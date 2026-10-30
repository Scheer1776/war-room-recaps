// Quiz / "pause and guess" data: leaderboards over the last 3 completed weeks (Sleeper stats),
// plus this week's projections, so every option and answer in the Quiz video is a real number.
// Usage: node scripts/quiz.mjs <outDir>   (writes quiz.json: leaderboards keyed by stat)
import { writeFileSync, mkdirSync } from "node:fs";
const S = "https://api.sleeper.app";
const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const out = process.argv[2] || "public/quiz";
mkdirSync(out, { recursive: true });
const st = await j(`${S}/v1/state/nfl`);
const season = st.season, week = st.week;
const POS = ["QB", "RB", "WR", "TE"];
const q = POS.map(p => "position[]=" + p).join("&");
const weeks = []; for (let w = Math.max(1, week - 3); w < week; w++) weeks.push(w);
const players = await j(`${S}/v1/players/nfl`);
const proj = await j(`${S}/projections/nfl/${season}/${week}?season_type=regular&${q}`);
const agg = new Map();
for (const w of weeks) {
  const rows = await j(`${S}/stats/nfl/${season}/${w}?season_type=regular&${q}`);
  for (const r of rows) {
    if (!r.stats || !(r.stats.gp > 0)) continue;
    const p = players[r.player_id]; if (!p || !POS.includes(p.position)) continue;
    const a = agg.get(r.player_id) || { id: r.player_id, n: `${p.first_name} ${p.last_name}`, num: p.number ?? null, pos: p.position, nfl: p.team, g: 0, tgt: 0, rec: 0, rec_yd: 0, rush_att: 0, rush_yd: 0, td: 0, pts: 0, pass_yd: 0, pass_td: 0, rz: 0, wk: [] };
    const s = r.stats;
    a.g++; a.tgt += s.rec_tgt || 0; a.rec += s.rec || 0; a.rec_yd += s.rec_yd || 0; a.rush_att += s.rush_att || 0; a.rush_yd += s.rush_yd || 0;
    a.td += (s.rec_td || 0) + (s.rush_td || 0); a.pts += s.pts_half_ppr || 0; a.pass_yd += s.pass_yd || 0; a.pass_td += s.pass_td || 0;
    a.wk.push({ w, pts: +(s.pts_half_ppr || 0).toFixed(1), tgt: s.rec_tgt || 0, opp: r.opponent || null });
    agg.set(r.player_id, a);
  }
}
const pj = new Map(proj.map(r => [r.player_id, { proj: +(r.stats?.pts_half_ppr ?? 0).toFixed(1), opp: r.opponent || null, date: r.date || null }]));
const all = [...agg.values()].map(a => ({ ...a, pts: +a.pts.toFixed(1), ppg: +(a.pts / a.g).toFixed(1), touches: a.rush_att + a.rec, ...(pj.get(a.id) || { proj: null, opp: null }), inj: players[a.id]?.injury_status || null }));
const top = (pos, k, n = 12) => all.filter(x => !pos || pos.includes(x.pos)).sort((a, b) => b[k] - a[k]).slice(0, n);
const boards = {
  wr_tgt: top(["WR", "TE"], "tgt"), rb_touch: top(["RB"], "touches"), te_pts: top(["TE"], "pts"), qb_pts: top(["QB"], "pts"),
  wr_pts: top(["WR"], "pts"), rb_pts: top(["RB"], "pts"), td: top(null, "td"), flex_pts: top(["RB", "WR", "TE"], "pts"),
};
writeFileSync(`${out}/quiz.json`, JSON.stringify({ season, week, weeks, builtAt: new Date().toISOString(), boards, players: Object.fromEntries(all.map(a => [a.id, a])) }, null, 1));
for (const [k, b] of Object.entries(boards)) { console.log("== " + k); for (const x of b) console.log(`  ${x.n} ${x.pos} ${x.nfl} #${x.num} g${x.g} tgt${x.tgt} tch${x.touches} td${x.td} pts${x.pts} ppg${x.ppg} proj${x.proj} v${x.opp} ${x.inj || ""}`); }
