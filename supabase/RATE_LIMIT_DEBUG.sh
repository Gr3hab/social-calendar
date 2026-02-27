#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_REF=xxxx TEST_CODE=TESTCODE_123 ORIGIN=http://localhost:3000 ./supabase/RATE_LIMIT_DEBUG.sh
# Optional:
#   FUNCTION_NAME=public-event-hardened MAX=40

FUNCTION_NAME="${FUNCTION_NAME:-public-event-hardened}"
ORIGIN="${ORIGIN:-http://localhost:3000}"
PROJECT_REF="${PROJECT_REF:?Set PROJECT_REF env var}"
TEST_CODE="${TEST_CODE:-TESTCODE_123}"
MAX="${MAX:-40}"

URL="https://${PROJECT_REF}.functions.supabase.co/${FUNCTION_NAME}?code=$(python3 - <<'PY'
import os, urllib.parse
print(urllib.parse.quote(os.environ.get("TEST_CODE","TESTCODE_123")))
PY
)"

echo "== RATE LIMIT DEBUG =="
echo "URL:    $URL"
echo "Origin: $ORIGIN"
echo "MAX:    $MAX"
echo

hit_429=0
for i in $(seq 1 "$MAX"); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: ${ORIGIN}" "$URL" || echo "000")
  printf "%02d -> %s\n" "$i" "$code"
  if [[ "$code" == "429" ]]; then
    echo "🚨 RATE LIMIT TRIGGERED at request #$i"
    hit_429=1
    break
  fi
done

if [[ "$hit_429" -eq 0 ]]; then
  echo "⚠️ No 429 observed. Either:"
  echo "  - maxPerMin too high, or"
  echo "  - key/window logic not working, or"
  echo "  - rate_limits table writes failing."
  exit 1
fi
