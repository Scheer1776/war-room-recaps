// Gate for the weekly league recaps: runs every 5 minutes from 8:40 pm PT on Monday and answers two questions for the
// workflow: is this NFL week over (every game final), and has it already been rendered? Prints GitHub Actions outputs.
// Env: ADMIN_KEY, WARROOM_URL, GITHUB_REPOSITORY, GITHUB_TOKEN, MAX_JOBS (default 20), PER_JOB (default 3), FORCE=1
import { appendFileSync } from "node:fs";

const APP = (process.env.WARROOM_URL || "https://war-room-self-one.vercel.app").replace(/\/$/, "");
const REPO = process.env.GITHUB_REPOSITORY || "";
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";
const out = (k, v) => { console.log(`[gate] ${k}=${v}`); if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };

// 1. Is the NFL week over? ESPN's public scoreboard lists the current week's games with their status.
const sb = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", { headers: { "User-Agent": "war-room-recaps" } }).then(r => r.json());
const week = Number(sb.week && sb.week.number) || 0, season = Number(sb.season && sb.season.year) || new Date().getFullYear();
const events = sb.events || [];
const states = events.map(e => ({ name: e.shortName, st: e.status && e.status.type && e.status.type.state, done: !!(e.status && e.status.type && e.status.type.completed) }));
const left = states.filter(s => !s.done);
console.log(`[gate] ${season} week ${week}: ${events.length} games, ${left.length} not final${left.length ? " (" + left.map(s => s.name + ":" + s.st).join(", ") + ")" : ""}.`);
out("week", week); out("season", season);

// 2. Already rendered? The finish job drops a marker on the media branch once every league is published.
async function marker() {
  if (!REPO) return false;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/recaps/weekly/${season}-w${week}.done?ref=media`,
    { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN || ""}`, "User-Agent": "war-room-recaps", Accept: "application/vnd.github+json" } });
  return r.status === 200;
}
const done = await marker();
if (done && !FORCE) { console.log("[gate] this week is already rendered."); out("go", "false"); process.exit(0); }
if (left.length && !FORCE) { console.log("[gate] games still going. Next poll will check again."); out("go", "false"); process.exit(0); }

// 3. How many leagues are on the list → how many parallel jobs (each renders a few leagues, ~2 min apiece on a runner).
const list = await fetch(`${APP}/api/recaps`, { headers: { "x-admin-key": process.env.ADMIN_KEY || "" } }).then(r => r.ok ? r.json() : []);
const n = list.length, per = Math.max(1, Number(process.env.PER_JOB || 3)), max = Math.max(1, Number(process.env.MAX_JOBS || 20));
const jobs = Math.min(max, Math.max(1, Math.ceil(n / per)));
console.log(`[gate] ${n} leagues registered → ${jobs} render jobs.`);
out("go", n ? "true" : "false"); out("jobs", jobs); out("chunks", JSON.stringify([...Array(jobs).keys()]));
