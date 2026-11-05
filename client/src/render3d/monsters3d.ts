// 몬스터와 보스. 뼈대와 동작은 기존 것을 쓰고, 겉모습만 새로 짓는다.
import * as THREE from 'three';
import { BOSSES } from '@bake/bosses.js';
import { MONSTERS } from '@bake/monsters.js';
import type { BuiltRig, CharAsset } from './chars';
import { Geo, mix, rng, tone, v3, type Hex } from './geo';

class MB {
  g = new Geo();
  order: string[] = [];
  id = 1;
  on(bone: string, fn: (g: Geo) => void) {
    let i = this.order.indexOf(bone);
    if (i < 0) {
      i = this.order.length;
      this.order.push(bone);
    }
    this.g.bone = i;
    this.g.set({ id: this.next(), spec: 0, em: 0, wind: 0 });
    fn(this.g);
  }
  next() {
    this.id = this.id >= 250 ? 1 : this.id + 1;
    return this.id;
  }
}

/** y축 고리들을 z축으로 눕혀 짐승 몸통을 만든다. 고리: [z, y, x, 가로반지름, 세로반지름] */
function barrel(g: Geo, rings: number[][], col: Hex | ((i: number, s: number) => Hex), sides = 8) {
  g.rotX(Math.PI / 2, () => {
    g.loft(rings.map(([z, y, x, rx, ry]) => [x, z, -y, rx, ry]), col, sides);
  });
}

function spike(g: Geo, x: number, y: number, z: number, len: number, w: number, dx: number, dz: number, col: Hex) {
  const tip = v3(x + dx * len, y + len, z + dz * len);
  const a = v3(x - w, y, z);
  const b = v3(x + w, y, z);
  const c = v3(x, y, z - w);
  const d = v3(x, y, z + w);
  g.tri(a, tip, d, col);
  g.tri(d, tip, b, tone(col, 0.88));
  g.tri(b, tip, c, tone(col, 0.78));
  g.tri(c, tip, a, tone(col, 0.92));
}

function limb(g: Geo, len: number, r0: number, r1: number, col: Hex, sides = 6) {
  g.loft(
    [
      [0, 0.02, 0, r0, r0],
      [0, -len * 0.55, 0, (r0 + r1) / 2, (r0 + r1) / 2],
      [0, -len, 0, r1, r1],
    ],
    (_i, s) => (s % 2 ? col : tone(col, 0.9)),
    sides,
  );
}

function flame(g: Geo, y: number, r: number, h: number, cols: Hex[], x = 0, z = 0) {
  g.loft(
    [
      [x, y, z, r * 0.6, r * 0.6],
      [x, y + h * 0.16, z, r, r],
      [x, y + h * 0.44, z, r * 0.74, r * 0.74],
      [x, y + h * 0.74, z, r * 0.34, r * 0.34],
      [x, y + h, z, 0, 0],
    ],
    (i) => cols[Math.min(i, cols.length - 1)],
    8,
    { flat: false, capTop: false },
  );
}

// ─── 버섯 병사 ─────────────────────────────

function mushroom() {
  const b = new MB();
  const stem = 0xd8c8a8;
  const stemD = 0xb49e80;
  b.on('chest', (g) => {
    g.loft(
      [
        [0, -0.06, 0, 0.17, 0.16],
        [0, 0.1, 0, 0.2, 0.18],
        [0, 0.3, 0, 0.17, 0.16],
        [0, 0.52, 0, 0.13, 0.12],
      ],
      (i, s) => (s % 3 === 0 ? stemD : i < 1 ? tone(stem, 0.9) : stem),
      10,
    );
    // 험상궂은 얼굴: 눈과 찢어진 입
    for (const s of [-1, 1]) {
      g.at(new THREE.Matrix4().makeRotationZ(s * -0.32).premultiply(new THREE.Matrix4().makeTranslation(s * 0.066, 0.31, 0.158)), () => {
        g.box(0, 0, 0, 0.066, 0.034, 0.012, 0x2a1810);
      });
      g.box(s * 0.066, 0.272, 0.162, 0.03, 0.03, 0.01, 0xd8b050);
    }
    g.box(0, 0.19, 0.178, 0.1, 0.018, 0.012, 0x4a2418);
  });
  // 줄기 위 찢어진 치마 고리
  b.on('chest', (g) => {
    const r = rng(9);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const y = 0.42;
      const low = 0.34 - r() * 0.06;
      const R = 0.17;
      const c = i % 2 ? 0xeee0c0 : 0xd2c0a0;
      g.quad(v3(Math.sin(a0) * 0.13, y, Math.cos(a0) * 0.12), v3(Math.sin(a0) * R, low, Math.cos(a0) * R), v3(Math.sin(a1) * R, low, Math.cos(a1) * R), v3(Math.sin(a1) * 0.13, y, Math.cos(a1) * 0.12), c);
    }
  });
  b.on('head', (g) => {
    // 갓: 물결치는 가장자리
    const n = 18;
    const R = 0.38;
    const prof = [
      [R * 0.98, 0.02],
      [R * 1.0, 0.06],
      [R * 0.86, 0.15],
      [R * 0.6, 0.24],
      [R * 0.3, 0.3],
      [0, 0.32],
    ];
    const P = (i: number, a: number) => {
      const w = 1 + Math.sin(a * 6) * (i < 2 ? 0.05 : 0.018);
      return v3(Math.sin(a) * prof[i][0] * w, prof[i][1] + (i < 2 ? Math.sin(a * 6 + 1) * 0.012 : 0), Math.cos(a) * prof[i][0] * w);
    };
    const cols = [0x8e2a22, 0xa8352a, 0xbd4230, 0xc84a34, 0xd2563c];
    for (let k = 0; k < prof.length - 1; k++) {
      for (let s = 0; s < n; s++) {
        const a0 = (s / n) * Math.PI * 2;
        const a1 = ((s + 1) / n) * Math.PI * 2;
        g.quad(P(k, a0), P(k, a1), P(k + 1, a1), P(k + 1, a0), s % 2 ? cols[k] : tone(cols[k], 0.92));
      }
    }
    // 밑면과 주름
    g.set({ id: b.next() });
    for (let s = 0; s < n; s++) {
      const a0 = (s / n) * Math.PI * 2;
      const a1 = ((s + 1) / n) * Math.PI * 2;
      g.tri(v3(0, 0.0, 0), P(0, a1), P(0, a0), s % 2 ? 0xb8a07c : 0x8e7a5c);
    }
    // 흰 사마귀
    g.set({ id: b.next() });
    const r = rng(17);
    for (const [az, el, sz] of [[0.2, 0.62, 0.05], [1.3, 0.7, 0.044], [-1.2, 0.66, 0.05], [2.4, 0.66, 0.04], [-2.5, 0.7, 0.05], [0.7, 0.3, 0.04], [-0.5, 0.26, 0.036], [1.9, 0.3, 0.04], [-1.7, 0.3, 0.04], [3, 0.3, 0.04], [0, 1.1, 0.05]] as const) {
      const y = Math.sin(el) * 0.3 + 0.04;
      const d = Math.cos(el) * R;
      g.rock(Math.sin(az) * d, y, Math.cos(az) * d, sz, sz * 0.42, sz, 0xeadcc0, Math.floor(r() * 999), 0.14, 0);
    }
  });
  for (const s of ['L', 'R']) {
    b.on(`thigh${s}`, (g) => limb(g, 0.11, 0.075, 0.066, stemD));
    b.on(`shin${s}`, (g) => limb(g, 0.11, 0.066, 0.06, stem));
    b.on(`foot${s}`, (g) => {
      g.box(0, -0.02, 0.03, 0.13, 0.07, 0.2, 0x4a3424, 0.016);
    });
    b.on(`upper${s}`, (g) => limb(g, 0.12, 0.05, 0.046, stem));
    b.on(`fore${s}`, (g) => limb(g, 0.12, 0.046, 0.04, stem));
    b.on(`hand${s}`, (g) => g.rock(0, -0.01, 0, 0.05, 0.05, 0.05, stem, 5, 0.1, 0));
  }
  b.on('gripR', (g) => {
    g.tube([v3(0, 0, -0.06), v3(0, 0, 0.3)], [0.024, 0.03], (_i, s) => (s % 2 ? 0x6a452c : 0x7d5534), 5);
    g.tube([v3(0, 0, 0.26), v3(0, 0.01, 0.42), v3(0, 0, 0.56)], [0.05, 0.085, 0.07], (_i, s) => (s % 2 ? 0x6a452c : 0x7d5534), 6);
    g.set({ id: b.next(), spec: 0.5 });
    spike(g, 0.07, 0, 0.42, 0.06, 0.02, 0.6, 0, 0x8a8a90);
    spike(g, -0.07, 0, 0.48, 0.06, 0.02, -0.6, 0, 0x8a8a90);
    spike(g, 0, 0.07, 0.5, 0.06, 0.02, 0, 0, 0x8a8a90);
  });
  return b;
}

// ─── 멧돼지·늑대 ───────────────────────────

function furColor(a: Hex, c: Hex, seed: number) {
  const r = rng(seed);
  const cache = new Map<string, Hex>();
  return (i: number, s: number) => {
    const k = `${i}:${s}`;
    let v = cache.get(k);
    if (v === undefined) {
      v = mix(a, c, r() * 0.9);
      cache.set(k, v);
    }
    return v;
  };
}

function boar() {
  const b = new MB();
  const hide = 0x5a3c2a;
  const hideD = 0x3c281e;
  b.on('body', (g) => {
    barrel(
      g,
      [
        [-0.56, 0.03, 0, 0.14, 0.12],
        [-0.44, 0.03, 0, 0.26, 0.24],
        [-0.14, 0.04, 0, 0.3, 0.29],
        [0.2, 0.08, 0, 0.32, 0.34],
        [0.44, 0.08, 0, 0.27, 0.3],
        [0.56, 0.06, 0, 0.18, 0.2],
      ],
      furColor(hide, hideD, 3),
      9,
    );
    // 등 갈기: 굵은 털 뭉치와 뿔처럼 솟은 가시
    g.set({ id: b.next() });
    const r = rng(5);
    for (let i = 0; i < 12; i++) {
      const z = 0.5 - i * 0.09;
      const top = 0.3 + 0.1 * Math.sin((i / 11) * Math.PI);
      const l = 0.12 + r() * 0.08 + 0.06 * Math.sin((i / 11) * Math.PI);
      spike(g, 0, top, z, l, 0.04, 0, -0.45, i % 2 ? 0xa89a7c : 0xc8b890);
      if (i > 1 && i < 10) for (const s of [1, -1]) spike(g, s * 0.1, top - 0.05, z + 0.02, l * 0.62, 0.03, s * 0.35, -0.4, 0x8a7a5e);
    }
  });
  b.on('tail', (g) => {
    g.tube([v3(0, 0, 0), v3(0, 0.05, -0.06), v3(0, 0.02, -0.12), v3(0, -0.04, -0.14)], [0.025, 0.018, 0.014, 0.01], hideD, 4);
  });
  b.on('head', (g) => {
    barrel(
      g,
      [
        [-0.08, 0.02, 0, 0.2, 0.2],
        [0.1, 0.0, 0, 0.21, 0.2],
        [0.24, -0.04, 0, 0.14, 0.13],
        [0.38, -0.07, 0, 0.1, 0.09],
        [0.4, -0.07, 0, 0.095, 0.085],
      ],
      furColor(hide, hideD, 7),
      8,
    );
    g.set({ id: b.next() });
    barrel(g, [[0.4, -0.07, 0, 0.1, 0.09], [0.425, -0.07, 0, 0.1, 0.09]], 0xb8847a, 8);
    for (const s of [1, -1]) {
      g.box(s * 0.04, -0.07, 0.43, 0.022, 0.03, 0.006, 0x2a1810);
      // 눈
      g.set({ id: b.next(), em: 0.8 });
      g.box(s * 0.145, 0.05, 0.16, 0.012, 0.03, 0.04, 0xffb84a);
      g.set({ id: b.next() });
      // 귀
      g.tri(v3(s * 0.12, 0.17, -0.02), v3(s * 0.24, 0.32, -0.06), v3(s * 0.2, 0.14, -0.08), hideD);
      g.tri(v3(s * 0.2, 0.14, -0.08), v3(s * 0.24, 0.32, -0.06), v3(s * 0.12, 0.17, -0.02), tone(hide, 1.1));
      // 엄니
      g.set({ id: b.next(), spec: 0.3 });
      g.tube([v3(s * 0.09, -0.1, 0.3), v3(s * 0.135, -0.02, 0.36), v3(s * 0.12, 0.07, 0.34)], [0.024, 0.018, 0.004], 0xe8dcc0, 5);
      g.set({ spec: 0 });
    }
  });
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    b.on(`u${n}`, (g) => limb(g, 0.18, 0.09, 0.06, hideD));
    b.on(`l${n}`, (g) => limb(g, 0.2, 0.055, 0.04, 0x30201a));
    b.on(`f${n}`, (g) => g.box(0, -0.01, 0.015, 0.09, 0.05, 0.11, 0x161012, 0.012));
  }
  return b;
}

function wolf() {
  const b = new MB();
  const fur = 0x6e6a68;
  const furD = 0x45424a;
  const ember = 0xff6a2a;
  const emberH = 0xffb04a;
  b.on('body', (g) => {
    barrel(
      g,
      [
        [-0.5, 0.02, 0, 0.09, 0.09],
        [-0.38, 0.03, 0, 0.17, 0.17],
        [-0.1, 0.0, 0, 0.17, 0.17],
        [0.18, 0.05, 0, 0.21, 0.24],
        [0.38, 0.09, 0, 0.19, 0.22],
        [0.5, 0.11, 0, 0.12, 0.13],
      ],
      furColor(fur, furD, 11),
      8,
    );
    g.set({ id: b.next(), em: 0.9 });
    for (let i = 0; i < 10; i++) {
      const z = 0.42 - i * 0.09;
      const top = 0.21 + 0.06 * Math.sin((i / 9) * Math.PI) - (i > 7 ? 0.04 : 0);
      spike(g, 0, top, z, 0.07 + (i % 2) * 0.05, 0.022, 0, -0.5, i % 2 ? emberH : ember);
    }
    g.set({ em: 0, id: b.next() });
    // 목덜미 갈기
    const r = rng(3);
    for (let i = 0; i < 10; i++) spike(g, (r() - 0.5) * 0.28, 0.2 + r() * 0.08, 0.28 + r() * 0.18, 0.1, 0.04, (r() - 0.5) * 0.4, -0.7, i % 2 ? fur : furD);
  });
  b.on('tail', (g) => barrel(g, [[-0.26, 0.05, 0, 0.05, 0.05], [-0.1, 0.02, 0, 0.08, 0.08], [0.01, 0, 0, 0.05, 0.05]], fur, 6));
  b.on('tail2', (g) => {
    barrel(g, [[-0.2, 0.03, 0, 0.01, 0.01], [-0.08, 0.02, 0, 0.055, 0.055], [0.02, 0, 0, 0.05, 0.05]], furD, 6);
    g.set({ id: b.next(), em: 0.9 });
    spike(g, 0, 0.02, -0.2, 0.08, 0.016, 0, -0.5, ember);
    g.set({ em: 0 });
  });
  b.on('head', (g) => {
    barrel(
      g,
      [
        [-0.08, 0.04, 0, 0.12, 0.12],
        [0.08, 0.05, 0, 0.14, 0.13],
        [0.2, 0.02, 0, 0.085, 0.08],
        [0.36, -0.01, 0, 0.05, 0.05],
      ],
      furColor(fur, furD, 13),
      7,
    );
    g.set({ id: b.next() });
    g.box(0, 0.005, 0.37, 0.05, 0.04, 0.02, 0x141014);
    for (const s of [1, -1]) {
      g.tri(v3(s * 0.05, 0.14, 0.02), v3(s * 0.11, 0.33, -0.04), v3(s * 0.13, 0.11, -0.03), furD);
      g.tri(v3(s * 0.13, 0.11, -0.03), v3(s * 0.11, 0.33, -0.04), v3(s * 0.05, 0.14, 0.02), fur);
      g.set({ id: b.next(), em: 1 });
      g.box(s * 0.094, 0.06, 0.15, 0.03, 0.022, 0.02, 0xff3a22);
      g.set({ id: b.next(), em: 0 });
    }
  });
  b.on('jaw', (g) => {
    barrel(g, [[-0.04, 0, 0, 0.07, 0.04], [0.16, -0.01, 0, 0.04, 0.025]], 0x3a3634, 6);
    g.set({ id: b.next() });
    for (const s of [1, -1]) spike(g, s * 0.03, 0.02, 0.12, 0.04, 0.008, 0, 0, 0xe8dcc0);
  });
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    b.on(`u${n}`, (g) => limb(g, 0.26, 0.078, 0.042, fur));
    b.on(`l${n}`, (g) => limb(g, 0.28, 0.04, 0.03, furD));
    b.on(`f${n}`, (g) => g.box(0, -0.002, 0.03, 0.075, 0.04, 0.12, 0x242024, 0.01));
  }
  return b;
}

// ─── 도깨비불 ─────────────────────────────

function wisp() {
  const b = new MB();
  const G = [0x4adc78, 0x56e684, 0x8df39e, 0xc6f8b0, 0xeaffd2];
  b.on('body', (g) => {
    g.rock(0, -0.08, 0, 0.24, 0.13, 0.24, 0x4a5a38, 3, 0.2);
    g.set({ id: 0, wind: 0.3 });
    g.leaves(0, -0.05, 0, 0.26, 0.15, 0.26, 40, [0x4a6e36, 0x5e8240, 0x3a5a2c, 0x79994a], 5, 0.14);
    g.set({ wind: 0, id: b.next() });
    for (const [x, z, l] of [[0.1, 0.05, 0.24], [-0.09, -0.04, 0.2], [0.02, -0.1, 0.18], [-0.04, 0.1, 0.16]] as const) g.tube([v3(x, -0.14, z), v3(x * 1.1, -0.14 - l * 0.5, z), v3(x * 1.3, -0.14 - l, z * 1.2)], [0.03, 0.02, 0.004], 0x3a4a2c, 4);
  });
  b.on('flame', (g) => {
    g.set({ em: 1 });
    flame(g, 0, 0.26, 0.72, G);
    g.set({ id: b.next(), em: 1 });
    flame(g, 0.04, 0.14, 0.44, [0xc6f8b0, 0xdcffc0, 0xeaffd2, 0xffffff]);
    g.set({ em: 0 });
  });
  for (const [n, h, r] of [['t1', 0.5, 0.1], ['t2', 0.44, 0.09], ['t3', 0.48, 0.1]] as const) {
    b.on(n, (g) => {
      g.set({ em: 1 });
      flame(g, 0, r, h, G);
      g.set({ em: 0 });
    });
  }
  b.on('eyes', (g) => {
    for (const s of [1, -1]) g.box(s * 0.08, 0, -0.02, 0.05, 0.08, 0.02, 0x10382a);
  });
  for (let i = 0; i < 3; i++) {
    b.on(`sp${i}`, (g) => {
      g.set({ em: 1 });
      g.rock(0, 0, 0, 0.03, 0.03, 0.03, 0xb8ffb0, 3 + i, 0, 0);
      g.set({ em: 0 });
    });
  }
  return b;
}

// ─── 불씨 벌레 ─────────────────────────────

function bug() {
  const b = new MB();
  const shell = 0x2e2022;
  b.on('body', (g) => {
    barrel(
      g,
      [
        [-0.3, 0.02, 0, 0.09, 0.05],
        [-0.16, 0.04, 0, 0.19, 0.11],
        [0.04, 0.05, 0, 0.2, 0.13],
        [0.2, 0.03, 0, 0.14, 0.09],
      ],
      (i, s) => (s % 2 ? shell : tone(shell, 1.3)),
      8,
    );
    g.set({ id: b.next(), em: 1 });
    g.box(0, 0.18, -0.03, 0.02, 0.012, 0.42, 0xff8a2a);
    for (const s of [1, -1]) {
      g.tube([v3(0, 0.178, 0.05), v3(s * 0.07, 0.15, 0.0), v3(s * 0.15, 0.09, -0.06)], 0.009, 0xffc060, 3);
      g.tube([v3(0, 0.17, -0.1), v3(s * 0.08, 0.13, -0.15), v3(s * 0.12, 0.08, -0.22)], 0.009, 0xff7a2a, 3);
    }
    g.set({ em: 0 });
  });
  b.on('tailglow', (g) => {
    g.set({ em: 1 });
    g.rock(0, 0, 0, 0.085, 0.07, 0.085, 0xffa040, 5, 0.1, 1);
    g.set({ em: 0 });
  });
  b.on('head', (g) => {
    g.rock(0, 0, 0, 0.09, 0.07, 0.08, 0x1e1618, 3, 0.1);
    for (const s of [1, -1]) {
      g.set({ id: b.next(), em: 1 });
      g.box(s * 0.05, 0.02, 0.07, 0.02, 0.02, 0.012, 0xffb04a);
      g.set({ id: b.next(), em: 0 });
      g.tube([v3(s * 0.035, 0.045, 0.05), v3(s * 0.09, 0.1, 0.14), v3(s * 0.13, 0.15, 0.2)], 0.007, 0x1e1618, 3);
      g.tube([v3(s * 0.04, -0.03, 0.06), v3(s * 0.05, -0.04, 0.14), v3(s * 0.015, -0.04, 0.18)], [0.016, 0.012, 0.004], 0x5a3a30, 4);
    }
  });
  for (const [i, z] of [[0, 1], [1, 0], [2, -1]] as const) {
    for (const s of [1, -1]) {
      b.on(`leg${i}${s > 0 ? 'L' : 'R'}`, (g) => {
        g.tube([v3(0, 0, 0), v3(s * 0.12, 0.02, z * 0.03), v3(s * 0.2, -0.1, z * 0.07)], [0.016, 0.012, 0.005], 0x1e1618, 4);
      });
    }
  }
  return b;
}

// ─── 돌 거인 ─────────────────────────────

function golem() {
  const b = new MB();
  const rock = 0x77726e;
  const rockD = 0x5a5654;
  const glow = 0xff8a2a;
  const glowH = 0xffd263;
  const seam = (g: Geo, pts: [number, number, number][], c: Hex, r = 0.016) => {
    g.set({ id: b.next(), em: 1 });
    g.tube(pts.map(([x, y, z]) => v3(x, y, z)), r, c, 3);
    g.set({ id: b.next(), em: 0 });
  };
  b.on('chest', (g) => {
    g.rock(0, 0.42, 0, 0.42, 0.36, 0.32, rock, 11, 0.16);
    g.set({ id: b.next() });
    g.rock(0, 0.1, 0, 0.32, 0.22, 0.25, rockD, 13, 0.18);
    g.set({ id: b.next() });
    g.rock(-0.22, 0.66, -0.06, 0.18, 0.13, 0.16, tone(rock, 1.1), 14, 0.2, 0);
    seam(g, [[0.03, 0.62, 0.3], [0.0, 0.46, 0.33], [0.05, 0.3, 0.3], [0.02, 0.14, 0.24]], glowH, 0.022);
    seam(g, [[0.0, 0.46, 0.33], [-0.12, 0.38, 0.3], [-0.24, 0.3, 0.2]], glow);
    seam(g, [[0.05, 0.3, 0.3], [0.17, 0.36, 0.27], [0.3, 0.44, 0.18]], glow);
  });
  b.on('head', (g) => {
    g.rock(0, 0.08, 0.06, 0.2, 0.16, 0.18, rock, 17, 0.16);
    g.set({ id: b.next() });
    g.rock(0, 0.2, 0.0, 0.14, 0.08, 0.13, tone(rock, 1.14), 18, 0.18, 0);
    g.set({ id: b.next(), em: 1 });
    for (const s of [1, -1]) g.box(s * 0.078, 0.09, 0.23, 0.07, 0.026, 0.02, glowH);
    g.set({ em: 0 });
  });
  b.on('hips', (g) => g.rock(0, -0.02, 0, 0.3, 0.17, 0.24, rockD, 19, 0.18));
  for (const [s, k] of [['L', 1], ['R', -1]] as const) {
    b.on(`thigh${s}`, (g) => g.rock(0, -0.1, 0, 0.15, 0.17, 0.15, rockD, 21 + k, 0.16));
    b.on(`shin${s}`, (g) => g.rock(0, -0.1, 0, 0.14, 0.17, 0.14, rock, 23 + k, 0.16));
    b.on(`foot${s}`, (g) => g.rock(0, -0.03, 0.05, 0.16, 0.08, 0.2, rockD, 25 + k, 0.16));
    b.on(`upper${s}`, (g) => {
      g.rock(0, -0.05, 0, 0.2, 0.17, 0.2, rock, 27 + k, 0.17);
      g.set({ id: b.next() });
      g.rock(0, -0.2, 0, 0.12, 0.14, 0.12, rockD, 29 + k, 0.17, 0);
    });
    b.on(`fore${s}`, (g) => {
      g.rock(0, -0.14, 0, 0.16, 0.19, 0.16, rock, 31 + k, 0.16);
      seam(g, [[k * 0.05, -0.05, 0.13], [k * 0.02, -0.15, 0.15], [k * 0.05, -0.25, 0.12]], glow);
    });
    b.on(`hand${s}`, (g) => g.rock(0, -0.04, 0, 0.2, 0.18, 0.2, tone(rock, 1.08), 33 + k, 0.16));
  }
  return b;
}

// ─── 보스: 이끼 고목왕 ─────────────────────

function elderBoss() {
  const b = new MB();
  const bark = 0x54402c;
  const barkD = 0x3a2c22;
  const barkC = (i: number, s: number) => (s % 2 ? (i % 2 ? bark : tone(bark, 1.12)) : barkD);
  const MOSS = [0x4c7a3a, 0x5e8c40, 0x3a6438, 0x7ea84c];
  const CANOPY = [0x3f6e3a, 0x4c8040, 0x305a34, 0x6a9c44, 0x8a9a3c];
  b.on('chest', (g) => {
    g.groundAO = null;
    g.loft(
      [
        [0, -0.1, 0, 0.72, 0.62],
        [0, 0.3, 0, 0.66, 0.56],
        [0, 0.8, 0.02, 0.6, 0.52],
        [0, 1.25, 0, 0.66, 0.56],
        [0, 1.56, 0, 0.42, 0.38],
      ],
      barkC,
      12,
    );
    // 어깨와 가슴의 이끼
    g.set({ id: 0, wind: 0.15 });
    for (const [x, y, z, r, s] of [[-0.56, 1.3, 0.05, 0.36, 3], [0.56, 1.3, 0.05, 0.36, 4], [0, 1.44, -0.42, 0.42, 5], [0.28, 1.34, 0.42, 0.26, 6], [-0.3, 1.34, 0.42, 0.24, 7]] as const) g.leaves(x, y, z, r, r * 0.6, r, 70, MOSS, s, 0.24);
    g.set({ id: b.next(), wind: 0.6 });
    const r = rng(11);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r();
      const len = 0.24 + r() * 0.4;
      g.box(Math.sin(a) * 0.68, 1.14 - len / 2, Math.cos(a) * 0.6, 0.05, len, 0.012, i % 2 ? 0x3a6438 : 0x4c7a3a);
    }
    g.set({ wind: 0 });
  });
  b.on('eye', (g) => {
    g.loft([[0, -0.32, -0.03, 0.34, 0.1], [0, 0, 0.0, 0.42, 0.12], [0, 0.32, -0.03, 0.34, 0.1]], barkD, 10);
    g.set({ id: b.next(), em: 1 });
    g.rock(0, 0, 0.09, 0.24, 0.24, 0.1, 0xffb040, 3, 0.04, 1);
    g.set({ id: b.next(), em: 0 });
    g.box(0, 0, 0.2, 0.08, 0.24, 0.02, 0x3a1c0a);
  });
  b.on('eyeOff', (g) => g.rock(0, 0, 0.05, 0.24, 0.24, 0.12, 0x4a3018, 3, 0.1));
  b.on('hips', (g) => g.rock(0, -0.02, 0, 0.7, 0.38, 0.62, barkD, 7, 0.08));
  b.on('head', (g) => {
    g.set({ id: 240, wind: 0.5 });
    for (const [x, y, z, r, s] of [[0, 0.5, -0.04, 0.92, 21], [0.66, 0.3, 0.04, 0.58, 22], [-0.66, 0.32, 0.02, 0.6, 23], [0.05, 0.3, 0.56, 0.54, 24], [-0.05, 0.32, -0.62, 0.6, 25], [0.28, 0.86, 0.12, 0.52, 26], [-0.32, 0.8, -0.14, 0.5, 27]] as const) {
      g.set({ id: 240 + (s % 6) });
      g.leaves(x, y, z, r, r * 0.8, r, Math.round(170 * r * r + 60), CANOPY, s, 0.34);
    }
    g.set({ wind: 0 });
  });
  for (const [s, k] of [['L', 1], ['R', -1]] as const) {
    b.on(`thigh${s}`, (g) => limb(g, 0.46, 0.28, 0.22, barkD, 8));
    b.on(`shin${s}`, (g) => limb(g, 0.46, 0.22, 0.22, bark, 8));
    b.on(`foot${s}`, (g) => {
      g.rock(0, -0.02, 0.05, 0.3, 0.15, 0.34, barkD, 30 + k, 0.1);
      for (const [a, l] of [[-0.6, 0.52], [0, 0.62], [0.6, 0.52], [2.9, 0.4]] as const) {
        g.tube([v3(Math.sin(a) * 0.2, -0.05, Math.cos(a) * 0.2 + 0.05), v3(Math.sin(a) * (0.2 + l * 0.55), -0.04, Math.cos(a) * (0.2 + l * 0.55) + 0.05), v3(Math.sin(a) * (0.2 + l), -0.12, Math.cos(a) * (0.2 + l) + 0.05)], [0.1, 0.07, 0.015], barkC, 5);
      }
    });
    b.on(`upper${s}`, (g) => {
      g.tube([v3(0, 0.02, 0), v3(0, -0.33, 0), v3(0, -0.66, 0)], [0.26, 0.2, 0.17], barkC, 7);
      g.tube([v3(0, -0.34, 0), v3(k * 0.24, -0.56, 0.1), v3(k * 0.42, -0.74, 0.16)], [0.07, 0.04, 0.015], barkD, 5);
      g.set({ id: 0, wind: 0.2 });
      g.leaves(0, -0.2, 0.02, 0.28, 0.2, 0.28, 34, MOSS, 40 + k, 0.2);
      g.set({ wind: 0 });
    });
    b.on(`fore${s}`, (g) => {
      g.tube([v3(0, 0.02, 0), v3(0, -0.37, 0), v3(0, -0.74, 0)], [0.17, 0.14, 0.12], barkC, 7);
      g.set({ id: b.next() });
      for (const [x, z, l] of [[0.15, 0.1, 0.42], [-0.14, 0.1, 0.4], [0.02, -0.15, 0.36], [0.02, 0.18, 0.46]] as const) {
        g.tube([v3(0, -0.74, 0), v3(x * 0.9, -0.74 - l * 0.7, z * 0.9), v3(x * 1.7, -0.74 - l * 1.25, z * 1.7)], [0.09, 0.05, 0.012], barkD, 5);
      }
      g.set({ id: 0, wind: 0.2 });
      g.leaves(k * 0.05, -0.42, 0, 0.2, 0.15, 0.2, 22, MOSS, 44 + k, 0.2);
      g.set({ wind: 0 });
    });
  }
  return b;
}

// ─── 보스: 꺼진 등불지기 ────────────────────

function wardenBoss() {
  const b = new MB();
  const steel = 0x3a4150;
  const steelL = 0x566076;
  const trim = 0xa58a4a;
  const under = 0x202028;
  const FIRE = [0x2a78e0, 0x3a92ee, 0x96d8ff, 0xcceeff, 0xecfdff];
  b.on('chest', (g) => {
    g.set({ spec: 0.45 });
    g.loft(
      [
        [0, -0.08, 0, 0.5, 0.36],
        [0, 0.26, 0, 0.5, 0.36],
        [0, 0.68, 0.02, 0.66, 0.47],
        [0, 1.0, 0, 0.68, 0.46],
        [0, 1.22, -0.02, 0.42, 0.32],
      ],
      (i, s) => (i === 0 ? steel : s % 2 ? steel : tone(steel, 1.14)),
      12,
    );
    g.set({ id: b.next(), spec: 0.7 });
    g.box(0, 0.68, 0.46, 0.08, 1.0, 0.05, trim, 0.012);
    g.box(0, 0.86, 0.42, 0.78, 0.07, 0.05, trim, 0.012);
    g.set({ id: b.next(), em: 1, spec: 0 });
    g.box(0.18, 0.62, 0.44, 0.05, 0.3, 0.03, 0x60b0ff);
    g.box(-0.2, 0.56, 0.44, 0.04, 0.22, 0.03, 0x60b0ff);
    g.set({ id: b.next(), em: 0, spec: 0.5 });
    g.loft([[0, 1.14, 0, 0.26, 0.26], [0, 1.2, 0, 0.44, 0.44], [0, 1.32, 0, 0.46, 0.46], [0, 1.3, 0, 0.3, 0.3]], steelL, 12);
    g.set({ spec: 0 });
    for (const s of [1, -1]) {
      g.set({ id: b.next(), spec: 0.5 });
      g.loft(
        [
          [s * 0.78, 0.92, 0, 0.36, 0.36],
          [s * 0.78, 1.08, 0, 0.4, 0.4],
          [s * 0.78, 1.28, 0, 0.3, 0.3],
          [s * 0.78, 1.42, 0, 0.1, 0.1],
        ],
        (i) => (i === 0 ? trim : steelL),
        10,
      );
      g.set({ id: b.next(), spec: 0.7 });
      for (const [dx, dz] of [[0.12, 0.12], [0.14, -0.14], [-0.08, 0]] as const) spike(g, s * (0.78 + dx), 1.34, dz, 0.34, 0.06, s * 0.16, 0, trim);
      g.set({ spec: 0 });
    }
  });
  b.on('neckFlame', (g) => {
    g.set({ em: 1 });
    for (const [x, z, s] of [[0.26, 0.1, 1], [-0.26, 0.08, 0.9], [0.03, -0.26, 1.05]] as const) flame(g, 0, 0.1 * s, 0.4 * s, FIRE, x, z);
    g.set({ em: 0 });
  });
  for (const s of [1, -1]) {
    b.on(`shFlame${s}`, (g) => {
      g.set({ em: 1 });
      flame(g, -0.1, 0.09, 0.34, FIRE, s * -0.2, 0.1);
      g.set({ em: 0 });
    });
  }
  b.on('hips', (g) => {
    g.set({ spec: 0.7 });
    g.loft([[0, -0.02, 0, 0.47, 0.42], [0, 0.07, 0, 0.47, 0.42]], trim, 14);
    g.set({ id: b.next(), spec: 0.35 });
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.rotY(a, () => {
        g.quad(v3(-0.16, 0, 0.44), v3(-0.22, -0.5, 0.58), v3(0.22, -0.5, 0.58), v3(0.16, 0, 0.44), i % 2 ? 0x3e4454 : 0x4a5262);
        g.quad(v3(-0.22, -0.5, 0.58), v3(-0.22, -0.54, 0.585), v3(0.22, -0.54, 0.585), v3(0.22, -0.5, 0.58), trim);
      });
    }
    g.set({ spec: 0 });
  });
  const capeC = (i: number, s: number) => (s % 2 ? 0x2a3560 : 0x222c52);
  const capeSheet = (g: Geo, r0: number, r1: number, h: number, jag: boolean) => {
    const r = rng(5);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI - 1.75 + (3.5 * i) / n;
      const a1 = Math.PI - 1.75 + (3.5 * (i + 1)) / n;
      const low = -h + (jag ? r() * 0.34 : 0);
      const low2 = -h + (jag ? r() * 0.34 : 0);
      const c = capeC(0, i);
      g.quad(v3(Math.sin(a0) * r0, 0, Math.cos(a0) * r0 * 0.5), v3(Math.sin(a1) * r0, 0, Math.cos(a1) * r0 * 0.5), v3(Math.sin(a1) * r1, low2, Math.cos(a1) * r1 * 0.5), v3(Math.sin(a0) * r1, low, Math.cos(a0) * r1 * 0.5), c);
    }
  };
  b.on('cape1', (g) => capeSheet(g, 0.6, 0.78, 1.1, false));
  b.on('cape2', (g) => capeSheet(g, 0.78, 0.9, 0.62, true));
  for (const [s, k] of [['L', 1], ['R', -1]] as const) {
    b.on(`thigh${s}`, (g) => {
      g.set({ spec: 0.3 });
      limb(g, 0.54, 0.22, 0.18, steel, 8);
    });
    b.on(`shin${s}`, (g) => {
      g.set({ spec: 0.35 });
      limb(g, 0.54, 0.18, 0.17, steel, 8);
      g.set({ id: b.next(), spec: 0.6 });
      g.rock(0, 0, 0.1, 0.17, 0.17, 0.14, steelL, 3, 0.05, 0);
      g.box(0, -0.26, 0.17, 0.05, 0.42, 0.04, trim);
      g.set({ spec: 0 });
    });
    b.on(`foot${s}`, (g) => {
      g.set({ spec: 0.4 });
      g.box(0, -0.03, 0.1, 0.32, 0.22, 0.56, steelL, 0.05);
      g.set({ spec: 0 });
    });
    b.on(`upper${s}`, (g) => {
      limb(g, 0.62, 0.17, 0.14, under, 8);
      g.set({ id: b.next(), spec: 0.4 });
      g.loft([[0, -0.16, 0, 0.17, 0.17], [0, -0.52, 0, 0.15, 0.15]], steel, 8);
      g.set({ spec: 0 });
    });
    b.on(`fore${s}`, (g) => {
      g.set({ spec: 0.4 });
      limb(g, 0.62, 0.14, 0.14, steel, 8);
      g.set({ id: b.next(), spec: 0.5 });
      g.loft([[0, -0.34, 0, 0.16, 0.16], [0, -0.58, 0, 0.19, 0.19]], steelL, 8);
      g.set({ spec: 0 });
    });
    b.on(`hand${s}`, (g) => {
      g.set({ spec: 0.5 });
      g.box(0, 0, 0, 0.26, 0.26, 0.26, steelL, 0.05);
      g.set({ spec: 0 });
    });
    void k;
  }
  b.on('handFire', (g) => {
    g.set({ em: 1 });
    flame(g, 0.1, 0.2, 0.74, FIRE);
    g.set({ em: 0 });
  });
  b.on('head', (g) => {
    const iron = 0x30303a;
    g.set({ spec: 0.4 });
    g.loft([[0, -0.04, 0, 0.12, 0.12], [0, 0.1, 0, 0.1, 0.1]], iron, 8);
    g.loft([[0, 0.1, 0, 0.27, 0.27], [0, 0.15, 0, 0.33, 0.33]], iron, 8);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      g.tube([v3(Math.cos(a) * 0.3, 0.13, Math.sin(a) * 0.3), v3(Math.cos(a) * 0.35, 0.74, Math.sin(a) * 0.35)], 0.024, iron, 4);
    }
    g.loft([[0, 0.72, 0, 0.42, 0.42], [0, 0.78, 0, 0.46, 0.46], [0, 1.09, 0, 0.04, 0.04]], (i) => (i ? tone(iron, 1.2) : iron), 8);
    g.set({ spec: 0 });
  });
  b.on('headFlame', (g) => {
    g.set({ em: 1 });
    flame(g, 0, 0.28, 0.68, FIRE);
    g.set({ em: 0 });
  });
  b.on('gripR', (g) => {
    g.tube([v3(0, 0, -0.25), v3(0, 0, 0.44)], 0.05, 0x3c3028, 6);
    g.set({ id: b.next(), spec: 0.7 });
    g.tube([v3(0, 0, 0.42), v3(0, 0, 0.52)], [0.09, 0.075], trim, 6);
    g.set({ spec: 0 });
  });
  b.on('ballNode', (g) => {
    g.set({ spec: 0.6 });
    g.rock(0, 0, 0, 0.34, 0.34, 0.34, 0x4e5262, 3, 0.04, 2);
    g.set({ id: b.next(), spec: 0.7 });
    const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
    const seen = new Set<string>();
    for (let i = 0; i < ico.count; i++) {
      const d = v3(ico.getX(i), ico.getY(i), ico.getZ(i)).normalize();
      const key = d.toArray().map((n) => n.toFixed(2)).join();
      if (seen.has(key)) continue;
      seen.add(key);
      const base = d.clone().multiplyScalar(0.3);
      const tip = d.clone().multiplyScalar(0.62);
      g.tube([base, tip], [0.09, 0.004], trim, 5);
    }
    g.set({ spec: 0 });
  });
  for (let i = 0; i < 9; i++) {
    b.on(`link${i}`, (g) => {
      g.set({ spec: 0.6 });
      g.rock(0, 0, 0, 0.056, 0.056, 0.056, 0x7a7f8e, 3 + i, 0, 0);
      g.set({ spec: 0 });
    });
  }
  return b;
}

const BUILD: Record<string, () => MB> = { mushroom, boar, wolf, ashwolf: wolf, wisp, emberbug: bug, golem, elder: elderBoss, warden: wardenBoss };

const cache = new Map<string, CharAsset>();

export function monsterAsset(id: string): CharAsset | null {
  let a = cache.get(id);
  if (a) return a;
  const def = MONSTERS[id] ?? BOSSES[id];
  const fn = BUILD[id];
  if (!def || !fn) return null;
  const b = fn();
  const geometry = b.g.build();
  const proto = def.build();
  proto.apply?.(proto.anims.idle?.poses?.[0] ?? {});
  proto.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(proto.root);
  const height = Math.max(0.5, box.max.y);
  const lookup = (rig: any, n: string): THREE.Object3D => {
    if (n === 'ballNode') return rig.ballNode;
    if (n.startsWith('link')) return rig.linkNodes[Number(n.slice(4))];
    const o = rig.nodes[n];
    if (!o) throw new Error(`뼈 없음: ${id}.${n}`);
    return o;
  };
  const rigFactory = (): BuiltRig => {
    const rig = def.build();
    return { rig, bones: b.order.map((n) => lookup(rig, n)), panels: [], chains: [] };
  };
  a = { geometry, boneOrder: b.order, rigFactory, anims: proto.anims, retarget: false, height, baseScale: 1.28 };
  cache.set(id, a);
  return a;
}
