import React from "react";
import { AbsoluteFill, Interactive, interpolate, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { Props, cleanName } from "./data";
import { Blunder, Cta, Extremes, Hook, Mvp, SceneProps, Scores, Standings } from "./scenes";

export const FPS = 30;
const T = 10; // transition overlap in frames
// Scene lengths in seconds. The bench-blunder scene is skipped in a week without one.
export const sceneList = (p: Props) => {
  const r = p.recap!;
  const s: { id: string; sec: number; C: React.FC<SceneProps> }[] = [{ id: "hook", sec: 2.8, C: Hook }];
  if (r.blunder && r.blunder.bench && (r.blunder.team.left || 0) >= 10) s.push({ id: "blunder", sec: 3.8, C: Blunder });
  if (r.mvp) s.push({ id: "mvp", sec: 3.2, C: Mvp });
  s.push({ id: "scores", sec: 4.4, C: Scores }, { id: "extremes", sec: 3.6, C: Extremes }, { id: "standings", sec: 3.6, C: Standings }, { id: "cta", sec: 3.4, C: Cta });
  return s;
};
export const totalFrames = (p: Props) => {
  const s = sceneList(p);
  return s.reduce((n, x) => n + Math.round(x.sec * FPS), 0) - T * (s.length - 1);
};

export const WeeklyTikTok: React.FC<Props> = (p) => {
  const { durationInFrames } = useVideoConfig();
  if (!p.recap) return <AbsoluteFill style={{ background: "#04110B" }} />;
  const sp: SceneProps = { r: p.recap, name: s => cleanName(s, p.nameOverrides), source: p.source, appUrl: p.appUrl };
  const scenes = sceneList(p);
  return (
    <AbsoluteFill style={{ background: "#04110B" }}>
      <TransitionSeries>
        {scenes.flatMap((x, i) => {
          const seq = (
            <TransitionSeries.Sequence key={x.id} name={x.id} durationInFrames={Math.round(x.sec * FPS)}>
              <x.C {...sp} />
            </TransitionSeries.Sequence>
          );
          if (i === 0) return [seq];
          const tr = (
            <TransitionSeries.Transition key={x.id + "-t"} timing={linearTiming({ durationInFrames: T })}
              presentation={i % 2 ? slide({ direction: "from-bottom" }) : fade()} />
          );
          return [tr, seq];
        })}
      </TransitionSeries>
      <Interactive.Div name="Music">
        <Audio src={staticFile("beat.wav")} volume={(f) => interpolate(f, [0, 10, durationInFrames - 20, durationInFrames], [0, 0.55, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </Interactive.Div>
    </AbsoluteFill>
  );
};
