#!/usr/bin/env python3
"""pronounce.py — did the voice actually SAY each name right? (added 2026-11-01 after "Allgeier" passed a spelling check
and was pronounced wrong). Whisper only tells you how a name might be spelled; this listens to the sounds.

  python3 -I audit/pronounce.py <voice.wav|mp3|mp4> "<exact script>"      → per-name report, exit 1 on any FAIL

How: whisper word timestamps find each name in the audio → that slice goes through a phoneme recognizer
(facebook/wav2vec2-lv-60-espeak-cv-ft, IPA out) → compared with the correct pronunciation in voice/names.json
("ipa", space-separated phones, plus optional "alt" variants) by phonetic-feature edit distance (panphon).
A name in the script with no "ipa" on file FAILS: add it (from a reliable source) before the video ships.
names.json "pronounce" entries: {"Allgeier": {"ipa": "æ l ɡ aɪ ɚ", "say": "Al-guy-er", "note": "AL-guy-er"}}
"say" is the respelling to type into VoiceStudio when the plain spelling comes out wrong.
"""
import json, pathlib, re, subprocess, sys, tempfile
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
NAMES = json.loads((HERE.parent / "voice" / "names.json").read_text()).get("pronounce", {})
# voice/pronounce-bank.json: sourced readings for every name token of the top ~300 fantasy players (2026-11-02).
# names.json wins on a clash (hand-checked entries); tokens in the bank's "_unsourced" list stay missing → they FAIL until sourced.
_bank = HERE.parent / "voice" / "pronounce-bank.json"
if _bank.exists():
    for _k, _v in json.loads(_bank.read_text()).items():
        if not _k.startswith("_") and isinstance(_v, dict) and _v.get("ipa"): NAMES.setdefault(_k, _v)
MODEL = "facebook/wav2vec2-lv-60-espeak-cv-ft"
WARN_D, FAIL_D = 0.09, 0.15   # cost per target phone. Calibrated 2026-11-01: 13 good names <= 0.06, the wrong "AL-guy-er" Allgeier = 0.19

def norm_ipa(s):
    s = re.sub(r"[0-9.ˈˌːˑ]", "", s)                      # tones/lengths/stress from the multilingual vocab
    s = s.replace("ɚ", "ə ɹ").replace("ɝ", "ɜ ɹ").replace("ɐ", "ə").replace("ᵻ", "ɪ").replace("ɾ", "t").replace("ʔ", "")
    s = s.replace("g", "ɡ").replace("r", "ɹ")
    for a, b in (("oʊ", "o ʊ"), ("ou", "o ʊ"), ("aɪ", "a ɪ"), ("ai", "a ɪ"), ("eɪ", "e ɪ"), ("ei", "e ɪ"), ("aʊ", "a ʊ"),
                 ("au", "a ʊ"), ("ɔɪ", "ɔ ɪ"), ("ɑu", "ɑ ʊ"), ("tʃ", "t ʃ"), ("dʒ", "d ʒ"), ("ts", "t s"), ("əl", "ə l"), ("ɪə", "ɪ ə"), ("ɪɹ", "ɪ ɹ"), ("ɛɹ", "ɛ ɹ"), ("ʊɹ", "ʊ ɹ"), ("ɑɹ", "ɑ ɹ"), ("ɔɹ", "ɔ ɹ"), ("aɪɚ", "a ɪ ə ɹ")):
        s = s.replace(a, b)
    return [p for p in s.split() if p]

_ft = None
def sub(a, b):
    """0..1 phonetic difference between two single phones (panphon features)."""
    global _ft
    import panphon.distance
    _ft = _ft or panphon.distance.Distance()
    if a == b: return 0.0
    # Connected speech, not mispronunciation: dark/vocalized L ("Mitchell"→[mɪtʃəʊ]), and /æ/ before dark L heard as [aʊ]
    if {a, b} <= {"l", "ʊ", "o"} and "l" in (a, b): return 0.2
    if {a, b} <= {"æ", "a"}: return 0.15
    try: return min(1.0, _ft.feature_edit_distance(a, b) * 2.5)
    except Exception: return 1.0

def fit(target, window):
    """Semi-global alignment: the whole target must align somewhere inside the window (free skips at the window's ends).
    Returns cost per target phone (0 = identical, ~1 = nothing alike)."""
    n, m = len(target), len(window)
    if not n: return 0.0
    if not m: return 1.0
    INS = 0.8
    # a word-final consonant that blends into the next word ("Jacksonvi(lle) won") costs less than a missing core sound
    dele = lambda i: 0.35 if i == n and target[i - 1] not in "aeiouæɑɔəɛɪʊʌɜ" else 0.8
    D = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1): D[i][0] = D[i - 1][0] + dele(i)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i][j] = min(D[i - 1][j - 1] + sub(target[i - 1], window[j - 1]), D[i - 1][j] + dele(i), D[i][j - 1] + INS)
    return min(D[n][j] for j in range(m + 1)) / n

_rec = None
def track_phones(wav):
    """Every phone in the file with its time: [(t_seconds, phone)]. One pass over the whole track (no word slicing)."""
    global _rec
    import torch, librosa, json as _j
    from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC
    from huggingface_hub import hf_hub_download
    if _rec is None:
        vocab = _j.load(open(hf_hub_download(MODEL, "vocab.json")))
        _rec = (Wav2Vec2FeatureExtractor.from_pretrained(MODEL), Wav2Vec2ForCTC.from_pretrained(MODEL).eval(), {v: k for k, v in vocab.items()})
    fe, model, inv = _rec
    y, sr = librosa.load(wav, sr=16000)
    out = []
    for c0 in range(0, len(y), 16000 * 20):                 # 20 s chunks with 1 s overlap
        seg = y[max(0, c0 - 16000):c0 + 16000 * 20]
        off = max(0, c0 - 16000) / 16000
        with torch.no_grad():
            ids = model(fe(seg, sampling_rate=16000, return_tensors="pt").input_values).logits.argmax(-1)[0].tolist()
        step = len(seg) / 16000 / len(ids); prev = None
        for k, i in enumerate(ids):
            if i != prev:
                tok = inv.get(i, "")
                if tok and not tok.startswith("<") and tok not in ("|", "[PAD]", "[UNK]"):
                    t = off + k * step
                    if not out or t > out[-1][0] + 1e-3:
                        for ph in norm_ipa(tok): out.append((t, ph))
            prev = i
    return out

def words_of(wav):
    from faster_whisper import WhisperModel
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    return [w for s in m.transcribe(wav, beam_size=5, word_timestamps=True)[0] for w in s.words]

def names_in(script):
    """Every name-like word (capitalised, not sentence-initial) plus known names anywhere."""
    found = set(re.findall(r"(?<![.?!]\s)(?<!^)\b[A-Z][a-zA-Z'\-]+", script))
    found |= {n for n in NAMES if re.search(rf"\b{re.escape(n)}\b", script)}
    skip = {"Bay", "City", "England", "Kansas", "New", "Green", "York", "Los", "Angeles", "Las", "Vegas", "Tampa", "San", "Francisco", "Orleans", "Jersey", "Madrid", "War", "Room", "Sunday", "Wednesday", "Tonight", "Here", "Every", "Did", "Check", "Monday", "Thursday", "PPR", "ESPN", "Sleeper", "OT", "NFL", "So", "And", "He", "Find"}
    # a token that only appears inside a longer hyphenated name ("Smith" in "Smith-Njigba") is checked as that name
    found = {n for n in found if not any(n != m and "-" in m and n in m.split("-") and not re.search(rf"\b{re.escape(n)}\b(?!-)(?<!-{re.escape(n)})", script.replace(m, "")) for m in found)}
    return sorted(n for n in found if n not in skip)

def check(wav, script, words=None):
    """Returns [(name, status, msg)]. wav: a .wav/.mp3/.mp4 with the voice."""
    if str(wav).lower().endswith((".mp4", ".mov", ".mp3")):
        w2 = pathlib.Path(tempfile.mkdtemp()) / "v.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-vn", "-ac", "1", "-ar", "16000", str(w2)], check=True); wav = str(w2)
    words = words or words_of(wav)
    tp = track_phones(wav)
    norm = lambda w: re.sub(r"[^a-z]", "", w.lower())
    out = []
    script_names = names_in(script)
    order = [norm(t) for t in re.findall(r"[A-Za-z'\-]+", script)]
    for name in script_names:
        ref = NAMES.get(name)
        if not ref or not ref.get("ipa"):
            out.append((name, "FAIL", "no pronunciation on file: add {\"ipa\": ..., \"say\": ...} to voice/names.json")); continue
        # locate: the transcript word aligned to the name's position in the script (spelling-agnostic: by order)
        idx = [i for i, t in enumerate(order) if t == norm(name)]
        hits = []
        import difflib
        hw = [norm(w.word) for w in words]
        sm = difflib.SequenceMatcher(None, order, hw, autojunk=False)
        s2h = {}
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            for k in range(i2 - i1): s2h[i1 + k] = (j1 + min(k, j2 - j1 - 1)) if j2 > j1 else None
        for i in idx:
            h = s2h.get(i)
            if h is not None: hits.append(words[h])
        if not hits:
            out.append((name, "FAIL", "could not find the name in the audio")); continue
        targets = [norm_ipa(ref["ipa"])] + [norm_ipa(x) for x in ref.get("alt", [])]
        wrongs = [norm_ipa(x) for x in ref.get("wrong", [])]
        for w in hits:
            # long or hyphenated names (Smith-Njigba) can span several transcript words: widen the window by the name length
            win = [ph for t, ph in tp if w.start - 0.35 <= t <= w.end + 0.35 + 0.06 * max(0, len(targets[0]) - 5)]
            good = min(fit(t, win) for t in targets)
            bad = min([fit(x, win) for x in wrongs] or [9])
            heard = " ".join(win)
            if bad + 0.02 < good: st, why = "FAIL", f"sounds like a known WRONG version (wrong {bad:.2f} < right {good:.2f})"
            elif good > FAIL_D: st, why = "FAIL", f"too far from the right pronunciation ({good:.2f})"
            elif good > WARN_D: st, why = "WARN", f"close-ish ({good:.2f}); listen to it"
            else: st, why = "PASS", f"{good:.2f}"
            out.append((name, st, f"at {w.start:.2f}s: {why}. Heard around it: /{heard}/; right: /{ref['ipa']}/ {ref.get('note', '')}"))
    return out

if __name__ == "__main__":
    res = check(sys.argv[1], sys.argv[2])
    for n, st, msg in res: print(f"[{st:4}] {n}: {msg}")
    sys.exit(1 if any(st == "FAIL" for _, st, _ in res) else 0)
