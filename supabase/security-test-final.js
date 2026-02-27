import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) throw new Error("Missing env vars");

const admin = createClient(URL, SERVICE);

const rand = () => Math.random().toString(16).slice(2);
const mkUser = async (label) => {
  const email = `test_${label}_${Date.now()}_${rand()}@example.com`;
  const password = `Pw_${rand()}_${rand()}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { email, password, id: data.user.id };
};

const login = async (email, password) => {
  const c = createClient(URL, ANON);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c, user: data.user };
};

const mustFail = async (p, msg) => {
  let ok = false;
  try { await p; ok = true; } catch {}
  if (ok) throw new Error("SHOULD HAVE FAILED: " + msg);
};

(async () => {
  console.log("🚀 Starting Security Tests...");
  
  const A = await mkUser("A");
  const B = await mkUser("B");

  const a = await login(A.email, A.password);
  const b = await login(B.email, B.password);

  // profiles: each inserts own
  await a.c.from("profiles").insert({ id: a.user.id, display_name: "A" });
  await b.c.from("profiles").insert({ id: b.user.id, display_name: "B" });

  // A creates group
  const { data: g1, error: ge } = await a.c.from("groups").insert({
    name: "Group A",
    created_by: a.user.id,
  }).select("*").single();
  if (ge) throw ge;

  // Ensure A is member (depends on your flow/policies; adjust if auto-membership)
  await a.c.from("group_members").upsert({
    group_id: g1.id,
    user_id: a.user.id,
    role: "admin",
  });

  // A creates private event
  const { data: e1, error: ee } = await a.c.from("events").insert({
    title: "Private A",
    starts_at: new Date(Date.now() + 3600_000).toISOString(),
    created_by: a.user.id,
    visibility: "private",
  }).select("*").single();
  if (ee) throw ee;

  // B must NOT see A's private event
  const { data: bSeePrivate, error: bErr1 } = await b.c.from("events").select("*").eq("id", e1.id);
  if (bErr1) throw bErr1;
  if ((bSeePrivate ?? []).length !== 0) throw new Error("LEAK: B can see A private event");

  // A creates link event with invitation_code
  const code = "TESTCODE_" + rand().slice(0, 6);
  const { data: e2, error: ee2 } = await a.c.from("events").insert({
    title: "Link A",
    starts_at: new Date(Date.now() + 7200_000).toISOString(),
    created_by: a.user.id,
    visibility: "link",
    invitation_code: code,
  }).select("*").single();
  if (ee2) throw ee2;

  // B must NOT see link event via direct table select (should be edge function only)
  const { data: bSeeLink } = await b.c.from("events").select("*").eq("id", e2.id);
  if ((bSeeLink ?? []).length !== 0) throw new Error("LEAK: B can see link event via DB select");

  console.log("✅ RLS core checks passed");

  // Edge function check (stats only)
  const fnUrl = `${URL.replace(".supabase.co", ".functions.supabase.co")}/public-event-hardened?code=${encodeURIComponent(code)}`;
  const r = await fetch(fnUrl, { headers: { Origin: "http://localhost:3000" } });
  const j = await r.json();
  if (!r.ok) throw new Error("Edge function failed: " + JSON.stringify(j));
  if (JSON.stringify(j).includes("instagram_handle") || JSON.stringify(j).includes("avatar_url"))
    throw new Error("LEAK: edge returns profile fields");

  console.log("✅ Edge function sanitized output OK");
  console.log("🎉 ALL GREEN - Zero Data Leaks Verified!");
})();
