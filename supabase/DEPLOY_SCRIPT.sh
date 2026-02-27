#!/bin/bash
# ========================================
# 7-MINUTE SECURITY DEPLOY SCRIPT
# ========================================

set -e

echo "🚀 Starting 7-Minute Security Deploy..."

# Check prerequisites
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Create with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Load environment variables
source .env

echo "📋 Step 1: Supabase Login & Link"
supabase login
supabase link --project-ref ${SUPABASE_URL//https://} | cut -d'.' -f1

echo "🗄️ Step 2: Deploy Schema + RLS"
echo "📝 Running schema.sql..."
supabase db push --schema=public

echo "🔒 Step 3: Deploy Hardened Edge Functions"
supabase functions deploy public-event-hardened --no-verify-jwt
supabase functions deploy rsvp-public-hardened --no-verify-jwt

echo "⚙️ Step 4: Set Secrets"
supabase secrets set ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo "🧪 Step 5: Install Test Dependencies"
npm install @supabase/supabase-js dotenv

echo "🔍 Step 6: Run Security Tests"
node supabase/security-test-final.js

echo "✅ Step 7: Cleanup Rate Limits (optional)"
supabase db reset --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -c "SELECT public.cleanup_old_rate_limits();"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "📊 If you see '🎉 ALL GREEN' above: Zero Data Leaks Verified!"
echo ""
echo "🔗 Next Steps:"
echo "1. Update your frontend to use hardened functions"
echo "2. Set ALLOWED_ORIGINS to your production domains"
echo "3. Monitor rate limiting in production"
echo ""
echo "🚀 Ready for Lovable integration!"
