// Phaser 게임 만들기와 장면 전환
import * as Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { MapData } from '@shared/mapdata';
import { assetsReady, loadProgress, settings, toast } from '../store';
import { PX_U, PX_V } from '@shared/core';
import { Stage3D } from '../render3d/stage';
import { loadDescriptors, makeFxTextures, preloadArt, registerPropFrames } from './assets';
import { WorldScene } from './world';

let game: Phaser.Game | null = null;
let world: WorldScene | null = null;
let queue: { type: string; msg: unknown }[] = [];
let stage: Stage3D | null = null;

/** 3D 무대. 글자·효과는 Phaser가 투명한 위층에 그린다. */
export function getStage(): Stage3D {
  if (!stage) throw new Error('무대가 아직 없습니다');
  return stage;
}

export const stageOrNull = () => stage;

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

/** 시작 화면 뒤로 보이는 마을. 입력 없이 천천히 움직인다. */
class TitleScene extends Phaser.Scene {
  private dark?: Phaser.GameObjects.Rectangle;
  private built = false;

  constructor() {
    super('title');
  }

  async create() {
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fit, this);
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
    getStage().loadMap(map);
    getStage().setFocus(0, 0, 0, false);
    this.dark = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0b0a12, 0.28).setOrigin(0, 0).setScrollFactor(0);
    this.built = true;
    this.cameras.main.fadeIn(900, 11, 10, 18);
  }

  private fit() {
    this.dark?.setSize(this.scale.width, this.scale.height);
  }

  update(time: number, deltaMs: number) {
    if (!this.built) return;
    const t = time * 0.001;
    // 광장 둘레를 천천히 맴돈다
    const s = getStage();
    s.setView(Math.round((44 + Math.sin(t * 0.07) * 6) * PX_U), Math.round((27 + Math.cos(t * 0.05) * 3) * PX_V));
    s.render(Math.min(0.05, deltaMs / 1000));
  }
}

/**
 * 그림 한 칸을 화면 픽셀 몇 개로 키울지. 세로 540칸 안팎이 보이도록 고른다.
 * 레티나에서는 장치 픽셀의 정수배가 되도록 1.5배도 쓴다. 그래야 칸 크기가 고르다.
 */
export function pixelScale(): number {
  const z = settings.value.zoom;
  if (z > 0) return z;
  const dpr = window.devicePixelRatio || 1;
  const device = Math.max(1, Math.round((window.innerHeight * dpr) / 540));
  const k = device / dpr;
  // 720·768줄 모니터는 그대로 두면 인물이 너무 작게 보인다
  if (k < 1.25 && window.innerHeight >= 640) return 1.5;
  return Math.min(4, k);
}

export function applyScale() {
  if (!game) return;
  const s = logicalSize();
  game.scale.setZoom(s.k);
  game.scale.resize(s.w, s.h);
  stage?.setSize(s.w, s.h, s.k);
}

function logicalSize() {
  const k = pixelScale();
  return { w: Math.ceil(window.innerWidth / k), h: Math.ceil(window.innerHeight / k), k };
}

/** 설정에 맞춰 그래픽 수준을 정한다 */
export function applyGfx() {
  if (!stage) return;
  stage.setQuality(settings.value.gfx === 'low' ? 0 : 1);
}

export async function createGame() {
  await loadDescriptors();
  const { w, h, k } = logicalSize();
  const parent = document.getElementById('game')!;
  stage = new Stage3D(parent);
  stage.setSize(w, h, k);
  applyGfx();
  // 자동일 때만: 프레임이 계속 느리면 한 단계 낮춘다
  stage.onSlow = () => {
    if (settings.value.gfx !== 'auto') return;
    stage?.setQuality(0);
    toast('화면이 느려서 그래픽을 낮췄어요. 설정에서 바꿀 수 있어요.', 'info', 3200);
  };
  (window as unknown as { __stage?: Stage3D }).__stage = stage;
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    transparent: true,
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
  game.canvas.style.position = 'absolute';
  game.canvas.style.left = '0';
  game.canvas.style.top = '0';
  game.canvas.style.zIndex = '1';
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
