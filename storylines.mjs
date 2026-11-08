// League storylines: every Thursday morning, Claude writes a short "week ahead" preview for each registered league
// (must-win games, playoff stakes, the game of the week) from War Room's own projections, and posts it to the app
// (POST /api/story), where it shows as a card on the home screen. Text only.
// Caps: at most MAX_LEAGUES leagues a run (default 300) and ~250 output words each. Claude Haiku 5.5 costs about
// a fifth of a cent per league. Lines with any number that isn't in the week's facts are dropped; a league whose
// text fails the check is skipped, never posted.
// Env: ANTHROPIC_API_KEY, ADMIN_KEY, WARROOM_URL, ESPN_S2/ESPN_SWID (fallback cookies), MAX_LEAGUES, DRY_RUN=1,
//      LEAGUES_JSON (league list inline, for testing), STORY_MODEL (default claude-haiku-5-5)
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = (process.env.WARROOM_URL || "https://war-room-self-one.vercel.app").replace(/\/$/, "");
const KEY = process.env.ANTHROPIC_API_KEY, DRY = process.env.DRY_RUN === "1";
const MAX = Number(process.env.MAX_LEAGUES) || 300;
const MODEL = process.env.STORY_MODEL || "claude-haiku-5-5";
let tokIn = 0, tokOut = 0;
const log = (...a) => console.log("[story]", ...a);
const plain = s => String(s || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

async function json(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "User-Agent": "war-room-recaps", "x-warroom-bot": "1", ...(opts.headers || {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${url.split("?")[0]} → ${r.status} ${(j && j.error && j.error.message) || ""}`);
  return j;
}
async function loadModel(dir) {
  mkdirSync(dir, { recursive: true });
  const r = await fetch(`${APP}/model.js`, { cache: "no-store" }); if (!r.ok) throw new Error("couldn't load model.js");
  writeFileSync(join(dir, "model.mjs"), await r.text());
  return import(pathToFileURL(join(dir, "model.mjs")));
}
const cookies = cfg => ({ espnS2: cfg.espnS2 || process.env.ESPN_S2 || "", swid: cfg.swid || process.env.ESPN_SWID || "" });
async function loadLeague(cfg) {
  if (cfg.platform === "sleeper") return json(`${APP}/api/sleeper?username=${encodeURIComponent(cfg.username)}&league=${encodeURIComponent(cfg.leagueId)}`);
  return json(`${APP}/api/espn`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId: cfg.leagueId, season: cfg.season, ...cookies(cfg), teamId: cfg.teamId }) });
}

// The week's facts, all from War Room's model.
function facts(L, M) {
  const w = M.upcomingWeek(L);
  if (w > L.regEnd) return null; // regular season over; the playoff bracket has its own screen
  const sim = M.simulate(L, { n: 5000, medianWeeks: L.medianWeeks || [] });
  const odds = Object.fromEntries(sim.map(r => [r.id, r]));
  const team = id => L.teams.find(t => t.id === id) || {};
  const rec = t => `${t.w}-${t.l}${t.t ? "-" + t.t : ""}`;
  const games = L.matchups.filter(m => m.week === w && m.a != null && m.b != null).map(m => {
    const pa = M.lineup(M.rosterOf(L, m.a), w, L), pb = M.lineup(M.rosterOf(L, m.b), w, L), wa = M.winProb(pa, pb);
    const A = team(m.a), B = team(m.b);
    return { a: plain(A.name), aRecord: rec(A), aPlayoffOdds: Math.round(odds[m.a]?.playoffOdds || 0), aProjected: Math.round(pa * 10) / 10,
      b: plain(B.name), bRecord: rec(B), bPlayoffOdds: Math.round(odds[m.b]?.playoffOdds || 0), bProjected: Math.round(pb * 10) / 10,
      aWinPct: Math.round(wa * 100), bWinPct: 100 - Math.round(wa * 100) };
  });
  if (!games.length) return null;
  const standings = [...L.teams].sort((x, y) => (y.w + y.t / 2) - (x.w + x.t / 2) || y.pf - x.pf)
    .map((t, i) => ({ rank: i + 1, team: plain(t.name), record: rec(t), pointsFor: Math.round(t.pf), playoffOdds: Math.round(odds[t.id]?.playoffOdds || 0) }));
  return { league: plain(L.name), week: w, regularSeasonEnds: L.regEnd, playoffTeams: L.playoffTeams, weeksLeftAfterThis: L.regEnd - w, standings, games };
}

function allowedNumbers(f) {
  const n = new Set(); const add = v => { if (typeof v === "number" && isFinite(v)) { n.add(String(v)); n.add(String(Math.round(v))); } };
  const walk = o => { if (typeof o === "number") add(o); else if (typeof o === "string") (o.match(/\d+(?:\.\d+)?/g) || []).forEach(x => n.add(x)); else if (o && typeof o === "object") Object.values(o).forEach(walk); };
  walk(f); ["1", "2", "3", "4", "5"].forEach(x => n.add(x));
  return n;
}

async function write(f) {
  const prompt = `Write the week-ahead storylines for a fantasy football league's group chat, shown in the War Room app.

Facts from War Room's projections (JSON):
${JSON.stringify(f)}

Write 3 short paragraphs, under 130 words in total:
1. The game of the week: the matchup with the most at stake (playoff odds on the line, a close projection, or two top teams).
2. The must-win: a team whose season hangs on this week, or a bubble race.
3. One more angle worth trash talk: a lopsided game, a team on the slide, or the race for the top seed.

Rules: use the real team names. Only use numbers that appear in the facts, exactly as written; never invent stats or player news.
PG trash talk aimed at lineups and records, never at people. No emoji, hashtags, markdown, bullet points or headings. Separate paragraphs with a blank line.`;
  const r = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", { method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error(`API ${r.status} ${(j && j.error && j.error.message) || ""}`);
  tokIn += j.usage?.input_tokens || 0; tokOut += j.usage?.output_tokens || 0;
  const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("").replace(/[*#`_]/g, "").trim();
  const ok = allowedNumbers(f);
  const bad = (text.match(/\d+(?:\.\d+)?/g) || []).filter(x => !ok.has(x));
  if (bad.length) throw new Error(`numbers not in the facts: ${bad.join(", ")}`);
  if (!text || text.length > 1400) throw new Error("empty or too long");
  return { text: text.split(/\n\s*\n/).map(plain).filter(Boolean).join("\n"), usage: j.usage };
}

if (!KEY) { log("No ANTHROPIC_API_KEY; nothing to do."); process.exit(0); }
const list = process.env.LEAGUES_JSON ? JSON.parse(process.env.LEAGUES_JSON)
  : await json(`${APP}/api/recaps`, { headers: { "x-admin-key": process.env.ADMIN_KEY || "" } });
const M = await loadModel(join(HERE, ".app"));
let done = 0, skipped = 0, failed = 0;
for (const cfg of list.filter(c => c.platform === "espn" || c.platform === "sleeper").slice(0, MAX)) {
  const tag = `${cfg.platform}-${cfg.leagueId}`;
  try {
    const L = await loadLeague(cfg);
    const f = facts(L, M);
    if (!f) { log(`${tag}: no regular-season games ahead.`); skipped++; continue; }
    const { text } = await write(f);
    if (DRY) { log(`${tag} week ${f.week}:\n${text}\n`); done++; continue; }
    await json(`${APP}/api/story`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-key": process.env.ADMIN_KEY || "" },
      body: JSON.stringify({ platform: cfg.platform, leagueId: L.leagueId, week: f.week, text }) });
    log(`${tag}: week ${f.week} storyline posted.`); done++;
  } catch (e) {
    if (/\b401\b|private/i.test(e.message || "")) { log(`${tag}: skipped (private league, not unlocked).`); skipped++; continue; }
    log(`${tag}: failed: ${e.message}`); failed++;
  }
}
log(`done ${done}, skipped ${skipped}, failed ${failed}. Tokens in ${tokIn}, out ${tokOut} ≈ $${((tokIn * 0.10 + tokOut * 0.50) / 1e6).toFixed(4)}.`);
process.exit(failed && !done ? 1 : 0);
