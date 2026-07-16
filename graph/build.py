"""Booking graph construction.

The graph handles Act 1's booking flow: intent → search flights → pick →
search hotels → pick → search cars → pick → confirm → commit → close.

Each search+pick step uses interrupt() to pause and wait for the user's
choice before proceeding. The caller (api/routes/agent.py) invokes the
graph and extracts the interrupt value as the speech to return.
"""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from graph.nodes import (
    close,
    commit_booking,
    confirm,
    search_and_pick_car,
    search_and_pick_flight,
    search_and_pick_hotel,
    understand,
)
from graph.state import TripState

_checkpointer = MemorySaver()
_graph = None


def _should_continue_after_confirm(state: TripState) -> str:
    """If user declined at confirm, end. Otherwise commit."""
    if state.get("pnr"):
        return "commit"  # already committed (shouldn't happen here, but safe)
    if state.get("total_usd") is not None:
        return "commit"
    return END


def _build() -> object:
    builder = StateGraph(TripState)

    builder.add_node("understand", understand)
    builder.add_node("search_and_pick_flight", search_and_pick_flight)
    builder.add_node("search_and_pick_hotel", search_and_pick_hotel)
    builder.add_node("search_and_pick_car", search_and_pick_car)
    builder.add_node("confirm", confirm)
    builder.add_node("commit_booking", commit_booking)
    builder.add_node("close", close)

    builder.set_entry_point("understand")

    builder.add_edge("understand", "search_and_pick_flight")
    builder.add_edge("search_and_pick_flight", "search_and_pick_hotel")
    builder.add_edge("search_and_pick_hotel", "search_and_pick_car")
    builder.add_edge("search_and_pick_car", "confirm")
    builder.add_conditional_edges(
        "confirm",
        _should_continue_after_confirm,
        {"commit": "commit_booking", END: END},
    )
    builder.add_edge("commit_booking", "close")
    builder.add_edge("close", END)

    return builder.compile(checkpointer=_checkpointer, interrupt_before=[])


def get_graph():
    global _graph
    if _graph is None:
        _graph = _build()
    return _graph


def get_config(session_id: str) -> dict:
    return {"configurable": {"thread_id": session_id}}
