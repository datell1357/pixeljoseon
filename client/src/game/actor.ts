// 화면에 움직이는 인물: 3D 모델을 움직이고, 이름표와 말풍선은 위층에 그린다
import * as Phaser from 'phaser';
import { DIR_VEC, PX_H, PX_U, PX_V, toX, toY } from '@shared/core';
import { ActorView } from '../render3d/actor3d';
import type { Stage3D } from '../render3d/stage';
import { getStage } from './boot';

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

export interface AnimInfo {
  frames: number;
  dur: number;
  loop?: boolean;
}

export class Actor {
  stage: Stage3D;
  view: ActorView;
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
  private lastDir = -1;
  heading = 0;
  animName = 'idle';
  animInfo: AnimInfo | undefined;
  t = 0;
  dur = 1;
  /** 비반복 동작이 끝나면 이 동작으로 돌아간다. 없으면 마지막 프레임 유지 */
  next?: string;
  frozen = 0;
  /** 맞고 살짝 밀려나는 그림 위치(서버 위치는 그대로) */
  kickU = 0;
  kickV = 0;
  flashUntil = 0;
  scale = 1;
  fading = 1;
  alpha = 1;
  seq = -1;
  actPending = false;
  labelColor = '';
  hold = false;
  ghostT = 0;
  private dtLast = 0;

  constructor(
    public scene: Phaser.Scene,
    public sheetId: string,
    u: number,
    v: number,
    scale = 1,
  ) {
    this.stage = getStage();
    this.view = new ActorView(sheetId, this.stage.actors);
    this.u = this.tu = u;
    this.v = this.tv = v;
    this.scale = scale;
    this.setAnim('idle', { restart: true });
    this.place(0);
  }

  has(name: string) {
    return !!this.view.asset.anims[name];
  }

  /** 입은 장비가 바뀌면 모델을 갈아 끼운다 */
  setSheet(id: string) {
    if (id === this.sheetId) return;
    this.sheetId = id;
    this.view.setSheet(id);
    const info = this.view.asset.anims[this.animName];
    if (info) this.animInfo = info;
  }

  setAnim(name: string, o: { restart?: boolean; dur?: number; next?: string; hold?: boolean } = {}) {
    const anims = this.view.asset.anims;
    let info = anims[name];
    if (!info) {
      // 없는 동작은 비슷한 것으로 대신한다
      const alt = name.startsWith('attack') ? 'attack' : name === 'spin' || name === 'cast' ? (anims.attack ? 'attack' : 'idle') : 'idle';
      info = anims[alt];
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

  /** 정확한 방향을 본다 (내 조준처럼 8방향보다 고운 곳) */
  faceTo(du: number, dv: number, dir: number) {
    this.dir = dir;
    this.lastDir = dir;
    if (du || dv) this.heading = Math.atan2(du, dv);
  }

  update(dt: number) {
    if (this.frozen > 0) this.frozen -= dt;
    else this.t += dt;
    if (this.kickU || this.kickV) {
      const k = Math.exp(-dt * 14);
      this.kickU = Math.abs(this.kickU * k) < 0.002 ? 0 : this.kickU * k;
      this.kickV = Math.abs(this.kickV * k) < 0.002 ? 0 : this.kickV * k;
    }
    const info = this.animInfo;
    if (info && !info.loop && this.t >= this.dur && this.next) {
      const n = this.next;
      this.next = undefined;
      this.setAnim(n, { restart: true });
    }
    if (this.flashUntil && performance.now() > this.flashUntil) {
      this.flashUntil = 0;
      this.view.setFlash(0, 0, 0, 0);
    }
    this.place(dt);
  }

  place(dt = this.dtLast) {
    this.dtLast = dt;
    if (this.dir !== this.lastDir) {
      this.lastDir = this.dir;
      const d = DIR_VEC[this.dir] ?? DIR_VEC[0];
      this.heading = Math.atan2(d[0], d[1]);
    }
    const x = toX(this.u + this.kickU, this.v + this.kickV);
    const y = toY(this.u + this.kickU, this.v + this.kickV);
    // 화면 픽셀에 맞춰 세워야 움직일 때 모델 표면이 떨리지 않는다
    const wx = Math.round(x) / PX_U;
    const wz = Math.round(y) / PX_V;
    const ground = this.stage.terrain?.groundAt(wx, wz) ?? 0;
    const wy = Math.round((ground + this.lift / PX_H) * PX_H) / PX_H;
    this.view.setAlpha(Math.max(0, Math.min(1, this.alpha)));
    this.view.update(dt, this.animName, this.t / this.dur, wx, wy, wz, this.heading, this.scale);
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

  /** 발에서 머리 꼭대기까지 대략의 높이(px) */
  topY(): number {
    return this.view.asset.height * this.view.asset.baseScale * this.scale * PX_H;
  }

  screenX() {
    return toX(this.u, this.v);
  }

  screenY() {
    return toY(this.u, this.v);
  }

  kick(du: number, dv: number, amt: number) {
    const l = Math.hypot(du, dv) || 1;
    this.kickU = (du / l) * amt;
    this.kickV = (dv / l) * amt;
  }

  flash(ms = 70, color = 0xffffff) {
    this.view.setFlash(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, 0.85);
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
    this.view.dispose();
    this.label?.destroy();
    this.mark?.destroy();
    this.bubble?.obj.destroy();
  }
}
