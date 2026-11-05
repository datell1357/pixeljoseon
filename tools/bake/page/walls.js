// 벽 덩어리는 3D로 굽지 않고 픽셀로 직접 그린다. 이웃과 붙였을 때 이음새가 정확히 맞아야 하기 때문이다.
const H = 55; // 1.4유닛 × 39.2px
function hash(a, b, seed) {
  let h = Math.imul(a * 73856093 ^ b * 19349663 ^ seed * 83492791, 0x5bd1e995);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const pick = (ramp, t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))];
/** 1칸 주기의 값 잡음 */
function pnoise(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v = (i, j) => hash(((i % period) + period) % period, ((j % period) + period) % period, seed);
  return (v(xi, yi) * (1 - sx) + v(xi + 1, yi) * sx) * (1 - sy) + (v(xi, yi + 1) * (1 - sx) + v(xi + 1, yi + 1) * sx) * sy;
}

export function wallPixels(p) {
  const W = 64;
  const IH = 32 + H;
  const out = new Uint8Array(W * IH * 4);
  const put = (x, y, c) => {
    const i = (y * W + x) * 4;
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
    out[i + 3] = 255;
  };
  // 윗면: 격자 주기 잡음이라 이웃 윗면과 이어진다
  for (let y = 0; y < 32; y++) {
    const half = y < 16 ? (y + 1) * 2 : (32 - y) * 2;
    for (let x = 32 - half; x < 32 + half; x++) {
      const dx = x + 0.5 - 32;
      const dy = y + 0.5 - 16;
      const u = (dx / 32 + dy / 16) / 2 + 0.5;
      const v = (dy / 16 - dx / 32) / 2 + 0.5;
      const n = pnoise(u * 8, v * 8, 8, p.seed) * 0.6 + pnoise(u * 16, v * 16, 16, p.seed + 3) * 0.4;
      let c = pick(p.top, n * 1.15 - 0.07);
      if (p.topSpot) {
        const m = pnoise(u * 6, v * 6, 6, p.seed + 7) * 0.7 + pnoise(u * 16, v * 16, 16, p.seed + 9) * 0.3;
        if (m > p.topSpot.thr) c = pick(p.topSpot.ramp, (m - p.topSpot.thr) * 6);
      }
      put(x, y, c);
    }
  }
  // 앞면 두 장: 가로 32px 주기로 벽돌이 이어진다
  const face = (a, b, ramp, seed) => {
    const course = 11;
    const row = Math.floor(b / course);
    const by = b % course;
    const off = row % 2 ? 11 : 0;
    const aa = (a + off) % 32;
    const brick = Math.floor(aa / 16);
    const bx = aa % 16;
    if (by === course - 1 || bx === 15) return ramp.mortar;
    const shade = hash(brick, row, seed);
    const n = pnoise(a / 4, b / 4, 8, seed + 5);
    let t = shade * 0.55 + n * 0.45;
    // 돌마다 위·왼쪽은 밝고 아래·오른쪽은 어둡게
    if (by === 0 || bx === 0) t += 0.28;
    if (by === course - 2 || bx === 14) t -= 0.25;
    return pick(ramp.stone, t);
  };
  for (let x = 0; x < W; x++) {
    const left = x < 32;
    const a = left ? x : 63 - x;
    const top = 16 + Math.floor(a / 2) + 1;
    for (let b = 0; b < H; b++) {
      const ramp = left ? p.left : p.right;
      let c = face(a, b + (left ? 0 : 3), ramp, p.seed + (left ? 11 : 13));
      if (b === 0) c = ramp.lip;
      if (b >= H - 2) c = b === H - 1 ? p.base : ramp.mortar;
      if (p.crack) {
        const k = p.crack(a, b, left);
        if (k) c = k;
      }
      put(x, top + b, c);
    }
  }
  return { w: W, h: IH, ax: 32, ay: H + 16, rgba: out };
}

const hexc = (s) => {
  const v = parseInt(s.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const ramp = (...l) => l.map(hexc);

export const WALLS = {
  wall_stone: {
    seed: 21,
    top: ramp('#7f8391', '#8a8e9b', '#949aa7', '#a0a6b2'),
    topSpot: { thr: 0.66, ramp: ramp('#6e8a55', '#5f7d4b') },
    left: { stone: ramp('#6f7380', '#7d818e', '#8a8e9b', '#989ca8'), mortar: hexc('#4a4c5a'), lip: hexc('#b2b7c2') },
    right: { stone: ramp('#474a5a', '#515465', '#5a5e6f', '#666a7b'), mortar: hexc('#30313f'), lip: hexc('#7c8091') },
    base: hexc('#262632'),
  },
  wall_ash: {
    seed: 57,
    top: ramp('#55504f', '#5e5957', '#686260', '#736c69'),
    topSpot: { thr: 0.7, ramp: ramp('#3b3635', '#332f2f') },
    left: { stone: ramp('#4a4443', '#544e4c', '#5e5755', '#696260'), mortar: hexc('#2c2726'), lip: hexc('#7c7470') },
    right: { stone: ramp('#312d30', '#393436', '#413c3d', '#4a4445'), mortar: hexc('#1f1b1e'), lip: hexc('#585152') },
    base: hexc('#171416'),
    crack: (a, b, left) => {
      // 불씨가 스민 틈: 줄눈 일부를 주황으로
      if (!left) return null;
      if (b % 22 === 10 && a >= 6 && a <= 13) return hexc('#ff7a2a');
      if (b % 33 === 21 && a >= 18 && a <= 22) return hexc('#ffa64a');
      return null;
    },
  },
};
