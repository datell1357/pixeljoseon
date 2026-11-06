// 게임 방: 지도 하나의 실시간 시뮬레이션 (이동 검증, 전투, 몬스터 AI, 드롭, 인스턴스)
import { Room, ServerError, matchMaker, type Client } from '@colyseus/core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSES, SKILLS, expToNext, mitigate, skillMult, type AttackStep, type BaseStats, type ProjSpec, type SkillDef } from '../../shared/classes';
import { blocked, clamp, dirFromVec, dist, isSolid, lineClear, normalize, slideMove } from '../../shared/core';
import { CONSUMABLES, GEAR, RIFT_STOCK, SHOP_STOCK, dropPool, gearKey, rollGear, rollRarity, type Rarity } from '../../shared/items';
import { PERSISTENT_MAPS, type MapData, type SpawnGroup } from '../../shared/mapdata';
import { DESIGN_LEVEL, MONSTERS, riftScale, type MonAttack, type MonDef } from '../../shared/monsters';
import { NPCS, QUEST_BY_ID } from '../../shared/quests';
import * as C from './char';
import type { CharData } from './char';
import * as db from './db';
import * as hub from './hub';
import { LootS, MonS, PlayerS, PropS, RoomStateS } from './schema';

const here = dirname(fileURLToPath(import.meta.url));
const mapCache = new Map<string, MapData>();
export function loadMap(name: string): MapData {
  let m = mapCache.get(name);
  if (!m) {
    m = JSON.parse(readFileSync(join(here, '../../client/public/maps', `${name}.json`), 'utf8')) as MapData;
    mapCache.set(name, m);
  }
  return m;
}

const PLAYER_R = 0.22;
const VALID_ANIMS = new Set(['idle', 'walk', 'attack1', 'attack2', 'attack3', 'cast', 'spin', 'dodge', 'guard', 'hit', 'death']);
const EXITS: Record<string, [string, string]> = {
  hollow: ['woods', 'from_hollow'],
  furnace: ['ashfield', 'from_furnace'],
  rift: ['town', 'from_rift'],
};

interface Buff {
  id: string;
  until: number;
  atk?: number;
  dr?: number;
  crit?: number;
  aspd?: number;
}

export interface PlayerRt {
  sid: string;
  client: Client;
  char: CharData;
  s: PlayerS;
  stats: BaseStats;
  buffs: Buff[];
  cds: Record<string, number>;
  nextAtk: number;
  iframes: number;
  dashUntil: number;
  guardOn: boolean;
  guardStart: number;
  guardUntil: number;
  guardReady: number;
  parryBoost: number;
  shield: number;
  shieldUntil: number;
  slowUntil: number;
  lastMove: number;
  meDirty: boolean;
  meAt: number;
  saveAt: number;
  regenHp: number;
  regenMp: number;
  lastHurt: number;
  bagFullAt: number;
  doorToast: number;
  burnTick: number;
  lastChat: number;
  leaving: boolean;
}

interface MonRt {
  id: string;
  def: MonDef;
  s: MonS;
  group?: SpawnGroup;
  hp: number;
  dmgMul: number;
  expMul: number;
  home: [number, number];
  st: 'spawn' | 'idle' | 'chase' | 'windup' | 'recover' | 'charge' | 'return' | 'dead';
  until: number;
  target?: PlayerRt;
  retarget: number;
  wanderAt: number;
  wander?: [number, number];
  attack?: MonAttack;
  aim: [number, number];
  cds: Record<string, number>;
  stunUntil: number;
  slowUntil: number;
  slowMul: number;
  chargeLeft: number;
  chargeHit: Set<string>;
  path?: [number, number][];
  pathAt: number;
  phase: number;
  speedMul: number;
  temp: boolean;
  lastBy?: PlayerRt;
  hitBy: Set<PlayerRt>;
  rift?: boolean;
}

interface Proj {
  id: number;
  friendly: boolean;
  owner?: PlayerRt;
  dmg: number;
  crit: boolean;
  spec: ProjSpec;
  u: number;
  v: number;
  du: number;
  dv: number;
  left: number;
  pierce: number;
  hit: Set<string>;
  mon?: MonRt;
  mult: number;
}

interface Patch {
  id: number;
  u: number;
  v: number;
  r: number;
  until: number;
  dps: number;
  next: number;
}

interface Trap {
  id: number;
  u: number;
  v: number;
  r: number;
  until: number;
  owner: PlayerRt;
  mult: number;
  stun: number;
}

export class GameRoom extends Room {
  declare state: RoomStateS;
  map!: MapData;
  mapName = '';
  isInstance = false;
  players = new Map<string, PlayerRt>();
  mons = new Map<string, MonRt>();
  private timers: { at: number; fn: () => void }[] = [];
  private projs: Proj[] = [];
  private patches: Patch[] = [];
  private traps: Trap[] = [];
  private respawns: { at: number; group: SpawnGroup }[] = [];
  private now = 0;
  private nextId = 1;
  private partyTick = 0;
  private partyId?: string;
  private partySize = 1;
  private floor = 0;
  private floorClear = false;

  onCreate(options: { map: string; partyId?: string; partySize?: number }) {
    this.mapName = options.map;
    this.map = loadMap(options.map);
    this.isInstance = !!this.map.instance;
    this.partyId = options.partyId;
    this.partySize = options.partySize ?? 1;
    this.maxClients = this.isInstance ? hub.PARTY_MAX : 48;
    this.maxMessagesPerSecond = 90;
    this.state = new RoomStateS();
    this.state.mapName = options.map;
    if (this.isInstance) void this.setPrivate(true);
    this.patchRate = 50;
    this.setMessages();
    this.setSimulationInterval((ms) => this.tick(ms / 1000), 50);
    if (this.mapName === 'rift') {
      // 층은 첫 입장 때 시작
    } else {
      for (const g of this.map.spawns) for (let i = 0; i < g.n; i++) this.spawnFromGroup(g);
    }
  }

  async onAuth(_client: Client, options: { token?: string; charId?: string }) {
    const acc = db.accountByToken(options?.token);
    if (!acc) throw new ServerError(401, '로그인이 필요해요');
    if (typeof options.charId !== 'string') throw new ServerError(400, '캐릭터를 고르세요');
    const owned = db.loadChar(options.charId);
    if (!owned || owned.account !== acc.id) throw new ServerError(403, '캐릭터가 없어요');
    return { account: acc.id };
  }

  onJoin(client: Client, options: { charId: string; arrive?: string }) {
    // 같은 캐릭터가 다른 방에 남아 있으면 먼저 저장하고 내보낸다
    const prior = hub.getOnline(options.charId);
    if (prior) {
      db.saveChar(prior.char);
      hub.unregister(prior.char.id, prior.client);
      prior.client.send('kicked', { text: '다른 곳에서 접속했어요' });
      prior.client.leave(4000);
    }
    const char = db.loadChar(options.charId)!;
    const stats = C.computeStats(char);
    const [u, v] = this.arrivalPoint(char, options.arrive);
    const s = new PlayerS();
    s.name = char.name;
    s.cls = char.cls;
    s.look = char.look;
    s.gear = gearKey(char.equip);
    s.u = u;
    s.v = v;
    s.dir = 0;
    s.anim = 'idle';
    s.maxHp = stats.maxHp;
    s.maxMp = stats.maxMp;
    s.hp = char.hp > 0 ? clamp(char.hp, 1, stats.maxHp) : stats.maxHp;
    s.mp = clamp(char.mp, 0, stats.maxMp);
    s.level = char.level;
    s.dead = false;
    s.party = '';
    s.fx = 0;
    s.shield = 0;
    this.state.players.set(client.sessionId, s);
    const p: PlayerRt = {
      sid: client.sessionId,
      client,
      char,
      s,
      stats,
      buffs: [],
      cds: {},
      nextAtk: 0,
      iframes: this.now + 1.5,
      dashUntil: 0,
      guardOn: false,
      guardStart: 0,
      guardUntil: 0,
      guardReady: 0,
      parryBoost: 0,
      shield: 0,
      shieldUntil: 0,
      slowUntil: 0,
      lastMove: this.now,
      meDirty: true,
      meAt: 0,
      saveAt: this.now + 30,
      regenHp: 0,
      regenMp: 0,
      lastHurt: -99,
      bagFullAt: -99,
      doorToast: -99,
      burnTick: 0,
      lastChat: -99,
      leaving: false,
    };
    this.players.set(client.sessionId, p);
    const o: hub.Online = { char, client, roomId: this.roomId, map: this.mapName, hpRatio: s.hp / s.maxHp };
    hub.register(o);
    s.party = o.party ?? '';
    char.map = PERSISTENT_MAPS.includes(this.mapName) ? this.mapName : char.map;
    if (C.onReach(char, this.mapName)) p.meDirty = true;
    client.send('welcome', { map: this.mapName, title: this.map.title, u, v, sid: client.sessionId, serverNow: this.now });
    this.sendMe(p);
    if (this.mapName === 'rift' && this.floor === 0) this.startFloor(1);
    if (this.mapName === 'rift') client.send('rift', { floor: this.floor, board: db.riftBoard(5) });
  }

  onLeave(client: Client) {
    const p = this.players.get(client.sessionId);
    if (!p) return;
    this.state.players.delete(client.sessionId);
    this.players.delete(client.sessionId);
    this.saveNow(p);
    hub.unregister(p.char.id, client);
    for (const m of this.mons.values()) {
      if (m.target === p) m.target = undefined;
      m.hitBy.delete(p);
    }
    for (const t of this.traps) if (t.owner === p) t.until = 0;
  }

  onDispose() {
    for (const p of this.players.values()) this.saveNow(p);
    const party = hub.getParty(this.partyId);
    if (party && party.instances[this.mapName] === this.roomId) delete party.instances[this.mapName];
  }

  private saveNow(p: PlayerRt) {
    const c = p.char;
    if (PERSISTENT_MAPS.includes(this.mapName)) {
      c.map = this.mapName;
      c.u = p.s.u;
      c.v = p.s.v;
    }
    c.hp = p.s.dead ? Math.round(p.s.maxHp * 0.5) : p.s.hp;
    c.mp = p.s.mp;
    db.saveChar(c);
    p.saveAt = this.now + 30;
  }

  private arrivalPoint(char: CharData, arrive?: string): [number, number] {
    const named = arrive ? this.map.objects.find((o) => o.type === 'arrive' && o.name === arrive) : undefined;
    if (named) return this.openNear(named.u, named.v);
    if (char.map === this.mapName && char.u >= 0 && !blocked(this.map.solid, char.u, char.v, PLAYER_R)) return [char.u, char.v];
    const def = this.map.objects.find((o) => o.type === 'arrive' && o.name === 'start') ?? this.map.objects.find((o) => o.type === 'arrive');
    return def ? this.openNear(def.u, def.v) : [this.map.w / 2, this.map.h / 2];
  }

  private openNear(u: number, v: number, spread = 0.8): [number, number] {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = spread * Math.random();
      const x = u + Math.cos(a) * r;
      const y = v + Math.sin(a) * r;
      if (!blocked(this.map.solid, x, y, PLAYER_R)) return [x, y];
    }
    return [u, v];
  }

  // ─── 메시지 ─────────────────────────────────────────

  private on<T>(type: string, fn: (p: PlayerRt, msg: T, client: Client) => void) {
    this.onMessage(type, (client: Client, msg: T) => {
      const p = this.players.get(client.sessionId);
      if (p && !p.leaving) fn(p, msg, client);
    });
  }

  private setMessages() {
    this.on<{ u: number; v: number; dir: number; anim: string }>('move', (p, m) => this.onMove(p, m));
    this.on<{ aim: [number, number]; step: number }>('attack', (p, m) => this.onAttack(p, m));
    this.on<{ id: string; aim: [number, number]; at?: [number, number] }>('skill', (p, m) => this.onSkill(p, m));
    this.on<{ dir: [number, number] }>('dodge', (p, m) => this.onDodge(p, m));
    this.on<{ on: boolean }>('guard', (p, m) => this.onGuard(p, m));
    this.on<{ i: number }>('quick', (p, m) => this.onQuick(p, m.i));
    this.on<{ i: number }>('useBag', (p, m) => this.useBag(p, m.i));
    this.on<{ i: number }>('equip', (p, m) => this.result(p, C.equipFromBag(p.char, m.i), true));
    this.on<{ slot: 'weapon' }>('unequip', (p, m) => this.result(p, C.unequip(p.char, m.slot), true));
    this.on('bagSort', (p) => {
      C.sortBag(p.char);
      p.meDirty = true;
    });
    this.on<{ a: number; b: number }>('bagMove', (p, m) => {
      const { bag } = p.char;
      if (!(m.a in bag) || !(m.b in bag)) return;
      [bag[m.a], bag[m.b]] = [bag[m.b], bag[m.a]];
      p.meDirty = true;
    });
    this.on<{ i: number; id: string | null }>('quickSet', (p, m) => {
      if (m.i < 0 || m.i > 3) return;
      if (m.id && !CONSUMABLES[m.id]) return;
      p.char.quick[m.i] = m.id;
      p.meDirty = true;
    });
    this.on<{ id: string; n?: number; npc: string }>('buy', (p, m) => {
      if (!this.nearNpc(p, m.npc) || !NPCS[m.npc]?.shop) return;
      if (!SHOP_STOCK.includes(m.id)) return;
      this.result(p, C.buy(p.char, m.id, clamp(Math.floor(m.n ?? 1), 1, 99)), false);
      p.client.send('sfx', { id: 'coin' });
    });
    this.on<{ i: number; n?: number; npc: string }>('sell', (p, m) => {
      if (!this.nearNpc(p, m.npc) || !NPCS[m.npc]?.shop) return;
      this.result(p, C.sell(p.char, m.i, m.n), false);
      p.client.send('sfx', { id: 'coin' });
    });
    this.on<{ i: number; npc: string }>('riftBuy', (p, m) => {
      if (!this.nearNpc(p, m.npc)) return;
      const stock = RIFT_STOCK[m.i];
      if (!stock) return;
      if (C.countItem(p.char, 'rift_token') < stock.tokens) return this.toast(p, '저승 엽전이 모자라요', 'warn');
      if (C.freeSlots(p.char) < 1) return this.toast(p, '가방이 가득 찼어요', 'warn');
      C.removeItem(p.char, 'rift_token', stock.tokens);
      C.addGear(p.char, rollGear(stock.base, stock.rarity));
      p.meDirty = true;
      p.client.send('sfx', { id: 'coin' });
    });
    this.on<{ id: string; npc: string }>('qAccept', (p, m) => {
      const q = QUEST_BY_ID[m.id];
      if (!q || q.giver !== m.npc || !this.nearNpc(p, m.npc)) return;
      this.result(p, C.acceptQuest(p.char, m.id), true);
      if (C.onReach(p.char, this.mapName)) p.meDirty = true;
      p.client.send('sfx', { id: 'quest' });
    });
    this.on<{ id: string; npc: string }>('qTurnIn', (p, m) => {
      const q = QUEST_BY_ID[m.id];
      if (!q || q.giver !== m.npc || !this.nearNpc(p, m.npc)) return;
      const r = C.turnInQuest(p.char, m.id);
      this.result(p, r, true);
      if (r.ok) {
        this.toast(p, `퀘스트 완료 · ${q.title}`, 'good');
        p.client.send('sfx', { id: 'quest' });
        if (r.levels) this.onLevelUp(p, r.levels);
      }
    });
    this.on<{ id: string }>('skillUp', (p, m) => this.result(p, C.skillUp(p.char, m.id), true));
    this.on<{ npc: string }>('skillReset', (p) => this.result(p, C.resetSkills(p.char), true));
    this.on<{ where: 'bag' | 'weapon'; i: number; npc: string }>('enhance', (p, m) => {
      if (!this.nearNpc(p, m.npc) || !NPCS[m.npc]?.forge) return;
      const r = C.enhance(p.char, m.where, m.i);
      p.meDirty = true;
      if (!r.ok) return this.toast(p, r.msg, 'warn');
      this.refreshStats(p);
      p.client.send('enhanced', { success: r.success, plus: r.plus });
    });
    this.on<{ i: number; npc: string }>('salvage', (p, m) => {
      if (!this.nearNpc(p, m.npc) || !NPCS[m.npc]?.forge) return;
      const r = C.salvage(p.char, m.i);
      p.meDirty = true;
      if (!r.ok) return this.toast(p, r.msg, 'warn');
      this.toast(p, `등불 조각 ${r.shards}개를 얻었어요`, 'good');
      p.client.send('sfx', { id: 'forge' });
    });
    this.on<{ i: number; npc: string }>('vaultPut', (p, m) => {
      if (!this.nearNpc(p, m.npc) || !NPCS[m.npc]?.vault) return;
      const it = p.char.bag[m.i];
      const free = p.char.vault.findIndex((x) => !x);
      if (!it) return;
      if (free < 0) return this.toast(p, '창고가 가득 찼어요', 'warn');
      p.char.vault[free] = it;
      p.char.bag[m.i] = null;
      p.meDirty = true;
    });
    this.on<{ i: number; npc: string }>('vaultTake', (p, m) => {
      if (!this.nearNpc(p, m.npc) || !NPCS[m.npc]?.vault) return;
      const it = p.char.vault[m.i];
      const free = p.char.bag.findIndex((x) => !x);
      if (!it) return;
      if (free < 0) return this.toast(p, '가방이 가득 찼어요', 'warn');
      p.char.bag[free] = it;
      p.char.vault[m.i] = null;
      p.meDirty = true;
    });
    this.on<{ name: string }>('door', (p, m) => void this.onDoor(p, m.name));
    this.on<{ name: string }>('way', (p, m) => this.onWay(p, m.name));
    this.on('leaveInstance', (p) => {
      const exit = EXITS[this.mapName];
      if (exit) this.sendTo(p, exit[0], exit[1]);
    });
    this.on<{ id: string }>('propUse', (p, m) => this.onPropUse(p, m.id));
    this.on('respawn', (p) => this.onRespawn(p));
    this.on<{ text: string; ch?: 'all' | 'party' }>('chat', (p, m) => this.onChat(p, m));
    this.on<{ name: string }>('partyInvite', (p, m) => {
      const o = hub.getOnline(p.char.id);
      if (!o) return;
      const err = hub.invite(o, String(m.name ?? ''));
      this.toast(p, err ?? `${m.name}님을 초대했어요`, err ? 'warn' : 'good');
    });
    this.on<{ yes: boolean }>('partyAnswer', (p, m) => {
      const o = hub.getOnline(p.char.id);
      if (!o) return;
      hub.answerInvite(o, !!m.yes);
      p.s.party = o.party ?? '';
    });
    this.on('partyLeave', (p) => {
      hub.leaveParty(p.char.id);
      p.s.party = '';
    });
    // 시각 점검용. LANTERN_DEV=1로 띄운 서버에서만 켜진다.
    if (process.env.LANTERN_DEV === '1') {
      this.on<{ level?: number; tp?: [number, number]; goto?: string; arrive?: string; full?: boolean; hurt?: number; floor?: number; killAll?: boolean; gold?: number; item?: [string, number]; kill?: boolean }>('dev', (p, m) => {
        if (m.killAll) for (const x of [...this.mons.values()]) if (x.st !== 'dead' && x.st !== 'spawn') this.killMon(x, p);
        if (m.kill) this.killPlayer(p);
        if (m.gold) {
          p.char.gold += m.gold;
          p.meDirty = true;
        }
        if (m.item) {
          C.addStack(p.char, m.item[0], m.item[1]);
          p.meDirty = true;
        }
        if (m.level) {
          p.char.level = m.level;
          for (const id of CLASSES[p.char.cls].skills) {
            const sk = SKILLS[id];
            if (m.level >= sk.req) p.char.skills[id] = Math.min(sk.maxRank, 3);
          }
          this.refreshStats(p);
          p.meDirty = true;
        }
        if (m.tp) {
          p.s.u = m.tp[0];
          p.s.v = m.tp[1];
          p.dashUntil = this.now + 0.3;
          p.client.send('tp', { u: m.tp[0], v: m.tp[1], floor: 1 });
        }
        if (m.full) {
          p.s.hp = p.s.maxHp;
          p.s.mp = p.s.maxMp;
        }
        if (m.hurt) p.s.hp = Math.max(1, p.s.hp - m.hurt);
        if (m.floor) this.startFloor(m.floor);
        if (m.goto) void this.findInstanceOrMap(p, m.goto, m.arrive);
      });
    }
  }

  private nearNpc(p: PlayerRt, npc: string) {
    const o = this.map.objects.find((x) => x.type === 'npc' && x.name === npc);
    if (!o) return false;
    return dist(p.s.u, p.s.v, o.u, o.v) <= (o.r ?? 2.6) + 1.2;
  }

  private toast(p: PlayerRt, text: string, kind: 'good' | 'warn' | 'info' = 'info') {
    p.client.send('toast', { text, kind });
  }

  private result(p: PlayerRt, r: C.Result, stats: boolean) {
    if (!r.ok) {
      this.toast(p, r.msg, 'warn');
      return;
    }
    if (r.msg) this.toast(p, r.msg, 'info');
    if (stats) this.refreshStats(p);
    p.meDirty = true;
  }

  private refreshStats(p: PlayerRt) {
    p.stats = C.computeStats(p.char);
    p.s.maxHp = p.stats.maxHp;
    p.s.maxMp = p.stats.maxMp;
    p.s.level = p.char.level;
    p.s.gear = gearKey(p.char.equip);
    if (p.s.hp > p.s.maxHp) p.s.hp = p.s.maxHp;
    if (p.s.mp > p.s.maxMp) p.s.mp = p.s.maxMp;
    p.meDirty = true;
  }

  sendMe(p: PlayerRt) {
    const c = p.char;
    p.client.send('me', {
      name: c.name,
      cls: c.cls,
      look: c.look,
      level: c.level,
      exp: c.exp,
      expNext: expToNext(c.level),
      gold: c.gold,
      bag: c.bag,
      vault: c.vault,
      equip: c.equip,
      skills: c.skills,
      points: C.freePoints(c),
      quick: c.quick,
      quests: c.quests,
      stats: p.stats,
      riftBest: c.riftBest,
      kills: c.kills,
    });
    p.meDirty = false;
    p.meAt = this.now;
  }

  // ─── 이동·행동 ─────────────────────────────────────

  private speedOf(p: PlayerRt) {
    const slow = this.now < p.slowUntil ? 0.6 : 1;
    const guard = p.guardOn ? 0.45 : 1;
    return p.stats.speed * slow * guard;
  }

  private onMove(p: PlayerRt, m: { u: number; v: number; dir: number; anim: string }) {
    if (p.s.dead) return;
    if (!Number.isFinite(m.u) || !Number.isFinite(m.v)) return;
    const dt = Math.max(0.03, this.now - p.lastMove);
    p.lastMove = this.now;
    const d = dist(p.s.u, p.s.v, m.u, m.v);
    const dashing = this.now < p.dashUntil;
    const allowed = dashing ? 12 : Math.max(0.5, p.stats.speed * dt * 1.7 + 0.5);
    if (d > allowed || (blocked(this.map.solid, m.u, m.v, 0.06) && !dashing)) {
      p.client.send('tp', { u: p.s.u, v: p.s.v });
      return;
    }
    p.s.u = m.u;
    p.s.v = m.v;
    p.s.dir = clamp(Math.floor(m.dir) || 0, 0, 7);
    if (VALID_ANIMS.has(m.anim) && p.s.anim !== 'death') p.s.anim = m.anim;
  }

  private buffVal(p: PlayerRt, k: 'atk' | 'dr' | 'crit' | 'aspd') {
    let v = 0;
    for (const b of p.buffs) v += b[k] ?? 0;
    return v;
  }

  private aspd(p: PlayerRt) {
    return p.stats.aspd + this.buffVal(p, 'aspd');
  }

  private rollDamage(p: PlayerRt, mult: number): { raw: number; crit: boolean } {
    const atk = p.stats.atk * (1 + this.buffVal(p, 'atk'));
    let raw = atk * mult * (0.92 + Math.random() * 0.16);
    const crit = Math.random() < p.stats.crit + this.buffVal(p, 'crit');
    if (crit) raw *= p.stats.critDmg;
    if (this.now < p.parryBoost) {
      raw *= 2;
      p.parryBoost = 0;
    }
    return { raw, crit };
  }

  private onAttack(p: PlayerRt, m: { aim: [number, number]; step: number }) {
    if (p.s.dead || this.now < p.nextAtk - 0.1) return;
    if (this.map.safe) return;
    const cls = CLASSES[p.char.cls];
    const step: AttackStep = cls.combo[clamp(Math.floor(m.step) || 0, 0, cls.combo.length - 1)];
    const [au, av] = normalize(m.aim?.[0] ?? 1, m.aim?.[1] ?? 0);
    const sp = this.aspd(p);
    p.nextAtk = this.now + (step.dur / sp) * 0.9;
    this.broadcast('act', { sid: p.sid, anim: step.anim, dur: step.dur / sp, aim: [au, av], cls: p.char.cls }, { except: p.client });
    this.later(step.impact / sp, () => {
      if (p.s.dead || !this.players.has(p.sid)) return;
      if (step.kind === 'melee') {
        this.meleeHit(p, au, av, step.reach!, step.arc!, step.mult, step.knock ?? 0);
        this.broadcast('swing', { sid: p.sid, aim: [au, av], step: step.anim, reach: step.reach });
      } else if (step.proj) {
        const { raw, crit } = this.rollDamage(p, step.mult);
        this.spawnProj({ friendly: true, owner: p, spec: step.proj, u: p.s.u, v: p.s.v, du: au, dv: av, dmg: raw, crit, mult: step.mult });
      }
    });
  }

  private meleeHit(p: PlayerRt, au: number, av: number, reach: number, arc: number, mult: number, knock: number, stun = 0) {
    const cos = Math.cos(((arc / 2) * Math.PI) / 180);
    for (const m of this.mons.values()) {
      if (m.st === 'dead' || m.st === 'spawn') continue;
      const du = m.s.u - p.s.u;
      const dv = m.s.v - p.s.v;
      const d = Math.hypot(du, dv);
      if (d > reach + m.def.r) continue;
      if (d > 0.25 && (du * au + dv * av) / d < cos) continue;
      const { raw, crit } = this.rollDamage(p, mult);
      this.damageMon(m, raw, crit, p, { knock, stun, kdir: [du, dv] });
    }
  }

  private circleHit(p: PlayerRt, u: number, v: number, r: number, mult: number, o: { knock?: number; stun?: number; slow?: number; col?: string } = {}) {
    for (const m of this.mons.values()) {
      if (m.st === 'dead' || m.st === 'spawn') continue;
      const d = dist(m.s.u, m.s.v, u, v);
      if (d > r + m.def.r) continue;
      const { raw, crit } = this.rollDamage(p, mult);
      this.damageMon(m, raw, crit, p, { knock: o.knock, stun: o.stun, slow: o.slow, kdir: [m.s.u - u, m.s.v - v] });
    }
  }

  private onSkill(p: PlayerRt, msg: { id: string; aim: [number, number]; at?: [number, number] }) {
    if (p.s.dead) return;
    const sk: SkillDef | undefined = SKILLS[msg.id];
    if (!sk || sk.cls !== p.char.cls) return;
    const rank = p.char.skills[sk.id] ?? 0;
    if (rank <= 0) return this.toast(p, '아직 배우지 않았어요', 'warn');
    if (this.map.safe) return this.toast(p, '마을에서는 쓸 수 없어요', 'warn');
    if (this.now < (p.cds[sk.id] ?? 0) - 0.1) return;
    if (p.s.mp < sk.mp) {
      p.client.send('skillFail', { id: sk.id, why: 'mp' });
      return;
    }
    p.s.mp -= sk.mp;
    const cd = sk.cd * (1 - p.stats.cdr);
    p.cds[sk.id] = this.now + cd;
    p.client.send('cd', { id: sk.id, t: cd });
    p.nextAtk = this.now + sk.dur;
    const [au, av] = normalize(msg.aim?.[0] ?? 1, msg.aim?.[1] ?? 0);
    const mult = skillMult(sk, rank);
    let at: [number, number] = [p.s.u + au * 3, p.s.v + av * 3];
    if (sk.range) {
      const tu = Number(msg.at?.[0]);
      const tv = Number(msg.at?.[1]);
      if (Number.isFinite(tu) && Number.isFinite(tv)) at = [tu, tv];
      const d = dist(p.s.u, p.s.v, at[0], at[1]);
      if (d > sk.range) {
        const [nu, nv] = normalize(at[0] - p.s.u, at[1] - p.s.v);
        at = [p.s.u + nu * sk.range, p.s.v + nv * sk.range];
      }
    }
    const payload: Record<string, unknown> = { sid: p.sid, id: sk.id, aim: [au, av], at, dur: sk.dur, anim: sk.anim, rank };

    if (sk.kind === 'charge') {
      const [eu, ev] = this.castRay(p.s.u, p.s.v, au, av, sk.reach!);
      payload.dash = [eu, ev];
      p.dashUntil = this.now + sk.dur + 0.2;
      p.iframes = Math.max(p.iframes, this.now + sk.dur * 0.7);
      this.later(sk.dur * 0.6, () => {
        if (p.s.dead) return;
        this.lineHit(p, p.s.u - au * sk.reach!, p.s.v - av * sk.reach!, eu, ev, sk.r!, mult, sk);
      });
    } else if (sk.kind === 'leapSmash') {
      if (blocked(this.map.solid, at[0], at[1], PLAYER_R) || !lineClear(this.map.solid, p.s.u, p.s.v, at[0], at[1])) {
        at = this.castRay(p.s.u, p.s.v, ...normalize(at[0] - p.s.u, at[1] - p.s.v), dist(p.s.u, p.s.v, at[0], at[1]));
      }
      payload.at = at;
      payload.dash = at;
      p.dashUntil = this.now + sk.dur + 0.2;
      p.iframes = Math.max(p.iframes, this.now + sk.impact + 0.1);
    }

    this.broadcast('cast', payload);

    this.later(sk.impact, () => {
      if (p.s.dead || !this.players.has(p.sid)) return;
      switch (sk.kind) {
        case 'whirl':
          this.circleHit(p, p.s.u, p.s.v, sk.r!, mult, { knock: sk.knock });
          break;
        case 'cone':
          this.meleeHit(p, au, av, sk.reach!, sk.arc!, mult, sk.knock ?? 0, sk.stun ?? 0);
          break;
        case 'leapSmash':
          this.circleHit(p, at[0], at[1], sk.r!, mult, { knock: sk.knock, stun: sk.stun });
          this.broadcast('blast', { u: at[0], v: at[1], r: sk.r, col: 'gold', shake: 1 });
          break;
        case 'proj': {
          const { raw, crit } = this.rollDamage(p, mult);
          this.spawnProj({ friendly: true, owner: p, spec: sk.proj!, u: p.s.u, v: p.s.v, du: au, dv: av, dmg: raw, crit, mult });
          break;
        }
        case 'fan': {
          const n = sk.count!;
          const arc = (sk.arc! * Math.PI) / 180;
          const base = Math.atan2(av, au);
          for (let i = 0; i < n; i++) {
            const a = base - arc / 2 + (arc * i) / (n - 1);
            const { raw, crit } = this.rollDamage(p, mult);
            this.spawnProj({ friendly: true, owner: p, spec: sk.proj!, u: p.s.u, v: p.s.v, du: Math.cos(a), dv: Math.sin(a), dmg: raw, crit, mult });
          }
          break;
        }
        case 'nova':
          this.circleHit(p, p.s.u, p.s.v, sk.r!, mult, { stun: sk.stun, slow: sk.slow });
          this.broadcast('blast', { u: p.s.u, v: p.s.v, r: sk.r, col: 'ice' });
          break;
        case 'ground': {
          const [u, v] = at;
          this.broadcast('warn', { shape: 'circle', u, v, r: sk.r, t: sk.delay, friendly: true });
          this.later(sk.delay!, () => {
            this.circleHit(p, u, v, sk.r!, mult, { knock: sk.knock });
            this.broadcast('blast', { u, v, r: sk.r, col: 'fire', shake: 1 });
          });
          break;
        }
        case 'groundMulti': {
          const n = sk.count!;
          const [cu, cv] = at;
          const col = sk.cls === 'dosa' ? 'star' : 'arrow';
          this.broadcast('warn', { shape: 'circle', u: cu, v: cv, r: sk.r, t: sk.delay! + n * 0.17, friendly: true, soft: true });
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * sk.r!;
            const u = cu + Math.cos(a) * rr;
            const v = cv + Math.sin(a) * rr;
            this.later(sk.delay! + i * 0.17, () => {
              this.circleHit(p, u, v, 1.35, mult);
              this.broadcast('blast', { u, v, r: 1.35, col });
            });
          }
          break;
        }
        case 'buff':
          this.applyBuff(p, sk, rank);
          break;
        case 'shield': {
          const amount = Math.round(p.stats.atk * sk.shield! * (1 + 0.25 * (rank - 1)));
          p.shield = amount;
          p.shieldUntil = this.now + 12;
          p.s.shield = amount;
          this.broadcast('buffFx', { sid: p.sid, id: sk.id });
          break;
        }
        case 'trap': {
          const t: Trap = { id: this.nextId++, u: at[0], v: at[1], r: sk.r!, until: this.now + 20, owner: p, mult, stun: sk.stun! };
          this.traps.push(t);
          this.broadcast('trap', { id: t.id, u: t.u, v: t.v, r: t.r, ttl: 20 });
          break;
        }
        default:
          break;
      }
    });
  }

  private applyBuff(p: PlayerRt, sk: SkillDef, rank: number) {
    const b = sk.buff!;
    const scale = 1 + 0.15 * (rank - 1);
    const targets: PlayerRt[] = [p];
    if (b.party) {
      const pid = hub.getOnline(p.char.id)?.party;
      if (pid) for (const x of this.players.values()) if (x !== p && hub.getOnline(x.char.id)?.party === pid && dist(x.s.u, x.s.v, p.s.u, p.s.v) < 12) targets.push(x);
    }
    for (const t of targets) {
      t.buffs = t.buffs.filter((x) => x.id !== sk.id);
      t.buffs.push({ id: sk.id, until: this.now + b.dur, atk: (b.atk ?? 0) * scale, dr: (b.dr ?? 0) * scale, crit: (b.crit ?? 0) * scale, aspd: (b.aspd ?? 0) * scale });
      t.client.send('buff', { id: sk.id, t: b.dur });
      this.broadcast('buffFx', { sid: t.sid, id: sk.id });
    }
  }

  private lineHit(p: PlayerRt, u0: number, v0: number, u1: number, v1: number, r: number, mult: number, sk: SkillDef) {
    for (const m of this.mons.values()) {
      if (m.st === 'dead' || m.st === 'spawn') continue;
      if (distToSeg(m.s.u, m.s.v, u0, v0, u1, v1) > r + m.def.r) continue;
      const { raw, crit } = this.rollDamage(p, mult);
      this.damageMon(m, raw, crit, p, { knock: sk.knock, stun: sk.stun, kdir: [m.s.u - p.s.u, m.s.v - p.s.v] });
    }
  }

  private castRay(u: number, v: number, du: number, dv: number, len: number): [number, number] {
    let lastU = u;
    let lastV = v;
    const n = Math.ceil(len / 0.2);
    for (let i = 1; i <= n; i++) {
      const x = u + (du * len * i) / n;
      const y = v + (dv * len * i) / n;
      if (blocked(this.map.solid, x, y, PLAYER_R)) break;
      lastU = x;
      lastV = y;
    }
    return [lastU, lastV];
  }

  private onDodge(p: PlayerRt, m: { dir: [number, number] }) {
    if (p.s.dead) return;
    const d = CLASSES[p.char.cls].dodge;
    if (this.now < (p.cds.dodge ?? 0) - 0.1) return;
    const cd = d.cd * (1 - p.stats.cdr);
    p.cds.dodge = this.now + cd;
    p.iframes = this.now + d.iframes;
    p.dashUntil = this.now + d.dur + 0.3;
    p.guardOn = false;
    p.client.send('cd', { id: 'dodge', t: cd });
    const [du, dv] = normalize(m.dir?.[0] ?? 1, m.dir?.[1] ?? 0);
    this.broadcast('dodge', { sid: p.sid, kind: d.kind, dir: [du, dv], dur: d.dur }, { except: p.client });
  }

  private onGuard(p: PlayerRt, m: { on: boolean }) {
    if (p.s.dead) return;
    const g = CLASSES[p.char.cls].guard;
    if (m.on) {
      if (this.now < p.guardReady - 0.05) return;
      p.guardOn = true;
      p.guardStart = this.now;
      p.guardUntil = g.maxHold ? this.now + g.maxHold : Infinity;
      this.broadcast('guardFx', { sid: p.sid, on: true }, { except: p.client });
    } else if (p.guardOn) {
      this.endGuard(p);
    }
  }

  private endGuard(p: PlayerRt) {
    const g = CLASSES[p.char.cls].guard;
    p.guardOn = false;
    p.guardReady = this.now + g.cd;
    p.client.send('cd', { id: 'guard', t: g.cd });
    this.broadcast('guardFx', { sid: p.sid, on: false }, { except: p.client });
  }

  private onQuick(p: PlayerRt, i: number) {
    const id = p.char.quick[i];
    if (!id) return;
    const slot = p.char.bag.findIndex((x) => x?.kind === 'stack' && x.id === id);
    if (slot < 0) return this.toast(p, '물약이 없어요', 'warn');
    this.useBag(p, slot);
  }

  private useBag(p: PlayerRt, i: number) {
    if (p.s.dead) return;
    const it = p.char.bag[i];
    if (!it) return;
    if (it.kind === 'gear') {
      this.result(p, C.equipFromBag(p.char, i), true);
      p.client.send('sfx', { id: 'equip' });
      return;
    }
    const d = CONSUMABLES[it.id];
    if (!d || d.material) return;
    const key = d.home ? 'home' : d.hp ? 'potHp' : 'potMp';
    if (this.now < (p.cds[key] ?? 0)) return;
    p.cds[key] = this.now + (d.cd ?? 1);
    p.client.send('cd', { id: key, t: d.cd ?? 1 });
    if (d.hp) {
      const amount = Math.min(d.hp, p.s.maxHp - p.s.hp);
      p.s.hp += amount;
      this.broadcast('heal', { sid: p.sid, n: amount, kind: 'hp' });
    }
    if (d.mp) {
      const amount = Math.min(d.mp, p.s.maxMp - p.s.mp);
      p.s.mp += amount;
      this.broadcast('heal', { sid: p.sid, n: amount, kind: 'mp' });
    }
    if (d.home) this.sendTo(p, 'town', 'start');
    it.n -= 1;
    if (it.n <= 0) p.char.bag[i] = null;
    p.meDirty = true;
  }

  private async onDoor(p: PlayerRt, name: string) {
    const o = this.map.objects.find((x) => x.type === 'door' && x.name === name);
    if (!o || !o.target || p.s.dead) return;
    if (dist(p.s.u, p.s.v, o.u, o.v) > (o.r ?? 1.3) + 1.2) return;
    if (o.minLevel && p.char.level < o.minLevel) return this.doorDeny(p, `${o.minLevel}레벨부터 들어갈 수 있어요`);
    if (o.needQuest && !p.char.quests.done.includes(o.needQuest)) return this.doorDeny(p, `먼저 「${QUEST_BY_ID[o.needQuest].title}」을 끝내세요`);
    if (o.instance) {
      p.leaving = true;
      try {
        const roomId = await this.findInstance(p, o.target);
        p.client.send('goto', { map: o.target, arrive: o.arrive, roomId });
      } catch {
        p.leaving = false;
        this.toast(p, '입구가 열리지 않았어요', 'warn');
      }
    } else {
      this.sendTo(p, o.target, o.arrive);
    }
  }

  private doorDeny(p: PlayerRt, text: string) {
    if (this.now - p.doorToast > 3) {
      p.doorToast = this.now;
      this.toast(p, text, 'warn');
    }
  }

  private async findInstance(p: PlayerRt, map: string): Promise<string> {
    const o = hub.getOnline(p.char.id);
    const party = hub.getParty(o?.party);
    if (party?.instances[map]) {
      const existing = await matchMaker.query({ roomId: party.instances[map] });
      if (existing.length && existing[0].clients < hub.PARTY_MAX && !existing[0].locked) return party.instances[map];
      delete party.instances[map];
    }
    const created = await matchMaker.createRoom('instance', { map, partyId: party?.id, partySize: party?.members.length ?? 1 });
    if (party) party.instances[map] = created.roomId;
    return created.roomId;
  }

  private async findInstanceOrMap(p: PlayerRt, map: string, arrive?: string) {
    if (loadMap(map).instance) {
      p.leaving = true;
      p.client.send('goto', { map, arrive, roomId: await this.findInstance(p, map) });
    } else {
      this.sendTo(p, map, arrive);
    }
  }

  private sendTo(p: PlayerRt, map: string, arrive?: string) {
    p.leaving = true;
    p.client.send('goto', { map, arrive });
  }

  private onWay(p: PlayerRt, name: string) {
    const o = this.map.objects.find((x) => x.type === 'waystone' && x.name === name);
    if (!o || dist(p.s.u, p.s.v, o.u, o.v) > (o.r ?? 2.2) + 1.2) return;
    const key = `${this.mapName}:${name}`;
    const first = p.char.lastWay !== key;
    p.char.lastWay = key;
    p.s.hp = p.s.maxHp;
    p.s.mp = p.s.maxMp;
    if (first) {
      this.toast(p, '등불을 밝혔어요 · 쓰러지면 여기서 일어나요', 'good');
      this.broadcast('wayLit', { name, sid: p.sid });
    }
  }

  private onRespawn(p: PlayerRt) {
    if (!p.s.dead) return;
    if (this.mapName === 'rift') return this.sendTo(p, 'town', 'start');
    if (this.isInstance) {
      const def = this.map.objects.find((o) => o.type === 'arrive');
      if (def) this.revive(p, def.u, def.v);
      return;
    }
    const way = p.char.lastWay?.split(':');
    if (way && way[0] === this.mapName) {
      const o = this.map.objects.find((x) => x.type === 'waystone' && x.name === way[1]);
      if (o) {
        const [u, v] = this.openNear(o.u + 1, o.v + 1, 1.4);
        return this.revive(p, u, v);
      }
    }
    if (this.mapName === 'town') {
      const def = this.map.objects.find((o) => o.type === 'arrive' && o.name === 'start')!;
      return this.revive(p, def.u, def.v);
    }
    this.sendTo(p, 'town', 'start');
  }

  private revive(p: PlayerRt, u: number, v: number) {
    p.s.dead = false;
    p.s.hp = Math.round(p.s.maxHp * 0.6);
    p.s.mp = Math.round(p.s.maxMp * 0.6);
    p.s.u = u;
    p.s.v = v;
    p.s.anim = 'idle';
    p.iframes = this.now + 2;
    p.dashUntil = this.now + 0.5;
    p.client.send('tp', { u, v, revive: true });
  }

  private onChat(p: PlayerRt, m: { text: string; ch?: 'all' | 'party' }) {
    const text = String(m.text ?? '').trim().slice(0, 120);
    if (!text || this.now - p.lastChat < 0.5) return;
    p.lastChat = this.now;
    if (m.ch === 'party') {
      const o = hub.getOnline(p.char.id);
      if (!hub.broadcastChat(p.char.name, text, 'party', o?.party)) this.toast(p, '파티에 있지 않아요', 'warn');
      return;
    }
    hub.broadcastChat(p.char.name, text, 'all');
    this.broadcast('bubble', { sid: p.sid, text });
  }

  private onPropUse(p: PlayerRt, id: string) {
    const prop = this.state.props.get(id);
    if (!prop || dist(p.s.u, p.s.v, prop.u, prop.v) > prop.r + 1.2) return;
    if (prop.kind === 'rift_next') {
      if (!this.floorClear) return;
      this.startFloor(this.floor + 1);
    } else if (prop.kind === 'exit') {
      const exit = EXITS[this.mapName];
      if (exit) this.sendTo(p, exit[0], exit[1]);
    }
  }

  // ─── 시간 ─────────────────────────────────────────

  private later(t: number, fn: () => void) {
    this.timers.push({ at: this.now + t, fn });
  }

  private tick(dt: number) {
    this.now += dt;
    const { now } = this;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= now);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > now);
        for (const t of due) t.fn();
      }
    }
    for (const p of this.players.values()) this.tickPlayer(p, dt);
    if (this.players.size > 0) {
      for (const m of this.mons.values()) this.tickMon(m, dt);
    }
    this.tickProjs(dt);
    this.tickPatches();
    this.tickTraps();
    if (this.respawns.length) {
      const due = this.respawns.filter((r) => r.at <= now);
      if (due.length) {
        this.respawns = this.respawns.filter((r) => r.at > now);
        for (const r of due) this.spawnFromGroup(r.group);
      }
    }
    this.partyTick -= dt;
    if (this.partyTick <= 0) {
      this.partyTick = 1;
      const seen = new Set<string>();
      for (const p of this.players.values()) {
        const o = hub.getOnline(p.char.id);
        if (!o) continue;
        o.hpRatio = p.s.hp / p.s.maxHp;
        p.s.party = o.party ?? '';
        if (o.party) seen.add(o.party);
      }
      for (const id of seen) hub.sendPartyState(id);
    }
  }

  private tickPlayer(p: PlayerRt, dt: number) {
    const { now } = this;
    if (p.meDirty && now - p.meAt > 0.15) this.sendMe(p);
    if (now > p.saveAt) this.saveNow(p);
    if (p.buffs.length && p.buffs.some((b) => b.until <= now)) p.buffs = p.buffs.filter((b) => b.until > now);
    if (p.shield > 0 && now > p.shieldUntil) {
      p.shield = 0;
      p.s.shield = 0;
    }
    if (p.guardOn && now > p.guardUntil) this.endGuard(p);
    let fx = 0;
    if (p.shield > 0) fx |= 1;
    for (const b of p.buffs) fx |= b.atk ? 2 : b.crit ? 4 : 0;
    if (p.guardOn) fx |= 8;
    if (now < p.slowUntil) fx |= 16;
    if (p.s.fx !== fx) p.s.fx = fx;
    if (p.s.dead) return;
    // 회복: 싸우는 중이 아니면 더 빠르다
    const idle = now - p.lastHurt > 6 ? 3.5 : 1;
    p.regenHp += p.stats.regenHp * idle * dt * (this.map.safe ? 4 : 1);
    p.regenMp += p.stats.regenMp * idle * dt * (this.map.safe ? 4 : 1);
    if (p.regenHp >= 1) {
      const n = Math.floor(p.regenHp);
      p.regenHp -= n;
      if (p.s.hp < p.s.maxHp) p.s.hp = Math.min(p.s.maxHp, p.s.hp + n);
    }
    if (p.regenMp >= 1) {
      const n = Math.floor(p.regenMp);
      p.regenMp -= n;
      if (p.s.mp < p.s.maxMp) p.s.mp = Math.min(p.s.maxMp, p.s.mp + n);
    }
    // 드롭 자동 줍기
    this.state.loot.forEach((l, id) => {
      if (l.owner && l.owner !== p.char.id && !this.sameParty(p, l.owner)) return;
      if (dist(l.u, l.v, p.s.u, p.s.v) > 1.05) return;
      this.pickup(p, l, id);
    });
  }

  private sameParty(p: PlayerRt, charId: string) {
    const a = hub.getOnline(p.char.id)?.party;
    return !!a && a === hub.getOnline(charId)?.party;
  }

  private pickup(p: PlayerRt, l: LootS, id: string) {
    const rt = this.lootData.get(id);
    if (!rt) return;
    if (rt.gold) {
      p.char.gold += rt.gold;
      this.toastLoot(p, `${rt.gold}냥`, 0);
    } else if (rt.gear) {
      if (!C.addGear(p.char, rt.gear)) return this.bagFull(p);
      this.toastLoot(p, l.label, l.rarity);
    } else if (rt.stack) {
      const left = C.addStack(p.char, rt.stack[0], rt.stack[1]);
      if (left === rt.stack[1]) return this.bagFull(p);
      this.toastLoot(p, l.label, 0);
    }
    this.state.loot.delete(id);
    this.lootData.delete(id);
    p.meDirty = true;
    p.client.send('sfx', { id: rt.gold ? 'coin' : 'pickup' });
    this.broadcast('lootGone', { id, sid: p.sid });
  }

  private toastLoot(p: PlayerRt, label: string, rarity: number) {
    p.client.send('lootToast', { label, rarity });
  }

  private bagFull(p: PlayerRt) {
    if (this.now - p.bagFullAt > 5) {
      p.bagFullAt = this.now;
      this.toast(p, '가방이 가득 찼어요', 'warn');
    }
  }

  // ─── 몬스터 ─────────────────────────────────────────

  private spawnFromGroup(g: SpawnGroup) {
    let u = g.u;
    let v = g.v;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * g.r;
      const x = g.u + Math.cos(a) * r;
      const y = g.v + Math.sin(a) * r;
      if (!blocked(this.map.solid, x, y, 0.4)) {
        u = x;
        v = y;
        break;
      }
    }
    return this.spawnMon(g.mon, u, v, g.level, { group: g });
  }

  spawnMon(kind: string, u: number, v: number, level: number, o: { group?: SpawnGroup; temp?: boolean; hpMul?: number; dmgMul?: number; expMul?: number; rift?: boolean } = {}): MonRt {
    const def = MONSTERS[kind];
    const id = `m${this.nextId++}`;
    const dl = DESIGN_LEVEL[kind] ?? level;
    const lv = level - dl;
    const hpLv = lv >= 0 ? 1 + lv * 0.14 : Math.max(0.45, 1 + lv * 0.1);
    const dmgLv = lv >= 0 ? 1 + lv * 0.1 : Math.max(0.5, 1 + lv * 0.08);
    const partyHp = this.isInstance ? 1 + (this.partySize - 1) * 0.7 : 1;
    const maxHp = Math.round(def.hp * hpLv * partyHp * (o.hpMul ?? 1));
    const s = new MonS();
    s.kind = kind;
    s.u = u;
    s.v = v;
    s.dir = Math.floor(Math.random() * 8);
    s.anim = 'idle';
    s.seq = 0;
    s.hp = maxHp;
    s.maxHp = maxHp;
    s.level = level;
    s.boss = !!def.boss;
    s.elite = false;
    s.fx = 0;
    this.state.monsters.set(id, s);
    const m: MonRt = {
      id,
      def,
      s,
      group: o.group,
      hp: maxHp,
      dmgMul: dmgLv * (o.dmgMul ?? 1),
      expMul: (1 + Math.max(0, lv) * 0.1) * (o.expMul ?? 1),
      home: [u, v],
      st: 'spawn',
      until: this.now + 0.5,
      retarget: 0,
      wanderAt: this.now + Math.random() * 3,
      aim: [1, 0],
      cds: {},
      stunUntil: 0,
      slowUntil: 0,
      slowMul: 1,
      chargeLeft: 0,
      chargeHit: new Set(),
      pathAt: 0,
      phase: 0,
      speedMul: 1,
      temp: !!o.temp,
      hitBy: new Set(),
      rift: o.rift,
    };
    this.mons.set(id, m);
    return m;
  }

  private setMonAnim(m: MonRt, anim: string, restart = false) {
    if (m.s.anim !== anim || restart) {
      m.s.anim = anim;
      if (anim !== 'idle' && anim !== 'walk') m.s.seq = (m.s.seq + 1) & 0xffff;
    }
  }

  private nearestPlayer(u: number, v: number, range: number): PlayerRt | undefined {
    let best: PlayerRt | undefined;
    let bd = range;
    for (const p of this.players.values()) {
      if (p.s.dead) continue;
      const d = dist(p.s.u, p.s.v, u, v);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private tickMon(m: MonRt, dt: number) {
    const { now } = this;
    const { s, def } = m;
    if (m.st === 'dead') {
      if (now >= m.until) {
        this.state.monsters.delete(m.id);
        this.mons.delete(m.id);
      }
      return;
    }
    let fx = 0;
    if (now < m.stunUntil) fx |= 1;
    if (now < m.slowUntil) fx |= 2;
    if (s.fx !== fx) s.fx = fx;
    if (m.st === 'spawn') {
      if (now >= m.until) m.st = 'idle';
      return;
    }
    if (now < m.stunUntil) return;
    if (def.boss) this.checkBossPhase(m);

    switch (m.st) {
      case 'idle': {
        if (now >= m.retarget) {
          m.retarget = now + 0.4 + Math.random() * 0.2;
          const t = this.nearestPlayer(s.u, s.v, def.detect);
          if (t) {
            this.aggro(m, t);
            break;
          }
        }
        if (def.boss) break;
        if (now >= m.wanderAt) {
          m.wanderAt = now + 2.5 + Math.random() * 4;
          if (Math.random() < 0.55) {
            const a = Math.random() * Math.PI * 2;
            const r = 1 + Math.random() * 2.2;
            m.wander = [m.home[0] + Math.cos(a) * r, m.home[1] + Math.sin(a) * r];
          } else {
            m.wander = undefined;
            this.setMonAnim(m, 'idle');
          }
        }
        if (m.wander) {
          if (!this.walkToward(m, m.wander[0], m.wander[1], dt, 0.45)) {
            m.wander = undefined;
            this.setMonAnim(m, 'idle');
          }
        }
        break;
      }
      case 'chase': {
        const t = m.target;
        if (!t || t.s.dead || !this.players.has(t.sid)) {
          m.target = undefined;
          m.st = this.nearestPlayer(s.u, s.v, def.detect) ? 'idle' : 'return';
          break;
        }
        if (now >= m.retarget) {
          m.retarget = now + 1;
          const closer = this.nearestPlayer(s.u, s.v, dist(t.s.u, t.s.v, s.u, s.v) - 1.5);
          if (closer) m.target = closer;
        }
        const d = dist(s.u, s.v, t.s.u, t.s.v);
        if (!def.boss && !m.rift && dist(s.u, s.v, m.home[0], m.home[1]) > def.leash && d > def.detect) {
          m.target = undefined;
          m.st = 'return';
          break;
        }
        const atk = this.pickAttack(m, d);
        if (atk) {
          this.beginAttack(m, atk, t);
          break;
        }
        // 이동
        if (def.kite && d < def.kite - 1) {
          const [au, av] = normalize(s.u - t.s.u, s.v - t.s.v);
          this.stepMon(m, au, av, dt, 0.85);
          this.setMonAnim(m, 'walk');
        } else if (d > (def.kite ?? 0) + (def.attacks[0]?.range ?? 1) * 0.6 || !def.kite) {
          this.walkToward(m, t.s.u, t.s.v, dt, 1, def.r + 0.35);
        } else {
          this.setMonAnim(m, 'idle');
          s.dir = dirFromVec(t.s.u - s.u, t.s.v - s.v);
        }
        break;
      }
      case 'windup': {
        const t = m.target;
        if (t && !m.attack?.charge && !m.attack?.atTarget && m.attack?.shape !== 'circle' && m.attack?.shape !== 'ring' && now < m.until - 0.3) {
          // 판정 직전까지만 살짝 따라 돈다
          const [au, av] = normalize(t.s.u - s.u, t.s.v - s.v);
          const w = 2.2 * dt;
          const [nu, nv] = normalize(m.aim[0] + (au - m.aim[0]) * w, m.aim[1] + (av - m.aim[1]) * w);
          m.aim = [nu, nv];
        }
        if (now >= m.until) this.resolveAttack(m);
        break;
      }
      case 'charge': {
        const step = (m.attack?.charge ?? 8) * dt;
        const [nu, nv] = slideMove(this.map.solid, s.u, s.v, m.aim[0] * step, m.aim[1] * step, def.r * 0.8);
        const moved = dist(nu, nv, s.u, s.v);
        s.u = nu;
        s.v = nv;
        m.chargeLeft -= step;
        for (const p of this.players.values()) {
          if (p.s.dead || m.chargeHit.has(p.sid)) continue;
          if (dist(p.s.u, p.s.v, s.u, s.v) < def.r + 0.55) {
            m.chargeHit.add(p.sid);
            this.damagePlayer(p, def.dmg * m.attack!.mult * m.dmgMul, m);
          }
        }
        if (m.chargeLeft <= 0 || moved < step * 0.25) {
          m.st = 'recover';
          m.until = now + (m.attack?.recover ?? 0.6);
          this.setMonAnim(m, 'idle');
        }
        break;
      }
      case 'recover':
        if (now >= m.until) {
          m.st = 'chase';
          this.setMonAnim(m, 'idle');
        }
        break;
      case 'return': {
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.25 * dt);
        m.hp = s.hp;
        if (now >= m.retarget) {
          m.retarget = now + 0.5;
          const t = this.nearestPlayer(s.u, s.v, def.detect * 0.7);
          if (t) {
            this.aggro(m, t);
            break;
          }
        }
        if (!this.walkToward(m, m.home[0], m.home[1], dt, 1.2, 0.3)) {
          m.st = 'idle';
          this.setMonAnim(m, 'idle');
        }
        break;
      }
      default:
        break;
    }
    // 서로 겹치지 않게 살짝 민다
    if (m.st === 'chase' || m.st === 'idle') {
      for (const o of this.mons.values()) {
        if (o === m || o.st === 'dead' || o.def.boss) continue;
        const dx = s.u - o.s.u;
        const dy = s.v - o.s.v;
        const min = def.r + o.def.r;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.25;
          const [nu, nv] = slideMove(this.map.solid, s.u, s.v, (dx / d) * push, (dy / d) * push, def.r * 0.7);
          s.u = nu;
          s.v = nv;
        }
      }
    }
  }

  private aggro(m: MonRt, t: PlayerRt) {
    m.target = t;
    m.st = 'chase';
    m.wander = undefined;
    m.retarget = this.now + 1;
    if (m.group?.pack) {
      for (const o of this.mons.values()) {
        if (o !== m && o.group === m.group && o.st === 'idle') {
          o.target = t;
          o.st = 'chase';
          o.retarget = this.now + 1;
        }
      }
    }
  }

  private pickAttack(m: MonRt, d: number): MonAttack | undefined {
    const { now } = this;
    const ratio = m.s.hp / m.s.maxHp;
    const usable = m.def.attacks.filter((a) => {
      if (now < (m.cds[a.id] ?? 0)) return false;
      if (a.below !== undefined && ratio > a.below) return false;
      if (d > a.range + m.def.r) return false;
      if (a.minRange && d < a.minRange) return false;
      return true;
    });
    if (!usable.length) return undefined;
    const total = usable.reduce((n, a) => n + (a.weight ?? 1), 0);
    let r = Math.random() * total;
    for (const a of usable) {
      r -= a.weight ?? 1;
      if (r <= 0) return a;
    }
    return usable[0];
  }

  private beginAttack(m: MonRt, a: MonAttack, t: PlayerRt) {
    const { s, def } = m;
    m.attack = a;
    m.st = 'windup';
    m.until = this.now + a.windup;
    m.cds[a.id] = this.now + a.cd;
    const [au, av] = normalize(t.s.u - s.u, t.s.v - s.v);
    m.aim = [au, av];
    s.dir = dirFromVec(au, av);
    this.setMonAnim(m, a.anim, true);
    this.broadcast('monAct', { id: m.id, t: a.windup, anim: a.anim });

    if (a.proj) {
      // 탄환 공격은 방향 표시만
      if (a.proj.count && a.proj.count > 1) {
        this.broadcast('warn', { shape: 'circle', u: s.u, v: s.v, r: def.r + 0.6, t: a.windup, soft: true });
      } else {
        this.broadcast('warn', { shape: 'line', u: s.u, v: s.v, du: au, dv: av, r: a.r, width: a.width ?? 0.5, t: a.windup, m: m.id, soft: true });
      }
      return;
    }
    if (a.scatter) {
      const { count, spread, stagger } = a.scatter;
      for (let i = 0; i < count; i++) {
        const delay = i * stagger;
        const ang = Math.random() * Math.PI * 2;
        const rr = i === 0 ? 0 : Math.sqrt(Math.random()) * spread;
        const lead = i === 0 ? 0 : 0.5;
        const u = t.s.u + Math.cos(ang) * rr + au * lead;
        const v = t.s.v + Math.sin(ang) * rr + av * lead;
        this.later(delay, () => {
          this.broadcast('warn', { shape: 'circle', u, v, r: a.r, t: a.windup });
          this.later(a.windup, () => this.circleBlast(m, u, v, a));
        });
      }
      return;
    }
    if (a.atTarget) {
      const u = t.s.u;
      const v = t.s.v;
      this.broadcast('warn', { shape: 'circle', u, v, r: a.r, t: a.windup });
      m.wander = [u, v];
      return;
    }
    if (a.shape === 'cone') {
      this.broadcast('warn', { shape: 'cone', u: s.u, v: s.v, du: au, dv: av, r: a.r + def.r * 0.5, arc: a.arc, t: a.windup, m: m.id });
    } else if (a.shape === 'line') {
      this.broadcast('warn', { shape: 'line', u: s.u, v: s.v, du: au, dv: av, r: a.r, width: a.width ?? 1, t: a.windup, m: m.id });
    } else if (a.shape === 'ring') {
      this.broadcast('warn', { shape: 'ring', u: s.u, v: s.v, r: a.r, inner: a.inner, t: a.windup });
    } else {
      this.broadcast('warn', { shape: 'circle', u: s.u, v: s.v, r: a.r, t: a.windup });
    }
  }

  private circleBlast(m: MonRt, u: number, v: number, a: MonAttack) {
    if (m.st === 'dead') return;
    this.broadcast('blast', { u, v, r: a.r, col: a.burn ? 'ember' : m.def.id === 'gumiho' ? 'root' : 'dark' });
    for (const p of this.players.values()) {
      if (p.s.dead) continue;
      if (dist(p.s.u, p.s.v, u, v) <= a.r) this.damagePlayer(p, m.def.dmg * a.mult * m.dmgMul, m);
    }
    if (a.burn) this.addPatch(u, v, a.r * 0.9, 3, m.def.dmg * 0.22 * m.dmgMul);
  }

  private addPatch(u: number, v: number, r: number, ttl: number, dps: number) {
    const pa: Patch = { id: this.nextId++, u, v, r, until: this.now + ttl, dps, next: this.now + 0.4 };
    this.patches.push(pa);
    this.broadcast('patch', { id: pa.id, u, v, r, ttl });
  }

  private resolveAttack(m: MonRt) {
    const a = m.attack;
    const { s, def } = m;
    if (!a) return;
    const after = () => {
      m.st = 'recover';
      m.until = this.now + a.recover;
    };
    if (a.summon) {
      for (let i = 0; i < a.summon.count; i++) this.spawnNear(m, a.summon.kind);
      after();
      return;
    }
    if (a.proj) {
      const n = a.proj.count ?? 1;
      const base = Math.atan2(m.aim[1], m.aim[0]);
      const arc = ((a.proj.arc ?? 0) * Math.PI) / 180;
      for (let i = 0; i < n; i++) {
        const ang = n === 1 ? base : base + (arc * i) / n;
        this.spawnProj({
          friendly: false,
          mon: m,
          spec: { kind: a.proj.kind, speed: a.proj.speed, range: a.proj.range, r: a.proj.r },
          u: s.u,
          v: s.v,
          du: Math.cos(ang),
          dv: Math.sin(ang),
          dmg: def.dmg * a.mult * m.dmgMul,
          crit: false,
          mult: a.mult,
        });
      }
      after();
      return;
    }
    if (a.scatter) {
      after();
      return;
    }
    if (a.charge) {
      m.st = 'charge';
      m.chargeLeft = a.r;
      m.chargeHit = new Set();
      this.setMonAnim(m, 'walk');
      this.broadcast('monDash', { id: m.id });
      return;
    }
    if (a.atTarget && m.wander) {
      this.circleBlast(m, m.wander[0], m.wander[1], a);
      m.wander = undefined;
      after();
      return;
    }
    const dmg = def.dmg * a.mult * m.dmgMul;
    if (a.shape === 'cone') {
      const reach = a.r + def.r * 0.5;
      const cos = Math.cos((((a.arc ?? 90) / 2) * Math.PI) / 180);
      this.broadcast('mswing', { id: m.id, aim: m.aim, r: reach, arc: a.arc });
      for (const p of this.players.values()) {
        if (p.s.dead) continue;
        const du = p.s.u - s.u;
        const dv = p.s.v - s.v;
        const d = Math.hypot(du, dv);
        if (d > reach + 0.2) continue;
        if (d > 0.3 && (du * m.aim[0] + dv * m.aim[1]) / d < cos) continue;
        this.damagePlayer(p, dmg, m);
      }
    } else if (a.shape === 'circle') {
      this.broadcast('blast', { u: s.u, v: s.v, r: a.r, col: 'dark', shake: def.boss ? 1 : 0 });
      for (const p of this.players.values()) {
        if (!p.s.dead && dist(p.s.u, p.s.v, s.u, s.v) <= a.r) this.damagePlayer(p, dmg, m);
      }
    } else if (a.shape === 'ring') {
      this.broadcast('blast', { u: s.u, v: s.v, r: a.r, inner: a.inner, col: 'ring', shake: 1 });
      for (const p of this.players.values()) {
        if (p.s.dead) continue;
        const d = dist(p.s.u, p.s.v, s.u, s.v);
        if (d >= (a.inner ?? 0) && d <= a.r) this.damagePlayer(p, dmg, m);
      }
    } else if (a.shape === 'line') {
      const w = (a.width ?? 1) / 2;
      const eu = s.u + m.aim[0] * a.r;
      const ev = s.v + m.aim[1] * a.r;
      for (const p of this.players.values()) {
        if (!p.s.dead && distToSeg(p.s.u, p.s.v, s.u, s.v, eu, ev) <= w + 0.2) this.damagePlayer(p, dmg, m);
      }
    }
    after();
  }

  private spawnNear(m: MonRt, kind: string): MonRt {
    const a = Math.random() * Math.PI * 2;
    const [u, v] = this.openNear(m.s.u + Math.cos(a) * 3, m.s.v + Math.sin(a) * 3, 2);
    const n = this.spawnMon(kind, u, v, m.s.level, { temp: true, rift: m.rift });
    if (m.target) {
      n.target = m.target;
      n.st = 'spawn';
      n.until = this.now + 0.6;
    }
    this.broadcast('blast', { u, v, r: 0.9, col: 'summon' });
    return n;
  }

  private checkBossPhase(m: MonRt) {
    const ph = m.def.phases;
    if (!ph || m.phase >= ph.length) return;
    const next = ph[m.phase];
    if (m.s.hp / m.s.maxHp > next.at) return;
    m.phase += 1;
    if (next.speedMul) m.speedMul = next.speedMul;
    this.broadcast('say', { id: m.id, text: next.say, big: true });
    if (next.summon) for (let i = 0; i < next.summon.count; i++) this.spawnNear(m, next.summon.kind);
    m.cds = {};
  }

  /** 대상 쪽으로 걷는다. 도착하면 false */
  private walkToward(m: MonRt, u: number, v: number, dt: number, mul: number, stop = 0.15): boolean {
    const { s } = m;
    const d = dist(s.u, s.v, u, v);
    if (d <= stop) return false;
    let tu = u;
    let tv = v;
    if (!lineClear(this.map.solid, s.u, s.v, u, v)) {
      if (this.now >= m.pathAt || !m.path?.length) {
        m.pathAt = this.now + 0.6 + Math.random() * 0.2;
        m.path = findPath(this.map, s.u, s.v, u, v);
      }
      if (m.path?.length) {
        while (m.path.length > 1 && lineClear(this.map.solid, s.u, s.v, m.path[1][0], m.path[1][1])) m.path.shift();
        if (dist(s.u, s.v, m.path[0][0], m.path[0][1]) < 0.3) m.path.shift();
        if (m.path.length) [tu, tv] = m.path[0];
      }
    } else {
      m.path = undefined;
    }
    const [au, av] = normalize(tu - s.u, tv - s.v);
    this.stepMon(m, au, av, dt, mul);
    this.setMonAnim(m, 'walk');
    return true;
  }

  private stepMon(m: MonRt, au: number, av: number, dt: number, mul: number) {
    const { s, def } = m;
    const slow = this.now < m.slowUntil ? m.slowMul : 1;
    const step = def.speed * m.speedMul * mul * slow * dt;
    const [nu, nv] = slideMove(this.map.solid, s.u, s.v, au * step, av * step, def.r * 0.7);
    s.u = nu;
    s.v = nv;
    s.dir = dirFromVec(au, av);
  }

  damageMon(m: MonRt, raw: number, crit: boolean, by: PlayerRt, o: { knock?: number; stun?: number; slow?: number; kdir?: [number, number] } = {}) {
    if (m.st === 'dead' || m.st === 'spawn') return;
    const n = Math.max(1, Math.round(mitigate(raw, m.def.def + m.s.level * 0.3)));
    m.hp -= n;
    m.s.hp = Math.max(0, m.hp);
    m.lastBy = by;
    m.hitBy.add(by);
    this.broadcast('hit', { m: m.id, n, c: crit ? 1 : 0, by: by.sid });
    if (m.hp <= 0) return this.killMon(m, by);
    if (m.st === 'idle' || m.st === 'return') this.aggro(m, by);
    if (!m.def.poise) {
      if (o.knock && o.kdir) {
        const [ku, kv] = normalize(o.kdir[0], o.kdir[1]);
        const [nu, nv] = slideMove(this.map.solid, m.s.u, m.s.v, ku * o.knock, kv * o.knock, m.def.r * 0.7);
        m.s.u = nu;
        m.s.v = nv;
      }
      const stun = Math.max(o.stun ?? 0, 0.16);
      if (m.st !== 'windup' || (o.stun ?? 0) > 0) {
        m.stunUntil = Math.max(m.stunUntil, this.now + stun);
        if (m.st === 'windup') {
          m.st = 'chase';
          this.broadcast('warnCancel', { m: m.id });
        }
        if (m.st !== 'charge') this.setMonAnim(m, 'hit', true);
      }
      if (o.slow) {
        m.slowUntil = this.now + 3;
        m.slowMul = 1 - o.slow;
      }
    }
  }

  private killMon(m: MonRt, by: PlayerRt) {
    const { def, s } = m;
    m.st = 'dead';
    m.until = this.now + (def.boss ? 2.4 : 1.1);
    this.setMonAnim(m, 'death', true);
    this.broadcast('warnCancel', { m: m.id });
    if (def.deathBlast) {
      const { r, mult, delay } = def.deathBlast;
      const [u, v] = [s.u, s.v];
      const dmg = def.dmg * mult * m.dmgMul;
      this.broadcast('warn', { shape: 'circle', u, v, r, t: delay });
      this.later(delay, () => {
        this.broadcast('blast', { u, v, r, col: 'ember' });
        for (const p of this.players.values()) if (!p.s.dead && dist(p.s.u, p.s.v, u, v) <= r) this.damagePlayer(p, dmg, m);
      });
    }
    // 경험치·퀘스트: 처치에 참여한 사람 + 근처 파티원
    const share = new Set<PlayerRt>([by, ...m.hitBy]);
    const pid = hub.getOnline(by.char.id)?.party;
    if (pid) {
      for (const p of this.players.values()) {
        if (hub.getOnline(p.char.id)?.party === pid && dist(p.s.u, p.s.v, s.u, s.v) < 22) share.add(p);
      }
    }
    const baseExp = def.exp * m.expMul;
    const partyBonus = share.size > 1 ? 1 + (share.size - 1) * 0.15 : 1;
    for (const p of share) {
      if (!this.players.has(p.sid)) continue;
      const diff = p.char.level - s.level;
      const mul = diff <= 3 ? 1 : Math.max(0.1, 1 - (diff - 3) * 0.15);
      const exp = Math.max(1, Math.round((baseExp * mul * partyBonus) / Math.max(1, share.size * 0.75)));
      const before = p.char.level;
      const ups = C.gainExp(p.char, exp);
      p.client.send('exp', { n: exp, m: m.id });
      if (ups) this.onLevelUp(p, p.char.level - before);
      if (C.onKill(p.char, def.id)) p.client.send('qProg', {});
      p.meDirty = true;
    }
    this.rollDrops(m, by);
    if (m.group && m.group.respawn > 0 && !m.temp) {
      this.respawns.push({ at: this.now + m.group.respawn * (0.85 + Math.random() * 0.3), group: m.group });
    }
    if (def.boss) this.onBossDead(m);
    if (m.rift) this.checkFloorClear();
  }

  private onLevelUp(p: PlayerRt, ups: number) {
    this.refreshStats(p);
    p.s.hp = p.s.maxHp;
    p.s.mp = p.s.maxMp;
    this.broadcast('levelup', { sid: p.sid, level: p.char.level, ups });
    p.meDirty = true;
    const o = hub.getOnline(p.char.id);
    if (o?.party) hub.sendPartyState(o.party);
  }

  private lootData = new Map<string, { gold?: number; gear?: ReturnType<typeof rollGear>; stack?: [string, number] }>();

  private dropLoot(u: number, v: number, owner: string, d: { gold?: number; gear?: ReturnType<typeof rollGear>; stack?: [string, number] }) {
    const id = `l${this.nextId++}`;
    const a = Math.random() * Math.PI * 2;
    const r = 0.25 + Math.random() * 0.75;
    const [lu, lv] = slideMove(this.map.solid, u, v, Math.cos(a) * r, Math.sin(a) * r, 0.1);
    const l = new LootS();
    l.u = lu;
    l.v = lv;
    l.owner = owner;
    l.gold = d.gold ?? 0;
    l.rarity = d.gear?.rarity ?? 0;
    if (d.gold) {
      l.icon = 'gold';
      l.label = `${d.gold}냥`;
    } else if (d.gear) {
      const b = GEAR[d.gear.base];
      l.icon = b.icon;
      l.label = b.name;
    } else if (d.stack) {
      const def = CONSUMABLES[d.stack[0]];
      l.icon = def.icon;
      l.label = d.stack[1] > 1 ? `${def.name} ×${d.stack[1]}` : def.name;
    }
    this.state.loot.set(id, l);
    this.lootData.set(id, d);
    this.later(90, () => {
      if (this.state.loot.has(id)) {
        this.state.loot.delete(id);
        this.lootData.delete(id);
      }
    });
    this.broadcast('lootDrop', { id, from: [u, v] });
  }

  private rollDrops(m: MonRt, by: PlayerRt) {
    const { def, s } = m;
    const owner = by.char.id;
    const u = s.u;
    const v = s.v;
    const [g0, g1] = def.gold;
    const goldMul = 1 + Math.max(0, s.level - (DESIGN_LEVEL[def.id] ?? s.level)) * 0.1;
    if (def.boss || Math.random() < 0.6) this.dropLoot(u, v, owner, { gold: Math.round((g0 + Math.random() * (g1 - g0)) * goldMul) });
    for (const [item, chance] of def.drops ?? []) {
      if (Math.random() < chance) this.dropLoot(u, v, owner, { stack: [item, 1] });
    }
    if (Math.random() < (def.boss ? 1 : 0.07)) this.dropLoot(u, v, owner, { stack: ['ember_shard', def.boss ? 8 : 1] });
    const gearRolls = def.boss ? 3 : Math.random() < 0.075 ? 1 : 0;
    for (let i = 0; i < gearRolls; i++) {
      const pool = dropPool(s.level, Math.random() < 0.7 ? by.char.cls : undefined);
      if (!pool.length) continue;
      const base = pool[Math.floor(Math.random() * pool.length)];
      const rarity: Rarity = rollRarity(def.boss ? 0.35 : 0, Math.random());
      this.dropLoot(u, v, owner, { gear: rollGear(base, rarity) });
    }
    if (Math.random() < (def.boss ? 0 : 0.05)) {
      const id = s.level >= 8 ? (Math.random() < 0.5 ? 'potion_hp_l' : 'potion_mp_l') : Math.random() < 0.5 ? 'potion_hp_s' : 'potion_mp_s';
      this.dropLoot(u, v, owner, { stack: [id, 1] });
    }
  }

  private onBossDead(m: MonRt) {
    this.broadcast('bossDead', { id: m.id, name: m.def.name });
    if (this.mapName === 'rift') return;
    const prop = new PropS();
    prop.kind = 'exit';
    const [u, v] = this.openNear(m.s.u, m.s.v + 2.5, 1.5);
    prop.u = u;
    prop.v = v;
    prop.label = '돌아가기';
    prop.r = 1.2;
    this.state.props.set('exit', prop);
    // 남아 있는 소환수 정리
    for (const o of this.mons.values()) if (o.temp && o.st !== 'dead') this.killSilently(o);
  }

  private killSilently(m: MonRt) {
    m.st = 'dead';
    m.until = this.now + 1;
    m.s.hp = 0;
    this.setMonAnim(m, 'death', true);
  }

  // ─── 플레이어 피해 ─────────────────────────────────

  damagePlayer(p: PlayerRt, raw: number, from?: MonRt) {
    const { now } = this;
    if (p.s.dead) return;
    if (now < p.iframes) {
      p.client.send('dodged', {});
      return;
    }
    let n = mitigate(raw, p.stats.def);
    n *= 1 - Math.min(0.7, this.buffVal(p, 'dr'));
    if (p.guardOn) {
      const g = CLASSES[p.char.cls].guard;
      if (now - p.guardStart <= g.parry) {
        // 패링: 피해 없음, 상대 경직, 다음 공격 2배
        p.parryBoost = now + 4;
        this.broadcast('parryOk', { sid: p.sid });
        p.guardStart = -99;
        if (from && from.st !== 'dead') {
          const stun = from.def.boss ? 0.6 : 1.1;
          from.stunUntil = Math.max(from.stunUntil, now + stun);
          if (from.st === 'charge') {
            from.st = 'recover';
            from.until = now + stun;
          }
          if (!from.def.boss) this.setMonAnim(from, 'hit', true);
        }
        return;
      }
      n *= g.reduce;
      this.broadcast('guardHit', { sid: p.sid });
    }
    n = Math.max(1, Math.round(n));
    if (p.shield > 0) {
      const ab = Math.min(p.shield, n);
      p.shield -= ab;
      p.s.shield = p.shield;
      n -= ab;
      if (p.shield <= 0) this.broadcast('shieldBreak', { sid: p.sid });
      if (n <= 0) {
        this.broadcast('hitP', { sid: p.sid, n: ab, sh: 1 });
        return;
      }
    }
    p.s.hp = Math.max(0, p.s.hp - n);
    p.lastHurt = now;
    this.broadcast('hitP', { sid: p.sid, n });
    if (p.s.hp <= 0) this.killPlayer(p);
  }

  private killPlayer(p: PlayerRt) {
    p.s.dead = true;
    p.s.anim = 'death';
    p.guardOn = false;
    p.buffs = [];
    p.shield = 0;
    p.s.shield = 0;
    this.broadcast('died', { sid: p.sid });
    for (const m of this.mons.values()) if (m.target === p) m.target = undefined;
    if (this.mapName === 'rift') {
      if ([...this.players.values()].every((x) => x.s.dead)) {
        this.later(4, () => {
          for (const x of this.players.values()) this.sendTo(x, 'town', 'start');
        });
        for (const x of this.players.values()) this.toast(x, `${this.floor}층에서 쓰러졌어요`, 'warn');
      }
    }
  }

  // ─── 탄환·장판·덫 ─────────────────────────────────

  private spawnProj(o: { friendly: boolean; owner?: PlayerRt; mon?: MonRt; spec: ProjSpec; u: number; v: number; du: number; dv: number; dmg: number; crit: boolean; mult: number }) {
    const id = this.nextId++;
    const pr: Proj = {
      id,
      friendly: o.friendly,
      owner: o.owner,
      mon: o.mon,
      dmg: o.dmg,
      crit: o.crit,
      spec: o.spec,
      u: o.u,
      v: o.v,
      du: o.du,
      dv: o.dv,
      left: o.spec.range,
      pierce: o.spec.pierce ?? 0,
      hit: new Set(),
      mult: o.mult,
    };
    this.projs.push(pr);
    this.broadcast('proj', { id, kind: o.spec.kind, u: o.u, v: o.v, du: o.du, dv: o.dv, speed: o.spec.speed, range: o.spec.range, friendly: o.friendly });
  }

  private tickProjs(dt: number) {
    if (!this.projs.length) return;
    const alive: Proj[] = [];
    for (const pr of this.projs) {
      const step = pr.spec.speed * dt;
      pr.u += pr.du * step;
      pr.v += pr.dv * step;
      pr.left -= step;
      let end = pr.left <= 0;
      let hitWall = false;
      if (!end && isSolid(this.map.solid, pr.u, pr.v) && !wallIsLow(this.map, pr.u, pr.v)) {
        end = true;
        hitWall = true;
      }
      if (!end) {
        if (pr.friendly) {
          for (const m of this.mons.values()) {
            if (m.st === 'dead' || m.st === 'spawn' || pr.hit.has(m.id)) continue;
            if (dist(m.s.u, m.s.v, pr.u, pr.v) > pr.spec.r + m.def.r) continue;
            pr.hit.add(m.id);
            if (pr.owner) {
              if (pr.spec.blast) {
                end = true;
                break;
              }
              this.damageMon(m, pr.dmg, pr.crit, pr.owner, { knock: 0.12, kdir: [pr.du, pr.dv] });
            }
            if (pr.pierce-- <= 0) {
              end = true;
              break;
            }
          }
        } else {
          for (const p of this.players.values()) {
            if (p.s.dead || pr.hit.has(p.sid)) continue;
            if (dist(p.s.u, p.s.v, pr.u, pr.v) > pr.spec.r + PLAYER_R) continue;
            pr.hit.add(p.sid);
            if (this.now < p.iframes) continue;
            this.damagePlayer(p, pr.dmg, pr.mon);
            end = true;
            break;
          }
        }
      }
      if (end) {
        if (pr.friendly && pr.spec.blast && pr.owner && this.players.has(pr.owner.sid)) {
          const owner = pr.owner;
          for (const m of this.mons.values()) {
            if (m.st === 'dead' || m.st === 'spawn') continue;
            if (dist(m.s.u, m.s.v, pr.u, pr.v) > pr.spec.blast + m.def.r) continue;
            this.damageMon(m, pr.dmg * (0.9 + Math.random() * 0.2), pr.crit, owner, { knock: 0.4, kdir: [m.s.u - pr.u, m.s.v - pr.v] });
          }
          this.broadcast('blast', { u: pr.u, v: pr.v, r: pr.spec.blast, col: pr.spec.kind === 'fireball' ? 'fire' : 'arcane' });
        }
        this.broadcast('projEnd', { id: pr.id, u: pr.u, v: pr.v, wall: hitWall });
      } else {
        alive.push(pr);
      }
    }
    this.projs = alive;
  }

  private tickPatches() {
    if (!this.patches.length) return;
    this.patches = this.patches.filter((pa) => pa.until > this.now);
    for (const pa of this.patches) {
      if (this.now < pa.next) continue;
      pa.next = this.now + 0.5;
      for (const p of this.players.values()) {
        if (!p.s.dead && this.now >= p.iframes && dist(p.s.u, p.s.v, pa.u, pa.v) <= pa.r) {
          this.damagePlayer(p, pa.dps * 0.5);
        }
      }
    }
  }

  private tickTraps() {
    if (!this.traps.length) return;
    this.traps = this.traps.filter((t) => {
      if (t.until <= this.now) {
        this.broadcast('trapGone', { id: t.id });
        return false;
      }
      for (const m of this.mons.values()) {
        if (m.st === 'dead' || m.st === 'spawn') continue;
        if (dist(m.s.u, m.s.v, t.u, t.v) < t.r * 0.6 + m.def.r) {
          if (this.players.has(t.owner.sid)) {
            this.circleHit(t.owner, t.u, t.v, t.r, t.mult, { stun: t.stun, slow: 0.5 });
          }
          this.broadcast('blast', { u: t.u, v: t.v, r: t.r, col: 'trap' });
          this.broadcast('trapGone', { id: t.id });
          return false;
        }
      }
      return true;
    });
  }

  // ─── 저승길 ─────────────────────────────────────────

  private startFloor(n: number) {
    this.floor = n;
    this.floorClear = false;
    this.state.floor = n;
    this.state.props.delete('rift_next');
    for (const x of this.mons.values()) if (x.st !== 'dead') this.killSilently(x);
    const start = this.map.objects.find((o) => o.type === 'arrive')!;
    for (const p of this.players.values()) {
      const [u, v] = this.openNear(start.u, start.v, 2);
      if (p.s.dead) {
        p.s.dead = false;
        p.s.hp = Math.round(p.s.maxHp * 0.5);
        p.s.anim = 'idle';
      }
      p.s.u = u;
      p.s.v = v;
      p.iframes = this.now + 1.5;
      p.dashUntil = this.now + 0.5;
      p.client.send('tp', { u, v, floor: n });
      if (n > p.char.riftBest) {
        p.char.riftBest = n;
        db.recordRift(p.char, n);
        p.meDirty = true;
      }
    }
    this.broadcast('riftFloor', { floor: n });
    const level = Math.max(5, Math.round([...this.players.values()].reduce((a, p) => a + p.char.level, 0) / Math.max(1, this.players.size)));
    const sc = riftScale(n);
    const partyMul = 1 + (this.players.size - 1) * 0.5;
    const opts = { rift: true, hpMul: sc.hp * partyMul, dmgMul: sc.dmg, expMul: sc.exp };
    this.later(0.8, () => {
      if (n % 5 === 0) {
        const boss = n % 10 === 0 ? 'bulgasari' : 'gumiho';
        const bossMul = boss === 'bulgasari' ? Math.min(1, level / 18) * 0.5 : Math.max(0.5, Math.min(1, level / 8)) * 0.55;
        this.spawnMon(boss, 17, 13, Math.max(level, DESIGN_LEVEL[boss] - 6), { ...opts, hpMul: opts.hpMul * bossMul, rift: true });
      } else {
        const pool = n < 4 ? ['daramjwi', 'neoguri', 'metdwaeji'] : n < 9 ? ['yeou', 'metdwaeji', 'neukdae', 'seungnyangi'] : ['bandalgom', 'horangi', 'bakjwi', 'neukdae', 'seungnyangi'];
        const count = Math.min(14, 4 + Math.floor(n * 0.7));
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 5 + Math.random() * 6;
          const [u, v] = this.openNear(17 + Math.cos(a) * r, 15 + Math.sin(a) * r, 1);
          const kind = pool[Math.floor(Math.random() * pool.length)];
          const m = this.spawnMon(kind, u, v, level, opts);
          m.home = [17, 17];
        }
      }
      this.state.remain = this.riftAlive();
    });
  }

  private riftAlive() {
    let n = 0;
    for (const m of this.mons.values()) if (m.rift && m.st !== 'dead') n++;
    return n;
  }

  private checkFloorClear() {
    const left = this.riftAlive();
    this.state.remain = left;
    if (left > 0 || this.floorClear) return;
    this.floorClear = true;
    const n = this.floor;
    const prop = new PropS();
    prop.kind = 'rift_next';
    prop.u = 17;
    prop.v = 17;
    prop.label = `${n + 1}층으로`;
    prop.r = 1.3;
    this.state.props.set('rift_next', prop);
    this.broadcast('riftClear', { floor: n });
    for (const p of this.players.values()) {
      if (p.s.dead) continue;
      const gold = Math.round(8 + n * 4);
      p.char.gold += gold;
      const tokens = (n % 5 === 0 ? 4 : 0) + (n % 3 === 0 ? 1 : 0);
      if (tokens) {
        C.addStack(p.char, 'rift_token', tokens);
        this.toast(p, `저승 엽전 ${tokens}개를 얻었어요`, 'good');
      }
      p.s.hp = Math.min(p.s.maxHp, p.s.hp + Math.round(p.s.maxHp * 0.3));
      p.s.mp = Math.min(p.s.maxMp, p.s.mp + Math.round(p.s.maxMp * 0.4));
      p.meDirty = true;
    }
  }
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** 물·용암 위로는 탄환이 날아갈 수 있다 */
function wallIsLow(map: MapData, u: number, v: number) {
  const x = Math.floor(u);
  const y = Math.floor(v);
  for (const layer of ['water', 'lava']) {
    const g = map.corners[layer];
    if (g && g[y]?.[x] === '1' && g[y + 1]?.[x + 1] === '1') return true;
  }
  return false;
}

/** 칸 단위 너비 우선 탐색. 경로를 [u,v] 목록으로 돌려준다 */
function findPath(map: MapData, u0: number, v0: number, u1: number, v1: number): [number, number][] | undefined {
  const res = map.solid.res;
  const W = map.solid.rows[0].length;
  const H = map.solid.rows.length;
  const sx = Math.floor(u0 * res);
  const sy = Math.floor(v0 * res);
  const tx = Math.floor(u1 * res);
  const ty = Math.floor(v1 * res);
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return undefined;
  const prev = new Map<number, number>();
  const start = sy * W + sx;
  const goal = ty * W + tx;
  prev.set(start, -1);
  const q = [start];
  let head = 0;
  let found = false;
  const LIMIT = 2200;
  while (head < q.length && head < LIMIT) {
    const c = q[head++];
    if (c === goal) {
      found = true;
      break;
    }
    const x = c % W;
    const y = Math.floor(c / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny * W + nx;
      if (prev.has(k)) continue;
      if (map.solid.rows[ny].charCodeAt(nx) !== 48) continue;
      if (dx && dy && (map.solid.rows[y].charCodeAt(nx) !== 48 || map.solid.rows[ny].charCodeAt(x) !== 48)) continue;
      prev.set(k, c);
      q.push(k);
    }
  }
  if (!found) return undefined;
  const out: [number, number][] = [];
  let c = goal;
  while (c !== -1 && c !== start) {
    out.push([(c % W + 0.5) / res, (Math.floor(c / W) + 0.5) / res]);
    c = prev.get(c)!;
  }
  return out.reverse();
}

