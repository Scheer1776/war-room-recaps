@echo off
rem War Room weekly highlight scrape (runs itself: Sunday 8:45pm and Monday 7:00am, Windows Task Scheduler "WarRoom Sunday Clips").
rem Grabs every NFL-channel upload since that Sunday (shorts <= 90 s, videos <= 20 min) into C:\WarRoom\clip-library\sun-<date>.
rem Re-runs are cheap: archive.txt skips anything already downloaded. Index of what came down: index.tsv in that folder.
setlocal
for /f %%d in ('powershell -NoProfile -Command "(Get-Date).AddDays(-[int](Get-Date).DayOfWeek).ToString('yyyyMMdd')"') do set "SUN=%%d"
set "OUT=C:\WarRoom\clip-library\sun-%SUN%"
if not exist "%OUT%" mkdir "%OUT%"
set "LOG=%OUT%\run.log"
echo [%date% %time%] start (games of %SUN%) >> "%LOG%"
yt-dlp -U >> "%LOG%" 2>&1
set "COMMON=--dateafter %SUN% --break-match-filters "upload_date >= %SUN%" --merge-output-format mp4 --download-archive %OUT%\archive.txt --no-overwrites --ignore-errors --sleep-requests 1 --sleep-interval 1 --max-sleep-interval 3"
echo --- shorts >> "%LOG%"
yt-dlp "https://www.youtube.com/@NFL/shorts" --playlist-end 200 --match-filter "duration <= 90" -f "bv*[height<=1920][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" %COMMON% -o "%OUT%\shorts\%%(title).80B [%%(id)s].%%(ext)s" --print-to-file "shorts	%%(upload_date)s	%%(duration)s	%%(width)sx%%(height)s	%%(id)s	%%(title)s" "%OUT%\index.tsv" >> "%LOG%" 2>&1
echo --- videos >> "%LOG%"
yt-dlp "https://www.youtube.com/@NFL/videos" --playlist-end 200 --match-filter "duration <= 1200" -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b" %COMMON% -o "%OUT%\videos\%%(title).80B [%%(id)s].%%(ext)s" --print-to-file "videos	%%(upload_date)s	%%(duration)s	%%(width)sx%%(height)s	%%(id)s	%%(title)s" "%OUT%\index.tsv" >> "%LOG%" 2>&1
echo [%date% %time%] DONE >> "%LOG%"
