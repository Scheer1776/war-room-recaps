// Roast lines for the weekly League Recap: one short, PG trash-talk line each for the High & Low, MVP and Bench
// Blunder scenes, written by Claude from the week's recap data. Text on screen only (no voice), so it costs about a
// cent per league. Optional by design: no ANTHROPIC_API_KEY, an API error or a bad answer just means no roast lines,
// and the recap renders exactly as before. Never fails a render.
// Env: ANTHROPIC_API_KEY, ROAST_MODEL (default claude-haiku-5-5), ROAST=0 (turn off)

const MODEL = process.env.ROAST_MODEL || "claude-haiku-5-5";
const MAX = 70; // characters per line, so it fits two lines on screen
// Same emoji strip as the video's cleanName(): the video fonts can't draw emoji.
const plain = v => typeof v === "string" ? v.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim() : v;

// Every number the lines are allowed to mention: the week's real numbers, in the forms the video shows them.
function allowedNumbers(d) {
  const n = new Set();
  const add = v => { if (typeof v !== "number" || !isFinite(v)) return; const r = Math.round(v * 10) / 10; n.add(String(r)); n.add(r.toFixed(1)); n.add(String(Math.round(v))); };
  for (const g of d.games || []) { add(g.win.pts); add(g.lose.pts); add(g.margin); }
  for (const x of [d.high, d.low, d.blunder && d.blunder.team]) if (x) { add(x.pts); add(x.left); }
  for (const p of [d.high && d.high.star, d.mvp && d.mvp.player, d.blunder && d.blunder.bench]) if (p) add(p.act);
  for (const s of d.standings || []) { add(s.w); add(s.l); add(s.t); add(s.odds); }
  add(d.week); add(d.week + 1); n.add("1"); n.add("2"); n.add("3"); // "week 9", small counts like "2 touchdowns" are fine
  return n;
}

// Keep a line only if it's short, plain text, and every number in it is real.
function clean(line, ok) {
  if (typeof line !== "string") return null;
  const s = plain(line).replace(/\s+/g, " ").replace(/^["'“]+|["'”]+$/g, "").trim();
  if (!s || s.length > MAX) return null;
  if (/[#@]|https?:/i.test(s)) return null;
  for (const num of s.match(/\d+(?:\.\d+)?/g) || []) if (!ok.has(num)) return null;
  return s;
}

export async function roastLines(d, log = () => {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.ROAST === "0") return null;
  const want = ["highlow"];
  if (d.mvp) want.push("mvp");
  if (d.blunder && d.blunder.bench && (d.blunder.team.left || 0) >= 8) want.push("blunder");

  const facts = {
    week: d.week,
    high: d.high && { team: d.high.name, pts: d.high.pts, topPlayer: d.high.star && `${d.high.star.n} (${d.high.star.act} pts)` },
    low: d.low && { team: d.low.name, pts: d.low.pts },
    closest: d.close && { winner: d.close.win.name, loser: d.close.lose.name, margin: d.close.margin },
    blowout: d.blow && { winner: d.blow.win.name, loser: d.blow.lose.name, margin: d.blow.margin },
    mvp: d.mvp && { player: d.mvp.player.n, pos: d.mvp.player.pos, pts: d.mvp.player.act, team: d.mvp.team.name },
    blunder: d.blunder && d.blunder.bench && { team: d.blunder.team.name, benched: d.blunder.bench.n, benchedPts: d.blunder.bench.act, pointsLeftOnBench: d.blunder.team.left },
  };
  const deep = o => o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "object" ? deep(v) : plain(v)])) : o;
  const prompt = `You write the on-screen roast lines for a fantasy football league's weekly recap video. The league's friends watch it in their group chat.

Week facts (JSON):
${JSON.stringify(deep(facts))}

Write exactly one line for each of these scenes: ${want.join(", ")}.
- highlow: about the top score and/or the low score
- mvp: about the MVP player and the fantasy team that started him
- blunder: about the team that left points on the bench

Rules:
- Max ${MAX} characters per line. Punchy, funny, group-chat trash talk.
- PG: no swearing, nothing about looks, family, race, religion or anything personal. Roast the lineup, not the person.
- Use the real team or player names from the facts.
- Only use numbers that appear in the facts, exactly as written. Never invent a stat.
- No hashtags, no emoji, no quotation marks.

Answer with JSON only, like {"highlow": "...", "mvp": "...", "blunder": "..."} with only the keys asked for.`;

  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctrl.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, thinking: { type: "disabled" }, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] }),
    }).finally(() => clearTimeout(timer));
    const j = await r.json().catch(() => null);
    if (!r.ok) { log(`roast lines skipped: API ${r.status} ${(j && j.error && j.error.message) || ""}`); return null; }
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    const m = text.match(/\{[\s\S]*\}/); if (!m) { log("roast lines skipped: no JSON in the answer"); return null; }
    const raw = JSON.parse(m[0]), ok = allowedNumbers(d), out = {};
    for (const k of want) { const s = clean(raw[k], ok); if (s) out[k] = s; else if (raw[k]) log(`roast line dropped (${k}): ${String(raw[k]).slice(0, 90)}`); }
    return Object.keys(out).length ? out : null;
  } catch (e) {
    log(`roast lines skipped: ${e.message}`); return null;
  }
}
