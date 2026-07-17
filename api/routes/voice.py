import httpx
from fastapi import APIRouter, HTTPException

from api.config import settings
from api.state import set_active_session

router = APIRouter()


@router.post("/api/voice-token")
async def voice_token(body: dict):
    if not settings.vocal_bridge_api_key:
        raise HTTPException(500, "VOCAL_BRIDGE_API_KEY not configured")

    session_id = body.get("session_id")
    if session_id:
        set_active_session(session_id)

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
                "session_id": session_id,
            },
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
