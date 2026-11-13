// auto/slate.mjs — data for an auto-made recap of one slate of NFL games (Thursday night, Sunday, Monday night, or all).
// Usage: node auto/slate.mjs <outDir> [--slate thu|sun|mon|all] [--week N]
// Writes <outDir>/slate.json and <outDir>/h/<sleeperId>.jpg headshots. Free public data only:
//   ESPN scoreboard (scores, game state) + Sleeper weekly stats/projections (PPR fantasy points).
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = process.argv[2] || "public/auto";
const slate = arg("slate", "thu");
const weekArg = arg("week", "");
mkdirSync(out + "/h", { recursive: true });

const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const sb = await j("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard" + (weekArg ? `?week=${weekArg}&seasontype=2` : ""));
const week = Number(weekArg) || sb.week.number, season = sb.season.year;
const pt = d => new Date(new Date(d).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
const DAY = { thu: [4], sun: [0], mon: [1], all: [0, 1, 2, 3, 4, 5, 6] }[slate];
if (!DAY) throw new Error("slate must be thu|sun|mon|all");
const games = sb.events.filter(e => DAY.includes(pt(e.date).getDay())).map(e => {
  const c = e.competitions[0], st = e.status.type;
  const [a, b] = [...c.competitors].sort(x => (x.homeAway === "away" ? -1 : 1));
  const side = x => ({ t: x.team.abbreviation, s: Number(x.score || 0), name: x.team.shortDisplayName, full: x.team.displayName, rec: x.records?.[0]?.summary || "" });
  return { id: e.id, date: e.date, state: st.state, final: st.completed, detail: st.shortDetail, ot: /OT/.test(st.shortDetail), away: side(a), home: side(b) };
});
if (!games.length) throw new Error(`no ${slate} games in week ${week}`);
const teams = new Set(games.flatMap(g => [g.away.t, g.home.t]));

// Sleeper: PPR points + projections for skill players on the slate's teams.
const S = "https://api.sleeper.app", POS = ["QB", "RB", "WR", "TE"], pos = POS.map(p => "position[]=" + p).join("&");
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
  if (!teams.has(team)) continue;
  const td = (s.rush_td || 0) + (s.rec_td || 0);
  const line = p.position === "QB"
    ? [s.pass_yd && `${s.pass_yd} pass yds`, s.pass_td && `${s.pass_td} TD`, s.pass_int && `${s.pass_int} INT`, s.rush_yd >= 20 && `${s.rush_yd} rush yds`, s.rush_td && `${s.rush_td} rush TD`]
    : [s.rush_yd >= 15 && `${s.rush_yd} rush yds`, s.rec && `${s.rec} rec`, s.rec_yd && `${s.rec_yd} rec yds`, td && `${td} TD`];
  rows.push({ id: r.player_id, n: `${p.first_name} ${p.last_name}`, first: p.first_name, last: p.last_name, pos: p.position, team,
    pts: Math.round(s.pts_ppr * 10) / 10, proj: Math.round((pj.get(r.player_id) || 0) * 10) / 10, line: line.filter(Boolean).join(" · "),
    s: { pass_yd: s.pass_yd || 0, pass_td: s.pass_td || 0, pass_int: s.pass_int || 0, rush_yd: s.rush_yd || 0, rush_td: s.rush_td || 0, rec: s.rec || 0, rec_yd: s.rec_yd || 0, rec_td: s.rec_td || 0 } });
}
rows.forEach(r => r.diff = Math.round((r.pts - r.proj) * 10) / 10);
const top = [...rows].sort((a, b) => b.pts - a.pts).slice(0, 8);
const beat = [...rows].filter(r => r.proj >= 5).sort((a, b) => b.diff - a.diff).slice(0, 6);
const bust = [...rows].filter(r => r.proj >= 10).sort((a, b) => a.diff - b.diff).slice(0, 6);

for (const r of [...top, ...beat, ...bust]) {
  const f = `${out}/h/${r.id}.jpg`;
  if (existsSync(f)) continue;
  const res = await fetch(`https://sleepercdn.com/content/nfl/players/${r.id}.jpg`);
  if (res.ok) writeFileSync(f, Buffer.from(await res.arrayBuffer()));
}
const data = { season, week, slate, games, top, beat, bust, made: new Date().toISOString() };
writeFileSync(`${out}/slate.json`, JSON.stringify(data, null, 1));
console.log(`week ${week} ${slate}: ${games.length} game(s), ${games.filter(g => g.final).length} final, ${rows.length} players with stats`);
for (const g of games) console.log(`  ${g.away.t} ${g.away.s} @ ${g.home.t} ${g.home.s}  ${g.detail}`);
for (const r of top.slice(0, 4)) console.log(`  top  ${r.pts} (proj ${r.proj})  ${r.n} ${r.pos} ${r.team}  ${r.line}`);
for (const r of bust.slice(0, 2)) console.log(`  bust ${r.pts} (proj ${r.proj})  ${r.n} ${r.pos} ${r.team}`);
