import asyncio
import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from api.state import emit_event, event_queues, get_or_create_session, load_booking

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


@router.post("/debug/cancel/{pnr}")
async def debug_cancel(pnr: str):
    """Act 2 trigger: marks the outbound flight cancelled and queues the
    recovery job. Will be wired to LangGraph in Act 2 work."""
    # TODO Act 2: load booking by pnr, emit recovery_started, launch vb call
    return {"ok": True, "pnr": pnr, "note": "recovery trigger not yet implemented"}


@router.get("/debug/booking/{session_id}")
async def debug_booking(session_id: str):
    """Inspect persisted booking — useful during dev."""
    return load_booking(session_id) or {"error": "not found"}
