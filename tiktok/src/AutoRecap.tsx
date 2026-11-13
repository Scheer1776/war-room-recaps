import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { AppLink, BODY, C, DISPLAY, SAFE, f1, initialsOf, teamColor } from "./theme";
import { Flash, Kinetic, Particles, Phone3D, Stamp, W, H, clamp, useShake } from "./fx";
import { Captions, GlitchOpen, Grain, ProgressBar, Whip } from "./polish";

// AutoRecap (2026-11-12): the cloud-made recap (tiktok/auto/). Same data + voice timing as SundayRecap, its own look:
// a logo smash for the result, a tilting 3D player card with a light sweep and a points-vs-projection meter,
// a cracking bust card, and a 3D phone + QR closer. No game footage needed (YouTube blocks cloud downloads).
const stats = z.object({ pass_yd: z.number(), pass_td: z.number(), pass_int: z.number().default(0), rush_yd: z.number(), rush_td: z.number(), rec: z.number(), rec_yd: z.number(), rec_td: z.number() });
const player = z.object({ id: z.string(), n: z.string(), pos: z.string(), team: z.string(), pts: z.number(), proj: z.number(), line: z.string(), s: stats.optional() });
const side = z.object({ t: z.string(), s: z.number(), name: z.string() });
const scene = z.object({
  id: z.string(), kind: z.enum(["versus", "scores", "hero", "bust", "cta"]), dur: z.number(),
  title: z.string().default(""), stamp: z.string().default(""), color: z.string().default("gold"),
  player: player.nullable().default(null),
  game: z.object({ away: side, home: side, ot: z.boolean().default(false) }).nullable().default(null),
  appShot: z.string().default("app/startsit-vp.png"),
});
export const autoSchema = z.object({
  source: z.string(), week: z.number(), label: z.string().nullable().optional(), voFull: z.string().nullable().optional(),
  words: z.array(z.object({ t: z.string(), s: z.number(), e: z.number() })).nullable().optional(),
  scenes: z.array(scene),
  scores: z.array(z.object({ away: z.object({ t: z.string(), s: z.number() }), home: z.object({ t: z.string(), s: z.number() }), ot: z.boolean() })),
});
export type AutoProps = z.infer<typeof autoSchema>;
type Scene = z.infer<typeof scene>; type Pl = z.infer<typeof player>;
const FPS = 30;
export const autoFrames = (p: AutoProps) => p.scenes.reduce((n, s) => n + Math.round(s.dur * FPS), 0);
const col = (c?: string) => (C as Record<string, string>)[c || "gold"] || c || C.gold;
const L = SAFE.left, R = SAFE.right, T = SAFE.top;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

// ---------- shared pieces ----------
// Rotating speed lines radiating from a point, in a team color: the "everything's moving" background.
const SpeedLines: React.FC<{ color: string; cx?: number; cy?: number; n?: number; seed?: number }> = ({ color, cx = W / 2, cy = 760, n = 44, seed = 1 }) => {
  const f = useCurrentFrame();
  const rot = f * 0.25;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <defs><radialGradient id={`sl${seed}`} cx={cx / W} cy={cy / H} r="0.75"><stop offset="0.12" stopColor={color} stopOpacity="0" /><stop offset="0.55" stopColor={color} stopOpacity="0.55" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient></defs>
      <g transform={`rotate(${rot} ${cx} ${cy})`}>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + ((i * 7919 * seed) % 13) * 0.01;
          const w = 0.006 + (((i * 31 + seed * 17) % 10) / 10) * 0.018;
          const r = 2400;
          const p1 = [cx + Math.cos(a - w) * r, cy + Math.sin(a - w) * r], p2 = [cx + Math.cos(a + w) * r, cy + Math.sin(a + w) * r];
          const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f / 6 + i * 1.7));
          return <polygon key={i} points={`${cx},${cy} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={`url(#sl${seed})`} opacity={pulse * 0.5} />;
        })}
      </g>
    </svg>
  );
};
const Base: React.FC<{ color: string; color2?: string; seed?: number }> = ({ color, color2, seed = 1 }) => (
  <AbsoluteFill style={{ background: "#04110B" }}>
    <AbsoluteFill style={{ background: `radial-gradient(1100px 1000px at 50% 38%, ${color}55, transparent 70%)${color2 ? `, radial-gradient(900px 900px at 85% 90%, ${color2}44, transparent 70%)` : ""}` }} />
    <SpeedLines color={color} seed={seed} />
    <Particles n={45} color={color} seed={"b" + seed} speed={2.2} size={7} opacity={0.6} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,17,11,0.75) 0%, rgba(4,17,11,0) 22%, rgba(4,17,11,0) 62%, rgba(4,17,11,0.85) 100%)" }} />
  </AbsoluteFill>
);
const Logo: React.FC<{ src: string; t: string; size: number; style?: React.CSSProperties }> = ({ src, t, size, style }) => (
  <div style={{ width: size, height: size, position: "relative", ...style }}>
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.34, color: teamColor(t) }}>{t}</div>
    <Img src={staticFile(`${src}/l/${t}.png`)} onError={() => undefined} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: `drop-shadow(0 0 40px ${teamColor(t)}aa) drop-shadow(0 18px 30px rgba(0,0,0,0.6))` }} />
  </div>
);
const Shockwave: React.FC<{ at: number; x: number; y: number; color: string }> = ({ at, x, y, color }) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 22) return null;
  return <>{[0, 5].map(d => { const k = Math.max(0, f - d); const r = interpolate(k, [0, 16], [20, 900], { ...clamp, easing: easeOut });
    return <div key={d} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${Math.max(2, 26 - k * 1.5)}px solid ${color}`, opacity: interpolate(k, [0, 16], [0.9, 0], clamp), boxShadow: `0 0 60px ${color}` }} />; })}</>;
};
const Sparks: React.FC<{ at: number; x: number; y: number; color: string; n?: number }> = ({ at, x, y, color, n = 26 }) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 26) return null;
  return <>{Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + i; const v = 18 + ((i * 37) % 22); const d = v * f * (1 - f / 60);
    return <div key={i} style={{ position: "absolute", left: x + Math.cos(a) * d, top: y + Math.sin(a) * d + f * f * 0.4, width: 26, height: 6, borderRadius: 3, background: i % 3 ? color : "#fff", rotate: `${(a * 180) / Math.PI}deg`, opacity: 1 - f / 26, boxShadow: `0 0 14px ${color}` }} />; })}</>;
};
const Count: React.FC<{ at: number; to: number; size: number; color: string; dec?: number; dur?: number; style?: React.CSSProperties }> = ({ at, to, size, color, dec = 1, dur = 26, style }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + dur], [0, to], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
  return <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 0.9, color, fontVariantNumeric: "tabular-nums", textShadow: `0 0 50px ${color}77`, ...style }}>{v.toFixed(dec)}</span>;
};
const Title: React.FC<{ s: Scene; accent: string }> = ({ s, accent }) => (
  <div style={{ position: "absolute", top: T - 30, left: L, right: R }}><Kinetic text={s.title || ""} at={2} size={92} align="left" accent={accent} /></div>
);

// ---------- scenes ----------
// Result: both logos fly in and collide (flash, shockwave, sparks, shake), scores count up, winner glows, loser fades.
const Versus: React.FC<{ p: AutoProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame(); const g = s.game!;
  const hit = 11;
  const aw = g.away.s >= g.home.s, tie = g.away.s === g.home.s;
  const xin = (dir: number) => interpolate(f, [0, hit], [dir * 900, dir * 40], { ...clamp, easing: (x) => x * x });
  const bounce = (dir: number) => f < hit ? xin(dir) : dir * interpolate(f, [hit, hit + 10, hit + 24], [40, 230, 210], { ...clamp, easing: easeOut });
  const blur = f < hit ? interpolate(f, [0, hit], [18, 6], clamp) : 0;
  const wiggle = Math.sin(f / 9) * 6;
  const loseDim = (isWinner: boolean) => tie || isWinner ? 1 : interpolate(f, [hit + 40, hit + 54], [1, 0.45], clamp);
  const winPop = (isWinner: boolean) => !tie && isWinner ? interpolate(f, [hit + 40, hit + 48, hit + 60], [1, 1.16, 1.1], clamp) : 1;
  const cy = 700;
  const split = interpolate(f, [hit, hit + 12], [50, 50 + (aw ? 6 : -6) * (tie ? 0 : 1)], clamp);
  return (
    <AbsoluteFill style={{ translate: useShake(hit, 30, 14) }}>
      <AbsoluteFill style={{ background: `linear-gradient(105deg, ${teamColor(g.away.t)}cc 0%, ${teamColor(g.away.t)}33 ${split - 2}%, #04110B ${split}%, ${teamColor(g.home.t)}33 ${split + 2}%, ${teamColor(g.home.t)}cc 100%)` }} />
      <SpeedLines color="#ffffff" cy={cy} n={36} seed={3} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,17,11,0.8) 0%, rgba(4,17,11,0.1) 25%, rgba(4,17,11,0.1) 60%, rgba(4,17,11,0.9) 100%)" }} />
      <Title s={s} accent={C.gold} />
      <div style={{ position: "absolute", top: cy - 190, left: W / 2 - 190, translate: `${bounce(-1)}px ${wiggle}px`, filter: `blur(${blur}px)`, opacity: loseDim(aw), scale: String(winPop(aw)) }}><Logo src={p.source} t={g.away.t} size={380} /></div>
      <div style={{ position: "absolute", top: cy - 190, left: W / 2 - 190, translate: `${bounce(1)}px ${-wiggle}px`, filter: `blur(${blur}px)`, opacity: loseDim(!aw), scale: String(winPop(!aw)) }}><Logo src={p.source} t={g.home.t} size={380} /></div>
      {f >= hit ? <div style={{ position: "absolute", top: cy - 70, width: W, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, color: "#fff", opacity: interpolate(f, [hit, hit + 6, hit + 30, hit + 40], [0, 1, 1, 0.25], clamp), textShadow: "0 0 40px #fff" }}>VS</div> : null}
      <Shockwave at={hit} x={W / 2} y={cy} color="#ffffff" />
      <Sparks at={hit} x={W / 2} y={cy} color={C.gold} n={30} />
      <div style={{ position: "absolute", top: cy + 230, left: 0, width: W, display: "flex", justifyContent: "center", gap: 170 }}>
        {[{ x: g.away, w: aw }, { x: g.home, w: !aw }].map(({ x, w }, i) => (
          <div key={i} style={{ width: 300, textAlign: "center", opacity: f < hit + 6 ? 0 : 1 }}>
            <Count at={hit + 6} to={x.s} size={230} color={tie ? C.ink : w ? C.gold : "rgba(243,247,244,0.55)"} dec={0} dur={30} />
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, letterSpacing: 6, color: C.dim, marginTop: 4 }}>{x.name.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: cy + 115, left: 0, width: W, display: "flex", justifyContent: "center" }}><Stamp text={g.ot ? "FINAL / OT" : "FINAL"} color={C.gold} at={hit + 44} size={72} rot={-4} /></div>
      <Flash at={hit} color="#fff" peak={0.75} />
    </AbsoluteFill>
  );
};

// Hero player card: flips in, tilts in 3D, a light sweep crosses it; giant outlined points behind; stat chips; meter.
const statChips = (x: Pl): string[] => {
  const s = x.s; if (!s) return x.line ? x.line.split(" · ").slice(0, 3) : [];
  const out: string[] = [];
  if (x.pos === "QB") { if (s.pass_yd) out.push(`${s.pass_yd} PASS YDS`); if (s.pass_td) out.push(`${s.pass_td} PASS TD`); if (s.rush_yd >= 20) out.push(`${s.rush_yd} RUSH YDS`); }
  else { if (s.rush_yd >= 15) out.push(`${s.rush_yd} RUSH YDS`); if (s.rec) out.push(`${s.rec} REC · ${s.rec_yd} YDS`); }
  const td = (s.rush_td || 0) + (s.rec_td || 0) + (x.pos === "QB" ? 0 : 0); if (td) out.push(`${td} TD`);
  if (x.pos === "QB" && s.rush_td) out.push(`${s.rush_td} RUSH TD`);
  return out.slice(0, 3);
};
const Card: React.FC<{ p: AutoProps; x: Pl; at: number; crack?: number; gray?: number; top?: number; k?: number }> = ({ p, x, at, crack, gray = 0, top = 400, k = 1 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const tc = teamColor(x.team);
  const inn = spring({ frame: f - at, fps, config: { damping: 13, stiffness: 110, mass: 0.9 } });
  const ry = (1 - inn) * 80 + Math.sin(f / 24) * 9, rx = 5 + Math.cos(f / 31) * 3;
  const sweep = interpolate(f, [at + 14, at + 34], [-120, 220], clamp);
  const sweep2 = interpolate(f, [at + 70, at + 90], [-120, 220], clamp);
  const cw = 620, ch = 760;
  return (
    <div style={{ position: "absolute", top, left: (W - cw) / 2, width: cw, height: ch, perspective: 1500, scale: String(k), transformOrigin: "50% 0%" }}>
      <div style={{ width: "100%", height: "100%", transform: `rotateY(${ry}deg) rotateX(${rx}deg) scale(${0.7 + 0.3 * inn})`, opacity: Math.min(1, inn * 2), borderRadius: 46, overflow: "hidden", position: "relative",
        background: `linear-gradient(165deg, ${tc}, ${tc}66 55%, #061209)`, boxShadow: `0 0 0 5px ${tc}, 0 0 90px ${tc}aa, 0 50px 90px rgba(0,0,0,0.7)`, filter: gray ? `grayscale(${gray}) brightness(${1 - gray * 0.25})` : undefined }}>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 260, color: "rgba(255,255,255,0.25)" }}>{initialsOf(x.n)}</div>
        <Img src={staticFile(`${p.source}/h/${x.id}.jpg`)} onError={() => undefined} style={{ position: "absolute", top: 0, left: -40, width: cw + 80, height: ch * 0.86, objectFit: "cover", objectPosition: "50% 10%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(4,17,11,0.92) 82%)" }} />
        <div style={{ position: "absolute", left: 36, right: 36, bottom: 30 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, lineHeight: 0.95, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: "rgba(255,255,255,0.75)" }}>{x.pos} · {x.team}</div>
        </div>
        {[sweep, sweep2].map((sx, i) => <div key={i} style={{ position: "absolute", top: -200, bottom: -200, left: `${sx}%`, width: "28%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)", rotate: "18deg", mixBlendMode: "overlay" }} />)}
        {crack != null && f >= crack ? (
          <svg width={cw} height={ch} style={{ position: "absolute", inset: 0 }}>
            {["M310 120 L280 260 L330 330 L250 470 L300 560 L270 700", "M280 260 L170 300 L90 280", "M330 330 L450 360 L540 330", "M250 470 L140 520", "M300 560 L420 610 L520 600"].map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeDasharray={900} strokeDashoffset={interpolate(f, [crack + i * 2, crack + i * 2 + 8], [900, 0], clamp)} style={{ filter: `drop-shadow(0 0 10px ${C.red})` }} />
            ))}
          </svg>
        ) : null}
      </div>
    </div>
  );
};
// Points vs projection: the bar fills past (or stops short of) the projection tick; the difference pops as a badge.
const Meter: React.FC<{ x: Pl; at: number; good: boolean; showCount?: boolean }> = ({ x, at, good, showCount = true }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const max = Math.max(x.pts, x.proj) * 1.18 || 1, Wb = W - L - R - 10;
  const v = interpolate(f, [at, at + 34], [0, x.pts], { ...clamp, easing: (k) => 1 - Math.pow(1 - k, 3) });
  const projX = (x.proj / max) * Wb, fillW = (v / max) * Wb;
  const passed = x.pts >= x.proj;
  // the fill eases 1-(1-k)^3, so it reaches the projection at k = 1 - cbrt(1 - proj/pts)
  const cross = passed && x.pts > 0 ? at + Math.round(34 * (1 - Math.cbrt(Math.max(0, 1 - x.proj / x.pts)))) : at + 34;
  const badge = spring({ frame: f - cross, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  const c = good ? C.turf : C.red, diff = Math.round((x.pts - x.proj) * 10) / 10;
  return (
    <div style={{ position: "absolute", top: 1195, left: L + 5, width: Wb, opacity: interpolate(f, [at - 6, at], [0, 1], clamp) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, letterSpacing: 4, color: C.dim }}>FANTASY POINTS</span>
        {showCount ? <Count at={at} to={x.pts} size={96} color={good ? C.gold : C.red} dur={34} /> : <span style={{ height: 96 }} />}
      </div>
      <div style={{ position: "relative", height: 34, borderRadius: 17, background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.18)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: fillW, borderRadius: 17, background: `linear-gradient(90deg, ${c}88, ${c})`, boxShadow: `0 0 30px ${c}` }} />
        <div style={{ position: "absolute", left: projX - 3, top: -14, width: 6, height: 62, borderRadius: 3, background: "#fff", boxShadow: f >= cross && passed ? `0 0 ${30 * (1 - Math.min(1, (f - cross) / 12))}px #fff` : undefined }} />
        <div style={{ position: "absolute", left: Math.min(projX - 70, Wb - 150), top: 52, fontFamily: BODY, fontWeight: 600, fontSize: 24, color: C.dim, whiteSpace: "nowrap" }}>PROJ {f1(x.proj)}</div>
      </div>
      {f >= cross ? <div style={{ position: "absolute", right: 0, top: -88, scale: String(2 - badge), opacity: Math.min(1, badge * 2), padding: "4px 18px", borderRadius: 14, background: c, color: "#04110B", fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, boxShadow: `0 0 40px ${c}` }}>{diff >= 0 ? "+" : ""}{f1(diff)}</div> : null}
    </div>
  );
};
const Chips: React.FC<{ items: string[]; at: number; color: string }> = ({ items, at, color }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: T + 100, left: L, right: R, display: "flex", flexWrap: "wrap", gap: 12 }}>
      {items.map((t, i) => { const k = spring({ frame: f - at - i * 5, fps, config: { damping: 13, stiffness: 180 } });
        return <div key={i} style={{ padding: "8px 18px", borderRadius: 14, background: "rgba(4,17,11,0.7)", border: `2px solid ${color}`, fontFamily: DISPLAY, fontWeight: 800, fontSize: 36, color: "#fff", opacity: Math.min(1, k * 2), translate: `${(1 - k) * -200}px 0`, boxShadow: `0 0 24px ${color}55` }}>{t}</div>; })}
    </div>
  );
};
const BigOutline: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const f = useCurrentFrame();
  return <div style={{ position: "absolute", top: 520, width: W, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 560, lineHeight: 1, color: "transparent", WebkitTextStroke: `4px ${color}`, opacity: 0.35, translate: `${interpolate(f, [0, 200], [60, -60])}px 0`, letterSpacing: -10 }}>{text}</div>;
};
const Hero: React.FC<{ p: AutoProps; s: Scene }> = ({ p, s }) => {
  const x = s.player!; const tc = teamColor(x.team); const c = col(s.color);
  return (
    <AbsoluteFill>
      <Base color={tc} color2={c} seed={x.id.length + 2} />
      <BigOutline text={f1(x.pts)} color={tc} />
      <Card p={p} x={x} at={3} />
      <Title s={s} accent={c} />
      <Chips items={statChips(x)} at={10} color={tc} />
      <Meter x={x} at={16} good />
      <Flash at={1} color={tc} peak={0.4} />
    </AbsoluteFill>
  );
};
// Bust: the card drops in, cracks, goes gray; the number glitches in red; the meter stops short of the projection.
const Bust: React.FC<{ p: AutoProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame(); const x = s.player!;
  const crack = 26;
  const gray = interpolate(f, [crack, crack + 14], [0, 0.85], clamp);
  const jit = (k: number) => (Math.sin(f * 7.1 + k * 3) > 0.7 ? Math.sin(f * 2.3 + k) * 14 : 0);
  return (
    <AbsoluteFill style={{ translate: useShake(crack, 22, 12) }}>
      <Base color={C.red} seed={9} />
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 45%, ${C.red}33, transparent 70%)` }} />
      <Card p={p} x={x} at={2} crack={crack} gray={gray} top={360} k={0.78} />
      {f >= crack ? <div style={{ position: "absolute", top: 945, left: 0, width: W, textAlign: "center" }}>
        {[["#00E5FF", -1], [C.red, 1], ["#fff", 0]].map(([cc, k], i) => (
          <div key={i} style={{ position: i < 2 ? "absolute" : "relative", width: W, fontFamily: DISPLAY, fontWeight: 800, fontSize: 230, lineHeight: 1, color: cc as string, opacity: i < 2 ? 0.7 : 1, mixBlendMode: i < 2 ? "screen" : undefined, translate: `${jit(i) + (k as number) * 6}px ${jit(i + 5) * 0.4}px`, textShadow: i === 2 ? `0 0 60px ${C.red}` : undefined, scale: String(interpolate(f, [crack, crack + 5], [1.6, 1], clamp)) }}>{f1(x.pts)}</div>
        ))}
      </div> : null}
      <Title s={s} accent={C.red} />
      <Meter x={x} at={12} good={false} showCount={false} />
      {s.stamp ? <div style={{ position: "absolute", top: 370, right: R - 30 }}><Stamp text={s.stamp} color={C.red} at={crack + 10} size={84} rot={9} /></div> : null}
      <Sparks at={crack} x={W / 2} y={780} color={C.red} n={22} />
      <Flash at={crack} color={C.red} peak={0.5} />
    </AbsoluteFill>
  );
};
// Several games: a quick grid of finals.
const Scores: React.FC<{ p: AutoProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Base color={C.turf} seed={4} />
      <Title s={s} accent={C.turf} />
      <div style={{ position: "absolute", top: 420, left: L - 20, right: R - 60, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {p.scores.map((g, i) => { const k = spring({ frame: f - 4 - i * 2, fps, config: { damping: 14, stiffness: 150 } }); const aw = g.away.s > g.home.s;
          return <div key={i} style={{ padding: "12px 20px", borderRadius: 22, background: "rgba(4,17,11,0.7)", border: "2px solid rgba(255,255,255,0.15)", opacity: k, scale: String(0.8 + 0.2 * k) }}>
            {[[g.away, aw], [g.home, !aw]].map(([t, w]: any, j) => <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Logo src={p.source} t={t.t} size={56} /><span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, color: w ? C.turf : C.dim }}>{t.s}</span></div>)}
          </div>; })}
      </div>
    </AbsoluteFill>
  );
};
// Closer: the app spins in on a 3D phone next to the QR code (held >= 3.5 s by the timing step).
const Cta: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const inn = interpolate(f, [0, 22], [0, 1], { ...clamp, easing: easeOut });
  return (
    <AbsoluteFill>
      <Base color={C.turf} seed={7} />
      <div style={{ position: "absolute", top: T - 10, left: L, right: R, textAlign: "center" }}>
        <Kinetic text={(s.title || "").replace("|", " ")} at={2} size={104} align="center" accent={C.gold} />
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.dim, marginTop: 10, opacity: interpolate(f, [14, 26], [0, 1], clamp) }}>free start/sit · trades · waivers · playoff odds</div>
      </div>
      <Phone3D src={s.appShot || "app/startsit-vp.png"} yaw={-1.3 + 0.95 * inn + Math.sin(f / 26) * 0.07} pitch={0.08} y={(1 - inn) * -2 + Math.sin(f / 22) * 0.05} scale={0.78} crop={0.7} glowColor={C.turf} height={1100} style={{ top: 470, left: -330 }} />
      <div style={{ position: "absolute", top: 640, right: R - 40 }}><AppLink at={10} size={300} align="center" /></div>
      <Flash at={1} color={C.turf} peak={0.45} />
    </AbsoluteFill>
  );
};

const TeamWipe: React.FC<{ color: string; dir: number }> = ({ color, dir }) => {
  const f = useCurrentFrame();
  if (f > 9) return null;
  const x = interpolate(f, [0, 9], [0, dir * W * 1.3], { ...clamp, easing: easeOut });
  return <AbsoluteFill style={{ pointerEvents: "none" }}><div style={{ position: "absolute", top: -200, bottom: -200, left: -W * 0.3, width: W * 0.45, background: color, translate: `${x}px 0`, rotate: "12deg", boxShadow: `0 0 80px ${color}`, opacity: 0.9 }} /></AbsoluteFill>;
};

export const AutoRecap: React.FC<AutoProps> = (p) => {
  let from = 0;
  const seqs = p.scenes.map(s => { const d = Math.round(s.dur * FPS); const x = { s, from, d }; from += d; return x; });
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      {seqs.map(({ s, from, d }, i) => (
        <Sequence key={s.id} name={s.id} from={from} durationInFrames={d}>
          <Whip dir={i % 2 ? -1 : 1}>
            {s.kind === "versus" ? <Versus p={p} s={s} /> : s.kind === "hero" ? <Hero p={p} s={s} /> : s.kind === "bust" ? <Bust p={p} s={s} />
              : s.kind === "scores" ? <Scores p={p} s={s} /> : <Cta s={s} />}
          </Whip>
          {i > 0 ? <TeamWipe color={s.player ? teamColor(s.player.team) : col(s.color)} dir={i % 2 ? -1 : 1} /> : null}
          {i === 0 ? <GlitchOpen line1={`WEEK ${p.week}`} line2={p.label || "RECAP"} dur={20} /> : null}
        </Sequence>
      ))}
      <Grain />
      <ProgressBar lens={seqs.map(x => x.d)} />
      {p.words ? <Captions words={p.words} /> : null}
      {p.voFull ? <Audio src={staticFile(`${p.source}/vo/${p.voFull}`)} /> : null}
    </AbsoluteFill>
  );
};
