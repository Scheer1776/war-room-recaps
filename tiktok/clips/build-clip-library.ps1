# War Room clip library: downloads short NFL highlight clips for the players in wishlist.txt.
# Run:  powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\OneDrive\Desktop\Documents-WarRoom\clips\build-clip-library.ps1"
# Needs yt-dlp + ffmpeg (winget install yt-dlp.yt-dlp Gyan.FFmpeg). Safe to re-run: archive.txt skips clips you already have.
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
New-Item -ItemType Directory -Force -Path "library" | Out-Null
yt-dlp -U 2>$null | Out-Null
yt-dlp `
  -a wishlist.txt `
  --match-filter "duration <= 120 & channel = 'NFL'" `
  --dateafter 20240901 `
  -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b[height<=720]" `
  --merge-output-format mp4 `
  --download-archive archive.txt `
  --no-overwrites --ignore-errors --no-playlist `
  --sleep-requests 1 --sleep-interval 2 --max-sleep-interval 5 `
  -o "library\%(upload_date)s %(title).90B [%(id)s].%(ext)s" `
  --print-to-file "%(upload_date)s`t%(duration)s`t%(id)s`t%(webpage_url)s`t%(title)s" index.tsv
$n = (Get-ChildItem library -Filter *.mp4).Count
$mb = [math]::Round(((Get-ChildItem library -Filter *.mp4 | Measure-Object Length -Sum).Sum / 1MB), 0)
Write-Host "`nDone. $n clips in $here\library ($mb MB). index.tsv lists them."
