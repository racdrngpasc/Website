/* ai-chat — keeps the OpenRouter key on the server.
   supabase secrets set OPENROUTER_API_KEY=...   (rotate the key that used to be in config.js)
   Optional: AI_MODEL (primary) and AI_FALLBACK_MODELS (comma separated) */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const PRIMARY = Deno.env.get("AI_MODEL") || "openai/gpt-4o-mini";
const FALLBACKS = (Deno.env.get("AI_FALLBACK_MODELS") || "google/gemini-2.0-flash-001,meta-llama/llama-3.3-70b-instruct")
  .split(",").map((m) => m.trim()).filter(Boolean);
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function callModel(key: string, model: string, messages: unknown[], max_tokens: number, temperature: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 35000);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Rotaract Club Assistant" },
      body: JSON.stringify({ model, messages, stream: false, max_tokens, temperature })
    });
    const out = await r.json().catch(() => ({}));
    return { ok: r.ok && !!out?.choices?.[0]?.message?.content, status: r.status, out };
  } finally { clearTimeout(t); }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: { message: "Use POST." } }, 405);
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json({ error: { message: "AI is not configured." } }, 500);
  let b: any; try { b = await req.json(); } catch { return json({ error: { message: "Invalid JSON." } }, 400); }
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-20)
    .filter((m: any) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, m.role === "system" ? 20000 : 4000) }));
  if (!messages.some((m: any) => m.role === "user")) return json({ error: { message: "No user message." } }, 400);
  const max_tokens = Math.min(parseInt(b.max_tokens) || 1500, 2048);
  const temperature = Math.min(Number(b.temperature) || 0.5, 1.2);

  // Try the primary model, then fall back so the bot keeps answering if one provider is down or rate-limited
  let last: any = null;
  for (const model of [PRIMARY, ...FALLBACKS]) {
    try {
      const res = await callModel(key, model, messages, max_tokens, temperature);
      if (res.ok) return json(res.out);
      last = res;
      if (res.status === 401 || res.status === 402) break; // bad/exhausted key: fallbacks won't help
    } catch (e: any) { last = { status: 502, out: { error: { message: e?.message || "Upstream error" } } }; }
  }
  return json(last?.out?.error ? last.out : { error: { message: "AI temporarily unavailable." } }, last?.status && last.status >= 400 ? last.status : 502);
});
