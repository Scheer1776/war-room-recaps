// Find "coin-flip" start/sit pairs for the Start/Sit Showdown video: two players at the same position whose
// Sleeper projections are nearly tied this week, plus their recent form (half-PPR, last 3 weeks played).
// Usage: node scripts/startsit.mjs <outDir>   (writes startsit.json with candidate pairs; pick the scenes in Root.tsx)
import { writeFileSync, mkdirSync } from "node:fs";
const S = "https://api.sleeper.app";
const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const out = process.argv[2] || "public/startsit";
mkdirSync(out, { recursive: true });
const st = await j(`${S}/v1/state/nfl`);
const season = st.season, week = st.week;
const POS = ["QB", "RB", "WR", "TE"];
const q = POS.map(p => "position[]=" + p).join("&");
const proj = await j(`${S}/projections/nfl/${season}/${week}?season_type=regular&${q}`);
const past = [];
for (let w = Math.max(1, week - 3); w < week; w++) past.push([w, await j(`${S}/stats/nfl/${season}/${w}?season_type=regular&${q}`)]);
const players = await j(`${S}/v1/players/nfl`);
const hist = new Map(); // id -> [{w, pts}]
for (const [w, rows] of past) for (const r of rows) {
  if (!r.stats || !(r.stats.gp > 0)) continue;
  if (!hist.has(r.player_id)) hist.set(r.player_id, []);
  hist.get(r.player_id).push({ w, pts: +(r.stats.pts_half_ppr ?? 0).toFixed(1), opp: r.opponent || null });
}
const pool = [];
for (const r of proj) {
  const p = players[r.player_id];
  if (!p || !POS.includes(p.position) || !r.opponent || p.injury_status) continue;
  const pts = r.stats?.pts_half_ppr ?? 0;
  if (pts < 6) continue;
  const h = hist.get(r.player_id) || [];
  if (h.length < 2) continue;
  const avg = h.reduce((a, b) => a + b.pts, 0) / h.length;
  pool.push({ id: r.player_id, n: `${p.first_name} ${p.last_name}`, num: p.number ?? null, pos: p.position, nfl: p.team, opp: r.opponent,
    proj: +pts.toFixed(1), adp: r.stats?.pos_adp_dd_ppr ?? null, last: h.map(x => x.pts), weeks: h.map(x => x.w), avg: +avg.toFixed(1) });
}
const pairs = [];
for (const pos of POS) {
  const ps = pool.filter(x => x.pos === pos).sort((a, b) => b.proj - a.proj).slice(0, pos === "QB" || pos === "TE" ? 16 : 36);
  for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) {
    const A = ps[a], B = ps[b];
    const gap = +Math.abs(A.proj - B.proj).toFixed(1);
    if (gap > 0.3) continue;
    pairs.push({ pos, gap, form: +Math.abs(A.avg - B.avg).toFixed(1), a: A, b: B });
  }
}
pairs.sort((x, y) => y.form - x.form);
writeFileSync(`${out}/startsit.json`, JSON.stringify({ season, week, builtAt: new Date().toISOString(), players: pool, pairs: pairs.slice(0, 40) }, null, 1));
for (const p of pairs.slice(0, 25)) console.log(`${p.pos} gap=${p.gap} form=${p.form} | ${p.a.n} ${p.a.nfl} v${p.a.opp} ${p.a.proj} avg${p.a.avg} [${p.a.last}] adp${p.a.adp} | ${p.b.n} ${p.b.nfl} v${p.b.opp} ${p.b.proj} avg${p.b.avg} [${p.b.last}] adp${p.b.adp}`);
