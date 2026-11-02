@echo off
rem Sunday Week 8 highlights for the War Room recap video: newest NFL-channel uploads from 2026-11-01 about today's storylines.
set "OUT=C:\WarRoom\clip-library\sun8"
if not exist "%OUT%" mkdir "%OUT%"
set "LOG=%OUT%\run.log"
echo [%date% %time%] start > "%LOG%"
yt-dlp --version >> "%LOG%" 2>&1
set "WHO=Burrow|Higgins|Chase|Allgeier|Adonai|Mitchell|Bijan|Falcons|Buccaneers|Bengals|Titans|Cardinals|Cowboys|Jets|Raiders|Jaguars|Tuten"
set "COMMON=--dateafter 20261101 --break-match-filters "upload_date >= 20261101" --merge-output-format mp4 --download-archive %OUT%\archive.txt --no-overwrites --ignore-errors --sleep-requests 1 --sleep-interval 1 --max-sleep-interval 3"
echo --- shorts (vertical plays) >> "%LOG%"
yt-dlp "https://www.youtube.com/@NFL/shorts" --playlist-end 120 --match-filter "duration <= 90 & title ~= '(?i)(%WHO%)'" -f "bv*[height<=1920][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" %COMMON% -o "%OUT%\shorts\%%(title).80B [%%(id)s].%%(ext)s" --print-to-file "shorts	%%(upload_date)s	%%(duration)s	%%(width)sx%%(height)s	%%(id)s	%%(title)s" "%OUT%\index.tsv" >> "%LOG%" 2>&1
echo --- videos (plays + game packages) >> "%LOG%"
yt-dlp "https://www.youtube.com/@NFL/videos" --playlist-end 150 --match-filter "duration <= 1200 & title ~= '(?i)(%WHO%)'" -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b" %COMMON% -o "%OUT%\videos\%%(title).80B [%%(id)s].%%(ext)s" --print-to-file "videos	%%(upload_date)s	%%(duration)s	%%(width)sx%%(height)s	%%(id)s	%%(title)s" "%OUT%\index.tsv" >> "%LOG%" 2>&1
echo [%date% %time%] DONE >> "%LOG%"
