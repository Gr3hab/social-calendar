// ========================================
// Edge Function: Public RSVP (Hardened)
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SupabaseTableClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { window_start?: string; count?: number } | null }>;
      };
    };
    upsert: (payload: Record<string, unknown>) => Promise<unknown>;
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<unknown>;
    };
  };
}

// CORS + Security headers helper
function corsHeaders(origin: string | null) {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const okOrigin = origin && allowed.includes(origin) ? origin : allowed[0] ?? "null";

  return {
    "Access-Control-Allow-Origin": okOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function resolveSupabaseCredentials() {
  const url = Deno.env.get("EDGE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("EDGE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials. Set EDGE_SUPABASE_URL and EDGE_SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, serviceKey };
}

function sha256(input: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
  );
}

async function rateLimit(supabase: SupabaseTableClient, key: string, maxPerMin = 20) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();

  const { data } = await supabase.from("rate_limits").select("*").eq("key", key).maybeSingle();
  if (!data || data.window_start !== windowStart) {
    await supabase.from("rate_limits").upsert({ key, window_start: windowStart, count: 1 });
    return true;
  }
  if (data.count >= maxPerMin) return false;
  await supabase.from("rate_limits").update({ count: data.count + 1 }).eq("key", key);
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  try {
    const body = await req.json();
    const { code, name, phoneNumber, status } = body;

    // Input validation
    if (!code || typeof code !== "string") return json({ error: "missing_code" }, 400, origin);
    if (!name || typeof name !== "string" || name.trim().length === 0) return json({ error: "missing_name" }, 400, origin);
    if (!phoneNumber || typeof phoneNumber !== "string") return json({ error: "missing_phone" }, 400, origin);
    if (!["yes", "no", "maybe"].includes(status)) return json({ error: "invalid_status" }, 400, origin);

    const { url, serviceKey } = resolveSupabaseCredentials();
    const supabase = createClient(url, serviceKey);

    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const key = `rsvp-public:${await sha256(ip)}:${await sha256(code)}`;
    if (!(await rateLimit(supabase, key, 20))) return json({ error: "rate_limited" }, 429, origin);

    // Find event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id,starts_at,rsvp_deadline")
      .eq("invitation_code", code)
      .eq("visibility", "link")
      .maybeSingle();

    if (eventError) return json({ error: "db_error" }, 500, origin);
    if (!event) return json({ error: "not_found" }, 404, origin);

    // Check if event is in the past
    if (new Date(event.starts_at) < new Date()) {
      return json({ error: "event_passed" }, 410, origin);
    }

    // Check RSVP deadline
    const isLateResponse = event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date();

    // Check existing public response
    const { data: existing } = await supabase
      .from("public_invite_responses")
      .select("id")
      .eq("event_id", event.id)
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    // Upsert RSVP in dedicated public response table
    const { data: rsvp, error: rsvpError } = await supabase
      .from("public_invite_responses")
      .upsert({
        event_id: event.id,
        phone_number: phoneNumber,
        display_name: name.trim(),
        status: status,
        responded_at: new Date().toISOString(),
        is_late_response: isLateResponse || !!existing
      })
      .select("status,responded_at,is_late_response,display_name,phone_number")
      .single();

    if (rsvpError) return json({ error: "rsvp_failed" }, 500, origin);

    // Get updated stats
    const { data: stats } = await supabase
      .from("event_attendees")
      .select("status")
      .eq("event_id", event.id);

    const { data: publicStats } = await supabase
      .from("public_invite_responses")
      .select("status")
      .eq("event_id", event.id);

    const counts = { yes: 0, no: 0, maybe: 0 };
    for (const row of (stats ?? [])) {
      if (row.status === "yes") counts.yes++;
      else if (row.status === "no") counts.no++;
      else counts.maybe++;
    }
    for (const row of (publicStats ?? [])) {
      if (row.status === "yes") counts.yes++;
      else if (row.status === "no") counts.no++;
      else counts.maybe++;
    }

    return json({
      success: true,
      rsvp: rsvp,
      attendee_stats: counts
    }, 200, origin);

  } catch {
    return json({ error: "invalid_request" }, 400, origin);
  }
});
