// War Room promo video: a 9:16 feature tour built from real app screens.
// Usage: node promo/build.mjs <shotsDir> <qr.svg> <fontsDir>  → writes build/promo/ (HyperFrames project)
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeBeat } from "../beat.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "..");
const [shots, qr, fonts] = process.argv.slice(2);
const OUT = join(ROOT, "build", "promo");
mkdirSync(join(OUT, "img"), { recursive: true }); mkdirSync(join(OUT, "fonts"), { recursive: true });
copyFileSync(join(ROOT, "node_modules/gsap/dist/gsap.min.js"), join(OUT, "gsap.min.js"));
for (const f of ["Barlow-Regular", "Barlow-SemiBold", "Barlow-Bold", "SairaCondensed-SemiBold", "SairaCondensed-ExtraBold"]) copyFileSync(join(fonts, f + ".ttf"), join(OUT, "fonts", f + ".ttf"));
for (const f of ["connect", "home", "matchup", "lineup-set", "lineup-opt", "startsit", "trades", "points", "player", "report", "recap-scores", "recap-stand"]) copyFileSync(join(shots, f + ".png"), join(OUT, "img", f + ".png"));
copyFileSync(qr, join(OUT, "img", "qr.svg"));

const BEAT = 60 / 112;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// Headline: each line slams in word by word.
const head = (id, lines, sub) => `<div class="head" id="${id}-head">${lines.map(l => `<div class="hl">${l.split(" ").map(w => `<span class="w">${esc(w)}</span>`).join(" ")}</div>`).join("")}${sub ? `<div class="sub" id="${id}-sub">${esc(sub)}</div>` : ""}</div>`;
const phone = (id, img, extra = "") => `<div class="phone" id="${id}-phone"><div class="screen"><img src="img/${img}.png" alt="">${extra}</div><div class="glare"></div></div>`;
const call = (id, i, side, top, icon, text, cls = "") => `<div class="call ${side} ${cls}" id="${id}-c${i}" style="top:${top}px"><span class="ic">${icon}</span><span>${text}</span></div>`;

const S = []; // { id, beats, html, anim(t0) }
S.push({ id: "hook", beats: 7, html: `
  <div class="slam" id="hook-a">STOP<br>GUESSING.</div>
  <div class="slam gold" id="hook-b">START<br>WINNING.</div>
  <div class="logo" id="hook-logo"><div class="wm">WAR<br>ROOM</div><div class="tag">The free fantasy football command center</div></div>`,
  anim: t => [
    `tl.fromTo("#hook-a", { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: .32, ease: "power4.in" }, ${t});`,
    `tl.to("#root", { x: 14, duration: .05, yoyo: true, repeat: 5, ease: "none" }, ${t + .32});`,
    `tl.to("#hook-a", { opacity: 0, y: -120, duration: .25 }, ${t + 1.15});`,
    `tl.fromTo("#hook-b", { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: .32, ease: "power4.in" }, ${t + 1.3});`,
    `tl.to("#root", { x: -14, duration: .05, yoyo: true, repeat: 5, ease: "none" }, ${t + 1.62});`,
    `tl.to("#hook-b", { opacity: 0, y: -120, duration: .25 }, ${t + 2.4});`,
    `tl.fromTo("#hook-logo", { scale: .6, opacity: 0, filter: "blur(18px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: .6, ease: "expo.out" }, ${t + 2.55});`,
    `tl.to("#hook-logo .wm", { scale: 1.06, duration: 1.2, ease: "sine.inOut" }, ${t + 3.1});`] });

const scene = (id, beats, lines, sub, img, calls, extraHtml = "", extraAnim = () => []) => S.push({ id, beats,
  html: head(id, lines, sub) + phone(id, img, extraHtml) + calls.map((c, i) => call(id, i, ...c)).join(""),
  anim: t => [
    `tl.from("#${id}-head .w", { y: 90, opacity: 0, duration: .45, stagger: .055, ease: "power3.out" }, ${t + .05});`,
    lines && sub ? `tl.from("#${id}-sub", { opacity: 0, y: 20, duration: .4 }, ${t + .45});` : "",
    `tl.from("#${id}-phone", { y: 900, rotation: 7, duration: .85, ease: "expo.out" }, ${t + .2});`,
    `tl.to("#${id}-phone", { y: -24, duration: ${(beats * BEAT - 1.1).toFixed(2)}, ease: "sine.inOut" }, ${t + 1.05});`,
    ...calls.map((c, i) => `tl.from("#${id}-c${i}", { scale: .4, opacity: 0, x: ${c[0] === "l" ? -80 : 80}, duration: .5, ease: "back.out(1.8)" }, ${(t + 1.0 + i * .5).toFixed(2)});`),
    ...extraAnim(t)] });

scene("connect", 7, ["CONNECT IN", "10 SECONDS"], "ESPN or Sleeper. No password needed.", "connect",
  [["r", 700, "⚡", "One tap from your phone"], ["l", 1150, "🆓", "Free. For your whole league."]]);
scene("matchup", 9, ["EVERY MATCHUP.", "LIVE."], "Real scores, real-time win odds, any week, any team.", "matchup",
  [["l", 520, "📡", "Live scores & projections"], ["r", 820, "🎯", "Win odds move every play"], ["l", 1150, "👆", "Tap any player for stats"]]);
scene("optimal", 10, ["ONE TAP.", "BEST LINEUP."], "Shows exactly who to start and who to sit.", "lineup-set",
  [["r", 700, "🪑", "<b>+24 pts</b> sitting on your bench"], ["l", 1050, "✅", "Swaps highlighted for you"]],
  `<img class="swapimg" id="optimal-after" src="img/lineup-opt.png" alt=""><div class="ripple" id="optimal-ripple"></div>`,
  t => [`tl.fromTo("#optimal-ripple", { scale: .2, opacity: .9 }, { scale: 3, opacity: 0, duration: .6, ease: "power2.out" }, ${t + 1.7});`,
        `tl.fromTo("#optimal-after", { opacity: 0 }, { opacity: 1, duration: .35 }, ${t + 1.85});`]);
scene("startsit", 8, ["YOUR GUYS VS.", "THE WAIVER WIRE"], "Every projection, side by side, every week.", "startsit",
  [["r", 560, "⬆️", "Free-agent upgrades flagged"], ["l", 980, "📈", "Snap share & target trends"]]);
scene("trades", 9, ["TRADES THAT", "ACTUALLY WORK"], "Win-win deals for both teams. Injuries priced in.", "trades",
  [["l", 600, "🤝", "Finds deals they'll accept"], ["r", 950, "🩹", "Skips hurt players"], ["l", 1280, "📊", "Value 0–100, updated daily"]]);
scene("points", 8, ["CHASING THE", "POINTS TITLE?"], "Your odds to lead the league in points, every week.", "points",
  [["r", 620, "🏆", "Points-for race & odds"], ["l", 1060, "🎲", "10,000 simulated seasons"]]);
scene("player", 7, ["EVERY PLAYER.", "EVERY STAT."], "Game logs, matchups, injuries and what's next.", "player",
  [["l", 640, "🗓️", "Next 8 matchups ranked"], ["r", 1100, "📋", "Week-by-week game log"]]);

S.push({ id: "recap", beats: 7, html: head("recap", ["YOUR WEEKLY", "RECAP VIDEO"], "Auto-made after Monday Night Football. Drop it in the group chat.")
  + `<div class="cards"><div class="vcard" id="recap-v1"><img src="img/recap-scores.png" alt=""></div><div class="vcard" id="recap-v2"><img src="img/recap-stand.png" alt=""></div><div class="play" id="recap-play">▶</div></div>`,
  anim: t => [`tl.from("#recap-head .w", { y: 90, opacity: 0, duration: .45, stagger: .055, ease: "power3.out" }, ${t + .05});`,
    `tl.from("#recap-sub", { opacity: 0, y: 20, duration: .4 }, ${t + .45});`,
    `tl.from("#recap-v1", { x: -700, rotation: -18, duration: .8, ease: "expo.out" }, ${t + .25});`,
    `tl.from("#recap-v2", { x: 700, rotation: 18, duration: .8, ease: "expo.out" }, ${t + .4});`,
    `tl.from("#recap-play", { scale: 0, duration: .5, ease: "back.out(2)" }, ${t + 1.1});`,
    `tl.to("#recap-play", { scale: 1.12, duration: .27, yoyo: true, repeat: 5, ease: "sine.inOut" }, ${t + 1.7});`] });

S.push({ id: "brains", beats: 9, html: head("brains", ["THREE SOURCES.", "GRADED WEEKLY."], "ESPN + Sleeper + Vegas, weighted by who's actually been right.")
  + `<div class="chips"><div class="chip" id="brains-a">ESPN</div><div class="chip" id="brains-b">Sleeper</div><div class="chip gold" id="brains-c">Vegas</div></div>
     <div class="merge" id="brains-m">War Room projection</div>` + phone("brains", "report"),
  anim: t => [`tl.from("#brains-head .w", { y: 90, opacity: 0, duration: .45, stagger: .055, ease: "power3.out" }, ${t + .05});`,
    `tl.from("#brains-sub", { opacity: 0, y: 20, duration: .4 }, ${t + .45});`,
    `tl.from(["#brains-a", "#brains-b", "#brains-c"], { y: -60, opacity: 0, scale: .5, duration: .45, stagger: .18, ease: "back.out(2)" }, ${t + .5});`,
    `tl.to(["#brains-a", "#brains-c"], { x: (i) => i === 0 ? 290 : -290, opacity: 0, scale: .6, duration: .45, ease: "power2.in" }, ${t + 1.55});`,
    `tl.to("#brains-b", { opacity: 0, scale: .6, duration: .45, ease: "power2.in" }, ${t + 1.55});`,
    `tl.from("#brains-m", { scale: .3, opacity: 0, duration: .5, ease: "back.out(2.2)" }, ${t + 1.95});`,
    `tl.from("#brains-phone", { y: 1000, duration: .85, ease: "expo.out" }, ${t + 1.2});`] });

S.push({ id: "outro", beats: 10, html: `
  <div class="logo big" id="outro-logo"><div class="wm">WAR<br>ROOM</div></div>
  <div class="free" id="outro-free">100% free · ESPN &amp; Sleeper leagues</div>
  <div class="qrbox" id="outro-qr"><img src="img/qr.svg" alt=""></div>
  <div class="url" id="outro-url">war-room-self-one.vercel.app</div>
  <div class="cta" id="outro-cta">Send this to your league chat 🏈</div>`,
  anim: t => [`tl.from("#outro-logo", { scale: 1.8, opacity: 0, duration: .5, ease: "power4.in" }, ${t + .05});`,
    `tl.to("#root", { x: 12, duration: .05, yoyo: true, repeat: 5, ease: "none" }, ${t + .55});`,
    `tl.from("#outro-free", { y: 40, opacity: 0, duration: .45 }, ${t + .7});`,
    `tl.from("#outro-qr", { scale: .5, opacity: 0, rotation: -8, duration: .6, ease: "back.out(1.8)" }, ${t + .95});`,
    `tl.from("#outro-url", { y: 40, opacity: 0, duration: .45 }, ${t + 1.3});`,
    `tl.from("#outro-cta", { y: 40, opacity: 0, duration: .45 }, ${t + 1.7});`,
    `tl.to("#outro-cta", { scale: 1.06, duration: .27, yoyo: true, repeat: 7, ease: "sine.inOut" }, ${t + 2.4});`] });

// Timeline: scenes back to back; a diagonal turf-stripe wipe covers each cut.
let t = 0; const parts = [], anims = [], wipes = [];
const WC = ["#3DDB86", "#FF6B2C", "#FFC629", "#8CC4FF"];
S.forEach((s, i) => {
  const dur = s.beats * BEAT;
  parts.push(`<section id="${s.id}" class="clip scene" data-start="${t.toFixed(3)}" data-duration="${dur.toFixed(3)}" data-track-index="1">${s.html}</section>`);
  anims.push(...s.anim(t).filter(Boolean));
  if (i > 0) {
    const ws = t - 0.28;
    wipes.push(`<div id="wipe-${i}" class="clip wipe" data-start="${ws.toFixed(3)}" data-duration="0.6" data-track-index="2" style="--wc:${WC[i % WC.length]}"></div>`);
    anims.push(`tl.fromTo("#wipe-${i}", { xPercent: -160 }, { xPercent: 160, duration: .6, ease: "power2.inOut" }, ${ws.toFixed(3)});`);
  }
  t += dur;
});
const total = Math.round(t * 1000) / 1000;

const html = `<!doctype html>
<html lang="en" data-resolution="portrait"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=1080, height=1920">
<script src="gsap.min.js"></script>
<style>
@font-face { font-family: "Saira Condensed"; font-weight: 800; src: url("fonts/SairaCondensed-ExtraBold.ttf"); }
@font-face { font-family: "Saira Condensed"; font-weight: 600; src: url("fonts/SairaCondensed-SemiBold.ttf"); }
@font-face { font-family: "Barlow"; font-weight: 400; src: url("fonts/Barlow-Regular.ttf"); }
@font-face { font-family: "Barlow"; font-weight: 600; src: url("fonts/Barlow-SemiBold.ttf"); }
@font-face { font-family: "Barlow"; font-weight: 700; src: url("fonts/Barlow-Bold.ttf"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: #04110B; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; color: #EEF4EC; font-family: "Barlow", sans-serif; }
.field { position: absolute; inset: -620px 0 -40px 0; background:
  repeating-linear-gradient(0deg, transparent 0 238px, rgba(255,255,255,.07) 238px 242px),
  repeating-linear-gradient(90deg, #0A2A1B 0 135px, #0D3322 135px 270px); }
.glow { position: absolute; inset: 0; background:
  radial-gradient(900px 600px at 15% -5%, rgba(255,246,214,.22), transparent 60%),
  radial-gradient(800px 560px at 95% 0%, rgba(214,236,255,.16), transparent 60%),
  radial-gradient(140% 90% at 50% 20%, transparent 45%, rgba(2,10,6,.85) 100%); }
.scene { position: absolute; inset: 0; }
.head { position: absolute; left: 70px; right: 70px; top: 150px; }
.hl { font-family: "Saira Condensed"; font-weight: 800; font-size: 122px; line-height: .92; letter-spacing: .005em; color: #fff; text-shadow: 0 6px 40px rgba(0,0,0,.5); }
.hl + .hl { color: #FFC629; }
.w { display: inline-block; }
.sub { margin-top: 22px; font-size: 38px; font-weight: 600; color: #B9CCC0; max-width: 900px; line-height: 1.2; }
.phone { position: absolute; left: 220px; top: 610px; width: 640px; height: 1385px; border-radius: 88px; padding: 18px; background: linear-gradient(160deg, #2c3a33, #0b1310 40%, #1a2620);
  box-shadow: 0 0 0 3px rgba(255,255,255,.12), 0 60px 140px rgba(0,0,0,.7), 0 0 120px rgba(61,219,134,.25); }
.screen { position: relative; width: 100%; height: 100%; border-radius: 72px; overflow: hidden; background: #04110B; }
.screen img { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
.glare { position: absolute; inset: 18px; border-radius: 72px; pointer-events: none; background: linear-gradient(115deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 72%, rgba(255,255,255,.06) 100%); }
.call { position: absolute; display: flex; align-items: center; gap: 16px; max-width: 520px; padding: 22px 30px; border-radius: 28px; font-size: 36px; font-weight: 700; line-height: 1.1;
  background: linear-gradient(155deg, rgba(255,255,255,.22), rgba(255,255,255,.07)), rgba(10,34,22,.72); border: 2px solid rgba(255,255,255,.22);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.3), 0 24px 60px rgba(0,0,0,.55); backdrop-filter: blur(16px); z-index: 5; }
.call.l { left: 36px; } .call.r { right: 36px; }
.call b { color: #FFC629; }
.call .ic { font-size: 44px; }
.swapimg { opacity: 0; }
.ripple { position: absolute; left: 50%; top: 60px; width: 160px; height: 160px; margin-left: -80px; border-radius: 50%; background: radial-gradient(circle, rgba(140,196,255,.9), rgba(140,196,255,0) 70%); opacity: 0; z-index: 3; }
.slam { position: absolute; left: 0; right: 0; top: 640px; text-align: center; font-family: "Saira Condensed"; font-weight: 800; font-size: 250px; line-height: .86; color: #fff; text-shadow: 0 10px 60px rgba(0,0,0,.6); opacity: 0; }
.slam.gold { color: #FFC629; }
.logo { position: absolute; left: 0; right: 0; top: 560px; text-align: center; opacity: 0; }
.logo .wm { font-family: "Saira Condensed"; font-weight: 800; font-size: 300px; line-height: .82; color: #fff; text-shadow: 0 0 60px rgba(61,219,134,.55), 0 10px 50px rgba(0,0,0,.6); }
.logo .tag { margin-top: 40px; font-size: 44px; font-weight: 600; color: #B9CCC0; padding: 0 100px; }
.logo.big { top: 170px; opacity: 1; }
.logo.big .wm { font-size: 270px; }
.free { position: absolute; left: 0; right: 0; top: 700px; text-align: center; font-family: "Saira Condensed"; font-weight: 800; font-size: 66px; color: #FFC629; }
.qrbox { position: absolute; left: 290px; top: 830px; width: 500px; height: 500px; padding: 36px; border-radius: 48px; background: #fff; box-shadow: 0 0 0 10px rgba(61,219,134,.35), 0 40px 120px rgba(0,0,0,.6); }
.qrbox img { width: 100%; height: 100%; display: block; }
.url { position: absolute; left: 0; right: 0; top: 1400px; text-align: center; font-size: 54px; font-weight: 700; color: #fff; }
.cta { position: absolute; left: 140px; right: 140px; top: 1540px; text-align: center; font-size: 46px; font-weight: 700; color: #1A0800; padding: 28px 30px; border-radius: 999px;
  background: linear-gradient(180deg, #FF8A4F, #FF6B2C); box-shadow: inset 0 2px 0 rgba(255,255,255,.4), 0 20px 60px rgba(255,107,44,.55); }
.cards { position: absolute; left: 0; right: 0; top: 640px; height: 1200px; }
.vcard { position: absolute; top: 0; width: 560px; height: 996px; border-radius: 40px; overflow: hidden; border: 4px solid rgba(255,255,255,.25); box-shadow: 0 40px 120px rgba(0,0,0,.65); }
.vcard img { width: 100%; height: 100%; object-fit: cover; }
#recap-v1 { left: 40px; transform: rotate(-6deg); } #recap-v2 { right: 40px; top: 120px; transform: rotate(6deg); }
.play { position: absolute; left: 430px; top: 400px; width: 220px; height: 220px; border-radius: 50%; display: grid; place-items: center; font-size: 100px; color: #04110B; background: #FFC629; box-shadow: 0 0 0 16px rgba(255,198,41,.3), 0 30px 80px rgba(0,0,0,.6); z-index: 4; padding-left: 16px; }
.chips { position: absolute; left: 0; right: 0; top: 540px; display: flex; justify-content: center; gap: 24px; }
.chip { font-family: "Saira Condensed"; font-weight: 800; font-size: 58px; padding: 10px 38px; border-radius: 999px; color: #03150B; background: #3DDB86; }
.chip:nth-child(2) { background: #8CC4FF; } .chip.gold { background: #FFC629; }
.merge { position: absolute; left: 180px; right: 180px; top: 528px; text-align: center; font-family: "Saira Condensed"; font-weight: 800; font-size: 60px; padding: 14px 20px; border-radius: 999px; color: #fff;
  background: linear-gradient(90deg, #3DDB86, #8CC4FF 50%, #FFC629); color: #04110B; box-shadow: 0 0 60px rgba(255,198,41,.5); }
#brains-phone { top: 690px; }
#brains-phone .screen img { top: -440px; }
.wipe { position: absolute; top: -300px; left: 0; width: 1080px; height: 2520px; transform: skewX(-18deg); background: repeating-linear-gradient(90deg, var(--wc) 0 90px, color-mix(in srgb, var(--wc) 75%, #000) 90px 180px); z-index: 50; }
</style></head>
<body>
<div id="root" data-composition-id="promo" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
  <div class="clip field" id="field" data-start="0" data-duration="${total}" data-track-index="0"></div>
  <div class="clip glow" id="glow" data-start="0" data-duration="${total}" data-track-index="0"></div>
  ${parts.join("\n  ")}
  ${wipes.join("\n  ")}
  <audio id="beat" class="clip" src="beat.wav" data-start="0" data-duration="${total}" data-volume="0.85" data-fade-out="1.5" data-track-index="3"></audio>
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.to("#field", { y: 480, duration: ${total}, ease: "none" }, 0);
  ${anims.join("\n  ")}
  window.__timelines["promo"] = tl;
</script>
</body></html>`;
writeFileSync(join(OUT, "index.html"), html);
writeFileSync(join(OUT, "meta.json"), JSON.stringify({ id: "war-room-promo", name: "War Room promo" }));
writeBeat(join(OUT, "beat.wav"), total + 0.5);
console.log(`built ${S.length} scenes, ${total.toFixed(1)} s → ${OUT}`);
