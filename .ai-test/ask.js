// "Ask CHOMP": the website's question box. Claude (Haiku 5.5) answers from facts.txt only, which is the site's own text:
// hours, menu and prices, the back room, the address and phone. Runs as a Vercel function next to the static site.
//   GET  /api/ask → { on }           (the page hides the button when the feature is off)
//   POST /api/ask { messages: [{ role: "user"|"assistant", content }] } → { text }
// Safety: allergy and dietary questions always go to staff (the kitchen handles every major allergen), nothing is
// booked or promised, and anything not in facts.txt gets "call us at (805) 688-7733".
// Caps: 20 questions per visitor a day, 300 a day for the whole site, and $5 a month (CHOMP_MONTHLY_USD).
// The caps are kept in Upstash Redis when KV_REST_API_URL/TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN) are set, and in the
// function's memory otherwise (per server instance, so looser; add the free Upstash store for exact caps).
// Env: ANTHROPIC_API_KEY (feature is off without it), CHOMP_MONTHLY_USD, KV_REST_API_URL, KV_REST_API_TOKEN
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FACTS = readFileSync(new URL("./facts.txt", import.meta.url), "utf8");
const CAPS = { perVisitor: 20, perDay: 300 };
const MONTHLY_USD = () => Number(process.env.CHOMP_MONTHLY_USD) || 5;
const PRICE = { in: 0.10, out: 0.50, cacheWrite: 0.125, cacheRead: 0.01 }; // Claude Haiku 5.5, $ per million tokens
const PHONE = "(805) 688-7733";

const SYSTEM = [
  { type: "text", text: `You answer questions on the website of CHOMP, a family-owned burger diner in Solvang, California. You are a friendly counter person, not a salesperson.

Everything you know about CHOMP is in the website text below. Rules:
- Answer only from the website text. If the answer isn't there (parking, wait times, catering details, today's specials, jobs, anything else), say you're not sure and to call ${PHONE}.
- Food allergies, gluten, celiac, vegan or any dietary safety question: never say a dish is safe or free of anything. Say the kitchen handles wheat, milk, eggs, soy, fish, shellfish and tree nuts, and to tell the server or call ${PHONE} before ordering. You can mention the gluten-free bun exists, with that warning. For allergy questions, don't guess or comment on which ingredients a dish does or doesn't contain.
- The Plant Based Burger is not vegan (the buns aren't vegan). Never call any item vegan.
- You can't take orders, reservations or bookings. For the back room, say to call ${PHONE}.
- Prices on the website can change; the restaurant's prices apply.
- Keep it short: 1 to 3 sentences. Plain text, no markdown, no lists, no emoji.
- If someone asks about something unrelated to CHOMP, steer back to the restaurant in one sentence.

WEBSITE TEXT:
${FACTS}`, cache_control: { type: "ephemeral" } }];

// ---- caps ----
const KV_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const mem = new Map();
async function kv(cmds) {
  if (!KV_URL() || !KV_TOKEN()) return cmds.map(([op, k, v]) => { // in-memory fallback
    if (op === "INCR" || op === "INCRBY") { const n = Number(mem.get(k) || 0) + (op === "INCR" ? 1 : Number(v)); mem.set(k, n); return n; }
    if (op === "GET") return mem.get(k) ?? null;
    return 1;
  });
  const r = await fetch(KV_URL() + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + KV_TOKEN(), "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  if (!r.ok) throw Object.assign(new Error("store"), { status: 503 });
  return (await r.json()).map(x => x.result);
}
const day = () => new Date().toISOString().slice(0, 10), month = () => new Date().toISOString().slice(0, 7);
const visitor = req => createHash("sha256").update("chomp|" + String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()).digest("hex").slice(0, 16);
async function reserve(req) {
  const kV = `chomp:ask:v:${day()}:${visitor(req)}`, kD = `chomp:ask:d:${day()}`, kM = `chomp:ask:usd:${month()}`;
  const [v, , d, , spent] = await kv([["INCR", kV], ["EXPIRE", kV, 172800], ["INCR", kD], ["EXPIRE", kD, 172800], ["GET", kM]]);
  if (Number(spent || 0) / 1e6 >= MONTHLY_USD() || d > CAPS.perDay) throw Object.assign(new Error(`Our question box is taking a break. Call us at ${PHONE}.`), { status: 429 });
  if (v > CAPS.perVisitor) throw Object.assign(new Error(`That's a lot of questions! Give us a call at ${PHONE}.`), { status: 429 });
}
async function record(u) {
  if (!u) return;
  const micro = Math.ceil((u.input_tokens || 0) * PRICE.in + (u.output_tokens || 0) * PRICE.out + (u.cache_creation_input_tokens || 0) * PRICE.cacheWrite + (u.cache_read_input_tokens || 0) * PRICE.cacheRead);
  const k = `chomp:ask:usd:${month()}`; await kv([["INCRBY", k, micro], ["EXPIRE", k, 40 * 86400]]).catch(() => {});
}

// ---- handler ----
const send = (res, status, body) => { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); };
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let s = ""; for await (const c of req) s += c; try { return JSON.parse(s || "{}"); } catch { return {}; }
}

export default async function handler(req, res) {
  const on = !!process.env.ANTHROPIC_API_KEY;
  if (req.method === "GET") return send(res, 200, { on });
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  if (!on) return send(res, 503, { error: `Call us at ${PHONE}.` });
  try {
    const b = await body(req);
    // Last 6 turns, 300 characters each, ending on the visitor's question.
    const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-6)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map(m => ({ role: m.role, content: m.content.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300) }));
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") return send(res, 400, { error: "Ask us something!" });
    await reserve(req);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    let r, j;
    try {
      r = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", { method: "POST", signal: ctl.signal,
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.CHOMP_MODEL || "claude-haiku-5-5", max_tokens: 400, thinking: { type: "disabled" }, output_config: { effort: "low" }, system: SYSTEM, messages: msgs }) });
      j = await r.json().catch(() => null);
    } finally { clearTimeout(t); }
    if (j && j.usage) await record(j.usage);
    const text = r && r.ok && j ? (j.content || []).filter(c => c.type === "text").map(c => c.text).join("").replace(/[*#`_]/g, "").trim() : "";
    if (!text) { console.error("claude", r && r.status, j && j.error); return send(res, 502, { error: `Sorry, that one didn't go through. Call us at ${PHONE}.` }); }
    send(res, 200, { text: text.slice(0, 700) });
  } catch (e) {
    send(res, e.status || 502, { error: e.status ? e.message : `Sorry, that one didn't go through. Call us at ${PHONE}.` });
  }
}
