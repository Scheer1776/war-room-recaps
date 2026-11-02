#!/usr/bin/env python3
"""dering.py — remove the steady high-pitched ringing VoiceStudio (VoxCPM2) leaves in a take (owner, 2026-11-02:
"a high pitched ringing the whole way through"). Measured: a constant tone at exactly 6000 Hz (+ fainter lines at
9.6k / 12k / 13.2k / 15.8k / 18k), present even in the pauses, i.e. the model's vocoder, not the voice.

  python3 -I voice/dering.py <in.wav|mp3> <out.wav>          → finds every steady narrow tone and notches it
  python3 -I voice/dering.py --check <file>                   → just reports tones (exit 1 if any are left)

How: tones show up as narrow spectral lines in the QUIET frames (pauses), where speech can't explain them. Each steady line
(see tones()) gets a narrow notch (two stacked peaking EQs, ~60 Hz wide) —
speech is broadband, so a 60 Hz hole is inaudible, while the tone disappears. Run it on the raw take BEFORE prep.
"""
import sys, subprocess, tempfile, pathlib
import numpy as np

MIN_HZ, LINE_DB, PRESENT, MIN_LEVEL_DB = 1000, 6.0, 0.5, -65.0

def tones(path):
    """Steady narrow tones: bins that stick out >= 6 dB above their +-150 Hz surroundings in more than half of all frames.
    Speech harmonics move with the pitch, so they never stay on one bin; the vocoder's lines do (2026-11-02 take:
    6000, 15800, 15600, 12000, 7200, 13200, 9600, 4200, 16800, 10400 Hz — all multiples of 200 Hz)."""
    import librosa
    y, sr = librosa.load(path, sr=48000, mono=True)
    S = np.abs(librosa.stft(y, n_fft=16384, hop_length=2048)) ** 2
    fr = librosa.fft_frequencies(sr=sr, n_fft=16384); df = fr[1] - fr[0]
    db = 10 * np.log10(S + 1e-14)
    from scipy.ndimage import median_filter
    nb = median_filter(db, size=(2 * int(150 / df) + 1, 1), mode="nearest")   # median: a 60 Hz notch can't drag it down
    pres = ((db - nb) > LINE_DB).mean(1)
    total = S.sum()
    found = []
    for i in np.argsort(-pres):
        if pres[i] <= PRESENT: break
        if fr[i] < MIN_HZ or any(abs(fr[i] - f) < 30 for f, _ in found): continue
        lvl = 10 * np.log10(S[max(0, i - 2):i + 3].sum() / total + 1e-20)   # tone energy vs the whole track
        if lvl < MIN_LEVEL_DB: continue    # Remotion's AAC leaves an 18 kHz line at -75 dB (inaudible); the VoxCPM2 6 kHz whine was -34 dB
        found.append((round(float(fr[i])), round(float(lvl))))
    return sorted(found)

def dering(src, dst):
    lines = tones(src)
    af = ",".join(f"equalizer=f={f}:t=h:w=60:g=-40,equalizer=f={f}:t=h:w=20:g=-30" for f, _ in lines) or "anull"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", af, dst], check=True)
    return lines

if __name__ == "__main__":
    if sys.argv[1] == "--check":
        t = tones(sys.argv[2]); print("tones left:", t or "none"); sys.exit(1 if t else 0)
    src, dst = sys.argv[1], sys.argv[2]
    # up to 3 passes: a strong line can hide a weaker one right next to it (15600/15800 hid 15700 on 2026-11-02)
    done, cur, tmp = [], src, pathlib.Path(tempfile.mkdtemp())
    for n in range(3):
        out = str(tmp / f"p{n}.wav")
        got = dering(cur, out); done += got; cur = out
        if not got: break
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", cur, dst], check=True)
    print("notched:", sorted(f for f, _ in done) or "nothing"); left = tones(dst)
    print("tones left:", left or "none")
