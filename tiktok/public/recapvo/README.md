# League recap narration (shared by every league)

The weekly League Recap says the same eight lines for every league (numbers and names are on screen, not spoken), so
narration is recorded once and costs nothing per league. Record each key in `lines.json` as its own take in VoiceStudio
with the **War Room Announcer** voice (natural pauses at "..." ), save as `recap_<key>.wav` in Documents-WarRoom, then:

```
mkdir -p tiktok/public/recapvo/vo/raw && for f in .../recap_*.wav; do ffmpeg -i "$f" tiktok/public/recapvo/vo/raw/$(basename "${f#recap_}" .wav).mp3; done
cd tiktok && ./prep-vo.sh public/recapvo/vo && cp public/recapvo/vo/durations.json public/recapvo/ && cp public/recapvo/vo/*.mp3 public/recapvo/
```
`render.mjs` turns `voice: true` on when `public/recapvo/durations.json` exists, and each scene stretches to its line.
ElevenLabs (shared account) is the fallback if the Announcer takes aren't recorded: ~430 characters once, not per league.
No per-league speech anywhere, by design: that is what keeps 100 leagues free.
