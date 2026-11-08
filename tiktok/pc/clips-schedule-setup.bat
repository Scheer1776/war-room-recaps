@echo off
rem One-time setup: registers the weekly clip scrape in Windows Task Scheduler (current user, no admin needed).
set "BAT=C:\WarRoom\war-room-recaps\tiktok\clips\weekly-clips.bat"
set "LOG=%~dp0clips-schedule-setup.log"
echo [%date% %time%] setup > "%LOG%"
schtasks /Create /F /TN "WarRoom Sunday Clips" /SC WEEKLY /D SUN /ST 20:45 /TR "\"%BAT%\"" >> "%LOG%" 2>&1
schtasks /Create /F /TN "WarRoom Sunday Clips (Mon AM)" /SC WEEKLY /D MON /ST 07:00 /TR "\"%BAT%\"" >> "%LOG%" 2>&1
schtasks /Create /F /TN "WarRoom Sunday Clips (afternoon)" /SC WEEKLY /D SUN /ST 17:15 /TR "\"%BAT%\"" >> "%LOG%" 2>&1
schtasks /Query /TN "WarRoom Sunday Clips (afternoon)" /FO LIST >> "%LOG%" 2>&1
schtasks /Query /TN "WarRoom Sunday Clips" /FO LIST >> "%LOG%" 2>&1
schtasks /Query /TN "WarRoom Sunday Clips (Mon AM)" /FO LIST >> "%LOG%" 2>&1
echo DONE >> "%LOG%"
