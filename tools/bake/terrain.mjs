// 지형 타일. 전부 절차적 픽셀 코드로 만든다.
// 이음새 원리: 타일 좌표 (s,t)∈[0,1]²에서 주기 1인 잡음을 쓰고, 변형별 차이는 가장자리로 갈수록 0이 되게 섞는다.
// 그래서 어떤 변형끼리 붙여도 맞닿는 줄의 색이 정확히 같다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Img, hex } from './lib/img.mjs';

const TW = 64;
const TH = 32;
const COLS = 16;

function hash(a, b, seed) {
  let h = Math.imul((a * 73856093) ^ (b * 19349663) ^ (seed * 83492791), 0x5bd1e995);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const wrap = (i, p) => ((i % p) + p) % p;
const smooth = (t) => t * t * (3 - 2 * t);
/** s,t 주기 1, 격자 P칸 값 잡음 */
function pn(s, t, P, seed) {
  const x = s * P;
  const y = t * P;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const v = (i, j) => hash(wrap(i, P), wrap(j, P), seed);
  return (v(xi, yi) * (1 - fx) + v(xi + 1, yi) * fx) * (1 - fy) + (v(xi, yi + 1) * (1 - fx) + v(xi + 1, yi + 1) * fx) * fy;
}
const fbm = (s, t, seed) => pn(s, t, 3, seed) * 0.5 + pn(s, t, 6, seed + 1) * 0.3 + pn(s, t, 12, seed + 2) * 0.2;
/** 가장자리 공유 값: 큰 얼룩 없이 잔결만 (타일 반복이 눈에 띄지 않게) */
const shared = (s, t, seed) => 0.5 + (pn(s, t, 8, seed) - 0.5) * 0.32 + (pn(s, t, 16, seed + 1) - 0.5) * 0.26;
/** 공유 값과 변형별 얼룩을 섞는다. vi<0이면 변형 0을 쓴다 */
const blendField = (s, t, vi, seed) => {
  const w = inner(s, t);
  const v = vi < 0 ? 0 : vi;
  return shared(s, t, seed) * (1 - w) + fbm(s, t, seed + 10 + v * 7) * w;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const ramp = (...l) => l.map(hex);
/** 색 단계 고르기: v∈[0,1], 약한 격자 디더 */
function step(r, v, x, y, d = 0.5) {
  const f = Math.max(0, Math.min(0.9999, v)) * r.length;
  const i = Math.floor(f);
  const k = f - i;
  const off = k + (bayer(x, y) - 0.5) * d > 0.5 ? 1 : 0;
  return r[Math.min(r.length - 1, i + off)];
}
const norm = (v, a, b) => (v - a) / (b - a);
/** 가장자리에서 0, 안쪽에서 1 */
const inner = (s, t) => {
  const m = Math.min(s, 1 - s, t, 1 - t);
  return smooth(Math.max(0, Math.min(1, (m - 0.06) / 0.2)));
};

/** 주기 보로노이: 가까운 두 점까지의 거리와 칸 번호, 중심에서의 오프셋 */
function voronoi(s, t, N, seed, jitter = 0.72) {
  const x = s * N;
  const y = t * N;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  let dx = 0;
  let dy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const wx = wrap(cx, N);
      const wy = wrap(cy, N);
      const px = cx + 0.5 + (hash(wx, wy, seed) - 0.5) * jitter;
      const py = cy + 0.5 + (hash(wx, wy, seed + 1) - 0.5) * jitter;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = wx + wy * N;
        dx = x - px;
        dy = y - py;
      } else if (d < f2) f2 = d;
    }
  return { f1, f2, id, dx, dy };
}

// 작은 장식 도장: [x,y,색번호]
const TUFT = [[0, 0, 0], [-1, -1, 0], [1, -1, 0], [0, -1, 1], [0, -2, 1], [-2, -2, 1], [2, -2, 1]];
const TUFT2 = [[0, 0, 0], [1, -1, 1], [-1, 0, 0], [-1, -1, 1]];
const PEBBLE = [[0, 0, 0], [1, 0, 0], [-1, 0, 1], [0, -1, 2], [1, -1, 2], [0, 1, 1], [1, 1, 1]];
const FLOWER = [[0, 0, 0], [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1]];
const SPECK = [[0, 0, 0], [1, 0, 1]];
const CRACK = [[0, 0, 0], [1, 0, 0], [2, 1, 0], [3, 1, 1], [-1, -1, 0], [-2, -1, 1], [-3, -2, 1]];

/** 변형 번호에 따른 장식 자리. 가장자리에서 떨어진 곳만 */
function spots(name, vi, n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const s = 0.16 + hash(i, vi, name * 3 + 11) * 0.68;
    const t = 0.16 + hash(i, vi, name * 3 + 13) * 0.68;
    list.push([s, t, hash(i, vi, name * 3 + 17)]);
  }
  return list;
}
const toXY = (s, t) => [Math.round((s - t) * 32 + 32 - 0.5), Math.round((s + t - 1) * 16 + 16 - 0.5)];

// ---------- 지형별 색 ----------
const T = {
  grass: {
    id: 1,
    field(s, t, vi) {
      return blendField(s, t, vi, 100);
    },
    color(v, x, y) {
      return step(this.r, norm(v, 0.26, 0.74), x, y);
    },
    r: ramp('#3f6e34', '#477a39', '#4f863e', '#598f44'),
    deco: (vi) => spots(1, vi, 5 + vi).map(([s, t, k]) => [s, t, k > 0.45 ? TUFT : TUFT2, k > 0.5 ? ramp('#3a6631', '#6a9e4c') : ramp('#3a6631', '#6a9e4c')]),
  },
  meadow: {
    id: 2,
    field(s, t, vi) {
      return blendField(s, t, vi, 200);
    },
    color(v, x, y) {
      return step(this.r, norm(v, 0.26, 0.74), x, y);
    },
    r: ramp('#6c9a46', '#78a64b', '#84b052', '#92ba5c'),
    deco: (vi) => spots(2, vi, 7).map(([s, t, k], i) =>
      k > 0.62 ? [s, t, FLOWER, k > 0.82 ? ramp('#f4c84a', '#fbf4e4') : k > 0.72 ? ramp('#f4c84a', '#ec7f92') : ramp('#fff6d8', '#c9a6e6')] : [s, t, TUFT2, ramp('#5d8b40', '#a0c566')]),
  },
  forest: {
    id: 3,
    field(s, t, vi) {
      return blendField(s, t, vi, 300);
    },
    color(v, x, y, s, t) {
      const c = step(this.r, norm(v, 0.28, 0.72), x, y);
      const m = pn(s, t, 8, 333);
      if (m > 0.72) return step(this.r2, norm(m, 0.72, 0.92), x, y, 0.3);
      return c;
    },
    r: ramp('#2c3f2a', '#324a2d', '#3a5331', '#435c36'),
    r2: ramp('#4e4a2c', '#5a5230'),
    deco: (vi) => spots(3, vi, 6).map(([s, t, k]) => (k > 0.55 ? [s, t, SPECK, ramp('#8a6a34', '#6e5228')] : [s, t, TUFT2, ramp('#2a3b28', '#567a3e')])),
  },
  dirt: {
    id: 4,
    field(s, t, vi) {
      return blendField(s, t, vi, 400);
    },
    color(v, x, y) {
      return step(this.r, norm(v, 0.28, 0.72), x, y);
    },
    r: ramp('#7a5a3a', '#856340', '#916d47', '#9c774f'),
    deco: (vi) => spots(4, vi, 4 + vi).map(([s, t, k]) => (k > 0.5 ? [s, t, PEBBLE, ramp('#8c8071', '#5e4830', '#b4a896')] : [s, t, SPECK, ramp('#6a4d30', '#b0895d')])),
  },
  cobble: {
    id: 5,
    field(s, t) {
      return 0;
    },
    color(_, x, y, s, t, vi) {
      const V = voronoi(s, t, 3, 500, 0.6);
      const edge = V.f2 - V.f1;
      if (edge < 0.075) return this.mortar;
      // 돌마다 밝기 변화
      let v = hash(V.id, 0, 501);
      if (vi >= 0) v = v * (1 - inner(s, t)) + hash(V.id, vi + 1, 502) * inner(s, t);
      // 왼쪽 위가 밝고 오른쪽 아래가 어둡다 (화면 기준)
      const sx = V.dx - V.dy;
      const sy = V.dx + V.dy;
      const li = -(sx * 0.6 + sy * 0.8);
      const r = edge < 0.15 ? (li > 0 ? 0.3 : -0.3) : 0;
      return step(this.r, norm(v, 0, 1) * 0.5 + 0.25 + r + li * 0.16, x, y, 0.2);
    },
    r: ramp('#6e6a66', '#7b7671', '#88837c', '#969087', '#a39d93'),
    mortar: hex('#4a4640'),
    deco: () => [],
  },
  ash: {
    id: 6,
    field(s, t, vi) {
      return blendField(s, t, vi, 600);
    },
    color(v, x, y) {
      return step(this.r, norm(v, 0.28, 0.72), x, y);
    },
    r: ramp('#67625e', '#716c67', '#7c7671', '#87817b'),
    deco: (vi) => spots(6, vi, 6).map(([s, t, k]) => (k > 0.6 ? [s, t, SPECK, ramp('#3e3a38', '#9b958e')] : [s, t, SPECK, ramp('#a59f97', '#59544f')])),
  },
  scorch: {
    id: 7,
    field(s, t, vi) {
      return blendField(s, t, vi, 700);
    },
    color(v, x, y) {
      return step(this.r, norm(v, 0.28, 0.72), x, y);
    },
    r: ramp('#2e2626', '#372d2b', '#403430', '#4a3c36'),
    deco: (vi) => spots(7, vi, 3).map(([s, t, k]) => (k > 0.5 ? [s, t, CRACK, ramp('#ff7a2a', '#a8411f')] : [s, t, SPECK, ramp('#c85a24', '#5e3a2a')])),
  },
  cave: {
    id: 8,
    field(s, t, vi) {
      return blendField(s, t, vi, 800);
    },
    color(v, x, y, s, t) {
      const V = voronoi(s, t, 3, 830, 0.8);
      if (V.f2 - V.f1 < 0.035) return this.crack;
      return step(this.r, norm(v, 0.28, 0.72), x, y);
    },
    r: ramp('#2e3140', '#343848', '#3b3f50', '#434859'),
    crack: hex('#232532'),
    deco: (vi) => spots(8, vi, 3).map(([s, t, k]) => [s, t, PEBBLE, ramp('#4d5264', '#262834', '#646a7e')]),
  },
  stone: {
    id: 9,
    field() {
      return 0;
    },
    color(_, x, y, s, t, vi) {
      // 넉 장 판석: 격자선이 타일 가장자리와 어긋나게 (2칸 주기, 0.25 밀림)
      const N = 2;
      const us = wrap((s + 0.25) * N, N);
      const ut = wrap((t + 0.25) * N, N);
      const fx = us % 1;
      const fy = ut % 1;
      const grid = Math.min(fx, 1 - fx, fy, 1 - fy);
      if (grid < 0.035) return this.mortar;
      const cell = Math.floor(us) + Math.floor(ut) * N;
      let n = hash(cell, 0, 900) * 0.5 + pn(s, t, 12, 901) * 0.5;
      if (vi >= 0) n = n * (1 - inner(s, t)) + (hash(cell, vi + 1, 902) * 0.5 + pn(s, t, 12, 903 + vi) * 0.5) * inner(s, t);
      let bevel = 0;
      if (grid < 0.08) bevel = fx < 0.5 && fx < fy && fx < 1 - fy ? 0.25 : fy < 0.5 && fy < fx && fy < 1 - fx ? 0.25 : -0.22;
      return step(this.r, norm(n, 0.2, 0.8) * 0.6 + 0.2 + bevel, x, y, 0.3);
    },
    r: ramp('#6f7380', '#7b7f8c', '#878b98', '#9498a4'),
    mortar: hex('#4f525e'),
    deco: (vi) => spots(9, vi, 2).map(([s, t]) => [s, t, CRACK, ramp('#585b67', '#666a76')]),
  },
  water: {
    id: 10,
    field(s, t, vi) {
      return blendField(s, t, vi, 1000);
    },
    color(v, x, y, s, t) {
      // 잔물결: 화면 가로 방향 줄 (s+t가 일정한 선을 따라)
      const w = Math.sin((s + t) * Math.PI * 2 * 5 + pn(s, t, 4, 1020) * 7);
      const c = step(this.r, norm(v, 0.28, 0.72), x, y, 0.35);
      if (w > 0.86 && pn(s, t, 6, 1021) > 0.48) return this.lite;
      if (w < -0.9 && pn(s, t, 6, 1022) > 0.5) return this.r[0];
      return c;
    },
    r: ramp('#2b5c8e', '#306698', '#3670a2', '#3d7bac'),
    lite: hex('#6aa8cf'),
    deco: () => [],
  },
  lava: {
    id: 11,
    field(s, t, vi) {
      return blendField(s, t, vi, 1100);
    },
    color(v, x, y, s, t, vi) {
      const V = voronoi(s, t, 3, 1130, 0.75);
      const iw = vi < 0 ? 0 : inner(s, t);
      const e = V.f2 - V.f1 + (pn(s, t, 9, 1131) - 0.5) * 0.14 + (pn(s, t, 4, 1140 + Math.max(vi, 0) * 3) - 0.4) * 0.3 * iw;
      if (e < 0.1) return this.hot[2];
      if (e < 0.17) return this.hot[1];
      if (e < 0.25) return this.hot[0];
      return step(this.r, norm(v, 0.28, 0.72), x, y, 0.4);
    },
    r: ramp('#3b1a18', '#4b201a', '#5c281c', '#6e301f'),
    hot: ramp('#b23a14', '#ee6a18', '#ffc23e'),
    deco: () => [],
  },
};

// 겹침 가장자리 설정: 테두리에 입히는 색
const RIM = {
  meadow: { w: 0.05, mix: [0.82, 0.86, 0.72] },
  forest: { w: 0.05, mix: [0.8, 0.8, 0.8] },
  dirt: { w: 0.06, mix: [0.82, 0.8, 0.76] },
  cobble: { w: 0.05, mix: [0.72, 0.72, 0.72] },
  ash: { w: 0.05, mix: [1.08, 1.08, 1.06] },
  scorch: { w: 0.07, mix: [0.8, 0.72, 0.7] },
  stone: { w: 0.05, mix: [0.68, 0.68, 0.72] },
  water: { w: 0.07, color: hex('#b7dfe8'), w2: 0.11, color2: hex('#4f8fba') },
  lava: { w: 0.08, color: hex('#22100f'), w2: 0.14, color2: hex('#ffb733') },
};

const insideTile = (x, y) => {
  const half = y < 16 ? (y + 1) * 2 : (32 - y) * 2;
  return x >= 32 - half && x < 32 + half;
};
const toST = (x, y) => {
  const dx = x + 0.5 - 32;
  const dy = y + 0.5 - 16;
  return [(dx / 32 + dy / 16) / 2 + 0.5, (dy / 16 - dx / 32) / 2 + 0.5];
};

function drawFull(img, name, vi, ox, oy) {
  const def = T[name];
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      if (!insideTile(x, y)) continue;
      const [s, t] = toST(x, y);
      const v = def.field(s, t, vi);
      img.set(ox + x, oy + y, def.color(v, x, y, s, t, vi));
    }
  for (const [s, t, stamp, cols] of def.deco(vi)) {
    const [cx, cy] = toXY(s, t);
    for (const [dx, dy, ci] of stamp) {
      if (insideTile(cx + dx, cy + dy)) img.set(ox + cx + dx, oy + cy + dy, cols[ci]);
    }
  }
}

function drawEdge(img, name, n, ox, oy) {
  const def = T[name];
  const rim = RIM[name];
  const N = n & 1 ? 1 : 0;
  const E = n & 2 ? 1 : 0;
  const S = n & 4 ? 1 : 0;
  const W = n & 8 ? 1 : 0;
  const se = def.id * 40 + 5000;
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      if (!insideTile(x, y)) continue;
      const [s, t] = toST(x, y);
      if (n === 0) continue;
      const evi = n & 3;
      let col = def.color(def.field(s, t, evi), x, y, s, t, evi);
      let a = 255;
      if (n !== 15) {
        // 이웃과 겹치는 2px 줄은 변 위의 값으로 맞춘다
        const cs = s < 0.02 ? 0 : s > 0.98 ? 1 : s;
        const ct = t < 0.02 ? 0 : t > 0.98 ? 1 : t;
        const bil = N * (1 - cs) * (1 - ct) + E * cs * (1 - ct) + S * cs * ct + W * (1 - cs) * ct;
        const wob = (pn(s, t, 4, se) - 0.5) * 0.32 + (pn(s, t, 9, se + 1) - 0.5) * 0.2 + (pn(s, t, 18, se + 2) - 0.5) * 0.08;
        const d = bil + wob - 0.5;
        // 알파는 네 단계 + 격자 디더로 부드럽게
        const soft = Math.max(0, Math.min(1, (d + 0.02) / 0.09));
        const lv = Math.floor(soft * 3 + bayer(x, y) * 0.999);
        a = [0, 96, 176, 255][lv];
        if (rim && a > 0) {
          if (rim.color && d < rim.w) col = rim.color;
          else if (rim.color2 && d < rim.w2) col = rim.color2;
          else if (rim.mix && d < rim.w) col = [col[0] * rim.mix[0], col[1] * rim.mix[1], col[2] * rim.mix[2], 255].map((v) => Math.min(255, Math.round(v)));
        }
      }
      if (a > 0) img.set(ox + x, oy + y, [col[0], col[1], col[2], a]);
    }
}

export async function bakeTerrain(art) {
  const names = ['grass', 'meadow', 'forest', 'dirt', 'cobble', 'ash', 'scorch', 'cave', 'stone', 'water', 'lava'];
  const edges = ['meadow', 'forest', 'dirt', 'cobble', 'ash', 'scorch', 'stone', 'water', 'lava'];
  const fullCount = names.length * 4;
  const edgeStart = Math.ceil(fullCount / COLS) * COLS;
  const total = edgeStart + edges.length * 16;
  const rows = Math.ceil(total / COLS);
  const img = new Img(COLS * TW, rows * TH);
  const json = { tw: TW, th: TH, cols: COLS, full: {}, edge: {} };
  const place = (n) => [(n % COLS) * TW, Math.floor(n / COLS) * TH];
  let n = 0;
  for (const name of names) {
    json.full[name] = [];
    for (let vi = 0; vi < 4; vi++, n++) {
      const [ox, oy] = place(n);
      drawFull(img, name, vi, ox, oy);
      json.full[name].push(n);
    }
  }
  n = edgeStart;
  for (const name of edges) {
    json.edge[name] = n;
    for (let m = 0; m < 16; m++, n++) {
      const [ox, oy] = place(n);
      drawEdge(img, name, m, ox, oy);
    }
  }
  img.save(join(art, 'terrain/terrain.png'));
  mkdirSync(join(art, 'terrain'), { recursive: true });
  writeFileSync(join(art, 'terrain/terrain.json'), JSON.stringify(json, null, 1) + '\n');
}
