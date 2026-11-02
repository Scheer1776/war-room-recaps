#!/usr/bin/env python3
"""audit.py — automatic edit QA for a rendered War Room video. Run it on every render before delivering.

  python3 -I audit/audit.py audit/manifests/<name>.json      → prints a report, writes <video>.audit.json + .audit.png,
                                                               exits 1 if anything FAILs (fix, re-render, re-audit)
Manifest (JSON):
{
  "video": "out/henry-hype.mp4",
  "audio": "voice" | "music" | "silent",           # what the soundtrack should be
  "vo": "public/hype/vo/full.wav",                    # optional: the voice track before mixing (pause + name checks)
  "script": "You draft a thirty-two-year-old...",     # optional: exact script (pause + name checks)
  "names": ["Derrick Henry", "Cole Bishop"],          # optional: names that must be heard (extra to capitalised script words)
  "clips": [{ "src": "public/hype/henry-stiffarm-916.mp4", "at": 3.0, "dur": 5.0,
              "clipStart": 0.0, "keyAt": 2.15, "label": "stiff-arm" }],
                       # at/dur = where the clip sits in the video (s); clipStart = s into the clip it should start from;
                       # keyAt = s into the clip where the big moment happens (find it with a timestamped contact sheet)
                       # band = optional [top, bottom] fraction of the frame to compare, when cards/big type cover the middle
  "endCard": 3.5                                      # seconds the QR/app link must be on screen at the end
}
Checks
  CLIP SYNC   the rendered frames really show the clip from clipStart (finds the true offset by matching frames; >0.25 s off = FAIL)
  CLIP MOMENT the key moment plays inside its window with >= 0.8 s of lead-in and >= 1.0 s after it (else FAIL)
  VOICE PACE  a beat before every "..." (>= 0.45 s), nothing dead > 1.6 s,
              130-270 words/min (FAIL on missing beats, WARN on short sentence gaps)
  NAMES       every name is PRONOUNCED right: phonemes heard vs voice/names.json (audit/pronounce.py; missing entry = FAIL)
  VOICE SPLICES no digital-silence runs inside the speech (inserted pauses sound choppy; record one natural take)
  END CARD    the QR code decodes in frames across the last `endCard` seconds (FAIL)
  AUDIO       soundtrack present/absent as declared, no clipping (peak < -0.3 dBFS)
"""
import json, pathlib, re, subprocess, sys
import numpy as np, cv2

def ffprobe_dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip() or 0)

def frame_at(cap, t, fps):
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(round(t * fps))))
    ok, f = cap.read()
    return f if ok else None

def sig(img, band=(0.22, 0.78)):  # small grayscale signature of the clip region (the action area), zero-mean, unit-norm
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = g.shape
    g = g[int(h * band[0]):int(h * band[1]), :]    # band: where the clip shows, away from captions/cards (manifest "band")
    g = cv2.resize(g, (48, 48), interpolation=cv2.INTER_AREA).astype(np.float32)
    g -= g.mean(); n = np.linalg.norm(g)
    return g / n if n else g

res = []
def add(check, status, msg): res.append({"check": check, "status": status, "msg": msg}); print(f"[{status:4}] {check}: {msg}")

def check_clip(video, c):
    vcap, ccap = cv2.VideoCapture(str(video)), cv2.VideoCapture(str(c["src"]))
    vf, cf = vcap.get(cv2.CAP_PROP_FPS), ccap.get(cv2.CAP_PROP_FPS)
    clen = ccap.get(cv2.CAP_PROP_FRAME_COUNT) / cf
    cache = {}; band = tuple(c.get("band", (0.22, 0.78)))
    ZOOMS = (1.0, 1.04, 1.08, 1.12, 1.16)   # compositions slowly zoom clips (Ken Burns): zoom the CLIP frame to match
    def zoom(f, z):
        h0, w0 = f.shape[:2]; ch, cw = int(h0 / z), int(w0 / z); y0, x0 = (h0 - ch) // 2, (w0 - cw) // 2
        return cv2.resize(f[y0:y0 + ch, x0:x0 + cw], (w0, h0))
    def csig(t):
        k = round(t, 2)
        if k not in cache:
            f = frame_at(ccap, t, cf); cache[k] = [sig(zoom(f, z), band) for z in ZOOMS] if f is not None else None
        return cache[k]
    offsets = []
    for u in np.linspace(0.3, c["dur"] - 0.3, 6):
        f = frame_at(vcap, c["at"] + u, vf)
        if f is None: continue
        sv = sig(f, band)
        best, bt = -2, None
        for t in np.arange(0, clen, 1 / 15):
            cs = csig(t)
            if cs is None: continue
            v = max(float((sv * c_) .sum()) for c_ in cs)
            if v > best: best, bt = v, t
        if bt is not None and best > 0.5: offsets.append(bt - u)
    lab = c.get("label", c["src"])
    if not offsets:
        add("CLIP SYNC", "FAIL", f"{lab}: the clip is not visible in its window ({c['at']:.1f}-{c['at'] + c['dur']:.1f}s)"); return
    off = float(np.median(offsets)); err = off - c.get("clipStart", 0)
    if abs(err) > 0.25:
        add("CLIP SYNC", "FAIL", f"{lab}: plays from {off:.2f}s into the clip, should start at {c.get('clipStart', 0):.2f}s ({err:+.2f}s off)")
    else:
        add("CLIP SYNC", "PASS", f"{lab}: starts at {off:.2f}s into the clip (expected {c.get('clipStart', 0):.2f}s)")
    if "keyAt" in c:
        key_t = c["keyAt"] - off            # when the moment happens, relative to the window start
        lead, tail = key_t, c["dur"] - key_t
        mb = c.get("minBefore", 0.8)   # a deliberately short scene (< 2 s) may set 0.6 in its manifest entry
        st = "PASS" if lead >= mb and tail >= 1.0 else "FAIL"
        add("CLIP MOMENT", st, f"{lab}: key moment at {c['at'] + key_t:.2f}s in the video, {lead:.2f}s of lead-in, {tail:.2f}s after (need >= {mb} / 1.0)")

def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower())

def check_voice(vo, script, names):
    from faster_whisper import WhisperModel
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, info = m.transcribe(str(vo), beam_size=5, word_timestamps=True)
    words = [w for s in segs for w in s.words]
    if not words: add("VOICE PACE", "FAIL", "no speech found"); return
    heard = " ".join(norm(w.word) for w in words)
    # NAMES
    want = set(names)
    if script:
        want |= {w for w in re.findall(r"(?<![.?!]\s)(?<!^)\b[A-Z][a-zA-Z'\-]+(?:\s[A-Z][a-zA-Z'\-]+)*", script)}
    # NAMES (2026-11-01, after a wrong "Allgeier" passed a spelling-based check): listen to the SOUNDS of every name with a
    # phoneme recognizer and compare with the sourced pronunciation in voice/names.json (audit/pronounce.py). A name with no
    # pronunciation on file fails, so every new name gets looked up before it ships. Whisper spelling is never the test.
    if script:
        sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
        import pronounce
        for n, st, msg in pronounce.check(str(vo), script, words):
            add("NAMES", st, f"{n}: {msg}")
    else:
        add("NAMES", "WARN", "no script given: pronunciation not checked")
    # PACE
    speak = sum(w.end - w.start for w in words); wpm = len(words) / max(0.1, words[-1].end - words[0].start) * 60
    gaps = [(words[i + 1].start - words[i].end, i) for i in range(len(words) - 1)]
    dead = [g for g, _ in gaps if g > 1.6]
    if not script:
        add("VOICE PACE", "WARN" if dead else "PASS", f"{wpm:.0f} wpm, {sum(g >= 0.18 for g, _ in gaps)} pauses, {len(dead)} dead spots > 1.6s (no script given, beats not checked)"); return
    import difflib
    toks, need = [], {}
    for raw in re.findall(r"\S+", script.replace("[pause]", " ⟦P⟧ ").replace("[long pause]", " ⟦P⟧ ")):
        if raw == "⟦P⟧":
            if toks: need[len(toks) - 1] = 0.45
            continue
        if raw.startswith("...") and toks: need[len(toks) - 1] = 0.45
        n = norm(raw)
        if not n: continue
        toks.append(n)
        if raw.endswith("..."): need[len(toks) - 1] = 0.45
        elif raw.endswith((".", "?", "!")): need.setdefault(len(toks) - 1, 0.18)
    hw = [norm(w.word) for w in words]
    s2h = {}
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, toks, hw, autojunk=False).get_opcodes():
        for k in range(i2 - i1): s2h[i1 + k] = (j1 + min(k, j2 - j1 - 1)) if j2 > j1 else None
    # measure real silence from the waveform (whisper's word edges smear over inserted silence)
    import librosa, tempfile
    wav = vo
    if str(vo).lower().endswith((".mp4", ".mov", ".webm", ".mkv")):
        wav = pathlib.Path(tempfile.mkdtemp()) / "vo.wav"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vo), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
    y, sr = librosa.load(str(wav), sr=16000); hop = 160
    db = 20 * np.log10(librosa.feature.rms(y=y, frame_length=400, hop_length=hop)[0] + 1e-9)
    floor = np.percentile(db, 20); thr = max(floor + 8, db.max() - 38)
    def longest_quiet(t0, t1):
        a, b = int(t0 * sr / hop), int(t1 * sr / hop); q = db[a:b] < thr
        best = run = 0
        for v in q: run = run + 1 if v else 0; best = max(best, run)
        return best * hop / sr
    short_beats, short_sent = [], []
    for si, g in sorted(need.items()):
        hi = s2h.get(si)
        if hi is None or hi >= len(words) - 1: continue
        have = longest_quiet(words[hi].start + 0.05, words[hi + 1].end)
        if have + 1e-3 < g: (short_beats if g >= 0.45 else short_sent).append(f"after '{words[hi].word.strip()}' {have:.2f}s")
    # Spliced silence (2026-11-01: the owner heard the inserted gaps as "choppy, weird pauses"): exact-zero runs inside
    # the speech are edits, not delivery. Natural pauses keep breath and room tone, so they are never digital zero.
    import soundfile as _sf
    yy, ssr = librosa.load(str(wav), sr=16000)
    a0, a1 = int(words[0].end * ssr), int(words[-1].start * ssr)   # between the first and last word: lead-in/tail padding is fine
    z = np.abs(yy[a0:a1]) < 1e-5; runs = []; rn = 0
    for i, v in enumerate(z):
        if v: rn += 1
        else:
            if rn > 0.04 * ssr: runs.append(round((a0 + i - rn) / ssr, 2))
            rn = 0
    if runs: add("VOICE SPLICES", "FAIL", f"{len(runs)} spliced digital-silence gaps inside the speech at {runs[:6]}s: re-record as one take instead of inserting pauses")
    else: add("VOICE SPLICES", "PASS", "no spliced silence inside the speech (natural pauses only)")
    short_sent = []   # sentence-gap length is no longer judged: one natural take sets its own rhythm (owner, 2026-11-01)
    st = "FAIL" if short_beats or dead or not (130 <= wpm <= 270) else "PASS"
    msg = f"{wpm:.0f} wpm; beats before twists: {'OK' if not short_beats else 'MISSING ' + '; '.join(short_beats)}"
    msg += f"; sentence gaps: {'OK' if not short_sent else str(len(short_sent)) + ' too short (' + '; '.join(short_sent[:4]) + ')'}"
    if dead: msg += f"; {len(dead)} dead spots > 1.6s"
    add("VOICE PACE", st, msg)

def check_endcard(video, secs):
    cap = cv2.VideoCapture(str(video)); fps = cap.get(cv2.CAP_PROP_FPS); dur = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
    det = cv2.QRCodeDetector(); hits = []
    for t in np.linspace(dur - secs, dur - 0.1, 7):
        f = frame_at(cap, t, fps)
        txt = det.detectAndDecode(f)[0] if f is not None else ""
        hits.append(bool(txt))
    first = next((i for i, h in enumerate(hits) if h), None)
    ok = all(hits)
    add("END CARD", "PASS" if ok else "FAIL", f"QR decodes in {sum(hits)}/7 frames across the last {secs:.1f}s" + ("" if ok else " (on screen too short or unreadable)"))

def check_audio(video, kind):
    has = "audio" in subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(video)], capture_output=True, text=True).stdout
    if kind == "silent":
        add("AUDIO", "PASS" if not has else "FAIL", "silent as declared" if not has else "has an audio track but should be silent"); return
    if not has: add("AUDIO", "FAIL", f"no audio track (expected {kind})"); return
    out = subprocess.run(["ffmpeg", "-i", str(video), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    mean = float(re.search(r"mean_volume: (-?[\d.]+)", out).group(1)); peak = float(re.search(r"max_volume: (-?[\d.]+)", out).group(1))
    st = "FAIL" if mean < -40 or peak > -0.3 else "PASS"
    add("AUDIO", st, f"{kind}: mean {mean:.1f} dB, peak {peak:.1f} dB" + (" (near silent)" if mean < -40 else "") + (" (clipping)" if peak > -0.3 else ""))

def contact_sheet(video, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", "fps=1,scale=180:-1,tile=10x4", "-frames:v", "1", str(out)])

if __name__ == "__main__":
    mf = pathlib.Path(sys.argv[1]); m = json.loads(mf.read_text()); base = pathlib.Path.cwd()
    video = base / m["video"]; print(f"AUDIT {video.name} ({ffprobe_dur(video):.1f}s)")
    for c in m.get("clips", []): c["src"] = str(base / c["src"]); check_clip(video, c)
    if m.get("vo") or (m.get("audio") == "voice"):
        check_voice(base / m["vo"] if m.get("vo") else video, m.get("script"), m.get("names", []))
    if m.get("endCard"): check_endcard(video, m["endCard"])
    check_audio(video, m.get("audio", "music"))
    contact_sheet(video, video.with_suffix(".audit.png"))
    fails = [r for r in res if r["status"] == "FAIL"]
    video.with_suffix(".audit.json").write_text(json.dumps({"video": m["video"], "pass": not fails, "results": res}, indent=1))
    print(f"\n{'PASS' if not fails else 'FAIL'}: {len(fails)} failing, {sum(r['status'] == 'WARN' for r in res)} warnings. Contact sheet: {video.with_suffix('.audit.png').name}")
    sys.exit(1 if fails else 0)
