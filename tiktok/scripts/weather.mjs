// Weather game alert data: every NFL game this week (dome / good / bad) from War Room's own lib/weather.js
// (ESPN scoreboard + Open-Meteo, with the app's backtested projection multipliers), joined with Sleeper projections
// for the top players in the games that get a multiplier.
// Usage: node scripts/weather.mjs <path to war-room-web clone> <outDir>   (writes weather.json)
// Node's fetch can't reach open-meteo through this sandbox's proxy, so the app's calls go through curl (with retries: open-meteo answers 429 now and then).
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const [web = "../../war-room", out = "public/weather"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const curl = (url) => execFileSync("curl", ["-sSf", "-m", "30", "--retry", "5", "--retry-all-errors", "--retry-delay", "4", "-A", "war-room/1.0", String(url)], { maxBuffer: 64e6 }).toString();
globalThis.fetch = async (url) => { const t = curl(url); return { ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t }; };
const S = "https://api.sleeper.app";
const st = JSON.parse(curl(`${S}/v1/state/nfl`));
const { weekWeather } = await import(resolve(web, "lib/weather.js"));
const w = await weekWeather(st.week);
const games = [...new Map(Object.values(w.teams).map(g => [g.away + "@" + g.home, g])).values()].sort((a, b) => a.kick.localeCompare(b.kick));
const proj = JSON.parse(curl(`${S}/projections/nfl/${st.season}/${st.week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE`));
const db = JSON.parse(curl(`${S}/v1/players/nfl`));
for (const g of games) {
  if (!g.adj) continue;
  // Weather hits the passing game hardest, so show the top 3 QB/WR/TE plus the top RB.
  const pool = proj.filter(x => (x.team === g.home || x.team === g.away) && !x.player?.injury_status && (x.stats?.pts_half_ppr ?? 0) >= 8)
    .sort((a, b) => b.stats.pts_half_ppr - a.stats.pts_half_ppr);
  const pick = [...pool.filter(x => x.player.position !== "RB").slice(0, 3), ...pool.filter(x => x.player.position === "RB").slice(0, 1)];
  g.players = pick.map(x => { const pos = x.player.position, p = +x.stats.pts_half_ppr.toFixed(1), m = g.adj[pos] ?? 1;
      return { id: x.player_id, n: `${x.player.first_name} ${x.player.last_name}`, num: db[x.player_id]?.number ?? null, pos, nfl: x.team, proj: p, mult: m, wx: +(p * m).toFixed(1) }; });
}
writeFileSync(`${out}/weather.json`, JSON.stringify({ season: st.season, week: st.week, builtAt: new Date().toISOString(), rule: w.rule, games }, null, 1));
for (const g of games) console.log(`${g.away}@${g.home} ${g.kick} ${g.kind} ${g.text} ${g.adj ? JSON.stringify(g.adj) : ""}`, (g.players || []).map(p => `${p.n} ${p.proj}->${p.wx}`).join(", "));
