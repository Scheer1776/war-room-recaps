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
VOICE, SPEED = opt("--voice", "am_michael:0.55,am_fenrir:0.45"), float(opt("--speed", "1.22"))  # 2026-11-13 owner: "a little bit more excitement" (was 0.7/0.3 @ 1.2)  # 2026-11-12 owner: "a little more excitement, not much more" -> +17% pitch movement
SR, LEAD, GAP, TAIL = 24000, 0.15, 0.28, 0.6   # GAP = breath after each scene's line (Kokoro chunks join without one)

st = json.loads(story_p.read_text())
lex = json.loads((pathlib.Path(__file__).resolve().parent.parent / "voice" / "names.json").read_text())["kokoro"]
def for_speech(t):
    t = re.sub(r"\bJr\.", "Junior", t); t = re.sub(r"\bSr\.", "Senior", t); t = re.sub(r"\bIII\b", "the third", t)
    for w in sorted(lex, key=len, reverse=True):
        t = re.sub(rf"(?<![\w\[]){re.escape(w)}(?![\w\]])", f"[{w}](/{lex[w]}/)", t)
    return t

pipe = KPipeline(lang_code="a")
if ":" in VOICE:   # weighted blend of Kokoro voicepacks, e.g. am_michael:0.55,am_fenrir:0.45
    VOICE = sum(float(w) * pipe.load_voice(n) for n, w in (x.split(":") for x in VOICE.split(",")))

def record():
    chunks, words, t = [], [], LEAD
    audio = [np.zeros(int(LEAD * SR), dtype=np.float32)]
    for sc in st["scenes"]:
        start = t
        for r in pipe(for_speech(sc["line"]), voice=VOICE, speed=SPEED, split_pattern=r"\n+"):
            a = r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio)
            for tok in (r.tokens or []):   # caption words from Kokoro's own token timings (no transcription needed)
                if tok.start_ts is None or not re.search(r"[A-Za-z0-9]", tok.text): continue
                words.append({"t": tok.text, "s": round(t + tok.start_ts, 3), "e": round(t + (tok.end_ts or tok.start_ts + 0.2), 3)})
            audio.append(a.astype(np.float32)); t += len(a) / SR
        spoke = t - start
        pad = max(GAP, sc.get("minDur", 0) - spoke) if sc is not st["scenes"][-1] else GAP   # a scene can hold longer than its line (e.g. to let a clip play)
        audio.append(np.zeros(int(pad * SR), dtype=np.float32)); t += pad
        chunks.append((sc, start, spoke))
    audio.append(np.zeros(int(TAIL * SR), dtype=np.float32))
    (d / "vo").mkdir(exist_ok=True)
    sf.write(d / "vo" / "take.wav", np.concatenate(audio), SR)
    return chunks, words, t

# Name audit + auto-fix (auto/namefix.py, same checker as the PC's audit/pronounce.py)
import importlib.util as _iu
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
script_all = " ".join(sc["line"] for sc in st["scenes"])
report, fixed = [], {}
for attempt in range(3):
    chunks, words, t = record()
    if "--no-name-audit" in args: break
    try:
        import namefix
        res = namefix.check_take(d / "vo" / "take.wav", script_all)
    except Exception as e:
        report.append(f"name audit skipped: {e}"); break
    fails = [(n, m) for n, stt, m in res if stt == "FAIL"]
    report = [f"[{stt}] {n}: {m}" for n, stt, m in res]
    todo = []
    for n, m in fails:
        e = namefix.entry(n)
        if e and e.get("ipa") and n not in fixed: todo.append((n, namefix.kokoro_from_ipa(e)))
    print(f"name audit (take {attempt + 1}): {sum(1 for _, s_, _ in res if s_ == 'PASS')} pass, {len(fails)} fail" + (f"; fixing {[x for x, _ in todo]}" if todo else ""))
    if not todo: break
    for n, ph in todo: lex[n] = ph; fixed[n] = ph
(d / "names-report.txt").write_text("\n".join(report + ([f"auto-fixed (Kokoro phonemes): {fixed}"] if fixed else [])) + "\n")
for line in report: print("  " + line)
if fixed: print("  auto-fixed:", fixed, "-> add to voice/names.json 'kokoro' to keep")

total = t + TAIL
full = d / "vo" / "full.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(d / "vo" / "take.wav"), "-af", "loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.8:level=disabled",
                "-ar", "44100", "-ac", "1", "-b:a", "192k", str(full)], check=True)

# Captions keep the SCRIPT's spelling ("Jr.", digits): map spoken tokens back to script words by order where counts match.
script_words = []
for sc in st["scenes"]:
    script_words += re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-\.]*[A-Za-z0-9]?[.,?!:;]?|[A-Za-z0-9]", sc["line"])
if len(script_words) == len(words):
    for w, s in zip(words, script_words): w["t"] = s

# Scene lengths: each scene runs from its line's start to the next line's start (cut 0.1 s early); the CTA holds >= minDur.
scenes, starts = [], [c[1] for c in chunks]
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
