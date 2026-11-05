// 브라우저 쪽 진입점. Node가 window.BAKE의 함수를 부른다.
import { THREE } from './kit.js';
import { shot, makeCamera, assignEdgeGroups, getRenderer, toBase64 } from './core.js';
import { PLAYERS } from './humans.js';
import { MONSTERS } from './monsters.js';
import { NPCS } from './npcs.js';
import { BOSSES } from './bosses.js';
import { PROPS } from './props.js';
import { WALLS, wallPixels } from './walls.js';
import { PX } from './core.js';

import { DIRS8, DIRS5, DIRV, PROP_IDS as PROP_ORDER } from '../lib/spec.mjs';
const dirAngle = (d) => Math.atan2(DIRV[d][0], DIRV[d][1]);

const CHARS = { ...PLAYERS, ...NPCS, ...MONSTERS, ...BOSSES };

function layout(def) {
  const boss = def.kind === 'boss';
  return { cell: boss ? [192, 192] : [96, 96], anchor: boss ? [96, 150] : [48, 76], dirs: boss ? DIRS5 : DIRS8, mirror: boss };
}

async function bakeChar(id) {
  const def = CHARS[id];
  if (!def) throw new Error('없는 캐릭터: ' + id);
  const { cell, anchor, dirs, mirror } = layout(def);
  const [W, H] = cell;
  const rig = def.build();
  assignEdgeGroups(rig.root);
  const scene = new THREE.Scene();
  scene.add(rig.root);
  const cam = makeCamera(W, H, anchor[0], anchor[1]);

  let total = 0;
  const meta = {};
  for (const [name, a] of Object.entries(rig.anims)) {
    meta[name] = { start: total, frames: a.frames, dur: a.dur, loop: !!a.loop };
    total += a.frames * dirs.length;
  }
  const maxCols = Math.floor(4096 / W);
  const cols = Math.min(maxCols, def.cols ?? (W > 96 ? 21 : total > 300 ? 22 : total <= 48 ? 8 : 16));
  const rows = Math.ceil(total / cols);
  const SW = cols * W;
  const SH = rows * H;
  const sheet = new Uint8Array(SW * SH * 4);

  for (const [name, a] of Object.entries(rig.anims)) {
    const m = meta[name];
    for (let di = 0; di < dirs.length; di++) {
      rig.root.rotation.y = dirAngle(dirs[di]);
      for (let f = 0; f < a.frames; f++) {
        rig.apply(a.poses[f]);
        rig.root.updateMatrixWorld(true);
        const px = shot(scene, cam, W, H, def.shot ?? {});
        const fi = m.start + di * a.frames + f;
        const ox = (fi % cols) * W;
        const oy = Math.floor(fi / cols) * H;
        for (let y = 0; y < H; y++) {
          const src = y * W * 4;
          sheet.set(px.subarray(src, src + W * 4), ((oy + y) * SW + ox) * 4);
        }
      }
    }
  }
  scene.clear();
  return {
    w: SW, h: SH, rgba: toBase64(sheet),
    json: { cell, anchor, cols, dirs, mirror, anims: meta },
  };
}

/** 소품 하나를 굽고 불투명 영역으로 잘라 돌려준다 */
function renderProp(id) {
  const d = PROPS[id];
  const obj = d.build();
  assignEdgeGroups(obj);
  const scene = new THREE.Scene();
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj, true);
  // 경계 상자의 여덟 꼭짓점을 화면으로
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const u of [b.min.x, b.max.x]) for (const v of [b.min.z, b.max.z]) for (const h of [b.min.y, b.max.y]) {
    const sx = (u - v) * 32;
    const sy = (u + v) * 16 - h * PX * Math.cos(Math.PI / 6);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const m = 6;
  const ax = Math.ceil(-x0) + m;
  const ay = Math.ceil(-y0) + m;
  const W = ax + Math.ceil(x1) + m;
  const H = ay + Math.ceil(y1) + m;
  const cam = makeCamera(W, H, ax, ay);
  const px = shot(scene, cam, W, H, { coverage: 6 });
  scene.clear();
  return crop(px, W, H, ax, ay);
}
function crop(px, W, H, ax, ay) {
  let cx0 = W, cx1 = -1, cy0 = H, cy1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3]) {
    cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); cy0 = Math.min(cy0, y); cy1 = Math.max(cy1, y);
  }
  const w = cx1 - cx0 + 1;
  const h = cy1 - cy0 + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(px.subarray(((cy0 + y) * W + cx0) * 4, ((cy0 + y) * W + cx0 + w) * 4), y * w * 4);
  return { w, h, ax: ax - cx0, ay: ay - cy0, rgba: out };
}
function bakeProps(only) {
  const items = [];
  for (const id of PROP_ORDER) {
    if (only && !only.includes(id)) continue;
    if (WALLS[id]) {
      items.push({ id, ...wallPixels(WALLS[id]), fp: [-0.5, -0.5, 0.5, 0.5], solid: true, hu: 1.4 });
      continue;
    }
    const d = PROPS[id];
    if (!d) continue;
    items.push({ id, ...renderProp(id), fp: d.fp, solid: d.solid, hu: d.h });
  }
  // 선반 쌓기: 키 큰 것부터
  const AW = 2048;
  const sorted = [...items].sort((a, b) => b.h - a.h);
  let sx = 0, sy = 0, rowH = 0;
  for (const it of sorted) {
    if (sx + it.w > AW) {
      sx = 0;
      sy += rowH + 1;
      rowH = 0;
    }
    it.x = sx;
    it.y = sy;
    sx += it.w + 1;
    rowH = Math.max(rowH, it.h);
  }
  const AH = sy + rowH;
  const sheet = new Uint8Array(AW * AH * 4);
  const json = {};
  for (const it of items) {
    for (let y = 0; y < it.h; y++) sheet.set(it.rgba.subarray(y * it.w * 4, (y + 1) * it.w * 4), ((it.y + y) * AW + it.x) * 4);
    json[it.id] = { x: it.x, y: it.y, w: it.w, h: it.h, ax: it.ax, ay: it.ay, fp: it.fp, solid: it.solid, hu: it.hu };
  }
  return { w: AW, h: AH, rgba: toBase64(sheet), json };
}

window.BAKE = {
  ready: true,
  chars: () => Object.fromEntries(Object.entries(CHARS).map(([k, v]) => [k, v.kind])),
  bakeChar,
  bakeProps,
  info: () => {
    const gl = getRenderer().getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  },
};
