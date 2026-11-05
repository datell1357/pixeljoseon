// 작은 픽셀 캔버스. 미리보기·지형·아이콘에서 쓴다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { encodePNG, decodePNG } from './png.mjs';

export const hex = (s) => {
  const v = parseInt(s.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
};

// 5×7 글꼴 (미리보기 라벨용)
const F = {
  a: '01110 10001 10001 11111 10001 10001 10001', b: '11110 10001 10001 11110 10001 10001 11110',
  c: '01110 10001 10000 10000 10000 10001 01110', d: '11110 10001 10001 10001 10001 10001 11110',
  e: '11111 10000 10000 11110 10000 10000 11111', f: '11111 10000 10000 11110 10000 10000 10000',
  g: '01110 10001 10000 10111 10001 10001 01111', h: '10001 10001 10001 11111 10001 10001 10001',
  i: '01110 00100 00100 00100 00100 00100 01110', j: '00111 00010 00010 00010 00010 10010 01100',
  k: '10001 10010 10100 11000 10100 10010 10001', l: '10000 10000 10000 10000 10000 10000 11111',
  m: '10001 11011 10101 10101 10001 10001 10001', n: '10001 11001 10101 10011 10001 10001 10001',
  o: '01110 10001 10001 10001 10001 10001 01110', p: '11110 10001 10001 11110 10000 10000 10000',
  q: '01110 10001 10001 10001 10101 10010 01101', r: '11110 10001 10001 11110 10100 10010 10001',
  s: '01111 10000 10000 01110 00001 00001 11110', t: '11111 00100 00100 00100 00100 00100 00100',
  u: '10001 10001 10001 10001 10001 10001 01110', v: '10001 10001 10001 10001 10001 01010 00100',
  w: '10001 10001 10001 10101 10101 11011 10001', x: '10001 10001 01010 00100 01010 10001 10001',
  y: '10001 10001 01010 00100 00100 00100 00100', z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10011 10101 10101 10101 11001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00110 01000 10000 11111', 3: '11110 00001 00001 01110 00001 00001 11110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  _: '00000 00000 00000 00000 00000 00000 11111', '-': '00000 00000 00000 11111 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 00110 00110', ':': '00000 00110 00110 00000 00110 00110 00000',
  '/': '00001 00010 00010 00100 01000 01000 10000', '=': '00000 00000 11111 00000 11111 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000', '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000', ' ': '00000 00000 00000 00000 00000 00000 00000',
};

export class Img {
  constructor(w, h, data) {
    this.w = w;
    this.h = h;
    this.data = data ?? new Uint8Array(w * h * 4);
  }
  static load(path) {
    const { w, h, data } = decodePNG(readFileSync(path));
    return new Img(w, h, data);
  }
  save(path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encodePNG(this.w, this.h, this.data));
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }
  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3] ?? 255;
  }
  /** 알파 합성으로 한 점 찍기 */
  over(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = (c[3] ?? 255) / 255;
    if (a >= 1) return this.set(x, y, c);
    if (a <= 0) return;
    const i = (y * this.w + x) * 4;
    const da = this.data[i + 3] / 255;
    const oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) this.data[i + k] = Math.round((c[k] * a + this.data[i + k] * da * (1 - a)) / oa);
    this.data[i + 3] = Math.round(oa * 255);
  }
  fill(c) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c);
    return this;
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }
  frame(x, y, w, h, c) {
    for (let i = x; i < x + w; i++) {
      this.set(i, y, c);
      this.set(i, y + h - 1, c);
    }
    for (let j = y; j < y + h; j++) {
      this.set(x, j, c);
      this.set(x + w - 1, j, c);
    }
  }
  /** 일부를 정수 배율로 복사 (알파 합성) */
  blit(src, sx, sy, sw, sh, dx, dy, scale = 1) {
    for (let j = 0; j < sh; j++)
      for (let i = 0; i < sw; i++) {
        const c = src.get(sx + i, sy + j);
        if (c[3] === 0) continue;
        for (let b = 0; b < scale; b++) for (let a = 0; a < scale; a++) this.over(dx + i * scale + a, dy + j * scale + b, c);
      }
  }
  text(x, y, str, c = [255, 255, 255, 255], scale = 1) {
    let cx = x;
    for (const raw of String(str).toLowerCase()) {
      const g = F[raw] ?? F[' '];
      const rows = g.split(' ');
      for (let j = 0; j < 7; j++)
        for (let i = 0; i < 5; i++)
          if (rows[j][i] === '1') for (let b = 0; b < scale; b++) for (let a = 0; a < scale; a++) this.set(cx + i * scale + a, y + j * scale + b, c);
      cx += 6 * scale;
    }
    return cx;
  }
}
