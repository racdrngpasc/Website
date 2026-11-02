/* ai-chat — keeps the OpenRouter key on the server.
   supabase secrets set OPENROUTER_API_KEY=...   (rotate the key that used to be in config.js) */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const MODEL = Deno.env.get("AI_MODEL") || "openai/gpt-4o-mini";
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: { message: "Use POST." } }, 405);
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return json({ error: { message: "AI is not configured." } }, 500);
  let b: any; try { b = await req.json(); } catch { return json({ error: { message: "Invalid JSON." } }, 400); }
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-14)
    .filter((m: any) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, m.role === "system" ? 8000 : 2000) }));
  if (!messages.some((m: any) => m.role === "user")) return json({ error: { message: "No user message." } }, 400);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Rotaract Club Assistant" },
      body: JSON.stringify({ model: MODEL, messages, stream: false,
        max_tokens: Math.min(parseInt(b.max_tokens) || 1024, 1024), temperature: Math.min(Number(b.temperature) || 0.7, 1.2) })
    });
    const out = await r.json().catch(() => ({}));
    return json(out, r.ok ? 200 : r.status);
  } catch (e: any) { return json({ error: { message: e?.message || "Upstream error" } }, 502); }
});
