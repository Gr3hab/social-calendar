// ========================================
// Edge Function: Public Event Access via Invitation Code
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
    const { code } = await req.json()
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Invitation code required' }),
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
      .select(`
        *,
        profiles!events_created_by_fkey (
          display_name,
          avatar_url
        ),
        event_attendees (
          status,
          responded_at,
          is_late_response,
          profiles!event_attendees_user_id_fkey (
            display_name,
            avatar_url
          )
        )
      `)
      .eq('invitation_code', code)
      .eq('visibility', 'link')
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found or invalid invitation code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if event has expired (optional - you could add an expires_at field)
    // For now, we'll assume events don't expire

    return new Response(
      JSON.stringify({ 
        event: {
          ...event,
          // Transform the data structure for easier frontend consumption
          attendees: event.event_attendees.map(attendee => ({
            userId: attendee.profiles?.display_name || 'Unknown',
            name: attendee.profiles?.display_name || 'Unknown',
            avatar: attendee.profiles?.avatar_url,
            status: attendee.status,
            respondedAt: attendee.responded_at,
            isLateResponse: attendee.is_late_response
          }))
        }
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
