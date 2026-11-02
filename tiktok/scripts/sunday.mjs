// Sunday recap data: this week's final scores (ESPN scoreboard) + fantasy booms and busts (Sleeper stats vs projections).
// Usage: node scripts/sunday.mjs <outDir> [week]   → <outDir>/sunday.json + <outDir>/h/<id>.jpg headshots
// Points are PPR. "Boom" = most points; "beat" = most points over projection; "bust" = biggest miss among top-projected players.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
const S = "https://api.sleeper.app";
const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const out = process.argv[2] || "public/sun";
mkdirSync(out + "/h", { recursive: true });

const sb = await j("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard" + (process.argv[3] ? `?week=${process.argv[3]}` : ""));
const week = Number(process.argv[3]) || sb.week.number, season = sb.season.year;
const games = sb.events.map(e => {
  const c = e.competitions[0], st = e.status.type;
  const [a, b] = c.competitors.sort((x, y) => (x.homeAway === "away" ? -1 : 1));
  return { id: e.id, date: e.date, state: st.state, detail: st.shortDetail, ot: /OT/.test(st.shortDetail),
    away: { t: a.team.abbreviation, s: Number(a.score), name: a.team.shortDisplayName }, home: { t: b.team.abbreviation, s: Number(b.score), name: b.team.shortDisplayName } };
});
// Sunday = games kicking off on the most recent Sunday (Pacific time) in this week's slate.
const pt = d => new Date(new Date(d).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
const sunday = games.filter(g => pt(g.date).getDay() === 0);
const sunTeams = new Set(sunday.flatMap(g => [g.away.t, g.home.t]));

const POS = ["QB", "RB", "WR", "TE"], pos = POS.map(p => "position[]=" + p).join("&");
const [players, stats, proj] = await Promise.all([
  j(`${S}/v1/players/nfl`),
  j(`${S}/stats/nfl/${season}/${week}?season_type=regular&${pos}`),
  j(`${S}/projections/nfl/${season}/${week}?season_type=regular&${pos}`),
]);
const pj = new Map(proj.map(x => [x.player_id, x.stats?.pts_ppr ?? 0]));
const fix = t => ({ WAS: "WSH", JAC: "JAX" }[t] || t);
const rows = [];
for (const r of stats) {
  const p = players[r.player_id], s = r.stats || {};
  if (!p || !POS.includes(p.position) || s.pts_ppr == null) continue;
  const team = fix(r.team || p.team);
  if (!sunTeams.has(team)) continue;
  const line = p.position === "QB"
    ? [s.pass_yd && `${s.pass_yd} pass yds`, s.pass_td && `${s.pass_td} TD`, s.rush_yd >= 20 && `${s.rush_yd} rush yds`, s.rush_td && `${s.rush_td} rush TD`]
    : [s.rush_yd >= 15 && `${s.rush_yd} rush yds`, s.rec && `${s.rec} rec`, s.rec_yd && `${s.rec_yd} rec yds`, (s.rush_td || 0) + (s.rec_td || 0) && `${(s.rush_td || 0) + (s.rec_td || 0)} TD`];
  rows.push({ id: r.player_id, n: `${p.first_name} ${p.last_name}`, last: p.last_name, pos: p.position, team, num: p.number,
    pts: Math.round(s.pts_ppr * 10) / 10, proj: Math.round((pj.get(r.player_id) || 0) * 10) / 10, line: line.filter(Boolean).join(" · "),
    s: { pass_yd: s.pass_yd || 0, pass_td: s.pass_td || 0, rush_yd: s.rush_yd || 0, rush_td: s.rush_td || 0, rec: s.rec || 0, rec_yd: s.rec_yd || 0, rec_td: s.rec_td || 0 } });
}
rows.forEach(r => r.diff = Math.round((r.pts - r.proj) * 10) / 10);
const top = [...rows].sort((a, b) => b.pts - a.pts).slice(0, 12);
const beat = [...rows].filter(r => r.proj >= 5).sort((a, b) => b.diff - a.diff).slice(0, 8);
const bust = [...rows].filter(r => r.proj >= 14).sort((a, b) => a.diff - b.diff).slice(0, 8);
const gameOf = t => sunday.find(g => g.away.t === t || g.home.t === t);

for (const r of [...top, ...beat, ...bust]) {
  const f = `${out}/h/${r.id}.jpg`;
  if (existsSync(f)) continue;
  const res = await fetch(`https://sleepercdn.com/content/nfl/players/${r.id}.jpg`);
  if (res.ok) writeFileSync(f, Buffer.from(await res.arrayBuffer()));
}
const data = { season, week, sunday, top, beat, bust, gameOf: Object.fromEntries([...top, ...beat, ...bust].map(r => [r.id, gameOf(r.team)?.id])) };
writeFileSync(`${out}/sunday.json`, JSON.stringify(data, null, 1));
console.log(`week ${week}: ${sunday.length} Sunday games (${sunday.filter(g => g.state === "post").length} final)`);
for (const [k, list] of Object.entries({ top, beat, bust })) {
  console.log(`\n${k.toUpperCase()}`);
  for (const r of list) console.log(`${r.pts.toFixed(1).padStart(5)} (proj ${r.proj.toFixed(1)}, ${r.diff >= 0 ? "+" : ""}${r.diff})  ${r.n} ${r.pos} ${r.team}  ${r.line}`);
}
console.log("\nSCORES"); for (const g of sunday) console.log(`${g.away.t} ${g.away.s} @ ${g.home.t} ${g.home.s}  ${g.detail}`);
