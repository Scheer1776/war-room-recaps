#!/usr/bin/env python3
"""auto/voice.py — voice a story.json with Kokoro (free, Apache-2.0, CPU) and time the video to it.
  voice/.venv/bin/python -I auto/voice.py public/<dir>/story.json [--voice am_michael:0.7,am_fenrir:0.3] [--speed 1.2]
One continuous generation of the whole script (one line per scene, so each Kokoro chunk = one scene), then:
  - <dir>/vo/full.mp3   trimmed, 0.15 s lead-in, loudnorm -14 LUFS
  - <dir>/plan.json     SundayRecap props: each scene's exact `dur`, word timings for captions (script spelling)
Names in voice/names.json -> "kokoro" get exact phonemes. "Jr." is spoken "Junior" (captions keep "Jr.").
"""
import json, re, subprocess, sys, pathlib
import numpy as np, soundfile as sf
from kokoro import KPipeline

args = sys.argv[1:]
story_p = pathlib.Path(args[0]); d = story_p.parent
opt = lambda k, v: args[args.index(k) + 1] if k in args else v
VOICE, SPEED = opt("--voice", "am_michael:0.7,am_fenrir:0.3"), float(opt("--speed", "1.2"))  # 2026-11-12 owner: "a little more excitement, not much more" -> +17% pitch movement
SR, LEAD, GAP, TAIL = 24000, 0.15, 0.28, 0.6   # GAP = breath after each scene's line (Kokoro chunks join without one)

st = json.loads(story_p.read_text())
lex = json.loads((pathlib.Path(__file__).resolve().parent.parent / "voice" / "names.json").read_text())["kokoro"]
def for_speech(t):
    t = re.sub(r"\bJr\.", "Junior", t); t = re.sub(r"\bSr\.", "Senior", t); t = re.sub(r"\bIII\b", "the third", t)
    for w in sorted(lex, key=len, reverse=True):
        t = re.sub(rf"(?<![\w\[]){re.escape(w)}(?![\w\]])", f"[{w}](/{lex[w]}/)", t)
    return t

pipe = KPipeline(lang_code="a")
if ":" in VOICE:   # weighted blend of Kokoro voicepacks, e.g. am_michael:0.7,am_fenrir:0.3
    VOICE = sum(float(w) * pipe.load_voice(n) for n, w in (x.split(":") for x in VOICE.split(",")))
chunks, words, t = [], [], LEAD
audio = [np.zeros(int(LEAD * SR), dtype=np.float32)]
for sc in st["scenes"]:
    start = t
    parts = list(pipe(for_speech(sc["line"]), voice=VOICE, speed=SPEED, split_pattern=r"\n+"))
    for r in parts:
        a = r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio)
        # caption words from Kokoro's own token timings (no transcription needed)
        for tok in (r.tokens or []):
            if tok.start_ts is None or not re.search(r"[A-Za-z0-9]", tok.text): continue
            words.append({"t": tok.text + (tok.whitespace and "" or ""), "s": round(t + tok.start_ts, 3), "e": round(t + (tok.end_ts or tok.start_ts + 0.2), 3)})
        audio.append(a.astype(np.float32)); t += len(a) / SR
    spoke = t - start
    audio.append(np.zeros(int(GAP * SR), dtype=np.float32)); t += GAP
    chunks.append((sc, start, spoke))

audio.append(np.zeros(int(TAIL * SR), dtype=np.float32))
(d / "vo").mkdir(exist_ok=True)
raw = d / "vo" / "take.wav"; sf.write(raw, np.concatenate(audio), SR)
full = d / "vo" / "full.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.8:level=disabled",
                "-ar", "44100", "-ac", "1", "-b:a", "192k", str(full)], check=True)

# Captions keep the SCRIPT's spelling ("Jr.", digits): map spoken tokens back to script words by order where counts match.
script_words = []
for sc in st["scenes"]:
    script_words += re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-\.]*[A-Za-z0-9]?[.,?!:;]?|[A-Za-z0-9]", sc["line"])
if len(script_words) == len(words):
    for w, s in zip(words, script_words): w["t"] = s

# Scene lengths: each scene runs from its line's start to the next line's start (cut 0.1 s early); the CTA holds >= minDur.
scenes, starts = [], [c[1] for c in chunks]
total = t + TAIL
for i, (sc, a, spoke) in enumerate(chunks):
    a0 = 0.0 if i == 0 else a - 0.1
    b0 = starts[i + 1] - 0.1 if i + 1 < len(chunks) else max(total, a0 + sc.get("minDur", 0) + 0.4)
    s = {k: v for k, v in sc.items() if k not in ("line", "minDur")}
    s["dur"] = round(b0 - a0, 3); s["base"] = s["dur"]
    scenes.append(s)
    print(f"{sc['id']:8} {a0:6.2f}-{b0:6.2f} ({s['dur']:.2f}s)  {sc['line']}")
plan = {"source": st["source"], "week": st["week"], "label": st.get("label"), "voice": True, "voDur": None, "voFull": "full.mp3",
        "words": words, "scenes": scenes, "scores": st["scores"]}
(d / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False))
print(f"video {sum(s['dur'] for s in scenes):.2f}s, {len(words)} caption words ({'script spelling' if len(script_words) == len(words) else 'spoken spelling'}) -> {d / 'plan.json'}")
