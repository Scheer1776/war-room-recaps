// Downloads player headshots (ESPN cutouts when available, else Sleeper) and NFL team logos
// for the names in assets-request.json, into ./assets-out. Run by .github/workflows/assets.yml.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const want = JSON.parse(readFileSync("assets-request.json", "utf8"));
const norm = s => String(s || "").toLowerCase().replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/, "").replace(/\s+/g, " ").trim();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-");
const FIX = { WAS: "WSH", LAR: "LA" };
mkdirSync("assets-out/heads", { recursive: true }); mkdirSync("assets-out/logos", { recursive: true });
const db = await (await fetch("https://api.sleeper.app/v1/players/nfl")).json();
const byName = {};
for (const [id, p] of Object.entries(db)) { const n = norm(p.full_name || `${p.first_name} ${p.last_name}`); (byName[n] = byName[n] || []).push({ id, ...p }); }
const save = async (url, path) => { try { const r = await fetch(url); if (!r.ok) return false; const b = Buffer.from(await r.arrayBuffer()); if (b.length < 1500) return false; writeFileSync(path, b); return true; } catch { return false; } };
const index = {};
for (const w of want) {
  if (w.pos === "DST") continue;
  const c = (byName[norm(w.n)] || []).sort((a, b) => ((b.team === (FIX[w.nfl] || w.nfl)) - (a.team === (FIX[w.nfl] || w.nfl))) || ((b.position === w.pos) - (a.position === w.pos)))[0];
  if (!c) continue;
  const s = slug(w.n);
  if (c.espn_id && await save(`https://a.espncdn.com/i/headshots/nfl/players/full/${c.espn_id}.png`, `assets-out/heads/${s}.png`)) index[s] = `heads/${s}.png`;
  else if (await save(`https://sleepercdn.com/content/nfl/players/${c.id}.jpg`, `assets-out/heads/${s}.jpg`)) index[s] = `heads/${s}.jpg`;
}
const TEAMS = ["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LAC","LAR","LV","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SF","SEA","TB","TEN","WAS"];
for (const t of TEAMS) await save(`https://a.espncdn.com/i/teamlogos/nfl/500/${(t === "WAS" ? "wsh" : t).toLowerCase()}.png`, `assets-out/logos/${t}.png`);
writeFileSync("assets-out/index.json", JSON.stringify(index, null, 1));
console.log(`headshots: ${Object.keys(index).length} of ${want.length}`);
