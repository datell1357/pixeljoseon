// 지형을 타일에서 큰 그림 조각으로 굽는다
import * as Phaser from 'phaser';
import { toX, toY } from '@shared/core';
import type { MapData } from '@shared/mapdata';
import { DEPTH } from './actor';
import { terrain } from './assets';

const CHUNK_W = 1024;
const CHUNK_H = 512;

export interface GroundResult {
  grounds: { img: Phaser.GameObjects.Image; key: string }[];
  sparks: { u: number; v: number; col: number; next: number }[];
}

export function bakeGround(scene: Phaser.Scene, map: MapData): GroundResult {
  const out: GroundResult = { grounds: [], sparks: [] };
  const t = terrain;
  if (!t || !scene.textures.exists('terrain')) return out;
  const src = scene.textures.get('terrain').getSourceImage() as HTMLImageElement;
  const minX = -map.h * 32;
  const maxX = map.w * 32;
  const maxY = (map.w + map.h) * 16;
  const cols = Math.ceil((maxX - minX) / CHUNK_W);
  const rows = Math.ceil(maxY / CHUNK_H);
  const canvases: (CanvasRenderingContext2D | null)[] = Array(cols * rows).fill(null);
  const ctxOf = (i: number) => {
    if (!canvases[i]) {
      const c = document.createElement('canvas');
      c.width = CHUNK_W;
      c.height = CHUNK_H;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      canvases[i] = g;
    }
    return canvases[i]!;
  };
  const tw = t.tw;
  const th = t.th;
  const stamp = (cell: number, x: number, y: number) => {
    const sx = (cell % t.cols) * tw;
    const sy = Math.floor(cell / t.cols) * th;
    const dx = x - tw / 2 - minX;
    const dy = y;
    const c0 = Math.max(0, Math.floor(dx / CHUNK_W));
    const c1 = Math.min(cols - 1, Math.floor((dx + tw - 1) / CHUNK_W));
    const r0 = Math.max(0, Math.floor(dy / CHUNK_H));
    const r1 = Math.min(rows - 1, Math.floor((dy + th - 1) / CHUNK_H));
    for (let ry = r0; ry <= r1; ry++) {
      for (let cx = c0; cx <= c1; cx++) {
        ctxOf(ry * cols + cx).drawImage(src, sx, sy, tw, th, dx - cx * CHUNK_W, dy - ry * CHUNK_H, tw, th);
      }
    }
  };
  const baseSet = t.full[map.base] ?? t.full.grass;
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  };
  for (let v = 0; v < map.h; v++) {
    for (let u = 0; u < map.w; u++) {
      const x = toX(u, v);
      const y = toY(u, v);
      stamp(baseSet[hash(u, v) % baseSet.length], x, y);
      for (const layer of map.layers) {
        const e = t.edge[layer];
        const grid = map.corners[layer];
        if (e === undefined || !grid) continue;
        const n = (grid[v][u] === '1' ? 1 : 0) + (grid[v][u + 1] === '1' ? 2 : 0) + (grid[v + 1][u + 1] === '1' ? 4 : 0) + (grid[v + 1][u] === '1' ? 8 : 0);
        if (n > 0) stamp(e + n, x, y);
        if (n === 15 && (layer === 'water' || layer === 'lava') && hash(u, v) % 3 === 0) {
          out.sparks.push({ u: u + 0.5, v: v + 0.5, col: layer === 'water' ? 0x9fdcff : 0xffa63c, next: 0 });
        }
      }
    }
  }
  canvases.forEach((g, i) => {
    if (!g) return;
    const key = `ground_${map.name}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    scene.textures.addCanvas(key, g.canvas);
    const cx = i % cols;
    const ry = Math.floor(i / cols);
    const img = scene.add.image(minX + cx * CHUNK_W, ry * CHUNK_H, key).setOrigin(0, 0).setDepth(DEPTH.GROUND);
    out.grounds.push({ img, key });
  });
  return out;
}
