// Ranked-list data for the "Rank Slides" carousels (trade value, weekly position rankings), from Sleeper's public API.
// Usage: node scripts/rankings.mjs <outDir>   (writes rankings.json)
// Value rating (0-99): blend of season average (half-PPR), the last 3 weeks and this week's projection, scaled within position.
import { writeFileSync, mkdirSync } from "node:fs";
const S = "https://api.sleeper.app";
const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const out = process.argv[2] || "public/rank";
mkdirSync(out, { recursive: true });
const st = await j(`${S}/v1/state/nfl`);
const season = st.season, week = st.week, last = week - 1;
const POS = ["QB", "RB", "WR", "TE"];
const pos = POS.map(p => "position[]=" + p).join("&");
const weeks = Array.from({ length: last }, (_, i) => i + 1);
const [players, proj, ...weekly] = await Promise.all([
  j(`${S}/v1/players/nfl`),
  j(`${S}/projections/nfl/${season}/${week}?season_type=regular&${pos}`),
  ...weeks.map(w => j(`${S}/stats/nfl/${season}/${w}?season_type=regular&${pos}`)),
]);
const pj = new Map(proj.map(x => [x.player_id, x]));
const byId = new Map();
weekly.forEach((rows, i) => { for (const r of rows) { const pts = r.stats?.pts_half_ppr; if (pts == null) continue; const a = byId.get(r.player_id) || []; a.push({ w: i + 1, pts, tgt: r.stats?.rec_tgt || 0, rz: (r.stats?.rec_rz_tgt || 0) + (r.stats?.rush_rz_att || 0) }); byId.set(r.player_id, a); } });
const rows = [];
for (const [id, games] of byId) {
  const p = players[id]; if (!p || !POS.includes(p.position) || !p.team) continue;
  if (games.length < 3) continue;
  const avg = games.reduce((s, g) => s + g.pts, 0) / games.length;
  const l3 = games.slice(-3).reduce((s, g) => s + g.pts, 0) / Math.min(3, games.length);
  const pr = pj.get(id)?.stats?.pts_half_ppr ?? 0;
  const bye = !pj.get(id)?.opponent;
  const raw = 0.45 * avg + 0.3 * l3 + 0.25 * (bye ? avg : pr);
  rows.push({ id, n: `${p.first_name} ${p.last_name}`, num: p.number ?? null, pos: p.position, nfl: p.team, gp: games.length,
    avg: +avg.toFixed(1), l3: +l3.toFixed(1), proj: +pr.toFixed(1), opp: pj.get(id)?.opponent || "BYE", inj: p.injury_status || null,
    tgt: games.reduce((s, g) => s + g.tgt, 0), rz: games.reduce((s, g) => s + g.rz, 0), raw });
}
// scale raw → 0-99 within position (top of position = 99)
for (const P of POS) {
  const top = Math.max(...rows.filter(r => r.pos === P).map(r => r.raw));
  for (const r of rows) if (r.pos === P) r.value = Math.round(99 * r.raw / top);
}
const trend = r => r.l3 - r.avg >= 3 ? "up" : r.l3 - r.avg <= -3 ? "down" : "flat";
const strip = r => ({ id: r.id, n: r.n, num: r.num, pos: r.pos, nfl: r.nfl, value: r.value, avg: r.avg, l3: r.l3, proj: r.proj, opp: r.opp, trend: trend(r), inj: r.inj, tgt: r.tgt });
const healthy = rows.filter(r => !r.inj || r.inj === "Questionable");
const flex = healthy.filter(r => r.pos !== "QB").sort((a, b) => b.raw - a.raw);
const maxFlex = flex[0].raw;
// trade value is one scale across RB/WR/TE (99 = best flex asset); weekRank keeps the per-position scale
const tradeValue = flex.slice(0, 20).map(r => ({ ...strip(r), value: Math.round(99 * r.raw / maxFlex) }));
const weekRank = Object.fromEntries(POS.map(P => [P, healthy.filter(r => r.pos === P && r.opp !== "BYE").sort((a, b) => b.proj - a.proj).slice(0, 20).map(strip)]));
const risers = healthy.filter(r => r.pos !== "QB" && r.l3 - r.avg >= 4 && r.avg >= 6).sort((a, b) => (b.l3 - b.avg) - (a.l3 - a.avg)).slice(0, 10).map(strip);
const fallers = healthy.filter(r => r.pos !== "QB" && r.avg - r.l3 >= 4 && r.avg >= 10).sort((a, b) => (b.avg - b.l3) - (a.avg - a.l3)).slice(0, 10).map(strip);
writeFileSync(`${out}/rankings.json`, JSON.stringify({ season, week, through: last, builtAt: new Date().toISOString(), tradeValue, weekRank, risers, fallers }, null, 1));
console.log(`week ${week} (stats through ${last})\nTRADE VALUE: ` + tradeValue.slice(0, 12).map(r => `${r.n} ${r.pos} ${r.nfl} ${r.value} (${r.avg}/${r.l3}/${r.proj})`).join(" | "));
console.log("RISERS: " + risers.slice(0, 6).map(r => `${r.n} ${r.avg}→${r.l3}`).join(" | "));
