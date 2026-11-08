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
# 1) remove VoxCPM2's steady vocoder tones first (owner heard "high pitched ringing", 2026-11-02: 6000 Hz + others)
clean = d / "vo" / "take-clean.wav"
subprocess.run([sys.executable, "-I", str(pathlib.Path(__file__).resolve().parent.parent / "voice" / "dering.py"), take, str(clean)], check=True)
take = str(clean)
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
def find_any(anchor, after):
    """anchor = ["first", "words"] or a list of alternatives [["bs", "on"], ["b", "zahn"]] (whisper hears names differently run to run)"""
    alts = anchor if anchor and isinstance(anchor[0], list) else [anchor]
    for a in alts:
        try: return find(a, after)
        except SystemExit as e: err = e
    raise err
for sc in st["scenes"][1:]:
    i = find_any(sc["anchor"], i); starts.append(round(max(0, w[i].start - 0.12) * 30) / 30)
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
# Caption words (2026-11-08): whisper timings, but the SCRIPT's spelling (whisper writes "algiers", "gassicki").
# Script tokens are aligned to whisper words by order; a script word whisper split or missed gets its neighbours' time.
words = []
script_p = d / "script.txt"
if script_p.exists():
    import difflib
    toks = re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-\.]*[A-Za-z0-9]?[.,?!:;]?|[A-Za-z0-9]", script_p.read_text())
    norm = lambda x: re.sub(r"[^a-z0-9]", "", x.lower())
    tn = [norm(t) for t in toks]
    sm = difflib.SequenceMatcher(None, tn, nw, autojunk=False)
    tm = [None] * len(toks)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1): tm[i1 + k] = (w[j1 + k].start, w[j1 + k].end)
        elif tag == "replace" and j2 > j1:          # e.g. "thirty-three" vs "33": spread the whisper span over the script tokens
            a, b = w[j1].start, w[j2 - 1].end
            for k in range(i2 - i1): tm[i1 + k] = (a + (b - a) * k / (i2 - i1), a + (b - a) * (k + 1) / (i2 - i1))
    for k in range(len(tm)):                         # fill gaps from neighbours
        if tm[k] is None:
            prev = next((tm[j] for j in range(k - 1, -1, -1) if tm[j]), (0.0, 0.0))
            nxt = next((tm[j] for j in range(k + 1, len(tm)) if tm[j]), (prev[1] + 0.3, prev[1] + 0.3))
            tm[k] = (prev[1], max(prev[1] + 0.05, nxt[0]))
    words = [{"t": t, "s": round(a, 3), "e": round(b, 3)} for t, (a, b) in zip(toks, tm)]
plan = {"source": st["source"], "week": st["week"], "voice": True, "voDur": None, "voFull": "full.mp3", "words": words, "scenes": scenes, "scores": st["scores"]}
(d / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False))
print(f"video {ends[-1]:.2f}s, voice ends {w[-1].end:.2f}s -> {d / 'plan.json'}")
sys.exit(1 if bad else 0)
