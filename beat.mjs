// Synthesizes an original drum + bass loop as a 16-bit stereo WAV. Same idea as the
// in-app recap's beat: kick, clap, hi-hats and a triangle bass. Deterministic (seeded noise).
import { writeFileSync } from "node:fs";

export function writeBeat(path, seconds, { bpm = 112, rate = 44100 } = {}) {
  const n = Math.ceil(seconds * rate), L = new Float32Array(n), R = new Float32Array(n);
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
  const beat = 60 / bpm;
  const addTone = (t0, dur, fn, gain, pan = 0) => {
    const s0 = Math.floor(t0 * rate), s1 = Math.min(n, s0 + Math.floor(dur * rate));
    for (let i = s0; i < s1; i++) { const t = (i - s0) / rate; const v = fn(t) * gain; L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); }
  };
  const kick = t0 => { let ph = 0; addTone(t0, .32, t => { const f = 40 + 100 * Math.exp(-t * 18); ph += 2 * Math.PI * f / rate; return Math.sin(ph) * Math.exp(-t * 9); }, .9); };
  const clap = t0 => { let lp = 0; addTone(t0, .18, t => { const x = rnd(); lp += .35 * (x - lp); return (x - lp) * Math.exp(-t * 22); }, .5); };
  const hat = (t0, v, pan) => { let prev = 0; addTone(t0, .06, t => { const x = rnd(); const y = x - prev; prev = x; return y * Math.exp(-t * 70); }, v, pan); };
  const bass = (t0, hz) => addTone(t0, beat * .9, t => { const p = (t * hz) % 1; return (p < .5 ? 4 * p - 1 : 3 - 4 * p) * Math.exp(-t * 2.5); }, .32);
  const notes = [55, 55, 65.41, 49];
  const total = Math.floor(seconds / beat);
  for (let i = 0; i < total; i++) {
    const t = i * beat;
    if (i % 4 === 0 || i % 4 === 2) kick(t);
    if (i % 4 === 1 || i % 4 === 3) clap(t);
    hat(t, .22, -.3); hat(t + beat / 2, .14, .3);
    if (i % 2 === 0) bass(t, notes[Math.floor(i / 8) % notes.length]);
  }
  // Fade out the last 1.5 s and soft-clip.
  const fade = Math.floor(1.5 * rate);
  const buf = Buffer.alloc(44 + n * 4);
  for (let i = 0; i < n; i++) {
    const g = i > n - fade ? (n - i) / fade : 1;
    const l = Math.tanh(L[i] * g * .9), r = Math.tanh(R[i] * g * .9);
    buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
  }
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  writeFileSync(path, buf);
}
