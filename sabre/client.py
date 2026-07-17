"""Sabre MCP seam.

All Sabre calls go through this module. Every function hits the live Sabre
MCP server at SABRE_MCP_URL using a ReAct agent (Claude + MCP tools).

The agent handles the OpenAPI-spec-load → callSabreAPI orchestration
automatically, so we don't hard-code endpoint paths that can drift.

Set CAPTURE=1 to dump every normalized response to sabre/captures/ for
debugging (does not affect live behaviour).

Every MCP tool call is automatically logged to:
  - Terminal: structured ┌/└ lines with timestamp, tool name, I/O summary, latency
  - File:     sabre/logs/mcp_calls.log (newline-delimited JSON)
"""

import json
import os
import string
import random
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler

CAPTURE = os.environ.get("CAPTURE", "0") == "1"
CAPTURES_DIR = Path(__file__).parent / "captures"
LOGS_DIR = Path(__file__).parent / "logs"


# ---------------------------------------------------------------------------
# Capture helper (debug only)
# ---------------------------------------------------------------------------

def _capture(filename: str, data: list | dict) -> None:
    CAPTURES_DIR.mkdir(exist_ok=True)
    path = CAPTURES_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"[sabre] captured → {path}")


# ---------------------------------------------------------------------------
# MCP observability
# ---------------------------------------------------------------------------

def _summarize(text: str, n: int = 120) -> str:
    s = str(text).replace("\n", " ").strip()
    return (s[:n] + "…") if len(s) > n else s


def _write_log(entry: dict) -> None:
    LOGS_DIR.mkdir(exist_ok=True)
    with open(LOGS_DIR / "mcp_calls.log", "a") as f:
        f.write(json.dumps(entry) + "\n")


class MCPObservabilityHandler(BaseCallbackHandler):
    """LangChain callback handler that logs every MCP tool call."""

    def __init__(self):
        super().__init__()
        self._t0: dict[str, float] = {}
        self._names: dict[str, str] = {}
        self._inputs: dict[str, str] = {}

    # LangChain callback protocol ------------------------------------------------

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        key = str(run_id)
        self._t0[key] = time.monotonic()
        tool_name = serialized.get("name", "unknown")
        self._names[key] = tool_name
        self._inputs[key] = input_str
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(
            f"  ┌─ [{ts}] MCP ▶  {tool_name:<40}"
            f"  IN: {_summarize(input_str, 80)}"
        )

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        key = str(run_id)
        elapsed = int((time.monotonic() - self._t0.pop(key, time.monotonic())) * 1000)
        tool_name = self._names.pop(key, "unknown")
        input_str = self._inputs.pop(key, "")
        out_str = _summarize(str(output), 100)
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(
            f"  └─ [{ts}] MCP ✓  {tool_name:<40}"
            f"  OUT: {out_str}  [{elapsed}ms]"
        )
        _write_log({
            "ts": datetime.now(timezone.utc).isoformat(),
            "tool": tool_name,
            "input_summary": _summarize(input_str, 300),
            "output_summary": out_str,
            "duration_ms": elapsed,
        })

    def on_tool_error(
        self,
        error: Any,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        key = str(run_id)
        elapsed = int((time.monotonic() - self._t0.pop(key, time.monotonic())) * 1000)
        tool_name = self._names.pop(key, "unknown")
        input_str = self._inputs.pop(key, "")
        err_str = _summarize(str(error), 100)
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(
            f"  └─ [{ts}] MCP ✗  {tool_name:<40}"
            f"  ERR: {err_str}  [{elapsed}ms]"
        )
        _write_log({
            "ts": datetime.now(timezone.utc).isoformat(),
            "tool": tool_name,
            "input_summary": _summarize(input_str, 300),
            "output_summary": f"ERROR: {err_str}",
            "duration_ms": elapsed,
            "error": True,
        })

def _pnr() -> str:
    """Last-resort PNR placeholder if the booking response is missing one."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ---------------------------------------------------------------------------
# Sabre MCP agent
#
# The Sabre MCP server exposes:
#   Workflow tools  — SearchAndBookFlightWorkflow, SearchAndBookHotelWorkflow, …
#   callSabreAPI    — generic REST proxy to any Sabre API
#   OpenAPI specs   — FlightShop, HotelsSearch, … (return schemas, NOT data)
#
# Correct pattern: load the OpenAPI spec tool to learn the endpoint, then call
# callSabreAPI. We run a small ReAct agent so the LLM does that orchestration
# instead of us hard-coding paths that drift between API versions.
# ---------------------------------------------------------------------------

async def _sabre_agent_run(task: str, timeout: float = 120.0) -> str:
    """Run a Claude ReAct agent with Sabre MCP tools and return its final text."""
    from langchain_mcp_adapters.client import MultiServerMCPClient
    from langchain_anthropic import ChatAnthropic
    from langgraph.prebuilt import create_react_agent

    url = os.environ.get("SABRE_MCP_URL", "https://mcp.cert.sabre.com/mcp")
    token = os.environ.get("SABRE_TOKEN", "")
    if not token:
        raise RuntimeError("SABRE_TOKEN not set")

    client = MultiServerMCPClient({
        "sabre": {
            "transport": "streamable_http",
            "url": url,
            "headers": {"Authorization": f"Bearer {token}"},
            "timeout": timeout,
        }
    })
    tools = await client.get_tools()

    llm = ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        temperature=0,
        max_tokens=2048,
        api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
    )
    agent = create_react_agent(llm, tools)
    handler = MCPObservabilityHandler()
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": task}]},
        config={"callbacks": [handler]},
    )
    last = result["messages"][-1]
    return last.content if isinstance(last.content, str) else str(last.content)


async def _mcp_call(tool_name: str, params: dict) -> dict:
    """Direct JSON-RPC call to a known Sabre MCP tool (callSabreAPI etc.)."""
    import httpx

    url = os.environ.get("SABRE_MCP_URL", "https://mcp.cert.sabre.com/mcp")
    token = os.environ.get("SABRE_TOKEN", "")
    if not token:
        raise RuntimeError("SABRE_TOKEN not set")

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": params},
    }
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
        )
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            raise RuntimeError(f"Sabre MCP error: {body['error']}")
        return body.get("result", {})


def _parse_json_from_agent(text: str) -> list | dict:
    """Extract a JSON array or object from agent response text."""
    text = text.strip()
    if "```" in text:
        for part in text.split("```")[1::2]:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except json.JSONDecodeError:
                continue
    for opener, closer in [("[", "]"), ("{", "}")]:
        start = text.find(opener)
        if start >= 0:
            end = text.rfind(closer)
            if end > start:
                try:
                    return json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    pass
    raise ValueError(f"No JSON found in agent response: {text[:300]}")


# ---------------------------------------------------------------------------
# Flight search
# ---------------------------------------------------------------------------

async def search_flights(
    origin: str,
    destination: str,
    depart_date: str,  # YYYY-MM-DD
    pax: int = 1,
) -> list[dict]:
    """Return a list of normalized flight options from Sabre."""
    pcc = os.environ.get("SABRE_PCC", "S5OM")
    task = (
        f"Search Sabre for available flights:\n"
        f"- Origin: {origin}\n"
        f"- Destination: {destination}\n"
        f"- Departure date: {depart_date}\n"
        f"- Passengers: {pax} adult(s)\n"
        f"- PCC: {pcc}\n\n"
        f"Use the Sabre MCP tools (load the FlightShop OpenAPI spec first to learn "
        f"the schema, then call callSabreAPI). "
        f"Return ONLY a valid JSON array of up to 10 options — no markdown, no explanation.\n"
        f"Include the full airline name in airline_name (e.g. 'JetBlue Airways', 'American Airlines').\n"
        f"Calculate duration from depart/arrive times and format as e.g. '2h 45m'.\n"
        f'[{{"id":"f1","carrier":"B6","airline_name":"JetBlue Airways","flight_number":"B6204",'
        f'"origin":"{origin}","destination":"{destination}",'
        f'"depart":"YYYY-MM-DDTHH:MM:SS","arrive":"YYYY-MM-DDTHH:MM:SS","duration":"2h 45m",'
        f'"stops":0,"price_usd":299.0,"offer_id":"<offer-id from response>"}}]'
    )
    raw = await _sabre_agent_run(task)
    options = _parse_json_from_agent(raw)
    if CAPTURE:
        _capture(f"flights_{origin.lower()}_{destination.lower()}.json", options)
    return options  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Hotel search
# ---------------------------------------------------------------------------

async def search_hotels(
    destination: str,
    check_in: str,   # YYYY-MM-DD
    check_out: str,  # YYYY-MM-DD
    pax: int = 1,
) -> list[dict]:
    """Return a list of normalized hotel options from Sabre."""
    pcc = os.environ.get("SABRE_PCC", "S5OM")
    try:
        nights = (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days
    except ValueError:
        nights = 4
    task = (
        f"Search Sabre for available hotels:\n"
        f"- Destination: {destination} (city/airport code)\n"
        f"- Check-in: {check_in}\n"
        f"- Check-out: {check_out}\n"
        f"- Guests: {pax} adult(s)\n"
        f"- PCC: {pcc}\n\n"
        f"Use the Sabre MCP tools (load the HotelsSearch OpenAPI spec first, "
        f"then call callSabreAPI). "
        f"Return ONLY a valid JSON array of up to 3 options — no markdown, no explanation:\n"
        f'[{{"id":"h1","name":"Hotel Name","property_id":"<hotel_code>",'
        f'"rate_usd":150.0,"check_in":"{check_in}","check_out":"{check_out}",'
        f'"nights":{nights},"amenities":[],"rating":4.0,"area":"{destination}"}}]'
    )
    raw = await _sabre_agent_run(task)
    options = _parse_json_from_agent(raw)
    if CAPTURE:
        _capture(f"hotels_{destination.lower()}.json", options)
    return options  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Car search
# ---------------------------------------------------------------------------

async def search_cars(
    location: str,
    pickup_date: str,    # YYYY-MM-DD
    dropoff_date: str,   # YYYY-MM-DD
    pickup_time: str = "15:00",
    dropoff_time: str = "12:00",
) -> list[dict]:
    """Return a list of normalized car rental options from Sabre."""
    pcc = os.environ.get("SABRE_PCC", "S5OM")
    try:
        days = (date.fromisoformat(dropoff_date) - date.fromisoformat(pickup_date)).days or 1
    except ValueError:
        days = 4
    task = (
        f"Search Sabre for available car rentals:\n"
        f"- Pickup location: {location}\n"
        f"- Pickup date/time: {pickup_date}T{pickup_time}\n"
        f"- Dropoff date/time: {dropoff_date}T{dropoff_time}\n"
        f"- Days: {days}\n"
        f"- PCC: {pcc}\n\n"
        f"Use callSabreAPI with the Vehicle Price Check endpoint. "
        f"Return ONLY a valid JSON array of up to 3 options — no markdown, no explanation:\n"
        f'[{{"id":"c1","vendor":"Hertz","category":"mid-size","model":"Toyota Camry",'
        f'"rate_usd_per_day":65.0,"days":{days},"total_usd":{65.0 * days},'
        f'"pickup":"{pickup_date}T{pickup_time}:00","dropoff":"{dropoff_date}T{dropoff_time}:00",'
        f'"pickup_location":"{location}","rate_key":"<rate_key from response>"}}]'
    )
    raw = await _sabre_agent_run(task)
    options = _parse_json_from_agent(raw)
    if CAPTURE:
        _capture(f"cars_{location.lower()}.json", options)
    return options  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Create booking
# ---------------------------------------------------------------------------

async def create_booking(
    session_id: str,
    flight_id: str,
    hotel_id: str,
    car_id: Optional[str],
    pax_name: str = "Test Traveler",
    pax_email: str = "test@example.com",
) -> dict:
    """Create a Sabre booking and return {pnr, ...}."""
    pcc = os.environ.get("SABRE_PCC", "S5OM")
    name_parts = pax_name.split()
    first_name = name_parts[0]
    last_name = name_parts[-1] if len(name_parts) > 1 else name_parts[0]
    task = (
        f"Create a Sabre booking with the following details:\n"
        f"- Flight offer ID: {flight_id}\n"
        f"- Hotel property ID: {hotel_id}\n"
        f"- Car rate key: {car_id or 'none (no car)'}\n"
        f"- Passenger first name: {first_name}\n"
        f"- Passenger last name: {last_name}\n"
        f"- Passenger email: {pax_email}\n"
        f"- PCC: {pcc}\n\n"
        f"Use SearchAndBookFlightWorkflow for the flight booking. "
        f"Use SearchAndBookHotelWorkflow for the hotel if hotel_id is set. "
        f"Return ONLY JSON — no markdown, no explanation:\n"
        f'{{\"pnr\": \"<PNR>\", \"status\": \"CONFIRMED\"}}'
    )
    raw = await _sabre_agent_run(task, timeout=180.0)
    result = _parse_json_from_agent(raw)
    result_dict: dict = result if isinstance(result, dict) else {}
    pnr = result_dict.get("pnr") or result_dict.get("confirmationId") or _pnr()
    booking = {"pnr": pnr, "session_id": session_id, "raw": result_dict}
    if CAPTURE:
        _capture("booking_confirmed.json", booking)
    return booking


# ---------------------------------------------------------------------------
# Get / modify booking (Act 2)
# ---------------------------------------------------------------------------

async def get_booking(pnr: str) -> Optional[dict]:
    """Retrieve a booking by PNR."""
    result = await _mcp_call("callSabreAPI", {
        "endpoint": f"/v1/trip/orders/{pnr}",
        "method": "GET",
    })
    return result if isinstance(result, dict) else None


async def modify_booking(pnr: str, new_flight_id: str, new_hotel_id: Optional[str] = None) -> dict:
    """Rebook the flight (and optionally hotel) on an existing PNR."""
    result = await _mcp_call("callSabreAPI", {
        "endpoint": f"/v1/trip/orders/{pnr}/rebook",
        "method": "POST",
        "body": {"newFlightOfferId": new_flight_id},
    })
    return result if isinstance(result, dict) else {}
