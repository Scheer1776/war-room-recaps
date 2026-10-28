import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/fonts";

// Same night-game look as War Room and the HD recap.
export const C = {
  bg1: "#0B2A1B", bg2: "#04110B", ink: "#F3F7F4", dim: "rgba(243,247,244,0.66)",
  turf: "#3DDB86", pylon: "#FF6B2C", gold: "#FFC629", red: "#FF5E52", slate: "#8CC4FF",
};
export const DISPLAY = "Saira Condensed";
// TikTok/Reels overlay their own UI: tabs on top, action buttons on the right, caption at the bottom.
export const SAFE = { top: 230, right: 160, bottom: 420, left: 80 };
export const BODY = "Barlow";

export const fontsReady = Promise.all([
  loadFont({ family: DISPLAY, url: staticFile("fonts/SairaCondensed-ExtraBold.ttf"), weight: "800" }),
  loadFont({ family: DISPLAY, url: staticFile("fonts/SairaCondensed-SemiBold.ttf"), weight: "600" }),
  loadFont({ family: BODY, url: staticFile("fonts/Barlow-SemiBold.ttf"), weight: "600" }),
]);

const TEAM_COLOR: Record<string, string> = { ARI: "#C8102E", ATL: "#D0102E", BAL: "#6A4FD8", BUF: "#2F6BFF", CAR: "#0085CA", CHI: "#E8562A", CIN: "#FB4F14", CLE: "#FF5A1F",
  DAL: "#8FA8C8", DEN: "#FB4F14", DET: "#1B9BE0", GB: "#FFB612", HOU: "#D0243F", IND: "#3A82D8", JAX: "#D7A22A", KC: "#F0263F", LAC: "#21A0E8",
  LAR: "#FFB000", LV: "#B9C0C4", MIA: "#00B3BD", MIN: "#8A5CE0", NE: "#E0263F", NO: "#D3BC8D", NYG: "#4A6BE8", NYJ: "#22A45D", PHI: "#00A3AD",
  PIT: "#FFB612", SF: "#D92A2A", SEA: "#69BE28", TB: "#E8261E", TEN: "#4B92DB", WAS: "#C9373C" };
export const teamColor = (nfl: string) => TEAM_COLOR[nfl] || C.turf;

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// 0→1 over [start, start+dur] frames with a soft ease-out.
export const useIn = (start: number, dur = 14) => {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing: ease });
};
export const countUp = (frame: number, start: number, dur: number, to: number) =>
  interpolate(frame, [start, start + dur], [0, to], { ...clamp, easing: Easing.out(Easing.cubic) });

// Stadium-lit field with yard lines drifting slowly upward.
export const Field: React.FC = () => {
  const f = useCurrentFrame();
  const off = (f * 1.4) % 160;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 20% -10%, rgba(255,246,214,0.16), transparent 60%), radial-gradient(900px 600px at 95% 0%, rgba(214,236,255,0.10), transparent 60%), linear-gradient(180deg, ${C.bg1}, ${C.bg2})` }}>
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 4px, transparent 4px)", backgroundSize: "100% 160px", backgroundPosition: `0 ${-off}px` }} />
      <AbsoluteFill style={{ background: "radial-gradient(130% 90% at 50% 20%, transparent 45%, rgba(2,10,6,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};

export const Glass: React.FC<{ style?: React.CSSProperties; children: React.ReactNode; tint?: string }> = ({ style, children, tint }) => (
  <div style={{
    background: `linear-gradient(155deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.02)), ${tint || "rgba(16,40,28,0.62)"}`,
    border: "2px solid rgba(255,255,255,0.16)", borderRadius: 40,
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.22), 0 30px 60px -30px rgba(0,0,0,0.7)", ...style,
  }}>{children}</div>
);

export const Face: React.FC<{ src: string | null; nfl: string; size: number; initials: string }> = ({ src, nfl, size, initials }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", position: "relative", flex: "none",
    background: `radial-gradient(circle at 50% 120%, ${teamColor(nfl)}, #061209 75%)`, boxShadow: `0 0 0 ${Math.round(size / 28)}px ${teamColor(nfl)}, 0 0 ${size / 4}px -${size / 20}px ${teamColor(nfl)}` }}>
    {src ? <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" }} />
      : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: size / 3, color: "#fff" }}>{initials}</div>}
  </div>
);

// Small top line on every scene: league + week, so a viewer always knows what they're watching.
export const Kicker: React.FC<{ league: string; week: number; label: string; color: string; t: number }> = ({ league, week, label, color, t }) => (
  <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, opacity: t, translate: `0 ${(1 - t) * -30}px`, textAlign: "center" }}>
    <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, letterSpacing: 4, color: C.dim, textTransform: "uppercase" }}>{league} · Week {week}</div>
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 112, lineHeight: 1, color, marginTop: 8, textTransform: "uppercase" }}>{label}</div>
  </div>
);

export const initialsOf = (n: string) => n.split(/\s+/).map(s => s[0]).join("").slice(0, 2).toUpperCase();
export const f1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
