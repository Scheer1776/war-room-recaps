import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { AppLink, BODY, C, DISPLAY, Field, Glass, SAFE, teamColor } from "./theme";

// "Rank Slides": the ranked-list photo carousel (cover + ranked tables + risers + app slide), one frame = one slide.
// Render: `npx remotion still RankSlides out/rank/0N.png --frame=N`. Data: public/<source>/rankings.json (scripts/rankings.mjs).
// Covers use a jersey-number tile in team colors, never player photos (no rights to those).
const row = z.object({ id: z.string(), n: z.string(), num: z.number().nullable(), pos: z.string(), nfl: z.string(), value: z.number(), avg: z.number(), l3: z.number(), proj: z.number(), opp: z.string(), trend: z.string(), inj: z.string().nullable(), tgt: z.number() });
type Row = z.infer<typeof row>;
export const rankSchema = z.object({
  source: z.string(),
  title: z.tuple([z.string(), z.string()]), // two words: white, gold
  sub: z.string(),
  metric: z.string(), // column header for the number: "VALUE", "PROJ", "AVG"
  metricKey: z.enum(["value", "proj", "avg"]),
  pages: z.array(z.object({ heading: z.string(), rows: z.array(row) })),
  risers: z.object({ heading: z.string(), rows: z.array(row) }).nullable(),
  appShot: z.string(),
  week: z.number(),
  photos: z.boolean(), // real headshots from public/<source>/h/<id>.jpg (owner's call, 2026-10-30)
});
export type RankProps = z.infer<typeof rankSchema>;
export const rankSlides = (p: RankProps) => 1 + p.pages.length + (p.risers ? 1 : 0) + 1;

const Wd = 1080 - SAFE.left - SAFE.right;
const Jersey: React.FC<{ r: Row; size: number; glow?: boolean; photo?: string | null }> = ({ r, size, glow, photo }) => {
  const col = teamColor(r.nfl);
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: `linear-gradient(160deg, ${col}, ${col}99)`, display: "grid", placeItems: "center", boxShadow: glow ? `0 0 ${size * 0.5}px ${col}88, inset 0 0 0 3px rgba(255,255,255,0.25)` : "inset 0 0 0 2px rgba(255,255,255,0.2)", flex: "none", position: "relative", overflow: "hidden" }}>
      {photo ? (
        <>
          <Img src={photo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 12%", transform: "scale(1.15)", transformOrigin: "50% 30%" }} />
          <span style={{ position: "absolute", right: size * 0.06, bottom: size * 0.03, fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.26, color: "#fff", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>{r.num ?? ""}</span>
        </>
      ) : (
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size * 0.56, color: "#fff", lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{r.num ?? r.pos}</span>
      )}
    </div>
  );
};
const photoOf = (p: RankProps, r: Row) => (p.photos ? staticFile(`${p.source}/h/${r.id}.jpg`) : null);
const Arrow: React.FC<{ t: string }> = ({ t }) => <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, color: t === "up" ? C.turf : t === "down" ? C.red : C.dim }}>{t === "up" ? "▲" : t === "down" ? "▼" : "—"}</span>;

const Header: React.FC<{ p: RankProps; heading: string; i: number; n: number }> = ({ p, heading, i, n }) => (
  <div style={{ position: "absolute", top: SAFE.top - 30, left: SAFE.left, right: SAFE.right }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.dim, letterSpacing: 2 }}>
      <span>{p.sub.toUpperCase()}</span><span>{i}/{n}</span>
    </div>
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, lineHeight: 0.95, color: C.ink, marginTop: 8 }}>{p.title[0]} <span style={{ color: C.gold }}>{p.title[1]}</span></div>
    <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 44, color: C.turf, marginTop: 6 }}>{heading}</div>
  </div>
);

const Table: React.FC<{ p: RankProps; rows: Row[]; start: number }> = ({ p, rows, start }) => {
  const max = Math.max(...p.pages.flatMap((pg) => pg.rows.map((r) => r[p.metricKey])));
  return (
    <div style={{ position: "absolute", top: 500, left: SAFE.left, width: Wd }}>
      <div style={{ display: "grid", gridTemplateColumns: "70px 96px 1fr 150px 60px", gap: 14, alignItems: "center", fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, letterSpacing: 2, padding: "0 16px 10px" }}>
        <span>#</span><span /><span>PLAYER</span><span style={{ textAlign: "right" }}>{p.metric}</span><span />
      </div>
      {rows.map((r, i) => (
        <Glass key={r.id} style={{ display: "grid", gridTemplateColumns: "70px 96px 1fr 150px 60px", gap: 14, alignItems: "center", padding: "10px 16px", marginBottom: 10, height: 86 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, color: start + i <= 3 ? C.gold : C.ink }}>{start + i}</span>
          <Jersey r={r} size={72} photo={photoOf(p, r)} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 42, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.n.toUpperCase()}</div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, marginTop: 4 }}>{r.pos} · {r.nfl}{p.metricKey === "proj" ? ` · ${r.opp}` : ` · avg ${r.avg}`}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: 1, color: C.ink }}>{r[p.metricKey]}</div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)", marginTop: 6, overflow: "hidden" }}><div style={{ width: `${(100 * r[p.metricKey]) / max}%`, height: "100%", background: `linear-gradient(90deg, ${C.turf}, ${C.gold})` }} /></div>
          </div>
          <div style={{ textAlign: "center" }}><Arrow t={r.trend} /></div>
        </Glass>
      ))}
    </div>
  );
};

export const RankSlides: React.FC<RankProps> = (p) => {
  const i = useCurrentFrame();
  const n = rankSlides(p);
  const top = p.pages[0].rows[0];
  const col = teamColor(top.nfl);
  let body: React.ReactNode;
  if (i === 0) {
    body = (
      <>
        <AbsoluteFill style={{ background: `radial-gradient(900px 900px at 50% 42%, ${col}55, transparent 70%)` }} />
        <div style={{ position: "absolute", top: 330, left: 0, width: 1080, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {p.photos ? (
            <div style={{ width: 760, height: 560, position: "relative" }}>
              <div style={{ position: "absolute", left: 130, top: 60, width: 500, height: 500, borderRadius: 250, background: `radial-gradient(circle, ${col} 0%, ${col}66 55%, transparent 72%)`, filter: "blur(10px)" }} />
              <Img src={photoOf(p, top)!} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.7))" }} />
            </div>
          ) : <Jersey r={top} size={520} glow />}
          <div style={{ marginTop: 26, fontFamily: DISPLAY, fontWeight: 800, fontSize: 60, color: C.ink }}>{top.n.toUpperCase()}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 32, color: C.dim }}>#1 · {top.pos} · {top.nfl} · {p.metric} {top[p.metricKey]}</div>
        </div>
        <div style={{ position: "absolute", top: 1080, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.dim, letterSpacing: 4 }}>{p.sub.toUpperCase()}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 210, lineHeight: 0.86, color: C.ink, marginTop: 12 }}>{p.title[0]}</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 210, lineHeight: 0.86, color: C.gold, textShadow: `0 0 60px ${C.gold}66` }}>{p.title[1]}</div>
          <div style={{ marginTop: 30, fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.ink, opacity: 0.85 }}>swipe for the full list →</div>
        </div>
      </>
    );
  } else if (i <= p.pages.length) {
    const pg = p.pages[i - 1];
    const start = 1 + p.pages.slice(0, i - 1).reduce((s, x) => s + x.rows.length, 0);
    body = <><Header p={p} heading={pg.heading} i={i + 1} n={n} /><Table p={p} rows={pg.rows} start={start} /></>;
  } else if (p.risers && i === p.pages.length + 1) {
    body = (
      <>
        <Header p={p} heading={p.risers.heading} i={i + 1} n={n} />
        <div style={{ position: "absolute", top: 520, left: SAFE.left, width: Wd }}>
          {p.risers.rows.map((r) => (
            <Glass key={r.id} style={{ display: "grid", gridTemplateColumns: "96px 1fr 260px", gap: 16, alignItems: "center", padding: "14px 18px", marginBottom: 14 }}>
              <Jersey r={r} size={76} photo={photoOf(p, r)} />
              <div><div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, lineHeight: 1, color: C.ink }}>{r.n.toUpperCase()}</div><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, marginTop: 4 }}>{r.pos} · {r.nfl} · season avg {r.avg}</div></div>
              <div style={{ textAlign: "right", fontFamily: DISPLAY, fontWeight: 800, fontSize: 44, color: C.turf }}>{r.avg} → {r.l3}<div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24, color: C.dim }}>LAST 3 WEEKS</div></div>
            </Glass>
          ))}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div style={{ position: "absolute", top: SAFE.top - 20, left: SAFE.left, right: SAFE.right, textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 92, lineHeight: 0.95, color: C.ink }}>THIS, FOR <span style={{ color: C.gold }}>YOUR</span> LEAGUE.</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.dim, marginTop: 14 }}>Trade finder · start/sit · waivers · live red zone · weekly recap video</div>
        </div>
        <div style={{ position: "absolute", left: 540 - 190, top: 520, width: 380, height: 560, borderRadius: 56, background: "#050a07", padding: 14, boxShadow: `0 0 0 4px rgba(255,255,255,0.18), 0 60px 120px -30px rgba(0,0,0,0.9), 0 0 120px -40px ${C.turf}` }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", position: "relative" }}><Img src={staticFile(p.appShot)} style={{ width: "100%", position: "absolute", top: 0 }} /></div>
        </div>
        <div style={{ position: "absolute", top: 1120, left: 0, width: 1080, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 70, color: C.gold, marginBottom: 14 }}>WAR ROOM · FREE</div>
          <AppLink at={0} size={230} />
        </div>
      </>
    );
  }
  return (
    <AbsoluteFill style={{ background: C.bg2 }}>
      <Field />
      {body}
      {i > 0 && i < n - 1 && <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1920 - SAFE.bottom + 30, fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim, textAlign: "center" }}>half-PPR · stats through week {p.week - 1} · War Room</div>}
    </AbsoluteFill>
  );
};
