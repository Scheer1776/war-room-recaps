import React from "react";
import { AbsoluteFill, Interactive, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { BODY, C, DISPLAY, Field, Glass, SAFE } from "./theme";
import { Flash, Kicker, Kinetic, Leak, Neon, Particles, Phone3D, Shatter, Slam, Stamp, W, clamp, useCount, useShake } from "./fx";

// "Showcase": the features you can't get anywhere else, one scene each, voiced by the War Room Announcer
// (clips <source>/vo/<scene>.mp3 + durations.json; lines in <source>/lines.json). Works music-only too.
export const showcaseSchema = z.object({
  source: z.string(),
  voice: z.boolean().default(false),
  music: z.enum(["bed", "none"]),
  // Real weather numbers from scripts/weather.mjs (the one flagged game of the week).
  wx: z.object({ game: z.string(), wind: z.number(), pop: z.number(), passPct: z.number() }),
  voDur: z.record(z.string(), z.number()).nullable(),
});
export type ShowcaseProps = z.infer<typeof showcaseSchema>;

const FPS = 30;
// lightLeak() hue shift that turns the stock leak into the house green/gold.
const HUE = 0;
export const SCENES = [
  { id: "hook", base: 4.2 }, { id: "finder", base: 5.2 }, { id: "redzone", base: 4.8 }, { id: "odds", base: 5.2 },
  { id: "weather", base: 5.2 }, { id: "recap", base: 5 }, { id: "cta", base: 4.8 },
];
const secs = (p: ShowcaseProps, s: { id: string; base: number }) => { const d = p.voice && p.voDur ? p.voDur[s.id] : undefined; return d ? Math.max(s.base, d + (s.id === "cta" ? 1.0 : 0.6)) : s.base; };
export const showcaseFrames = (p: ShowcaseProps) => SCENES.reduce((n, s) => n + Math.round(secs(p, s) * FPS), 0);

const L = SAFE.left, R = SAFE.right, T = SAFE.top;
// Every scene opens with a punch-in and a flash so cuts feel edited, not slid.
const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 12], [1.08, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  return <AbsoluteFill style={{ scale: String(s) }}>{children}</AbsoluteFill>;
};
const Glow: React.FC<{ color: string; y?: string; o?: number }> = ({ color, y = "110%", o = 0.3 }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: `radial-gradient(900px 800px at 50% ${y}, ${color}, transparent 70%)`, opacity: o + 0.06 * Math.sin(f / 8) }} />;
};

const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breakAt = Math.min(Math.round(dur * 0.48), 62), zeroAt = breakAt + 6;
  const z = spring({ frame: f - zeroAt, fps, config: { damping: 9, stiffness: 200, mass: 0.8 } });
  const pulse = 1 + 0.035 * Math.max(0, Math.sin(f / 3.2));
  return (
    <AbsoluteFill>
      <Field /><Glow color={f < zeroAt ? C.pylon : C.turf} o={0.32} />
      <Particles n={60} color={f < zeroAt ? C.gold : C.turf} seed="hook" speed={f < zeroAt ? 0.8 : 3} />
      <AbsoluteFill style={{ translate: useShake(zeroAt, 26, 12) }}>
        <div style={{ position: "absolute", top: T + 10, left: L, right: R, textAlign: "center" }}>
          <Kinetic text="OTHER FANTASY APPS CHARGE" at={2} size={72} color={C.dim} />
        </div>
        {/* $65 / A YEAR, neon, then it shatters */}
        <Shatter at={breakAt} height={720} seed={7} style={{ top: 420 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", translate: f > breakAt - 10 && f < breakAt ? `${Math.sin(f * 9) * 6}px 0` : undefined }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 420, lineHeight: 0.85, color: C.gold, letterSpacing: -10, textShadow: `0 0 60px ${C.gold}99, 0 0 120px ${C.gold}55` }}><Slam at={8}>$65</Slam></div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 130, lineHeight: 1, color: C.ink, marginTop: 10 }}><Slam at={16}>A YEAR</Slam></div>
          </div>
        </Shatter>
        {f >= zeroAt ? (
          <div style={{ position: "absolute", top: 560, left: 0, width: W, height: 520, scale: String((2.8 - 1.8 * z) * pulse), opacity: Math.min(1, z * 2) }}>
            <Neon height={520} color="#1f9c5c" radius={56} intensity={1.3} split={interpolate(f, [zeroAt, zeroAt + 12], [26, 0], clamp)}>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 520, lineHeight: 0.85, color: C.turf, letterSpacing: -14 }}>$0</div>
            </Neon>
          </div>
        ) : null}
        <div style={{ position: "absolute", top: 1180, left: L, right: R, textAlign: "center" }}>
          {f >= zeroAt + 10 ? <Kinetic text="WAR ROOM. SAME TOOLS. *FREE.*" at={zeroAt + 10} size={92} /> : null}
        </div>
      </AbsoluteFill>
      <Flash at={zeroAt} color={C.turf} peak={0.8} />
      <Leak at={zeroAt - 2} dur={36} seed={2} hue={HUE} opacity={0.3} />
    </AbsoluteFill>
  );
};

// Phone scene scaffold: kicker, 3D phone swinging in from the right, captions under the safe top.
const PhoneScene: React.FC<{ i: number; kicker: string; color: string; shot: string; crop?: number; lines: [string, string]; stamp?: string; children?: React.ReactNode; dur: number }> = ({ i, kicker, color, shot, crop = 0.6, lines, stamp, children, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = spring({ frame: f - 2, fps, config: { damping: 16, stiffness: 70, mass: 1.1 } });
  const yaw = -1.3 + 1.05 * inn + Math.sin(f / 26) * 0.08;
  const y = (1 - inn) * -2.5 + Math.sin(f / 22) * 0.05;
  const stampAt = Math.round(dur * 0.62);
  return (
    <AbsoluteFill>
      <Field /><Glow color={color} y="100%" o={0.28} />
      <Particles n={40} color={color} seed={kicker} speed={1.2} size={7} opacity={0.6} />
      <Kicker text={kicker} i={i} n={SCENES.length - 2} color={color} top={T - 50} left={L} right={R} />
      <div style={{ position: "absolute", top: T, left: L, right: R }}>
        <Kinetic text={lines[0]} at={4} size={96} align="left" accent={color} />
        <Kinetic text={lines[1]} at={16} size={66} color={C.dim} align="left" accent={color} style={{ marginTop: 8 }} />
      </div>
      <Phone3D src={shot} yaw={yaw} pitch={0.1} y={y} scale={1.0} crop={crop} glowColor={color} height={1250} style={{ top: 540, left: -190 }} />
      {children}
      {stamp ? <div style={{ position: "absolute", left: L, right: R, top: 1330, display: "flex", justifyContent: "center" }}><Stamp text={stamp} color={color} at={stampAt} size={Math.min(96, Math.floor(820 / (stamp.length * 0.5)))} /></div> : null}
      <Flash at={0} peak={0.5} />
    </AbsoluteFill>
  );
};

// Scanner beam sweeping the phone (Trade Finder "searching every roster").
const Scan: React.FC<{ color: string }> = ({ color }) => {
  const f = useCurrentFrame();
  const y = 600 + ((f * 14) % 1000);
  return <div style={{ position: "absolute", left: 200, right: 200, top: y, height: 6, background: color, boxShadow: `0 0 40px 10px ${color}66`, opacity: 0.85, mixBlendMode: "screen" }} />;
};
const Finder: React.FC<{ dur: number }> = ({ dur }) => {
  const combos = useCount(40, 50, 5);
  return (
    <PhoneScene i={0} kicker="Trade Finder" color={C.gold} shot="app/finder-vp.png" crop={0.75} lines={["SEARCHES *EVERY* ROSTER", "DEALS THAT HELP BOTH TEAMS"]} stamp="FAIR TRADES, FOUND" dur={dur}>
      <Scan color={C.gold} />
      <div style={{ position: "absolute", right: R, top: 1080, textAlign: "right" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: C.dim }}>PLAYERS A SIDE</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, lineHeight: 0.9, color: C.gold, fontVariantNumeric: "tabular-nums" }}>UP TO {Math.round(combos)}</div>
      </div>
    </PhoneScene>
  );
};

// Red Zone: a pulsing live badge and "on the field" chips sliding in from the left.
const RedZone: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chips = ["YOUR RB · 1st & goal", "THEIR WR · red zone", "YOUR QB · 2-min drill"];
  return (
    <PhoneScene i={1} kicker="Red Zone · live" color={C.red} shot="app/redzone-vp.png" crop={0.7} lines={["EVERY GAME *LIVE*", "WHO'S ON THE FIELD RIGHT NOW"]} stamp="NEVER MISS A TD" dur={dur}>
      <div style={{ position: "absolute", left: 540, top: 1040, display: "flex", flexDirection: "column", gap: 14 }}>
        {chips.map((c, k) => {
          const s = spring({ frame: f - 30 - k * 9, fps, config: { damping: 13, stiffness: 160 } });
          return <div key={k} style={{ translate: `${(1 - s) * 600}px 0`, opacity: Math.min(1, s * 2), fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.ink, background: "rgba(255,94,82,0.22)", border: `2px solid ${C.red}`, borderRadius: 999, padding: "8px 22px", boxShadow: `0 0 30px -8px ${C.red}` }}>
            <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 7, background: C.red, marginRight: 12, opacity: 0.5 + 0.5 * Math.sin(f / 3 + k) }} />{c}
          </div>;
        })}
      </div>
    </PhoneScene>
  );
};

// Playoff odds: a 10,000 counter that fills the frame, then a swarm of simulated seasons collapsing into the phone.
const Odds: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const n = useCount(4, 40, 10000, 5);
  const done = f >= 44;
  return (
    <AbsoluteFill>
      <Field /><Glow color={C.slate} y="0%" o={0.25} />
      <Kicker text="Playoff odds" i={2} n={SCENES.length - 2} color={C.slate} top={T - 50} left={L} right={R} />
      <AbsoluteFill style={{ translate: useShake(44, 18) }}>
        <Neon height={330} color={C.slate} radius={44} intensity={1.5} split={done ? 0 : 6} style={{ top: T - 20, left: 0 }}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 290, lineHeight: 0.9, color: C.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -6 }}>{Math.round(n).toLocaleString("en-US")}</div>
        </Neon>
        <div style={{ position: "absolute", top: T + 290, left: L, right: R, textAlign: "center" }}>
          <Kinetic text="SIMULATED SEASONS" at={6} size={84} color={C.slate} />
          <Kinetic text="YOUR PLAYOFF ODDS, *EVERY* WEEK" at={46} size={66} color={C.dim} accent={C.gold} style={{ marginTop: 6 }} />
        </div>
        {/* swarm: 220 seasons orbiting, then pulled into the phone */}
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {Array.from({ length: 220 }, (_, i) => {
            const a = (i / 220) * Math.PI * 2 + f / 40, r = 420 + ((i * 37) % 160);
            const pull = interpolate(f, [44, 80], [0, 1], { ...clamp, easing: (x) => x * x });
            const x = 540 + Math.cos(a) * r * (1 - pull), y = 1180 + Math.sin(a) * r * 0.55 * (1 - pull);
            return <div key={i} style={{ position: "absolute", left: x, top: y, width: 6, height: 6, borderRadius: 3, background: i % 7 === 0 ? C.gold : C.slate, opacity: 0.9 - pull * 0.9, boxShadow: `0 0 10px ${C.slate}` }} />;
          })}
        </AbsoluteFill>
        <Phone3D src="app/league-vp.png" yaw={interpolate(f, [40, 70], [1.2, 0.18], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) })} pitch={0.08} y={interpolate(f, [40, 70], [-3, 0], clamp) + Math.sin(f / 22) * 0.05} scale={0.92} crop={0.7} glowColor={C.slate} height={1250} style={{ top: 660, left: 0, opacity: f < 40 ? 0 : 1 }} />
        <div style={{ position: "absolute", left: L, right: R, top: 1340, display: "flex", justifyContent: "center" }}><Stamp text="KNOW YOUR ODDS" color={C.slate} at={Math.round(dur * 0.66)} size={96} /></div>
      </AbsoluteFill>
      <Flash at={0} peak={0.5} /><Flash at={44} color={C.slate} peak={0.6} />
    </AbsoluteFill>
  );
};

// Weather: real numbers from this week's flagged game, then the matchup screen with the lineup check.
const Weather: React.FC<{ p: ShowcaseProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const wind = useCount(8, 26, p.wx.wind), pct = useCount(30, 24, p.wx.passPct);
  const rain = Array.from({ length: 50 }, (_, i) => i);
  return (
    <PhoneScene i={3} kicker={`Weather · ${p.wx.game}`} color={C.slate} shot="app/matchup-vp.png" crop={0.7} lines={["WIND. RAIN. COLD.", "BAKED INTO *EVERY* PROJECTION"]} stamp="ONE TAP. BEST LINEUP" dur={dur}>
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.5 }}>
        {rain.map(i => { const y = ((f * 26 + i * 97) % 2100) - 100, x = (i * 131) % W; return <div key={i} style={{ position: "absolute", left: x, top: y, width: 3, height: 70, background: `linear-gradient(${C.slate}, transparent)`, rotate: "12deg" }} />; })}
      </AbsoluteFill>
      <Glass style={{ position: "absolute", left: 600, top: 1000, padding: "16px 26px", borderRadius: 28 }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, letterSpacing: 3, color: C.dim }}>WIND</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 0.9, color: C.pylon, fontVariantNumeric: "tabular-nums" }}>{Math.round(wind)}<span style={{ fontSize: 40, color: C.dim }}> mph</span></div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, letterSpacing: 3, color: C.dim, marginTop: 10 }}>PASS GAME</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 100, lineHeight: 0.9, color: C.gold, fontVariantNumeric: "tabular-nums" }}>−{pct.toFixed(1)}%</div>
      </Glass>
    </PhoneScene>
  );
};

// Recap video: iMessage-style bubbles with the recap thumbnail landing in the group chat.
const Recap: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bubbles = [{ t: "who's making the recap this week", me: false, at: 24 }, { t: "▶ War Room · Week 8 recap · 0:45", me: true, at: 42, video: true }, { t: "bro it roasted my bench 💀", me: false, at: 66 }];
  return (
    <PhoneScene i={4} kicker="Recap video" color={C.pylon} shot="app/home-vp.png" crop={0.7} lines={["A 45-SECOND RECAP VIDEO", "MADE ON YOUR PHONE. SEND IT."]} stamp="GROUP CHAT GOLD" dur={dur}>
      <div style={{ position: "absolute", left: 470, right: R, top: 980, display: "flex", flexDirection: "column", gap: 14 }}>
        {bubbles.map((b, k) => {
          const s = spring({ frame: f - b.at, fps, config: { damping: 12, stiffness: 180 } });
          return <div key={k} style={{ alignSelf: b.me ? "flex-end" : "flex-start", maxWidth: 500, opacity: Math.min(1, s * 2), scale: String(0.5 + 0.5 * s), transformOrigin: b.me ? "right bottom" : "left bottom", translate: `0 ${(1 - s) * 40}px`,
            background: b.me ? C.turf : "rgba(255,255,255,0.14)", color: b.me ? "#061209" : C.ink, fontFamily: BODY, fontWeight: 600, fontSize: 34, padding: "14px 24px", borderRadius: 30, boxShadow: b.me ? `0 0 40px -8px ${C.turf}` : undefined }}>
            {b.video ? <div style={{ width: 300, height: 170, borderRadius: 16, background: `linear-gradient(135deg, ${C.bg1}, #04110B)`, marginBottom: 10, display: "grid", placeItems: "center", color: C.gold, fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, border: "2px solid rgba(255,255,255,0.2)" }}>WEEK 8 ▶</div> : null}
            {b.t}
          </div>;
        })}
      </div>
    </PhoneScene>
  );
};

const Cta: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const up = spring({ frame: f - 10, fps, config: { damping: 15, stiffness: 80 } });
  return (
    <AbsoluteFill>
      <Field /><Glow color={C.turf} o={0.35} />
      <Particles n={90} color={C.turf} seed="cta" speed={2} size={9} />
      <div style={{ position: "absolute", top: T + 20, left: 0, width: W }}>
        <Neon height={560} color={C.turf} radius={50} intensity={1.8} split={interpolate(f, [0, 14], [22, 2], clamp)}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontWeight: 800, lineHeight: 0.86, color: C.ink, fontSize: 250, letterSpacing: -6 }}>
            <Slam at={2}>WAR</Slam><Slam at={8} style={{ color: C.turf }}>ROOM</Slam>
          </div>
        </Neon>
      </div>
      <div style={{ position: "absolute", top: 830, left: L, right: R, textAlign: "center" }}>
        <Kinetic text="ANY ESPN OR SLEEPER LEAGUE" at={18} size={72} color={C.dim} />
        <div style={{ marginTop: 30, display: "flex", justifyContent: "center" }}><Stamp text="FREE" color={C.gold} at={30} size={200} rot={-8} /></div>
        <div style={{ marginTop: 40, fontFamily: DISPLAY, fontWeight: 800, fontSize: 92, color: C.ink, opacity: interpolate(f, [48, 60], [0, 1], clamp), translate: `0 ${(1 - up) * 60}px` }}>LINK IN BIO</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.dim, marginTop: 8, opacity: interpolate(f, [56, 68], [0, 1], clamp) }}>war-room-self-one.vercel.app</div>
      </div>
      <Leak at={4} dur={Math.max(40, dur - 10)} seed={5} hue={HUE} opacity={0.25} />
      <Flash at={0} color={C.turf} peak={0.7} />
    </AbsoluteFill>
  );
};

export const Showcase: React.FC<ShowcaseProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  let from = 0;
  const seqs = SCENES.map((s) => { const d = Math.round(secs(p, s) * FPS); const x = { ...s, from, d }; from += d; return x; });
  const body = (id: string, d: number) => id === "hook" ? <Hook dur={d} /> : id === "finder" ? <Finder dur={d} /> : id === "redzone" ? <RedZone dur={d} /> : id === "odds" ? <Odds dur={d} />
    : id === "weather" ? <Weather p={p} dur={d} /> : id === "recap" ? <Recap dur={d} /> : <Cta dur={d} />;
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
