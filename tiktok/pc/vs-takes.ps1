# vs-takes.ps1: generate voice takes through VoiceStudio's local API (no clicking). Reads takes\job.json:
#   {"name": "recap60", "voice": "War Room Announcer", "model": "voxcpm2", "seeds": [11, 12, 13], "text": "..."}
# Writes takes\<name>_s<seed>.wav for each seed and takes\vs-takes.log. VoiceStudio must be open (its engine serves 127.0.0.1:3900).
$ErrorActionPreference = "Stop"
$dir = Join-Path $PSScriptRoot "takes"
$log = Join-Path $dir "vs-takes.log"
$job = Get-Content -Raw -Encoding UTF8 (Join-Path $dir "job.json") | ConvertFrom-Json
"[$(Get-Date -Format s)] job $($job.name): $($job.seeds.Count) takes, voice '$($job.voice)', model $($job.model)" | Out-File -Append -Encoding utf8 $log
try { $h = Invoke-RestMethod -Uri "http://127.0.0.1:3900/health" -TimeoutSec 5; "engine: $($h.status) on $($h.device)" | Out-File -Append -Encoding utf8 $log }
catch { "ENGINE NOT REACHABLE: open VoiceStudio first. $_" | Out-File -Append -Encoding utf8 $log; exit 1 }
foreach ($seed in $job.seeds) {
  $out = Join-Path $dir ("{0}_s{1}.wav" -f $job.name, $seed)
  $body = @{ model = $job.model; input = $job.text; voice = $job.voice; response_format = "wav"; seed = [int]$seed } | ConvertTo-Json -Compress
  $t0 = Get-Date
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:3900/v1/audio/speech" -Method Post -ContentType "application/json; charset=utf-8" `
      -Body ([Text.Encoding]::UTF8.GetBytes($body)) -OutFile $out -TimeoutSec 900 -UseBasicParsing
    "take seed $seed -> $(Split-Path $out -Leaf) ($([int](Get-Item $out).Length / 1KB) KB, $([int]((Get-Date) - $t0).TotalSeconds) s)" | Out-File -Append -Encoding utf8 $log
  } catch { "take seed $seed FAILED: $($_.Exception.Message) $($_.ErrorDetails.Message)" | Out-File -Append -Encoding utf8 $log }
}
"[$(Get-Date -Format s)] DONE" | Out-File -Append -Encoding utf8 $log
