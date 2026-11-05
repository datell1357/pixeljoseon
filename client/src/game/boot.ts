// Phaser 게임 만들기와 장면 전환
import * as Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { MapData } from '@shared/mapdata';
import { assetsReady, loadProgress, settings } from '../store';
import { toX, toY } from '@shared/core';
import { DEPTH } from './actor';
import { loadDescriptors, makeFxTextures, preloadArt, propFrames, registerPropFrames } from './assets';
import { bakeGround } from './ground';
import { WorldScene } from './world';

let game: Phaser.Game | null = null;
let world: WorldScene | null = null;
let queue: { type: string; msg: unknown }[] = [];

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.load.on('progress', (v: number) => {
      loadProgress.value = v;
    });
    preloadArt(this);
  }

  async create() {
    makeFxTextures(this);
    registerPropFrames(this);
    try {
      await Promise.all([document.fonts.load('11px Galmuri11'), document.fonts.load('14px Galmuri14')]);
    } catch {
      // 글꼴을 못 읽어도 대체 글꼴로 돈다
    }
    assetsReady.value = true;
    this.scene.start('title');
  }
}

/** 시작 화면 뒤로 보이는 밤의 마을. 입력 없이 천천히 움직인다. */
class TitleScene extends Phaser.Scene {
  private keys: string[] = [];
  private lamps: { img: Phaser.GameObjects.Image; ph: number }[] = [];
  private dark?: Phaser.GameObjects.Rectangle;
  private built = false;

  constructor() {
    super('title');
  }

  async create() {
    this.cameras.main.setBackgroundColor('#0b0a12');
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fit, this);
      for (const k of this.keys) this.textures.remove(k);
      this.keys = [];
      this.lamps = [];
      this.dark = undefined;
      this.built = false;
    });
    this.scale.on('resize', this.fit, this);
    let map: MapData;
    try {
      map = (await (await fetch('/maps/town.json')).json()) as MapData;
    } catch {
      return;
    }
    if (!this.scene.isActive()) return;
    const { grounds } = bakeGround(this, map);
    this.keys = grounds.map((g) => g.key);
    if (this.textures.exists('props')) {
      for (const [id, u, v] of map.props) {
        const f = propFrames[id];
        if (!f) continue;
        const y = toY(u, v);
        this.add.image(Math.round(toX(u, v)), Math.round(y), 'props', id).setOrigin(f.ax / f.w, f.ay / f.h).setDepth(y);
      }
    }
    this.dark = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x4a4468).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.DARK).setBlendMode(Phaser.BlendModes.MULTIPLY);
    for (const o of map.objects) {
      if (o.type !== 'lantern') continue;
      const r = o.r ?? 5;
      const img = this.add
        .image(toX(o.u, o.v), toY(o.u, o.v) - 18, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffb86a)
        .setDepth(DEPTH.LIGHT)
        .setScale((r * 90) / 128, (r * 62) / 128);
      this.lamps.push({ img, ph: Math.random() * 10 });
    }
    this.built = true;
    this.cameras.main.fadeIn(900, 11, 10, 18);
  }

  private fit() {
    this.dark?.setSize(this.scale.width, this.scale.height);
  }

  update(time: number) {
    if (!this.built) return;
    const t = time * 0.001;
    // 광장 둘레를 천천히 맴돈다
    this.cameras.main.centerOn(Math.round(toX(30, 30) + Math.sin(t * 0.07) * 150), Math.round(toY(30, 30) - 30 + Math.cos(t * 0.05) * 70));
    for (const l of this.lamps) l.img.setAlpha(0.55 + Math.sin(t * 3 + l.ph) * 0.05 + Math.sin(t * 7.3 + l.ph * 2) * 0.03);
  }
}

/** 화면 픽셀 하나를 몇 칸으로 키울지. 세로 540칸 안팎이 보이도록 고른다. */
export function pixelScale(): number {
  const z = settings.value.zoom;
  if (z > 0) return z;
  return Math.max(1, Math.min(4, Math.round(window.innerHeight / 540)));
}

export function applyScale() {
  if (!game) return;
  const s = logicalSize();
  game.scale.setZoom(s.k);
  game.scale.resize(s.w, s.h);
}

function logicalSize() {
  const k = pixelScale();
  return { w: Math.ceil(window.innerWidth / k), h: Math.ceil(window.innerHeight / k), k };
}

export async function createGame() {
  await loadDescriptors();
  const { w, h, k } = logicalSize();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0b0a12',
    pixelArt: true,
    roundPixels: true,
    width: w,
    height: h,
    scale: { mode: Phaser.Scale.NONE, zoom: k },
    input: { mouse: { preventDefaultWheel: false } },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, TitleScene, WorldScene],
  });
  window.addEventListener('resize', applyScale);
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}

export function startWorld(room: Room, map: MapData) {
  if (!game) return;
  if (game.scene.isActive('title')) game.scene.stop('title');
  if (game.scene.isActive('world') || game.scene.isPaused('world')) game.scene.stop('world');
  // 장면이 준비될 때까지 들어온 메시지는 같은 배열에 쌓였다가 create에서 처리된다
  game.scene.start('world', { room, map, queue });
  world = game.scene.getScene('world') as WorldScene;
}

export function stopWorld() {
  world = null;
  queue = [];
  if (game?.scene.isActive('world')) game.scene.stop('world');
}

/** 게임에서 나와 시작·캐릭터 화면으로 돌아갈 때 배경을 다시 튼다 */
export function showTitleScene() {
  if (game && assetsReady.value && !game.scene.isActive('title') && !game.scene.isActive('world')) game.scene.start('title');
}

export function worldEvent(type: string, msg: unknown) {
  if (world?.ready) world.onNet(type, msg);
  else queue.push({ type, msg });
}

export const worldScene = () => (world?.ready ? world : null);
