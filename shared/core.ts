// 좌표, 방향, 충돌 등 서버와 클라이언트가 함께 쓰는 기본 도구

/** 화면 비율: 땅 1칸이 가로 40px, 세로 22px, 높이 1유닛이 33.4px. 카메라는 정면에서 약 33도 내려다본다. */
export const PX_U = 40;
export const PX_V = 22;
export const PX_H = 33.4;

export const toX = (u: number, _v: number) => u * PX_U;
export const toY = (_u: number, v: number) => v * PX_V;
export const toUV = (x: number, y: number): [number, number] => [x / PX_U, y / PX_V];

export const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'] as const;
export type DirName = (typeof DIRS)[number];

/** 방향 번호별 월드 단위 벡터. S=(+u,+v), E=(+u,-v) */
export const DIR_VEC: readonly [number, number][] = [
  [Math.SQRT1_2, Math.SQRT1_2], // S
  [0, 1], // SW
  [-Math.SQRT1_2, Math.SQRT1_2], // W
  [-1, 0], // NW
  [-Math.SQRT1_2, -Math.SQRT1_2], // N
  [0, -1], // NE
  [Math.SQRT1_2, -Math.SQRT1_2], // E
  [1, 0], // SE
];

/** 월드 벡터 -> 8방향 번호 */
export function dirFromVec(du: number, dv: number): number {
  if (du === 0 && dv === 0) return 0;
  let best = 0;
  let bestDot = -Infinity;
  const l = Math.hypot(du, dv);
  for (let i = 0; i < 8; i++) {
    const d = (du / l) * DIR_VEC[i][0] + (dv / l) * DIR_VEC[i][1];
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return best;
}

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const dist = (a: number, b: number, c: number, d: number) => Math.hypot(a - c, b - d);

export function normalize(du: number, dv: number): [number, number] {
  const l = Math.hypot(du, dv);
  if (l < 1e-6) return [1, 0];
  return [du / l, dv / l];
}

/** 시드 고정 난수 (지도 생성·소품 변형에 사용) */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 충돌 격자. res=2이면 한 칸을 2×2로 나눈다. */
export interface SolidGrid {
  w: number;
  h: number;
  res: number;
  rows: string[];
}

export function isSolid(g: SolidGrid, u: number, v: number): boolean {
  const x = Math.floor(u * g.res);
  const y = Math.floor(v * g.res);
  if (x < 0 || y < 0 || y >= g.rows.length || x >= g.rows[0].length) return true;
  return g.rows[y].charCodeAt(x) === 49; // '1'
}

/** 반지름 r의 원이 막힌 곳에 걸리는지 */
export function blocked(g: SolidGrid, u: number, v: number, r: number): boolean {
  return (
    isSolid(g, u, v) ||
    isSolid(g, u + r, v) ||
    isSolid(g, u - r, v) ||
    isSolid(g, u, v + r) ||
    isSolid(g, u, v - r)
  );
}

/** 벽을 따라 미끄러지는 이동. 결과 좌표를 돌려준다. */
export function slideMove(
  g: SolidGrid,
  u: number,
  v: number,
  du: number,
  dv: number,
  r: number,
): [number, number] {
  const steps = Math.max(1, Math.ceil(Math.hypot(du, dv) / 0.2));
  const su = du / steps;
  const sv = dv / steps;
  for (let i = 0; i < steps; i++) {
    if (!blocked(g, u + su, v + sv, r)) {
      u += su;
      v += sv;
    } else if (!blocked(g, u + su, v, r)) {
      u += su;
    } else if (!blocked(g, u, v + sv, r)) {
      v += sv;
    } else {
      break;
    }
  }
  return [u, v];
}

/** 두 점 사이가 뚫려 있는지 (시야·돌진 판정) */
export function lineClear(g: SolidGrid, u0: number, v0: number, u1: number, v1: number): boolean {
  const d = dist(u0, v0, u1, v1);
  const n = Math.max(1, Math.ceil(d / 0.25));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (isSolid(g, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t)) return false;
  }
  return true;
}
