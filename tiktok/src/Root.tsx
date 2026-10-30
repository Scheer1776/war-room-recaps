import React from "react";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Props, propsSchema, recapSchema, asset } from "./data";
import { FPS, WeeklyTikTok, totalFrames } from "./WeeklyTikTok";
import { fontsReady } from "./theme";
import { WaiverHeat, WaiverProps, waiverFrames, waiverSchema } from "./WaiverHeat";
import { StartSit, StartSitProps, startSitFrames, startSitSchema } from "./StartSit";
import { Showcase, ShowcaseProps, showcaseFrames, showcaseSchema } from "./Showcase";
import { GameRecap, RecapGameProps, recapGameFrames, recapGameSchema } from "./GameRecap";
import { WeatherSlides, WeatherProps, weatherSlides, weatherSchema } from "./WeatherSlides";

const showcaseMeta: CalculateMetadataFunction<ShowcaseProps> = async ({ props }) => {
  await fontsReady;
  let voDur: Record<string, number> | null = null;
  if (props.voice) { try { const v = await fetch(staticFile(`${props.source}/vo/durations.json`)); if (v.ok) voDur = await v.json(); } catch { voDur = null; } }
  const p = { ...props, voDur };
  return { props: p, durationInFrames: showcaseFrames(p) };
};
const recapGameMeta: CalculateMetadataFunction<RecapGameProps> = async ({ props }) => {
  await fontsReady;
  const game = await (await fetch(staticFile(`${props.source}/game.json`))).json();
  const players = await (await fetch(staticFile(`${props.source}/players.json`))).json();
  let voDur: Record<string, number> | null = null;
  if (props.voice) { try { const v = await fetch(staticFile(`${props.source}/vo/durations.json`)); if (v.ok) voDur = await v.json(); } catch { voDur = null; } }
  const p = { ...props, game, players, voDur };
  return { props: p, durationInFrames: recapGameFrames(p) };
};
const weatherMeta: CalculateMetadataFunction<WeatherProps> = async ({ props }) => {
  await fontsReady;
  const d = await (await fetch(staticFile(`${props.source}/weather.json`))).json();
  const p = { ...props, week: d.week, games: d.games };
  return { props: p, durationInFrames: weatherSlides(p) };
};

const startSitMeta: CalculateMetadataFunction<StartSitProps> = async ({ props }) => {
  await fontsReady;
  const d = await (await fetch(staticFile(`${props.source}/startsit.json`))).json();
  let voDur: Record<string, number> | null = null;
  if (props.voice) { try { const v = await fetch(staticFile(`${props.source}/vo/durations.json`)); if (v.ok) voDur = await v.json(); } catch { voDur = null; } }
  const p = { ...props, week: d.week, players: d.players, voDur };
  return { props: p, durationInFrames: startSitFrames(p) };
};

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
  <Composition
    id="StartSit"
    component={StartSit}
    schema={startSitSchema}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={1000}
    calculateMetadata={startSitMeta}
    defaultProps={{
      source: "ss8",
      week: 8,
      hook: ["SIT", "MAHOMES?", "3 COIN-FLIP START/SITS", "WEEK 8 · PROJECTIONS TIED"],
      duels: [
        { top: "8138", bottom: "3198", win: "8138", say: ["SAME GAME. TWO RBs.", "WHO EATS?"], verdict: "START COOK." },
        { top: "9228", bottom: "11566", win: "11566", say: ["YOUNG PLAYS TONIGHT.", "DECIDE NOW."], verdict: "START DANIELS." },
        { top: "4046", bottom: "1166", win: "1166", say: ["THE BIG ONE.", "BOTH PROJECT 16.8"], verdict: "SIT MAHOMES." },
      ],
      appShot: "app/app-matchup.png",
      music: "bed",
      voice: false,
      voDur: null,
      players: null,
    }}
  />
  <Composition
    id="WeatherSlides"
    component={WeatherSlides}
    schema={weatherSchema}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={7}
    calculateMetadata={weatherMeta}
    defaultProps={{
      source: "wx8",
      week: 8,
      hook: { player: "Baker Mayfield" },
      spots: [
        { home: "TB", title: "THE STORM GAME", twist: "The only game this week that trips War Room's bad-weather line (15 mph wind).", verdict: "START 'EM ANYWAY" },
        { home: "MIA", title: "THE RAIN ICON GAME", twist: "82% rain chance, but the forecast is under 0.1 inch of rain. Only the wind counts.", verdict: "IGNORE THE RAIN ICON" },
        { home: "JAX", title: "THE BREEZY ONE", twist: "Gusts to 18 mph. A small trim for the passing game, nothing more.", verdict: "NON-FACTOR" },
      ],
      appShot: "app/app-matchup.png",
      appScroll: 470,
      games: null,
    }}
  />
  <Composition
    id="Showcase"
    component={Showcase}
    schema={showcaseSchema}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={1000}
    calculateMetadata={showcaseMeta}
    defaultProps={{ source: "show1", voice: false, music: "bed", wx: { game: "ATL @ TB", wind: 15, pop: 63, passPct: 3.1 }, voDur: null }}
  />
  <Composition
    id="GameRecap"
    component={GameRecap}
    schema={recapGameSchema}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={1000}
    calculateMetadata={recapGameMeta}
    defaultProps={{
      source: "tnf8", voice: false, music: "bed",
      call: { id: "9228", said: "YESTERDAY WE SAID *SIT* BRYCE YOUNG." },
      studs: ["6804", "7594", "5850"], surprise: "12501", busts: ["9228", "12526", "13545"],
      verdict: { id: "12501", stamp: "BUY NOW", why: "13 TARGETS DOESN'T LIE. GET HIM BEFORE YOUR LEAGUE DOES." },
      appShot: "app/redzone-vp.png", game: null, players: null, voDur: null,
    }}
  />
  </>
);
