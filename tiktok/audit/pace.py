#!/usr/bin/env python3
"""pace.py — give a voiceover natural spacing: real pauses between sentences and a longer beat before twists.

Two modes:
  Per-line clips (preferred; one VoiceStudio take per line):
    python3 -I audit/pace.py lines --lines public/<dir>/lines.json --clips public/<dir>/vo/raw --out public/<dir>/vo/full.wav
    lines.json is {"<key>": "<text>", ...} in order. Gap after a line: 0.30 s, or 0.65 s when the NEXT line starts
    a twist/verdict (its text starts with "..." or the key is in --twist). Clips are trimmed of edge silence first.
  One long take (when a whole script was rendered at once):
    python3 -I audit/pace.py take --take take.wav --script "the exact script" --out spaced.wav
    Finds every sentence end in the take with word timestamps and inserts silence: 0.28 s after ".", 0.32 s after "?"/"!",
    0.65 s where the script has "..." (the beat before the punchline).
Script markup understood in both modes: "..." = beat before what follows; "[pause]" = 0.5 s; "[long pause]" = 0.9 s.
Emotion lives in the words and the take, not here: write the line the way it should feel (short punchy sentences, a question,
"Obviously.") and render the punchline as its own clip so it gets its own delivery.
"""
import argparse, json, pathlib, re, subprocess, sys, tempfile

GAP_SENT, GAP_Q, GAP_BEAT, GAP_PAUSE, GAP_LONG = 0.28, 0.32, 0.65, 0.5, 0.9
SR = 44100

def run(cmd): subprocess.run(cmd, check=True)

def trim(src, dst):
    run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af",
         "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse",
         "-ar", str(SR), "-ac", "1", str(dst)])

def silence(sec, dst):
    run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{sec:.3f}", str(dst)])

def concat(parts, out):
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        for p in parts: f.write(f"file '{p}'\n")
        lst = f.name
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-ar", str(SR), "-ac", "1", str(out)])

def gap_after(text_now, text_next, twist):
    t = text_now.rstrip()
    if text_next is not None and (text_next.lstrip().startswith("...") or twist): return GAP_BEAT
    if t.endswith("[long pause]"): return GAP_LONG
    if t.endswith("[pause]"): return GAP_PAUSE
    if t.endswith("...") : return GAP_BEAT
    return GAP_Q if t.endswith(("?", "!")) else GAP_SENT

def mode_lines(a):
    lines = json.loads(pathlib.Path(a.lines).read_text())
    keys = list(lines); twist = set(a.twist or [])
    tmp = pathlib.Path(tempfile.mkdtemp()); parts = []
    for i, k in enumerate(keys):
        src = next((pathlib.Path(a.clips) / f"{k}{e}" for e in (".wav", ".mp3") if (pathlib.Path(a.clips) / f"{k}{e}").exists()), None)
        if not src: sys.exit(f"missing clip for {k}")
        t = tmp / f"{i:02d}.wav"; trim(src, t); parts.append(t)
        if i < len(keys) - 1:
            g = tmp / f"{i:02d}g.wav"; silence(gap_after(lines[k], lines[keys[i + 1]], keys[i + 1] in twist), g); parts.append(g)
    concat(parts, a.out); print("wrote", a.out)

def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower())

def mode_take(a):
    from faster_whisper import WhisperModel
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    words = [w for s in m.transcribe(a.take, beam_size=5, word_timestamps=True)[0] for w in s.words]
    # sentence ends in the script, with the gap each one needs
    script = a.script.replace("[long pause]", " ⟦L⟧ ").replace("[pause]", " ⟦P⟧ ")
    toks, ends = [], {}
    for raw in re.findall(r"\S+", script):
        if raw in ("⟦L⟧", "⟦P⟧"):
            if toks: ends[len(toks) - 1] = max(ends.get(len(toks) - 1, 0), GAP_LONG if raw == "⟦L⟧" else GAP_PAUSE)
            continue
        if raw.startswith("...") and toks: ends[len(toks) - 1] = GAP_BEAT
        n = norm(raw)
        if not n: continue
        toks.append(n)
        if raw.endswith("..."): ends[len(toks) - 1] = GAP_BEAT
        elif raw.endswith(("?", "!")): ends.setdefault(len(toks) - 1, GAP_Q)
        elif raw.endswith("."): ends.setdefault(len(toks) - 1, GAP_SENT)
    heard = [norm(w.word) for w in words]
    import difflib
    sm = difflib.SequenceMatcher(None, toks, heard, autojunk=False)
    s2h = {}
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        for k in range(i2 - i1): s2h[i1 + k] = j1 + min(k, max(0, j2 - j1 - 1)) if j2 > j1 else None
    cuts = []  # (time, gap)
    for si, g in sorted(ends.items()):
        hi = s2h.get(si)
        if hi is None or hi >= len(words) - 1: continue
        end, nxt = words[hi].end, words[hi + 1].start
        have = max(0.0, nxt - end)
        if have < g: cuts.append(((end + nxt) / 2, g - have))
    tmp = pathlib.Path(tempfile.mkdtemp()); parts = []; t0 = 0.0
    for i, (t, add) in enumerate(cuts):
        seg = tmp / f"{i:02d}.wav"
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-to", f"{t:.3f}", "-i", a.take, "-ar", str(SR), "-ac", "1", str(seg)])
        g = tmp / f"{i:02d}g.wav"; silence(add, g); parts += [seg, g]; t0 = t
    last = tmp / "last.wav"; run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-i", a.take, "-ar", str(SR), "-ac", "1", str(last)]); parts.append(last)
    concat(parts, a.out)
    print(f"wrote {a.out}: inserted {len(cuts)} pauses (" + ", ".join(f"{t:.1f}s+{g:.2f}" for t, g in cuts) + ")")

ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="mode", required=True)
l = sp.add_parser("lines"); l.add_argument("--lines", required=True); l.add_argument("--clips", required=True); l.add_argument("--out", required=True); l.add_argument("--twist", nargs="*")
t = sp.add_parser("take"); t.add_argument("--take", required=True); t.add_argument("--script", required=True); t.add_argument("--out", required=True)
a = ap.parse_args(); mode_lines(a) if a.mode == "lines" else mode_take(a)
