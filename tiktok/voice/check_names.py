"""Listen back to voice clips and confirm every word that matters was heard.
Usage: .venv/bin/python -I check_names.py lines.json clip_dir
Exits 1 and lists failures when a capitalized name or key word from the script isn't in the transcript."""
import json, re, sys, pathlib
from faster_whisper import WhisperModel

lines = json.loads(pathlib.Path(sys.argv[1]).read_text())
d = pathlib.Path(sys.argv[2])
m = WhisperModel("small.en", device="cpu", compute_type="int8")
norm = lambda s: re.sub(r"[^a-z0-9 ]", " ", s.lower())
bad = []
for k, t in lines.items():
    f = next((d / f"{k}{e}" for e in (".wav", ".mp3") if (d / f"{k}{e}").exists()), None)
    if not f: bad.append((k, "missing clip")); continue
    heard = norm(" ".join(s.text for s in m.transcribe(str(f), beam_size=5)[0]))
    # Every capitalized word that isn't the first word of a sentence is treated as a name.
    names = {w for w in re.findall(r"(?<![.?!]\s)(?<!^)\b[A-Z][a-zA-Z'\-]+", t)}
    miss = [w for w in names if norm(w).strip() not in heard]
    print(f"{k}: heard '{heard.strip()}'" + (f"  MISSING {miss}" if miss else "  ok"))
    if miss: bad.append((k, miss))
sys.exit(1 if bad else 0)
