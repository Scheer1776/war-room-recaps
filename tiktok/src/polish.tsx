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
