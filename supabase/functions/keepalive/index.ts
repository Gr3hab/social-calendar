// ========================================
// Keepalive Edge Function - Verhindert Supabase Pausierung
// ========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function resolveSupabaseCredentials() {
  const url = Deno.env.get('EDGE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('EDGE_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials. Set EDGE_SUPABASE_URL and EDGE_SUPABASE_SERVICE_ROLE_KEY.')
  }
  return { url, serviceKey }
}

Deno.serve(async (req) => {
  // Nur mit Secret Header aufrufbar (Security)
  const secretHeader = req.headers.get('X-Keepalive-Secret')
  if (secretHeader !== Deno.env.get('KEEPALIVE_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { url, serviceKey } = resolveSupabaseCredentials()
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false }
    })

    // Minimal DB Query - hält Projekt am Leben
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      console.error('Keepalive DB error:', error)
      return new Response('DB Error', { status: 500 })
    }

    return new Response(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      count: data?.length || 0
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Keepalive error:', error)
    return new Response('Server Error', { status: 500 })
  }
})
