#!/usr/bin/env python3
"""sunday-plan.py — time a SundayRecap to ONE continuous voice take (owner's rule 2026-11-01: no per-line clips, no splices).
  python3 -I scripts/sunday-plan.py public/<dir>/story.json public/<dir>/vo/<take>.wav
story.json = {"source": "<dir>", "week": 8, "scenes": [ {"id", "kind", "anchor": ["first", "words"], "clip"?, "keyAt"?, ...scene props} ],
              "scores": [...]}   (anchor = the first transcript words of the scene's line, lowercase, digits as digits)
Writes public/<dir>/vo/full.mp3 (trim + 0.15 s lead-in + loudnorm, nothing else) and public/<dir>/plan.json with each scene's
`dur` (cut 0.12 s before its anchor) and each clip's `clipFrom`, so the clip's big moment (keyAt, seconds into the cut clip)
lands inside the scene with >= 0.9 s before and >= 1.1 s after. Prints the timing table; exits 1 if a clip can't fit.
"""
import json, re, subprocess, sys, pathlib

story_p, take = pathlib.Path(sys.argv[1]), sys.argv[2]
st = json.loads(story_p.read_text()); d = story_p.parent
full = d / "vo" / "full.mp3"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", take, "-af",
                "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,adelay=150|150,loudnorm=I=-14:TP=-1.5:LRA=9",
                "-ar", "44100", "-ac", "1", "-b:a", "192k", str(full)], check=True)
from faster_whisper import WhisperModel
m = WhisperModel("small.en", device="cpu", compute_type="int8")
w = [x for s in m.transcribe(str(full), beam_size=5, word_timestamps=True)[0] for x in s.words]
nw = [re.sub(r"[^a-z0-9']", "", x.word.lower()).replace("'", "") for x in w]
def find(seq, after):
    seq = [re.sub(r"[^a-z0-9]", "", s.lower()) for s in seq]
    for i in range(after, len(nw) - len(seq) + 1):
        if nw[i:i + len(seq)] == seq: return i
    raise SystemExit(f"anchor {seq} not found after word {after}: ...{' '.join(nw[after:after + 25])}")
starts, i = [0.0], 0
for sc in st["scenes"][1:]:
    i = find(sc["anchor"], i); starts.append(round(max(0, w[i].start - 0.12) * 30) / 30)
ends = starts[1:] + [round((w[-1].end + 2.3) * 30) / 30]
dur = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)
bad = 0; scenes = []
for sc, a, b in zip(st["scenes"], starts, ends):
    s = {k: v for k, v in sc.items() if k not in ("anchor", "keyAt", "minBefore")}
    s["dur"] = round(b - a, 3); s.setdefault("base", s["dur"]); s["clipFrom"] = 0
    msg = ""
    if sc.get("clip"):
        clen = dur(str(d / "clips" / sc["clip"])); k = sc["keyAt"]; D = s["dur"]
        mb = sc.get("minBefore", 0.8)   # a short scene (< 2 s) may lower this: the moment still shows, it just arrives fast
        want = min(max(mb + 0.1, D * 0.55), D - 1.1)
        cf = min(max(0.0, k - want), max(0.0, clen - D - 0.05)); kin = k - cf
        s["clipFrom"] = round(cf, 2)
        ok = kin >= mb and D - kin >= 1.0 and cf + D <= clen + 0.01
        bad += not ok
        msg = f"clip {sc['clip']} from {cf:.2f}: moment at {kin:.2f}s (before {kin:.2f}, after {D - kin:.2f}){'' if ok else '  <-- DOES NOT FIT'}"
    print(f"{sc['id']:9} {a:6.2f}-{b:6.2f} ({s['dur']:4.2f}s) {msg}")
    scenes.append(s)
plan = {"source": st["source"], "week": st["week"], "voice": True, "voDur": None, "voFull": "full.mp3", "scenes": scenes, "scores": st["scores"]}
(d / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False))
print(f"video {ends[-1]:.2f}s, voice ends {w[-1].end:.2f}s -> {d / 'plan.json'}")
sys.exit(1 if bad else 0)
