import asyncio
import json
import os
from dataclasses import dataclass, field
from typing import Optional

BOOKINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "bookings.json")


@dataclass
class LegState:
    status: str = "empty"
    options: list = field(default_factory=list)
    selected_id: Optional[str] = None
    detail: Optional[str] = None


@dataclass
class SessionState:
    session_id: str
    flight: LegState = field(default_factory=LegState)
    hotel: LegState = field(default_factory=LegState)
    pnr: Optional[str] = None
    total_usd: Optional[float] = None
    # Raw options stored for booking lookup
    flight_options: list = field(default_factory=list)
    hotel_options: list = field(default_factory=list)
    selected_flight: Optional[dict] = None
    selected_hotel: Optional[dict] = None
    # Trip context
    origin: str = ""
    destination: str = ""
    depart_date: str = ""
    return_date: str = ""
    nights: int = 4
    pax: int = 1


sessions: dict[str, SessionState] = {}
event_queues: dict[str, asyncio.Queue] = {}

# Last session_id registered via /api/voice-token — used by init tool
active_session_id: Optional[str] = None

# Act 2: proposed hotel change for the nested hotel-agent pull
hotel_call_proposals: dict[str, dict] = {}


def get_or_create_session(session_id: str) -> SessionState:
    if session_id not in sessions:
        sessions[session_id] = SessionState(session_id=session_id)
        event_queues[session_id] = asyncio.Queue()
    return sessions[session_id]


def set_active_session(session_id: str) -> None:
    global active_session_id
    active_session_id = session_id
    get_or_create_session(session_id)


def get_active_session_id() -> Optional[str]:
    return active_session_id


async def emit_event(session_id: str, event_type: str, payload: dict) -> None:
    if session_id not in event_queues:
        event_queues[session_id] = asyncio.Queue()
    await event_queues[session_id].put(
        {"type": event_type, "session_id": session_id, "payload": payload}
    )


def _read_all_bookings() -> dict:
    if not os.path.exists(BOOKINGS_FILE):
        return {}
    with open(BOOKINGS_FILE) as f:
        return json.load(f)


def persist_booking(session_id: str, data: dict) -> None:
    existing = _read_all_bookings()
    data = {**data, "session_id": session_id}
    existing[session_id] = data
    with open(BOOKINGS_FILE, "w") as f:
        json.dump(existing, f, indent=2)


def load_booking(session_id: str) -> Optional[dict]:
    return _read_all_bookings().get(session_id)


def load_booking_by_pnr(pnr: str) -> Optional[dict]:
    """Find a persisted booking by confirmation code (case-insensitive)."""
    needle = (pnr or "").strip().upper()
    if not needle:
        return None
    for booking in _read_all_bookings().values():
        if str(booking.get("pnr", "")).strip().upper() == needle:
            return booking
    return None


def load_active_booking() -> Optional[dict]:
    bookings = _read_all_bookings()
    if not bookings:
        return None
    if active_session_id and active_session_id in bookings:
        return bookings[active_session_id]
    return list(bookings.values())[-1]


def set_hotel_call_proposal(session_id: str, proposal: dict) -> None:
    hotel_call_proposals[session_id] = proposal


def get_hotel_call_proposal(session_id: Optional[str] = None) -> Optional[dict]:
    sid = session_id or active_session_id
    if sid and sid in hotel_call_proposals:
        return hotel_call_proposals[sid]
    if hotel_call_proposals:
        return list(hotel_call_proposals.values())[-1]
    return None
