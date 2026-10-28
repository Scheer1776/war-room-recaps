#!/usr/bin/env bash
# Tighten voiceover lines for short-form pacing: trim leading/trailing silence, shorten
# long internal pauses, speed up 8%, normalize loudness. Writes <dir>/<name>.mp3 and
# <dir>/durations.json (seconds) from <dir>/raw/*.mp3.
set -euo pipefail
dir="$1"; cd "$dir"
echo "{" > durations.json; first=1
for f in raw/*.mp3; do
  n=$(basename "$f" .mp3)
  ffmpeg -v error -y -i "$f" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=stop_periods=-1:stop_duration=0.28:stop_threshold=-45dB,atempo=1.08,loudnorm=I=-14:TP=-1.5:LRA=7" -ar 44100 -b:a 192k "$n.mp3"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$n.mp3")
  [ $first -eq 1 ] || echo "," >> durations.json; first=0
  printf '  "%s": %.3f' "$n" "$d" >> durations.json
done
echo "" >> durations.json; echo "}" >> durations.json
cat durations.json
