// 눈으로 확인할 접촉 시트. docs/art-preview/ 아래에 쓴다.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Img, hex } from './lib/img.mjs';

const BG = hex('#4c5a46');
const BG2 = hex('#46533f');
const INK = hex('#f0ead8');

export function charSheet(root, id) {
  const dir = join(root, 'client/public/art/chars');
  const meta = JSON.parse(readFileSync(join(dir, id + '.json'), 'utf8'));
  const img = Img.load(join(dir, id + '.png'));
  return { meta, img };
}

function frameAt(meta, f) {
  const [W, H] = meta.cell;
  return [(f % meta.cols) * W, Math.floor(f / meta.cols) * H];
}

/** 동작 하나: 세로 방향, 가로 프레임 */
export function animSheet(root, id, anim, scale = 2) {
  const { meta, img } = charSheet(root, id);
  const a = meta.anims[anim];
  const [W, H] = meta.cell;
  const crop = meta.cell[0] > 96 ? 1 : 1;
  const left = 30;
  const top = 14;
  const out = new Img(left + a.frames * W * scale, top + meta.dirs.length * H * scale);
  out.fill(hex('#2c2f2a'));
  out.text(4, 3, `${id} ${anim} ${a.frames}f ${a.dur}s${a.loop ? ' loop' : ''}`, INK);
  meta.dirs.forEach((d, di) => {
    out.text(4, top + di * H * scale + 8, d, INK);
    for (let f = 0; f < a.frames; f++) {
      const [sx, sy] = frameAt(meta, a.start + di * a.frames + f);
      const dx = left + f * W * scale;
      const dy = top + di * H * scale;
      out.rect(dx, dy, W * scale, H * scale, (f + di) % 2 ? BG : BG2);
      // 앵커 표시
      const [ax, ay] = meta.anchor;
      for (let k = -3; k <= 3; k++) {
        out.set(dx + ax * scale + k, dy + ay * scale, hex('#7fd0ff'));
        out.set(dx + ax * scale, dy + ay * scale + k, hex('#7fd0ff'));
      }
      out.blit(img, sx, sy, W, H, dx, dy, scale);
    }
  });
  return out;
}

/** 캐릭터 한눈에: 모든 동작을 S 방향으로 + 방향별 idle */
export function overview(root, id, scale) {
  const { meta, img } = charSheet(root, id);
  scale = scale ?? (meta.cell[0] > 96 ? 1 : 2);
  const [W, H] = meta.cell;
  const names = Object.keys(meta.anims);
  const maxF = Math.max(...names.map((n) => meta.anims[n].frames));
  const left = 54;
  const top = 14;
  const rowDir = [...meta.dirs];
  const colsW = Math.max(maxF, rowDir.length);
  const out = new Img(left + colsW * W * scale, top + (names.length + 1) * H * scale);
  out.fill(hex('#2c2f2a'));
  out.text(4, 3, id, INK);
  names.forEach((n, r) => {
    const a = meta.anims[n];
    out.text(4, top + r * H * scale + 8, n, INK);
    for (let f = 0; f < a.frames; f++) {
      const [sx, sy] = frameAt(meta, a.start + f);
      const dx = left + f * W * scale;
      const dy = top + r * H * scale;
      out.rect(dx, dy, W * scale, H * scale, (f + r) % 2 ? BG : BG2);
      out.blit(img, sx, sy, W, H, dx, dy, scale);
    }
  });
  const r = names.length;
  out.text(4, top + r * H * scale + 8, 'dirs', INK);
  const first = meta.anims[names[0]];
  rowDir.forEach((d, di) => {
    const [sx, sy] = frameAt(meta, first.start + di * first.frames);
    const dx = left + di * W * scale;
    const dy = top + r * H * scale;
    out.rect(dx, dy, W * scale, H * scale, (di + r) % 2 ? BG : BG2);
    out.blit(img, sx, sy, W, H, dx, dy, scale);
    out.text(dx + 3, dy + 3, d, INK);
  });
  return out;
}

export async function makePreviews(root, args = []) {
  const P = join(root, 'docs/art-preview');
  const dir = join(root, 'client/public/art/chars');
  if (existsSync(dir)) {
    const ids = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    const groups = new Set(['chars', 'players', 'npcs', 'monsters', 'bosses', 'preview']);
    const only = args.length && !args.some((a) => groups.has(a)) ? new Set(args) : null;
    for (const id of ids) {
      if (only && !only.has(id)) continue;
      overview(root, id).save(join(P, 'chars', id + '.png'));
      const { meta } = charSheet(root, id);
      const scale = meta.cell[0] > 96 ? 1 : 2;
      for (const anim of Object.keys(meta.anims)) animSheet(root, id, anim, scale).save(join(P, 'chars', id, anim + '.png'));
    }
  }
  const { previewWorld } = await import('./preview-world.mjs').catch(() => ({}));
  if (previewWorld) await previewWorld(root);
}
