// 지도 생성기. 실행: npm run maps
// 결과는 client/public/maps/*.json 에 쓴다. 서버도 같은 파일을 읽는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from '../shared/core';
import type { MapData, MapObject, SpawnGroup } from '../shared/mapdata';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'client/public/maps');
const PROPS_JSON = join(ROOT, 'client/public/art/props/props.json');

type FP = [number, number, number, number];
interface PropInfo {
  fp: FP;
  solid: boolean;
}

// 아트가 아직 없을 때 쓰는 기본 차지 영역. 구운 props.json이 있으면 그 값을 우선한다.
const FALLBACK: Record<string, PropInfo> = {};
const set = (ids: string, fp: FP, solid = true) => {
  for (const id of ids.split(' ')) FALLBACK[id] = { fp, solid };
};
set('house_a house_b house_c smithy', [-1.5, -1.5, 1.5, 1.5]);
set('tavern', [-2, -2, 2, 2]);
set('shop_stall', [-1, -0.7, 1, 0.7]);
set('well big_lantern statue', [-0.6, -0.6, 0.6, 0.6]);
set('lantern_post waystone torch sign pillar ruin_pillar', [-0.2, -0.2, 0.2, 0.2]);
set('fence_u', [-0.5, -0.1, 0.5, 0.1]);
set('fence_v', [-0.1, -0.5, 0.1, 0.5]);
set('crate barrel stump ash_rock_s rock_s', [-0.3, -0.3, 0.3, 0.3]);
set('bench hay cart broken_cart log fallen_log', [-0.7, -0.35, 0.7, 0.35]);
set('tree_oak tree_pine tree_moss_l tree_moss_s tree_moss_dead tree_dead', [-0.35, -0.35, 0.35, 0.35]);
set('rock_l mossy_rock ash_rock_l', [-0.6, -0.6, 0.6, 0.6]);
set('wall_stone wall_ash', [-0.5, -0.5, 0.5, 0.5]);
set('bush fern mush_cluster bone_pile rubble ember_vent', [-0.2, -0.2, 0.2, 0.2], false);
set('portal_arch door_arch ruin_arch', [-0.1, -0.1, 0.1, 0.1], false);
set('chest chest_open', [-0.4, -0.3, 0.4, 0.3]);

function loadPropInfo(): Record<string, PropInfo> {
  const out = { ...FALLBACK };
  if (existsSync(PROPS_JSON)) {
    const baked = JSON.parse(readFileSync(PROPS_JSON, 'utf8')) as Record<string, { fp?: FP; solid?: boolean }>;
    for (const [id, p] of Object.entries(baked)) {
      if (p.fp) out[id] = { fp: p.fp, solid: !!p.solid };
    }
  }
  return out;
}
const PROP = loadPropInfo();

// 값 노이즈 (지형 경계를 울퉁불퉁하게)
function makeNoise(seed: number) {
  const rand = rng(seed);
  const size = 64;
  const g = new Float32Array(size * size).map(() => rand());
  const at = (x: number, y: number) => g[((y % size) + size) % size * size + (((x % size) + size) % size)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const one = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
  return (x: number, y: number) => one(x * 0.13, y * 0.13) * 0.6 + one(x * 0.31, y * 0.31) * 0.3 + one(x * 0.7, y * 0.7) * 0.1;
}

class Builder {
  rand: () => number;
  noise: (x: number, y: number) => number;
  layers: string[] = [];
  grids: Record<string, Uint8Array> = {};
  props: [string, number, number][] = [];
  decals: [string, number, number][] = [];
  objects: MapObject[] = [];
  spawns: SpawnGroup[] = [];
  /** res 2 격자. 1=막힘 */
  solid: Uint8Array;
  /** 소품을 놓지 않을 칸 */
  keep: Uint8Array;

  constructor(
    public name: string,
    public title: string,
    public w: number,
    public h: number,
    public base: string,
    seed: number,
  ) {
    this.rand = rng(seed);
    this.noise = makeNoise(seed + 7);
    this.solid = new Uint8Array(w * 2 * (h * 2));
    this.keep = new Uint8Array(w * h);
  }

  grid(layer: string) {
    if (!this.grids[layer]) {
      this.grids[layer] = new Uint8Array((this.w + 1) * (this.h + 1));
      this.layers.push(layer);
    }
    return this.grids[layer];
  }

  /** 꼭짓점 단위로 칠하기 */
  paint(layer: string, fn: (x: number, y: number) => boolean) {
    const g = this.grid(layer);
    for (let y = 0; y <= this.h; y++) {
      for (let x = 0; x <= this.w; x++) {
        if (fn(x, y)) g[y * (this.w + 1) + x] = 1;
      }
    }
  }

  blob(layer: string, cu: number, cv: number, r: number, wobble = 0.35) {
    this.paint(layer, (x, y) => {
      const d = Math.hypot(x - cu, y - cv);
      return d < r * (1 - wobble + this.noise(x, y) * wobble * 2);
    });
  }

  /** 점들을 잇는 길 */
  road(layer: string, pts: [number, number][], width: number, wobble = 0.4) {
    this.paint(layer, (x, y) => {
      let best = Infinity;
      for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, segDist(x, y, pts[i], pts[i + 1]));
      return best < width * (1 - wobble + this.noise(x + 91, y + 13) * wobble * 2);
    });
    for (let i = 0; i + 1 < pts.length; i++) this.keepLine(pts[i], pts[i + 1], width + 1);
  }

  keepLine(a: [number, number], b: [number, number], width: number) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (segDist(x + 0.5, y + 0.5, a, b) < width) this.keep[y * this.w + x] = 1;
      }
    }
  }

  keepCircle(u: number, v: number, r: number) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (Math.hypot(x + 0.5 - u, y + 0.5 - v) < r) this.keep[y * this.w + x] = 1;
      }
    }
  }

  isKept(u: number, v: number) {
    const x = Math.floor(u);
    const y = Math.floor(v);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    return this.keep[y * this.w + x] === 1;
  }

  markSolid(u0: number, v0: number, u1: number, v1: number) {
    const W = this.w * 2;
    const H = this.h * 2;
    for (let y = Math.max(0, Math.floor(v0 * 2)); y < Math.min(H, Math.ceil(v1 * 2)); y++) {
      for (let x = Math.max(0, Math.floor(u0 * 2)); x < Math.min(W, Math.ceil(u1 * 2)); x++) {
        this.solid[y * W + x] = 1;
      }
    }
  }

  clearSolid(u0: number, v0: number, u1: number, v1: number) {
    const W = this.w * 2;
    const H = this.h * 2;
    for (let y = Math.max(0, Math.floor(v0 * 2)); y < Math.min(H, Math.ceil(v1 * 2)); y++) {
      for (let x = Math.max(0, Math.floor(u0 * 2)); x < Math.min(W, Math.ceil(u1 * 2)); x++) {
        this.solid[y * W + x] = 0;
      }
    }
  }

  prop(id: string, u: number, v: number) {
    this.props.push([id, round2(u), round2(v)]);
    const p = PROP[id];
    if (p?.solid) this.markSolid(u + p.fp[0], v + p.fp[1], u + p.fp[2], v + p.fp[3]);
  }

  /** 장식을 지정 구역에 흩뿌린다. 길과 keep 칸은 피한다. */
  scatter(ids: string[], n: number, area: (u: number, v: number) => boolean, spacing = 0) {
    const placed: [number, number][] = [];
    let tries = n * 12;
    while (placed.length < n && tries-- > 0) {
      const u = 1 + this.rand() * (this.w - 2);
      const v = 1 + this.rand() * (this.h - 2);
      if (!area(u, v) || this.isKept(u, v)) continue;
      if (spacing && placed.some(([a, b]) => Math.hypot(a - u, b - v) < spacing)) continue;
      placed.push([u, v]);
      this.prop(ids[Math.floor(this.rand() * ids.length)], u, v);
    }
  }

  /** 지도 가장자리를 나무로 메워 막는다. 출구 자리는 keep으로 비워 둔다. */
  treeBorder(ids: string[], thick = 3) {
    const { w, h } = this;
    for (let v = 0.5; v < h; v += 1.05) {
      for (let u = 0.5; u < w; u += 1.05) {
        const edge = Math.min(u, v, w - u, h - v);
        if (edge > thick + this.noise(u, v) * 3) continue;
        if (this.isKept(u, v)) continue;
        const ju = u + (this.rand() - 0.5) * 0.5;
        const jv = v + (this.rand() - 0.5) * 0.5;
        this.prop(ids[Math.floor(this.rand() * ids.length)], ju, jv);
      }
    }
    // 틈으로 빠져나가지 못하게 경계 띠를 막는다
    for (let v = 0; v < h; v += 0.5) {
      for (let u = 0; u < w; u += 0.5) {
        const edge = Math.min(u, v, w - u, h - v);
        if (edge < thick - 0.5 && !this.isKept(u, v)) this.markSolid(u, v, u + 0.5, v + 0.5);
      }
    }
  }

  door(name: string, u: number, v: number, target: string, arrive: string, label: string, extra: Partial<MapObject> = {}) {
    this.objects.push({ type: 'door', name, u, v, r: 1.3, target, arrive, label, ...extra });
    this.keepCircle(u, v, 2.5);
  }

  arrive(name: string, u: number, v: number) {
    this.objects.push({ type: 'arrive', name, u, v });
    this.keepCircle(u, v, 1.6);
  }

  npc(name: string, u: number, v: number, dir = 0) {
    this.objects.push({ type: 'npc', name, u, v, dir, r: 2.6 });
    this.keepCircle(u, v, 1.6);
    this.markSolid(u - 0.25, v - 0.25, u + 0.25, v + 0.25);
  }

  spawn(mon: string, u: number, v: number, r: number, n: number, level: number, respawn = 14, pack = false) {
    this.spawns.push({ mon, u, v, r, n, level, respawn, pack });
  }

  finish(opts: Partial<MapData> & { tint: [number, number, number]; dark: number; bg: string; music: string; color: string }): MapData {
    // 물·용암은 막는다
    for (const layer of ['water', 'lava']) {
      const g = this.grids[layer];
      if (!g) continue;
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const W = this.w + 1;
          const c = g[y * W + x] + g[y * W + x + 1] + g[(y + 1) * W + x] + g[(y + 1) * W + x + 1];
          if (c >= 3) this.markSolid(x, y, x + 1, y + 1);
        }
      }
    }
    // 문·도착 지점은 무조건 뚫어 둔다
    for (const o of this.objects) {
      if (o.type === 'door' || o.type === 'arrive') this.clearSolid(o.u - 0.7, o.v - 0.7, o.u + 0.7, o.v + 0.7);
    }
    const W = this.w * 2;
    const rows: string[] = [];
    for (let y = 0; y < this.h * 2; y++) {
      let row = '';
      for (let x = 0; x < W; x++) row += this.solid[y * W + x] ? '1' : '0';
      rows.push(row);
    }
    const corners: Record<string, string[]> = {};
    for (const l of this.layers) {
      const g = this.grids[l];
      const out: string[] = [];
      for (let y = 0; y <= this.h; y++) {
        let row = '';
        for (let x = 0; x <= this.w; x++) row += g[y * (this.w + 1) + x] ? '1' : '0';
        out.push(row);
      }
      corners[l] = out;
    }
    // 앞뒤 정렬: 뒤에 있는 것부터
    this.props.sort((a, b) => a[1] + a[2] - (b[1] + b[2]));
    return {
      name: this.name,
      title: this.title,
      w: this.w,
      h: this.h,
      base: this.base,
      layers: this.layers,
      corners,
      props: this.props,
      decals: this.decals,
      objects: this.objects,
      spawns: this.spawns,
      solid: { w: this.w, h: this.h, res: 2, rows },
      ...opts,
    };
  }
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}

function segDist(px: number, py: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

// ─── 등불마루 ─────────────────────────────────────────────
function town(): MapData {
  const b = new Builder('town', '등불마루', 60, 60, 'grass', 11);
  const c = 30;
  b.paint('meadow', (x, y) => b.noise(x + 40, y) > 0.55);
  b.road('dirt', [[c, c], [59, c]], 2.0);
  b.road('dirt', [[c, c], [1, c]], 2.0);
  b.road('dirt', [[c, c], [c, 14]], 1.6);
  b.road('dirt', [[c, c], [c, 47]], 1.6);
  b.blob('cobble', c, c, 7.4, 0.14);
  b.road('cobble', [[c, c], [46, c]], 1.2, 0.2);
  b.blob('water', 44, 47, 6.5, 0.3);
  b.keepCircle(c, c, 8.6);

  // 출구
  b.door('to_woods', 58.2, c, 'woods', 'from_town', '이끼숲');
  b.arrive('from_woods', 55, c);
  b.door('to_rift', 3.2, c, 'rift', 'start', '균열', { minLevel: 5, instance: true });
  b.arrive('from_rift', 6.6, c);
  b.arrive('start', c + 0.5, c + 3.8);
  b.prop('portal_arch', 3.2, c);

  // 건물
  b.prop('tavern', c, 15.5);
  b.keepCircle(c, 19, 2.5);
  b.prop('house_a', 20, 21);
  b.prop('house_b', 40.5, 20.5);
  b.prop('house_c', 18, 41);
  b.prop('house_a', 41, 39.5);
  b.prop('house_b', 12, 21);
  b.prop('house_c', 49, 21);
  b.prop('smithy', 21.5, 37);
  b.prop('shop_stall', 37.5, 25);
  for (const [u, v] of [[20, 21], [40.5, 20.5], [18, 41], [41, 39.5], [12, 21], [49, 21], [21.5, 37], [c, 15.5]] as const) b.keepCircle(u, v, 2.6);

  // 광장
  b.prop('big_lantern', c, c);
  b.objects.push({ type: 'lantern', name: 'plaza', u: c, v: c, r: 9 });
  b.prop('well', c + 4.6, c - 4.4);
  b.prop('bench', c - 4.8, c + 4.8);
  b.prop('bench', c + 4.8, c + 4.8);
  b.prop('sign', 46.5, c - 2.2);

  // NPC
  b.npc('npc_elder', c - 3.4, c - 3.6, 0);
  b.npc('npc_merchant', 36.4, 27.1, 2);
  b.npc('npc_smith', 24.4, 35.2, 6);
  b.npc('npc_guard', 47, c + 2, 2);
  b.npc('npc_keeper', c + 3.6, c + 5.4, 4);

  // 길가 등불
  for (const [u, v] of [[38, 27.6], [38, 32.4], [46, 27.6], [46, 32.4], [52, 32.4], [22, 27.8], [22, 32.2], [14, 27.8], [14, 32.2], [27.6, 22], [32.4, 22], [27.6, 38], [32.4, 38], [32.4, 44]] as const) {
    b.prop('lantern_post', u, v);
    b.objects.push({ type: 'lantern', name: 'post', u, v, r: 4.5 });
  }

  // 울타리
  for (let i = 0; i < 7; i++) b.prop('fence_u', 8 + i, 37);
  for (let i = 0; i < 6; i++) b.prop('fence_v', 8, 37 + i);
  for (let i = 0; i < 7; i++) b.prop('fence_u', 44 + i, 14);
  b.prop('hay', 10.5, 39.5);
  b.prop('hay', 12.5, 40.5);
  b.prop('cart', 37, 37);
  b.prop('crate', 38.8, 23.2);
  b.prop('crate', 39.6, 24);
  b.prop('barrel', 35.6, 23.2);
  b.prop('barrel', 19, 35.4);
  b.prop('crate', 20, 34.6);
  b.prop('barrel', 26.4, 13.6);
  b.prop('log', 16, 34);

  b.treeBorder(['tree_oak', 'tree_oak', 'tree_pine'], 4);
  const inside = (u: number, v: number) => u > 5 && v > 5 && u < 55 && v < 55;
  b.scatter(['tree_oak', 'tree_pine'], 22, inside, 3.5);
  b.scatter(['bush', 'bush', 'rock_s', 'stump'], 46, inside, 1.5);
  return b.finish({ tint: [1, 0.97, 0.9], dark: 0.28, bg: '#0e1a12', music: 'town', safe: true, color: '#3f5f39' });
}

// ─── 이끼숲 ─────────────────────────────────────────────
function woods(): MapData {
  const b = new Builder('woods', '이끼숲', 72, 72, 'forest', 23);
  const c = 36;
  b.paint('meadow', (x, y) => b.noise(x, y + 70) > 0.62);
  b.road('dirt', [[1, c], [20, 34], [c, c], [52, 42], [68, 42]], 1.7);
  b.road('dirt', [[c, c], [c, 18], [36, 2]], 1.5);
  b.road('dirt', [[c, c], [38, 58]], 1.4);
  b.blob('dirt', c, c, 4.5, 0.25);
  b.blob('water', 44, 13, 5.5, 0.35);
  b.blob('water', 25, 12, 3.5, 0.35);
  b.blob('water', 58, 60, 5, 0.3);
  b.keepCircle(c, c, 5);
  b.keepCircle(38, 56, 7);
  b.keepCircle(c, 18, 6);

  b.door('to_town', 1.6, c, 'town', 'from_woods', '등불마루');
  b.arrive('from_town', 4.6, c);
  b.door('to_hollow', 68.2, 42, 'hollow', 'start', '고목의 빈터', { minLevel: 5, instance: true });
  b.arrive('from_hollow', 64.8, 42);
  b.prop('door_arch', 68.2, 42);
  b.door('to_ashfield', 36, 1.6, 'ashfield', 'from_woods', '잿빛 벌판', { minLevel: 9, needQuest: 'q_hollow' });
  b.arrive('from_ashfield', 36, 4.8);

  b.prop('waystone', c + 1.6, c - 1.6);
  b.objects.push({ type: 'waystone', name: 'woods_mid', u: c + 1.6, v: c - 1.6, r: 2.2 });
  b.objects.push({ type: 'lantern', name: 'way', u: c + 1.6, v: c - 1.6, r: 7 });
  for (const [u, v] of [[10, 38.6], [20, 37], [29, 38.4], [43, 41], [52, 45], [60, 45], [38.6, 26], [38.6, 12]] as const) {
    b.prop('lantern_post', u, v);
    b.objects.push({ type: 'lantern', name: 'post', u, v, r: 4 });
  }
  b.prop('ruin_pillar', 28, 24);
  b.prop('ruin_pillar', 30, 26.5);
  b.prop('ruin_arch', 54, 25);
  b.prop('ruin_pillar', 51.5, 23);
  b.prop('ruin_pillar', 57, 28);

  b.treeBorder(['tree_moss_l', 'tree_moss_l', 'tree_moss_s'], 4);
  const inside = (u: number, v: number) => u > 5 && v > 5 && u < 67 && v < 67;
  b.scatter(['tree_moss_l', 'tree_moss_s', 'tree_moss_s', 'tree_moss_dead'], 130, inside, 2.2);
  b.scatter(['mossy_rock', 'fallen_log', 'stump'], 26, inside, 3);
  b.scatter(['fern', 'fern', 'mush_cluster', 'bush'], 130, inside, 0.9);

  // 몬스터: 마을에서 멀어질수록 강해진다
  b.spawn('mushroom', 14, 28, 5, 5, 1, 9);
  b.spawn('mushroom', 13, 45, 5, 5, 1, 9);
  b.spawn('mushroom', 24, 44, 5, 5, 2, 10);
  b.spawn('mushroom', 24, 28, 5, 5, 2, 10);
  b.spawn('boar', 34, 54, 6, 4, 3, 13);
  b.spawn('boar', 45, 56, 6, 4, 4, 13);
  b.spawn('boar', 26, 57, 5, 3, 4, 13);
  b.spawn('wisp', 32, 16, 6, 4, 5, 13);
  b.spawn('wisp', 44, 22, 6, 4, 5, 13);
  b.spawn('wisp', 52, 18, 6, 4, 6, 13);
  b.spawn('mushroom', 58, 33, 5, 5, 6, 12, true);
  b.spawn('boar', 56, 51, 5, 3, 7, 14, true);
  return b.finish({ tint: [0.86, 0.96, 0.88], dark: 0.42, bg: '#0a120c', music: 'forest', color: '#2e4f35' });
}

/** 동굴 공통: 방과 복도를 칸 단위로 파고 나머지는 벽 */
function carve(b: Builder, rooms: [number, number, number][], halls: [[number, number], [number, number], number][], wall: string) {
  const open = new Uint8Array(b.w * b.h);
  const cut = (fn: (x: number, y: number) => boolean) => {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (fn(x + 0.5, y + 0.5)) open[y * b.w + x] = 1;
  };
  for (const [u, v, r] of rooms) cut((x, y) => Math.hypot(x - u, y - v) < r * (0.86 + b.noise(x, y) * 0.3));
  for (const [p, q, w] of halls) cut((x, y) => segDist(x, y, p, q) < w);
  // 트인 칸과 맞닿은 벽만 그린다. 안쪽은 까만 바닥(bg)으로 비워 둔다.
  const isOpen = (x: number, y: number) => x >= 0 && y >= 0 && x < b.w && y < b.h && open[y * b.w + x] === 1;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (isOpen(x, y)) continue;
      b.markSolid(x, y, x + 1, y + 1);
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isOpen(x + dx, y + dy)) near = true;
      if (near) b.props.push([wall, x + 0.5, y + 0.5]);
    }
  }
  return isOpen;
}

// ─── 고목의 빈터 ─────────────────────────────────────────
function hollow(): MapData {
  const b = new Builder('hollow', '고목의 빈터', 40, 56, 'cave', 37);
  const rooms: [number, number, number][] = [[20, 50, 5.2], [12, 36, 6.6], [28, 26, 6.6], [20, 11, 9.4]];
  const halls: [[number, number], [number, number], number][] = [
    [[20, 50], [12, 36], 1.8],
    [[12, 36], [28, 26], 1.8],
    [[28, 26], [20, 11], 2],
  ];
  const isOpen = carve(b, rooms, halls, 'wall_stone');
  b.paint('forest', (x, y) => b.noise(x + 5, y + 5) > 0.5);
  b.blob('forest', 20, 11, 9, 0.2);
  b.arrive('start', 20, 51);
  b.door('leave', 20, 53.6, 'woods', 'from_hollow', '이끼숲으로');
  b.clearSolid(19, 50, 21, 55);
  b.objects.push({ type: 'lantern', name: 't1', u: 20, v: 47, r: 6 });
  b.objects.push({ type: 'lantern', name: 't2', u: 12, v: 36, r: 6 });
  b.objects.push({ type: 'lantern', name: 't3', u: 28, v: 26, r: 6 });
  b.objects.push({ type: 'lantern', name: 't4', u: 20, v: 18, r: 7 });
  for (const [u, v] of [[20, 47], [12, 36], [28, 26], [17, 18], [23, 18]] as const) b.prop('torch', u, v);
  for (let i = 0; i < 18; i++) {
    const u = 3 + b.rand() * 34;
    const v = 4 + b.rand() * 48;
    if (isOpen(Math.floor(u), Math.floor(v)) && Math.hypot(u - 20, v - 11) > 6) b.prop(b.rand() < 0.5 ? 'fern' : 'mush_cluster', u, v);
  }
  b.spawn('mushroom', 12, 37, 4, 6, 5, 0, true);
  b.spawn('wisp', 28, 28, 4, 4, 6, 0, true);
  b.spawn('boar', 26, 24, 3, 2, 6, 0, true);
  b.spawn('elder', 20, 10, 0, 1, 8, 0);
  return b.finish({ tint: [0.8, 0.94, 0.82], dark: 0.62, bg: '#05080a', music: 'dungeon', instance: true, color: '#26382b' });
}

// ─── 잿빛 벌판 ─────────────────────────────────────────
function ashfield(): MapData {
  const b = new Builder('ashfield', '잿빛 벌판', 76, 76, 'ash', 53);
  b.paint('scorch', (x, y) => b.noise(x + 20, y + 40) > 0.58);
  b.road('stone', [[38, 74], [38, 54], [26, 40], [38, 26], [56, 16], [68, 10]], 1.7, 0.45);
  b.road('stone', [[26, 40], [10, 34]], 1.4, 0.45);
  b.blob('lava', 52, 42, 6.2, 0.35);
  b.blob('lava', 18, 56, 4.5, 0.35);
  b.blob('lava', 60, 62, 5, 0.35);
  b.blob('stone', 11, 33, 7, 0.18);
  b.keepCircle(11, 33, 7);
  b.keepCircle(38, 54, 3);

  b.door('to_woods', 38, 74.2, 'woods', 'from_ashfield', '이끼숲');
  b.arrive('from_woods', 38, 71);
  b.door('to_furnace', 69, 9.4, 'furnace', 'start', '용광로', { minLevel: 15, instance: true });
  b.arrive('from_furnace', 65.6, 11.6);
  b.prop('door_arch', 69, 9.4);

  b.prop('waystone', 39.6, 52.4);
  b.objects.push({ type: 'waystone', name: 'ash_mid', u: 39.6, v: 52.4, r: 2.2 });
  b.objects.push({ type: 'lantern', name: 'way', u: 39.6, v: 52.4, r: 7 });
  // 서쪽 제단
  b.prop('statue', 11, 33);
  for (const [u, v] of [[7, 29], [15, 29], [7, 37], [15, 37]] as const) b.prop('ruin_pillar', u, v);
  b.objects.push({ type: 'lantern', name: 'altar', u: 11, v: 33, r: 5 });

  b.treeBorder(['ash_rock_l', 'tree_dead', 'ash_rock_s'], 4);
  const inside = (u: number, v: number) => u > 5 && v > 5 && u < 71 && v < 71;
  b.scatter(['tree_dead', 'ash_rock_l', 'ash_rock_s'], 90, inside, 2.6);
  b.scatter(['bone_pile', 'ember_vent', 'rubble'], 70, inside, 1.6);
  b.scatter(['broken_cart'], 5, inside, 12);

  b.spawn('ashwolf', 30, 62, 6, 4, 9, 14, true);
  b.spawn('ashwolf', 48, 60, 6, 4, 10, 14, true);
  b.spawn('ashwolf', 24, 47, 6, 4, 10, 14, true);
  b.spawn('emberbug', 44, 32, 5, 6, 11, 11, true);
  b.spawn('emberbug', 58, 30, 5, 6, 12, 11, true);
  b.spawn('golem', 36, 16, 6, 3, 12, 18);
  b.spawn('golem', 52, 24, 6, 3, 13, 18);
  b.spawn('cultist', 12, 26, 5, 4, 12, 15, true);
  b.spawn('cultist', 14, 42, 5, 4, 13, 15, true);
  b.spawn('cultist', 6, 33, 3, 3, 14, 15, true);
  b.spawn('golem', 62, 18, 4, 2, 14, 18);
  b.spawn('emberbug', 64, 12, 3, 5, 14, 11, true);
  return b.finish({ tint: [1, 0.86, 0.76], dark: 0.5, bg: '#120a08', music: 'ash', color: '#4d3f3a' });
}

// ─── 용광로 ─────────────────────────────────────────────
function furnace(): MapData {
  const b = new Builder('furnace', '용광로', 44, 60, 'stone', 71);
  const rooms: [number, number, number][] = [[22, 54, 5.2], [33, 41, 7], [12, 30, 7], [22, 12, 10.6]];
  const halls: [[number, number], [number, number], number][] = [
    [[22, 54], [33, 41], 2],
    [[33, 41], [12, 30], 2],
    [[12, 30], [22, 12], 2.2],
  ];
  carve(b, rooms, halls, 'wall_ash');
  b.paint('ash', (x, y) => b.noise(x, y) > 0.52);
  b.blob('scorch', 22, 12, 9, 0.25);
  b.blob('lava', 33, 41, 2.6, 0.2);
  b.blob('lava', 12, 30, 2.4, 0.2);
  b.arrive('start', 22, 55);
  b.door('leave', 22, 57.6, 'ashfield', 'from_furnace', '잿빛 벌판으로');
  b.clearSolid(21, 54, 23, 59);
  for (const [u, v] of [[22, 50], [33, 36], [12, 36], [17, 21], [27, 21]] as const) {
    b.prop('torch', u, v);
    b.objects.push({ type: 'lantern', name: 't', u, v, r: 6 });
  }
  b.spawn('emberbug', 28, 39, 4, 7, 15, 0, true);
  b.spawn('golem', 37, 44, 3, 2, 15, 0, true);
  b.spawn('cultist', 9, 33, 4, 4, 16, 0, true);
  b.spawn('golem', 16, 28, 3, 2, 16, 0, true);
  b.spawn('warden', 22, 10, 0, 1, 18, 0);
  return b.finish({ tint: [1, 0.82, 0.72], dark: 0.66, bg: '#090504', music: 'dungeon', instance: true, color: '#3a2a26' });
}

// ─── 균열 ─────────────────────────────────────────────
function rift(): MapData {
  const b = new Builder('rift', '균열', 34, 34, 'cave', 91);
  carve(b, [[17, 17, 13]], [], 'wall_stone');
  b.paint('stone', (x, y) => Math.hypot(x - 17, y - 17) < 11 && b.noise(x, y) > 0.46);
  b.arrive('start', 17, 24);
  b.objects.push({ type: 'lantern', name: 'c', u: 17, v: 17, r: 11 });
  for (const [u, v] of [[10, 10], [24, 10], [10, 24], [24, 24]] as const) b.prop('pillar', u, v);
  return b.finish({ tint: [0.82, 0.76, 1], dark: 0.6, bg: '#07040e', music: 'rift', instance: true, color: '#2c2340' });
}

mkdirSync(OUT, { recursive: true });
const maps = [town(), woods(), hollow(), ashfield(), furnace(), rift()];
for (const m of maps) {
  writeFileSync(join(OUT, `${m.name}.json`), JSON.stringify(m));
  // 도착 지점과 문이 실제로 뚫려 있고 서로 이어졌는지 검사
  const open = (u: number, v: number) => {
    const x = Math.floor(u * 2);
    const y = Math.floor(v * 2);
    return m.solid.rows[y]?.charCodeAt(x) === 48;
  };
  const start = m.objects.find((o) => o.type === 'arrive');
  if (!start) throw new Error(`${m.name}: 도착 지점 없음`);
  const seen = new Set<number>();
  const W = m.w * 2;
  const q = [Math.floor(start.v * 2) * W + Math.floor(start.u * 2)];
  seen.add(q[0]);
  while (q.length) {
    const c = q.pop()!;
    const x = c % W;
    const y = Math.floor(c / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= m.h * 2 || seen.has(k)) continue;
      if (m.solid.rows[ny].charCodeAt(nx) !== 48) continue;
      seen.add(k);
      q.push(k);
    }
  }
  const reach = (u: number, v: number) => seen.has(Math.floor(v * 2) * W + Math.floor(u * 2));
  const problems: string[] = [];
  for (const o of m.objects) {
    if ((o.type === 'door' || o.type === 'arrive') && (!open(o.u, o.v) || !reach(o.u, o.v))) problems.push(`${o.type}:${o.name}(${o.u},${o.v})`);
    if (o.type === 'npc') {
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([du, dv]) => reach(o.u + du, o.v + dv));
      if (!near) problems.push(`npc:${o.name}`);
    }
  }
  for (const sp of m.spawns) {
    // 무리 중심이 막혀 있어도 흩어지는 반경 안에 설 곳이 있으면 된다
    let ok = reach(sp.u, sp.v);
    for (let a = 0; a < 16 && !ok; a++) {
      const r = Math.max(1, sp.r);
      ok = reach(sp.u + Math.cos(a) * r * 0.6, sp.v + Math.sin(a) * r * 0.6);
    }
    if (!ok) problems.push(`spawn:${sp.mon}(${sp.u},${sp.v})`);
  }
  console.log(`${m.name}: ${m.w}x${m.h} 소품 ${m.props.length}, 몬스터 ${m.spawns.reduce((a, s) => a + s.n, 0)}, 걸을 수 있는 칸 ${seen.size}${problems.length ? ' / 문제: ' + problems.join(', ') : ''}`);
  if (problems.length) process.exitCode = 1;
}
