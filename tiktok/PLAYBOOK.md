# War Room TikTok playbook

A new marketing video every day (10:47am PT). Each run reads this file, picks a format it didn't use last time,
builds and renders it, adds what it learned to **Learnings**, and logs it in **Log**.
The goal is new War Room users, so every video ends by showing the app and "Link in bio".

## Hard rules
- **No real fantasy-league names.** No team names or league names from the owner's ESPN league (several are
  offensive puns). The weekly recap uses `anonymize: true`. App screenshots come from the mock server
  (`MOCK=1`, sample league with clean names).
- Real NFL players and real stats are fine. Use jersey numbers and team colors, not ESPN or Sleeper headshots
  (we don't have rights to use those in ads).
- Every number must come from data pulled during the run (Sleeper API, the published recap, the app).
  Nothing is invented or "about right".
- Keep text inside `SAFE` (top 230, right 160, bottom 420, left 80) so TikTok's buttons and caption cover nothing.
- No imitating real people's voices. The voice is ElevenLabs "Larry" (`fIGaHjfrR8KmMy0vGEVJ`, eleven_v3).
- Never post anything. The owner posts by hand. Deliver the MP4s and a ready-to-paste caption.

## What makes these work
- **The hook is decided in the first second.** Open on a big number, a hot take or a question. No logo intro.
- One idea per video, 20–40 seconds, a new visual beat every 2–4 seconds.
- Motion in every scene: springs, a counter ticking up, an impact plus a shake, a kinetic word reveal.
  Nothing should sit still.
- Give a verdict. ADD / FADE / TRAP stamps, START / SIT, WIN / LOSE. Opinions get comments.
- Two renders every time: voice + beat, and voice only (the owner adds a trending sound in TikTok).
- The caption is 1–2 punchy lines plus 4–6 hashtags (#fantasyfootball #fantasyfootballadvice #nfl
  #waiverwire #ff #fantasyfootballtips, rotating).

## Daily cadence
- Never repeat the previous day's format, and use no format more than twice in any 7 days.
- Vary the hook type day to day: a big number, a hot take, a question, a "you're doing this wrong" line, or a quiz.
- When a format clearly fits the calendar, use it: Mon–Tue blowups and recaps, Wed waivers, Thu–Sat start/sit and weather, Sun morning last-minute calls.
- Make every caption different. Rotate the free-app angle into about every other caption, without naming competitor apps or using their hashtags:
  "Trade analyzer, trade finder, start/sit, waivers. $0." / "Stop paying for fantasy advice." /
  "The free fantasy app your league doesn't know about." / "Other apps charge $65 a year for this."

## Format rotation (pick the one used least recently that fits the calendar)
| Format | Composition | Best days | Data |
|---|---|---|---|
| Waiver Heat: most-added players, ADD / FADE / TRAP stamps | `WaiverHeat` | Mon–Wed | `scripts/waivers.mjs` (Sleeper trending + projections) |
| Weekly league recap: blunders, MVP, scores, playoff odds | `WeeklyTikTok` | Tue | recap.json from the recap-data workflow, `anonymize: true` |
| Start/Sit showdown: two players head to head, one winner | *build* | Thu–Sat | Sleeper projections + Vegas totals / weather |
| Bench-points shame: "you left X on your bench" + the app's max-lineup feature | *build* | Mon–Tue | recap.json bench data (anonymized) |
| Weather game alert: wind/rain games that change projections | *build* | Fri–Sat | the app's weather factors (lib/weather.js) |
| O-line injury watch: a starter's line just lost a lineman | *build* | Wed–Fri | lib/oline.js |
| Feature demo: screen tour of one app tool on a phone mockup | *build* | any | mock server screenshots/recordings |
| Quiz / "would you rather" poll: pause-to-answer, reveal | *build* | any | Sleeper stats |

When a run builds a new format, add it as its own composition in `src/`, reuse `theme.tsx`,
and switch its row from *build* to the composition name.

## Production steps
1. `cd tiktok && npm ci`. Data: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/waivers.mjs public/<dir>`
   (or the format's own data step).
2. Script: one line per scene. Generate it as **one** ElevenLabs take with `[pause] [long pause]` between lines
   (the account rate-limits parallel calls; never retry a generation that started). Download, split on silences
   (`ffmpeg -af silencedetect=noise=-40dB:d=1.2`) into `public/<dir>/vo/raw/<scene>.mp3`, then run `./prep-vo.sh public/<dir>/vo`.
3. Render with `--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell --concurrency=2`.
4. QA: pull 5–7 frames with ffmpeg into one strip and look at it. Check safe zones, that stamps and verdicts
   land, that no real league names appear and that no text overflows.
5. Send both MP4s plus the caption, commit the source (not `out/`), and update Log and Learnings.

## Learnings
- Verdict stamps that overlap the stat card read as "stamped onto it". That works; keep the note line above the caption zone.
- Splitting one long take keeps the voice consistent across scenes and costs about 660 credits per 35s video.
- Players on bye show up in trending adds (Sleeper projection 0, opponent null). Calling those a TRAP is good content.

## Log
| Date | Format | Notes |
|---|---|---|
| 2026-10-27 | Weekly recap (week 7) | First video; anonymized after review |
| 2026-10-28 | Waiver Heat (week 8) | Douglas FADE, Coleman ADD, Singletary TRAP (bye), Strange ADD, Tucker ADD |
