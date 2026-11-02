#!/usr/bin/env python3
"""say.py — turn a real-spelling script into the text VoiceStudio should read, BEFORE recording (2026-11-02).
  python3 -I voice/say.py "Tyler Allgeier was projected for eight."
Prints the voice text (each name swapped for its sourced respelling where the plain spelling is known to come out wrong)
and lists every name with NO sourced pronunciation: cut those names from the voice (show them on screen only).
Sources: voice/names.json "pronounce" (hand-checked) then voice/pronounce-bank.json (top ~300 players, sourced).
The script you audit with stays the REAL spelling; only the voice text is respelled.
"""
import re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "audit"))
import pronounce  # loads names.json + the bank into pronounce.NAMES

script = sys.argv[1]
names = pronounce.names_in(script)
missing = [n for n in names if not (pronounce.NAMES.get(n) or {}).get("ipa")]
voice = script
for n in sorted(names, key=len, reverse=True):
    ref = pronounce.NAMES.get(n) or {}
    say = ref.get("say")
    # respell only when the entry says the plain spelling is misread (it lists a "wrong" reading) and the respelling differs
    if say and ref.get("wrong") and say.replace("-", "").lower() != n.replace("-", "").replace("'", "").lower():
        voice = re.sub(rf"\b{re.escape(n)}\b", say, voice)
print("VOICE TEXT:\n" + voice)
print("\nNO SOURCED PRONUNCIATION (cut from the voice or source one):", ", ".join(missing) if missing else "none")
sys.exit(1 if missing else 0)
