/* ============================================================
   send-mail-attachments
   Builds the requested attachments (PDF / Word / Excel data, posters)
   and hands the finished mail to the Google Apps Script mailer.

   Secrets (supabase secrets set ...):
     GAS_WEBAPP_URL      https://script.google.com/macros/s/XXXX/exec
     GAS_SHARED_SECRET   same value as SHARED_SECRET in Code.gs
     RESEND_API_KEY      optional fallback (PDF/Word/poster only)
     RESEND_FROM_EMAIL   optional
   POST body:
     { subject, html_body, email_type, recipient_group?, to_email?, cc?,
       related_id?, related_type?, triggered_by?,
       attachments: [
         { kind:"doc", doc:"minutes", format:"pdf"|"docx"|"xlsx", params:{meeting_id}, name? },
         { kind:"url", url:"https://...poster.jpg", name:"Event_Poster" }
       ] }
   ============================================================ */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as b64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const SEND_ROLES = ["super_admin", "advisor", "president", "immediate_past_president", "vice_president",
  "secretary_administration", "secretary_communication", "treasurer"];
const DOC_TYPES = ["event_report", "monthly_report", "avenue_report", "dpp_report", "agenda", "minutes",
  "attendance", "combined_meeting", "combined_agenda", "treasury"];
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
const RATE_MAX = 40, RATE_WINDOW_MIN = 60, MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const isHttps = (u?: string) => { try { return new URL(String(u)).protocol === "https:"; } catch { return false; } };
const isEmail = (e?: string) => !!e && e.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const emailList = (v: unknown) => String(v ?? "").split(/[;,]+/).map(x => x.trim()).filter(isEmail).slice(0, 20);
const strip = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(p|div|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/\n{3,}/g, "\n\n").trim();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  const SB_URL = Deno.env.get("SUPABASE_URL"), SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SB_URL || !SB_KEY) return json({ error: "Server misconfiguration." }, 500);
  const sb = createClient(SB_URL, SB_KEY);

  const subject = String(body.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const html = String(body.html_body || "");
  if (!subject || !html.trim()) return json({ error: "subject and html_body are required." }, 400);
  const emailType = String(body.email_type || "general");
  const specs: any[] = Array.isArray(body.attachments) ? body.attachments.slice(0, 8) : [];

  /* ---- who is sending? ---- */
  let adminOk = false;
  if (body.triggered_by) {
    const { data: a } = await sb.from("admin_users").select("id, role, is_active").eq("id", body.triggered_by).single();
    if (!a || !a.is_active) return json({ error: "Sender not found or inactive." }, 401);
    if (!SEND_ROLES.includes(a.role)) return json({ error: "Insufficient permissions to send mail." }, 403);
    adminOk = true;
  }

  /* ---- rate limit ---- */
  try {
    const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
    const { count } = await sb.from("email_logs").select("id", { count: "exact", head: true })
      .gte("created_at", since).eq("status", "sent");
    if ((count ?? 0) >= RATE_MAX) return json({ error: "Rate limit reached. Try again later." }, 429);
  } catch { /* never block on a failed check */ }

  /* ---- settings ---- */
  const settings: Record<string, string> = {};
  const { data: srows } = await sb.from("club_settings").select("key, value");
  (srows || []).forEach((r: any) => { if (r.key) settings[r.key] = r.value; });
  const clubName = settings.club_name || "Rotaract Club of Dr. N.G.P Arts & Science College";
  const clubEmail = settings.club_email || "rac.drngpasc@gmail.com";
  const groupEmail = settings.group_email || "ngpmembers@googlegroups.com";
  const requested = adminOk ? emailList(body.recipient_group || body.to_email) : [];
  const toList = requested.length ? requested : emailList(groupEmail).length ? emailList(groupEmail) : ["ngpmembers@googlegroups.com"];
  const to = toList.join(",");
  const ccList = adminOk ? emailList(body.cc).filter(x => !toList.includes(x)) : [];

  /* ---- build attachments ----
     Documents come from the generate-document function — the SAME PDF / Word templates used by the
     download buttons. Three things make sure they actually reach the mail:
       1. the internal call re-uses the caller's own sign-in headers (a service key in the new
          "sb_secret_" format is not a JWT and would be refused by generate-document);
       2. all documents are generated in parallel (one slow file cannot time out the others);
       3. if the PDF cannot be produced (e.g. HTTP 546 — too heavy for the server), the Word version
          of the same document is attached instead and the admin is told. */
  const callerAuth = req.headers.get("Authorization");
  const callerKey  = req.headers.get("apikey");
  const genHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: callerAuth || `Bearer ${SB_KEY}`,
    apikey: callerKey || SB_KEY
  };
  const generate = async (sp: any, format: string) => {
    const r = await fetch(`${SB_URL}/functions/v1/generate-document`, {
      method: "POST", headers: genHeaders, body: JSON.stringify({ ...(sp.params || {}), doc: sp.doc, format })
    });
    if (r.ok) return { ok: true as const, r };
    let msg = `HTTP ${r.status}`;
    try { const j = await r.clone().json(); if (j?.error || j?.message) msg = `HTTP ${r.status} ${j.error || j.message}`; } catch { /* not JSON */ }
    return { ok: false as const, msg };
  };

  const attachments: any[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];
  const results = await Promise.all(specs.map(async (sp: any) => {
    try {
      if (sp?.kind === "url") {
        if (!isHttps(sp.url)) return { skip: "invalid poster url" };
        return { att: { kind: "url", url: sp.url, name: String(sp.name || "Poster").slice(0, 80) } };
      }
      if (sp?.kind === "doc" && DOC_TYPES.includes(sp.doc)) {
        const want = ["pdf", "docx", "xlsx"].includes(sp.format) ? sp.format : "pdf";
        if (want === "xlsx") {
          const g = await generate(sp, "data");
          if (!g.ok) return { skip: `${sp.doc} (Excel): ${g.msg}` };
          const d = await g.r.json();
          return { att: { kind: "xlsx", name: sp.name || d.filename, title: d.title, club: d.club, summary: d.summary, sheets: d.sheets } };
        }
        let fmt = want;
        let g = await generate(sp, fmt);
        if (!g.ok && fmt === "pdf") {            // same document, Word version
          const pdfError = g.msg;
          fmt = "docx";
          g = await generate(sp, fmt);
          if (g.ok) notes.push(`${sp.name || sp.doc}: the PDF could not be generated (${pdfError}) — the Word version is attached instead`);
        }
        if (!g.ok) return { skip: `${sp.doc}: ${g.msg}` };
        const bytes = new Uint8Array(await g.r.arrayBuffer());
        const cd = g.r.headers.get("Content-Disposition") || "";
        const fn = /filename="([^"]+)"/.exec(cd)?.[1] || `${sp.doc}.${fmt}`;
        return { size: bytes.byteLength, att: { kind: "file", name: sp.name ? `${String(sp.name).replace(/\.(pdf|docx)$/i, "")}.${fmt}` : fn, mime: MIME[fmt], base64: b64(bytes) } };
      }
      return { skip: "unsupported attachment" };
    } catch (err: any) { return { skip: `${sp?.doc || sp?.kind}: ${err?.message || "failed"}` }; }
  }));
  let total = 0;
  for (const r of results as any[]) {
    if (r.skip) { skipped.push(r.skip); continue; }
    total += r.size || 0;
    if (total > MAX_TOTAL_BYTES) { skipped.push(`${r.att.name}: attachments exceed 20 MB`); continue; }
    attachments.push(r.att);
  }

  const log = async (status: string, method: string, err?: string) => {
    try {
      await sb.from("email_logs").insert({
        email_type: emailType, recipient_group: to, subject, status, method, error_message: err || null,
        related_id: body.related_id || null, related_type: body.related_type || null,
        triggered_by: body.triggered_by || null, sent_at: status === "sent" ? new Date().toISOString() : null
      });
    } catch { /* logging must not break sending */ }
  };

  /* ---- 1. Google Apps Script ---- */
  const errors: string[] = [];
  const gasUrl = Deno.env.get("GAS_WEBAPP_URL"), gasKey = Deno.env.get("GAS_SHARED_SECRET");
  if (gasUrl && gasKey) {
    try {
      const r = await fetch(gasUrl, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token: gasKey, to, cc: ccList.join(","), subject, htmlBody: html,
          plainBody: strip(html), fromName: clubName, replyTo: clubEmail, attachments }) });
      const out = await r.json().catch(() => ({}));
      if (r.ok && out.success) {
        await log("sent", "google_apps_script");
        return json({ success: true, method: "google_apps_script", recipient: to, attachments: out.attached ?? attachments.length, skipped, notes: [...notes, ...(out.notes || [])] });
      }
      errors.push(`Apps Script: ${out.error || r.status}`);
    } catch (e: any) { errors.push(`Apps Script: ${e?.message}`); }
  } else errors.push("Apps Script: GAS_WEBAPP_URL / GAS_SHARED_SECRET not set");

  /* ---- 2. Resend fallback (files + posters only) ---- */
  const rk = Deno.env.get("RESEND_API_KEY");
  if (rk) {
    try {
      const files: any[] = [];
      for (const a of attachments) {
        if (a.kind === "file") files.push({ filename: a.name, content: a.base64 });
        else if (a.kind === "url") {
          const pr = await fetch(a.url);
          if (pr.ok) {
            const ct = pr.headers.get("content-type") || "image/jpeg";
            files.push({ filename: `${a.name}.${ct.includes("png") ? "png" : ct.includes("pdf") ? "pdf" : "jpg"}`,
              content: b64(new Uint8Array(await pr.arrayBuffer())) });
          }
        } else skipped.push(`${a.name}: Excel needs the Apps Script mailer`);
      }
      const from = Deno.env.get("RESEND_FROM_EMAIL") || `noreply@${clubEmail.split("@")[1]}`;
      const r = await fetch("https://api.resend.com/emails", { method: "POST",
        headers: { Authorization: `Bearer ${rk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${clubName} <${from}>`, to: toList, cc: ccList.length ? ccList : undefined, subject, html, text: strip(html), reply_to: clubEmail, attachments: files }) });
      const out = await r.json().catch(() => ({}));
      if (r.ok && out.id) { await log("sent", "resend"); return json({ success: true, method: "resend", recipient: to, attachments: files.length, skipped, notes }); }
      errors.push(`Resend: ${out.message || r.status}`);
    } catch (e: any) { errors.push(`Resend: ${e?.message}`); }
  }

  await log("failed", "none", errors.join(" | "));
  return json({ success: false, error: "Mail could not be sent.", details: errors, skipped }, 502);
});
