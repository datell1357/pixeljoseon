// 사람 모델. 5등신 비율에 한복풍 옷. 옷자락과 머리카락은 뼈마다 따로 움직인다.
import * as THREE from 'three';
import { Human, STAND } from '@bake/rig.js';
import { idleFrames } from '@bake/humans.js';
import { Geo, mix, tone, v3, type Hex } from './geo';

export const DIMS = {
  hipH: 0.9,
  hipW: 0.095,
  thigh: 0.43,
  shin: 0.43,
  ankle: 0.07,
  stance: 0.125,
  toe: 0.16,
  heel: 0.06,
  spine: 0.05,
  shoulderY: 0.46,
  shoulderW: 0.228,
  upper: 0.27,
  fore: 0.26,
  headY: 0.52,
};

const K_LEG = 1.9;
const K_ARM = 1.55;
const K_REACH = 1.18;
const OLD_SHOULDER = 0.42 + 0.03 + 0.32;
const NEW_SHOULDER = DIMS.hipH + DIMS.spine + DIMS.shoulderY;

/** 옛 비율로 만든 동작을 새 비율에 맞춘다 */
export function retarget(p: Record<string, number>) {
  const P: Record<string, number> = { ...STAND, ...p };
  const out: Record<string, number> = { ...P };
  for (const k of ['Fx', 'Fy', 'Fz', 'Gx', 'Gy', 'Gz']) out[k] = P[k] * K_LEG;
  for (const k of ['hx', 'hy', 'hz', 'Px', 'Py', 'Pz']) out[k] = P[k] * K_LEG;
  out.Rr = P.Rr * K_REACH;
  out.Lr = P.Lr * K_REACH;
  out.Ry = NEW_SHOULDER + (P.Ry - OLD_SHOULDER) * K_ARM;
  out.Ly = NEW_SHOULDER + (P.Ly - OLD_SHOULDER) * K_ARM;
  if (P.Wslide !== undefined) out.Wslide = P.Wslide * K_ARM;
  return out;
}

export interface Panel {
  a: number;
  top: THREE.Group;
  low: THREE.Group;
  ang: number;
  vel: number;
  ang2: number;
  vel2: number;
  flare: number;
}

export interface Chain {
  nodes: THREE.Group[];
  ang: number[];
  vel: number[];
  rest: number;
  stiff: number;
}

export interface CharAsset {
  geometry: THREE.BufferGeometry;
  boneOrder: string[];
  rigFactory: () => BuiltRig;
  anims: Record<string, { frames: number; dur: number; loop?: boolean; poses: Record<string, number>[] }>;
  retarget: boolean;
  height: number;
  /** 모델 자체 배율. 예전 비율 모델을 키울 때 쓴다 */
  baseScale: number;
  alpha?: number;
  /** 털결 세기 (짐승만) */
  fur?: number;
  /** 스킨드 모델 (정점마다 뼈 넷) */
  skinned?: boolean;
  /** 색 텍스처 */
  map?: THREE.Texture | null;
  /** 쇳물 색 텍셀을 발광으로 */
  emKey?: boolean;
  /** 지금 이 모델을 쓰는 인물 수. 장비 조합 모델을 언제 버려도 되는지 판단한다 */
  refs?: number;
}

export interface BuiltRig {
  rig: any;
  bones: THREE.Object3D[];
  panels: Panel[];
  chains: Chain[];
  strings?: { update: (P: Record<string, number>) => void };
  /** 스킨드 모델: 뼈마다 곱할 묶임 역행렬 */
  bindInv?: THREE.Matrix4[];
}

/** 몸체 만들기: 뼈 이름별로 Geo에 그린다 */
export class Body {
  g = new Geo();
  order: string[] = [];
  extra: { name: string; parent: string; x: number; y: number; z: number; ry?: number }[] = [];
  panelDefs: { a: number; top: string; low: string; flare: number }[] = [];
  chainDefs: { nodes: string[]; rest: number; stiff: number }[] = [];
  id = 1;

  on(bone: string, fn: (g: Geo) => void) {
    let i = this.order.indexOf(bone);
    if (i < 0) {
      i = this.order.length;
      this.order.push(bone);
    }
    this.g.bone = i;
    fn(this.g);
  }

  /** 새 뼈. parent 기준으로 놓인다 */
  node(name: string, parent: string, x: number, y: number, z: number, ry = 0) {
    this.extra.push({ name, parent, x, y, z, ry });
  }

  next() {
    this.id = this.id >= 250 ? 1 : this.id + 1;
    return this.id;
  }
}

// ─── 부위 ─────────────────────────────────────

const HEAD_PROFILE: [number, number, number, number][] = [
  // y, 반폭, 반깊이, 앞뒤 치우침
  [0.05, 0.05, 0.055, 0.02],
  [0.09, 0.083, 0.086, 0.012],
  [0.14, 0.104, 0.108, 0.004],
  [0.2, 0.112, 0.118, 0],
  [0.26, 0.106, 0.114, -0.004],
  [0.31, 0.08, 0.088, -0.006],
  [0.335, 0.035, 0.04, -0.006],
];

function headR(y: number) {
  const P = HEAD_PROFILE;
  if (y <= P[0][0]) return P[0];
  for (let i = 0; i < P.length - 1; i++) {
    if (y <= P[i + 1][0]) {
      const t = (y - P[i][0]) / (P[i + 1][0] - P[i][0]);
      return [y, P[i][1] + (P[i + 1][1] - P[i][1]) * t, P[i][2] + (P[i + 1][2] - P[i][2]) * t, P[i][3] + (P[i + 1][3] - P[i][3]) * t] as [number, number, number, number];
    }
  }
  return P[P.length - 1];
}

export function head(b: Body, skin: Hex, o: { eyeY?: number; eye?: Hex; brow?: Hex; beard?: Hex; blush?: boolean; lash?: boolean } = {}) {
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0 });
    g.loft(
      [
        [0, -0.05, 0, 0.042, 0.042],
        [0, 0.05, 0, 0.042, 0.042],
      ],
      tone(skin, 0.8),
      6,
      { flat: false },
    );
    g.loft(HEAD_PROFILE.map(([y, rx, rz, cz]) => [0, y, cz, rx, rz]), skin, 12, { flat: false, faceFront: 0.8 });
    // 눈, 눈썹: 얼굴과 같은 부위로 묶어 둘레에 외곽선이 생기지 않게 한다
    const eyeY = o.eyeY ?? 0.17;
    const eye = o.eye ?? 0x241820;
    const z = 0.108;
    for (const s of [-1, 1]) {
      const x = s * 0.054;
      // 흰자, 눈동자, 윗눈꺼풀
      g.box(x + s * 0.012, eyeY - 0.002, z, 0.024, 0.044, 0.008, 0xf6f0e4);
      g.box(x - s * 0.004, eyeY - 0.002, z + 0.002, 0.03, 0.058, 0.01, eye);
      g.box(x + s * 0.002, eyeY + 0.012, z + 0.005, 0.012, 0.014, 0.006, 0xfff8ec);
      g.box(x + s * 0.004, eyeY + 0.03, z + 0.002, 0.056, o.lash ? 0.016 : 0.011, 0.01, o.lash ? 0x1a1014 : tone(skin, 0.42));
      // 눈썹
      g.box(x + s * 0.004, eyeY + 0.056, z - 0.002, 0.052, 0.012, 0.01, o.brow ?? 0x2a1c18);
      // 귀
      g.rock(s * 0.113, 0.15, -0.008, 0.016, 0.03, 0.02, tone(skin, 0.9), 3, 0, 0);
    }
    if (o.blush) {
      for (const s of [-1, 1]) g.box(s * 0.076, eyeY - 0.046, 0.094, 0.034, 0.016, 0.01, mix(skin, 0xe05a48, 0.5));
    }
    // 코와 입
    g.box(0, eyeY - 0.044, 0.114, 0.018, 0.012, 0.01, tone(skin, 0.78));
    g.box(0, eyeY - 0.082, 0.104, 0.036, 0.01, 0.01, mix(skin, 0x8a2f35, o.blush ? 0.75 : 0.5));
    if (o.beard !== undefined) {
      g.set({ id: b.next() });
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a0 = -1.1 + (2.2 * i) / n;
        const a1 = -1.1 + (2.2 * (i + 1)) / n;
        const top = 0.12;
        const bot = 0.02 - Math.cos((a0 + a1) * 0.5) * 0.09 + (i % 2) * 0.012;
        const R = 0.098;
        const p0 = v3(Math.sin(a0) * R, top, Math.cos(a0) * R + 0.012);
        const p1 = v3(Math.sin(a1) * R, top, Math.cos(a1) * R + 0.012);
        const p2 = v3(Math.sin((a0 + a1) / 2) * R * 0.7, bot, Math.cos((a0 + a1) / 2) * R * 0.7 + 0.024);
        g.tri(p0, p2, p1, i % 2 ? o.beard : tone(o.beard, 0.9));
      }
    }
  });
}

/** 머리카락: 두피를 따라 내려오는 띠. bottom(방위각)이 머리카락 끝 높이 */
export function hairCap(b: Body, col: Hex, bottom: (a: number, i: number) => number, opt: { lift?: number } = {}) {
  const lift = opt.lift ?? 0.022;
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0.22 });
    const seg = 24;
    const rows = 6;
    const shine = tone(col, 1.75);
    const center = v3(0, 0.2, -0.006);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const y0 = bottom(am > Math.PI ? am - Math.PI * 2 : am, i);
      const yTop = 0.356;
      const P = (a: number, y: number, tip: boolean) => {
        const yy = Math.min(y, 0.34);
        const [, rx, rz, cz] = headR(Math.max(0.05, yy));
        const k = yy < 0.05 ? 1.02 : 1;
        const out = lift + (tip ? 0.002 : 0.006);
        return v3(Math.sin(a) * (rx * k + out), y, Math.cos(a) * (rz * k + out) + cz);
      };
      for (let r = 0; r < rows; r++) {
        const t0 = r / rows;
        const t1 = (r + 1) / rows;
        const ya = y0 + (yTop - y0) * t0;
        const yb = y0 + (yTop - y0) * t1;
        // 윤기 띠: 머리를 두르는 한 줄
        const c = ya < 0.3 && yb > 0.25 ? (i % 3 === 0 ? shine : tone(col, 1.34)) : i % 2 ? col : tone(col, 0.86);
        if (r === 0) {
          // 끝은 뾰족하게
          const tip = P(am, ya - 0.016, true);
          g.tri(P(a0, yb, false), tip, P(a1, yb, false), c);
        } else {
          g.quadS(P(a0, ya, false), P(a1, ya, false), P(a1, yb, false), P(a0, yb, false), c, center);
        }
      }
      // 꼭대기 닫기
      g.tri(P(a0, yTop, false), P(a1, yTop, false), v3(0, 0.372, -0.006), tone(col, 1.2));
    }
  });
}

/** 앞머리와 귀밑머리: 뾰족한 다발이 이마와 볼 옆으로 내려온다. 얼굴 둘레를 잡아 준다 */
export function bangs(b: Body, col: Hex, o: { front?: number; side?: number; part?: number } = {}) {
  const { front = 0.235, side = 0.09, part = 0 } = o;
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0.2 });
    const tuft = (a: number, w: number, top: number, end: number, c: Hex) => {
      const out = (ang: number, y: number, k: number) => {
        const [, rx, rz, cz] = headR(Math.max(0.05, Math.min(y, 0.34)));
        return v3(Math.sin(ang) * (rx + k), y, Math.cos(ang) * (rz + k) + cz);
      };
      const l = out(a - w, top, 0.03);
      const r = out(a + w, top, 0.03);
      const tip = out(a + part * 0.12, end, 0.016);
      const mid = out(a, (top + end) / 2, 0.042);
      const center = v3(0, 0.2, -0.006);
      g.quadS(l, mid, r, r, c, center);
      g.tri(l, tip, mid, tone(c, 1.12));
      g.tri(mid, tip, r, c);
    };
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.25 + part * 0.2;
      tuft(a, 0.17, 0.33, front - Math.abs(i) * 0.006 + (i % 2) * 0.012, i % 2 ? col : tone(col, 1.22));
    }
    for (const s of [-1, 1]) {
      tuft(s * 1.08, 0.2, 0.3, side + 0.03, tone(col, 1.1));
      tuft(s * 1.38, 0.2, 0.3, side, col);
    }
  });
}

/** 상투 또는 틀어 올린 머리 */
export function topknot(b: Body, col: Hex, pin?: Hex, y = 0.37, z = -0.02, s = 1) {
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0.1 });
    g.rock(0, y, z, 0.055 * s, 0.06 * s, 0.055 * s, col, 3, 0.08, 1);
    if (pin !== undefined) {
      g.set({ id: b.next(), spec: 0.8 });
      g.box(0, y + 0.005, z, 0.2 * s, 0.014, 0.014, pin);
    }
  });
}

/** 머리띠 */
export function headband(b: Body, col: Hex, tail: boolean) {
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id });
    // 눈을 가리지 않게 머리카락이 시작하는 곳에 맨다
    const rx = 0.124;
    const rz = 0.131;
    g.loft(
      [
        [0, 0.258, -0.002, rx, rz],
        [0, 0.294, -0.004, rx - 0.018, rz - 0.018],
      ],
      col,
      12,
      { capTop: false, capBot: false },
    );
  });
  if (tail) {
    addChain(b, 'head', 'bandTail', 0, 0.275, -0.12, 3, 0.09, (g, i, L) => {
      g.set({ id, wind: 0.6 });
      for (const s of [-1, 1]) g.box(s * 0.018, -L / 2, 0, 0.022 - i * 0.002, L + 0.01, 0.008, tone(col, s > 0 ? 1 : 0.84));
      g.set({ wind: 0 });
    }, 0.22, 26);
  }
}

/** 갓: 넓은 챙과 높은 원통 */
export function gat(b: Body, col: Hex, tie: Hex) {
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0.3 });
    const y = 0.292;
    g.loft(
      [
        [0, y, 0, 0.285, 0.285],
        [0, y + 0.012, 0, 0.21, 0.21],
        [0, y + 0.03, 0, 0.125, 0.125],
      ],
      (i) => (i === 0 ? tone(col, 1.25) : col),
      14,
      { capBot: true },
    );
    g.set({ id: b.next(), spec: 0.3 });
    g.loft(
      [
        [0, y + 0.03, 0, 0.122, 0.122],
        [0, y + 0.19, 0, 0.1, 0.1],
      ],
      tone(col, 1.12),
      10,
    );
    g.set({ id: b.next() });
    for (const s of [-1, 1]) g.tube([v3(s * 0.115, 0.25, 0.02), v3(s * 0.09, 0.08, 0.095), v3(s * 0.02, 0.03, 0.125)], 0.006, tie, 3);
    g.set({ spec: 0 });
  });
}

/** 벙거지: 순찰자의 챙 넓은 모자 */
export function bonnet(b: Body, col: Hex, plume?: Hex) {
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0.05 });
    const y = 0.262;
    g.loft(
      [
        [0, y - 0.02, 0, 0.205, 0.205],
        [0, y + 0.012, 0, 0.175, 0.175],
        [0, y + 0.03, 0, 0.13, 0.13],
        [0, y + 0.13, 0, 0.115, 0.115],
        [0, y + 0.17, 0, 0.05, 0.05],
      ],
      (i) => (i === 0 ? tone(col, 0.82) : i === 2 ? tone(col, 0.7) : col),
      12,
    );
    if (plume !== undefined) {
      g.set({ id: b.next() });
      g.tube([v3(0.11, y + 0.06, -0.02), v3(0.18, y + 0.2, -0.06), v3(0.19, y + 0.34, -0.14)], [0.02, 0.028, 0.002], plume, 4);
    }
  });
}

export function addChain(b: Body, parent: string, name: string, x: number, y: number, z: number, n: number, len: number, draw: (g: Geo, i: number, L: number) => void, rest: number, stiff: number) {
  const nodes: string[] = [];
  let par = parent;
  for (let i = 0; i < n; i++) {
    const nm = `${name}${i}`;
    if (i === 0) b.node(nm, par, x, y, z);
    else b.node(nm, par, 0, -len, 0);
    b.on(nm, (g) => draw(g, i, len));
    nodes.push(nm);
    par = nm;
  }
  b.chainDefs.push({ nodes, rest, stiff });
}

export function ponytail(b: Body, col: Hex, y: number, z: number, n = 4, w = 0.05) {
  const id = b.next();
  addChain(b, 'head', 'pony', 0, y, z, n, 0.14, (g, i, L) => {
    g.set({ id, spec: 0.1 });
    const a = w * (1 - i / (n + 0.6));
    const c = w * (1 - (i + 1) / (n + 0.6));
    g.loft(
      [
        [0, -L - 0.01, 0, c, c * 0.8],
        [0, 0.01, 0, a, a * 0.8],
      ],
      (_r, s) => (s % 2 ? col : tone(col, 1.2)),
      6,
    );
  }, 0.14, 22);
}

/** 윗몸. 옷깃은 한복처럼 왼쪽을 위로 여민다 */
export const torsoRings = (w = 1): number[][] => [
  [0, -0.02, 0, 0.145 * w, 0.1],
  [0, 0.1, 0.002, 0.152 * w, 0.106],
  [0, 0.24, 0.006, 0.178 * w, 0.118],
  [0, 0.36, 0.004, 0.195 * w, 0.12],
  [0, 0.44, -0.002, 0.185 * w, 0.104],
  [0, 0.5, -0.008, 0.095, 0.074],
];

/** 몸 앞면의 z. 옷깃과 장식을 몸에 붙일 때 쓴다 */
export function torsoFront(R: number[][], y: number, x: number) {
  let z = 0.1;
  for (let i = 0; i < R.length - 1; i++) {
    if (y >= R[i][1] && y <= R[i + 1][1]) {
      const t = (y - R[i][1]) / (R[i + 1][1] - R[i][1]);
      const rx = R[i][3] + (R[i + 1][3] - R[i][3]) * t;
      const rz = R[i][4] + (R[i + 1][4] - R[i][4]) * t;
      const cz = R[i][2] + (R[i + 1][2] - R[i][2]) * t;
      const q = Math.max(0, 1 - (x * x) / (rx * rx));
      z = cz + rz * Math.sqrt(q);
    }
  }
  return z + 0.012;
}

/** 고리 사이를 잘게 나눈다. 무늬를 놓을 칸을 늘릴 때 쓴다 */
export function fineRings(R: number[][], k: number) {
  const out: number[][] = [];
  for (let i = 0; i < R.length - 1; i++) {
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push(R[i].map((v, q) => v + (R[i + 1][q] - v) * t));
    }
  }
  out.push(R[R.length - 1]);
  return out;
}

export function torso(b: Body, o: { col: Hex; dark?: Hex; collar?: Hex; collarEm?: number; undercol?: Hex; w?: number; plated?: Hex; studs?: Hex; shell?: (g: Geo, R: number[][]) => void }) {
  const { col, collar = 0xece6d6, w = 1 } = o;
  const under = o.undercol ?? tone(col, 0.82);
  const R = torsoRings(w);
  const id = b.next();
  b.on('chest', (g) => {
    g.set({ id });
    if (o.shell) o.shell(g, R);
    else g.loft(fineRings(R, 2), col, 16, { flat: false });
  });
  // 깃: 몸 앞면을 따라 비스듬히
  const front = (y: number, x: number) => torsoFront(R, y, x);
  const cid = b.next();
  b.on('chest', (g) => {
    g.set({ id: cid, em: o.collarEm ?? 0 });
    const line = (x0: number, y0: number, x1: number, y1: number, r: number, c: Hex) => {
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        pts.push(v3(x, y, front(y, x)));
      }
      g.tube(pts, r, c, 4);
    };
    line(-0.066, 0.48, 0.1, 0.13, 0.014, collar);
    line(0.066, 0.48, -0.01, 0.31, 0.013, tone(collar, 0.92));
    // 고름
    g.box(0.09, 0.125, front(0.125, 0.09) + 0.004, 0.018, 0.09, 0.01, o.dark ?? tone(col, 0.6));
    g.loft(
      [
        [0, 0.47, -0.012, 0.075, 0.06],
        [0, 0.52, -0.012, 0.058, 0.05],
      ],
      collar,
      8,
      { capTop: false },
    );
    g.set({ em: 0 });
  });
  if (o.studs !== undefined) {
    // 두정갑: 금빛 징을 줄지어 박는다
    const sid = b.next();
    b.on('chest', (g) => {
      g.set({ id: sid, spec: 0.9 });
      for (let row = 0; row < 5; row++) {
        const y = 0.05 + row * 0.085;
        for (const x of [-0.11, -0.055, 0.0, 0.055, 0.11]) {
          if (Math.abs(x - (0.09 - (y - 0.14) * 0.45)) < 0.03) continue;
          g.box(x, y, front(y, x) - 0.002, 0.017, 0.017, 0.012, o.studs!);
        }
      }
      g.set({ spec: 0 });
    });
  }
  void under;
}

export function belt(b: Body, col: Hex, buckle?: Hex, sash?: Hex) {
  const id = b.next();
  b.on('hips', (g) => {
    g.set({ id });
    g.loft(
      [
        [0, 0.012, 0, 0.15, 0.108],
        [0, 0.075, 0, 0.15, 0.108],
      ],
      col,
      12,
    );
    if (buckle !== undefined) {
      g.set({ id: b.next(), spec: 0.8 });
      g.box(0, 0.045, 0.098, 0.062, 0.062, 0.016, buckle, 0.006);
      g.set({ spec: 0 });
    }
    if (sash !== undefined) {
      g.set({ id: b.next(), wind: 0.25 });
      g.box(0.09, -0.08, 0.1, 0.05, 0.26, 0.012, sash);
      g.box(0.13, -0.05, 0.085, 0.042, 0.2, 0.012, tone(sash, 0.84));
      g.set({ wind: 0 });
    }
  });
}

export function pelvis(b: Body, col: Hex) {
  const id = b.next();
  b.on('hips', (g) => {
    g.set({ id });
    g.loft(
      [
        [0, -0.14, 0, 0.1, 0.09],
        [0, -0.06, 0, 0.145, 0.108],
        [0, 0.03, 0, 0.145, 0.102],
      ],
      col,
      12,
      { flat: false },
    );
  });
}

/** 다리: 넓은 바지와 묶은 정강이 */
export function legs(b: Body, o: { pants: Hex; wrap: Hex; boot: Hex; sole?: Hex; wide?: number; strap?: Hex }) {
  const wide = o.wide ?? 1;
  for (const side of ['L', 'R']) {
    const idT = b.next();
    b.on(`thigh${side}`, (g) => {
      g.set({ id: idT });
      const n = DIMS.thigh;
      g.loft(
        [
          [0, 0.03, 0, 0.092 * wide, 0.094 * wide],
          [0, -n * 0.45, 0.004, 0.09 * wide, 0.092 * wide],
          [0, -n, 0, 0.072, 0.075],
        ],
        o.pants,
        10,
        { flat: false },
      );
    });
    const idS = b.next();
    b.on(`shin${side}`, (g) => {
      g.set({ id: idS });
      const n = DIMS.shin;
      g.loft(
        [
          [0, 0.03, 0, 0.072, 0.076],
          [0, -n * 0.32, -0.006, 0.066, 0.074],
          [0, -n * 0.72, -0.002, 0.05, 0.054],
          [0, -n, 0, 0.048, 0.052],
        ],
        (i) => (i === 0 ? o.pants : o.wrap),
        10,
        { flat: false },
      );
      if (o.strap !== undefined) {
        g.set({ id: b.next() });
        for (const y of [0.42, 0.56, 0.7]) g.box(0, -n * y, 0, 0.116 - y * 0.03, 0.016, 0.12 - y * 0.03, o.strap);
      }
    });
    const idF = b.next();
    b.on(`foot${side}`, (g) => {
      g.set({ id: idF });
      g.loft(
        [
          [0, -0.07, -0.005, 0.05, 0.075],
          [0, -0.02, 0.0, 0.048, 0.07],
          [0, 0.04, -0.005, 0.04, 0.05],
        ],
        o.boot,
        7,
        { capBot: true },
      );
      // 앞코가 살짝 들린 신
      g.loft(
        [
          [0, -0.07, 0.05, 0.05, 0.022],
          [0, -0.07, 0.12, 0.044, 0.022],
          [0, -0.05, 0.178, 0.018, 0.012],
        ].map((r) => [r[0], r[2], r[1], r[3], r[4]]).map(([x, z, y, rx, rz]) => [x, y, z, rx, rz]),
        o.boot,
        6,
      );
      g.box(0, -0.052, 0.07, 0.092, 0.05, 0.14, o.boot, 0.012);
      g.set({ id: b.next() });
      g.box(0, -0.074, 0.06, 0.098, 0.012, 0.24, o.sole ?? 0x241a18);
    });
  }
}

export function arms(b: Body, o: { sleeve: Hex; cuff: Hex; skin: Hex; flare?: number; bracer?: Hex; bracerEm?: Hex; cuffEm?: number; pat?: (i: number, s: number) => Hex }) {
  const flare = o.flare ?? 0;
  for (const side of ['L', 'R']) {
    const idU = b.next();
    b.on(`upper${side}`, (g) => {
      g.set({ id: idU });
      g.loft(
        [
          [0, 0.025, 0, 0.074, 0.078],
          [0, -DIMS.upper * 0.5, 0, 0.068 + flare * 0.25, 0.072 + flare * 0.25],
          [0, -DIMS.upper, 0, 0.06 + flare * 0.5, 0.064 + flare * 0.5],
        ],
        o.pat ?? o.sleeve,
        o.pat ? 12 : 10,
        { flat: false },
      );
    });
    const idF = b.next();
    b.on(`fore${side}`, (g) => {
      g.set({ id: idF });
      const L = DIMS.fore;
      if (flare > 0) {
        // 도포 소매: 손목 쪽으로 넓어지며 아래로 처진다
        g.loft(
          [
            [0, 0.02, 0, 0.056 + flare * 0.2, 0.06 + flare * 0.2],
            [0, -L * 0.45, -flare * 0.12, 0.064 + flare * 0.38, 0.072 + flare * 0.64],
            [0, -L * 0.88, -flare * 0.26, 0.066 + flare * 0.5, 0.08 + flare * 1.0],
            [0, -L * 1.12, -flare * 0.42, 0.054 + flare * 0.42, 0.066 + flare * 0.9],
            [0, -L * 1.32, -flare * 0.5, 0.02 + flare * 0.12, 0.024 + flare * 0.3],
          ],
          o.sleeve,
          12,
          { flat: false },
        );
        // 손이 나오는 소맷부리
        g.set({ id: b.next(), em: o.cuffEm ?? 0 });
        g.loft(
          [
            [0, -L * 0.84, 0.012, 0.062, 0.062],
            [0, -L * 0.98, 0.012, 0.058, 0.058],
          ],
          o.cuff,
          8,
          { flat: false },
        );
        g.set({ em: 0 });
      } else {
        g.loft(
          [
            [0, 0.02, 0, 0.06, 0.064],
            [0, -L * 0.6, 0, 0.052, 0.056],
            [0, -L, 0, 0.04, 0.044],
          ],
          o.pat ?? ((i) => (i === 0 ? o.sleeve : o.cuff)),
          o.pat ? 12 : 10,
          { flat: false },
        );
        if (o.bracer !== undefined) {
          g.set({ id: b.next(), spec: 0.5 });
          g.loft(
            [
              [0, -L * 0.42, 0, 0.06, 0.064],
              [0, -L * 0.96, 0, 0.05, 0.054],
            ],
            o.bracer,
            7,
          );
          if (o.bracerEm !== undefined) {
            g.set({ id: b.next(), em: 0.85, spec: 0 });
            g.loft(
              [
                [0, -L * 0.95, 0, 0.052, 0.056],
                [0, -L * 0.88, 0, 0.054, 0.058],
              ],
              o.bracerEm,
              7,
              { capBot: false, capTop: false },
            );
            g.set({ em: 0 });
          }
          g.set({ spec: 0 });
        }
      }
    });
    const idH = b.next();
    b.on(`hand${side}`, (g) => {
      g.set({ id: idH });
      g.loft(
        [
          [0, 0.015, 0, 0.036, 0.036],
          [0, -0.035, 0, 0.05, 0.044],
          [0, -0.09, 0, 0.038, 0.032],
        ],
        o.skin,
        8,
        { flat: false },
      );
    });
  }
}

/** 어깨 판 */
export function pauldrons(b: Body, col: Hex, edge: Hex) {
  for (const s of [-1, 1]) {
    const id = b.next();
    b.on('chest', (g) => {
      g.set({ id, spec: 0.55 });
      const x = s * DIMS.shoulderW;
      g.rotZ(s * -0.26, () => {
        g.move(x * 1.02, 0.44, 0, () => {
          g.loft(
            [
              [0, -0.065, 0, 0.098, 0.102],
              [0, -0.02, 0, 0.092, 0.098],
              [0, 0.035, 0, 0.066, 0.072],
              [0, 0.062, 0, 0.02, 0.02],
            ],
            (i) => (i === 0 ? edge : i === 1 ? col : tone(col, 1.12)),
            8,
          );
        });
      });
      g.set({ spec: 0 });
    });
  }
}

/** 허리에 달린 옷자락. 다리를 밀어내며 펄럭인다 */
export function skirtPanels(b: Body, o: { n: number; len: number; col: Hex; trim: Hex; trimEm?: number; ribs?: Hex; ribN?: number; rx?: number; rz?: number; y?: number; flare?: number; widthK?: number; alt?: Hex; gapFront?: boolean; back?: boolean }) {
  const { n, len, col, trim } = o;
  const rx = o.rx ?? 0.145;
  const rz = o.rz ?? 0.106;
  const y = o.y ?? 0.03;
  // 긴 옷은 넓게 퍼져야 벌린 다리를 덮는다
  const flare = len > 0.7 ? Math.max(o.flare ?? 0.14, 0.16) : (o.flare ?? 0.14);
  const wk = len > 0.7 ? Math.max(o.widthK ?? 1.25, 1.5) : (o.widthK ?? 1.25);
  const id = b.next();
  if (len > 0.7) {
    // 긴 옷: 자락이 들려도 다리가 비치지 않게 안쪽에 받침 치마를 둔다
    const lid = b.next();
    b.on('hips', (g) => {
      g.set({ id: lid });
      g.loft(
        [
          [0, y - len * 0.97, 0, rx + 0.13, rz + 0.13],
          [0, y - len * 0.5, 0, rx + 0.07, rz + 0.07],
          [0, y, 0, rx - 0.004, rz - 0.004],
        ],
        tone(col, 0.72),
        12,
        { flat: false, capBot: false, capTop: false },
      );
    });
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (o.gapFront ? Math.PI / n : 0);
    const top = `pT${i}`;
    const low = `pL${i}`;
    const px = Math.sin(a) * rx;
    const pz = Math.cos(a) * rz;
    const w = ((Math.PI * 2 * (rx + rz)) / 2 / n) * wk;
    b.node(top, 'hips', px, y, pz, a);
    const L1 = len * 0.52;
    const L2 = len * 0.48;
    b.node(low, top, 0, -L1, 0);
    const c = i % 2 ? col : (o.alt ?? tone(col, 0.92));
    // 판을 가로지르는 줄: 쇠미늘처럼 보이게 한다
    const ribs = (g: Geo, y0: number, y1: number, wid: number) => {
      if (o.ribs === undefined) return;
      const n = o.ribN ?? 2;
      for (let k = 0; k < n; k++) g.box(0, y0 + ((y1 - y0) * (k + 0.5)) / n, 0.012, wid, 0.016, 0.012, o.ribs);
    };
    b.on(top, (g) => {
      g.set({ id: id, wind: 0 });
      plank(g, w / 2, w / 2 + 0.008, 0, -L1, c, 0.012);
      ribs(g, 0, -L1, w);
    });
    b.on(low, (g) => {
      g.set({ id: id });
      const trimH = Math.min(0.06, L2 * 0.25);
      plank(g, w / 2 + 0.008, w / 2 + 0.016, 0.008, -(L2 - trimH), c, 0.012);
      ribs(g, 0.008, -(L2 - trimH), w + 0.02);
      g.set({ id: id, em: o.trimEm ?? 0 });
      plank(g, w / 2 + 0.016, w / 2 + 0.018, -(L2 - trimH), -L2, trim, 0.012);
      g.set({ em: 0 });
    });
    b.panelDefs.push({ a, top, low, flare });
  }
}

/** 살짝 휜 판자 하나 (옷자락 조각) */
export function plank(g: Geo, w0: number, w1: number, y0: number, y1: number, col: Hex, t: number) {
  const a = v3(-w0, y0, 0);
  const b = v3(w0, y0, 0);
  const c = v3(w1, y1, 0);
  const d = v3(-w1, y1, 0);
  const m0 = v3(0, y0, t);
  const m1 = v3(0, y1, t);
  g.quad(a, d, m1, m0, tone(col, 0.94));
  g.quad(m0, m1, c, b, col);
  g.quad(a, b, c, d, tone(col, 0.72));
}

// ─── 조립 ─────────────────────────────────────

export interface Build {
  body: Body;
  anims: CharAsset['anims'];
  /** 활: H는 활 끝까지의 높이 */
  bow?: { H: number; string?: Hex; em?: number };
}

export const SKINS = [0xf2cba6, 0xecbc92, 0xd8a57e];

export function finish(id: string, { body, anims, bow }: Build): CharAsset {
  // 활 시위와 화살: 굽기 때와 같이 두 끝과 손 사이에 늘려 놓는다
  if (bow) {
    const sid = body.next();
    for (const n of ['strA', 'strB']) {
      body.node(n, 'pivot', 0, 0, 0);
      body.on(n, (g) => {
        g.set({ id: sid, em: bow.em ?? 0.2 });
        g.box(0, -0.5, 0, 0.012, 1, 0.012, bow.string ?? 0xe6dcc0);
        g.set({ em: 0 });
      });
    }
    body.node('arrow', 'pivot', 0, 0, 0);
    body.on('arrow', (g) => {
      g.set({ id: body.next() });
      g.box(0, 0, 0.45, 0.014, 0.014, 0.9, 0xc8b080);
      g.box(0, 0, 0.06, 0.05, 0.012, 0.12, 0xece6d6);
      g.box(0, 0, 0.06, 0.012, 0.05, 0.12, 0xb5482e);
      g.set({ id: body.next(), spec: 0.8 });
      g.loft([[0, 0.9, 0, 0.022, 0.022], [0, 1.0, 0, 0, 0]].map((r) => [r[0], r[2], r[1], r[3], r[4]]).map(([x, y, z, rx, rz]) => [x, y, z, rx, rz]), 0xcdd4dc, 4);
      g.set({ spec: 0 });
    });
  }
  const geometry = body.g.build();
  const order = body.order;
  const rigFactory = (): BuiltRig => {
    const rig = new Human({ ...DIMS });
    // 머리를 조금 키워 얼굴이 읽히게 한다
    rig.head.scale.setScalar(1.3);
    rig.remember();
    const extra = new Map<string, THREE.Group>();
    const look = (n: string): THREE.Object3D => extra.get(n) ?? rig.nodes[n];
    for (const e of body.extra) {
      const g = new THREE.Group();
      g.position.set(e.x, e.y, e.z);
      if (e.ry) g.rotation.y = e.ry;
      extra.set(e.name, g);
      look(e.parent).add(g);
    }
    const panels: Panel[] = body.panelDefs.map((d) => ({ a: d.a, top: extra.get(d.top)!, low: extra.get(d.low)!, ang: d.flare, vel: 0, ang2: 0, vel2: 0, flare: d.flare }));
    const chains: Chain[] = body.chainDefs.map((d) => ({ nodes: d.nodes.map((n) => extra.get(n)!), ang: d.nodes.map(() => d.rest), vel: d.nodes.map(() => 0), rest: d.rest, stiff: d.stiff }));
    const bones = order.map((n) => look(n));
    const built: BuiltRig = { rig, bones, panels, chains };
    if (bow) {
      const A = extra.get('strA')!;
      const B = extra.get('strB')!;
      const arrow = extra.get('arrow')!;
      const tipA = v3(0, bow.H, -0.1);
      const tipB = v3(0, -bow.H, -0.1);
      const a = v3();
      const c = v3();
      const n = v3();
      const y = v3();
      const lay = (o: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) => {
        o.position.copy(from);
        y.copy(from).sub(to);
        const len = y.length() || 1e-3;
        y.divideScalar(len);
        o.quaternion.setFromUnitVectors(v3(0, 1, 0), y);
        o.scale.set(1, len, 1);
      };
      built.strings = {
        update(P) {
          rig.gripL.updateMatrix();
          a.copy(tipA).applyMatrix4(rig.gripL.matrix);
          c.copy(tipB).applyMatrix4(rig.gripL.matrix);
          n.copy(a).add(c).multiplyScalar(0.5);
          if (P.draw > 0) n.lerp(rig.handR.position, Math.min(1, P.draw * 1.4));
          lay(A, a, n);
          lay(B, c, n);
          const show = P.arrow > 0.5;
          if (show) {
            y.copy(rig.gripL.position).sub(n);
            const len = Math.max(0.2, y.length());
            arrow.position.copy(n);
            arrow.quaternion.setFromUnitVectors(v3(0, 0, 1), y.normalize());
            arrow.scale.set(1, 1, Math.min(1.1, len + 0.2));
          } else {
            arrow.scale.setScalar(0.0001);
          }
        },
      };
    }
    return built;
  };
  return { geometry, boneOrder: order, rigFactory, anims, retarget: true, height: 1.98, baseScale: 1 };
}

// ─── 마을 사람 ─────────────────────────────────

const NPC_STANCE = { hy: -0.006, Ra: -72, Rr: 0.26, Ry: 0.5, La: 72, Lr: 0.26, Ly: 0.5, c1: 6, c2: 5, Wp: 0, Vp: 0 };

function npcAnims(base: Record<string, number>) {
  const b = { ...NPC_STANCE, ...base };
  return { idle: { frames: 6, dur: 1.5, loop: true, poses: idleFrames(6, b, 0.8) } };
}

function buildNpc(id: string): Build {
  const b = new Body();
  const skin = SKINS[0];
  switch (id) {
    case 'npc_elder': {
      head(b, 0xeabf9a, { brow: 0xe6e4dc, beard: 0xefeee8 });
      hairCap(b, 0xdcdad2, (a) => (Math.abs(a) < 1.2 ? 0.27 : 0.12));
      gat(b, 0x1e1c22, 0x8a2f35);
      torso(b, { col: 0x4e6e54, collar: 0xeeeae0, w: 0.96 });
      pelvis(b, 0x3a3640);
      belt(b, 0xd8cdb0, undefined, 0xd8cdb0);
      skirtPanels(b, { n: 10, len: 0.84, col: 0x4e6e54, trim: 0xd8cdb0, flare: 0.05, widthK: 1.3 });
      legs(b, { pants: 0xd8d2c4, wrap: 0xd8d2c4, boot: 0x2a2428 });
      arms(b, { sleeve: 0x4e6e54, cuff: 0xd8cdb0, skin: 0xeabf9a, flare: 0.08 });
      const sid = b.next();
      b.on('gripR', (g) => {
        g.set({ id: sid });
        g.tube([v3(0, 0, -0.74), v3(0.01, 0, 0), v3(-0.01, 0.01, 0.4), v3(0.04, 0, 0.6)], [0.016, 0.024, 0.024, 0.04], (_i, s) => (s % 2 ? 0x5e3d28 : 0x704a30), 5);
      });
      return { body: b, anims: npcAnims({ Ra: -40, Rr: 0.26, Ry: 0.6, Wp: 84, crx: 7, drx: 4 }) };
    }
    case 'npc_merchant': {
      head(b, skin, { brow: 0x2a1c18, blush: true });
      hairCap(b, 0x2c1e1a, (a, i) => (Math.abs(a) < 1.1 ? 0.25 + (i % 2) * 0.02 : 0.1 + (i % 2) * 0.03));
      ponytail(b, 0x2c1e1a, 0.14, -0.11, 4, 0.046);
      bonnet(b, 0xc4a464);
      torso(b, { col: 0xd2a84c, collar: 0xf0ead8, dark: 0x9a3a30, w: 0.96 });
      pelvis(b, 0x7a3c34);
      belt(b, 0x7a3c34, undefined, 0x9a3a30);
      skirtPanels(b, { n: 10, len: 0.8, col: 0x7a3c34, trim: 0xd2a84c, flare: 0.08, widthK: 1.3 });
      legs(b, { pants: 0x7a3c34, wrap: 0x7a3c34, boot: 0x3a2a20 });
      arms(b, { sleeve: 0xd2a84c, cuff: 0x9a3a30, skin });
      // 등짐: 지게와 보따리
      const pid = b.next();
      b.on('chest', (g) => {
        g.set({ id: pid });
        g.rock(0, 0.33, -0.3, 0.27, 0.3, 0.2, 0x7d6448, 11, 0.1);
        g.set({ id: b.next() });
        g.box(0, 0.62, -0.3, 0.46, 0.05, 0.3, 0x5a3f2c, 0.012);
        g.set({ id: b.next() });
        g.rock(0.05, 0.76, -0.3, 0.18, 0.11, 0.14, 0x3e5e7a, 12, 0.1);
        g.set({ id: b.next() });
        for (const s of [-1, 1]) g.tube([v3(s * 0.2, 0.86, -0.18), v3(s * 0.22, -0.3, -0.2)], 0.018, 0x5a3f2c, 4);
      });
      return { body: b, anims: npcAnims({ Ra: -50, Rr: 0.2, Ry: 0.64, La: 50, Lr: 0.2, Ly: 0.64 }) };
    }
    case 'npc_smith': {
      head(b, 0xd8a57e, { brow: 0x1c1410 });
      hairCap(b, 0x1c1614, (a, i) => (Math.abs(a) < 1.2 ? 0.262 + (i % 2) * 0.016 : 0.13));
      headband(b, 0xe4dcc4, false);
      torso(b, { col: 0xd8a57e, collar: 0x8a6a4a, dark: 0x3a2a20, w: 1.14 });
      // 가죽 앞치마
      const aid = b.next();
      b.on('hips', (g) => {
        g.set({ id: aid });
        g.box(0, -0.2, 0.108, 0.27, 0.64, 0.016, 0x54382a, 0.004);
      });
      b.on('chest', (g) => {
        g.set({ id: aid });
        g.box(0, 0.2, 0.128, 0.23, 0.44, 0.016, 0x54382a, 0.004);
      });
      pelvis(b, 0x3a3640);
      belt(b, 0x2c221c, 0xa89a7a);
      legs(b, { pants: 0x45404a, wrap: 0x45404a, boot: 0x2a2020 });
      arms(b, { sleeve: 0xd8a57e, cuff: 0xd8a57e, skin: 0xd8a57e });
      const hid = b.next();
      b.on('gripR', (g) => {
        g.set({ id: hid });
        g.tube([v3(0, 0, -0.14), v3(0, 0, 0.46)], 0.02, 0x5e3d28, 5);
        g.set({ id: b.next(), spec: 0.7 });
        g.box(0, 0, 0.47, 0.09, 0.22, 0.1, 0x3e3e48, 0.012);
        g.set({ spec: 0 });
      });
      return { body: b, anims: npcAnims({ Ra: -64, Rr: 0.26, Ry: 0.46, Wp: -24, Fz: 0.03, Gz: -0.03 }) };
    }
    case 'npc_guard': {
      head(b, 0xecbc92, { brow: 0x1c1614 });
      hairCap(b, 0x1c1614, (a, i) => (Math.abs(a) < 1.2 ? 0.262 + (i % 2) * 0.012 : 0.14));
      // 전립: 붉은 술이 달린 군모
      const hid = b.next();
      b.on('head', (g) => {
        g.set({ id: hid, spec: 0.2 });
        const y = 0.25;
        g.loft([[0, y, 0, 0.23, 0.23], [0, y + 0.016, 0, 0.19, 0.19], [0, y + 0.03, 0, 0.126, 0.126], [0, y + 0.13, 0, 0.1, 0.1], [0, y + 0.15, 0, 0.03, 0.03]], (i) => (i === 0 ? 0x34303a : 0x26242c), 12);
        g.set({ id: b.next() });
        g.rock(0, y + 0.17, 0, 0.05, 0.03, 0.05, 0xb5302a, 3, 0.2, 0);
        g.set({ id: b.next(), spec: 0.7 });
        g.box(0, y + 0.08, 0.108, 0.04, 0.05, 0.012, 0xd2a24a);
        g.set({ spec: 0 });
      });
      torso(b, { col: 0xa42e2c, collar: 0xe9e2d0, studs: 0xd2a24a, dark: 0x263a5e });
      pauldrons(b, 0x6a6f7a, 0xd2a24a);
      pelvis(b, 0x263a5e);
      belt(b, 0x2c221c, 0xd2a24a);
      skirtPanels(b, { n: 8, len: 0.54, col: 0xa42e2c, trim: 0xd2a24a, flare: 0.08 });
      legs(b, { pants: 0x263a5e, wrap: 0x4a3a2c, boot: 0x241c1c, strap: 0x705c44 });
      arms(b, { sleeve: 0x263a5e, cuff: 0x263a5e, skin: 0xecbc92, bracer: 0x585c66 });
      const sid = b.next();
      b.on('gripR', (g) => {
        g.set({ id: sid });
        g.tube([v3(0, 0, -0.8), v3(0, 0, 1.2)], 0.018, (_i, s) => (s % 2 ? 0x5e3d28 : 0x704a30), 5);
        g.set({ id: b.next() });
        g.rock(0, 0, 1.17, 0.042, 0.042, 0.06, 0xb5302a, 3, 0.2, 0);
        g.set({ id: b.next(), spec: 1 });
        g.loft([[0, 1.2, 0, 0.04, 0.012], [0, 1.42, 0, 0, 0]].map((r) => [r[0], r[2], r[1], r[3], r[4]]).map(([x, y, z, rx, rz]) => [x, y, z, rx, rz]), 0xdce4ee, 4);
        g.set({ spec: 0 });
      });
      return { body: b, anims: npcAnims({ Ra: -58, Rr: 0.27, Ry: 0.52, Wp: 86, La: 66, Lr: 0.22, Ly: 0.5, Fz: 0.02, Gz: -0.03 }) };
    }
    default: {
      // 창고지기 유림
      head(b, skin, { brow: 0x2a2028, blush: true });
      hairCap(b, 0x2a2028, (a, i) => (Math.abs(a) < 0.9 ? 0.25 + (i % 2) * 0.016 : Math.abs(a) < 1.7 ? 0.08 + (i % 2) * 0.03 : 0.08));
      topknot(b, 0x2a2028, 0xd2a24a, 0.27, -0.14, 1.2);
      torso(b, { col: 0xe9e2d0, collar: 0x5c4670, dark: 0xa42e2c, w: 0.94 });
      pelvis(b, 0x5c4670);
      belt(b, 0x5c4670);
      skirtPanels(b, { n: 12, len: 0.92, col: 0x5c4670, trim: 0xd2a24a, flare: 0.14, widthK: 1.25, alt: 0x6a5280 });
      legs(b, { pants: 0xe9e2d0, wrap: 0xe9e2d0, boot: 0xe9e2d0 });
      arms(b, { sleeve: 0xe9e2d0, cuff: 0x5c4670, skin, flare: 0.03 });
      const kid = b.next();
      b.on('hips', (g) => {
        g.set({ id: kid, spec: 0.8 });
        for (let i = 0; i < 4; i++) g.box(-0.11 + i * 0.02, -0.02 - (i % 2) * 0.03, 0.1, 0.012, 0.07, 0.012, 0xd2a24a);
        g.set({ spec: 0 });
      });
      return { body: b, anims: npcAnims({ Ra: -30, Rr: 0.18, Ry: 0.62, La: 30, Lr: 0.18, Ly: 0.62 }) };
    }
  }
}

const cache = new Map<string, CharAsset>();

export function humanAsset(id: string): CharAsset | null {
  let a = cache.get(id);
  if (a) return a;
  if (id.startsWith('npc_')) {
    a = finish(id, buildNpc(id));
  } else {
    return null;
  }
  cache.set(id, a);
  return a;
}
