#!/usr/bin/env python3
"""cut.py — cut one highlight into a 1080x1920, 30 fps, silent MP4 for the clip-first compositions (SundayRecap, PlayerHype).
  python3 -I clips/cut.py SRC START END OUT [--speed 0.8] [--pan 0.5] [--zoom 1.0] [--y 260]
Vertical sources (Shorts) are scaled to cover the frame. Landscape sources become a square crop (pan 0=left .. 1=right of
center, zoom >1 = tighter) over a blurred, darkened copy of themselves, with the square's top at --y.
--speed < 1 slows the cut (0.8 for the big moment). Prints the output length; key moments in the output sit at
(source_time - START) / speed seconds.
"""
import argparse, json, subprocess

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("start", type=float); ap.add_argument("end", type=float); ap.add_argument("out")
ap.add_argument("--speed", type=float, default=1.0); ap.add_argument("--pan", type=float, default=0.5)
ap.add_argument("--no-smooth", action="store_true"); ap.add_argument("--zoom", type=float, default=1.0); ap.add_argument("--y", type=int, default=260)
a = ap.parse_args()

info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                  "-of", "json", a.src], capture_output=True, text=True, check=True).stdout)["streams"][0]
w, h = info["width"], info["height"]
# Slow-mo (2026-11-08): plain setpts just repeats frames (stutters at 0.75x). Motion-interpolate new in-between
# frames instead so the big play glides. --no-smooth falls back to frame repeats (faster to cut).
slow = (f"setpts=PTS/{a.speed}," + ("" if a.no_smooth else "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,")) if a.speed != 1 else ""
if h > w:
    vf = f"{slow}scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p"
else:
    side = int(h / a.zoom)
    x = f"(iw-{side})*{a.pan}"
    vf = (f"{slow}split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.18[bg];"
          f"[b]crop={side}:{side}:{x}:(ih-{side})/2,scale=1080:1080[fg];[bg][fg]overlay=0:{a.y},fps=30,format=yuv420p")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a.start), "-to", str(a.end), "-i", a.src, "-an",
                "-filter_complex" if h <= w else "-vf", vf, "-c:v", "libx264", "-crf", "18", "-preset", "medium", a.out], check=True)
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.out], capture_output=True, text=True).stdout.strip()
print(f"{a.out}: {d} s ({w}x{h} -> 1080x1920, speed {a.speed})")
