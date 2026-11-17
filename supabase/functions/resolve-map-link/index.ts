/* resolve-map-link — reads a Google Maps / Google search / share.google link for the portal's photo geo-tagging.
   Deploy:  supabase functions deploy resolve-map-link --no-verify-jwt
   Only Google hosts are ever contacted. */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
/** The place text of a Google link that carries no coordinates, e.g. google.com/search?q=R.S.+Puram,+Coimbatore */
function mapQuery(url: string): string {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("query") || u.searchParams.get("destination");
    if (q && !/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(q.trim())) return q.replace(/\+/g, " ").trim();
    const m = u.pathname.match(/\/maps\/(?:search|place)\/([^/@]+)/);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
  } catch (_) { /* ignore */ }
  return "";
}
async function resolveMapLink(input: string) {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return { success: false, error: "That is not a valid link." }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { success: false, error: "Only http(s) links are supported." };
  if (!MAP_HOST.test(u.hostname)) return { success: false, error: "Only Google Maps links can be read." };
  const hops: string[] = []; let body = "", name = "", query = mapQuery(u.href), coords = mapCoords(u.href);
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
      u = next; const c = mapCoords(u.href); if (c && !coords) coords = c; if (!name) name = mapName(u.href, ""); if (!query) query = mapQuery(u.href); if (coords) break; if (query && u.pathname === "/search") break;
      continue;
    }
    body = (await res.text()).slice(0, 600000);
    if (!coords) coords = mapCoords(u.href) || mapCoords(body);
    if (!name) name = mapName(u.href, body);
    break;
  }
  if (!query) query = mapQuery(u.href);
  if (!coords) return { success: false, query, name, error: query ? "The link points to a place name, not to a map pin." : "No coordinates were found in that link. Open it in Google Maps, tap Share → Copy link, and try again — or type the latitude and longitude manually.", hops, final_url: u.href };
  return { success: true, lat: coords.lat, lng: coords.lng, name, query, final_url: u.href, hops };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    return json(await resolveMapLink(String(body?.url || "")));
  } catch (e) {
    return json({ success: false, error: String((e as Error)?.message || e) });
  }
});
