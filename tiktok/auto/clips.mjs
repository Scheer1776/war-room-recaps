// auto/clips.mjs — real game clips for the cloud recaps, from ESPN's public video feed (direct MP4s on ESPN's CDN).
// ESPN posts single-play NFL clips during games (e.g. "Live on Prime Video: ... TD"), each tagged with the game, teams,
// athletes and the play-by-play play id. The feed only returns the newest ~100 clips (all sports, ~1 hour), so a
// collector polls it during the games and keeps every NFL clip; the matcher then picks clips for each scene.
//
//   node auto/clips.mjs collect <file.json> [--until-final thu|sun|mon|all] [--every 120] [--max-min 330] [--push media:path]
//   node auto/clips.mjs match <dir> [<file.json> ...]     (reads <dir>/slate.json + story.json, downloads, sets scene.pip)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FEED = "https://content.core.api.espn.com/v1/video/clips?limit=100";
const j = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const slim = (v) => {
  const cats = v.categories || [];
  const src = v.links?.source || {};
  return {
    id: v.id, headline: v.headline, published: v.originalPublishDate, gameId: String(v.gameId || cats.find(c => c.type === "event")?.eventId || ""),
    playIds: (v.plays || []).map(p => String(p.id)), duration: v.duration,
    athletes: cats.filter(c => c.type === "athlete").map(c => ({ id: String(c.athleteId), name: c.description })),
    teams: cats.filter(c => c.type === "team").map(c => c.team?.abbreviation).filter(Boolean),
    mp4: src.HD?.href || src.href || src.full?.href || null, hls916: src.HLS?.["9x16"]?.href || null,
  };
};
const isNfl = (v) => (v.categories || []).some(c => c.type === "league" && c.description === "NFL");
const load = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { clips: [] });

async function pollOnce(store) {
  const d = await j(FEED);
  let added = 0;
  for (const v of d.videos || []) {
    if (!isNfl(v) || store.clips.some(c => c.id === v.id)) continue;
    const s = slim(v); if (!s.mp4) continue;
    store.clips.push(s); added++;
  }
  return added;
}

async function slateFinal(slate) {
  const sb = await j("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  const pt = d => new Date(new Date(d).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).getDay();
  const DAY = { thu: [4], sun: [0], mon: [1], all: [0, 1, 2, 3, 4, 5, 6] }[slate];
  const g = sb.events.filter(e => DAY.includes(pt(e.date)));
  return { week: sb.week.number, season: sb.season.year, total: g.length, final: g.filter(e => e.status.type.completed).length, started: g.filter(e => e.status.type.state !== "pre").length };
}

function push(file, spec) {   // spec = "media:clips/nfl-2026-w10.json": commit the store to a branch so later jobs can use it
  const [branch, path] = spec.split(":");
  const repo = process.env.GITHUB_REPOSITORY, tok = process.env.GITHUB_TOKEN;
  if (!repo || !tok) return;
  const dir = "/tmp/clipstore";
  try {
    execFileSync("bash", ["-c", `rm -rf ${dir} && git clone -q --depth 1 --branch ${branch} https://x-access-token:${tok}@github.com/${repo}.git ${dir} && mkdir -p ${dir}/$(dirname ${path}) && cp ${file} ${dir}/${path} && cd ${dir} && git config user.name war-room-recaps && git config user.email actions@users.noreply.github.com && git add -A && (git diff --cached --quiet || (git commit -qm "clips: $(basename ${path})" && git push -q origin HEAD:${branch}))`], { stdio: "inherit" });
  } catch (e) { console.log("push failed:", e.message); }
}

const cmd = process.argv[2];
if (cmd === "collect") {
  const file = process.argv[3];
  const until = arg("until-final", null), every = Number(arg("every", 120)) * 1000, maxMin = Number(arg("max-min", 330)), pushTo = arg("push", null);
  const t0 = Date.now(); let finalAt = null;
  const store = load(file);
  for (;;) {
    let added = 0;
    try { added = await pollOnce(store); } catch (e) { console.log("poll failed:", e.message); }
    store.updated = new Date().toISOString();
    writeFileSync(file, JSON.stringify(store, null, 1));
    let st = null; if (until) { try { st = await slateFinal(until); } catch { } }
    console.log(`${new Date().toISOString()} +${added} NFL clips (total ${store.clips.length})${st ? `  games final ${st.final}/${st.total}` : ""}`);
    if (added && pushTo) push(file, pushTo);
    if (!until) break;
    if (st && st.total && st.final === st.total) { finalAt ??= Date.now(); if (Date.now() - finalAt > 12 * 60e3) break; } // ESPN posts the last clips a few minutes after the final whistle
    if (Date.now() - t0 > maxMin * 60e3) break;
    await sleep(every);
  }
  if (pushTo) push(file, pushTo);
} else if (cmd === "match") {
  const dir = process.argv[3];
  const slate = JSON.parse(readFileSync(`${dir}/slate.json`, "utf8"));
  const story = JSON.parse(readFileSync(`${dir}/story.json`, "utf8"));
  const store = { clips: [] };
  for (const f of process.argv.slice(4)) for (const c of load(f).clips) if (!store.clips.some(x => x.id === c.id)) store.clips.push(c);
  try { await pollOnce(store); } catch (e) { console.log("live feed failed:", e.message); }
  const gameIds = new Set(slate.games.map(g => String(g.id)));
  const clips = store.clips.filter(c => gameIds.has(c.gameId));
  console.log(`clips for this slate: ${clips.length} (of ${store.clips.length} NFL clips known)`);
  // play-by-play text for each clip's play (what actually happened), from the ESPN game summaries
  const playText = new Map();
  for (const g of slate.games) {
    try {
      const s = await j(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${g.id}`);
      for (const dr of s.drives?.previous || []) for (const p of dr.plays || []) playText.set(String(p.id), `${p.type?.text || ""} | ${p.text || ""}`);
    } catch { }
  }
  const what = (c) => `${c.headline} ${c.playIds.map(id => playText.get(id) || "").join(" ")}`.toLowerCase();
  const BAD = /intercept|picked off|pick-six|pick six|picks off|sack|fumble|strip|safety|turnover/;
  const GOOD = /touchdown|\btd\b|scores|bomb|dart|finds|breaks|big gain|yard|catch|run|dash|leap|hurdle/;
  const label = (c) => { const t = what(c);
    return /intercept|picked off|picks off|pick-six|pick six/.test(t) ? "PICKED OFF" : /sack/.test(t) ? "SACKED" : /fumble|strip/.test(t) ? "FUMBLE"
      : /touchdown|\btd\b/.test(t) ? "TOUCHDOWN" : "THE PLAY"; };
  const byPlayer = (pl) => clips.filter(c => (pl.espn && c.athletes.some(a => a.id === String(pl.espn))) || new RegExp(`\\b${pl.last.replace(/[^A-Za-z' -]/g, "")}\\b`, "i").test(c.headline));
  const rows = [...slate.top, ...slate.beat, ...slate.bust];
  const used = new Set();
  const pick = (list, want, n) => list.filter(c => !used.has(c.id) && want(c)).sort((a, b) => a.published.localeCompare(b.published)).slice(0, n);
  mkdirSync(`${dir}/clips`, { recursive: true });
  const fetchClip = (c) => {
    const out = `${dir}/clips/c${c.id}.mp4`;
    if (existsSync(out)) return `c${c.id}.mp4`;
    // ESPN play clips open ~1 s before the snap; keep the play (8 s), 16:9 at 960x540, no audio (the voice is the sound)
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "0.6", "-t", "8.5", "-i", c.mp4, "-an", "-vf", "scale=960:540:force_original_aspect_ratio=increase,crop=960:540,fps=30,format=yuv420p",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-movflags", "+faststart", out], { stdio: "inherit", timeout: 120000 });
    return `c${c.id}.mp4`;
  };
  for (const sc of story.scenes) {
    let chosen = [];
    if ((sc.kind === "hero" || sc.kind === "bust") && sc.player) {
      const r = rows.find(x => x.id === sc.player.id);
      if (!r) continue;
      const mine = byPlayer(r);
      chosen = sc.kind === "bust" ? pick(mine, c => BAD.test(what(c)), 2) : pick(mine, c => !BAD.test(what(c)), 2);
    } else if (sc.kind === "versus" && sc.game) {
      const w = sc.game.away.s >= sc.game.home.s ? sc.game.away.t : sc.game.home.t;
      chosen = pick(clips, c => /touchdown|\btd\b/.test(what(c)) && c.teams.includes(w) && new RegExp(w === sc.game.away.t ? sc.game.away.name : sc.game.home.name, "i").test(c.headline), 1);
      if (!chosen.length) chosen = pick(clips, c => /touchdown|\btd\b/.test(what(c)), 1);
    }
    const pip = [];
    for (const c of chosen) {
      try { pip.push({ file: fetchClip(c), label: label(c), headline: c.headline }); used.add(c.id); } catch (e) { console.log("download failed", c.id, e.message); }
    }
    if (pip.length) { sc.pip = pip.map((p, i, a) => ({ ...p, label: a.length > 1 && a.every(x => x.label === p.label) ? `${p.label} #${i + 1}` : p.label })); console.log(`  ${sc.id}: ${pip.map(p => `${p.label} <- ${p.headline}`).join(" | ")}`); }
    else delete sc.pip;
  }
  writeFileSync(`${dir}/story.json`, JSON.stringify(story, null, 1));
} else {
  console.log("usage: clips.mjs collect <file> [...] | match <dir> [files...]"); process.exit(2);
}
