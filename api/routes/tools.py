"""VB HTTP tool endpoints.

Miles calls these directly during a conversation. Each endpoint:
  1. Emits SSE events so the dashboard updates in real-time
  2. Calls Sabre MCP via sabre/client.py
  3. Returns plain JSON that Miles reads aloud / acts on

Session ID bridge: Miles calls /tools/init first to get the active
session_id, then passes it in every subsequent tool call.
"""

import logging

from fastapi import APIRouter

import sabre.client as sabre
from api.state import (
    emit_event,
    get_active_session_id,
    get_or_create_session,
    persist_booking,
    set_active_session,
)

router = APIRouter(prefix="/tools")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Init — Miles calls this first to get the session_id
# ---------------------------------------------------------------------------

@router.post("/init")
async def init_session(body: dict = None):
    body = body or {}
    session_id = body.get("session_id") or get_active_session_id()
    if not session_id:
        # No session registered yet — create one so Miles can proceed.
        # Client actions will still reach the dashboard once the browser
        # registers its session_id via /api/voice-token.
        import uuid
        session_id = str(uuid.uuid4())
        set_active_session(session_id)
        logger.warning("init called with no active session — created fallback %s", session_id)
    get_or_create_session(session_id)
    return {"session_id": session_id, "status": "ready"}


# ---------------------------------------------------------------------------
# Search flights
# ---------------------------------------------------------------------------

@router.post("/search_flights")
async def search_flights(body: dict):
    session_id = body.get("session_id", "")
    origin = body.get("origin", "MCO")
    destination = body.get("destination", "CUN")
    depart_date = body.get("depart_date", "")
    return_date = body.get("return_date", "")
    pax = int(body.get("pax", 1))

    if not session_id:
        return {"error": "session_id required"}

    session = get_or_create_session(session_id)
    session.origin = origin
    session.destination = destination
    session.depart_date = depart_date
    session.return_date = return_date
    session.pax = pax

    await emit_event(session_id, "leg_status", {"leg": "flight", "status": "loading"})

    try:
        options = await sabre.search_flights(origin, destination, depart_date, pax)
    except Exception as e:
        logger.exception("Flight search failed")
        await emit_event(session_id, "leg_status", {"leg": "flight", "status": "empty"})
        return {"error": f"Flight search failed: {e}"}

    session.flight_options = options
    session.flight.options = options
    session.flight.status = "options"

    await emit_event(session_id, "flight_options", {"options": options})
    await emit_event(session_id, "leg_status", {"leg": "flight", "status": "options"})

    # Build a compact text summary for Miles to read
    lines = []
    for i, f in enumerate(options[:10], 1):
        airline = f.get("airline_name") or f.get("carrier", "")
        fn = f.get("flight_number", "")
        depart = _fmt_time(f.get("depart", ""))
        arrive = _fmt_time(f.get("arrive", ""))
        stops = "nonstop" if f.get("stops", 1) == 0 else f"{f.get('stops', 1)} stop"
        duration = f.get("duration", "")
        price = f.get("price_usd", 0)
        dur_str = f" {duration}" if duration else ""
        lines.append(f"{i}. {airline} {fn} — {depart}→{arrive}{dur_str} {stops} ${price}")

    return {
        "found": len(options),
        "options": options,
        "flights": lines,
        "message": f"Found {len(options)} flights. Trigger client action show_flights with the options array. Options are showing on screen.",
    }


# ---------------------------------------------------------------------------
# Select flight
# ---------------------------------------------------------------------------

@router.post("/select_flight")
async def select_flight(body: dict):
    session_id = body.get("session_id", "")
    offer_id = body.get("offer_id", "")

    if not session_id or not offer_id:
        return {"error": "session_id and offer_id required"}

    session = get_or_create_session(session_id)

    # Find the matching option
    chosen = next(
        (f for f in session.flight_options if f.get("offer_id") == offer_id or f.get("id") == offer_id),
        None,
    )
    if not chosen:
        return {"error": f"No flight with offer_id={offer_id}. Ask the user to pick again."}

    session.selected_flight = chosen
    session.flight.selected_id = chosen.get("id", offer_id)
    session.flight.status = "selected"

    airline = chosen.get("airline_name") or chosen.get("carrier", "")
    fn = chosen.get("flight_number", "")
    depart = _fmt_time(chosen.get("depart", ""))
    stops = "nonstop" if chosen.get("stops", 1) == 0 else f"{chosen.get('stops')} stop"
    price = chosen.get("price_usd", 0)
    detail = f"{airline} {fn}, {depart}, {stops}, ${price}"

    session.flight.detail = detail

    await emit_event(session_id, "leg_status", {
        "leg": "flight",
        "status": "selected",
        "selected_id": chosen.get("id", offer_id),
        "detail": detail,
    })

    return {"selected": True, "flight": detail, "offer_id": offer_id}


# ---------------------------------------------------------------------------
# Search hotels
# ---------------------------------------------------------------------------

@router.post("/search_hotels")
async def search_hotels(body: dict):
    session_id = body.get("session_id", "")
    destination = body.get("destination", "")
    check_in = body.get("check_in", "")
    check_out = body.get("check_out", "")
    pax = int(body.get("pax", 1))

    if not session_id:
        return {"error": "session_id required"}

    session = get_or_create_session(session_id)
    if not destination:
        destination = session.destination
    if not check_in:
        check_in = session.depart_date
    if not check_out:
        check_out = session.return_date

    from datetime import date
    try:
        nights = (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days
    except Exception:
        nights = session.nights or 4
    session.nights = nights

    await emit_event(session_id, "leg_status", {"leg": "hotel", "status": "loading"})

    try:
        options = await sabre.search_hotels(destination, check_in, check_out, pax)
    except Exception as e:
        logger.exception("Hotel search failed")
        await emit_event(session_id, "leg_status", {"leg": "hotel", "status": "empty"})
        return {"error": f"Hotel search failed: {e}"}

    session.hotel_options = options
    session.hotel.options = options
    session.hotel.status = "options"

    await emit_event(session_id, "hotel_options", {"options": options})
    await emit_event(session_id, "leg_status", {"leg": "hotel", "status": "options"})

    lines = []
    for i, h in enumerate(options[:10], 1):
        name = h.get("name", "Hotel")
        rate = h.get("rate_usd", 0)
        rating = h.get("rating", 0)
        amenities = ", ".join(h.get("amenities", [])[:2])
        stars = f"{rating}★" if rating else ""
        lines.append(f"{i}. {name} {stars} — ${rate}/night{' · ' + amenities if amenities else ''}")

    return {
        "found": len(options),
        "options": options,
        "hotels": lines,
        "nights": nights,
        "message": f"Found {len(options)} hotels for {nights} nights. Trigger client action show_hotels with the options array. Options showing on screen.",
    }


# ---------------------------------------------------------------------------
# Select hotel
# ---------------------------------------------------------------------------

@router.post("/select_hotel")
async def select_hotel(body: dict):
    session_id = body.get("session_id", "")
    property_id = body.get("property_id", "")

    if not session_id or not property_id:
        return {"error": "session_id and property_id required"}

    session = get_or_create_session(session_id)

    chosen = next(
        (h for h in session.hotel_options if h.get("property_id") == property_id or h.get("id") == property_id),
        None,
    )
    if not chosen:
        return {"error": f"No hotel with property_id={property_id}. Ask the user to pick again."}

    session.selected_hotel = chosen
    session.hotel.selected_id = chosen.get("id", property_id)
    session.hotel.status = "selected"

    name = chosen.get("name", "Hotel")
    rate = chosen.get("rate_usd", 0)
    nights = session.nights
    total = rate * nights
    detail = f"{name}, ${rate}/night, {nights} nights (${total} total)"

    session.hotel.detail = detail
    session.total_usd = (session.selected_flight or {}).get("price_usd", 0) + total

    await emit_event(session_id, "leg_status", {
        "leg": "hotel",
        "status": "selected",
        "selected_id": chosen.get("id", property_id),
        "detail": detail,
    })

    return {"selected": True, "hotel": detail, "property_id": property_id}


# ---------------------------------------------------------------------------
# Book — commits everything selected
# ---------------------------------------------------------------------------

@router.post("/book")
async def book(body: dict):
    session_id = body.get("session_id", "")
    if not session_id:
        return {"error": "session_id required"}

    session = get_or_create_session(session_id)

    # Accept IDs directly from Miles (MCP flow) or fall back to stored selections
    flight_id = body.get("flight_offer_id") or (session.selected_flight or {}).get("offer_id") or (session.selected_flight or {}).get("id", "")
    hotel_id = body.get("hotel_property_id") or (session.selected_hotel or {}).get("property_id") or (session.selected_hotel or {}).get("id", "")

    flight = session.selected_flight
    hotel = session.selected_hotel

    if not flight_id and not hotel_id:
        return {"error": "Nothing to book. Provide flight_offer_id or hotel_property_id."}

    try:
        booking = await sabre.create_booking(
            session_id=session_id,
            flight_id=flight_id,
            hotel_id=hotel_id,
            car_id=None,
        )
    except Exception as e:
        logger.exception("Booking failed")
        return {"error": f"Booking failed: {e}"}

    pnr = booking.get("pnr", "UNKNOWN")
    session.pnr = pnr

    total = session.total_usd or 0

    if flight:
        await emit_event(session_id, "leg_status", {"leg": "flight", "status": "confirmed", "detail": session.flight.detail})
    if hotel:
        await emit_event(session_id, "leg_status", {"leg": "hotel", "status": "confirmed", "detail": session.hotel.detail})

    itinerary = {}
    if flight:
        itinerary["flight"] = {"id": flight.get("id", ""), "detail": session.flight.detail or ""}
    if hotel:
        itinerary["hotel"] = {"id": hotel.get("id", ""), "detail": session.hotel.detail or ""}

    await emit_event(session_id, "booking_confirmed", {
        "pnr": pnr,
        "total_usd": total,
        "itinerary": itinerary,
    })

    persist_booking(session_id, {
        "session_id": session_id,
        "pnr": pnr,
        "flight": flight,
        "hotel": hotel,
        "nights": session.nights,
        "total_usd": total,
    })

    return {
        "booked": True,
        "pnr": pnr,
        "total_usd": total,
        "message": f"Booking confirmed! PNR is {pnr}. Total ${total}.",
    }


# ---------------------------------------------------------------------------
# Deselect — clear a leg so the user can re-pick
# ---------------------------------------------------------------------------

@router.post("/deselect")
async def deselect(body: dict):
    session_id = body.get("session_id", "")
    leg = body.get("leg", "")  # "flight" or "hotel"

    if not session_id or leg not in ("flight", "hotel"):
        return {"error": "session_id and leg ('flight' or 'hotel') required"}

    session = get_or_create_session(session_id)

    if leg == "flight":
        session.selected_flight = None
        session.flight.selected_id = None
        session.flight.status = "options" if session.flight_options else "empty"
        await emit_event(session_id, "leg_status", {"leg": "flight", "status": session.flight.status})
    else:
        session.selected_hotel = None
        session.hotel.selected_id = None
        session.hotel.status = "options" if session.hotel_options else "empty"
        await emit_event(session_id, "leg_status", {"leg": "hotel", "status": session.hotel.status})

    return {"deselected": True, "leg": leg, "message": f"{leg.capitalize()} selection cleared. Options still showing on screen."}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_time(iso: str) -> str:
    if not iso:
        return "?"
    t = iso.split("T")[-1][:5]
    try:
        h, m = int(t[:2]), int(t[3:5])
        ampm = "am" if h < 12 else "pm"
        return f"{h % 12 or 12}:{m:02d}{ampm}"
    except Exception:
        return t
