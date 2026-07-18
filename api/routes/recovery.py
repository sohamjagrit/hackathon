"""Act 2 recovery HTTP tools: nested hotel call."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter

from api.state import (
    emit_event,
    get_active_session_id,
    get_or_create_session,
    load_active_booking,
    load_booking,
    persist_booking,
    set_active_session,
    set_hotel_call_proposal,
)
from api.vb_call import vb_call

router = APIRouter()


def _resolve_booking(session_id: Optional[str]) -> tuple[Optional[str], Optional[dict]]:
    if session_id and session_id != "active":
        booking = load_booking(session_id)
        if booking:
            return session_id, booking
    booking = load_active_booking()
    if not booking:
        return None, None
    return booking.get("session_id") or get_active_session_id(), booking


def _default_hotel_proposal(booking: dict, body: dict) -> dict:
    hotel = booking.get("hotel") or {}
    flight = booking.get("flight") or {}
    check_in = body.get("new_check_in") or hotel.get("check_in")
    check_out = body.get("new_check_out") or hotel.get("check_out")
    nights = body.get("new_nights")
    if nights is None and check_in and check_out:
        try:
            nights = (
                datetime.fromisoformat(str(check_out)[:10])
                - datetime.fromisoformat(str(check_in)[:10])
            ).days
        except ValueError:
            nights = hotel.get("nights", 2)
    elif nights is None:
        # Demo default: shorten stay by one night when flight slips a day
        orig_nights = int(hotel.get("nights") or booking.get("nights") or 4)
        nights = max(1, orig_nights - 1)
        if check_in and not body.get("new_check_out"):
            try:
                check_out = (
                    datetime.fromisoformat(str(check_in)[:10]) + timedelta(days=nights)
                ).strftime("%Y-%m-%d")
            except ValueError:
                pass

    return {
        "guest_name": body.get("guest_name")
        or booking.get("traveler_name")
        or booking.get("guest_name")
        or "Test Traveler",
        "hotel_name": hotel.get("name"),
        "property_id": hotel.get("property_id"),
        "pnr": booking.get("pnr"),
        "original_check_in": hotel.get("check_in"),
        "original_check_out": hotel.get("check_out"),
        "original_nights": hotel.get("nights") or booking.get("nights"),
        "new_check_in": check_in,
        "new_check_out": check_out,
        "new_nights": nights,
        "flight_detail": body.get("flight_detail")
        or booking.get("recovery_flight_detail")
        or flight.get("detail")
        or (
            f"{flight.get('flight_number') or ''} "
            f"{(flight.get('depart') or '')[:16]}"
        ).strip()
        or None,
        "goal": body.get("goal")
        or f"Shorten the stay to {nights} nights (check-in {check_in}, check-out {check_out}) due to a rebooked arrival.",
    }


async def _run_hotel_call(
    session_id: str,
    booking: dict,
    proposal: dict,
    body: dict,
    contact_mode: str,
) -> dict:
    await emit_event(
        session_id,
        "hotel_call_status",
        {
            "status": "in_progress",
            "transcript_line": f"Calling {proposal.get('hotel_name') or 'the hotel'}…",
            "contact_mode": contact_mode,
        },
    )

    hotel_phone = os.getenv("HOTEL_PHONE", "").strip()
    hotel_agent = os.getenv("VB_HOTEL_AGENT_ID", "").strip()

    if not hotel_phone:
        await emit_event(
            session_id,
            "hotel_call_status",
            {
                "status": "failed",
                "transcript_line": "HOTEL_PHONE unset",
                "contact_mode": contact_mode,
            },
        )
        return {
            "ok": False,
            "outcome": "Hotel phone not configured. Tell the traveler you'll follow up.",
        }

    try:
        result = await vb_call(
            hotel_phone,
            agent_id=hotel_agent or None,
            name="Hotel Front Desk",
            timeout_s=float(os.getenv("ACT2_HOTEL_CALL_TIMEOUT_S", "280")),
        )
    except Exception as exc:  # noqa: BLE001
        await emit_event(
            session_id,
            "hotel_call_status",
            {
                "status": "failed",
                "transcript_line": str(exc),
                "contact_mode": contact_mode,
            },
        )
        return {
            "ok": False,
            "outcome": f"Hotel call failed ({exc}). Ask the traveler how to proceed.",
        }

    if not result["ok"]:
        await emit_event(
            session_id,
            "hotel_call_status",
            {
                "status": "failed",
                "transcript_line": result.get("stderr") or result.get("stdout") or "call failed",
                "contact_mode": contact_mode,
            },
        )
        return {
            "ok": False,
            "outcome": "The hotel did not confirm. Ask the traveler how to proceed.",
            "call": result,
        }

    # Update booking with modified hotel stay
    hotel = dict(booking.get("hotel") or {})
    hotel["check_in"] = proposal["new_check_in"]
    hotel["check_out"] = proposal["new_check_out"]
    hotel["nights"] = proposal["new_nights"]
    hotel["detail"] = (
        f"{hotel.get('name')}, {proposal['new_nights']} nights "
        f"({proposal['new_check_in']} → {proposal['new_check_out']}, modified)"
    )
    booking["hotel"] = hotel
    booking["hotel_conflict"] = False
    booking["flight_cancelled"] = False
    booking["nights"] = proposal["new_nights"]
    if body.get("flight_detail") or booking.get("recovery_flight_detail"):
        detail = body.get("flight_detail") or booking.get("recovery_flight_detail")
        flight = dict(booking.get("flight") or {})
        flight["detail"] = detail
        booking["flight"] = flight
    persist_booking(session_id, booking)

    itinerary: dict[str, Any] = {
        "flight": {
            "id": (booking.get("flight") or {}).get("id", "f1"),
            "detail": (booking.get("flight") or {}).get("detail")
            or booking.get("recovery_flight_detail")
            or "Rebooked flight",
        },
        "hotel": {
            "id": hotel.get("id", "h1"),
            "detail": hotel.get("detail"),
        },
    }

    await emit_event(
        session_id,
        "hotel_call_status",
        {
            "status": "completed",
            "transcript_line": f"Hotel confirmed {proposal['new_nights']} nights.",
            "contact_mode": contact_mode,
        },
    )
    await emit_event(
        session_id,
        "recovery_confirmed",
        {"pnr": booking.get("pnr"), "itinerary": itinerary},
    )

    nights = proposal["new_nights"]
    return {
        "ok": True,
        "outcome": (
            f"Hotel confirmed. Stay is now {nights} nights, "
            f"check-in {proposal['new_check_in']}, check-out {proposal['new_check_out']}."
        ),
        "pnr": booking.get("pnr"),
        "itinerary": itinerary,
    }


async def _call_hotel_then_callback(
    session_id: str,
    booking: dict,
    proposal: dict,
    body: dict,
) -> None:
    try:
        result = await _run_hotel_call(
            session_id,
            booking,
            proposal,
            body,
            contact_mode="callback",
        )
    except Exception as exc:  # noqa: BLE001
        result = {
            "ok": False,
            "outcome": f"The hotel call failed unexpectedly: {exc}",
        }
        await emit_event(
            session_id,
            "hotel_call_status",
            {
                "status": "failed",
                "transcript_line": str(exc),
                "contact_mode": "callback",
            },
        )

    latest = load_booking(session_id) or booking
    latest["recovery_callback_ready"] = True
    latest["recovery_callback_outcome"] = result.get("outcome")
    persist_booking(session_id, latest)

    traveler_phone = os.getenv("TRAVELER_PHONE", "").strip()
    traveler_agent = os.getenv("VB_TRAVELER_AGENT_ID", "").strip()
    if not traveler_phone:
        await emit_event(
            session_id,
            "traveler_callback_status",
            {
                "status": "failed",
                "transcript_line": "TRAVELER_PHONE unset; callback could not be placed.",
            },
        )
        latest["recovery_callback_ready"] = False
        persist_booking(session_id, latest)
        return

    await emit_event(
        session_id,
        "traveler_callback_status",
        {
            "status": "calling",
            "transcript_line": "The hotel call finished. Miles is calling the traveler now.",
        },
    )
    try:
        callback = await vb_call(
            traveler_phone,
            agent_id=traveler_agent or None,
            name="Traveler callback",
            timeout_s=float(os.getenv("ACT2_TRAVELER_CALL_TIMEOUT_S", "600")),
        )
        if not callback["ok"]:
            await emit_event(
                session_id,
                "traveler_callback_status",
                {
                    "status": "failed",
                    "transcript_line": (
                        callback.get("stderr")
                        or callback.get("stdout")
                        or "Traveler callback failed."
                    ),
                },
            )
            return
        await emit_event(
            session_id,
            "traveler_callback_status",
            {
                "status": "completed",
                "transcript_line": "Traveler callback completed.",
            },
        )
    except Exception as exc:  # noqa: BLE001
        await emit_event(
            session_id,
            "traveler_callback_status",
            {
                "status": "failed",
                "transcript_line": f"Traveler callback failed: {exc}",
            },
        )
    finally:
        latest = load_booking(session_id) or latest
        latest["recovery_callback_ready"] = False
        persist_booking(session_id, latest)


@router.post("/tools/call_hotel")
async def call_hotel(body: dict):
    """Place the required hotel call, either while holding or before callback."""
    session_id, booking = _resolve_booking(body.get("session_id"))
    if not booking or not session_id:
        return {
            "ok": False,
            "outcome": "No active booking found — cannot call the hotel.",
        }

    set_active_session(session_id)
    get_or_create_session(session_id)

    proposal = _default_hotel_proposal(booking, body)
    set_hotel_call_proposal(session_id, proposal)

    if body.get("flight_detail"):
        booking["recovery_flight_detail"] = body["flight_detail"]
    booking["proposed_hotel"] = {
        "check_in": proposal["new_check_in"],
        "check_out": proposal["new_check_out"],
        "nights": proposal["new_nights"],
    }
    contact_mode = (
        "callback" if body.get("contact_mode") == "callback" else "stay_on_line"
    )
    booking["hotel_contact_mode"] = contact_mode
    persist_booking(session_id, booking)

    if contact_mode == "callback":
        await emit_event(
            session_id,
            "traveler_callback_status",
            {
                "status": "queued",
                "transcript_line": "Callback will start immediately after the hotel call.",
            },
        )
        asyncio.create_task(
            _call_hotel_then_callback(session_id, booking, proposal, body)
        )
        return {
            "ok": True,
            "callback_queued": True,
            "outcome": (
                "The hotel call is now starting. Tell the traveler to hang up and use "
                "the hangup action. Miles will call back immediately after the hotel call."
            ),
        }

    return await _run_hotel_call(
        session_id,
        booking,
        proposal,
        body,
        contact_mode="stay_on_line",
    )
