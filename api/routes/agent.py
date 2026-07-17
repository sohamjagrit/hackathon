"""Kept as a stub — LangGraph removed. All booking logic now lives in /tools/*.

If you need a simple text relay for testing, POST here with
{"session_id": "...", "query": "..."} and it returns {"speech": "ok"}.
"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/agent/query")
async def agent_query(body: dict):
    return {"speech": "I'm now powered by direct VB tools. Use the voice interface."}
