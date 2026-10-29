/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   generate-document  —  one function, every document

   POST { doc, format, ...params }
     format : "docx" (default) | "pdf" | "data"   ("data" = JSON tables for Excel)
     doc    : event_report | monthly_report | avenue_report | dpp_report
              agenda | minutes | attendance | combined_meeting
              combined_agenda | treasury

   Every document is first described as a list of layout "blocks",
   then rendered to Word, PDF or JSON from that same description,
   so all formats share the same cranberry design.
   ============================================================ */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak, Footer,
  PageNumber, VerticalAlign
} from "https://esm.sh/docx@8.5.0";

/* ------------------------------ CONSTANTS ------------------------------ */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

/** Cranberry shades (hex without #) */
const C = {
  c900: "3F0A1A", c800: "5E0F28", c700: "7D1536", c600: "9C1C42",
  c500: "B93A5E", c400: "D0627F", c300: "E39BAE", c200: "F0C6D2",
  c100: "F8E4EA", c50: "FCF3F6", ink: "2B1A20", muted: "7A5C66", white: "FFFFFF"
};

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const AVENUES: Record<string, string> = {
  club_service: "Club Service", community_service: "Community Service",
  professional_service: "Professional Service", international_service: "International Service",
  district_priority_projects: "District Priority Projects"
};
const COLLAB: Record<string, string> = {
  rotaract: "Rotaract", interact: "Interact", rotary: "Rotary", ngo: "NGO", others: "Others"
};
const MTG_TYPES: Record<string, string> = {
  board_meeting: "Board Meeting", general_body_meeting: "General Body Meeting",
  special_meeting: "Special Meeting", emergency_meeting: "Emergency Meeting"
};
const DEFAULT_LOGO = "https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713317/ngp_colour_nlpsyt.png";
const DEFAULT_DPP_LOGO = "https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713318/ngp_logo_dpp_colourAsset_4_2x-8_exk9kk.png";
const DISTRICT = "Rotary International District 3206";
const MAX_DPP_PHOTOS = 8;

/* ------------------------------ TYPES ------------------------------ */
interface Img { data: Uint8Array; type: "png" | "jpg"; w: number; h: number }
type Cell = string | Img | null;
type Block =
  | { t: "letter"; logo: Img | null; logoW: number; logoH: number }
  | { t: "title"; text: string; sub?: string }
  | { t: "kv"; rows: [string, string][]; accent?: boolean }
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "bullets"; items: string[] }
  | { t: "stats"; items: [string, string][] }
  | { t: "table"; name: string; head: string[]; widths: number[]; align: string[]; rows: Cell[][]; foot?: string[] }
  | { t: "timeline"; entries: { time: string; heading: string; details: string }[] }
  | { t: "photos"; imgs: (Img | null)[] }
  | { t: "sign"; people: [string, string][]; club: string }
  | { t: "pagebreak" };

interface Model { title: string; filename: string; blocks: Block[]; club: string }
type Sb = ReturnType<typeof createClient>;
class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

/* ------------------------------ FORMATTERS ------------------------------ */
function fmtTime(t?: string | null): string {
  if (!t) return "";
  const [hs, ms] = String(t).split(":");
  const h = parseInt(hs, 10), m = parseInt(ms, 10);
  if (isNaN(h) || isNaN(m)) return String(t);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function fmtDate(d?: string | null): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (m) return `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10)]} ${m[1]}`;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? String(d) :
    dt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}
function fmtShort(d?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ""));
  return m ? `${m[3]} ${MONTHS[parseInt(m[2], 10)].slice(0, 3)} ${m[1]}` : fmtDate(d);
}
const fmtCur = (v: unknown) =>
  "₹" + (parseFloat(String(v ?? 0)) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const timeRange = (s?: string | null, e?: string | null) =>
  fmtTime(s) + (e ? ` to ${fmtTime(e)}` : "");
const safeName = (s: string) =>
  (s || "Document").replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().replace(/\s+/g, "_").substring(0, 60) || "Document";
const paras = (text?: string | null): Block[] =>
  String(text || "").split(/\n+/).map(s => s.trim()).filter(Boolean).map(t => ({ t: "p", text: t } as Block));
const minutesBetween = (a?: string | null, b?: string | null) => {
  if (!a || !b) return 0;
  const [sh, sm] = a.split(":").map(Number), [eh, em] = b.split(":").map(Number);
  const d = (eh * 60 + em) - (sh * 60 + sm);
  return isNaN(d) || d < 0 ? 0 : d;
};

/* ------------------------------ IMAGES ------------------------------ */
function imgSize(d: Uint8Array, type: "png" | "jpg"): [number, number] {
  try {
    if (type === "png") {
      const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
      return [v.getUint32(16), v.getUint32(20)];
    }
    let i = 2;
    while (i < d.length) {
      if (d[i] !== 0xff) { i++; continue; }
      const mk = d[i + 1];
      if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) {
        return [(d[i + 7] << 8) | d[i + 8], (d[i + 5] << 8) | d[i + 6]];
      }
      i += 2 + ((d[i + 2] << 8) | d[i + 3]);
    }
  } catch { /* fall through */ }
  return [4, 3];
}
function sniff(b: Uint8Array): "png" | "jpg" | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return "jpg";
  return null; // webp/gif/svg are not embeddable — caller skips
}
const imgCache = new Map<string, Promise<Img | null>>();
function loadImg(url?: string | null, opts: { photo?: boolean; logo?: boolean } = {}): Promise<Img | null> {
  if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) return Promise.resolve(null);
  const key = url + (opts.photo ? "#p" : opts.logo ? "#l" : "");
  if (!imgCache.has(key)) {
    imgCache.set(key, (async () => {
      const tryFetch = async (u: string) => {
        try {
          const r = await fetch(u, { headers: { Accept: "image/png,image/jpeg,image/*" } });
          if (!r.ok) return null;
          const data = new Uint8Array(await r.arrayBuffer());
          const type = sniff(data);
          if (!type) return null;
          const [w, h] = imgSize(data, type);
          return { data, type, w, h } as Img;
        } catch { return null; }
      };
      // Cloudinary: ask for a web-sized JPEG (also converts webp)
      const isCld = /res\.cloudinary\.com\/.+\/image\/upload\//.test(url);
      if (opts.photo && isCld && !/\/upload\/[^/]*f_/.test(url)) {
        const t = await tryFetch(url.replace("/image/upload/", "/image/upload/f_jpg,q_70,w_800/"));
        if (t) return t;
      }
      if (opts.logo && isCld && !/\/upload\/[^/]*f_/.test(url)) {
        const t = await tryFetch(url.replace("/image/upload/", "/image/upload/b_white,f_jpg,q_85,w_900/"));
        if (t) return t;
      }
      const first = await tryFetch(url);
      if (first) return first;
      if (isCld) return await tryFetch(url.replace("/image/upload/", "/image/upload/f_jpg,q_70,w_800/"));
      return null;
    })());
  }
  return imgCache.get(key)!;
}
async function loadMany(urls: string[], photo = true): Promise<(Img | null)[]> {
  const out: (Img | null)[] = new Array(urls.length).fill(null);
  let next = 0;
  const worker = async () => { while (next < urls.length) { const i = next++; out[i] = await loadImg(urls[i], { photo }); } };
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
  return out;
}

/* ------------------------------ DATA ACCESS ------------------------------ */
async function getSettings(sb: Sb): Promise<Record<string, string>> {
  const s: Record<string, string> = {};
  const { data } = await sb.from("club_settings").select("key, value");
  (data || []).forEach((r: any) => { if (r.key) s[r.key] = r.value; });
  return s;
}
async function getSignatories(sb: Sb): Promise<[string, string][]> {
  // select("*") so this keeps working before the multi-role columns exist
  const { data } = await sb.from("members").select("*").eq("is_active", true).eq("is_board_member", true);
  const holds = (m: any, r: string) => m.role === r || (Array.isArray(m.extra_roles) && m.extra_roles.includes(r));
  const f = (r: string) => (data || []).find((m: any) => holds(m, r));
  /** The title printed: the member's own portfolio text that matches this post, else the standard title */
  const title = (m: any, r: string, std: string) => {
    if (!m) return std;
    if (m.role === r && m.portfolio) return m.portfolio;
    const extras: string[] = Array.isArray(m.extra_portfolios) ? m.extra_portfolios : [];
    const hit = extras.find(t => t.toLowerCase().includes(std.toLowerCase().split(" ")[0]));
    return hit || std;
  };
  const a = f("secretary_administration"), p = f("president"), c = f("secretary_communication");
  return [
    [a?.full_name || "", title(a, "secretary_administration", "Secretary Administration")],
    [p?.full_name || "", title(p, "president", "President")],
    [c?.full_name || "", title(c, "secretary_communication", "Secretary Communication")]
  ];
}

interface Ctx { sb: Sb; s: Record<string, string>; club: string; sign: [string, string][] }
async function makeCtx(sb: Sb): Promise<Ctx> {
  const [s, sign] = await Promise.all([getSettings(sb), getSignatories(sb)]);
  return { sb, s, sign, club: s.club_name || "Rotaract Club of Dr. N.G.P Arts & Science College" };
}
async function letterhead(ctx: Ctx, dpp: boolean): Promise<Block> {
  const pre = dpp ? "dpp_logo_strip" : "report_logo_strip";
  const url = ctx.s[`${pre}_url`] || (dpp ? DEFAULT_DPP_LOGO : DEFAULT_LOGO);
  const logo = await loadImg(url, { logo: true });
  const wIn = parseFloat(ctx.s[`${pre}_width`] || (dpp ? "5.55" : "4.53")) || 4.53;
  const hIn = parseFloat(ctx.s[`${pre}_height`] || "0.42") || 0.42;
  return { t: "letter", logo, logoW: wIn * 72, logoH: hIn * 72 };
}
const DIRECTOR_TITLE: Record<string, string> = {
  club_service: "Avenue Director - Club Service", community_service: "Avenue Director - Community Service",
  professional_service: "Avenue Director - Professional Service", international_service: "Avenue Director - International Service",
  district_priority_projects: "District Priority Projects Chair", treasurer: "Treasurer"
};
/** Which admin role normally holds each signature slot. */
const SLOT_ROLE: Record<string, string> = {
  club_service: "avenue_director_club_service", community_service: "avenue_director_community_service",
  professional_service: "avenue_director_professional_service", international_service: "avenue_director_international_service",
  district_priority_projects: "district_priority_chair", treasurer: "treasurer"
};
/**
 * Signature for an avenue director, the DPP chair or the treasurer.
 * Names come from ADMIN USERS (never from the members list):
 *   1. an active admin whose portfolio is linked to this slot in Site Settings → Portfolios, else
 *   2. an active admin holding the slot's usual role.
 * The title printed is the admin's portfolio name when one is set, otherwise the standard title.
 * A vacant slot returns a blank name so the signature line is still printed.
 */
async function specificSignatory(ctx: Ctx, key: string): Promise<[string, string]> {
  const role = SLOT_ROLE[key];
  if (!role) return ["", ""];
  const fallbackTitle = DIRECTOR_TITLE[key] || "";

  const portfolios = new Map<string, { name: string; slot: string }>();
  try {
    const { data } = await ctx.sb.from("admin_portfolios").select("id, name, signature_slot").eq("is_active", true);
    (data || []).forEach((p: any) => portfolios.set(p.id, { name: p.name, slot: p.signature_slot }));
  } catch { /* portfolio table not created yet — role lookup still works */ }

  // select("*") keeps this working before the optional columns exist
  const { data: rows } = await ctx.sb.from("admin_users").select("*").eq("is_active", true);
  const admins: any[] = rows || [];
  const idsOf = (a: any): string[] => [...new Set([a.portfolio_id, ...(Array.isArray(a.portfolio_ids) ? a.portfolio_ids : [])].filter(Boolean))];
  const holdsRole = (a: any) => a.role === role || (Array.isArray(a.extra_roles) && a.extra_roles.includes(role));
  const bySlot = admins.filter(a => idsOf(a).some(id => portfolios.get(id)?.slot === key));
  const byRole = admins.filter(holdsRole);
  const pick = bySlot[0] || byRole[0];
  if (!pick) return ["", fallbackTitle];
  // Title: the portfolio of THIS slot (a person with two posts prints the right title on each document)
  const own = idsOf(pick).map(id => portfolios.get(id)).find(p => p && p.slot === key);
  return [pick.full_name || "", own?.name || fallbackTitle];
}
/** Meetings: office bearers only. Reports/treasury: the specific director first, then the office bearers. */
const signBlock = (ctx: Ctx, specific?: [string, string] | null): Block =>
  ({ t: "sign", people: specific && specific[1] ? [specific, ...ctx.sign] : ctx.sign, club: ctx.club });

/* ------------------------------ EVENT BLOCKS ------------------------------ */
const EVENT_SELECT = `id,title,description,avenue,event_date,start_time,end_time,venue,event_chair,
  event_secretary,event_proposed_by,event_seconded_by,collaboration,collaborator_name,group_number,
  is_dpp,actual_attendance,beneficiaries,service_hours,budget_proposed,budget_actual,status,
  dpp_approval_number,dpp_pillar,dpp_category,dpp_council_member,
  event_photos(id,photo_url,photo_name,is_action_photo,sort_order),
  event_reports(id,report_content,key_highlights,challenges,outcomes,future_plans,is_approved,
    photo_urls,project_approval_number,dpp_pillar,dpp_category,council_member_or_trainer,
    council_members_count,rotarians_count,district_trainers_count,interactors_count)`;

const avenueOf = (e: any) => e.is_dpp ? AVENUES.district_priority_projects : (AVENUES[e.avenue] || e.avenue || "—");

async function eventSection(ctx: Ctx, e: any, withLetter = true): Promise<Block[]> {
  const isDPP = e.is_dpp === true;
  const rep = e.event_reports?.[0] || null;
  const group = ctx.s.current_group || "1";
  const rows: [string, string][] = [
    ["Event Name", e.title || "—"], ["Date", fmtDate(e.event_date)],
    ["Time", timeRange(e.start_time, e.end_time) || "—"], ["Venue", e.venue || "—"],
    ["Event Chair", e.event_chair || "—"]
  ];
  if (e.event_secretary) rows.push(["Event Secretary", e.event_secretary]);
  rows.push(["Avenue", avenueOf(e)], ["Group", `Group ${e.group_number || group}`]);
  if (e.event_proposed_by) rows.push(["Proposed By", e.event_proposed_by]);
  if (e.event_seconded_by) rows.push(["Seconded By", e.event_seconded_by]);
  if (e.collaboration && e.collaboration !== "none") {
    const l = COLLAB[e.collaboration] || e.collaboration;
    rows.push(["Collaboration", e.collaborator_name ? `${l} — ${e.collaborator_name}` : l]);
  }
  if (e.actual_attendance) rows.push(["Actual Attendance", `${e.actual_attendance} participants`]);
  const guestParts: string[] = [];
  const gc = (n: any, one: string, many: string) => { const v = parseInt(n, 10) || 0; if (v > 0) guestParts.push(`${v} ${v === 1 ? one : many}`); };
  gc(rep?.council_members_count, "Council Member", "Council Members");
  gc(rep?.rotarians_count, "Rotarian", "Rotarians");
  gc(rep?.district_trainers_count, "District Trainer", "District Trainers");
  gc(rep?.interactors_count, "Interactor", "Interactors");
  if (guestParts.length) rows.push(["Guests Present", guestParts.join("  |  ")]);
  if (e.beneficiaries) rows.push(["Beneficiaries", String(e.beneficiaries)]);
  if (e.service_hours) rows.push(["Service Hours", `${e.service_hours} hours`]);
  if (e.budget_actual) rows.push(["Actual Budget", fmtCur(e.budget_actual)]);

  const out: Block[] = [];
  if (withLetter) out.push(await letterhead(ctx, isDPP));
  out.push({ t: "title", text: e.title || "Untitled Event", sub: `${avenueOf(e)}  |  ${fmtDate(e.event_date)}` });
  out.push({ t: "kv", rows });

  if (isDPP) {
    const dpp: [string, string][] = [];
    const v = (a?: string, b?: string) => a || b || "";
    const ap = v(e.dpp_approval_number, rep?.project_approval_number);
    const pl = v(e.dpp_pillar, rep?.dpp_pillar);
    const ct = v(e.dpp_category, rep?.dpp_category);
    const cm = v(e.dpp_council_member, rep?.council_member_or_trainer);
    if (ap) dpp.push(["Project Approval Number", ap]);
    if (pl) dpp.push(["DPP Pillar", pl]);
    if (ct) dpp.push(["Category", ct]);
    if (cm) dpp.push(["Council Member / District Trainer", cm]);
    if (dpp.length) { out.push({ t: "h", text: "DPP Project Details" }); out.push({ t: "kv", rows: dpp, accent: true }); }
  }
  if (rep?.report_content) { out.push({ t: "h", text: "Report" }); out.push(...paras(rep.report_content)); }
  for (const [label, text] of [["Key Highlights", rep?.key_highlights], ["Outcomes", rep?.outcomes],
    ["Challenges", rep?.challenges], ["Future Plans", rep?.future_plans]] as [string, string][]) {
    if (text) { out.push({ t: "h", text: label }); out.push(...paras(text)); }
  }
  const action = (e.event_photos || []).filter((p: any) => p.is_action_photo === true)
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((p: any) => p.photo_url);
  const repPhotos = Array.isArray(rep?.photo_urls) ? rep.photo_urls : [];
  let urls = [...new Set([...repPhotos, ...action])].filter((u: any) => typeof u === "string" && u);
  if (isDPP) urls = urls.slice(0, MAX_DPP_PHOTOS);
  if (urls.length) {
    out.push({ t: "h", text: isDPP ? `Action Photographs (${urls.length}/${MAX_DPP_PHOTOS})` : "Action Photographs" });
    out.push({ t: "photos", imgs: await loadMany(urls) });
  }
  return out;
}

function monthRange(month: number, year: number) {
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}` };
}
function needMonthYear(p: any) {
  const month = parseInt(String(p.month), 10), year = parseInt(String(p.year), 10);
  if (isNaN(month) || month < 1 || month > 12) throw new HttpError(400, "month must be between 1 and 12");
  if (isNaN(year) || year < 2000 || year > 2100) throw new HttpError(400, "year must be a valid 4-digit year");
  return { month, year };
}

async function buildEventReport(ctx: Ctx, p: any): Promise<Model> {
  if (!p.event_id) throw new HttpError(400, "event_id is required");
  const { data: e, error } = await ctx.sb.from("events").select(EVENT_SELECT).eq("id", p.event_id).single();
  if (error || !e) throw new HttpError(404, "Event not found");
  const dirKey = e.is_dpp ? "district_priority_projects" : e.avenue;
  const blocks = [...await eventSection(ctx, e), signBlock(ctx, await specificSignatory(ctx, dirKey))];
  return { title: e.title, club: ctx.club, blocks, filename: `Report_${safeName(e.title)}_${e.event_date || "nodate"}` };
}

async function buildPeriodReport(ctx: Ctx, p: any, kind: "monthly" | "avenue" | "dpp"): Promise<Model> {
  const { month, year } = needMonthYear(p);
  let avenue = "";
  if (kind === "avenue") {
    avenue = String(p.avenue || "");
    if (!AVENUES[avenue]) throw new HttpError(400, `Invalid avenue. Use one of: ${Object.keys(AVENUES).join(", ")}`);
  }
  const isDPP = kind === "dpp" || avenue === "district_priority_projects";
  const label = kind === "monthly" ? "Monthly Report" : kind === "dpp" ? "District Priority Projects Report" : `${AVENUES[avenue]} Report`;
  const { start, end } = monthRange(month, year);
  let q = ctx.sb.from("events").select(EVENT_SELECT).gte("event_date", start).lte("event_date", end)
    .order("event_date", { ascending: true });
  if (kind !== "dpp" && avenue !== "district_priority_projects") q = q.eq("status", "completed");
  if (isDPP) q = q.eq("is_dpp", true);
  else if (kind === "avenue") q = q.eq("avenue", avenue).eq("is_dpp", false);
  const { data: events, error } = await q;
  if (error) throw new Error(`Events fetch error: ${error.message}`);
  if (!events?.length) throw new HttpError(404, `No events found for ${label.replace(" Report", "")} — ${MONTHS[month]} ${year}`);

  const sum = (k: string) => events.reduce((s: number, e: any) => s + (parseFloat(e[k]) || 0), 0);
  const approved = events.filter((e: any) => e.event_reports?.some((r: any) => r.is_approved)).length;
  const stats: [string, string][] = [["Events", String(events.length)]];
  if (isDPP) stats.push(["Reports Approved", `${approved}/${events.length}`]);
  if (sum("actual_attendance")) stats.push(["Participants", String(sum("actual_attendance"))]);
  if (sum("beneficiaries")) stats.push(["Beneficiaries", String(sum("beneficiaries"))]);
  if (sum("service_hours")) stats.push(["Service Hours", sum("service_hours").toFixed(1)]);
  const rsum = (k: string) => events.reduce((t: number, e: any) => t + (parseInt(e.event_reports?.[0]?.[k], 10) || 0), 0);
  if (rsum("council_members_count")) stats.push(["Council Members", String(rsum("council_members_count"))]);
  if (rsum("rotarians_count")) stats.push(["Rotarians", String(rsum("rotarians_count"))]);
  if (rsum("district_trainers_count")) stats.push(["District Trainers", String(rsum("district_trainers_count"))]);
  if (rsum("interactors_count")) stats.push(["Interactors", String(rsum("interactors_count"))]);

  const blocks: Block[] = [
    await letterhead(ctx, isDPP),
    { t: "title", text: label.toUpperCase(), sub: `${MONTHS[month]} ${year}  |  Rotary Year ${ctx.s.current_rotary_year || ""}`.replace(/\s+\|\s+Rotary Year\s*$/, "") },
    { t: "stats", items: stats },
    { t: "h", text: "Events Overview" },
    {
      t: "table", name: "Events", head: ["S.No", "Date", "Event", "Venue", ...(kind === "monthly" ? ["Avenue"] : []), "Attendance"],
      widths: kind === "monthly" ? [7, 14, 28, 20, 18, 13] : [7, 15, 36, 26, 16],
      align: kind === "monthly" ? ["c", "l", "l", "l", "l", "c"] : ["c", "l", "l", "l", "c"],
      rows: events.map((e: any, i: number) => [String(i + 1), fmtShort(e.event_date), e.title || "", e.venue || "",
        ...(kind === "monthly" ? [avenueOf(e)] : []), e.actual_attendance ? String(e.actual_attendance) : "—"])
    }
  ];
  const specific = kind === "monthly" ? null : await specificSignatory(ctx, isDPP ? "district_priority_projects" : avenue);
  blocks.push(signBlock(ctx, specific));
  for (const e of events) {
    blocks.push({ t: "pagebreak" });
    blocks.push(...await eventSection(ctx, e));
  }
  blocks.push(signBlock(ctx, specific));
  const tag = kind === "monthly" ? "Monthly_Report" : kind === "dpp" ? "DPP_Report" : `${safeName(AVENUES[avenue])}_Report`;
  return { title: `${label} ${MONTHS[month]} ${year}`, club: ctx.club, blocks, filename: `${tag}_${MONTHS[month]}_${year}` };
}

/* ------------------------------ MEETING BLOCKS ------------------------------ */
async function loadMeeting(ctx: Ctx, id: string, withPhotos = false) {
  if (!id) throw new HttpError(400, "meeting_id is required");
  const cols = `id,title,meeting_type,meeting_date,start_time,end_time,actual_start_time,actual_end_time,venue,
    description,agenda,minutes_content,minutes_prepared_by,sergeant_at_arms,minutes_finalized,group_number,poster_url`
    + (withPhotos ? ",meeting_photos(id,photo_url,photo_name,sort_order)" : "");
  const { data, error } = await ctx.sb.from("meetings").select(cols).eq("id", id).single();
  if (error || !data) throw new HttpError(404, "Meeting not found");
  return data as any;
}
function agendaItems(m: any): string[] {
  const raw = typeof m.agenda === "string" ? (() => { try { return JSON.parse(m.agenda); } catch { return []; } })() : m.agenda;
  return (Array.isArray(raw) ? raw : []).map((i: any) =>
    typeof i === "string" ? i.trim() : i && i.text ? String(i.text).trim() : "").filter(Boolean);
}
function meetingKv(m: any, ctx: Ctx, actual = false): [string, string][] {
  const s = actual ? (m.actual_start_time || m.start_time) : m.start_time;
  const e = actual ? (m.actual_end_time || m.end_time) : m.end_time;
  const rows: [string, string][] = [
    ["Meeting Name", m.title || "—"], ["Date", fmtDate(m.meeting_date)], ["Time", timeRange(s, e) || "—"],
    ["Venue", m.venue || "—"], ["Type", MTG_TYPES[m.meeting_type] || m.meeting_type || "Meeting"],
    ["Group", `Group ${m.group_number || ctx.s.current_group || "1"}`]
  ];
  if (m.minutes_prepared_by) rows.push(["Minutes Prepared By", m.minutes_prepared_by]);
  if (m.sergeant_at_arms) rows.push(["Sergeant at Arms", m.sergeant_at_arms]);
  return rows;
}
const agendaBlocks = (m: any): Block[] => {
  const items = agendaItems(m);
  return [{ t: "h", text: "Agenda" },
    items.length ? { t: "bullets", items } : { t: "p", text: "Agenda items will be announced at the meeting." }];
};
async function attendanceBlocks(ctx: Ctx, m: any): Promise<Block[]> {
  const { data } = await ctx.sb.from("meeting_attendance")
    .select("id,member_name,ri_id,designation,in_time,e_sign_url,submitted_at").eq("meeting_id", m.id)
    .order("in_time", { ascending: true });
  const recs = data || [];
  const sigs = await loadMany(recs.map((r: any) => r.e_sign_url || ""), false);
  const rows: Cell[][] = recs.length
    ? recs.map((r: any, i: number) => [String(i + 1), r.member_name || "—", r.ri_id || "—", r.designation || "—",
      r.in_time ? fmtTime(r.in_time) : "—", sigs[i]])
    : Array.from({ length: 15 }, (_, i) => [String(i + 1), "", "", "", "", null]);
  return [
    { t: "h", text: `Attendance Sheet — ${recs.length} present` },
    { t: "table", name: "Attendance", head: ["S.No", "Name", "RI ID", "Portfolio", "In Time", "Signature"],
      widths: [7, 27, 12, 20, 12, 22], align: ["c", "l", "c", "l", "c", "c"], rows }
  ];
}
function minutesBlocks(m: any): Block[] {
  const entries = (Array.isArray(m.minutes_content) ? m.minutes_content : [])
    .filter((x: any) => x && typeof x === "object")
    .map((x: any) => ({ time: x.time ? fmtTime(x.time) : "", heading: x.heading || "", details: x.details || "" }));
  const start = m.actual_start_time || m.start_time, end = m.actual_end_time || m.end_time;
  const dur = minutesBetween(start, end);
  const out: Block[] = [{ t: "h", text: "Meeting Minutes" }];
  if (start) out.push({ t: "p", text: `Meeting called to order at ${fmtTime(start)}` });
  out.push(entries.length ? { t: "timeline", entries } : { t: "p", text: "No minutes entries were recorded for this meeting." });
  if (dur > 0) out.push({ t: "kv", rows: [["Duration of Meeting", `${dur} minutes`]], accent: true });
  return out;
}

async function buildAgenda(ctx: Ctx, p: any): Promise<Model> {
  const m = await loadMeeting(ctx, p.meeting_id);
  return { title: `Agenda — ${m.title}`, club: ctx.club, filename: `Agenda_${safeName(m.title)}_${m.meeting_date || "nodate"}`,
    blocks: [await letterhead(ctx, false), { t: "title", text: "AGENDA", sub: m.title }, { t: "kv", rows: meetingKv(m, ctx) },
      ...agendaBlocks(m), signBlock(ctx)] };
}
async function buildMinutes(ctx: Ctx, p: any): Promise<Model> {
  const m = await loadMeeting(ctx, p.meeting_id, true);
  const urls = (m.meeting_photos || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((x: any) => x.photo_url).filter(Boolean);
  const blocks: Block[] = [await letterhead(ctx, false), { t: "title", text: "MEETING MINUTES", sub: m.title },
    { t: "kv", rows: meetingKv(m, ctx) }, ...minutesBlocks(m)];
  if (urls.length) blocks.push({ t: "h", text: "Meeting Photographs" }, { t: "photos", imgs: await loadMany(urls) });
  blocks.push(signBlock(ctx));
  return { title: `Minutes — ${m.title}`, club: ctx.club, blocks, filename: `Minutes_${safeName(m.title)}_${m.meeting_date || "nodate"}` };
}
async function buildAttendance(ctx: Ctx, p: any): Promise<Model> {
  const m = await loadMeeting(ctx, p.meeting_id);
  return { title: `Attendance — ${m.title}`, club: ctx.club, filename: `Attendance_${safeName(m.title)}_${m.meeting_date || "nodate"}`,
    blocks: [await letterhead(ctx, false), { t: "title", text: "ATTENDANCE SHEET", sub: m.title },
      { t: "kv", rows: meetingKv(m, ctx, true) }, ...await attendanceBlocks(ctx, m), signBlock(ctx)] };
}
async function buildCombinedMeeting(ctx: Ctx, p: any): Promise<Model> {
  const m = await loadMeeting(ctx, p.meeting_id, true);
  const urls = (m.meeting_photos || []).map((x: any) => x.photo_url).filter(Boolean);
  const blocks: Block[] = [await letterhead(ctx, false), { t: "title", text: "MEETING RECORD", sub: m.title },
    { t: "kv", rows: meetingKv(m, ctx) }, ...agendaBlocks(m),
    { t: "pagebreak" }, ...await attendanceBlocks(ctx, m),
    { t: "pagebreak" }, ...minutesBlocks(m)];
  if (urls.length) blocks.push({ t: "h", text: "Meeting Photographs" }, { t: "photos", imgs: await loadMany(urls) });
  blocks.push(signBlock(ctx));
  return { title: `Meeting Record — ${m.title}`, club: ctx.club, blocks, filename: `Meeting_Record_${safeName(m.title)}_${m.meeting_date || "nodate"}` };
}
async function buildCombinedAgenda(ctx: Ctx, p: any): Promise<Model> {
  const { month, year } = needMonthYear(p);
  const { start, end } = monthRange(month, year);
  let q = ctx.sb.from("meetings").select("id,title,meeting_type,meeting_date,start_time,end_time,venue,agenda,group_number")
    .gte("meeting_date", start).lte("meeting_date", end).order("meeting_date", { ascending: true });
  if (p.meeting_type) q = q.eq("meeting_type", p.meeting_type);
  const { data: ms, error } = await q;
  if (error) throw new Error(`Meetings fetch error: ${error.message}`);
  if (!ms?.length) throw new HttpError(404, `No meetings found for ${MONTHS[month]} ${year}`);
  const blocks: Block[] = [await letterhead(ctx, false),
    { t: "title", text: "COMBINED AGENDA", sub: `${MONTHS[month]} ${year}` },
    { t: "stats", items: [["Meetings", String(ms.length)]] },
    { t: "table", name: "Meetings", head: ["S.No", "Date", "Meeting", "Type", "Time", "Venue"], widths: [7, 15, 28, 17, 15, 18],
      align: ["c", "l", "l", "l", "l", "l"],
      rows: ms.map((m: any, i: number) => [String(i + 1), fmtShort(m.meeting_date), m.title || "",
        MTG_TYPES[m.meeting_type] || m.meeting_type || "", fmtTime(m.start_time), m.venue || ""]) }];
  ms.forEach((m: any, i: number) => {
    blocks.push({ t: "pagebreak" }, { t: "h", text: `${i + 1}. ${m.title} — ${fmtDate(m.meeting_date)}` },
      { t: "kv", rows: [["Time", timeRange(m.start_time, m.end_time) || "—"], ["Venue", m.venue || "—"],
        ["Type", MTG_TYPES[m.meeting_type] || m.meeting_type || ""]] },
      ...agendaBlocks(m).slice(1));
  });
  blocks.push(signBlock(ctx));
  return { title: `Combined Agenda ${MONTHS[month]} ${year}`, club: ctx.club, blocks, filename: `Combined_Agenda_${MONTHS[month]}_${year}` };
}

/* ------------------------------ TREASURY ------------------------------ */
async function buildTreasury(ctx: Ctx, p: any): Promise<Model> {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(p.from_date || "") || !re.test(p.to_date || "")) throw new HttpError(400, "from_date and to_date must be YYYY-MM-DD");
  if (p.from_date > p.to_date) throw new HttpError(400, "from_date must be on or before to_date");
  const { data: tx, error } = await ctx.sb.from("treasury_transactions")
    .select("id,transaction_date,particular,description,transaction_type,amount,balance,category,voucher_number,is_verified,created_at")
    .gte("transaction_date", p.from_date).lte("transaction_date", p.to_date)
    .order("transaction_date", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw new Error(`Transactions fetch error: ${error.message}`);
  const list = tx || [];
  const { data: prev } = await ctx.sb.from("treasury_transactions").select("balance").lt("transaction_date", p.from_date)
    .order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(1);
  let opening = parseFloat(prev?.[0]?.balance ?? "0") || 0;
  if (!prev?.length) {   // nothing recorded before this period → start from the club's opening balance (Treasury → Opening balance)
    const { data: ob } = await ctx.sb.from("club_settings").select("key,value").in("key", ["treasury_opening_balance", "treasury_opening_date"]);
    const amount = parseFloat((ob || []).find((r: any) => r.key === "treasury_opening_balance")?.value ?? "0") || 0;
    const asOf = (ob || []).find((r: any) => r.key === "treasury_opening_date")?.value || "";
    if (!asOf || asOf <= p.to_date) opening = amount;
  }
  const amt = (t: any) => parseFloat(t.amount) || 0;
  const income = list.filter((t: any) => t.transaction_type === "income").reduce((s: number, t: any) => s + amt(t), 0);
  const expense = list.filter((t: any) => t.transaction_type === "expense").reduce((s: number, t: any) => s + amt(t), 0);
  const closing = list.length ? (parseFloat(list[list.length - 1].balance) || opening + income - expense) : opening;

  const cats: Record<string, [number, number]> = {};
  list.forEach((t: any) => { const c = t.category || "Uncategorised"; cats[c] ||= [0, 0];
    cats[c][t.transaction_type === "income" ? 0 : 1] += amt(t); });

  const blocks: Block[] = [await letterhead(ctx, false),
    { t: "title", text: "TREASURY STATEMENT", sub: `${fmtDate(p.from_date)} to ${fmtDate(p.to_date)}` },
    { t: "stats", items: [["Opening Balance", fmtCur(opening)], ["Total Income", fmtCur(income)],
      ["Total Expense", fmtCur(expense)], ["Closing Balance", fmtCur(closing)]] },
    { t: "h", text: `Transactions (${list.length})` },
    { t: "table", name: "Transactions", head: ["S.No", "Date", "Particular", "Category", "Voucher", "Income", "Expense", "Balance"],
      widths: [6, 13, 23, 13, 9, 12, 12, 12], align: ["c", "l", "l", "l", "l", "r", "r", "r"],
      rows: list.map((t: any, i: number) => [String(i + 1), fmtShort(t.transaction_date), t.particular || "", t.category || "",
        t.voucher_number || "", t.transaction_type === "income" ? fmtCur(t.amount) : "", t.transaction_type === "expense" ? fmtCur(t.amount) : "",
        fmtCur(t.balance)]),
      foot: ["", "", "TOTAL", "", "", fmtCur(income), fmtCur(expense), fmtCur(closing)] }];
  const catRows = Object.entries(cats);
  if (catRows.length) blocks.push({ t: "h", text: "Category Summary" }, { t: "table", name: "Categories",
    head: ["Category", "Income", "Expense", "Net"], widths: [40, 20, 20, 20], align: ["l", "r", "r", "r"],
    rows: catRows.map(([c, [i, e]]) => [c, fmtCur(i), fmtCur(e), fmtCur(i - e)]) });
  blocks.push(signBlock(ctx, await specificSignatory(ctx, "treasurer")));
  return { title: "Treasury Statement", club: ctx.club, blocks, filename: `Treasury_Statement_${p.from_date}_to_${p.to_date}` };
}

/* ------------------------------ DATA (for Excel) ------------------------------ */
function toData(model: Model) {
  const sheets: any[] = [];
  const summary: [string, string][] = [];
  for (const b of model.blocks) {
    if (b.t === "stats") summary.push(...b.items);
    if (b.t === "kv" && !sheets.length) summary.push(...b.rows);
    if (b.t === "table") sheets.push({ name: b.name, head: b.head, widths: b.widths, align: b.align,
      rows: b.rows.map(r => r.map(c => typeof c === "string" || c === null ? (c ?? "") : "")), foot: b.foot || null });
  }
  return { title: model.title, club: model.club, filename: model.filename, summary, sheets };
}

/* ============================================================
   RENDERER 1 — WORD (.docx)
   ============================================================ */
const PAGE_W = 11906, MARGIN = 960, CONTENT = PAGE_W - MARGIN * 2; // twips
const px = (pt: number) => Math.round(pt * 96 / 72);
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NOB = { top: NB, bottom: NB, left: NB, right: NB };
const hair = (color: string, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const AL: Record<string, any> = { l: AlignmentType.LEFT, c: AlignmentType.CENTER, r: AlignmentType.RIGHT };
/* Word picks the right font per script: Latin = Calibri, Indic/Arabic/Hebrew/Thai = Nirmala UI / Segoe UI, CJK = Microsoft YaHei */
const DOCX_FONT = { ascii: "Calibri", hAnsi: "Calibri", cs: "Nirmala UI", eastAsia: "Microsoft YaHei" };
const run = (text: string, o: any = {}) => new TextRun({ text, font: DOCX_FONT, size: 21, color: C.ink, ...o });
const fit = (img: Img, maxW: number, maxH: number) => {
  const k = Math.min(maxW / img.w, maxH / img.h, 1e6);
  return { width: Math.max(1, Math.round(img.w * k)), height: Math.max(1, Math.round(img.h * k)) };
};
const imgRun = (img: Img, maxWpt: number, maxHpt: number) => {
  const s = fit(img, px(maxWpt), px(maxHpt));
  return new ImageRun({ data: img.data, type: img.type, transformation: s } as any);
};
const gap = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

function dxaCols(widths: number[], total = CONTENT) {
  const sum = widths.reduce((a, b) => a + b, 0) || 1;
  const cols = widths.map(w => Math.floor(total * w / sum));
  cols[cols.length - 1] += total - cols.reduce((a, b) => a + b, 0);
  return cols;
}

function docxBlocks(blocks: Block[], club: string, parent: string, meta: string): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case "letter": {
        if (b.logo) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [imgRun(b.logo, Math.min(b.logoW, 440), b.logoH)] }));
        out.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: [CONTENT],
          borders: { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB },
          rows: [new TableRow({ children: [new TableCell({ width: { size: CONTENT, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: C.c800, color: "auto" }, borders: NOB,
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(club, { bold: true, size: 36, color: C.white })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [run(`Sponsored by ${parent}`, { size: 22, color: C.c100 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [run(meta, { size: 19, color: C.c200 })] })
            ] })] })] }));
        out.push(new Paragraph({ spacing: { after: 220 }, border: { bottom: hair(C.c400, 18) }, children: [] }));
        break;
      }
      case "title":
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: b.sub ? 40 : 160 },
          children: [run(b.text, { bold: true, size: 36, color: C.c700 })] }));
        if (b.sub) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
          children: [run(b.sub, { size: 23, color: C.c600 })] }));
        break;
      case "h":
        out.push(new Paragraph({ keepNext: true, spacing: { before: 260, after: 120 }, indent: { left: 140 },
          border: { left: { style: BorderStyle.SINGLE, size: 24, color: C.c500, space: 8 } },
          children: [run(b.text, { bold: true, size: 26, color: C.c700 })] }));
        break;
      case "p":
        out.push(new Paragraph({ alignment: AlignmentType.BOTH, spacing: { after: 120, line: 288 }, children: [run(b.text)] }));
        break;
      case "bullets":
        b.items.forEach(t => out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 90, line: 276 }, children: [run(t)] })));
        break;
      case "kv": {
        const cols = dxaCols([30, 70]);
        out.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: cols,
          borders: { top: NB, bottom: hair(C.c200), left: NB, right: NB, insideHorizontal: hair(C.c100), insideVertical: NB },
          rows: b.rows.map(([k, v], i) => new TableRow({ cantSplit: true, children: [
            new TableCell({ width: { size: cols[0], type: WidthType.DXA }, margins: { top: 70, bottom: 70, left: 140, right: 100 },
              shading: { type: ShadingType.CLEAR, fill: b.accent ? C.c100 : (i % 2 ? C.c50 : C.white), color: "auto" }, borders: NOB,
              children: [new Paragraph({ children: [run(k, { bold: true, color: C.c700 })] })] }),
            new TableCell({ width: { size: cols[1], type: WidthType.DXA }, margins: { top: 70, bottom: 70, left: 140, right: 100 },
              shading: { type: ShadingType.CLEAR, fill: b.accent ? C.c100 : (i % 2 ? C.c50 : C.white), color: "auto" }, borders: NOB,
              children: [new Paragraph({ children: [run(v || "—")] })] })
          ] })) }));
        out.push(gap(80));
        break;
      }
      case "stats": {
        const n = b.items.length, cols = dxaCols(b.items.map(() => 1));
        out.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: cols,
          borders: { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: "FFFFFF" } },
          rows: [new TableRow({ children: b.items.map(([k, v], i) => new TableCell({ width: { size: cols[i], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: C.c100, color: "auto" }, verticalAlign: VerticalAlign.CENTER,
            margins: { top: 140, bottom: 140, left: 80, right: 80 },
            borders: { top: { style: BorderStyle.SINGLE, size: 18, color: C.c500 }, bottom: NB, left: NB, right: NB },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(v, { bold: true, size: n > 3 ? 24 : 32, color: C.c700 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [run(k, { size: 17, color: C.muted })] })] })) })] }));
        out.push(gap(120));
        break;
      }
      case "table": {
        const cols = dxaCols(b.widths);
        const mkCell = (c: Cell, i: number, o: { head?: boolean; fill?: string; bold?: boolean }) => new TableCell({
          width: { size: cols[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          shading: { type: ShadingType.CLEAR, fill: o.fill || C.white, color: "auto" },
          borders: { top: hair(C.c200), bottom: hair(C.c200), left: hair(C.c200), right: hair(C.c200) },
          children: [new Paragraph({ alignment: AL[b.align[i]] || AlignmentType.LEFT,
            children: c && typeof c === "object" ? [imgRun(c, 90, 32)]
              : [run(String(c ?? ""), { size: 18, bold: o.bold || o.head, color: o.head ? C.white : C.ink })] })] });
        const rows: TableRow[] = [new TableRow({ tableHeader: true, cantSplit: true,
          children: b.head.map((h, i) => mkCell(h, i, { head: true, fill: C.c700 })) })];
        b.rows.forEach((r, ri) => rows.push(new TableRow({ cantSplit: true,
          height: r.some(c => c && typeof c === "object") || b.name === "Attendance" ? { value: 620, rule: "atLeast" as any } : undefined,
          children: r.map((c, i) => mkCell(c, i, { fill: ri % 2 ? C.c50 : C.white })) })));
        if (b.foot) rows.push(new TableRow({ cantSplit: true, children: b.foot.map((c, i) => mkCell(c, i, { fill: C.c200, bold: true })) }));
        out.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: cols, rows }));
        out.push(gap(120));
        break;
      }
      case "timeline": {
        const cols = dxaCols([16, 84]);
        const rows: TableRow[] = [];
        b.entries.forEach(en => {
          rows.push(new TableRow({ cantSplit: true, children: [
            new TableCell({ width: { size: cols[0], type: WidthType.DXA }, borders: { ...NOB, right: { style: BorderStyle.SINGLE, size: 12, color: C.c300 } },
              margins: { top: 100, bottom: 40, left: 40, right: 100 },
              children: [new Paragraph({ children: [run(en.time, { bold: true, color: C.c600, size: 20 })] })] }),
            new TableCell({ width: { size: cols[1], type: WidthType.DXA }, borders: NOB, margins: { top: 100, bottom: 40, left: 160, right: 40 },
              children: [new Paragraph({ children: [run(en.heading, { bold: true, size: 22, color: C.c800 })] })] })] }));
          if (en.details) rows.push(new TableRow({ children: [
            new TableCell({ width: { size: cols[0], type: WidthType.DXA }, borders: { ...NOB, right: { style: BorderStyle.SINGLE, size: 12, color: C.c300 } }, children: [new Paragraph({ children: [] })] }),
            new TableCell({ width: { size: cols[1], type: WidthType.DXA }, margins: { top: 20, bottom: 120, left: 160, right: 40 },
              borders: { ...NOB, bottom: hair(C.c100) }, children: [new Paragraph({ alignment: AlignmentType.BOTH, children: [run(en.details, { size: 20 })] })] })] }));
        });
        out.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: cols, rows,
          borders: { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB } }));
        out.push(gap(100));
        break;
      }
      case "photos": {
        const imgs = b.imgs.filter(Boolean) as Img[];
        if (!imgs.length) break;
        const cols = dxaCols([1, 1]);
        const rows: TableRow[] = [];
        for (let i = 0; i < imgs.length; i += 2) {
          rows.push(new TableRow({ cantSplit: true, children: [0, 1].map(k => new TableCell({ width: { size: cols[k], type: WidthType.DXA },
            borders: NOB, margins: { top: 60, bottom: 60, left: 60, right: 60 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: imgs[i + k] ? [imgRun(imgs[i + k], 245, 175)] : [] })] })) }));
        }
        out.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: cols, rows,
          borders: { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB } }));
        out.push(gap(100));
        break;
      }
      case "sign": {
        const cols = dxaCols(b.people.map(() => 1));
        out.push(gap(500));
        out.push(new Table({ width: { size: CONTENT, type: WidthType.DXA }, columnWidths: cols,
          borders: { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB },
          rows: [new TableRow({ cantSplit: true, children: b.people.map(([name, role], i) => new TableCell({
            width: { size: cols[i], type: WidthType.DXA }, margins: { left: 100, right: 100 }, borders: NOB,
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, border: { top: hair(C.c600, 8) }, spacing: { before: 380 },
                children: [run(name || " ", { bold: true, size: 20, color: C.c800 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [run(role, { size: 18, color: C.c600 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [run(b.club, { size: 15, color: C.muted })] })] })) })] }));
        break;
      }
      case "pagebreak":
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
    }
  }
  return out;
}

async function renderDocx(model: Model, ctx: Ctx): Promise<Uint8Array> {
  const parent = ctx.s.parent_club || "Rotary Club of Coimbatore Meridian";
  const meta = `${ctx.s.club_id || "217835"}  |  Group ${ctx.s.current_group || "1"}  |  ${DISTRICT}`;
  const children = docxBlocks(model.blocks, model.club, parent, meta);
  const doc = new Document({
    creator: model.club, title: model.title,
    styles: { default: { document: { run: { font: DOCX_FONT, size: 21 } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 760, bottom: 900, left: MARGIN, right: MARGIN, footer: 400 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: hair(C.c300, 6) },
        children: [run(`${model.club}  •  Page `, { size: 16, color: C.c500 }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.c500, font: "Calibri" }),
          run(" of ", { size: 16, color: C.c500 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.c500, font: "Calibri" })] })] }) },
      children
    }]
  });
  const buf = await Packer.toBuffer(doc);
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf as any);
}

/* ============================================================
   RENDERER 2 — PDF
   ============================================================ */
const hex = (h: string) => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
const win = (s: unknown) => String(s ?? "").replace(/₹/g, "Rs. ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/\u2026/g, "...").replace(/[\u2013\u2014]/g, "-").replace(/[\u2022\u25CF]/g, "*").replace(/\u00A0/g, " ")
  .replace(/\s{2,}/g, m => m.length > 3 ? "   " : m).replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");

/* ---------- MULTI-LANGUAGE PDF TEXT ----------
   Helvetica (built in) draws Latin text. Any other script (Tamil, Hindi, Telugu, Arabic, Cyrillic ...)
   is drawn with a matching Noto Sans font that is downloaded once and embedded (only the glyphs used).
   Text is split into runs per script so English and local-language text can share one line. */
const SCRIPTS: Record<string, { re: RegExp; font: string; sub: string }> = {
  tamil:      { re: /[\u0B80-\u0BFF]/,                         font: "noto-sans-tamil",      sub: "tamil" },
  devanagari: { re: /[\u0900-\u097F\uA8E0-\uA8FF]/,            font: "noto-sans-devanagari", sub: "devanagari" },
  bengali:    { re: /[\u0980-\u09FF]/,                         font: "noto-sans-bengali",    sub: "bengali" },
  gurmukhi:   { re: /[\u0A00-\u0A7F]/,                         font: "noto-sans-gurmukhi",   sub: "gurmukhi" },
  gujarati:   { re: /[\u0A80-\u0AFF]/,                         font: "noto-sans-gujarati",   sub: "gujarati" },
  telugu:     { re: /[\u0C00-\u0C7F]/,                         font: "noto-sans-telugu",     sub: "telugu" },
  kannada:    { re: /[\u0C80-\u0CFF]/,                         font: "noto-sans-kannada",    sub: "kannada" },
  malayalam:  { re: /[\u0D00-\u0D7F]/,                         font: "noto-sans-malayalam",  sub: "malayalam" },
  arabic:     { re: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/, font: "noto-sans-arabic", sub: "arabic" },
  hebrew:     { re: /[\u0590-\u05FF]/,                         font: "noto-sans-hebrew",     sub: "hebrew" },
  thai:       { re: /[\u0E00-\u0E7F]/,                         font: "noto-sans-thai",       sub: "thai" },
  cyrillic:   { re: /[\u0400-\u04FF]/,                         font: "noto-sans",            sub: "cyrillic" },
  greek:      { re: /[\u0370-\u03FF]/,                         font: "noto-sans",            sub: "greek" },
};
const RTL = new Set(["arabic", "hebrew"]);
const fontBytesCache = new Map<string, Uint8Array | null>();
async function fetchFont(script: string, weight: 400 | 700): Promise<Uint8Array | null> {
  const key = `${script}-${weight}`;
  if (fontBytesCache.has(key)) return fontBytesCache.get(key)!;
  const d = SCRIPTS[script];
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fontsource/${d.font}/files/${d.font}-${d.sub}-${weight}-normal.woff`,
    `https://cdn.jsdelivr.net/fontsource/fonts/${d.font}@latest/${d.sub}-${weight}-normal.woff`,
    `https://unpkg.com/@fontsource/${d.font}/files/${d.font}-${d.sub}-${weight}-normal.woff`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length > 1000) { fontBytesCache.set(key, b); return b; } }
    } catch (_) { /* try next */ }
  }
  console.warn(`[pdf] could not load a ${script} font; those characters will print as ?`);
  fontBytesCache.set(key, null);
  return null;
}
function scriptOf(ch: string): string | null {
  const c = ch.codePointAt(0)!;
  if (c < 0x370) return null;                      // Latin, digits, punctuation → Helvetica
  if (c === 0x200C || c === 0x200D) return "joiner"; // keeps conjuncts together
  for (const k of Object.keys(SCRIPTS)) if (SCRIPTS[k].re.test(ch)) return k;
  return null;
}
function scriptsIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const ch of text) { const sc = scriptOf(ch); if (sc && sc !== "joiner") out.add(sc); }
  return out;
}
class MultiFont {
  constructor(public latin: any, public byScript: Record<string, any>) {}
  /** split into [script|null, text] runs; "null" = Latin/neutral run drawn with Helvetica */
  runs(text: string): [string | null, string][] {
    const out: [string | null, string][] = [];
    let cur: string | null | undefined, buf = "";
    for (const ch of String(text ?? "")) {
      let sc = scriptOf(ch);
      if (sc === "joiner") sc = (cur && cur !== null) ? cur : null;
      if (sc && !this.byScript[sc]) sc = null;      // font unavailable → '?' via win()
      if (cur === undefined) cur = sc;
      if (sc !== cur) { out.push([cur ?? null, buf]); buf = ""; cur = sc; }
      buf += ch;
    }
    if (buf) out.push([cur ?? null, buf]);
    return out;
  }
  private part(sc: string | null, t: string): [any, string] {
    if (!sc) return [this.latin, win(t)];
    let s = t;
    if (RTL.has(sc)) s = [...t].reverse().join("");  // simple right-to-left display order
    return [this.byScript[sc], s];
  }
  widthOfTextAtSize(text: string, size: number): number {
    let w = 0;
    for (const [sc, t] of this.runs(text)) { const [f, s] = this.part(sc, t); try { w += f.widthOfTextAtSize(s, size); } catch (_) { w += s.length * size * 0.55; } }
    return w;
  }
  draw(page: any, text: string, o: any) {
    let x = o.x;
    for (const [sc, t] of this.runs(text)) {
      const [f, s] = this.part(sc, t);
      if (!s) continue;
      try { page.drawText(s, { ...o, x, font: f }); x += f.widthOfTextAtSize(s, o.size); } catch (_) { /* skip unsupported glyph run */ }
    }
  }
}

class PdfWriter {
  doc!: PDFDocument; f: any; fb: any; page: any; y = 0;
  W = 595.28; H = 841.89; M = 46;
  get cw() { return this.W - this.M * 2; }
  private imgs = new Map<Img, any>();
  static async create(model?: unknown) { const w = new PdfWriter(); w.doc = await PDFDocument.create(); w.f = await w.doc.embedFont(StandardFonts.Helvetica);
    w.fb = await w.doc.embedFont(StandardFonts.HelveticaBold);
    const need = model ? scriptsIn(JSON.stringify(model, (_k, v) => (v instanceof Uint8Array ? undefined : v))) : new Set<string>();
    if (need.size) {
      w.doc.registerFontkit(fontkit);
      const reg: Record<string, any> = {}, bold: Record<string, any> = {};
      for (const sc of need) {
        try {
          const r = await fetchFont(sc, 400); if (!r) continue;
          reg[sc] = await w.doc.embedFont(r, { subset: true });
          const b = await fetchFont(sc, 700);
          bold[sc] = b ? await w.doc.embedFont(b, { subset: true }) : reg[sc];
        } catch (e) { console.warn(`[pdf] font embed failed for ${sc}:`, e); }
      }
      if (Object.keys(reg).length) { w.f = new MultiFont(w.f, reg); w.fb = new MultiFont(w.fb, bold); w.multi = true; }
    }
    w.newPage(); return w; }
  multi = false;
  /** sanitise for Helvetica only when no multi-language font is active */
  s(t: unknown): string { return this.multi ? String(t ?? "") : win(t); }
  dt(page: any, text: string, o: any) { if (o.font instanceof MultiFont) o.font.draw(page, text, o); else page.drawText(text, o); }
  newPage() { this.page = this.doc.addPage([this.W, this.H]); this.y = this.H - this.M; }
  need(h: number) { if (this.y - h < this.M + 22) this.newPage(); }
  wrap(text: string, font: any, size: number, maxW: number): string[] {
    const out: string[] = [];
    for (const para of this.s(text).split("\n")) {
      let line = "";
      for (let word of para.split(" ")) {
        while (font.widthOfTextAtSize(word, size) > maxW) { // break very long words
          let k = word.length; while (k > 1 && font.widthOfTextAtSize(word.slice(0, k), size) > maxW) k--;
          if (line) { out.push(line); line = ""; }
          out.push(word.slice(0, k)); word = word.slice(k);
        }
        const t = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(t, size) <= maxW) line = t; else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }
  textBlock(text: string, o: { x?: number; w?: number; size?: number; bold?: boolean; color?: string; align?: string; lh?: number; justify?: boolean } = {}) {
    const size = o.size || 10, font = o.bold ? this.fb : this.f, lh = o.lh || size * 1.45, x0 = o.x ?? this.M, w = o.w ?? this.cw;
    const lines = this.wrap(text, font, size, w);
    for (const ln of lines) {
      this.need(lh);
      const tw = font.widthOfTextAtSize(ln, size);
      const x = o.align === "c" ? x0 + (w - tw) / 2 : o.align === "r" ? x0 + w - tw : x0;
      this.dt(this.page, ln, { x, y: this.y - size, size, font, color: hex(o.color || C.ink) });
      this.y -= lh;
    }
    return lines.length * lh;
  }
  emb(img: Img) { if (!this.imgs.has(img)) this.imgs.set(img, null); return this.imgs.get(img); }
  async embedAll(blocks: Block[]) {
    const all: Img[] = [];
    for (const b of blocks) {
      if (b.t === "letter" && b.logo) all.push(b.logo);
      if (b.t === "photos") b.imgs.forEach(i => i && all.push(i));
      if (b.t === "table") b.rows.forEach(r => r.forEach(c => c && typeof c === "object" && all.push(c)));
    }
    // pdf-lib decodes PNGs in JavaScript (slow, memory hungry) -> keep within the edge-function limits.
    let pngBudget = 1_200_000, jpgBudget = 9_000_000, count = 0, pixelBudget = 1_500_000;
    for (const i of all) if (!this.imgs.get(i)) {
      const size = i.data.byteLength;
      const px = i.w * i.h;
      if (i.type === "png" ? (size > pngBudget || px > 600_000 || px > pixelBudget)
                           : (size > jpgBudget || count >= 24)) { this.imgs.set(i, undefined); continue; }
      try {
        this.imgs.set(i, i.type === "png" ? await this.doc.embedPng(i.data) : await this.doc.embedJpg(i.data));
        if (i.type === "png") { pngBudget -= size; pixelBudget -= px; } else jpgBudget -= size;
        count++;
      } catch { this.imgs.set(i, undefined); }
    }
  }
  drawImg(img: Img, x: number, y: number, maxW: number, maxH: number, center = true) {
    const e = this.imgs.get(img); if (!e) return { w: 0, h: 0 };
    const k = Math.min(maxW / e.width, maxH / e.height); const w = e.width * k, h = e.height * k;
    this.page.drawImage(e, { x: center ? x + (maxW - w) / 2 : x, y: y + (maxH - h) / 2, width: w, height: h });
    return { w, h };
  }
  rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, sw = 0.6) {
    this.page.drawRectangle({ x, y, width: w, height: h, color: fill ? hex(fill) : undefined,
      borderColor: stroke ? hex(stroke) : undefined, borderWidth: stroke ? sw : 0 });
  }
}

async function renderPdf(model: Model, ctx: Ctx): Promise<Uint8Array> {
  const P = await PdfWriter.create(model);
  await P.embedAll(model.blocks);
  const parent = ctx.s.parent_club || "Rotary Club of Coimbatore Meridian";
  const meta = `${ctx.s.club_id || "217835"}  |  Group ${ctx.s.current_group || "1"}  |  ${DISTRICT}`;

  for (const b of model.blocks) {
    switch (b.t) {
      case "letter": {
        let h = 0;
        if (b.logo && P.imgs.get(b.logo)) {
          const box = Math.min(b.logoW, P.cw), bh = Math.max(b.logoH, 28);
          P.need(bh + 90);
          const r = P.drawImg(b.logo, P.M + (P.cw - box) / 2, P.y - bh, box, bh);
          h = bh + 8; P.y -= h;
        } else P.need(90);
        const bandH = 62;
        P.rect(P.M, P.y - bandH, P.cw, bandH, C.c800);
        P.rect(P.M, P.y - bandH, 5, bandH, C.c400);
        const save = P.y; P.y -= 11;
        P.textBlock(model.club, { size: 14.5, bold: true, color: C.white, align: "c", lh: 18 });
        P.textBlock(`Sponsored by ${parent}`, { size: 9.5, color: C.c100, align: "c", lh: 13 });
        P.textBlock(meta, { size: 8.5, color: C.c200, align: "c", lh: 12 });
        P.y = save - bandH; P.rect(P.M, P.y - 3, P.cw, 2.2, C.c400); P.y -= 16;
        break;
      }
      case "title":
        P.need(60); P.y -= 6;
        P.textBlock(b.text, { size: 18, bold: true, color: C.c700, align: "c", lh: 23 });
        if (b.sub) P.textBlock(b.sub, { size: 10.5, color: C.c600, align: "c", lh: 15 });
        P.rect(P.M + P.cw / 2 - 30, P.y - 4, 60, 1.6, C.c300); P.y -= 16;
        break;
      case "h":
        P.need(40); P.y -= 8;
        P.rect(P.M, P.y - 15, 3.5, 15, C.c500);
        P.textBlock(b.text, { x: P.M + 10, w: P.cw - 10, size: 12.5, bold: true, color: C.c700, lh: 17 });
        P.y -= 3;
        break;
      case "p":
        P.textBlock(b.text, { size: 10, lh: 14.5 }); P.y -= 5;
        break;
      case "bullets":
        for (const t of b.items) {
          const lines = P.wrap(t, P.f, 10, P.cw - 16); P.need(lines.length * 14.5 + 2);
          P.page.drawCircle({ x: P.M + 5, y: P.y - 7, size: 2, color: hex(C.c500) });
          P.textBlock(t, { x: P.M + 16, w: P.cw - 16, size: 10, lh: 14.5 }); P.y -= 3;
        }
        P.y -= 3;
        break;
      case "kv": {
        const lw = P.cw * 0.31, vw = P.cw - lw - 16;
        b.rows.forEach(([k, v], i) => {
          const kl = P.wrap(k, P.fb, 10, lw - 14), vl = P.wrap(v || "-", P.f, 10, vw);
          const h = Math.max(kl.length, vl.length) * 14 + 9; P.need(h);
          P.rect(P.M, P.y - h, P.cw, h, b.accent ? C.c100 : i % 2 ? C.c50 : undefined);
          P.rect(P.M, P.y - h, P.cw, 0.5, C.c100);
          const top = P.y; P.y = top - 4.5;
          P.textBlock(k, { x: P.M + 8, w: lw - 14, size: 10, bold: true, color: C.c700, lh: 14 });
          P.y = top - 4.5; P.textBlock(v || "-", { x: P.M + lw + 8, w: vw, size: 10, lh: 14 });
          P.y = top - h;
        });
        P.y -= 8;
        break;
      }
      case "stats": {
        const n = b.items.length, gapw = 8, tw = (P.cw - gapw * (n - 1)) / n, h = 52; P.need(h + 10);
        b.items.forEach(([k, v], i) => {
          const x = P.M + i * (tw + gapw);
          P.rect(x, P.y - h, tw, h, C.c100); P.rect(x, P.y - 3, tw, 3, C.c500);
          const size = n > 3 || v.length > 11 ? 11.5 : 15;
          const vw = P.fb.widthOfTextAtSize(P.s(v), size);
          P.dt(P.page, P.s(v), { x: x + (tw - vw) / 2, y: P.y - 27, size, font: P.fb, color: hex(C.c700) });
          const kw = P.f.widthOfTextAtSize(P.s(k), 8);
          P.dt(P.page, P.s(k), { x: x + (tw - kw) / 2, y: P.y - 42, size: 8, font: P.f, color: hex(C.muted) });
        });
        P.y -= h + 12;
        break;
      }
      case "table": {
        const sum = b.widths.reduce((a, c) => a + c, 0), cols = b.widths.map(w => P.cw * w / sum);
        const size = cols.length > 6 ? 7.6 : 8.6, pad = 4, lh = size * 1.35;
        const rowH = (cells: Cell[], bold = false) => Math.max(...cells.map((c, i) => c && typeof c === "object" ? 34
          : P.wrap(String(c ?? ""), bold ? P.fb : P.f, size, cols[i] - pad * 2).length * lh + pad * 2), 18);
        const drawRow = (cells: Cell[], o: { fill?: string; color?: string; bold?: boolean; head?: boolean }) => {
          const h = rowH(cells, o.bold || o.head); P.need(h);
          let x = P.M; const top = P.y;
          cells.forEach((c, i) => {
            P.rect(x, top - h, cols[i], h, o.fill || C.white, C.c200, 0.5);
            if (c && typeof c === "object") {
              if (P.imgs.get(c)) P.drawImg(c, x + 3, top - h + 3, cols[i] - 6, h - 6);
              else { P.y = top - h / 2 - 4; P.textBlock("Signed", { x: x + pad, w: cols[i] - pad * 2, size, color: C.muted, align: "c", lh }); }
            }
            else { P.y = top - pad; P.textBlock(String(c ?? ""), { x: x + pad, w: cols[i] - pad * 2, size, bold: o.bold || o.head,
              color: o.color || C.ink, align: b.align[i], lh }); }
            x += cols[i];
          });
          P.y = top - h;
        };
        const head = () => drawRow(b.head, { fill: C.c700, color: C.white, head: true });
        P.need(40); head();
        b.rows.forEach((r, ri) => {
          const h = rowH(r); if (P.y - h < P.M + 22) { P.newPage(); head(); }
          drawRow(r, { fill: ri % 2 ? C.c50 : C.white });
        });
        if (b.foot) drawRow(b.foot, { fill: C.c200, bold: true, color: C.c900 });
        P.y -= 12;
        break;
      }
      case "timeline": {
        const tw = P.cw * 0.16;
        for (const en of b.entries) {
          const hl = P.wrap(en.heading, P.fb, 10.5, P.cw - tw - 14), dl = P.wrap(en.details, P.f, 9.5, P.cw - tw - 14);
          const h = hl.length * 14.5 + dl.length * 13.5 + 14; P.need(Math.min(h, 90));
          const top = P.y;
          P.page.drawLine({ start: { x: P.M + tw, y: top }, end: { x: P.M + tw, y: top - h }, thickness: 1.2, color: hex(C.c300) });
          P.page.drawCircle({ x: P.M + tw, y: top - 6, size: 3, color: hex(C.c500) });
          P.y = top - 2; P.textBlock(en.time, { x: P.M, w: tw - 8, size: 9.5, bold: true, color: C.c600, align: "r", lh: 13 });
          P.y = top - 2; P.textBlock(en.heading, { x: P.M + tw + 12, w: P.cw - tw - 14, size: 10.5, bold: true, color: C.c800, lh: 14.5 });
          if (en.details) P.textBlock(en.details, { x: P.M + tw + 12, w: P.cw - tw - 14, size: 9.5, lh: 13.5 });
          P.y -= 8; P.rect(P.M + tw + 12, P.y + 2, P.cw - tw - 12, 0.5, C.c100);
        }
        P.y -= 6;
        break;
      }
      case "photos": {
        const imgs = b.imgs.filter(i => i && P.imgs.get(i)) as Img[];
        const bw = (P.cw - 10) / 2, bh = 168;
        for (let i = 0; i < imgs.length; i += 2) {
          P.need(bh + 10);
          [0, 1].forEach(k => { const im = imgs[i + k]; if (!im) return;
            const x = P.M + k * (bw + 10); P.rect(x, P.y - bh, bw, bh, C.c50, C.c200);
            P.drawImg(im, x + 3, P.y - bh + 3, bw - 6, bh - 6); });
          P.y -= bh + 10;
        }
        break;
      }
      case "sign": {
        P.need(110); P.y -= 52;
        const nSign = b.people.length, w = P.cw / nSign;
        b.people.forEach(([name, role], i) => {
          const x = P.M + i * w + 6, lw = w - 12;
          P.rect(x, P.y, lw, 0.9, C.c600);
          P.y -= 3; const t = P.y;
          P.textBlock(name || " ", { x, w: lw, size: 9.5, bold: true, color: C.c800, align: "c", lh: 12 });
          P.textBlock(role, { x, w: lw, size: 8.5, color: C.c600, align: "c", lh: 11 });
          P.textBlock(b.club, { x, w: lw, size: 7, color: C.muted, align: "c", lh: 9 });
          P.y = t + 3;
        });
        P.y -= 40;
        break;
      }
      case "pagebreak": P.newPage(); break;
    }
  }
  const pages = P.doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawRectangle({ x: P.M, y: 30, width: P.cw, height: 0.6, color: hex(C.c300) });
    P.dt(pg, P.s(model.club), { x: P.M, y: 18, size: 7.5, font: P.f, color: hex(C.c500) });
    const t = `Page ${i + 1} of ${pages.length}`;
    P.dt(pg, t, { x: P.W - P.M - P.f.widthOfTextAtSize(t, 7.5), y: 18, size: 7.5, font: P.f, color: hex(C.c500) });
  });
  P.doc.setTitle(win(model.title)); P.doc.setAuthor(win(model.club));
  return await P.doc.save();
}

/* ------------------------------ HTTP HANDLER ------------------------------ */
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ALIASES: Record<string, string> = {
  "generate-event-report": "event_report", "generate-monthly-report": "monthly_report", "generate-dpp-report": "dpp_report",
  "generate-avenue-report": "avenue_report", "generate-meeting-agenda": "agenda", "generate-meeting-minutes": "minutes",
  "generate-meeting-attendance": "attendance"
};

export async function buildModel(ctx: Ctx, doc: string, p: any): Promise<Model> {
  switch (ALIASES[doc] || doc) {
    case "event_report": return buildEventReport(ctx, p);
    case "monthly_report": return buildPeriodReport(ctx, p, "monthly");
    case "avenue_report": return buildPeriodReport(ctx, p, "avenue");
    case "dpp_report": return buildPeriodReport(ctx, p, "dpp");
    case "agenda": return buildAgenda(ctx, p);
    case "minutes": return buildMinutes(ctx, p);
    case "attendance": return buildAttendance(ctx, p);
    case "combined_meeting": return buildCombinedMeeting(ctx, p);
    case "combined_agenda": return buildCombinedAgenda(ctx, p);
    case "treasury": return buildTreasury(ctx, p);
    default: throw new HttpError(400, `Unknown doc type: ${doc}`);
  }
}
export { renderDocx, renderPdf, toData, makeCtx };

/* ---------- GOOGLE MAPS LINK RESOLVER (used by photo geo-tagging) ----------
   Short links such as https://maps.app.goo.gl/uL3Cb1Q4o6qNUUHc9 cannot be opened from a browser page (CORS),
   so the portal asks this function. Only Google hosts are ever contacted (no open proxy). */
const MAP_HOST = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google|(www\.|maps\.|consent\.|www\.consent\.)?google\.[a-z.]{2,8})$/i;
const NUM = "(-?\\d{1,3}\\.\\d{3,})";
function okLatLng(lat: number, lng: number) { return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0); }
function mapCoords(text: string): { lat: number; lng: number } | null {
  const t = text.replace(/%2C/gi, ",").replace(/%40/g, "@").replace(/\\u003d/g, "=").replace(/\\u0026/g, "&");
  const pats: RegExp[] = [
    new RegExp(`!3d${NUM}!4d${NUM}`),                                              // exact place pin
    new RegExp(`[?&](?:q|ll|query|destination|daddr|center|sll)=\\s*${NUM}\\s*(?:,|\\+)\\s*${NUM}`),
    new RegExp(`@${NUM},${NUM}`),                                                  // map centre
    new RegExp(`(?:markers|center)=${NUM},${NUM}`),                                // static map in the page
    new RegExp(`\\[\\[\\[[\\d.]+,${NUM},${NUM}\\]`),                               // APP_INITIALIZATION_STATE: [[[zoom,lng,lat]
  ];
  for (let i = 0; i < pats.length; i++) {
    const m = t.match(pats[i]); if (!m) continue;
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    const [lat, lng] = i === 4 ? [b, a] : [a, b];
    if (okLatLng(lat, lng)) return { lat, lng };
  }
  return null;
}
function mapName(url: string, body: string): string {
  const m = url.match(/\/maps\/place\/([^/@?]+)/);
  if (m) { try { const n = decodeURIComponent(m[1].replace(/\+/g, " ")).trim(); if (n && !/^-?\d+\.\d+,/.test(n)) return n; } catch (_) { /* ignore */ } }
  const og = body.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og) { const n = og[1].replace(/&amp;/g, "&").replace(/ - Google Maps$/i, "").trim(); if (n && !/^google maps$/i.test(n)) return n; }
  return "";
}
async function resolveMapLink(input: string) {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return { success: false, error: "That is not a valid link." }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { success: false, error: "Only http(s) links are supported." };
  if (!MAP_HOST.test(u.hostname)) return { success: false, error: "Only Google Maps links can be read." };
  const hops: string[] = []; let body = "", name = "", coords = mapCoords(u.href);
  for (let i = 0; i < 8; i++) {
    hops.push(u.href);
    if (!name) name = mapName(u.href, "");
    let res: Response;
    try {
      res = await fetch(u.href, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "en-IN,en;q=0.9" } });
    } catch (e: any) { return { success: false, error: `Could not open the link (${e?.message || "network error"}).`, hops }; }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      let next: URL;
      try { next = new URL(res.headers.get("location")!, u); } catch { break; }
      const cont = next.searchParams.get("continue");                    // Google consent page keeps the real target here
      if (/consent\./i.test(next.hostname) && cont) { try { next = new URL(cont); } catch (_) { /* keep */ } }
      if (!MAP_HOST.test(next.hostname)) break;
      u = next; const c = mapCoords(u.href); if (c && !coords) coords = c; if (!name) name = mapName(u.href, ""); if (coords) break;
      continue;
    }
    body = (await res.text()).slice(0, 600000);
    if (!coords) coords = mapCoords(u.href) || mapCoords(body);
    if (!name) name = mapName(u.href, body);
    break;
  }
  if (!coords) return { success: false, error: "No coordinates were found in that link. Open it in Google Maps, tap Share → Copy link, and try again — or type the latitude and longitude manually.", hops, final_url: u.href };
  return { success: true, lat: coords.lat, lng: coords.lng, name, final_url: u.href, hops };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);
  try {
    let p: any; try { p = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    if (p.action === "resolve_map") return json(await resolveMapLink(String(p.url || "")));
    const format = String(p.format || "docx").toLowerCase();
    if (!["docx", "pdf", "data"].includes(format)) return json({ error: "format must be docx, pdf or data" }, 400);
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Server misconfiguration: missing Supabase env vars." }, 500);
    const ctx = await makeCtx(createClient(url, key));
    const model = await buildModel(ctx, String(p.doc || ""), p);
    if (format === "data") return json({ success: true, ...toData(model) });
    const bytes = format === "pdf" ? await renderPdf(model, ctx) : await renderDocx(model, ctx);
    const mime = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const filename = `${model.filename}.${format}`;
    return new Response(bytes, { status: 200, headers: { ...CORS, "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`, "Access-Control-Expose-Headers": "Content-Disposition",
      "Content-Length": String(bytes.byteLength) } });
  } catch (err: any) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("generate-document error:", err);
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
