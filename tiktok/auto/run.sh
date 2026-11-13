#!/usr/bin/env bash
# auto/run.sh — make a TikTok recap video from scratch, fully in the cloud, for free.
#   bash auto/run.sh <slate thu|sun|mon|all> [week] [--force]
# data (ESPN + Sleeper) -> story + script -> Kokoro voice (one take, timed scenes, captions) -> optional game b-roll
# -> Remotion render (SundayRecap, 1080x1920) -> out/auto-<slate>-w<week>.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
SLATE="${1:-thu}"; WEEK="${2:-}"; FORCE=""
for a in "$@"; do [ "$a" = "--force" ] && FORCE="--force"; done
DIR="public/auto/${SLATE}"
rm -rf "$DIR"; mkdir -p "$DIR" out

echo "== 1/5 data"
node auto/slate.mjs "$DIR" --slate "$SLATE" ${WEEK:+--week "$WEEK"}
WEEK=$(node -e "console.log(require('./$DIR/slate.json').week)")
echo "== 2/5 story"
node auto/story.mjs "$DIR" $FORCE
echo "== 3/5 game clips (ESPN play clips collected during the game, + the live feed)"
SEASON=$(node -e "console.log(require('./$DIR/slate.json').season)")
CF="$DIR/clips-store.json"
curl -sf "https://raw.githubusercontent.com/Scheer1776/war-room-recaps/media/clips/nfl-${SEASON}-w${WEEK}.json" -o "$CF" || echo '{"clips":[]}' > "$CF"
node auto/clips.mjs match "$DIR" "$CF" || echo "clips skipped"
echo "== 4/5 voice"
voice/.venv/bin/python -I auto/voice.py "$DIR/story.json" 2>&1 | grep -v -i "warn" || true
test -f "$DIR/plan.json"
echo "== 5/5 render"
OUT="out/auto-${SLATE}-w${WEEK}.mp4"
npx remotion render AutoRecap "$OUT" --props="$DIR/plan.json" --codec=h264 --crf=20 --concurrency="${REMOTION_CONCURRENCY:-4}" --log=error
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | xargs -I{} echo "done: $OUT ({} s)"
echo "$OUT" > out/last.txt
