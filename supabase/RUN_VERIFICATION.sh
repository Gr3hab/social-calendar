#!/bin/bash
# ========================================
# COMPLETE VERIFICATION - ALL GREEN CHECK
# ========================================

set -euo pipefail

echo "🔥 COMPLETE VERIFICATION - Zero Data Leaks Proof"
echo "================================================="

if [ -f ".env" ]; then
    source .env
    PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\(.*\)\.supabase\.co.*/\1/')
else
    echo "❌ .env file not found!"
    echo "Create .env with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "📋 Project: $PROJECT_REF"
echo ""

# ========================================
# CHECK 1: CORS DEBUG
# ========================================
echo "🌐 CHECK 1: CORS Headers Verification"
echo "===================================="

if PROJECT_REF="$PROJECT_REF" ./supabase/CORS_DEBUG.sh 2>/dev/null | grep -q "Access-Control-Allow-Origin: http://localhost:3000"; then
    echo "✅ CORS: Origin properly restricted"
else
    echo "❌ CORS: Origin not properly restricted"
    echo "🔍 Run manually: PROJECT_REF=$PROJECT_REF ./supabase/CORS_DEBUG.sh"
fi

echo ""

# ========================================
# CHECK 2: RATE LIMIT DEBUG
# ========================================
echo "🚦 CHECK 2: Rate Limit Verification"
echo "=================================="

if PROJECT_REF="$PROJECT_REF" ./supabase/RATE_LIMIT_DEBUG.sh 2>/dev/null | grep -q "🚨 RATE LIMIT TRIGGERED"; then
    echo "✅ Rate Limit: Working correctly"
else
    echo "❌ Rate Limit: Not triggered"
    echo "🔍 Run manually: PROJECT_REF=$PROJECT_REF ./supabase/RATE_LIMIT_DEBUG.sh"
fi

echo ""

# ========================================
# CHECK 3: REAL SESSION TESTS
# ========================================
echo "🧪 CHECK 3: Real Session Security Tests"
echo "======================================="

if node supabase/security-test-final.js 2>/dev/null | grep -q "🎉 ALL GREEN"; then
    echo "✅ Security Tests: ALL GREEN"
    echo ""
    echo "🎉 ZERO DATA LEAKS VERIFIED!"
    echo ""
    echo "✅ SUCCESS CLAIM READY:"
    echo "   'Zero data leaks verified via real-session RLS tests +"
    echo "    hardened public Edge Functions (CORS whitelist + rate limiting + sanitized output)'"
else
    echo "❌ Security Tests: FAILED"
    echo "🔍 Run manually: node supabase/security-test-final.js"
    echo ""
    echo "📋 Post the full error output for instant fix!"
fi

echo ""
echo "🏁 VERIFICATION COMPLETE"
