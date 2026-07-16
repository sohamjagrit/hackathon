import asyncio
import json
import os
from dataclasses import dataclass, field
from typing import Optional

BOOKINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "bookings.json")


@dataclass
class LegState:
    status: str = "empty"
    # Status values: empty | loading | options | selected | confirmed
    #                conflict | cancelled | pending_change  (Act 2 only)
    options: list[dict] = field(default_factory=list)
    selected_id: Optional[str] = None
    detail: Optional[str] = None


@dataclass
class SessionState:
    session_id: str
    flight: LegState = field(default_factory=LegState)
    hotel: LegState = field(default_factory=LegState)
    car: LegState = field(default_factory=LegState)
    pnr: Optional[str] = None
    transaction_id: Optional[str] = None
    total_usd: Optional[float] = None


# In-memory session state (reset on restart — fine for dev)
sessions: dict[str, SessionState] = {}

# Per-session SSE queues
event_queues: dict[str, asyncio.Queue] = {}


def get_or_create_session(session_id: str) -> SessionState:
    if session_id not in sessions:
        sessions[session_id] = SessionState(session_id=session_id)
        event_queues[session_id] = asyncio.Queue()
    return sessions[session_id]


async def emit_event(session_id: str, event_type: str, payload: dict) -> None:
    if session_id not in event_queues:
        event_queues[session_id] = asyncio.Queue()
    await event_queues[session_id].put(
        {"type": event_type, "session_id": session_id, "payload": payload}
    )


def persist_booking(session_id: str, data: dict) -> None:
    existing: dict = {}
    if os.path.exists(BOOKINGS_FILE):
        with open(BOOKINGS_FILE) as f:
            existing = json.load(f)
    existing[session_id] = data
    with open(BOOKINGS_FILE, "w") as f:
        json.dump(existing, f, indent=2)


def load_booking(session_id: str) -> Optional[dict]:
    if not os.path.exists(BOOKINGS_FILE):
        return None
    with open(BOOKINGS_FILE) as f:
        return json.load(f).get(session_id)


def load_active_booking() -> Optional[dict]:
    """Most recent confirmed booking — used by hotel agent context pull."""
    if not os.path.exists(BOOKINGS_FILE):
        return None
    with open(BOOKINGS_FILE) as f:
        bookings: dict = json.load(f)
    if not bookings:
        return None
    return list(bookings.values())[-1]
