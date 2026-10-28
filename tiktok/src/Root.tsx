import React from "react";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Props, propsSchema, recapSchema, asset } from "./data";
import { FPS, WeeklyTikTok, totalFrames } from "./WeeklyTikTok";
import { fontsReady } from "./theme";
import { WaiverHeat, WaiverProps, waiverFrames, waiverSchema } from "./WaiverHeat";

const waiverMeta: CalculateMetadataFunction<WaiverProps> = async ({ props }) => {
  await fontsReady;
  const w = await (await fetch(staticFile(`${props.source}/waivers.json`))).json();
  let voDur: Record<string, number> | null = null;
  if (props.voice) { try { const v = await fetch(staticFile(`${props.source}/vo/durations.json`)); if (v.ok) voDur = await v.json(); } catch { voDur = null; } }
  const p = { ...props, week: w.week, players: w.players, voDur };
  return { props: p, durationInFrames: waiverFrames(p) };
};

// Loads the week's recap.json (local public/ folder or the published media URL) and sizes the video to it.
const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  await fontsReady;
  const res = await fetch(asset(props.source, "recap.json", staticFile));
  const recap = recapSchema.parse(await res.json());
  let voDur: Record<string, number> | null = null;
  if (props.voice) { try { const v = await fetch(asset(props.source, "vo/durations.json", staticFile)); if (v.ok) voDur = await v.json(); } catch { voDur = null; } }
  const p = { ...props, recap, voDur };
  return { props: p, durationInFrames: totalFrames(p) };
};

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="WeeklyTikTok"
    component={WeeklyTikTok}
    schema={propsSchema}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={700}
    calculateMetadata={calculateMetadata}
    defaultProps={{
      source: "w7",
      anonymize: true,
      leagueLabel: "Our League",
      nameOverrides: {},
      appUrl: "war-room-self-one.vercel.app",
      voice: true,
      music: "bed",
      recap: null,
      voDur: null,
    }}
  />
  <Composition
    id="WaiverHeat"
    component={WaiverHeat}
    schema={waiverSchema}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={900}
    calculateMetadata={waiverMeta}
    defaultProps={{
      source: "wv8",
      week: 8,
      picks: [
        { id: "13296", vo: "douglas", verdict: "FADE", note: "20 last week, projected 5.4" },
        { id: "13345", vo: "coleman", verdict: "ADD", note: "Best projection on the list" },
        { id: "6130", vo: "singletary", verdict: "TRAP", note: "Giants are on bye" },
        { id: "9480", vo: "strange", verdict: "ADD", note: "Rare TE upside on waivers" },
        { id: "10213", vo: "tucker", verdict: "ADD", note: "Plug and play vs the Jets" },
      ],
      appShot: "app/app-waivers.png",
      voice: true,
      music: "bed",
      players: null,
      voDur: null,
    }}
  />
  </>
);
