# Backs up the "War Room Narrator" VoiceStudio profile (id e864e4c6): profile JSON + reference audio. Read-only.
$ErrorActionPreference = "Stop"
$dir = Join-Path $PSScriptRoot "takes"; $log = Join-Path $dir "vs-narrator.log"; $id = "e864e4c6"
"[$(Get-Date -Format s)] export $id" | Out-File -Encoding utf8 $log
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:3900/profiles/$id" -TimeoutSec 20 | ConvertTo-Json -Depth 8 | Out-File -Encoding utf8 (Join-Path $dir "narrator-profile.json")
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:3900/profiles/$id/audio" -TimeoutSec 60 -UseBasicParsing -OutFile (Join-Path $dir "narrator-ref-original.bin") -PassThru
  "audio content-type: $($r.Headers['Content-Type'])" | Out-File -Append -Encoding utf8 $log
  "DONE" | Out-File -Append -Encoding utf8 $log
} catch { "FAILED: $($_.Exception.Message) $($_.ErrorDetails.Message)" | Out-File -Append -Encoding utf8 $log }
