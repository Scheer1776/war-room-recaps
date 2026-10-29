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
- No imitating real people's voices. Voices allowed: ElevenLabs "Larry" (`fIGaHjfrR8KmMy0vGEVJ`, eleven_v3) and Kokoro "am_michael" (free).
- Never post anything. The owner posts by hand. Deliver the MP4s and a ready-to-paste caption.

## What makes these work
- **The hook is decided in the first second.** Open on a big number, a hot take or a question. No logo intro.
- One idea per video, 20–40 seconds, a new visual beat every 2–4 seconds.
- Motion in every scene: springs, a counter ticking up, an impact plus a shake, a kinetic word reveal.
  Nothing should sit still.
- Give a verdict. ADD / FADE / TRAP stamps, START / SIT, WIN / LOSE. Opinions get comments.
- Two renders every time. On voiced days: voice + beat, and voice only. On music days: beat, and silent (the owner adds a trending sound in TikTok).
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

## Format rotation (pick the one used least recently that fits the calendar)
| Format | Composition | Best days | Data |
|---|---|---|---|
| Waiver Heat: most-added players, ADD / FADE / TRAP stamps | `WaiverHeat` | Mon–Wed | `scripts/waivers.mjs` (Sleeper trending + projections) |
| Weekly league recap: blunders, MVP, scores, playoff odds | `WeeklyTikTok` | Tue | recap.json from the recap-data workflow, `anonymize: true` |
| Start/Sit showdown: coin-flip pairs (projections within 0.3), tiebreaker = last-3-weeks form, START / SIT stamps | `StartSit` | Thu–Sat | `scripts/startsit.mjs` (Sleeper projections + last 3 weeks of stats) |
| Bench-points shame: "you left X on your bench" + the app's max-lineup feature | *build* | Mon–Tue | recap.json bench data (anonymized) |
| Weather game alert: wind/rain games that change projections | *build* | Fri–Sat | the app's weather factors (lib/weather.js) |
| O-line injury watch: a starter's line just lost a lineman | *build* | Wed–Fri | lib/oline.js |
| Feature demo: screen tour of one app tool on a phone mockup | *build* | any | mock server screenshots/recordings |
| Quiz / "would you rather" poll: pause-to-answer, reveal | *build* | any | Sleeper stats |
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

## Log
| Date | Format | Notes |
|---|---|---|
| 2026-10-27 | Weekly recap (week 7) | First video; anonymized after review |
| 2026-10-28 | Photo carousel (Waiver Heat stills) | 7 slides from WaiverHeat frames 140/345/503/632/778/871/1055; no voice |
| 2026-10-28 | Waiver Heat (week 8) | Douglas FADE, Coleman ADD, Singletary TRAP (bye), Strange ADD, Tucker ADD |
| 2026-10-29 | Start/Sit Showdown (week 8), NEW `StartSit` | No-voice (music-only). Cook START / Henry SIT, Daniels START / Young SIT (TNF), Cousins START / Mahomes SIT; hook "SIT MAHOMES?" + 3D coin flip |
| 2026-10-29 | Start/Sit Showdown (week 8), voiced redo | First VoiceStudio video: War Room Announcer (VoxCPM2) on all 5 lines, names passed; music bed at 0.16 |
