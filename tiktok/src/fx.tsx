import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, HtmlInCanvas, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { glow } from "@remotion/effects/glow";
import { chromaticAberration } from "@remotion/effects/chromatic-aberration";
import { shatter } from "@remotion/effects/shatter";
import { lightLeak } from "@remotion/effects/light-leak";
import { noise2D, noise3D } from "@remotion/noise";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BODY, C, DISPLAY } from "./theme";

// Shared "big budget" effects for the showcase videos. Everything here renders with --gl=swangle
// (set in remotion.config.ts): WebGL shader effects through HtmlInCanvas, three.js scenes, noise fields.
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const W = 1080, H = 1920;

export const useShake = (at: number, amp = 14, len = 10) => {
  const f = useCurrentFrame() - at;
  if (f < 0 || f > len) return "0px 0px";
  const k = amp * (1 - f / len);
  return `${Math.sin(f * 2.7) * k}px ${Math.cos(f * 3.3) * k}px`;
};
export const Flash: React.FC<{ at: number; color?: string; peak?: number }> = ({ at, color = "#fff", peak = 0.6 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 1, at + 8], [0, peak, 0], clamp);
  return o > 0 ? <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} /> : null;
};

// A word or number that slams in from scale 2.4 with a spring.
export const Slam: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({ at, children, style, from = 2.4 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  return <span style={{ display: "inline-block", opacity: f < at ? 0 : Math.min(1, s * 3), scale: String(from - (from - 1) * s), ...style }}>{children}</span>;
};

// Kinetic line: words pop in one after another. hot words (numbers, or wrapped in *stars*) go gold.
export const Kinetic: React.FC<{ text: string; at: number; gap?: number; size?: number; color?: string; align?: "left" | "center"; style?: React.CSSProperties; accent?: string }> = ({ text, at, gap = 3, size = 92, color = C.ink, align = "center", style, accent = C.gold }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `0 ${size * 0.22}px`, ...style }}>
      {text.split(" ").map((raw, i) => {
        const hot = raw.startsWith("*") || /\d/.test(raw);
        const w = raw.replace(/\*/g, "");
        const s = spring({ frame: f - at - i * gap, fps, config: { damping: 11, stiffness: 240, mass: 0.6 } });
        return <span key={i} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.02, color: hot ? accent : color, opacity: f < at + i * gap ? 0 : Math.min(1, s * 2), translate: `0 ${(1 - s) * 60}px`, rotate: `${(1 - s) * -6}deg`, scale: String(0.7 + 0.3 * s), textShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>{w}</span>;
      })}
    </div>
  );
};

// Counter easing out to `to` over [at, at+dur].
export const useCount = (at: number, dur: number, to: number, pow = 4) => {
  const f = useCurrentFrame();
  return interpolate(f, [at, at + dur], [0, to], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, pow) });
};

// Drifting glowing particles driven by simplex noise (deterministic per frame).
export const Particles: React.FC<{ n?: number; color?: string; seed?: string; speed?: number; size?: number; opacity?: number }> = ({ n = 70, color = C.turf, seed = "p", speed = 1, size = 8, opacity = 0.8 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => {
        const t = (f * speed) / 90;
        const x = (noise2D(seed + "x" + i, t, i * 0.37) * 0.5 + 0.5) * W;
        const y = ((noise2D(seed + "y" + i, t, i * 0.91) * 0.5 + 0.5) * H + f * speed * 1.5 * (0.4 + (i % 5) / 5)) % H;
        const s = size * (0.5 + ((i * 7) % 10) / 10);
        const o = opacity * (0.4 + 0.6 * (noise3D(seed + "o", i, t, 0) * 0.5 + 0.5));
        return <div key={i} style={{ position: "absolute", left: x, top: H - y, width: s, height: s, borderRadius: "50%", background: color, opacity: o, boxShadow: `0 0 ${s * 2.5}px ${color}` }} />;
      })}
    </AbsoluteFill>
  );
};

// WebGL glow + RGB split around any DOM content (HTML-in-canvas). Use sparingly: each is a GPU pass.
export const Neon: React.FC<{ children: React.ReactNode; width?: number; height?: number; color?: string; radius?: number; intensity?: number; split?: number; style?: React.CSSProperties }> = ({ children, width = W, height = 600, color = C.turf, radius = 36, intensity = 1.6, split = 0, style }) => (
  <HtmlInCanvas width={width} height={height} effects={[glow({ radius, intensity, color, threshold: 0.2 }), chromaticAberration({ amount: split, disabled: split <= 0 })]} style={{ position: "absolute", width, height, ...style }}>
    <div style={{ position: "absolute", inset: 0 }}>{children}</div>
  </HtmlInCanvas>
);

// Content that shatters into bricks from frame `at`. Before `at` it is drawn untouched.
export const Shatter: React.FC<{ at: number; children: React.ReactNode; width?: number; height?: number; style?: React.CSSProperties; seed?: number; repetitions?: number }> = ({ at, children, width = W, height = 700, style, seed = 1, repetitions = 11 }) => {
  const f = useCurrentFrame();
  const t = Math.max(0, (f - at) / 30);
  return (
    <HtmlInCanvas width={width} height={height} effects={[shatter({ time: t, repetitions, pattern: "bricks", strength: 7, gravity: 4, rotationSpeed: 0.5, randomness: 0.4, seed, disabled: t <= 0 })]} style={{ position: "absolute", width, height, ...style }}>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </HtmlInCanvas>
  );
};

// Warm light leak sweeping over the frame (screen blend), progress 0→1 over [at, at+dur].
export const Leak: React.FC<{ at: number; dur?: number; seed?: number; hue?: number; opacity?: number }> = ({ at, dur = 40, seed = 1, hue = 90, opacity = 0.55 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], clamp);
  if (f < at || f > at + dur) return null;
  return (
    <HtmlInCanvas width={540} height={960} effects={[lightLeak({ seed, hueShift: hue, progress: p })]} style={{ position: "absolute", inset: 0, width: W, height: H, mixBlendMode: "screen", opacity, pointerEvents: "none" }}>
      <div style={{ width: 540, height: 960, background: "#000" }} />
    </HtmlInCanvas>
  );
};

// A 3D phone (rounded body + screen texture) in three.js. yaw/pitch in radians; screenshot is a staticFile path.
const useImageTexture = (src: string, crop: number) => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const h = delayRender("phone texture " + src);
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.repeat.set(1, crop); t.offset.set(0, 1 - crop);
      t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      t.needsUpdate = true;
      setTex(t); continueRender(h);
    };
    img.onerror = (e) => { console.log("phone texture failed", src, String(e)); continueRender(h); };
    img.src = staticFile(src);
  }, [src, crop]);
  return tex;
};
const PhoneMesh: React.FC<{ tex: THREE.Texture; yaw: number; pitch: number; y: number; scale: number }> = ({ tex, yaw, pitch, y, scale }) => {
  const body = useMemo(() => new RoundedBoxGeometry(1.9, 4.0, 0.22, 6, 0.22), []);
  return (
    <group position={[0, y, 0]} rotation={[pitch, yaw, 0]} scale={scale}>
      <mesh geometry={body}><meshStandardMaterial color="#0a1b12" metalness={0.75} roughness={0.28} /></mesh>
      <mesh position={[0, 0, 0.115]}><planeGeometry args={[1.72, 3.78]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
};
// The texture is loaded before the canvas mounts: Remotion's ThreeCanvas only redraws when the frame changes,
// so a texture that arrives later would never be painted.
export const Phone3D: React.FC<{ src: string; yaw: number; pitch?: number; y?: number; scale?: number; width?: number; height?: number; glowColor?: string; crop?: number; style?: React.CSSProperties }> = ({ src, yaw, pitch = 0.06, y = 0, scale = 1, width = W, height = 1300, glowColor = C.turf, crop = 0.62, style }) => {
  const tex = useImageTexture(src, crop);
  return (
    <div style={{ position: "absolute", width, height, ...style }}>
      {tex ? (
        <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 7.2], fov: 38 }} style={{ background: "transparent" }} gl={{ alpha: true, antialias: true }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[4, 6, 6]} intensity={2.2} color="#ffffff" />
          <pointLight position={[-4, -3, 4]} intensity={30} color={glowColor} />
          <PhoneMesh tex={tex} yaw={yaw} pitch={pitch} y={y} scale={scale} />
        </ThreeCanvas>
      ) : null}
    </div>
  );
};

// Small progress pips + section kicker, placed under the TikTok top bar.
export const Kicker: React.FC<{ text: string; i?: number; n?: number; color?: string; top: number; left: number; right: number }> = ({ text, i, n, color = C.dim, top, left, right }) => (
  <div style={{ position: "absolute", top, left, right, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, letterSpacing: 5, color, textTransform: "uppercase" }}>{text}</div>
    {n ? <div style={{ display: "flex", gap: 8 }}>{Array.from({ length: n }, (_, k) => <div key={k} style={{ width: 30, height: 9, borderRadius: 5, background: k <= (i ?? -1) ? C.gold : "rgba(255,255,255,0.18)" }} />)}</div> : null}
  </div>
);

// Stamp with glow (verdicts).
export const Stamp: React.FC<{ text: string; color: string; at: number; size?: number; rot?: number }> = ({ text, color, at, size = 120, rot = -6 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = spring({ frame: f - at, fps, config: { damping: 10, stiffness: 220, mass: 0.7 } });
  if (f < at) return null;
  return (
    <div style={{ display: "inline-block", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.02, color, border: `12px solid ${color}`, borderRadius: 26, padding: "0 34px", whiteSpace: "nowrap", rotate: `${rot}deg`, scale: String(2.6 - 1.6 * st), opacity: Math.min(1, st * 2),
      background: "rgba(4,17,11,0.6)", boxShadow: `0 0 70px -10px ${color}, inset 0 0 30px -10px ${color}`, textShadow: `0 0 30px ${color}` }}>{text}</div>
  );
};
