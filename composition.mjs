// Builds the HyperFrames composition (one HTML file) for a week's recap.
// Every element is placed statically with data-start/data-duration and animated by a
// single paused GSAP timeline, so HyperFrames can seek any frame deterministically.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const f1 = v => (Math.round((v || 0) * 10) / 10).toFixed(1);

export const COLORS = { bg1: "#0B2416", bg2: "#050F09", ink: "#F3F7F4", dim: "rgba(243,247,244,.62)", turf: "#55B87C", pylon: "#FF7A2E", gold: "#FFD21F", red: "#FF5A4F", slate: "#7FB0D8" };

// img(key) returns a local asset path (or null) for "head:<playerId>" and "logo:<NFL abbr>".
export function buildComposition(R, img = () => null) {
  const C = COLORS;
  const scenes = [];
  // Scenes with a header get their content centered in the space below it.
  const add = (id, dur, html, anim) => scenes.push({ id, dur, anim,
    html: html.includes("<!--/hdr-->") ? html.replace("<!--/hdr-->", '<div class="body">') + "</div>" : html });
  const face = (p, size, ring) => {
    const src = p && img("head:" + p.id);
    const logo = p && img("logo:" + p.nfl);
    const initials = esc(String(p ? p.n : "").split(" ").map(x => x[0]).join("").slice(0, 3));
    return `<div class="face" style="width:${size}px;height:${size}px;border-color:${ring}">
      ${src ? `<img src="${esc(src)}" alt="">` : `<span class="init" style="font-size:${size * 0.34}px">${initials}</span>`}
      ${logo ? `<img class="badge" src="${esc(logo)}" alt="">` : ""}</div>`;
  };
  const hdr = (sid, label, color) => `
    <div class="hdr"><div class="kick">${esc(R.league.toUpperCase())} · WEEK ${R.week}</div>
    <div class="h1" style="color:${color}">${esc(label)}</div><div class="rule" id="${sid}-rule" style="background:${color}"></div></div><!--/hdr-->`;
  const hdrAnim = sid => `tl.from("#${sid} .hdr", { y: -60, opacity: 0, duration: .45, ease: "power3.out" }, S);
    tl.from("#${sid}-rule", { scaleX: 0, duration: .5, ease: "power2.out" }, S + .2);`;

  // 1. Intro
  add("intro", 3.8, `
    <div class="center col">
      <div class="kick big" id="i-league">${esc(R.league.toUpperCase())}</div>
      <div class="mega" id="i-week">WEEK ${R.week}</div>
      <div class="mega" id="i-recap" style="color:${C.pylon}">RECAP</div>
      <div class="bar" id="i-bar"></div>
      <div class="tag" id="i-tag">WAR ROOM · HD</div>
    </div>`, `
    tl.from("#i-league", { y: 40, opacity: 0, duration: .5, ease: "power3.out" }, S + .15);
    tl.from("#i-week", { scale: 2.4, opacity: 0, duration: .55, ease: "expo.out" }, S + .3);
    tl.from("#i-recap", { x: 700, opacity: 0, duration: .55, ease: "expo.out" }, S + .6);
    tl.from("#i-bar", { scaleX: 0, duration: .6, ease: "power2.out" }, S + .9);
    tl.from("#i-tag", { opacity: 0, y: 20, duration: .4 }, S + 1.3);
    tl.to("#i-week", { scale: 1.06, duration: 2, ease: "sine.inOut" }, S + .9);`);

  // 2. Final scores
  const rows = R.games.map((g, i) => `
    <div class="row" id="sc-${i}">
      <div class="rt"><div class="tn ${g.win.id === R.myTeamId ? "me" : ""}">${esc(g.win.name)}</div><div class="ts win">${f1(g.win.pts)}</div></div>
      <div class="rt lose"><div class="tn ${g.lose.id === R.myTeamId ? "me" : ""}">${esc(g.lose.name)}</div><div class="ts">${f1(g.lose.pts)}</div></div>
    </div>`).join("");
  add("scores", Math.min(8.5, 3.2 + R.games.length * 0.65), `${hdr("scores", "FINAL SCORES", C.turf)}<div class="rows" style="--n:${R.games.length}">${rows}</div>`,
    `${hdrAnim("scores")}
    ${R.games.map((_, i) => `tl.from("#sc-${i}", { x: ${i % 2 ? 900 : -900}, opacity: 0, duration: .5, ease: "power3.out" }, S + .5 + ${i * 0.22});`).join("\n")}`);

  // 3. High & low
  const topOf = t => (t.starters || []).filter(r => !r.empty).sort((a, b) => (b.act || 0) - (a.act || 0))[0];
  const hiTop = topOf(R.high);
  add("highlow", 5, `${hdr("highlow", "HIGH & LOW", C.gold)}
    <div class="card gold" id="hl-hi"><div class="lbl" style="color:${C.gold}">TOP SCORE</div>
      <div class="split">${face(hiTop, 200, C.gold)}<div><div class="num xl">${f1(R.high.pts)}</div><div class="tn big" style="color:${C.gold}">${esc(R.high.name)}</div>
      ${hiTop ? `<div class="sub">led by ${esc(hiTop.n)} · ${f1(hiTop.act)}</div>` : ""}</div></div></div>
    <div class="card red" id="hl-lo"><div class="lbl" style="color:${C.red}">BASEMENT</div>
      <div class="num l">${f1(R.low.pts)}</div><div class="tn big" style="color:${C.red}">${esc(R.low.name)}</div></div>`,
    `${hdrAnim("highlow")}
    tl.from("#hl-hi", { x: -1000, duration: .6, ease: "expo.out" }, S + .4);
    tl.from("#hl-hi .face", { scale: 0, rotation: -20, duration: .6, ease: "back.out(1.8)" }, S + .8);
    tl.from("#hl-lo", { x: 1000, duration: .6, ease: "expo.out" }, S + 1.7);`);

  // 4/5. Nail-biter + blowout
  const duel = (id, title, color, g) => add(id, 4.6, `${hdr(id, title, color)}
    <div class="duel"><div id="${id}-a"><div class="tn huge">${esc(g.win.name)}</div><div class="num xl" style="color:${C.turf}">${f1(g.win.pts)}</div></div>
    <div class="vs" id="${id}-vs">VS</div>
    <div id="${id}-b" class="lose"><div class="tn huge">${esc(g.lose.name)}</div><div class="num l">${f1(g.lose.pts)}</div></div>
    <div class="pillbig" id="${id}-p" style="background:${color}">WON BY ${f1(g.margin)}</div></div>`,
    `${hdrAnim(id)}
    tl.from("#${id}-a", { y: 200, opacity: 0, duration: .5, ease: "power3.out" }, S + .35);
    tl.from("#${id}-vs", { scale: 3, opacity: 0, duration: .4, ease: "expo.out" }, S + .8);
    tl.from("#${id}-b", { y: 200, opacity: 0, duration: .5, ease: "power3.out" }, S + 1.1);
    tl.from("#${id}-p", { scale: 0, duration: .5, ease: "back.out(2)" }, S + 1.8);`);
  duel("close", "NAIL-BITER", C.slate, R.close);
  if (R.blow !== R.close) duel("blow", "BLOWOUT", C.pylon, R.blow);

  // 6. MVP
  if (R.mvp) add("mvp", 5, `${hdr("mvp", "WEEK MVP", C.gold)}
    <div class="center col mvp">${face(R.mvp.r, 520, C.gold)}
      <div class="num xxl" id="mvp-n">${f1(R.mvp.r.act)}</div><div class="lbl" style="color:${C.gold}">POINTS</div>
      <div class="tn huge" id="mvp-name">${esc(R.mvp.r.n)}</div>
      <div class="sub" id="mvp-sub">${esc(R.mvp.r.pos)} · ${esc(R.mvp.r.nfl)} · started by ${esc(R.mvp.team.name)}</div></div>`,
    `${hdrAnim("mvp")}
    tl.from("#mvp .face", { scale: 0, rotation: 180, duration: .8, ease: "back.out(1.4)" }, S + .3);
    tl.from("#mvp-n", { scale: 3, opacity: 0, duration: .5, ease: "expo.out" }, S + 1);
    tl.from("#mvp-name", { y: 80, opacity: 0, duration: .5, ease: "power3.out" }, S + 1.4);
    tl.from("#mvp-sub", { opacity: 0, duration: .4 }, S + 1.8);
    tl.to("#mvp .face", { scale: 1.05, duration: 2.5, ease: "sine.inOut" }, S + 1.2);`);

  // 7. Bench blunder
  const bt = R.blunder && R.blunder.benchTop;
  if (R.blunder && R.blunder.left >= 1) add("bench", 5, `${hdr("bench", "BENCH BLUNDER", C.red)}
    <div class="center col"><div class="tn huge" id="bb-team">${esc(R.blunder.name)}</div>
      <div class="lbl" style="color:${C.dim}">LEFT</div><div class="num xxl" id="bb-n" style="color:${C.red}">${f1(R.blunder.left)}</div>
      <div class="lbl" style="color:${C.dim}">POINTS ON THE BENCH</div>
      ${bt && bt.act > 0 ? `<div class="card red benchcard" id="bb-p"><div class="split">${face(bt, 170, C.red)}<div><div class="sub">${esc(bt.n)} sat with</div><div class="num l" style="color:${C.red}">${f1(bt.act)} pts</div></div></div></div>` : ""}</div>`,
    `${hdrAnim("bench")}
    tl.from("#bb-team", { y: 60, opacity: 0, duration: .45 }, S + .35);
    tl.from("#bb-n", { scale: 0, rotation: -12, duration: .6, ease: "back.out(2)" }, S + .8);
    ${bt && bt.act > 0 ? `tl.from("#bb-p", { y: 300, opacity: 0, duration: .55, ease: "power3.out" }, S + 1.8);` : ""}`);

  // 8. Standings + playoff odds
  const hasOdds = R.standings.some(t => t.odds != null);
  const st = R.standings.map((t, i) => `
    <div class="srow ${t.mine ? "me" : ""}" id="st-${i}"><div class="rk" style="color:${i === 0 ? C.gold : C.dim}">${i + 1}</div>
      <div class="sn">${esc(t.name)}</div><div class="rec">${esc(t.rec)}</div>
      ${hasOdds ? `<div class="odds"><div class="ob"><div class="of" id="of-${i}" style="width:${Math.max(2, Math.round(t.odds || 0))}%;background:${(t.odds || 0) >= 50 ? C.gold : C.slate}"></div></div><div class="op">${Math.round(t.odds || 0)}%</div></div>` : ""}</div>`).join("");
  add("stand", 6, `${hdr("stand", "STANDINGS", C.turf)}${hasOdds ? `<div class="colhdr">RECORD · PLAYOFF ODDS</div>` : ""}<div class="srows">${st}</div>`,
    `${hdrAnim("stand")}
    ${R.standings.map((_, i) => `tl.from("#st-${i}", { x: -1000, duration: .45, ease: "power3.out" }, S + .4 + ${i * 0.16});`).join("\n")}
    ${hasOdds ? R.standings.map((_, i) => `tl.from("#of-${i}", { width: "0%", duration: .8, ease: "power2.out" }, S + 1.6 + ${i * 0.1});`).join("\n") : ""}`);

  // 9. Next week
  if (R.next) {
    const wa = Math.round(R.next.wa * 100);
    add("next", 5, `${hdr("next", `WEEK ${R.next.week} PREVIEW`, C.slate)}
      <div class="lbl center-t" style="color:${C.dim}">GAME OF THE WEEK</div>
      <div class="duel"><div id="nx-a"><div class="tn huge">${esc(R.next.a)}</div><div class="sub">proj ${f1(R.next.pa)}</div></div>
      <div class="vs" id="nx-vs">VS</div>
      <div id="nx-b"><div class="tn huge">${esc(R.next.b)}</div><div class="sub">proj ${f1(R.next.pb)}</div></div>
      <div class="wpbar"><div class="wpf" id="nx-f" style="width:${wa}%"></div></div>
      <div class="wpl"><span style="color:${C.slate}">${wa}%</span><span>${100 - wa}%</span></div></div>`,
      `${hdrAnim("next")}
      tl.from("#nx-a", { x: -900, duration: .5, ease: "expo.out" }, S + .4);
      tl.from("#nx-vs", { scale: 3, opacity: 0, duration: .4 }, S + .8);
      tl.from("#nx-b", { x: 900, duration: .5, ease: "expo.out" }, S + 1);
      tl.from("#nx-f", { width: "0%", duration: 1.2, ease: "power2.inOut" }, S + 1.6);`);
  }

  // 10. Outro
  add("outro", 3, `<div class="center col"><div class="mega" id="o-1">SEE YOU</div><div class="mega" id="o-2" style="color:${C.pylon}">NEXT WEEK</div><div class="tag" id="o-3">MADE WITH WAR ROOM</div></div>`,
    `tl.from("#o-1", { y: -200, opacity: 0, duration: .5, ease: "expo.out" }, S + .2);
    tl.from("#o-2", { y: 200, opacity: 0, duration: .5, ease: "expo.out" }, S + .4);
    tl.from("#o-3", { opacity: 0, duration: .5 }, S + .9);`);

  // Timeline: scenes back to back; a colored wipe covers each cut.
  let t = 0;
  const wipeColors = [C.pylon, C.turf, C.slate, C.gold, C.red];
  const parts = [], anims = [], wipes = [];
  scenes.forEach((s, i) => {
    s.start = t;
    parts.push(`<section id="${s.id}" class="clip scene" data-start="${t.toFixed(2)}" data-duration="${s.dur.toFixed(2)}" data-track-index="1">${s.html}</section>`);
    anims.push(`{ const S = ${t.toFixed(2)}; ${s.anim} }`);
    if (i > 0) {
      const wc = wipeColors[i % wipeColors.length], ws = Math.max(0, t - 0.32);
      wipes.push(`<div id="wipe-${i}" class="clip wipe" data-start="${ws.toFixed(2)}" data-duration="0.7" data-track-index="2" style="background:${wc}"></div>`);
      anims.push(`tl.fromTo("#wipe-${i}", { x: -1400 }, { x: 1400, duration: .64, ease: "power2.inOut" }, ${ws.toFixed(2)});`);
    }
    t += s.dur;
  });
  const total = Math.round(t * 100) / 100;

  const html = `<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">
<script src="gsap.min.js"></script>
<style>
@font-face { font-family: "Saira Condensed"; font-weight: 800; src: url("fonts/SairaCondensed-ExtraBold.ttf"); }
@font-face { font-family: "Saira Condensed"; font-weight: 600; src: url("fonts/SairaCondensed-SemiBold.ttf"); }
@font-face { font-family: "Barlow"; font-weight: 600; src: url("fonts/Barlow-SemiBold.ttf"); }
:root { --ink: ${C.ink}; --dim: ${C.dim}; --turf: ${C.turf}; --gold: ${C.gold}; --red: ${C.red}; --pylon: ${C.pylon}; --slate: ${C.slate}; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: ${C.bg2}; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; color: var(--ink); font-family: "Saira Condensed", "Arial Narrow", sans-serif; font-weight: 800;
  background: radial-gradient(120% 70% at 50% 0%, #144a2b 0%, ${C.bg1} 45%, ${C.bg2} 100%); }
.field { position: absolute; inset: -400px 0 0 0; background-image: repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 4px, transparent 4px 160px); }
.glow { position: absolute; width: 1400px; height: 1400px; left: -160px; top: 300px; border-radius: 50%; background: radial-gradient(circle, rgba(255,122,46,.18), transparent 60%); }
.scene { position: absolute; inset: 0; padding: 150px 70px 140px; display: flex; flex-direction: column; }
.body { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; }
.wipe { position: absolute; top: -200px; width: 1400px; height: 2400px; transform: skewX(-12deg); z-index: 50; }
.hdr { text-align: center; margin-bottom: 30px; flex: none; }
.kick { font-family: "Barlow", sans-serif; font-weight: 600; font-size: 34px; letter-spacing: 6px; color: var(--dim); }
.kick.big { font-size: 52px; }
.h1 { font-size: 118px; line-height: 1; margin-top: 10px; }
.rule { width: 160px; height: 12px; border-radius: 6px; margin: 20px auto 0; }
.center { display: flex; align-items: center; justify-content: center; flex: 1; }
.col { flex-direction: column; text-align: center; }
.center-t { text-align: center; }
.mega { font-size: 250px; line-height: .95; }
.bar { width: 620px; height: 16px; border-radius: 8px; background: var(--turf); margin-top: 40px; }
.tag { font-size: 48px; letter-spacing: 12px; color: var(--turf); margin-top: 60px; }
.rows { display: flex; flex-direction: column; gap: 14px; }
.row { background: rgba(255,255,255,.07); border-radius: 24px; padding: 14px 32px; }
.rt { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; }
.tn { font-size: 50px; line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tn.me { color: var(--gold); }
.ts { font-size: 50px; line-height: 1.05; }
.ts.win { color: var(--turf); font-size: 60px; }
.lose .tn, .lose .ts, .lose .num { color: var(--dim); }
.lose .tn { font-size: 40px; font-weight: 600; }
.card { border-radius: 34px; padding: 40px; margin-bottom: 40px; }
.card.gold { background: rgba(255,210,31,.12); } .card.red { background: rgba(255,90,79,.12); }
.lbl { font-family: "Barlow", sans-serif; font-weight: 600; font-size: 44px; letter-spacing: 8px; }
.split { display: flex; align-items: center; gap: 40px; }
.num { line-height: 1; } .num.xl { font-size: 190px; } .num.l { font-size: 150px; } .num.xxl { font-size: 260px; }
.tn.big { font-size: 72px; white-space: normal; } .tn.huge { font-size: 100px; white-space: normal; }
.sub { font-family: "Barlow", sans-serif; font-weight: 600; font-size: 42px; color: var(--dim); margin-top: 10px; }
.duel { text-align: center; display: flex; flex-direction: column; gap: 26px; align-items: center; margin-top: 40px; }
.vs { font-size: 80px; color: var(--dim); }
.pillbig { margin-top: 40px; color: #0B160F; font-size: 84px; padding: 22px 70px; border-radius: 80px; }
.face { position: relative; border-radius: 50%; border: 12px solid; background: #133824; display: grid; place-items: center; flex: none; }
.face > img:first-child { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; object-position: top; }
.face .badge { position: absolute; right: -6%; bottom: -6%; width: 34%; height: 34%; background: #fff; border-radius: 50%; padding: 4%; object-fit: contain; }
.init { color: var(--ink); }
.mvp .face { margin-bottom: 30px; }
.benchcard { margin-top: 60px; }
.colhdr { font-family: "Barlow", sans-serif; font-weight: 600; text-align: right; font-size: 30px; letter-spacing: 4px; color: var(--dim); margin: -20px 10px 20px; }
.srows { display: flex; flex-direction: column; gap: 18px; }
.srow { display: grid; grid-template-columns: 70px 1fr 160px 300px; align-items: center; gap: 16px; background: rgba(255,255,255,.07); border-radius: 26px; padding: 22px 28px; }
.srow.me { background: rgba(255,210,31,.16); } .srow.me .sn { color: var(--gold); }
.rk { font-size: 70px; } .sn { font-size: 54px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .rec { font-size: 58px; color: var(--turf); text-align: right; }
.odds { display: flex; align-items: center; gap: 14px; } .ob { flex: 1; height: 26px; border-radius: 13px; background: rgba(255,255,255,.12); overflow: hidden; } .of { height: 100%; border-radius: 13px; } .op { font-size: 50px; width: 110px; text-align: right; }
.wpbar { width: 900px; height: 70px; border-radius: 35px; background: rgba(255,255,255,.12); overflow: hidden; margin-top: 60px; } .wpf { height: 100%; background: var(--slate); border-radius: 35px; }
.wpl { width: 900px; display: flex; justify-content: space-between; font-size: 70px; color: var(--dim); }
</style>
</head>
<body>
<div id="root" data-composition-id="recap" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
  <div class="clip field" id="field" data-start="0" data-duration="${total}" data-track-index="0"></div>
  <div class="clip glow" id="glow" data-start="0" data-duration="${total}" data-track-index="0"></div>
  ${parts.join("\n  ")}
  ${wipes.join("\n  ")}
  <audio id="beat" class="clip" src="beat.wav" data-start="0" data-duration="${total}" data-volume="0.8" data-fade-out="1.5" data-track-index="3"></audio>
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.to("#field", { y: 320, duration: ${total}, ease: "none" }, 0);
  tl.to("#glow", { x: 300, y: -500, duration: ${total}, ease: "sine.inOut" }, 0);
  ${anims.join("\n  ")}
  window.__timelines["recap"] = tl;
</script>
</body>
</html>`;
  return { html, total };
}
