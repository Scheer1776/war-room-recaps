import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { AppLink, BODY, C, DISPLAY, Field, Glass, SAFE, f1, initialsOf, teamColor } from "./theme";
import { Flash, Kinetic, Particles, Slam, Stamp, W, clamp, useShake } from "./fx";

// "Sunday Recap": the night's fantasy story told over that day's real highlights (owner's call on footage, 2026-10-30).
// Clip-first: every storyline scene is a full-bleed 1080x1920 clip (pre-cut by clips/cut.py) with a stat card over the
// bottom third. Data-driven: public/<source>/plan.json lists the scenes; numbers come from scripts/sunday.mjs.
const player = z.object({ id: z.string(), n: z.string(), pos: z.string(), team: z.string(), pts: z.number(), proj: z.number(), line: z.string() });
const scene = z.object({
  id: z.string(), kind: z.enum(["boom", "stats", "bust", "scores", "cta"]), base: z.number(),
  clip: z.string().nullable().default(null), clipFrom: z.number().default(0), // seconds into the pre-cut clip
  title: z.string().default(""), stamp: z.string().default(""), color: z.string().default("gold"),
  player: player.nullable().default(null), players: z.array(player).default([]),
  tiles: z.array(z.object({ v: z.number(), dec: z.number().default(0), label: z.string() })).default([]),
  big: z.string().default(""),
});
export const sundaySchema = z.object({
  source: z.string(), week: z.number(), voice: z.boolean(), voDur: z.record(z.string(), z.number()).nullable(),
  scenes: z.array(scene),
  scores: z.array(z.object({ away: z.object({ t: z.string(), s: z.number() }), home: z.object({ t: z.string(), s: z.number() }), ot: z.boolean() })),
});
export type SundayProps = z.infer<typeof sundaySchema>;
type Scene = z.infer<typeof scene>; type Pl = z.infer<typeof player>;
const FPS = 30;
const secs = (p: SundayProps, s: Scene) => { const d = p.voice && p.voDur ? p.voDur[s.id] : undefined; return d ? Math.max(s.base, d + (s.kind === "cta" ? 1.2 : 0.45)) : s.base; };
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
const Clip: React.FC<{ src: string; file: string; from: number; dim?: number }> = ({ src, file, from, dim = 0 }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 150], [1.04, 1.12], clamp);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <OffthreadVideo src={staticFile(`${src}/clips/${file}`)} startFrom={Math.round(from * FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover", scale: String(z) }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(4,17,11,${0.72 + dim}) 0%, rgba(4,17,11,${0.1 + dim}) 24%, rgba(4,17,11,${0.05 + dim}) 52%, rgba(4,17,11,${0.85 + dim}) 74%, rgba(4,17,11,0.95) 100%)` }} />
    </AbsoluteFill>
  );
};

const Boom: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const x = s.player!; const c = col(s.color ?? "gold");
  const inn = spring({ frame: f - 8, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ translate: useShake(10, 16, 9) }}>
      {s.clip ? <Clip src={p.source} file={s.clip} from={s.clipFrom ?? 0} /> : <><Field /><Particles n={60} color={teamColor(x.team)} seed={s.id} speed={2} size={8} /></>}
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={c} /></div>
      <Glass style={{ position: "absolute", top: 1130, left: L - 20, width: Wd + 40, padding: "26px 30px", display: "flex", gap: 26, alignItems: "center", opacity: inn, translate: `0 ${(1 - inn) * 260}px` }} tint="rgba(4,17,11,0.62)">
        <Head src={p.source} x={x} size={170} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.pos} · {x.team} · {x.line}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6 }}>
            <Count at={14} to={x.pts} size={118} color={c} /><span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim }}>PPR</span>
            <span style={{ marginLeft: "auto", fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, padding: "6px 14px", borderRadius: 14, background: "rgba(255,255,255,0.08)" }}>proj {f1(x.proj)}</span>
          </div>
        </div>
      </Glass>
      {s.stamp ? <div style={{ position: "absolute", top: 930, left: L, right: R, display: "flex", justifyContent: "flex-end" }}><Stamp text={s.stamp} color={c} at={Math.round(d * FPS * 0.55)} size={96} rot={-7} /></div> : null}
      <Flash at={0} color="#fff" peak={0.45} />
    </AbsoluteFill>
  );
};

const Stats: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const c = col(s.color ?? "gold");
  return (
    <AbsoluteFill>
      {s.clip ? <Clip src={p.source} file={s.clip} from={s.clipFrom ?? 0} dim={0.08} /> : <Field />}
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
      {s.stamp ? <div style={{ position: "absolute", top: 1290, left: L, right: R, display: "flex", justifyContent: "center" }}><Stamp text={s.stamp} color={c} at={Math.round(d * FPS * 0.6)} size={88} rot={-5} /></div> : null}
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
};

const Bust: React.FC<{ p: SundayProps; s: Scene; d: number }> = ({ p, s, d }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const c = col(s.color ?? "gold");
  return (
    <AbsoluteFill style={{ translate: useShake(4, 22, 12) }}>
      {s.clip ? <Clip src={p.source} file={s.clip} from={s.clipFrom ?? 0} dim={0.12} /> : <><Field /><AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 40%, ${c}33, transparent 70%)` }} /></>}
      <div style={{ position: "absolute", top: T - 20, left: L, right: R }}><Kinetic text={s.title} at={2} size={86} align="left" accent={c} /></div>
      {s.big ? <div style={{ position: "absolute", top: 420, left: 0, width: W, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 380, lineHeight: 1, color: c, textShadow: `0 0 90px ${c}88` }}><Slam at={4}>{s.big}</Slam></div> : null}
      <div style={{ position: "absolute", top: 980, left: L - 10, width: Wd + 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {(s.players ?? []).map((x, i) => {
          const inn = spring({ frame: f - (16 + i * 8), fps, config: { damping: 14, stiffness: 120 } });
          return (
            <Glass key={x.id} style={{ padding: "16px 24px", display: "flex", gap: 22, alignItems: "center", opacity: inn, translate: `${(1 - inn) * (i % 2 ? 700 : -700)}px 0` }} tint="rgba(40,8,8,0.62)">
              <Head src={p.source} x={x} size={104} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, marginTop: 4 }}>proj {f1(x.proj)}</div>
              </div>
              <Count at={20 + i * 8} to={x.pts} size={92} color={c} />
            </Glass>
          );
        })}
      </div>
      {s.stamp ? <div style={{ position: "absolute", top: 1330, left: L, right: R, display: "flex", justifyContent: "center" }}><Stamp text={s.stamp} color={c} at={Math.round(d * FPS * 0.62)} size={96} rot={5} /></div> : null}
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

const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ scale: String(interpolate(f, [0, 10], [1.07, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) })) }}>{children}</AbsoluteFill>;
};

export const SundayRecap: React.FC<SundayProps> = (p) => {
  let from = 0;
  const seqs = p.scenes.map(s => { const d = Math.round(secs(p, s) * FPS); const x = { s, from, d }; from += d; return x; });
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      {seqs.map(({ s, from, d }) => (
        <Sequence key={s.id} name={s.id} from={from} durationInFrames={d}>
          <Punch>
            {s.kind === "boom" ? <Boom p={p} s={s} d={d / FPS} /> : s.kind === "stats" ? <Stats p={p} s={s} d={d / FPS} /> : s.kind === "bust" ? <Bust p={p} s={s} d={d / FPS} />
              : s.kind === "scores" ? <Scores p={p} s={s} /> : <Cta s={s} />}
          </Punch>
          {p.voice && p.voDur && p.voDur[s.id] ? <Sequence from={4} layout="none"><Audio src={staticFile(`${p.source}/vo/${s.id}.mp3`)} /></Sequence> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
