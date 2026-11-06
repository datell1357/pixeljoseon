// 지도 한 장의 화면: 지형·소품 그리기, 입력, 내 캐릭터 조작, 다른 사람과 몬스터 동기화
import * as Phaser from 'phaser';
import type * as THREE from 'three';
import type { Room } from '@colyseus/sdk';
import { CLASSES, SKILLS, type AttackStep, type ClassDef, type SkillDef } from '@shared/classes';
import { blocked, dirFromVec, dist, normalize, PX_H, PX_U, PX_V, slideMove, toUV, toX, toY } from '@shared/core';
import type { MapData, MapObject } from '@shared/mapdata';
import { pcSheet } from '@shared/items';
import { MONSTERS } from '@shared/monsters';
import { NPCS, QUEST_BY_ID, QUESTS, npcMark, questAvailable, questComplete } from '@shared/quests';
import { sfx } from '../audio';
import {
  boss,
  buffs,
  chatOpen,
  closeAll,
  cooldownLeft,
  floor,
  me,
  npcOpen,
  npcTab,
  prompt,
  settings,
  setCooldown,
  showBig,
  toast,
  togglePanel,
  vitals,
} from '../store';
import { Actor, DEPTH } from './actor';
import { getStage } from './boot';
import { Fx } from './fx';

const R = 0.22;
const SEND_HZ = 15;

type PState = 'idle' | 'walk' | 'attack' | 'cast' | 'dodge' | 'guard' | 'hit' | 'dead' | 'dash';

interface AttackRun {
  step: AttackStep;
  index: number;
  t: number;
  dur: number;
  aim: [number, number];
  lunged: number;
  struck: boolean;
}

interface LootView {
  img: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  x: number;
  y: number;
  t: number;
  from?: [number, number];
}

interface OtherView {
  a: Actor;
  overrideUntil: number;
  guard?: Phaser.GameObjects.Image;
}

/** 지도끼리 이어진 길 */
const ROADS: Record<string, string[]> = {
  town: ['woods', 'rift'],
  woods: ['town', 'hollow', 'ashfield'],
  hollow: ['woods'],
  ashfield: ['woods', 'furnace'],
  furnace: ['ashfield'],
  rift: ['town'],
};

/** target까지 가려면 지금 지도에서 어느 지도로 가야 하는지 */
function nextHop(from: string, target: string): string | null {
  if (from === target) return null;
  const prev = new Map<string, string>([[from, '']]);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    for (const n of ROADS[q[i]] ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, q[i]);
      q.push(n);
    }
  }
  if (!prev.has(target)) return null;
  let cur = target;
  while (prev.get(cur) !== from) cur = prev.get(cur)!;
  return cur;
}

/** 입력: 다른 곳(UI, 터치)에서도 값을 넣을 수 있다 */
export const input = {
  moveX: 0,
  moveY: 0,
  attack: false,
  guard: false,
  /** 터치 조준: 없으면 자동 조준 */
  aim: null as [number, number] | null,
  usedTouch: false,
};

export class WorldScene extends Phaser.Scene {
  room!: Room;
  map!: MapData;
  fx!: Fx;
  me!: Actor;
  cls!: ClassDef;
  sid = '';
  keys = new Set<string>();
  pState: PState = 'idle';
  stateT = 0;
  atk: AttackRun | null = null;
  comboIdx = 0;
  comboAt = 0;
  castEnd = 0;
  dodgeRun: { t: number; dur: number; from: [number, number]; to: [number, number]; kind: string; blinked: boolean } | null = null;
  dashRun: { t: number; dur: number; from: [number, number]; to: [number, number]; arc: number } | null = null;
  guardOn = false;
  guardAt = 0;
  dead = false;
  lastDir: [number, number] = [1, 0];
  sendT = 0;
  hudT = 0;
  doorT = 0;
  nearT = 0;
  others = new Map<string, OtherView>();
  mons = new Map<string, Actor>();
  loot = new Map<string, LootView>();
  npcs = new Map<string, { a: Actor; o: MapObject }>();
  dynProps = new Map<string, { mesh: THREE.Object3D; glow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; r: number; u: number; v: number; kind: string; used: number }>();
  doorViews: { o: MapObject; ring: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; t: Phaser.GameObjects.Text }[] = [];
  barG!: Phaser.GameObjects.Graphics;
  aura?: Phaser.GameObjects.Image;
  shieldImg?: Phaser.GameObjects.Image;
  camX = 0;
  camY = 0;
  hitstop = 0;
  bossId = '';
  bossSeen = new Set<string>();
  ambientT = 0;
  pending: { type: string; msg: any }[] = [];
  ready = false;
  autoAttack = false;
  pointerDown = false;
  rightDown = false;
  lastDoor = -99;
  nearNpc: string | null = null;
  nearWayT = 0;
  guideArrow?: Phaser.GameObjects.Image;
  guideText?: Phaser.GameObjects.Text;
  guideT = 0;
  guideTo: { u: number; v: number; label: string } | null = null;
  frameErrors = 0;
  lastCombat = -99999;
  private keyDown = (e: KeyboardEvent) => this.onKey(e, true);
  private keyUp = (e: KeyboardEvent) => this.onKey(e, false);
  private blur = () => {
    this.keys.clear();
    this.pointerDown = false;
    this.setGuard(false);
  };

  constructor() {
    super('world');
  }

  init(data: { room: Room; map: MapData; queue: { type: string; msg: any }[] }) {
    this.room = data.room;
    this.map = data.map;
    this.pending = data.queue;
    this.sid = data.room.sessionId;
    this.others = new Map();
    this.mons = new Map();
    this.loot = new Map();
    this.npcs = new Map();
    this.dynProps = new Map();
    this.doorViews = [];
    this.bossSeen = new Set();
    this.bossId = '';
    this.pState = 'idle';
    this.atk = null;
    this.dodgeRun = null;
    this.dashRun = null;
    this.guardOn = false;
    this.dead = false;
    this.ready = false;
    this.keys = new Set();
    // 장면 객체는 지도를 옮겨도 재사용된다. 파괴된 그림 참조를 남기지 않는다.
    this.guideArrow = undefined;
    this.guideText = undefined;
    this.guideTo = null;
    this.guideT = 0;
    this.shieldImg = undefined;
    this.aura = undefined;
    this.pointerDown = false;
    this.rightDown = false;
    this.hitstop = 0;
    this.lastDoor = -99;
    this.nearNpc = null;
    this.nearWayT = 0;
    this.comboIdx = 0;
    this.comboAt = 0;
    this.sendT = 0;
    this.hudT = 0;
    this.doorT = 0;
    this.nearT = 0;
    this.ambientT = 0;
    this.frameErrors = 0;
    this.lastCombat = -99999;
  }

  create() {
    const { map } = this;
    getStage().loadMap(map);
    this.fx = new Fx(this);
    this.buildObjects();
    this.barG = this.add.graphics().setDepth(DEPTH.TEXT - 2);

    const s = this.room.state as any;
    const self = s.players.get(this.sid);
    const clsId = (self?.cls ?? me.value?.cls ?? 'warrior') as keyof typeof CLASSES;
    this.cls = CLASSES[clsId];
    this.me = new Actor(this, pcSheet(clsId, self?.look ?? 0, self?.gear), self?.u ?? map.w / 2, self?.v ?? map.h / 2);
    this.me.setLabel(self?.name ?? '', '#ffe7a8');
    this.snapCamera();

    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p, true));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointer(p, false));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onPointer(p, false));
    this.events.once('shutdown', () => this.cleanup());
    this.scale.on('resize', this.layout, this);
    this.layout();

    this.ready = true;
    for (const e of this.pending) this.onNet(e.type, e.msg);
    this.pending = [];
    showBig(map.title, map.safe ? '안전 지역' : undefined, 2200);
    floor.value = null;
    boss.value = null;
    this.bootHook();
  }

  /** 자동 시험에서 상태를 읽을 수 있게 열어 둔다 */
  private bootHook() {
    (window as unknown as { __world?: WorldScene }).__world = this;
  }

  private cleanup() {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    this.scale.off('resize', this.layout, this);
    this.fx.destroy();
    for (const a of [this.me, ...this.mons.values(), ...[...this.others.values()].map((o) => o.a), ...[...this.npcs.values()].map((n) => n.a)]) a?.view.dispose();
    for (const d of this.dynProps.values()) getStage().removeProp(d.mesh);
    prompt.value = null;
    this.ready = false;
  }

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setViewport(0, 0, w, h);
  }

  private buildObjects() {
    for (const o of this.map.objects) {
      if (o.type === 'npc') {
        const def = NPCS[o.name];
        const a = new Actor(this, def?.sheet ?? o.name, o.u, o.v);
        a.dir = o.dir ?? 0;
        a.setLabel(def?.name ?? o.name, '#a8e6ff');
        this.npcs.set(o.name, { a, o });
      } else if (o.type === 'door') {
        const x = toX(o.u, o.v);
        const y = toY(o.u, o.v);
        const ring = this.add.image(x, y, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd98a).setDepth(DEPTH.TELEGRAPH + 2);
        const px = ((o.r ?? 1.3) * PX_U * 2) / 96;
        ring.setScale(px, (px * PX_V) / PX_U).setAlpha(0.6);
        const glow = this.add.image(x, y - 10, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(o.instance ? 0xb58aff : 0xffc96a).setScale(0.9, 0.7).setAlpha(0.35).setDepth(DEPTH.LIGHT);
        const t = this.add
          .text(x, y - 1.2 * PX_H, o.label ?? '', { fontFamily: 'Galmuri11', fontSize: '11px', color: '#ffe7a8', stroke: '#0b0a12', strokeThickness: 2 })
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.TEXT);
        this.doorViews.push({ o, ring, glow, t });
      }
    }
  }

  // ─── 입력 ─────────────────────────────────────────

  private onKey(e: KeyboardEvent, down: boolean) {
    const el = document.activeElement;
    const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    if (typing) {
      this.keys.clear();
      if (down && e.key === 'Escape') (el as HTMLElement).blur();
      return;
    }
    const k = e.code;
    if (down) {
      if (this.keys.has(k)) return;
      this.keys.add(k);
      this.onPress(k, e);
    } else {
      this.keys.delete(k);
      if (k === 'KeyZ' || k === 'KeyJ') input.attack = false;
    }
  }

  private onPress(k: string, e: KeyboardEvent) {
    switch (k) {
      case 'Space':
        e.preventDefault();
        this.tryDodge();
        break;
      case 'KeyQ':
        this.useSlot(0);
        break;
      case 'KeyE':
        this.useSlot(1);
        break;
      case 'KeyR':
        this.useSlot(2);
        break;
      case 'KeyF':
        this.useSlot(3);
        break;
      case 'KeyV':
        this.useSlot(4);
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
        this.useQuick(Number(k.slice(5)) - 1);
        break;
      case 'KeyG':
        this.interact();
        break;
      case 'KeyI':
      case 'KeyB':
        togglePanel('bag');
        break;
      case 'KeyC':
        togglePanel('equip');
        break;
      case 'KeyK':
        togglePanel('skills');
        break;
      case 'KeyL':
        togglePanel('quests');
        break;
      case 'KeyM':
        togglePanel('map');
        break;
      case 'KeyP':
        togglePanel('party');
        break;
      case 'F1':
        e.preventDefault();
        togglePanel('help');
        break;
      case 'Escape':
        if (!closeAll()) togglePanel('settings');
        break;
      case 'Enter':
        e.preventDefault();
        chatOpen.value = true;
        break;
      default:
        break;
    }
  }

  private onPointer(p: Phaser.Input.Pointer, down: boolean) {
    if (input.usedTouch) return;
    if (p.rightButtonDown() || (!down && p.button === 2)) {
      this.rightDown = down;
      this.setGuard(down);
      return;
    }
    if (p.button === 0) {
      this.pointerDown = down;
      if (down) {
        // NPC를 눌렀으면 대화
        const hit = this.npcAtPointer(p);
        if (hit) {
          this.pointerDown = false;
          this.openNpc(hit);
        }
      }
    }
  }

  private npcAtPointer(p: Phaser.Input.Pointer): string | null {
    for (const [id, { a, o }] of this.npcs) {
      const dx = p.worldX - a.screenX();
      const dy = p.worldY - (a.screenY() - 0.66 * PX_H);
      if (Math.abs(dx) < 22 && Math.abs(dy) < 44) {
        if (dist(this.me.u, this.me.v, o.u, o.v) <= (o.r ?? 2.6)) return id;
        toast('더 가까이 가세요', 'info', 1200);
        return null;
      }
    }
    return null;
  }

  private openNpc(id: string) {
    npcTab.value = 'talk';
    npcOpen.value = id;
    sfx('click');
    const n = this.npcs.get(id);
    if (n) {
      n.a.faceTo(this.me.u - n.a.u, this.me.v - n.a.v, dirFromVec(this.me.u - n.a.u, this.me.v - n.a.v));
      this.me.faceTo(n.a.u - this.me.u, n.a.v - this.me.v, dirFromVec(n.a.u - this.me.u, n.a.v - this.me.v));
    }
  }

  interact() {
    if (this.nearNpc) this.openNpc(this.nearNpc);
  }

  /** 마우스 위치의 월드 좌표 */
  pointerUV(): [number, number] {
    const p = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    return toUV(wp.x, wp.y + 10);
  }

  aimVec(): [number, number] {
    if (input.usedTouch) {
      if (input.aim) return input.aim;
      // 터치: 가장 가까운 적을 자동으로 겨눈다
      const t = this.nearestMon(9);
      if (t) return normalize(t.u - this.me.u, t.v - this.me.v);
      return this.lastDir;
    }
    const [u, v] = this.pointerUV();
    return normalize(u - this.me.u, v - this.me.v);
  }

  aimPoint(range: number): [number, number] {
    if (input.usedTouch) {
      const t = this.nearestMon(range + 1);
      if (t) return [t.u, t.v];
      return [this.me.u + this.lastDir[0] * range * 0.6, this.me.v + this.lastDir[1] * range * 0.6];
    }
    return this.pointerUV();
  }

  private nearestMon(range: number): Actor | undefined {
    let best: Actor | undefined;
    let bd = range;
    for (const a of this.mons.values()) {
      if (a.animName === 'death') continue;
      const d = dist(a.u, a.v, this.me.u, this.me.v);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  private moveVec(): [number, number] {
    let x = input.moveX;
    let y = input.moveY;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (!x && !y) return [0, 0];
    // 정면 시점: 화면 오른쪽이 +u, 아래가 +v
    const l = Math.hypot(x, y);
    const mag = Math.min(1, l);
    return [(x / l) * mag, (y / l) * mag];
  }

  private canAct() {
    return !this.dead && this.pState !== 'dodge' && this.pState !== 'dash';
  }

  private setGuard(on: boolean) {
    if (this.dead) return;
    if (on) {
      if (this.guardOn || !this.canAct() || this.map.safe) return;
      if (cooldownLeft('guard') > 0) return;
      this.guardOn = true;
      this.guardAt = this.time.now;
      this.atk = null;
      this.pState = 'guard';
      this.me.setAnim('guard', { restart: true });
      this.room.send('guard', { on: true });
      sfx('guard');
    } else if (this.guardOn) {
      this.guardOn = false;
      this.room.send('guard', { on: false });
      if (this.pState === 'guard') this.pState = 'idle';
    }
  }

  tryDodge() {
    if (!this.canAct() || cooldownLeft('dodge') > 0) return;
    const d = this.cls.dodge;
    const mv = this.moveVec();
    let dir: [number, number];
    if (d.backward) {
      const a = this.aimVec();
      dir = mv[0] || mv[1] ? normalize(mv[0], mv[1]) : [-a[0], -a[1]];
    } else {
      dir = mv[0] || mv[1] ? normalize(mv[0], mv[1]) : this.aimVec();
    }
    if (this.guardOn) this.setGuard(false);
    this.atk = null;
    // 벽 앞까지만
    let to: [number, number] = [this.me.u, this.me.v];
    const n = Math.ceil(d.dist / 0.2);
    for (let i = 1; i <= n; i++) {
      const u = this.me.u + (dir[0] * d.dist * i) / n;
      const v = this.me.v + (dir[1] * d.dist * i) / n;
      if (blocked(this.map.solid, u, v, R)) break;
      to = [u, v];
    }
    this.dodgeRun = { t: 0, dur: d.dur, from: [this.me.u, this.me.v], to, kind: d.kind, blinked: false };
    this.pState = 'dodge';
    this.me.setAnim('dodge', { restart: true, dur: d.dur });
    if (!d.backward) this.me.faceTo(dir[0], dir[1], dirFromVec(dir[0], dir[1]));
    this.room.send('dodge', { dir });
    setCooldown('dodge', d.cd * (1 - (me.value?.stats.cdr ?? 0)));
    sfx(d.kind === 'blink' ? 'blink' : 'dodge');
    if (d.kind === 'blink') this.fx.glowAt(this.me.u, this.me.v, 1.4, 0xb8d8ff, 0.3, 20);
  }

  useSlot(i: number) {
    const id = this.cls.skills[i];
    if (id) this.tryCast(id);
  }

  tryCast(id: string) {
    const sk: SkillDef | undefined = SKILLS[id];
    if (!sk || !me.value) return;
    const rank = me.value.skills[id] ?? 0;
    if (rank <= 0) {
      toast(me.value.level < sk.req ? `${sk.name}: ${sk.req}레벨부터 배울 수 있어요` : `${sk.name}: 스킬 창(K)에서 먼저 배우세요`, 'info', 1800);
      return;
    }
    if (this.map.safe) {
      toast('마을에서는 쓸 수 없어요', 'warn', 1400);
      return;
    }
    if (!this.canAct() || this.pState === 'cast' || cooldownLeft(id) > 0) return;
    if (vitals.value.mp < sk.mp) {
      toast('기력이 모자라요', 'warn', 1200);
      sfx('deny');
      return;
    }
    if (this.guardOn) this.setGuard(false);
    const aim = this.aimVec();
    const at = sk.range ? this.aimPoint(sk.range) : undefined;
    this.room.send('skill', { id, aim, at });
    this.atk = null;
    this.pState = 'cast';
    this.castEnd = this.time.now + sk.dur * 1000;
    this.me.faceTo(aim[0], aim[1], dirFromVec(aim[0], aim[1]));
    this.me.setAnim(sk.anim, { restart: true, dur: sk.dur });
    this.lastDir = aim;
  }

  useQuick(i: number) {
    this.room.send('quick', { i });
  }

  // ─── 매 프레임 ─────────────────────────────────────

  update(_time: number, deltaMs: number) {
    if (!this.ready) return;
    try {
      this.step(deltaMs);
    } catch (e) {
      // 한 프레임의 오류로 화면 전체가 멈추지 않게 한다
      this.frameErrors++;
      if (this.frameErrors <= 3) console.error('프레임 오류', (e as Error)?.stack ?? e);
    }
  }

  private step(deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    const state = this.room.state as any;
    if (!state?.players) return;
    this.updateMe(dt, state);
    this.syncOthers(dt, state);
    this.syncMons(dt, state);
    this.syncLoot(dt, state);
    this.syncDynProps(dt, state);
    this.fx.update(dt);
    this.drawBars();
    this.updateNpcs(dt);
    this.updateLights(dt);
    this.updateCamera(dt);
    this.tickAmbient(dt);
    this.tickHud(dt, state);
    this.checkDoors(dt);
    this.updateGuide(dt);
  }

  /** 지금 가야 할 곳: 지도 위의 다음 목적지 */
  private guideTarget(): { u: number; v: number; label: string } | null {
    const m = me.value;
    if (!m) return null;
    const here = this.map.name;
    const toMap = (target: string, label: string) => {
      const next = nextHop(here, target);
      if (!next) return null;
      const door = this.map.objects.find((o) => o.type === 'door' && o.target === next);
      return door ? { u: door.u, v: door.v, label: `${label} · ${door.label}` } : null;
    };
    const toNpc = (npc: string) => {
      const name = NPCS[npc]?.name ?? '';
      if (here === 'town') {
        const n = this.npcs.get(npc);
        return n ? { u: n.o.u, v: n.o.v, label: name } : null;
      }
      return toMap('town', name);
    };
    for (const id of Object.keys(m.quests.active)) {
      const q = QUEST_BY_ID[id];
      if (!q) continue;
      if (questComplete(m, q)) return toNpc(q.giver);
    }
    for (const id of Object.keys(m.quests.active)) {
      const q = QUEST_BY_ID[id];
      if (!q) continue;
      if (q.where !== here) {
        const t = toMap(q.where, q.title);
        if (t) return t;
      }
      return null;
    }
    const next = QUESTS.find((q) => questAvailable(m, q));
    return next ? toNpc(next.giver) : null;
  }

  private updateGuide(dt: number) {
    this.guideT -= dt;
    if (this.guideT <= 0) {
      this.guideT = 0.4;
      this.guideTo = this.dead ? null : this.guideTarget();
    }
    const t = this.guideTo;
    const d = t ? dist(this.me.u, this.me.v, t.u, t.v) : 0;
    const inCombat = !!boss.value || this.time.now - this.lastCombat < 4000;
    if (!t || d < 3.5 || inCombat) {
      this.guideArrow?.setVisible(false);
      this.guideText?.setVisible(false);
      return;
    }
    if (!this.guideArrow) {
      this.guideArrow = this.add.image(0, 0, 'guide').setDepth(DEPTH.TEXT - 4);
      this.guideText = this.add
        .text(0, 0, '', { fontFamily: 'Galmuri11', fontSize: '10px', color: '#ffe7a8', stroke: '#0b0a12', strokeThickness: 2 })
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH.TEXT - 4);
    }
    const sx = toX(t.u, t.v) - this.me.screenX();
    const sy = toY(t.u, t.v) - this.me.screenY();
    const a = Math.atan2(sy, sx);
    const c = Math.cos(a);
    const px = this.me.screenX() + c * 44;
    const py = this.me.screenY() - 16 + Math.sin(a) * 30;
    const bob = Math.sin(this.time.now * 0.006) * 2;
    this.guideArrow.setVisible(true).setPosition(px + c * bob, py + Math.sin(a) * bob).setRotation(a);
    // 글자는 화살표 바깥쪽으로 붙여 인물을 가리지 않게 한다
    this.guideText!
      .setVisible(true)
      .setText(`${t.label} ${Math.round(d)}칸`)
      .setOrigin(c >= 0 ? 0 : 1, 0.5)
      .setPosition(Math.round(px + c * 12), Math.round(py + 1));
  }

  private updateMe(dt: number, state: any) {
    const a = this.me;
    const self = state.players.get(this.sid);
    if (!self) return;
    a.setSheet(pcSheet(self.cls, self.look ?? 0, self.gear));
    const wasDead = this.dead;
    this.dead = self.dead;
    if (this.dead && !wasDead) {
      this.pState = 'dead';
      this.atk = null;
      this.guardOn = false;
      this.dodgeRun = null;
      this.dashRun = null;
      a.setAnim('death', { restart: true });
      sfx('death');
      closeAll();
    }
    if (!this.dead && wasDead) {
      this.pState = 'idle';
      a.setAnim('idle', { restart: true });
      a.lift = 0;
    }
    if (this.dead) {
      a.update(dt);
      return;
    }

    const mv = this.moveVec();
    const moving = mv[0] !== 0 || mv[1] !== 0;
    const speedBase = me.value?.stats.speed ?? this.cls.speed;
    const slowed = (self.fx & 16) !== 0 ? 0.6 : 1;

    // 공격 입력
    const wantAttack = this.pointerDown || input.attack || this.keys.has('KeyZ') || this.keys.has('KeyJ');
    if (wantAttack && !this.map.safe && !npcOpen.value) this.tryAttack();

    switch (this.pState) {
      case 'attack': {
        const r = this.atk!;
        r.t += dt * (this.hitstop > 0 ? 0.15 : 1);
        const aspd = this.attackSpeed();
        const dur = r.dur;
        const impact = r.step.impact / aspd;
        if (r.step.lunge && r.t < impact) {
          const k = Math.min(1, r.t / impact);
          const want = r.step.lunge * (1 - (1 - k) * (1 - k));
          const d = want - r.lunged;
          r.lunged = want;
          [a.u, a.v] = slideMove(this.map.solid, a.u, a.v, r.aim[0] * d, r.aim[1] * d, R);
        }
        if (!r.struck && r.t >= impact) {
          r.struck = true;
          this.onLocalImpact(r);
        }
        const mobile = this.cls.id === 'archer' ? 0.5 : this.cls.id === 'mage' ? 0.3 : 0;
        if (mobile && moving) {
          [a.u, a.v] = slideMove(this.map.solid, a.u, a.v, mv[0] * speedBase * mobile * slowed * dt, mv[1] * speedBase * mobile * slowed * dt, R);
        }
        if (r.t >= dur) {
          this.atk = null;
          this.pState = 'idle';
          this.comboAt = this.time.now;
        }
        break;
      }
      case 'cast':
        if (this.time.now >= this.castEnd) this.pState = 'idle';
        break;
      case 'dodge': {
        const r = this.dodgeRun!;
        r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        if (r.kind === 'blink') {
          if (k >= 0.45 && !r.blinked) {
            r.blinked = true;
            a.u = r.to[0];
            a.v = r.to[1];
            this.fx.glowAt(a.u, a.v, 1.4, 0xb8d8ff, 0.3, 20);
            this.fx.burst(a.u, a.v, 12, [0xbcd8ff, 0xffffff], 90, 20);
          }
          a.alpha = k < 0.45 ? 1 - k * 1.6 : (k - 0.45) * 1.8;
        } else {
          const e = 1 - (1 - k) * (1 - k);
          a.u = r.from[0] + (r.to[0] - r.from[0]) * e;
          a.v = r.from[1] + (r.to[1] - r.from[1]) * e;
          if (r.kind === 'leap') a.lift = Math.sin(k * Math.PI) * 16;
          a.ghostT -= dt;
          if (a.ghostT <= 0) {
            a.ghostT = 0.05;
            this.ghost(a);
          }
        }
        if (k >= 1) {
          this.dodgeRun = null;
          a.lift = 0;
          a.alpha = 1;
          this.pState = 'idle';
        }
        break;
      }
      case 'dash': {
        const r = this.dashRun!;
        r.t += dt;
        const k = Math.min(1, r.t / r.dur);
        const e = r.arc ? k : 1 - (1 - k) * (1 - k);
        a.u = r.from[0] + (r.to[0] - r.from[0]) * e;
        a.v = r.from[1] + (r.to[1] - r.from[1]) * e;
        a.lift = r.arc ? Math.sin(k * Math.PI) * r.arc : 0;
        a.ghostT -= dt;
        if (a.ghostT <= 0) {
          a.ghostT = 0.04;
          this.ghost(a);
        }
        if (k >= 1) {
          this.dashRun = null;
          a.lift = 0;
          this.pState = 'cast';
          this.castEnd = this.time.now + 150;
        }
        break;
      }
      case 'guard': {
        if (moving) {
          [a.u, a.v] = slideMove(this.map.solid, a.u, a.v, mv[0] * speedBase * 0.42 * slowed * dt, mv[1] * speedBase * 0.42 * slowed * dt, R);
        }
        const aim = this.aimVec();
        a.faceTo(aim[0], aim[1], dirFromVec(aim[0], aim[1]));
        const g = this.cls.guard;
        if (g.maxHold && this.time.now - this.guardAt > g.maxHold * 1000) this.setGuard(false);
        if (a.animName !== 'guard') a.setAnim('guard', { restart: true });
        break;
      }
      default: {
        if (moving) {
          const sp = speedBase * slowed;
          [a.u, a.v] = slideMove(this.map.solid, a.u, a.v, mv[0] * sp * dt, mv[1] * sp * dt, R);
          a.faceTo(mv[0], mv[1], dirFromVec(mv[0], mv[1]));
          this.lastDir = normalize(mv[0], mv[1]);
          if (a.animName !== 'walk') a.setAnim('walk', { restart: true });
          this.pState = 'walk';
        } else {
          if (a.animName !== 'idle') a.setAnim('idle', { restart: true });
          this.pState = 'idle';
        }
        break;
      }
    }

    if (this.rightDown && !this.guardOn && (this.pState === 'idle' || this.pState === 'walk') && cooldownLeft('guard') <= 0) this.setGuard(true);
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      a.frozen = Math.max(a.frozen, 0.001);
    }
    a.update(dt);

    // 보호막·강화 표시
    this.updateMyAura(dt, self);

    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / SEND_HZ;
      this.room.send('move', { u: a.u, v: a.v, dir: a.dir, anim: a.animName });
    }
  }

  private updateMyAura(dt: number, self: any) {
    const a = this.me;
    if (self.shield > 0) {
      if (!this.shieldImg) {
        this.shieldImg = this.add.image(0, 0, 'bubble').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8fd0ff).setDepth(DEPTH.FX);
      }
      this.shieldImg.setPosition(a.screenX(), a.screenY() - 24 - a.lift).setAlpha(0.65 + Math.sin(this.time.now * 0.008) * 0.2).setVisible(true);
    } else if (this.shieldImg) {
      this.shieldImg.setVisible(false);
    }
    if (self.fx & 6) {
      if (Math.random() < dt * 22) {
        const color = self.fx & 2 ? 0xffb65c : 0xc8ff8a;
        this.fx.part({ tex: 'px', x: a.screenX() + (Math.random() - 0.5) * 22, y: a.screenY() - Math.random() * 1.1 * PX_H, vy: -30, life: 0.55, s0: 0.7, s1: 0.1, color });
      }
    }
  }

  private attackSpeed() {
    return (me.value?.stats.aspd ?? 1) + (buffs.value.some((b) => b.id === 'a_hawk') ? 0.3 : 0);
  }

  private tryAttack() {
    if (this.dead) return;
    if (this.pState !== 'idle' && this.pState !== 'walk') {
      // 현재 타격이 끝났으면 다음 타로 넘어간다
      if (!(this.pState === 'attack' && this.atk && this.atk.struck && this.atk.index < 2 && this.atk.t >= this.atk.dur * 0.72)) return;
    }
    const combo = this.cls.combo;
    if (this.time.now - this.comboAt > 800) this.comboIdx = 0;
    const index = this.comboIdx % combo.length;
    const step = combo[index];
    this.comboIdx = index + 1;
    if (this.comboIdx >= combo.length) this.comboIdx = 0;
    const aim = this.aimVec();
    const dur = step.dur / this.attackSpeed();
    this.atk = { step, index, t: 0, dur, aim, lunged: 0, struck: false };
    this.pState = 'attack';
    this.comboAt = this.time.now;
    this.lastDir = aim;
    this.me.faceTo(aim[0], aim[1], dirFromVec(aim[0], aim[1]));
    this.me.setAnim(step.anim, { restart: true, dur });
    this.room.send('attack', { aim, step: index });
    if (this.cls.id === 'warrior') sfx(index === 2 ? 'slash2' : 'slash');
  }

  /** 타격 순간의 내 쪽 연출 (실제 판정은 서버) */
  private onLocalImpact(r: AttackRun) {
    const a = this.me;
    if (r.step.kind === 'melee') {
      const big = r.index === 2;
      this.fx.slash(a.u, a.v, r.aim, r.step.reach ?? 1.4, big ? 0xffe9b0 : 0xffffff, r.index === 1, big);
    } else {
      sfx(this.cls.id === 'archer' ? 'arrow' : 'orb');
    }
  }

  private ghost(a: Actor) {
    getStage().ghost(a.view);
  }

  private syncOthers(dt: number, state: any) {
    const seen = new Set<string>();
    state.players.forEach((p: any, sid: string) => {
      if (sid === this.sid) return;
      seen.add(sid);
      let v = this.others.get(sid);
      if (!v) {
        const a = new Actor(this, pcSheet(p.cls, p.look ?? 0, p.gear), p.u, p.v);
        a.setLabel(p.name);
        v = { a, overrideUntil: 0 };
        this.others.set(sid, v);
      }
      const a = v.a;
      a.setSheet(pcSheet(p.cls, p.look ?? 0, p.gear));
      a.tu = p.u;
      a.tv = p.v;
      const d = dist(a.u, a.v, a.tu, a.tv);
      if (d > 4) {
        a.u = a.tu;
        a.v = a.tv;
      } else {
        const k = Math.min(1, dt * 14);
        a.u += (a.tu - a.u) * k;
        a.v += (a.tv - a.v) * k;
      }
      a.dir = p.dir;
      const partyColor = p.party && p.party === (state.players.get(this.sid)?.party || '#') ? '#a8ffb8' : '#f4efe2';
      a.setLabel(p.name, partyColor);
      if (a.label) a.label.setVisible(settings.value.names);
      if (p.dead) {
        if (a.animName !== 'death') a.setAnim('death', { restart: true });
      } else if (performance.now() > v.overrideUntil) {
        const name = p.anim === 'walk' ? 'walk' : p.anim === 'guard' ? 'guard' : 'idle';
        if (a.animName !== name) a.setAnim(name, { restart: true });
      }
      a.update(dt);
    });
    for (const [sid, v] of this.others) {
      if (!seen.has(sid)) {
        v.a.destroy();
        this.others.delete(sid);
      }
    }
  }

  private syncMons(dt: number, state: any) {
    const seen = new Set<string>();
    let bossNow: { id: string; m: any } | null = null;
    state.monsters.forEach((m: any, id: string) => {
      seen.add(id);
      let a = this.mons.get(id);
      if (!a) {
        const def = MONSTERS[m.kind];
        a = new Actor(this, def?.sheet ?? m.kind, m.u, m.v, def?.scale ?? 1);
        a.alpha = 0;
        this.tweens.add({ targets: a, alpha: 1, duration: 280 });
        this.mons.set(id, a);
      }
      a.tu = m.u;
      a.tv = m.v;
      const d = dist(a.u, a.v, a.tu, a.tv);
      if (d > 4) {
        a.u = a.tu;
        a.v = a.tv;
      } else {
        const k = Math.min(1, dt * 12);
        a.u += (a.tu - a.u) * k;
        a.v += (a.tv - a.v) * k;
      }
      a.dir = m.dir;
      const seqChanged = m.seq !== a.seq;
      a.seq = m.seq;
      if (m.anim === 'hit') {
        // 서버는 다음 행동까지 hit로 남아 있으니 번호가 바뀔 때만 재생한다
        if (seqChanged) a.setAnim('hit', { restart: true, next: 'idle' });
      } else if (m.anim === 'death') {
        if (a.animName !== 'death') a.setAnim('death', { restart: true });
      } else if (seqChanged && a.actPending && m.anim === a.animName) {
        // monAct가 이미 판정 시각에 맞춰 재생을 시작했다
        a.actPending = false;
      } else if (seqChanged || m.anim !== a.animName) {
        a.setAnim(m.anim, { restart: seqChanged });
      }
      if (m.anim === 'death' && a.t > a.dur * 0.7) {
        a.fading = 1 - (a.t - a.dur * 0.7) / 0.5;
        a.alpha = Math.max(0, a.fading);
      }
      if (m.fx & 1) a.frozen = 0.05;
      a.update(dt);
      if (m.boss && m.anim !== 'death' && dist(m.u, m.v, this.me.u, this.me.v) < 22) bossNow = { id, m };
    });
    for (const [id, a] of this.mons) {
      if (!seen.has(id)) {
        a.destroy();
        this.mons.delete(id);
      }
    }
    const cur = bossNow as { id: string; m: any } | null;
    if (cur) {
      const def = MONSTERS[cur.m.kind];
      boss.value = { name: def?.name ?? '', hp: cur.m.hp, maxHp: cur.m.maxHp, level: cur.m.level };
      if (!this.bossSeen.has(cur.id)) {
        this.bossSeen.add(cur.id);
        showBig(def?.name ?? '', '보스', 2400);
        sfx('roar');
        this.fx.shake = Math.max(this.fx.shake, 6);
      }
    } else if (boss.value) {
      boss.value = null;
    }
  }

  private syncLoot(dt: number, state: any) {
    const seen = new Set<string>();
    state.loot.forEach((l: any, id: string) => {
      seen.add(id);
      let v = this.loot.get(id);
      if (!v) {
        const x = toX(l.u, l.v);
        const y = toY(l.u, l.v);
        const hasIcon = this.textures.exists('icons_items') && this.textures.get('icons_items').has(l.icon);
        const img = hasIcon ? this.add.image(x, y, 'icons_items', l.icon).setScale(0.5) : this.add.image(x, y, 'px').setScale(2).setTint(0xffd25a);
        img.setDepth(y);
        v = { img, x, y, t: Math.random() * 3 };
        const rarityColor = [0xd7d3c8, 0x7ee08a, 0x6fb7ff, 0xc79bff][l.rarity] ?? 0xffffff;
        if (l.rarity > 0) {
          v.glow = this.add.image(x, y - 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(rarityColor).setScale(0.3).setDepth(DEPTH.LIGHT);
          v.label = this.add
            .text(x, y - 16, l.label, { fontFamily: 'Galmuri11', fontSize: '10px', color: ['#d7d3c8', '#7ee08a', '#6fb7ff', '#c79bff'][l.rarity], stroke: '#0b0a12', strokeThickness: 2 })
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.TEXT - 3);
        }
        this.loot.set(id, v);
      }
      v.t += dt;
      const bob = Math.sin(v.t * 4) * 1.5 - 5;
      v.img.setPosition(v.x, v.y + bob);
      if (v.glow) v.glow.setAlpha(0.5 + Math.sin(v.t * 3) * 0.25);
    });
    for (const [id, v] of this.loot) {
      if (!seen.has(id)) {
        v.img.destroy();
        v.glow?.destroy();
        v.label?.destroy();
        this.loot.delete(id);
      }
    }
  }

  private syncDynProps(dt: number, state: any) {
    const seen = new Set<string>();
    state.props.forEach((p: any, id: string) => {
      seen.add(id);
      let v = this.dynProps.get(id);
      if (!v) {
        const x = toX(p.u, p.v);
        const y = toY(p.u, p.v);
        const mesh = getStage().addProp('portal_arch', p.u, p.v);
        const glow = this.add.image(x, y - 0.66 * PX_H, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(p.kind === 'exit' ? 0xffd98a : 0xb58aff).setScale(0.8, 1).setDepth(DEPTH.LIGHT);
        const label = this.add
          .text(x, y - 3.4 * PX_H, p.label, { fontFamily: 'Galmuri11', fontSize: '11px', color: '#ffe7a8', stroke: '#0b0a12', strokeThickness: 2 })
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.TEXT);
        v = { mesh, glow, label, r: p.r, u: p.u, v: p.v, kind: p.kind, used: -99 };
        this.dynProps.set(id, v);
        sfx('door');
      }
      v.glow.setAlpha(0.65 + Math.sin(this.time.now * 0.006) * 0.25);
      if (!this.dead && dist(this.me.u, this.me.v, v.u, v.v) < v.r && this.time.now / 1000 - v.used > 1.5) {
        v.used = this.time.now / 1000;
        this.room.send('propUse', { id });
      }
      if (Math.random() < dt * 14) {
        this.fx.part({ tex: 'px', x: toX(v.u, v.v) + (Math.random() - 0.5) * 22, y: toY(v.u, v.v) - Math.random() * 10, vy: -40 - Math.random() * 30, life: 0.8, s0: 0.7, s1: 0.1, color: v.kind === 'exit' ? 0xffd98a : 0xb58aff });
      }
    });
    for (const [id, v] of this.dynProps) {
      if (!seen.has(id)) {
        getStage().removeProp(v.mesh);
        v.glow.destroy();
        v.label.destroy();
        this.dynProps.delete(id);
      }
    }
  }

  private drawBars() {
    const g = this.barG;
    g.clear();
    const state = this.room.state as any;
    const cam = this.cameras.main;
    const view = cam.worldView;
    state.monsters.forEach((m: any, id: string) => {
      if (m.boss || m.hp >= m.maxHp || m.hp <= 0) return;
      const a = this.mons.get(id);
      if (!a) return;
      const x = Math.round(a.screenX());
      const y = Math.round(a.screenY() - a.topY() + 8);
      if (x < view.x - 40 || x > view.right + 40 || y < view.y - 40 || y > view.bottom + 40) return;
      const w = 26;
      g.fillStyle(0x0b0a12, 0.9);
      g.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
      g.fillStyle(0xd8483a, 1);
      g.fillRect(x - w / 2, y, Math.max(1, Math.round((w * m.hp) / m.maxHp)), 2);
    });
    state.players.forEach((p: any, sid: string) => {
      if (sid === this.sid || p.dead || p.hp >= p.maxHp) return;
      const v = this.others.get(sid);
      if (!v) return;
      const x = Math.round(v.a.screenX());
      const y = Math.round(v.a.screenY() - v.a.topY() + 2);
      g.fillStyle(0x0b0a12, 0.9);
      g.fillRect(x - 13, y - 1, 26, 4);
      g.fillStyle(0x6fd07a, 1);
      g.fillRect(x - 12, y, Math.max(1, Math.round((24 * p.hp) / p.maxHp)), 2);
    });
  }

  private updateNpcs(dt: number) {
    let near: string | null = null;
    let nd = Infinity;
    const m = me.value;
    for (const [id, { a, o }] of this.npcs) {
      a.update(dt);
      const d = dist(this.me.u, this.me.v, o.u, o.v);
      if (d < (o.r ?? 2.6) && d < nd) {
        nd = d;
        near = id;
      }
      if (m) a.setMark(npcMark(m, id));
    }
    this.nearNpc = near;
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 0.15;
      const label = near && !npcOpen.value ? `${NPCS[near]?.name ?? ''}와 대화` : null;
      if ((prompt.value?.label ?? null) !== label) prompt.value = label ? { label, key: 'G' } : null;
      if (npcOpen.value && (!near || near !== npcOpen.value)) {
        const cur = this.npcs.get(npcOpen.value);
        if (!cur || dist(this.me.u, this.me.v, cur.o.u, cur.o.v) > (cur.o.r ?? 2.6) + 1) npcOpen.value = null;
      }
    }
  }

  private updateLights(_dt: number) {
    const t = this.time.now * 0.001;
    for (const d of this.doorViews) {
      const p = 0.5 + Math.sin(t * 3) * 0.25;
      d.ring.setAlpha(p);
      d.glow.setAlpha(0.28 + p * 0.2);
    }
  }

  private snapCamera() {
    this.camX = this.me.screenX();
    this.camY = this.me.screenY() - 12;
    this.cameras.main.centerOn(Math.round(this.camX), Math.round(this.camY));
    getStage().setView(Math.round(this.camX), Math.round(this.camY));
  }

  private updateCamera(dt: number) {
    const tx = this.me.screenX();
    const ty = this.me.screenY() - 12;
    const k = 1 - Math.exp(-dt * 9);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    let sx = 0;
    let sy = 0;
    if (this.fx.shake > 0.05) {
      const s = settings.value.shake ? this.fx.shake : 0;
      sx = (Math.random() - 0.5) * s;
      sy = (Math.random() - 0.5) * s;
      this.fx.shake *= Math.exp(-dt * 11);
    }
    const cx = Math.round(this.camX + sx);
    const cy = Math.round(this.camY + sy);
    this.cameras.main.centerOn(cx, cy);
    const stage = getStage();
    stage.setView(cx, cy);
    stage.setFocus(this.me.u, this.me.v, 0.9, !this.dead);
    stage.render(dt);
  }

  private tickAmbient(dt: number) {
    this.ambientT -= dt;
    if (this.ambientT > 0) return;
    this.ambientT = 0.05;
    const v = this.cameras.main.worldView;
    // 떠다니는 빛
    const col = this.map.name === 'ashfield' || this.map.name === 'furnace' ? 0xff8a3c : this.map.name === 'rift' ? 0xb58aff : 0xd8ffa8;
    if (Math.random() < 0.5) {
      this.fx.part({ tex: 'px', x: v.x + Math.random() * v.width, y: v.y + Math.random() * v.height, vx: (Math.random() - 0.5) * 12, vy: -8 - Math.random() * 14, life: 2.2, s0: 0.4, s1: 0.1, a0: 0.75, color: col });
    }
  }

  private tickHud(dt: number, state: any) {
    this.hudT -= dt;
    if (this.hudT > 0) return;
    this.hudT = 0.08;
    const self = state.players.get(this.sid);
    if (self) {
      const cur = vitals.value;
      if (cur.hp !== self.hp || cur.maxHp !== self.maxHp || cur.mp !== self.mp || cur.maxMp !== self.maxMp || cur.shield !== self.shield || cur.dead !== self.dead) {
        vitals.value = { hp: self.hp, maxHp: self.maxHp, mp: self.mp, maxMp: self.maxMp, shield: self.shield, dead: self.dead };
      }
    }
    if (state.floor > 0) {
      const f = floor.value;
      if (!f || f.n !== state.floor || f.remain !== state.remain) floor.value = { n: state.floor, remain: state.remain };
    }
    const now = performance.now();
    if (buffs.value.some((b) => b.end < now)) buffs.value = buffs.value.filter((b) => b.end >= now);
  }

  private checkDoors(dt: number) {
    this.doorT -= dt;
    if (this.doorT > 0 || this.dead) return;
    this.doorT = 0.2;
    for (const d of this.doorViews) {
      const { o } = d;
      if (dist(this.me.u, this.me.v, o.u, o.v) < (o.r ?? 1.3) && this.time.now - this.lastDoor > 1500) {
        this.lastDoor = this.time.now;
        this.room.send('door', { name: o.name });
        break;
      }
    }
    // 등불을 밝히면 부활 지점이 된다
    this.nearWayT -= 0.2;
    if (this.nearWayT <= 0) {
      for (const o of this.map.objects) {
        if (o.type === 'waystone' && dist(this.me.u, this.me.v, o.u, o.v) < (o.r ?? 2.2)) {
          this.nearWayT = 4;
          this.room.send('way', { name: o.name });
        }
      }
    }
  }

  // ─── 서버 이벤트 ─────────────────────────────────

  onNet(type: string, m: any) {
    if (!this.ready) {
      this.pending.push({ type, msg: m });
      return;
    }
    try {
      this.handleNet(type, m);
    } catch (e) {
      console.error('메시지 처리 오류', type, (e as Error)?.stack ?? e);
    }
  }

  private handleNet(type: string, m: any) {
    switch (type) {
      case 'welcome':
        break;
      case 'tp':
        this.me.u = m.u;
        this.me.v = m.v;
        if (m.revive) this.snapCamera();
        if (m.floor) this.snapCamera();
        this.dodgeRun = null;
        this.dashRun = null;
        this.me.lift = 0;
        break;
      case 'act': {
        const v = this.others.get(m.sid);
        if (!v) break;
        v.a.dir = dirFromVec(m.aim[0], m.aim[1]);
        v.a.setAnim(m.anim, { restart: true, dur: m.dur });
        v.overrideUntil = performance.now() + m.dur * 1000;
        break;
      }
      case 'swing': {
        if (m.sid === this.sid) break;
        const v = this.others.get(m.sid);
        if (v) this.fx.slash(v.a.u, v.a.v, m.aim, m.reach ?? 1.4, 0xffffff, m.step === 'attack2', m.step === 'attack3');
        break;
      }
      case 'cast':
        this.onCast(m);
        break;
      case 'dodge': {
        const v = this.others.get(m.sid);
        if (v) {
          v.a.setAnim('dodge', { restart: true, dur: m.dur });
          v.overrideUntil = performance.now() + m.dur * 1000;
        }
        break;
      }
      case 'guardHit':
        this.fx.burst(this.actorOf(m.sid)?.u ?? 0, this.actorOf(m.sid)?.v ?? 0, 8, [0xffffff, 0xbcd8ff], 70, 20);
        if (m.sid === this.sid) sfx('guard');
        break;
      case 'parryOk': {
        const a = this.actorOf(m.sid);
        if (!a) break;
        this.fx.glowAt(a.u, a.v, 2, 0xfff2c0, 0.3, 20);
        this.fx.groundRing(a.u, a.v, 1.8, 0xffffff, 0.3);
        this.fx.burst(a.u, a.v, 18, [0xffffff, 0xffe9a8], 120, 20, 0.35);
        sfx('parry');
        if (m.sid === this.sid) {
          this.fx.number(a.u, a.v, '막아냄!', '#ffe9a8', true, 40);
          this.fx.shake = Math.max(this.fx.shake, 3);
          this.hitstop = 0.09;
        }
        break;
      }
      case 'hit':
        this.onHitMon(m);
        break;
      case 'hitP':
        this.onHitPlayer(m);
        break;
      case 'dodged':
        this.fx.number(this.me.u, this.me.v, '회피', '#bcd8ff', false, 40);
        break;
      case 'heal': {
        const a = this.actorOf(m.sid);
        if (!a) break;
        if (m.n > 0) this.fx.number(a.u, a.v, `+${m.n}`, m.kind === 'mp' ? '#8fc4ff' : '#8fe89a', false, 42);
        this.fx.burst(a.u, a.v, 8, m.kind === 'mp' ? [0x8fc4ff, 0xffffff] : [0x8fe89a, 0xffffff], 34, 12, 0.3);
        if (m.sid === this.sid) sfx('pickup');
        break;
      }
      case 'exp': {
        const a = this.mons.get(m.m);
        if (a) this.fx.number(a.u, a.v, `+${m.n} EXP`, '#ffe08a', false, 50);
        break;
      }
      case 'levelup': {
        const a = this.actorOf(m.sid);
        if (!a) break;
        this.fx.glowAt(a.u, a.v, 3, 0xffe9a8, 0.7, 20);
        this.fx.groundRing(a.u, a.v, 2.4, 0xffd25a, 0.6);
        for (let i = 0; i < 30; i++) {
          this.fx.part({
            tex: 'spark',
            x: a.screenX() + (Math.random() - 0.5) * 30,
            y: a.screenY() - Math.random() * 12,
            vy: -50 - Math.random() * 80,
            life: 0.7 + Math.random() * 0.5,
            s0: 0.8,
            s1: 0.1,
            color: i % 2 ? 0xffd25a : 0xffffff,
          });
        }
        if (m.sid === this.sid) {
          sfx('levelup');
          showBig(`${m.level} 레벨`, '레벨이 올랐어요', 2400);
          this.fx.shake = Math.max(this.fx.shake, 2);
        } else {
          a.say(`${m.level} 레벨 달성!`, 2000);
        }
        break;
      }
      case 'died': {
        const v = this.others.get(m.sid);
        if (v) v.a.setAnim('death', { restart: true });
        break;
      }
      case 'warn':
        this.fx.addWarn(m);
        if (!m.friendly && !m.soft) sfx('warn');
        break;
      case 'warnCancel':
        this.fx.cancelWarn(m.m);
        break;
      case 'blast':
        this.fx.blast(m.u, m.v, m.r, m.col, m.inner);
        if (m.shake) this.fx.shake = Math.max(this.fx.shake, 5);
        sfx(m.col === 'ice' ? 'ice' : m.col === 'fire' || m.col === 'ember' ? 'fire' : m.shake ? 'boom' : m.col === 'arrow' ? 'arrow' : 'fire');
        break;
      case 'mswing': {
        const a = this.mons.get(m.id);
        if (a) this.fx.slash(a.u, a.v, m.aim, m.r, 0xff9a8a, false, m.r > 2.4);
        sfx('slash');
        break;
      }
      case 'monAct': {
        const a = this.mons.get(m.id);
        if (a?.animInfo) {
          // 타격 프레임이 판정 시각과 맞도록 재생 시간을 늘린다
          a.setAnim(m.anim, { restart: true, dur: Math.max(a.animInfo.dur * 0.7, m.t / 0.55) });
          a.actPending = true;
        }
        break;
      }
      case 'proj':
        this.fx.addProj(m);
        if (!m.friendly) sfx('orb');
        break;
      case 'projEnd':
        this.fx.endProj(m.id, m.u, m.v);
        break;
      case 'patch':
        this.fx.addPatch(m.id, m.u, m.v, m.r, m.ttl);
        break;
      case 'trap':
        this.fx.addTrap(m.id, m.u, m.v, m.r);
        break;
      case 'trapGone':
        this.fx.removeTrap(m.id);
        break;
      case 'buffFx': {
        const a = this.actorOf(m.sid);
        if (!a) break;
        const sk = SKILLS[m.id];
        const color = m.id === 'm_shield' ? 0x8fd0ff : m.id === 'a_hawk' ? 0xc8ff8a : 0xffb65c;
        this.fx.glowAt(a.u, a.v, 2.2, color, 0.5, 20);
        this.fx.groundRing(a.u, a.v, 1.6, color, 0.5);
        if (m.sid === this.sid && sk) sfx('buff');
        break;
      }
      case 'shieldBreak': {
        const a = this.actorOf(m.sid);
        if (a) this.fx.burst(a.u, a.v, 18, [0x8fd0ff, 0xffffff], 110, 22, 0.35);
        sfx('ice');
        break;
      }
      case 'say': {
        const a = this.mons.get(m.id);
        if (a) a.say(m.text, 3200);
        if (m.big) {
          showBig(m.text, undefined, 2200);
          sfx('roar');
          this.fx.shake = Math.max(this.fx.shake, 6);
        }
        break;
      }
      case 'bubble': {
        const a = this.actorOf(m.sid);
        if (a) a.say(m.text);
        break;
      }
      case 'lootDrop':
        sfx('pickup');
        break;
      case 'wayLit': {
        for (const o of this.map.objects) {
          if (o.type === 'waystone' && o.name === m.name) {
            this.fx.glowAt(o.u, o.v, 4, 0xffd98a, 0.8, 34);
            this.fx.burst(o.u, o.v, 24, [0xffd98a, 0xffffff], 100, 34, 0.35);
          }
        }
        sfx('quest');
        break;
      }
      case 'riftFloor':
        this.fx.shake = Math.max(this.fx.shake, 3);
        sfx('door');
        break;
      default:
        break;
    }
  }

  actorOf(sid: string): Actor | undefined {
    return sid === this.sid ? this.me : this.others.get(sid)?.a;
  }

  private onCast(m: any) {
    const sk: SkillDef | undefined = SKILLS[m.id];
    const a = this.actorOf(m.sid);
    if (!sk || !a) return;
    const mine = m.sid === this.sid;
    if (!mine) {
      const v = this.others.get(m.sid);
      if (v) {
        a.dir = dirFromVec(m.aim[0], m.aim[1]);
        a.setAnim(m.anim, { restart: true, dur: m.dur });
        v.overrideUntil = performance.now() + m.dur * 1000;
      }
    } else {
      this.fx.shake = Math.max(this.fx.shake, 1);
    }
    if (m.dash && mine) {
      this.dashRun = {
        t: 0,
        dur: sk.kind === 'leapSmash' ? sk.impact : sk.dur * 0.6,
        from: [this.me.u, this.me.v],
        to: m.dash,
        arc: sk.kind === 'leapSmash' ? 48 : 0,
      };
      this.pState = 'dash';
    }
    // 스킬별 연출
    this.time.delayedCall(sk.impact * 1000, () => {
      if (!this.ready) return;
      const au = m.aim[0];
      const av = m.aim[1];
      switch (sk.id) {
        case 'w_whirl':
          this.fx.whirl(a.u, a.v, sk.r!, 0xffe9b0);
          sfx('whirl');
          break;
        case 'w_slam': {
          const reach = sk.reach!;
          this.fx.slash(a.u, a.v, [au, av], reach, 0xffc27a, false, true);
          for (let i = 1; i <= 5; i++) {
            const d = (reach * i) / 5;
            this.time.delayedCall(i * 40, () => {
              if (!this.ready) return;
              this.fx.blast(a.u + au * d, a.v + av * d, 0.8 + i * 0.12, 'gold');
            });
          }
          this.fx.shake = Math.max(this.fx.shake, 6);
          sfx('boom');
          break;
        }
        case 'w_charge':
          this.fx.burst(a.u, a.v, 18, [0xffe9b0, 0xffffff], 120, 12);
          sfx('slash2');
          break;
        case 'w_cry':
        case 'a_hawk':
        case 'm_shield':
          break;
        case 'm_nova':
          this.fx.groundRing(a.u, a.v, sk.r!, 0xbff0ff, 0.5);
          break;
        case 'a_fan':
        case 'a_pierce':
          sfx('arrow');
          break;
        case 'm_fireball':
          sfx('fire');
          break;
        default:
          break;
      }
    });
  }

  private onHitMon(m: any) {
    const a = this.mons.get(m.m);
    if (!a) return;
    const mine = m.by === this.sid;
    a.flash(70);
    const big = !!m.c;
    this.fx.number(a.u, a.v, String(m.n), big ? '#ffd25a' : mine ? '#ffffff' : '#c8c4bc', big, a.topY() * 0.7);
    this.fx.burst(a.u, a.v, big ? 12 : 5, big ? [0xffd25a, 0xffffff, 0xff8a3c] : [0xffffff, 0xffc0a8], big ? 110 : 70, a.topY() * 0.45, 0.28);
    if (mine) {
      this.lastCombat = this.time.now;
      sfx(big ? 'crit' : 'hit');
      this.hitstop = Math.max(this.hitstop, big ? 0.07 : 0.035);
      a.frozen = Math.max(a.frozen, big ? 0.09 : 0.05);
      this.fx.shake = Math.max(this.fx.shake, big ? 2.6 : 1);
    }
    const mon = (this.room.state as any).monsters.get(m.m);
    if (mon && mon.hp <= 0) {
      sfx('mdeath');
      this.fx.burst(a.u, a.v, 18, [0xffffff, 0xd8d0c0, 0x8a7a68], 100, 20, 0.35);
    }
  }

  private onHitPlayer(m: any) {
    const a = this.actorOf(m.sid);
    if (!a) return;
    a.flash(90, 0xff6a5a);
    this.fx.number(a.u, a.v, String(m.n), m.sh ? '#8fd0ff' : m.sid === this.sid ? '#ff7a6a' : '#e0a8a0', false, 40);
    this.fx.burst(a.u, a.v, 6, [0xff7a6a, 0x8a1a1a], 70, 22, 0.3);
    if (m.sid === this.sid) {
      this.lastCombat = this.time.now;
      sfx('hurt');
      this.fx.shake = Math.max(this.fx.shake, 3);
      const el = document.getElementById('hurt');
      if (el) {
        el.classList.remove('on');
        void el.offsetWidth;
        el.classList.add('on');
      }
    }
  }

  // ─── 지도 창에서 쓰는 값 ─────────────────────────

  dots() {
    const state = this.room.state as any;
    const out: { u: number; v: number; c: string; r: number }[] = [];
    state.monsters.forEach((m: any) => {
      if (m.hp > 0) out.push({ u: m.u, v: m.v, c: m.boss ? '#ff5a4a' : '#d8887a', r: m.boss ? 3 : 1.5 });
    });
    state.players.forEach((p: any, sid: string) => {
      if (sid !== this.sid) out.push({ u: p.u, v: p.v, c: '#8fe89a', r: 2 });
    });
    for (const o of this.map.objects) {
      if (o.type === 'npc') out.push({ u: o.u, v: o.v, c: '#8fd0ff', r: 2 });
      else if (o.type === 'door') out.push({ u: o.u, v: o.v, c: '#ffd25a', r: 3 });
    }
    out.push({ u: this.me.u, v: this.me.v, c: '#ffffff', r: 3 });
    return out;
  }
}

