// 소품·지형 미리보기.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Img, hex } from './lib/img.mjs';

const INK = hex('#f0ead8');
const DARK = hex('#23262a');

function tileAt(img, meta, n) {
  return [(n % meta.cols) * meta.tw, Math.floor(n / meta.cols) * meta.th];
}
/** 마름모 격자로 타일을 깐다 (화면 좌표 원점을 넘겨 준다) */
function paintTile(out, img, meta, n, sx, sy, scale = 1) {
  const [tx, ty] = tileAt(img, meta, n);
  out.blit(img, tx, ty, meta.tw, meta.th, sx - 32 * scale, sy - 16 * scale, scale);
}

function hashf(a, b) {
  let h = Math.imul(a * 73856093 ^ b * 19349663, 0x5bd1e995);
  h ^= h >>> 13;
  return ((Math.imul(h, 0x5bd1e995) >>> 0) % 1000) / 1000;
}

/** 소품 전체 + 축척 비교용 사람 실루엣 */
function propSheet(root) {
  const dir = join(root, 'client/public/art/props');
  if (!existsSync(join(dir, 'props.json'))) return null;
  const meta = JSON.parse(readFileSync(join(dir, 'props.json'), 'utf8'));
  const img = Img.load(join(dir, 'props.png'));
  const tdir = join(root, 'client/public/art/terrain');
  const tm = existsSync(join(tdir, 'terrain.json')) ? JSON.parse(readFileSync(join(tdir, 'terrain.json'), 'utf8')) : null;
  const ti = tm ? Img.load(join(tdir, 'terrain.png')) : null;
  const ids = Object.keys(meta);
  const rows = [];
  const CW = 300;
  const CH = 330;
  const perRow = 6;
  const out = new Img(CW * perRow, Math.ceil(ids.length / perRow) * CH);
  out.fill(DARK);
  const dirC = join(root, 'client/public/art/chars');
  const hero = existsSync(join(dirC, 'pc_warrior_a.json')) ? { m: JSON.parse(readFileSync(join(dirC, 'pc_warrior_a.json'), 'utf8')), i: Img.load(join(dirC, 'pc_warrior_a.png')) } : null;
  ids.forEach((id, k) => {
    const p = meta[id];
    const ox = (k % perRow) * CW;
    const oy = Math.floor(k / perRow) * CH;
    const cx = ox + CW / 2;
    const cy = oy + CH - 70;
    // 바닥 타일 깔기
    if (tm) {
      for (let a = -3; a <= 3; a++)
        for (let b = -3; b <= 3; b++) {
          const sx = (a - b) * 32 + cx;
          const sy = (a + b) * 16 + cy;
          if (sx < ox + 32 || sx > ox + CW - 32 || sy < oy + 16 || sy > oy + CH - 16) continue;
          const name = /moss|mush|fallen|ruin|fern/.test(id) ? 'forest' : id.startsWith('wall') || /pillar|torch|door|chest|rubble|statue/.test(id) ? 'cave' : /ash|ember|broken|bone|dead/.test(id) ? 'ash' : 'grass';
          const v = tm.full[name];
          paintTile(out, ti, tm, v[Math.floor(hashf(a + 5, b + 9 + k) * 4)], sx, sy);
        }
    }
    // 차지 영역 표시
    const [u0, v0, u1, v1] = p.fp;
    const proj = (u, v) => [Math.round(cx + (u - v) * 32), Math.round(cy + (u + v) * 16)];
    const corners = [proj(u0, v0), proj(u1, v0), proj(u1, v1), proj(u0, v1)];
    for (let e = 0; e < 4; e++) {
      const [a, b] = [corners[e], corners[(e + 1) % 4]];
      const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
      for (let t = 0; t <= n; t++) out.set(Math.round(a[0] + ((b[0] - a[0]) * t) / n), Math.round(a[1] + ((b[1] - a[1]) * t) / n), hex('#ffe066'));
    }
    if (id === 'wall_stone' || id === 'wall_ash') {
      // 벽은 이어 붙여 본다 (L자)
      const cells = [[-2, 0], [-1, 0], [0, 0], [0, 1], [0, 2], [1, 0]];
      cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
      for (const [a, b] of cells) out.blit(img, p.x, p.y, p.w, p.h, Math.round(cx + (a - b) * 32 - p.ax), Math.round(cy + (a + b) * 16 - p.ay));
    } else if (id === 'fence_u' || id === 'fence_v') {
      for (let t = -2; t <= 2; t++) {
        const [a, b] = id === 'fence_u' ? [t, 0] : [0, t];
        out.blit(img, p.x, p.y, p.w, p.h, Math.round(cx + (a - b) * 32 - p.ax), Math.round(cy + (a + b) * 16 - p.ay));
      }
    } else out.blit(img, p.x, p.y, p.w, p.h, Math.round(cx - p.ax), Math.round(cy - p.ay));
    // 앵커
    out.set(cx, cy, hex('#ff3b3b'));
    out.set(cx + 1, cy, hex('#ff3b3b'));
    out.set(cx, cy + 1, hex('#ff3b3b'));
    // 축척 비교용 전사 (옆 칸)
    if (hero) {
      const [W, H] = hero.m.cell;
      const f = hero.m.anims.idle.start;
      const [ax, ay] = hero.m.anchor;
      const hu = cx + 92;
      const hv = cy + 26;
      out.blit(hero.i, (f % hero.m.cols) * W, Math.floor(f / hero.m.cols) * H, W, H, hu - ax, hv - ay);
    }
    out.rect(ox, oy, CW, 10, DARK);
    out.text(ox + 2, oy + 2, `${id} ${p.w}x${p.h}`, INK);
    out.frame(ox, oy, CW, CH, hex('#3a3f44'));
  });
  return out;
}

function terrainSheets(root) {
  const dir = join(root, 'client/public/art/terrain');
  if (!existsSync(join(dir, 'terrain.json'))) return {};
  const m = JSON.parse(readFileSync(join(dir, 'terrain.json'), 'utf8'));
  const img = Img.load(join(dir, 'terrain.png'));
  const names = Object.keys(m.full);
  // 1) 지형별 12×12 격자: 변형을 임의로 섞어 이음새를 본다
  const G = 7;
  const tileW = 64 * G;
  const tileH = 32 * G;
  const cols = 4;
  const fullImg = new Img(cols * tileW, Math.ceil(names.length / cols) * tileH);
  fullImg.fill(hex('#ff00ff'));
  names.forEach((name, k) => {
    const ox = (k % cols) * tileW;
    const oy = Math.floor(k / cols) * tileH;
    const cx = ox + tileW / 2;
    const cy = oy + tileH / 2;
    for (let a = -G; a <= G; a++)
      for (let b = -G; b <= G; b++) {
        const sx = (a - b) * 32 + cx;
        const sy = (a + b) * 16 + cy;
        if (Math.abs(sx - cx) / (tileW / 2) + Math.abs(sy - cy) / (tileH / 2) > 1.02) continue;
        const v = m.full[name][Math.floor(hashf(a * 7 + k, b * 13 + k) * 4)];
        const [tx, ty] = tileAt(img, m, v);
        // 그리는 순서가 이음새에 영향을 주지 않는지 보려고 뒤에서 앞으로
        fullImg.blit(img, tx, ty, 64, 32, sx - 32, sy - 16);
      }
    fullImg.text(ox + 4, oy + 4, name, hex('#ffffff'));
  });
  // 2) 겹침 지형: 꼭짓점 격자에 잡음으로 덩어리를 만들어 깔아 본다
  const edges = Object.keys(m.edge);
  const edgeImg = new Img(3 * 480, Math.ceil(edges.length / 3) * 260);
  edgeImg.fill(hex('#202225'));
  edges.forEach((name, k) => {
    const ox = (k % 3) * 480;
    const oy = Math.floor(k / 3) * 260;
    const base = name === 'cobble' || name === 'dirt' ? 'grass' : name === 'lava' ? 'scorch' : name === 'water' ? 'meadow' : name === 'ash' || name === 'scorch' ? 'dirt' : name === 'stone' ? 'cave' : 'grass';
    const N = 12;
    const corner = (a, b) => {
      const d = Math.hypot(a - N / 2, b - N / 2) + (hashf(a * 3 + k, b * 5) - 0.5) * 2.4;
      return d < 3.8 || (a + b * 2 + k) % 11 === 0 ? 1 : 0;
    };
    const cx = ox + 240;
    const cy = oy + 40;
    for (let s = 0; s < N * 2; s++)
      for (let a = 0; a < N; a++) {
        const b = s - a;
        if (b < 0 || b >= N) continue;
        const sx = (a - b) * 32 + cx;
        const sy = (a + b) * 16 + cy;
        const v = m.full[base][Math.floor(hashf(a + k, b + 3) * 4)];
        const [tx, ty] = tileAt(img, m, v);
        edgeImg.blit(img, tx, ty, 64, 32, sx - 32, sy - 16);
        const n = corner(a, b) * 1 + corner(a + 1, b) * 2 + corner(a + 1, b + 1) * 4 + corner(a, b + 1) * 8;
        if (n) {
          const [ex, ey] = tileAt(img, m, m.edge[name] + n);
          edgeImg.blit(img, ex, ey, 64, 32, sx - 32, sy - 16);
        }
      }
    edgeImg.text(ox + 4, oy + 4, `${name} on ${base}`, INK);
  });
  // 3) 시트 전체
  const raw = new Img(img.w * 2, img.h * 2);
  raw.fill(hex('#30343a'));
  raw.blit(img, 0, 0, img.w, img.h, 0, 0, 2);
  return { fullImg, edgeImg, raw };
}

function iconSheet(root, name) {
  const dir = join(root, 'client/public/art/icons');
  if (!existsSync(join(dir, name + '.json'))) return null;
  const m = JSON.parse(readFileSync(join(dir, name + '.json'), 'utf8'));
  const img = Img.load(join(dir, name + '.png'));
  const S = 3;
  const rows = Math.ceil(m.ids.length / m.cols);
  const CW = 32 * S + 8;
  const CH = 32 * S + 18;
  const out = new Img(m.cols * CW, rows * CH);
  out.fill(hex('#2b2d33'));
  m.ids.forEach((id, k) => {
    const x = (k % m.cols) * CW + 4;
    const y = Math.floor(k / m.cols) * CH + 4;
    out.rect(x, y, 32 * S, 32 * S, hex('#3b3e46'));
    out.blit(img, (k % m.cols) * m.cell, Math.floor(k / m.cols) * m.cell, m.cell, m.cell, x, y, S);
    out.text(x, y + 32 * S + 3, id.slice(0, 16), INK);
  });
  return out;
}

export async function previewWorld(root) {
  const P = join(root, 'docs/art-preview');
  const ps = propSheet(root);
  if (ps) ps.save(join(P, 'props_on_terrain.png'));
  const t = terrainSheets(root);
  if (t.fullImg) {
    t.fullImg.save(join(P, 'terrain_grid.png'));
    t.edgeImg.save(join(P, 'terrain_edges.png'));
    t.raw.save(join(P, 'terrain_sheet.png'));
  }
  for (const n of ['items', 'skills']) {
    const s = iconSheet(root, n);
    if (s) s.save(join(P, 'icons_' + n + '.png'));
  }
  if (existsSync(join(root, 'client/public/art/chars'))) roster(root).save(join(P, 'roster.png'));
  const sn = scene(root);
  if (sn) sn.save(join(P, 'scene.png'));
}

/** 모든 캐릭터 한 장: S·E·N 쉬는 자세 */
function roster(root) {
  const dir = join(root, 'client/public/art/chars');
  const groups = [
    ['pc_warrior_a', 'pc_warrior_b', 'pc_warrior_c', 'pc_mage_a', 'pc_mage_b', 'pc_mage_c', 'pc_archer_a', 'pc_archer_b', 'pc_archer_c'],
    ['npc_elder', 'npc_merchant', 'npc_smith', 'npc_guard', 'npc_keeper', 'mushroom', 'boar', 'wisp', 'ashwolf'],
    ['emberbug', 'golem', 'cultist', 'shade', 'elder', 'warden'],
  ];
  const S = 2;
  const CW = 96 * S * 3 + 8;
  const out = new Img(CW * 3, (96 * S + 12) * 21);
  out.fill(hex('#3a4238'));
  let y = 0;
  let col = 0;
  for (const g of groups)
    for (const id of g) {
      if (!existsSync(join(dir, id + '.json'))) continue;
      const m = JSON.parse(readFileSync(join(dir, id + '.json'), 'utf8'));
      const img = Img.load(join(dir, id + '.png'));
      const [W, H] = m.cell;
      const scale = W > 96 ? 1 : S;
      const a = m.anims.idle;
      const dirs = m.mirror ? ['S', 'W', 'N'] : ['S', 'E', 'N'];
      const ox = col * CW;
      out.text(ox + 4, y + 2, id, INK);
      dirs.forEach((d, i) => {
        const di = m.dirs.indexOf(d);
        const fi = a.start + di * a.frames;
        out.blit(img, (fi % m.cols) * W, Math.floor(fi / m.cols) * H, W, H, ox + i * 96 * S, y + 10, scale);
      });
      col++;
      if (col === 3) {
        col = 0;
        y += 96 * S + 12;
      }
    }
  const h = y + (col ? 96 * S + 12 : 0);
  const final = new Img(out.w, h);
  final.blit(out, 0, 0, out.w, h, 0, 0, 1);
  return final;
}

/** 지형·소품·캐릭터를 한 장면에 깔아 축척과 앵커를 본다 */
function scene(root) {
  const art = join(root, 'client/public/art');
  if (!existsSync(join(art, 'terrain/terrain.json')) || !existsSync(join(art, 'props/props.json'))) return null;
  const tm = JSON.parse(readFileSync(join(art, 'terrain/terrain.json'), 'utf8'));
  const ti = Img.load(join(art, 'terrain/terrain.png'));
  const pm = JSON.parse(readFileSync(join(art, 'props/props.json'), 'utf8'));
  const pi = Img.load(join(art, 'props/props.png'));
  const N = 22;
  const W = N * 64 + 64;
  const H = N * 32 + 220;
  const out = new Img(W, H);
  out.fill(hex('#15171b'));
  const ox = W / 2;
  const oy = 200;
  const sc = (u, v) => [Math.round(ox + (u - v) * 32), Math.round(oy + (u + v) * 16)];
  // 꼭짓점 격자
  const cornerDirt = (a, b) => Math.abs(a - b) < 2 + Math.sin(a * 0.7) * 0.6 || Math.abs(a - 11) + Math.abs(b - 11) < 4;
  const cornerWater = (a, b) => Math.hypot(a - 18, b - 5) < 3.4;
  const cornerCobble = (a, b) => Math.abs(a + b - 22) < 2 && a > 6 && b > 6;
  const mask = (fn, a, b) => (fn(a, b) ? 1 : 0) + (fn(a + 1, b) ? 2 : 0) + (fn(a + 1, b + 1) ? 4 : 0) + (fn(a, b + 1) ? 8 : 0);
  for (let s = 0; s < N * 2; s++)
    for (let a = 0; a < N; a++) {
      const b = s - a;
      if (b < 0 || b >= N) continue;
      const [cx, cy] = sc(a + 0.5, b + 0.5);
      const v = tm.full.grass[Math.floor(hashf(a, b) * 4)];
      const [tx, ty] = tileAt(ti, tm, v);
      out.blit(ti, tx, ty, 64, 32, cx - 32, cy - 16);
      for (const [name, fn] of [['dirt', cornerDirt], ['cobble', cornerCobble], ['water', cornerWater]]) {
        const n = mask(fn, a, b);
        if (!n) continue;
        const [ex, ey] = tileAt(ti, tm, tm.edge[name] + n);
        out.blit(ti, ex, ey, 64, 32, cx - 32, cy - 16);
      }
    }
  const items = [
    ['p', 'tavern', 5, 15.5], ['p', 'house_a', 4, 4], ['p', 'house_b', 15.5, 15], ['p', 'smithy', 9, 19.5], ['p', 'big_lantern', 11, 11],
    ['p', 'well', 14.5, 9], ['p', 'tree_oak', 2, 9.5], ['p', 'tree_pine', 19, 11], ['p', 'tree_oak', 12, 2], ['p', 'shop_stall', 9, 7.5],
    ['p', 'bench', 13.5, 13], ['p', 'lantern_post', 8.5, 11.5], ['p', 'crate', 8, 16.5], ['p', 'barrel', 8.6, 17.2], ['p', 'hay', 18, 18], ['p', 'cart', 15, 19.5],
    ['p', 'rock_l', 20, 2], ['p', 'bush', 16, 2], ['p', 'waystone', 13, 7], ['p', 'portal_arch', 1.2, 14], ['p', 'stump', 3, 12], ['p', 'log', 6, 1.5],
    ...[0, 1, 2, 3, 4, 5].map((i) => ['p', 'fence_u', 14 + i + 0.5, 12]),
    ...[0, 1, 2, 3].map((i) => ['p', 'fence_v', 14, 12.5 + i]),
    ['c', 'pc_warrior_a', 11.5, 13, 'idle', 'S'], ['c', 'pc_mage_a', 9.4, 12.2, 'idle', 'SE'], ['c', 'pc_archer_a', 12.8, 11.4, 'walk', 'E'],
    ['c', 'npc_elder', 8.3, 9.7, 'idle', 'S'], ['c', 'npc_guard', 2.6, 13.2, 'idle', 'E'], ['c', 'mushroom', 16.5, 6.5, 'idle', 'SW'], ['c', 'boar', 18, 8.5, 'walk', 'W'], ['c', 'npc_merchant', 10.5, 6.4, 'idle', 'S'],
  ];
  items.sort((a, b) => a[2] + a[3] - (b[2] + b[3]));
  for (const it of items) {
    const [cx, cy] = sc(it[2], it[3]);
    if (it[0] === 'p') {
      const p = pm[it[1]];
      out.blit(pi, p.x, p.y, p.w, p.h, cx - p.ax, cy - p.ay);
    } else {
      const m = JSON.parse(readFileSync(join(art, 'chars', it[1] + '.json'), 'utf8'));
      const im = Img.load(join(art, 'chars', it[1] + '.png'));
      const a = m.anims[it[4]];
      const fi = a.start + m.dirs.indexOf(it[5]) * a.frames + 1;
      const [cw, ch] = m.cell;
      out.blit(im, (fi % m.cols) * cw, Math.floor(fi / m.cols) * ch, cw, ch, cx - m.anchor[0], cy - m.anchor[1]);
    }
  }
  return out;
}
