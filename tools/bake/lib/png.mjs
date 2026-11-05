// 의존성 없는 PNG 읽기·쓰기. 지형·아이콘·미리보기·검사는 브라우저 없이 이 파일만 쓴다.
import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([len, t, data, crc]);
}

function ihdr(w, h, colorType) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(w, 0);
  b.writeUInt32BE(h, 4);
  b[8] = 8;
  b[9] = colorType;
  return chunk('IHDR', b);
}

/** RGBA 버퍼를 PNG로. 색이 256개 이하면 팔레트 PNG로 줄인다. */
export function encodePNG(w, h, rgba) {
  const n = w * h;
  const pal = new Map();
  let indexed = true;
  const px = new Uint32Array(rgba.buffer, rgba.byteOffset, n);
  for (let i = 0; i < n; i++) {
    // 완전 투명은 색을 하나로 합친다.
    const c = rgba[i * 4 + 3] === 0 ? 0 : px[i];
    if (!pal.has(c)) {
      if (pal.size >= 256) {
        indexed = false;
        break;
      }
      pal.set(c, pal.size);
    }
  }
  const idat = (raw) => chunk('IDAT', zlib.deflateSync(raw, { level: 9, memLevel: 9 }));
  const end = chunk('IEND', Buffer.alloc(0));
  if (indexed) {
    const plte = Buffer.alloc(pal.size * 3);
    const trns = Buffer.alloc(pal.size);
    let hasAlpha = false;
    for (const [c, i] of pal) {
      plte[i * 3] = c & 255;
      plte[i * 3 + 1] = (c >>> 8) & 255;
      plte[i * 3 + 2] = (c >>> 16) & 255;
      trns[i] = (c >>> 24) & 255;
      if (trns[i] !== 255) hasAlpha = true;
    }
    const raw = Buffer.alloc((w + 1) * h);
    for (let y = 0, o = 0, p = 0; y < h; y++) {
      raw[o++] = 0;
      for (let x = 0; x < w; x++, p++) raw[o++] = pal.get(rgba[p * 4 + 3] === 0 ? 0 : px[p]);
    }
    const parts = [SIG, ihdr(w, h, 3), chunk('PLTE', plte)];
    if (hasAlpha) parts.push(chunk('tRNS', trns));
    parts.push(idat(raw), end);
    return Buffer.concat(parts);
  }
  // 트루컬러: 줄마다 sub/up/none 중 합이 작은 필터
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 3; f++) {
      let sum = 0;
      const c = cand[f];
      for (let i = 0; i < stride; i++) {
        const v = rgba[row + i];
        const a = f === 1 ? (i >= 4 ? rgba[row + i - 4] : 0) : 0;
        const b = f === 2 ? (y > 0 ? rgba[row + i - stride] : 0) : 0;
        const r = (v - a - b) & 255;
        c[i] = r;
        sum += r < 128 ? r : 256 - r;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    const o = y * (stride + 1);
    raw[o] = best;
    cand[best].copy(raw, o + 1);
  }
  return Buffer.concat([SIG, ihdr(w, h, 6), idat(raw), end]);
}

/** 8비트 비인터레이스 PNG(회색·RGB·팔레트·RGBA)를 RGBA로 읽는다. */
export function decodePNG(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('PNG 서명이 아닙니다');
  let o = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  let plte = null;
  let trns = null;
  const idats = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('8비트 PNG만 읽습니다');
      ct = data[9];
      if (data[12] !== 0) throw new Error('인터레이스는 읽지 않습니다');
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idats.push(data);
    o += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = w * ch;
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0, p = 0; y < h; y++) {
    const f = raw[p++];
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = raw[p++];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - b);
        const pc = Math.abs(q - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 255;
    }
    prev.set(line);
    for (let x = 0; x < w; x++) {
      const d = (y * w + x) * 4;
      if (ct === 6) {
        out[d] = line[x * 4];
        out[d + 1] = line[x * 4 + 1];
        out[d + 2] = line[x * 4 + 2];
        out[d + 3] = line[x * 4 + 3];
      } else if (ct === 2) {
        out[d] = line[x * 3];
        out[d + 1] = line[x * 3 + 1];
        out[d + 2] = line[x * 3 + 2];
        out[d + 3] = 255;
      } else if (ct === 3) {
        const i = line[x];
        out[d] = plte[i * 3];
        out[d + 1] = plte[i * 3 + 1];
        out[d + 2] = plte[i * 3 + 2];
        out[d + 3] = trns && i < trns.length ? trns[i] : 255;
      } else if (ct === 0) {
        out[d] = out[d + 1] = out[d + 2] = line[x];
        out[d + 3] = 255;
      } else {
        out[d] = out[d + 1] = out[d + 2] = line[x * 2];
        out[d + 3] = line[x * 2 + 1];
      }
    }
  }
  return { w, h, data: out };
}
