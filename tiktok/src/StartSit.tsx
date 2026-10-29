import React from "react";
import { AbsoluteFill, Img, Interactive, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { BODY, C, DISPLAY, Field, Glass, SAFE, f1, teamColor } from "./theme";

// "Start/Sit Showdown": coin-flip start/sits. Two players at one position with (nearly) tied Sleeper projections,
// broken by recent form; one gets START, the other SIT. Built music-first: every cut and caption word lands on the beat.
// Data: public/<source>/startsit.json from scripts/startsit.mjs.
const pl = z.object({ id: z.string(), n: z.string(), num: z.number().nullable(), pos: z.string(), nfl: z.string(), opp: z.string(),
  proj: z.number(), last: z.array(z.number()), weeks: z.array(z.number()), avg: z.number() });
type P = z.infer<typeof pl>;
const duel = z.object({ top: z.string(), bottom: z.string(), win: z.string(), say: z.array(z.string()), verdict: z.string() });
export const startSitSchema = z.object({
  source: z.string(),
  week: z.number(),
  hook: z.array(z.string()),
  duels: z.array(duel),
  appShot: z.string(),
  music: z.enum(["bed", "none"]),
  // Voiceover: clips <source>/vo/{hook,d1,d2,d3,cta}.mp3 (see prep-vo.sh). The hook gets one extra beat to fit the line.
  voice: z.boolean().default(false),
  voDur: z.record(z.string(), z.number()).nullable().default(null),
  players: z.array(pl).nullable(),
});
export type StartSitProps = z.infer<typeof startSitSchema>;

// beat.wav is 112 BPM: one beat = 16.07 frames. Scenes start on beats so the cuts hit the kick.
const FPS = 30, BEAT = (60 / 112) * FPS;
const DUEL = 16, CTA = 11;
const hookBeats = (p: StartSitProps) => (p.voice ? 9 : 8);
const startBeat = (p: StartSitProps, i: number) => hookBeats(p) + i * DUEL;
export const startSitFrames = (p: StartSitProps) => Math.round((hookBeats(p) + p.duels.length * DUEL + CTA) * BEAT);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// Local frame of beat k inside a scene that starts at global beat s.
const bt = (s: number, k: number) => Math.round((s + k) * BEAT) - Math.round(s * BEAT);

const useShake = (at: number, amp = 14) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > 10) return "0px 0px";
  const k = amp * (1 - f / 10);
  return `${Math.sin(f * 2.7) * k}px ${Math.cos(f * 3.3) * k}px`;
};
const Flash: React.FC<{ at: number; color?: string }> = ({ at, color = "#fff" }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 1, at + 7], [0, 0.55, 0], clamp);
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} />;
};
// A word that slams in (scale 2.4 → 1) at frame `at`.
const Slam: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  return <span style={{ display: "inline-block", opacity: f < at ? 0 : Math.min(1, s * 3), scale: String(2.4 - 1.4 * s), ...style }}>{children}</span>;
};

// Kinetic caption: the line's words pop in one per half-beat, starting at frame `at`.
const Caption: React.FC<{ text: string; at: number; until: number; color?: string; size?: number }> = ({ text, at, until, color = C.ink, size: max = 92 }) => {
  const f = useCurrentFrame();
  const size = fit(text, 800, max);
  const { fps } = useVideoConfig();
  if (f < at || f >= until) return null;
  const out = interpolate(f, [until - 4, until], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, height: 120, display: "flex", justifyContent: "center", alignItems: "center", gap: 22, opacity: out }}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: f - at - Math.round(i * BEAT / 2), fps, config: { damping: 11, stiffness: 240, mass: 0.6 } });
        const hot = /^[\d.]+$/.test(w.replace(/[^\d.]/g, "")) && /\d/.test(w);
        return <span key={i} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1, color: hot ? C.gold : color, opacity: Math.min(1, s * 2), translate: `0 ${(1 - s) * 50}px`, scale: String(0.6 + 0.4 * s), textShadow: "0 6px 30px rgba(0,0,0,0.6)" }}>{w}</span>;
      })}
    </div>
  );
};

// 3D coin flip: rotates on Y, the face showing START or SIT depending on the angle.
const Coin: React.FC<{ at: number; size: number }> = ({ at, size }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: f - at, fps, config: { damping: 30, stiffness: 40 } });
  const deg = t * 1260 + Math.sin(f / 6) * 6; // 3.5 turns, settles on SIT
  const up = Math.sin(Math.min(1, t * 1.2) * Math.PI) * -120;
  const face = (label: string, color: string, back: boolean) => (
    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backfaceVisibility: "hidden", transform: back ? "rotateY(180deg)" : undefined,
      background: `radial-gradient(circle at 35% 30%, #fff3b0, ${C.gold} 45%, #a8780a 100%)`, boxShadow: "inset 0 0 0 14px rgba(120,80,0,0.45), inset 0 0 0 22px rgba(255,240,180,0.5)",
      display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.3, color }}>{label}</div>
  );
  return (
    <div style={{ width: size, height: size, perspective: 1400, opacity: f < at ? 0 : 1, translate: `0 ${up}px` }}>
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateY(${deg}deg)` }}>
        {face("START", "#0b5d33", false)}
        {face("SIT", "#8a1b14", true)}
      </div>
    </div>
  );
};

const Hook: React.FC<{ p: StartSitProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const b = (k: number) => bt(0, k);
  const pulse = 1 + 0.03 * Math.max(0, 1 - ((f % BEAT) / 6));
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 800px at 50% 105%, ${C.red}, transparent 70%)`, opacity: 0.28 }} />
      <AbsoluteFill style={{ translate: useShake(b(1), 22) }}>
        <div style={{ position: "absolute", top: SAFE.top + 10, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 250, lineHeight: 0.86, color: C.red, scale: String(pulse) }}>
            <Slam at={b(0)}>{p.hook[0]}</Slam>
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 196, lineHeight: 0.9, color: C.ink }}>
            <Slam at={b(1)}>{p.hook[1]}</Slam>
          </div>
        </div>
        <div style={{ position: "absolute", top: 820, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "center" }}>
          <Coin at={b(2)} size={330} />
        </div>
        <div style={{ position: "absolute", top: 1230, left: SAFE.left, right: SAFE.right, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, color: C.ink }}>
          <span style={{ fontSize: fit(p.hook[2], 820, 84) }}><Slam at={b(4)}>{p.hook[2]}</Slam></span>
          <div style={{ fontSize: 64, color: C.gold, marginTop: 14 }}><Slam at={b(6)}>{p.hook[3]}</Slam></div>
        </div>
      </AbsoluteFill>
      <Flash at={b(1)} color={C.red} />
    </AbsoluteFill>
  );
};

const fit = (w: string, room: number, max: number) => Math.min(max, Math.floor(room / (w.length * 0.47)));

const Card: React.FC<{ x: P; y: number; from: number; s: number; max: number; win: boolean | null; tieAt: number; formAt: number; stampAt: number }> = ({ x, y, from, s, max, win, tieAt, formAt, stampAt }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tc = teamColor(x.nfl);
  const enter = spring({ frame: f - s, fps, config: { damping: 15, stiffness: 130 } });
  const proj = interpolate(f, [tieAt, tieAt + 22], [0, x.proj], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const avg = interpolate(f, [formAt + 10, formAt + 34], [0, x.avg], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const st = spring({ frame: f - stampAt, fps, config: { damping: 10, stiffness: 220, mass: 0.7 } });
  const lose = win === false ? interpolate(f, [stampAt, stampAt + 10], [0, 1], clamp) : 0;
  const glow = win ? st : 0;
  const parts = x.n.toUpperCase().split(" ");
  const first = parts[0], rest = parts.slice(1).join(" ");
  const sc = win ? C.turf : C.red;
  return (
    <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: y, height: 470, translate: `${(1 - enter) * from * 1000}px 0`, scale: String(1 + 0.035 * glow - 0.03 * lose) }}>
      <Glass tint={`linear-gradient(100deg, ${tc}55, rgba(16,40,28,0.7) 45%)`} style={{ position: "absolute", inset: 0, padding: "26px 34px", overflow: "hidden",
        filter: `grayscale(${lose * 0.9}) brightness(${1 - lose * 0.35})`, boxShadow: glow ? `0 0 ${90 * glow}px -10px ${C.turf}, inset 0 0 0 ${4 * glow}px ${C.turf}` : undefined }}>
        {/* Giant jersey number bleeding off the card */}
        <div style={{ position: "absolute", left: -20, top: -40, fontFamily: DISPLAY, fontWeight: 800, fontSize: 360, lineHeight: 1, color: tc, opacity: 0.85, letterSpacing: -14, translate: `${-f * 0.25}px 0`, textShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
          {x.num ?? x.pos}
        </div>
        <div style={{ position: "absolute", left: 250, top: 28, right: 230 }}>
          <div style={{ display: "inline-block", fontFamily: DISPLAY, fontWeight: 800, fontSize: 38, color: "#061209", background: tc, padding: "2px 14px", borderRadius: 10 }}>{x.pos} · {x.nfl} vs {x.opp}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 56, lineHeight: 1, color: C.dim, marginTop: 12 }}>{first}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(rest, 330, 104), lineHeight: 0.95, color: C.ink }}>{rest}</div>
        </div>
        <div style={{ position: "absolute", right: 34, top: 26, textAlign: "right" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 3, color: C.dim }}>WK PROJ</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 0.95, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{f1(proj)}</div>
        </div>
        {/* Recent form: one bar per game played in the last 3 weeks */}
        <div style={{ position: "absolute", left: 34, right: 34, bottom: 26, height: 170, display: "flex", alignItems: "flex-end", gap: 22, opacity: interpolate(f, [formAt, formAt + 6], [0, 1], clamp) }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, letterSpacing: 2, color: C.dim, width: 150, alignSelf: "center", lineHeight: 1.15 }}>LAST 3<br />WEEKS</div>
          {x.last.map((v, i) => {
            const at = formAt + Math.round(i * BEAT / 2);
            const t = interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: (q) => 1 - Math.pow(1 - q, 3) });
            const h = Math.max(6, (v / max) * 110) * t;
            return (
              <div key={i} style={{ width: 84, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: C.ink, opacity: t }}>{f1(v)}</div>
                <div style={{ width: 60, height: h, borderRadius: 10, background: v >= x.proj ? C.turf : C.pylon, boxShadow: `0 0 18px ${v >= x.proj ? C.turf : C.pylon}88` }} />
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: C.dim, marginTop: 4 }}>WK{x.weeks[i]}</div>
              </div>
            );
          })}
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, letterSpacing: 3, color: C.dim }}>AVG</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 108, lineHeight: 0.92, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{f1(avg)}</div>
          </div>
        </div>
      </Glass>
      {win !== null && f >= stampAt ? (
        <div style={{ position: "absolute", left: -6, top: 262, fontFamily: DISPLAY, fontWeight: 800, fontSize: win ? 118 : 108, lineHeight: 1, color: sc, border: `12px solid ${sc}`, borderRadius: 26, padding: "0 34px",
          rotate: win ? "-5deg" : "6deg", scale: String(2.6 - 1.6 * st), opacity: Math.min(1, st * 2), background: "rgba(4,17,11,0.55)", boxShadow: `0 0 70px -10px ${sc}, inset 0 0 30px -10px ${sc}`, textShadow: `0 0 30px ${sc}` }}>
          {win ? "START" : "SIT"}
        </div>
      ) : null}
    </div>
  );
};

const Duel: React.FC<{ p: StartSitProps; d: StartSitProps["duels"][number]; i: number }> = ({ p, d, i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const by = new Map(p.players!.map(x => [x.id, x]));
  const A = by.get(d.top)!, B = by.get(d.bottom)!;
  const s0 = startBeat(p, i);
  const b = (k: number) => bt(s0, k);
  const max = Math.max(...A.last, ...B.last, A.proj, B.proj);
  const vs = spring({ frame: f - b(2), fps, config: { damping: 9, stiffness: 200 } });
  const winTop = d.win === d.top;
  const stampAt = b(12);
  const wc = teamColor((winTop ? A : B).nfl);
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at 50% 0%, ${teamColor(A.nfl)}, transparent 70%), radial-gradient(900px 600px at 50% 100%, ${teamColor(B.nfl)}, transparent 70%)`, opacity: 0.22 }} />
      <AbsoluteFill style={{ background: `radial-gradient(1000px 900px at 50% ${winTop ? 25 : 75}%, ${wc}, transparent 70%)`, opacity: interpolate(f, [stampAt, stampAt + 12], [0, 0.25], clamp) }} />
      {/* Progress pips: which showdown of how many */}
      <div style={{ position: "absolute", top: SAFE.top - 40, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "center", gap: 10 }}>
        {p.duels.map((_, k) => <div key={k} style={{ width: 60, height: 10, borderRadius: 5, background: k <= i ? C.gold : "rgba(255,255,255,0.2)" }} />)}
      </div>
      <Caption text={d.say[0]} at={b(0)} until={b(5)} />
      <Caption text={d.say[1]} at={b(5)} until={b(8)} color={C.gold} />
      <Caption text="TIEBREAKER: FORM" at={b(8)} until={b(12)} color={C.slate} />
      <Caption text={d.verdict} at={b(12)} until={b(16) + 2} color={C.turf} size={96} />
      <AbsoluteFill style={{ translate: useShake(stampAt, 18) }}>
        <Card x={A} y={370} from={-1} s={b(0)} max={max} win={winTop} tieAt={b(2)} formAt={b(8)} stampAt={stampAt} />
        <Card x={B} y={940} from={1} s={b(1)} max={max} win={!winTop} tieAt={b(2)} formAt={b(8) + 4} stampAt={stampAt} />
        {/* VS badge slams between the cards */}
        <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 845, height: 90, display: "flex", justifyContent: "center", alignItems: "center", opacity: f < b(2) ? 0 : 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, color: "#061209", background: C.gold, borderRadius: 20, padding: "0 30px", lineHeight: 1.05, scale: String(2.2 - 1.2 * vs), rotate: `${(1 - vs) * 30 - 4}deg`, boxShadow: `0 0 50px ${C.gold}` }}>
            {Math.abs(A.proj - B.proj) < 0.05 ? "DEAD EVEN" : `${f1(Math.abs(A.proj - B.proj))} APART`}
          </div>
        </div>
      </AbsoluteFill>
      <Flash at={0} />
      <Flash at={stampAt} color={C.turf} />
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ p: StartSitProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s0 = startBeat(p, p.duels.length);
  const b = (k: number) => bt(s0, k);
  const up = spring({ frame: f - b(2), fps, config: { damping: 16, stiffness: 90 } });
  const scroll = interpolate(f, [b(3), dur], [0, -900], clamp);
  const cx = (SAFE.left + 1080 - SAFE.right) / 2;
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 100%, ${C.turf}, transparent 70%)`, opacity: 0.25 }} />
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 104, lineHeight: 0.95, color: C.ink }}>
        <Slam at={b(0)}>STOP FLIPPING</Slam><br /><Slam at={b(1)} style={{ color: C.gold }}>COINS.</Slam>
      </div>
      <div style={{ position: "absolute", left: cx - 230, top: 480, width: 460, height: 860, borderRadius: 64, background: "#050a07", padding: 16,
        boxShadow: `0 0 0 4px rgba(255,255,255,0.18), 0 60px 120px -30px rgba(0,0,0,0.9), 0 0 120px -40px ${C.turf}`, translate: `0 ${(1 - up) * 1100}px`, rotate: `${(1 - up) * 8}deg` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", position: "relative" }}>
          <Img src={staticFile(p.appShot)} style={{ width: "100%", position: "absolute", top: scroll }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1352, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 76, lineHeight: 1, color: C.gold }}><Slam at={b(4)}>WAR ROOM · FREE</Slam></div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.ink, marginTop: 8, opacity: interpolate(f, [b(5), b(5) + 8], [0, 1], clamp) }}>Start/sit for your league · Link in bio</div>
      </div>
      <Flash at={0} />
    </AbsoluteFill>
  );
};

export const StartSit: React.FC<StartSitProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  if (!p.players) return <AbsoluteFill style={{ background: "#04110B" }} />;
  const at = (beat: number) => Math.round(beat * BEAT);
  const ctaFrom = at(startBeat(p, p.duels.length));
  // Duel lines are delayed (up to 1.5s) so the spoken verdict lands with the START/SIT stamp (beat 12).
  const voFrom = (name: string) => {
    const d = p.voDur?.[name];
    if (!name.startsWith("d") || !d) return 3;
    return Math.max(3, Math.min(45, Math.round((12 * BEAT) / FPS * FPS + 15 - d * FPS)));
  };
  const vo = (name: string) => (p.voice ? <Sequence from={voFrom(name)} layout="none"><Audio src={staticFile(`${p.source}/vo/${name}.mp3`)} /></Sequence> : null);
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      <Sequence name="hook" durationInFrames={at(hookBeats(p))}><Hook p={p} />{vo("hook")}</Sequence>
      {p.duels.map((d, i) => (
        <Sequence key={i} name={`duel-${i + 1}`} from={at(startBeat(p, i))} durationInFrames={at(startBeat(p, i + 1)) - at(startBeat(p, i))}><Duel p={p} d={d} i={i} />{vo(`d${i + 1}`)}</Sequence>
      ))}
      <Sequence name="cta" from={ctaFrom}><Cta p={p} dur={durationInFrames - ctaFrom} />{vo("cta")}</Sequence>
      {p.music === "bed" ? (
        <Interactive.Div name="Music">
          <Audio src={staticFile("beat40.wav")} loop volume={(f) => interpolate(f, [0, 4, durationInFrames - 20, durationInFrames], [0, p.voice ? 0.16 : 0.6, p.voice ? 0.16 : 0.6, 0], clamp)} />
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
