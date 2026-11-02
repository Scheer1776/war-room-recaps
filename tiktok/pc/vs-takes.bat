@echo off
rem Generate the voice takes described in takes\job.json via VoiceStudio's local API. Log: takes\vs-takes.log
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vs-takes.ps1"
