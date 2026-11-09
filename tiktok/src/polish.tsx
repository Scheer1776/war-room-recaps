// polish.tsx — shared "make it look expensive" layer for every voiced TikTok composition (owner, 2026-11-08:
// "add whatever you need to increase the quality of our videos and any animations in them").
//   <Captions words={...} />  TikTok-style word-by-word captions synced to the ONE voice take (whisper timings,
//                             script spellings), 2-4 words per line, the spoken word pops gold.
//   <Whip>                    scene entry: fast slide + directional blur, so cuts feel like camera moves.
//   <Grade> / <Grain />       cinematic look for game clips: contrast + saturation lift, vignette, moving film grain.
// Timing never changes: everything here is an overlay or an entry animation inside the scene's own frames,
// so scene lengths stay locked to the voice.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DISPLAY, SAFE } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export type Word = { t: string; s: number; e: number };

// Group words into short caption lines: break on sentence punctuation, on pauses > 0.35 s, or every 3 words / 16 chars.
export const captionLines = (words: Word[]) => {
  const lines: Word[][] = []; let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const chars = cur.map(x => x.t).join(" ").length;
    const end = /[.?!,:;]$/.test(w.t) || !next || next.s - w.e > 0.35 || cur.length >= 3 || chars >= 16;
    if (end) { lines.push(cur); cur = []; }
  });
  return lines;
};

export const Captions: React.FC<{ words: Word[]; top?: number; size?: number }> = ({ words, top = 1372, size = 76 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const t = f / fps;
  const lines = React.useMemo(() => captionLines(words), [words]);
  const li = lines.findIndex((l, i) => t >= l[0].s - 0.05 && t < (lines[i + 1]?.[0].s ?? l[l.length - 1].e + 0.6) - 0.05);
  if (li < 0) return null;
  const line = lines[li];
  const lf = Math.round((line[0].s - 0.05) * fps);
  const pop = spring({ frame: f - lf, fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 26px",
        transform: `translateY(${(1 - pop) * 26}px) scale(${0.92 + pop * 0.08})`, opacity: Math.min(1, pop * 1.4) }}>
        {line.map((w, i) => {
          const on = t >= w.s - 0.03 && t < (line[i + 1]?.s ?? w.e + 0.4);
          const done = t >= w.s - 0.03;
          const wf = Math.round(w.s * fps);
          const k = interpolate(f, [wf - 1, wf + 3, wf + 8], [1, 1.09, 1.04], clamp);
          return (
            <span key={i} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: 0.5,
              color: on ? C.gold : "#fff", opacity: done ? 1 : 0.55, display: "inline-block", transform: on ? `scale(${k})` : undefined, transformOrigin: "50% 60%",
              WebkitTextStroke: "3px rgba(0,0,0,0.85)", paintOrder: "stroke fill", textShadow: "0 6px 18px rgba(0,0,0,0.75), 0 0 2px #000" }}>{w.t.replace(/[,;:]$/, "")}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Scene entry: 7-frame whip from the right with motion blur and a tiny overshoot.
export const Whip: React.FC<{ children: React.ReactNode; dir?: 1 | -1 }> = ({ children, dir = 1 }) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, 7], [140 * dir, 0], { ...clamp, easing: (v) => 1 - Math.pow(1 - v, 3) });
  const blur = interpolate(f, [0, 7], [14, 0], clamp);
  return <AbsoluteFill style={{ transform: `translateX(${x}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};

// Cinematic look over game footage: slight contrast/saturation lift lives on the <video> style (gradeStyle);
// this adds the vignette. Grain is separate so it can sit over the whole frame.
export const gradeStyle: React.CSSProperties = { filter: "contrast(1.08) saturate(1.18) brightness(1.02)" };
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)` }} />
);

// Moving film grain (SVG turbulence re-seeded every 2 frames). Very light: it reads as texture, not noise.
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2) % 97;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={`g${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

// ───────────── v2 (owner, 2026-11-08: "i dont see any new cool animations") — effects you can't miss ─────────────

// Impact moment on a game clip: the play FREEZES on the key frame for `hold` s while the frame punches in, a white
// flash + team-color shockwave ring fire, the screen shakes and a slam word ("TOUCHDOWN!") lands; then play resumes.
export const ImpactFX: React.FC<{ at: number; hold: number; color: string; text?: string }> = ({ at, hold, color, text }) => {
  const f = useCurrentFrame();
  if (f < at - 1 || f > at + hold + 16) return null;
  const t = f - at;
  const flash = interpolate(t, [0, 1, 7], [0, 0.7, 0], clamp);
  const ring = interpolate(t, [0, 16], [0.1, 2.4], { ...clamp, easing: (v) => 1 - Math.pow(1 - v, 3) });
  const ringO = interpolate(t, [0, 3, 16], [0, 1, 0], clamp);
  const slam = interpolate(t, [1, 7], [2.6, 1], { ...clamp, easing: (v) => 1 - Math.pow(1 - v, 4) });
  const slamO = interpolate(t, [1, 3, hold + 6, hold + 14], [0, 1, 1, 0], clamp);
  const lines = interpolate(t, [0, hold + 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* speed lines */}
      <AbsoluteFill style={{ opacity: (1 - lines) * 0.55, background: `repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,255,255,0.0) 0deg 5deg, rgba(255,255,255,0.22) 5deg 6deg)`, maskImage: "radial-gradient(circle at 50% 45%, transparent 28%, black 70%)", WebkitMaskImage: "radial-gradient(circle at 50% 45%, transparent 28%, black 70%)" }} />
      <div style={{ position: "absolute", left: 540 - 500, top: 860 - 500, width: 1000, height: 1000, borderRadius: "50%", border: `22px solid ${color}`, boxShadow: `0 0 80px ${color}`, transform: `scale(${ring})`, opacity: ringO }} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      {text ? (
        <div style={{ position: "absolute", top: 760, left: 0, right: 0, textAlign: "center", opacity: slamO, transform: `scale(${slam}) rotate(-4deg)` }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 168, lineHeight: 1, color: "#fff", letterSpacing: 2, textTransform: "uppercase",
            WebkitTextStroke: `6px ${color}`, paintOrder: "stroke fill", textShadow: `0 0 40px ${color}, 0 14px 30px rgba(0,0,0,0.8)` }}>{text}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Screen shake helper for the impact (returns a CSS translate for the whole scene).
export const impactShake = (f: number, at: number, len = 12, amp = 22) => {
  const t = f - at;
  if (t < 0 || t > len) return "";
  const k = amp * (1 - t / len);
  return `translate(${Math.sin(t * 12.9) * k}px, ${Math.cos(t * 9.7) * k * 0.7}px)`;
};

// Scene entry wipe: two skewed bars in the scene's color sweep across (covering the cut), then clear.
export const TeamWipe: React.FC<{ color: string; dir?: 1 | -1 }> = ({ color, dir = 1 }) => {
  const f = useCurrentFrame();
  if (f > 14) return null;
  const x = interpolate(f, [0, 14], [-1500, 1500], { ...clamp, easing: (v) => v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2 }) * dir;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: -300, bottom: -300, left: 140, width: 900, background: color, transform: `translateX(${x}px) skewX(-18deg)`, boxShadow: `0 0 120px ${color}` }} />
      <div style={{ position: "absolute", top: -300, bottom: -300, left: 140, width: 260, background: "#04110B", transform: `translateX(${x - 520 * dir}px) skewX(-18deg)` }} />
    </AbsoluteFill>
  );
};

// Glitch title open over the first ~0.9 s: RGB-split "WEEK 9 / SUNDAY RECAP" with jittering slices, then it tears away.
export const GlitchOpen: React.FC<{ line1: string; line2: string; dur?: number }> = ({ line1, line2, dur = 28 }) => {
  const f = useCurrentFrame();
  if (f > dur) return null;
  const out = interpolate(f, [dur - 8, dur], [0, 1], clamp);
  const jit = (s: number) => (Math.sin(f * 7.3 + s * 13.1) > 0.55 ? Math.sin(f * 3.1 + s) * 38 : 0);
  const word = (color: string, dx: number, dy: number, blend?: string) => (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: `translate(${dx}px, ${dy}px)`, mixBlendMode: blend as any }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 120, color, letterSpacing: 6, lineHeight: 1 }}>{line1}</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 200, color, letterSpacing: 2, lineHeight: 0.95, textTransform: "uppercase" }}>{line2}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: `rgba(4,17,11,${0.92 * (1 - out)})`, opacity: 1 - out * 0.6, transform: `scaleY(${1 - out * 0.9})` }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <AbsoluteFill key={i} style={{ clipPath: `inset(${i * 16.6}% 0 ${100 - (i + 1) * 16.6}% 0)`, transform: `translateX(${jit(i)}px)` }}>
          {word("#ff2e4d", -9, 0, "screen")}{word("#2ee6ff", 9, 0, "screen")}{word("#ffffff", 0, 0)}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};

// TikTok-style story progress bar across the top: one segment per scene, filling as the video plays.
export const ProgressBar: React.FC<{ lens: number[] }> = ({ lens }) => {
  const f = useCurrentFrame();
  let acc = 0;
  return (
    <div style={{ position: "absolute", top: 18, left: 28, right: 28, display: "flex", gap: 8, pointerEvents: "none" }}>
      {lens.map((n, i) => { const p = Math.min(1, Math.max(0, (f - acc) / n)); acc += n;
        return <div key={i} style={{ flex: n, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
          <div style={{ width: `${p * 100}%`, height: "100%", background: "#fff", boxShadow: "0 0 10px rgba(255,255,255,0.8)" }} /></div>; })}
    </div>
  );
};
