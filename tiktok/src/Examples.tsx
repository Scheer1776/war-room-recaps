import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY, C, DISPLAY, SAFE, teamColor } from "./theme";
import { Flash, Kinetic, Particles, Slam, Stamp, W, H, clamp } from "./fx";

// Two example layers the owner asked for (2026-10-30): licensed football B-roll behind the kinetic text, and an
// animated play. Both are plain CSS/SVG (no WebGL), so they render fast and can be dropped into any format.


/* ---------- 1. B-roll layer ----------
   `src` = an MP4 under public/broll/ (licensed stock: Pexels/Storyblocks, never NFL footage). With no file it draws a
   procedural stand-in: stadium light beams, crowd bokeh, rain, slow handheld drift. Either way it's darkened and
   desaturated so the text stays legible, and it slowly pushes in (Ken Burns). */
export const Broll: React.FC<{ src?: string | null; from?: number; dim?: number; zoom?: number }> = ({ src, from = 0, dim = 0.55, zoom = 1.08 }) => {
  const f = useCurrentFrame() - from;
  const { durationInFrames } = useVideoConfig();
  const z = interpolate(f, [0, durationInFrames], [1, zoom], clamp);
  const drift = Math.sin(f / 37) * 6;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: C.bg2 }}>
      <AbsoluteFill style={{ transform: `scale(${z}) translate(${drift}px, ${Math.cos(f / 41) * 4}px)`, filter: "saturate(0.55) contrast(1.05)" }}>
        {src ? (
          <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <ProceduralStadium f={f} />
        )}
      </AbsoluteFill>
      {/* legibility: top/bottom darkening and a green tint so it matches the house look */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(4,17,11,${dim + 0.25}) 0%, rgba(4,17,11,${dim - 0.2}) 45%, rgba(4,17,11,${dim + 0.3}) 100%)` }} />
      <AbsoluteFill style={{ background: C.bg1, opacity: 0.22, mixBlendMode: "color" }} />
    </AbsoluteFill>
  );
};

const ProceduralStadium: React.FC<{ f: number }> = ({ f }) => {
  const beams = [0.15, 0.38, 0.62, 0.85];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #06120c 0%, #0b2a1b 55%, #0a2416 100%)" }}>
      {/* crowd bokeh: thousands of phone lights */}
      <Particles n={420} color="#F3F7F4" seed="crowd" speed={0.25} size={5} />
      <Particles n={60} color={C.gold} seed="flash" speed={2.5} size={7} />
      {/* light beams sweeping */}
      {beams.map((x, i) => {
        const ang = Math.sin(f / (50 + i * 9) + i) * 9;
        return <div key={i} style={{ position: "absolute", left: x * W - 90, top: -200, width: 180, height: H * 0.9, background: "linear-gradient(180deg, rgba(255,246,214,0.34), rgba(255,246,214,0) 85%)", transformOrigin: "50% 0", transform: `rotate(${ang}deg)`, filter: "blur(18px)" }} />;
      })}
      {/* turf with yard lines, in perspective */}
      <div style={{ position: "absolute", left: -300, right: -300, bottom: 0, height: 760, background: "linear-gradient(180deg, #0e3a24, #082818)", transform: "perspective(900px) rotateX(58deg)", transformOrigin: "50% 100%", backgroundImage: `repeating-linear-gradient(180deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 90px)`, backgroundPositionY: `${(f * 2) % 90}px` }} />
      {/* rain */}
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(100deg, rgba(255,255,255,0.09) 0 2px, transparent 2px 26px)", backgroundPosition: `${f * 7}px ${f * 23}px`, opacity: 0.7 }} />
      <AbsoluteFill style={{ background: "radial-gradient(70% 50% at 50% 35%, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};

export const BrollExample: React.FC<{ src: string | null }> = ({ src }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg2 }}>
      <Broll src={src} />
      <div style={{ position: "absolute", top: SAFE.top + 60, left: SAFE.left, right: SAFE.right }}>
        <Kinetic text="JORDAN LOVE" at={4} size={150} color={C.ink} align="left" />
        <Kinetic text="*3 TOUCHDOWNS.*" at={16} size={110} align="left" accent={C.gold} />
        <Kinetic text="WIN PROBABILITY WAS 48%" at={34} size={64} color={C.dim} align="left" />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, top: 1150, display: "flex" }}><Stamp text="NEVER IN DOUBT? NOPE." color={C.gold} at={52} size={78} rot={-6} /></div>
      <div style={{ position: "absolute", left: SAFE.left, top: 1330, fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim, opacity: interpolate(f, [70, 84], [0, 1], clamp) }}>
        B-roll layer · {src ? "licensed stock clip" : "procedural stand-in (swap in any licensed MP4)"}
      </div>
      <Flash at={0} color={C.turf} peak={0.5} />
    </AbsoluteFill>
  );
};

/* ---------- 2. Animated play ----------
   A schematic top-down field (not real tracking data): offense O's, a defender X, one route drawn live, the ball
   flying along an arc, the catch, then the verdict. Colors come from the team. */
type Pt = [number, number];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pathLen = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const along = (pts: Pt[], t: number): Pt => {
  const total = pathLen(pts); let d = t * total;
  for (let i = 1; i < pts.length; i++) { const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= seg) return lerp(pts[i - 1], pts[i], seg ? d / seg : 0); d -= seg; }
  return pts[pts.length - 1];
};

export const PlayAnimExample: React.FC<{ nfl: string; opp: string; player: string; num: number; stat: string; stamp: string }> = ({ nfl, opp, player, num, stat, stamp }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const col = teamColor(nfl), ocol = teamColor(opp);
  // field: 1080 wide, from the 25 (bottom) to the back of the end zone (top). 10 yards = 150px.
  const top = 480, yard = 15, fieldH = 35 * yard; // 25 yards + 10 yd end zone
  const yOf = (yd: number) => top + (35 - yd) * yard; // yd 0 = goal line
  const los = yOf(-14); // snap from the 14
  // route: post from the right slot. Snap at frame 18, throw at 44, catch at 68.
  const route: Pt[] = [[720, los], [720, yOf(-2)], [600, yOf(4)]];
  const snapAt = 18, throwAt = 44, catchAt = 68;
  const rt = interpolate(f, [snapAt, catchAt], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const wr = along(route, rt);
  const db = along([[760, los - 7 * yard], [735, yOf(-1)], [640, yOf(3)]], interpolate(f, [snapAt + 4, catchAt + 2], [0, 1], clamp));
  const qb: Pt = [540, los + 5 * yard - interpolate(f, [snapAt, snapAt + 16], [0, 40], clamp)];
  const bt = interpolate(f, [throwAt, catchAt], [0, 1], clamp);
  const ball: Pt = [qb[0] + (wr[0] - qb[0]) * bt, qb[1] + (wr[1] - qb[1]) * bt - Math.sin(bt * Math.PI) * 170];
  const drawn = interpolate(f, [snapAt, catchAt], [0, 1], clamp);
  const catchPop = spring({ frame: f - catchAt, fps, config: { damping: 9, stiffness: 160 } });
  const oLine = [-120, -60, 0, 60, 120].map((dx) => [540 + dx, los + 10] as Pt);
  const dLine = [-100, -35, 35, 100].map((dx) => [540 + dx, los - 18] as Pt);
  return (
    <AbsoluteFill style={{ background: C.bg2 }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at 50% 30%, ${col}22, transparent 70%)` }} />
      <div style={{ position: "absolute", top: SAFE.top - 20, left: SAFE.left, right: SAFE.right }}>
        <Kinetic text="THE PLAY" at={2} size={60} color={C.dim} align="left" />
        <Kinetic text={`*${player.toUpperCase()}* · ${stat.toUpperCase()}`} at={10} size={80} align="left" accent={col} />
      </div>
      {/* field */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs><filter id="g"><feGaussianBlur stdDeviation="6" /></filter></defs>
        <rect x={60} y={top} width={W - 120} height={fieldH} rx={28} fill="#0B2A1B" stroke="rgba(255,255,255,0.18)" strokeWidth={4} />
        <rect x={60} y={top} width={W - 120} height={10 * yard} fill={col} opacity={0.28} />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i}>
            <line x1={60} x2={W - 60} y1={yOf(i * 5 - 25)} y2={yOf(i * 5 - 25)} stroke="rgba(255,255,255,0.22)" strokeWidth={i % 2 ? 2 : 4} />
            {i % 2 === 0 && i > 0 && <text x={95} y={yOf(i * 5 - 25) - 8} fill="rgba(255,255,255,0.45)" fontFamily={DISPLAY} fontWeight={800} fontSize={40}>{i * 5 === 25 ? "G" : 25 - i * 5}</text>}
          </g>
        ))}
        <text x={W / 2} y={top + 7 * yard} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontFamily={DISPLAY} fontWeight={800} fontSize={90} letterSpacing={8}>{nfl}</text>
        <line x1={60} x2={W - 60} y1={los} y2={los} stroke={C.gold} strokeWidth={4} strokeDasharray="14 10" />
        {/* route: drawn progressively */}
        <polyline points={route.map((p) => p.join(",")).join(" ")} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={pathLen(route)} strokeDashoffset={pathLen(route) * (1 - drawn)} filter="url(#g)" opacity={0.8} />
        <polyline points={route.map((p) => p.join(",")).join(" ")} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={pathLen(route)} strokeDashoffset={pathLen(route) * (1 - drawn)} />
        {/* ball arc (shadow of the path) */}
        {f >= throwAt && <path d={`M ${qb[0]} ${qb[1]} Q ${(qb[0] + wr[0]) / 2} ${Math.min(qb[1], wr[1]) - 260} ${wr[0]} ${wr[1]}`} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={3} strokeDasharray="8 12" />}
        {/* linemen */}
        {oLine.map((p, i) => <circle key={"o" + i} cx={p[0]} cy={p[1]} r={16} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={4} />)}
        {dLine.map((p, i) => <text key={"d" + i} x={p[0]} y={p[1] + 10} textAnchor="middle" fill={ocol} fontFamily={DISPLAY} fontWeight={800} fontSize={40}>X</text>)}
        {/* defender, QB, receiver */}
        <text x={db[0]} y={db[1] + 12} textAnchor="middle" fill={ocol} fontFamily={DISPLAY} fontWeight={800} fontSize={44}>X</text>
        <circle cx={qb[0]} cy={qb[1]} r={20} fill="none" stroke={C.ink} strokeWidth={5} />
        <text x={qb[0]} y={qb[1] + 9} textAnchor="middle" fill={C.ink} fontFamily={DISPLAY} fontWeight={800} fontSize={26}>QB</text>
        <circle cx={wr[0]} cy={wr[1]} r={26 + catchPop * 10} fill={col} stroke="#fff" strokeWidth={5} />
        <text x={wr[0]} y={wr[1] + 11} textAnchor="middle" fill="#04110B" fontFamily={DISPLAY} fontWeight={800} fontSize={30}>{num}</text>
        {/* ball */}
        {f >= throwAt && f <= catchAt && <ellipse cx={ball[0]} cy={ball[1]} rx={14} ry={9} fill="#B5651D" stroke="#fff" strokeWidth={2} transform={`rotate(${(f - throwAt) * 24} ${ball[0]} ${ball[1]})`} />}
        {/* catch burst */}
        {f >= catchAt && <circle cx={wr[0]} cy={wr[1]} r={30 + (f - catchAt) * 9} fill="none" stroke={col} strokeWidth={6} opacity={Math.max(0, 1 - (f - catchAt) / 22)} />}
      </svg>
      <div style={{ position: "absolute", left: SAFE.left, top: top + fieldH + 30, display: "flex", gap: 18 }}>
        <Stamp text="TOUCHDOWN" color={C.turf} at={catchAt + 2} size={96} rot={-5} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: top + fieldH + 190 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1, color: C.ink }}><Slam at={catchAt + 14}>{stamp}</Slam></div>
        <div style={{ marginTop: 10, fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim, opacity: interpolate(f, [catchAt + 20, catchAt + 32], [0, 1], clamp) }}>Animated play · schematic route, not tracking data</div>
      </div>
      <Flash at={catchAt} color={col} peak={0.5} />
    </AbsoluteFill>
  );
};
