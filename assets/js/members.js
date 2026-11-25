/* Member accounts for the Field Guide: email-link sign-in, saved self-check scores, certificates.
   Backed by Supabase (see supabase/schema.sql). Every function is safe to call when accounts
   are switched off in config.js: reads return empty results and writes return { off: true }. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;
function client() {
  if (!enabled) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
      }));
  }
  return clientPromise;
}

export async function getUser() {
  const sb = await client();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

/* Only same-site paths are allowed as the page to return to after sign-in. */
export function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/field-guide";
}

export async function sendLink(email, { ageConfirmed, wantsNote, next }) {
  const sb = await client();
  if (!sb) return { off: true };
  const redirect = new URL("/account", location.origin);
  redirect.searchParams.set("next", safeNext(next));
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirect.toString(),
      shouldCreateUser: true,
      data: { age_13_confirmed: Boolean(ageConfirmed), wants_monthly_note: Boolean(wantsNote) }
    }
  });
  return { error };
}

export async function signOut() {
  const sb = await client();
  if (sb) await sb.auth.signOut();
}

export async function getMember() {
  const sb = await client();
  const user = sb && await getUser();
  if (!user) return null;
  const { data } = await sb.from("members").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export async function updateMember(fields) {
  const sb = await client();
  const user = sb && await getUser();
  if (!user) return { off: true };
  const allowed = {};
  for (const k of ["wants_monthly_note", "role"]) if (k in fields) allowed[k] = fields[k];
  const { error } = await sb.from("members").update(allowed).eq("id", user.id);
  return { error };
}

export async function saveAttempt(module, score) {
  const sb = await client();
  const user = sb && await getUser();
  if (!user) return { off: true, signedOut: Boolean(sb) };
  const { error } = await sb.from("check_attempts").insert({ member_id: user.id, module, score, passed: score >= 4 });
  return { error };
}

/* Returns { best: Map(module -> best score), passed: Set(module) }. */
export async function loadProgress() {
  const out = { best: new Map(), passed: new Set() };
  const sb = await client();
  const user = sb && await getUser();
  if (!user) return out;
  const { data } = await sb.from("check_attempts").select("module, score, passed").eq("member_id", user.id);
  for (const r of data || []) {
    out.best.set(r.module, Math.max(out.best.get(r.module) || 0, r.score));
    if (r.passed) out.passed.add(r.module);
  }
  return out;
}

export async function getMyCertificate() {
  const sb = await client();
  const user = sb && await getUser();
  if (!user) return null;
  const { data } = await sb.from("certificates").select("id, display_name, county, state, issued_at").eq("member_id", user.id).maybeSingle();
  return data;
}

export async function issueCertificate({ displayName, county, state }) {
  const sb = await client();
  if (!sb) return { off: true };
  const { data, error } = await sb.rpc("issue_certificate", { p_display_name: displayName, p_county: county, p_state: state });
  return { id: data, error };
}

export async function getCertificate(id) {
  const sb = await client();
  if (!sb) return null;
  const { data } = await sb.rpc("get_certificate", { p_id: id });
  return Array.isArray(data) ? data[0] || null : data;
}

export async function deleteAccount() {
  const sb = await client();
  if (!sb) return { off: true };
  const { error } = await sb.rpc("delete_my_account");
  if (!error) await sb.auth.signOut();
  return { error };
}

/* Swap the nav's "Sign in" link for "My account" when someone is signed in. */
export async function markNav() {
  const link = document.querySelector("[data-account-link]");
  if (!link || !enabled) return;
  const user = await getUser();
  if (user) { link.textContent = "My account"; link.setAttribute("href", "/account"); }
}
