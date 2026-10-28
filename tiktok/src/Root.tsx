import React from "react";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Props, propsSchema, recapSchema, asset } from "./data";
import { FPS, WeeklyTikTok, totalFrames } from "./WeeklyTikTok";
import { fontsReady } from "./theme";

// Loads the week's recap.json (local public/ folder or the published media URL) and sizes the video to it.
const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  await fontsReady;
  const res = await fetch(asset(props.source, "recap.json", staticFile));
  const recap = recapSchema.parse(await res.json());
  const p = { ...props, recap };
  return { props: p, durationInFrames: totalFrames(p) };
};

export const RemotionRoot: React.FC = () => (
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
      // Names that shouldn't appear on a public brand account.
      nameOverrides: { "Veiny dih": "Team V", "Rigger JEW'Marr": "Team R", "Jacking Goff": "Team J" },
      appUrl: "war-room-self-one.vercel.app",
      recap: null,
    }}
  />
);
