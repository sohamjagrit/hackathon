#!/usr/bin/env bash
# Patch Act 2 HTTP tool URLs with PUBLIC_BASE_URL and print paths for vb config set.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${PUBLIC_BASE_URL:?Set PUBLIC_BASE_URL to your HTTPS tunnel, e.g. https://xyz.trycloudflare.com}"
if [[ "$PUBLIC_BASE_URL" == *"YOUR-TUNNEL"* || "$PUBLIC_BASE_URL" == *"example.com"* ]]; then
  echo "ERROR: PUBLIC_BASE_URL looks like a placeholder: $PUBLIC_BASE_URL"
  exit 1
fi
PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}"
OUT="${TMPDIR:-/tmp}/miles-act2-tools"
mkdir -p "$OUT"
sed "s|https://REPLACE_WITH_PUBLIC_BASE_URL|${PUBLIC_BASE_URL}|g" \
  "$ROOT/agents/traveler_tools.json" > "$OUT/traveler_tools.json"
sed "s|https://REPLACE_WITH_PUBLIC_BASE_URL|${PUBLIC_BASE_URL}|g" \
  "$ROOT/agents/hotel_tools.json" > "$OUT/hotel_tools.json"
echo "Patched:"
echo "  $OUT/traveler_tools.json"
echo "  $OUT/hotel_tools.json"
echo
echo "Push with:"
echo "  vb agent use \$VB_TRAVELER_AGENT_ID"
echo "  vb config set --api-tools-file $OUT/traveler_tools.json"
echo "  vb agent use \$VB_HOTEL_AGENT_ID"
echo "  vb config set --api-tools-file $OUT/hotel_tools.json"
echo "  vb agent use \$VB_AGENT_ID   # restore Miles"
