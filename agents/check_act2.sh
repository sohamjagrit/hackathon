#!/usr/bin/env bash
# Validate Act 2 env + reachability before a demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

ok=0
fail=0
check() {
  local label="$1" cond="$2" hint="$3"
  if eval "$cond"; then
    echo "  OK  $label"
    ok=$((ok+1))
  else
    echo "  FAIL  $label — $hint"
    fail=$((fail+1))
  fi
}

echo "Act 2 readiness"
echo "---------------"
check "VOCAL_BRIDGE_API_KEY" '[[ -n "${VOCAL_BRIDGE_API_KEY:-}" ]]' "set in .env"
check "VB_AGENT_ID (Miles)" '[[ -n "${VB_AGENT_ID:-}" ]]' "Act 1 agent id"
check "PUBLIC_BASE_URL set" '[[ -n "${PUBLIC_BASE_URL:-}" && "$PUBLIC_BASE_URL" != *YOUR-TUNNEL* && "$PUBLIC_BASE_URL" != *example.com* ]]' "start tunnel, paste https URL"
check "TRAVELER_PHONE E.164" '[[ "${TRAVELER_PHONE:-}" =~ ^\+[0-9]{10,15}$ ]]' "e.g. +14155551234"
check "HOTEL_PHONE E.164" '[[ "${HOTEL_PHONE:-}" =~ ^\+[0-9]{10,15}$ ]]' "teammate phone, e.g. +14155555678"
check "VB_TRAVELER_AGENT_ID" '[[ -n "${VB_TRAVELER_AGENT_ID:-}" ]]' "run ./agents/setup_act2.sh"
check "VB_HOTEL_AGENT_ID" '[[ -n "${VB_HOTEL_AGENT_ID:-}" ]]' "run ./agents/setup_act2.sh"
check "mcp_servers.json" '[[ -f agents/mcp_servers.json ]]' "gitignored; must contain Sabre"
check "traveler prompt" '[[ -f agents/traveler_prompt.txt ]]' "missing file"
check "hotel prompt" '[[ -f agents/hotel_prompt.txt ]]' "missing file"

if [[ -n "${PUBLIC_BASE_URL:-}" && "$PUBLIC_BASE_URL" != *YOUR-TUNNEL* && "$PUBLIC_BASE_URL" != *example.com* ]]; then
  base="${PUBLIC_BASE_URL%/}"
  if curl -fsS --max-time 8 "$base/health" >/dev/null 2>&1; then
    echo "  OK  tunnel /health reachable via $base"
    ok=$((ok+1))
  else
    echo "  FAIL  tunnel /health — is uvicorn on :8000 and tunnel pointed at it?"
    fail=$((fail+1))
  fi
  if curl -fsS --max-time 8 -X POST "$base/tools/get_itinerary" \
      -H 'Content-Type: application/json' \
      -d '{"session_id":"active"}' >/dev/null 2>&1; then
    echo "  OK  POST /tools/get_itinerary via tunnel"
    ok=$((ok+1))
  else
    echo "  FAIL  POST /tools/get_itinerary via tunnel"
    fail=$((fail+1))
  fi
fi

echo "---------------"
echo "$ok checks passed, $fail failed"
[[ "$fail" -eq 0 ]]
