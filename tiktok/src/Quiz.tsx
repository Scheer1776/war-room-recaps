import React from "react";
import { AbsoluteFill, Img, Interactive, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { AppLink, BODY, C, DISPLAY, Field, Glass, SAFE, f1, teamColor } from "./theme";

// "Pause & Guess" quiz: three multiple-choice questions about the last three weeks (Sleeper stats), each with
// four jersey-tile options, a 3-2-1 countdown ring ("pause now"), a value race that eliminates the wrong
// answers, and a stamp on the right one. Built music-first (no voice): every beat of the scene is a new reveal.
// Data: public/<source>/quiz.json from scripts/quiz.mjs.
const pl = z.object({ id: z.string(), n: z.string(), num: z.number().nullable(), pos: z.string(), nfl: z.string(), g: z.number(),
  touches: z.number(), pts: z.number(), ppg: z.number(), tgt: z.number() });
type P = z.infer<typeof pl>;
const question = z.object({
  q: z.array(z.string()),           // [small kicker, big question]
  metric: z.enum(["touches", "pts", "ppg", "tgt"]),
  unit: z.string(),                 // label under each value, e.g. "TOUCHES"
  dec: z.number(),
  ids: z.array(z.string()),         // 4 options, screen order
  answer: z.string(),
  stamp: z.string(),
  fact: z.string(),                 // line under the grid after the reveal; *word* = gold
});
export const quizSchema = z.object({
  source: z.string(),
  hook: z.array(z.string()),
  questions: z.array(question),
  verdict: z.array(z.string()),
  appShot: z.string(),
  music: z.enum(["bed", "none"]),
  players: z.record(z.string(), pl).nullable(),
});
export type QuizProps = z.infer<typeof quizSchema>;

// beat40.wav is 112 BPM: one beat = 16.07 frames. Every scene starts on a beat.
const FPS = 30, BEAT = (60 / 112) * FPS;
const HOOK = 7, Q = 17, VERDICT = 7, CTA = 10;
const qStart = (i: number) => HOOK + i * Q;
export const quizFrames = (p: QuizProps) => Math.round((HOOK + p.questions.length * Q + VERDICT + CTA) * BEAT);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const bt = (s: number, k: number) => Math.round((s + k) * BEAT) - Math.round(s * BEAT);
const out3 = (t: number) => 1 - Math.pow(1 - t, 3);
const fit = (w: string, room: number, max: number) => Math.min(max, Math.floor(room / (w.length * 0.47)));

const useShake = (at: number, amp = 14) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 10) return "0px 0px";
  const k = amp * (1 - f / 10);
  return `${Math.sin(f * 2.7) * k}px ${Math.cos(f * 3.3) * k}px`;
};
const Flash: React.FC<{ at: number; color?: string }> = ({ at, color = "#fff" }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 1, at + 7], [0, 0.5, 0], clamp);
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} />;
};
const Slam: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  return <span style={{ display: "inline-block", opacity: f < at ? 0 : Math.min(1, s * 3), scale: String(2.4 - 1.4 * s), ...style }}>{children}</span>;
};
// "*word*" → gold.
const Gold: React.FC<{ text: string }> = ({ text }) => (
  <>{text.split(/(\*[^*]+\*)/).map((s, i) => s.startsWith("*") ? <span key={i} style={{ color: C.gold }}>{s.slice(1, -1)}</span> : <span key={i}>{s}</span>)}</>
);
// Words pop in one per half-beat.
const Kinetic: React.FC<{ text: string; at: number; size: number; color?: string; width?: number }> = ({ text, at, size, color = C.ink, width = 920 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: size * 0.24, rowGap: 0, maxWidth: width, margin: "0 auto" }}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: f - at - Math.round(i * BEAT / 2), fps, config: { damping: 11, stiffness: 240, mass: 0.6 } });
        const gold = w.startsWith("*");
        return <span key={i} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 0.98, color: gold ? C.gold : color, opacity: Math.min(1, s * 2),
          translate: `0 ${(1 - s) * 50}px`, scale: String(0.6 + 0.4 * s), textShadow: "0 6px 30px rgba(0,0,0,0.6)" }}>{w.replace(/\*/g, "")}</span>;
      })}
    </div>
  );
};

// Countdown ring: an SVG stroke that drains over `beats` beats, with the number in the middle punching on each beat.
const Ring: React.FC<{ at: number; beats: number; size: number }> = ({ at, beats, size }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = beats * BEAT;
  const t = interpolate(f, [at, at + len], [0, 1], clamp);
  const k = Math.min(beats - 1, Math.floor((f - at) / BEAT));
  const n = beats - k;
  const hit = spring({ frame: f - at - Math.round(k * BEAT), fps, config: { damping: 9, stiffness: 300, mass: 0.5 } });
  const r = size / 2 - 14, circ = 2 * Math.PI * r;
  const col = n === 1 ? C.red : n === 2 ? C.pylon : C.gold;
  if (f < at || f > at + len + 2) return null;
  return (
    <div style={{ width: size, height: size, position: "relative", scale: String(1.25 - 0.25 * hit) }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, rotate: "-90deg" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(4,17,11,0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth={18} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={18} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * t}
          style={{ filter: `drop-shadow(0 0 16px ${col})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.56, color: col, lineHeight: 1 }}>{n}</div>
    </div>
  );
};

// One option: jersey-number tile in team colors. After the reveal its value counts up; losers get an X drawn
// through them (SVG stroke) and go gray, the answer glows and scales up.
const Option: React.FC<{ x: P; i: number; letter: string; at: number; revealAt: number; elimAt: number | null; win: boolean; value: number; dec: number; unit: string; max: number }> =
  ({ x, i, letter, at, revealAt, elimAt, win, value, dec, unit, max }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tc = teamColor(x.nfl);
  const enter = spring({ frame: f - at, fps, config: { damping: 13, stiffness: 160 } });
  const v = interpolate(f, [revealAt, revealAt + 24], [0, value], { ...clamp, easing: out3 });
  const vo = interpolate(f, [revealAt, revealAt + 4], [0, 1], clamp);
  const x1 = elimAt === null ? 0 : interpolate(f, [elimAt, elimAt + 7], [0, 1], { ...clamp, easing: out3 });
  const winT = win ? spring({ frame: f - (revealAt + Math.round(3 * BEAT)), fps, config: { damping: 11, stiffness: 180 } }) : 0;
  const last = x.n.split(" ").slice(1).join(" ").replace(/ (Jr\.|Sr\.|III|II)$/, "").toUpperCase();
  const first = x.n.split(" ")[0].toUpperCase();
  const W = 410, H = 330;
  const col = i % 2, row = Math.floor(i / 2);
  return (
    <div style={{ position: "absolute", left: SAFE.left + col * (W + 20), top: 560 + row * (H + 22), width: W, height: H,
      translate: `${(1 - enter) * (col ? 700 : -700)}px 0`, rotate: `${(1 - enter) * (col ? 8 : -8)}deg`,
      scale: String(1 + 0.06 * winT - 0.05 * x1), zIndex: win ? 2 : 1 }}>
      <Glass tint={`linear-gradient(150deg, ${tc}66, rgba(16,40,28,0.75) 55%)`} style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 34,
        filter: `grayscale(${x1 * 0.95}) brightness(${1 - x1 * 0.45})`,
        boxShadow: winT ? `0 0 ${90 * winT}px -6px ${C.turf}, inset 0 0 0 ${5 * winT}px ${C.turf}` : undefined }}>
        {/* Jersey number fills the tile until the reveal, then dims so the value takes its place */}
        <div style={{ position: "absolute", right: -6, top: -36, fontFamily: DISPLAY, fontWeight: 800, fontSize: 250, lineHeight: 1, color: tc, opacity: 0.9 - 0.75 * vo, letterSpacing: -10,
          translate: `${Math.sin((f + i * 20) / 22) * 8}px 0`, textShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>{x.num ?? x.pos}</div>
        <div style={{ position: "absolute", left: 22, top: 20, width: 64, height: 64, borderRadius: 18, background: "#061209", border: `3px solid ${C.gold}`,
          display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, color: C.gold }}>{letter}</div>
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 24 }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, letterSpacing: 2, color: C.dim }}>{x.pos} · {x.nfl}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 38, lineHeight: 1, color: C.dim }}>{first}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(last, 360, 72), lineHeight: 0.95, color: C.ink, whiteSpace: "nowrap" }}>{last}</div>
        </div>
        {/* Value race: counter in the number's spot plus a bar along the bottom edge relative to the max */}
        <div style={{ position: "absolute", left: 0, bottom: 0, height: 12, width: `${(v / max) * 100}%`, background: win ? C.turf : C.pylon, opacity: vo, boxShadow: `0 0 20px ${win ? C.turf : C.pylon}` }} />
        <div style={{ position: "absolute", right: 22, top: 18, textAlign: "right", opacity: vo, scale: String(0.6 + 0.4 * vo) }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 116, lineHeight: 0.9, color: win ? C.turf : C.ink, fontVariantNumeric: "tabular-nums", textShadow: "0 6px 30px rgba(0,0,0,0.7)" }}>{dec ? f1(v) : Math.round(v)}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, letterSpacing: 2, color: C.dim, marginTop: 2 }}>{unit}</div>
        </div>
      </Glass>
      {elimAt !== null ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {[[40, 40, W - 40, H - 40], [W - 40, 40, 40, H - 40]].map(([a, b, c, d], k) => {
            const L = Math.hypot(c - a, d - b);
            const t = interpolate(f, [elimAt + k * 3, elimAt + k * 3 + 6], [0, 1], clamp);
            return <line key={k} x1={a} y1={b} x2={c} y2={d} stroke={C.red} strokeWidth={18} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - t)} style={{ filter: `drop-shadow(0 0 12px ${C.red})` }} />;
          })}
        </svg>
      ) : null}
    </div>
  );
};

const Pips: React.FC<{ n: number; i: number }> = ({ n, i }) => (
  <div style={{ position: "absolute", top: SAFE.top - 40, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "center", gap: 10 }}>
    {Array.from({ length: n }).map((_, k) => <div key={k} style={{ width: 70, height: 10, borderRadius: 5, background: k <= i ? C.gold : "rgba(255,255,255,0.2)" }} />)}
  </div>
);

const Hook: React.FC<{ p: QuizProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = (k: number) => bt(0, k);
  const q = spring({ frame: f - b(2), fps, config: { damping: 14, stiffness: 70 } });
  const pause = spring({ frame: f - b(4), fps, config: { damping: 10, stiffness: 220 } });
  const blink = 0.75 + 0.25 * Math.max(0, 1 - ((f % BEAT) / 8));
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 800px at 50% 55%, ${C.gold}, transparent 70%)`, opacity: 0.16 }} />
      <AbsoluteFill style={{ translate: useShake(b(1), 20) }}>
        <div style={{ position: "absolute", top: SAFE.top + 10, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 230, lineHeight: 0.86, color: C.gold }}><Slam at={b(0)}>{p.hook[0]}</Slam></div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 0.9, color: C.ink }}><Slam at={b(1)}>{p.hook[1]}</Slam></div>
        </div>
        {/* 3D question mark spinning in on Y */}
        <div style={{ position: "absolute", top: 690, left: 0, right: 0, display: "flex", justifyContent: "center", perspective: 1200, opacity: f < b(2) ? 0 : 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 470, lineHeight: 1, color: C.ink, transform: `rotateY(${(1 - q) * 540 + Math.sin(f / 9) * 12}deg) scale(${0.4 + 0.6 * q})`,
            textShadow: `0 0 60px ${C.gold}, 0 20px 0 ${C.pylon}` }}>?</div>
        </div>
        <div style={{ position: "absolute", top: 1215, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "center", opacity: f < b(4) ? 0 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, background: C.red, borderRadius: 26, padding: "10px 34px", scale: String((2 - pause) * (0.94 + 0.06 * blink)), rotate: "-3deg",
            boxShadow: `0 0 60px -6px ${C.red}` }}>
            <div style={{ display: "flex", gap: 12 }}><div style={{ width: 22, height: 74, background: "#fff", borderRadius: 6 }} /><div style={{ width: 22, height: 74, background: "#fff", borderRadius: 6 }} /></div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, lineHeight: 1, color: "#fff" }}>{p.hook[2]}</div>
          </div>
        </div>
        <div style={{ position: "absolute", top: 1370, left: SAFE.left, right: SAFE.right, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, color: C.gold }}>
          <Slam at={b(5)}>{p.hook[3]}</Slam>
        </div>
      </AbsoluteFill>
      <Flash at={b(1)} color={C.gold} />
    </AbsoluteFill>
  );
};

const Question: React.FC<{ p: QuizProps; i: number }> = ({ p, i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const qq = p.questions[i];
  const s0 = qStart(i);
  const b = (k: number) => bt(s0, k);
  const xs = qq.ids.map(id => p.players![id]);
  const vals = xs.map(x => x[qq.metric] as number);
  const max = Math.max(...vals);
  const revealAt = b(8);
  // Eliminate wrong answers lowest value first, one per half-beat after the values land.
  const order = xs.map((x, k) => ({ k, v: vals[k], id: x.id })).filter(o => o.id !== qq.answer).sort((a, c) => a.v - c.v);
  const elim = new Map(order.map((o, n) => [o.k, revealAt + Math.round(BEAT * 1.5) + Math.round(n * BEAT / 2)]));
  const winAt = revealAt + Math.round(3 * BEAT);
  const st = spring({ frame: f - winAt, fps, config: { damping: 10, stiffness: 220, mass: 0.7 } });
  const factT = spring({ frame: f - b(12), fps, config: { damping: 14, stiffness: 140 } });
  const ai = qq.ids.indexOf(qq.answer);
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(1000px 900px at 50% 50%, ${C.turf}, transparent 70%)`, opacity: interpolate(f, [winAt, winAt + 12], [0, 0.2], clamp) }} />
      <Pips n={p.questions.length} i={i} />
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, letterSpacing: 5, color: C.gold }}><Slam at={b(0)}>{`Q${i + 1} OF ${p.questions.length} · ${qq.q[0]}`}</Slam></div>
        <div style={{ marginTop: 14 }}><Kinetic text={qq.q[1]} at={b(0) + 4} size={fit(qq.q[1], 1700, 104)} /></div>
      </div>
      <AbsoluteFill style={{ translate: useShake(winAt, 18) }}>
        {xs.map((x, k) => (
          <Option key={x.id} x={x} i={k} letter={"ABCD"[k]} at={b(2) + Math.round(k * BEAT / 2)} revealAt={revealAt} elimAt={elim.get(k) ?? null}
            win={x.id === qq.answer} value={vals[k]} dec={qq.dec} unit={qq.unit} max={max} />
        ))}
        {/* PAUSE NOW countdown in the middle of the grid */}
        <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 560 + 330 + 11 - 130, display: "flex", justifyContent: "center", zIndex: 5 }}>
          <Ring at={b(4)} beats={3} size={260} />
        </div>
        <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1280, textAlign: "center", zIndex: 5, opacity: f >= b(4) && f < b(7) + 6 ? 1 : 0 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, color: "#fff", background: C.red, borderRadius: 20, padding: "0 28px", opacity: 0.6 + 0.4 * Math.max(0, 1 - (((f - b(4)) % BEAT) / 8)) }}>⏸ PAUSE NOW</span>
        </div>
        {/* Answer stamp over the winning tile */}
        {f >= winAt ? (
          <div style={{ position: "absolute", left: SAFE.left + (ai % 2) * 430 + 20, top: 560 + Math.floor(ai / 2) * 352 + 100, width: 370, display: "flex", justifyContent: "center", zIndex: 6 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(qq.stamp, 330, 92), lineHeight: 1, color: C.turf, border: `10px solid ${C.turf}`, borderRadius: 22, padding: "0 22px",
              rotate: "-6deg", scale: String(2.6 - 1.6 * st), opacity: Math.min(1, st * 2), background: "rgba(4,17,11,0.8)", boxShadow: `0 0 70px -10px ${C.turf}`, textShadow: `0 0 26px ${C.turf}`, whiteSpace: "nowrap" }}>
              {qq.stamp}
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1290, textAlign: "center", opacity: f < b(12) ? 0 : Math.min(1, factT * 2), translate: `0 ${(1 - factT) * 60}px`,
        fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(qq.fact.replace(/\*/g, ""), 1500, 70), lineHeight: 1.02, color: C.ink, textShadow: "0 6px 30px rgba(0,0,0,0.6)" }}>
        <Gold text={qq.fact} />
      </div>
      <Flash at={0} />
      <Flash at={winAt} color={C.turf} />
    </AbsoluteFill>
  );
};

const Verdict: React.FC<{ p: QuizProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s0 = qStart(p.questions.length);
  const b = (k: number) => bt(s0, k);
  const st = spring({ frame: f - b(3), fps, config: { damping: 10, stiffness: 220, mass: 0.7 } });
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 800px at 50% 40%, ${C.red}, transparent 70%)`, opacity: 0.22 }} />
      <AbsoluteFill style={{ translate: useShake(b(3), 22) }}>
        <div style={{ position: "absolute", top: SAFE.top + 30, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <Kinetic text={p.verdict[0]} at={b(0)} size={150} />
        </div>
        <div style={{ position: "absolute", top: 820, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 132, lineHeight: 1, color: C.turf, border: `14px solid ${C.turf}`, borderRadius: 28, padding: "6px 40px",
            rotate: "-4deg", scale: String(2.6 - 1.6 * st), opacity: f < b(3) ? 0 : Math.min(1, st * 2), background: "rgba(4,17,11,0.6)", boxShadow: `0 0 80px -10px ${C.turf}`, textShadow: `0 0 30px ${C.turf}`, textAlign: "center" }}>
            {p.verdict[1]}
          </div>
        </div>
        <div style={{ position: "absolute", top: 1200, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <Kinetic text={p.verdict[2]} at={b(5)} size={76} color={C.gold} />
        </div>
      </AbsoluteFill>
      <Flash at={0} />
      <Flash at={b(3)} color={C.turf} />
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ p: QuizProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s0 = qStart(p.questions.length) + VERDICT;
  const b = (k: number) => bt(s0, k);
  const up = spring({ frame: f - b(1), fps, config: { damping: 16, stiffness: 90 } });
  const scroll = interpolate(f, [b(2), dur], [0, -260], clamp);
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 100%, ${C.turf}, transparent 70%)`, opacity: 0.25 }} />
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, lineHeight: 0.95, color: C.ink }}>
        <Slam at={b(0)}>STOP GUESSING.</Slam><br /><Slam at={b(1)} style={{ color: C.gold }}>WAR ROOM TRACKS IT.</Slam>
      </div>
      <div style={{ position: "absolute", left: SAFE.left + 10, top: 520, width: 380, height: 640, borderRadius: 54, background: "#050a07", padding: 14,
        boxShadow: `0 0 0 4px rgba(255,255,255,0.18), 0 60px 120px -30px rgba(0,0,0,0.9), 0 0 120px -40px ${C.turf}`, translate: `${(1 - up) * -900}px 0`, rotate: `${(1 - up) * -10 - 3}deg` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 46, overflow: "hidden", position: "relative" }}>
          <Img src={staticFile(p.appShot)} style={{ width: "100%", position: "absolute", top: scroll }} />
        </div>
      </div>
      <div style={{ position: "absolute", right: SAFE.right, top: 560, width: 400 }}>
        <AppLink at={b(2)} size={300} align="center" />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1250, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 60, lineHeight: 1.05, color: C.ink }}>
        <Slam at={b(3)}>ANY ESPN OR SLEEPER LEAGUE.</Slam><br /><Slam at={b(4)} style={{ color: C.turf }}>$0.</Slam>
      </div>
      <Flash at={0} />
    </AbsoluteFill>
  );
};

export const Quiz: React.FC<QuizProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  if (!p.players) return <AbsoluteFill style={{ background: "#04110B" }} />;
  const at = (beat: number) => Math.round(beat * BEAT);
  const vStart = at(qStart(p.questions.length));
  const cStart = at(qStart(p.questions.length) + VERDICT);
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      <Sequence name="hook" durationInFrames={at(HOOK)}><Hook p={p} /></Sequence>
      {p.questions.map((_, i) => (
        <Sequence key={i} name={`q${i + 1}`} from={at(qStart(i))} durationInFrames={at(qStart(i + 1)) - at(qStart(i))}><Question p={p} i={i} /></Sequence>
      ))}
      <Sequence name="verdict" from={vStart} durationInFrames={cStart - vStart}><Verdict p={p} /></Sequence>
      <Sequence name="cta" from={cStart}><Cta p={p} dur={durationInFrames - cStart} /></Sequence>
      {p.music === "bed" ? (
        <Interactive.Div name="Music">
          <Audio src={staticFile("beat40.wav")} loop volume={(f) => interpolate(f, [0, 4, durationInFrames - 20, durationInFrames], [0, 0.6, 0.6, 0], clamp)} />
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
