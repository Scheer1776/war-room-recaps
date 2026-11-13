# War Room TikTok playbook

A new marketing video every day (10:47am PT). Each run reads this file, picks a format it didn't use last time,
builds and renders it, adds what it learned to **Learnings**, and logs it in **Log**.
The goal is new War Room users, so every video ends by showing the app and "Link in bio".


## Edit audit (MANDATORY before delivering any video) — 2026-10-30
`audit/audit.py <manifest.json>` checks the render and exits 1 on any FAIL. Fix, re-render, re-audit until it passes; never
deliver a video whose last audit failed. Write one manifest per video in `audit/manifests/` (format in audit.py's docstring).
- **Clip sync:** for every clip give `at`/`dur` (where it sits in the video), `clipStart` and `keyAt` (seconds into the clip
  where the big moment happens — find it from a timestamped contact sheet: `ffmpeg -ss A -t 1.5 -i clip -vf "fps=10,
  drawtext=text='%{pts\:flt}'...,tile=6x2"`). The audit matches frames to prove the clip really plays from clipStart and
  that the moment has >= 0.8 s of lead-in and >= 1.0 s after it. (It caught the Henry v1 bug: clip 2.98 s late.)
  In Remotion, a clip inside a scene MUST sit in `<Sequence from={sceneStart}>`, or it plays on the global clock.
- **Voice:** give `vo` (the voice track before mixing) and the exact `script`. Checks: every name heard (no hints given to
  the transcriber), a real pause after every sentence, a beat (>= 0.45 s) before every "...", 130–270 wpm, no dead air.
- **End card:** `endCard: 3.5` — the QR must decode across the last 3.5 s.
- **Audio:** `audio: "voice"` (every delivery is voiced since 2026-11-02); nothing may clip.
- Attach the `.audit.png` contact sheet view to your own QA; mention the audit result in one line of the delivery message.

## Polish layer (owner, 2026-11-08: "increase the quality of our videos and any animations")
Every voiced video gets these (src/polish.tsx; SundayRecap has them built in, add them to any new composition):
- **Captions:** TikTok-style word-by-word captions synced to the one voice take. `scripts/sunday-plan.py` writes
  `plan.words` (whisper timing, SCRIPT spelling: whisper writes "algiers"/"gassicki"). Needs `public/<dir>/script.txt`
  = the exact real-spelling script. Lines of 2-3 words at y=1372 (between the card/stamp and TikTok's bottom UI);
  the spoken word pops gold. Turn off with `captions: false` only for a deliberate no-text style.
- **Scene entries:** 7-frame whip (slide + motion blur, alternating direction) instead of hard cuts; a soft light
  leak (opacity 0.14, 12 frames) when a scene opens on a game clip. Scene lengths never change (voice-locked).
- **Clip look:** contrast 1.08 / saturation 1.18 grade + vignette on every game clip; light moving film grain over
  the whole frame. Light leaks above ~0.2 opacity wash the footage orange/purple: keep them subtle.
- **Smooth slow-mo:** `clips/cut.py ... --speed 0.6` now motion-interpolates new frames (no stutter). It's slow
  (~90 s in the cloud for a 3 s source; faster on the PC). `--no-smooth` = old frame repeats.
- **Sunday clip scrapes** now run at 5:15pm (afternoon games), 8:45pm and Monday 7am (Task Scheduler on the PC).

## Voices: pacing, flow and pronunciation — rewritten 2026-11-01 (owner: "choppy, weird pauses"; Allgeier said wrong)
- **De-ring every VoiceStudio take (owner, 2026-11-02: "high pitched ringing the whole way through").** VoxCPM2 leaves
  steady vocoder tones (a 6000 Hz whine at -34 dB, plus 12000/15600/15800 Hz). `python3 -I voice/dering.py <take> <out>`
  notches only those lines (voice level changes < 0.1 dB, timing unchanged); scripts/sunday-plan.py runs it automatically.
  The audit's RINGING check fails any steady tone louder than -65 dB.
- **Fast path (2026-11-02):** `python3 -I voice/say.py "<real-spelling script>"` prints the VoiceStudio text with sourced
  respellings swapped in and lists names with no sourced pronunciation (cut those from the voice, show them on screen).
  Sources: voice/names.json (hand-checked) + voice/pronounce-bank.json (every name token of the top ~300 players, each with
  a source URL; `_unsourced` lists the ones still missing). Then record 3 seeds with no clicking: put
  `{name, voice, model:"voxcpm2", seeds:[11,12,13], text}` in `Documents-WarRoom\takes\job.json`, double-click
  `vs-takes.bat` (VoiceStudio API at 127.0.0.1:3900, ~60 s a take), stage `takes\<name>_s<seed>.wav` back, keep the
  take where audit/pronounce.py shows 0 FAIL. Time it with `scripts/sunday-plan.py`, render with a `--props=<file>.json`
  that names the source folder (render.bat alone renders the default props — it rendered last week's data once).
- Two voices, both VoiceStudio (VoxCPM2) on the owner's PC: **War Room Announcer** (hype, sports-radio) and **War Room
  Narrator** (fast second-person storytelling). Narrator for story scripts ("You draft…"), Announcer for recaps/rankings.
- **Record the whole script as ONE continuous take.** The voice's own rhythm across sentences is what sounds natural.
  Never assemble per-line clips into scenes and never splice silence into a take (audit FAILs "VOICE SPLICES"); never
  speed it up. Write the pauses into the script instead: periods, commas, a question ("And Atlanta? Shut out.").
  Prep = trim the ends + 0.15 s lead-in + loudnorm only (`-af silenceremove…,adelay=150|150,loudnorm=I=-14:TP=-1.5:LRA=9`).
- **Time the video to the voice**, not the voice to the video: scene boundaries = sentence starts from whisper word
  timestamps (−0.12 s), each scene's `dur` set in plan.json, one `voFull` track (SundayRecap supports both). Then shift
  each clip (`clipFrom`) so its moment lands inside its scene with >= 0.8 s before and >= 1.0 s after.
- **Pronunciation is checked by sound, not spelling** (audit NAMES = `audit/pronounce.py`): every name in the script needs
  a sourced entry in `voice/names.json` → `pronounce` (ipa, alt, wrong, say, note); no entry = FAIL. Look the name up
  (Wikipedia IPA/respelling, team site, the player's own words) — never guess (I guessed "AL-guy-er"; it is "AL-jeer").
  Type the `say` respelling into VoiceStudio for any name the plain spelling gets wrong (Al-jeer, Add-en-eye, Bee-zhahn;
  "Bih-zhon" came out "Biz-jon", a "?" after a name can clip it). Takes are random: render 2–3 and keep the one where
  every name PASSes (VoxCPM is stochastic; the same script can come out right on the next try).
## Clips and photos in daily runs — 2026-10-30
- Player photos are allowed (owner's call): Sleeper headshots `https://sleepercdn.com/content/nfl/players/<id>.jpg` work from
  the cloud, no PC needed. Use them on covers, cards and rows.
- Clips: use them as much as possible. They live on the owner's PC (`Documents-WarRoom\clips\library`, listed in
  `clips\index.tsv`); a run with the PC link reads index.tsv with device_stage_files, stages the clips it needs and cuts
  them square-over-blur (`ffmpeg ... crop=ih:ih,scale=1080:1080 over a blurred 1080x1920`, 0.75x for the big moment).
  No PC link → no clips that day: photos instead, and say so in one line.
- If a player has no clip, add a wishlist line (`ytsearch3:<Player> Can't-Miss Play`) to clips\wishlist.txt via
  device_commit_files so the owner's next library run fetches it.
- Save every delivered file to `Documents-WarRoom\Completed Videos\` with a dated name when the PC is linked.

## Hard rules
- **No real fantasy-league names.** No team names or league names from the owner's ESPN league (several are
  offensive puns). The weekly recap uses `anonymize: true`. App screenshots come from the mock server
  (`MOCK=1`, sample league with clean names).
- Real NFL players and real stats are fine. **Owner's decision (2026-10-30): real player photos and clips are allowed**
  (Sleeper headshots `https://sleepercdn.com/content/nfl/players/<id>.jpg`, team logos; stitching the NFL's own TikTok posts).
  The owner accepts takedown risk and will deal with it if it comes. Fall back to jersey tiles only when a photo is missing.
  Rank Slides: `photos: true`; put headshots in `public/<dir>/h/<id>.jpg` (scripts fetch them).
- Every number must come from data pulled during the run (Sleeper API, the published recap, the app).
  Nothing is invented or "about right".
- Keep text inside `SAFE` (top 230, right 160, bottom 420, left 80) so TikTok's buttons and caption cover nothing.
- No imitating real people's voices. Voices allowed: ElevenLabs "Larry" (`fIGaHjfrR8KmMy0vGEVJ`, eleven_v3) and Kokoro "am_michael" (free).
- Never post anything. The owner posts by hand. Deliver the MP4s and a ready-to-paste caption.

## What makes these work
- **The hook is decided in the first second.** Open on a big number, a hot take or a question. No logo intro.
- One idea per video, 20–40 seconds, a new visual beat every 2–4 seconds.
- Motion in every scene: springs, a counter ticking up, an impact plus a shake, a kinetic word reveal.
  Nothing should sit still.
- Give a verdict. ADD / FADE / TRAP stamps, START / SIT, WIN / LOSE. Opinions get comments.
- **Every video is voiced (owner, 2026-11-02: "dont make videos without voice anymore").** No music-only, beat-only or silent
  versions, and no silent second render. One delivery: the voiced video.
- The caption is 1–2 punchy lines plus 4–6 hashtags (#fantasyfootball #fantasyfootballadvice #nfl
  #waiverwire #ff #fantasyfootballtips, rotating).

## Daily cadence
- Never repeat the previous day's format, and use no format more than twice in any 7 days.
- Vary the hook type day to day: a big number, a hot take, a question, a "you're doing this wrong" line, or a quiz.
- When a format clearly fits the calendar, use it: Mon–Tue blowups and recaps, Wed waivers, Thu–Sat start/sit and weather, Sun morning last-minute calls.
- Make every caption different. Rotate the free-app angle into about every other caption, without naming competitor apps or using their hashtags:
  "Trade analyzer, trade finder, start/sit, waivers. $0." / "Stop paying for fantasy advice." /
  "The free fantasy app your league doesn't know about." / "Other apps charge $65 a year for this."

## Voice budget (the owner's rule: stretch ElevenLabs across the month)
- **Alternate days.** Voiced and **music-only** take turns. If the last Log row was voiced, today is music-only, and vice versa.
- **Music-only videos** carry the story with big kinetic captions: one punchy line per beat (max ~7 words on screen),
  words popping in on the beat, plus the verdict. They must make sense with the sound off. In the caption message,
  suggest the kind of trending sound to add (for example "hype trap beat" or "suspense build into a drop").
  Never download or bundle copyrighted music.
- **Voiced days use ElevenLabs Larry** with `generations_count: 1` (the owner asked to save credits) as one take
  for the whole script (~660 credits). After each voiced run, add its exact `credits` from the generation result to the ledger.
- **Switch to Kokoro Michael** when the ledger shows less than 800 credits left this cycle, or when ElevenLabs
  reports not enough credits. Never retry a failed ElevenLabs call.
- **Kokoro pronunciation gate (required):**
  1. `voice/setup.sh` once per session.
  2. Write the scene lines to `lines.json` (`{"scene": "text"}`).
  3. Run `voice/.venv/bin/python -I voice/kokoro_tts.py lines.json public/<dir>/vo/raw`.
  4. Run `voice/.venv/bin/python -I voice/check_names.py lines.json public/<dir>/vo/raw`.
  5. If a name or word is MISSING, add its phonemes to `voice/names.json` and re-run steps 3–4 (at most 3 tries).
  6. If it still fails, make the day **music-only**. Never ship a mispronounced name.
  7. Then run `./prep-vo.sh public/<dir>/vo` (it accepts mp3; convert wav with ffmpeg first).
- **VoiceStudio "War Room Announcer" (owner's pick, 2026-10-29)** runs on the owner's PC (RTX 4060) in VoiceStudio with the
  **VoxCPM2** engine (Apache-2.0, commercial OK). It's a saved clone profile made from an original VoxCPM2 voice design
  (reference: `Documents-WarRoom/03_announcer.wav`). Only usable when the PC is on and linked; render one clip per scene,
  save to `C:\Users\ms980\OneDrive\Desktop\Documents-WarRoom`, stage, then the same `check_names.py` + `prep-vo.sh` gate.
  Speed: VoxCPM2 runs on the 4060 (CUDA) but fills ~7.4 of its 8 GB, so warm renders take ~7x the clip length
  (3.3s line = 22s) and the first one after loading takes ~70s. Keep only VoxCPM2 loaded (Settings > Compute device >
  Memory management) and nothing else on the GPU; with other engines loaded it was twice as slow.
  Never use VoiceStudio's default engine (OmniVoice) or anything with a red licence badge: CC-BY-NC, not for War Room.
- ElevenLabs Larry is also checked: run `check_names.py` on his clips too. If a name is wrong there, fix the
  spelling in the script for the next voiced day (don't regenerate the same day).

### Song pick (every music-only video and every carousel)
- Each run, look up what's trending **this week** (tokchart.com/tiktok-trending-sounds, buffer.com/resources/trending-songs-tiktok,
  metricool.com/tiktok-songs) and recommend ONE specific sound by exact name and artist, with one line on why it fits
  (energy, a "reveal" beat drop, a ranking or "fact" trend). Give a backup pick.
- Prefer sounds whose trend matches the post (ranking trends for lists, ominous or reveal sounds for a TRAP or FADE,
  hype for ADD). Tell the owner to tap the sound in TikTok's sound picker. Never download or bundle the music.
- Carousel slides need a "swipe" cue on the hook slide and must make sense in order without sound.

### ElevenLabs credit ledger (Free plan: 10,000 credits a month)
The owner checks the real balance at elevenlabs.io → Subscription. When the ledger total passes 10,000 or a new
cycle starts, start a new block. A run can't see the real balance, so if ElevenLabs refuses for credits, note it here.
| Date | Credits | Used this cycle | Note |
|---|---|---|---|
| 2026-10-28 | — | 4,068 | Owner's dashboard reading (2 takes/video before this rule) |

## TikTok stats (official Display API, read-only) — use them to pick what to make next
- `tiktok/stats.json` on the `media` branch (raw: `https://raw.githubusercontent.com/Scheer1776/war-room-recaps/media/tiktok/stats.json`),
  refreshed daily at 6:17am Pacific by `.github/workflows/tiktok-stats.yml` from `tiktok/stats/tiktok_stats.py`.
  Fields per video: views, likes, comments, shares, age_hours, views_per_hour, engagement_pct; plus top_by_views / top_by_engagement.
- Each run: fetch it first. If it's missing or older than 3 days, say so in the delivery message and carry on.
- Match videos to Log rows by posted date and title. Then:
  - Repeat what wins: the format of the top-2 by views_per_hour (videos < 72 h old) is the first choice for the next
    *video* day; the hook style of the top engagement_pct video is the first choice for the next hook.
  - Retire what loses: a format whose last two posts are both under half the median views is skipped for a week.
  - Voiced vs no-voice: compare median views of each over the last 14 days; if one is 1.5x the other, lean that way (budget permitting).
  - Note the read in the Log row ("stats: Quiz 2.1k views/h, carousel 0.4k → Quiz again") and add a Learning when something surprises.
- Setup (one time, owner): developers.tiktok.com → create app "War Room stats" (Web; redirect URI
  `https://war-room-self-one.vercel.app/tiktok-auth`), add Login Kit + Display API with scopes `user.info.basic,video.list`,
  submit for review. Then with the client key/secret: `python3 -I tiktok/stats/tiktok_stats.py auth-url` → open, Allow, copy
  `code` from the redirect URL → `python3 -I tiktok/stats/tiktok_stats.py exchange CODE` → store `TIKTOK_CLIENT_KEY`,
  `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN` as repo Actions secrets. Run the workflow once by hand to check.

## Format rotation (pick the one used least recently that fits the calendar)
| Format | Composition | Best days | Data |
|---|---|---|---|
| Waiver Heat: most-added players, ADD / FADE / TRAP stamps | `WaiverHeat` | Mon–Wed | `scripts/waivers.mjs` (Sleeper trending + projections) |
| Weekly league recap: blunders, MVP, scores, playoff odds | `WeeklyTikTok` | Tue | recap.json from the recap-data workflow, `anonymize: true` |
| Start/Sit showdown: coin-flip pairs (projections within 0.3), tiebreaker = last-3-weeks form, START / SIT stamps | `StartSit` | Thu–Sat | `scripts/startsit.mjs` (Sleeper projections + last 3 weeks of stats) |
| Bench-points shame: "you left X on your bench" + the app's max-lineup feature | *build* | Mon–Tue | recap.json bench data (anonymized) |
| **Rank Slides** (ranked-list carousel, like @fantasyteamup's "TRADE VALUE" / "WEEK N RANKINGS" / "STOCK UP" posts): cover with the #1 player's jersey tile and a two-word title, two slides of 10 ranked rows (jersey tile, name, pos·team, number + bar, trend arrow), a risers slide, the app slide | `RankSlides` (carousel; one frame = one slide; `metricKey` value/proj/avg; `sub` starting with a position, e.g. "WR · Week 9", picks that position's weekly ranking) | any day, 2–3 a week in rotation with the other carousels: trade value (Tue/Wed), position rankings (Thu/Fri), stock up/down (Mon) | `scripts/rankings.mjs public/<dir>` (Sleeper season stats + projections; value = 0.45·season avg + 0.3·last-3 + 0.25·this-week proj, 99 = best flex asset) |
| Waiver Heat carousel: hook, heat board, one slide per trending player (ADD / FADE / TRAP, 4-week snap-share usage strip), app slide | `WaiverSlides` (carousel; one frame = one slide; picks with verdict/title/why/stat in props) | Mon–Tue (adds peak after Sunday) | `scripts/waiverslides.mjs public/<dir> 24` (Sleeper trending adds last 24 h, weeks N-3..N half-PPR + snaps, week N+1 projections, headshots) |
| Weather game alert: weather board of every game, one slide per flagged game (proj → with weather), verdict | `WeatherSlides` (carousel; one frame = one slide) | Thu–Sat | `scripts/weather.mjs <war-room-web> public/<dir>` (the app's lib/weather.js + Sleeper projections) |
| O-line injury watch: a starter's line just lost a lineman | *build* | Wed–Fri | lib/oline.js |
| Feature demo: screen tour of one app tool on a phone mockup | *build* (see `Showcase` for the 3D phone) | any | mock server screenshots/recordings |
| **Showcase**: the tools you can't get elsewhere, one scene each, $65→$0 shatter hook, 3D phone per feature | `Showcase` (src/fx.tsx effects) | any, about once a month | mock screenshots (`public/app/*-vp.png`) + the week's weather numbers |
| **Game recap** (TNF / MNF): the call we made, final + win-prob dip, studs, surprise, busts, verdict | `GameRecap` | Fri (TNF), Tue (MNF) | ESPN scoreboard + summary (score, linescores, win probability) and Sleeper week stats → `public/<dir>/game.json`, `players.json` |
| **Quiz** "Pause & Guess": 3 multiple-choice questions on the last 3 weeks (4 jersey tiles each), a 3-2-1 countdown ring + PAUSE NOW, value race, X-outs, stamp on the answer, "comment your score" verdict | `Quiz` (music-first; `scripts/quiz.mjs public/<dir>` builds leaderboards: touches, pts, ppg, tgt) | any (Fri–Sat between start/sit days; comment bait) | Sleeper stats weeks N-3..N-1 + projections |
| **Sunday Recap** (clip-first, the night of): the day's real highlights full-bleed, one storyline per scene with a stat card (headshot, PPR counter, proj chip, stamp): biggest score, OT/stat tiles, boom-vs-projection waiver heroes, the team-wide bust with a giant number, every Sunday final, QR closer | `SundayRecap` (data-driven: `public/<dir>/plan.json`) | Sun night (after SNF) / Mon morning | `scripts/sunday.mjs public/<dir>` (ESPN scoreboard + Sleeper PPR stats vs projections: top, beat, bust + headshots); clips from that night's NFL uploads (`Documents-WarRoom\sun8-clips.bat` pattern) cut with `clips/cut.py` |
| **Photo carousel** (TikTok photo post): 5–8 still slides, a hook slide, one slide per player or point, the app slide last | `npx remotion still <Comp> --frame=N` on any composition at its "landed" frames, or a dedicated slides composition | music days, about 2 a week | same as the format |
| Music-only cut of any format above: kinetic captions on the beat, no voice | any composition with `voice: false` + captions | music days | same as the format |

When a run builds a new format, add it as its own composition in `src/`, reuse `theme.tsx`,
and switch its row from *build* to the composition name.

## Production steps
1. `cd tiktok && npm ci`. Data: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/waivers.mjs public/<dir>`
   (or the format's own data step).
2. Voice (voiced days only; see Voice budget): one line per scene. Generate it as **one** ElevenLabs take with `[pause] [long pause]` between lines
   (the account rate-limits parallel calls; never retry a generation that started). Download, split on silences
   (`ffmpeg -af silencedetect=noise=-40dB:d=1.2`) into `public/<dir>/vo/raw/<scene>.mp3`, then run `./prep-vo.sh public/<dir>/vo`.
3. Render with `--browser-executable=<headless shell> --concurrency=2`. The path changes with the image: it was
   `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`, on 2026-10-29 it was
   `/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`. Run `ls /opt/pw-browsers` first.
4. QA: pull 5–7 frames with ffmpeg into one strip and look at it. Check safe zones, that stamps and verdicts
   land, that no real league names appear and that no text overflows.
5. Send both MP4s plus the caption, commit the source (not `out/`), and update Log and Learnings.
6. **Save the finished files to the owner's PC** whenever the run has the PC link (`mcp__remote-devices__*` tools present):
   `device_commit_files` into `C:\Users\ms980\OneDrive\Desktop\Completed Videos` (create it if missing). Name every file with
   the date first: `2026-10-31 waiver-heat w9 beat.mp4`, `2026-10-31 waiver-heat w9 silent.mp4`, `2026-10-31 weather-carousel 01.png`.
   Never overwrite a file there (add ` v2`). If the folder can't be written, say so in one line; with no PC link, skip silently.
   Tell the owner the folder and file names in the delivery message. (Owner's request, 2026-10-30.)

## Learnings
- Kokoro mispronounces some names (for example "Caleb Douglas") unless they get phonemes in `voice/names.json`; with them it passes the Whisper check.
- Chatterbox (free) can't take phoneme hints, and spelling names by sound made it worse ("Kayla Duck Loose"). Don't use it.
- Verdict stamps that overlap the stat card read as "stamped onto it". That works; keep the note line above the caption zone.
- Splitting one long take keeps the voice consistent across scenes and costs about 660 credits per 35s video.
- Players on bye show up in trending adds (Sleeper projection 0, opponent null). Calling those a TRAP is good content.

- Music-only cuts land harder when scenes start on the beat: `StartSit` places every scene on a multiple of one beat
  (112 BPM = 16.07 frames) with plain Sequences instead of TransitionSeries, and a 1-frame white/turf flash on each cut.
  `public/beat40.wav` is the same original beat rendered 40s long (`beat.wav` is 30s with a fade-out, which dips when looped).
- Verdict stamps must not cover the player's name. On a 470px card, put the stamp low-left over the form bars (they were
  already on screen for 4 beats) and let the loser card go grayscale; the winner card glows.
- VoiceStudio voice design gives a different speaker on every render; lock a voice by cloning one good take into a profile.
  VoxCPM2 ignores ALL CAPS emphasis (flatter, not louder); write normal punctuation and use "..." for a beat before verdicts.
  Expressiveness check without listening: pitch SD in semitones (Larry ~5, the Announcer 3–4.6, flat TTS ~1.5).
- `StartSit` takes `voice: true`: clips `<source>/vo/{hook,d1,d2,d3,cta}.mp3`, hook gets 9 beats, and duel lines are
  delayed (≤1.5s) so the spoken verdict lands with the stamp.
- Sleeper's projection rows carry `date`; check it for Thursday games. A player who plays tonight ("decide now") is a free urgency hook.

- Node's fetch can't reach api.open-meteo.com here (connect timeout, no proxy); `scripts/weather.mjs` routes the app's
  fetches through curl with `--retry`, because open-meteo also answers 429 every other call. Without the retry,
  lib/weather.js silently falls back to ESPN's text forecast and no multipliers come out: check the output has `{"QB":...}` lines.
- A "nothing to fear" week is still content: lead with how small the worst hit is (−0.5 pts) and stamp IGNORE / PLAY YOUR GUYS.
  The forecast's rain % and inches disagree often (MIA 82% but <0.1 in); that gap is a good "twist" line.
- Rank Slides tables: 10 rows of 86 px from top 500 end at 1460, the footnote sits at 1530 (under TikTok's caption only on long captions). Never name a React prop `key` (React eats it; it cost a render).
- Carousel stills: put stamps in their own band under the data card (top ~1300); stamps overlapping the last data row hid a name.

- **Owner decisions (2026-10-30):** no more voice+beat mix; every video is voice-only (owner adds a TikTok sound). Every closer
  shows the QR code + URL (`AppLink` in theme.tsx) for ≥3.5 s and never says "link in bio" (there is none yet). Rendered
  files are voice-only unless told otherwise.
- `check_names.py` stops transcribing at a long pause (it heard only "The studs"); when a clip is flagged, re-transcribe the
  tail before re-recording. Whisper hears "Chuba Hubbard" cleanly; "Tetairoa" comes out as "Tetiuroa"/"Ted Tiroa" from
  both takes, so that name needs the owner's ear. A wrong word in a clip can be cut with ffmpeg `aselect` by word timestamps
  (done for "rookie") instead of a re-record.
- **Fact check names and tenure**, not just pronunciation: Matthew Golden was a 2025 first-rounder, not a rookie in 2026.
- **Footage:** the owner OK'd real photos/clips (see Hard rules). Two extra looks exist as examples:
  `Broll` layer in src/Examples.tsx (licensed stock MP4 under public/broll/, or the procedural stadium stand-in) and the
  animated schematic play (`PlayAnimExample`). The owner likes both; use the B-roll layer behind kinetic text and an animated
  play when a post turns on one moment. For a real highlight, the owner stitches the NFL's own TikTok post by hand.
- **Clip library (2026-10-30):** NFL-channel highlight clips (< 2 min, 720p) live on the owner's PC in
  `Documents-WarRoom\clips\library\`, listed in `clips\index.tsv` (date, duration, YouTube id, url, title). Built by
  `clips\build-clip-library.ps1` from `clips\wishlist.txt` (copies in tiktok/clips/). A run with the PC link: read
  index.tsv, stage the clip it needs, cut it with the square-over-blur treatment (see PlayerHype / henry-stiffarm-916.mp4).
  Without the PC link, no clips: fall back to photos. Never commit video files to the repo.
- **Narrator style the owner wants (2026-10-30, ref: @youbuilddifferent "How a pit in your backyard becomes an ocean"):**
  Voice: AI male narrator, mid-baritone (median ~124 Hz), very expressive (pitch SD ~6.9 semitones vs ~1.5 for flat TTS),
  FAST: ~250 words/min while speaking, almost no gaps between sentences, only ~6 real pauses in 72 s (before twists).
  Sits over a low music bed (~8 dB under the voice).
  **Cloned 2026-10-30 as VoiceStudio profile "War Room Narrator"** (VoxCPM2, from voice-ref-clean-13s.wav). Test take on a
  Henry script: 203 wpm overall vs the reference's 205, median pitch 148 vs 144 Hz, every word heard right. It doesn't pause
  on "..." on its own: add the beat-before-the-twist in the edit (insert ~0.4 s of silence). Clean isolated samples: `Documents-WarRoom\voice-ref-clean-13s.wav`
  (for cloning) and `voice-ref-clean-full.wav`.
  Script shape matters as much as the voice: second person ("You dig a giant hole..."), one cause → consequence chain
  told in short sentences, each step opened with "So," / "Then," / "But", escalation to a disaster, and a deadpan
  twist close ("You just built an ocean. Well, kinda."). For War Room: "You start Mahomes. So, you..." chains, ending
  on a deadpan line that lands on the app.
- **Showcase v2 (2026-10-30):** `PhoneScene` takes `clip` + `source`: the clip plays full-bleed under the headline, then tucks to
  a 400 px card bottom-right as the phone lands; the stamp moves up/left when a clip is present. `prep-vo.sh` now keeps internal
  pauses up to 0.8 s (it used to cut them to 0.28 s, which silently removed every beat pace.py added). The audit measures pauses
  from the waveform, not whisper word edges (whisper smears a word over inserted silence and reports a 0 s gap).
- **Effects stack (2026-10-30):** `src/fx.tsx` wraps `@remotion/effects` (glow, chromatic aberration, shatter, light leak) through
  `HtmlInCanvas`, `@remotion/three` for the 3D phone, `@remotion/noise` particles. Needs `--gl=swangle` (set in remotion.config.ts;
  "angle" has no GPU here). `HtmlInCanvas` can't be nested (Chrome 153 in this image), so a shattering block uses CSS text-shadow glow, not `Neon`.
- Three.js textures must be loaded *before* `<ThreeCanvas>` mounts (Remotion only repaints it when the frame changes); `Phone3D` does that.
- WebGL renders are slow on 2 CPUs (~30 min for 35 s). Render each video once and derive the other audio mix with ffmpeg
  (`-an` for silent; `amix` with beat40.wav at 0.16 for voice+bed). `lightLeak` seeds differ a lot in color: seed 2 is warm gold, 4/5/6/9 come out purple.
- A game recap writes itself from yesterday's call: when a START/SIT pick plays on TNF, the hook is "we told you" (or "we were wrong").
- **Quiz (2026-10-30):** a "pause now" quiz needs the countdown to sit over the tile grid, not beside it, and the four
  values must count up *before* the X-outs (lowest first, one per half-beat) so the reveal reads as a race, not a cut.
  Jersey numbers on 410px tiles collide with names: keep the number top-right, dim it at the reveal and put the value
  counter in its spot. Questions where the "famous" option loses (Mahomes 9.2 ppg, Kittle vs Likely) are the comment bait.
- Non-WebGL 40 s renders still take ~28 min on 2 CPUs; start the render in the background (`nohup … &`) right after
  the still QA and do the PLAYBOOK/caption work while it runs.
- 2026-11-01 Same-night clips: the NFL posts single plays, player "best plays" reels and game packages to YouTube within
  ~1–3 h of the final whistle. The reliable source is the channel's own tabs, not search (this yt-dlp has no `ytsearchdate:`):
  `yt-dlp https://www.youtube.com/@NFL/videos` (and `/shorts`) `--dateafter <today> --break-match-filters "upload_date >= <today>"
  --match-filter "duration <= 1200 & title ~= '(?i)(Burrow|Higgins|...)'"`. Shorts arrive vertical (no blur needed).
- 2026-11-01 Finding a play inside a 10–15 min game package: transcribe its commentary with faster-whisper (segments with
  timestamps) and search the player's name ("Mitchell… Touchdown" at 6:09), then a 5 fps contact sheet of that window.
- 2026-11-01 VoiceStudio Save-as can truncate the typed name (sun8_bust → sun.wav, sun8_scores → su.wav) when a folder with
  the same prefix exists (sun8\). List the folder after recording and map stragglers by save time; avoid name prefixes that
  match a folder.
- 2026-11-01 Props filled by calculateMetadata skip zod `.default()`s: guard optional fields with `??` in the component.
  The cloud browser path moves between containers; find it with `ls /opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/`.
  `--concurrency` may not exceed the core count (2).
- 2026-11-01 RENDER ON THE PC when it is linked: i7-14700F (28 threads) + RTX 4060 renders a 36 s clip video in ~27 s vs
  12–13 min on the 2-core cloud box (~25x). Setup is done (Node at C:\Program Files\nodejs, repo at C:\WarRoom\war-room-recaps,
  `npm ci` + Remotion's Chrome). Copy changed public/<dir> files into the PC repo with device_commit_files, then double-click
  a wrapper that calls `Documents-WarRoom\render.bat <Composition> <name>` (21 of 28 threads, --gl=angle; copies the MP4 to
  Completed Videos with the date; log in render.log). Remotion 4.0.539 wants a number for --concurrency, not "75%".
  Never write a .bat while it is running: the write is lost (OneDrive/cmd keep the old file).
- 2026-11-01 Pauses: VoxCPM runs short sentences together ("462 yards. Six touchdowns." with 0.00 s between). pace.py take
  now measures silence from the waveform with a peak-relative threshold (a 3 s line has no silence to calibrate a floor),
  but its cut point can still land on a consonant stop inside the next word ("six [pause] touchdowns"). Verify every
  inserted pause: split the line at the candidate point and transcribe both halves; the right point reads
  "...yards." | "six touchdowns...". Same trick when whisper fuses words ("six... twenty-seven" heard as "627").
- 2026-11-01 Audit: NAMES accepts sound-alikes (same first letter + consonant skeleton: Bijan~bijon, Allgeier~allgaier) and
  prints them; CLIP SYNC takes a per-clip `band` (fraction of the frame to compare) when cards or giant type cover the
  middle of a clip, which otherwise reads as a false 1 s offset. Keep every gap between voice lines under 1.6 s: trim the
  scene base, or re-cut the clip later so its moment lands earlier, rather than padding.
- 2026-11-01 Owner feedback on the first Sunday Recap: "very choppy, weird pauses" and "Allgeier pronounced wrong".
  Causes: per-line takes placed per scene + silence spliced into lines + 8% speed-up; and an audit that accepted
  whisper's spelling "Allgaier" as a sound-alike. Fixes: one continuous take, scenes timed to it; new pronunciation audit
  (wav2vec2 phoneme recognizer over the whole track + semi-global alignment to sourced IPA, known-wrong variants, missing
  entry = FAIL), VOICE SPLICES check (digital-zero runs inside speech), zoom-aware CLIP SYNC. Regression sample
  `audit/regression/choppy-v1-voice.flac` (+ `choppy-v1-script.txt`) must keep FAILING: `python3 -I audit/pronounce.py
  audit/regression/choppy-v1-voice.flac "$(cat audit/regression/choppy-v1-script.txt)"` → Allgeier FAIL. Run it after any audit change.

- 2026-11-02 On the Monday after Sunday's games, Sleeper's state still says week N (MNF pending): next week's projections are week N+1
  and look preliminary (Adonai Mitchell 3.3 vs KC after 23.7). Base verdicts on usage (snap share, targets, carries) and show the
  projection only as a chip, not as the reason. `pts_half_ppr` is missing (not 0) when a player played and scored nothing.
- 2026-11-02 Sleeper headshots are transparent 350x254 cutouts: best ~500 px wide over a team-color glow, with a giant outlined
  jersey numeral (`WebkitTextStroke`) behind; much bigger and they go soft. A fan of 5 cutouts needs `transformOrigin: "50% 100%"`
  so the shoulders line up, plus a 150 px fade at the bottom.
- 2026-11-02 This cloud session could not push (git proxy: repo not in the session's authorized set; no add_repo tool) and could not
  clone war-room-web (private), so the app slide reused `public/app/app-waivers.png` and the commit went to the PC as
  `queue\23-waiver-slides.patch` for the owner's apply/push scripts.

- 2026-11-08 Sunday recap v2 (owner: "weird noise in the audio", "voice breaks sound weird", "no new cool animations", "shorter than i thought"):
  - The Narrator clone copied its reference clip's music bed into every pause (pause floor only -20 dB under the voice, hum near 1 kHz). Fixed at the source: the VoiceStudio Narrator reference was cleaned (demucs vocals, noisereduce, 70 Hz highpass, loudnorm) and re-uploaded with Documents-WarRoom\vs-narrator-clean.bat. Original kept at takes\narrator-ref-original.bin. New takes: pause floor -40 dB.
  - sunday-plan.py also runs demucs (htdemucs, vocals stem) on every take before dering. audit.py has a PAUSE NOISE check (FAIL above -26 dB).
  - "About a minute" means ~190 words: the clean Narrator reads ~3.2 words a second including pauses. Write to length; never speed up the take.
  - Every clip scene freezes on its key moment (keyIn from sunday-plan.py) and slams an impact word (ImpactFX: speed lines, team-color shockwave, flash, shake). Scenes enter with a team-color wipe; the video opens with a glitch title; a progress bar runs on top. Pick an "impact" word per clip scene in story.json.
  - Stamps sit above the caption band (captions start at y=1372).
  - device_commit_files can deliver a cached old copy when the staged file name repeats. Stage every file under a new name (job-<name>-<timestamp>.json) and check its size on the PC.
  - Names that fail twice in takes get cut from the voice and stay on screen only (Boutte, Irving this week).

## Log
| Date | Format | Notes |
|---|---|---|
| 2026-10-27 | Weekly recap (week 7) | First video; anonymized after review |
| 2026-10-28 | Photo carousel (Waiver Heat stills) | 7 slides from WaiverHeat frames 140/345/503/632/778/871/1055; no voice |
| 2026-10-28 | Waiver Heat (week 8) | Douglas FADE, Coleman ADD, Singletary TRAP (bye), Strange ADD, Tucker ADD |
| 2026-10-29 | Start/Sit Showdown (week 8), NEW `StartSit` | No-voice (music-only). Cook START / Henry SIT, Daniels START / Young SIT (TNF), Cousins START / Mahomes SIT; hook "SIT MAHOMES?" + 3D coin flip |
| 2026-10-29 | Start/Sit Showdown (week 8), voiced redo | First VoiceStudio video: War Room Announcer (VoxCPM2) on all 5 lines, names passed; music bed at 0.16 |
| 2026-10-29 | Photo carousel, NEW Weather game alert (`WeatherSlides`, week 8) | No-voice, 7 slides. Hook "−0.5" (Mayfield, ATL@TB storm game); board 3 domes / 8 clear / 3 hits; TB START 'EM ANYWAY, MIA IGNORE THE RAIN ICON, JAX NON-FACTOR; 11/14 PLAY YOUR GUYS |
| 2026-10-30 | Showcase (features, NEW `Showcase`) | Voiced: War Room Announcer (VoiceStudio), voice-only (owner dropped the beat mix). QR + URL closer. $65→$0 shatter, 3D phones, 10,000-season swarm |
| 2026-10-30 | Game recap TNF CAR@GB (NEW `GameRecap`) | Voiced: War Room Announcer, voice-only. QR closer. Young 11.4 vs 18.0 "we told you", GB 27-19, Love/Hubbard/Jacobs, Golden 13 tgts BUY. "Rookie" cut from the Golden line (he's 2nd year) |
| 2026-10-30 | Showcase v2 (9 features; NEW Start/Sit + Waivers scenes; clip layer) | Voiced: War Room Narrator (first full video), voice-only. Clips: Cook 41-yd TD, Mahomes truck-stick TD, Nabers moss (clip-library). Audit PASS (pace WARN: fast mid-line flow, by design) |
| 2026-10-30 | Quiz "Pause & Guess" (NEW `Quiz`, weeks 5-7) | No-voice (music-only, beat + silent). Hook "3 QUESTIONS. LAST 3 WEEKS."; Q1 RB touches → Irving 69 WORKHORSE; Q2 QB ppg → Maye 30.6 (Mahomes 9.2); Q3 TE pts → Likely 50.0; verdict DRAFT-DAY NAMES LIE / USAGE DOESN'T; QR closer. Song: Final Game Showdown (ProdByLucK). TikTok stats.json not published yet (404) |
| 2026-11-01 | Sunday Recap week 8 (NEW `SundayRecap`) | Voiced: War Room Announcer, voice-only + silent. Same-night clips scraped from the NFL channel on the PC: Burrow→Chase deep TD, Burrow OT TD (Short), Higgins corner catch, Allgeier 63-yd TD, Mitchell 4th-down TD, Penix INT (ATL 0). Burrow 42.5, Higgins 37.5, Allgeier 36.1 (proj 8.4), Mitchell 27.2 (proj 5.6), ATL shut out (Bijan 7.6, London 1.8), 12 finals. QR closer. Rendered on the owner's PC in 27 s (cloud: 12 min 43 s). v1 rejected by owner (choppy + Allgeier wrong); v2: one continuous take (take 5 of 5, all 14 names PASS by phoneme audit), scenes timed to the voice, 31 s. Audit PASS |
| 2026-11-02 | Photo carousel, NEW Waiver Heat carousel (`WaiverSlides`, week 9) | No-voice, 8 slides. No clips (none in the library for these players; 5 wishlist lines added), Sleeper headshots. Hook "579,376 adds · EVERYONE'S ADDING THESE 5. 2 ARE TRAPS."; heat board top 8; Mitchell ADD (9 tgt, snaps 44→61%), Allgeier FADE (33.6 on 11 car, 5.7 avg before), Emmett Johnson TRAP (22.8 on 13 snaps), Gainwell ADD (car 4/2/14/25), Coleman ADD (proj 13.0 vs CAR). Audit by hand PASS (QR decodes, SAFE, no league names). stats.json still 404. Song: Dame Hombro (Bulin 47) |

## League Recap (in-app weekly video, every league) — added 2026-10-30
- Composition `LeagueRecap` (src/LeagueRecap.tsx): real league/team names (it is FOR the league), house effects (kinetic
  type, slams, stamps, particles, counters, headshots), no WebGL → ~40 s renders in ~3 min on 2 cores, ~1.5–2 min on a runner.
- Pipeline: app registers every loaded league at `/api/recaps` (Sleeper + public ESPN automatically; private ESPN after the
  owner taps "Make our weekly recap", codes encrypted with RECAP_KEY). `.github/workflows/league-recaps.yml` polls every
  5 min from 8:40 pm PT Monday (`gate.mjs`: ESPN scoreboard all final + not-yet-done marker), then fans out render jobs
  (3 leagues per job, up to 20 parallel free / 40 on Pro; `REGISTRY=1 CHUNK/OF` in render.mjs with `ENGINE=remotion`).
  Each league is published to the media branch (push retries on conflict) and POSTed to `/api/hdrecap`. Finish job writes
  `recaps/weekly/<season>-w<N>.done`. Published leagues are skipped on re-polls, so failures retry themselves.
- Narration: eight shared Announcer lines in public/recapvo/lines.json (record once; see its README). Never per-league TTS.
- Secrets the workflow needs: ADMIN_KEY (already), and RECAP_KEY on Vercel (any long random string) for private leagues.
- Known limit: GitHub cron can start 3–10 min late under load; the 5-minute polls make that the only delay.

## Cloud auto videos (no PC) — 2026-11-12
`auto/run.sh <thu|sun|mon|all> [week] [--force]` makes a whole recap in the cloud: ESPN + Sleeper data (auto/slate.mjs)
-> templated scenes + script, every number from the data (auto/story.mjs) -> Kokoro voice, one take, scene times and
caption words from Kokoro's own token timings (auto/voice.py) -> best-effort game b-roll (auto/broll.py; YouTube blocks
cloud downloads, so it usually skips) -> Remotion SundayRecap with `label` (e.g. "THURSDAY NIGHT"). Workflow
`.github/workflows/tiktok-auto.yml` runs it after every Thursday Night Football game (and by hand for any slate) and
attaches the MP4 to a GitHub release. Boom scenes with no clip show a 600 px player photo instead of empty space.
Rough v1: no AI script yet, no game clips in the cloud, Kokoro voice instead of the VoiceStudio voices.
- v2 (same night, owner: "a little more excitement in the voice but not much more" + "cooler animation"): voice = Kokoro blend
  am_michael 0.7 + am_fenrir 0.3 at speed 1.2 (pitch movement 9.0 -> 10.6 semitones, +17%; Fenrir alone is +46%, too much)
  and "!" on the payoff lines. Render = new `AutoRecap` composition (src/AutoRecap.tsx): logo smash with shockwave/sparks and
  count-up scores, 3D-tilting player cards with a light sweep over rotating team-color speed lines, a fantasy-points meter
  that fills past (or stops short of) the projection tick with a +/- badge, a cracking grayscale bust card with an RGB-glitch
  number, and a 3D phone (app/startsit-vp.png) + QR closer. ESPN team logos are saved to <dir>/l/<TEAM>.png.
