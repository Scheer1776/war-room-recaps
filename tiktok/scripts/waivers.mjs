// Pull this week's hottest waiver adds from Sleeper (public API) for the "Waiver Heat" video.
// Usage: node scripts/waivers.mjs <outDir>   (writes waivers.json)
import { writeFileSync, mkdirSync } from "node:fs";
const S = "https://api.sleeper.app";
const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const out = process.argv[2] || "public/waivers";
mkdirSync(out, { recursive: true });
const st = await j(`${S}/v1/state/nfl`);
const season = st.season, week = st.week, last = week - 1;
const pos = ["QB", "RB", "WR", "TE"].map(p => "position[]=" + p).join("&");
const [trend, players, proj, stats] = await Promise.all([
  j(`${S}/v1/players/nfl/trending/add?lookback_hours=48&limit=60`),
  j(`${S}/v1/players/nfl`),
  j(`${S}/projections/nfl/${season}/${week}?season_type=regular&${pos}`),
  j(`${S}/stats/nfl/${season}/${last}?season_type=regular&${pos}`),
]);
const pj = new Map(proj.map(x => [x.player_id, x]));
const sj = new Map(stats.map(x => [x.player_id, x]));
const list = [];
for (const t of trend) {
  const p = players[t.player_id];
  if (!p || !["QB", "RB", "WR", "TE"].includes(p.position)) continue;
  const pr = pj.get(t.player_id), s = sj.get(t.player_id);
  list.push({
    id: t.player_id, n: `${p.first_name} ${p.last_name}`, num: p.number ?? null, pos: p.position, nfl: p.team || "FA", adds: t.count,
    proj: +(pr?.stats?.pts_half_ppr ?? 0).toFixed(1), opp: pr?.opponent || null,
    last: +(s?.stats?.pts_half_ppr ?? 0).toFixed(1), inj: p.injury_status || null,
  });
}
const top = list.filter(x => x.nfl !== "FA" && !x.inj).slice(0, 12);
writeFileSync(`${out}/waivers.json`, JSON.stringify({ season, week, builtAt: new Date().toISOString(), players: top }, null, 1));
console.log(top.map(x => `${x.n} ${x.pos} ${x.nfl} adds=${x.adds} last=${x.last} proj=${x.proj} vs ${x.opp}`).join("\n"));
