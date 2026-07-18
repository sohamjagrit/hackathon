from fastapi import APIRouter

from api.state import (
    get_active_session_id,
    get_hotel_call_proposal,
    load_active_booking,
    load_booking,
)

router = APIRouter()


@router.get("/context/hotel_call")
async def hotel_call_context():
    """Hotel agent pulls booking + proposed change (contracts: get_booking_context)."""
    booking = load_active_booking()
    if not booking:
        return {"error": "no active booking found"}

    session_id = booking.get("session_id") or get_active_session_id()
    proposal = get_hotel_call_proposal(session_id) or {}
    hotel = booking.get("hotel") or {}

    return {
        "pnr": booking.get("pnr"),
        "guest_name": proposal.get("guest_name")
        or booking.get("traveler_name")
        or booking.get("guest_name")
        or "Test Traveler",
        "hotel_name": proposal.get("hotel_name") or hotel.get("name"),
        "property_id": hotel.get("property_id"),
        "original_check_in": proposal.get("original_check_in") or hotel.get("check_in"),
        "original_check_out": proposal.get("original_check_out") or hotel.get("check_out"),
        "original_nights": proposal.get("original_nights")
        or hotel.get("nights")
        or booking.get("nights"),
        "new_check_in": proposal.get("new_check_in"),
        "new_check_out": proposal.get("new_check_out"),
        "new_nights": proposal.get("new_nights"),
        "flight_detail": proposal.get("flight_detail"),
        "goal": proposal.get("goal")
        or "Confirm the date change for this guest due to a rebooked flight.",
        "script_hint": (
            "Keep under 25 seconds. Confirm the new dates, ask one clarifying "
            "question if needed, then approve and hang up."
        ),
    }


def _enrich_itinerary(booking: dict) -> dict:
    return {
        **booking,
        "flight_cancelled": bool(booking.get("flight_cancelled")),
        "hotel_conflict": bool(booking.get("hotel_conflict")),
        "disruption": booking.get("disruption")
        or (
            {
                "cancelled_leg": "flight",
                "conflict_legs": ["hotel"],
            }
            if booking.get("flight_cancelled")
            else None
        ),
    }


@router.get("/tools/get_itinerary")
async def get_itinerary(session_id: str = "active"):
    """Act 2 VB tool: read-only itinerary fetch (query param)."""
    if session_id == "active":
        booking = load_active_booking()
    else:
        booking = load_booking(session_id)
    if not booking:
        return {"error": "booking not found", "session_id": session_id}
    return _enrich_itinerary(booking)


@router.post("/tools/get_itinerary")
async def get_itinerary_post(body: dict):
    """POST variant for VB api-tools."""
    sid = body.get("session_id", "active")
    if sid == "active":
        booking = load_active_booking()
    else:
        booking = load_booking(sid)
    if not booking:
        return {"error": "booking not found"}
    return _enrich_itinerary(booking)
