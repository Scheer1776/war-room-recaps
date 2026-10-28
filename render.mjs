// Weekly HD recap: runs on GitHub Actions after Monday Night Football.
//  1. Waits until every NFL game of the week is final (otherwise exits; a later scheduled run retries).
//  2. Loads each league from War Room, counts the final week into records, and reruns playoff odds.
//  3. Builds a HyperFrames composition and renders it to MP4.
//  4. Commits the MP4 to the public `media` branch (served by jsDelivr) and tells War Room about it.
// Env: WARROOM_URL, ADMIN_KEY, ESPN_S2, ESPN_SWID, FORCE=1 (re-render), WEEK=N (override), DRY_RUN=1 (no publish),
//      DATA_ONLY=1 (skip the HD render; just publish the week's recap data + headshots for the TikTok cut)
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildComposition } from "./composition.mjs";
import { writeBeat } from "./beat.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = (process.env.WARROOM_URL || "https://war-room-self-one.vercel.app").replace(/\/$/, "");
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";
const DRY = process.env.DRY_RUN === "1";
const DATA_ONLY = process.env.DATA_ONLY === "1";
const REPO = process.env.GITHUB_REPOSITORY || "";
const log = (...a) => console.log("[recap]", ...a);

async function json(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "User-Agent": "war-room-recaps", "x-warroom-bot": "1", ...(opts.headers || {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${url.split("?")[0]} → ${r.status} ${(j && j.error && j.error.message) || ""}`);
  return j;
}
async function download(url, path) {
  try { const r = await fetch(url, { headers: { "User-Agent": "war-room-recaps" } }); if (!r.ok) return false; writeFileSync(path, Buffer.from(await r.arrayBuffer())); return statSync(path).size > 500; }
  catch { return false; }
}

// War Room's own model + recap math, loaded from the live site so the video always matches the app.
async function loadAppModules(dir) {
  mkdirSync(dir, { recursive: true });
  for (const f of ["model.js", "recap.js"]) {
    const r = await fetch(`${APP}/${f}`, { cache: "no-store" }); if (!r.ok) throw new Error(`couldn't load ${f}`);
    writeFileSync(join(dir, f.replace(".js", ".mjs")), (await r.text()).replace('from "./model.js"', 'from "./model.mjs"'));
  }
  return { model: await import(pathToFileURL(join(dir, "model.mjs"))), recap: await import(pathToFileURL(join(dir, "recap.mjs"))) };
}

async function loadLeague(cfg) {
  if (cfg.platform === "sleeper") return json(`${APP}/api/sleeper?username=${encodeURIComponent(cfg.username)}&league=${encodeURIComponent(cfg.leagueId)}`);
  return json(`${APP}/api/espn`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId: cfg.leagueId, season: cfg.season, espnS2: process.env[cfg.s2Env || "ESPN_S2"], swid: process.env[cfg.swidEnv || "ESPN_SWID"], teamId: cfg.teamId }) });
}
async function loadLive(cfg, L, week) {
  if (cfg.platform === "sleeper") return json(`${APP}/api/live?platform=sleeper&league=${encodeURIComponent(L.leagueId)}&week=${week}`);
  return json(`${APP}/api/live`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: "espn", leagueId: cfg.leagueId, season: L.season, espnS2: process.env[cfg.s2Env || "ESPN_S2"], swid: process.env[cfg.swidEnv || "ESPN_SWID"], week }) });
}

const LOGO_FIX = { WAS: "wsh" };
const headUrl = (platform, id) => platform === "sleeper" ? `https://sleepercdn.com/content/nfl/players/${id}.jpg` : `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`;
const logoUrl = abbr => `https://a.espncdn.com/i/teamlogos/nfl/500/${(LOGO_FIX[abbr] || abbr).toLowerCase()}.png`;

// The week's story as plain data (no rosters), for the vertical TikTok cut in tiktok/.
function slimRecap(R, standings, odds) {
  const p = r => r && { id: String(r.id), n: r.n, pos: r.pos, nfl: r.nfl, act: Math.round((r.act || 0) * 10) / 10 };
  const t = x => x && { id: x.id, name: x.name, pts: Math.round(x.pts * 10) / 10, left: Math.round((x.left || 0) * 10) / 10 };
  const g = x => x && { win: t(x.win), lose: t(x.lose), margin: Math.round(x.margin * 10) / 10 };
  const top = x => { const s = (x.starters || []).filter(r => !r.empty).sort((a, b) => b.act - a.act)[0]; return p(s); };
  return {
    platform: R.platform, league: R.league, week: R.week, myTeamId: R.myTeamId,
    games: R.games.map(g), high: { ...t(R.high), star: top(R.high) }, low: t(R.low), close: g(R.close), blow: g(R.blow),
    mvp: R.mvp && { player: p(R.mvp.r), team: t(R.mvp.team) },
    blunder: R.blunder && { team: t(R.blunder), bench: p(R.blunder.benchTop) },
    standings: standings.map(s => ({ ...s, odds: Math.round((odds[s.id] || 0) * 10) / 10 })),
    next: R.next && { week: R.next.week, a: R.next.a, b: R.next.b, pa: Math.round(R.next.pa * 10) / 10, pb: Math.round(R.next.pb * 10) / 10, wa: Math.round(R.next.wa * 1000) / 1000 }
  };
}

async function renderLeague(cfg, mods) {
  const tag = `${cfg.platform}-${cfg.leagueId}`;
  let L = await loadLeague(cfg);
  const prev = await json(`${APP}/api/hdrecap?platform=${cfg.platform}&league=${encodeURIComponent(L.leagueId)}`).catch(() => null);

  // Which week to recap: the league's current week if every game is final, else the one before.
  let week = Number(process.env.WEEK) || 0, live = null;
  if (!week) {
    live = await loadLive(cfg, L, L.week);
    const games = Object.values(live.games || {});
    const done = games.length && games.every(g => g.state === "post");
    if (done) week = L.week;
    else if (games.some(g => g.state === "in") || !FORCE) { log(`${tag}: week ${L.week} still has games left. Skipping for now.`); return null; }
    else week = L.week - 1;
  }
  if (!live || live.week !== week) live = await loadLive(cfg, L, week);
  if (prev && prev.week >= week && !FORCE && !DATA_ONLY) { log(`${tag}: week ${week} HD recap already published.`); return null; }

  // Count the week into records (no-op if ESPN/Sleeper already did) and rerun playoff odds.
  const medianWeeks = cfg.medianWeeks || [];
  const counted = mods.model.finalizeWeek(L, live, medianWeeks);
  const sim = mods.model.simulate(L, { n: 20000, medianWeeks });
  const odds = Object.fromEntries(sim.map(r => [r.id, r.playoffOdds]));
  const R = mods.recap.computeRecap(L, live, week, odds);
  if (!R) { log(`${tag}: no results for week ${week}.`); return null; }
  log(`${tag}: week ${week}, ${R.games.length} games, records ${counted ? "updated here" : "already final on " + cfg.platform}.`);

  const standingsAll = L.teams.map(t => ({ id: t.id, name: t.name, w: t.w, l: t.l, t: t.t, pf: Math.round(t.pf * 10) / 10 }))
    .sort((a, b) => (b.w + b.t / 2) - (a.w + a.t / 2) || b.pf - a.pf);
  const data = slimRecap(R, standingsAll, odds);
  // Headshots + logos for the TikTok cut, saved next to the data.
  const ddir = join(HERE, "out", "data", tag, "week-" + week); mkdirSync(join(ddir, "img"), { recursive: true });
  for (const pl of [data.mvp && data.mvp.player, data.blunder && data.blunder.bench, data.high && data.high.star].filter(Boolean)) {
    if (pl.pos !== "DST") await download(headUrl(R.platform, pl.id), join(ddir, "img", `h-${pl.id}.png`));
    if (pl.nfl) await download(logoUrl(pl.nfl), join(ddir, "img", `l-${pl.nfl}.png`));
  }
  writeFileSync(join(ddir, "recap.json"), JSON.stringify(data, null, 1));
  if (DATA_ONLY) return { tag, week, dataDir: ddir, dataOnly: true, league: L };

  // Build the composition folder.
  const dir = join(HERE, "build", tag + "-w" + week); mkdirSync(join(dir, "img"), { recursive: true }); mkdirSync(join(dir, "fonts"), { recursive: true });
  copyFileSync(join(HERE, "node_modules/gsap/dist/gsap.min.js"), join(dir, "gsap.min.js"));
  for (const f of ["SairaCondensed-ExtraBold.ttf", "SairaCondensed-SemiBold.ttf", "Barlow-SemiBold.ttf"]) copyFileSync(join(HERE, "assets/fonts", f), join(dir, "fonts", f));
  const imgs = {};
  const people = [R.mvp && R.mvp.r, R.blunder && R.blunder.benchTop, ...[R.high].map(t => (t.starters || []).filter(r => !r.empty).sort((a, b) => b.act - a.act)[0])].filter(Boolean);
  for (const p of people) {
    if (p.pos !== "DST" && await download(headUrl(R.platform, p.id), join(dir, "img", `h-${p.id}.png`))) imgs["head:" + p.id] = `img/h-${p.id}.png`;
    if (p.nfl && !imgs["logo:" + p.nfl] && await download(logoUrl(p.nfl), join(dir, "img", `l-${p.nfl}.png`))) imgs["logo:" + p.nfl] = `img/l-${p.nfl}.png`;
  }
  const { html, total } = buildComposition(R, k => imgs[k] || null);
  writeFileSync(join(dir, "index.html"), html);
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ id: tag + "-w" + week, name: `${R.league} week ${week}` }));
  writeBeat(join(dir, "beat.wav"), total + 0.5);

  // Render.
  const out = join(HERE, "out", `${tag}-week-${week}.mp4`); mkdirSync(dirname(out), { recursive: true });
  execFileSync("npx", ["hyperframes", "render", dir, "-o", out, "--quality", "looks", "--video-bitrate", "2500k", "--workers", "4"], { stdio: "inherit", cwd: HERE, env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1" } });
  const poster = out.replace(/\.mp4$/, ".jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "2", "-i", out, "-frames:v", "1", "-vf", "scale=540:960", poster]);
  log(`${tag}: rendered ${(statSync(out).size / 1e6).toFixed(1)} MB, ${total.toFixed(1)} s.`);

  const standings = L.teams.map(t => ({ id: t.id, name: t.name, w: t.w, l: t.l, t: t.t, pf: Math.round(t.pf * 10) / 10, odds: Math.round((odds[t.id] || 0) * 10) / 10 }))
    .sort((a, b) => (b.w + b.t / 2) - (a.w + a.t / 2) || b.pf - a.pf);
  return { tag, week, out, poster, standings, league: L, counted };
}

// Publish: commit the files to the `media` branch and point War Room at the jsDelivr URLs.
function publishFiles(files) {
  const media = join(HERE, ".media");
  const url = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${REPO}.git`;
  if (!existsSync(media)) {
    try { execFileSync("git", ["clone", "--depth", "1", "--branch", "media", url, media], { stdio: "inherit" }); }
    catch { mkdirSync(media, { recursive: true }); execFileSync("git", ["init", "-b", "media"], { cwd: media }); execFileSync("git", ["remote", "add", "origin", url], { cwd: media }); }
  }
  for (const f of files) { const dest = join(media, "recaps", f.name); mkdirSync(dirname(dest), { recursive: true }); copyFileSync(f.path, dest); }
  const g = (...a) => execFileSync("git", a, { cwd: media, stdio: "inherit" });
  g("config", "user.name", "war-room-recaps"); g("config", "user.email", "actions@users.noreply.github.com");
  g("add", "-A"); try { g("commit", "-m", "Add recap " + files.map(f => f.name).join(", ")); } catch { /* nothing new */ }
  g("push", "origin", "HEAD:media");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: media }).toString().trim();
  return name => `https://cdn.jsdelivr.net/gh/${REPO}@${commit}/recaps/${name}`;
}

const cfgs = JSON.parse(readFileSync(process.env.LEAGUES_FILE || join(HERE, "leagues.json"), "utf8"));
const mods = await loadAppModules(join(HERE, ".app"));
let failures = 0;
for (const cfg of cfgs) {
  try {
    const r = await renderLeague(cfg, mods);
    if (!r) continue;
    if (DRY || !REPO || !process.env.GITHUB_TOKEN) { log(`${r.tag}: dry run, not publishing. ${r.dataOnly ? "Data at " + r.dataDir : "Video at " + r.out}`); continue; }
    const dataFiles = d => readdirSync(d, { recursive: true }).filter(f => statSync(join(d, f)).isFile()).map(f => ({ path: join(d, f), name: `${r.tag}/week-${r.week}/${f}` }));
    if (r.dataOnly) { const urlOf = publishFiles(dataFiles(r.dataDir)); log(`${r.tag}: published week ${r.week} data → ${urlOf(`${r.tag}/week-${r.week}/recap.json`)}`); continue; }
    const vName = `${r.tag}/week-${r.week}.mp4`, pName = `${r.tag}/week-${r.week}.jpg`;
    const urlOf = publishFiles([{ path: r.out, name: vName }, { path: r.poster, name: pName }, ...dataFiles(join(HERE, "out", "data", r.tag, "week-" + r.week))]);
    await json(`${APP}/api/hdrecap`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-key": process.env.ADMIN_KEY || "" },
      body: JSON.stringify({ platform: cfg.platform, leagueId: r.league.leagueId, season: r.league.season, week: r.week, video: urlOf(vName), poster: urlOf(pName),
        standings: r.standings, countedHere: r.counted, createdAt: new Date().toISOString() }) });
    log(`${r.tag}: published week ${r.week} → ${urlOf(vName)}`);
  } catch (e) { failures++; console.error(`[recap] ${cfg.platform}-${cfg.leagueId} failed:`, e.message); }
}
process.exit(failures ? 1 : 0);
