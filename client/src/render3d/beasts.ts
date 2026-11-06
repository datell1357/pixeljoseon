// 조선 땅의 짐승과 설화 보스. 짐승마다 제 체형의 뼈대, 걸음, 털 무늬를 갖는다.
import * as THREE from 'three';
import { Quad, Rig } from '@bake/rig.js';
import type { Geo, Hex } from './geo';
import { rng } from './geo';
import {
  MB, anim, ball, biteAttack, bound, counter, deathAnim, ear, eye, grain, hitAnim, idleLoop, keys, limbSeg, mix, paw,
  flameBlob, legProf, pounceAttack, roundEar, ramAttack, rearSlam, sweep, tone, trot, tuft, v3, walk4,
  type Anim, type Paint, type Pose, type Sec,
} from './beastkit';

type Prof = number[][];
type Dims = { bodyH: number; hipX: number; frontZ: number; backZ: number; upper: number; lower: number; ankle?: number; front?: number; back?: number; shift?: number };

export interface Beast {
  b: MB;
  rig: () => any;
  anims: Record<string, Anim>;
  /** 하늘을 나는 짐승 */
  fly?: boolean;
  /** 털결 세기. 기본 1 */
  fur?: number;
}

const S = (z: number, y: number, w: number, up: number, dn: number, x = 0, sq?: number): Sec => ({ p: [x, y, z], w, up, dn, sq });
/** z 방향으로 늘어놓은 단면 목록 */
const Z = (rows: number[][]): Sec[] => rows.map(([z, y, w, up, dn, sq]) => S(z, y, w, up, dn, 0, sq));

/** 모든 자세에 같은 값을 더한다 (쉬는 자세가 기울어진 짐승) */
function based(poses: Pose[], base: Pose): Pose[] {
  return poses.map((p) => {
    const o: Pose = { ...p };
    for (const k in base) o[k] = (o[k] ?? 0) + base[k];
    return o;
  });
}
function basedAll(a: Record<string, Anim>, base: Pose) {
  for (const k in a) a[k] = { ...a[k], poses: based(a[k].poses, base) };
  return a;
}

/**
 * 네발짐승 몸통: 엉덩이 → 허리 → 깊은 가슴 → 비스듬히 솟는 목.
 * b·f는 뒷다리·앞다리 뿌리의 z. 엉덩이와 가슴은 다리 뿌리를 조금만 넘는다.
 */
function torso(o: { b: number; f: number; w: number; d: number; chest?: number; belly?: number; neck: [number, number]; neckW?: number; neckD?: number; rump?: number; hump?: number; haunch?: number; level?: number }): number[][] {
  const u = (o.f - o.b) / 0.6;
  const c = o.chest ?? 1.45;
  const bl = o.belly ?? 0.82;
  const hu = o.hump ?? 0;
  const ha = o.haunch ?? 1;
  const r = o.rump ?? 0.11;
  const m = (o.b + o.f) / 2;
  const [ny, nz] = o.neck;
  const s0 = [o.f + 0.07 * u, 0.1 * u + hu * 0.6];
  const nw = o.neckW ?? 0.6;
  const nd = o.neckD ?? 0.66;
  const n1 = [s0[0] + (nz - s0[0]) * 0.5, s0[1] + (ny - s0[1]) * 0.5];
  return [
    [o.b - r * u, 0.03 * u, 0.42 * o.w * ha, 0.42 * o.d, 0.45 * o.d],
    [o.b - (r - 0.05) * u, 0.045 * u, 0.82 * o.w * ha, 0.82 * o.d, 0.92 * o.d],
    [o.b + 0.04 * u, 0.05 * u, o.w * ha, 0.9 * o.d, 1.05 * o.d],
    [m - 0.04 * u, (0.025 + (o.level ?? 0)) * u, 0.88 * o.w, 0.82 * o.d, bl * o.d],
    [m + 0.1 * u, (0.035 + (o.level ?? 0) * 0.7) * u + hu * 0.3, 0.95 * o.w, 0.86 * o.d, 1.15 * o.d],
    [o.f - 0.03 * u, 0.06 * u + hu, 1.04 * o.w, 0.92 * o.d, c * o.d],
    [s0[0], s0[1], 0.96 * o.w, 0.9 * o.d, c * 0.95 * o.d],
    [n1[0], n1[1], ((0.96 + nw) / 2) * o.w, ((0.9 + nd) / 2) * o.d, ((c * 0.9 + nd) / 2) * o.d],
    [nz, ny, nw * o.w, nd * o.d, nd * o.d],
  ];
}

/** 네 다리. paint(앞다리?, 윗마디?, t, s, p) */
function legs4(
  b: MB, d: Dims,
  o: { fu: Prof; fl: Prof; bu: Prof; bl: Prof; paint: (front: boolean, upper: boolean, t: number, s: number, p: THREE.Vector3) => Hex; paw: (g: Geo, front: boolean) => void; around?: number },
) {
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const front = n[0] === 'F';
    const pole = (front ? d.front : d.back) ?? -1;
    b.on(`u${n}`, (g) => limbSeg(g, d.upper, front ? o.fu : o.bu, (t, s, _c, p) => o.paint(front, true, t, s, p), { front: pole, around: o.around }));
    b.on(`l${n}`, (g) => limbSeg(g, d.lower, front ? o.fl : o.bl, (t, s, _c, p) => o.paint(front, false, t, s, p), { front: pole, around: o.around }));
    b.on(`f${n}`, (g) => o.paw(g, front));
  }
}

/** 네발짐승 뼈대: 몸, 머리, 턱, 꼬리 두 마디 */
function quadRig(d: Dims, o: { head: [number, number]; headRx?: number; jaw?: [number, number]; tail: [number, number]; tailRx?: number; tail2?: number; tail2Rx?: number; extra?: (q: any) => void }) {
  return () => {
    const q = new Quad({ ankle: 0.03, front: -1, back: -1, ...d });
    const head = q.node('head', q.body, 0, o.head[0], o.head[1]);
    head.rotation.x = o.headRx ?? 0;
    if (o.jaw) q.node('jaw', head, 0, o.jaw[0], o.jaw[1]);
    const tail = q.node('tail', q.body, 0, o.tail[0], o.tail[1]);
    tail.rotation.x = o.tailRx ?? 0;
    if (o.tail2 !== undefined) {
      const t2 = q.node('tail2', tail, 0, 0, o.tail2);
      t2.rotation.x = o.tail2Rx ?? 0;
    }
    o.extra?.(q);
    q.remember();
    return q;
  };
}

// ======================= 다람쥐 =======================
/** 한국 다람쥐: 등에 검은 줄 다섯, 눈 위아래 흰 줄, 위로 세운 털꼬리. 깡충깡충 뛴다 */
function squirrel(): Beast {
  const b = new MB();
  const d: Dims = { bodyH: 0.19, hipX: 0.065, frontZ: 0.1, backZ: -0.1, upper: 0.1, lower: 0.11, shift: 0.0 };
  // 한국 다람쥐: 회갈색에 누런 기, 엉덩이만 살짝 붉다. 여우처럼 진한 주황이 아니다
  const orange = 0xa88660;
  const rust = 0x9a6a44;
  const cream = 0xeee4d0;
  const dark = 0x1e1612;
  const grey = 0x8c7c6a;
  const greyD = 0x6e604f;
  // 등 줄무늬: 몸 둘레의 각도로 고른다
  const back = (s: number, c: number, z: number, z0: number, z1: number) => {
    if (z < z0 || z > z1 || s < 0.05) return -1;
    const a = Math.abs(Math.atan2(c, s));
    if (a < 0.15) return dark;
    if (a < 0.32) return greyD;
    if (a < 0.5) return dark;
    if (a < 0.72) return cream;
    if (a < 0.9) return dark;
    return -1;
  };
  const coat = counter(grey, orange, cream, -0.3, 0.2);
  b.on('body', (g) => {
    sweep(
      g,
      Z([
        [-0.17, 0.03, 0.05, 0.05, 0.05],
        [-0.14, 0.045, 0.1, 0.1, 0.095],
        [-0.07, 0.05, 0.115, 0.11, 0.1],
        [0.02, 0.05, 0.1, 0.1, 0.09],
        [0.1, 0.06, 0.085, 0.085, 0.08],
        [0.15, 0.09, 0.065, 0.07, 0.065],
        [0.18, 0.12, 0.05, 0.055, 0.05],
      ]),
      (_t, s, c, p) => {
        const st = back(s, c, p.z, -0.13, 0.12);
        // 엉덩이 쪽만 붉은 기
        const base = p.z < -0.11 && s > -0.3 ? mix(coat(s), rust, 0.6) : coat(s);
        return tone(st >= 0 ? st : base, grain(p, 0.06));
      },
      { around: 20, sub: 4, fur: { k: 0.18 } },
    );
  });
  b.on('head', (g) => {
    sweep(
      g,
      Z([
        [-0.065, 0.0, 0.045, 0.045, 0.045],
        [-0.035, 0.01, 0.078, 0.078, 0.068],
        [0.03, 0.01, 0.088, 0.082, 0.074],
        [0.09, -0.003, 0.064, 0.058, 0.054],
        [0.135, -0.018, 0.036, 0.034, 0.032],
        [0.155, -0.024, 0.015, 0.015, 0.015],
      ]),
      (_t, s, c, p) => {
        // 눈을 지나는 검은 줄, 그 위아래 흰 줄, 이마의 검은 줄
        const ey = p.y - (0.028 + (p.z - 0.05) * -0.2);
        let col = s < -0.35 ? cream : s > 0.5 ? greyD : orange;
        if (Math.abs(c) > 0.25 && p.z > -0.02 && p.z < 0.13) {
          if (Math.abs(ey) < 0.011) col = dark;
          else if (ey > 0.011 && ey < 0.024) col = cream;
          else if (ey < -0.011 && ey > -0.026) col = cream;
        }
        if (s > 0.85 && p.z < 0.1) col = dark;
        return tone(col, grain(p, 0.04));
      },
      { around: 16, sub: 3, fur: { k: 0.1, mask: (t) => t < 0.45 } },
    );
    ball(g, 0, -0.024, 0.155, 0.012, 0.009, 0.007, 0x3a2420, 6);
    // 볼주머니
    for (const s of [1, -1]) ball(g, s * 0.05, -0.02, 0.06, 0.03, 0.026, 0.035, (_t, ss) => (ss < 0 ? cream : orange), 8);
    for (const s of [1, -1]) {
      g.set({ id: b.next() });
      ear(g, v3(s * 0.035, 0.06, -0.01), v3(s * 0.055, 0.115, -0.025), 0.024, rust, 0xd8a888, { round: 1, face: v3(s * 0.5, 0, 1) });
      eye(g, () => b.next(), s * 0.054, 0.028, 0.05, 0.02, 0x140c0a, { yaw: s * 0.9, em: 0.15 });
    }
  });
  b.on('tail', (g) => {
    g.set({ id: b.next(), wind: 0.15 });
    sweep(
      g,
      [S(0.01, 0, 0.026, 0.024, 0.024), S(-0.05, 0.0, 0.06, 0.04, 0.04), S(-0.12, 0.0, 0.085, 0.048, 0.048), S(-0.2, 0.0, 0.09, 0.05, 0.05)],
      (_t, s, c, p) => tone(Math.abs(c) > 0.8 ? 0xd8c8b0 : Math.abs(c) > 0.55 ? dark : mix(greyD, rust, 0.3), grain(p, 0.06)),
      { around: 12, sub: 3, fur: { k: 0.45, dir: 1, chance: 0.7 } },
    );
  });
  b.on('tail2', (g) => {
    g.set({ id: b.next(), wind: 0.2 });
    sweep(
      g,
      [S(0.02, 0, 0.09, 0.05, 0.05), S(-0.07, 0, 0.088, 0.05, 0.05), S(-0.14, 0, 0.068, 0.04, 0.04), S(-0.19, 0, 0.032, 0.022, 0.022), S(-0.21, 0, 0, 0, 0)],
      (_t, s, c, p) => tone(Math.abs(c) > 0.8 ? 0xd8c8b0 : Math.abs(c) > 0.55 ? dark : mix(greyD, rust, 0.3), grain(p, 0.06)),
      { around: 12, sub: 3, fur: { k: 0.45, dir: 1, chance: 0.7 } },
    );
  });
  legs4(b, d, {
    ...legProf(0.02, { thigh: 1.8, shoulder: 0.9 }),
    paint: (front, upper, t, s) => (upper && t < 0.5 ? (s > 0 ? cream : orange) : front ? mix(orange, cream, 0.3) : orange),
    paw: (g, front) => paw(g, () => b.next(), 0.016, 0.012, front ? 0.022 : 0.04, 0xb88a64, { heel: front ? 0 : 0.012 }),
  });
  const rig = quadRig(d, { head: [0.13, 0.19], headRx: -0.05, tail: [0.03, -0.16], tailRx: 1.15, tail2: -0.2, tail2Rx: 0.75 });
  const base = { Brx: -8 };
  const anims = basedAll(
    {
      idle: anim(idleLoop(8, 0.006, (ph) => ({ 'tail.rx': 6 * Math.sin(ph * 2), 'tail2.rx': 10 * Math.sin(ph * 2 - 0.8), 'head.ry': 18 * Math.sin(ph) ** 5 })), 1.4, true),
      walk: anim(bound(8, 0.09, 0.06, (ph) => ({ 'tail.rx': -10 * Math.sin(ph), 'tail2.rx': 14 * Math.sin(ph - 0.8) })), 0.42, true),
      attack: anim(keys(8, [
        [0, { By: -0.02, Brx: 4, 'head.rx': 8 }],
        [2, { By: -0.05, Bz: -0.03, Brx: 10, 'head.rx': 14, BLz: -0.03, BRz: -0.03, 'tail.rx': 12 }, 'in'],
        [3, { Py: 0.09, Bz: 0.06, Brx: -14, 'head.rx': -10, FLz: 0.1, FRz: 0.1, FLy: 0.05, FRy: 0.05, BLz: -0.06, BRz: -0.06, 'tail.rx': -16 }, 'out'],
        [4, { Py: 0.02, Bz: 0.08, Brx: 14, 'head.rx': 22, FLz: 0.1, FRz: 0.09, 'tail.rx': 10, 'tail2.rx': 16 }],
        [6, { Bz: 0.04, Brx: 4, 'head.rx': 8, FLz: 0.04, FRz: 0.04 }],
        [7, { Bz: 0.01, 'head.rx': 2 }],
      ]), 0.5),
      hit: anim(hitAnim(0.5), 0.24),
      death: anim(deathAnim(0.45, 0.12), 0.7),
    },
    base,
  );
  return { b, rig, anims };
}

// ======================= 개과 공통 =======================
interface CanidOpt {
  d: Dims;
  head: [number, number];
  body: number[][];
  skull: number[][];
  jawSecs: number[][];
  jawAt: [number, number];
  bodyPaint: Paint;
  headPaint: Paint;
  jawPaint: Paint;
  eyes: { x: number; y: number; z: number; r: number; iris: Hex; slit?: boolean; em?: number };
  nose: [number, number, number];
  noseCol?: Hex;
  ears: { base: [number, number, number]; tip: [number, number, number]; w: number; back: Hex; inner: Hex; round?: number; tipCol?: Hex };
  tail: { at: [number, number]; rx: number; s1: number[][]; s2: number[][]; rx2: number; len1: number; paint: Paint | Hex; wind?: number };
  legs: { fu: Prof; fl: Prof; bu: Prof; bl: Prof; paint: (front: boolean, upper: boolean, t: number, s: number, p: THREE.Vector3) => Hex; paw: [number, number, number, Hex, Hex?] };
  deco?: (b: MB) => void;
  /** 털 길이 (몸 반지름 대비) */
  fur?: number;
}

function canid(o: CanidOpt): { b: MB; rig: () => any } {
  const b = new MB();
  const fk = o.fur ?? 0.22;
  b.on('body', (g) => sweep(g, Z(o.body), o.bodyPaint, { around: 18, sub: 4, fur: { k: fk } }));
  b.on('head', (g) => {
    sweep(g, Z(o.skull), o.headPaint, { around: 16, sub: 3, fur: { k: fk * 0.7, mask: (t, s) => t < 0.5 && s > -0.6 } });
    g.set({ id: b.next(), spec: 0.5 });
    ball(g, o.nose[0], o.nose[1], o.nose[2], o.nose[2] * 0.075, o.nose[2] * 0.06, o.nose[2] * 0.05, o.noseCol ?? 0x141012, 8);
    g.set({ spec: 0 });
    const e = o.ears;
    for (const s of [1, -1]) {
      g.set({ id: b.next() });
      ear(g, v3(s * e.base[0], e.base[1], e.base[2]), v3(s * e.tip[0], e.tip[1], e.tip[2]), e.w, e.back, e.inner, { round: e.round, face: v3(s * 0.4, 0.15, 1), tipCol: e.tipCol, thick: e.w * 0.55 });
      eye(g, () => b.next(), s * o.eyes.x, o.eyes.y, o.eyes.z, o.eyes.r, o.eyes.iris, { yaw: s * 0.55, slit: o.eyes.slit, em: o.eyes.em });
    }
  });
  b.on('jaw', (g) => {
    sweep(g, Z(o.jawSecs), o.jawPaint, { around: 12, sub: 2, capA: true });
    g.set({ id: b.next(), spec: 0.3 });
    const zt = o.jawSecs[o.jawSecs.length - 2][0];
    for (const s of [1, -1]) tuft(g, v3(s * 0.022, 0.005, zt), v3(s * 0.024, 0.04, zt + 0.006), 0.008, 0xf4ecd8, { around: 4 });
  });
  const t = o.tail;
  b.on('tail', (g) => {
    g.set({ id: b.next(), wind: t.wind ?? 0.1 });
    sweep(g, Z(t.s1), t.paint, { around: 14, sub: 3, fur: { k: fk * 1.4, dir: 1 } });
  });
  b.on('tail2', (g) => {
    g.set({ id: b.next(), wind: (t.wind ?? 0.1) * 1.5 });
    sweep(g, Z(t.s2), t.paint, { around: 14, sub: 3, fur: { k: fk * 1.4, dir: 1 } });
  });
  const [pw, ph, pl, pc, claw] = o.legs.paw;
  legs4(b, o.d, { ...o.legs, paw: (g) => paw(g, () => b.next(), pw, ph, pl, pc, { claw }) });
  o.deco?.(b);
  const rig = quadRig(o.d, { head: o.head, jaw: o.jawAt, tail: t.at, tailRx: t.rx, tail2: t.len1, tail2Rx: t.rx2 });
  return { b, rig };
}

function canidAnims(k: number, o: { stride: number; lift: number; dur: number; tailWag?: number; tailRx?: number }): Record<string, Anim> {
  const wag = o.tailWag ?? 10;
  const tr = o.tailRx ?? 0;
  return {
    idle: anim(idleLoop(8, 0.008 * k, (ph) => ({ 'tail.ry': wag * 0.6 * Math.sin(ph), 'tail.rx': tr, 'tail2.ry': wag * 0.8 * Math.sin(ph - 0.7), 'jaw.rx': 3 + 3 * Math.sin(ph * 2) })), 1.6, true),
    walk: anim(trot(8, o.stride, o.lift, 0.012 * k, (ph, c) => ({ 'tail.ry': wag * c, 'tail.rx': tr - 4, 'tail2.ry': wag * Math.cos(ph - 0.8), 'head.rx': 2.5 * Math.cos(2 * ph), 'jaw.rx': 4 })), o.dur, true),
    attack: anim(biteAttack(k), 0.5),
    hit: anim(hitAnim(k), 0.24),
    death: anim(deathAnim(k, 0.3 * k), 0.7),
  };
}

// ======================= 여우 =======================
function fox(): Beast {
  const red = 0xcf6526;
  const redD = 0xa84a1c;
  const white = 0xf2ece0;
  const black = 0x1e1614;
  const d: Dims = { bodyH: 0.46, hipX: 0.075, frontZ: 0.24, backZ: -0.25, upper: 0.22, lower: 0.23, shift: 0.02 };
  const coat = counter(redD, red, mix(white, red, 0.25), -0.4, 0.2);
  const { b, rig } = canid({
    d,
    head: [0.23, 0.44],
    body: torso({ b: d.backZ, f: d.frontZ, w: 0.105, d: 0.095, chest: 1.5, neck: [0.21, 0.41], neckW: 0.7, neckD: 0.78 }),
    bodyPaint: (_t, s, _c, p) => {
      // 목과 가슴의 흰 털
      if (p.z > 0.28 && s < 0.2) return tone(white, grain(p, 0.03));
      return tone(coat(s), grain(p, 0.06));
    },
    skull: [
      [-0.07, -0.01, 0.05, 0.055, 0.055],
      [-0.02, 0.01, 0.08, 0.075, 0.07],
      [0.05, 0.02, 0.092, 0.08, 0.075],
      [0.12, 0.01, 0.068, 0.06, 0.058],
      [0.19, -0.012, 0.042, 0.038, 0.038],
      [0.27, -0.026, 0.026, 0.026, 0.028],
      [0.305, -0.03, 0.014, 0.014, 0.016],
    ],
    headPaint: (_t, s, c, p) => {
      // 볼과 윗입술은 희고, 눈에서 코로 검붉은 줄
      const cheek = s < -0.05 && p.z > -0.02;
      if (cheek) return tone(white, grain(p, 0.03));
      if (Math.abs(c) > 0.5 && p.z > 0.13 && p.z < 0.26 && s < 0.3) return 0x5a2a1c;
      return tone(mix(red, redD, s > 0.6 ? 0.3 : 0), grain(p, 0.05));
    },
    jawSecs: [[-0.05, 0, 0.042, 0.018, 0.03], [0.06, -0.004, 0.032, 0.014, 0.024], [0.15, -0.008, 0.018, 0.01, 0.014], [0.18, -0.008, 0.006, 0.005, 0.006]],
    jawAt: [-0.035, 0.11],
    jawPaint: (_t, s) => (s > 0.4 ? 0x6a2a2a : white),
    eyes: { x: 0.052, y: 0.035, z: 0.13, r: 0.016, iris: 0xd89a2a, slit: true },
    nose: [0, -0.026, 0.305],
    ears: { base: [0.05, 0.065, 0.0], tip: [0.09, 0.225, -0.035], w: 0.056, back: redD, inner: 0xf0dcc4, tipCol: black },
    tail: {
      at: [0.06, -0.35], rx: -0.38, len1: -0.3, rx2: 0.22,
      s1: [[0.01, 0, 0.03, 0.03, 0.03], [-0.06, 0, 0.058, 0.055, 0.06], [-0.17, -0.005, 0.085, 0.08, 0.085], [-0.3, -0.01, 0.092, 0.085, 0.09]],
      s2: [[0.02, 0, 0.092, 0.085, 0.09], [-0.1, -0.005, 0.09, 0.085, 0.085], [-0.2, 0, 0.07, 0.066, 0.066], [-0.28, 0.005, 0.035, 0.035, 0.035], [-0.31, 0.006, 0, 0, 0]],
      paint: (t, s, _c, p) => (p.z < -0.17 && t > 0.5 ? white : tone(s > 0.5 ? redD : red, grain(p, 0.08))),
      wind: 0.12,
    },
    legs: {
      ...legProf(0.033),
      // 검은 버선
      paint: (front, upper, t, s) => (!upper ? black : front ? (t > 0.55 ? black : s > 0.3 ? mix(red, white, 0.3) : red) : t > 0.75 ? black : red),
      paw: [0.026, 0.02, 0.044, black],
    },
  });
  return { b, rig, anims: canidAnims(1, { stride: 0.15, lift: 0.08, dur: 0.48, tailWag: 8, tailRx: -4 }) };
}

// ======================= 늑대 =======================
function wolf(): Beast {
  const grey = 0x4e4a44;
  const greyD = 0x201e1c;
  const tan = 0x765e48;
  const cream = 0xb8ac98;
  const d: Dims = { bodyH: 0.5, hipX: 0.1, frontZ: 0.29, backZ: -0.3, upper: 0.23, lower: 0.25, shift: 0.02 };
  const { b, rig } = canid({
    d,
    fur: 0.26,
    head: [0.22, 0.52],
    body: torso({ b: d.backZ, f: d.frontZ, w: 0.15, d: 0.14, chest: 1.5, neck: [0.2, 0.5], neckW: 0.9, neckD: 0.98 }),
    // 등에 짙은 안장 무늬, 배와 다리 안쪽은 크림색
    bodyPaint: (_t, s, _c, p) => {
      let col = s < -0.45 ? cream : s < -0.15 ? mix(cream, tan, (s + 0.45) / 0.3) : s < 0.35 ? mix(tan, grey, (s + 0.15) / 0.5) : grey;
      if (s > 0.3 && p.z > -0.32 && p.z < 0.32) col = mix(grey, greyD, Math.min(1, (s - 0.3) * 2.2));
      if (p.z > 0.32 && s < 0.25) col = cream;
      return tone(col, grain(p, 0.09));
    },
    skull: [
      [-0.09, 0.0, 0.08, 0.08, 0.08],
      [-0.03, 0.02, 0.125, 0.11, 0.1],
      [0.05, 0.03, 0.13, 0.105, 0.1],
      [0.13, 0.02, 0.09, 0.08, 0.078],
      [0.21, -0.005, 0.055, 0.05, 0.052],
      [0.3, -0.02, 0.042, 0.038, 0.04],
      [0.35, -0.025, 0.026, 0.024, 0.026],
    ],
    headPaint: (_t, s, c, p) => {
      // 주둥이와 볼은 밝고, 정수리와 콧등은 어둡다
      if (s < -0.1 || (Math.abs(c) > 0.7 && p.z < 0.12)) return tone(cream, grain(p, 0.05));
      if (s > 0.5 && p.z > 0.14) return tone(mix(greyD, grey, 0.4), grain(p, 0.05));
      return tone(mix(grey, tan, 0.25), grain(p, 0.07));
    },
    jawSecs: [[-0.06, 0, 0.055, 0.022, 0.036], [0.08, -0.006, 0.042, 0.016, 0.028], [0.19, -0.01, 0.024, 0.012, 0.018], [0.22, -0.01, 0.008, 0.006, 0.008]],
    jawAt: [-0.045, 0.13],
    jawPaint: (_t, s) => (s > 0.4 ? 0x6a2a2a : cream),
    eyes: { x: 0.068, y: 0.05, z: 0.15, r: 0.018, iris: 0xd8a632, em: 0.35 },
    nose: [0, -0.02, 0.35],
    ears: { base: [0.062, 0.09, 0.0], tip: [0.095, 0.225, -0.035], w: 0.058, back: mix(grey, greyD, 0.4), inner: 0xd8c8b4 },
    tail: {
      at: [0.06, -0.41], rx: -0.8, len1: -0.26, rx2: 0.05,
      s1: [[0.01, 0, 0.035, 0.035, 0.035], [-0.07, 0, 0.06, 0.06, 0.06], [-0.18, -0.005, 0.075, 0.075, 0.075], [-0.26, -0.01, 0.08, 0.08, 0.08]],
      s2: [[0.02, 0, 0.08, 0.08, 0.08], [-0.1, 0, 0.075, 0.075, 0.075], [-0.2, 0, 0.055, 0.055, 0.055], [-0.26, 0, 0.022, 0.022, 0.022], [-0.28, 0, 0, 0, 0]],
      paint: (t, s, _c, p) => (p.z < -0.14 && t > 0.6 ? 0x1c1a1a : tone(s > 0.4 ? greyD : s < -0.4 ? cream : grey, grain(p, 0.1))),
    },
    legs: {
      ...legProf(0.05, { thigh: 1.05 }),
      paint: (_f, upper, t, s) => (upper && t < 0.4 ? (s > 0.4 ? grey : tan) : s > 0.2 ? tan : cream),
      paw: [0.032, 0.024, 0.055, 0x5a524a, 0x2a2420],
    },
    deco: (b) => {
      // 볼에서 뒤로 뻗는 털
      b.on('head', (g) => {
        g.set({ id: b.next() });
        for (const s of [1, -1]) {
          for (let i = 0; i < 3; i++) {
            const y = -0.02 + i * 0.03;
            tuft(g, v3(s * 0.1, y, 0.03), v3(s * 0.15, y - 0.03, -0.06), 0.035, (_t, ss) => (ss > 0.5 ? mix(grey, tan, 0.3) : cream), { around: 5 });
          }
        }
      });
    },
  });
  return { b, rig, anims: canidAnims(1.1, { stride: 0.17, lift: 0.1, dur: 0.56, tailWag: 6 }) };
}

// ======================= 승냥이 =======================
function dhole(): Beast {
  const rust = 0xb85a26;
  const rustD = 0x8a3e1c;
  const cream = 0xe8d4b4;
  const black = 0x241a18;
  const d: Dims = { bodyH: 0.47, hipX: 0.085, frontZ: 0.25, backZ: -0.26, upper: 0.22, lower: 0.23, shift: 0.02 };
  const coat = counter(rustD, rust, cream, -0.35, 0.22);
  const { b, rig } = canid({
    d,
    head: [0.21, 0.45],
    body: torso({ b: d.backZ, f: d.frontZ, w: 0.115, d: 0.1, chest: 1.5, neck: [0.19, 0.42], neckW: 0.72, neckD: 0.8 }),
    bodyPaint: (_t, s, _c, p) => tone(p.z > 0.28 && s < 0.2 ? cream : coat(s), grain(p, 0.06)),
    skull: [
      [-0.08, -0.005, 0.055, 0.06, 0.06],
      [-0.02, 0.015, 0.09, 0.085, 0.08],
      [0.05, 0.02, 0.1, 0.085, 0.08],
      [0.12, 0.01, 0.075, 0.065, 0.064],
      [0.18, -0.01, 0.048, 0.044, 0.046],
      [0.24, -0.022, 0.034, 0.032, 0.034],
      [0.27, -0.026, 0.02, 0.02, 0.022],
    ],
    // 짧고 거무스름한 주둥이
    headPaint: (_t, s, _c, p) => tone(p.z > 0.16 ? (s < -0.2 ? cream : mix(rustD, black, 0.4)) : s < -0.1 ? cream : rust, grain(p, 0.05)),
    jawSecs: [[-0.05, 0, 0.045, 0.02, 0.03], [0.06, -0.004, 0.034, 0.015, 0.025], [0.13, -0.008, 0.02, 0.01, 0.015], [0.155, -0.008, 0.007, 0.005, 0.006]],
    jawAt: [-0.04, 0.11],
    jawPaint: (_t, s) => (s > 0.4 ? 0x6a2a2a : cream),
    eyes: { x: 0.056, y: 0.038, z: 0.13, r: 0.016, iris: 0xb07a2a },
    nose: [0, -0.026, 0.27],
    // 둥근 귀, 안쪽은 흰 털
    ears: { base: [0.052, 0.07, 0.0], tip: [0.085, 0.18, -0.025], w: 0.058, back: rust, inner: 0xf4ece0, round: 1 },
    tail: {
      at: [0.06, -0.37], rx: -0.75, len1: -0.24, rx2: 0.08,
      s1: [[0.01, 0, 0.03, 0.03, 0.03], [-0.06, 0, 0.055, 0.055, 0.055], [-0.16, -0.005, 0.075, 0.075, 0.075], [-0.24, -0.01, 0.08, 0.08, 0.08]],
      s2: [[0.02, 0, 0.08, 0.08, 0.08], [-0.09, 0, 0.078, 0.078, 0.078], [-0.18, 0, 0.06, 0.06, 0.06], [-0.24, 0, 0.026, 0.026, 0.026], [-0.26, 0, 0, 0, 0]],
      // 꼬리는 검고 풍성하다
      paint: (t, _s, _c, p) => tone(t < 0.25 && p.z > -0.05 ? rustD : black, grain(p, 0.1)),
    },
    legs: {
      ...legProf(0.034),
      paint: (_f, upper, t, s) => (upper && t < 0.4 ? rust : s > 0.2 ? rustD : mix(rust, cream, 0.4)),
      paw: [0.027, 0.02, 0.045, 0x5a3424],
    },
  });
  return { b, rig, anims: canidAnims(1, { stride: 0.15, lift: 0.09, dur: 0.46, tailWag: 7 }) };
}

// ======================= 너구리 =======================
/** 너구리: 둥글고 털이 부숭부숭한 몸, 눈가의 검은 털, 검은 다리와 가슴, 짧고 굵은 꼬리 */
function raccoonDog(): Beast {
  const buff = 0xa88c62;
  const grizz = 0x5a4e40;
  const pale = 0xd8ccb4;
  const black = 0x1e1a18;
  const d: Dims = { bodyH: 0.32, hipX: 0.1, frontZ: 0.2, backZ: -0.21, upper: 0.14, lower: 0.15, shift: 0.0 };
  const { b, rig } = canid({
    d,
    fur: 0.32,
    head: [0.17, 0.37],
    body: torso({ b: d.backZ, f: d.frontZ, w: 0.19, d: 0.17, chest: 1.05, belly: 1.0, neck: [0.15, 0.34], neckW: 0.82, neckD: 0.86, rump: 0.13 }),
    // 털끝이 검은 얼룩 털, 어깨를 가로지르는 검은 띠, 검은 가슴
    bodyPaint: (_t, s, _c, p) => {
      const ripple = Math.sin(p.z * 60 + p.x * 40 + p.y * 30);
      let col = mix(buff, grizz, ripple > 0.3 ? 0.7 : 0.2);
      if (s > 0.7) col = mix(col, black, 0.45);
      if (p.z > 0.1 && p.z < 0.2 && s > -0.1) col = mix(col, black, 0.6);
      if (s < -0.3 && p.z > 0.05) col = black;
      if (s < -0.5) col = mix(grizz, black, 0.5);
      return tone(col, grain(p, 0.1));
    },
    skull: [
      [-0.08, 0.0, 0.07, 0.07, 0.07],
      [-0.02, 0.01, 0.105, 0.095, 0.09],
      [0.05, 0.01, 0.115, 0.095, 0.09],
      [0.11, 0.0, 0.08, 0.07, 0.07],
      [0.17, -0.015, 0.045, 0.04, 0.042],
      [0.22, -0.026, 0.028, 0.026, 0.028],
      [0.245, -0.03, 0.016, 0.016, 0.017],
    ],
    // 하얀 콧등과 이마, 눈을 감싼 검은 털이 볼로 흘러내린다
    headPaint: (_t, s, c, p) => {
      const ex = Math.abs(p.x) - 0.05;
      const ey = p.y - 0.025;
      const mask = p.z > -0.02 && p.z < 0.16 && Math.abs(c) > 0.15 && ((ex * ex) / 0.0025 + (ey * ey) / 0.0016 < 1 || (Math.abs(c) > 0.5 && s < 0.25 && s > -0.65 && p.z < 0.13));
      if (mask) return tone(black, grain(p, 0.05));
      if (p.z > 0.13) return tone(s < -0.2 ? pale : mix(pale, buff, 0.3), grain(p, 0.04));
      if (s > 0.3) return tone(mix(pale, buff, 0.45), grain(p, 0.06));
      return tone(pale, grain(p, 0.05));
    },
    jawSecs: [[-0.05, 0, 0.05, 0.02, 0.032], [0.05, -0.004, 0.036, 0.015, 0.024], [0.11, -0.008, 0.02, 0.01, 0.014], [0.13, -0.008, 0.007, 0.005, 0.006]],
    jawAt: [-0.04, 0.1],
    jawPaint: (_t, s) => (s > 0.4 ? 0x6a2a2a : pale),
    eyes: { x: 0.058, y: 0.03, z: 0.12, r: 0.017, iris: 0x7a5228, em: 0.25 },
    nose: [0, -0.03, 0.245],
    ears: { base: [0.058, 0.075, -0.015], tip: [0.078, 0.15, -0.035], w: 0.046, back: black, inner: pale, round: 1 },
    tail: {
      at: [0.08, -0.33], rx: -0.95, len1: -0.15, rx2: 0.1,
      s1: [[0.01, 0, 0.05, 0.05, 0.05], [-0.06, 0, 0.075, 0.075, 0.075], [-0.15, 0, 0.085, 0.085, 0.085]],
      s2: [[0.02, 0, 0.085, 0.085, 0.085], [-0.07, 0, 0.075, 0.075, 0.075], [-0.13, 0, 0.04, 0.04, 0.04], [-0.15, 0, 0, 0, 0]],
      paint: (_t, s, _c, p) => tone(s > 0.4 ? black : mix(buff, grizz, 0.4), grain(p, 0.1)),
    },
    legs: {
      ...legProf(0.036, { thigh: 0.9 }),
      paint: () => black,
      paw: [0.03, 0.022, 0.045, 0x1a1614],
    },
    deco: (b) => {
      // 볼에 부숭부숭한 털
      b.on('head', (g) => {
        g.set({ id: b.next() });
        for (const s of [1, -1]) {
          for (let i = 0; i < 4; i++) {
            const y = -0.03 + i * 0.022;
            tuft(g, v3(s * 0.09, y, 0.06), v3(s * 0.17, y - 0.04, -0.01), 0.036, (_t, ss) => (ss > 0.5 ? pale : mix(pale, buff, 0.3)), { around: 5 });
          }
        }
      });
    },
  });
  const anims = canidAnims(0.75, { stride: 0.1, lift: 0.05, dur: 0.4, tailWag: 5 });
  return { b, rig, anims };
}

// ======================= 멧돼지 =======================
/** 멧돼지: 높이 솟은 어깨와 억센 갈기, 길쭉한 쐐기 머리와 둥근 코, 위로 휜 엄니, 가는 다리 */
function boar(): Beast {
  const b = new MB();
  const hide = 0x5c4636;
  const hideD = 0x3a2c24;
  const grizzle = 0x7a6a58;
  const d: Dims = { bodyH: 0.4, hipX: 0.13, frontZ: 0.3, backZ: -0.33, upper: 0.16, lower: 0.18, shift: -0.1 };
  b.on('body', (g) => {
    sweep(
      g,
      Z([
        [-0.5, 0.03, 0.09, 0.09, 0.1],
        [-0.42, 0.04, 0.17, 0.17, 0.19],
        [-0.28, 0.05, 0.2, 0.19, 0.21],
        [-0.08, 0.07, 0.22, 0.23, 0.23],
        [0.12, 0.1, 0.24, 0.28, 0.26],
        [0.3, 0.1, 0.23, 0.28, 0.27],
        [0.44, 0.06, 0.18, 0.22, 0.22],
        [0.54, 0.02, 0.13, 0.15, 0.16],
      ]),
      (_t, s, _c, p) => {
        const sp = Math.sin(p.z * 70 + p.y * 50 + p.x * 33);
        const col = s > 0.6 ? hideD : s < -0.5 ? mix(hide, grizzle, 0.4) : mix(hide, grizzle, sp > 0.4 ? 0.6 : 0.1);
        return tone(col, grain(p, 0.12));
      },
      { around: 18, sub: 4, fur: { k: 0.18, chance: 0.6 } },
    );
    // 등을 따라 억센 갈기
    g.set({ id: b.next() });
    const r = rng(5);
    for (let i = 0; i < 16; i++) {
      const z = 0.5 - i * 0.065;
      const top = 0.3 + 0.1 * Math.sin((i / 15) * Math.PI) + (z > 0.05 ? 0.04 : 0);
      const l = 0.08 + r() * 0.04 + (z > 0.05 ? 0.05 : 0);
      for (const s of [-1, 0, 1]) {
        if (s && (i < 2 || i > 13)) continue;
        tuft(g, v3(s * 0.05, top - 0.04 - Math.abs(s) * 0.02, z), v3(s * 0.08, top + l * (s ? 0.6 : 1), z - 0.07), 0.035, (_t, ss) => (ss > 0 ? 0x2a2018 : 0x3e3026), { around: 4 });
      }
    }
  });
  b.on('tail', (g) => {
    g.set({ id: b.next() });
    sweep(g, Z([[0.0, 0, 0.022, 0.022, 0.022], [-0.08, -0.04, 0.016, 0.016, 0.016], [-0.14, -0.1, 0.012, 0.012, 0.012]]), hideD, { around: 6, sub: 2 });
    tuft(g, v3(0, -0.1, -0.14), v3(0, -0.18, -0.16), 0.022, 0x2a1e18, { around: 5 });
  });
  b.on('head', (g) => {
    sweep(
      g,
      Z([
        [-0.12, 0.04, 0.14, 0.16, 0.16],
        [-0.02, 0.04, 0.16, 0.17, 0.16],
        [0.1, 0.01, 0.13, 0.13, 0.13],
        [0.22, -0.03, 0.095, 0.09, 0.095],
        [0.33, -0.065, 0.068, 0.062, 0.066],
        [0.39, -0.075, 0.062, 0.058, 0.06],
      ]),
      (_t, s, c, p) => {
        // 볼에 희끗한 털, 콧등은 어둡다
        if (Math.abs(c) > 0.6 && s < 0.1 && p.z < 0.18) return tone(mix(grizzle, 0xb8a890, 0.4), grain(p, 0.1));
        return tone(s > 0.4 ? hideD : hide, grain(p, 0.1));
      },
      { around: 16, sub: 3 },
    );
    // 납작한 코
    g.set({ id: b.next() });
    sweep(g, [S(0.385, -0.075, 0.064, 0.06, 0.062), S(0.415, -0.075, 0.066, 0.06, 0.062), S(0.42, -0.075, 0.0, 0.0, 0.0)], (_t, _s, _c, p) => (p.z > 0.41 ? 0xa07870 : 0x8a6058), { around: 14, sub: 2 });
    for (const s of [1, -1]) ball(g, s * 0.025, -0.072, 0.418, 0.013, 0.018, 0.006, 0x2a1810, 6);
    for (const s of [1, -1]) {
      g.set({ id: b.next() });
      ear(g, v3(s * 0.085, 0.15, -0.04), v3(s * 0.15, 0.27, -0.09), 0.05, hideD, 0x8a6a5a, { face: v3(s * 0.6, 0.2, 1) });
      eye(g, () => b.next(), s * 0.098, 0.065, 0.11, 0.016, 0x3a2414, { yaw: s * 0.8, em: 0.2 });
      // 엄니
      g.set({ id: b.next(), spec: 0.5 });
      sweep(
        g,
        [S(0, 0, 0.018, 0.018, 0.018, 0), S(0, 0, 0.014, 0.014, 0.014), S(0, 0, 0.004, 0.004, 0.004)].map((sec, i) => {
          const pts = [v3(s * 0.07, -0.11, 0.28), v3(s * 0.115, -0.04, 0.33), v3(s * 0.1, 0.03, 0.31)];
          return { ...sec, p: [pts[i].x, pts[i].y, pts[i].z] as [number, number, number] };
        }),
        0xeee2c8,
        { around: 6, sub: 3 },
      );
      g.set({ spec: 0 });
    }
  });
  legs4(b, d, {
    ...legProf(0.045, { thigh: 1.15, shoulder: 1.2 }),
    paint: (_f, upper, t) => (upper && t < 0.5 ? hide : hideD),
    // 갈라진 굽
    paw: (g) => {
      g.set({ id: b.next(), spec: 0.4 });
      for (const s of [1, -1]) sweep(g, [S(-0.02, 0.025, 0.02, 0.01, 0.01, s * 0.016), S(0.02, 0.0, 0.017, 0.022, 0.006, s * 0.016), S(0.045, -0.008, 0.008, 0.008, 0.004, s * 0.014)], 0x161012, { around: 8, sub: 2, capA: true });
    },
  });
  const rig = quadRig(d, { head: [0.04, 0.47], tail: [0.1, -0.5] });
  const anims = {
    idle: anim(idleLoop(8, 0.01, (ph) => ({ 'tail.rz': 20 * Math.sin(ph * 2), 'head.rx': 4 + 4 * Math.sin(ph) })), 1.4, true),
    walk: anim(trot(8, 0.13, 0.07, 0.014, (ph, c) => ({ 'head.rx': 3 * Math.cos(2 * ph), 'tail.rz': 18 * c })), 0.5, true),
    attack: anim(ramAttack(1), 0.5),
    hit: anim(hitAnim(1), 0.24),
    death: anim(deathAnim(1, 0.18), 0.7),
  };
  return { b, rig, anims };
}

// ======================= 곰 공통 =======================
interface BearOpt {
  fur: Hex;
  furD: Hex;
  muzzle: Hex;
  chest?: Hex;
  eye: Hex;
  eyeEm?: number;
  bodyPaint?: Paint;
  legPaint?: (front: boolean, upper: boolean, t: number, s: number, p: THREE.Vector3) => Hex;
  mane?: boolean;
  /** 털 길이. 0이면 털 없음 */
  furLen?: number;
}

const BEAR_D: Dims = { bodyH: 0.48, hipX: 0.14, frontZ: 0.28, backZ: -0.28, upper: 0.24, lower: 0.22, shift: -0.02 };

function bearBody(o: BearOpt) {
  const b = new MB();
  const d = BEAR_D;
  // 가슴의 흰 반달(V): 가슴 앞면에서 가운데로 모이는 띠
  const crescent = (p: THREE.Vector3) => {
    if (o.chest === undefined || p.z < 0.26) return false;
    const v = p.y + 0.24;
    if (v < 0 || v > 0.22) return false;
    return Math.abs(Math.abs(p.x) - v * 1.05) < 0.03;
  };
  b.on('body', (g) => {
    sweep(
      g,
      Z(torso({ b: d.backZ, f: d.frontZ, w: 0.26, d: 0.24, chest: 1.15, belly: 0.95, hump: 0.02, level: 0.04, neck: [0.16, 0.45], neckW: 0.9, neckD: 0.92, rump: 0.14 })),
      o.bodyPaint ?? ((_t, s, _c, p) => (crescent(p) ? o.chest! : tone(s > 0.5 ? o.furD : o.fur, grain(p, 0.1)))),
      { around: 20, sub: 4, fur: o.furLen === 0 ? undefined : { k: o.furLen ?? 0.2 } },
    );
    if (o.mane === true) {
      // 목과 어깨를 덮는 긴 털(갈기)
      g.set({ id: b.next() });
      const r = rng(8);
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        if (Math.sin(a) < -0.55) continue;
        const x = Math.cos(a) * 0.22;
        const y = 0.1 + Math.sin(a) * 0.23;
        const z = 0.33 + r() * 0.06;
        tuft(g, v3(x * 0.95, y + 0.03, z), v3(x * 1.3, y + Math.sin(a) * 0.05, z - 0.16), 0.065, (_t, ss, _c, p) => tone(ss > 0 ? o.furD : o.fur, grain(p, 0.1)), { around: 5 });
      }
    }
  });
  b.on('tail', (g) => {
    g.set({ id: b.next() });
    ball(g, 0, 0, -0.03, 0.05, 0.05, 0.06, o.fur, 8);
  });
  b.on('head', (g) => {
    sweep(
      g,
      Z([
        [-0.1, 0.0, 0.13, 0.14, 0.14],
        [-0.03, 0.02, 0.175, 0.165, 0.155],
        [0.06, 0.02, 0.175, 0.155, 0.145],
        [0.13, -0.01, 0.12, 0.105, 0.105],
        [0.19, -0.035, 0.085, 0.075, 0.075],
        [0.24, -0.045, 0.065, 0.058, 0.058],
        [0.265, -0.045, 0.036, 0.034, 0.036],
      ]),
      (_t, s, _c, p) => tone(p.z > 0.14 ? (s > 0.6 ? tone(o.muzzle, 0.8) : o.muzzle) : s > 0.5 ? o.furD : o.fur, grain(p, 0.07)),
      { around: 16, sub: 3, fur: o.furLen === 0 ? undefined : { k: 0.14, mask: (t) => t < 0.5 } },
    );
    g.set({ id: b.next(), spec: 0.5 });
    ball(g, 0, -0.03, 0.268, 0.036, 0.026, 0.02, 0x0c0a0a, 8);
    g.set({ spec: 0 });
    for (const s of [1, -1]) {
      g.set({ id: b.next() });
      // 반달가슴곰은 귀가 크고 둥글다
      roundEar(g, s * 0.12, 0.15, -0.04, 0.062, o.furD, tone(o.fur, 1.5), { tilt: -s * 0.45, flat: 0.5 });
      eye(g, () => b.next(), s * 0.085, 0.045, 0.13, 0.018, o.eye, { yaw: s * 0.5, em: o.eyeEm ?? 0.2 });
    }
  });
  b.on('jaw', (g) => {
    sweep(g, Z([[-0.06, 0, 0.08, 0.025, 0.045], [0.04, -0.01, 0.058, 0.02, 0.034], [0.1, -0.015, 0.034, 0.012, 0.02], [0.12, -0.015, 0.01, 0.006, 0.01]]), (_t, s) => (s > 0.4 ? 0x6a2a2a : o.muzzle), { around: 12, sub: 2, capA: true });
    g.set({ id: b.next(), spec: 0.3 });
    for (const s of [1, -1]) tuft(g, v3(s * 0.033, 0.005, 0.085), v3(s * 0.035, 0.05, 0.095), 0.012, 0xf4ecd8, { around: 4 });
  });
  legs4(b, d, {
    ...legProf(0.07, { paw: 1.1, thigh: 1.05 }),
    paint: o.legPaint ?? ((_f, _u, _t, s, p) => tone(s > 0.6 ? o.fur : o.furD, grain(p, 0.08))),
    // 발바닥을 땅에 대고 걷는다: 뒷발은 뒤꿈치가 길다
    paw: (g, front) => paw(g, () => b.next(), 0.07, 0.045, front ? 0.08 : 0.1, o.furD, { claw: 0xd8d0c0, toes: 5, heel: front ? 0 : 0.05 }),
    around: 12,
  });
  return b;
}

function bearRig(extra?: (q: any) => void) {
  return quadRig(BEAR_D, { head: [0.18, 0.5], headRx: 0.05, jaw: [-0.06, 0.12], tail: [0.12, -0.42], extra });
}

function bearAnims(k: number): Record<string, Anim> {
  return {
    idle: anim(idleLoop(8, 0.012 * k, (ph) => ({ 'head.ry': 14 * Math.sin(ph * 0.5) ** 3, 'head.rx': 3 * Math.sin(ph), 'jaw.rx': 2 + 2 * Math.sin(ph * 2) })), 2.0, true),
    // 육중하게 어깨를 흔들며 걷는다
    walk: anim(walk4(8, 0.13 * k, 0.08 * k, { bob: 0.018 * k, roll: 4, yaw: 4, extra: (ph) => ({ 'head.ry': -4 * Math.cos(ph), 'head.rx': 3 * Math.cos(2 * ph) }) }), 0.8, true),
    attack: anim(rearSlam(k), 0.6),
    hit: anim(hitAnim(k), 0.24),
    death: anim(deathAnim(k, 0.32 * k), 0.8),
  };
}

function bear(): Beast {
  const b = bearBody({ fur: 0x201c1e, furD: 0x141214, muzzle: 0x8a6a4c, chest: 0xeee6d6, eye: 0x4a2c18 });
  return { b, rig: bearRig(), anims: bearAnims(1) };
}

// ======================= 호랑이 =======================
/** 범: 길고 낮은 몸, 굵은 앞다리, 둥근 머리와 흰 볼털, 몸을 감싸는 검은 줄, 고리 무늬 긴 꼬리 */
function tiger(): Beast {
  const b = new MB();
  const orange = 0xcc6a1e;
  const orangeD = 0xb05416;
  const white = 0xf4eee2;
  const black = 0x1a1412;
  const d: Dims = { bodyH: 0.5, hipX: 0.12, frontZ: 0.3, backZ: -0.32, upper: 0.25, lower: 0.23, shift: 0.0 };
  // 줄무늬: 몸을 위에서 아래로 두르고, 배 쪽으로 가늘어지다 끊긴다. 양옆이 엇갈린다
  const stripe = (p: THREE.Vector3, s: number, freq: number, w0: number) => {
    if (s < -0.55) return false;
    const u = p.z * freq + 0.9 * Math.sin(p.y * 11 + p.z * 4) + (p.x > 0 ? 0.37 : 0) + 0.25 * Math.sin(p.z * 31);
    const f = Math.abs((((u % 2) + 2) % 2) - 1);
    const w = w0 * Math.max(0, Math.min(1, (s + 0.55) / 0.9));
    return f < w;
  };
  const coat = counter(orangeD, orange, white, -0.4, 0.15);
  b.on('body', (g) => {
    sweep(
      g,
      Z(torso({ b: d.backZ, f: d.frontZ, w: 0.17, d: 0.15, chest: 1.55, hump: 0.03, level: 0.02, neck: [0.12, 0.47], neckW: 0.9, neckD: 0.92, rump: 0.12 })),
      (_t, s, _c, p) => (stripe(p, s, 15, 0.28) ? black : tone(coat(s), grain(p, 0.05))),
      { around: 22, sub: 6, fur: { k: 0.1, chance: 0.5 } },
    );
  });
  const big = new THREE.Matrix4().makeScale(1.2, 1.2, 1.2);
  b.on('head', (g) => g.at(big, () => {
    sweep(
      g,
      Z([
        [-0.1, 0.0, 0.1, 0.11, 0.11],
        [-0.03, 0.02, 0.15, 0.14, 0.13],
        [0.05, 0.02, 0.16, 0.135, 0.125],
        [0.11, 0.0, 0.14, 0.11, 0.105],
        [0.16, -0.028, 0.105, 0.08, 0.085],
        [0.2, -0.042, 0.078, 0.055, 0.06],
        [0.222, -0.047, 0.044, 0.034, 0.035],
      ]),
      (_t, s, c, p) => {
        // 흰 주둥이와 턱, 눈 위 흰 점, 이마와 볼의 검은 줄
        if (p.z > 0.15 && s < 0.35) return white;
        if (s < -0.25) return white;
        const ax = Math.abs(p.x);
        if (s > 0.2 && p.z > 0.1 && p.z < 0.16 && ax > 0.03 && ax < 0.075 && p.y > 0.07) return white;
        if (s > 0.55 && p.z < 0.13) {
          const u = Math.abs(p.x) * 40 + p.z * 18;
          if (Math.abs(((u % 2) + 2) % 2 - 1) < 0.25) return black;
        }
        if (Math.abs(c) > 0.6 && p.z < 0.1 && Math.abs(Math.sin(p.y * 70 + p.z * 20)) < 0.3) return black;
        return tone(orange, grain(p, 0.04));
      },
      { around: 18, sub: 3 },
    );
    g.set({ id: b.next() });
    ball(g, 0, -0.026, 0.222, 0.03, 0.02, 0.016, 0xc87870, 8);
    // 흰 볼털
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const y = -0.05 + i * 0.03;
        tuft(g, v3(s * 0.12, y - 0.01, 0.07 - i * 0.012), v3(s * 0.18, y - 0.035, 0.0), 0.03, (_t, ss) => (ss > 0.3 && i > 1 ? orange : white), { around: 5 });
      }
    }
    for (const s of [1, -1]) {
      g.set({ id: b.next() });
      roundEar(g, s * 0.1, 0.14, -0.035, 0.045, black, 0xf0e6d8, { tilt: -s * 0.35, spot: white });
      eye(g, () => b.next(), s * 0.066, 0.045, 0.14, 0.021, 0xe6b434, { yaw: s * 0.35, em: 0.45 });
    }
  }));
  b.on('jaw', (g) => g.at(big, () => {
    sweep(g, Z([[-0.05, 0, 0.065, 0.02, 0.04], [0.03, -0.008, 0.05, 0.016, 0.03], [0.07, -0.012, 0.03, 0.01, 0.018], [0.085, -0.012, 0.01, 0.006, 0.008]]), (_t, s) => (s > 0.4 ? 0x7a2a2a : white), { around: 12, sub: 2, capA: true });
    g.set({ id: b.next(), spec: 0.3 });
    for (const s of [1, -1]) tuft(g, v3(s * 0.03, 0.005, 0.06), v3(s * 0.032, 0.05, 0.07), 0.011, 0xf8f0e0, { around: 4 });
  }));
  const tailPaint: Paint = (_t, s, _c, p) => {
    const u = p.z * 22;
    const ring = Math.abs((((u % 2) + 2) % 2) - 1) < 0.3;
    return ring ? black : tone(s < -0.4 ? mix(orange, white, 0.5) : orange, grain(p, 0.05));
  };
  b.on('tail', (g) => {
    g.set({ id: b.next(), wind: 0.05 });
    sweep(g, Z([[0.01, 0, 0.045, 0.045, 0.045], [-0.15, 0, 0.042, 0.042, 0.042], [-0.3, 0, 0.038, 0.038, 0.038], [-0.42, 0, 0.036, 0.036, 0.036]]), tailPaint, { around: 12, sub: 4 });
  });
  b.on('tail2', (g) => {
    g.set({ id: b.next(), wind: 0.08 });
    sweep(g, Z([[0.02, 0, 0.036, 0.036, 0.036], [-0.12, 0, 0.036, 0.036, 0.036], [-0.26, 0, 0.034, 0.034, 0.034], [-0.34, 0, 0.03, 0.03, 0.03], [-0.38, 0, 0, 0, 0]]), (t, s, c, p) => (t > 0.7 ? black : tailPaint(t, s, c, p)), { around: 12, sub: 4 });
  });
  const legStripe = (p: THREE.Vector3, s: number) => s > -0.3 && Math.abs((((p.y * 26) % 2) + 2) % 2 - 1) < 0.22;
  legs4(b, d, {
    ...legProf(0.06, { thigh: 1.1, shoulder: 1.15, paw: 1.15 }),
    paint: (front, upper, t, s, p) => (!upper && t > 0.75 ? mix(orange, white, 0.5) : !front && upper && t < 0.7 && legStripe(p, s) ? black : front && upper && t > 0.4 && legStripe(p, s) ? black : orange),
    paw: (g) => paw(g, () => b.next(), 0.055, 0.035, 0.07, mix(orange, white, 0.6)),
    around: 12,
  });
  const rig = quadRig(d, { head: [0.14, 0.53], headRx: 0.08, jaw: [-0.054, 0.168], tail: [0.08, -0.46], tailRx: -1.0, tail2: -0.42, tail2Rx: 0.45 });
  const anims: Record<string, Anim> = {
    idle: anim(idleLoop(8, 0.01, (ph) => ({ 'tail2.rx': 12 * Math.sin(ph), 'tail2.ry': 16 * Math.sin(ph * 0.5 + 1), 'tail.ry': 6 * Math.sin(ph) })), 1.8, true),
    // 머리를 낮추고 미끄러지듯 걷는다
    walk: anim(walk4(8, 0.17, 0.09, { bob: 0.008, roll: 2, yaw: 2, extra: (ph) => ({ 'head.rx': 6 + 2 * Math.cos(2 * ph), 'tail.ry': 6 * Math.cos(ph), 'tail2.ry': 10 * Math.cos(ph - 0.8), 'tail2.rx': 6 }) }), 0.7, true),
    attack: anim(pounceAttack(1.1), 0.55),
    hit: anim(hitAnim(1.1), 0.24),
    death: anim(deathAnim(1.1, 0.34), 0.8),
  };
  return { b, rig, anims };
}

// ======================= 박쥐 =======================
/** 박쥐: 털 뭉치 몸, 큰 귀, 손가락 뼈 사이에 막이 펼쳐진 날개 */
function bat(): Beast {
  const b = new MB();
  const fur = 0x4a3a34;
  const furL = 0x6a5446;
  const wing = 0x2c2228;
  const bone = 0x3e3036;
  b.on('body', (g) => {
    sweep(g, Z([[-0.12, -0.02, 0.0, 0.0, 0.0], [-0.09, -0.01, 0.07, 0.07, 0.07], [0.0, 0.0, 0.1, 0.095, 0.1], [0.08, 0.01, 0.08, 0.08, 0.085], [0.13, 0.02, 0.0, 0.0, 0.0]]), (_t, s, _c, p) => tone(s < -0.2 ? furL : fur, grain(p, 0.12)), { around: 14, sub: 3 });
    // 뒷발
    for (const s of [1, -1]) tuft(g, v3(s * 0.04, -0.06, -0.08), v3(s * 0.05, -0.1, -0.16), 0.014, 0x2a2024, { around: 4 });
  });
  b.on('head', (g) => {
    sweep(g, Z([[-0.05, 0, 0.0, 0.0, 0.0], [-0.03, 0, 0.055, 0.05, 0.05], [0.03, 0.0, 0.06, 0.052, 0.05], [0.08, -0.015, 0.03, 0.026, 0.026], [0.1, -0.02, 0.0, 0.0, 0.0]]), (_t, s, _c, p) => tone(s < -0.3 ? furL : fur, grain(p, 0.1)), { around: 12, sub: 2 });
    g.set({ id: b.next() });
    ball(g, 0, -0.016, 0.095, 0.018, 0.012, 0.01, 0x2a1a1e, 6);
    for (const s of [1, -1]) {
      ear(g, v3(s * 0.03, 0.03, -0.0), v3(s * 0.075, 0.13, -0.02), 0.035, 0x3a2a2e, 0x8a5a5a, { face: v3(s * 0.5, 0, 1) });
      g.set({ id: b.next(), em: 0.9 });
      ball(g, s * 0.03, 0.012, 0.055, 0.011, 0.01, 0.008, 0xff6a3a, 6);
      g.set({ em: 0 });
      g.set({ id: b.next(), spec: 0.3 });
      tuft(g, v3(s * 0.012, -0.03, 0.085), v3(s * 0.013, -0.055, 0.088), 0.005, 0xf4ece0, { around: 4 });
    }
  });
  // 날개: 팔(w1)과 손가락(w2) 두 마디. 막은 몸 옆구리에서 손가락 끝까지 이어진다
  for (const [n1, n2, s] of [['wL', 'wL2', 1], ['wR', 'wR2', -1]] as const) {
    b.on(n1, (g) => {
      g.set({ id: b.next() });
      sweep(g, [S(0, 0, 0.022, 0.022, 0.022, 0), S(0, 0, 0.018, 0.018, 0.018, s * 0.12), S(0, 0, 0.014, 0.014, 0.014, s * 0.22)].map((q, i) => ({ ...q, p: [s * [0, 0.12, 0.22][i], [0, 0.02, 0.01][i], 0] as [number, number, number] })), bone, { around: 6, sub: 2 });
      // 몸과 팔 사이 막
      const A = v3(0, 0, 0.04);
      const B = v3(s * 0.22, 0.01, 0);
      const C = v3(s * 0.2, -0.02, -0.14);
      const D = v3(0, -0.02, -0.1);
      g.quad(A, B, C, D, wing);
      g.quad(A, D, C, B, tone(wing, 0.85));
    });
    b.on(n2, (g) => {
      g.set({ id: b.next() });
      const tips = [v3(s * 0.3, 0.06, 0.02), v3(s * 0.34, -0.02, -0.06), v3(s * 0.26, -0.06, -0.15), v3(s * 0.12, -0.05, -0.18)];
      for (const t of tips) tuft(g, v3(0, 0, 0), t, 0.009, bone, { around: 4 });
      // 손가락 사이 막: 가장자리가 안쪽으로 파인다
      const O = v3(0, 0, 0);
      const root = v3(-s * 0.02, -0.02, -0.14);
      const pts = [tips[0], tips[1].clone().lerp(tips[0], 0.5).multiplyScalar(0.8), tips[1], tips[2].clone().lerp(tips[1], 0.5).multiplyScalar(0.82), tips[2], tips[3].clone().lerp(tips[2], 0.5).multiplyScalar(0.85), tips[3], root];
      for (let i = 0; i < pts.length - 1; i++) {
        g.tri(O, pts[i], pts[i + 1], i % 2 ? tone(wing, 0.9) : wing);
        g.tri(O, pts[i + 1], pts[i], tone(wing, 0.8));
      }
    });
  }
  const rig = () => {
    const r = new Rig();
    const fl = r.node('float', r.root, 0, 0.75, 0);
    const body = r.node('body', fl);
    r.node('head', body, 0, 0.03, 0.12);
    const wL = r.node('wL', body, 0.06, 0.03, 0.02);
    const wR = r.node('wR', body, -0.06, 0.03, 0.02);
    r.node('wL2', wL, 0.22, 0.01, 0);
    r.node('wR2', wR, -0.22, 0.01, 0);
    r.remember();
    return r;
  };
  const flap = (n: number, amp: number, speedK = 1, extra?: (ph: number) => Pose): Pose[] =>
    [...Array(n)].map((_, i) => {
      const ph = (i / n) * Math.PI * 2 * speedK;
      const w = Math.sin(ph);
      return {
        'float.py': 0.05 * Math.sin(ph + 1.6),
        'wL.rz': amp * w,
        'wR.rz': -amp * w,
        'wL2.rz': amp * 0.6 * Math.sin(ph - 0.9),
        'wR2.rz': -amp * 0.6 * Math.sin(ph - 0.9),
        'wL.ry': 10 * Math.cos(ph),
        'wR.ry': -10 * Math.cos(ph),
        'body.rx': 6 * Math.cos(ph),
        ...(extra ? extra(ph) : {}),
      };
    });
  const anims: Record<string, Anim> = {
    idle: anim(flap(8, 48), 0.5, true),
    walk: anim(flap(8, 55, 1, () => ({ 'float.rx': 14 })), 0.4, true),
    attack: anim(keys(8, [
      [0, { 'float.py': 0.08, 'float.pz': -0.06, 'float.rx': -14, 'wL.rz': 60, 'wR.rz': -60, 'wL2.rz': 30, 'wR2.rz': -30 }],
      [2, { 'float.py': 0.14, 'float.pz': -0.12, 'float.rx': -24, 'wL.rz': 70, 'wR.rz': -70, 'wL2.rz': 40, 'wR2.rz': -40, 'head.rx': -16 }, 'in'],
      [4, { 'float.py': -0.16, 'float.pz': 0.22, 'float.rx': 38, 'wL.rz': -30, 'wR.rz': 30, 'wL2.rz': -40, 'wR2.rz': 40, 'head.rx': 14 }, 'out'],
      [6, { 'float.py': -0.06, 'float.pz': 0.12, 'float.rx': 12, 'wL.rz': 40, 'wR.rz': -40, 'wL2.rz': 10, 'wR2.rz': -10 }],
      [7, { 'float.py': 0.0, 'float.pz': 0.04, 'wL.rz': 20, 'wR.rz': -20 }],
    ]), 0.5),
    hit: anim(keys(3, [
      [0, { 'float.py': 0.06, 'float.pz': -0.1, 'float.rx': -24, 'float.rz': 14, 'wL.rz': 70, 'wR.rz': -40 }],
      [1, { 'float.py': 0.02, 'float.pz': -0.12, 'float.rx': -12, 'float.rz': 6, 'wL.rz': 30, 'wR.rz': -20 }],
      [2, { 'float.pz': -0.05, 'wL.rz': 10, 'wR.rz': -10 }],
    ]), 0.24),
    death: anim(keys(8, [
      [0, { 'float.py': 0.05, 'float.rx': -20, 'wL.rz': 70, 'wR.rz': -70 }],
      [2, { 'float.py': -0.1, 'float.rz': 40, 'float.rx': 20, 'wL.rz': 20, 'wR.rz': -80 }, 'in'],
      [4, { 'float.py': -0.5, 'float.rz': 120, 'float.rx': 40, 'wL.rz': -20, 'wR.rz': -40 }, 'in'],
      [5, { 'float.py': -0.68, 'float.rz': 170, 'float.rx': 10, 'wL.rz': -40, 'wR.rz': 40 }],
      [7, { 'float.py': -0.66, 'float.rz': 175, 'float.rx': 10, 'wL.rz': -50, 'wR.rz': 50, 'wL2.rz': -30, 'wR2.rz': 30 }],
    ]), 0.7),
  };
  return { b, rig, anims, fly: true, fur: 0.8 };
}

// ======================= 구미호 =======================
/** 구미호: 금빛이 도는 흰 여우. 꼬리 아홉이 부채처럼 펼쳐지고 끝마다 푸른 여우불 */
function gumiho(): Beast {
  const white = 0xf4eee4;
  const gold = 0xe0caa0;
  const red = 0xd8303a;
  const d: Dims = { bodyH: 0.48, hipX: 0.08, frontZ: 0.25, backZ: -0.26, upper: 0.23, lower: 0.24, shift: 0.02 };
  const coat = counter(gold, white, 0xfaf6ee, -0.3, 0.3);
  const N = 9;
  const { b, rig: baseRig } = canid({
    d,
    head: [0.27, 0.45],
    body: torso({ b: d.backZ, f: d.frontZ, w: 0.11, d: 0.1, chest: 1.5, neck: [0.25, 0.42], neckW: 0.72, neckD: 0.8 }),
    bodyPaint: (_t, s, _c, p) => tone(coat(s), grain(p, 0.04)),
    skull: [
      [-0.07, -0.01, 0.052, 0.058, 0.058],
      [-0.02, 0.01, 0.082, 0.078, 0.072],
      [0.05, 0.02, 0.094, 0.082, 0.076],
      [0.12, 0.01, 0.07, 0.062, 0.06],
      [0.2, -0.012, 0.043, 0.04, 0.04],
      [0.28, -0.026, 0.027, 0.027, 0.029],
      [0.315, -0.03, 0.014, 0.014, 0.016],
    ],
    // 이마의 붉은 불꽃 무늬와 눈가의 붉은 선
    headPaint: (_t, s, c, p) => {
      if (s > 0.6 && p.z > 0.0 && p.z < 0.12 && Math.abs(p.x) < 0.012 + (0.12 - p.z) * 0.12) return red;
      if (Math.abs(c) > 0.55 && s > -0.1 && s < 0.4 && p.z > 0.12 && p.z < 0.2) return red;
      return tone(s > 0.6 ? gold : white, grain(p, 0.03));
    },
    jawSecs: [[-0.05, 0, 0.044, 0.018, 0.03], [0.06, -0.004, 0.034, 0.014, 0.024], [0.15, -0.008, 0.019, 0.01, 0.014], [0.185, -0.008, 0.006, 0.005, 0.006]],
    jawAt: [-0.035, 0.115],
    jawPaint: (_t, s) => (s > 0.4 ? 0x8a2a3a : white),
    eyes: { x: 0.054, y: 0.036, z: 0.13, r: 0.018, iris: 0xff3a4a, slit: true, em: 1 },
    nose: [0, -0.026, 0.315],
    ears: { base: [0.05, 0.065, 0.0], tip: [0.095, 0.24, -0.035], w: 0.05, back: gold, inner: 0xf8d8d8, tipCol: red },
    // 기본 꼬리는 짧은 뿌리만. 아홉 꼬리는 따로 단다
    tail: {
      at: [0.08, -0.35], rx: 0.5, len1: -0.08, rx2: 0,
      s1: [[0.01, 0, 0.05, 0.05, 0.05], [-0.06, 0, 0.07, 0.07, 0.07], [-0.09, 0, 0.06, 0.06, 0.06]],
      s2: [[0.0, 0, 0.0, 0.0, 0.0], [0.001, 0, 0.0, 0.0, 0.0]],
      paint: white,
    },
    legs: {
      ...legProf(0.04, { thigh: 1.1 }),
      paint: (_f, upper, t, s) => (!upper && t > 0.4 ? gold : s > 0.4 ? mix(white, gold, 0.4) : white),
      paw: [0.027, 0.02, 0.045, gold, 0xe8d0d0],
    },
    deco: (b) => {
      // 목에 두른 붉은 끈과 방울
      b.on('body', (g) => {
        g.set({ id: b.next() });
        sweep(g, [S(0.33, 0.17, 0.085, 0.085, 0.1), S(0.35, 0.2, 0.08, 0.08, 0.095)], red, { around: 16, sub: 1 });
        g.set({ id: b.next(), spec: 0.8, em: 0.2 });
        ball(g, 0, 0.08, 0.41, 0.025, 0.025, 0.025, 0xe8c050, 8);
        g.set({ em: 0, spec: 0 });
      });
      for (let i = 0; i < N; i++) {
        b.on(`t${i}`, (g) => {
          g.set({ id: b.next(), wind: 0.3 });
          const r = rng(31 + i);
          const curl = (r() - 0.5) * 0.12;
          const secs = [
            S(0.0, 0.0, 0.05, 0.05, 0.05),
            S(-0.12, 0.06, 0.1, 0.095, 0.095),
            S(-0.26, 0.16, 0.13, 0.12, 0.12),
            S(-0.38, 0.3, 0.12, 0.11, 0.11, curl),
            S(-0.42, 0.44, 0.08, 0.075, 0.075, curl * 1.5),
            S(-0.38, 0.54, 0.025, 0.025, 0.025, curl * 2),
            S(-0.35, 0.56, 0.0, 0.0, 0.0, curl * 2),
          ];
          // 털 다발 결: 둘레를 따라 밝고 어두운 줄
          sweep(g, secs, (t, s, c, p) => (t > 0.86 ? 0xd8f0ff : tone(s > 0.3 ? white : gold, 1 + 0.07 * Math.sin(Math.atan2(s, c) * 5 + t * 7) + (grain(p, 0.04) - 1))), { around: 12, sub: 3, upRef: v3(1, 0, 0), fur: { k: 0.3, dir: 1, mask: (t) => t < 0.8 } });
          g.set({ id: b.next(), em: 1, wind: 0.7 });
          flameBlob(g, curl * 2, 0.6, -0.35, 0.045, 0.16, i % 2 ? 0x7fd0ff : 0x4aa8ff, 0xf0fbff);
          g.set({ em: 0, wind: 0 });
        });
      }
    },
  });
  const rig = () => {
    const q = baseRig();
    const tail = q.nodes.tail;
    for (let i = 0; i < N; i++) {
      const n = q.node(`t${i}`, tail, 0, 0, -0.04);
      const a = (i - (N - 1) / 2) / ((N - 1) / 2);
      n.rotation.y = a * 0.95;
      n.rotation.x = -0.25 - 0.15 * (1 - Math.abs(a));
      n.rotation.z = a * 0.35;
    }
    q.remember();
    return q;
  };
  // 꼬리 아홉이 물결치며 흔들린다
  const tails = (ph: number, amp: number, lift = 0): Pose => {
    const p: Pose = {};
    for (let i = 0; i < N; i++) {
      p[`t${i}.rx`] = -lift + amp * 0.5 * Math.sin(ph + i * 0.7);
      p[`t${i}.ry`] = amp * Math.sin(ph * 0.5 + i * 0.5) * 0.6;
    }
    return p;
  };
  const base = canidAnims(1.2, { stride: 0.15, lift: 0.08, dur: 0.5, tailWag: 0 });
  const withTails = (poses: Pose[], amp: number, lift = 0) => poses.map((p, i) => ({ ...tails((i / poses.length) * Math.PI * 2, amp, lift), ...p }));
  const anims: Record<string, Anim> = {
    idle: anim(withTails(base.idle.poses, 10), 1.6, true),
    walk: anim(withTails(base.walk.poses, 14), 0.5, true),
    attack: anim(withTails(base.attack.poses, 12), 0.5),
    hit: anim(withTails(base.hit.poses, 18), 0.24),
    death: anim(withTails(base.death.poses, 6, -30), 0.8),
    // 몸을 비틀어 꼬리로 후려친다
    sweep: anim(
      keys(9, [
        [0, { Bry: 0, 'head.ry': 0, ...tails(0, 8) }],
        [2, { Bry: -24, By: -0.05, 'head.ry': 18, 'tail.ry': -30, ...tails(1, 10, -10) }, 'in'],
        [4, { Bry: 34, By: -0.02, 'head.ry': -22, 'tail.ry': 70, 'tail.rx': 10, ...tails(2, 22, 10) }, 'out'],
        [6, { Bry: 18, 'head.ry': -10, 'tail.ry': 40, ...tails(3, 14) }],
        [8, { Bry: 0, 'tail.ry': 0, ...tails(4, 8) }],
      ]),
      0.7,
    ),
    // 뛰어올라 짓누른다
    slam: anim(rearSlam(1.2, 1).map((p, i) => ({ ...tails(i, 16, 20), ...p })), 0.9),
    // 고개를 쳐들고 꼬리를 활짝 펼쳐 여우불을 부른다
    cast: anim(
      keys(8, [
        [0, { 'head.rx': 0, ...tails(0, 8) }],
        [2, { By: -0.06, Brx: 4, 'head.rx': 12, 'jaw.rx': 6, ...tails(1, 6, -10) }, 'in'],
        [4, { By: 0.04, Brx: -16, 'head.rx': -40, 'jaw.rx': 34, FLy: 0.06, ...tails(2, 4, 35) }, 'out'],
        [6, { By: 0.02, Brx: -10, 'head.rx': -30, 'jaw.rx': 26, ...tails(3, 8, 30) }],
        [7, { Brx: -2, 'head.rx': -6, 'jaw.rx': 6, ...tails(4, 8, 10) }],
      ]),
      0.8,
    ),
  };
  return { b, rig, anims };
}

// ======================= 불가사리 =======================
/** 불가사리: 쇠를 먹는 짐승. 곰의 몸에 쇠바늘 털, 코끼리 코, 코뿔소 눈, 소꼬리, 범의 다리. 갈라진 틈에서 쇳물 빛 */
function bulgasari(): Beast {
  const iron = 0x4e5058;
  const ironD = 0x30323a;
  const rust = 0x7a5640;
  const molten = 0xff7a2a;
  const seam = (p: THREE.Vector3) => Math.abs(Math.sin(p.z * 23 + Math.sin(p.y * 13) * 1.4 + p.x * 9)) < 0.07;
  const b = bearBody({
    fur: iron, furD: ironD, muzzle: 0x5a5c66, eye: molten, eyeEm: 1, mane: false, furLen: 0,
    bodyPaint: (_t, s, _c, p) => {
      if (seam(p) && s < 0.7) return molten;
      const r = Math.sin(p.x * 47 + p.z * 31) * Math.sin(p.y * 29 - p.z * 17);
      return tone(r > 0.45 ? rust : s > 0.5 ? ironD : iron, grain(p, 0.12));
    },
    // 범의 다리: 쇳빛에 녹슨 가로 줄
    legPaint: (_f, _u, _t, s, p) => (s > -0.2 && Math.abs((((p.y * 22) % 2) + 2) % 2 - 1) < 0.25 ? rust : tone(iron, grain(p, 0.1))),
  });
  b.on('body', (g) => {
    // 등줄기의 쇠바늘
    const r = rng(9);
    g.set({ id: b.next(), spec: 0.9 });
    for (let i = 0; i < 18; i++) {
      const z = 0.34 - i * 0.04;
      const top = 0.37 + 0.03 * Math.sin((i / 17) * Math.PI);
      const l = 0.08 + r() * 0.05 + 0.06 * Math.sin((i / 17) * Math.PI);
      for (const s of [-1, 0, 1]) {
        if (s && i % 2) continue;
        tuft(g, v3(s * 0.07, top - Math.abs(s) * 0.035, z), v3(s * 0.12, top + l * (s ? 0.7 : 1), z - 0.07), 0.018, s ? 0x6a6c76 : 0x84868e, { around: 4 });
      }
    }
    g.set({ spec: 0 });
  });
  b.on('tail', (g) => {
    // 소꼬리: 가늘고 길며 끝에 쇠술
    g.set({ id: b.next(), spec: 0.5 });
    sweep(g, Z([[0.0, 0, 0.03, 0.03, 0.03], [-0.15, -0.08, 0.022, 0.022, 0.022], [-0.28, -0.22, 0.016, 0.016, 0.016], [-0.34, -0.34, 0.014, 0.014, 0.014]]), ironD, { around: 6, sub: 3 });
    for (let i = 0; i < 5; i++) tuft(g, v3(0, -0.34, -0.34), v3((i - 2) * 0.025, -0.48, -0.36 + (i % 2) * 0.03), 0.018, 0x8a8c96, { around: 4 });
    g.set({ spec: 0 });
  });
  b.on('head', (g) => {
    // 코뿔소 같은 작은 쇠뿔 둘
    g.set({ id: b.next(), spec: 0.8 });
    tuft(g, v3(0, 0.03, 0.22), v3(0, 0.17, 0.2), 0.04, 0x9a9ca6, { around: 6, bend: v3(0, 0, -0.03) });
    tuft(g, v3(0, 0.1, 0.12), v3(0, 0.2, 0.08), 0.03, 0x8a8c96, { around: 6 });
    g.set({ spec: 0 });
  });
  // 코끼리 코: 머리 끝에서 두 마디로 늘어진다
  b.on('trunk', (g) => {
    g.set({ id: b.next(), spec: 0.4 });
    sweep(g, [S(0.0, 0.0, 0.06, 0.06, 0.06), S(0.06, -0.06, 0.052, 0.052, 0.052), S(0.08, -0.16, 0.046, 0.046, 0.046), S(0.08, -0.22, 0.042, 0.042, 0.042)], (_t, _s, _c, p) => (Math.abs(Math.sin(p.y * 90)) < 0.3 ? ironD : iron), { around: 10, sub: 3, upRef: v3(1, 0, 0) });
  });
  b.on('trunk2', (g) => {
    g.set({ id: b.next(), spec: 0.4 });
    sweep(g, [S(0.0, 0.0, 0.042, 0.042, 0.042), S(0.0, -0.09, 0.036, 0.036, 0.036), S(0.03, -0.17, 0.03, 0.03, 0.03), S(0.07, -0.2, 0.026, 0.026, 0.026)], (_t, _s, _c, p) => (Math.abs(Math.sin(p.y * 90)) < 0.3 ? ironD : iron), { around: 10, sub: 3, upRef: v3(1, 0, 0) });
    g.set({ id: b.next(), em: 1 });
    ball(g, 0.07, -0.2, 0.0, 0.03, 0.02, 0.03, molten, 6);
    g.set({ em: 0 });
  });
  const rig = bearRig((q: any) => {
    const t = q.node('trunk', q.nodes.head, 0, -0.04, 0.3);
    t.rotation.x = 0.2;
    q.node('trunk2', t, 0, -0.22, 0.08);
  });
  const a = bearAnims(1.15);
  const trunkSw = (poses: Pose[], amp: number) => poses.map((p, i) => ({ 'trunk.rx': amp * Math.sin((i / poses.length) * Math.PI * 2), 'trunk2.rx': amp * 1.4 * Math.sin((i / poses.length) * Math.PI * 2 - 0.9), ...p }));
  const anims: Record<string, Anim> = {
    idle: anim(trunkSw(a.idle.poses, 8), 2.0, true),
    walk: anim(trunkSw(a.walk.poses, 14), 0.85, true),
    attack: anim(trunkSw(a.attack.poses, 20), 0.6),
    hit: anim(trunkSw(a.hit.poses, 20), 0.24),
    death: anim(trunkSw(a.death.poses, 10), 0.9),
    // 머리와 코를 옆으로 휘둘러 쓸어 버린다
    sweep: anim(
      keys(9, [
        [0, { 'head.ry': 0, 'trunk.ry': 0 }],
        [2, { Bry: -20, By: -0.04, 'head.ry': 34, 'head.rx': 10, 'trunk.ry': 30, 'trunk.rx': -20, 'trunk2.rx': -30 }, 'in'],
        [4, { Bry: 26, By: -0.02, 'head.ry': -40, 'head.rx': 4, 'trunk.ry': -50, 'trunk.rx': -40, 'trunk2.rx': -40, 'jaw.rx': 20 }, 'out'],
        [6, { Bry: 12, 'head.ry': -18, 'trunk.ry': -20, 'trunk.rx': -10, 'jaw.rx': 8 }],
        [8, { Bry: 0, 'head.ry': 0, 'trunk.ry': 0 }],
      ]),
      0.7,
    ),
    slam: anim(trunkSw(rearSlam(1.15, 1), 26), 0.9),
    // 고개를 쳐들고 코를 높이 세워 울부짖는다
    cast: anim(
      keys(8, [
        [0, {}],
        [2, { By: -0.06, Brx: 4, 'head.rx': 10, 'trunk.rx': 10, 'trunk2.rx': 10 }, 'in'],
        [4, { By: 0.03, Brx: -12, 'head.rx': -30, 'jaw.rx': 30, 'trunk.rx': -70, 'trunk2.rx': -60, Brz: 3 }, 'out'],
        [5, { By: 0.03, Brx: -12, 'head.rx': -28, 'jaw.rx': 32, 'trunk.rx': -74, 'trunk2.rx': -64, Brz: -3 }],
        [6, { By: 0.02, Brx: -10, 'head.rx': -24, 'jaw.rx': 26, 'trunk.rx': -60, 'trunk2.rx': -50, Brz: 3 }],
        [7, { Brx: -2, 'head.rx': -4, 'jaw.rx': 4, 'trunk.rx': -10 }],
      ]),
      0.8,
    ),
  };
  return { b, rig, anims, fur: 0.35 };
}

export const BEASTS: Record<string, () => Beast> = {
  squirrel, raccoon: raccoonDog, boar, fox, wolf, dhole, bear, tiger, bat, gumiho, bulgasari,
};
