// Waiver Heat carousel data: who's being added since Sunday's games, with the last 4 weeks of usage and next week's projection.
// Usage: node scripts/waiverslides.mjs <outDir> [lookbackHours=24]   (writes waivers.json + h/<id>.jpg headshots)
// Week logic: during a week whose Sunday is done (Mon/Tue), "next" = state.week + 1, last 4 = weeks week-3..week.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
const S = "https://api.sleeper.app";
const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const out = process.argv[2] || "public/wh";
const look = +(process.argv[3] || 24);
mkdirSync(`${out}/h`, { recursive: true });
const st = await j(`${S}/v1/state/nfl`);
const season = st.season, cur = st.week, next = cur + 1;
const weeks = [cur - 3, cur - 2, cur - 1, cur];
const pos = ["QB", "RB", "WR", "TE"].map(p => "position[]=" + p).join("&");
const [trend, players, proj, ...stats] = await Promise.all([
  j(`${S}/v1/players/nfl/trending/add?lookback_hours=${look}&limit=40`),
  j(`${S}/v1/players/nfl`),
  j(`${S}/projections/nfl/${season}/${next}?season_type=regular&${pos}`),
  ...weeks.map(w => j(`${S}/stats/nfl/${season}/${w}?season_type=regular&${pos}`)),
]);
const pj = new Map(proj.map(x => [x.player_id, x]));
const sw = stats.map(a => new Map(a.map(x => [x.player_id, x])));
// season-to-date average (weeks 1..cur, games played only)
const all = await Promise.all(Array.from({ length: cur }, (_, i) => j(`${S}/stats/nfl/${season}/${i + 1}?season_type=regular&${pos}`)));
const list = [];
for (const t of trend) {
  const p = players[t.player_id];
  if (!p || !["QB", "RB", "WR", "TE"].includes(p.position) || !p.team) continue;
  const pr = pj.get(t.player_id);
  const wk = weeks.map((w, i) => { const s = sw[i].get(t.player_id)?.stats; return s && (s.gp ?? 0) > 0 ? { w, pts: +(s.pts_half_ppr ?? 0).toFixed(1), tgt: s.rec_tgt ?? 0, rec: s.rec ?? 0, ryd: (s.rec_yd ?? 0), att: s.rush_att ?? 0, rush: s.rush_yd ?? 0, td: (s.rec_td ?? 0) + (s.rush_td ?? 0) + (s.pass_td ?? 0), snp: s.off_snp ?? null, tsnp: s.tm_off_snp ?? null, pyd: s.pass_yd ?? 0 } : { w, pts: null }; });
  const games = all.map(a => a.find(x => x.player_id === t.player_id)?.stats).filter(s => s && (s.gp ?? 0) > 0);
  const avg = games.length ? +(games.reduce((s, x) => s + (x.pts_half_ppr ?? 0), 0) / games.length).toFixed(1) : 0;
  list.push({ id: t.player_id, n: `${p.first_name} ${p.last_name}`, num: p.number ?? null, pos: p.position, nfl: p.team, adds: t.count,
    inj: p.injury_status || null, age: p.age ?? null, yrs: p.years_exp ?? null,
    proj: +(pr?.stats?.pts_half_ppr ?? 0).toFixed(1), opp: pr?.opponent || null, gameDate: pr?.date || null,
    avg, gp: games.length, wk });
}
writeFileSync(`${out}/waivers.json`, JSON.stringify({ season, week: cur, next, lookback: look, builtAt: new Date().toISOString(), players: list }, null, 1));
for (const x of list.slice(0, 14)) {
  if (!existsSync(`${out}/h/${x.id}.jpg`)) { const r = await fetch(`https://sleepercdn.com/content/nfl/players/${x.id}.jpg`); if (r.ok) writeFileSync(`${out}/h/${x.id}.jpg`, Buffer.from(await r.arrayBuffer())); }
}
console.log(list.slice(0, 16).map(x => `${x.n} ${x.pos} ${x.nfl} adds=${x.adds} inj=${x.inj} yrs=${x.yrs} avg=${x.avg}/${x.gp}g proj${next}=${x.proj} vs ${x.opp} | ` + x.wk.map(w => w.pts == null ? `w${w.w}:-` : `w${w.w}:${w.pts}(t${w.tgt} a${w.att} snp${w.snp}/${w.tsnp})`).join(" ")).join("\n"));
