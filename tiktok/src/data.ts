import { z } from "zod";

// The weekly recap data published by render.mjs (DATA_ONLY or the weekly HD job) to the
// media branch: recaps/<platform>-<leagueId>/week-<n>/recap.json plus img/.
const team = z.object({ id: z.number(), name: z.string(), pts: z.number(), left: z.number().optional() });
const player = z.object({ id: z.string(), n: z.string(), pos: z.string(), nfl: z.string(), act: z.number() });
const game = z.object({ win: team, lose: team, margin: z.number() });

export const recapSchema = z.object({
  platform: z.string(),
  league: z.string(),
  week: z.number(),
  myTeamId: z.number().nullable().optional(),
  games: z.array(game),
  high: team.extend({ star: player.nullable().optional() }),
  low: team,
  close: game,
  blow: game,
  mvp: z.object({ player, team }).nullable(),
  blunder: z.object({ team, bench: player.nullable() }).nullable(),
  standings: z.array(z.object({ id: z.number(), name: z.string(), w: z.number(), l: z.number(), t: z.number().optional(), pf: z.number(), odds: z.number() })),
  next: z.object({ week: z.number(), a: z.string(), b: z.string(), pa: z.number(), pb: z.number(), wa: z.number() }).nullable(),
});
export type Recap = z.infer<typeof recapSchema>;

export const propsSchema = z.object({
  // Folder under public/ (local) or a full URL to the published week folder.
  source: z.string(),
  // Public videos: replace every real team name and the league name with neutral ones.
  anonymize: z.boolean(),
  leagueLabel: z.string(),
  // Extra per-name swaps (used only when anonymize is off).
  nameOverrides: z.record(z.string(), z.string()),
  appUrl: z.string(),
  // Voiceover lines in <source>/vo/<scene>.mp3 with lengths in vo/durations.json.
  voice: z.boolean(),
  // "bed" = built-in beat under the voice; "none" = no music, for adding a TikTok sound in the app.
  music: z.enum(["bed", "none"]),
  recap: recapSchema.nullable(),
  voDur: z.record(z.string(), z.number()).nullable(),
});
export type Props = z.infer<typeof propsSchema>;

// Team names often carry emoji the video fonts can't draw; strip them, then apply overrides.
export const cleanName = (name: string, overrides: Record<string, string>) => {
  const raw = name.trim();
  if (overrides[raw]) return overrides[raw];
  const stripped = raw.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
  return overrides[stripped] || stripped || raw;
};

export const asset = (source: string, file: string, staticFile: (p: string) => string) =>
  /^https?:/.test(source) ? `${source.replace(/\/$/, "")}/${file}` : staticFile(`${source}/${file}`);

// Neutral stand-in names, handed out in standings order (first place gets the first name).
export const STAND_INS = ["Blitz Brigade", "Red Zone Rebels", "Gridiron Gang", "Hail Marys", "Goal Line Stand", "Pick Six",
  "Fourth and Long", "Two-Point Tries", "Hash Mark Heroes", "Waiver Wire Kings", "Field Goal Unit", "End Zone Elite",
  "Pocket Passers", "Sunday Funday", "Air Raid", "Victory Formation", "Play Action", "Prevent Defense", "Onside Kick", "Clock Killers"];
export const anonymizeRecap = (r: Recap, leagueLabel: string): Recap => {
  const ids = [...r.standings.map(s => s.id)];
  for (const g of r.games) for (const t of [g.win, g.lose]) if (!ids.includes(t.id)) ids.push(t.id);
  const nm = new Map(ids.map((id, i) => [id, STAND_INS[i % STAND_INS.length]]));
  const byName = new Map<string, string>();
  for (const s of r.standings) byName.set(s.name, nm.get(s.id)!);
  const t = <T extends { id: number; name: string }>(x: T): T => ({ ...x, name: nm.get(x.id) || "Team " + x.id });
  const g = (x: Recap["games"][number]) => ({ ...x, win: t(x.win), lose: t(x.lose) });
  return {
    ...r, league: leagueLabel, games: r.games.map(g), high: t(r.high), low: t(r.low), close: g(r.close), blow: g(r.blow),
    mvp: r.mvp && { ...r.mvp, team: t(r.mvp.team) }, blunder: r.blunder && { ...r.blunder, team: t(r.blunder.team) },
    standings: r.standings.map(t), next: r.next && { ...r.next, a: byName.get(r.next.a) || "Team A", b: byName.get(r.next.b) || "Team B" },
  };
};
