import asyncio
import os

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse
import json

from api.state import (
    emit_event,
    event_queues,
    get_or_create_session,
    load_booking,
    load_booking_by_pnr,
    persist_booking,
    set_active_session,
)
from api.vb_call import vb_call

router = APIRouter()


@router.get("/events")
async def sse_events(session_id: str, request: Request):
    """SSE stream for the dashboard. Dashboard subscribes once and reacts to
    events pushed from the graph. Read-only — no events flow from dashboard
    to backend."""
    get_or_create_session(session_id)
    queue = event_queues[session_id]

    async def generate():
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15)
                yield {"data": json.dumps(event)}
            except asyncio.TimeoutError:
                yield {"comment": "heartbeat"}

    return EventSourceResponse(generate())


@router.post("/debug/emit")
async def debug_emit(body: dict):
    """Push an arbitrary SSE event for dashboard dev without needing the
    graph or Sabre. Use this to build and test card states."""
    session_id: str = body.get("session_id", "debug")
    get_or_create_session(session_id)
    await emit_event(session_id, body["type"], body.get("payload", {}))
    return {"ok": True}


@router.post("/debug/persist-booking")
async def debug_persist_booking(body: dict):
    """Act 1 → Act 2 handoff: dashboard POSTs the confirmed trip snapshot."""
    session_id = body.get("session_id")
    pnr = body.get("pnr")
    if not session_id or not pnr:
        return {"ok": False, "error": "session_id and pnr required"}
    persist_booking(session_id, body)
    set_active_session(session_id)
    return {"ok": True, "session_id": session_id, "pnr": pnr}


@router.post("/debug/cancel/{pnr}")
async def debug_cancel(pnr: str):
    """Act 2 trigger: mark outbound flight cancelled, push dashboard conflict
    states, then place an outbound VB call to the traveler."""
    booking = load_booking_by_pnr(pnr)
    if not booking:
        return {"ok": False, "error": f"no booking found for PNR {pnr}"}

    session_id = booking.get("session_id") or "active"
    set_active_session(session_id)
    get_or_create_session(session_id)

    booking = {
        **booking,
        "flight_cancelled": True,
        "hotel_conflict": True,
        "disruption": {
            "cancelled_leg": "flight",
            "conflict_legs": ["hotel"],
        },
    }
    persist_booking(session_id, booking)

    await emit_event(
        session_id,
        "recovery_started",
        {
            "pnr": booking.get("pnr", pnr),
            "cancelled_leg": "flight",
            "conflict_legs": ["hotel"],
        },
    )

    traveler_phone = os.getenv("TRAVELER_PHONE", "").strip()
    traveler_agent = os.getenv("VB_TRAVELER_AGENT_ID", "").strip()
    ring_delay = float(os.getenv("ACT2_RING_DELAY_S", "2.5"))

    if traveler_phone:
        asyncio.create_task(
            _ring_traveler(session_id, traveler_phone, traveler_agent or None, ring_delay)
        )
        call_note = "traveler call queued"
    else:
        call_note = "TRAVELER_PHONE unset — SSE emitted only; no outbound call"

    return {
        "ok": True,
        "session_id": session_id,
        "pnr": booking.get("pnr", pnr),
        "note": call_note,
    }


async def _ring_traveler(
    session_id: str,
    phone: str,
    agent_id: str | None,
    delay_s: float,
) -> None:
    await asyncio.sleep(delay_s)
    try:
        result = await vb_call(
            phone,
            agent_id=agent_id,
            name="Traveler",
            timeout_s=float(os.getenv("ACT2_TRAVELER_CALL_TIMEOUT_S", "600")),
        )
        if not result["ok"]:
            await emit_event(
                session_id,
                "hotel_call_status",
                {
                    "status": "failed",
                    "transcript_line": f"Traveler call failed: {result.get('stderr') or result.get('stdout')}",
                },
            )
    except Exception as exc:  # noqa: BLE001 — surface to dashboard for demo debug
        await emit_event(
            session_id,
            "hotel_call_status",
            {"status": "failed", "transcript_line": f"Traveler call error: {exc}"},
        )


@router.get("/debug/booking-by-pnr/{pnr}")
async def debug_booking_by_pnr(pnr: str):
    """Look up a persisted booking by confirmation code (Act 2 UI)."""
    booking = load_booking_by_pnr(pnr)
    if not booking:
        return {"error": "not found", "pnr": pnr}
    return booking


@router.get("/debug/booking/{session_id}")
async def debug_booking(session_id: str):
    """Inspect persisted booking — useful during dev."""
    return load_booking(session_id) or {"error": "not found"}
