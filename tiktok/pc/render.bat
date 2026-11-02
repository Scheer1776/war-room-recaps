@echo off
rem War Room PC render: render.bat <Composition> <name> [extra remotion flags]
rem   e.g. render.bat SundayRecap sunday-recap-voice
rem Uses 75%% of this PC's cores + the GPU, writes tiktok\out\<name>.mp4, copies it to Completed Videos with today's date,
rem and logs the time to render.log next to this script.
setlocal
set "HERE=%~dp0"
set "LOG=%HERE%render.log"
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d C:\WarRoom\war-room-recaps\tiktok || exit /b 1
set /a CONC=NUMBER_OF_PROCESSORS*3/4
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "TODAY=%%d"
echo [%date% %time%] render %1 -^> out\%2.mp4 (%CONC% of %NUMBER_OF_PROCESSORS% threads) >> "%LOG%"
call npx remotion render %1 "out\%2.mp4" --concurrency=%CONC% --gl=angle %3 %4 %5 %6 >> "%LOG%" 2>&1
if errorlevel 1 (echo RENDER FAILED >> "%LOG%" & exit /b 1)
copy /y "out\%2.mp4" "%HERE%Completed Videos\%TODAY%-%2.mp4" >nul
echo [%date% %time%] RENDER DONE -^> Completed Videos\%TODAY%-%2.mp4 >> "%LOG%"
