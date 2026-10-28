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
  // Display names for teams (public videos: swap names that shouldn't go on a brand account).
  nameOverrides: z.record(z.string(), z.string()),
  appUrl: z.string(),
  recap: recapSchema.nullable(),
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
