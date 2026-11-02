@echo off
rem One-time setup so War Room videos render on this PC (much faster than the cloud).
set "HERE=%~dp0"
set "LOG=%HERE%pc-render-setup.log"
set "REPO=C:\WarRoom\war-room-recaps"
echo [%date% %time%] setup start > "%LOG%"
echo --- machine >> "%LOG%"
echo cores: %NUMBER_OF_PROCESSORS% >> "%LOG%"
powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).Name; (Get-CimInstance Win32_VideoController).Name; [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB).ToString() + ' GB RAM'" >> "%LOG%" 2>&1
echo --- node >> "%LOG%"
if not exist "C:\Program Files\nodejs\node.exe" (
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements >> "%LOG%" 2>&1
)
set "PATH=C:\Program Files\nodejs;%PATH%"
node --version >> "%LOG%" 2>&1
echo --- repo (apply queued patches + push) >> "%LOG%"
call "%HERE%wr-push.bat" >nul 2>&1
type "%HERE%wr-push.log" >> "%LOG%"
echo --- packages >> "%LOG%"
cd /d "%REPO%\tiktok" || (echo no repo >> "%LOG%" & goto :end)
call npm ci --no-audit --no-fund >> "%LOG%" 2>&1
echo --- remotion browser >> "%LOG%"
call npx remotion browser ensure >> "%LOG%" 2>&1
:end
echo [%date% %time%] SETUP DONE >> "%LOG%"
