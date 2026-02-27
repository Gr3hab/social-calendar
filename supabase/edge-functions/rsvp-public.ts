// ========================================
// Edge Function: Public RSVP via Invitation Code
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, name, phoneNumber, status } = await req.json()
    
    if (!code || !name || !phoneNumber || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, name, phoneNumber, status' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!['yes', 'no', 'maybe'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status. Must be: yes, no, or maybe' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find event by invitation code
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, starts_at, rsvp_deadline')
      .eq('invitation_code', code)
      .eq('visibility', 'link')
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found or invalid invitation code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if RSVP deadline has passed
    // Check if already responded
    const { data: existingResponse } = await supabase
      .from('event_attendees')
      .select('status, responded_at')
      .eq('event_id', event.id)
      .eq('user_id', phoneNumber) // Using phone number as user identifier for public RSVP
      .single()

    const isLateResponse = existingResponse ? true : (event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date())

    // Upsert RSVP response
    const { data: rsvpData, error: rsvpError } = await supabase
      .from('event_attendees')
      .upsert({
        event_id: event.id,
        user_id: phoneNumber, // Using phone number as identifier for public users
        status: status,
        responded_at: new Date().toISOString(),
        is_late_response: isLateResponse
      })
      .select()
      .single()

    if (rsvpError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save RSVP response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get updated event with all attendees
    const { data: updatedEvent } = await supabase
      .from('events')
      .select(`
        *,
        event_attendees (
          status,
          responded_at,
          is_late_response
        )
      `)
      .eq('id', event.id)
      .single()

    return new Response(
      JSON.stringify({ 
        success: true,
        rsvp: rsvpData,
        event: updatedEvent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
