import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { AppLink, BODY, C, DISPLAY, Field, Glass, SAFE, f1, teamColor } from "./theme";

// "Waiver Heat" as a TikTok photo carousel (NEW 2026-11-02): hook, heat board, one slide per pick, app slide.
// One frame = one 1080x1920 slide: `npx remotion still WaiverSlides out/wh/0N.png --frame=N`.
// Data: public/<source>/waivers.json from scripts/waiverslides.mjs (Sleeper trending adds since Sunday, 4 weeks of usage,
// next week's projection) + transparent Sleeper headshots in public/<source>/h/<id>.jpg.
// New looks: giant outlined jersey numeral behind the cutout, a 4-week "usage strip" (bar = snap share, label = points),
// flame-gradient heat bars with a halftone texture.
const wk = z.object({ w: z.number(), pts: z.number().nullable(), tgt: z.number().optional(), rec: z.number().optional(), ryd: z.number().optional(), att: z.number().optional(),
  rush: z.number().optional(), td: z.number().optional(), snp: z.number().nullable().optional(), tsnp: z.number().nullable().optional() });
const pl = z.object({ id: z.string(), n: z.string(), num: z.number().nullable(), pos: z.string(), nfl: z.string(), adds: z.number(), proj: z.number(), opp: z.string().nullable(), avg: z.number(), gp: z.number(), wk: z.array(wk) });
type P = z.infer<typeof pl>;
export const waiverSlidesSchema = z.object({
  source: z.string(),
  hook: z.tuple([z.string(), z.string()]), // two lines: white, then the red "trap" line
  picks: z.array(z.object({ id: z.string(), verdict: z.enum(["ADD", "FADE", "TRAP"]), title: z.string(), why: z.string(), stat: z.object({ v: z.string(), label: z.string() }) })),
  appShot: z.string(),
  boardSize: z.number(),
  data: z.object({ week: z.number(), next: z.number(), lookback: z.number(), players: z.array(pl) }).nullable(),
});
export type WaiverSlidesProps = z.infer<typeof waiverSlidesSchema>;
export const waiverSlides = (p: WaiverSlidesProps) => 3 + p.picks.length;

const Wd = 1080 - SAFE.left - SAFE.right;
const VC = { ADD: C.turf, FADE: C.gold, TRAP: C.red } as const;
const fmt = (n: number) => n.toLocaleString("en-US");
const head = (p: WaiverSlidesProps, id: string) => staticFile(`${p.source}/h/${id}.jpg`);
const last = (n: string) => n.split(" ").slice(1).join(" ") || n;

// halftone dots, used on heat bars and behind cutouts
const halftone = (col: string, s = 14) => ({ backgroundImage: `radial-gradient(${col} 28%, transparent 30%)`, backgroundSize: `${s}px ${s}px` });

const Stamp: React.FC<{ text: string; color: string; size: number; rot?: number }> = ({ text, color, size, rot = -7 }) => (
  <div style={{ display: "inline-block", rotate: `${rot}deg`, border: `${Math.round(size / 11)}px solid ${color}`, borderRadius: size * 0.18, padding: `${size * 0.04}px ${size * 0.28}px`,
    fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.05, color, letterSpacing: 2, textShadow: `0 0 30px ${color}88`, boxShadow: `0 0 40px -6px ${color}aa, inset 0 0 30px -10px ${color}`, background: "rgba(4,17,11,0.55)" }}>{text}</div>
);

const Cutout: React.FC<{ p: WaiverSlidesProps; r: P; w: number; h: number; x: number; y: number; numSize?: number }> = ({ p, r, w, h, x, y, numSize }) => {
  const col = teamColor(r.nfl);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      {/* giant outlined numeral */}
      <div style={{ position: "absolute", right: -40, top: -60, fontFamily: DISPLAY, fontWeight: 800, fontSize: numSize ?? h * 1.05, lineHeight: 1, color: "transparent", WebkitTextStroke: `6px ${col}`, opacity: 0.85, letterSpacing: -10 }}>{r.num ?? ""}</div>
      <div style={{ position: "absolute", left: w * 0.12, top: h * 0.12, width: w * 0.76, height: w * 0.76, borderRadius: "50%", background: `radial-gradient(circle, ${col}cc 0%, ${col}44 55%, transparent 72%)`, filter: "blur(8px)" }} />
      <div style={{ position: "absolute", left: w * 0.1, top: h * 0.2, width: w * 0.8, height: h * 0.8, borderRadius: "50%", ...halftone(`${col}66`, 16), maskImage: "radial-gradient(circle, black 30%, transparent 70%)" }} />
      <Img src={head(p, r.id)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.75))" }} />
    </div>
  );
};

const touches = (x: z.infer<typeof wk>, pos: string) => (pos === "RB" ? `${x.att ?? 0} car · ${x.tgt ?? 0} tgt` : `${x.tgt ?? 0} tgt`);

const UsageStrip: React.FC<{ r: P; color: string }> = ({ r, color }) => {
  const maxPts = Math.max(...r.wk.map((x) => x.pts ?? 0), 1);
  return (
    <Glass style={{ position: "absolute", left: SAFE.left, top: 830, width: Wd, height: 360, padding: "22px 30px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, letterSpacing: 3 }}>
        <span>LAST 4 WEEKS</span><span>BAR = SNAP SHARE</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22, marginTop: 14, height: 270, alignItems: "end" }}>
        {r.wk.map((x, i) => {
          const share = x.snp != null && x.tsnp ? x.snp / x.tsnp : null;
          const hot = i === r.wk.length - 1;
          return (
            <div key={x.w} style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: hot ? 46 : 38, lineHeight: 1, color: x.pts == null ? C.dim : hot ? color : C.ink }}>{x.pts == null ? "—" : f1(x.pts)}</div>
              <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 18, color: C.dim, marginBottom: 6 }}>{x.pts == null ? "no game" : "pts"}</div>
              <div style={{ width: "78%", height: share == null ? 6 : Math.max(8, share * 175), borderRadius: 10, background: hot ? `linear-gradient(0deg, ${color}, ${C.gold})` : "rgba(255,255,255,0.28)",
                boxShadow: hot ? `0 0 30px -4px ${color}` : "none", position: "relative", overflow: "hidden" }}>
                {share != null && <div style={{ position: "absolute", inset: 0, ...halftone("rgba(0,0,0,0.18)", 10) }} />}
              </div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: hot ? C.ink : C.dim, marginTop: 6 }}>{share == null ? "—" : `${Math.round(share * 100)}%`}</div>
              <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 20, color: C.dim }}>WK {x.w}{x.pts != null ? ` · ${touches(x, r.pos)}` : ""}</div>
            </div>
          );
        })}
      </div>
      {maxPts < 0 ? null : null}
    </Glass>
  );
};

export const WaiverSlides: React.FC<WaiverSlidesProps> = (p) => {
  const i = useCurrentFrame();
  const n = waiverSlides(p);
  const d = p.data!;
  const by = new Map(d.players.map((x) => [x.id, x]));
  const top = d.players[0];
  let body: React.ReactNode;
  if (i === 0) {
    // HOOK: the #1 add's count as a giant number, the cutouts of the picks fanned out, the trap line.
    const fan = p.picks.map((k) => by.get(k.id)!).slice(0, 5);
    body = (
      <>
        <AbsoluteFill style={{ background: `radial-gradient(1000px 800px at 50% 40%, ${C.pylon}40, transparent 70%)` }} />
        <AbsoluteFill style={{ ...halftone("rgba(255,107,44,0.10)", 18), maskImage: "linear-gradient(180deg, transparent 10%, black 45%, transparent 80%)" }} />
        <div style={{ position: "absolute", top: SAFE.top + 10, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, letterSpacing: 5, color: C.gold }}>WAIVER HEAT · WEEK {d.next}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 168, lineHeight: 0.95, color: C.ink, marginTop: 10, textShadow: `0 0 60px ${C.pylon}88` }}>{fmt(top.adds)}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim }}>adds for {top.n} in {d.lookback} hours (Sleeper)</div>
        </div>
        <div style={{ position: "absolute", top: 600, left: 0, width: 1080, height: 500 }}>
          {fan.map((r, k) => {
            const xs = [20, 215, 370, 545, 720][k];
            const scale = [0.86, 0.94, 1.1, 0.94, 0.86][k];
            return (
              <div key={r.id} style={{ position: "absolute", left: xs, top: 160, width: 340, height: 300, scale: `${scale}`, transformOrigin: "50% 100%", zIndex: k === 2 ? 3 : k === 1 || k === 3 ? 2 : 1,
                filter: p.picks[k].verdict === "ADD" ? "none" : "saturate(0.6)" }}>
                <div style={{ position: "absolute", inset: "15% 10% 0 10%", borderRadius: "50% 50% 20px 20px", background: `radial-gradient(circle at 50% 80%, ${VC[p.picks[k].verdict]}55, transparent 70%)` }} />
                <Img src={head(p, r.id)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.8))" }} />
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, zIndex: 5, background: `linear-gradient(180deg, transparent, ${C.bg2} 85%)` }} />
        </div>
        <div style={{ position: "absolute", top: 1110, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 104, lineHeight: 0.95, color: C.ink }}>{p.hook[0]}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 124, lineHeight: 0.95, color: C.red, textShadow: `0 0 50px ${C.red}77`, marginTop: 6 }}>{p.hook[1]}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, marginTop: 34, padding: "14px 34px", borderRadius: 60, background: "rgba(255,255,255,0.10)", border: "2px solid rgba(255,255,255,0.25)", fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.ink }}>
            swipe to see which <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 48, color: C.gold }}>→</span>
          </div>
        </div>
      </>
    );
  } else if (i === 1) {
    // HEAT BOARD: the most-added players since Sunday, flame bars scaled to adds.
    const rows = d.players.slice(0, p.boardSize);
    const max = rows[0].adds;
    const pick = new Map(p.picks.map((k) => [k.id, k.verdict]));
    body = (
      <>
        <div style={{ position: "absolute", top: SAFE.top - 10, left: SAFE.left, right: SAFE.right }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim, letterSpacing: 2 }}><span>MOST ADDED · LAST {d.lookback} H</span><span>2/{n}</span></div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 100, lineHeight: 0.95, color: C.ink, marginTop: 6 }}>THE HEAT <span style={{ color: C.pylon }}>BOARD</span></div>
        </div>
        <div style={{ position: "absolute", top: 420, left: SAFE.left, width: Wd }}>
          {rows.map((r, k) => {
            const v = pick.get(r.id);
            return (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 16, alignItems: "center", height: 118, marginBottom: 12 }}>
                <div style={{ width: 84, height: 84, borderRadius: 20, overflow: "hidden", background: `radial-gradient(circle at 50% 110%, ${teamColor(r.nfl)}, #061209 75%)`, position: "relative" }}>
                  <Img src={head(p, r.id)} style={{ position: "absolute", left: -12, bottom: 0, width: 108, height: 84, objectFit: "cover", objectPosition: "50% 0%" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, lineHeight: 1, color: C.ink, whiteSpace: "nowrap" }}>{r.n.toUpperCase()} <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24, color: C.dim }}>{r.pos} · {r.nfl}</span></span>
                    {v ? <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: VC[v], border: `3px solid ${VC[v]}`, borderRadius: 10, padding: "0 10px", lineHeight: 1.15 }}>{v}</span> : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                    <div style={{ flex: 1, height: 26, borderRadius: 13, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ width: `${(100 * r.adds) / max}%`, height: "100%", borderRadius: 13, background: `linear-gradient(90deg, ${C.gold}, ${C.pylon} 60%, ${C.red})`, position: "relative" }}>
                        <div style={{ position: "absolute", inset: 0, ...halftone("rgba(255,255,255,0.22)", 9) }} />
                      </div>
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: k === 0 ? C.gold : C.ink, width: 150, textAlign: "right" }}>{fmt(r.adds)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  } else if (i < n - 1) {
    const k = p.picks[i - 2];
    const r = by.get(k.id)!;
    const col = VC[k.verdict];
    const rank = d.players.findIndex((x) => x.id === r.id) + 1;
    const lw = r.wk[r.wk.length - 1];
    body = (
      <>
        <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 30% 25%, ${teamColor(r.nfl)}38, transparent 70%)` }} />
        <div style={{ position: "absolute", top: SAFE.top - 10, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim, letterSpacing: 2 }}>
          <span>#{rank} MOST ADDED · <span style={{ color: C.pylon }}>{fmt(r.adds)}</span> ADDS</span><span>{i + 1}/{n}</span>
        </div>
        <Cutout p={p} r={r} w={500} h={400} x={SAFE.left - 20} y={300} />
        <div style={{ position: "absolute", left: 560, top: 310, width: 1080 - SAFE.right - 560 }}>
          <div style={{ display: "inline-block", fontFamily: BODY, fontWeight: 600, fontSize: 28, letterSpacing: 3, color: C.ink, background: "rgba(4,17,11,0.7)", borderRadius: 8, padding: "0 10px" }}>{r.n.split(" ")[0].toUpperCase()}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: last(r.n).length > 8 ? 78 : 96, lineHeight: 0.9, color: C.ink }}>{last(r.n).toUpperCase()}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, color: C.dim, marginTop: 6 }}>{r.pos} · {r.nfl} · #{r.num ?? "—"}</div>
          <div style={{ marginTop: 22, fontFamily: DISPLAY, fontWeight: 800, fontSize: 104, lineHeight: 0.9, color: col, textShadow: `0 0 40px ${col}66` }}>{k.stat.v}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24, lineHeight: 1.2, color: C.ink, opacity: 0.85, marginTop: 6 }}>{k.stat.label}</div>
        </div>
        <div style={{ position: "absolute", top: 720, left: SAFE.left, right: SAFE.right, fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, lineHeight: 1, color: C.ink }}>{k.title}</div>
        <UsageStrip r={r} color={col} />
        <div style={{ position: "absolute", top: 1215, left: SAFE.left, right: SAFE.right, fontFamily: BODY, fontWeight: 600, fontSize: 34, lineHeight: 1.25, color: C.ink }}>{k.why}</div>
        <div style={{ position: "absolute", top: 1318, left: SAFE.left, right: SAFE.right, display: "flex", alignItems: "center", gap: 28 }}>
          <Stamp text={k.verdict} color={col} size={96} />
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, lineHeight: 1.3 }}>Week {d.week}: {f1(lw.pts ?? 0)} pts<br />Sleeper wk {d.next} proj: {f1(r.proj)}{r.opp ? ` vs ${r.opp}` : ""}</div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div style={{ position: "absolute", top: SAFE.top - 20, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 88, lineHeight: 0.95, color: C.ink }}>WHO'S ON <span style={{ color: C.gold }}>YOUR</span> WIRE?</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim, marginTop: 14 }}>War Room ranks the free agents in your league for your roster. Free.</div>
        </div>
        <div style={{ position: "absolute", left: 540 - 190, top: 520, width: 380, height: 560, borderRadius: 56, background: "#050a07", padding: 14, boxShadow: `0 0 0 4px rgba(255,255,255,0.18), 0 60px 120px -30px rgba(0,0,0,0.9), 0 0 120px -40px ${C.turf}` }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", position: "relative" }}><Img src={staticFile(p.appShot)} style={{ width: "100%", position: "absolute", top: 0 }} /></div>
        </div>
        <div style={{ position: "absolute", top: 1110, left: 0, width: 1080, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 66, color: C.gold, marginBottom: 12 }}>WAR ROOM · FREE</div>
          <AppLink at={0} size={220} />
        </div>
      </>
    );
  }
  return (
    <AbsoluteFill style={{ background: C.bg2 }}>
      <Field />
      {body}
      {i > 0 && i < n - 1 && <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1468, fontFamily: BODY, fontWeight: 600, fontSize: 22, color: C.dim, textAlign: "center" }}>half-PPR · Sleeper stats & trending adds · War Room</div>}
    </AbsoluteFill>
  );
};
