"""The one door into LangGraph (contracts/agent_query.md).

Both Act 1 (web relay via useAIAgent.onQuery) and Act 2 (phone HTTP tools)
call this endpoint. Nothing else reaches the graph.
"""

import logging

from fastapi import APIRouter
from langgraph.types import Command

from api.state import get_or_create_session
from graph.build import get_config, get_graph

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/agent/query")
async def agent_query(body: dict):
    session_id: str = body.get("session_id", "")
    query: str = body.get("query", "")

    if not session_id:
        return {"speech": "Session ID is required."}

    get_or_create_session(session_id)
    graph = get_graph()
    config = get_config(session_id)

    try:
        # Check if there's an ongoing (interrupted) session for this thread
        state_snapshot = await graph.aget_state(config)
        has_pending_interrupt = bool(
            state_snapshot.tasks and any(t.interrupts for t in state_snapshot.tasks)
        )

        if has_pending_interrupt:
            # Resume from the interrupt with the user's response
            await graph.ainvoke(Command(resume=query), config)
        else:
            # New session or fully-completed session — start fresh
            await graph.ainvoke(
                {"session_id": session_id, "last_query": query},
                config,
            )

        # Extract the speech from the new interrupt (if any) or state
        new_snapshot = await graph.aget_state(config)
        speech = _extract_speech(new_snapshot)

    except Exception as exc:
        logger.exception("Graph error for session %s", session_id)
        speech = "Something went wrong — please try again."

    return {"speech": speech}


def _extract_speech(snapshot) -> str:
    """Get the interrupt value (speech) from the current graph snapshot."""
    if snapshot.tasks:
        for task in snapshot.tasks:
            for intr in task.interrupts:
                val = intr.value
                return val if isinstance(val, str) else str(val)
    # Graph completed (no more interrupts) — get speech from state
    return snapshot.values.get("speech", "All done!")
