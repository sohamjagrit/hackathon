"""LangGraph node implementations for the Act 1 booking graph.

Each node is an async function. Nodes that need user input call interrupt()
which pauses the graph and returns speech to the voice agent. The user's next
utterance is passed as the resume value.

Rule: every node that produces options emits an SSE event before interrupting.
The dashboard fills in while the agent is speaking.
"""

import asyncio
import json
import os
from typing import Optional

from langchain_anthropic import ChatAnthropic
from langgraph.types import interrupt

from api.state import emit_event, persist_booking
import sabre.client as sabre
from graph.state import TripState

_llm = ChatAnthropic(
    model="claude-haiku-4-5-20251001",
    temperature=0,
    max_tokens=512,
    api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
)


# ---------------------------------------------------------------------------
# Helper: LLM calls
# ---------------------------------------------------------------------------

async def _llm_json(prompt: str) -> dict:
    """Call Claude and parse the JSON response."""
    msg = await _llm.ainvoke([{"role": "user", "content": prompt}])
    text = msg.content if isinstance(msg.content, str) else str(msg.content)
    # Strip markdown fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


# ---------------------------------------------------------------------------
# Node: understand
# ---------------------------------------------------------------------------

async def understand(state: TripState) -> dict:
    """Parse the user's opening utterance into a structured trip intent.
    If the intent can't be parsed, returns speech asking for clarification."""
    query = state.get("last_query", "")

    prompt = f"""Extract a trip booking request from this user message.
Return JSON only — no markdown, no explanation.

Message: "{query}"

JSON schema:
{{
  "origin": "IATA airport code or null if not specified",
  "destination": "IATA airport code (infer from city if needed)",
  "depart_date": "YYYY-MM-DD (use 2026-07-18 for 'this Friday' or 'Friday')",
  "nights": integer_or_4_if_not_stated,
  "pax": integer_or_1_if_not_stated,
  "understood": true_or_false
}}

Today is 2026-07-15. Use MCO as the default origin if the user doesn't specify.
Common destination hints: Cancún=CUN, New York=JFK, LA=LAX, Miami=MIA."""

    try:
        parsed = await _llm_json(prompt)
    except Exception:
        return {
            "speech": "I didn't quite catch that. Could you tell me where you'd like to go and when?",
        }

    if not parsed.get("understood") or not parsed.get("destination"):
        return {
            "speech": "I'd love to help you book a trip! Where would you like to go, and when?",
        }

    from datetime import date, timedelta
    depart = parsed.get("depart_date") or "2026-07-18"
    nights = int(parsed.get("nights") or 4)
    try:
        dep_date = date.fromisoformat(depart)
        ret_date = dep_date + timedelta(days=nights)
        return_date = ret_date.isoformat()
    except ValueError:
        depart = "2026-07-18"
        return_date = "2026-07-22"
        nights = 4

    return {
        "origin": parsed.get("origin") or "MCO",
        "destination": parsed.get("destination", "CUN"),
        "depart_date": depart,
        "return_date": return_date,
        "nights": nights,
        "pax": int(parsed.get("pax") or 1),
    }


# ---------------------------------------------------------------------------
# Node: parallel_search
# ---------------------------------------------------------------------------

async def parallel_search(state: TripState) -> dict:
    """Fire flight and hotel searches concurrently.

    Both MCP calls run via asyncio.gather. Flight options are emitted to the
    dashboard immediately so that card fills in right away. Hotel options are
    stored in state but NOT emitted here — search_and_pick_hotel reveals them
    only after the user has confirmed their flight selection.
    """
    session_id = state["session_id"]
    origin = state.get("origin", "MCO")
    destination = state.get("destination", "CUN")
    depart_date = state.get("depart_date", "2026-07-18")
    return_date = state.get("return_date", "2026-07-22")
    pax = state.get("pax", 1)

    await emit_event(session_id, "leg_status", {"leg": "flight", "status": "loading"})
    await emit_event(session_id, "leg_status", {"leg": "hotel", "status": "loading"})

    flight_opts, hotel_opts = await asyncio.gather(
        sabre.search_flights(origin, destination, depart_date, pax),
        sabre.search_hotels(destination, depart_date, return_date, pax),
    )

    # Reveal flights now; hotel card waits until flight is picked
    await emit_event(session_id, "flight_options", {"options": flight_opts})
    await emit_event(session_id, "leg_status", {"leg": "flight", "status": "options"})

    return {"flight_options": flight_opts, "hotel_options": hotel_opts}


# ---------------------------------------------------------------------------
# Node: search_and_pick_flight
# ---------------------------------------------------------------------------

async def search_and_pick_flight(state: TripState) -> dict:
    """Read pre-fetched flight options from state, interrupt with options, record selection."""
    session_id = state["session_id"]
    options = state.get("flight_options", [])

    if not options:
        return {"speech": "I couldn't find any flights for those dates. Want to try different dates?"}

    # Build speech — mention cheapest + best nonstop
    nonstops = [o for o in options if o.get("stops", 1) == 0]
    with_stop = [o for o in options if o.get("stops", 0) > 0]
    cheapest = min(options, key=lambda o: o["price_usd"])
    if nonstops:
        best = min(nonstops, key=lambda o: o["price_usd"])
        alt = cheapest if cheapest != best else (with_stop[0] if with_stop else None)
        speech = (
            f"I found {len(options)} options. "
            f"The nonstop at {_time(best['depart'])} is ${best['price_usd']}."
        )
        if alt and alt != best:
            speech += f" There's also a {_stops(alt['stops'])} at {_time(alt['depart'])} for ${alt['price_usd']} if you want to save a bit. Which would you like?"
        else:
            speech += " Want that one?"
    else:
        speech = (
            f"I found {len(options)} options. "
            f"The cheapest is ${cheapest['price_usd']} at {_time(cheapest['depart'])}. "
            "Would you like that one, or should I list the others?"
        )

    # Interrupt: speak the options and wait for user choice
    user_response = interrupt(speech)

    # Parse selection
    chosen = await _pick_option(options, user_response, "flight")
    if chosen is None:
        # Can't determine — ask again (simplified: pick first)
        chosen = options[0]

    await emit_event(
        session_id,
        "leg_status",
        {"leg": "flight", "status": "selected", "selected_id": chosen["id"], "detail": _flight_detail(chosen)},
    )

    return {"selected_flight": chosen, "flight_options": options}


# ---------------------------------------------------------------------------
# Node: search_and_pick_hotel
# ---------------------------------------------------------------------------

async def search_and_pick_hotel(state: TripState) -> dict:
    session_id = state["session_id"]
    destination = state.get("destination", "CUN")
    depart_date = state.get("depart_date", "2026-07-18")
    return_date = state.get("return_date", "2026-07-22")

    await emit_event(session_id, "leg_status", {"leg": "hotel", "status": "loading"})
    options = await sabre.search_hotels(destination, depart_date, return_date)
    await emit_event(session_id, "hotel_options", {"options": options})
    await emit_event(session_id, "leg_status", {"leg": "hotel", "status": "options"})

    nights = state.get("nights", 4)
    best = min(options, key=lambda o: o["rate_usd"])
    speech = (
        f"For hotels, I have {len(options)} options near the beach. "
        f"The {best['name'].split()[0]} {best['name'].split()[1]} is ${best['rate_usd']} a night — "
        f"it has a pool and ocean views. "
    )
    if len(options) > 1:
        second = options[1] if options[1] != best else options[0]
        speech += f"Or there's the {second['name'].split()[0]} for ${second['rate_usd']}. Which do you prefer?"
    else:
        speech += "Want that one?"

    user_response = interrupt(speech)

    chosen = await _pick_option(options, user_response, "hotel")
    if chosen is None:
        chosen = best

    await emit_event(
        session_id,
        "leg_status",
        {"leg": "hotel", "status": "selected", "selected_id": chosen["id"], "detail": _hotel_detail(chosen)},
    )

    return {"selected_hotel": chosen, "hotel_options": options}


# ---------------------------------------------------------------------------
# Node: search_and_pick_car
# ---------------------------------------------------------------------------

async def search_and_pick_car(state: TripState) -> dict:
    session_id = state["session_id"]
    destination = state.get("destination", "CUN")
    depart_date = state.get("depart_date", "2026-07-18")
    return_date = state.get("return_date", "2026-07-22")

    await emit_event(session_id, "leg_status", {"leg": "car", "status": "loading"})
    options = await sabre.search_cars(destination, depart_date, return_date)
    await emit_event(session_id, "car_options", {"options": options})
    await emit_event(session_id, "leg_status", {"leg": "car", "status": "options"})

    mid = next((o for o in options if "mid" in o.get("category", "").lower()), options[0])
    speech = (
        f"For the car, Hertz has a mid-size for ${mid['rate_usd_per_day']} a day — "
        f"picked up at the airport when you land. Want that, or would you prefer something else?"
    )

    user_response = interrupt(speech)

    # User might skip ("no thanks") or pick
    if any(w in user_response.lower() for w in ["no", "skip", "don't", "dont", "pass"]):
        await emit_event(session_id, "leg_status", {"leg": "car", "status": "confirmed", "detail": "No car rental"})
        return {"selected_car": None, "car_options": options}

    chosen = await _pick_option(options, user_response, "car")
    if chosen is None:
        chosen = mid

    await emit_event(
        session_id,
        "leg_status",
        {"leg": "car", "status": "selected", "selected_id": chosen["id"], "detail": _car_detail(chosen)},
    )

    return {"selected_car": chosen, "car_options": options}


# ---------------------------------------------------------------------------
# Node: confirm
# ---------------------------------------------------------------------------

async def confirm(state: TripState) -> dict:
    """Read back the full itinerary and get explicit approval before booking."""
    session_id = state["session_id"]
    flight = state.get("selected_flight", {})
    hotel = state.get("selected_hotel", {})
    car = state.get("selected_car")

    flight_price = flight.get("price_usd", 0)
    hotel_price = hotel.get("rate_usd", 0) * state.get("nights", 4)
    car_price = (car.get("total_usd", 0) if car else 0)
    total = flight_price + hotel_price + car_price

    lines = [
        f"Here's your trip:",
        f"Flight: {_flight_detail(flight)} — ${flight_price}.",
        f"Hotel: {_hotel_detail(hotel)} — ${hotel_price} total.",
    ]
    if car:
        lines.append(f"Car: {_car_detail(car)} — ${car_price}.")
    lines.append(f"Grand total: ${total}. Shall I book it?")

    speech = " ".join(lines)
    user_response = interrupt(speech)

    # Check if user confirmed
    affirmed = any(w in user_response.lower() for w in ["yes", "book", "go", "do it", "confirm", "yep", "sure"])
    if not affirmed:
        return {"speech": "No problem — let me know if you'd like to change anything."}

    return {"total_usd": float(total)}


# ---------------------------------------------------------------------------
# Node: commit_booking
# ---------------------------------------------------------------------------

async def commit_booking(state: TripState) -> dict:
    """Call Sabre (or fixture) to create the booking, persist it, emit SSE."""
    session_id = state["session_id"]
    flight = state.get("selected_flight", {})
    hotel = state.get("selected_hotel", {})
    car = state.get("selected_car")

    booking = await sabre.create_booking(
        session_id=session_id,
        flight_id=flight.get("offer_id", flight.get("id", "")),
        hotel_id=hotel.get("property_id", hotel.get("id", "")),
        car_id=car.get("rate_key", car.get("id", "")) if car else None,
    )

    pnr = booking.get("pnr", "DEMO01")

    # Persist for Act 2
    persist_booking(session_id, {
        "session_id": session_id,
        "pnr": pnr,
        "flight": flight,
        "hotel": hotel,
        "car": car,
        "nights": state.get("nights", 4),
        "total_usd": state.get("total_usd", 0),
    })

    await emit_event(
        session_id,
        "booking_confirmed",
        {
            "pnr": pnr,
            "total_usd": state.get("total_usd", 0),
            "itinerary": {
                "flight": {"id": flight.get("id", ""), "detail": _flight_detail(flight)},
                "hotel":  {"id": hotel.get("id", ""), "detail": _hotel_detail(hotel)},
                "car":    {"id": car.get("id", "") if car else "", "detail": _car_detail(car) if car else "none"},
            },
        },
    )

    return {"pnr": pnr}


# ---------------------------------------------------------------------------
# Node: close
# ---------------------------------------------------------------------------

async def close(state: TripState) -> dict:
    """Final node: generate confirmation speech and interrupt to speak it."""
    pnr = state.get("pnr", "DEMO01")
    flight = state.get("selected_flight", {})
    hotel = state.get("selected_hotel", {})
    car = state.get("selected_car")

    speech = (
        f"You're all set! "
        f"{_flight_detail(flight)}, "
        f"{hotel.get('name', 'hotel')} for {state.get('nights', 4)} nights"
        f"{', ' + _car_detail(car) if car else ''}. "
        f"Confirmation number is {pnr}. Have a great trip!"
    )

    # Final interrupt so the voice agent speaks the closing line
    interrupt(speech)
    return {"speech": speech}


# ---------------------------------------------------------------------------
# Helpers: option picking
# ---------------------------------------------------------------------------

async def _pick_option(options: list, user_response: str, leg: str) -> Optional[dict]:
    """Use Claude to figure out which option the user chose from their utterance."""
    if not options:
        return None

    # Quick heuristic first (avoids an LLM call on common cases)
    resp_lower = user_response.lower()
    for opt in options:
        # Match by explicit flight number
        fn = opt.get("flight_number", "")
        if fn and fn.lower() in resp_lower:
            return opt
        # Match "first", "second", "third"
        ordinals = {"first": 0, "second": 1, "third": 2, "one": 0, "two": 1, "three": 2}
        for word, idx in ordinals.items():
            if word in resp_lower and idx < len(options):
                return options[idx]
        # Match vendor / name
        name = opt.get("vendor") or opt.get("name") or ""
        if name and name.lower().split()[0] in resp_lower:
            return opt

    # Fall back to LLM
    opts_str = "\n".join(
        f"id={o['id']} | {o.get('flight_number') or o.get('name') or o.get('vendor', '')} | ${o.get('price_usd') or o.get('rate_usd') or o.get('rate_usd_per_day', 0)}"
        for o in options
    )
    prompt = f"""The user is choosing a {leg}. Their response: "{user_response}"

Options:
{opts_str}

Return JSON: {{"chosen_id": "<id or null if unclear>"}}"""
    try:
        result = await _llm_json(prompt)
        chosen_id = result.get("chosen_id")
        if chosen_id:
            return next((o for o in options if o["id"] == chosen_id), None)
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Helpers: speech formatting
# ---------------------------------------------------------------------------

def _time(dt_str: str) -> str:
    if not dt_str:
        return "?"
    t = dt_str.split("T")[-1][:5]  # "HH:MM"
    h, m = int(t[:2]), int(t[3:5])
    ampm = "am" if h < 12 else "pm"
    h = h % 12 or 12
    return f"{h}:{m:02d}{ampm}"


def _stops(n: int) -> str:
    return "nonstop" if n == 0 else f"{n}-stop"


def _flight_detail(f: Optional[dict]) -> str:
    if not f:
        return "flight"
    fn = f.get("flight_number", "")
    depart = _time(f.get("depart", ""))
    stops = _stops(f.get("stops", 0))
    price = f.get("price_usd", "")
    return f"{fn} {depart} {stops}" + (f" ${price}" if price else "")


def _hotel_detail(h: Optional[dict]) -> str:
    if not h:
        return "hotel"
    name = h.get("name", "hotel")
    rate = h.get("rate_usd", "")
    nights = h.get("nights", "")
    return f"{name}" + (f" ${rate}/night" if rate else "") + (f" {nights} nights" if nights else "")


def _car_detail(c: Optional[dict]) -> str:
    if not c:
        return "no car"
    vendor = c.get("vendor", "")
    cat = c.get("category", "")
    rate = c.get("rate_usd_per_day", "")
    return f"{vendor} {cat}" + (f" ${rate}/day" if rate else "")
