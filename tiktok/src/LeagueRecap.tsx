import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { Recap, asset, cleanName } from "./data";
import { AppLink, BODY, C, DISPLAY, Field, Glass, SAFE, f1, initialsOf, teamColor } from "./theme";
import { Flash, Kinetic, Particles, Slam, Stamp, W, clamp, useShake } from "./fx";

// "League Recap": the in-app weekly recap every league gets after Monday Night Football, in the 2026-10-30 house style.
// Fast to render on purpose (no WebGL: kinetic type, slams, shakes, counters, stamps, particles, headshots) so 100 leagues
// fit in GitHub's free runners. Real names (this video is FOR the league). Shared narration: fixed Announcer lines per
// scene in public/recapvo/<scene>.mp3 (recorded once) + one per-week line (public/recapvo/week.mp3, e.g. ElevenLabs).
// `source` may be a URL (the media branch) or a folder under public/.
export const leagueRecapSchema = z.object({
  source: z.string(),            // where recap.json + img/ live
  recap: z.any().nullable(),     // filled by calculateMetadata
  nameOverrides: z.record(z.string(), z.string()).default({}),
  appUrl: z.string().default("war-room-self-one.vercel.app"),
  voice: z.boolean().default(true),
  voDur: z.record(z.string(), z.number()).nullable().default(null),
  music: z.enum(["bed", "none"]).default("bed"),
});
export type LeagueRecapProps = z.infer<typeof leagueRecapSchema>;
export const FPS = 30;

// Scene plan. Voiced lengths stretch to the clip + a beat.
export const recapScenes = (p: LeagueRecapProps) => {
  const r = p.recap as Recap;
  const s: { id: string; sec: number }[] = [{ id: "intro", sec: 3.6 }, { id: "scores", sec: Math.min(8, 3.2 + r.games.length * 0.6) }, { id: "highlow", sec: 4.6 }];
  if (r.mvp) s.push({ id: "mvp", sec: 4.6 });
  if (r.blunder && r.blunder.bench && (r.blunder.team.left || 0) >= 8) s.push({ id: "blunder", sec: 4.6 });
  s.push({ id: "standings", sec: 6.0 });
  if (r.next) s.push({ id: "next", sec: 4.6 });
  s.push({ id: "outro", sec: 4.6 });
  return s.map(x => { const d = p.voice && p.voDur ? p.voDur[x.id] : undefined; return { ...x, sec: d ? Math.max(x.sec, d + 0.5) : x.sec }; });
};
export const leagueRecapFrames = (p: LeagueRecapProps) => p.recap ? recapScenes(p).reduce((n, x) => n + Math.round(x.sec * FPS), 0) : 30;

const L = SAFE.left, R = SAFE.right, T = SAFE.top;
const Wd = W - L - R;
const head = (src: string, id: string) => asset(src, `img/h-${id}.png`, staticFile);

const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ scale: String(interpolate(f, [0, 12], [1.06, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) })) }}>{children}</AbsoluteFill>;
};
const Header: React.FC<{ r: Recap; label: string; color: string }> = ({ r, label, color }) => (
  <div style={{ position: "absolute", top: T - 40, left: L, right: R }}>
    <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.league.toUpperCase()} · WEEK {r.week}</div>
    <div style={{ marginTop: 6 }}><Kinetic text={label} at={2} size={96} align="left" accent={color} /></div>
  </div>
);
const Face: React.FC<{ src: string; id: string; n: string; nfl: string; size: number }> = ({ src, id, n, nfl, size }) => {
  const col = teamColor(nfl);
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: `linear-gradient(160deg, ${col}, ${col}88)`, boxShadow: `0 0 ${size * 0.4}px ${col}66, inset 0 0 0 4px rgba(255,255,255,0.25)`, position: "relative", overflow: "hidden", display: "grid", placeItems: "center", flex: "none" }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.4, color: "#fff" }}>{initialsOf(n)}</span>
      <Img src={head(src, id)} onError={() => undefined} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%", transform: "scale(1.12)", transformOrigin: "50% 30%" }} />
    </div>
  );
};
const TeamName: React.FC<{ s: string; size: number; color?: string; max?: number }> = ({ s, size, color = C.ink, max = 700 }) => (
  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1, color, maxWidth: max, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "bottom" }}>{s}</span>
);
const Count: React.FC<{ at: number; to: number; size: number; color?: string; dec?: number }> = ({ at, to, size, color = C.ink, dec = 1 }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + 30], [0, to], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
  return <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{v.toFixed(dec)}</span>;
};

type SP = { r: Recap; name: (s: string) => string; source: string; dur: number };

const Intro: React.FC<SP> = ({ r, name }) => {
  const f = useCurrentFrame();
  const shake = useShake(18, 22, 10);
  return (
    <AbsoluteFill style={{ translate: shake }}>
      <Field /><Particles n={70} color={C.turf} seed="intro" speed={2} size={8} />
      <div style={{ position: "absolute", top: 420, left: L, right: R, textAlign: "center" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 40, letterSpacing: 6, color: C.dim, opacity: interpolate(f, [4, 14], [0, 1], clamp), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name(r.league).toUpperCase()}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 300, lineHeight: 0.86, color: C.ink, marginTop: 20 }}><Slam at={8}>WEEK {r.week}</Slam></div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 200, lineHeight: 0.9, color: C.gold, textShadow: `0 0 70px ${C.gold}66` }}><Slam at={18}>RECAP</Slam></div>
        <div style={{ marginTop: 50, fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.dim, opacity: interpolate(f, [34, 46], [0, 1], clamp) }}>{r.games.length} games · {r.standings.length} teams · one week closer</div>
      </div>
      <Flash at={18} color={C.gold} peak={0.7} />
    </AbsoluteFill>
  );
};

const Scores: React.FC<SP> = ({ r, name }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const games = r.games.slice(0, 7); const rowH = Math.min(150, 1000 / games.length);
  return (
    <AbsoluteFill>
      <Field /><Particles n={30} color={C.turf} seed="scores" speed={1} size={6} />
      <Header r={r} label="FINAL *SCORES*" color={C.turf} />
      <div style={{ position: "absolute", top: 470, left: L - 10, width: Wd + 20 }}>
        {games.map((g, i) => {
          const s = spring({ frame: f - 8 - i * 5, fps, config: { damping: 14, stiffness: 120 } });
          const mine = (id: number) => id === r.myTeamId;
          return (
            <Glass key={i} style={{ height: rowH - 14, marginBottom: 14, padding: "0 32px", display: "flex", flexDirection: "column", justifyContent: "center", opacity: s, translate: `${(1 - s) * (i % 2 ? 700 : -700)}px 0` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <TeamName s={name(g.win.name)} size={Math.min(48, rowH * 0.34)} color={mine(g.win.id) ? C.gold : C.ink} max={640} />
                <Count at={12 + i * 5} to={g.win.pts} size={Math.min(56, rowH * 0.4)} color={C.turf} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: 0.75 }}>
                <TeamName s={name(g.lose.name)} size={Math.min(38, rowH * 0.27)} color={mine(g.lose.id) ? C.gold : C.dim} max={640} />
                <Count at={12 + i * 5} to={g.lose.pts} size={Math.min(44, rowH * 0.31)} color={C.dim} />
              </div>
            </Glass>
          );
        })}
      </div>
      <Flash at={0} peak={0.4} />
    </AbsoluteFill>
  );
};

const HighLow: React.FC<SP> = ({ r, name, source, dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const inn = (at: number) => spring({ frame: f - at, fps, config: { damping: 13, stiffness: 110 } });
  const a = inn(8), b = inn(34);
  return (
    <AbsoluteFill>
      <Field /><Particles n={40} color={C.gold} seed="hl" speed={1.4} size={7} />
      <Header r={r} label="HIGH & *LOW*" color={C.gold} />
      <Glass style={{ position: "absolute", top: 470, left: L, width: Wd, padding: "30px 36px", display: "flex", gap: 28, alignItems: "center", translate: `${(1 - a) * -800}px 0`, opacity: a }} tint="rgba(255,198,41,0.12)">
        {r.high.star && <Face src={source} id={r.high.star.id} n={r.high.star.n} nfl={r.high.star.nfl} size={190} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: C.gold }}>TOP SCORE</div>
          <TeamName s={name(r.high.name)} size={54} max={620} />
          <div style={{ marginTop: 6 }}><Count at={12} to={r.high.pts} size={120} color={C.gold} /></div>
          {r.high.star && <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim }}>{r.high.star.n} · {f1(r.high.star.act)} pts</div>}
        </div>
      </Glass>
      <Glass style={{ position: "absolute", top: 990, left: L, width: Wd, padding: "30px 36px", translate: `${(1 - b) * 800}px 0`, opacity: b }} tint="rgba(255,94,82,0.12)">
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, letterSpacing: 4, color: C.red }}>LOW SCORE</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20 }}>
          <TeamName s={name(r.low.name)} size={54} max={600} />
          <Count at={38} to={r.low.pts} size={110} color={C.red} />
        </div>
      </Glass>
      <div style={{ position: "absolute", left: L, right: R, top: 1330, display: "flex", justifyContent: "center" }}>
        <Stamp text={r.close ? `CLOSEST: ${f1(r.close.margin)} PTS` : "WHAT A WEEK"} color={C.turf} at={Math.round(dur * FPS * 0.62)} size={64} rot={-5} />
      </div>
      <Flash at={0} peak={0.4} />
    </AbsoluteFill>
  );
};

const Mvp: React.FC<SP> = ({ r, name, source, dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const m = r.mvp!; const col = teamColor(m.player.nfl);
  const inn = spring({ frame: f - 6, fps, config: { damping: 12, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ translate: useShake(6, 18, 8) }}>
      <Field /><AbsoluteFill style={{ background: `radial-gradient(800px 800px at 50% 45%, ${col}44, transparent 70%)` }} />
      <Particles n={60} color={col} seed="mvp" speed={2} size={8} />
      <Header r={r} label="WEEK *MVP*" color={C.gold} />
      <div style={{ position: "absolute", top: 480, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", scale: String(0.7 + 0.3 * inn), opacity: inn }}>
        <Face src={source} id={m.player.id} n={m.player.n} nfl={m.player.nfl} size={460} />
        <div style={{ marginTop: 26, fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, color: C.ink, textAlign: "center" }}>{m.player.n.toUpperCase()}</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim, marginTop: 6 }}>{m.player.pos} · {m.player.nfl} · started by <span style={{ color: C.gold }}>{name(m.team.name)}</span></div>
        <div style={{ marginTop: 20 }}><Count at={14} to={m.player.act} size={190} color={C.gold} /><span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.dim }}> PTS</span></div>
      </div>
      <div style={{ position: "absolute", left: L, right: R, top: 1380, display: "flex", justifyContent: "center" }}><Stamp text="MVP" color={C.gold} at={Math.round(dur * FPS * 0.6)} size={120} rot={-8} /></div>
      <Flash at={6} color={col} peak={0.6} />
    </AbsoluteFill>
  );
};

const Blunder: React.FC<SP> = ({ r, name, source, dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const b = r.blunder!; const bench = b.bench!; const inn = spring({ frame: f - 6, fps, config: { damping: 14, stiffness: 100 } });
  return (
    <AbsoluteFill>
      <Field /><AbsoluteFill style={{ background: `radial-gradient(800px 700px at 50% 60%, ${C.red}33, transparent 70%)` }} />
      <Particles n={40} color={C.red} seed="bl" speed={1.5} size={7} />
      <Header r={r} label="BENCH *BLUNDER*" color={C.red} />
      <Glass style={{ position: "absolute", top: 480, left: L, width: Wd, padding: "34px 36px", display: "flex", gap: 30, alignItems: "center", opacity: inn, translate: `0 ${(1 - inn) * 200}px` }} tint="rgba(255,94,82,0.12)">
        <Face src={source} id={bench.id} n={bench.n} nfl={bench.nfl} size={200} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 60, lineHeight: 1, color: C.ink }}>{bench.n.toUpperCase()}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim, marginTop: 6 }}>{bench.pos} · {bench.nfl} · <span style={{ color: C.red }}>on the bench</span></div>
          <div style={{ marginTop: 8 }}><Count at={14} to={bench.act} size={130} color={C.red} /><span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.dim }}> PTS WASTED</span></div>
        </div>
      </Glass>
      <div style={{ position: "absolute", top: 1010, left: L, right: R, textAlign: "center", opacity: interpolate(f, [30, 42], [0, 1], clamp) }}>
        <TeamName s={name(b.team.name)} size={64} max={900} />
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.dim, marginTop: 8 }}>left <span style={{ color: C.red, fontFamily: DISPLAY, fontWeight: 800, fontSize: 54 }}>{f1(b.team.left || 0)}</span> points on the bench</div>
      </div>
      <div style={{ position: "absolute", left: L, right: R, top: 1300, display: "flex", justifyContent: "center" }}><Stamp text="OUCH." color={C.red} at={Math.round(dur * FPS * 0.62)} size={120} rot={6} /></div>
      <Flash at={0} color={C.red} peak={0.4} />
    </AbsoluteFill>
  );
};

const Standings: React.FC<SP> = ({ r, name }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const rows = r.standings.slice(0, 14); const rowH = Math.min(92, 1100 / rows.length);
  return (
    <AbsoluteFill>
      <Field /><Particles n={30} color={C.turf} seed="st" speed={1} size={6} />
      <Header r={r} label="*STANDINGS*" color={C.turf} />
      <div style={{ position: "absolute", top: 440, left: L, width: Wd, display: "grid", gridTemplateColumns: "60px 1fr 120px 150px", gap: 12, fontFamily: BODY, fontWeight: 600, fontSize: 24, letterSpacing: 3, color: C.dim, padding: "0 20px 6px" }}>
        <span>#</span><span>TEAM</span><span style={{ textAlign: "right" }}>W-L</span><span style={{ textAlign: "right" }}>PLAYOFFS</span>
      </div>
      <div style={{ position: "absolute", top: 486, left: L, width: Wd }}>
        {rows.map((s, i) => {
          const t = spring({ frame: f - 6 - i * 3, fps, config: { damping: 15, stiffness: 140 } });
          const mine = s.id === r.myTeamId;
          return (
            <div key={s.id} style={{ height: rowH - 8, marginBottom: 8, display: "grid", gridTemplateColumns: "60px 1fr 120px 150px", gap: 12, alignItems: "center", padding: "0 20px", borderRadius: 18, background: mine ? "rgba(255,198,41,0.14)" : "rgba(255,255,255,0.06)", border: `2px solid ${mine ? C.gold : "rgba(255,255,255,0.08)"}`, opacity: t, translate: `${(1 - t) * -300}px 0` }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: rowH * 0.5, color: i < 3 ? C.gold : C.dim }}>{i + 1}</span>
              <TeamName s={name(s.name)} size={rowH * 0.42} color={mine ? C.gold : C.ink} max={520} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: rowH * 0.42, color: C.ink, textAlign: "right" }}>{s.w}-{s.l}{s.t ? `-${s.t}` : ""}</span>
              <span style={{ textAlign: "right" }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: rowH * 0.44, color: s.odds >= 50 ? C.turf : C.red }}>{Math.round(s.odds)}%</span>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", marginTop: 4, overflow: "hidden" }}><div style={{ width: `${Math.min(100, s.odds) * t}%`, height: "100%", background: s.odds >= 50 ? C.turf : C.red }} /></div>
              </span>
            </div>
          );
        })}
      </div>
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
};

const Next: React.FC<SP> = ({ r, name, dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const n = r.next!; const a = spring({ frame: f - 6, fps, config: { damping: 13, stiffness: 110 } }), b = spring({ frame: f - 14, fps, config: { damping: 13, stiffness: 110 } });
  const fav = n.wa >= 0.5 ? n.a : n.b, pct = Math.round(100 * Math.max(n.wa, 1 - n.wa));
  return (
    <AbsoluteFill>
      <Field /><Particles n={40} color={C.slate} seed="nx" speed={1.4} size={7} />
      <Header r={r} label={`WEEK ${n.week} *PREVIEW*`} color={C.slate} />
      <div style={{ position: "absolute", top: 520, left: L, width: Wd, display: "flex", flexDirection: "column", gap: 30 }}>
        <Glass style={{ padding: "34px 36px", translate: `${(1 - a) * -800}px 0`, opacity: a }}>
          <TeamName s={name(n.a)} size={64} max={880} /><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.dim, marginTop: 6 }}>projected <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 48, color: C.ink }}>{f1(n.pa)}</span></div>
        </Glass>
        <div style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 70, color: C.dim }}>VS</div>
        <Glass style={{ padding: "34px 36px", translate: `${(1 - b) * 800}px 0`, opacity: b }}>
          <TeamName s={name(n.b)} size={64} max={880} /><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.dim, marginTop: 6 }}>projected <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 48, color: C.ink }}>{f1(n.pb)}</span></div>
        </Glass>
      </div>
      <div style={{ position: "absolute", top: 1180, left: L, right: R, textAlign: "center", opacity: interpolate(f, [40, 52], [0, 1], clamp) }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, letterSpacing: 4, color: C.dim }}>GAME OF THE WEEK · WAR ROOM GIVES</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 72, color: C.slate, marginTop: 8 }}><TeamName s={name(fav)} size={72} color={C.slate} max={700} /> {pct}%</div>
      </div>
      <div style={{ position: "absolute", left: L, right: R, top: 1360, display: "flex", justifyContent: "center" }}><Stamp text="LOCK IT IN" color={C.slate} at={Math.round(dur * FPS * 0.65)} size={80} rot={-5} /></div>
      <Flash at={0} peak={0.35} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<SP & { appUrl: string }> = ({ r, name }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Field /><Particles n={70} color={C.turf} seed="out" speed={2} size={8} />
      <div style={{ position: "absolute", top: T + 20, left: L, right: R, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 0.92, color: C.ink }}><Slam at={2}>SEE YOU</Slam></div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 120, lineHeight: 0.92, color: C.gold }}><Slam at={8}>WEEK {r.week + 1}.</Slam></div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim, marginTop: 20, opacity: interpolate(f, [16, 28], [0, 1], clamp), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name(r.league)} · made by War Room</div>
      </div>
      <div style={{ position: "absolute", top: 760, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, color: C.turf, marginBottom: 16, opacity: interpolate(f, [20, 30], [0, 1], clamp) }}>SEND THIS TO THE GROUP CHAT</div>
        <AppLink at={24} size={300} />
      </div>
      <Flash at={2} color={C.turf} peak={0.5} />
    </AbsoluteFill>
  );
};

export const LeagueRecap: React.FC<LeagueRecapProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  if (!p.recap) return <AbsoluteFill style={{ background: "#04110B" }} />;
  const r = p.recap as Recap;
  const name = (s: string) => cleanName(s, p.nameOverrides);
  const scenes = recapScenes(p);
  let from = 0;
  const seqs = scenes.map(s => { const d = Math.round(s.sec * FPS); const x = { ...s, from, d }; from += d; return x; });
  const body = (id: string, d: number) => {
    const sp: SP = { r, name, source: p.source, dur: d / FPS };
    return id === "intro" ? <Intro {...sp} /> : id === "scores" ? <Scores {...sp} /> : id === "highlow" ? <HighLow {...sp} /> : id === "mvp" ? <Mvp {...sp} />
      : id === "blunder" ? <Blunder {...sp} /> : id === "standings" ? <Standings {...sp} /> : id === "next" ? <Next {...sp} /> : <Outro {...sp} appUrl={p.appUrl} />;
  };
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      {seqs.map(s => (
        <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.d}>
          <Punch>{body(s.id, s.d)}</Punch>
          {p.voice && p.voDur && p.voDur[s.id] ? <Sequence from={6} layout="none"><Audio src={staticFile(`recapvo/${s.id}.mp3`)} /></Sequence> : null}
        </Sequence>
      ))}
      {p.music === "bed" ? <Audio src={staticFile("beat40.wav")} loop volume={(f) => interpolate(f, [0, 8, durationInFrames - 24, durationInFrames], [0, p.voice ? 0.16 : 0.55, p.voice ? 0.16 : 0.55, 0], clamp)} /> : null}
    </AbsoluteFill>
  );
};
