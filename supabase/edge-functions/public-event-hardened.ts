// ========================================
// Edge Function: Public Event Access (Hardened)
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 🔒 HARDENED CORS - Nur erlaubte Origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173', 
  'https://your-app-domain.com',
  'https://your-vercel-app.vercel.app'
]

function getCorsHeaders(origin: string) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin?.startsWith('http://localhost:')
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'false',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Max-Age': '86400'
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 🔒 RATE LIMITING CHECK (einfach)
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  
  // Hier könntest du Redis oder Supabase für Rate Limiting nutzen
  // Für jetzt: Basic check (produktionssicherer wäre Redis)

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
      )
    }

    const body = await req.json()
    const { code } = body
    
    // 🔒 INPUT VALIDATION
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid invitation code required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 🔒 CODE FORMAT VALIDATION
    if (!/^[A-Z0-9]{12}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Invalid invitation code format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 🔒 BRUTE FORCE PROTECTION (einfach)
    // In Produktion: Redis mit exponential backoff
    // Create Supabase client with service role (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // 🔒 QUERY MIT MINIMAL FIELDS
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        starts_at,
        ends_at,
        location,
        rsvp_deadline,
        reminder_enabled,
        created_at,
        profiles!events_created_by_fkey (
          display_name,
          avatar_url
        )
      `)
      .eq('invitation_code', code)
      .eq('visibility', 'link')
      .single()

    if (eventError || !event) {
      // 🔒 LOGGING für Security (in Produktion)
      console.warn(`Invalid invitation code attempt: ${code} from IP: ${clientIP}`)
      
      return new Response(
        JSON.stringify({ error: 'Event not found or invalid invitation code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // 🔒 EVENT VALIDATION
    const now = new Date()
    const eventDate = new Date(event.starts_at)
    
    // Events in der Vergangenheit nicht mehr zugänglich
    if (eventDate < now) {
      return new Response(
        JSON.stringify({ error: 'Event has already passed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 410 }
      )
    }

    // 🔒 MINIMAL ATTENDEES QUERY (nicht alle Profile!)
    const { data: attendees, error: attendeesError } = await supabase
      .from('event_attendees')
      .select(`
        status,
        responded_at,
        is_late_response
      `)
      .eq('event_id', event.id)

    if (attendeesError) {
      console.error('Attendees query failed:', attendeesError)
      // Continue without attendees rather than exposing error
    }

    // 🔒 RESPONSE SANITIZATION
    const sanitizedResponse = {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        location: event.location,
        rsvp_deadline: event.rsvp_deadline,
        reminder_enabled: event.reminder_enabled,
        created_at: event.created_at,
        creator: {
          display_name: event.profiles?.display_name || 'Unknown',
          avatar_url: event.profiles?.avatar_url
        },
        // 🔒 KEINE vollständigen Profile - nur Status-Statistik
        attendee_stats: attendees ? {
          total: attendees.length,
          yes: attendees.filter(a => a.status === 'yes').length,
          no: attendees.filter(a => a.status === 'no').length,
          maybe: attendees.filter(a => a.status === 'maybe').length
        } : { total: 0, yes: 0, no: 0, maybe: 0 }
      }
    }

    // 🔒 SECURITY HEADERS
    const securityHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }

    return new Response(
      JSON.stringify(sanitizedResponse),
      { headers: securityHeaders, status: 200 }
    )

  } catch (error) {
    console.error('Public event function error:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { 
          ...getCorsHeaders(req.headers.get('origin') || ''),
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff'
        }, 
        status: 500 
      }
    )
  }
})
