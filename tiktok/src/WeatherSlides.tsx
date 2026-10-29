import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { BODY, C, DISPLAY, Field, Glass, SAFE, f1, teamColor } from "./theme";

// "Weather game alert" as a TikTok photo carousel: one frame = one 1080x1920 slide.
// Render each slide with `npx remotion still WeatherSlides out/wx/0N.png --frame=N`.
// Data: public/<source>/weather.json from scripts/weather.mjs (War Room's lib/weather.js + Sleeper projections).
const player = z.object({ id: z.string(), n: z.string(), num: z.number().nullable(), pos: z.string(), nfl: z.string(), proj: z.number(), mult: z.number(), wx: z.number() });
const game = z.object({ home: z.string(), away: z.string(), kick: z.string(), kind: z.string(), text: z.string(), temp: z.number().optional(), wind: z.number().optional(),
  pop: z.number().optional(), precip: z.number().optional(), adj: z.record(z.string(), z.number()).optional(), players: z.array(player).optional() });
type G = z.infer<typeof game>;
export const weatherSchema = z.object({
  source: z.string(),
  week: z.number(),
  hook: z.object({ player: z.string() }),
  // One slide per flagged game: home team abbreviation, headline, the twist line and the verdict stamp.
  spots: z.array(z.object({ home: z.string(), title: z.string(), twist: z.string(), verdict: z.string() })),
  appShot: z.string(),
  appScroll: z.number(),
  games: z.array(game).nullable(),
});
export type WeatherProps = z.infer<typeof weatherSchema>;
export const weatherSlides = (p: WeatherProps) => 4 + p.spots.length;

const pct = (m: number) => `${m < 1 ? "−" : "+"}${(Math.abs(1 - m) * 100).toFixed(1)}%`;
const W = 1080 - SAFE.left - SAFE.right;

// Rain streaks + a slow radar sweep: the "storm" backdrop for flagged games.
const Storm: React.FC<{ heavy?: boolean }> = ({ heavy }) => (
  <>
    <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(105deg, rgba(140,196,255,0.0) 0 22px, rgba(140,196,255,0.10) 22px 24px, rgba(140,196,255,0) 24px 61px)", opacity: heavy ? 1 : 0.55 }} />
    <AbsoluteFill style={{ background: "radial-gradient(900px 700px at 80% 10%, rgba(140,196,255,0.22), transparent 65%)" }} />
  </>
);
const Radar: React.FC<{ x: number; y: number; r: number; o?: number }> = ({ x, y, r, o = 0.5 }) => (
  <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", opacity: o,
    background: `conic-gradient(from 20deg, rgba(61,219,134,0.55), rgba(61,219,134,0) 70deg, transparent 360deg), repeating-radial-gradient(circle, rgba(61,219,134,0.35) 0 2px, transparent 2px ${r / 4}px)`,
    boxShadow: "0 0 0 2px rgba(61,219,134,0.35)" }} />
);

// Weather glyphs drawn in SVG so they match the house colors.
const Icon: React.FC<{ kind: string; wet?: boolean; windy?: boolean; size: number }> = ({ kind, wet, windy, size }) => {
  if (kind === "dome") return (
    <svg width={size} height={size} viewBox="0 0 64 64"><path d="M8 46 A24 24 0 0 1 56 46 Z" fill="none" stroke={C.slate} strokeWidth="5" strokeLinejoin="round" /><path d="M4 50 H60" stroke={C.slate} strokeWidth="5" strokeLinecap="round" /></svg>
  );
  if (!wet && !windy) return (
    <svg width={size} height={size} viewBox="0 0 64 64"><circle cx="32" cy="32" r="12" fill={C.gold} />{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <path key={i} d={`M${32 + Math.cos(a) * 19} ${32 + Math.sin(a) * 19} L${32 + Math.cos(a) * 27} ${32 + Math.sin(a) * 27}`} stroke={C.gold} strokeWidth="5" strokeLinecap="round" />; })}</svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path d="M18 40 a11 11 0 0 1 2-21 a15 15 0 0 1 28 4 a9 9 0 0 1-1 17 Z" fill="rgba(243,247,244,0.92)" />
      {wet ? [20, 32, 44].map(x => <path key={x} d={`M${x} 46 l-4 10`} stroke={C.slate} strokeWidth="5" strokeLinecap="round" />) : null}
      {windy && !wet ? [46, 54].map((y, i) => <path key={y} d={`M${10 + i * 8} ${y} H${50 - i * 6}`} stroke={C.slate} strokeWidth="5" strokeLinecap="round" />) : null}
    </svg>
  );
};

const Kick: React.FC<{ text: string; color?: string }> = ({ text, color = C.dim }) => (
  <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, letterSpacing: 5, color, textTransform: "uppercase" }}>{text}</div>
);
const Stamp: React.FC<{ text: string; color: string; size?: number; rot?: number }> = ({ text, color, size = 120, rot = -6 }) => (
  <div style={{ display: "inline-block", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.02, color, border: `12px solid ${color}`, borderRadius: 26, padding: "0 34px",
    rotate: `${rot}deg`, background: "rgba(4,17,11,0.6)", boxShadow: `0 0 70px -10px ${color}, inset 0 0 30px -10px ${color}`, textShadow: `0 0 30px ${color}` }}>{text}</div>
);
const Pager: React.FC<{ i: number; n: number }> = ({ i, n }) => (
  <div style={{ position: "absolute", top: SAFE.top - 50, left: SAFE.left, right: SAFE.right, display: "flex", justifyContent: "center", gap: 10 }}>
    {Array.from({ length: n }, (_, k) => <div key={k} style={{ width: 46, height: 10, borderRadius: 5, background: k <= i ? C.gold : "rgba(255,255,255,0.2)" }} />)}
  </div>
);
const fit = (w: string, room: number, max: number) => Math.min(max, Math.floor(room / (w.length * 0.47)));

const Hook: React.FC<{ p: WeatherProps; g: G; x: z.infer<typeof player> }> = ({ p, g, x }) => (
  <AbsoluteFill>
    <Field /><Storm heavy />
    <Radar x={1000} y={330} r={330} o={0.35} />
    <div style={{ position: "absolute", top: SAFE.top + 10, left: SAFE.left, right: SAFE.right }}>
      <Kick text={`Week ${p.week} weather check`} color={C.slate} />
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 0.9, color: C.ink, marginTop: 14 }}>WEATHER<br />PANIC?</div>
    </div>
    <div style={{ position: "absolute", top: 660, left: SAFE.left, right: SAFE.right }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 330, lineHeight: 0.85, color: C.gold, letterSpacing: -6, textShadow: `0 0 80px ${C.gold}55` }}>−{f1(x.proj - x.wx)}</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 70, lineHeight: 1.02, color: C.ink, marginTop: 16 }}>
        POINTS. THAT'S ALL THE WORST<br />WEATHER OF WEEK {p.week} COSTS<br /><span style={{ color: teamColor(x.nfl) }}>{x.n.toUpperCase()}</span>
      </div>
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.dim, marginTop: 18 }}>{g.away} @ {g.home} · {g.text}</div>
    </div>
    <div style={{ position: "absolute", bottom: SAFE.bottom + 10, right: SAFE.right, display: "flex", alignItems: "center", gap: 16, fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, color: "#061209", background: C.turf, borderRadius: 999, padding: "6px 34px", boxShadow: `0 0 50px -6px ${C.turf}` }}>
      SWIPE <svg width="56" height="40" viewBox="0 0 56 40"><path d="M4 20 H46 M32 6 L48 20 L32 34" stroke="#061209" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  </AbsoluteFill>
);

const wetOf = (g: G) => (g.precip ?? 0) >= 0.1 && (g.pop ?? 0) >= 50;
const Board: React.FC<{ p: WeatherProps; games: G[]; i: number; n: number }> = ({ p, games, i, n }) => {
  const dome = games.filter(g => g.kind === "dome").length, hit = games.filter(g => g.adj).length;
  return (
    <AbsoluteFill>
      <Field />
      <Radar x={540} y={1000} r={620} o={0.18} />
      <Pager i={i} n={n} />
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right }}>
        <Kick text={`Week ${p.week} · ${games.length} games`} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 96, lineHeight: 0.95, color: C.ink, marginTop: 6 }}>THE WEATHER BOARD</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, color: C.ink, marginTop: 10 }}>
          <span style={{ color: C.slate }}>{dome} domes</span> · <span style={{ color: C.gold }}>{games.length - dome - hit} clear</span> · <span style={{ color: C.pylon }}>{hit} with a weather hit</span>
        </div>
      </div>
      <div style={{ position: "absolute", top: SAFE.top + 220, left: SAFE.left, width: W, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {games.map((g, k) => {
          const hot = !!g.adj;
          return (
            <Glass key={k} tint={hot ? "rgba(255,107,44,0.20)" : undefined} style={{ height: 136, borderRadius: 26, padding: "0 18px", display: "flex", alignItems: "center", gap: 14, border: hot ? `3px solid ${C.pylon}` : undefined }}>
              <Icon kind={g.kind} wet={(g.pop ?? 0) >= 50} windy={(g.wind ?? 0) >= 12} size={70} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, lineHeight: 1, color: C.ink }}>{g.away} @ {g.home}</div>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 25, color: hot ? C.ink : C.dim, marginTop: 4, whiteSpace: "nowrap" }}>
                  {g.kind === "dome" ? "Indoors" : `${g.temp}°F · ${g.wind} mph${(g.pop ?? 0) >= 30 ? ` · ${g.pop}% rain` : ""}`}
                </div>
              </div>
            </Glass>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Spot: React.FC<{ g: G; s: WeatherProps["spots"][number]; i: number; n: number }> = ({ g, s, i, n }) => {
  const ps = g.players || [];
  const pass = g.adj?.WR ?? 1;
  const vc = s.verdict.includes("IGNORE") ? C.slate : C.turf;
  return (
    <AbsoluteFill>
      <Field /><Storm heavy={wetOf(g) || (g.pop ?? 0) >= 60} />
      <Radar x={980} y={420} r={260} o={0.3} />
      <Pager i={i} n={n} />
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Icon kind={g.kind} wet={(g.pop ?? 0) >= 50} windy={(g.wind ?? 0) >= 12} size={96} />
          <div>
            <Kick text={`${g.away} @ ${g.home}`} color={C.slate} />
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(s.title, W - 120, 92), lineHeight: 0.95, color: C.ink }}>{s.title}</div>
          </div>
        </div>
        {/* Three forecast tiles */}
        <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
          {[["WIND", `${g.wind}`, "mph"], ["RAIN", `${g.pop}%`, "chance"], ["TEMP", `${g.temp}°`, "F"]].map(([k, v, u]) => (
            <Glass key={k} style={{ flex: 1, borderRadius: 26, padding: "12px 20px" }}>
              <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, letterSpacing: 3, color: C.dim }}>{k}</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 92, lineHeight: 0.95, color: k === "WIND" && (g.wind ?? 0) >= 14 ? C.pylon : C.ink }}>{v}<span style={{ fontSize: 34, color: C.dim, marginLeft: 6 }}>{u}</span></div>
            </Glass>
          ))}
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 36, lineHeight: 1.25, color: C.ink, marginTop: 22 }}>{s.twist}</div>
      </div>
      {/* Projection before → after, using War Room's weather multipliers */}
      <Glass style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 730, padding: "20px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 600, fontSize: 26, letterSpacing: 3, color: C.dim }}>
          <span>PASS GAME {pct(pass)}</span><span>PROJ → WITH WEATHER</span>
        </div>
        {ps.map(x => (
          <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
            <div style={{ width: 92, height: 92, borderRadius: 22, background: teamColor(x.nfl), display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 60, color: "#061209", flex: "none" }}>{x.num ?? x.pos}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, lineHeight: 1, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.n.toUpperCase()}</div>
              <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim }}>{x.pos} · {x.nfl}</div>
            </div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 52, color: C.dim, textDecoration: "line-through", textDecorationColor: C.red, textDecorationThickness: 5 }}>{f1(x.proj)}</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, color: C.gold, width: 120, textAlign: "right" }}>{f1(x.wx)}</div>
          </div>
        ))}
      </Glass>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1300, display: "flex", justifyContent: "center" }}>
        <Stamp text={s.verdict} color={vc} size={fit(s.verdict, W - 120, 104)} />
      </div>
    </AbsoluteFill>
  );
};

const Verdict: React.FC<{ p: WeatherProps; games: G[]; i: number; n: number }> = ({ p, games, i, n }) => {
  const clean = games.filter(g => !g.adj).length;
  const worst = Math.min(...games.flatMap(g => Object.values(g.adj || {})));
  const wg = games.find(g => Object.values(g.adj || {}).includes(worst))!;
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 800px at 50% 100%, ${C.turf}, transparent 70%)`, opacity: 0.22 }} />
      <Pager i={i} n={n} />
      <div style={{ position: "absolute", top: SAFE.top + 20, left: SAFE.left, right: SAFE.right }}>
        <Kick text={`Week ${p.week} verdict`} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 300, lineHeight: 0.85, color: C.turf, marginTop: 10 }}>{clean}<span style={{ fontSize: 120, color: C.dim }}> / {games.length}</span></div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 0.98, color: C.ink, marginTop: 10 }}>GAMES WITH ZERO<br />WEATHER EFFECT</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 38, lineHeight: 1.3, color: C.ink, marginTop: 36 }}>
          Biggest hit all week: <span style={{ color: C.gold }}>{pct(worst)}</span> for pass catchers in {wg.away} @ {wg.home}.<br />
          <span style={{ color: C.dim }}>Don't bench a stud for a rain icon.</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1080, display: "flex", justifyContent: "center" }}>
        <Stamp text="PLAY YOUR GUYS" color={C.turf} size={104} rot={-5} />
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, bottom: SAFE.bottom + 4, textAlign: "center", fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.dim }}>
        Forecasts as of Thursday · they count at half weight until 3 days out
      </div>
    </AbsoluteFill>
  );
};

const App: React.FC<{ p: WeatherProps; i: number; n: number }> = ({ p, i, n }) => {
  const cx = SAFE.left + W / 2;
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at 50% 100%, ${C.turf}, transparent 70%)`, opacity: 0.25 }} />
      <Pager i={i} n={n} />
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 88, lineHeight: 0.95, color: C.ink }}>
        WEATHER IS BAKED<br />INTO <span style={{ color: C.gold }}>EVERY PROJECTION</span>
      </div>
      <div style={{ position: "absolute", left: cx - 230, top: 470, width: 460, height: 860, borderRadius: 64, background: "#050a07", padding: 16, rotate: "-3deg",
        boxShadow: `0 0 0 4px rgba(255,255,255,0.18), 0 60px 120px -30px rgba(0,0,0,0.9), 0 0 120px -40px ${C.turf}` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", position: "relative" }}>
          <Img src={staticFile(p.appShot)} style={{ width: "100%", position: "absolute", top: -p.appScroll }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.left, right: SAFE.right, top: 1360, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 80, lineHeight: 1, color: C.gold }}>WAR ROOM · FREE</div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 40, color: C.ink, marginTop: 8 }}>Your league, your matchup · Link in bio</div>
      </div>
    </AbsoluteFill>
  );
};

export const WeatherSlides: React.FC<WeatherProps> = (p) => {
  const f = useCurrentFrame();
  if (!p.games) return <AbsoluteFill style={{ background: "#04110B" }} />;
  const games = p.games;
  const n = weatherSlides(p);
  const flagged = games.filter(g => g.players && g.players.length);
  const all = flagged.flatMap(g => g.players!.map(x => ({ g, x })));
  const top = all.sort((a, b) => (b.x.proj - b.x.wx) - (a.x.proj - a.x.wx)).find(o => o.x.n === p.hook.player) || all[0];
  let body: React.ReactNode;
  if (f === 0) body = <Hook p={p} g={top.g} x={top.x} />;
  else if (f === 1) body = <Board p={p} games={games} i={f} n={n} />;
  else if (f < 2 + p.spots.length) { const s = p.spots[f - 2]; body = <Spot g={games.find(g => g.home === s.home)!} s={s} i={f} n={n} />; }
  else if (f === n - 2) body = <Verdict p={p} games={games} i={f} n={n} />;
  else body = <App p={p} i={f} n={n} />;
  return <AbsoluteFill style={{ background: "#04110B" }}>{body}</AbsoluteFill>;
};
