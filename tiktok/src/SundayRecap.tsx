import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { AppLink, BODY, C, DISPLAY, Field, Glass, SAFE, f1, initialsOf, teamColor } from "./theme";
import { Flash, Kinetic, Particles, Slam, Stamp, W, clamp, useShake } from "./fx";
import { Captions, GlitchOpen, Grain, ImpactFX, ProgressBar, TeamWipe, Vignette, Whip, gradeStyle, impactShake } from "./polish";
import { Freeze } from "remotion";

// "Sunday Recap": the night's fantasy story told over that day's real highlights (owner's call on footage, 2026-10-30).
// Clip-first: every storyline scene is a full-bleed 1080x1920 clip (pre-cut by clips/cut.py) with a stat card over the
// bottom third. Data-driven: public/<source>/plan.json lists the scenes; numbers come from scripts/sunday.mjs.
const player = z.object({ id: z.string(), n: z.string(), pos: z.string(), team: z.string(), pts: z.number(), proj: z.number(), line: z.string() });
const scene = z.object({
  id: z.string(), kind: z.enum(["boom", "stats", "bust", "scores", "cta", "chapter", "news", "adds", "mnf"]), base: z.number(),
  clip: z.string().nullable().default(null), clipFrom: z.number().default(0), // seconds into the pre-cut clip
  title: z.string().default(""), stamp: z.string().default(""), color: z.string().default("gold"),
  player: player.nullable().default(null), players: z.array(player).default([]),
  tiles: z.array(z.object({ v: z.number(), dec: z.number().default(0), label: z.string() })).default([]),
  big: z.string().default(""),
  sub: z.string().default(""), headline: z.string().default(""), projLabel: z.string().optional(), ptsLabel: z.string().optional(),
  rows: z.array(z.object({ player, count: z.number(), note: z.string().default("") })).default([]),   // adds
  game: z.object({ away: z.string(), home: z.string(), when: z.string(), line: z.string() }).nullable().default(null), // mnf
  keyIn: z.number().optional(), impact: z.string().optional(), // v2: seconds into the scene of the clip's big moment; slam word
  dur: z.number().optional(), // fixed scene length (s): set when scenes are timed to one continuous voice take
});
export const sundaySchema = z.object({
  source: z.string(), week: z.number(), voice: z.boolean(), voDur: z.record(z.string(), z.number()).nullable(),
  words: z.array(z.object({ t: z.string(), s: z.number(), e: z.number() })).nullable().optional(), // caption timings (sunday-plan.py)
  captions: z.boolean().optional(),
  voFull: z.string().nullable().optional(), // one continuous voice take for the whole video (preferred: natural flow)
  scenes: z.array(scene),
  scores: z.array(z.object({ away: z.object({ t: z.string(), s: z.number() }), home: z.object({ t: z.string(), s: z.number() }), ot: z.boolean() })),
});
export type SundayProps = z.infer<typeof sundaySchema>;
type Scene = z.infer<typeof scene>; type Pl = z.infer<typeof player>;
const FPS = 30;
const secs = (p: SundayProps, s: Scene) => { if (s.dur) return s.dur; const d = p.voice && p.voDur ? p.voDur[s.id] : undefined; return d ? Math.max(s.base, d + (s.kind === "cta" ? 1.2 : 0.45)) : s.base; };
export const sundayFrames = (p: SundayProps) => p.scenes.reduce((n, s) => n + Math.round(secs(p, s) * FPS), 0);
const col = (c: string) => (C as Record<string, string>)[c] || c;
const L = SAFE.left, R = SAFE.right, T = SAFE.top, Wd = W - L - R;

const Head: React.FC<{ src: string; x: Pl; size: number }> = ({ src, x, size }) => {
  const tc = teamColor(x.team);
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: `linear-gradient(160deg, ${tc}, ${tc}88)`, overflow: "hidden", position: "relative", flex: "none", display: "grid", placeItems: "center", boxShadow: `0 0 ${size * 0.35}px ${tc}66, inset 0 0 0 4px rgba(255,255,255,0.22)` }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.4, color: "#fff" }}>{initialsOf(x.n)}</span>
      <Img src={staticFile(`${src}/h/${x.id}.jpg`)} onError={() => undefined} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 12%", transform: "scale(1.1)" }} />
    </div>
  );
};
const Count: React.FC<{ at: number; to: number; size: number; color: string; dec?: number }> = ({ at, to, size, color, dec = 1 }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + 26], [0, to], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
  return <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 0.9, color, fontVariantNumeric: "tabular-nums", textShadow: `0 0 50px ${color}66` }}>{v.toFixed(dec)}</span>;
};
// The highlight, full bleed, darkened at top and bottom so text reads. Must sit inside the scene's Sequence.
const HOLD = 0.45; // seconds the play freezes on its big moment (v2)
const Clip: React.FC<{ src: string; file: string; from: number; dim?: number; keyIn?: number }> = ({ src, file, from, dim = 0, keyIn }) => {
  const f = useCurrentFrame();
  const kf = keyIn != null ? Math.round(keyIn * FPS) : null, H = Math.round(HOLD * FPS);
  // slow drift, then a hard punch-in on the frozen frame, easing back out when play resumes
  const base = interpolate(f, [0, 150], [1.04, 1.12], clamp);
  const punch = kf == null ? 0 : interpolate(f, [kf, kf + 4, kf + H, kf + H + 10], [0, 0.2, 0.24, 0.06], { ...clamp, easing: (v) => 1 - Math.pow(1 - v, 3) });
  const vstyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", scale: String(base + punch), ...gradeStyle,
    filter: kf != null && f >= kf && f < kf + H ? "contrast(1.25) saturate(1.45) brightness(1.06)" : gradeStyle.filter };
  const vid = (startSec: number) => <OffthreadVideo src={staticFile(`${src}/clips/${file}`)} startFrom={Math.round(startSec * FPS)} muted style={vstyle} />;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      {kf == null ? vid(from) : (
        <>
          <Sequence durationInFrames={kf} layout="none">{vid(from)}</Sequence>
          <Sequence from={kf} durationInFrames={H} layout="none"><Freeze frame={kf}>{vid(from)}</Freeze></Sequence>
          <Sequence from={kf + H} layout="none">{vid(from + kf / FPS)}</Sequence>
        </>
      )}
      <Vignette />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(4,17,11,${0.72 + dim}) 0%, rgba(4,17,11,${0.1 + dim}) 24%, rgba(4,17,11,${0.05 + dim}) 52%, rgba(4,17,11,${0.85 + dim}) 74%, rgba(4,17,11,0.95) 100%)` }} />
    </AbsoluteFill>
  );
};

const SceneShake: React.FC<{ at: number | null; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ transform: at == null ? undefined : impactShake(f, at) || undefined }}>{children}</AbsoluteFill>;
};

const Boom: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const x = s.player!; const c = col(s.color ?? "gold");
  const inn = spring({ frame: f - 8, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ translate: useShake(10, 16, 9) }}>
      {s.clip ? <Clip src={p.source} file={s.clip} from={s.clipFrom ?? 0} keyIn={s.keyIn} /> : <><Field /><Particles n={60} color={teamColor(x.team)} seed={s.id} speed={2} size={8} /></>}
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={c} /></div>
      <Glass style={{ position: "absolute", top: 1130, left: L - 20, width: Wd + 40, padding: "26px 30px", display: "flex", gap: 26, alignItems: "center", opacity: inn, translate: `0 ${(1 - inn) * 260}px` }} tint="rgba(4,17,11,0.62)">
        <Head src={p.source} x={x} size={170} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.pos} · {x.team} · {x.line}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6 }}>
            <Count at={14} to={x.pts} size={118} color={c} /><span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim }}>{s.ptsLabel ?? "PPR"}</span>
            <span style={{ marginLeft: "auto", fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, padding: "6px 14px", borderRadius: 14, background: "rgba(255,255,255,0.08)" }}>{s.projLabel ?? "proj"} {f1(x.proj)}</span>
          </div>
        </div>
      </Glass>
      {s.stamp ? <div style={{ position: "absolute", top: 930, left: L, right: R, display: "flex", justifyContent: "flex-end" }}><Stamp text={s.stamp} color={c} at={Math.round(d * FPS * 0.55)} size={96} rot={-7} /></div> : null}
      <Flash at={0} color="#fff" peak={0.45} />
    </AbsoluteFill>
  );
};

// v2 (2026-11-08): a scene with no game clip still needs motion: the two teams' colors split the screen diagonally and drift.
const TeamSplit: React.FC<{ a?: string; b?: string; seed: string }> = ({ a, b, seed }) => {
  const f = useCurrentFrame();
  const ca = a ? teamColor(a) : C.turf, cb = b ? teamColor(b) : C.slate;
  const sweep = interpolate(f, [0, 18], [-40, 0], { ...clamp, easing: (v) => 1 - Math.pow(1 - v, 3) });
  const drift = Math.sin(f / 20) * 30;
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `linear-gradient(${115 + drift / 10}deg, ${ca}66 0%, ${ca}22 ${45 + sweep}%, transparent ${46 + sweep}%, transparent ${54 - sweep}%, ${cb}22 ${55 - sweep}%, ${cb}66 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(700px 520px at ${22 + drift / 6}% 60%, ${ca}55, transparent 70%), radial-gradient(700px 520px at ${78 - drift / 6}% 60%, ${cb}55, transparent 70%)` }} />
      <Particles n={70} color={ca} seed={seed} speed={3} size={8} />
    </AbsoluteFill>
  );
};

const Stats: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const c = col(s.color ?? "gold");
  return (
    <AbsoluteFill>
      {s.clip ? <Clip src={p.source} file={s.clip} from={s.clipFrom ?? 0} dim={0.08} keyIn={s.keyIn} /> : <TeamSplit a={s.tiles?.[0]?.label} b={s.tiles?.[1]?.label} seed={s.id} />}
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={c} /></div>
      <div style={{ position: "absolute", top: 1010, left: L - 10, width: Wd + 20, display: "flex", gap: 18 }}>
        {(s.tiles ?? []).map((t, i) => {
          const inn = spring({ frame: f - (6 + i * 7), fps, config: { damping: 12, stiffness: 130 } });
          return (
            <Glass key={i} style={{ flex: 1, padding: "22px 10px", textAlign: "center", scale: String(0.6 + 0.4 * inn), opacity: inn }} tint="rgba(4,17,11,0.6)">
              <Count at={8 + i * 7} to={t.v} size={104} color={i === 0 ? c : C.ink} dec={t.dec ?? 0} />
              <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, letterSpacing: 2, color: C.dim, marginTop: 6 }}>{t.label}</div>
            </Glass>
          );
        })}
      </div>
      {s.stamp ? <div style={{ position: "absolute", top: 860, left: L, right: R, display: "flex", justifyContent: "flex-end" }}><Stamp text={s.stamp} color={c} at={Math.round(d * FPS * 0.6)} size={88} rot={-5} /></div> : null}
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
};

const Bust: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const c = col(s.color ?? "gold");
  return (
    <AbsoluteFill style={{ translate: useShake(4, 22, 12) }}>
      {s.clip ? <Clip src={p.source} file={s.clip} from={s.clipFrom ?? 0} dim={0.12} keyIn={s.keyIn} /> : <><Field /><AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 40%, ${c}33, transparent 70%)` }} /></>}
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={c} /></div>
      {s.big ? <div style={{ position: "absolute", top: 420, left: 0, width: W, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 380, lineHeight: 1, color: c, textShadow: `0 0 90px ${c}88` }}><Slam at={4}>{s.big}</Slam></div> : null}
      <div style={{ position: "absolute", top: (s.players ?? []).length > 2 ? 800 : 980, left: L - 10, width: Wd + 20, display: "flex", flexDirection: "column", gap: (s.players ?? []).length > 2 ? 10 : 16 }}>
        {(s.players ?? []).map((x, i) => {
          const inn = spring({ frame: f - (16 + i * 8), fps, config: { damping: 14, stiffness: 120 } });
          return (
            <Glass key={x.id} style={{ padding: "16px 24px", display: "flex", gap: 22, alignItems: "center", opacity: inn, translate: `${(1 - inn) * (i % 2 ? 700 : -700)}px 0` }} tint="rgba(40,8,8,0.62)">
              <Head src={p.source} x={x} size={(s.players ?? []).length > 2 ? 86 : 104} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, marginTop: 4 }}>proj {f1(x.proj)}</div>
              </div>
              <Count at={20 + i * 8} to={x.pts} size={92} color={c} />
            </Glass>
          );
        })}
      </div>
      {s.stamp ? <div style={{ position: "absolute", top: 330, left: L, right: R, display: "flex", justifyContent: "flex-end" }}><Stamp text={s.stamp} color={c} at={Math.round(d * FPS * 0.62)} size={84} rot={8} /></div> : null}
      <Flash at={0} color={c} peak={0.35} />
    </AbsoluteFill>
  );
};

const Scores: React.FC<{ p: SundayProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const g = p.scores; const cols = 2, rowH = Math.min(150, 1060 / Math.ceil(g.length / cols));
  return (
    <AbsoluteFill>
      <Field /><Particles n={40} color={C.turf} seed="scores" speed={1.2} size={6} />
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={C.turf} /></div>
      <div style={{ position: "absolute", top: 400, left: L - 20, width: Wd + 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {g.map((x, i) => {
          const inn = spring({ frame: f - (4 + i * 2), fps, config: { damping: 15, stiffness: 150 } });
          const aw = x.away.s > x.home.s;
          const Row = ({ t, sc, win }: { t: string; sc: number; win: boolean }) => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: rowH * 0.3, color: win ? C.ink : C.dim }}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 6, background: teamColor(t), marginRight: 10 }} />{t}</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: rowH * 0.32, color: win ? C.turf : C.dim, fontVariantNumeric: "tabular-nums" }}>{sc}</span>
            </div>
          );
          return (
            <Glass key={i} style={{ height: rowH - 14, padding: "6px 22px", display: "flex", flexDirection: "column", justifyContent: "center", opacity: inn, scale: String(0.8 + 0.2 * inn), position: "relative" }}>
              <Row t={x.away.t} sc={x.away.s} win={aw} /><Row t={x.home.t} sc={x.home.s} win={!aw} />
              {x.ot ? <span style={{ position: "absolute", top: 8, left: "50%", translate: "-50% 0", fontFamily: BODY, fontWeight: 700, fontSize: 20, letterSpacing: 3, color: C.gold }}>OT</span> : null}
            </Glass>
          );
        })}
      </div>
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Field /><Particles n={70} color={C.turf} seed="cta" speed={2} size={8} />
      <div style={{ position: "absolute", top: T + 10, left: L, right: R, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 112, lineHeight: 0.92, color: C.ink }}><Slam at={2}>{s.title.split("|")[0]}</Slam></div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 112, lineHeight: 0.92, color: C.gold }}><Slam at={8}>{s.title.split("|")[1] || ""}</Slam></div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim, marginTop: 18, opacity: interpolate(f, [16, 28], [0, 1], clamp) }}>start/sit · trades · waivers · playoff odds · free</div>
      </div>
      <div style={{ position: "absolute", top: 720, left: 0, width: W, display: "flex", justifyContent: "center" }}><AppLink at={14} size={320} /></div>
      <Flash at={2} color={C.turf} peak={0.5} />
    </AbsoluteFill>
  );
};


// "WHAT WE KNOW NOW": a chapter card between the highlights and the takeaways.
const Chapter: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const sweep = interpolate(f, [0, 18], [-W, W], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  return (
    <AbsoluteFill style={{ translate: useShake(6, 14, 8) }}>
      <Field /><Particles n={60} color={C.gold} seed="chapter" speed={2.4} size={8} />
      <div style={{ position: "absolute", top: 600, left: 0, width: W, height: 14, background: C.gold, translate: `${sweep}px 0`, boxShadow: `0 0 60px ${C.gold}` }} />
      <div style={{ position: "absolute", top: 660, left: L, right: R, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, lineHeight: 0.9, color: C.ink }}><Slam at={3}>{s.title.split("|")[0]}</Slam></div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, lineHeight: 0.9, color: C.gold, textShadow: `0 0 70px ${C.gold}66` }}><Slam at={9}>{s.title.split("|")[1] || ""}</Slam></div>
        {s.sub ? <div style={{ marginTop: 34, fontFamily: BODY, fontWeight: 600, fontSize: 38, letterSpacing: 4, color: C.dim, opacity: interpolate(f, [16, 28], [0, 1], clamp) }}>{s.sub}</div> : null}
      </div>
      <Flash at={3} color={C.gold} peak={0.6} />
    </AbsoluteFill>
  );
};

// Breaking news about one player (injury, role change): big headshot, headline, verdict stamp.
const News: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const x = s.player!; const c = col(s.color ?? "red");
  const inn = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 100 } });
  return (
    <AbsoluteFill>
      <Field /><AbsoluteFill style={{ background: `radial-gradient(900px 800px at 50% 42%, ${teamColor(x.team)}55, transparent 70%)` }} />
      <Particles n={40} color={c} seed={s.id} speed={1.4} size={7} />
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={c} /></div>
      <div style={{ position: "absolute", top: 470, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", opacity: inn, scale: String(0.75 + 0.25 * inn) }}>
        <Head src={p.source} x={x} size={420} />
        <div style={{ marginTop: 26, fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, color: C.ink }}>{x.n.toUpperCase()}</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.dim, marginTop: 6 }}>{x.pos} · {x.team}</div>
      </div>
      <Glass style={{ position: "absolute", top: 1150, left: L - 20, width: Wd + 40, padding: "26px 34px", opacity: interpolate(f, [12, 22], [0, 1], clamp) }} tint="rgba(40,8,8,0.6)">
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 58, lineHeight: 1.05, color: C.ink }}>{s.headline}</div>
        {s.sub ? <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim, marginTop: 10 }}>{s.sub}</div> : null}
      </Glass>
      {s.stamp ? <div style={{ position: "absolute", top: 520, left: L, right: R, display: "flex", justifyContent: "flex-end" }}><Stamp text={s.stamp} color={c} at={Math.round(d * FPS * 0.45)} size={100} rot={8} /></div> : null}
      <Flash at={0} color={c} peak={0.4} />
    </AbsoluteFill>
  );
};

// Waiver wire: most-added players with live add counts as bars.
const Adds: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const max = Math.max(...(s.rows ?? []).map(r => r.count), 1);
  return (
    <AbsoluteFill>
      <Field /><Particles n={40} color={C.turf} seed="adds" speed={1.4} size={7} />
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={C.turf} /></div>
      {s.sub ? <div style={{ position: "absolute", top: T + 90, left: L, right: R, fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.dim }}>{s.sub}</div> : null}
      <div style={{ position: "absolute", top: 470, left: L - 10, width: Wd + 20, display: "flex", flexDirection: "column", gap: 22 }}>
        {(s.rows ?? []).map((r, i) => {
          const inn = spring({ frame: f - (6 + i * 8), fps, config: { damping: 14, stiffness: 120 } });
          const v = interpolate(f, [8 + i * 8, 40 + i * 8], [0, r.count], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
          return (
            <Glass key={r.player.id} style={{ padding: "22px 28px", display: "flex", gap: 24, alignItems: "center", opacity: inn, translate: `${(1 - inn) * 600}px 0` }}>
              <Head src={p.source} x={r.player} size={130} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 50, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.player.n.toUpperCase()}</span>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, color: C.turf, fontVariantNumeric: "tabular-nums" }}>+{Math.round(v / 1000)}K</span>
                </div>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim }}>{r.player.pos} · {r.player.team} · {r.note}</div>
                <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.1)", marginTop: 10, overflow: "hidden" }}><div style={{ width: `${(v / max) * 100}%`, height: "100%", background: C.turf, boxShadow: `0 0 20px ${C.turf}` }} /></div>
              </div>
            </Glass>
          );
        })}
      </div>
      {s.stamp ? <div style={{ position: "absolute", top: 1330, left: L, right: R, display: "flex", justifyContent: "center" }}><Stamp text={s.stamp} color={C.turf} at={Math.round(d * FPS * 0.6)} size={90} rot={-5} /></div> : null}
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
};

// Monday night preview: matchup, line, the projected star.
const Mnf: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const g = s.game!; const x = s.player;
  const a = spring({ frame: f - 2, fps, config: { damping: 12, stiffness: 120 } }), b = spring({ frame: f - 8, fps, config: { damping: 12, stiffness: 120 } });
  return (
    <AbsoluteFill>
      <Field /><AbsoluteFill style={{ background: `linear-gradient(110deg, ${teamColor(g.away)}44 0%, transparent 45%, transparent 55%, ${teamColor(g.home)}44 100%)` }} />
      <Particles n={50} color={C.slate} seed="mnf" speed={1.8} size={7} />
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={C.slate} /></div>
      <div style={{ position: "absolute", top: 420, left: 0, width: W, display: "flex", justifyContent: "center", alignItems: "center", gap: 40 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 190, color: teamColor(g.away), textShadow: `0 0 60px ${teamColor(g.away)}88`, translate: `${(1 - a) * -500}px 0` }}>{g.away}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 70, color: C.dim }}>@</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 190, color: teamColor(g.home), textShadow: `0 0 60px ${teamColor(g.home)}88`, translate: `${(1 - b) * 500}px 0` }}>{g.home}</div>
      </div>
      <div style={{ position: "absolute", top: 650, left: L, right: R, textAlign: "center", fontFamily: BODY, fontWeight: 600, fontSize: 38, color: C.dim, opacity: interpolate(f, [12, 24], [0, 1], clamp) }}>{g.when} · {g.line}</div>
      {x ? (
        <Glass style={{ position: "absolute", top: 820, left: L - 20, width: Wd + 40, padding: "26px 30px", display: "flex", gap: 26, alignItems: "center", opacity: interpolate(f, [16, 28], [0, 1], clamp) }}>
          <Head src={p.source} x={x} size={170} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, letterSpacing: 3, color: C.slate }}>TOP PROJECTION</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 54, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}><Count at={20} to={x.proj} size={110} color={C.slate} /><span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim }}>PROJ PPR</span></div>
          </div>
        </Glass>
      ) : null}
      {s.stamp ? <div style={{ position: "absolute", top: 1230, left: L, right: R, display: "flex", justifyContent: "center" }}><Stamp text={s.stamp} color={C.slate} at={Math.round(d * FPS * 0.6)} size={88} rot={-5} /></div> : null}
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
};

const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ scale: String(interpolate(f, [0, 10], [1.07, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) })) }}>{children}</AbsoluteFill>;
};

export const SundayRecap: React.FC<SundayProps> = (p) => {
  let from = 0;
  const seqs = p.scenes.map(s => { const d = Math.round(secs(p, s) * FPS); const x = { s, from, d }; from += d; return x; });
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      {seqs.map(({ s, from, d }, i) => (
        <Sequence key={s.id} name={s.id} from={from} durationInFrames={d}>
          <SceneShake at={s.clip && s.keyIn != null ? Math.round(s.keyIn * FPS) + 1 : s.impact ? Math.round(d * 0.3) + 1 : null}><Whip dir={i % 2 ? -1 : 1}><Punch>
            {s.kind === "boom" ? <Boom p={p} s={s} d={d / FPS} /> : s.kind === "stats" ? <Stats p={p} s={s} d={d / FPS} /> : s.kind === "bust" ? <Bust p={p} s={s} d={d / FPS} />
              : s.kind === "scores" ? <Scores p={p} s={s} /> : s.kind === "chapter" ? <Chapter s={s} /> : s.kind === "news" ? <News p={p} s={s} d={d / FPS} />
              : s.kind === "adds" ? <Adds p={p} s={s} d={d / FPS} /> : s.kind === "mnf" ? <Mnf p={p} s={s} d={d / FPS} /> : <Cta s={s} />}
          </Punch></Whip></SceneShake>
          {s.clip && s.keyIn != null ? <ImpactFX at={Math.round(s.keyIn * FPS)} hold={Math.round(HOLD * FPS)} color={col(s.color ?? "gold")} text={s.impact} />
            : s.impact ? <ImpactFX at={Math.round(d * 0.3)} hold={8} color={s.tiles?.[0] ? teamColor(s.tiles[0].label) : col(s.color ?? "gold")} text={s.impact} /> : null}
          {i > 0 ? <TeamWipe color={s.player ? teamColor(s.player.team) : col(s.color ?? "gold")} dir={i % 2 ? -1 : 1} /> : null}
          {i === 0 ? <GlitchOpen line1={`WEEK ${p.week}`} line2="SUNDAY RECAP" /> : null}
          {p.voice && !p.voFull && p.voDur && p.voDur[s.id] ? <Sequence from={4} layout="none"><Audio src={staticFile(`${p.source}/vo/${s.id}.mp3`)} /></Sequence> : null}
        </Sequence>
      ))}
      <Grain />
      <ProgressBar lens={seqs.map(x => x.d)} />
      {p.voFull && p.words && p.captions !== false ? <Captions words={p.words} /> : null}
      {p.voice && p.voFull ? <Audio src={staticFile(`${p.source}/vo/${p.voFull}`)} /> : null}
    </AbsoluteFill>
  );
};
