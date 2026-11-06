// 짐승을 짓는 공통 도구: 단면을 이어 붙인 매끈한 몸, 귀·털 뭉치, 걸음과 공격 동작.
import * as THREE from 'three';
import { bakeKeys, trotFrames } from '@bake/rig.js';
import { Geo, mix, tone, v3, type Hex } from './geo';

/** 뼈 이름별로 정점을 모은다. 부위마다 외곽선 번호를 새로 준다 */
export class MB {
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

/** 단면 하나: 중심, 옆 반지름, 위(앞) 반지름, 아래(뒤) 반지름, 네모진 정도 */
export interface Sec {
  p: [number, number, number];
  w: number;
  up: number;
  dn: number;
  sq?: number;
}

/** 칠하기: t는 길이 방향 0~1, s는 위(+1)·아래(-1), c는 옆(+1이 +x 쪽), p는 정점 위치 */
export type Paint = (t: number, s: number, c: number, p: THREE.Vector3) => Hex;

const cr = (a: number, b: number, c: number, d: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
};

const flatSec = (s: Sec) => [s.p[0], s.p[1], s.p[2], s.w, s.up, s.dn, s.sq ?? 1];

/** 단면 사이를 부드러운 곡선으로 잘게 나눈다 */
function densify(secs: Sec[], sub: number): number[][] {
  const a = secs.map(flatSec);
  const out: number[][] = [];
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = a[Math.max(0, i - 1)];
    const p1 = a[i];
    const p2 = a[i + 1];
    const p3 = a[Math.min(n - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      out.push(p1.map((_, q) => Math.max(q >= 3 ? 0 : -1e9, cr(p0[q], p1[q], p2[q], p3[q], t))));
    }
  }
  out.push(a[n - 1]);
  return out;
}

/** 털결 잡티: 정점 위치마다 조금씩 다른 밝기 */
export function grain(p: THREE.Vector3, amt = 0.07) {
  const h = Math.sin(p.x * 127.1 + p.y * 311.7 + p.z * 74.7) * 43758.5453;
  return 1 + (h - Math.floor(h) - 0.5) * 2 * amt;
}

/**
 * 단면을 이어 붙인 매끈한 덩어리. 길이 방향 곡선을 따라 단면이 돌아간다.
 * upRef는 단면의 '위'가 향할 쪽 (몸통은 +y, 다리는 앞쪽).
 */
/** 털: k는 몸 반지름 대비 털 길이, dir은 털이 눕는 쪽 (+1이면 단면 순서 방향, -1이면 반대) */
export type Fur = { k: number; chance?: number; dir?: number; seed?: number; mask?: (t: number, s: number) => boolean };

export function sweep(g: Geo, secs: Sec[], paint: Paint | Hex, opt: { around?: number; sub?: number; upRef?: THREE.Vector3; capA?: boolean; capB?: boolean; fur?: Fur } = {}) {
  const around = opt.around ?? 14;
  const rows = densify(secs, opt.sub ?? 3);
  const upRef = (opt.upRef ?? v3(0, 1, 0)).clone().normalize();
  const n = rows.length;
  const P: THREE.Vector3[][] = [];
  const C: Hex[][] = [];
  const tan = v3();
  const side = v3();
  const up = v3();
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const a = rows[Math.max(0, i - 1)];
    const b = rows[Math.min(n - 1, i + 1)];
    tan.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (tan.lengthSq() < 1e-12) tan.set(0, 0, 1);
    tan.normalize();
    side.crossVectors(upRef, tan);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize();
    up.crossVectors(tan, side).normalize();
    const row: THREE.Vector3[] = [];
    const crow: Hex[] = [];
    const t = n > 1 ? i / (n - 1) : 0;
    const e = 1 / Math.max(0.3, r[6]);
    for (let j = 0; j < around; j++) {
      const ang = (j / around) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const cx = Math.sign(c) * Math.abs(c) ** e;
      const sy = Math.sign(s) * Math.abs(s) ** e;
      const p = v3(r[0], r[1], r[2])
        .addScaledVector(side, cx * r[3])
        .addScaledVector(up, sy * (s > 0 ? r[4] : r[5]));
      row.push(p);
      crow.push(typeof paint === 'function' ? paint(t, s, c, p) : paint);
    }
    P.push(row);
    C.push(crow);
  }
  const f = opt.fur;
  const fur = f
    ? {
        k: f.k,
        chance: f.chance ?? 0.55,
        dir: f.dir ?? -1,
        seed: f.seed ?? n * 31 + around,
        mask: f.mask ? (i: number, j: number) => f.mask!(i / (n - 1), Math.sin((j / around) * Math.PI * 2)) : undefined,
      }
    : undefined;
  g.surface(P, (i, j) => C[i][j], { capA: opt.capA, capB: opt.capB, fur });
}

/** 타원 공 */
export function ball(g: Geo, x: number, y: number, z: number, rx: number, ry: number, rz: number, paint: Paint | Hex, around = 10) {
  const secs: Sec[] = [];
  const k = 6;
  for (let i = 0; i <= k; i++) {
    const u = -1 + (2 * i) / k;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    secs.push({ p: [x, y, z + u * rz], w: rx * r, up: ry * r, dn: ry * r });
  }
  sweep(g, secs, paint, { around, sub: 2 });
}

/** 길쭉한 털 뭉치·발톱·가시: 뿌리에서 끝으로 가늘어진다 */
export function tuft(g: Geo, base: THREE.Vector3, tip: THREE.Vector3, w: number, paint: Paint | Hex, opt: { bend?: THREE.Vector3; flat?: number; around?: number; upRef?: THREE.Vector3 } = {}) {
  const mid = base.clone().lerp(tip, 0.5).add(opt.bend ?? v3());
  const f = opt.flat ?? 1;
  const secs: Sec[] = [
    { p: [base.x, base.y, base.z], w, up: w * f, dn: w * f },
    { p: [mid.x, mid.y, mid.z], w: w * 0.75, up: w * 0.75 * f, dn: w * 0.75 * f },
    { p: [tip.x, tip.y, tip.z], w: 0, up: 0, dn: 0 },
  ];
  const dir = tip.clone().sub(base).normalize();
  const upRef = opt.upRef ?? (Math.abs(dir.y) > 0.9 ? v3(0, 0, 1) : v3(0, 1, 0));
  sweep(g, secs, paint, { around: opt.around ?? 6, sub: 2, upRef });
}

/**
 * 귀: 뿌리에서 끝으로 뻗는 납작한 판. 앞면(안쪽)과 뒷면을 다르게 칠한다.
 * round가 클수록 끝이 둥글다.
 */
export function ear(g: Geo, base: THREE.Vector3, tip: THREE.Vector3, w: number, back: Hex, inner: Hex, opt: { round?: number; face?: THREE.Vector3; thick?: number; tipCol?: Hex } = {}) {
  const r = opt.round ?? 0;
  const th = opt.thick ?? w * 0.32;
  const face = opt.face ?? v3(0, 0, 1);
  const P = (t: number) => base.clone().lerp(tip, t);
  const ws = r > 0 ? [1, 0.96, 0.82 + 0.1 * r, 0.5 + 0.3 * r, 0.0] : [1, 0.84, 0.6, 0.3, 0.0];
  const ts = [0, 0.25, 0.55, 0.82, 1];
  const secs: Sec[] = ts.map((t, i) => {
    const p = P(t);
    return { p: [p.x, p.y, p.z], w: w * ws[i], up: th * (1 - t * 0.6), dn: th * 0.5 * (1 - t * 0.6) };
  });
  // 위(+) 쪽이 face 방향 = 귀 안쪽
  sweep(g, secs, (t, s) => (opt.tipCol !== undefined && t > 0.72 ? opt.tipCol : s > 0.35 ? (t > 0.15 && t < 0.85 ? inner : tone(inner, 0.85)) : back), { around: 10, sub: 2, upRef: face });
}

/** 불꽃: 아래가 둥글고 위로 뾰족한 덩어리. 가운데로 갈수록 밝다 */
export function flameBlob(g: Geo, x: number, y: number, z: number, r: number, h: number, outer: Hex, core: Hex) {
  const secs: Sec[] = [
    { p: [x, y - r * 0.6, z], w: 0, up: 0, dn: 0 },
    { p: [x, y - r * 0.35, z], w: r * 0.75, up: r * 0.75, dn: r * 0.75 },
    { p: [x, y, z], w: r, up: r, dn: r },
    { p: [x, y + h * 0.35, z], w: r * 0.72, up: r * 0.72, dn: r * 0.72 },
    { p: [x, y + h * 0.7, z], w: r * 0.3, up: r * 0.3, dn: r * 0.3 },
    { p: [x, y + h, z], w: 0, up: 0, dn: 0 },
  ];
  sweep(g, secs, (t) => mix(core, outer, Math.min(1, Math.abs(t - 0.32) * 2.2)), { around: 8, sub: 2, upRef: v3(0, 0, 1) });
}

/** 둥근 귀: 털 뭉치 같은 반구. 앞(+z)은 안쪽 털색, 뒤는 겉털색 */
export function roundEar(g: Geo, x: number, y: number, z: number, r: number, back: Hex, front: Hex, opt: { tilt?: number; flat?: number; spot?: Hex } = {}) {
  const tilt = opt.tilt ?? 0;
  const fl = opt.flat ?? 0.55;
  const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(tilt));
  g.at(m, () => {
    ball(g, 0, 0, 0, r, r * 1.05, r * fl, (_t, s, c, p) => {
      if (p.z > r * fl * 0.25 && s < 0.75) return front;
      if (opt.spot !== undefined && p.z < -r * fl * 0.5 && Math.abs(c) < 0.5 && Math.abs(s) < 0.5) return opt.spot;
      return back;
    }, 12);
  });
}

/** 눈: 홍채, 동공, 반짝이 */
export function eye(g: Geo, ids: () => number, x: number, y: number, z: number, r: number, iris: Hex, opt: { yaw?: number; em?: number; pupil?: Hex; slit?: boolean } = {}) {
  const yaw = opt.yaw ?? 0;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  g.set({ id: ids(), em: opt.em ?? 0.25, spec: 0.6 });
  ball(g, x, y, z, r, r * 0.86, r * 0.7, iris, 8);
  g.set({ em: 0 });
  const pr = opt.slit ? r * 0.28 : r * 0.55;
  ball(g, x + fx * r * 0.62, y, z + fz * r * 0.62, pr, r * 0.66, r * 0.2, opt.pupil ?? 0x0c0808, 6);
  g.set({ em: 1, spec: 0 });
  ball(g, x + fx * r * 0.7 + r * 0.25 * Math.sign(x || 1), y + r * 0.35, z + fz * r * 0.7, r * 0.2, r * 0.2, r * 0.1, 0xfff8ec, 4);
  g.set({ em: 0 });
}

/**
 * 다리 한 마디: 뼈의 -y로 뻗는다. front는 다리 앞쪽이 뼈 지역 z의 어느 부호인지 (무릎 굽는 쪽 pole과 같다).
 * prof: [길이 비율, 옆 반지름, 앞 반지름, 뒤 반지름, 앞으로 밀기?]. 비율은 0보다 작거나 1보다 커도 된다(관절을 덮는다).
 */
export function limbSeg(g: Geo, len: number, prof: number[][], paint: Paint | Hex, opt: { around?: number; front?: number } = {}) {
  const f = opt.front ?? -1;
  const secs: Sec[] = prof.map(([t, w, a, b, off]) => ({ p: [0, -t * len, (off ?? 0) * f], w, up: a, dn: b }));
  sweep(g, secs, paint, { around: opt.around ?? 10, sub: 2, upRef: v3(0, 0, f), capA: true, capB: true });
}

/**
 * 다리 단면 표준형. lw는 굵기 기준(발목 반지름쯤), 0~1 비율에 맞춰 늘어난다.
 * 앞다리: 어깨와 위팔이 굵고 팔꿈치 아래로 가늘다. 뒷다리: 넓적다리가 앞으로 불룩하고 뒤꿈치에서 꺾인다.
 */
export function legProf(lw: number, k: { thigh?: number; shoulder?: number; paw?: number } = {}) {
  const th = k.thigh ?? 1;
  const sh = k.shoulder ?? 1;
  const L = (rows: number[][]) => rows.map(([t, w, a, b, o]) => [t, w * lw, a * lw, b * lw, (o ?? 0) * lw]);
  return {
    fu: L([[-0.1, 1.5 * sh, 1.5 * sh, 1.7 * sh], [0.2, 1.45 * sh, 1.5 * sh, 1.55 * sh, 0.2], [0.55, 1.05, 1.1, 1.15], [1.0, 0.8, 0.8, 0.9], [1.12, 0.62, 0.6, 0.62]]),
    fl: L([[-0.08, 0.82, 0.8, 0.92], [0.2, 0.75, 0.72, 0.85], [0.7, 0.56, 0.56, 0.58], [1.0, 0.54 * (k.paw ?? 1), 0.56, 0.56]]),
    bu: L([[-0.12, 1.6 * th, 1.7 * th, 1.9 * th], [0.18, 1.6 * th, 2.0 * th, 1.7 * th, 0.35], [0.45, 1.1 * th, 1.25 * th, 1.05 * th, 0.3], [0.78, 0.68, 0.62, 0.78], [1.0, 0.6, 0.55, 0.72], [1.1, 0.52, 0.5, 0.56]]),
    bl: L([[-0.06, 0.6, 0.58, 0.68], [0.3, 0.55, 0.55, 0.6], [1.0, 0.52 * (k.paw ?? 1), 0.55, 0.55]]),
  };
}

/** 발: 발 마디 공간(몸과 같은 방향)에서 앞으로 놓인 둥근 발과 발톱 */
export function paw(g: Geo, ids: () => number, w: number, h: number, l: number, col: Hex, opt: { claw?: Hex; toes?: number; heel?: number } = {}) {
  const heel = opt.heel ?? 0;
  sweep(
    g,
    [
      { p: [0, 0.0, -l * 0.5 - heel], w: w * 0.6, up: h * 0.7, dn: h * 0.3 },
      { p: [0, 0.0, -l * 0.1 - heel * 0.5], w: w * 0.92, up: h, dn: h * 0.4 },
      { p: [0, -0.002, l * 0.45], w, up: h * 0.85, dn: h * 0.4 },
      { p: [0, -0.006, l * 0.9], w: w * 0.7, up: h * 0.45, dn: h * 0.3 },
      { p: [0, -0.008, l * 1.02], w: 0.0, up: 0, dn: 0 },
    ],
    (_t, s) => (s < -0.5 ? tone(col, 0.7) : col),
    { around: 10, sub: 2 },
  );
  if (opt.claw !== undefined) {
    g.set({ id: ids(), spec: 0.4 });
    const n = opt.toes ?? 4;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * w * 1.3;
      tuft(g, v3(x, h * 0.2, l * 0.85), v3(x * 1.1, -h * 0.25, l * 1.12), w * 0.14, opt.claw, { around: 4 });
    }
    g.set({ spec: 0 });
  }
}

// ---------- 동작 ----------

export type Pose = Record<string, number>;
export type Anim = { frames: number; dur: number; poses: Pose[]; loop?: boolean };
export const anim = (poses: Pose[], dur: number, loop = false): Anim => ({ frames: poses.length, dur, poses, loop });
export const keys = (n: number, k: [number, Pose, string?][], loop = false) => bakeKeys(n, k, {}, loop) as Pose[];
const LEGS = ['FL', 'FR', 'BL', 'BR'] as const;

/** 숨쉬기와 두리번거림. extra로 꼬리·귀를 더한다 */
export function idleLoop(n: number, amp: number, extra?: (ph: number) => Pose): Pose[] {
  const out: Pose[] = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * Math.PI * 2;
    out.push({
      By: -amp * (0.5 - 0.5 * Math.cos(ph)),
      Brx: 0.6 * Math.sin(ph),
      'head.rx': 2 * Math.sin(ph + 0.6),
      'head.ry': 7 * Math.sin(ph * 0.5 + 0.3) ** 3,
      ...(extra ? extra(ph) : {}),
    });
  }
  return out;
}

/** 걸음: 대각선 다리끼리 함께 (개과·멧돼지) */
export function trot(n: number, stride: number, lift: number, bob: number, extra?: (ph: number, c: number, s: number) => Pose): Pose[] {
  return trotFrames(n, { stride, lift, bob, extra }) as Pose[];
}

/**
 * 네 박자 걸음 (고양잇과·곰): 뒷다리가 먼저, 같은 쪽 앞다리가 뒤따른다.
 * swing은 발을 드는 시간 비율.
 */
export function walk4(n: number, stride: number, lift: number, o: { bob?: number; roll?: number; yaw?: number; swing?: number; extra?: (ph: number) => Pose } = {}): Pose[] {
  const swing = o.swing ?? 0.36;
  const phase: Record<string, number> = { BL: 0, FL: 0.24, BR: 0.5, FR: 0.74 };
  const out: Pose[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const ph = f * Math.PI * 2;
    const p: Pose = {};
    for (const L of LEGS) {
      const q = (f - phase[L] + 1) % 1;
      if (q < swing) {
        const u = q / swing;
        const e = u * u * (3 - 2 * u);
        p[`${L}z`] = -stride + 2 * stride * e;
        p[`${L}y`] = lift * Math.sin(Math.PI * u);
      } else {
        const u = (q - swing) / (1 - swing);
        p[`${L}z`] = stride - 2 * stride * u;
        p[`${L}y`] = 0;
      }
    }
    p.By = -(o.bob ?? 0.012) * Math.cos(2 * ph);
    p.Brz = (o.roll ?? 2) * Math.sin(ph);
    p.Bry = (o.yaw ?? 2) * Math.cos(ph);
    if (o.extra) Object.assign(p, o.extra(ph));
    out.push(p);
  }
  return out;
}

/** 깡충 뛰기 (다람쥐): 뒷발로 차고 날아 앞발로 내려앉는다 */
export function bound(n: number, stride: number, height: number, extra?: (ph: number) => Pose): Pose[] {
  const out: Pose[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const ph = f * Math.PI * 2;
    // 0~0.45: 공중, 나머지: 땅에서 몸을 모았다 편다
    const air = f < 0.45 ? Math.sin((Math.PI * f) / 0.45) : 0;
    const gather = f >= 0.45 ? Math.sin((Math.PI * (f - 0.45)) / 0.55) : 0;
    const p: Pose = {
      Py: height * air,
      Brx: -10 * Math.sin(Math.PI * Math.min(1, f / 0.45)) * (f < 0.22 ? 1 : -0.6) + 6 * gather,
      By: -0.02 * gather,
      FLz: stride * (air * 0.9 - gather * 0.5), FRz: stride * (air * 0.9 - gather * 0.5),
      FLy: 0.04 * air, FRy: 0.04 * air,
      BLz: stride * (-air * 0.8 + gather * 0.6), BRz: stride * (-air * 0.8 + gather * 0.6),
      BLy: 0.05 * air, BRy: 0.05 * air,
      'head.rx': 6 * air - 4 * gather,
    };
    if (extra) Object.assign(p, extra(ph));
    out.push(p);
  }
  return out;
}

/** 물기: 웅크렸다가 앞으로 덮치며 턱을 벌린다 */
export function biteAttack(k = 1, jaw = true): Pose[] {
  const J = (v: number): Pose => (jaw ? { 'jaw.rx': v } : {});
  return keys(8, [
    [0, { By: -0.03 * k, Bz: -0.02 * k, Brx: 4, 'head.rx': 6, 'tail.rx': -10 }],
    [2, { By: -0.11 * k, Bz: -0.06 * k, Brx: 9, 'head.rx': 12, BLz: -0.05 * k, BRz: -0.05 * k, 'tail.rx': -26, ...J(8) }, 'in'],
    [3, { Py: 0.12 * k, Bz: 0.08 * k, By: 0.0, Brx: -12, 'head.rx': -10, FLz: 0.18 * k, FRz: 0.15 * k, FLy: 0.1 * k, FRy: 0.08 * k, BLz: -0.12 * k, BRz: -0.1 * k, 'tail.rx': 0, ...J(40) }, 'out'],
    [4, { Py: 0.05 * k, Bz: 0.12 * k, By: -0.04 * k, Brx: 8, 'head.rx': 10, FLz: 0.2 * k, FRz: 0.17 * k, BLz: -0.02 * k, BRz: -0.04 * k, ...J(4) }],
    [6, { Bz: 0.06 * k, By: -0.04 * k, Brx: 3, 'head.rx': 4, FLz: 0.08 * k, FRz: 0.06 * k, ...J(2) }],
    [7, { Bz: 0.02 * k, By: -0.01 * k, 'head.rx': 1 }],
  ]);
}

/** 앞발로 덮치기 (범): 몸을 낮췄다가 솟구쳐 두 앞발을 내리친다 */
export function pounceAttack(k = 1): Pose[] {
  return keys(8, [
    [0, { By: -0.05 * k, Brx: 3, 'head.rx': 8, 'tail.rx': -6 }],
    [2, { By: -0.14 * k, Bz: -0.08 * k, Brx: 6, 'head.rx': 14, BLz: -0.06 * k, BRz: -0.06 * k, 'tail.rx': 16, 'tail2.rx': 20 }, 'in'],
    [3, { Py: 0.2 * k, By: 0.06 * k, Bz: 0.1 * k, Brx: -26, 'head.rx': -4, FLy: 0.32 * k, FRy: 0.3 * k, FLz: 0.28 * k, FRz: 0.24 * k, BLz: -0.16 * k, BRz: -0.14 * k, 'jaw.rx': 30, 'tail.rx': -10 }, 'out'],
    [4, { Py: 0.06 * k, By: -0.06 * k, Bz: 0.2 * k, Brx: 12, 'head.rx': 14, FLy: 0.0, FRy: 0.02 * k, FLz: 0.3 * k, FRz: 0.28 * k, BLz: -0.04 * k, BRz: -0.06 * k, 'jaw.rx': 34, 'tail.rx': 6 }, 'in'],
    [6, { By: -0.04 * k, Bz: 0.12 * k, Brx: 4, 'head.rx': 6, FLz: 0.16 * k, FRz: 0.14 * k, 'jaw.rx': 6 }],
    [7, { Bz: 0.04 * k, 'head.rx': 2 }],
  ]);
}

/** 일어서서 내려치기 (곰·보스) */
export function rearSlam(k = 1, hold = 0): Pose[] {
  return keys(9, [
    [0, { By: -0.02 * k, Brx: 2, 'head.rx': 4 }],
    [2 + hold, { By: 0.16 * k, Bz: -0.12 * k, Brx: -38, 'head.rx': -18, FLy: 0.46 * k, FRy: 0.42 * k, FLz: 0.04 * k, FRz: 0.08 * k, BLz: 0.06 * k, BRz: 0.06 * k, 'jaw.rx': 28 }, 'out'],
    [4 + hold, { By: -0.08 * k, Bz: 0.12 * k, Brx: 10, 'head.rx': 16, FLy: 0, FRy: 0, FLz: 0.22 * k, FRz: 0.2 * k, BLz: 0.02 * k, BRz: 0.02 * k, 'jaw.rx': 10 }, 'in'],
    [6 + hold, { By: -0.05 * k, Bz: 0.08 * k, Brx: 5, 'head.rx': 8, FLz: 0.14 * k, FRz: 0.12 * k, 'jaw.rx': 4 }],
    [8, { Bz: 0.02 * k, 'head.rx': 2 }],
  ]);
}

/** 머리로 들이받기 (멧돼지) */
export function ramAttack(k = 1): Pose[] {
  return keys(7, [
    [0, { Bz: -0.08 * k, By: -0.05 * k, Brx: 8, 'head.rx': 22, FLz: -0.06 * k, FRz: -0.04 * k, BLz: -0.1 * k, BRz: -0.1 * k }],
    [1, { Bz: -0.14 * k, By: -0.08 * k, Brx: 12, 'head.rx': 30, FLz: -0.08 * k, FRz: -0.06 * k, BLz: -0.14 * k, BRz: -0.14 * k, BLy: 0.03 * k }, 'in'],
    [2, { Bz: 0.12 * k, By: -0.02 * k, Brx: 6, 'head.rx': 26, FLz: 0.14 * k, FRz: 0.06 * k, BLz: 0.02 * k, BRz: -0.04 * k, BLy: 0.05 * k }],
    [3, { Bz: 0.17 * k, By: 0.02 * k, Brx: -12, 'head.rx': -26, FLz: 0.16 * k, FRz: 0.12 * k, BLz: 0.05 * k, BRz: 0.01 * k }],
    [5, { Bz: 0.08 * k, By: 0.0, Brx: -2, 'head.rx': -4, FLz: 0.09 * k, FRz: 0.07 * k, BLz: 0.03 * k }],
    [6, { Bz: 0.03 * k, 'head.rx': 3 }],
  ]);
}

export function hitAnim(k = 1, extra: Pose = {}): Pose[] {
  return keys(3, [
    [0, { Bz: -0.05 * k, By: 0.02 * k, Brx: -9, Brz: 4, 'head.rx': -18, 'head.ry': 10, 'jaw.rx': 18, 'tail.rx': -18, ...extra }],
    [1, { Bz: -0.06 * k, By: -0.03 * k, Brx: -3, Brz: 2, 'head.rx': -8, 'head.ry': 5, 'jaw.rx': 8, 'tail.rx': -14 }],
    [2, { Bz: -0.02 * k, By: -0.01 * k, 'head.rx': 2, 'tail.rx': -6 }],
  ]);
}

/** 쓰러지기: 옆으로 넘어가 다리를 뻗는다 */
export function deathAnim(k = 1, drop = 0.3): Pose[] {
  return keys(8, [
    [0, { Bz: -0.04 * k, By: 0.01, Brx: -10, 'head.rx': -18, 'jaw.rx': 20, 'tail.rx': -18 }],
    [1, { Bz: -0.04 * k, By: -0.08 * k, Brx: -4, 'head.rx': -8, Brz: 8, FLz: 0.08 * k, FRz: 0.06 * k, 'jaw.rx': 14 }],
    [2, { Prz: 20, By: -0.14 * k, Bz: -0.03 * k, 'head.rx': 4, 'jaw.rx': 8 }, 'in'],
    [4, { Prz: 62, Py: 0.08 * k, Px: 0.16 * k, By: -drop * 0.75, 'head.rx': 14, FLy: 0.1 * k, BLy: 0.1 * k, 'jaw.rx': 6, 'tail.rx': 8 }],
    [5, { Prz: 90, Py: 0.15 * k, Px: 0.3 * k, By: -drop, 'head.rx': 22, FLy: 0.14 * k, BLy: 0.14 * k, FRy: 0.03 * k, BRy: 0.03 * k, 'jaw.rx': 16, 'tail.rx': 16 }],
    [6, { Prz: 86, Py: 0.13 * k, Px: 0.3 * k, By: -drop - 0.01, 'head.rx': 24, FLy: 0.12 * k, BLy: 0.12 * k, FRy: 0.02 * k, BRy: 0.02 * k, 'jaw.rx': 14, 'tail.rx': 18 }],
    [7, { Prz: 88, Py: 0.13 * k, Px: 0.3 * k, By: -drop - 0.01, 'head.rx': 24, FLy: 0.12 * k, BLy: 0.12 * k, FRy: 0.02 * k, BRy: 0.02 * k, 'jaw.rx': 12, 'tail.rx': 18 }],
  ]);
}

/** 색 도우미: 위·옆·배 세 색을 높이(s)로 섞는다 */
export function counter(top: Hex, side: Hex, belly: Hex, edge = -0.35, soft = 0.25) {
  return (s: number) => {
    if (s < edge - soft) return belly;
    if (s < edge + soft) return mix(belly, side, (s - (edge - soft)) / (2 * soft));
    return mix(side, top, Math.max(0, Math.min(1, (s - 0.2) / 0.7)));
  };
}

export { mix, tone, v3 };
