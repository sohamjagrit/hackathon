#!/usr/bin/env bash
# Create / configure Act 2 VB agents and write IDs into .env.
# Prerequisites: VOCAL_BRIDGE_API_KEY in .env, PUBLIC_BASE_URL set to a live HTTPS tunnel,
# agents/mcp_servers.json present (Sabre bearer).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VB="${VB_CLI_PATH:-$(command -v vb || true)}"
if [[ -z "${VB}" && -x "$HOME/.local/bin/vb" ]]; then
  VB="$HOME/.local/bin/vb"
fi
if [[ -z "${VB}" ]]; then
  echo "ERROR: vb CLI not found. Install Vocal Bridge CLI first."
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${VOCAL_BRIDGE_API_KEY:?VOCAL_BRIDGE_API_KEY missing from .env}"
: "${PUBLIC_BASE_URL:?Set PUBLIC_BASE_URL to your HTTPS tunnel first (see agents/ACT2.md)}"

if [[ "$PUBLIC_BASE_URL" == *"YOUR-TUNNEL"* ]] || [[ "$PUBLIC_BASE_URL" == *"example.com"* ]]; then
  echo "ERROR: PUBLIC_BASE_URL is still a placeholder: $PUBLIC_BASE_URL"
  echo "Start a tunnel to localhost:8000, then set PUBLIC_BASE_URL to the https:// URL."
  exit 1
fi

PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}"
OUT="${TMPDIR:-/tmp}/miles-act2-tools"
mkdir -p "$OUT"
sed "s|https://REPLACE_WITH_PUBLIC_BASE_URL|${PUBLIC_BASE_URL}|g" \
  agents/traveler_tools.json > "$OUT/traveler_tools.json"
sed "s|https://REPLACE_WITH_PUBLIC_BASE_URL|${PUBLIC_BASE_URL}|g" \
  agents/hotel_tools.json > "$OUT/hotel_tools.json"
echo "Patched tool URLs → $OUT"

# Remember Miles so we can restore selection
MILES_ID="${VB_AGENT_ID:-}"

create_or_reuse() {
  local name="$1"
  "$VB" agent list --json 2>/dev/null | python3 -c "
import json,sys
name=sys.argv[1]
try:
  data=json.load(sys.stdin)
except Exception:
  sys.exit(0)
agents=data if isinstance(data,list) else data.get('agents',data.get('data',[]))
for a in agents or []:
  if a.get('name')==name:
    print(a.get('id') or a.get('agent_id') or '')
    break
" "$name" || true
}

echo ""
echo "=== Traveler Recovery agent ==="
TRAVELER_ID="$(create_or_reuse "Traveler Recovery")"
if [[ -z "$TRAVELER_ID" ]]; then
  CREATE_OUT="$("$VB" agent create \
    --name "Traveler Recovery" \
    --style Chatty \
    --deploy-targets phone \
    --hold-enabled true \
    --hangup-enabled true \
    --debug-mode true \
    --background-enabled true \
    --prompt-file agents/traveler_prompt.txt \
    --api-tools-file "$OUT/traveler_tools.json" \
    --json)"
  echo "$CREATE_OUT"
  TRAVELER_ID="$(echo "$CREATE_OUT" | python3 -c "
import json,sys,re
text=sys.stdin.read()
# vb prints a status line before JSON
m=re.search(r'\{[\s\S]*\}\s*$', text.strip())
d=json.loads(m.group(0) if m else text)
print(d.get('id') or d.get('agent_id') or (d.get('agent') or {}).get('id',''))
")"
fi
if [[ -z "$TRAVELER_ID" ]]; then
  echo "ERROR: could not determine Traveler Recovery agent id"
  exit 1
fi
echo "Traveler agent id: $TRAVELER_ID"

"$VB" agent use "$TRAVELER_ID"
"$VB" prompt set --file agents/traveler_prompt.txt
"$VB" config set \
  --outbound-enabled true --accept-outbound-tos \
  --continuous-mode true --continuous-mode-delay 3 \
  --hold-enabled true --hangup-enabled true \
  --debug-mode true \
  --background-enabled true \
  --ai-agent-enabled false \
  --mcp-servers-file agents/mcp_servers.json \
  --api-tools-file "$OUT/traveler_tools.json"

echo ""
echo "=== Hotel Front Desk agent ==="
HOTEL_ID="$(create_or_reuse "Hotel Front Desk")"
if [[ -z "$HOTEL_ID" ]]; then
  CREATE_OUT="$("$VB" agent create \
    --name "Hotel Front Desk" \
    --style Focused \
    --deploy-targets phone \
    --prompt-file agents/hotel_prompt.txt \
    --api-tools-file "$OUT/hotel_tools.json" \
    --json)"
  echo "$CREATE_OUT"
  HOTEL_ID="$(echo "$CREATE_OUT" | python3 -c "
import json,sys,re
text=sys.stdin.read()
m=re.search(r'\{[\s\S]*\}\s*$', text.strip())
d=json.loads(m.group(0) if m else text)
print(d.get('id') or d.get('agent_id') or (d.get('agent') or {}).get('id',''))
")"
fi
if [[ -z "$HOTEL_ID" ]]; then
  echo "ERROR: could not determine Hotel Front Desk agent id"
  exit 1
fi
echo "Hotel agent id: $HOTEL_ID"

"$VB" agent use "$HOTEL_ID"
"$VB" prompt set --file agents/hotel_prompt.txt
"$VB" config set \
  --outbound-enabled true --accept-outbound-tos \
  --ai-agent-enabled false \
  --api-tools-file "$OUT/hotel_tools.json"

# Restore Miles for Act 1 web
if [[ -n "$MILES_ID" ]]; then
  "$VB" agent use "$MILES_ID"
  echo "Restored Miles as selected agent ($MILES_ID)"
fi

# Upsert IDs into .env
upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    python3 - "$key" "$val" <<'PY'
import pathlib,sys
key,val=sys.argv[1],sys.argv[2]
p=pathlib.Path(".env")
lines=p.read_text().splitlines()
out=[]
for line in lines:
  if line.startswith(key+"="):
    out.append(f"{key}={val}")
  else:
    out.append(line)
p.write_text("\n".join(out)+"\n")
PY
  else
    echo "${key}=${val}" >> .env
  fi
}

upsert_env VB_TRAVELER_AGENT_ID "$TRAVELER_ID"
upsert_env VB_HOTEL_AGENT_ID "$HOTEL_ID"
upsert_env PUBLIC_BASE_URL "$PUBLIC_BASE_URL"

echo ""
echo "Done."
echo "  VB_TRAVELER_AGENT_ID=$TRAVELER_ID"
echo "  VB_HOTEL_AGENT_ID=$HOTEL_ID"
echo "  PUBLIC_BASE_URL=$PUBLIC_BASE_URL"
echo ""
echo "Still required in .env:"
echo "  TRAVELER_PHONE=+1...   (you have this if set)"
echo "  HOTEL_PHONE=+1...      (teammate playing front desk)"
echo ""
echo "Verify: vb agent list"
