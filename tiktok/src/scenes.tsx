import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Recap, asset } from "./data";
import { BODY, C, DISPLAY, Face, Field, Glass, Kicker, SAFE, countUp, f1, initialsOf, useIn } from "./theme";

export type SceneProps = { r: Recap; name: (s: string) => string; source: string; appUrl: string; cue: number };
const head = (source: string, id: string) => asset(source, `img/h-${id}.png`, staticFile);
const big: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 800, lineHeight: 0.92, textTransform: "uppercase", color: C.ink };
const body: React.CSSProperties = { fontFamily: BODY, fontWeight: 600, color: C.dim };

// The hook: the week's most surprising number, readable in the first second.
export const hookFor = (r: Recap) => {
  const b = r.blunder;
  if (b && b.team.id === r.high.id && (b.team.left || 0) >= 10) return "topBench" as const;
  if (b && (b.team.left || 0) >= 15) return "bench" as const;
  return "close" as const;
};
export const Hook: React.FC<SceneProps> = ({ r, name, cue }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const kind = hookFor(r);
  const a = spring({ frame: f, fps, config: { damping: 14, mass: 0.6 } });
  const b = useIn(Math.round(cue * fps), 12);
  const line1 = kind === "close" ? `Lost by ${f1(r.close.margin)}.` : kind === "topBench" ? `${f1(r.high.pts)} points.` : `${f1(r.blunder!.team.left || 0)} points.`;
  const sub1 = kind === "close" ? `${name(r.close.lose.name)} vs ${name(r.close.win.name)}` : kind === "topBench" ? "Top score in our league" : "Left on the bench";
  const line2 = kind === "topBench" ? `And still left ${f1(r.blunder!.team.left || 0)} on the bench` : kind === "bench" ? `by ${name(r.blunder!.team.name)}` : `Week ${r.week} was brutal`;
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${SAFE.right}px ${SAFE.bottom - 200}px ${SAFE.left}px` }}>
        <div style={{ ...body, fontSize: 44, letterSpacing: 6, textTransform: "uppercase", opacity: a }}>{r.league} · Week {r.week}</div>
        <div style={{ ...big, fontSize: 220, marginTop: 20, scale: String(0.7 + 0.3 * a), transformOrigin: "left center", opacity: a }}>{line1}</div>
        <div style={{ ...big, fontSize: 64, color: C.gold, marginTop: 10, opacity: a }}>{sub1}</div>
        <div style={{ ...big, fontSize: 120, color: C.pylon, marginTop: 70, opacity: b, translate: `0 ${(1 - b) * 60}px` }}>{line2}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Blunder: React.FC<SceneProps> = ({ r, name, source }) => {
  const f = useCurrentFrame();
  const b = r.blunder!; const p = b.bench;
  const t0 = useIn(0, 12), t1 = useIn(8, 16), t2 = useIn(26, 14), t3 = useIn(44, 14);
  return (
    <AbsoluteFill>
      <Field />
      <Kicker league={r.league} week={r.week} label="Bench blunder" color={C.red} t={t0} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `260px ${SAFE.right - 40}px ${SAFE.bottom - 180}px ${SAFE.left + 40}px` }}>
        {p && <div style={{ scale: String(0.6 + 0.4 * t1), opacity: t1 }}><Face src={p.pos === "DST" ? null : head(source, p.id)} nfl={p.nfl} size={460} initials={initialsOf(p.n)} /></div>}
        {p && <div style={{ ...big, fontSize: 104, marginTop: 50, opacity: t2, textAlign: "center" }}>{p.n}</div>}
        {p && <div style={{ ...big, fontSize: 150, color: C.red, opacity: t2 }}>{f1(countUp(f, 26, 20, p.act))} <span style={{ fontSize: 64, color: C.ink }}>on the bench</span></div>}
        <Glass style={{ marginTop: 50, padding: "30px 50px", opacity: t3, translate: `0 ${(1 - t3) * 40}px`, textAlign: "center" }}>
          <div style={{ ...body, fontSize: 44, color: C.ink }}>{name(b.team.name)}</div>
          <div style={{ ...big, fontSize: 64, color: C.gold }}>Left {f1(b.team.left || 0)} pts unused</div>
        </Glass>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Mvp: React.FC<SceneProps> = ({ r, name, source }) => {
  const f = useCurrentFrame();
  const m = r.mvp!; const p = m.player;
  const t0 = useIn(0, 12), t1 = useIn(6, 16), t2 = useIn(22, 14);
  return (
    <AbsoluteFill>
      <Field />
      <Kicker league={r.league} week={r.week} label="Week MVP" color={C.gold} t={t0} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: `260px ${SAFE.right - 40}px ${SAFE.bottom - 180}px ${SAFE.left + 40}px` }}>
        <div style={{ scale: String(0.6 + 0.4 * t1), opacity: t1 }}><Face src={p.pos === "DST" ? null : head(source, p.id)} nfl={p.nfl} size={500} initials={initialsOf(p.n)} /></div>
        <div style={{ ...big, fontSize: 104, marginTop: 50, opacity: t2 }}>{p.n}</div>
        <div style={{ ...big, fontSize: 260, color: C.gold, opacity: t2 }}>{f1(countUp(f, 18, 24, p.act))}</div>
        <div style={{ ...body, fontSize: 44, opacity: t2 }}>{p.pos} · {p.nfl} · {name(m.team.name)}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Scores: React.FC<SceneProps> = ({ r, name }) => {
  const f = useCurrentFrame();
  const t0 = useIn(0, 12);
  const games = r.games.slice(0, 7), rowH = Math.min(168, 1080 / games.length);
  return (
    <AbsoluteFill>
      <Field />
      <Kicker league={r.league} week={r.week} label="Final scores" color={C.turf} t={t0} />
      <div style={{ position: "absolute", top: 470, left: SAFE.left - 20, right: SAFE.right - 20 }}>
        {games.map((g, i) => {
          const t = useIn(6 + i * 4, 12);
          const mine = (id: number) => id === r.myTeamId;
          return (
            <Glass key={i} style={{ height: rowH - 20, marginBottom: 20, padding: "0 40px", display: "flex", flexDirection: "column", justifyContent: "center", opacity: t, translate: `${(1 - t) * (i % 2 ? 140 : -140)}px 0`, borderRadius: 30 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ ...big, fontSize: 52, color: mine(g.win.id) ? C.gold : C.ink, maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name(g.win.name)}</span>
                <span style={{ ...big, fontSize: 60, color: C.turf }}>{f1(countUp(f, 10 + i * 4, 18, g.win.pts))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ ...big, fontWeight: 600, fontSize: 42, color: mine(g.lose.id) ? C.gold : C.dim, maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name(g.lose.name)}</span>
                <span style={{ ...big, fontWeight: 600, fontSize: 46, color: C.dim }}>{f1(countUp(f, 10 + i * 4, 18, g.lose.pts))}</span>
              </div>
            </Glass>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Extremes: React.FC<SceneProps> = ({ r, name }) => {
  const t0 = useIn(0, 12), t1 = useIn(8, 16), t2 = useIn(30, 16);
  const card = (label: string, color: string, value: string, a: string, b: string, t: number, dx: number) => (
    <Glass style={{ padding: "50px 60px", marginBottom: 50, opacity: t, translate: `${(1 - t) * dx}px 0` }}>
      <div style={{ ...big, fontSize: 60, color }}>{label}</div>
      <div style={{ ...big, fontSize: 200 }}>{value}</div>
      <div style={{ ...body, fontSize: 46, color: C.ink }}>{a}</div>
      <div style={{ ...body, fontSize: 40 }}>{b}</div>
    </Glass>
  );
  return (
    <AbsoluteFill>
      <Field />
      <Kicker league={r.league} week={r.week} label="Thrillers & beatdowns" color={C.slate} t={t0} />
      <div style={{ position: "absolute", top: 500, left: SAFE.left, right: SAFE.right }}>
        {card("Nail-biter", C.gold, `${f1(r.close.margin)} pts`, `${name(r.close.win.name)} ${f1(r.close.win.pts)}`, `over ${name(r.close.lose.name)} ${f1(r.close.lose.pts)}`, t1, -160)}
        {card("Beatdown", C.red, `${f1(r.blow.margin)} pts`, `${name(r.blow.win.name)} ${f1(r.blow.win.pts)}`, `over ${name(r.blow.lose.name)} ${f1(r.blow.lose.pts)}`, t2, 160)}
      </div>
    </AbsoluteFill>
  );
};

export const Standings: React.FC<SceneProps> = ({ r, name }) => {
  const f = useCurrentFrame();
  const t0 = useIn(0, 12);
  const rows = r.standings.slice(0, 6);
  return (
    <AbsoluteFill>
      <Field />
      <Kicker league={r.league} week={r.week} label="Playoff odds" color={C.turf} t={t0} />
      <div style={{ position: "absolute", top: 490, left: SAFE.left, right: SAFE.right }}>
        {rows.map((s, i) => {
          const t = useIn(6 + i * 4, 12);
          const odds = countUp(f, 10 + i * 4, 22, s.odds);
          const mine = s.id === r.myTeamId;
          return (
            <div key={s.id} style={{ marginBottom: 40, opacity: t, translate: `0 ${(1 - t) * 40}px` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ ...big, fontSize: 56, color: mine ? C.gold : C.ink, maxWidth: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {name(s.name)}</span>
                <span style={{ ...big, fontSize: 56, color: C.turf }}>{Math.round(odds)}%</span>
              </div>
              <div style={{ ...body, fontSize: 34, marginTop: 4 }}>{s.w}-{s.l}{s.t ? `-${s.t}` : ""} · {f1(s.pf)} pts</div>
              <div style={{ height: 14, borderRadius: 8, background: "rgba(255,255,255,0.10)", marginTop: 12, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${odds}%`, borderRadius: 8, background: `linear-gradient(90deg, #1FA866, ${C.turf})` }} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Cta: React.FC<SceneProps> = ({ appUrl }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const t0 = useIn(0, 14), t1 = useIn(12, 14), t2 = useIn(26, 14);
  const pulse = 1 + 0.03 * Math.sin((f / fps) * Math.PI * 2);
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: `0 ${SAFE.right - 40}px ${SAFE.bottom - 200}px ${SAFE.left + 40}px` }}>
        <div style={{ ...big, fontSize: 130, opacity: t0, translate: `0 ${(1 - t0) * 50}px` }}>Get this for<br />your league</div>
        <div style={{ ...body, fontSize: 50, color: C.ink, marginTop: 40, opacity: t1 }}>Free weekly recaps, start/sit calls,<br />trade finder and playoff odds</div>
        <div style={{ marginTop: 70, opacity: t2, scale: String(pulse) }}>
          <div style={{ ...big, fontSize: 148, color: C.turf }}>War Room</div>
          <div style={{ ...body, fontSize: 40, color: C.gold, marginTop: 10 }}>{appUrl}</div>
          <div style={{ ...body, fontSize: 36, marginTop: 24 }}>ESPN & Sleeper leagues</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: SAFE.bottom - 60, left: 0, right: 0, textAlign: "center", ...body, fontSize: 34, opacity: interpolate(f, [40, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>Link in bio</div>
    </AbsoluteFill>
  );
};
