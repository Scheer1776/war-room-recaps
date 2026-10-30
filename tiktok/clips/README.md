# Clips

`grab.py` cuts a section of any YouTube / X / TikTok / Reddit video into a vertical 1080x1920 MP4 for the video
compositions' clip slots (`PlayerHype.clip`, `Broll.src`). It wraps **yt-dlp** (github.com/yt-dlp/yt-dlp) and ffmpeg.

It runs on the owner's PC, not in the cloud runs: YouTube and friends block datacenter IPs, and the owner picks the
moment by hand anyway. Footage policy: owner's call (PLAYBOOK hard rules, 2026-10-30).

## One-time setup (Windows)
```
winget install yt-dlp.yt-dlp Gyan.FFmpeg
```
(mac: `brew install yt-dlp ffmpeg`). Keep yt-dlp fresh when a site breaks: `yt-dlp -U`.

## Cut a clip
```
python tiktok/clips/grab.py "https://www.youtube.com/watch?v=XXXX" 0:42 0:51 henry-stiffarm
```
Options: `--pan 0.3` (crop left of center on a 16:9 source), `--zoom 1.2` (tighter), `--keep-audio`, `--raw`.
Output: `tiktok/clips/out/henry-stiffarm.mp4`. Copy it to `tiktok/public/<source>/` and set `clip: "henry-stiffarm.mp4"`
(`clipFrom` = seconds into the clip to start) in the composition props, or hand the file to Claude with the name.

Tip: 6–9 seconds is the sweet spot for a hype cut; the scene is 5 s and starts at `clipFrom`.
