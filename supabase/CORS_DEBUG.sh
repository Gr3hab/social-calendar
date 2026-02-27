#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_REF=xxxx TEST_CODE=TESTCODE_123 ORIGIN=http://localhost:3000 ./supabase/CORS_DEBUG.sh
# Optional:
#   FUNCTION_NAME=public-event-hardened

FUNCTION_NAME="${FUNCTION_NAME:-public-event-hardened}"
ORIGIN="${ORIGIN:-http://localhost:3000}"
PROJECT_REF="${PROJECT_REF:?Set PROJECT_REF env var (your Supabase project ref)}"
TEST_CODE="${TEST_CODE:-TESTCODE_123}"

URL="https://${PROJECT_REF}.functions.supabase.co/${FUNCTION_NAME}?code=$(python3 - <<'PY'
import os, urllib.parse
print(urllib.parse.quote(os.environ.get("TEST_CODE","TESTCODE_123")))
PY
)"

echo "== CORS DEBUG =="
echo "URL:    $URL"
echo "Origin: $ORIGIN"
echo

# OPTIONS preflight
echo "-- Preflight (OPTIONS) --"
curl -s -D - -o /dev/null \
  -X OPTIONS \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type, apikey, authorization" \
  "$URL" | grep -iE 'HTTP/|access-control-allow-origin|vary|access-control-allow-methods|access-control-allow-headers' || true

echo
# GET request
echo "-- Actual (GET) --"
curl -s -D - -o /dev/null \
  -H "Origin: ${ORIGIN}" \
  "$URL" | grep -iE 'HTTP/|access-control-allow-origin|vary|cache-control|x-frame-options|x-content-type-options|referrer-policy' || true

echo
echo "Expected:"
echo "  - Access-Control-Allow-Origin: ${ORIGIN}  (NOT *)"
echo "  - Vary: Origin"
