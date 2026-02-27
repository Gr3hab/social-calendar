// ========================================
// Edge Function: Public Event Access (Hardened)
// ========================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(origin: string | null) {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
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
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

function resolveSupabaseCredentials() {
  const url = Deno.env.get("EDGE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("EDGE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error("Missing credentials: EDGE_SUPABASE_URL / EDGE_SUPABASE_SERVICE_ROLE_KEY");
  }

  return { url, serviceKey };
}

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function rateLimit(
  supabase: ReturnType<typeof createClient>,
  key: string,
  maxPerMinute: number,
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("window_start,count")
    .eq("key", key)
    .maybeSingle();

  const currentCount = Number(existing?.count ?? 0);
  const sameWindow = existing?.window_start === windowStart;

  if (!sameWindow) {
    const { error: insertError } = await supabase
      .from("rate_limits")
      .upsert({ key, window_start: windowStart, count: 1 });
    if (insertError) {
      return false;
    }
    return true;
  }

  if (currentCount >= maxPerMinute) {
    return false;
  }

  const { error: updateError } = await supabase
    .from("rate_limits")
    .update({ count: currentCount + 1 })
    .eq("key", key);

  return !updateError;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }

  try {
    const url = new URL(req.url);
    const codeFromQuery = url.searchParams.get("code")?.trim() ?? "";

    let code = codeFromQuery;
    if (!code && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      code = typeof body?.code === "string" ? body.code.trim() : "";
    }

    if (!code) {
      return json({ error: "missing_code" }, 400, origin);
    }

    const { url: supabaseUrl, serviceKey } = resolveSupabaseCredentials();
    const supabase = createClient(supabaseUrl, serviceKey);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limitKey = `public-event:${await sha256(ip)}:${await sha256(code)}`;
    const allowed = await rateLimit(supabase, limitKey, 30);
    if (!allowed) {
      return json({ error: "rate_limited" }, 429, origin);
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id,title,description,starts_at,ends_at,location,rsvp_deadline,visibility")
      .eq("invitation_code", code)
      .maybeSingle();

    if (eventError) {
      return json({ error: "db_error" }, 500, origin);
    }

    if (!event) {
      return json({ error: "not_found" }, 404, origin);
    }

    if (event.visibility !== "link") {
      return json({ error: "not_public" }, 403, origin);
    }

    const { data: stats, error: statsError } = await supabase
      .from("event_attendees")
      .select("status")
      .eq("event_id", event.id);

    if (statsError) {
      return json({ error: "db_error" }, 500, origin);
    }

    const { data: publicResponses, error: publicResponsesError } = await supabase
      .from("public_invite_responses")
      .select("status")
      .eq("event_id", event.id);

    if (publicResponsesError) {
      return json({ error: "db_error" }, 500, origin);
    }

    const attendeeStats = { yes: 0, no: 0, maybe: 0 };
    for (const row of stats ?? []) {
      if (row.status === "yes") attendeeStats.yes += 1;
      else if (row.status === "no") attendeeStats.no += 1;
      else attendeeStats.maybe += 1;
    }
    for (const row of publicResponses ?? []) {
      if (row.status === "yes") attendeeStats.yes += 1;
      else if (row.status === "no") attendeeStats.no += 1;
      else attendeeStats.maybe += 1;
    }

    return json(
      {
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          location: event.location,
          rsvp_deadline: event.rsvp_deadline,
        },
        attendee_stats: attendeeStats,
      },
      200,
      origin,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return json({ error: message }, 500, origin);
  }
});
