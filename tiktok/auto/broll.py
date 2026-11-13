#!/usr/bin/env python3
"""auto/broll.py — best-effort game footage for an auto recap, fully in the cloud.
  python3 auto/broll.py public/<dir>/story.json
Finds the game's official highlight video (YouTube search via yt-dlp), downloads up to 720p, cuts one ~7 s action
segment into 1080x1920 with clips/cut.py, and attaches it to the opening "result" scene (stat tiles sit over it).
Never fails the pipeline: if YouTube blocks the runner or nothing matches, it prints why and leaves the story unchanged.
"""
import json, pathlib, subprocess, sys, shutil

story_p = pathlib.Path(sys.argv[1]); d = story_p.parent
st = json.loads(story_p.read_text())
slate = json.loads((d / "slate.json").read_text())
if len(slate["games"]) != 1:
    print("broll: multi-game slate, skipping"); sys.exit(0)
g = slate["games"][0]
if not shutil.which("yt-dlp"):
    print("broll: yt-dlp not installed, skipping"); sys.exit(0)
q = f"ytsearch5:{g['away']['full']} vs. {g['home']['full']} highlights NFL week {slate['week']} {slate['season']}"
try:
    r = subprocess.run(["yt-dlp", "--dump-json", "--flat-playlist", "--no-warnings", q], capture_output=True, text=True, timeout=90)
    hits = [json.loads(x) for x in r.stdout.splitlines() if x.strip()]
except Exception as e:
    print("broll: search failed:", e); sys.exit(0)
an, hn = g["away"]["name"].lower(), g["home"]["name"].lower()
def ok(h):
    t = (h.get("title") or "").lower(); ch = (h.get("channel") or h.get("uploader") or "").lower()
    return an in t and hn in t and "highlight" in t and (h.get("duration") or 0) < 1500 and ("nfl" in ch)
pick = next((h for h in hits if ok(h)), None)
print("broll: search hits:", [(h.get("title"), h.get("channel")) for h in hits][:5])
if not pick:
    print("broll: no official highlight video found yet"); sys.exit(0)
url = pick.get("url") or f"https://www.youtube.com/watch?v={pick['id']}"
dur = pick.get("duration") or 600
start = max(20, int(dur * 0.18))   # past the intro, into the first big plays
raw = d / "clips" / "src.mp4"; raw.parent.mkdir(exist_ok=True)
r = subprocess.run(["yt-dlp", "--no-warnings", "-f", "bv*[height<=720][ext=mp4]/b[height<=720]", "--download-sections", f"*{start}-{start + 9}",
                    "--force-keyframes-at-cuts", "-o", str(raw), url], capture_output=True, text=True, timeout=300)
if r.returncode or not raw.exists():
    print("broll: download blocked/failed:", (r.stderr or "")[-400:]); sys.exit(0)
cut = pathlib.Path(__file__).resolve().parent.parent / "clips" / "cut.py"
out = d / "clips" / "result.mp4"
r = subprocess.run([sys.executable, str(cut), str(raw), "0", "8.5", str(out)], capture_output=True, text=True)
raw.unlink(missing_ok=True)
if r.returncode or not out.exists():
    print("broll: cut failed:", r.stderr[-400:]); sys.exit(0)
for sc in st["scenes"]:
    if sc["id"] == "result": sc["clip"] = "result.mp4"; sc["clipFrom"] = 0
story_p.write_text(json.dumps(st, indent=1))
print(f"broll: attached {pick.get('title')!r} @ {start}s to the result scene")
