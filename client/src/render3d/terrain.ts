// 지도 격자에서 지형 질감 표, 높낮이, 풀잎 자리를 만든다
import * as THREE from 'three';
import type { MapData } from '@shared/mapdata';

const KIND: Record<string, number> = { grass: 0, meadow: 1, forest: 2, dirt: 3, cobble: 4, ash: 5, scorch: 6, cave: 7, stone: 8, water: 9, lava: 10 };

function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class TerrainData {
  splat: THREE.DataTexture;
  baseKind: number;
  kinds: number[] = [];
  kindsVec = new THREE.Vector4(0, 0, 0, 0);
  kindN = 0;
  waterIdx = -1;
  lavaIdx = -1;
  grids: Float32Array[] = [];
  margin = 18;

  constructor(public map: MapData) {
    const W = map.w + 1;
    const H = map.h + 1;
    this.baseKind = KIND[map.base] ?? 0;
    const data = new Uint8Array(W * H * 4);
    const layers = map.layers.slice(0, 4);
    layers.forEach((name, li) => {
      const grid = map.corners[name];
      const k = KIND[name] ?? 0;
      this.kinds.push(k);
      if (name === 'water') this.waterIdx = li;
      if (name === 'lava') this.lavaIdx = li;
      const f = new Float32Array(W * H);
      if (grid) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const on = grid[y]?.charCodeAt(x) === 49 ? 1 : 0;
            f[y * W + x] = on;
            data[(y * W + x) * 4 + li] = on ? 255 : 0;
          }
        }
      }
      this.grids.push(f);
    });
    this.kindN = layers.length;
    this.kindsVec.set(this.kinds[0] ?? 0, this.kinds[1] ?? 0, this.kinds[2] ?? 0, this.kinds[3] ?? 0);
    this.splat = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    this.splat.minFilter = THREE.LinearFilter;
    this.splat.magFilter = THREE.LinearFilter;
    this.splat.wrapS = this.splat.wrapT = THREE.ClampToEdgeWrapping;
    this.splat.needsUpdate = true;
  }

  dispose() {
    this.splat.dispose();
  }

  /** 격자값을 부드럽게 읽기 */
  layerAt(li: number, u: number, v: number) {
    const f = this.grids[li];
    if (!f) return 0;
    const W = this.map.w + 1;
    const H = this.map.h + 1;
    const x = Math.max(0, Math.min(W - 1.001, u));
    const y = Math.max(0, Math.min(H - 1.001, v));
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const a = f[yi * W + xi];
    const b = f[yi * W + xi + 1];
    const c = f[(yi + 1) * W + xi];
    const d = f[(yi + 1) * W + xi + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  kindAt(u: number, v: number) {
    let k = this.baseKind;
    const wob = (noise(u * 1.1, v * 1.1) - 0.5) * 0.3;
    for (let i = 0; i < this.kindN; i++) if (this.layerAt(i, u, v) + wob > 0.5) k = this.kinds[i];
    return k;
  }

  /** 땅 높이. 걷는 곳은 거의 평평하고, 지도 밖은 산이 된다 */
  heightAt(u: number, v: number) {
    const m = this.map;
    const ox = Math.max(0, -u, u - m.w);
    const oz = Math.max(0, -v, v - m.h);
    const out = Math.hypot(ox, oz);
    let h = (noise(u * 0.33, v * 0.33) - 0.5) * 0.14;
    if (this.waterIdx >= 0) h -= smooth(0.42, 0.78, this.layerAt(this.waterIdx, u, v)) * 0.55;
    if (out > 0) h += smooth(0, 16, out) * 7 + smooth(0, 16, out) * (noise(u * 0.18, v * 0.18) - 0.3) * 4;
    return h;
  }

  buildMesh() {
    const M = this.margin;
    const { w, h } = this.map;
    const step = 0.5;
    const nx = Math.round((w + M * 2) / step) + 1;
    const nz = Math.round((h + M * 2) / step) + 1;
    const pos = new Float32Array(nx * nz * 3);
    const idx: number[] = [];
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const u = -M + x * step;
        const v = -M + z * step;
        const i = (z * nx + x) * 3;
        pos[i] = u;
        pos[i + 1] = this.heightAt(u, v);
        pos[i + 2] = v;
      }
    }
    for (let z = 0; z < nz - 1; z++) {
      for (let x = 0; x < nx - 1; x++) {
        const a = z * nx + x;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** 지도 밖을 메울 나무들 */
  outerProps(): [string, number, number][] {
    const m = this.map;
    const out: [string, number, number][] = [];
    const tree: Record<number, string[]> = { 0: ['tree_oak', 'tree_pine'], 1: ['tree_oak', 'tree_pine'], 2: ['tree_moss_l', 'tree_moss_s'], 5: ['tree_dead', 'ash_rock_l'], 6: ['tree_dead', 'ash_rock_l'] };
    const ids = tree[this.baseKind];
    if (!ids) return out;
    const M = this.margin - 2;
    for (let z = -M; z < m.h + M; z += 1.9) {
      for (let x = -M; x < m.w + M; x += 1.9) {
        if (x >= -0.5 && x <= m.w + 0.5 && z >= -0.5 && z <= m.h + 0.5) continue;
        const u = x + hash2(x * 3 + 11, z * 3) * 1.5;
        const v = z + hash2(x * 3, z * 3 + 7) * 1.5;
        out.push([ids[hash2(x * 7, z * 5) > 0.6 ? 1 : 0], u, v]);
      }
    }
    return out;
  }

  /** 칸별 풀잎 */
  grassChunks(chunk: number) {
    const m = this.map;
    const res: { cx: number; cz: number; n: number; pos: Float32Array; col: Float32Array; seed: Float32Array }[] = [];
    const DENS: Record<number, number> = { 0: 26, 1: 30, 2: 12, 5: 0, 6: 0, 7: 2 };
    const GOLD = [0.72, 0.62, 0.3];
    const OLIVE = [0.42, 0.47, 0.22];
    const DEEP = [0.27, 0.36, 0.2];
    const M = 4;
    for (let cz = Math.floor(-M / chunk); cz <= Math.floor((m.h + M) / chunk); cz++) {
      for (let cx = Math.floor(-M / chunk); cx <= Math.floor((m.w + M) / chunk); cx++) {
        const P: number[] = [];
        const C: number[] = [];
        const S: number[] = [];
        const x0 = cx * chunk;
        const z0 = cz * chunk;
        const cell = 0.5;
        for (let gz = 0; gz < chunk / cell; gz++) {
          for (let gx = 0; gx < chunk / cell; gx++) {
            const bu = x0 + gx * cell;
            const bv = z0 + gz * cell;
            const k0 = this.kindAt(bu + 0.25, bv + 0.25);
            const dens = DENS[k0] ?? 0;
            if (!dens) continue;
            const count = Math.floor(dens * cell * cell + hash2(gx * 13 + cx, gz * 17 + cz));
            for (let i = 0; i < count; i++) {
              const u = bu + hash2(gx * 31 + i * 7 + cx * 97, gz * 11 + cz * 53) * cell;
              const v = bv + hash2(gx * 5 + cx * 41, gz * 29 + i * 13 + cz * 71) * cell;
              const k = this.kindAt(u, v);
              if ((DENS[k] ?? 0) === 0) continue;
              const big = noise(u * 0.22, v * 0.22);
              const mid = noise(u * 0.9, v * 0.9);
              const t = Math.max(0, Math.min(1, big * 0.8 + mid * 0.45 - 0.1 + (k === 1 ? 0.25 : 0)));
              const a = t < 0.5 ? DEEP : OLIVE;
              const b = t < 0.5 ? OLIVE : GOLD;
              const f = t < 0.5 ? t * 2 : t * 2 - 1;
              const j = 0.86 + hash2(u * 91, v * 37) * 0.28;
              // 숲바닥의 풀은 어둡고 짧다
              const dim = k === 2 ? 0.62 : 1;
              P.push(u, this.heightAt(u, v), v);
              C.push((a[0] + (b[0] - a[0]) * f) * j * dim, (a[1] + (b[1] - a[1]) * f) * j * dim, (a[2] + (b[2] - a[2]) * f) * j * dim);
              S.push(hash2(u * 17, v * 23), (0.7 + hash2(u * 3, v * 5) * 0.7) * (k === 2 ? 0.7 : 1));
            }
          }
        }
        if (P.length) res.push({ cx, cz, n: P.length / 3, pos: new Float32Array(P), col: new Float32Array(C), seed: new Float32Array(S) });
      }
    }
    return res;
  }
}
