"""PayPal Sandbox Orders API for the checkout page."""

from __future__ import annotations

import os
import uuid
from decimal import Decimal, InvalidOperation

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/paypal", tags=["paypal"])


def _settings() -> tuple[str, str, str]:
    client_id = os.getenv("PAYPAL_CLIENT_ID", "").strip()
    client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "").strip()
    base_url = os.getenv(
        "PAYPAL_BASE", "https://api-m.sandbox.paypal.com"
    ).rstrip("/")
    return client_id, client_secret, base_url


def _paypal_error(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:300] or f"PayPal returned HTTP {response.status_code}"
    return str(
        data.get("message")
        or data.get("error_description")
        or data.get("name")
        or f"PayPal returned HTTP {response.status_code}"
    )


async def _access_token() -> tuple[str, str]:
    client_id, client_secret, base_url = _settings()
    if not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="PayPal sandbox is not configured")

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{base_url}/v1/oauth2/token",
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json"},
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail=_paypal_error(response))
    return str(response.json()["access_token"]), base_url


@router.get("/config")
async def paypal_config():
    client_id, client_secret, _ = _settings()
    return {
        "configured": bool(client_id and client_secret),
        "client_id": client_id if client_id and client_secret else None,
        "currency": "USD",
        "sandbox": True,
    }


@router.post("/create-order")
async def create_order(body: dict):
    try:
        amount = Decimal(str(body.get("amount", ""))).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="A valid payment amount is required")
    if amount <= 0 or amount > Decimal("100000"):
        raise HTTPException(status_code=400, detail="Payment amount is out of range")

    token, base_url = await _access_token()
    reference_id = str(body.get("reference_id") or "Miles trip")[:127]
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": reference_id,
                "description": "Miles flight and hotel itinerary",
                "amount": {
                    "currency_code": "USD",
                    "value": f"{amount:.2f}",
                },
            }
        ],
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{base_url}/v2/checkout/orders",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": str(uuid.uuid4()),
            },
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail=_paypal_error(response))
    data = response.json()
    return {"order_id": data["id"], "status": data.get("status")}


@router.post("/capture-order/{order_id}")
async def capture_order(order_id: str):
    if not order_id or len(order_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid PayPal order ID")

    token, base_url = await _access_token()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{base_url}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail=_paypal_error(response))

    data = response.json()
    captures = (
        data.get("purchase_units", [{}])[0]
        .get("payments", {})
        .get("captures", [])
    )
    transaction_id = captures[0].get("id") if captures else order_id
    return {
        "ok": data.get("status") == "COMPLETED",
        "status": data.get("status"),
        "order_id": order_id,
        "transaction_id": transaction_id,
    }
