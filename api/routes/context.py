from fastapi import APIRouter

from api.state import load_active_booking, load_booking

router = APIRouter()


@router.get("/context/hotel_call")
async def hotel_call_context():
    """Hotel agent pulls its context here (contracts/tools.json: get_booking_context).
    Keyed by most-recent active booking for a scripted single-session demo."""
    booking = load_active_booking()
    if not booking:
        return {"error": "no active booking found"}
    return booking


@router.get("/tools/get_itinerary")
async def get_itinerary(session_id: str):
    """Act 2 VB direct tool: read-only itinerary fetch. No LangGraph round-trip."""
    booking = load_booking(session_id)
    if not booking:
        return {"error": "booking not found", "session_id": session_id}
    return booking


@router.post("/tools/get_itinerary")
async def get_itinerary_post(body: dict):
    """POST variant — tools.json declares method POST."""
    sid = body.get("session_id", "active")
    if sid == "active":
        booking = load_active_booking()
    else:
        booking = load_booking(sid)
    if not booking:
        return {"error": "booking not found"}
    return booking
