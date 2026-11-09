# Replaces the "War Room Narrator" reference audio with the cleaned version (music bed + room noise removed, 2026-11-08).
# The original is backed up in takes\narrator-ref-original.bin (restore: run this with that file instead).
$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot; $log = Join-Path $dir "takes\vs-narrator.log"; $id = "e864e4c6"
$wav = Join-Path $dir "narrator-ref-clean.wav"
"[$(Get-Date -Format s)] replace reference with $wav" | Out-File -Append -Encoding utf8 $log
$out = & curl.exe -s -S -X PUT "http://127.0.0.1:3900/profiles/$id/audio" -F "ref_audio=@$wav;type=audio/wav" -F "ref_text=You dig a giant hole in your backyard, then dig a trench connecting it to the ocean. The bottom sits below sea level, so seawater flows in until both sides reach the same height. Now you have your own ocean, until the tide goes out. Water flows back down the trench." -F "language=English" 2>&1
"response: $out" | Out-File -Append -Encoding utf8 $log
"DONE" | Out-File -Append -Encoding utf8 $log
