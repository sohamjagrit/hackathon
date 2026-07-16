import httpx
from fastapi import APIRouter, HTTPException

from api.config import settings

router = APIRouter()


@router.post("/api/voice-token")
async def voice_token(body: dict):
    """Mint a VB LiveKit token server-side. The session_id ties the voice
    session to the LangGraph thread and the SSE stream."""
    if not settings.vocal_bridge_api_key:
        raise HTTPException(500, "VOCAL_BRIDGE_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://vocalbridgeai.com/api/v1/token",
            headers={
                "X-API-Key": settings.vocal_bridge_api_key,
                "X-Agent-Id": settings.vb_agent_id,
                "Content-Type": "application/json",
            },
            json={
                "participant_name": body.get("participant_name", "Traveler"),
                "session_id": body.get("session_id"),
            },
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
