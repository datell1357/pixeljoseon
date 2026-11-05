// 전투 연출: 입자, 베기 궤적, 경고 표시, 탄환, 숫자
import * as Phaser from 'phaser';
import { PX_U, PX_V, toX, toY } from '@shared/core';
import { DEPTH } from './actor';

const ADD = Phaser.BlendModes.ADD;
const RATIO = PX_V / PX_U;

interface Part {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  t: number;
  life: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  spin: number;
  sx?: number;
}

interface Num {
  txt: Phaser.GameObjects.Text;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  big: boolean;
}

export interface Warn {
  shape: string;
  u: number;
  v: number;
  du?: number;
  dv?: number;
  r: number;
  inner?: number;
  arc?: number;
  width?: number;
  t: number;
  age: number;
  m?: string;
  friendly?: boolean;
  soft?: boolean;
  fade: number;
}

export interface ProjView {
  id: number;
  kind: string;
  u: number;
  v: number;
  du: number;
  dv: number;
  speed: number;
  left: number;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  trail: number;
  color: number;
  friendly: boolean;
}

const PROJ_STYLE: Record<string, { tex: string; color: number; scale: number; glow: number; glowColor: number; trail: number }> = {
  arrow: { tex: 'arrow', color: 0xffffff, scale: 0.8, glow: 0.18, glowColor: 0xffe8b0, trail: 0 },
  arrow_big: { tex: 'arrow', color: 0xfff0a8, scale: 1.25, glow: 0.42, glowColor: 0xffd76a, trail: 0xffd76a },
  orb: { tex: 'orb', color: 0xffd98a, scale: 0.55, glow: 0.42, glowColor: 0xffaa44, trail: 0xffb65c },
  orb_big: { tex: 'orb', color: 0xfff0c0, scale: 0.85, glow: 0.7, glowColor: 0xff9a3c, trail: 0xffb65c },
  fireball: { tex: 'orb', color: 0xfff0c0, scale: 1, glow: 0.95, glowColor: 0xff6a22, trail: 0xff7a2c },
  wisp: { tex: 'orb', color: 0xcaff9a, scale: 0.6, glow: 0.5, glowColor: 0x6bdc5a, trail: 0x7ee06a },
  chain: { tex: 'orb', color: 0xbcd8ff, scale: 0.65, glow: 0.55, glowColor: 0x4a86ff, trail: 0x6aa0ff },
};

const BLAST_COLORS: Record<string, { core: number; mid: number; dark: number; n: number; ring?: boolean }> = {
  fire: { core: 0xfff2c0, mid: 0xff8a2c, dark: 0x7a2410, n: 36, ring: true },
  ember: { core: 0xffe2a0, mid: 0xff6a22, dark: 0x4a1a10, n: 22, ring: true },
  ice: { core: 0xeaffff, mid: 0x8fd8ff, dark: 0x2a6ac0, n: 34, ring: true },
  gold: { core: 0xfff8d8, mid: 0xffd25a, dark: 0xa86a18, n: 44, ring: true },
  star: { core: 0xffffff, mid: 0xbfa8ff, dark: 0x4a32b0, n: 18, ring: true },
  arrow: { core: 0xfff0c0, mid: 0xffd27a, dark: 0x6a4a20, n: 10 },
  arcane: { core: 0xfff4d8, mid: 0xffb65c, dark: 0x8a3c10, n: 18, ring: true },
  dark: { core: 0xffd0c0, mid: 0xc04a3a, dark: 0x2a1014, n: 22, ring: true },
  root: { core: 0xe6ffb0, mid: 0x7fbf4a, dark: 0x2a3a14, n: 22, ring: true },
  ring: { core: 0xffd0d8, mid: 0xc0306a, dark: 0x2a0a20, n: 44, ring: true },
  summon: { core: 0xe0d0ff, mid: 0x7a5aff, dark: 0x201040, n: 14 },
  trap: { core: 0xf8ffb0, mid: 0xc0d84a, dark: 0x3a4410, n: 18, ring: true },
};

export class Fx {
  parts: Part[] = [];
  pool: Phaser.GameObjects.Image[] = [];
  nums: Num[] = [];
  numPool: Phaser.GameObjects.Text[] = [];
  warns: Warn[] = [];
  warnG: Phaser.GameObjects.Graphics;
  projs = new Map<number, ProjView>();
  patches = new Map<number, { imgs: Phaser.GameObjects.Image[]; until: number; u: number; v: number; r: number; next: number }>();
  traps = new Map<number, { img: Phaser.GameObjects.Image; u: number; v: number; r: number }>();
  /** 카메라 흔들림 세기 */
  shake = 0;

  constructor(public scene: Phaser.Scene) {
    // 어둠 층 위에 그려야 어두운 던전에서도 경고가 또렷하다
    this.warnG = scene.add.graphics().setDepth(DEPTH.DARK + 1);
  }

  private img(tex: string): Phaser.GameObjects.Image {
    const i = this.pool.pop();
    if (i) {
      i.setTexture(tex).setVisible(true).setAlpha(1).setRotation(0).setScale(1);
      i.clearTint();
      return i;
    }
    return this.scene.add.image(0, 0, tex);
  }

  private free(i: Phaser.GameObjects.Image) {
    i.setVisible(false);
    if (this.pool.length < 400) this.pool.push(i);
    else i.destroy();
  }

  part(o: {
    tex?: string;
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    g?: number;
    drag?: number;
    life: number;
    s0?: number;
    s1?: number;
    a0?: number;
    a1?: number;
    color?: number;
    add?: boolean;
    rot?: number;
    spin?: number;
    depth?: number;
    sx?: number;
  }) {
    if (this.parts.length > 700) return;
    const img = this.img(o.tex ?? 'soft');
    img.setBlendMode(o.add === false ? Phaser.BlendModes.NORMAL : ADD);
    if (o.color !== undefined) img.setTint(o.color);
    img.setRotation(o.rot ?? 0);
    img.setDepth(o.depth ?? DEPTH.FX);
    img.setPosition(o.x, o.y);
    this.parts.push({
      img,
      x: o.x,
      y: o.y,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      g: o.g ?? 0,
      drag: o.drag ?? 0,
      t: 0,
      life: o.life,
      s0: o.s0 ?? 1,
      s1: o.s1 ?? 0,
      a0: o.a0 ?? 1,
      a1: o.a1 ?? 0,
      spin: o.spin ?? 0,
      sx: o.sx,
    });
  }

  burst(u: number, v: number, n: number, colors: number[], speed = 60, lift = 10, size = 0.3) {
    const x = toX(u, v);
    const y = toY(u, v) - lift;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random());
      this.part({
        tex: 'px',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.55 - 26,
        g: 130,
        drag: 2,
        life: 0.3 + Math.random() * 0.4,
        s0: size + Math.random() * size * 1.6,
        s1: 0.05,
        color: colors[i % colors.length],
      });
    }
  }

  /** 땅 위 타원 고리 */
  groundRing(u: number, v: number, r: number, color: number, life = 0.35, width = 1) {
    const x = toX(u, v);
    const y = toY(u, v);
    const px = (r * PX_U * 2) / 96;
    const img = this.img('ring');
    img.setBlendMode(ADD).setTint(color).setDepth(DEPTH.DARK + 2).setPosition(x, y);
    this.parts.push({ img, x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life, s0: px * 0.3, s1: px, a0: 0.95 * width, a1: 0, spin: 0, sx: RATIO });
  }

  glowAt(u: number, v: number, r: number, color: number, life = 0.25, lift = 6) {
    const x = toX(u, v);
    const y = toY(u, v) - lift;
    this.part({ tex: 'glow', x, y, life, s0: (r * 80) / 128, s1: (r * 120) / 128, a0: 0.9, a1: 0, color, depth: DEPTH.LIGHT + 1 });
  }

  blast(u: number, v: number, r: number, col: string, inner?: number) {
    const c = BLAST_COLORS[col] ?? BLAST_COLORS.dark;
    this.glowAt(u, v, r * 1.1, c.mid, 0.34);
    if (c.ring) {
      this.groundRing(u, v, r, c.core, 0.34);
      if (inner) this.groundRing(u, v, inner, c.core, 0.34);
    }
    const x = toX(u, v);
    const y = toY(u, v);
    for (let i = 0; i < c.n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = inner ? inner + Math.random() * (r - inner) : Math.random() * r * 0.8;
      const px = x + Math.cos(a) * rr * PX_U;
      const py = y + Math.sin(a) * rr * PX_V;
      const up = 30 + Math.random() * 80;
      this.part({
        tex: 'px',
        x: px,
        y: py - 4,
        vx: Math.cos(a) * 30 * Math.random(),
        vy: -up,
        g: 170,
        drag: 1,
        life: 0.35 + Math.random() * 0.4,
        s0: 0.5 + Math.random() * 1.1,
        s1: 0.05,
        color: [c.core, c.mid, c.mid, c.dark][i % 4],
      });
    }
    // 연기
    for (let i = 0; i < Math.min(8, c.n / 3); i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * r * 0.7;
      this.part({
        tex: 'soft',
        x: x + Math.cos(a) * rr * PX_U,
        y: y + Math.sin(a) * rr * PX_V - 6,
        vy: -14 - Math.random() * 14,
        life: 0.5 + Math.random() * 0.4,
        s0: 0.7,
        s1: 1.8,
        a0: 0.3,
        a1: 0,
        color: c.dark,
        add: false,
        depth: toY(u, v) + 2,
      });
    }
  }

  /** 근접 베기 궤적 */
  slash(u: number, v: number, aim: [number, number], reach: number, color: number, flip: boolean, big = false) {
    const x = toX(u + aim[0] * reach * 0.42, v + aim[1] * reach * 0.42);
    const y = toY(u + aim[0] * reach * 0.42, v + aim[1] * reach * 0.42) - 16;
    const sx = aim[0] * PX_U;
    const sy = aim[1] * PX_V;
    const rot = Math.atan2(sy, sx);
    const s = ((reach * PX_U) / 64) * (big ? 1.3 : 1);
    const img = this.img('slash');
    img.setBlendMode(ADD).setTint(color).setRotation(rot).setDepth(DEPTH.FX).setPosition(x, y).setFlipY(flip);
    this.parts.push({ img, x, y, vx: Math.cos(rot) * 34, vy: Math.sin(rot) * 34, g: 0, drag: 4, t: 0, life: big ? 0.22 : 0.16, s0: s * 0.72, s1: s * 1.06, a0: 1, a1: 0, spin: 0 });
    for (let i = 0; i < (big ? 12 : 6); i++) {
      const a = rot + (Math.random() - 0.5) * 1.6;
      const sp = 60 + Math.random() * 90;
      this.part({
        tex: 'px',
        x: x + Math.cos(a) * 10,
        y: y + Math.sin(a) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.6,
        drag: 4,
        life: 0.14 + Math.random() * 0.14,
        s0: 0.6,
        s1: 0.1,
        color,
      });
    }
  }

  /** 회오리 등 도는 궤적 */
  whirl(u: number, v: number, r: number, color: number) {
    const x = toX(u, v);
    const y = toY(u, v) - 12;
    for (let i = 0; i < 2; i++) {
      const img = this.img('slash');
      const s = (r * PX_U) / 56;
      img.setBlendMode(ADD).setTint(color).setDepth(DEPTH.FX).setPosition(x, y).setRotation((i * Math.PI) as number);
      this.parts.push({ img, x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: 0.34, s0: s * 0.78, s1: s * 1.05, a0: 0.62, a1: 0, spin: 13, sx: RATIO });
    }
    this.groundRing(u, v, r, color, 0.4);
  }

  number(u: number, v: number, val: string, color: string, big = false, lift = 26) {
    const x = toX(u, v) + (Math.random() - 0.5) * 14;
    const y = toY(u, v) - lift;
    let txt = this.numPool.pop();
    if (!txt) {
      txt = this.scene.add
        .text(0, 0, '', { fontFamily: 'Galmuri11', fontSize: '11px', stroke: '#14101a', strokeThickness: 3, color: '#fff' })
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH.TEXT - 1);
    }
    txt.setFontSize(big ? 15 : 11);
    txt.setColor(color).setText(val).setVisible(true).setAlpha(1).setPosition(x, y).setScale(big ? 1.5 : 1.2);
    this.nums.push({ txt, x, y, vx: (Math.random() - 0.5) * 22, vy: big ? -62 : -46, t: 0, life: big ? 0.85 : 0.62, big });
  }

  addWarn(w: Omit<Warn, 'age' | 'fade'>) {
    this.warns.push({ ...w, age: 0, fade: 0 });
  }

  cancelWarn(mid: string) {
    this.warns = this.warns.filter((w) => w.m !== mid);
  }

  private shapePoints(w: Warn, r: number): Phaser.Math.Vector2[] {
    const pts: Phaser.Math.Vector2[] = [];
    const P = (a: number, b: number) => new Phaser.Math.Vector2(toX(a, b), toY(a, b));
    if (w.shape === 'cone') {
      const base = Math.atan2(w.dv ?? 0, w.du ?? 1);
      const half = (((w.arc ?? 90) / 2) * Math.PI) / 180;
      pts.push(P(w.u, w.v));
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const a = base - half + (2 * half * i) / n;
        pts.push(P(w.u + Math.cos(a) * r, w.v + Math.sin(a) * r));
      }
    } else if (w.shape === 'line') {
      const du = w.du ?? 1;
      const dv = w.dv ?? 0;
      const h = (w.width ?? 1) / 2;
      const nu = -dv * h;
      const nv = du * h;
      pts.push(P(w.u + nu, w.v + nv), P(w.u + du * r + nu, w.v + dv * r + nv), P(w.u + du * r - nu, w.v + dv * r - nv), P(w.u - nu, w.v - nv));
    } else {
      const n = 40;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(P(w.u + Math.cos(a) * r, w.v + Math.sin(a) * r));
      }
    }
    return pts;
  }

  private drawWarns(dt: number) {
    const g = this.warnG;
    g.clear();
    const keep: Warn[] = [];
    for (const w of this.warns) {
      w.age += dt;
      const p = Math.min(1, w.age / w.t);
      if (w.age > w.t + 0.12) continue;
      keep.push(w);
      const color = w.friendly ? 0xffcf6a : 0xff3b30;
      const pulse = 0.5 + 0.5 * Math.sin(w.age * 22);
      const endFade = w.age > w.t ? 1 - (w.age - w.t) / 0.12 : 1;
      if (w.shape === 'ring') {
        // 도넛: 바깥과 안쪽 원으로 그린다
        const outer = this.shapePoints(w, w.r);
        const inner = this.shapePoints(w, w.inner ?? 0).reverse();
        g.fillStyle(color, (0.14 + 0.16 * p) * endFade);
        for (let i = 0; i < outer.length; i++) {
          const j = (i + 1) % outer.length;
          const ii = outer.length - 1 - i;
          const jj = (ii - 1 + outer.length) % outer.length;
          g.fillTriangle(outer[i].x, outer[i].y, outer[j].x, outer[j].y, inner[ii].x, inner[ii].y);
          g.fillTriangle(outer[j].x, outer[j].y, inner[jj].x, inner[jj].y, inner[ii].x, inner[ii].y);
        }
        g.lineStyle(1, color, 0.9 * endFade);
        g.strokePoints(outer, true, true);
        g.lineStyle(1, 0xffffff, (0.5 + 0.4 * pulse) * endFade);
        g.strokePoints(inner, true, true);
        continue;
      }
      const pts = this.shapePoints(w, w.r);
      if (!w.soft) {
        g.fillStyle(color, 0.12 * endFade);
        g.fillPoints(pts, true);
        // 안쪽이 차오르며 터질 때를 알려 준다
        const grow = w.shape === 'line' ? w.r * p : w.r * p;
        const inner = this.shapePoints(w, Math.max(0.02, grow));
        g.fillStyle(color, (0.14 + 0.18 * p) * endFade);
        g.fillPoints(inner, true);
      }
      g.lineStyle(1, w.friendly ? 0xffe9a8 : p > 0.7 ? 0xffffff : 0xff7a6a, (w.soft ? 0.45 : 0.75 + 0.25 * pulse) * endFade);
      g.strokePoints(pts, true, true);
    }
    this.warns = keep;
  }

  addProj(m: { id: number; kind: string; u: number; v: number; du: number; dv: number; speed: number; range: number; friendly: boolean }) {
    const st = PROJ_STYLE[m.kind] ?? PROJ_STYLE.orb;
    const img = this.img(st.tex);
    img.setBlendMode(st.tex === 'arrow' ? Phaser.BlendModes.NORMAL : ADD);
    img.setTint(st.color).setScale(st.scale).setDepth(DEPTH.FX);
    img.setRotation(Math.atan2(m.dv * PX_V, m.du * PX_U));
    const glow = this.img('glow');
    glow.setBlendMode(ADD).setTint(st.glowColor).setScale(st.glow).setAlpha(0.75).setDepth(DEPTH.LIGHT);
    this.projs.set(m.id, { id: m.id, kind: m.kind, u: m.u, v: m.v, du: m.du, dv: m.dv, speed: m.speed, left: m.range, img, glow, trail: st.trail, color: st.glowColor, friendly: m.friendly });
    this.moveProj(this.projs.get(m.id)!, 0);
  }

  endProj(id: number, u: number, v: number) {
    const p = this.projs.get(id);
    if (!p) return;
    this.free(p.img);
    this.free(p.glow);
    this.projs.delete(id);
    this.burst(u, v, 6, [p.color, 0xffffff], 50, 14, 0.25);
  }

  private moveProj(p: ProjView, dt: number) {
    p.u += p.du * p.speed * dt;
    p.v += p.dv * p.speed * dt;
    p.left -= p.speed * dt;
    const x = toX(p.u, p.v);
    const y = toY(p.u, p.v) - 18;
    p.img.setPosition(x, y);
    p.glow.setPosition(x, y);
    if (p.trail && dt > 0) {
      this.part({ tex: 'soft', x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, life: 0.22, s0: 0.4, s1: 0.05, a0: 0.8, color: p.trail });
    }
  }

  addPatch(id: number, u: number, v: number, r: number, ttl: number) {
    const img = this.img('glow');
    img.setBlendMode(ADD).setTint(0xff5a22).setAlpha(0.55).setDepth(DEPTH.DARK + 1);
    img.setPosition(toX(u, v), toY(u, v));
    img.setScale((r * PX_U * 2.04) / 128, (r * PX_V * 2.04) / 128);
    this.patches.set(id, { imgs: [img], until: performance.now() + ttl * 1000, u, v, r, next: 0 });
  }

  addTrap(id: number, u: number, v: number, r: number) {
    const img = this.img('cross');
    img.setBlendMode(ADD).setTint(0xd8ff7a).setDepth(DEPTH.DARK + 1);
    img.setPosition(toX(u, v), toY(u, v)).setScale(0.8, 0.8 * RATIO);
    this.traps.set(id, { img, u, v, r });
    this.groundRing(u, v, r * 0.7, 0xd8ff7a, 0.5);
  }

  removeTrap(id: number) {
    const t = this.traps.get(id);
    if (!t) return;
    this.free(t.img);
    this.traps.delete(id);
  }

  update(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        p.img.setBlendMode(ADD);
        p.img.setFlipY(false);
        this.free(p.img);
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const s = p.s0 + (p.s1 - p.s0) * k;
      p.img.setPosition(p.x, p.y);
      if (p.sx !== undefined) p.img.setScale(s, s * p.sx);
      else p.img.setScale(s);
      p.img.setAlpha(p.a0 + (p.a1 - p.a0) * k);
      if (p.spin) p.img.rotation += p.spin * dt;
    }
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      const k = n.t / n.life;
      if (k >= 1) {
        n.txt.setVisible(false);
        this.numPool.push(n.txt);
        this.nums[i] = this.nums[this.nums.length - 1];
        this.nums.pop();
        continue;
      }
      n.vy += 90 * dt;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.txt.setPosition(Math.round(n.x), Math.round(n.y));
      n.txt.setAlpha(k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1);
      const pop = n.big ? 1.5 : 1.2;
      n.txt.setScale(k < 0.15 ? pop - (pop - 1) * (k / 0.15) : 1);
    }
    for (const p of this.projs.values()) {
      this.moveProj(p, dt);
      if (p.left < -1.5) this.endProj(p.id, p.u, p.v);
    }
    const now = performance.now();
    for (const [id, pa] of this.patches) {
      if (now > pa.until) {
        for (const i of pa.imgs) this.free(i);
        this.patches.delete(id);
        continue;
      }
      pa.imgs[0].setAlpha(0.42 + Math.sin(now * 0.01) * 0.12);
      if (now > pa.next) {
        pa.next = now + 90;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * pa.r;
        this.part({
          tex: 'px',
          x: toX(pa.u, pa.v) + Math.cos(a) * rr * PX_U,
          y: toY(pa.u, pa.v) + Math.sin(a) * rr * PX_V,
          vy: -30 - Math.random() * 30,
          life: 0.5,
          s0: 0.6,
          s1: 0.1,
          color: Math.random() < 0.5 ? 0xff8a2c : 0xffd25a,
        });
      }
    }
    this.drawWarns(dt);
  }

  destroy() {
    this.warnG.destroy();
    for (const p of this.parts) p.img.destroy();
    for (const i of this.pool) i.destroy();
    for (const n of this.nums) n.txt.destroy();
    for (const t of this.numPool) t.destroy();
    for (const p of this.projs.values()) {
      p.img.destroy();
      p.glow.destroy();
    }
    for (const pa of this.patches.values()) for (const i of pa.imgs) i.destroy();
    for (const t of this.traps.values()) t.img.destroy();
  }
}
