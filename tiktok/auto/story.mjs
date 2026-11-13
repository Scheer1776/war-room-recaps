// auto/story.mjs — turn slate.json into a SundayRecap story: scenes + one spoken line per scene.
// Usage: node auto/story.mjs <dir> [--force]   (reads <dir>/slate.json, writes <dir>/story.json + <dir>/script.txt)
// Every number spoken or shown comes straight from slate.json (no invented stats). Rough v1: templates, no AI.
import { readFileSync, writeFileSync } from "node:fs";

const dir = process.argv[2];
const force = process.argv.includes("--force");
const d = JSON.parse(readFileSync(`${dir}/slate.json`, "utf8"));
const src = dir.replace(/^.*public\//, ""); // Remotion staticFile() path relative to public/
const LABEL = { thu: "THURSDAY NIGHT", sun: "SUNDAY RECAP", mon: "MONDAY NIGHT", all: "WEEK RECAP" }[d.slate];
const WHEN = { thu: "Thursday night", sun: "Sunday", mon: "Monday night", all: "This week" }[d.slate];

const notFinal = d.games.filter(g => !g.final);
if (notFinal.length && !force) { console.error(`not final yet: ${notFinal.map(g => `${g.away.t}@${g.home.t} ${g.detail}`).join(", ")}`); process.exit(3); }

const pl = r => ({ id: r.id, n: r.n, pos: r.pos, team: r.team, pts: r.pts, proj: r.proj, line: r.line });
const num = x => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const tdWords = n => (n === 1 ? "a touchdown" : `${n} touchdowns`);
function spoken(r) {
  const s = r.s, out = [];
  if (r.pos === "QB") {
    if (s.pass_yd) out.push(`${s.pass_yd} passing yards`);
    if (s.pass_td) out.push(tdWords(s.pass_td));
    if (s.rush_yd >= 25) out.push(`${s.rush_yd} on the ground`);
    if (s.rush_td) out.push(`${s.rush_td === 1 ? "a rushing touchdown" : s.rush_td + " rushing touchdowns"}`);
  } else {
    if (s.rush_yd >= 20) out.push(`${s.rush_yd} rushing yards`);
    if (s.rec_yd >= 25) out.push(`${plural(s.rec, "catch").replace("catchs", "catches")} for ${s.rec_yd}`);
    const td = s.rush_td + s.rec_td;
    if (td) out.push(tdWords(td));
  }
  if (!out.length) return "";
  return out.length === 1 ? out[0] : out.slice(0, -1).join(", ") + " and " + out.at(-1);
}

const scenes = [];
// 1) the result (single game) or the slate's scoreboard (several games)
if (d.games.length === 1) {
  const g = d.games[0], aw = g.away.s > g.home.s, W = aw ? g.away : g.home, L = aw ? g.home : g.away, m = W.s - L.s;
  const tie = g.away.s === g.home.s;
  const verb = tie ? "TIE." : g.ot ? "IN OT." : m >= 17 ? "ROLL." : m >= 8 ? "WIN." : "SURVIVE.";
  scenes.push({ id: "result", kind: "stats", title: tie ? `${g.away.name.toUpperCase()}-${g.home.name.toUpperCase()} END IN A TIE.` : `${W.name.toUpperCase()} ${verb}`,
    stamp: "FINAL", color: "gold",
    tiles: [{ v: g.away.s, label: g.away.t }, { v: g.home.s, label: g.home.t }],
    line: tie ? `${WHEN}. ${g.away.name} and ${g.home.name} tie at ${g.away.s}. Here's what it did to your fantasy team.`
      : `${WHEN}. The ${W.name} ${m >= 17 ? "ran over" : "beat"} the ${L.name}, ${W.s} to ${L.s}${g.ot ? " in overtime" : ""}. Here's what it did to your fantasy team.` });
} else {
  scenes.push({ id: "result", kind: "scores", title: `${LABEL} SCORES`, line: `${WHEN} is in the books. Here's who won your fantasy week.` });
}
// 2) top scorer
const t0 = d.top[0];
if (t0) scenes.push({ id: "top", kind: "boom", title: t0.pts >= 25 ? "WENT NUCLEAR." : t0.pts >= 18 ? "SHOWED UP." : "LED THE WAY.", stamp: `${num(t0.pts)} PTS`, color: "gold",
  player: pl(t0), line: `${t0.n} led everyone with ${num(t0.pts)} points.${spoken(t0) ? " " + spoken(t0)[0].toUpperCase() + spoken(t0).slice(1) + "." : ""}` });
// 3) the surprise (beat projection most), else the second-best scorer
const b0 = d.beat.find(r => r.id !== t0?.id && r.diff >= 5);
const t1 = b0 || d.top.find(r => r.id !== t0?.id);
if (t1) scenes.push(b0
  ? { id: "beat", kind: "boom", title: "NOBODY SAW THIS.", stamp: `+${num(b0.diff)}`, color: "turf", player: pl(b0),
      line: `Nobody saw ${b0.n} coming. Projected for ${num(b0.proj)}, he put up ${num(b0.pts)}.` }
  : { id: "second", kind: "boom", title: "RIGHT BEHIND HIM.", stamp: `${num(t1.pts)} PTS`, color: "turf", player: pl(t1),
      line: `${t1.n} added ${num(t1.pts)}.${spoken(t1) ? " " + spoken(t1)[0].toUpperCase() + spoken(t1).slice(1) + "." : ""}` });
// 4) the bust
const x0 = d.bust.find(r => r.diff <= -5 && r.id !== t0?.id && r.id !== t1?.id);
if (x0) scenes.push({ id: "bust", kind: "bust", title: "WHO STARTED HIM?", stamp: "OUCH.", color: "red", big: num(x0.pts), players: [pl(x0)],
  line: `And if you started ${x0.n}... sorry. ${num(x0.pts)} points, on a ${num(x0.proj)} point projection.` });
// 5) call to action (QR + link card; held >= 4 s so the code can be scanned)
scenes.push({ id: "cta", kind: "cta", title: "SUNDAY'S|COMING.", minDur: 4.2,
  line: `Need help with Sunday's lineup? Get free start-sit picks on War Room. Link in bio.` });

const story = { source: src, week: d.week, label: LABEL, slate: d.slate,
  scores: d.games.map(g => ({ away: { t: g.away.t, s: g.away.s }, home: { t: g.home.t, s: g.home.s }, ot: g.ot })), scenes };
writeFileSync(`${dir}/story.json`, JSON.stringify(story, null, 1));
writeFileSync(`${dir}/script.txt`, scenes.map(s => s.line).join("\n") + "\n");
console.log(scenes.map(s => `[${s.id}] ${s.line}`).join("\n"));
