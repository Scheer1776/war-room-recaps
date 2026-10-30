#!/usr/bin/env python3
"""grab.py — cut a clip from YouTube / X / TikTok / most video sites into a TikTok-ready 9:16 MP4.

Built on yt-dlp (github.com/yt-dlp/yt-dlp, ~120k stars) + ffmpeg. Runs on the owner's PC (sites block cloud IPs).

Setup (once, Windows):   winget install yt-dlp.yt-dlp Gyan.FFmpeg      (mac: brew install yt-dlp ffmpeg)
Usage:
  python grab.py URL 0:42 0:51 henry-stiffarm            -> clips/out/henry-stiffarm.mp4 (1080x1920, 30 fps, muted)
  python grab.py URL 0:42 0:51 henry-stiffarm --keep-audio --pan 0.3
Options:
  --pan 0..1     where to crop horizontally when the source is 16:9 (0 = left edge, 0.5 = center, 1 = right). Default 0.5.
  --zoom 1.0+    extra zoom before the crop (1.2 gets tighter on the action). Default 1.0.
  --keep-audio   keep the source audio (default: muted; the TikTok sound goes on top).
  --raw          also keep the untouched downloaded segment next to the output.
Then copy the MP4 into tiktok/public/<source>/ and set the composition's `clip` prop to its filename.
"""
import argparse, pathlib, shutil, subprocess, sys

def need(tool):
    if not shutil.which(tool):
        sys.exit(f"{tool} not found. Install: winget install yt-dlp.yt-dlp Gyan.FFmpeg  (mac: brew install yt-dlp ffmpeg)")

def secs(t):
    parts = [float(x) for x in t.split(":")]
    return sum(v * 60 ** i for i, v in enumerate(reversed(parts)))

ap = argparse.ArgumentParser()
ap.add_argument("url"); ap.add_argument("start"); ap.add_argument("end"); ap.add_argument("name")
ap.add_argument("--pan", type=float, default=0.5); ap.add_argument("--zoom", type=float, default=1.0)
ap.add_argument("--keep-audio", action="store_true"); ap.add_argument("--raw", action="store_true")
a = ap.parse_args()
need("yt-dlp"); need("ffmpeg")
out = pathlib.Path(__file__).parent / "out"; out.mkdir(exist_ok=True)
raw = out / f"{a.name}.raw.mp4"; final = out / f"{a.name}.mp4"
s, e = secs(a.start), secs(a.end)
if e <= s: sys.exit("end must be after start")
# 1. download just the section (yt-dlp seeks with ffmpeg; pad 1 s each side for clean keyframes)
sec = f"*{max(0, s - 1):.2f}-{e + 1:.2f}"
cmd = ["yt-dlp", "--no-playlist", "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/best",
       "--download-sections", sec, "--force-keyframes-at-cuts", "--merge-output-format", "mp4", "-o", str(raw), a.url]
print(" ".join(cmd)); subprocess.run(cmd, check=True)
# 2. trim exactly, crop to 9:16 with pan/zoom, 1080x1920 @30, h264
pan = min(1, max(0, a.pan)); z = max(1, a.zoom)
vf = (f"scale=iw*{z}:ih*{z},"
      f"crop='min(iw,ih*9/16)':'min(ih,iw*16/9)':'(iw-min(iw,ih*9/16))*{pan}':'(ih-min(ih,iw*16/9))/2',"
      f"scale=1080:1920:flags=lanczos,fps=30,format=yuv420p")
ff = ["ffmpeg", "-y", "-v", "error", "-ss", f"{1 if s >= 1 else s:.2f}", "-t", f"{e - s:.2f}", "-i", str(raw), "-vf", vf,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart"]
ff += ["-c:a", "aac", "-b:a", "160k"] if a.keep_audio else ["-an"]
ff.append(str(final)); subprocess.run(ff, check=True)
if not a.raw: raw.unlink(missing_ok=True)
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(final)], capture_output=True, text=True).stdout.strip()
print(f"\nwrote {final}  ({float(d):.1f}s, 1080x1920)\nnext: copy it to tiktok/public/<source>/ and set clip: \"{final.name}\"")
