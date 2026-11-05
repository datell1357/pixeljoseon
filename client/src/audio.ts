// 소리는 전부 Web Audio로 합성한다. 외부 음원을 쓰지 않는다.
import { settings } from './store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(comp);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// 첫 입력 때 소리를 켠다 (브라우저 자동 재생 정책)
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => ensure(), { once: true, capture: true });
}

interface Tone {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  t: number;
  v: number;
  at?: number;
}

function tone(a: Tone) {
  const c = ctx!;
  const now = c.currentTime + (a.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = a.type ?? 'sine';
  o.frequency.setValueAtTime(a.f0, now);
  if (a.f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, a.f1), now + a.t);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(a.v, now + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, now + a.t);
  o.connect(g);
  g.connect(master!);
  o.start(now);
  o.stop(now + a.t + 0.02);
}

interface Noise {
  t: number;
  v: number;
  f0: number;
  f1?: number;
  q?: number;
  type?: BiquadFilterType;
  at?: number;
}

function noise(a: Noise) {
  const c = ctx!;
  const now = c.currentTime + (a.at ?? 0);
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = a.type ?? 'bandpass';
  f.Q.value = a.q ?? 1;
  f.frequency.setValueAtTime(a.f0, now);
  if (a.f1) f.frequency.exponentialRampToValueAtTime(a.f1, now + a.t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(a.v, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + a.t);
  s.connect(f);
  f.connect(g);
  g.connect(master!);
  s.start(now, Math.random() * 0.8);
  s.stop(now + a.t + 0.02);
}

const SFX: Record<string, () => void> = {
  slash: () => {
    noise({ t: 0.14, v: 0.32, f0: 5200, f1: 1200, q: 0.8 });
    tone({ type: 'triangle', f0: 720, f1: 260, t: 0.09, v: 0.06 });
  },
  slash2: () => {
    noise({ t: 0.22, v: 0.42, f0: 3400, f1: 500, q: 0.7 });
    tone({ type: 'sawtooth', f0: 380, f1: 90, t: 0.16, v: 0.08 });
  },
  hit: () => {
    noise({ t: 0.07, v: 0.4, f0: 1500, f1: 500, q: 0.6 });
    tone({ type: 'square', f0: 190, f1: 70, t: 0.08, v: 0.13 });
  },
  crit: () => {
    noise({ t: 0.14, v: 0.5, f0: 2600, f1: 500, q: 0.5 });
    tone({ type: 'square', f0: 240, f1: 60, t: 0.14, v: 0.16 });
    tone({ type: 'triangle', f0: 1500, f1: 820, t: 0.14, v: 0.09, at: 0.02 });
  },
  hurt: () => {
    tone({ type: 'sawtooth', f0: 170, f1: 70, t: 0.18, v: 0.18 });
    noise({ t: 0.12, v: 0.28, f0: 700, f1: 260, q: 0.7 });
  },
  death: () => {
    tone({ type: 'sawtooth', f0: 240, f1: 40, t: 0.7, v: 0.2 });
    noise({ t: 0.6, v: 0.2, f0: 900, f1: 120, q: 0.6 });
  },
  mdeath: () => {
    noise({ t: 0.2, v: 0.22, f0: 1200, f1: 240, q: 0.6 });
    tone({ type: 'triangle', f0: 260, f1: 80, t: 0.2, v: 0.1 });
  },
  arrow: () => {
    noise({ t: 0.1, v: 0.2, f0: 6400, f1: 2400, q: 2 });
    tone({ type: 'triangle', f0: 900, f1: 400, t: 0.06, v: 0.05 });
  },
  orb: () => {
    tone({ type: 'sine', f0: 880, f1: 340, t: 0.16, v: 0.12 });
    tone({ type: 'triangle', f0: 1760, f1: 680, t: 0.1, v: 0.05 });
  },
  fire: () => {
    noise({ t: 0.32, v: 0.36, f0: 800, f1: 300, q: 0.5, type: 'lowpass' });
    tone({ type: 'sawtooth', f0: 200, f1: 70, t: 0.26, v: 0.12 });
  },
  boom: () => {
    noise({ t: 0.5, v: 0.6, f0: 900, f1: 90, q: 0.4, type: 'lowpass' });
    tone({ type: 'sine', f0: 120, f1: 32, t: 0.5, v: 0.4 });
  },
  ice: () => {
    noise({ t: 0.32, v: 0.22, f0: 7000, f1: 2600, q: 3 });
    tone({ type: 'sine', f0: 1800, f1: 2600, t: 0.2, v: 0.05 });
  },
  whirl: () => {
    noise({ t: 0.42, v: 0.32, f0: 1200, f1: 4200, q: 1.2 });
  },
  dodge: () => {
    noise({ t: 0.18, v: 0.2, f0: 1600, f1: 500, q: 0.8 });
  },
  blink: () => {
    tone({ type: 'sine', f0: 600, f1: 2200, t: 0.14, v: 0.12 });
    tone({ type: 'triangle', f0: 1400, f1: 300, t: 0.14, v: 0.06, at: 0.05 });
  },
  guard: () => {
    tone({ type: 'square', f0: 900, f1: 560, t: 0.05, v: 0.08 });
  },
  parry: () => {
    tone({ type: 'triangle', f0: 2200, f1: 1500, t: 0.28, v: 0.22 });
    tone({ type: 'sine', f0: 3300, f1: 2800, t: 0.34, v: 0.08 });
    noise({ t: 0.06, v: 0.28, f0: 4000, q: 1 });
  },
  warn: () => {
    tone({ type: 'sine', f0: 240, f1: 300, t: 0.12, v: 0.05 });
  },
  buff: () => {
    [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, t: 0.24, v: 0.08, at: i * 0.06 }));
  },
  levelup: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, t: 0.42, v: 0.14, at: i * 0.09 }));
    tone({ type: 'sine', f0: 1568, t: 0.6, v: 0.05, at: 0.36 });
  },
  coin: () => {
    tone({ type: 'square', f0: 1320, t: 0.05, v: 0.05 });
    tone({ type: 'square', f0: 1760, t: 0.1, v: 0.05, at: 0.05 });
  },
  pickup: () => {
    tone({ type: 'triangle', f0: 660, f1: 990, t: 0.1, v: 0.09 });
  },
  equip: () => {
    noise({ t: 0.06, v: 0.2, f0: 3000, q: 1.5 });
    tone({ type: 'square', f0: 480, f1: 340, t: 0.07, v: 0.05 });
  },
  quest: () => {
    tone({ type: 'triangle', f0: 587, t: 0.14, v: 0.1 });
    tone({ type: 'triangle', f0: 880, t: 0.22, v: 0.1, at: 0.1 });
  },
  forge: () => {
    tone({ type: 'square', f0: 1200, f1: 700, t: 0.1, v: 0.1 });
    noise({ t: 0.12, v: 0.2, f0: 5000, q: 2 });
  },
  click: () => {
    tone({ type: 'square', f0: 700, f1: 500, t: 0.03, v: 0.03 });
  },
  deny: () => {
    tone({ type: 'square', f0: 180, f1: 150, t: 0.1, v: 0.06 });
  },
  door: () => {
    tone({ type: 'sine', f0: 300, f1: 900, t: 0.4, v: 0.1 });
    noise({ t: 0.4, v: 0.1, f0: 800, f1: 3000, q: 1 });
  },
  roar: () => {
    tone({ type: 'sawtooth', f0: 110, f1: 62, t: 0.9, v: 0.24 });
    noise({ t: 0.8, v: 0.22, f0: 500, f1: 180, q: 0.8 });
  },
};

const lastPlayed = new Map<string, number>();

export function sfx(id: string) {
  const c = ensure();
  const vol = settings.value.sfx;
  if (!c || !master || vol <= 0 || c.state !== 'running') return;
  const now = performance.now();
  if (now - (lastPlayed.get(id) ?? 0) < 35) return;
  lastPlayed.set(id, now);
  master.gain.value = vol;
  SFX[id]?.();
}

// ─── 배경 음악: 지도별 음계로 천천히 흐르는 합성 음악 ─────────

interface Track {
  scale: number[];
  root: number;
  beat: number;
  pad: OscillatorType;
  lead: OscillatorType;
  density: number;
}

const TRACKS: Record<string, Track> = {
  town: { scale: [0, 2, 4, 7, 9], root: 220, beat: 0.62, pad: 'triangle', lead: 'triangle', density: 0.55 },
  forest: { scale: [0, 3, 5, 7, 10], root: 196, beat: 0.8, pad: 'sine', lead: 'triangle', density: 0.38 },
  ash: { scale: [0, 1, 5, 7, 8], root: 146.8, beat: 0.92, pad: 'sawtooth', lead: 'sine', density: 0.3 },
  dungeon: { scale: [0, 1, 3, 7, 8], root: 110, beat: 1.05, pad: 'sawtooth', lead: 'sine', density: 0.26 },
  rift: { scale: [0, 2, 3, 6, 9], root: 130.8, beat: 0.72, pad: 'sine', lead: 'square', density: 0.34 },
};

let musicTimer: ReturnType<typeof setTimeout> | null = null;
let currentTrack = '';
let step = 0;

export function playMusic(name: string) {
  if (name === currentTrack) return;
  currentTrack = name;
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
  step = 0;
  if (name) musicLoop();
}

function musicLoop() {
  const tr = TRACKS[currentTrack];
  if (!tr) return;
  const c = ensure();
  if (c && c.state === 'running' && musicGain) {
    const vol = settings.value.music * 0.5;
    musicGain.gain.setTargetAtTime(vol, c.currentTime, 0.4);
    if (vol > 0) {
      const now = c.currentTime;
      const note = (deg: number, oct: number) => tr.root * Math.pow(2, oct + (tr.scale[deg % tr.scale.length] + 12 * Math.floor(deg / tr.scale.length)) / 12);
      if (step % 8 === 0) {
        const chord = [0, 2, 4].map((d) => d + [0, 3, 1, 4][(step / 8) % 4 | 0]);
        for (const d of chord) {
          const o = c.createOscillator();
          const g = c.createGain();
          const f = c.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 620;
          o.type = tr.pad;
          o.frequency.value = note(d, -1);
          const dur = tr.beat * 8;
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.05, now + dur * 0.3);
          g.gain.linearRampToValueAtTime(0.0001, now + dur);
          o.connect(f);
          f.connect(g);
          g.connect(musicGain);
          o.start(now);
          o.stop(now + dur + 0.1);
        }
      }
      if (Math.random() < tr.density) {
        const d = Math.floor(Math.random() * tr.scale.length * 2);
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = tr.lead;
        o.frequency.value = note(d, 1);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + tr.beat * 2.4);
        o.connect(g);
        g.connect(musicGain);
        o.start(now);
        o.stop(now + tr.beat * 2.5);
      }
    }
  }
  step++;
  musicTimer = setTimeout(musicLoop, tr.beat * 1000);
}
