import React from "react";
import { AbsoluteFill, Img, Interactive, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { z } from "zod";
import { BODY, C, DISPLAY, Field, Glass, SAFE, f1, teamColor, useIn } from "./theme";

// "Waiver Heat": the most-added players this week, each stamped ADD / FADE / TRAP.
// Data: public/<source>/waivers.json from scripts/waivers.mjs (Sleeper trending adds + projections).
const pl = z.object({ id: z.string(), n: z.string(), num: z.number().nullable().optional(), pos: z.string(), nfl: z.string(), adds: z.number(), proj: z.number(), opp: z.string().nullable(), last: z.number() });
export const waiverSchema = z.object({
  source: z.string(),
  week: z.number(),
  // Scene order. vo = clip name in <source>/vo, note = small line under the stamp.
  picks: z.array(z.object({ id: z.string(), vo: z.string(), verdict: z.enum(["ADD", "FADE", "TRAP"]), note: z.string() })),
  appShot: z.string(),
  voice: z.boolean(),
  music: z.enum(["bed", "none"]),
  players: z.array(pl).nullable(),
  voDur: z.record(z.string(), z.number()).nullable(),
});
export type WaiverProps = z.infer<typeof waiverSchema>;
type P = z.infer<typeof pl>;

const FPS = 30, T = 9;
const STAMP: Record<string, string> = { ADD: C.turf, FADE: C.pylon, TRAP: C.red };
const big = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);

const scenes = (p: WaiverProps) => [
  { id: "hook", vo: "hook", base: 3.2 },
  ...p.picks.map(k => ({ id: k.id, vo: k.vo, base: 3.4 })),
  { id: "cta", vo: "cta", base: 4 },
];
const frames = (p: WaiverProps, s: { vo: string; base: number; id: string }) => {
  const d = p.voice && p.voDur ? p.voDur[s.vo] : undefined;
  return Math.round((d ? Math.max(s.base, d + (s.id === "cta" ? 0.9 : 0.5)) : s.base) * FPS);
};
export const waiverFrames = (p: WaiverProps) => { const s = scenes(p); return s.reduce((n, x) => n + frames(p, x), 0) - T * (s.length - 1); };

// Small shake after an impact frame.
const useShake = (at: number, amp = 14) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 10) return "0px 0px";
  const k = amp * (1 - f / 10);
  return `${Math.sin(f * 2.7) * k}px ${Math.cos(f * 3.3) * k}px`;
};

const Heat: React.FC<{ color?: string }> = ({ color = C.pylon }) => {
  const f = useCurrentFrame();
  const o = 0.22 + 0.08 * Math.sin(f / 9);
  return <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 112%, ${color}, transparent 70%)`, opacity: o }} />;
};

const Top: React.FC<{ week: number; i?: number; n?: number }> = ({ week, i, n }) => {
  const t = useIn(0, 12);
  return (
    <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: t }}>
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, letterSpacing: 5, color: C.dim }}>WEEK {week} WAIVER WIRE</div>
      {n ? <div style={{ display: "flex", gap: 10 }}>{Array.from({ length: n }, (_, k) => (
        <div key={k} style={{ width: 34, height: 10, borderRadius: 5, background: k <= (i ?? -1) ? C.gold : "rgba(255,255,255,0.18)" }} />
      ))}</div> : null}
    </div>
  );
};

const Hook: React.FC<{ p: WaiverProps; top: P; dur: number }> = ({ p, top, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const land = 26;
  const v = Math.round(interpolate(f, [4, land], [0, top.adds], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 4) }));
  const pop = spring({ frame: f - land, fps, config: { damping: 9, stiffness: 180 } });
  const q = Math.min(dur * 0.62, dur - 30);
  const qs = spring({ frame: f - q, fps, config: { damping: 11, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <Field /><Heat />
      <Top week={p.week} />
      <AbsoluteFill style={{ translate: useShake(land, 18), justifyContent: "center", paddingLeft: SAFE.left, paddingRight: SAFE.right }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 210, lineHeight: 0.9, color: C.gold, scale: String(1 + 0.08 * pop * (1 - Math.min(1, (f - land) / 20))), fontVariantNumeric: "tabular-nums", letterSpacing: -2 }}>
          {v.toLocaleString("en-US")}
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 76, lineHeight: 1, color: C.ink, marginTop: 18, opacity: useIn(land - 4, 10) }}>
          PEOPLE GRABBED<br />THIS GUY IN 48 HOURS
        </div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 1, color: C.pylon, marginTop: 60, opacity: qs, scale: String(0.6 + 0.4 * qs), transformOrigin: "left center", rotate: `${(1 - qs) * -8}deg` }}>
          SHOULD YOU?
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Bar: React.FC<{ label: string; v: number; max: number; color: string; at: number }> = ({ label, v, max, color, at }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [at, at + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  return (
    <div style={{ marginTop: 26, opacity: Math.min(1, t * 3) }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.dim, letterSpacing: 2 }}>
        <span>{label}</span><span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 70, color: C.ink }}>{f1(v * t)}</span>
      </div>
      <div style={{ height: 30, borderRadius: 15, background: "rgba(255,255,255,0.1)", marginTop: 6, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(2, (v / max) * 100) * t}%`, height: "100%", borderRadius: 11, background: color, boxShadow: `0 0 24px ${color}` }} />
      </div>
    </div>
  );
};

const Card: React.FC<{ p: WaiverProps; x: P; k: WaiverProps["picks"][number]; i: number; dur: number }> = ({ p, x, k, i, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tc = teamColor(x.nfl), sc = STAMP[k.verdict];
  const enter = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const stampAt = Math.max(30, dur - 30);
  const st = spring({ frame: f - stampAt, fps, config: { damping: 10, stiffness: 220, mass: 0.7 } });
  const words = x.n.toUpperCase().split(" ");
  const max = Math.max(x.last, x.proj, 10);
  return (
    <AbsoluteFill>
      <Field /><Heat color={tc} />
      {/* Giant jersey number drifting behind the card */}
      <div style={{ position: "absolute", right: -40, top: 360, fontFamily: DISPLAY, fontWeight: 800, fontSize: 1100, lineHeight: 0.8, color: tc, opacity: 0.22, translate: `${(1 - enter) * 300 - f * 0.8}px 0`, letterSpacing: -40 }}>
        {x.num ?? x.pos}
      </div>
      <Top week={p.week} i={i} n={p.picks.length} />
      <AbsoluteFill style={{ translate: useShake(stampAt, 16) }}>
        <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: SAFE.top + 150, translate: `${(1 - enter) * 900}px 0` }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, color: "#061209", background: tc, padding: "4px 18px", borderRadius: 12 }}>{x.pos} · {x.nfl}</div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 42, color: C.gold }}>🔥 {big(x.adds)} adds</div>
          </div>
          <div style={{ marginTop: 18 }}>
            {words.map((w, j) => {
              const t = spring({ frame: f - 6 - j * 4, fps, config: { damping: 14, stiffness: 140 } });
              return <div key={j} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 172, lineHeight: 0.88, color: C.ink, opacity: t, translate: `0 ${(1 - t) * 80}px` }}>{w}</div>;
            })}
          </div>
          <Glass style={{ marginTop: 48, padding: "22px 44px 40px" }}>
            <Bar label="LAST WEEK" v={x.last} max={max} color={C.slate} at={14} />
            <Bar label={`WEEK ${p.week} PROJ${x.opp ? " · vs " + x.opp : " · BYE"}`} v={x.proj} max={max} color={sc} at={26} />
          </Glass>
        </div>
        {/* Verdict stamp */}
        <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, bottom: SAFE.bottom + 30, display: "flex", flexDirection: "column", alignItems: "center", opacity: Math.min(1, st * 2) }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 210, lineHeight: 1, color: sc, border: `14px solid ${sc}`, borderRadius: 30, padding: "0 50px", rotate: "-8deg", scale: String(2.6 - 1.6 * st), boxShadow: `0 0 80px -10px ${sc}, inset 0 0 40px -10px ${sc}`, textShadow: `0 0 40px ${sc}` }}>
            {k.verdict}
          </div>
          <div style={{ marginTop: 26, fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.ink, opacity: interpolate(f, [stampAt + 8, stampAt + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{k.note}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ p: WaiverProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const up = spring({ frame: f - 4, fps, config: { damping: 16, stiffness: 90 } });
  const scroll = interpolate(f, [24, dur], [0, -260], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t2 = useIn(14, 14);
  return (
    <AbsoluteFill>
      <Field /><Heat color={C.turf} />
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, textAlign: "center", opacity: t2, translate: `0 ${(1 - t2) * -30}px` }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 104, lineHeight: 0.95, color: C.ink }}>YOUR LEAGUE.<br /><span style={{ color: C.turf }}>EVERY WEEK.</span></div>
      </div>
      {/* Phone with the real app */}
      <div style={{ position: "absolute", left: "50%", top: 560, width: 560, height: 1060, marginLeft: -280 - (SAFE.right - SAFE.left) / 2, borderRadius: 72, background: "#050a07", padding: 18, boxShadow: "0 0 0 4px rgba(255,255,255,0.18), 0 60px 120px -30px rgba(0,0,0,0.9), 0 0 120px -40px " + C.turf, translate: `0 ${(1 - up) * 900}px`, rotate: `${(1 - up) * 8}deg` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 56, overflow: "hidden", position: "relative" }}>
          <Img src={staticFile(p.appShot)} style={{ width: "100%", position: "absolute", top: scroll }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, bottom: SAFE.bottom - 120, textAlign: "center", opacity: useIn(30, 12) }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 72, color: C.gold }}>WAR ROOM · FREE</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.ink }}>Link in bio</div>
      </div>
    </AbsoluteFill>
  );
};

export const WaiverHeat: React.FC<WaiverProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  if (!p.players) return <AbsoluteFill style={{ background: "#04110B" }} />;
  const byId = new Map(p.players.map(x => [x.id, x]));
  const top = [...p.players].sort((a, b) => b.adds - a.adds)[0];
  const list = scenes(p);
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      <TransitionSeries>
        {list.flatMap((s, i) => {
          const d = frames(p, s);
          const pick = p.picks.find(k => k.id === s.id);
          const body = s.id === "hook" ? <Hook p={p} top={top} dur={d} />
            : s.id === "cta" ? <Cta p={p} dur={d} />
            : <Card p={p} x={byId.get(s.id)!} k={pick!} i={i - 1} dur={d} />;
          const seq = (
            <TransitionSeries.Sequence key={s.id} name={s.id} durationInFrames={d}>
              {body}
              {p.voice && p.voDur && p.voDur[s.vo] ? <Sequence from={i === 0 ? 2 : 5} layout="none"><Audio src={staticFile(`${p.source}/vo/${s.vo}.mp3`)} /></Sequence> : null}
            </TransitionSeries.Sequence>
          );
          if (i === 0) return [seq];
          return [<TransitionSeries.Transition key={s.id + "-t"} timing={linearTiming({ durationInFrames: T })}
            presentation={(i % 2 ? wipe({ direction: "from-right" }) : slide({ direction: "from-right" })) as ReturnType<typeof slide>} />, seq];
        })}
      </TransitionSeries>
      {p.music === "bed" ? (
        <Interactive.Div name="Music">
          <Audio src={staticFile("beat.wav")} loop volume={(f) => interpolate(f, [0, 10, durationInFrames - 20, durationInFrames], [0, p.voice ? 0.16 : 0.55, p.voice ? 0.16 : 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
