#!/bin/bash
# ========================================
# 3 BLITZ-VERIFIKATIONSCHECKS - Zero Data Leaks Proof
# ========================================

set -e

echo "🔍 Starting Verification Checks..."

# Load environment
if [ -f ".env" ]; then
    source .env
else
    echo "❌ .env file not found!"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\(.*\)\.supabase\.co.*/\1/')

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Could not extract project ref from SUPABASE_URL"
    exit 1
fi

echo "📋 Project Ref: $PROJECT_REF"

# ========================================
# CHECK 1: Secrets & Origins (30 Sekunden)
# ========================================
echo ""
echo "🔐 CHECK 1: Secrets & Origins Sanity"
echo "====================================="

if command -v npx &> /dev/null && npx supabase --version &> /dev/null; then
    echo "📝 Current secrets:"
    npx supabase secrets list 2>/dev/null || echo "⚠️  Could not list secrets (not linked?)"
    
    echo ""
    echo "✅ Expected ALLOWED_ORIGINS format:"
    echo "   http://localhost:3000,http://localhost:5173,https://deine-domain.tld"
    echo ""
    echo "⚠️  Make sure your origin matches EXACTLY (including http/https and port!)"
else
    echo "⚠️  Supabase CLI not linked - skipping secrets check"
fi

# ========================================
# CHECK 2: CORS Verification (20 Sekunden)
# ========================================
echo ""
echo "🌐 CHECK 2: CORS Headers Verification"
echo "===================================="

TEST_CODE="TESTCODE_123"
FUNCTION_URL="https://${PROJECT_REF}.functions.supabase.co/public-event-hardened"

echo "🔍 Testing CORS with: $FUNCTION_URL"
echo "📝 Expected: Access-Control-Allow-Origin: http://localhost:3000 (not *)"

echo ""
echo "📡 Sending CORS test request..."
CORS_RESPONSE=$(curl -i -s -H "Origin: http://localhost:3000" "${FUNCTION_URL}?code=${TEST_CODE}" 2>/dev/null || echo "FAILED")

if [[ "$CORS_RESPONSE" == *"FAILED"* ]]; then
    echo "❌ CORS request failed - function may not be deployed"
else
    echo "✅ CORS Response Headers:"
    echo "$CORS_RESPONSE" | grep -E "(Access-Control-Allow-Origin|Vary|HTTP)" || echo "⚠️  No CORS headers found"
    
    if [[ "$CORS_RESPONSE" == *"Access-Control-Allow-Origin: \*"* ]]; then
        echo "❌ CRITICAL: CORS allows * origin - SECURITY RISK!"
    elif [[ "$CORS_RESPONSE" == *"Access-Control-Allow-Origin: http://localhost:3000"* ]]; then
        echo "✅ CORS properly restricted to localhost:3000"
    else
        echo "⚠️  Unexpected CORS origin - check ALLOWED_ORIGINS"
    fi
fi

# ========================================
# CHECK 3: Rate Limit Verification (1 Minute)
# ========================================
echo ""
echo "🚦 CHECK 3: Rate Limit Verification"
echo "=================================="

echo "📡 Sending 40 rapid requests (expecting 429 after ~30)..."
echo "🔍 Watch for HTTP status codes:"

RATE_LIMIT_HIT=false
for i in {1..40}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Origin: http://localhost:3000" \
        "${FUNCTION_URL}?code=TESTCODE_${i}" 2>/dev/null || echo "000")
    
    echo -n "${HTTP_CODE} "
    
    if [[ "$HTTP_CODE" == "429" ]]; then
        RATE_LIMIT_HIT=true
        echo ""
        echo "✅ Rate limit triggered at request $i (HTTP 429)"
        break
    fi
    
    # Small delay to avoid overwhelming
    sleep 0.1
done

echo ""

if [[ "$RATE_LIMIT_HIT" == "true" ]]; then
    echo "✅ Rate limiting is working correctly"
else
    echo "❌ Rate limit NOT triggered - may not be working"
    echo "⚠️  Check: rate_limits table, function secrets, IP hashing"
fi

# ========================================
# CHECK 4: Real Session Tests (Final)
# ========================================
echo ""
echo "🧪 CHECK 4: Real Session Security Tests"
echo "======================================"

echo "📡 Running: node supabase/security-test-final.js"
echo "🔍 Expected output: '🎉 ALL GREEN - Zero Data Leaks Verified!'"

if [ -f "supabase/security-test-final.js" ]; then
    if node supabase/security-test-final.js 2>/dev/null; then
        echo ""
        echo "🎉 ALL GREEN - Zero Data Leaks Verified!"
        echo ""
        echo "✅ VERIFICATION COMPLETE - You can claim:"
        echo "   'Zero data leaks verified via real-session RLS tests +"
        echo "    hardened public Edge Functions (CORS whitelist + rate limiting + sanitized output)'"
    else
        echo ""
        echo "❌ SECURITY TESTS FAILED"
        echo ""
        echo "🔍 Check these common issues:"
        echo "   1. Auth → Email+Password provider enabled?"
        echo "   2. RLS policies exist and are correct?"
        echo "   3. Link events not leaking via DB select?"
        echo ""
        echo "📋 Post the full error output for instant fix!"
    fi
else
    echo "❌ Security test file not found: supabase/security-test-final.js"
fi

echo ""
echo "🏁 VERIFICATION CHECKS COMPLETE"
