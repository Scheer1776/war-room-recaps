import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { AppLink, BODY, C, DISPLAY, Field, Glass, SAFE, teamColor } from "./theme";
import { Flash, Kinetic, Particles, Slam, Stamp, W, clamp } from "./fx";
import { Broll } from "./Examples";

// "Player Hype": a 25 s pre-game hype cut for one player on the owner's team. Real clip in the middle when
// public/<source>/<clip> exists (owner's call on footage, 2026-10-30), the headshot with motion otherwise.
export const hypeSchema = z.object({
  source: z.string(),
  player: z.string(), nick: z.string(), nfl: z.string(), opp: z.string(), num: z.number(),
  photo: z.string(), clip: z.string().nullable(), clipFrom: z.number(), // seconds into the clip to start
  hitAt: z.number(), // frames after the clip starts when the big moment lands (impact boom)
  line1: z.string(), line2: z.string(), // the clip captions
  stats: z.array(z.object({ v: z.number(), label: z.string(), dec: z.number() })),
  quiet: z.array(z.number()), quietLabel: z.string(), hungry: z.string(),
  game: z.string(), proj: z.number(), projYds: z.number(), stamp: z.string(),
  appShot: z.string(),
});
export type HypeProps = z.infer<typeof hypeSchema>;
export const hypeFrames = 750;

const T = [0, 90, 240, 400, 520, 630, 750]; // scene starts (frames): hook, clip, stats, quiet, matchup, cta

const Photo: React.FC<{ src: string; col: string; f: number; big?: boolean }> = ({ src, col, f, big }) => (
  <div style={{ position: "absolute", left: 0, width: W, top: big ? 600 : 560, height: big ? 820 : 700, display: "flex", justifyContent: "center" }}>
    <div style={{ position: "absolute", top: "20%", width: 700, height: 700, borderRadius: 350, background: `radial-gradient(circle, ${col} 0%, ${col}55 50%, transparent 72%)`, filter: "blur(14px)", transform: `scale(${1 + Math.sin(f / 20) * 0.04})` }} />
    <Img src={src} style={{ height: "100%", objectFit: "contain", filter: "drop-shadow(0 40px 60px rgba(0,0,0,0.8)) contrast(1.08)", transform: `scale(${1.02 + Math.sin(f / 30) * 0.02}) translateY(${Math.sin(f / 25) * 6}px)` }} />
  </div>
);

export const PlayerHype: React.FC<HypeProps> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const col = teamColor(p.nfl), ocol = teamColor(p.opp);
  const photo = staticFile(`${p.source}/${p.photo}`);
  const scene = T.findIndex((t, i) => f >= t && f < T[i + 1]);
  const sf = f - T[Math.max(0, scene)];
  const shake = scene === 0 && sf < 8 ? `translate(${(8 - sf) * (sf % 2 ? 6 : -6)}px, 0)` : undefined;
  return (
    <AbsoluteFill style={{ background: C.bg2, transform: shake }}>
      <Audio src={staticFile("beat40.wav")} loop volume={(t) => interpolate(t, [0, 4, hypeFrames - 24, hypeFrames], [0, 0.6, 0.6, 0], clamp)} />
      <Sequence from={0} durationInFrames={40}><Audio src={staticFile(`${p.source}/boom.wav`)} volume={0.9} /></Sequence>
      {p.clip && <Sequence from={T[1] + p.hitAt} durationInFrames={40}><Audio src={staticFile(`${p.source}/boom.wav`)} volume={1} /></Sequence>}
      <Field />
      <Particles n={80} color={col} seed="hype" speed={1.6} size={8} />
      {scene === 0 && (
        <>
          <Photo src={photo} col={col} f={f} big />
          <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 200, lineHeight: 0.86, color: C.ink, textShadow: `0 0 80px ${col}` }}><Slam at={2}>{p.nick.toUpperCase()}</Slam></div>
          </div>
          <div style={{ position: "absolute", top: 1430, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
            <Kinetic text={`${p.nfl} vs ${p.opp} · ${p.game}`} at={30} size={64} color={C.gold} />
          </div>
          <Flash at={0} color={col} peak={0.8} />
        </>
      )}
      {scene === 1 && (
        <>
          {p.clip ? (
            <AbsoluteFill style={{ overflow: "hidden" }}>
              <Sequence from={T[1]} layout="none"><OffthreadVideo src={staticFile(`${p.source}/${p.clip}`)} startFrom={Math.round(p.clipFrom * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /></Sequence>
              <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,17,11,0.55) 0%, transparent 22%, transparent 78%, rgba(4,17,11,0.6) 100%)" }} />
            </AbsoluteFill>
          ) : (
            <><Broll src={null} from={T[1]} dim={0.4} /><Photo src={photo} col={col} f={f} /></>
          )}
          <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right }}>
            <Kinetic text={p.line1} at={T[1] + 6} size={78} align="left" accent={C.gold} />
          </div>
          <div style={{ position: "absolute", top: 1490, left: SAFE.left, right: SAFE.right }}>
            <Kinetic text={p.line2} at={T[1] + 70} size={72} align="left" color={C.ink} accent={C.gold} />
          </div>
          <Flash at={T[1]} color="#fff" peak={0.5} />
        </>
      )}
      {scene === 2 && (
        <>
          <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right }}>
            <Kinetic text="THE RESUME." at={T[2] + 2} size={110} align="left" color={C.dim} />
          </div>
          <div style={{ position: "absolute", top: 520, left: SAFE.left, width: W - SAFE.left - SAFE.right, display: "flex", flexDirection: "column", gap: 22 }}>
            {p.stats.map((s, i) => {
              const v = interpolate(f, [T[2] + 12 + i * 22, T[2] + 52 + i * 22], [0, s.v], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
              const inn = spring({ frame: f - (T[2] + 10 + i * 22), fps, config: { damping: 14, stiffness: 90 } });
              return (
                <Glass key={i} style={{ padding: "22px 36px", display: "flex", alignItems: "baseline", justifyContent: "space-between", translate: `${(1 - inn) * -200}px 0`, opacity: inn }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 1, color: i === 0 ? C.gold : C.ink }}>{v.toFixed(s.dec)}</span>
                  <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.dim, textAlign: "right", maxWidth: 380 }}>{s.label}</span>
                </Glass>
              );
            })}
          </div>
        </>
      )}
      {scene === 3 && (
        <>
          <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right }}>
            <Kinetic text={p.quietLabel} at={T[3] + 2} size={110} align="left" color={C.ink} accent={C.red} />
          </div>
          <div style={{ position: "absolute", top: 600, left: SAFE.left, right: SAFE.right, display: "flex", gap: 30, justifyContent: "center" }}>
            {p.quiet.map((q, i) => { const inn = spring({ frame: f - (T[3] + 14 + i * 12), fps, config: { damping: 12, stiffness: 120 } }); return (
              <Glass key={i} style={{ width: 330, padding: "30px 0", textAlign: "center", scale: String(inn), opacity: inn }} tint="rgba(60,20,20,0.6)">
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 140, lineHeight: 1, color: C.red }}>{q.toFixed(1)}</div>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim }}>WEEK {6 + i}</div>
              </Glass>); })}
          </div>
          <div style={{ position: "absolute", top: 1000, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 0.9, color: C.ink, textShadow: `0 0 80px ${col}` }}><Slam at={T[3] + 60}>{p.hungry}</Slam></div>
          </div>
          <Flash at={T[3] + 60} color={col} peak={0.6} />
        </>
      )}
      {scene === 4 && (
        <>
          <Photo src={photo} col={col} f={f} />
          <div style={{ position: "absolute", top: SAFE.top - 20, left: 0, width: W, display: "flex", justifyContent: "center", gap: 40, alignItems: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, color: col, textShadow: `0 0 60px ${col}88` }}><Slam at={T[4] + 2}>{p.nfl}</Slam></div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 70, color: C.dim }}>vs</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 170, color: ocol, textShadow: `0 0 60px ${ocol}88` }}><Slam at={T[4] + 8}>{p.opp}</Slam></div>
          </div>
          <div style={{ position: "absolute", top: 440, left: SAFE.left, right: SAFE.right, textAlign: "center", fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.dim, opacity: interpolate(f, [T[4] + 14, T[4] + 26], [0, 1], clamp) }}>{p.game} · projected {p.proj} pts · {p.projYds} rush yds</div>
          <div style={{ position: "absolute", top: 1240, left: 0, width: W, display: "flex", justifyContent: "center" }}><Stamp text={p.stamp} color={C.turf} at={T[4] + 40} size={110} rot={-6} /></div>
          <Flash at={T[4]} color={ocol} peak={0.4} />
        </>
      )}
      {scene === 5 && (
        <>
          <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 110, lineHeight: 0.95, color: C.ink }}><Slam at={T[5] + 2}>YOUR LEAGUE.</Slam></div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 110, lineHeight: 0.95, color: C.gold }}><Slam at={T[5] + 8}>YOUR WAR ROOM.</Slam></div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.dim, marginTop: 16, opacity: interpolate(f, [T[5] + 16, T[5] + 28], [0, 1], clamp) }}>start/sit · trades · waivers · live red zone · free</div>
          </div>
          <div style={{ position: "absolute", left: 540 - 170, top: 560, width: 340, height: 420, borderRadius: 50, background: "#050a07", padding: 12, boxShadow: `0 0 0 4px rgba(255,255,255,0.18), 0 60px 120px -30px rgba(0,0,0,0.9), 0 0 120px -40px ${C.turf}` }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 40, overflow: "hidden", position: "relative" }}><Img src={staticFile(p.appShot)} style={{ width: "100%", position: "absolute", top: 0 }} /></div>
          </div>
          <div style={{ position: "absolute", top: 1030, left: 0, width: W, display: "flex", justifyContent: "center" }}><AppLink at={T[5] + 12} size={250} /></div>
        </>
      )}
    </AbsoluteFill>
  );
};
