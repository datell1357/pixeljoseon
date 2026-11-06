// 아이템·스킬 아이콘. 32×32 도트를 코드로 그린다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Img, hex } from './lib/img.mjs';

const C = 32;
const c = (s) => hex(s);
const OUT = c('#1b1520');

class P {
  constructor() {
    this.g = new Array(C * C).fill(null);
  }
  px(x, y, col) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= C || y >= C) return;
    this.g[y * C + x] = col === null ? null : typeof col === 'string' ? c(col) : col;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= C || y >= C) return null;
    return this.g[y * C + x];
  }
  rect(x, y, w, h, col) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, col);
  }
  line(x0, y0, x1, y1, col, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let t = 0; t <= n; t++) {
      const x = x0 + ((x1 - x0) * t) / n;
      const y = y0 + ((y1 - y0) * t) / n;
      if (w === 1) this.px(x, y, col);
      else this.disk(x, y, w / 2, col);
    }
  }
  disk(cx, cy, r, col) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.px(x, y, col);
  }
  ell(cx, cy, rx, ry, col) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.px(x, y, col);
  }
  /** 왼쪽 위가 밝은 구 */
  ball(cx, cy, r, ramp) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const l = (-dx * 0.65 - dy * 0.75) / r + 0.35 * (1 - (dx * dx + dy * dy) / (r * r));
        const i = l > 0.62 ? 3 : l > 0.14 ? 2 : l > -0.34 ? 1 : 0;
        this.px(x, y, ramp[i]);
      }
  }
  poly(pts, col) {
    let y0 = C;
    let y1 = 0;
    for (const [, y] of pts) {
      y0 = Math.min(y0, Math.floor(y));
      y1 = Math.max(y1, Math.ceil(y));
    }
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.px(x, y, col);
    }
  }
  arc(cx, cy, r, a0, a1, col, w = 1) {
    const n = Math.ceil(Math.abs(a1 - a0) * r * 2) + 2;
    for (let t = 0; t <= n; t++) {
      const a = a0 + ((a1 - a0) * t) / n;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (w === 1) this.px(x, y, col);
      else this.disk(x, y, w / 2, col);
    }
  }
  /** 불투명 칸을 1px 어두운 외곽선으로 두른다 */
  outline(col = OUT) {
    const add = [];
    for (let y = 0; y < C; y++)
      for (let x = 0; x < C; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    for (const [x, y] of add) this.px(x, y, col);
  }
  over(other) {
    for (let i = 0; i < C * C; i++) if (other.g[i]) this.g[i] = other.g[i];
  }
}
const sparkle = (p, x, y, col = '#fff6cf', big = false) => {
  p.px(x, y, '#ffffff');
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + a, y + b, col);
  if (big) for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.px(x + a, y + b, col);
};
const STEEL = ['#5c6474', '#8c95a6', '#c3cbd8', '#f2f5fa'];
const IRON = ['#4a4c58', '#6c6f7c', '#92959f', '#c0c2c8'];
const GOLD = ['#8a5a1c', '#c88f2a', '#efc24a', '#fff0a8'];
const BRASS = ['#6e5222', '#a07c34', '#c8a04a', '#ecd088'];
const WOOD = ['#4a2e1c', '#6d4629', '#8e5f36', '#b0824e'];
const DARKW = ['#2a1e22', '#42303a', '#5e4650', '#7c6470'];
const LEATHER = ['#4a2e1c', '#74492a', '#986538', '#bd8a54'];
const RUBY = ['#6e1420', '#b82a34', '#ec5a50', '#ffc2a8'];
const SAPPH = ['#1c2c78', '#2f56c0', '#5c94ec', '#c4e4ff'];
const EMER = ['#10502e', '#1f8a4a', '#4cc66c', '#c0f4b8'];
const AMBER = ['#7a3a10', '#c8701a', '#f2a92c', '#ffe48a'];
const FROST = ['#2a5a98', '#4a94d0', '#8fd2ee', '#e8fbff'];
const VIOLET = ['#3a1c6e', '#6636b0', '#9c6ae4', '#e0c8ff'];

/** 대각선 칼날 (왼쪽 아래 → 오른쪽 위) */
function blade(p, x0, y0, len, w, r) {
  for (let i = 0; i <= len; i++) {
    const x = x0 + i;
    const y = y0 - i;
    const tip = len - i;
    const ww = tip < 2 ? 0 : w;
    p.px(x, y, r[2]);
    for (let k = 1; k <= ww; k++) {
      p.px(x - k, y, k === ww ? r[3] : r[2]);
      p.px(x, y - k, k === ww ? r[3] : r[2]);
      p.px(x + k, y, k === ww ? r[0] : r[1]);
      p.px(x, y + k, k === ww ? r[0] : r[1]);
    }
    if (ww) p.px(x - 1, y - 1, r[3]);
    if (ww) p.px(x + 1, y + 1, r[0]);
  }
}
function sword(t) {
  const p = new P();
  const blades = [IRON, STEEL, STEEL, ['#c86a18', '#f2a92c', '#ffe48a', '#fffbe0']];
  const len = [14, 17, 18, 19][t];
  const w = [1, 1, 2, 2][t];
  const sx = 9;
  const sy = 22;
  blade(p, sx, sy, len, w, blades[t]);
  if (t === 2) p.line(sx + 2, sy - 2, sx + len - 3, sy - len + 3, SAPPH[2]);
  if (t === 3) p.line(sx + 2, sy - 2, sx + len - 3, sy - len + 3, '#ffffff');
  // 손잡이
  const gr = t < 2 ? WOOD : t === 2 ? LEATHER : DARKW;
  p.line(sx - 5, sy + 5, sx - 1, sy + 1, gr[1], 2);
  p.line(sx - 5, sy + 4, sx - 2, sy + 1, gr[3]);
  const gd = [IRON, BRASS, GOLD, GOLD][t];
  // 코등이
  const gw = [3, 4, 5, 6][t];
  p.line(sx - gw, sy - gw + 1, sx + gw - 1, sy + gw, gd[1], 2);
  p.line(sx - gw, sy - gw, sx + gw - 1, sy + gw - 1, gd[2]);
  // 끝 장식
  p.disk(sx - 6, sy + 6, t > 1 ? 2 : 1.5, gd[2]);
  p.px(sx - 7, sy + 5, gd[3]);
  if (t >= 2) {
    p.px(sx, sy + 1, t === 2 ? SAPPH[2] : RUBY[2]);
    p.px(sx + 1, sy, t === 2 ? SAPPH[3] : RUBY[3]);
  }
  if (t === 3) {
    p.line(sx - gw - 1, sy - gw - 2, sx - gw, sy - gw, GOLD[3]);
    p.line(sx + gw + 1, sy + gw + 1, sx + gw - 1, sy + gw, GOLD[3]);
  }
  p.outline();
  if (t === 3) {
    sparkle(p, 26, 11, '#ffe48a');
    sparkle(p, 14, 6, '#ffe48a');
  }
  if (t === 2) sparkle(p, 26, 6, '#c4e4ff');
  return p;
}
function staff(t) {
  const p = new P();
  const w = [WOOD, WOOD, DARKW, DARKW][t];
  // 자루
  p.line(5, 28, 20, 13, w[1], 2);
  p.line(5, 27, 19, 13, w[3]);
  if (t >= 1) {
    const b = t === 1 ? IRON : GOLD;
    for (const [x, y] of [[9, 24], [14, 19]]) {
      p.line(x - 1, y - 1, x + 1, y + 1, b[2]);
      p.px(x + 1, y + 2, b[1]);
    }
  }
  if (t >= 3) p.line(5, 28, 8, 25, GOLD[2], 2);
  // 머리
  const glass = [AMBER, AMBER, EMER, SAPPH][t];
  const cx = 23;
  const cy = 9;
  const r = [3.5, 4, 4, 4.5][t];
  const metal = [IRON, BRASS, GOLD, GOLD][t];
  if (t < 2) {
    // 작은 등불
    p.ball(cx, cy, r, AMBER);
    p.rect(cx - 3, cy - 5, 7, 1, metal[2]);
    p.px(cx, cy - 6, metal[3]);
    p.rect(cx - 3, cy + 4, 7, 1, metal[1]);
    if (t === 1) {
      p.line(cx - 3, cy - 4, cx - 3, cy + 3, metal[1]);
      p.line(cx + 3, cy - 4, cx + 3, cy + 3, metal[1]);
    }
  } else {
    // 갈래 받침과 수정
    p.arc(cx, cy + 1, r + 2, 0.2, Math.PI + 0.3, metal[2], 1);
    p.arc(cx, cy + 1, r + 3, 0.5, Math.PI - 0.2, metal[1], 1);
    p.poly([[cx, cy - r - 2], [cx + r, cy], [cx, cy + r + 1], [cx - r, cy]], glass[1]);
    p.poly([[cx, cy - r - 1], [cx, cy + r], [cx - r + 1, cy]], glass[2]);
    p.px(cx - 1, cy - 2, glass[3]);
    p.px(cx - 1, cy - 1, glass[3]);
    if (t === 3) {
      p.px(cx - r - 3, cy - 4, GOLD[3]);
      p.px(cx + r + 3, cy - 4, GOLD[3]);
      p.line(cx - r - 2, cy - 3, cx - r - 2, cy, GOLD[2]);
      p.line(cx + r + 2, cy - 3, cx + r + 2, cy, GOLD[2]);
    }
  }
  p.outline();
  if (t >= 2) sparkle(p, 28, 4, t === 3 ? '#c4e4ff' : '#c0f4b8');
  if (t === 3) sparkle(p, 16, 5, '#c4e4ff');
  return p;
}
function bow(t) {
  const p = new P();
  const w = [WOOD, WOOD, DARKW, GOLD][t];
  const cx = 8;
  const cy = 24;
  const R = 19;
  // 활대: 왼쪽 위 → 오른쪽 아래 호
  const a0 = -Math.PI / 2 - 0.1;
  const a1 = 0.1;
  p.arc(cx, cy, R, a0, a1, w[1], 2.4);
  p.arc(cx, cy, R - 0.6, a0 + 0.08, a1 - 0.08, w[3], 1);
  const tip1 = [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R];
  const tip2 = [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R];
  // 줌통
  const m = Math.PI * -0.25;
  const gx = cx + Math.cos(m) * R;
  const gy = cy + Math.sin(m) * R;
  p.line(gx - 2, gy - 2, gx + 2, gy + 2, t === 0 ? LEATHER[1] : t === 1 ? LEATHER[2] : t === 2 ? GOLD[2] : RUBY[2], 3);
  if (t >= 1) {
    const b = t === 1 ? IRON : GOLD;
    p.disk(tip1[0], tip1[1], 1.5, b[2]);
    p.disk(tip2[0], tip2[1], 1.5, b[2]);
  }
  if (t >= 2) {
    // 젖혀진 끝
    p.line(tip1[0], tip1[1], tip1[0] - 3, tip1[1] - 2, w[2], 2);
    p.line(tip2[0], tip2[1], tip2[0] + 2, tip2[1] + 3, w[2], 2);
  }
  p.outline();
  // 시위
  const sc = t === 3 ? '#ffe48a' : '#e8e0c8';
  p.line(tip1[0], tip1[1], tip2[0], tip2[1], sc);
  if (t === 3) {
    sparkle(p, 22, 4, '#ffe48a');
    sparkle(p, 28, 20, '#ffe48a');
  }
  return p;
}
function helm(t) {
  const p = new P();
  const r = [LEATHER, IRON, STEEL][t];
  const cx = 16;
  p.ball(cx, 15, 10, r);
  p.rect(cx - 12, 15, 24, 11, null);
  for (let y = 16; y < 26; y++) for (let x = 0; x < C; x++) p.g[y * C + x] = null;
  // 옆판
  p.rect(cx - 10, 15, 20, 7 + (t === 0 ? 0 : 3), r[1]);
  p.rect(cx - 10, 15, 3, 7 + (t === 0 ? 0 : 3), r[2]);
  p.rect(cx + 7, 15, 3, 7 + (t === 0 ? 0 : 3), r[0]);
  if (t === 0) {
    p.rect(cx - 10, 21, 20, 2, LEATHER[0]);
    p.rect(cx - 7, 18, 14, 3, '#2a1c1c');
    for (let x = cx - 8; x <= cx + 8; x += 4) p.px(x, 10, LEATHER[3]);
    p.rect(cx - 10, 14, 20, 2, LEATHER[3]);
  } else {
    // 얼굴 틈
    p.rect(cx - 7, 16, 14, 3, '#16121c');
    p.rect(cx - 1, 16, 2, 8, r[2]);
    p.rect(cx - 10, 13, 20, 2, t === 2 ? GOLD[2] : r[3]);
    p.rect(cx - 1, 6, 2, 8, t === 2 ? GOLD[2] : r[2]);
    if (t === 1) for (const x of [cx - 8, cx + 7]) p.px(x, 13, r[0]);
    if (t === 2) {
      // 깃털
      p.line(cx, 6, cx + 8, 1, RUBY[1], 3);
      p.line(cx + 1, 5, cx + 8, 1, RUBY[2]);
      p.disk(cx, 21, 1.2, GOLD[2]);
    }
  }
  p.outline();
  if (t === 2) sparkle(p, 25, 9, '#fff0a8');
  return p;
}
function armor(t) {
  const p = new P();
  const r = [LEATHER, IRON, STEEL][t];
  const body = [[6, 6], [11, 5], [13, 8], [19, 8], [21, 5], [26, 6], [29, 12], [25, 15], [24, 28], [8, 28], [7, 15], [3, 12]];
  p.poly(body, r[1]);
  // 왼쪽 밝게
  p.poly([[6, 6], [11, 5], [13, 8], [14, 28], [8, 28], [7, 15], [3, 12]], r[2]);
  p.poly([[20, 8], [21, 5], [26, 6], [29, 12], [25, 15], [24, 28], [21, 28]], r[0]);
  // 목
  p.rect(13, 5, 6, 3, null);
  p.ell(16, 7, 3, 2.5, '#1a141c');
  if (t === 0) {
    p.line(16, 10, 16, 27, LEATHER[0]);
    for (let y = 12; y < 26; y += 4) {
      p.px(15, y, '#e8d6a8');
      p.px(17, y, '#e8d6a8');
    }
    p.rect(8, 21, 16, 2, LEATHER[0]);
    p.rect(14, 21, 4, 2, BRASS[2]);
  } else if (t === 1) {
    // 쇠고리 무늬
    for (let y = 10; y < 28; y += 2) for (let x = 8 + (y % 4 ? 1 : 0); x < 25; x += 2) p.px(x, y, IRON[3]);
    p.rect(8, 21, 16, 2, LEATHER[1]);
    p.rect(14, 21, 4, 2, IRON[3]);
  } else {
    p.line(16, 9, 16, 27, GOLD[2]);
    p.line(8, 12, 16, 15, GOLD[2]);
    p.line(24, 12, 16, 15, GOLD[1]);
    p.rect(8, 22, 16, 2, GOLD[1]);
    p.disk(16, 15, 2, RUBY[2]);
    p.px(15, 14, RUBY[3]);
    p.rect(3, 11, 5, 1, GOLD[2]);
    p.rect(24, 11, 5, 1, GOLD[1]);
  }
  p.outline();
  if (t === 2) sparkle(p, 9, 6, '#fff0a8');
  return p;
}
function boots(t) {
  const p = new P();
  const r = [LEATHER, IRON, GOLD][t];
  const boot = (ox, oy, rr) => {
    p.poly([[ox, oy], [ox + 8, oy], [ox + 8, oy + 12], [ox + 14, oy + 15], [ox + 14, oy + 19], [ox, oy + 19]], rr[1]);
    p.rect(ox, oy, 3, 19, rr[2]);
    p.rect(ox + 6, oy, 2, 11, rr[0]);
    p.rect(ox, oy + 17, 14, 2, rr[0]);
    p.rect(ox - 1, oy - 1, 10, 3, rr[2]);
    p.rect(ox - 1, oy, 10, 1, rr[3]);
  };
  boot(11, 4, r);
  boot(5, 7, r);
  if (t === 1) {
    p.rect(11, 20, 8, 3, IRON[3]);
    for (let y = 11; y < 19; y += 3) p.rect(5, y, 8, 1, IRON[0]);
  }
  if (t === 2) {
    // 날개
    p.poly([[3, 12], [1, 9], [2, 14], [0, 13], [2, 17], [5, 18]], '#f4f6fa');
    p.line(1, 10, 4, 16, '#b8c4d8');
    p.px(9, 14, RUBY[2]);
  }
  if (t === 0) {
    p.rect(5, 12, 8, 1, LEATHER[0]);
    p.px(9, 12, BRASS[3]);
  }
  p.outline();
  if (t === 2) sparkle(p, 25, 5, '#fff0a8');
  return p;
}
function ring(t) {
  const p = new P();
  const r = t === 0 ? STEEL : GOLD;
  const g = t === 0 ? SAPPH : RUBY;
  p.ell(16, 20, 9, 8, r[1]);
  p.ell(16, 20, 5.5, 4.5, null);
  p.arc(16, 20, 8, Math.PI * 0.8, Math.PI * 1.45, r[3]);
  p.arc(16, 20, 8, 0.1, Math.PI * 0.6, r[0]);
  // 받침과 보석
  p.rect(12, 11, 8, 2, r[2]);
  const s = t === 0 ? 3.2 : 4.6;
  p.ball(16, t === 0 ? 8 : 7, s, g);
  p.outline();
  sparkle(p, t === 0 ? 20 : 22, t === 0 ? 5 : 3, t === 0 ? '#c4e4ff' : '#ffc2a8');
  return p;
}
function amulet(t) {
  const p = new P();
  const ch = t === 0 ? '#8a6a44' : GOLD[2];
  p.arc(16, 12, 10, Math.PI * 0.95, Math.PI * 2.05, ch);
  p.line(6, 12, 13, 22, ch);
  p.line(26, 12, 19, 22, ch);
  if (t === 0) {
    p.poly([[16, 19], [21, 25], [16, 30], [11, 25]], EMER[1]);
    p.poly([[16, 19], [16, 30], [11, 25]], EMER[2]);
    p.px(14, 23, EMER[3]);
  } else {
    p.disk(16, 25, 5.5, GOLD[1]);
    p.disk(16, 25, 4.5, GOLD[2]);
    p.ball(16, 25, 3.4, SAPPH);
    p.rect(15, 18, 2, 2, GOLD[3]);
  }
  p.outline();
  if (t === 1) sparkle(p, 23, 21, '#fff0a8');
  return p;
}
function potion(big, r) {
  const p = new P();
  const cx = 16;
  const by = big ? 19 : 21;
  const R = big ? 10 : 7.5;
  p.ball(cx, by, R, ['#6c7c8c', '#9db0c0', '#c8d8e4', '#ffffff']);
  // 물약
  const lv = by - R * 0.42;
  for (let y = Math.floor(by - R); y <= by + R; y++)
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if ((x - cx) ** 2 + (y - by) ** 2 > (R - 1) ** 2 || y < lv) continue;
      const l = (-(x - cx) * 0.65 - (y - by) * 0.75) / R;
      p.px(x, y, l > 0.4 ? r[3] : l > -0.1 ? r[2] : l > -0.45 ? r[1] : r[0]);
    }
  p.rect(cx - R * 0.7, lv, R * 1.4, 1, r[3]);
  // 목과 코르크
  const ny = by - R;
  p.rect(cx - 3, ny - 4, 6, 5, '#b8c8d4');
  p.rect(cx - 3, ny - 4, 2, 5, '#e8f0f4');
  p.rect(cx - 4, ny - 5, 8, 2, '#d8e2ea');
  p.rect(cx - 2, ny - 8, 4, 4, '#a07c4e');
  p.rect(cx - 2, ny - 8, 2, 4, '#c8a06e');
  // 하이라이트
  p.px(cx - R * 0.5, by - R * 0.5, '#ffffff');
  p.px(cx - R * 0.5 + 1, by - R * 0.5 - 1, '#ffffff');
  p.outline();
  return p;
}
function scrollHome() {
  const p = new P();
  const pa = ['#a8854e', '#d4b478', '#efd9a4', '#fff4d0'];
  p.rect(7, 7, 18, 19, pa[2]);
  p.rect(7, 7, 3, 19, pa[3]);
  p.rect(22, 7, 3, 19, pa[1]);
  for (const y of [6, 25]) {
    p.ell(16, y + 0.5, 11, 2.5, pa[1]);
    p.ell(16, y, 11, 1.6, pa[3]);
    p.px(5, y, pa[0]);
    p.px(27, y, pa[0]);
  }
  // 작은 집
  p.poly([[16, 10], [22, 15], [10, 15]], '#b5553a');
  p.rect(12, 15, 8, 6, '#8a5a34');
  p.rect(15, 17, 2, 4, '#3a2418');
  // 등불빛
  p.px(13, 16, '#ffd873');
  p.px(19, 16, '#ffd873');
  p.outline();
  return p;
}
function emberShard() {
  const p = new P();
  p.poly([[17, 2], [24, 12], [21, 16], [25, 22], [17, 30], [9, 23], [11, 15], [8, 11]], AMBER[1]);
  p.poly([[17, 2], [15, 16], [17, 30], [9, 23], [11, 15], [8, 11]], AMBER[2]);
  p.poly([[17, 6], [14, 14], [16, 22], [12, 20]], AMBER[3]);
  p.line(19, 8, 21, 12, '#fff4c8');
  p.line(18, 20, 21, 22, '#ffd873');
  p.outline('#401808');
  sparkle(p, 6, 6, '#ffd873');
  sparkle(p, 27, 26, '#ffd873');
  return p;
}
function mossCore() {
  const p = new P();
  p.ball(16, 16, 12, ['#274a26', '#3f7038', '#5f9a48', '#8dc463']);
  const dots = [[8, 10], [12, 7], [20, 8], [25, 13], [23, 22], [17, 26], [9, 22], [6, 16]];
  for (const [x, y] of dots) p.disk(x, y, 1.6, '#7fb050');
  p.ball(16, 16, 5.5, ['#5fc86a', '#8df39e', '#d2ffc4', '#ffffff']);
  p.outline();
  sparkle(p, 25, 5, '#c0f4b8');
  return p;
}
function boarTusk() {
  const p = new P();
  const iv = ['#a8946a', '#d4c49a', '#f0e6c8', '#fffdf2'];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const a = Math.PI * (0.92 - t * 0.86);
    const x = 15 + Math.cos(a) * 12;
    const y = 24 - Math.sin(a) * 18;
    const r = 4.6 * (1 - t * 0.92);
    p.disk(x, y, r, iv[1]);
    p.disk(x - r * 0.25, y - r * 0.25, r * 0.6, iv[2]);
    if (r > 1.6) p.px(x - r * 0.5, y - r * 0.5, iv[3]);
  }
  p.rect(0, 26, 8, 4, null);
  p.disk(4.5, 25, 4.2, '#7a5a3a');
  p.disk(4, 24.5, 3, '#a07c54');
  for (const [x, y] of [[3, 24], [5, 26], [6, 23]]) p.px(x, y, '#5a3f28');
  p.outline();
  return p;
}
function ashCore() {
  const p = new P();
  p.ball(16, 16, 12, ['#26222a', '#3c363a', '#57504e', '#7c7470']);
  const cr = '#ff7a2a';
  p.line(16, 5, 14, 13, cr);
  p.line(14, 13, 19, 17, '#ffc24a');
  p.line(19, 17, 16, 27, cr);
  p.line(14, 13, 6, 15, cr);
  p.line(19, 17, 27, 14, cr);
  p.line(16, 21, 10, 24, cr);
  p.disk(16, 15.5, 2.2, '#ffd873');
  p.px(16, 15, '#ffffff');
  p.outline();
  return p;
}
function wardenSeal() {
  const p = new P();
  const hexPts = [[16, 2], [27, 8], [27, 23], [16, 29], [5, 23], [5, 8]];
  p.poly(hexPts, IRON[1]);
  p.poly([[16, 2], [5, 8], [5, 23], [16, 29]], IRON[2]);
  p.poly([[16, 5], [24, 10], [24, 21], [16, 26], [8, 21], [8, 10]], '#1a2640');
  // 등불 무늬 + 푸른 불꽃
  p.rect(12, 9, 8, 1, GOLD[2]);
  p.rect(15, 7, 2, 2, GOLD[2]);
  p.rect(11, 22, 10, 2, GOLD[1]);
  p.line(12, 10, 12, 22, GOLD[1]);
  p.line(20, 10, 20, 22, GOLD[1]);
  p.poly([[16, 11], [19, 17], [18, 21], [14, 21], [13, 17]], '#3a92ee');
  p.poly([[16, 14], [17.5, 18], [16.5, 21], [15, 21], [14.5, 18]], '#96d8ff');
  p.px(16, 19, '#ffffff');
  p.outline();
  return p;
}
function gold() {
  const p = new P();
  const coin = (x, y) => {
    p.ell(x, y, 5.5, 3.5, GOLD[1]);
    p.ell(x, y - 1, 5.5, 3.5, GOLD[2]);
    p.ell(x, y - 1, 3.5, 2, GOLD[3]);
    p.ell(x, y - 1, 2.2, 1, GOLD[2]);
  };
  for (const [x, y] of [[9, 26], [16, 27], [23, 26], [12, 22], [20, 22], [16, 18], [7, 21], [25, 20], [14, 14], [20, 15]]) coin(x, y);
  p.outline('#3c2408');
  sparkle(p, 9, 8, '#fff0a8');
  sparkle(p, 26, 11, '#fff0a8');
  return p;
}
function riftToken() {
  const p = new P();
  p.disk(16, 16, 12.5, VIOLET[0]);
  p.disk(16, 16, 11, VIOLET[1]);
  p.arc(16, 16, 11.5, Math.PI * 0.9, Math.PI * 1.6, VIOLET[3]);
  for (let i = 0; i < 44; i++) {
    const t = i / 44;
    const a = t * Math.PI * 3;
    const r = t * 9;
    p.px(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, t > 0.5 ? VIOLET[3] : '#ffffff');
    p.px(16 + Math.cos(a + 0.2) * r, 16 + Math.sin(a + 0.2) * r, VIOLET[2]);
  }
  p.poly([[16, 8], [18, 16], [16, 24], [14, 16]], '#14081e');
  p.line(16, 10, 16, 22, '#e0c8ff');
  p.outline();
  return p;
}
function key() {
  const p = new P();
  // 머리 고리
  p.disk(10, 10, 7, GOLD[1]);
  p.disk(10, 10, 6, GOLD[2]);
  p.disk(10, 10, 3, null);
  p.arc(10, 10, 6, Math.PI * 0.9, Math.PI * 1.6, GOLD[3]);
  // 자루
  p.line(14, 14, 27, 27, GOLD[1], 3);
  p.line(14, 13, 27, 26, GOLD[3]);
  // 이빨
  p.line(23, 23, 19, 27, GOLD[2], 2);
  p.line(27, 27, 23, 30, GOLD[2], 2);
  p.outline('#3c2408');
  sparkle(p, 26, 7, '#fff0a8');
  return p;
}

// ---------- 스킬 ----------
const BG = {
  w: ['#3a1e20', '#5a2a2a', '#7a3c34'],
  m: ['#1e1e48', '#2c2c6c', '#40408c'],
  a: ['#1c3220', '#28482c', '#3a6438'],
  x: ['#2a2c34', '#3c404c', '#545a68'],
};
function frame(kind) {
  const p = new P();
  const [d, m, l] = BG[kind];
  for (let y = 1; y < 31; y++)
    for (let x = 1; x < 31; x++) {
      if ((x < 3 || x > 28) && (y < 3 || y > 28) && (x === 1 || x === 30 || y === 1 || y === 30)) continue;
      const t = (x + y) / 62;
      p.px(x, y, t < 0.4 ? m : d);
    }
  // 테두리
  for (let i = 3; i < 29; i++) {
    p.px(i, 1, l);
    p.px(1, i, l);
    p.px(i, 30, OUT);
    p.px(30, i, OUT);
  }
  return p;
}
const finish = (p, sym) => {
  sym.outline();
  p.over(sym);
  return p;
};
function symSword(q, x, y, len, w = 1, r = STEEL) {
  blade(q, x, y, len, w, r);
  q.line(x - 3, y - 2, x + 2, y + 3, GOLD[2], 2);
  q.line(x - 4, y + 4, x - 1, y + 1, WOOD[2], 2);
}
function arrowDiag(q, x0, y0, x1, y1, col = '#e8e0c8', head = STEEL[3], fl = RUBY[2]) {
  q.line(x0, y0, x1, y1, col);
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  q.poly([[x1 + ux * 3, y1 + uy * 3], [x1 - uy * 2.2, y1 + ux * 2.2], [x1 + uy * 2.2, y1 - ux * 2.2]], head);
  for (let k = 0; k < 3; k++) {
    q.px(x0 + ux * k - uy, y0 + uy * k + ux, fl);
    q.px(x0 + ux * k + uy, y0 + uy * k - ux, fl);
  }
}
const S = {
  w_whirl() {
    const p = frame('w');
    const q = new P();
    q.arc(16, 16, 11, 0.3, Math.PI * 1.7, '#ffe48a', 2);
    q.arc(16, 16, 7, Math.PI * 1.2, Math.PI * 2.8, '#ffb24a', 1);
    q.poly([[27, 12], [29, 18], [24, 17]], '#ffe48a');
    symSword(q, 11, 21, 12, 1);
    return finish(p, q);
  },
  w_charge() {
    const p = frame('w');
    const q = new P();
    for (const [y, x0] of [[9, 3], [16, 2], [23, 3]]) q.line(x0, y, x0 + 8, y, '#ffd8a0');
    q.disk(19, 16, 9, IRON[1]);
    q.disk(19, 16, 7.5, '#b23a38');
    q.arc(19, 16, 8.5, Math.PI * 0.9, Math.PI * 1.6, STEEL[3]);
    q.rect(18, 9, 2, 14, '#f0d9a0');
    q.rect(12, 15, 14, 2, '#f0d9a0');
    q.disk(19, 16, 2, GOLD[2]);
    return finish(p, q);
  },
  w_slam() {
    const p = frame('w');
    const q = new P();
    // 땅 금
    q.line(4, 26, 28, 26, '#6e5a48');
    q.line(16, 24, 8, 28, '#ffb24a');
    q.line(16, 24, 24, 28, '#ffb24a');
    q.line(16, 24, 16, 29, '#ffe48a');
    q.arc(16, 25, 11, Math.PI * 1.05, Math.PI * 1.95, '#ffe48a');
    // 칼
    q.rect(14, 8, 4, 16, STEEL[2]);
    q.rect(14, 8, 1, 16, STEEL[3]);
    q.rect(17, 8, 1, 16, STEEL[0]);
    q.poly([[14, 24], [18, 24], [16, 27]], STEEL[2]);
    q.rect(10, 6, 12, 2, GOLD[2]);
    q.rect(15, 2, 2, 4, WOOD[2]);
    return finish(p, q);
  },
  w_cry() {
    const p = frame('w');
    const q = new P();
    q.ball(11, 16, 7, STEEL);
    q.rect(5, 15, 12, 2, '#23182a');
    q.poly([[12, 18], [17, 15], [17, 22]], '#23182a');
    q.rect(10, 9, 2, 6, GOLD[2]);
    q.arc(14, 17, 7, -0.7, 0.7, '#ffe48a');
    q.arc(14, 17, 11, -0.7, 0.7, '#ffb24a');
    q.arc(14, 17, 15, -0.55, 0.55, '#e0703a');
    return finish(p, q);
  },
  w_judge() {
    const p = frame('w');
    const q = new P();
    // 빛줄기
    for (const x of [8, 24]) q.line(16, 2, x, 28, '#ffcf6e');
    q.line(16, 2, 4, 20, '#c88f2a');
    q.line(16, 2, 28, 20, '#c88f2a');
    // 내려오는 큰 칼
    q.rect(13, 6, 6, 18, '#fff4c8');
    q.rect(13, 6, 2, 18, '#ffffff');
    q.rect(17, 6, 2, 18, '#ffcf6e');
    q.poly([[13, 24], [19, 24], [16, 29]], '#fff4c8');
    q.rect(8, 4, 16, 2, GOLD[2]);
    q.rect(15, 1, 2, 3, GOLD[3]);
    return finish(p, q);
  },
  m_fireball() {
    const p = frame('m');
    const q = new P();
    q.poly([[3, 28], [10, 12], [20, 22]], '#c8421c');
    q.poly([[6, 26], [12, 15], [18, 21]], '#ff8a2a');
    q.ball(19, 13, 8, ['#c8421c', '#ff8a2a', '#ffc24a', '#fff4c8']);
    return finish(p, q);
  },
  m_nova() {
    const p = frame('m');
    const q = new P();
    q.arc(16, 16, 11, 0, Math.PI * 2, FROST[2], 3);
    q.arc(16, 16, 11, 0, Math.PI * 2, FROST[3], 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = 16 + Math.cos(a) * 11;
      const y = 16 + Math.sin(a) * 11;
      q.poly([[x + Math.cos(a) * 4, y + Math.sin(a) * 4], [x - Math.sin(a) * 2, y + Math.cos(a) * 2], [x - Math.cos(a) * 2, y - Math.sin(a) * 2], [x + Math.sin(a) * 2, y - Math.cos(a) * 2]], '#e8fbff');
    }
    q.px(16, 16, '#ffffff');
    return finish(p, q);
  },
  m_meteor() {
    const p = frame('m');
    const q = new P();
    q.poly([[28, 2], [14, 12], [22, 20]], '#ff8a2a');
    q.poly([[28, 3], [17, 13], [21, 17]], '#ffe48a');
    q.ball(13, 19, 8, ['#2a2024', '#4a3a38', '#6e5a50', '#a08a70']);
    q.line(9, 17, 13, 22, '#ff7a2a');
    q.line(13, 22, 18, 19, '#ffc24a');
    q.line(13, 15, 13, 22, '#ff7a2a');
    return finish(p, q);
  },
  m_shield() {
    const p = frame('m');
    const q = new P();
    q.poly([[16, 3], [26, 7], [26, 17], [16, 29], [6, 17], [6, 7]], SAPPH[2]);
    q.poly([[16, 3], [16, 29], [6, 17], [6, 7]], SAPPH[3]);
    q.poly([[16, 7], [22, 10], [22, 16], [16, 24], [10, 16], [10, 10]], SAPPH[1]);
    q.poly([[16, 11], [19, 15], [16, 20], [13, 15]], '#e8fbff');
    return finish(p, q);
  },
  m_starfall() {
    const p = frame('m');
    const q = new P();
    const star = (x, y, r, col) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const R = i % 2 ? r * 0.45 : r;
        pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R]);
      }
      q.poly(pts, col);
    };
    q.line(27, 2, 20, 11, '#8fd2ee');
    q.line(13, 2, 8, 10, '#8fd2ee');
    q.line(24, 14, 17, 22, '#8fd2ee');
    star(18, 13, 6, '#ffe48a');
    star(7, 12, 4, '#fff4c8');
    star(15, 25, 4.6, '#ffe48a');
    return finish(p, q);
  },
  a_fan() {
    const p = frame('a');
    const q = new P();
    arrowDiag(q, 4, 25, 14, 5);
    arrowDiag(q, 4, 26, 24, 12);
    arrowDiag(q, 5, 27, 26, 24);
    return finish(p, q);
  },
  a_pierce() {
    const p = frame('a');
    const q = new P();
    for (const x of [10, 19]) {
      q.ell(x, 16, 3.5, 9, '#7a5a3a');
      q.ell(x, 16, 2, 7, '#c8483c');
      q.ell(x, 16, 1, 4, '#f0e4c8');
    }
    q.line(1, 16, 26, 16, '#ffe48a', 1);
    q.poly([[30, 16], [25, 13], [25, 19]], STEEL[3]);
    q.rect(2, 14, 3, 1, RUBY[2]);
    q.rect(2, 18, 3, 1, RUBY[2]);
    return finish(p, q);
  },
  a_trap() {
    const p = frame('a');
    const q = new P();
    // 올가미
    q.rect(22, 4, 3, 20, WOOD[1]);
    q.rect(22, 4, 1, 20, WOOD[3]);
    q.arc(14, 21, 9, 0, Math.PI * 2, '#e0cf9e');
    q.ell(14, 21, 8, 5, null);
    q.arc(14, 21, 8.5, 0, Math.PI * 2, '#e0cf9e');
    q.line(23, 8, 17, 15, '#e0cf9e');
    q.line(24, 5, 12, 7, '#e0cf9e');
    q.rect(4, 26, 24, 2, '#4a3a28');
    return finish(p, q);
  },
  a_hawk() {
    const p = frame('a');
    const q = new P();
    // 날개
    q.poly([[2, 12], [12, 6], [16, 12], [20, 6], [30, 12], [22, 15], [16, 20], [10, 15]], '#b08a58');
    q.poly([[2, 12], [12, 6], [16, 12], [10, 15]], '#d4b078');
    q.line(5, 13, 12, 9, '#6e4e2c');
    q.line(27, 13, 20, 9, '#6e4e2c');
    // 눈
    q.ell(16, 21, 7, 4.5, '#fff4c8');
    q.disk(16, 21, 3.4, '#e0a020');
    q.disk(16, 21, 1.8, '#16121c');
    q.px(15, 20, '#ffffff');
    return finish(p, q);
  },
  a_rain() {
    const p = frame('a');
    const q = new P();
    for (const [x, y] of [[8, 4], [16, 7], [24, 4], [12, 15], [21, 16]]) {
      q.line(x, y, x - 2, y + 8, '#e8e0c8');
      q.poly([[x - 3, y + 12], [x - 4, y + 8], [x - 1, y + 8]], STEEL[3]);
      q.px(x + 1, y - 1, RUBY[2]);
      q.px(x - 1, y - 1, RUBY[2]);
    }
    q.line(4, 28, 28, 28, '#4a6a3a');
    return finish(p, q);
  },
  roll() {
    const p = frame('x');
    const q = new P();
    q.arc(16, 17, 9, -Math.PI * 0.95, Math.PI * 0.5, '#e8eef6', 2);
    q.poly([[16, 26], [11, 23], [11, 29]], '#e8eef6');
    q.ball(16, 17, 4.5, ['#6a7486', '#9aa4b4', '#c8d0dc', '#f2f5fa']);
    for (const y of [12, 18, 24]) q.rect(2, y, 3, 1, '#9aa4b4');
    return finish(p, q);
  },
  blink() {
    const p = frame('x');
    const q = new P();
    // 사라지는 쪽(점선 몸)과 나타나는 쪽
    const body = (x, col, col2) => {
      q.disk(x, 11, 3.5, col);
      q.poly([[x - 4, 15], [x + 4, 15], [x + 3, 26], [x - 3, 26]], col2);
    };
    body(9, '#6c5a9c', '#4a3c78');
    for (let y = 8; y < 27; y += 2) for (let x = 5; x < 14; x += 2) q.g[y * C + x] = null;
    body(22, '#e0c8ff', '#9c6ae4');
    q.line(13, 16, 17, 16, '#e0c8ff');
    q.poly([[18, 16], [15, 13], [15, 19]], '#e0c8ff');
    sparkle(q, 27, 7, '#e0c8ff');
    return finish(p, q);
  },
  leap() {
    const p = frame('x');
    const q = new P();
    q.arc(16, 24, 12, Math.PI, Math.PI * 1.9, '#e8eef6', 2);
    q.poly([[29, 23], [23, 20], [27, 16]], '#e8eef6');
    q.rect(3, 26, 26, 2, '#7a6a58');
    q.disk(12, 11, 2.5, '#f2c8a2');
    q.line(12, 13, 13, 18, '#b5553a', 2);
    q.line(13, 18, 9, 21, '#6a5a48');
    q.line(13, 18, 17, 20, '#6a5a48');
    q.line(12, 14, 8, 12, '#b5553a');
    q.line(12, 14, 16, 12, '#b5553a');
    return finish(p, q);
  },
  guard_w() {
    const p = frame('w');
    const q = new P();
    q.disk(16, 16, 11, IRON[2]);
    q.disk(16, 16, 9.5, '#3f62b0');
    q.arc(16, 16, 10.5, Math.PI * 0.9, Math.PI * 1.6, '#ffffff');
    q.rect(15, 7, 2, 18, '#e9e3cf');
    q.rect(7, 15, 18, 2, '#e9e3cf');
    q.disk(16, 16, 2.6, GOLD[2]);
    q.px(15, 15, GOLD[3]);
    return finish(p, q);
  },
  guard_m() {
    const p = frame('m');
    const q = new P();
    q.arc(16, 16, 12, Math.PI * 1.05, Math.PI * 1.95, '#c4e4ff', 2);
    q.arc(16, 18, 8, Math.PI * 1.1, Math.PI * 1.9, '#5c94ec', 1);
    // 손바닥
    q.rect(12, 18, 8, 8, '#f2c8a2');
    q.rect(12, 18, 3, 8, '#ffe0c0');
    for (const x of [12, 14, 16, 18]) q.rect(x, 14, 2, 5, '#f2c8a2');
    q.rect(20, 20, 2, 4, '#e0ac84');
    q.rect(12, 26, 8, 2, '#4a3f9c');
    return finish(p, q);
  },
  guard_a() {
    const p = frame('a');
    const q = new P();
    // 비껴 든 활 + 막는 쐐기
    q.arc(8, 24, 18, -Math.PI / 2, 0.05, WOOD[2], 2.4);
    q.arc(8, 24, 17.5, -Math.PI / 2 + 0.1, -0.05, WOOD[3]);
    q.line(8, 6, 26, 25, '#e8e0c8');
    q.poly([[6, 12], [16, 12], [16, 20], [11, 25], [6, 20]], '#7f5a34');
    q.poly([[6, 12], [11, 12], [11, 25], [6, 20]], '#a58350');
    q.px(11, 16, '#ffe48a');
    return finish(p, q);
  },
};


// ─── 조선 물건 (2026-11-06 다시 그림) ─────────────────────
const BRONZE = ['#5a3a1a', '#8a5a26', '#b88438', '#e2b866'];
const CELADON = ['#3e6a62', '#5e9488', '#8cc0b0', '#cfeee2'];
const BLUEG = ['#2a4a7a', '#4a7ac0', '#8ab8f0', '#e0f2ff'];
const STRAW = ['#7a5e2a', '#a8843e', '#ccaa5a', '#ecd690'];
const SILK_R = ['#6e1420', '#a8232c', '#d8443e', '#f48a72'];

/** 환도: 살짝 휜 외날, 둥근 코등이, 자루 끝 술 */
function jSword(t) {
  const p = new P();
  const blades = [IRON, STEEL, ['#3a6a62', '#5e9a8c', '#9cd2c0', '#e8fff4'], BLUEG];
  const len = [14, 17, 18, 20][t];
  const w = [1, 1, 1, 2][t];
  const sx = 9;
  const sy = 22;
  blade(p, sx, sy, len, w, blades[t]);
  // 휜 등: 칼끝 쪽 등선을 한 칸 밀어 휘어 보이게 한다
  for (let i = Math.floor(len * 0.55); i < len - 1; i++) p.px(sx + i + 1, sy - i + 1, blades[t][0]);
  const gr = t < 2 ? ['#2a1a14', '#3e2a20', '#5a3c2a', '#7a5638'] : t === 2 ? LEATHER : DARKW;
  p.line(sx - 5, sy + 5, sx - 1, sy + 1, gr[1], 2);
  for (let k = 0; k < 4; k++) p.px(sx - 4 + k, sy + 4 - k, gr[3]);
  // 둥근 코등이
  const gd = [IRON, BRASS, BRASS, GOLD][t];
  p.ell(sx, sy, 2.6, 2.6, gd[1]);
  p.px(sx - 1, sy - 1, gd[3]);
  p.px(sx, sy - 1, gd[2]);
  // 자루 끝 술
  const tas = t === 3 ? BLUEG : SILK_R;
  p.line(sx - 6, sy + 6, sx - 7, sy + 10, tas[2]);
  p.line(sx - 7, sy + 6, sx - 8, sy + 10, tas[1]);
  p.outline();
  if (t === 3) {
    sparkle(p, 26, 10, '#c4e4ff');
    sparkle(p, 15, 6, '#c4e4ff');
  }
  if (t === 2) sparkle(p, 25, 6, '#c8fff0');
  return p;
}

/** 초롱 지팡이 */
function jStaff(t) {
  const p = new P();
  const pole = [WOOD, BRONZE, ['#2e2a1e', '#4a4030', '#6a5c40', '#8a7a58'], DARKW][t];
  p.line(8, 29, 20, 9, pole[1], 2);
  p.line(8, 28, 19, 9, pole[3]);
  if (t === 0) {
    // 등잔: 작은 접시와 불꽃
    p.rect(17, 7, 7, 2, BRONZE[1]);
    p.rect(18, 7, 5, 1, BRONZE[3]);
    p.disk(20.5, 4.5, 1.6, AMBER[2]);
    p.px(20, 4, '#fff4c0');
  } else if (t === 2) {
    // 굽은 가지 끝에 맺힌 빛
    p.line(19, 9, 23, 6, pole[2]);
    p.line(19, 9, 17, 4, pole[2]);
    p.ball(21, 5, 3.2, EMER);
    p.px(14, 18, '#4e6e30');
    p.px(15, 17, '#5c7a34');
  } else {
    // 구부러진 끝에 매단 초롱
    p.line(20, 9, 23, 5, pole[2], 2);
    p.line(23, 5, 25, 7, pole[2]);
    const big = t === 3;
    const top = big ? BLUEG : SILK_R;
    const bot = big ? SILK_R : AMBER;
    const cx = 25;
    const cy = big ? 14 : 12;
    const rx = big ? 4 : 3;
    const ry = big ? 5 : 4;
    p.line(25, 7, 25, cy - ry, '#2a1e18');
    p.ell(cx, cy, rx, ry, bot[2]);
    for (let y = cy - ry; y <= cy - 1; y++) for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) p.px(x, y, top[2]);
    p.rect(cx - rx + 1, cy - ry - 1, rx * 2 - 1, 1, GOLD[1]);
    p.rect(cx - rx + 1, cy + ry, rx * 2 - 1, 1, GOLD[1]);
    p.px(cx - 1, cy - 1, '#fffbe0');
    p.line(cx, cy + ry + 1, cx, cy + ry + 3, top[1]);
  }
  p.outline();
  if (t === 3) sparkle(p, 20, 18, '#ffe48a');
  if (t === 2) sparkle(p, 25, 3, '#c0f4b8');
  return p;
}

/** 각궁: 줌통 양쪽이 휘었다가 끝이 바깥으로 젖혀진다 */
function jBow(t) {
  const p = new P();
  const lim = [WOOD, ['#1e1612', '#3a2a20', '#5a4030', '#7a5a40'], ['#2e3a20', '#4a5a30', '#6a7a40', '#8a9a58'], ['#a8987a', '#d8c8a8', '#f2e8d0', '#ffffff']][t];
  const wrap = [LEATHER, SILK_R, EMER, GOLD][t];
  // 위아래로 선 활: 줌통 (12,16), 끝은 (19,3)과 (19,29)
  const pts = [[19, 3], [17, 4], [15, 6], [13, 9], [12, 12], [12, 16], [12, 20], [13, 23], [15, 26], [17, 28], [19, 29]];
  for (let i = 0; i + 1 < pts.length; i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lim[1], 2);
  for (let i = 0; i + 1 < pts.length; i++) p.line(pts[i][0] - 1, pts[i][1], pts[i + 1][0] - 1, pts[i + 1][1], lim[3]);
  // 젖혀진 끝
  p.line(19, 3, 21, 2, lim[2]);
  p.line(19, 29, 21, 30, lim[2]);
  p.rect(11, 14, 3, 5, wrap[2]);
  p.px(11, 14, wrap[3]);
  // 시위
  p.line(20, 3, 20, 29, t === 3 ? '#ffe0c0' : '#e8dcc0');
  p.outline();
  if (t >= 2) sparkle(p, 23, 6, t === 3 ? '#ffe0c0' : '#c0f4b8');
  return p;
}

/** 전립·투구 */
function jHelm(t) {
  const p = new P();
  if (t === 0) {
    // 가죽 벙거지: 넓은 챙, 둥근 모자, 붉은 상모
    p.ell(16, 21, 13, 4, LEATHER[1]);
    p.ell(16, 20, 12, 3, LEATHER[2]);
    p.ell(16, 15, 7, 7, LEATHER[1]);
    p.ell(15, 13, 5, 4, LEATHER[2]);
    p.px(13, 11, LEATHER[3]);
    p.rect(9, 18, 14, 1, '#2a1a14');
    p.disk(16, 7, 2, SILK_R[2]);
    p.px(15, 6, SILK_R[3]);
  } else {
    const m = t === 1 ? STEEL : ['#24232a', '#3a3842', '#56535e', '#7a7684'];
    // 볼끼
    p.rect(7, 18, 18, 9, t === 1 ? LEATHER[1] : m[1]);
    for (let x = 8; x < 25; x += 3) p.rect(x, 19, 1, 7, t === 1 ? LEATHER[0] : m[0]);
    // 둥근 투구
    p.ell(16, 16, 9, 9, m[1]);
    for (let y = 7; y <= 16; y++) for (let x = 7; x <= 25; x++) if (((x - 16) / 9) ** 2 + ((y - 16) / 9) ** 2 <= 1 && x < 15) p.px(x, y, m[2]);
    p.px(11, 11, m[3]);
    p.px(12, 10, m[3]);
    // 챙과 테
    p.rect(5, 17, 22, 2, m[0]);
    p.rect(6, 16, 20, 1, t === 1 ? GOLD[2] : '#ff7a2a');
    // 꼭대기
    p.rect(15, 4, 2, 4, t === 1 ? GOLD[2] : '#ff7a2a');
    p.disk(16, 3, 2, t === 1 ? SILK_R[2] : '#d8443e');
    if (t === 2) {
      p.line(7, 13, 3, 6, m[2], 2);
      p.line(25, 13, 29, 6, m[2], 2);
      p.line(16, 8, 16, 15, '#ff9a4a');
    }
  }
  p.outline();
  if (t === 2) sparkle(p, 26, 22, '#ffb06a');
  return p;
}

/** 철릭·쇄자갑·찰갑 */
function jArmor(t) {
  const p = new P();
  const coat = [['#1c2a4a', '#2c3f66', '#41588a', '#6a82b4'], IRON, ['#24232a', '#3a3842', '#56535e', '#7a7684']][t];
  // 몸판과 넓게 퍼진 치마
  p.poly([[10, 6], [22, 6], [24, 16], [27, 29], [5, 29], [8, 16]], coat[1]);
  p.poly([[10, 6], [16, 6], [15, 29], [5, 29], [8, 16]], coat[2]);
  // 소매
  p.poly([[10, 6], [5, 9], [3, 18], [7, 18], [9, 12]], coat[1]);
  p.poly([[22, 6], [27, 9], [29, 18], [25, 18], [23, 12]], coat[0]);
  if (t === 0) {
    // 철릭: 허리 아래 잔주름, 흰 동정, 띠
    for (let x = 7; x < 26; x += 2) p.line(x, 18, x - (x < 16 ? 1 : -1), 28, coat[0]);
    p.line(12, 6, 18, 13, '#ece6d6');
    p.line(20, 6, 16, 10, '#ece6d6');
  } else if (t === 1) {
    // 쇄자갑: 고리 무늬와 앞치마
    for (let y = 7; y < 29; y++) for (let x = 6; x < 27; x++) if ((x + y) % 2 && p.get(x, y)) p.px(x, y, coat[0]);
    p.rect(13, 9, 6, 18, '#2c3f66');
    p.rect(13, 9, 6, 1, GOLD[2]);
    p.rect(13, 26, 6, 1, GOLD[2]);
  } else {
    // 찰갑: 줄지어 엮은 쇳조각, 달아오른 테
    for (let y = 8; y < 29; y += 3) for (let x = 6; x < 27; x++) if (p.get(x, y)) p.px(x, y, coat[0]);
    for (let y = 9; y < 29; y += 3) for (let x = 6 + (y % 2); x < 27; x += 3) if (p.get(x, y)) p.px(x, y, coat[3]);
    p.rect(9, 5, 14, 2, '#ff7a2a');
    p.rect(5, 28, 22, 1, '#ff7a2a');
  }
  p.rect(8, 16, 16, 2, t === 0 ? SILK_R[1] : LEATHER[0]);
  p.outline();
  if (t === 2) sparkle(p, 26, 5, '#ffb06a');
  return p;
}

/** 짚신·목화 */
function jBoots(t) {
  const p = new P();
  if (t === 0) {
    // 짚신: 위에서 본 엮은 바닥과 끈
    for (const ox of [0, 11]) {
      p.ell(10 + ox, 17, 4.5, 11, STRAW[1]);
      for (let y = 8; y < 27; y += 2) p.line(7 + ox, y, 13 + ox, y, STRAW[2]);
      p.line(7 + ox, 12, 13 + ox, 12, '#5a3c1e');
      p.line(10 + ox, 7, 10 + ox, 12, '#5a3c1e');
    }
  } else {
    const leather = t === 1 ? ['#1a1416', '#2e2428', '#4a3a40', '#6a5660'] : BLUEG;
    // 목이 긴 신과 흰 밑창
    p.poly([[9, 3], [18, 3], [18, 22], [27, 24], [27, 28], [7, 28], [8, 20]], leather[1]);
    p.poly([[9, 3], [12, 3], [11, 22], [8, 26], [7, 26], [8, 20]], leather[2]);
    p.rect(7, 27, 21, 2, '#ece6d6');
    p.rect(9, 3, 9, 2, t === 1 ? SILK_R[1] : '#ffffff');
    if (t === 2) {
      p.line(18, 8, 25, 4, '#e0f2ff');
      p.line(18, 11, 26, 9, '#c4e4ff');
    }
  }
  p.outline();
  if (t === 2) sparkle(p, 26, 14, '#c4e4ff');
  return p;
}

/** 가락지: 한 쌍의 고리 */
function jRing(t) {
  const p = new P();
  const m = t === 0 ? BRONZE : GOLD;
  for (const [cx, cy] of [[12, 17], [20, 15]]) {
    p.ell(cx, cy, 6, 6, m[1]);
    p.ell(cx, cy, 4, 4, null);
    p.arc(cx, cy, 5, 3.4, 5.2, m[3]);
  }
  if (t === 1) p.ball(20, 9, 2.6, AMBER);
  p.outline();
  if (t === 1) sparkle(p, 25, 6, '#ffe48a');
  return p;
}

/** 노리개: 매듭, 장식, 긴 술 */
function jNorigae(t) {
  const p = new P();
  // 고리와 매듭
  p.ell(16, 4, 2.5, 2.5, GOLD[2]);
  p.ell(16, 4, 1, 1, null);
  p.poly([[16, 7], [20, 10], [16, 13], [12, 10]], SILK_R[2]);
  p.px(15, 9, SILK_R[3]);
  // 장식
  if (t === 0) {
    p.ell(16, 17, 3.5, 4, AMBER[2]);
    p.rect(13, 13, 7, 1, GOLD[1]);
    p.rect(13, 21, 7, 1, GOLD[1]);
    p.px(15, 16, '#fff4c0');
  } else {
    p.ball(16, 17, 4.2, CELADON);
    p.rect(12, 12, 9, 1, GOLD[2]);
  }
  // 술
  const tas = t === 0 ? SILK_R : BLUEG;
  p.rect(14, 22, 5, 2, GOLD[1]);
  for (let x = 13; x <= 19; x++) p.line(x, 24, x + (x - 16) * 0.3, 30, x % 2 ? tas[2] : tas[1]);
  p.outline();
  if (t === 1) sparkle(p, 23, 14, '#e0f2ff');
  return p;
}

/** 환약: 비단 주머니 위의 둥근 알약. mp는 금박을 싼 청심환 */
function jPills(gold) {
  const p = new P();
  p.ell(16, 23, 12, 5, gold ? '#2c3f66' : '#7a2c30');
  p.ell(16, 22, 11, 4, gold ? '#41588a' : '#a8402e');
  const ramp = gold ? GOLD : ['#3a1a10', '#6a3220', '#8a4a2e', '#b8704a'];
  p.ball(11, 18, 3.6, ramp);
  p.ball(20, 18, 3.6, ramp);
  p.ball(15.5, 13, 3.6, ramp);
  p.outline();
  if (gold) sparkle(p, 22, 9, '#fff0a8');
  return p;
}

/** 탕약: 사발에 담긴 약. 김이 오른다 */
function jBowl(blue) {
  const p = new P();
  const bowl = blue ? CELADON : ['#c8bca8', '#e2d8c4', '#f2ecdc', '#ffffff'];
  p.poly([[4, 16], [28, 16], [24, 26], [8, 26]], bowl[1]);
  p.poly([[4, 16], [14, 16], [12, 26], [8, 26]], bowl[2]);
  p.rect(11, 26, 10, 2, bowl[0]);
  p.ell(16, 16, 12, 3, blue ? '#2f56c0' : '#6a2a1a');
  p.ell(14, 15, 7, 1.5, blue ? '#5c94ec' : '#9a4a2a');
  // 김
  for (const [x, ph] of [[11, 0], [17, 1], [22, 0]]) for (let y = 5; y < 12; y++) p.px(x + ((y + ph) % 4 < 2 ? 0 : 1), y, '#e8e0d0');
  p.outline();
  return p;
}

/** 부적: 노란 종이에 붉은 글씨 */
function jTalisman() {
  const p = new P();
  p.rect(10, 3, 12, 26, '#e8c040');
  p.rect(10, 3, 3, 26, '#f6dc70');
  p.rect(10, 3, 12, 1, '#b8901e');
  const red = '#b8232c';
  p.line(16, 6, 16, 26, red);
  p.line(13, 9, 19, 9, red);
  p.line(13, 13, 19, 16, red);
  p.line(19, 13, 13, 16, red);
  p.disk(16, 21, 2.4, red);
  p.disk(16, 21, 1, '#e8c040');
  p.line(13, 25, 19, 25, red);
  p.outline();
  return p;
}

/** 정철: 단단히 두드린 쇳덩이 */
function jIngot() {
  const p = new P();
  p.poly([[6, 14], [24, 10], [28, 18], [10, 23]], IRON[1]);
  p.poly([[6, 14], [24, 10], [25, 12], [7, 16]], IRON[3]);
  p.poly([[10, 23], [28, 18], [28, 21], [10, 26]], IRON[0]);
  p.line(9, 22, 26, 18, '#ff8a3a');
  p.outline();
  sparkle(p, 25, 8, '#ffb06a');
  return p;
}

/** 짐승 털 한 뭉치 */
function jFur() {
  const p = new P();
  const f = ['#4a2e1c', '#7a5030', '#a8763e', '#d0a06a'];
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 2;
    p.line(16, 26, x, 6 + Math.abs(i - 4) * 2, f[1 + (i % 3)], 2);
  }
  p.rect(13, 24, 7, 4, SILK_R[1]);
  p.outline();
  return p;
}

/** 짐승 가죽: 펼친 가죽 */
function jHide() {
  const p = new P();
  p.poly([[6, 8], [11, 5], [16, 7], [21, 5], [26, 8], [24, 16], [27, 25], [20, 27], [16, 25], [12, 27], [5, 25], [8, 16]], '#a8763e');
  p.poly([[9, 10], [16, 9], [23, 10], [21, 22], [16, 23], [11, 22]], '#c89458');
  for (let i = 0; i < 4; i++) p.line(11 + i * 3, 12, 12 + i * 3, 20, '#8a5a2e');
  p.outline();
  return p;
}

/** 불가사리 쇠비늘 */
function jScale() {
  const p = new P();
  p.poly([[16, 3], [27, 12], [23, 28], [9, 28], [5, 12]], IRON[1]);
  p.poly([[16, 3], [16, 28], [9, 28], [5, 12]], IRON[2]);
  p.line(16, 6, 13, 16, '#ff7a2a');
  p.line(13, 16, 18, 24, '#ff9a4a');
  p.outline();
  sparkle(p, 24, 6, '#ffb06a');
  return p;
}

/** 엽전 꾸러미: 끈에 꿴 상평통보 */
function jCoins() {
  const p = new P();
  const coin = (cx, cy) => {
    p.ell(cx, cy, 5, 5, BRONZE[2]);
    p.arc(cx, cy, 4, 3.6, 5.6, BRONZE[3]);
    p.rect(cx - 1, cy - 1, 3, 3, null);
  };
  coin(11, 20);
  coin(20, 22);
  coin(16, 13);
  p.line(16, 3, 16, 9, SILK_R[2]);
  p.line(15, 3, 17, 3, SILK_R[2]);
  p.outline();
  sparkle(p, 25, 12, '#ffe48a');
  return p;
}

/** 저승 엽전: 검붉은 빛이 도는 동전 */
function jUnderCoin() {
  const p = new P();
  p.ell(16, 16, 11, 11, VIOLET[0]);
  p.ell(16, 16, 9, 9, VIOLET[1]);
  p.arc(16, 16, 8, 3.6, 5.6, VIOLET[3]);
  p.rect(13, 13, 7, 7, null);
  p.rect(12, 12, 9, 1, VIOLET[2]);
  p.outline();
  sparkle(p, 25, 6, '#e0c8ff');
  return p;
}

const ITEMS = {
  sword_1: () => jSword(0), sword_2: () => jSword(1), sword_3: () => jSword(2), sword_4: () => jSword(3),
  staff_1: () => jStaff(0), staff_2: () => jStaff(1), staff_3: () => jStaff(2), staff_4: () => jStaff(3),
  bow_1: () => jBow(0), bow_2: () => jBow(1), bow_3: () => jBow(2), bow_4: () => jBow(3),
  helm_1: () => jHelm(0), helm_2: () => jHelm(1), helm_3: () => jHelm(2),
  armor_1: () => jArmor(0), armor_2: () => jArmor(1), armor_3: () => jArmor(2),
  boots_1: () => jBoots(0), boots_2: () => jBoots(1), boots_3: () => jBoots(2),
  ring_1: () => jRing(0), ring_2: () => jRing(1),
  amulet_1: () => jNorigae(0), amulet_2: () => jNorigae(1),
  potion_hp_s: () => jPills(false), potion_hp_l: () => jBowl(false),
  potion_mp_s: () => jPills(true), potion_mp_l: () => jBowl(true),
  scroll_home: jTalisman, ember_shard: jIngot, moss_core: jFur, boar_tusk: boarTusk, ash_core: jHide,
  warden_seal: jScale, gold: jCoins, rift_token: jUnderCoin, key,
};
const SKILL_ORDER = 'w_whirl w_charge w_slam w_cry w_judge m_fireball m_nova m_meteor m_shield m_starfall a_fan a_pierce a_trap a_hawk a_rain roll blink leap guard_w guard_m guard_a'.split(' ');

function sheet(list, makers, art, name) {
  const cols = 8;
  const rows = Math.ceil(list.length / cols);
  const img = new Img(cols * C, rows * C);
  list.forEach((id, k) => {
    const p = makers[id]();
    const ox = (k % cols) * C;
    const oy = Math.floor(k / cols) * C;
    for (let y = 0; y < C; y++)
      for (let x = 0; x < C; x++) {
        const v = p.g[y * C + x];
        if (v) img.set(ox + x, oy + y, v);
      }
  });
  img.save(join(art, 'icons', name + '.png'));
  writeFileSync(join(art, 'icons', name + '.json'), JSON.stringify({ cell: C, cols, ids: list }, null, 1) + '\n');
}

export async function bakeIcons(art) {
  mkdirSync(join(art, 'icons'), { recursive: true });
  const itemIds = 'sword_1 sword_2 sword_3 sword_4 staff_1 staff_2 staff_3 staff_4 bow_1 bow_2 bow_3 bow_4 helm_1 helm_2 helm_3 armor_1 armor_2 armor_3 boots_1 boots_2 boots_3 ring_1 ring_2 amulet_1 amulet_2 potion_hp_s potion_hp_l potion_mp_s potion_mp_l scroll_home ember_shard moss_core boar_tusk ash_core warden_seal gold rift_token key'.split(' ');
  sheet(itemIds, ITEMS, art, 'items');
  sheet(SKILL_ORDER, S, art, 'skills');
}
