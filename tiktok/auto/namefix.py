"""auto/namefix.py — cloud name auditor + auto-fix for the Kokoro voice (2026-11-13; same checker as the PC: audit/pronounce.py).
check_take(wav, script) -> results;  kokoro_from_ipa(entry) -> Kokoro/misaki phonemes from a sourced names.json / bank entry.
voice.py runs: record -> audit every name -> for each FAIL that has a sourced pronunciation, override Kokoro with that
pronunciation -> re-record -> re-audit (max 2 retries). Names with nothing on file are reported, never guessed."""
import re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "audit"))
import pronounce  # noqa: E402

PAIRS = [("e ɪ", "A"), ("a ɪ", "I"), ("o ʊ", "O"), ("a ʊ", "W"), ("ɔ ɪ", "Y"), ("d ʒ", "ʤ"), ("t ʃ", "ʧ")]
VOWELS = set("æɑɔəɛɪiʊuʌɜaeoAIOWY")

def kokoro_from_ipa(entry):
    s = " " + entry["ipa"] + " "
    for a, b in PAIRS: s = s.replace(f" {a} ", f" {b} ")
    ph = s.split()
    # primary stress: the CAPS syllable of the respelling ("SKAT-uh-boo" -> 1st, "muh-LEEK" -> 2nd); default first syllable
    say = entry.get("say") or entry.get("note") or ""
    parts = [x for x in re.split(r"[-\s]", say.split(",")[0]) if x]
    k = next((i for i, x in enumerate(parts) if len(x) > 1 and x.isupper()), 0)
    vi = [i for i, x in enumerate(ph) if x in VOWELS or x[0] in VOWELS]
    if vi: ph.insert(vi[min(k, len(vi) - 1)], "ˈ")
    return "".join(ph)

def check_take(wav, script):
    return pronounce.check(str(wav), script)

def entry(name):
    return pronounce.NAMES.get(name)
