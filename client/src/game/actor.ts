// 화면에 움직이는 인물: 8방향 시트에서 프레임을 골라 그린다
import * as Phaser from 'phaser';
import { toX, toY } from '@shared/core';
import { sheets, type AnimInfo, type SheetInfo } from './assets';

export const DEPTH = {
  GROUND: -1_000_000,
  WATER: -900_000,
  DECAL: -800_000,
  SHADOW: -700_000,
  TELEGRAPH: -600_000,
  DARK: 500_000,
  LIGHT: 510_000,
  FX: 520_000,
  TEXT: 600_000,
};

const MIRROR_MAP: [number, boolean][] = [
  [0, false],
  [1, false],
  [2, false],
  [3, false],
  [4, false],
  [3, true],
  [2, true],
  [1, true],
];

export class Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  sheet: SheetInfo | undefined;
  label?: Phaser.GameObjects.Text;
  mark?: Phaser.GameObjects.Text;
  bubble?: { obj: Phaser.GameObjects.Text; until: number };
  u = 0;
  v = 0;
  tu = 0;
  tv = 0;
  /** 공중으로 뜬 높이 (px) */
  lift = 0;
  dir = 0;
  animName = 'idle';
  animInfo: AnimInfo | undefined;
  t = 0;
  dur = 1;
  /** 비반복 동작이 끝나면 이 동작으로 돌아간다. 없으면 마지막 프레임 유지 */
  next?: string;
  frozen = 0;
  flashUntil = 0;
  scale = 1;
  fading = 1;
  seq = -1;
  actPending = false;
  labelColor = '';
  hold = false;
  ghostT = 0;

  constructor(
    public scene: Phaser.Scene,
    public sheetId: string,
    u: number,
    v: number,
    scale = 1,
  ) {
    this.sheet = sheets[sheetId];
    this.u = this.tu = u;
    this.v = this.tv = v;
    this.scale = scale;
    const key = this.sheet ? sheetId : 'placeholder';
    this.sprite = scene.add.sprite(0, 0, key, 0);
    if (this.sheet) this.sprite.setOrigin(this.sheet.anchor[0] / this.sheet.cell[0], this.sheet.anchor[1] / this.sheet.cell[1]);
    else this.sprite.setOrigin(0.5, 0.95);
    this.sprite.setScale(scale);
    const size = this.sheet && this.sheet.cell[0] > 100 ? 2.6 : 1;
    this.shadow = scene.add.image(0, 0, 'shadow').setDepth(DEPTH.SHADOW).setScale(size * scale * 0.9);
    this.setAnim('idle', { restart: true });
    this.place();
  }

  has(name: string) {
    return !!this.sheet?.anims[name];
  }

  setAnim(name: string, o: { restart?: boolean; dur?: number; next?: string; hold?: boolean } = {}) {
    if (!this.sheet) return;
    let info = this.sheet.anims[name];
    if (!info) {
      // 시트에 없는 동작은 비슷한 것으로 대신한다
      const alt = name.startsWith('attack') ? 'attack' : name === 'spin' || name === 'cast' ? (this.sheet.anims.attack ? 'attack' : 'idle') : name === 'guard' || name === 'dodge' ? 'idle' : 'idle';
      info = this.sheet.anims[alt];
      if (!info) return;
      name = alt;
    }
    if (this.animName === name && !o.restart) return;
    this.animName = name;
    this.animInfo = info;
    this.t = 0;
    this.dur = o.dur ?? info.dur;
    this.next = o.next;
    this.hold = !!o.hold;
  }

  frameIndex(): number {
    const info = this.animInfo;
    const sh = this.sheet;
    if (!info || !sh) return 0;
    let p = this.t / this.dur;
    if (info.loop) p = p % 1;
    else p = Math.min(p, 0.999);
    const f = Math.min(info.frames - 1, Math.floor(p * info.frames));
    const d = sh.mirror ? MIRROR_MAP[this.dir][0] : this.dir;
    return info.start + d * info.frames + f;
  }

  update(dt: number) {
    if (!this.sheet) {
      this.place();
      return;
    }
    if (this.frozen > 0) this.frozen -= dt;
    else this.t += dt;
    const info = this.animInfo;
    if (info && !info.loop && this.t >= this.dur && this.next) {
      const n = this.next;
      this.next = undefined;
      this.setAnim(n, { restart: true });
    }
    this.sprite.setFrame(this.frameIndex());
    if (this.sheet.mirror) this.sprite.setFlipX(MIRROR_MAP[this.dir][1]);
    if (this.flashUntil && performance.now() > this.flashUntil) {
      this.flashUntil = 0;
      this.sprite.clearTint();
    }
    this.place();
  }

  place() {
    const x = toX(this.u, this.v);
    const y = toY(this.u, this.v);
    this.sprite.setPosition(Math.round(x), Math.round(y - this.lift));
    this.sprite.setDepth(y);
    this.shadow.setPosition(Math.round(x), Math.round(y));
    const shadowFade = 1 - Math.min(0.7, this.lift / 60);
    this.shadow.setAlpha(shadowFade * Math.max(0, this.fading));
    const top = this.topY();
    if (this.label) this.label.setPosition(Math.round(x), Math.round(y - this.lift - top - 2));
    if (this.mark) this.mark.setPosition(Math.round(x), Math.round(y - this.lift - top - 16));
    if (this.bubble) {
      this.bubble.obj.setPosition(Math.round(x), Math.round(y - this.lift - top - 14));
      if (performance.now() > this.bubble.until) {
        this.bubble.obj.destroy();
        this.bubble = undefined;
      }
    }
  }

  /** 앵커에서 머리 꼭대기까지 대략의 높이 */
  topY(): number {
    if (!this.sheet) return 44;
    return this.sheet.cell[0] > 100 ? 128 * this.scale : 56 * this.scale;
  }

  screenX() {
    return toX(this.u, this.v);
  }

  screenY() {
    return toY(this.u, this.v);
  }

  flash(ms = 70, color = 0xffffff) {
    this.sprite.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.flashUntil = performance.now() + ms;
  }

  setLabel(text: string, color = '#f4efe2') {
    if (!this.label) {
      this.label = this.scene.add
        .text(0, 0, text, { fontFamily: 'Galmuri11', fontSize: '11px', color, stroke: '#0b0a12', strokeThickness: 2 })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.TEXT)
        .setResolution(1);
    } else if (this.label.text !== text) {
      this.label.setText(text);
    }
    // 글자 색을 바꾸면 그림을 다시 그리므로 바뀔 때만 부른다
    if (this.labelColor !== color) {
      this.labelColor = color;
      this.label.setColor(color);
    }
  }

  setMark(text: string) {
    if (!text) {
      this.mark?.setVisible(false);
      return;
    }
    if (!this.mark) {
      this.mark = this.scene.add
        .text(0, 0, text, { fontFamily: 'Galmuri11', fontSize: '16px', color: '#ffd54a', stroke: '#0b0a12', strokeThickness: 3, fontStyle: 'bold' })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.TEXT);
    }
    this.mark.setText(text).setVisible(true);
    this.mark.setColor(text === '?' ? '#7ee08a' : '#ffd54a');
  }

  say(text: string, ms = 3600) {
    if (this.bubble) this.bubble.obj.destroy();
    const obj = this.scene.add
      .text(0, 0, text, {
        fontFamily: 'Galmuri11',
        fontSize: '11px',
        color: '#0b0a12',
        backgroundColor: '#f4efe2',
        padding: { x: 4, y: 3 },
        wordWrap: { width: 150, useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.TEXT + 1);
    this.bubble = { obj, until: performance.now() + ms };
    this.place();
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.label?.destroy();
    this.mark?.destroy();
    this.bubble?.obj.destroy();
  }
}
