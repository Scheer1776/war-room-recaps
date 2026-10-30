import React from "react";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Props, propsSchema, recapSchema, asset } from "./data";
import { FPS, WeeklyTikTok, totalFrames } from "./WeeklyTikTok";
import { fontsReady } from "./theme";
import { WaiverHeat, WaiverProps, waiverFrames, waiverSchema } from "./WaiverHeat";
import { StartSit, StartSitProps, startSitFrames, startSitSchema } from "./StartSit";
import { Showcase, ShowcaseProps, showcaseFrames, showcaseSchema } from "./Showcase";
import { GameRecap, RecapGameProps, recapGameFrames, recapGameSchema } from "./GameRecap";
import { BrollExample, PlayAnimExample } from "./Examples";
import { RankSlides, RankProps, rankSchema, rankSlides } from "./RankSlides";
import { PlayerHype, hypeFrames, hypeSchema } from "./PlayerHype";
import { Quiz, QuizProps, quizFrames, quizSchema } from "./Quiz";
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
const quizMeta: CalculateMetadataFunction<QuizProps> = async ({ props }) => {
  await fontsReady;
  const d = await (await fetch(staticFile(`${props.source}/quiz.json`))).json();
  const p = { ...props, players: d.players };
  return { props: p, durationInFrames: quizFrames(p) };
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

const rankMeta: CalculateMetadataFunction<RankProps> = async ({ props }) => {
  await fontsReady;
  const d = await fetch(staticFile(`${props.source}/rankings.json`)).then((r) => r.json());
  const key = props.metricKey;
  let pages = props.pages, risers = props.risers;
  if (!pages.length) {
    const rows = key === "value" ? d.tradeValue : d.weekRank[props.sub.split(" ")[0]] || d.tradeValue;
    pages = [{ heading: "1–10", rows: rows.slice(0, 10) }, { heading: "11–20", rows: rows.slice(10, 20) }];
    risers = { heading: "STOCK UP · last 3 weeks vs season", rows: d.risers.slice(0, 6) };
  }
  const p = { ...props, pages, risers, week: d.week };
  return { props: p, durationInFrames: rankSlides(p), fps: 1 };
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
  <Composition id="BrollExample" component={BrollExample} fps={30} width={1080} height={1920} durationInFrames={300} defaultProps={{ src: null }} />
  <Composition id="PlayAnimExample" component={PlayAnimExample} fps={30} width={1080} height={1920} durationInFrames={300}
    defaultProps={{ nfl: "GB", opp: "CAR", player: "Matthew Golden", num: 0, stat: "13 targets · 79 yds · TD", stamp: "BUY BEFORE YOUR LEAGUE NOTICES." }} />
  <Composition id="RankSlides" component={RankSlides} fps={1} width={1080} height={1920} durationInFrames={5} schema={rankSchema} calculateMetadata={rankMeta}
    defaultProps={{ source: "rank9", title: ["TRADE", "VALUE"], sub: "Week 8 · RB / WR / TE", metric: "VALUE", metricKey: "value", pages: [], risers: null, appShot: "app/finder-vp.png", week: 8, photos: true }} />
  <Composition id="PlayerHype" component={PlayerHype} fps={30} width={1080} height={1920} durationInFrames={hypeFrames} schema={hypeSchema}
    defaultProps={{ source: "hype", player: "Derrick Henry", nick: "King Henry", nfl: "BAL", opp: "BUF", num: 22, photo: "henry.jpg", clip: "henry-stiffarm-916.mp4", clipFrom: 0, hitAt: 64,
      line1: "HE PUTS *GROWN MEN* IN THE GROUND.", line2: "STIFF ARM *SEASON.*",
      stats: [{ v: 579, label: "rush yards, 7 games", dec: 0 }, { v: 7, label: "touchdowns", dec: 0 }, { v: 34.8, label: "week 1 vs IND", dec: 1 }],
      quiet: [4.5, 5.4], quietLabel: "TWO *QUIET* WEEKS.", hungry: "THE KING IS HUNGRY.",
      game: "Sunday", proj: 15.2, projYds: 77, stamp: "START HIM. OBVIOUSLY.", appShot: "app/startsit-vp.png" }} />
  <Composition id="Quiz" component={Quiz} fps={30} width={1080} height={1920} durationInFrames={1000} schema={quizSchema} calculateMetadata={quizMeta}
    defaultProps={{
      source: "quiz8",
      hook: ["3 QUESTIONS.", "LAST 3 WEEKS.", "PAUSE & GUESS", "COMMENT YOUR SCORE /3"],
      questions: [
        { q: ["RB · WEEKS 5-7", "MOST *TOUCHES* SINCE WEEK 5?"], metric: "touches", unit: "TOUCHES", dec: 0, ids: ["9509", "11584", "3198", "6813"], answer: "11584", stamp: "WORKHORSE", fact: "*69* TOUCHES IN 3 GAMES. *23* A WEEK." },
        { q: ["QB · WEEKS 5-7", "MOST FANTASY *POINTS* PER GAME?"], metric: "ppg", unit: "PTS / GAME", dec: 1, ids: ["4984", "6770", "11564", "4046"], answer: "11564", stamp: "QB1", fact: "MAYE *30.6* A GAME. MAHOMES *9.2*." },
        { q: ["TE · WEEKS 5-7", "WHO'S THE TOP *TIGHT END?*"], metric: "pts", unit: "PTS · HALF-PPR", dec: 1, ids: ["8130", "8131", "11604", "4217"], answer: "8131", stamp: "TE1", fact: "LIKELY *50.0* POINTS. BOWERS *38.3*." },
      ],
      verdict: ["DRAFT-DAY *NAMES* LIE.", "USAGE DOESN'T.", "HOW MANY DID YOU GET? *COMMENT* 0-3"],
      appShot: "app/home-vp.png", music: "bed", players: null,
    }} />
  </>
);
