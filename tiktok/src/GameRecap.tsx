import React from "react";
import { AbsoluteFill, Interactive, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { BODY, C, DISPLAY, Field, Glass, SAFE, f1, teamColor } from "./theme";
import { Flash, Kicker, Kinetic, Leak, Neon, Particles, Phone3D, Shatter, Slam, Stamp, W, clamp, useCount, useShake } from "./fx";

// "Game Recap": one NFL game (Thursday night) from the fantasy angle: the call we made, the score, studs, the surprise,
// busts, a verdict and the app. Data: public/<source>/game.json (ESPN scoreboard) + players.json (Sleeper week stats).
const pl = z.object({ id: z.string(), n: z.string(), num: z.number().nullable(), pos: z.string(), nfl: z.string(), pts: z.number(), proj: z.number(),
  pass_yd: z.number(), pass_td: z.number(), pass_int: z.number(), rush_yd: z.number(), rush_td: z.number(), rec: z.number(), rec_yd: z.number(), rec_td: z.number(), tgt: z.number(), car: z.number(), fum: z.number() });
type P = z.infer<typeof pl>;
export const recapGameSchema = z.object({
  source: z.string(),
  voice: z.boolean().default(false),
  music: z.enum(["bed", "none"]),
  call: z.object({ id: z.string(), said: z.string() }),       // the player we called yesterday + the line
  studs: z.array(z.string()), surprise: z.string(), busts: z.array(z.string()),
  verdict: z.object({ id: z.string(), stamp: z.string(), why: z.string() }),
  appShot: z.string(),
  game: z.object({ week: z.number(), away: z.string(), home: z.string(), awayScore: z.number(), homeScore: z.number(), homeMinWin: z.number(),
    linescores: z.record(z.string(), z.array(z.number())) }).nullable(),
  players: z.array(pl).nullable(),
  voDur: z.record(z.string(), z.number()).nullable(),
});
export type RecapGameProps = z.infer<typeof recapGameSchema>;

const FPS = 30;
export const RSCENES = [{ id: "hook", base: 4.6 }, { id: "score", base: 4.6 }, { id: "studs", base: 5.2 }, { id: "surprise", base: 4.8 }, { id: "busts", base: 5 }, { id: "verdict", base: 4.6 }, { id: "cta", base: 4.6 }];
const secs = (p: RecapGameProps, s: { id: string; base: number }) => { const d = p.voice && p.voDur ? p.voDur[s.id] : undefined; return d ? Math.max(s.base, d + (s.id === "cta" ? 1.0 : 0.6)) : s.base; };
export const recapGameFrames = (p: RecapGameProps) => RSCENES.reduce((n, s) => n + Math.round(secs(p, s) * FPS), 0);

const L = SAFE.left, R = SAFE.right, T = SAFE.top;
const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 12], [1.08, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  return <AbsoluteFill style={{ scale: String(s) }}>{children}</AbsoluteFill>;
};
const Glow: React.FC<{ color: string; y?: string; o?: number }> = ({ color, y = "110%", o = 0.3 }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: `radial-gradient(900px 800px at 50% ${y}, ${color}, transparent 70%)`, opacity: o + 0.06 * Math.sin(f / 8) }} />;
};
const statLine = (x: P) => {
  const parts: string[] = [];
  if (x.pass_yd) parts.push(`${x.pass_yd} pass yds`, `${x.pass_td} TD`);
  if (x.pass_int) parts.push(`${x.pass_int} INT`);
  if (x.car) parts.push(`${x.rush_yd} rush yds`);
  if (x.rush_td) parts.push(`${x.rush_td} rush TD`);
  if (x.rec) parts.push(`${x.rec} rec, ${x.rec_yd} yds`);
  if (x.rec_td) parts.push(`${x.rec_td} rec TD`);
  if (x.tgt && x.tgt >= 10) parts.push(`${x.tgt} targets`);
  return parts.slice(0, 3).join(" · ");
};
// Jersey tile with a 3D flip-in.
const Jersey: React.FC<{ x: P; size: number; at: number }> = ({ x, size, at }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 13, stiffness: 150 } });
  const tc = teamColor(x.nfl);
  return (
    <div style={{ width: size, height: size, perspective: 900, flex: "none" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: size * 0.22, background: `linear-gradient(145deg, ${tc}, ${tc}99 60%, #061209)`, display: "grid", placeItems: "center", transform: `rotateY(${(1 - s) * -180}deg)`, backfaceVisibility: "hidden",
        boxShadow: `0 0 ${size * 0.5}px -${size * 0.1}px ${tc}, inset 0 2px 0 rgba(255,255,255,0.35)`, fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.58, color: "#fff", textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{x.num ?? x.pos}</div>
    </div>
  );
};

// HOOK: the call we made yesterday. The projection shatters; the real score slams in over the pieces.
const Hook: React.FC<{ p: RecapGameProps; x: P; dur: number }> = ({ p, x, dur }) => {
  const f = useCurrentFrame();
  const breakAt = Math.min(Math.round(dur * 0.55), 70), realAt = breakAt + 5;
  const tc = teamColor(x.nfl);
  return (
    <AbsoluteFill>
      <Field /><Glow color={C.red} o={0.3} />
      <Particles n={50} color={C.red} seed="rh" speed={1.5} size={7} />
      <AbsoluteFill style={{ translate: useShake(realAt, 26, 12) }}>
        <div style={{ position: "absolute", top: T, left: L, right: R }}>
          <Kinetic text={p.call.said} at={2} size={104} align="left" accent={C.red} />
        </div>
        <div style={{ position: "absolute", top: 640, left: L, display: "flex", alignItems: "center", gap: 26 }}>
          <Jersey x={x} size={190} at={14} />
          <div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, letterSpacing: 4, color: C.dim }}>{x.pos} · {x.nfl}</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, lineHeight: 0.95, color: C.ink }}>{x.n.toUpperCase()}</div>
          </div>
        </div>
        <Shatter at={breakAt} height={520} seed={3} repetitions={9} style={{ top: 860 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, letterSpacing: 5, color: C.dim }}>PROJECTED</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 400, lineHeight: 0.86, color: C.gold, fontVariantNumeric: "tabular-nums", letterSpacing: -10, textShadow: `0 0 70px ${C.gold}77` }}><Slam at={22}>{f1(x.proj)}</Slam></div>
          </div>
        </Shatter>
        {f >= realAt ? (
          <div style={{ position: "absolute", top: 860, left: 0, width: W, height: 520, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, letterSpacing: 5, color: C.red }}><Slam at={realAt}>ACTUAL</Slam></div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 400, lineHeight: 0.86, color: C.red, fontVariantNumeric: "tabular-nums", letterSpacing: -10, textShadow: `0 0 90px ${C.red}99` }}><Slam at={realAt} from={3}>{f1(x.pts)}</Slam></div>
          </div>
        ) : null}
        {f >= realAt + 8 ? <div style={{ position: "absolute", left: L, right: R, top: 1330, display: "flex", justifyContent: "center" }}><Stamp text="WE TOLD YOU" color={C.red} at={realAt + 8} size={120} /></div> : null}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: L, top: T - 50, fontFamily: BODY, fontWeight: 600, fontSize: 34, letterSpacing: 5, color: tc }}>TNF · {p.game!.away} @ {p.game!.home}</div>
      <Flash at={realAt} color={C.red} peak={0.7} />
    </AbsoluteFill>
  );
};

// SCORE: final score slams in, quarter boxes fill one beat each, win-probability dip counts.
const Score: React.FC<{ p: RecapGameProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const g = p.game!;
  const win = interpolate(f, [50, 74], [100, Math.round(g.homeMinWin * 100)], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const row = (team: string, score: number, at: number, winner: boolean) => {
    const tc = teamColor(team);
    const ls = g.linescores[team] || [];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 18 }}>
        <div style={{ width: 300, fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 0.95, color: tc, textShadow: `0 0 40px ${tc}66` }}><Slam at={at}>{team}</Slam></div>
        <div style={{ display: "flex", gap: 10 }}>
          {ls.map((q, k) => {
            const s = spring({ frame: f - at - 10 - k * 6, fps: FPS, config: { damping: 12, stiffness: 220 } });
            return <div key={k} style={{ width: 74, height: 84, borderRadius: 14, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 48, color: C.ink, scale: String(0.6 + 0.4 * s), opacity: Math.min(1, s * 2) }}>{q}</div>;
          })}
        </div>
        <div style={{ marginLeft: "auto", fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 0.9, color: winner ? C.gold : C.ink, fontVariantNumeric: "tabular-nums" }}><Slam at={at + 4}>{score}</Slam></div>
      </div>
    );
  };
  const homeWon = g.homeScore > g.awayScore;
  return (
    <AbsoluteFill>
      <Field /><Glow color={teamColor(homeWon ? g.home : g.away)} o={0.3} />
      <Particles n={40} color={C.gold} seed="sc" speed={1} size={6} opacity={0.6} />
      <Kicker text={`Final · Week ${g.week} TNF`} i={0} n={5} color={C.gold} top={T - 50} left={L} right={R} />
      <AbsoluteFill style={{ translate: useShake(8, 20) }}>
        <div style={{ position: "absolute", top: T, left: L, right: R }}>
          <Kinetic text="FINAL" at={0} size={150} align="left" color={C.ink} />
          <div style={{ display: "flex", gap: 14, fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: C.dim, paddingLeft: 320, marginTop: 18 }}>{["Q1", "Q2", "Q3", "Q4"].map(q => <div key={q} style={{ width: 74, textAlign: "center" }}>{q}</div>)}</div>
          {row(g.away, g.awayScore, 6, !homeWon)}
          {row(g.home, g.homeScore, 14, homeWon)}
        </div>
        <Glass style={{ position: "absolute", left: L, right: R, top: 960, padding: "26px 36px", borderRadius: 32 }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, letterSpacing: 4, color: C.dim }}>{g.home} WIN PROBABILITY · LOWEST POINT</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 200, lineHeight: 0.9, color: C.pylon, fontVariantNumeric: "tabular-nums" }}>{Math.round(win)}%</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, lineHeight: 1, color: C.ink, opacity: interpolate(f, [72, 84], [0, 1], clamp) }}>THEN LOVE<br />TOOK OVER</div>
          </div>
          <div style={{ height: 22, borderRadius: 11, background: "rgba(255,255,255,0.1)", marginTop: 14, overflow: "hidden" }}>
            <div style={{ width: `${interpolate(f, [50, 74], [100, Math.round(g.homeMinWin * 100)], clamp)}%`, height: "100%", background: `linear-gradient(90deg, ${C.turf}, ${C.pylon})`, boxShadow: `0 0 24px ${C.pylon}` }} />
          </div>
        </Glass>
        <div style={{ position: "absolute", left: L, right: R, top: 1330, display: "flex", justifyContent: "center" }}><Stamp text="NEVER IN DOUBT? NOPE." color={C.gold} at={Math.round(dur * 0.7)} size={84} /></div>
      </AbsoluteFill>
      <Leak at={0} dur={40} seed={2} opacity={0.25} />
      <Flash at={0} peak={0.6} />
    </AbsoluteFill>
  );
};

// Player rows used by studs / busts: jersey flips in, bar races to the score, stat line types in.
const Rows: React.FC<{ xs: P[]; color: string; from: number; top: number; max: number; proj?: boolean }> = ({ xs, color, from, top, max, proj }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: L, right: R, top, display: "flex", flexDirection: "column", gap: 22 }}>
      {xs.map((x, k) => {
        const at = from + k * 12;
        const s = spring({ frame: f - at, fps: FPS, config: { damping: 14, stiffness: 120 } });
        const v = interpolate(f, [at + 6, at + 30], [0, x.pts], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
        return (
          <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 22, translate: `${(1 - s) * (k % 2 ? 700 : -700)}px 0`, opacity: Math.min(1, s * 2) }}>
            <Jersey x={x} size={150} at={at + 4} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 60, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 92, lineHeight: 0.9, color, fontVariantNumeric: "tabular-nums" }}>{f1(v)}</div>
              </div>
              <div style={{ height: 22, borderRadius: 11, background: "rgba(255,255,255,0.1)", marginTop: 8, overflow: "hidden", position: "relative" }}>
                {proj ? <div style={{ position: "absolute", left: `${(x.proj / max) * 100}%`, top: -4, width: 4, height: 30, background: C.gold }} /> : null}
                <div style={{ width: `${(v / max) * 100}%`, height: "100%", borderRadius: 11, background: color, boxShadow: `0 0 20px ${color}` }} />
              </div>
              <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: interpolate(f, [at + 18, at + 28], [0, 1], clamp) }}>
                {proj ? <span style={{ color: C.gold }}>proj {f1(x.proj)} · </span> : null}{statLine(x)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Studs: React.FC<{ xs: P[]; dur: number }> = ({ xs, dur }) => {
  const max = Math.max(...xs.map(x => x.pts)) * 1.05;
  return (
    <AbsoluteFill>
      <Field /><Glow color={C.turf} o={0.3} />
      <Particles n={60} color={C.turf} seed="st" speed={2} size={8} />
      <Kicker text="The studs" i={1} n={5} color={C.turf} top={T - 50} left={L} right={R} />
      <div style={{ position: "absolute", top: T, left: L, right: R }}><Kinetic text="THEY *ATE.*" at={0} size={150} align="left" accent={C.turf} /></div>
      <Rows xs={xs} color={C.turf} from={10} top={T + 200} max={max} />
      <div style={{ position: "absolute", left: L, right: R, top: 1340, display: "flex", justifyContent: "center" }}><Stamp text="START EVERY WEEK" color={C.turf} at={Math.round(dur * 0.7)} size={88} /></div>
      <Leak at={2} dur={44} seed={2} opacity={0.25} />
      <Flash at={0} color={C.turf} peak={0.5} />
    </AbsoluteFill>
  );
};

const Surprise: React.FC<{ x: P; dur: number }> = ({ x }) => {
  const tgt = useCount(16, 24, x.tgt), over = useCount(44, 24, x.pts - x.proj);
  const tc = teamColor(x.nfl);
  return (
    <AbsoluteFill>
      <Field /><Glow color={tc} o={0.32} />
      <Particles n={50} color={C.gold} seed="su" speed={1.6} />
      <Kicker text="The surprise" i={2} n={5} color={C.gold} top={T - 50} left={L} right={R} />
      <AbsoluteFill style={{ translate: useShake(44, 16) }}>
        <div style={{ position: "absolute", top: T, left: L, right: R }}><Kinetic text="NOBODY SAW THIS COMING" at={0} size={88} align="left" /></div>
        <div style={{ position: "absolute", top: 520, left: L, display: "flex", alignItems: "center", gap: 26 }}>
          <Jersey x={x} size={220} at={8} />
          <div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, letterSpacing: 4, color: C.dim }}>{x.pos} · {x.nfl}</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 92, lineHeight: 0.95, color: C.ink, maxWidth: 560 }}>{x.n.toUpperCase()}</div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.dim, marginTop: 6 }}>{statLine(x)}</div>
          </div>
        </div>
        <div style={{ position: "absolute", top: 820, left: L, right: R, display: "flex", gap: 20 }}>
          <Glass style={{ flex: 1, padding: "18px 28px", borderRadius: 30 }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: C.dim }}>TARGETS</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, lineHeight: 0.9, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{Math.round(tgt)}</div>
          </Glass>
          <Glass style={{ flex: 1, padding: "18px 28px", borderRadius: 30 }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: C.dim }}>OVER PROJ</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, lineHeight: 0.9, color: C.turf, fontVariantNumeric: "tabular-nums" }}>+{f1(over)}</div>
          </Glass>
        </div>
        <Neon height={300} color={C.gold} radius={40} intensity={1.4} style={{ top: 1110, left: 0 }}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 250, lineHeight: 0.9, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{f1(useCount(10, 30, x.pts))} <span style={{ fontSize: 70, color: C.dim }}>PTS</span></div>
        </Neon>
      </AbsoluteFill>
      <Flash at={44} color={C.gold} peak={0.5} /><Flash at={0} peak={0.5} />
    </AbsoluteFill>
  );
};

const Busts: React.FC<{ xs: P[]; dur: number }> = ({ xs, dur }) => {
  const max = Math.max(...xs.map(x => Math.max(x.pts, x.proj))) * 1.05;
  return (
    <AbsoluteFill>
      <Field /><Glow color={C.red} o={0.3} />
      <Particles n={40} color={C.red} seed="bu" speed={0.8} size={6} opacity={0.5} />
      <Kicker text="The busts · tick = projection" i={3} n={5} color={C.red} top={T - 50} left={L} right={R} />
      <div style={{ position: "absolute", top: T, left: L, right: R }}><Kinetic text="THEY *DIDN'T.*" at={0} size={150} align="left" accent={C.red} /></div>
      <Rows xs={xs} color={C.red} from={10} top={T + 200} max={max} proj />
      <div style={{ position: "absolute", left: L, right: R, top: 1340, display: "flex", justifyContent: "center" }}><Stamp text="OUCH" color={C.red} at={Math.round(dur * 0.7)} size={130} rot={6} /></div>
      <Flash at={0} color={C.red} peak={0.5} />
    </AbsoluteFill>
  );
};

const Verdict: React.FC<{ p: RecapGameProps; x: P; dur: number }> = ({ p, x, dur }) => {
  const tc = teamColor(x.nfl);
  return (
    <AbsoluteFill>
      <Field /><Glow color={tc} o={0.35} />
      <Particles n={70} color={C.gold} seed="vd" speed={2.4} size={9} />
      <Kicker text="Verdict" i={4} n={5} color={C.gold} top={T - 50} left={L} right={R} />
      <AbsoluteFill style={{ translate: useShake(Math.round(dur * 0.35), 20) }}>
        <div style={{ position: "absolute", top: T, left: L, right: R, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><Jersey x={x} size={300} at={4} /></div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 110, lineHeight: 0.95, color: C.ink, marginTop: 24 }}><Slam at={10}>{x.n.toUpperCase()}</Slam></div>
          <div style={{ marginTop: 40 }}><Stamp text={p.verdict.stamp} color={C.gold} at={Math.round(dur * 0.35)} size={150} /></div>
          <div style={{ marginTop: 50 }}><Kinetic text={p.verdict.why} at={Math.round(dur * 0.35) + 10} size={60} color={C.dim} /></div>
        </div>
      </AbsoluteFill>
      <Leak at={Math.round(dur * 0.35) - 2} dur={40} seed={2} opacity={0.25} />
      <Flash at={Math.round(dur * 0.35)} color={C.gold} peak={0.6} /><Flash at={0} peak={0.5} />
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ p: RecapGameProps; dur: number }> = ({ p }) => {
  const f = useCurrentFrame();
  const inn = spring({ frame: f - 2, fps: FPS, config: { damping: 16, stiffness: 70, mass: 1.1 } });
  return (
    <AbsoluteFill>
      <Field /><Glow color={C.turf} o={0.35} />
      <Particles n={80} color={C.turf} seed="cta2" speed={2} size={9} />
      <div style={{ position: "absolute", top: T, left: L, right: R }}>
        <Kinetic text="EVERY GAME. *LIVE.*" at={2} size={104} align="left" accent={C.red} />
        <Kinetic text="YOUR PLAYERS, ON THE FIELD, RIGHT NOW" at={14} size={56} color={C.dim} align="left" />
      </div>
      <Phone3D src={p.appShot} yaw={-1.2 + 1.0 * inn + Math.sin(f / 26) * 0.08} pitch={0.1} y={(1 - inn) * -2.5 + Math.sin(f / 22) * 0.05} scale={1.0} crop={0.7} glowColor={C.red} height={1250} style={{ top: 540, left: -250 }} />
      <div style={{ position: "absolute", right: R, top: 1000, textAlign: "right" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, color: C.gold }}><Slam at={30}>WAR ROOM</Slam></div>
        <div style={{ marginTop: 16 }}><Stamp text="FREE" color={C.turf} at={40} size={120} rot={-8} /></div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, color: C.ink, marginTop: 24, opacity: interpolate(f, [54, 66], [0, 1], clamp) }}>LINK IN BIO</div>
      </div>
      <Leak at={4} dur={50} seed={2} opacity={0.25} />
      <Flash at={0} color={C.turf} peak={0.6} />
    </AbsoluteFill>
  );
};

export const GameRecap: React.FC<RecapGameProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  if (!p.players || !p.game) return <AbsoluteFill style={{ background: "#04110B" }} />;
  const by = new Map(p.players.map(x => [x.id, x]));
  const g = (id: string) => by.get(id)!;
  let from = 0;
  const seqs = RSCENES.map((s) => { const d = Math.round(secs(p, s) * FPS); const x = { ...s, from, d }; from += d; return x; });
  const body = (id: string, d: number) => id === "hook" ? <Hook p={p} x={g(p.call.id)} dur={d} /> : id === "score" ? <Score p={p} dur={d} /> : id === "studs" ? <Studs xs={p.studs.map(g)} dur={d} />
    : id === "surprise" ? <Surprise x={g(p.surprise)} dur={d} /> : id === "busts" ? <Busts xs={p.busts.map(g)} dur={d} /> : id === "verdict" ? <Verdict p={p} x={g(p.verdict.id)} dur={d} /> : <Cta p={p} dur={d} />;
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      {seqs.map(s => (
        <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.d}>
          <Punch>{body(s.id, s.d)}</Punch>
          {p.voice && p.voDur && p.voDur[s.id] ? <Sequence from={s.id === "hook" ? 4 : 8} layout="none"><Audio src={staticFile(`${p.source}/vo/${s.id}.mp3`)} /></Sequence> : null}
        </Sequence>
      ))}
      {p.music === "bed" ? (
        <Interactive.Div name="Music">
          <Audio src={staticFile("beat40.wav")} loop volume={(f) => interpolate(f, [0, 6, durationInFrames - 24, durationInFrames], [0, p.voice ? 0.16 : 0.55, p.voice ? 0.16 : 0.55, 0], clamp)} />
        </Interactive.Div>
      ) : null}
    </AbsoluteFill>
  );
};
