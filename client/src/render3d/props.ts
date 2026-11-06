// 소품 모델. 지도에 쓰이는 이름 그대로 짓는다. 가을 저녁의 한옥 마을과 그 너머 지역.
import * as THREE from 'three';
import { Geo, rng, tone, mix, v3, type Hex } from './geo';

const WOOD = 0x6b4029;
const WOOD_D = 0x45291e;
const WOOD_L = 0x93633c;
const PLASTER = 0xe4dcc6;
const STONE = 0x98918a;
const STONE_D = 0x69666a;
const TILE = 0x46505f;
const TILE_L = 0x626f80;
const THATCH = 0xb79a58;
const THATCH_D = 0x7f6638;
const PAPER = 0xffcf80;

export const PROP_LIGHTS: Record<string, { x: number; y: number; z: number; r: number; col: number; k: number }> = {
  torch: { x: 0, y: 1.5, z: 0.1, r: 6, col: 0xff8a3c, k: 1 },
  ember_vent: { x: 0, y: 0.4, z: 0, r: 2.6, col: 0xff6a22, k: 0.8 },
  mush_cluster: { x: 0, y: 0.4, z: 0, r: 2, col: 0x8fe0a0, k: 0.5 },
  shop_stall: { x: 0, y: 1.6, z: 0.5, r: 3.2, col: 0xffb060, k: 0.7 },
  smithy: { x: 0.2, y: 0.8, z: 1.7, r: 3.6, col: 0xff7a2c, k: 1 },
  tavern: { x: 0, y: 1, z: 2.3, r: 4, col: 0xffb060, k: 0.8 },
  house_a: { x: 0, y: 1, z: 1.8, r: 2.8, col: 0xffb060, k: 0.65 },
  house_c: { x: 0, y: 1, z: 1.8, r: 2.8, col: 0xffb060, k: 0.65 },
  hall: { x: 0, y: 1.2, z: 2.1, r: 4.4, col: 0xffb060, k: 0.8 },
  pavilion: { x: 0, y: 1.5, z: 1.15, r: 3.2, col: 0xffb060, k: 0.7 },
};

// ─── 건물 조각 ─────────────────────────────────

/** 다듬은 돌을 쌓은 기단 */
function plinth(g: Geo, w: number, d: number, h: number, seed: number) {
  const r = rng(seed);
  g.set({ id: 20 });
  const rows = Math.max(1, Math.round(h / 0.16));
  const sh = h / rows;
  for (let y = 0; y < rows; y++) {
    const inset = (rows - 1 - y) * 0.015;
    const course = (zf: number, xr: number, horiz: boolean) => {
      let t = -xr + (y % 2 ? 0.14 : 0);
      t = -xr;
      let first = true;
      while (t < xr - 0.01) {
        let len = 0.26 + r() * 0.26;
        if (first && y % 2) len *= 0.55;
        first = false;
        if (t + len > xr - 0.08) len = xr - t;
        const col = mix(STONE, r() > 0.5 ? 0xad9f8c : STONE_D, r() * 0.7);
        const yy = sh * (y + 0.5);
        if (horiz) g.box(t + len / 2, yy, zf, len - 0.012, sh - 0.012, 0.12, col, 0.012);
        else g.box(zf, yy, t + len / 2, 0.12, sh - 0.012, len - 0.012, col, 0.012);
        t += len;
      }
    };
    course(d / 2 - inset - 0.06, w / 2 - inset, true);
    course(-d / 2 + inset + 0.06, w / 2 - inset, true);
    course(w / 2 - inset - 0.06, d / 2 - inset, false);
    course(-w / 2 + inset + 0.06, d / 2 - inset, false);
  }
  g.box(0, h - 0.02, 0, w - 0.06, 0.04, d - 0.06, 0x8f8878);
  g.box(0, h / 2, 0, w - 0.2, h - 0.04, d - 0.2, 0x4a4648);
}

/** 곡선 기와 지붕. 앞뒤 경사면 + 양옆 경사면(우진각에 가까운 팔작 느낌) */
function tiledRoof(g: Geo, w: number, d: number, y0: number, h: number, o: { over?: number; lift?: number; seed?: number; col?: Hex; ridge?: Hex } = {}) {
  const { over = 0.55, lift = 0.26, seed = 3, col = TILE, ridge = 0xdcd5c4 } = o;
  const r = rng(seed);
  const W = w / 2 + over; // 처마 끝
  const D = d / 2 + over;
  const ridgeHalf = Math.max(0.2, w / 2 - d * 0.36); // 용마루 절반 길이
  const sag = 0.06;
  // 지붕면 위의 점: s(-1~1, 길이 방향), t(0 용마루~1 처마). 앞(+z) 경사 기준
  const surf = (s: number, t: number, front: number) => {
    const ridgeX = s * ridgeHalf;
    const eaveX = s * W;
    const x = ridgeX + (eaveX - ridgeX) * t;
    const z = front * (D * t);
    // 처마로 갈수록 오목하게 내려왔다가 끝에서 살짝 들린다
    const tt = t * t;
    const fall = h * (1 - (1 - t) * (1 - t * 0.35));
    const cornerLift = lift * Math.abs(s) ** 3 * t ** 2;
    const y = y0 + h - fall * 0.98 + cornerLift + sag * (1 - s * s) * (1 - t) * -1 + tt * 0.02;
    return v3(x, y, z);
  };
  const stripN = Math.round((w + over * 2) / 0.17);
  const segs = 7;
  g.set({ id: 30, spec: 0.12 });
  for (const front of [1, -1]) {
    for (let i = 0; i < stripN; i++) {
      const s0 = -1 + (2 * i) / stripN;
      const s1 = -1 + (2 * (i + 1)) / stripN;
      const sm = (s0 + s1) / 2;
      const shade = tone(col, 0.9 + r() * 0.22);
      const rib = i % 2 === 0;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const a0 = surf(s0, t0, front);
        const b0 = surf(s1, t0, front);
        const a1 = surf(s0, t1, front);
        const b1 = surf(s1, t1, front);
        if (rib) {
          // 수키와: 지붕 골 위로 솟은 둥근 줄을 세모 단면으로
          const m0 = surf(sm, t0, front).add(v3(0, 0.055, 0));
          const m1 = surf(sm, t1, front).add(v3(0, 0.055, 0));
          const c = tone(shade, 1.12);
          const c2 = tone(shade, 0.95);
          if (front > 0) {
            g.quad(a0, a1, m1, m0, c2);
            g.quad(m0, m1, b1, b0, c);
          } else {
            g.quad(a0, m0, m1, a1, c);
            g.quad(m0, b0, b1, m1, c2);
          }
        } else {
          const c = tone(shade, 0.72);
          if (front > 0) g.quad(a0, a1, b1, b0, c);
          else g.quad(a0, b0, b1, a1, c);
        }
      }
      // 처마 끝 막새
      if (rib) {
        const e = surf(sm, 1, front);
        g.set({ id: 31, spec: 0.1 });
        g.box(e.x, e.y - 0.02, e.z + front * 0.015, ((W * 2) / stripN) * 0.9, 0.09, 0.05, tone(col, 0.62), 0.008);
        g.set({ id: 30, spec: 0.12 });
      }
    }
  }
  // 양옆 합각면
  for (const side of [1, -1]) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const f0 = -1 + (2 * i) / n;
      const f1 = -1 + (2 * (i + 1)) / n;
      const sm = (f0 + f1) / 2;
      const rib = i % 2 === 0;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const P = (f: number, t: number) => {
          const fr = f >= 0 ? 1 : -1;
          const q = surf(side, t, fr);
          q.z = f * D * t;
          // 가운데는 낮고 모서리는 들린다
          q.y -= (1 - Math.abs(f)) * lift * t * t;
          return q;
        };
        const a0 = P(f0, t0);
        const b0 = P(f1, t0);
        const a1 = P(f0, t1);
        const b1 = P(f1, t1);
        const c = tone(col, rib ? 1.02 : 0.72);
        if (side > 0) g.quad(a0, b0, b1, a1, c);
        else g.quad(a0, a1, b1, b0, c);
      }
      void sm;
    }
  }
  // 용마루: 흰 회와 검은 기와를 쌓는다
  g.set({ id: 32, spec: 0 });
  const ry = y0 + h - 0.02;
  const rl = ridgeHalf;
  g.box(0, ry + 0.05, 0, rl * 2 + 0.08, 0.16, 0.24, tone(col, 0.8), 0.02);
  g.box(0, ry + 0.17, 0, rl * 2 + 0.02, 0.1, 0.19, ridge, 0.015);
  g.box(0, ry + 0.26, 0, rl * 2 + 0.06, 0.1, 0.22, tone(col, 0.9), 0.02);
  // 끝이 치켜 오른 망와
  for (const sx of [-1, 1]) {
    g.loft(
      [
        [sx * (rl + 0.02), ry + 0.02, 0, 0.09, 0.12],
        [sx * (rl + 0.08), ry + 0.26, 0, 0.09, 0.13],
        [sx * (rl + 0.2), ry + 0.44, 0, 0.05, 0.09],
      ],
      tone(col, 0.82),
      5,
    );
  }
  // 내림마루
  g.set({ id: 33 });
  for (const sx of [-1, 1]) {
    for (const front of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        pts.push(surf(sx, t, front).add(v3(0, 0.07, 0)));
      }
      g.tube(pts, [0.075, 0.07, 0.065, 0.06, 0.06, 0.06, 0.07], tone(col, 0.92), 4);
    }
  }
  // 처마 밑면과 서까래: 그늘 속에서 나뭇결이 보인다
  g.set({ id: 34, spec: 0 });
  for (const front of [1, -1]) {
    const n = Math.round(w / 0.2);
    for (let i = 0; i <= n; i++) {
      const s = -0.96 + (1.92 * i) / n;
      const e = surf(s, 1, front);
      const inner = v3(e.x * (w / 2 + 0.05) / W, y0 + 0.02, (front * d) / 2);
      g.tube([inner, e.clone().add(v3(0, -0.07, -front * 0.04))], 0.028, i % 2 ? 0x54331f : 0x6b4029, 3);
    }
  }
  // 밑창: 처마 안쪽을 막는다
  const under = 0x26201e;
  const c0 = surf(-1, 1, 1).add(v3(0, -0.1, 0));
  const c1 = surf(1, 1, 1).add(v3(0, -0.1, 0));
  const c2 = surf(1, 1, -1).add(v3(0, -0.1, 0));
  const c3 = surf(-1, 1, -1).add(v3(0, -0.1, 0));
  g.quad(c3, c2, c1, c0, under);
}

/** 초가 지붕: 빵처럼 둥글게 부푼 짚과 그물처럼 맨 새끼줄 */
function thatchRoof(g: Geo, w: number, d: number, y0: number, h: number, seed: number) {
  const r = rng(seed);
  const W = w / 2 + 0.36;
  const D = d / 2 + 0.36;
  const ridge = Math.max(0.1, W - D); // 꼭대기 능선 절반 길이
  // x, z에서 지붕 높이: 능선까지의 거리로 둥글게
  const hAt = (x: number, z: number) => {
    const dx = Math.max(0, Math.abs(x) - ridge);
    const t = Math.min(1, Math.hypot(dx, z) / D);
    return y0 + h * Math.sqrt(Math.max(0, 1 - t ** 2.4)) - (1 - t) * 0.0;
  };
  const inside = (x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x) - ridge), z) <= D + 1e-3;
  g.set({ id: 35, spec: 0 });
  // 동심 고리로 짚을 층층이 덮는다
  const rings = 8;
  const seg = 36;
  const P = (t: number, a: number) => {
    // t 0 처마 → 1 능선, a는 둘레각
    const rr = D * Math.cos((t * Math.PI) / 2) ** 0.72;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const x = c * rr + Math.sign(c) * ridge;
    const z = sn * rr;
    return v3(x, y0 + h * Math.sin((t * Math.PI) / 2) ** 0.9, z);
  };
  for (let i = 0; i < rings; i++) {
    const t0 = i / rings;
    const t1 = (i + 1) / rings;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2;
      const a1 = ((s + 1) / seg) * Math.PI * 2;
      const j = r();
      const col = mix(THATCH, j > 0.5 ? 0xd0b36c : THATCH_D, r() * 0.6);
      const A = P(t0, a0);
      const B = P(t0, a1);
      const C = P(t1, a1);
      const E = P(t1, a0);
      if (Math.sign(Math.cos(a0)) !== Math.sign(Math.cos(a1))) {
        // 능선 양쪽이 벌어지는 곳을 평면으로 잇는다
      }
      if (i === 0) {
        A.y -= 0.03 + r() * 0.05;
        B.y -= 0.03 + r() * 0.05;
      }
      g.quad(A, E, C, B, col);
    }
  }
  // 앞뒤 사이 틈을 메우는 능선 판
  for (let i = 0; i < rings; i++) {
    const t0 = i / rings;
    const t1 = (i + 1) / rings;
    for (const sn of [1, -1]) {
      const z0 = sn * D * Math.cos((t0 * Math.PI) / 2) ** 0.72;
      const z1 = sn * D * Math.cos((t1 * Math.PI) / 2) ** 0.72;
      const y00 = y0 + h * Math.sin((t0 * Math.PI) / 2) ** 0.9;
      const y11 = y0 + h * Math.sin((t1 * Math.PI) / 2) ** 0.9;
      const n = 6;
      for (let k = 0; k < n; k++) {
        const x0 = -ridge + (2 * ridge * k) / n;
        const x1 = -ridge + (2 * ridge * (k + 1)) / n;
        const col = mix(THATCH, r() > 0.5 ? 0xd0b36c : THATCH_D, r() * 0.6);
        if (sn > 0) g.quad(v3(x0, y00, z0), v3(x1, y00, z0), v3(x1, y11, z1), v3(x0, y11, z1), col);
        else g.quad(v3(x1, y00, z0), v3(x0, y00, z0), v3(x0, y11, z1), v3(x1, y11, z1), col);
      }
    }
  }
  // 꼭대기 용마름
  g.set({ id: 37 });
  g.tube([v3(-ridge - 0.06, y0 + h + 0.015, 0), v3(ridge + 0.06, y0 + h + 0.015, 0)], 0.075, (_i, s) => (s % 2 ? THATCH_D : 0xa98c50), 6);
  // 새끼줄: 능선에서 처마로 내려오는 줄과 가로 줄
  g.set({ id: 36 });
  const rope = 0x5d4a2a;
  const nx = Math.round((W * 2) / 0.36);
  for (let i = 1; i < nx; i++) {
    const x = -W + (2 * W * i) / nx;
    for (const sn of [1, -1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 7; k++) {
        const z = (sn * D * k) / 7;
        if (!inside(x, z)) break;
        pts.push(v3(x, hAt(x, z) + 0.018, z));
      }
      if (pts.length > 1) g.tube(pts, 0.011, rope, 3);
    }
  }
  for (const zf of [0.34, 0.68]) {
    for (const sn of [1, -1]) {
      const pts: THREE.Vector3[] = [];
      const z = sn * D * zf;
      for (let k = 0; k <= 14; k++) {
        const x = -W + (2 * W * k) / 14;
        if (inside(x, z)) pts.push(v3(x, hAt(x, z) + 0.018, z));
      }
      if (pts.length > 1) g.tube(pts, 0.011, rope, 3);
    }
  }
}

/** 기둥과 벽, 창호 */
function hanokBody(g: Geo, w: number, d: number, y0: number, wallH: number, bays: number, o: { door?: number; paper?: boolean; wall?: Hex; timber?: Hex; seed?: number } = {}) {
  const { door = -1, paper = true, wall = PLASTER, timber = WOOD, seed = 5 } = o;
  const r = rng(seed);
  const hw = w / 2;
  const hd = d / 2;
  const y1 = y0 + wallH;
  g.set({ id: 40 });
  // 벽체
  g.box(0, y0 + wallH / 2, 0, w - 0.12, wallH, d - 0.12, wall);
  // 앞면: 칸 나누기
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const cx = -hw + bw * (i + 0.5);
    const isDoor = i === door;
    if (isDoor) {
      g.set({ id: 41 });
      g.box(cx, y0 + wallH * 0.48, hd - 0.03, bw - 0.14, wallH * 0.86, 0.04, 0x2c1e18);
      for (const sx of [-0.25, 0.25]) {
        g.box(cx + sx * (bw - 0.14), y0 + wallH * 0.48, hd + 0.005, (bw - 0.14) * 0.46, wallH * 0.8, 0.03, WOOD_L, 0.006);
        for (let k = 0; k < 4; k++) g.box(cx + sx * (bw - 0.14), y0 + wallH * (0.2 + k * 0.2), hd + 0.024, (bw - 0.14) * 0.42, 0.018, 0.012, WOOD_D);
      }
    } else if (paper) {
      // 창호: 은은히 빛나는 종이와 격자 살
      g.set({ id: 42, em: 0.55 });
      const wx = bw - 0.2;
      const wy = wallH * 0.52;
      const cy = y0 + wallH * 0.56;
      g.box(cx, cy, hd - 0.04, wx, wy, 0.02, PAPER);
      g.set({ id: 43, em: 0 });
      const nx = 4;
      const ny = 4;
      for (let k = 1; k < nx; k++) g.box(cx - wx / 2 + (wx * k) / nx, cy, hd - 0.02, 0.025, wy, 0.02, WOOD_D);
      for (let k = 1; k < ny; k++) g.box(cx, cy - wy / 2 + (wy * k) / ny, hd - 0.02, wx, 0.025, 0.02, WOOD_D);
      g.box(cx, cy + wy / 2 + 0.015, hd - 0.02, wx + 0.06, 0.04, 0.03, timber);
      g.box(cx, cy - wy / 2 - 0.015, hd - 0.02, wx + 0.06, 0.04, 0.03, timber);
      g.box(cx - wx / 2 - 0.015, cy, hd - 0.02, 0.04, wy, 0.03, timber);
      g.box(cx + wx / 2 + 0.015, cy, hd - 0.02, 0.04, wy, 0.03, timber);
    }
    g.set({ id: 40, em: 0 });
  }
  // 옆면 인방
  g.set({ id: 44 });
  for (const sx of [-1, 1]) {
    g.box(sx * (hw - 0.05), y0 + wallH * 0.5, 0, 0.03, 0.06, d - 0.1, timber);
    g.box(sx * (hw - 0.05), y0 + wallH * 0.82, 0, 0.03, 0.05, d - 0.1, timber);
  }
  // 기둥
  g.set({ id: 45 });
  for (let i = 0; i <= bays; i++) {
    const x = -hw + bw * i;
    for (const z of [hd, -hd]) {
      const col = mix(timber, WOOD_D, r() * 0.35);
      g.loft(
        [
          [x, y0, z, 0.075, 0.075],
          [x, y0 + wallH * 0.6, z, 0.066, 0.066],
          [x, y1, z, 0.06, 0.06],
        ],
        col,
        6,
      );
      // 주춧돌
      g.loft(
        [
          [x, y0 - 0.005, z, 0.12, 0.12],
          [x, y0 + 0.05, z, 0.09, 0.09],
        ],
        0xa59f92,
        6,
      );
    }
  }
  for (const sx of [-1, 1]) {
    const col = mix(timber, WOOD_D, 0.2);
    g.loft(
      [
        [sx * hw, y0, 0, 0.075, 0.075],
        [sx * hw, y1, 0, 0.06, 0.06],
      ],
      col,
      6,
    );
  }
  // 창방과 도리
  g.set({ id: 46 });
  g.box(0, y1 - 0.05, hd, w + 0.2, 0.1, 0.1, tone(timber, 0.92), 0.015);
  g.box(0, y1 - 0.05, -hd, w + 0.2, 0.1, 0.1, tone(timber, 0.92), 0.015);
  g.box(hw, y1 - 0.05, 0, 0.1, 0.1, d + 0.2, tone(timber, 0.92), 0.015);
  g.box(-hw, y1 - 0.05, 0, 0.1, 0.1, d + 0.2, tone(timber, 0.92), 0.015);
  // 단청 띠: 초록과 주홍을 눌러 칠한다
  g.set({ id: 47 });
  g.box(0, y1 + 0.02, hd + 0.03, w + 0.16, 0.05, 0.05, 0x3b6e62);
  g.box(0, y1 + 0.02, -hd - 0.03, w + 0.16, 0.05, 0.05, 0x3b6e62);
  for (let i = 0; i <= bays * 2; i++) g.box(-hw + (w * i) / (bays * 2), y1 + 0.02, hd + 0.06, 0.1, 0.05, 0.012, i % 2 ? 0xb5482e : 0xd9b56a);
}

/** 앞 툇마루와 댓돌 */
function porch(g: Geo, w: number, z: number, y: number) {
  g.set({ id: 48 });
  const n = Math.round(w / 0.24);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    g.box(x, y, z, w / n - 0.012, 0.05, 0.42, i % 3 === 0 ? 0x8d5d38 : 0x7a4f30, 0.006);
  }
  g.set({ id: 49 });
  g.rock(0.15, y - 0.17, z + 0.38, 0.32, 0.12, 0.16, 0x9a958d, 77, 0.1);
}

function house(variant: number) {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.22];
  if (variant === 0) {
    // 기와집
    plinth(g, 3.0, 2.6, 0.34, 11);
    hanokBody(g, 2.56, 2.0, 0.34, 1.0, 3, { door: 1, seed: 8 });
    porch(g, 2.4, 1.06, 0.33);
    tiledRoof(g, 2.56, 2.0, 1.34, 0.92, { over: 0.42, seed: 9 });
  } else {
    plinth(g, 2.9, 2.5, 0.28, 21);
    hanokBody(g, 2.44, 1.94, 0.28, 1.04, 3, { door: 0, seed: 18 });
    porch(g, 2.3, 1.03, 0.27);
    tiledRoof(g, 2.44, 1.94, 1.32, 0.86, { over: 0.42, seed: 19, col: 0x4e4a54 });
    // 장독대
    jarsOn(g, 1.15, 0.0, 1.55, 3);
  }
  return g;
}

function jarsOn(g: Geo, x: number, y: number, z: number, n: number) {
  const r = rng(n * 13 + 3);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28;
    const s = 0.8 + r() * 0.4;
    jar(g, x + Math.cos(a) * 0.14 * i, y, z + Math.sin(a) * 0.1 * i, s, 50 + i);
  }
}

/** 옹기: 유약이 반짝인다 */
function jar(g: Geo, x: number, y: number, z: number, s: number, id: number) {
  g.set({ id, spec: 0.75 });
  const col = (i: number) => (i > 3 ? 0x3f2a22 : i === 3 ? 0x5b3a2a : 0x56352a);
  g.loft(
    [
      [x, y, z, 0.1 * s, 0.1 * s],
      [x, y + 0.1 * s, z, 0.17 * s, 0.17 * s],
      [x, y + 0.24 * s, z, 0.205 * s, 0.205 * s],
      [x, y + 0.38 * s, z, 0.18 * s, 0.18 * s],
      [x, y + 0.45 * s, z, 0.115 * s, 0.115 * s],
      [x, y + 0.5 * s, z, 0.125 * s, 0.125 * s],
    ],
    col,
    10,
    { flat: false },
  );
  g.set({ id: id + 1, spec: 0.2 });
  g.loft(
    [
      [x, y + 0.5 * s, z, 0.13 * s, 0.13 * s],
      [x, y + 0.56 * s, z, 0.075 * s, 0.075 * s],
    ],
    0x4a3026,
    8,
  );
  g.set({ spec: 0 });
}

function thatchHouse() {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.25];
  plinth(g, 2.8, 2.3, 0.2, 31);
  // 흙벽
  hanokBody(g, 2.36, 1.8, 0.2, 0.98, 3, { door: 1, wall: 0xc3a57c, timber: 0x5e422c, seed: 28 });
  porch(g, 2.2, 0.97, 0.19);
  thatchRoof(g, 2.36, 1.8, 1.14, 1.02, 33);
  // 처마 밑 짚 다발, 굴뚝
  g.set({ id: 60 });
  g.loft(
    [
      [-1.05, 0.2, 1.3, 0.13, 0.13],
      [-1.05, 0.5, 1.3, 0.1, 0.1],
    ],
    0x776b5e,
    6,
  );
  g.rock(-1.05, 0.66, 1.3, 0.1, 0.1, 0.1, 0x6e6660, 5, 0.1, 0);
  return g;
}

function tavern() {
  const g = new Geo();
  g.groundAO = [0, 0.6, 0.22];
  plinth(g, 3.9, 3.6, 0.42, 41);
  hanokBody(g, 3.44, 2.9, 0.42, 1.12, 5, { door: 2, seed: 38 });
  // 앞마당 차양과 평상
  porch(g, 3.2, 1.52, 0.41);
  tiledRoof(g, 3.44, 2.9, 1.54, 0.5, { over: 0.34, seed: 44, col: 0x4b5562 });
  // 2층 누각
  g.set({ id: 61 });
  g.box(0, 2.1, 0, 2.5, 0.5, 1.8, PLASTER);
  hanokBody(g, 2.3, 1.6, 2.0, 0.72, 4, { seed: 48, door: -1 });
  tiledRoof(g, 2.3, 1.6, 2.72, 0.86, { over: 0.42, seed: 49 });
  // 주막 깃발과 등
  g.set({ id: 62, wind: 0.4 });
  g.tube([v3(1.75, 0.4, 1.9), v3(1.75, 3.1, 1.9)], [0.04, 0.025], WOOD_D, 5);
  g.set({ id: 63, wind: 1 });
  g.box(1.45, 2.65, 1.9, 0.55, 0.85, 0.018, 0xe8e0c8);
  g.box(1.45, 3.05, 1.9, 0.55, 0.06, 0.03, 0xb5482e);
  hangingLantern(g, -1.4, 1.5, 1.72, 0.8);
  hangingLantern(g, 1.0, 1.5, 1.72, 0.8);
  return g;
}

function smithy() {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.25];
  plinth(g, 2.9, 2.6, 0.18, 51);
  // 뒤와 옆은 벽, 앞은 열린 대장간
  g.set({ id: 70 });
  g.box(0, 0.8, -0.7, 2.44, 1.3, 0.2, 0x7d6a58);
  g.box(-1.12, 0.8, 0.1, 0.2, 1.3, 1.5, 0x7d6a58);
  for (const [x, z] of [[-1.2, 0.95], [1.2, 0.95], [1.2, -0.85], [0, 0.95]] as const) {
    g.set({ id: 71 });
    g.loft([[x, 0.18, z, 0.08, 0.08], [x, 1.42, z, 0.065, 0.065]], WOOD_D, 6);
  }
  g.box(0, 1.42, 0.95, 2.6, 0.1, 0.1, WOOD_D, 0.015);
  g.box(0, 1.42, -0.85, 2.6, 0.1, 0.1, WOOD_D, 0.015);
  // 화덕: 돌과 이글거리는 숯
  g.set({ id: 72 });
  g.rock(-0.45, 0.5, -0.25, 0.5, 0.36, 0.42, 0x6a615b, 62, 0.14);
  g.set({ id: 73, em: 1 });
  g.loft([[-0.45, 0.8, -0.05, 0.25, 0.14], [-0.45, 0.84, -0.05, 0.2, 0.1]], 0xff7a26, 8);
  // 모루
  g.set({ id: 74, spec: 0.6, em: 0 });
  g.box(0.45, 0.42, 0.25, 0.14, 0.42, 0.16, 0x3a3a42, 0.02);
  g.box(0.45, 0.68, 0.25, 0.46, 0.12, 0.17, 0x4a4b54, 0.03);
  g.set({ spec: 0 });
  // 굴뚝
  g.set({ id: 75 });
  g.loft([[-0.7, 0.5, -0.5, 0.2, 0.2], [-0.7, 2.75, -0.5, 0.13, 0.13]], 0x6a5c52, 6);
  tiledRoof(g, 2.44, 1.8, 1.48, 0.76, { over: 0.44, seed: 59, col: 0x4a4544 });
  return g;
}

function hangingLantern(g: Geo, x: number, y: number, z: number, s = 1) {
  // 끈
  g.set({ id: 80, em: 0 });
  g.box(x, y + 0.2 * s, z, 0.012, 0.16 * s, 0.012, 0x201610);
  // 위아래 뚜껑
  g.set({ id: 81 });
  g.loft([[x, y + 0.11 * s, z, 0.06 * s, 0.06 * s], [x, y + 0.13 * s, z, 0.03 * s, 0.03 * s]], 0x2c2018, 6);
  g.loft([[x, y - 0.13 * s, z, 0.06 * s, 0.06 * s], [x, y - 0.11 * s, z, 0.07 * s, 0.07 * s]], 0x2c2018, 6);
  // 등 몸통
  g.set({ id: 82, em: 1 });
  g.loft(
    [
      [x, y - 0.11 * s, z, 0.075 * s, 0.075 * s],
      [x, y - 0.03 * s, z, 0.115 * s, 0.115 * s],
      [x, y + 0.04 * s, z, 0.115 * s, 0.115 * s],
      [x, y + 0.11 * s, z, 0.07 * s, 0.07 * s],
    ],
    (i) => (i === 1 ? 0xffe6a8 : 0xffb65a),
    8,
    { flat: false },
  );
  // 붉은 띠
  g.set({ id: 82, em: 0.7 });
  g.loft([[x, y - 0.115 * s, z, 0.078 * s, 0.078 * s], [x, y - 0.09 * s, z, 0.09 * s, 0.09 * s]], 0xc9402a, 8);
  g.set({ em: 0 });
}

function lanternPost() {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.25];
  g.set({ id: 90 });
  g.rock(0, 0.05, 0, 0.2, 0.1, 0.19, STONE, 91, 0.1, 0);
  // 네모난 나무 기둥, 위로 갈수록 가늘다
  g.loft([[0, 0.06, 0, 0.075, 0.075], [0, 1.2, 0, 0.066, 0.066], [0, 2.3, 0, 0.056, 0.056]], (i, s2) => (s2 % 2 ? 0x5a3a26 : i ? 0x6b4730 : 0x4c2f20), 4, { rot: Math.PI / 4 });
  // 쐐기와 가로대
  g.set({ id: 91 });
  g.box(0.2, 2.2, 0, 0.62, 0.075, 0.075, 0x5a3a26, 0.012);
  g.box(0.02, 2.05, 0, 0.1, 0.2, 0.09, 0x4c2f20, 0.01);
  g.tube([v3(0.06, 1.95, 0), v3(0.32, 2.17, 0)], 0.022, 0x4c2f20, 4);
  // 작은 기와 갓
  g.set({ id: 92, spec: 0.1 });
  g.box(0.42, 2.28, 0, 0.26, 0.03, 0.26, 0x3c4452, 0.008);
  g.loft([[0.42, 2.28, 0, 0.17, 0.17], [0.42, 2.34, 0, 0.11, 0.11], [0.42, 2.38, 0, 0.03, 0.03]], 0x46505f, 4, { rot: Math.PI / 4 });
  hangingLantern(g, 0.42, 1.9, 0, 1.55);
  return g;
}

/** 광장의 석등 */
function stoneLantern() {
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.22];
  const S = 0x8c877d;
  const SD = 0x716c65;
  g.set({ id: 100 });
  g.loft([[0, 0, 0, 0.62, 0.62], [0, 0.14, 0, 0.58, 0.58], [0, 0.18, 0, 0.5, 0.5], [0, 0.3, 0, 0.46, 0.46]], (i) => (i % 2 ? S : SD), 8, { rot: Math.PI / 8 });
  // 연꽃잎 받침
  g.set({ id: 101 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.rotY(a, () => {
      g.rock(0.3, 0.38, 0, 0.14, 0.09, 0.12, S, 200 + i, 0.05, 0);
    });
  }
  g.set({ id: 102 });
  g.loft([[0, 0.34, 0, 0.17, 0.17], [0, 1.35, 0, 0.13, 0.13]], (i, s) => (s % 2 ? S : tone(S, 0.92)), 8, { rot: Math.PI / 8 });
  g.loft([[0, 1.33, 0, 0.16, 0.16], [0, 1.41, 0, 0.17, 0.17]], SD, 8, { rot: Math.PI / 8 });
  g.set({ id: 103 });
  g.loft([[0, 1.41, 0, 0.3, 0.3], [0, 1.53, 0, 0.42, 0.42], [0, 1.6, 0, 0.42, 0.42]], (i) => (i % 2 ? S : SD), 8, { rot: Math.PI / 8 });
  // 불집: 네 기둥 사이로 불이 보인다
  g.set({ id: 104, em: 1 });
  g.loft([[0, 1.6, 0, 0.26, 0.26], [0, 2.18, 0, 0.24, 0.24]], (i) => (i ? 0xffc660 : 0xffe9ae), 8, { flat: false, rot: Math.PI / 8 });
  g.set({ id: 105, em: 0 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.loft([[Math.cos(a) * 0.3, 1.6, Math.sin(a) * 0.3, 0.06, 0.06], [Math.cos(a) * 0.28, 2.2, Math.sin(a) * 0.28, 0.05, 0.05]], S, 5);
  }
  // 지붕돌
  g.set({ id: 106 });
  const up = (a: number) => 0.09 * (Math.cos(a * 8) * 0.5 + 0.5);
  void up;
  g.loft([[0, 2.18, 0, 0.52, 0.52], [0, 2.28, 0, 0.64, 0.64], [0, 2.36, 0, 0.56, 0.56], [0, 2.56, 0, 0.26, 0.26], [0, 2.68, 0, 0.12, 0.12]], (i) => (i === 0 ? SD : i === 2 ? S : tone(S, 1.06)), 8, { rot: Math.PI / 8 });
  g.set({ id: 107 });
  g.loft([[0, 2.68, 0, 0.07, 0.07], [0, 2.8, 0, 0.11, 0.11], [0, 2.92, 0, 0.1, 0.1], [0, 3.02, 0, 0, 0]], S, 8, { flat: false });
  return g;
}

/** 돌담: 막돌 쌓기 위에 기와 한 줄 */
function stoneWall(dir: 'u' | 'v', seed: number) {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.3];
  const r = rng(seed);
  g.set({ id: 110 });
  const rows = 4;
  const H = 0.62;
  for (let y = 0; y < rows; y++) {
    let t = -0.54;
    while (t < 0.54) {
      const len = 0.17 + r() * 0.17;
      const c = mix(0x9a9186, r() > 0.5 ? 0x7c7874 : 0xb0a28e, r());
      const yy = 0.09 + (y / rows) * H;
      const px = t + len / 2;
      const off = (r() - 0.5) * 0.03;
      const hy = H / rows / 2 + 0.018;
      const rid = 110 + Math.floor(r() * 4);
      g.set({ id: rid });
      if (dir === 'u') g.rock(px, yy, off, len / 2 + 0.01, hy, 0.11, c, Math.floor(r() * 9999), 0.12, 0);
      else g.rock(off, yy, px, 0.11, hy, len / 2 + 0.01, c, Math.floor(r() * 9999), 0.12, 0);
      t += len;
    }
  }
  // 흙 메움
  g.set({ id: 115 });
  if (dir === 'u') g.box(0, 0.35, 0, 1.04, 0.66, 0.12, 0x5a504a);
  else g.box(0, 0.35, 0, 0.12, 0.66, 1.04, 0x5a504a);
  // 위 기와
  g.set({ id: 116, spec: 0.1 });
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = -0.5 + (i + 0.5) / n;
    const col = tone(TILE, i % 2 ? 0.8 : 1.05);
    if (dir === 'u') {
      g.box(t, 0.76, 0.08, 1 / n - 0.004, 0.035, 0.2, col);
      g.box(t, 0.76, -0.08, 1 / n - 0.004, 0.035, 0.2, col);
    } else {
      g.box(0.08, 0.76, t, 0.2, 0.035, 1 / n - 0.004, col);
      g.box(-0.08, 0.76, t, 0.2, 0.035, 1 / n - 0.004, col);
    }
  }
  if (dir === 'u') g.box(0, 0.81, 0, 1.02, 0.06, 0.1, tone(TILE, 0.72), 0.015);
  else g.box(0, 0.81, 0, 0.1, 0.06, 1.02, tone(TILE, 0.72), 0.015);
  return g;
}

function well() {
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.25];
  const r = rng(71);
  const n = 12;
  for (let y = 0; y < 3; y++) {
    for (let i = 0; i < n; i++) {
      const a = ((i + (y % 2) * 0.5) / n) * Math.PI * 2;
      g.set({ id: 120 + (i % 3) });
      g.rock(Math.cos(a) * 0.44, 0.1 + y * 0.17, Math.sin(a) * 0.44, 0.13, 0.095, 0.11, mix(STONE, 0xb3a693, r()), 700 + i * 3 + y, 0.1, 0);
    }
  }
  g.set({ id: 124 });
  g.loft([[0, 0.05, 0, 0.36, 0.36], [0, 0.44, 0, 0.36, 0.36]], 0x1b2a30, 12);
  g.set({ id: 125, spec: 0.4 });
  g.loft([[0, 0.44, 0, 0.36, 0.36], [0, 0.45, 0, 0.36, 0.36]], 0x2c5760, 12);
  g.set({ id: 126, spec: 0 });
  for (const s of [-1, 1]) g.loft([[s * 0.6, 0, 0, 0.05, 0.05], [s * 0.6, 1.25, 0, 0.042, 0.042]], WOOD, 6);
  g.tube([v3(-0.65, 1.1, 0), v3(0.65, 1.1, 0)], 0.04, WOOD_D, 6);
  g.tube([v3(0.05, 1.08, 0), v3(0.05, 0.62, 0)], 0.008, 0x8a7a5a, 3);
  g.set({ id: 127 });
  g.loft([[0.05, 0.5, 0, 0.09, 0.09], [0.05, 0.63, 0, 0.11, 0.11]], WOOD_L, 8);
  tiledRoof(g, 1.1, 0.8, 1.22, 0.42, { over: 0.22, seed: 73, lift: 0.14 });
  return g;
}

function stall() {
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.25];
  g.set({ id: 130 });
  for (const [x, z] of [[-0.95, 0.6], [0.95, 0.6], [-0.95, -0.6], [0.95, -0.6]] as const) g.loft([[x, 0, z, 0.05, 0.05], [x, 1.5 + (z < 0 ? 0.28 : 0), z, 0.04, 0.04]], WOOD, 5);
  // 평상 위 물건
  g.set({ id: 131 });
  const n = 8;
  for (let i = 0; i < n; i++) g.box(-0.9 + (1.8 * (i + 0.5)) / n, 0.56, 0.05, 1.8 / n - 0.012, 0.05, 1.2, i % 2 ? 0x8d5d38 : 0x7f5332, 0.006);
  g.box(0, 0.28, 0.55, 1.9, 0.5, 0.05, 0x5e3b26);
  // 바구니와 과일
  const r = rng(133);
  for (let i = 0; i < 5; i++) {
    const x = -0.72 + i * 0.36;
    g.set({ id: 132 + i });
    g.loft([[x, 0.58, 0.2, 0.11, 0.11], [x, 0.67, 0.2, 0.16, 0.16]], 0xa98a52, 8);
    g.set({ id: 138 });
    const c = [0xe0702c, 0xc9402a, 0xe7bc4c, 0x7aa04a, 0xe0702c][i];
    for (let k = 0; k < 5; k++) g.rock(x + (r() - 0.5) * 0.16, 0.71, 0.2 + (r() - 0.5) * 0.16, 0.05, 0.045, 0.05, c, 300 + i * 9 + k, 0.05, 0);
  }
  jar(g, 0.62, 0.59, -0.3, 0.75, 140);
  jar(g, 0.22, 0.59, -0.36, 0.6, 142);
  // 차양: 줄무늬 천이 처진다
  g.set({ id: 144, wind: 0.25 });
  const M = 12;
  for (let i = 0; i < M; i++) {
    const x0 = -1.15 + (2.3 * i) / M;
    const x1 = -1.15 + (2.3 * (i + 1)) / M;
    const col = i % 2 ? 0xd6cfb8 : 0x2f5a78;
    const K = 4;
    for (let k = 0; k < K; k++) {
      const t0 = k / K;
      const t1 = (k + 1) / K;
      const y = (t: number) => 1.82 - t * 0.5 - Math.sin(t * Math.PI) * 0.06;
      const z = (t: number) => -0.82 + t * 1.74;
      g.quad(v3(x0, y(t0), z(t0)), v3(x0, y(t1), z(t1)), v3(x1, y(t1), z(t1)), v3(x1, y(t0), z(t0)), k === K - 1 ? tone(col, 0.86) : col);
    }
    g.box((x0 + x1) / 2, y1Fringe, 0.95, (x1 - x0) * 0.96, 0.1, 0.012, tone(col, 0.82));
  }
  g.set({ wind: 0 });
  hangingLantern(g, 0.75, 1.2, 0.68, 0.75);
  return g;
}
const y1Fringe = 1.27;

function crate() {
  const g = new Geo();
  g.groundAO = [0, 0.15, 0.25];
  g.set({ id: 150 });
  const b = 0.5;
  g.box(0, b / 2, 0, b, b, b, 0x7a5332, 0.012);
  g.set({ id: 151 });
  for (const s of [-1, 1]) {
    g.box(s * (b / 2 + 0.006), b / 2, 0, 0.012, b + 0.02, 0.07, 0x5a3a24);
    g.box(0, b / 2, s * (b / 2 + 0.006), 0.07, b + 0.02, 0.012, 0x5a3a24);
  }
  g.box(0, b + 0.006, 0, b + 0.02, 0.012, 0.07, 0x5a3a24);
  g.box(0, b + 0.006, 0, 0.07, 0.012, b + 0.02, 0x5a3a24);
  return g;
}

function barrel() {
  const g = new Geo();
  g.groundAO = [0, 0.15, 0.25];
  jar(g, 0, 0, 0, 1.15, 160);
  jar(g, 0.3, 0, 0.15, 0.7, 162);
  return g;
}

function bench() {
  // 낮은 평상
  const g = new Geo();
  g.groundAO = [0, 0.2, 0.3];
  g.set({ id: 170 });
  for (const [x, z] of [[-0.6, -0.26], [0.6, -0.26], [-0.6, 0.26], [0.6, 0.26]] as const) g.box(x, 0.14, z, 0.08, 0.28, 0.08, WOOD_D, 0.01);
  const n = 7;
  for (let i = 0; i < n; i++) {
    g.set({ id: 171 + (i % 3) });
    g.box(-0.72 + (1.44 * (i + 0.5)) / n, 0.31, 0, 1.44 / n - 0.012, 0.05, 0.72, i % 2 ? 0x96683f : 0x87593a, 0.006);
  }
  g.set({ id: 174 });
  g.box(0, 0.31, 0.36, 1.5, 0.06, 0.05, WOOD, 0.01);
  g.box(0, 0.31, -0.36, 1.5, 0.06, 0.05, WOOD, 0.01);
  return g;
}

function cart(broken = false) {
  const g = new Geo();
  g.groundAO = [0, 0.2, 0.3];
  const wheel = (x: number, z: number, tilt: number) => {
    g.at(new THREE.Matrix4().makeRotationY(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(x, 0.36, z)).multiply(new THREE.Matrix4().makeRotationZ(tilt)), () => {
      g.set({ id: 180 });
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        g.tube([v3(Math.cos(a0) * 0.36, Math.sin(a0) * 0.36, 0), v3(Math.cos(a1) * 0.36, Math.sin(a1) * 0.36, 0)], 0.032, 0x5a3a24, 4);
      }
      g.set({ id: 181 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.tube([v3(0, 0, 0), v3(Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0)], 0.016, 0x6b4029, 3);
      }
      g.loft([[0, 0, -0.06, 0.06, 0.06], [0, 0, 0.06, 0.06, 0.06]].map((q) => [q[0], q[2], q[1], q[3], q[4]]), 0x3a2a20, 8);
    });
  };
  wheel(-0.1, 0.44, 0);
  wheel(-0.1, -0.44, broken ? 0.3 : 0);
  g.set({ id: 182 });
  const tilt = broken ? 0.42 : 0.08;
  g.at(new THREE.Matrix4().makeRotationZ(-tilt).premultiply(new THREE.Matrix4().makeTranslation(0, broken ? 0.42 : 0.6, 0)), () => {
    for (let i = 0; i < 6; i++) g.box(-0.52 + i * 0.2, 0, 0, 0.19, 0.04, 0.78, i % 2 ? 0x87593a : 0x774d30, 0.006);
    for (const s of [-1, 1]) {
      g.set({ id: 183 });
      g.box(0, 0.14, s * 0.39, 1.2, 0.24, 0.035, 0x6b4029);
      g.box(0.6, 0.14, s * 0.2, 0.035, 0.24, 0.4, 0x6b4029);
    }
    g.tube([v3(0.55, -0.04, 0.26), v3(1.25, -0.28, 0.26)], 0.03, WOOD_D, 5);
    g.tube([v3(0.55, -0.04, -0.26), v3(1.25, -0.28, -0.26)], 0.03, WOOD_D, 5);
    if (!broken) {
      g.set({ id: 184 });
      g.rock(-0.2, 0.26, 0, 0.32, 0.2, 0.3, THATCH, 19, 0.12);
    }
  });
  return g;
}

function hay() {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.25];
  const r = rng(83);
  for (const [x, z, s] of [[-0.3, 0, 1], [0.36, 0.05, 0.85]] as const) {
    g.set({ id: 190 + (x > 0 ? 1 : 0) });
    g.loft(
      [
        [x, 0, z, 0.42 * s, 0.34 * s],
        [x, 0.35 * s, z, 0.36 * s, 0.3 * s],
        [x, 0.62 * s, z, 0.22 * s, 0.2 * s],
        [x, 0.8 * s, z, 0.03 * s, 0.03 * s],
      ],
      () => mix(THATCH, r() > 0.5 ? 0xd2b56a : THATCH_D, r() * 0.7),
      12,
    );
    g.set({ id: 192 });
    g.loft([[x, 0.3 * s, z, 0.39 * s, 0.325 * s], [x, 0.34 * s, z, 0.38 * s, 0.32 * s]], 0x6a5530, 12);
  }
  return g;
}

function sign() {
  // 장승
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.3];
  g.set({ id: 200 });
  g.loft([[0, 0, 0, 0.17, 0.15], [0, 0.8, 0, 0.14, 0.13], [0, 1.18, 0, 0.15, 0.14], [0, 1.4, 0, 0.1, 0.1]], 0x7a5a3c, 7);
  g.set({ id: 201 });
  // 눈과 입
  g.box(-0.06, 1.14, 0.14, 0.07, 0.04, 0.03, 0x1e1410);
  g.box(0.06, 1.14, 0.14, 0.07, 0.04, 0.03, 0x1e1410);
  g.box(0, 1.03, 0.15, 0.05, 0.1, 0.04, 0x8a4a2c);
  g.box(0, 0.92, 0.135, 0.15, 0.04, 0.03, 0x1e1410);
  g.set({ id: 202 });
  g.box(0, 0.5, 0.16, 0.13, 0.6, 0.018, 0xb5482e);
  g.set({ id: 203 });
  g.loft([[0, 1.36, 0, 0.17, 0.17], [0, 1.47, 0, 0.11, 0.11], [0, 1.58, 0, 0.02, 0.02]], 0x2c2a30, 7);
  return g;
}

// ─── 자연물 ─────────────────────────────────

function rocks(kind: string, seed: number) {
  const g = new Geo();
  g.groundAO = [0, 0.2, 0.25];
  const col = kind === 'ash' ? 0x4e4648 : kind === 'moss' ? 0x6c7264 : 0x8a857c;
  g.set({ id: 210 });
  return { g, col, r: rng(seed) };
}

function rockSmall(kind: string) {
  const { g, col, r } = rocks(kind, 91);
  g.rock(0, 0.14, 0, 0.3, 0.2, 0.26, col, 11, 0.2);
  g.set({ id: 211 });
  g.rock(0.24, 0.07, 0.14, 0.13, 0.09, 0.12, tone(col, 1.08), 12, 0.2, 0);
  void r;
  return g;
}

function rockLarge(kind: string) {
  const { g, col } = rocks(kind, 93);
  g.rock(0, 0.4, 0, 0.62, 0.52, 0.56, col, 21, 0.24);
  g.set({ id: 211 });
  g.rock(0.42, 0.18, 0.3, 0.3, 0.22, 0.26, tone(col, 1.1), 22, 0.24);
  g.set({ id: 212 });
  g.rock(-0.44, 0.14, 0.28, 0.24, 0.16, 0.2, tone(col, 0.92), 23, 0.24, 0);
  if (kind === 'moss') {
    g.set({ id: 0, wind: 0.05 });
    g.leaves(0, 0.72, 0.02, 0.5, 0.2, 0.45, 110, [0x5d7a3a, 0x70903f, 0x4a6a34], 24, 0.12);
    g.set({ wind: 0 });
  }
  return g;
}

function stump() {
  const g = new Geo();
  g.groundAO = [0, 0.14, 0.3];
  g.set({ id: 220 });
  g.loft(
    [
      [0, 0, 0, 0.32, 0.3],
      [0, 0.08, 0, 0.27, 0.26],
      [0, 0.34, 0, 0.23, 0.22],
    ],
    (_i, s) => (s % 2 ? 0x5e3e29 : 0x6d4a31),
    9,
    { capTop: false },
  );
  g.set({ id: 221 });
  g.loft([[0, 0.34, 0, 0.23, 0.22], [0, 0.35, 0, 0.17, 0.16], [0, 0.35, 0, 0.09, 0.08], [0, 0.35, 0, 0, 0]], (i) => (i % 2 ? 0xc29a64 : 0xa8804f), 9);
  return g;
}

function logProp(mossy = false) {
  const g = new Geo();
  g.groundAO = [0, 0.14, 0.3];
  g.set({ id: 230 });
  g.tube([v3(-0.72, 0.17, -0.05), v3(-0.2, 0.18, 0.03), v3(0.3, 0.17, -0.02), v3(0.72, 0.16, 0.05)], [0.17, 0.18, 0.17, 0.15], (i, s) => (s % 2 ? 0x5e3e29 : 0x6b4730), 7);
  g.set({ id: 231 });
  g.loft([[0.72, 0.16, 0.05, 0, 0]].concat([[0.725, 0.16, 0.05, 0.14, 0.14]]), 0xb48c58, 7);
  if (mossy) {
    g.set({ id: 0, wind: 0.05 });
    g.leaves(0, 0.33, 0, 0.62, 0.06, 0.14, 70, [0x5d7a3a, 0x70903f], 31, 0.1);
    g.set({ wind: 0 });
  }
  return g;
}

function bush(seed: number) {
  const g = new Geo();
  g.set({ id: 0, wind: 0.5 });
  const cols = seed % 2 ? [0x77803e, 0x8d8e42, 0x5f6e38, 0xa2823c] : [0xa2502e, 0xbf6a30, 0x8a3e2c, 0xc98a3a];
  g.leaves(0, 0.3, 0, 0.42, 0.3, 0.36, 60, cols, seed + 40, 0.2);
  g.leaves(0.26, 0.2, 0.14, 0.24, 0.18, 0.2, 22, cols, seed + 41, 0.18);
  g.set({ wind: 0 });
  return g;
}

function fern(seed: number) {
  const g = new Geo();
  g.set({ id: 0, wind: 0.8 });
  const r = rng(seed + 77);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r();
    const len = 0.3 + r() * 0.2;
    const c = i % 2 ? 0x54783c : 0x6c8c40;
    const x = Math.cos(a) * len;
    const z = Math.sin(a) * len;
    const m = v3(x * 0.5, 0.26, z * 0.5);
    const e = v3(x, 0.1, z);
    const sx = -Math.sin(a) * 0.05;
    const sz = Math.cos(a) * 0.05;
    g.quad(v3(-sx, 0, -sz), v3(sx, 0, sz), m.clone().add(v3(sx, 0, sz)), m.clone().add(v3(-sx, 0, -sz)), tone(c, 0.82));
    g.tri(m.clone().add(v3(sx, 0, sz)), e, m.clone().add(v3(-sx, 0, -sz)), c);
  }
  g.set({ wind: 0 });
  return g;
}

function mushCluster(seed: number) {
  const g = new Geo();
  const r = rng(seed + 5);
  for (let i = 0; i < 5; i++) {
    const a = r() * 6.28;
    const d = r() * 0.2;
    const s = 0.55 + r() * 0.65;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    g.set({ id: 240 + i });
    g.loft([[x, 0, z, 0.03 * s, 0.03 * s], [x, 0.17 * s, z, 0.022 * s, 0.022 * s]], 0xd8d0b8, 5);
    g.set({ id: 245 + i, em: 0.45 });
    g.loft([[x, 0.16 * s, z, 0.085 * s, 0.085 * s], [x, 0.21 * s, z, 0.065 * s, 0.065 * s], [x, 0.24 * s, z, 0, 0]], 0x7de0a8, 7);
    g.set({ em: 0 });
  }
  return g;
}

// ─── 유적·던전 ─────────────────────────────

function ruinPillar(seed: number) {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.28];
  const r = rng(seed + 300);
  const S = 0x8c8a82;
  g.set({ id: 250 });
  g.box(0, 0.08, 0, 0.5, 0.16, 0.5, tone(S, 0.92), 0.03);
  const top = 1.4 + r() * 0.7;
  const rings: number[][] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    rings.push([(r() - 0.5) * 0.02, 0.16 + t * top, (r() - 0.5) * 0.02, 0.17 - t * 0.03, 0.17 - t * 0.03]);
  }
  g.set({ id: 251 });
  g.loft(rings, (i, s) => mix(S, 0x6f7a60, i < 2 && s % 3 === 0 ? 0.45 : 0.05), 8);
  g.set({ id: 0, wind: 0.05 });
  g.leaves(0.08, 0.5, 0.16, 0.13, 0.3, 0.1, 40, [0x5d7a3a, 0x70903f], 7 + seed, 0.09);
  g.set({ wind: 0 });
  return g;
}

function archFrame(col: Hex, glow?: Hex) {
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.28];
  g.set({ id: 260 });
  for (const s of [-1, 1]) {
    g.box(s * 0.82, 0.1, 0, 0.5, 0.2, 0.5, tone(col, 0.9), 0.03);
    for (let i = 0; i < 6; i++) g.box(s * 0.82, 0.32 + i * 0.32, 0, 0.36 - (i % 2) * 0.02, 0.3, 0.36 - (i % 2) * 0.02, tone(col, 0.95 + (i % 3) * 0.05), 0.02);
  }
  g.set({ id: 261 });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI - (i / n) * Math.PI;
    const a1 = Math.PI - ((i + 1) / n) * Math.PI;
    const P = (a: number, r2: number) => v3(Math.cos(a) * r2, 2.16 + Math.sin(a) * r2 * 0.8, 0);
    const inR = 0.64;
    const ouR = 1.02;
    const c = tone(col, i % 2 ? 1.02 : 0.9);
    for (const z of [-0.18, 0.18]) {
      const fr = z > 0;
      const q = [P(a0, inR), P(a1, inR), P(a1, ouR), P(a0, ouR)].map((p) => p.add(v3(0, 0, z)));
      if (fr) g.quad(q[0], q[1], q[2], q[3], c);
      else g.quad(q[1], q[0], q[3], q[2], c);
    }
    const ring = (rr: number, flip: boolean, cc: Hex) => {
      const a = P(a0, rr).add(v3(0, 0, 0.18));
      const b = P(a1, rr).add(v3(0, 0, 0.18));
      const d = P(a1, rr).add(v3(0, 0, -0.18));
      const e = P(a0, rr).add(v3(0, 0, -0.18));
      if (flip) g.quad(e, d, b, a, cc);
      else g.quad(a, b, d, e, cc);
    };
    ring(ouR, false, tone(col, 1.12));
    ring(inR, true, tone(col, 0.72));
  }
  if (glow !== undefined) {
    g.set({ id: 262, em: 0.9 });
    g.box(0, 3.05, 0.2, 0.26, 0.26, 0.06, glow, 0.02);
    g.set({ em: 0 });
  }
  return g;
}

function ruinArch() {
  return archFrame(0x8c8a82);
}

/** 붙여 놓으면 이어지는 석벽 한 칸 */
function wallBlock(col: Hex, seed: number, top: Hex) {
  const g = new Geo();
  const r = rng(seed);
  const H = 1.5;
  g.set({ id: 270 });
  g.box(0, H / 2, 0, 0.98, H, 0.98, tone(col, 0.5));
  const rows = 6;
  const h = H / rows;
  const facade = (fn: (x: number, y: number, w: number, c: Hex) => void) => {
    for (let y = 0; y < rows; y++) {
      let t = -0.5 + (y % 2 ? -0.16 : 0);
      while (t < 0.5) {
        const w = 0.26 + r() * 0.22;
        const a = Math.max(t, -0.5);
        const b = Math.min(t + w, 0.5);
        if (b - a > 0.03) fn((a + b) / 2, h * (y + 0.5), b - a, tone(col, 0.85 + r() * 0.3));
        t += w;
      }
    }
  };
  g.set({ id: 271 });
  facade((x, y, w, c) => g.box(x, y, 0.49, w - 0.015, h - 0.015, 0.04, c, 0.008));
  facade((x, y, w, c) => g.box(0.49, y, x, 0.04, h - 0.015, w - 0.015, c, 0.008));
  facade((x, y, w, c) => g.box(-0.49, y, x, 0.04, h - 0.015, w - 0.015, c, 0.008));
  g.set({ id: 272 });
  g.box(0, H + 0.03, 0, 1.0, 0.06, 1.0, top);
  // 윗면의 깨진 돌
  for (let i = 0; i < 5; i++) g.rock((r() - 0.5) * 0.74, H + 0.08, (r() - 0.5) * 0.74, 0.1 + r() * 0.08, 0.05, 0.1 + r() * 0.08, tone(top, 0.9 + r() * 0.3), 800 + i * 7 + seed, 0.12, 0);
  return g;
}

function pillar() {
  // 네모나게 다듬은 돌기둥. 위에 나무 받침을 얹는다
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.3];
  const c = 0x77747a;
  g.set({ id: 280 });
  g.box(0, 0.1, 0, 0.62, 0.2, 0.62, tone(c, 0.86), 0.04);
  g.set({ id: 281 });
  g.box(0, 1.22, 0, 0.34, 2.04, 0.34, c, 0.05);
  g.box(0, 0.32, 0, 0.42, 0.24, 0.42, tone(c, 0.94), 0.03);
  g.set({ id: 282 });
  g.box(0, 2.32, 0, 0.5, 0.16, 0.5, WOOD_D, 0.02);
  g.box(0, 2.46, 0, 0.66, 0.12, 0.3, WOOD, 0.02);
  g.box(0, 2.46, 0, 0.3, 0.12, 0.66, WOOD, 0.02);
  return g;
}

function torch() {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.28];
  g.set({ id: 290 });
  g.loft([[0, 0, 0, 0.14, 0.14], [0, 0.12, 0, 0.12, 0.12]], 0x5c5a60, 6);
  g.loft([[0, 0.12, 0, 0.05, 0.05], [0, 1.26, 0, 0.042, 0.042]], 0x3e3430, 6);
  g.set({ id: 291, spec: 0.4 });
  g.loft([[0, 1.26, 0, 0.05, 0.05], [0, 1.4, 0, 0.13, 0.13]], 0x2c2a2e, 7);
  g.set({ id: 292, em: 1, spec: 0 });
  g.loft([[0, 1.38, 0, 0.11, 0.11], [0, 1.5, 0, 0.1, 0.1], [0, 1.66, 0, 0.05, 0.05], [0, 1.82, 0, 0, 0]], (i) => (i < 1 ? 0xffe9ae : i < 2 ? 0xffb050 : 0xff7428), 7, { flat: false });
  g.set({ em: 0 });
  return g;
}

function chest(open: boolean) {
  const g = new Geo();
  g.groundAO = [0, 0.12, 0.25];
  g.set({ id: 300 });
  g.box(0, 0.17, 0, 0.72, 0.34, 0.46, 0x6b4029, 0.015);
  g.set({ id: 301, spec: 0.7 });
  for (const x of [-0.26, 0.26]) {
    g.box(x, 0.17, 0.24, 0.06, 0.36, 0.012, 0xc09a4a);
    g.box(x, 0.17, -0.24, 0.06, 0.36, 0.012, 0xc09a4a);
  }
  g.box(0, 0.3, 0.24, 0.14, 0.14, 0.02, 0xd9b45a, 0.01);
  g.set({ id: 302, spec: 0 });
  if (open) {
    g.at(new THREE.Matrix4().makeRotationX(-1.1).premultiply(new THREE.Matrix4().makeTranslation(0, 0.36, -0.23)), () => {
      g.box(0, 0, 0.2, 0.74, 0.08, 0.46, 0x7a4c30, 0.02);
    });
    g.set({ id: 303, em: 0.6 });
    g.box(0, 0.33, 0, 0.62, 0.03, 0.36, 0xffd25a);
    g.set({ em: 0 });
  } else {
    g.box(0, 0.4, 0, 0.74, 0.12, 0.48, 0x7a4c30, 0.03);
  }
  return g;
}

function deadTree(seed: number) {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.3];
  const r = rng(seed + 400);
  const col = (_i: number, s: number) => (s % 2 ? 0x37302e : 0x2a2626);
  g.set({ id: 310 });
  const lean = (r() - 0.5) * 0.4;
  g.tube([v3(0, 0, 0), v3(lean * 0.2, 0.7, 0.02), v3(lean * 0.6, 1.5, -0.04), v3(lean, 2.3, 0.03)], [0.2, 0.13, 0.09, 0.03], col, 6);
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.28;
    const y = 0.9 + r() * 1.2;
    const l = 0.4 + r() * 0.5;
    const from = v3(lean * (y / 2.3), y, 0);
    const mid = from.clone().add(v3(Math.cos(a) * l * 0.5, 0.2 + r() * 0.2, Math.sin(a) * l * 0.5));
    const end = mid.clone().add(v3(Math.cos(a) * l * 0.6, 0.15 + r() * 0.3, Math.sin(a) * l * 0.6));
    g.set({ id: 311 + i });
    g.tube([from, mid, end], [0.05, 0.03, 0.008], col, 4);
  }
  return g;
}

function vent() {
  const g = new Geo();
  const r = rng(61);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28;
    g.set({ id: 320 + i });
    g.rock(Math.cos(a) * 0.24, 0.06, Math.sin(a) * 0.2, 0.1, 0.08, 0.09, 0x2e2a2a, 900 + i, 0.2, 0);
  }
  g.set({ id: 328, em: 1 });
  g.loft([[0, 0.02, 0, 0.2, 0.17], [0, 0.05, 0, 0.14, 0.12]], 0xff7a26, 9);
  g.set({ em: 0 });
  void r;
  return g;
}

function bones() {
  const g = new Geo();
  const r = rng(63);
  const c = 0xcfc8b4;
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.28;
    const x = (r() - 0.5) * 0.3;
    const z = (r() - 0.5) * 0.26;
    g.set({ id: 330 + i });
    g.tube([v3(x, 0.03, z), v3(x + Math.cos(a) * 0.22, 0.05, z + Math.sin(a) * 0.22)], 0.018, c, 4);
  }
  g.set({ id: 338 });
  g.rock(0.05, 0.08, 0.02, 0.08, 0.07, 0.07, c, 71, 0.1, 0);
  g.box(0.03, 0.08, 0.09, 0.028, 0.028, 0.01, 0x201c18);
  g.box(0.08, 0.08, 0.09, 0.028, 0.028, 0.01, 0x201c18);
  return g;
}

function rubble() {
  const g = new Geo();
  const r = rng(65);
  for (let i = 0; i < 8; i++) {
    g.set({ id: 340 + i });
    g.rock((r() - 0.5) * 0.46, 0.05, (r() - 0.5) * 0.38, 0.05 + r() * 0.08, 0.04 + r() * 0.05, 0.05 + r() * 0.07, tone(0x6f6e70, 0.8 + r() * 0.4), 950 + i, 0.2, 0);
  }
  return g;
}

function statue() {
  // 돌부처
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.28];
  const c = 0x77726c;
  g.set({ id: 350 });
  g.box(0, 0.16, 0, 1.1, 0.32, 1.1, tone(c, 0.9), 0.03);
  g.set({ id: 351 });
  g.loft([[0, 0.32, 0, 0.5, 0.4], [0, 0.62, 0, 0.42, 0.33], [0, 1.25, 0, 0.3, 0.22], [0, 1.72, 0, 0.32, 0.22], [0, 1.85, 0, 0.13, 0.12]], (_i, s) => (s % 2 ? c : tone(c, 0.92)), 10);
  g.set({ id: 352 });
  g.loft([[0, 1.85, 0, 0.13, 0.12], [0, 2.02, 0, 0.2, 0.19], [0, 2.26, 0, 0.19, 0.18], [0, 2.4, 0, 0.1, 0.1], [0, 2.5, 0, 0.07, 0.07]], tone(c, 1.06), 10, { flat: false });
  g.set({ id: 353 });
  g.box(-0.08, 2.14, 0.19, 0.1, 0.02, 0.02, 0x2a2622);
  g.box(0.08, 2.14, 0.19, 0.1, 0.02, 0.02, 0x2a2622);
  g.box(0, 2.0, 0.19, 0.08, 0.02, 0.02, 0x2a2622);
  g.set({ id: 354 });
  for (const s of [-1, 1]) g.tube([v3(s * 0.31, 1.6, 0.05), v3(s * 0.38, 1.05, 0.2), v3(s * 0.08, 0.92, 0.32)], [0.1, 0.09, 0.08], tone(c, 0.96), 6);
  return g;
}

function waystone() {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.26];
  const c = 0x88857d;
  g.set({ id: 360 });
  g.rock(0, 0.1, 0, 0.42, 0.16, 0.4, tone(c, 0.9), 37, 0.14);
  g.set({ id: 361 });
  g.loft([[0, 0.15, 0, 0.24, 0.2], [0, 1.0, 0, 0.17, 0.14], [0, 1.68, 0, 0.12, 0.1]], (_i, s) => (s % 2 ? c : tone(c, 0.92)), 5);
  // 새김 무늬가 빛난다
  g.set({ id: 362, em: 0.75 });
  for (let i = 0; i < 4; i++) g.box(0, 0.5 + i * 0.28, 0.17 - i * 0.012, 0.09, 0.08, 0.012, 0xffc660);
  g.set({ em: 0 });
  // 꼭대기 초롱
  g.set({ id: 363 });
  g.loft([[0, 1.66, 0, 0.16, 0.16], [0, 1.72, 0, 0.17, 0.17]], tone(c, 0.92), 6);
  hangingLantern(g, 0, 1.92, 0, 1);
  g.set({ id: 364 });
  g.loft([[0, 2.14, 0, 0.26, 0.26], [0, 2.24, 0, 0.1, 0.1], [0, 2.36, 0, 0, 0]], TILE, 6);
  return g;
}

// ─── 나무 ─────────────────────────────────

const LEAF_SETS: Hex[][] = [
  [0xc6502c, 0xd9692e, 0xa93f2a, 0xe08a36], // 단풍
  [0xdba634, 0xe8bd46, 0xc48c2e, 0xeccd5e], // 은행
  [0x80853c, 0x96933f, 0x6a7638, 0xb49a3e], // 물든 느티
  [0xa4562c, 0xc27830, 0x8a4630, 0xd49a3c], // 갈잎
];

function oak(variant: number) {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.25];
  const r = rng(variant * 97 + 11);
  const bark = (_i: number, s: number) => (s % 2 ? 0x54392a : 0x614432);
  const lean = (r() - 0.5) * 0.3;
  const top = v3(lean, 2.0, (r() - 0.5) * 0.2);
  g.set({ id: 400 });
  g.tube([v3(0, -0.1, 0), v3(lean * 0.2, 0.45, 0.02), v3(lean * 0.55, 1.2, -0.03), top], [0.25, 0.17, 0.13, 0.07], bark, 7);
  // 뿌리
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.28 + 0.6;
    g.tube([v3(0, 0.16, 0), v3(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3)], [0.08, 0.02], bark, 4);
  }
  const set = LEAF_SETS[variant % LEAF_SETS.length];
  const blobs: [number, number, number, number, number][] = [];
  blobs.push([top.x, 2.6, top.z, 1.2, 0.92]);
  const nb = 5 + Math.floor(r() * 2);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.28 + r();
    const d = 0.72 + r() * 0.32;
    blobs.push([top.x + Math.cos(a) * d, 2.05 + r() * 0.75, top.z + Math.sin(a) * d * 0.9, 0.62 + r() * 0.26, 0.5 + r() * 0.16]);
  }
  blobs.forEach(([x, y, z, rr, ry], i) => {
    // 가지
    g.set({ id: 401 + i });
    g.tube([v3(top.x * 0.8, 1.55, top.z), v3((x + top.x) / 2, y - 0.3, (z + top.z) / 2), v3(x, y - 0.1, z)], [0.08, 0.05, 0.02], bark, 4);
    g.set({ id: 410 + i, wind: 0.65 });
    g.leaves(x, y, z, rr, ry, rr, Math.round(70 * rr * rr + 30), set, variant * 13 + i + 50, 0.28);
    g.set({ wind: 0 });
  });
  return g;
}

/** 소나무: 붉은 껍질, 굽은 줄기, 납작하게 층진 잎 */
function pine(variant: number) {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.25];
  const r = rng(variant * 53 + 7);
  const bark = (i: number, s: number) => (i < 2 ? (s % 2 ? 0x4e3028 : 0x5e3a2c) : s % 2 ? 0x8a4c30 : 0x9e5a38);
  const dir = variant % 2 ? 1 : -1;
  const pts = [v3(0, -0.1, 0), v3(dir * 0.12, 0.6, 0.02), v3(dir * 0.42, 1.3, -0.04), v3(dir * 0.3, 2.1, 0.02), v3(dir * 0.5, 2.9, -0.02), v3(dir * 0.72, 3.5, 0)];
  g.set({ id: 420 });
  g.tube(pts, [0.2, 0.16, 0.13, 0.11, 0.08, 0.035], bark, 6);
  const NEED = [0x2f5a48, 0x3a6c52, 0x264c44, 0x4a7c58];
  const pad = (x: number, y: number, z: number, rx: number, id: number, from: THREE.Vector3) => {
    g.set({ id: 421 + id });
    g.tube([from, v3((x + from.x) / 2, (y + from.y) / 2 - 0.08, (z + from.z) / 2), v3(x, y - 0.05, z)], [0.06, 0.04, 0.02], 0x6a3e2c, 4);
    g.set({ id: 430 + id, wind: 0.5 });
    // 납작한 잎 뭉치: 바늘 같은 긴 카드
    g.leaves(x, y, z, rx, rx * 0.36, rx * 0.86, Math.round(80 * rx * rx + 26), NEED, variant * 7 + id + 21, 0.2, 1.1, 0.7);
    g.leaves(x, y - rx * 0.2, z, rx * 0.86, rx * 0.2, rx * 0.72, Math.round(26 * rx * rx + 8), [0x1f3d3a, 0x264c44], variant * 7 + id + 31, 0.2, 1, 0.8);
    g.set({ wind: 0 });
  };
  pad(pts[5].x + dir * 0.05, 3.68, 0, 0.95, 0, pts[4]);
  pad(pts[4].x - dir * 0.66, 3.02 + r() * 0.1, 0.1, 0.9, 1, pts[3]);
  pad(pts[3].x + dir * 0.8, 2.56 + r() * 0.1, -0.08, 0.86, 2, pts[3]);
  pad(pts[2].x - dir * 0.74, 2.0, 0.14, 0.76, 3, pts[2]);
  if (variant % 3 !== 2) pad(pts[2].x + dir * 0.7, 1.62, 0.06, 0.62, 4, pts[1]);
  return g;
}

function mossTree(large: boolean, variant: number) {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.3];
  const r = rng(variant * 31 + (large ? 3 : 5));
  const k = large ? 1.02 : 0.76;
  const bark = (_i: number, s: number) => (s % 2 ? 0x3c3a2c : 0x4a4632);
  g.set({ id: 440 });
  const t = v3((r() - 0.5) * 0.4, 2.2 * k, (r() - 0.5) * 0.2);
  g.tube([v3(0, -0.1, 0), v3(0.05, 0.8 * k, 0.02), t], [0.26 * k, 0.17 * k, 0.08 * k], bark, 7);
  const set = [0x35583a, 0x416a3e, 0x2a4a38, 0x547a40];
  const blobs = large ? 6 : 4;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * 6.28 + r();
    const d = i === 0 ? 0 : 0.8 * k;
    const y = (i === 0 ? 3.0 : 2.3 + r() * 0.5) * k;
    const rr = (i === 0 ? 1.05 : 0.7 + r() * 0.2) * k;
    g.set({ id: 441 + i, wind: 0.6 });
    g.leaves(t.x + Math.cos(a) * d, y, t.z + Math.sin(a) * d * 0.9, rr, rr * 0.72, rr, Math.round(70 * rr * rr + 30), set, variant * 11 + i + 3, 0.28);
    g.set({ wind: 0 });
  }
  // 늘어진 이끼
  g.set({ id: 0, wind: 1 });
  for (let i = 0; i < 12; i++) {
    const a = r() * 6.28;
    const d = 0.7 + r() * 0.5;
    const x = t.x + Math.cos(a) * d * k;
    const z = t.z + Math.sin(a) * d * k;
    const y = (1.9 + r() * 0.3) * k;
    g.box(x, y - 0.3, z, 0.035, 0.6, 0.012, 0x52703c);
  }
  g.set({ wind: 0 });
  return g;
}

// ─── 새 마을의 표지물 ─────────────────────────

/** 종가: 마을에서 가장 큰 기와집 */
function hall() {
  const g = new Geo();
  g.groundAO = [0, 0.6, 0.22];
  plinth(g, 6.0, 3.3, 0.5, 71);
  hanokBody(g, 5.4, 2.6, 0.5, 1.2, 7, { door: 3, seed: 72 });
  porch(g, 5.2, 1.4, 0.49);
  tiledRoof(g, 5.4, 2.6, 1.7, 1.24, { over: 0.56, seed: 73 });
  hangingLantern(g, -1.5, 1.62, 1.52, 0.8);
  hangingLantern(g, 1.5, 1.62, 1.52, 0.8);
  return g;
}

/** 솟을대문: 가운데 지붕이 높은 문. 문은 열려 있어 지나간다 */
function tallGate() {
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.22];
  for (const s of [-1, 1]) {
    g.move(s * 1.56, 0, 0, () => {
      plinth(g, 1.5, 1.24, 0.12, 80 + s);
      hanokBody(g, 1.3, 1.04, 0.12, 1.02, 1, { paper: false, seed: 82 + s });
      tiledRoof(g, 1.3, 1.04, 1.14, 0.56, { over: 0.26, seed: 84 + s });
    });
  }
  g.set({ id: 86 });
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.42, 0.42]) g.tube([v3(x, 0, z), v3(x, 1.8, z)], 0.075, (_i, c) => (c % 2 ? WOOD : WOOD_L), 6);
  }
  g.box(0, 1.76, 0.42, 1.68, 0.14, 0.14, WOOD_D, 0.01);
  g.box(0, 1.76, -0.42, 1.68, 0.14, 0.14, WOOD_D, 0.01);
  // 안쪽으로 열린 문짝
  g.set({ id: 87 });
  for (const s of [-1, 1]) {
    g.at(new THREE.Matrix4().makeTranslation(s * 0.74, 0, -0.34).multiply(new THREE.Matrix4().makeRotationY(s * 1.25)), () => {
      g.box(-s * 0.36, 0.86, 0, 0.72, 1.62, 0.05, WOOD_L, 0.006);
      for (const y of [0.4, 0.86, 1.32]) g.box(-s * 0.36, y, 0.03, 0.68, 0.05, 0.016, WOOD_D);
    });
  }
  tiledRoof(g, 1.76, 1.16, 1.84, 0.74, { over: 0.36, seed: 88 });
  return g;
}

/** 정자: 개방된 마루와 기둥, 네모 지붕 */
function pavilion() {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.22];
  plinth(g, 2.9, 2.9, 0.3, 91);
  g.set({ id: 92 });
  for (const x of [-1.15, 0, 1.15]) {
    for (const z of [-1.15, 0, 1.15]) {
      if (x === 0 && z === 0) continue;
      g.tube([v3(x, 0.3, z), v3(x, 1.86, z)], 0.075, (_i, c) => (c % 2 ? WOOD : WOOD_L), 6);
    }
  }
  // 마루
  g.set({ id: 93 });
  for (let i = 0; i < 10; i++) g.box(-1.08 + i * 0.24, 0.6, 0, 0.228, 0.05, 2.4, i % 3 === 0 ? 0x8d5d38 : 0x7a4f30, 0.006);
  // 난간
  g.set({ id: 94 });
  for (const [x0, z0, x1, z1] of [[-1.15, 1.15, -0.5, 1.15], [0.5, 1.15, 1.15, 1.15], [-1.15, -1.15, 1.15, -1.15], [-1.15, -1.15, -1.15, 1.15], [1.15, -1.15, 1.15, 1.15]] as const) {
    g.tube([v3(x0, 0.94, z0), v3(x1, 0.94, z1)], 0.03, WOOD_L, 4);
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.2);
    for (let i = 0; i <= n; i++) g.box(x0 + ((x1 - x0) * i) / n, 0.78, z0 + ((z1 - z0) * i) / n, 0.026, 0.3, 0.026, WOOD_D);
  }
  // 도리와 지붕
  g.set({ id: 95 });
  for (const z of [-1.15, 1.15]) g.box(0, 1.84, z, 2.5, 0.12, 0.12, WOOD_D, 0.01);
  for (const x of [-1.15, 1.15]) g.box(x, 1.84, 0, 0.12, 0.12, 2.5, WOOD_D, 0.01);
  tiledRoof(g, 2.5, 2.5, 1.9, 1.04, { over: 0.56, seed: 96 });
  hangingLantern(g, 0, 1.54, 1.15, 0.8);
  return g;
}

/** 당산나무: 돌을 둘러 쌓은 마을의 큰 나무. 금줄과 오색 천이 걸려 있다 */
function dangsan() {
  const g = new Geo();
  g.groundAO = [0, 0.6, 0.28];
  const r = rng(101);
  const R = 1.34;
  // 돌 둘레
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 6.283;
    g.set({ id: 102 + (i % 4) });
    g.rock(Math.cos(a) * R, 0.14, Math.sin(a) * R * 0.94, 0.2, 0.17, 0.17, mix(STONE, r() > 0.5 ? STONE_D : 0xb0a28e, r()), i + 3, 0.16, 0);
    if (i % 2 === 0) g.rock(Math.cos(a + 0.12) * (R - 0.05), 0.36, Math.sin(a + 0.12) * (R - 0.05) * 0.94, 0.17, 0.13, 0.14, mix(STONE, 0x7c7874, r()), i + 40, 0.16, 0);
  }
  g.set({ id: 106 });
  g.loft([[0, 0.02, 0, R, R * 0.94], [0, 0.42, 0, R - 0.14, (R - 0.14) * 0.94]], 0x5a4632, 16);
  // 굵은 줄기와 뿌리
  const bark = (_i: number, s: number) => (s % 2 ? 0x4c3426 : 0x5c4230);
  g.set({ id: 107 });
  g.tube([v3(0, 0.2, 0), v3(0.06, 1.2, 0.02), v3(-0.05, 2.3, -0.02), v3(0.08, 3.3, 0)], [0.62, 0.48, 0.38, 0.24], bark, 9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.283 + 0.4;
    g.tube([v3(Math.cos(a) * 0.3, 0.72, Math.sin(a) * 0.3), v3(Math.cos(a) * 0.78, 0.44, Math.sin(a) * 0.78)], [0.2, 0.06], bark, 5);
  }
  // 금줄
  g.set({ id: 108 });
  const rope: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * 6.283;
    rope.push(v3(Math.cos(a) * 0.6, 1.34 + Math.sin(a * 3) * 0.02, Math.sin(a) * 0.6));
  }
  g.tube(rope, 0.034, (_i, s) => (s % 2 ? THATCH : THATCH_D), 4);
  // 늘어뜨린 흰 종이와 오색 천
  const cloth = [0xe8e2d0, 0xb5302a, 0xe8e2d0, 0xd2a24a, 0xe8e2d0, 0x2c4a6e, 0xe8e2d0, 0x3e6a44];
  g.set({ id: 109, wind: 0.5 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.283 + 0.26;
    const c = cloth[i % cloth.length];
    const long = c === 0xe8e2d0 ? 0.24 : 0.5;
    g.box(Math.cos(a) * 0.62, 1.34 - long / 2, Math.sin(a) * 0.62, 0.07, long, 0.012, c);
  }
  g.set({ wind: 0 });
  // 큰 가지와 잎
  const set = LEAF_SETS[1];
  const set2 = LEAF_SETS[2];
  const blobs: [number, number, number, number, number][] = [[0, 4.9, 0, 2.4, 1.5]];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283 + r();
    const d = 2.0 + r() * 0.5;
    blobs.push([Math.cos(a) * d, 3.5 + r() * 1.0, Math.sin(a) * d * 0.9, 1.2 + r() * 0.34, 0.9 + r() * 0.24]);
  }
  blobs.forEach(([x, y, z, rr, ry], i) => {
    g.set({ id: 120 + (i % 8) });
    g.tube([v3(0.05, 2.7, 0), v3(x * 0.55, y - 0.54, z * 0.55), v3(x, y - 0.1, z)], [0.2, 0.11, 0.03], bark, 5);
    g.set({ id: 130 + (i % 8), wind: 0.5 });
    g.leaves(x, y, z, rr, ry, rr, Math.round(70 * rr * rr + 40), i % 3 === 2 ? set2 : set, 700 + i, 0.3);
    g.set({ wind: 0 });
  });
  return g;
}

/** 장승: 부릅뜬 눈과 큰 이빨 */
function jangseung(v: number) {
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.25];
  const wood = v % 2 ? 0x7a6448 : 0x6b5238;
  g.set({ id: 140 });
  g.tube([v3(0, 0, 0), v3(0.01, 1.2, 0), v3(-0.01, 2.22, 0)], [0.24, 0.21, 0.2], (_i, s) => (s % 2 ? wood : tone(wood, 1.18)), 8);
  // 관모
  g.set({ id: 141 });
  g.loft([[0, 2.14, 0, 0.26, 0.26], [0, 2.22, 0, 0.27, 0.27], [0, 2.46, 0, 0.17, 0.17], [0, 2.54, 0, 0.03, 0.03]], v % 2 ? 0x2c2a30 : 0x8a2f35, 8);
  // 눈과 코, 이빨
  g.set({ id: 142 });
  for (const s of [-1, 1]) {
    g.box(s * 0.09, 1.86, 0.2, 0.11, 0.09, 0.03, 0xe8e2d0);
    g.box(s * 0.09, 1.86, 0.216, 0.05, 0.05, 0.02, 0x1a1414);
    g.box(s * 0.09, 1.97, 0.2, 0.15, 0.03, 0.03, 0x1a1414);
    g.box(s * 0.052, 1.34, 0.2, 0.04, 0.09, 0.03, 0xe8e2d0);
  }
  g.box(0, 1.66, 0.22, 0.09, 0.2, 0.05, tone(wood, 0.8));
  g.box(0, 1.42, 0.2, 0.3, 0.05, 0.02, 0x1a1414);
  // 세로로 판 글자 대신 붉은 줄
  g.set({ id: 143 });
  g.box(0, 0.76, 0.21, 0.05, 0.84, 0.012, 0xa8302c);
  return g;
}

/** 솟대: 긴 장대 끝에 나무 새 */
function sotdae(v: number) {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.2];
  const r = rng(v * 7 + 5);
  const n = 3;
  for (let i = 0; i < n; i++) {
    const x = (i - 1) * 0.16 + (r() - 0.5) * 0.04;
    const z = (r() - 0.5) * 0.14;
    const h = 2.5 + r() * 0.7;
    g.set({ id: 150 + i });
    g.tube([v3(x, 0, z), v3(x + (r() - 0.5) * 0.08, h, z)], [0.038, 0.02], 0x6b5238, 4);
    g.set({ id: 153 + i });
    const a = r() * 6.28;
    g.at(new THREE.Matrix4().makeTranslation(x, h, z).multiply(new THREE.Matrix4().makeRotationY(a)), () => {
      g.rock(0, 0.05, 0, 0.11, 0.05, 0.05, 0x5c4634, i + 2, 0.1, 0);
      g.box(0.13, 0.08, 0, 0.1, 0.022, 0.022, 0x5c4634);
      g.box(0.19, 0.08, 0, 0.05, 0.012, 0.03, 0xc9913e);
      g.box(-0.12, 0.09, 0, 0.1, 0.012, 0.05, 0x5c4634);
    });
  }
  // 돌 받침
  g.set({ id: 156 });
  g.rock(0, 0.1, 0, 0.32, 0.12, 0.22, STONE, 3, 0.2, 0);
  return g;
}

/** 허수아비: 십자 막대에 낡은 옷과 삿갓 */
function scarecrow(v: number) {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.2];
  const cloth = [0x8a4a3a, 0x4e6a6e, 0x8a7a4a][v % 3];
  g.set({ id: 160 });
  g.tube([v3(0, 0, 0), v3(0, 1.72, 0)], 0.035, 0x6b5238, 4);
  g.tube([v3(-0.62, 1.24, 0), v3(0.62, 1.26, 0)], 0.028, 0x6b5238, 4);
  g.set({ id: 161, wind: 0.3 });
  g.loft([[0, 0.72, 0, 0.26, 0.15], [0, 0.96, 0, 0.2, 0.13], [0, 1.3, 0, 0.17, 0.11], [0, 1.38, 0, 0.09, 0.08]], (_i, s) => (s % 2 ? cloth : tone(cloth, 0.84)), 8);
  for (const s of [-1, 1]) g.box(s * 0.36, 1.16, 0, 0.36, 0.12, 0.08, tone(cloth, 0.9));
  g.set({ id: 162, wind: 0.5 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.box(s * (0.54 + i * 0.03), 1.1 - i * 0.04, (i - 1) * 0.03, 0.03, 0.2, 0.015, THATCH);
  g.set({ id: 163 });
  g.rock(0, 1.52, 0, 0.13, 0.13, 0.12, THATCH, 7, 0.14, 0);
  g.set({ id: 164 });
  g.loft([[0, 1.6, 0, 0.3, 0.3], [0, 1.78, 0, 0.1, 0.1], [0, 1.86, 0, 0.01, 0.01]], (_i, s) => (s % 2 ? THATCH_D : THATCH), 10);
  return g;
}

/** 홍살문: 붉은 기둥과 살. 저승길로 가는 길목을 표시한다 */
function hongsal() {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.2];
  const red = 0xa42e2c;
  g.set({ id: 170 });
  for (const s of [-1, 1]) {
    g.tube([v3(s * 1.5, 0, 0), v3(s * 1.5, 3.1, 0)], 0.1, (_i, c) => (c % 2 ? red : tone(red, 0.84)), 6);
    g.set({ id: 171 });
    g.rock(s * 1.5, 0.14, 0, 0.24, 0.17, 0.24, STONE, 3, 0.1, 0);
    g.set({ id: 170 });
  }
  g.box(0, 2.74, 0, 3.2, 0.14, 0.14, red, 0.012);
  g.box(0, 2.3, 0, 3.08, 0.1, 0.1, red, 0.012);
  // 위로 뻗은 살
  g.set({ id: 172 });
  for (let i = 0; i < 13; i++) {
    const x = -1.32 + (i * 2.64) / 12;
    const mid = Math.abs(i - 6) < 0.5;
    g.box(x, 2.68 + (mid ? 0.32 : 0.14), 0, 0.04, mid ? 0.8 : 0.52, 0.04, red);
  }
  // 가운데 삼지창 끝
  g.set({ id: 173, spec: 0.6 });
  g.box(0, 3.46, 0, 0.32, 0.03, 0.03, 0x2a2628);
  for (const x of [-0.15, 0, 0.15]) g.box(x, 3.54, 0, 0.03, 0.16, 0.03, 0x2a2628);
  g.set({ spec: 0 });
  return g;
}

/** 장독대: 돌 단 위의 옹기들 */
function jars() {
  const g = new Geo();
  g.groundAO = [0, 0.3, 0.25];
  g.set({ id: 174 });
  g.box(0, 0.08, 0, 1.62, 0.16, 1.14, STONE_D, 0.02);
  const r = rng(13);
  for (let i = 0; i < 7; i++) {
    const row = i < 3 ? 0 : 1;
    const k = i < 3 ? i - 1 : i - 4.5;
    jar(g, k * 0.46 + (r() - 0.5) * 0.04, 0.16, row ? 0.26 : -0.26, row ? 0.82 : 1.22, 176 + i * 2);
  }
  return g;
}

/** 감나무: 잎은 듬성하고 주황 감이 잔뜩 달렸다 */
function persimmon(variant: number) {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.25];
  const r = rng(variant * 41 + 29);
  const bark = (_i: number, s: number) => (s % 2 ? 0x3e2c24 : 0x4c3628);
  g.set({ id: 190 });
  const top = v3((r() - 0.5) * 0.3, 1.5, (r() - 0.5) * 0.2);
  g.tube([v3(0, -0.1, 0), v3(0.03, 0.7, 0), top], [0.17, 0.13, 0.07], bark, 6);
  const tips: THREE.Vector3[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.283 + r();
    const d = 0.78 + r() * 0.5;
    const tip = v3(top.x + Math.cos(a) * d, 2.0 + r() * 0.74, top.z + Math.sin(a) * d * 0.9);
    tips.push(tip);
    g.set({ id: 191 + i });
    g.tube([top, v3((top.x + tip.x) / 2, tip.y - 0.3, (top.z + tip.z) / 2), tip], [0.06, 0.035, 0.01], bark, 4);
    g.set({ id: 200 + i, wind: 0.55 });
    g.leaves(tip.x, tip.y, tip.z, 0.46, 0.34, 0.46, 18, [0xb0693a, 0x8e6a34, 0xc08a3c], variant * 7 + i, 0.2);
    g.set({ wind: 0 });
  }
  // 감
  g.set({ id: 210, spec: 0.5 });
  for (let i = 0; i < 26; i++) {
    const t = tips[i % tips.length];
    const c = i % 3 === 0 ? 0xf08a28 : 0xe87a22;
    g.rock(t.x + (r() - 0.5) * 0.76, t.y - 0.1 + (r() - 0.5) * 0.46, t.z + (r() - 0.5) * 0.76, 0.06, 0.056, 0.06, c, i + 2, 0.04, 0);
  }
  g.set({ spec: 0 });
  return g;
}

/** 돌다리: 완만하게 솟은 상판과 낮은 돌 난간 */
function stoneBridge(dir: 'u' | 'v') {
  const g = new Geo();
  const r = rng(219);
  const L = 5.2;
  const W = 2.8;
  const draw = () => {
    const n = 13;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = -L / 2 + L * t;
      const y = 0.06 + 0.22 * Math.sin(Math.PI * t);
      const seg = L / n;
      // 몸통: 물속까지 내려간다
      g.set({ id: 220 });
      g.box(x, y - 0.42, 0, seg, 0.64, W, STONE_D);
      // 상판 돌
      for (let k = 0; k < 4; k++) {
        const z = -W / 2 + 0.22 + ((W - 0.44) * (k + 0.5)) / 4;
        g.set({ id: 221 + ((i + k) % 3) });
        g.box(x, y - 0.03, z, seg - 0.014, 0.08, (W - 0.44) / 4 - 0.014, mix(STONE, r() > 0.5 ? 0xad9f8c : STONE_D, r() * 0.6), 0.008);
      }
      // 난간
      for (const s of [-1, 1]) {
        g.set({ id: 224 + (i % 2) });
        g.box(x, y + 0.14, s * (W / 2 - 0.11), seg - 0.006, 0.3, 0.2, mix(STONE, 0x7c7874, r()), 0.01);
      }
    }
    // 난간 끝 기둥
    g.set({ id: 226 });
    for (const sx of [-1, 1]) {
      for (const s of [-1, 1]) {
        g.box(sx * (L / 2 - 0.1), 0.34, s * (W / 2 - 0.11), 0.26, 0.68, 0.26, STONE, 0.02);
        g.rock(sx * (L / 2 - 0.1), 0.74, s * (W / 2 - 0.11), 0.13, 0.08, 0.13, 0xb0a28e, 5, 0.1, 0);
      }
    }
  };
  if (dir === 'u') draw();
  else g.rotY(Math.PI / 2, draw);
  return g;
}

/** 널다리: 나무 판자를 걸친 작은 다리 */
function plankBridge(dir: 'u' | 'v') {
  const g = new Geo();
  const r = rng(231);
  const L = 5.2;
  const W = 1.9;
  const draw = () => {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = -L / 2 + L * t;
      const y = 0.06 + 0.22 * Math.sin(Math.PI * t);
      g.set({ id: 232 + (i % 2) });
      g.box(x, y - 0.03, (r() - 0.5) * 0.06, L / n - 0.016, 0.06, W, mix(WOOD_L, WOOD, r()), 0.006);
    }
    g.set({ id: 234 });
    for (const s of [-1, 1]) {
      g.box(0, -0.06, s * (W / 2 - 0.2), L, 0.1, 0.12, WOOD_D);
      for (const t of [0.04, 0.3, 0.7, 0.96]) {
        const x = -L / 2 + L * t;
        const y = 0.06 + 0.22 * Math.sin(Math.PI * t);
        g.tube([v3(x, -0.7, s * (W / 2 - 0.02)), v3(x, y + 0.42, s * (W / 2 - 0.02))], 0.045, WOOD_D, 4);
      }
      const rail: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        rail.push(v3(-L / 2 + L * t, 0.4 + 0.22 * Math.sin(Math.PI * t), s * (W / 2 - 0.02)));
      }
      g.tube(rail, 0.024, WOOD_L, 4);
    }
  };
  if (dir === 'u') draw();
  else g.rotY(Math.PI / 2, draw);
  return g;
}

/** 삼층 석탑 */
function stonePagoda(seed: number) {
  const g = new Geo();
  g.groundAO = [0, 0.4, 0.28];
  const r = rng(seed + 900);
  const c = mix(0x8e8a82, 0x6f7a60, r() * 0.3);
  g.set({ id: 290 });
  g.box(0, 0.14, 0, 1.1, 0.28, 1.1, tone(c, 0.86), 0.03);
  g.box(0, 0.42, 0, 0.9, 0.28, 0.9, tone(c, 0.94), 0.03);
  let y = 0.56;
  for (let i = 0; i < 3; i++) {
    const w = 0.56 - i * 0.12;
    const h = i === 0 ? 0.46 : 0.22;
    g.set({ id: 291 + i * 2 });
    g.box(0, y + h / 2, 0, w, h, w, c, 0.02);
    y += h;
    // 지붕돌: 얇은 판에 귀가 살짝 들린다
    g.set({ id: 292 + i * 2 });
    const rw = w + 0.42;
    g.box(0, y + 0.05, 0, rw, 0.1, rw, tone(c, 1.06), 0.02);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box((sx * rw) / 2, y + 0.11, (sz * rw) / 2, 0.12, 0.05, 0.12, tone(c, 1.1));
    g.box(0, y + 0.13, 0, rw - 0.16, 0.06, rw - 0.16, tone(c, 0.96), 0.02);
    y += 0.16;
  }
  g.set({ id: 298 });
  g.tube([v3(0, y, 0), v3(0, y + 0.42, 0)], [0.06, 0.03], tone(c, 0.9), 6);
  // 이끼
  g.set({ id: 0, wind: 0.05 });
  g.leaves(0.3, 0.32, 0.3, 0.2, 0.12, 0.2, 30, [0x5d7a3a, 0x70903f], 11 + seed, 0.09);
  g.set({ wind: 0 });
  return g;
}

/** 서낭당: 돌을 쌓은 무더기와 오색 천을 매단 나뭇가지 */
function seonang() {
  const g = new Geo();
  g.groundAO = [0, 0.5, 0.28];
  const r = rng(77);
  for (let i = 0; i < 46; i++) {
    const t = i / 46;
    const a = i * 2.4;
    const rad = (1 - t) * 0.9;
    g.set({ id: 300 + (i % 4) });
    g.rock(Math.cos(a) * rad, 0.1 + t * 1.05, Math.sin(a) * rad * 0.9, 0.16 - t * 0.06, 0.12, 0.14, mix(STONE, r() > 0.5 ? STONE_D : 0xb0a28e, r()), i + 5, 0.2, 0);
  }
  g.set({ id: 305 });
  g.tube([v3(0.2, 0.6, -0.1), v3(0.24, 1.6, -0.12), v3(0.1, 2.5, -0.1)], [0.07, 0.05, 0.02], 0x4c3426, 5);
  for (const [x, y, z] of [[0.18, 1.9, -0.1], [0.5, 2.2, 0.1], [-0.2, 2.1, -0.2]] as const) g.tube([v3(0.22, y - 0.3, -0.1), v3(x, y, z)], [0.03, 0.01], 0x4c3426, 4);
  // 금줄과 오색 천
  g.set({ id: 306 });
  g.tube([v3(-0.7, 0.56, 0.4), v3(0, 0.66, 0.66), v3(0.7, 0.56, 0.4)], 0.03, THATCH, 4);
  const cloth = [0xb5302a, 0xe8e2d0, 0xd2a24a, 0x2c4a6e, 0x3e6a44];
  g.set({ id: 307, wind: 0.6 });
  for (let i = 0; i < 10; i++) {
    const x = (r() - 0.5) * 0.7;
    const y = 1.6 + r() * 0.8;
    g.box(0.22 + x, y - 0.18, -0.1 + (r() - 0.5) * 0.4, 0.06, 0.36, 0.012, cloth[i % cloth.length]);
  }
  g.set({ wind: 0 });
  return g;
}

// ─── 목록 ─────────────────────────────────

const BUILD: Record<string, (v: number) => Geo> = {
  house_a: () => house(0),
  house_b: () => thatchHouse(),
  house_c: () => house(1),
  tavern,
  smithy,
  shop_stall: stall,
  well,
  big_lantern: stoneLantern,
  lantern_post: lanternPost,
  fence_u: (v) => stoneWall('u', 500 + v),
  fence_v: (v) => stoneWall('v', 600 + v),
  crate,
  barrel,
  sign,
  bench,
  cart: () => cart(false),
  broken_cart: () => cart(true),
  hay,
  tree_oak: oak,
  tree_pine: pine,
  tree_moss_l: (v) => mossTree(true, v),
  tree_moss_s: (v) => mossTree(false, v),
  tree_moss_dead: (v) => deadTree(v + 20),
  tree_dead: deadTree,
  bush,
  rock_s: () => rockSmall('plain'),
  rock_l: () => rockLarge('plain'),
  mossy_rock: () => rockLarge('moss'),
  ash_rock_s: () => rockSmall('ash'),
  ash_rock_l: () => rockLarge('ash'),
  stump,
  log: () => logProp(false),
  fallen_log: () => logProp(true),
  fern,
  mush_cluster: mushCluster,
  ruin_pillar: ruinPillar,
  ruin_arch: ruinArch,
  portal_arch: () => archFrame(0x8a8678, 0xffc660),
  door_arch: () => archFrame(0x6e6a66, 0xffb060),
  wall_stone: (v) => wallBlock(0x7a8690, 700 + v, 0x5a6a5e),
  wall_ash: (v) => wallBlock(0x74605a, 800 + v, 0x5e4a44),
  pillar,
  torch,
  chest: () => chest(false),
  chest_open: () => chest(true),
  rubble,
  bone_pile: bones,
  ember_vent: vent,
  statue,
  waystone,
  hall,
  gate_tall: tallGate,
  pavilion,
  dangsan,
  jangseung,
  sotdae,
  scarecrow,
  hongsal,
  jars,
  stone_pagoda: stonePagoda,
  seonang,
  tree_persimmon: persimmon,
  bridge_u: () => stoneBridge('u'),
  bridge_v: () => stoneBridge('v'),
  plank_u: () => plankBridge('u'),
  plank_v: () => plankBridge('v'),
};

const VARIANTS: Record<string, number> = { stone_pagoda: 2, tree_persimmon: 3, jangseung: 2, sotdae: 2, scarecrow: 3, tree_oak: 8, tree_pine: 4, tree_moss_l: 3, tree_moss_s: 3, tree_dead: 3, tree_moss_dead: 2, bush: 4, fern: 3, mush_cluster: 3, ruin_pillar: 3, wall_stone: 4, wall_ash: 4, fence_u: 3, fence_v: 3 };

const SPIN = new Set(['tree_persimmon', 'tree_oak', 'tree_pine', 'tree_moss_l', 'tree_moss_s', 'tree_dead', 'tree_moss_dead', 'bush', 'fern', 'mush_cluster', 'rock_s', 'rock_l', 'mossy_rock', 'ash_rock_s', 'ash_rock_l', 'stump', 'rubble', 'bone_pile', 'ember_vent', 'hay', 'barrel']);

export const propVariants = (id: string) => VARIANTS[id] ?? 1;
export const propSpin = (id: string) => SPIN.has(id);
/** 다리: 물 위에 걸리므로 땅 높이를 따르지 않는다 */
export const propOnWater = (id: string) => /^(bridge|plank)_/.test(id);

const cache = new Map<string, THREE.BufferGeometry>();

export function clearPropCache() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}

export function propGeometry(id: string, variant: number): THREE.BufferGeometry {
  const key = `${id}#${variant}`;
  let g = cache.get(key);
  if (!g) {
    const fn = BUILD[id];
    if (!fn) console.warn('소품 모델 없음', id);
    const geo = fn ? fn(variant) : (() => {
      const q = new Geo();
      q.rock(0, 0.2, 0, 0.3, 0.3, 0.3, 0xff00ff, 1, 0.1, 0);
      return q;
    })();
    g = geo.build();
    cache.set(key, g);
  }
  return g;
}
