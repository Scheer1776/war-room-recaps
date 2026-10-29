"""Speak one line per scene with Kokoro (free, Apache-2.0).
Usage: .venv/bin/python -I kokoro_tts.py lines.json out_dir
lines.json = {"hook": "text", "scene2": "text", ...}
Names listed in names.json get exact pronunciations ([Name](/phonemes/) inline syntax)."""
import json, re, sys, pathlib
import numpy as np, soundfile as sf
from kokoro import KPipeline

here = pathlib.Path(__file__).parent
lex = json.loads((here / "names.json").read_text())["kokoro"]
lines = json.loads(pathlib.Path(sys.argv[1]).read_text())
out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)

def apply_lex(t: str) -> str:
    for word in sorted(lex, key=len, reverse=True):
        t = re.sub(rf"(?<![\w\[]){re.escape(word)}(?![\w\]])", f"[{word}](/{lex[word]}/)", t)
    return t

p = KPipeline(lang_code="a")
for k, t in lines.items():
    audio = np.concatenate([a for _, _, a in p(apply_lex(t), voice="am_michael", speed=1.1)])
    sf.write(out / f"{k}.wav", audio, 24000)
    print(k, round(len(audio) / 24000, 2), "s")
