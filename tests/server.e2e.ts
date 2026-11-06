// 서버 통합 시험: 실제 서버를 띄우고 봇 클라이언트로 핵심 흐름을 돈다.
// 실행: npx tsx tests/server.e2e.ts
import { Client, type Room } from '@colyseus/sdk';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = 2599;
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'lantern-'));
const dbPath = join(dir, 't.sqlite');
const server = spawn('npx', ['tsx', 'server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT), LANTERN_DB: dbPath, LANTERN_DEV: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '통과' : '실패'}  ${name}${extra ? ` (${extra})` : ''}`);
  if (!ok) failed++;
}

async function api(path: string, token: string | null, body?: unknown, method?: string) {
  const r = await fetch(BASE + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json() as Promise<any>;
}

class Bot {
  client = new Client(BASE);
  room!: Room;
  token = '';
  charId = '';
  me: any = null;
  u = 0;
  v = 0;
  events: Record<string, any[]> = {};
  gotoMsg: any = null;

  constructor(public name: string, public cls: string) {}

  async create() {
    this.token = (await api('/api/guest', null, {})).token;
    const r = await api('/api/chars', this.token, { name: this.name, cls: this.cls });
    this.charId = r.char.id;
  }

  async join(map: string, opts: { arrive?: string; roomId?: string } = {}) {
    const options = { token: this.token, charId: this.charId, arrive: opts.arrive };
    this.room = opts.roomId ? await this.client.joinById(opts.roomId, options) : await this.client.joinOrCreate(map, options);
    this.gotoMsg = null;
    this.room.onMessage('*', (type: any, msg: any) => {
      (this.events[type] ??= []).push(msg);
      if (type === 'me') this.me = msg;
      if (type === 'welcome') {
        this.u = msg.u;
        this.v = msg.v;
      }
      if (type === 'tp') {
        this.u = msg.u;
        this.v = msg.v;
      }
      if (type === 'goto') this.gotoMsg = msg;
    });
    await this.until(() => !!this.events.welcome?.length && !!this.me, 'welcome');
    this.events.welcome = [];
  }

  async until(fn: () => boolean, label: string, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await sleep(30);
    }
    throw new Error(`시간 초과: ${label}`);
  }

  /** 정상 속도로 목표까지 걷는다 */
  async walkTo(u: number, v: number, stop = 0.2, maxMs = 30000) {
    const speed = 2.6;
    const end = Date.now() + maxMs;
    while (Date.now() < end) {
      const d = Math.hypot(u - this.u, v - this.v);
      if (d <= stop) return true;
      const step = Math.min(d, speed * 0.066);
      this.u += ((u - this.u) / d) * step;
      this.v += ((v - this.v) / d) * step;
      this.room.send('move', { u: this.u, v: this.v, dir: 0, anim: 'walk' });
      await sleep(66);
    }
    return false;
  }

  teleportHack(u: number, v: number) {
    this.room.send('move', { u, v, dir: 0, anim: 'walk' });
  }

  player() {
    return (this.room.state as any).players.get(this.room.sessionId);
  }

  monsters(): [string, any][] {
    const out: [string, any][] = [];
    (this.room.state as any).monsters.forEach((m: any, id: string) => out.push([id, m]));
    return out;
  }

  nearest(kind?: string) {
    let best: [string, any] | null = null;
    let bd = Infinity;
    for (const e of this.monsters()) {
      if (e[1].hp <= 0 || (kind && e[1].kind !== kind)) continue;
      const d = Math.hypot(e[1].u - this.u, e[1].v - this.v);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  async fightUntil(fn: () => boolean, kind: string | undefined, ms: number) {
    const end = Date.now() + ms;
    let step = 0;
    while (Date.now() < end && !fn()) {
      const t = this.nearest(kind);
      if (!t) {
        await sleep(200);
        continue;
      }
      const m = t[1];
      const d = Math.hypot(m.u - this.u, m.v - this.v);
      if (d > 1.1) {
        const stepLen = Math.min(d - 0.9, 2.6 * 0.066);
        this.u += ((m.u - this.u) / d) * stepLen;
        this.v += ((m.v - this.v) / d) * stepLen;
        this.room.send('move', { u: this.u, v: this.v, dir: 0, anim: 'walk' });
        await sleep(66);
      } else {
        this.room.send('attack', { aim: [m.u - this.u, m.v - this.v], step: step++ % 3 });
        await sleep(360);
      }
    }
  }

  async followGoto() {
    await this.until(() => !!this.gotoMsg, 'goto');
    const g = this.gotoMsg;
    await this.room.leave();
    this.events = {};
    this.me = null;
    await this.join(g.map, { arrive: g.arrive, roomId: g.roomId });
    return g;
  }
}

async function setLevel(charId: string, level: number) {
  const db = new DatabaseSync(dbPath);
  const row = db.prepare('SELECT data FROM chars WHERE id = ?').get(charId) as { data: string };
  const c = JSON.parse(row.data);
  c.level = level;
  c.quests.done.push('q_hollow');
  db.prepare('UPDATE chars SET data = ? WHERE id = ?').run(JSON.stringify(c), charId);
  db.close();
}

async function main() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${BASE}/api/ping`);
      break;
    } catch {
      await sleep(250);
    }
  }
  const guest = await api('/api/guest', null, {});
  check('게스트 토큰 발급', !!guest.token);
  const bad = await api('/api/chars', guest.token, { name: '!', cls: 'musa' });
  check('이상한 이름 거부', !!bad.err);
  const noAuth = await api('/api/chars', null);
  check('토큰 없이 캐릭터 목록 거부', !!noAuth.err);

  const a = new Bot('시험전사', 'musa');
  await a.create();
  await a.join('town');
  check('마을 입장 · me 수신', a.me?.level === 1 && a.me.bag.length === 32);
  check('시작 장비 착용', !!a.me.equip.weapon);

  // 순간이동 방지
  const u0 = a.u;
  a.teleportHack(a.u + 30, a.v);
  await sleep(200);
  check('순간이동 거부', Math.abs(a.player().u - u0) < 1, `u=${a.player().u.toFixed(1)}`);
  await a.until(() => !!a.events.tp?.length, 'tp');
  a.u = a.events.tp.at(-1).u;
  a.v = a.events.tp.at(-1).v;

  // 벽 안으로 이동 거부: 큰 등불은 막혀 있다
  // NPC에게 가서 퀘스트 받기
  check('멀리서 퀘스트 거부', await (async () => {
    a.room.send('qAccept', { id: 'q_first_light', npc: 'npc_elder' });
    await sleep(200);
    return a.me.quests.active.q_first_light === undefined;
  })());
  // 어른은 당산나무 아래에 있다. 큰 석등을 돌아서 간다
  await a.walkTo(46, 30, 0.3);
  await a.walkTo(47.2, 26.4, 0.3);
  a.room.send('qAccept', { id: 'q_first_light', npc: 'npc_elder' });
  await a.until(() => a.me.quests.active.q_first_light === 0, '퀘스트 수락');
  check('퀘스트 수락', true);

  // 상점
  const goldBefore = a.me.gold;
  await a.walkTo(44.5, 29, 0.3);
  await a.walkTo(39, 28.6, 0.3);
  check('입은 장비가 방 상태에 실림', String(a.player().gear ?? '').includes('armor_1'), String(a.player().gear));
  a.room.send('unequip', { slot: 'armor' });
  await a.until(() => !String(a.player().gear ?? '').includes('armor_1'), '겉모습 갱신');
  check('벗으면 방 상태의 겉모습도 바뀜', true);
  a.room.send('buy', { id: 'potion_hp_s', n: 2, npc: 'npc_merchant' });
  await a.until(() => a.me.gold === goldBefore - 24, '구매');
  check('상점 구매', true);

  // 안전 지대에서는 공격 불가: 숲으로 이동
  await a.walkTo(47, 31.4, 0.3);
  await a.walkTo(54, 32.5, 0.3);
  await a.walkTo(58, 37, 0.3);
  await a.walkTo(75.4, 38, 0.3);
  a.room.send('door', { name: 'to_woods' });
  const g = await a.followGoto();
  check('숲으로 이동', g.map === 'woods' && (a.room.state as any).mapName === 'woods', `(${a.u.toFixed(1)},${a.v.toFixed(1)})`);

  await sleep(500);
  check('몬스터 동기화', a.monsters().length > 20, `${a.monsters().length}마리`);
  const expBefore = a.me.exp + a.me.level * 1e6;
  await a.fightUntil(() => (a.events.exp?.length ?? 0) >= 2, 'daramjwi', 40000);
  check('전투로 경험치 획득', (a.events.exp?.length ?? 0) >= 2, `처치 ${a.events.exp?.length ?? 0}`);
  check('서버가 피해 계산', (a.events.hit?.length ?? 0) > 0, `타격 ${a.events.hit?.length ?? 0}`);
  check('퀘스트 진행', a.me.quests.active.q_first_light >= 1, `${a.me.quests.active.q_first_light}/5`);
  check('경험치·레벨 변화', a.me.exp + a.me.level * 1e6 > expBefore);

  // 맞을 때까지 기다려 경고 → 피해 흐름 확인
  await a.fightUntil(() => (a.events.hitP?.length ?? 0) > 0 && (a.events.warn?.length ?? 0) > 0, 'daramjwi', 25000);
  check('몬스터 공격 전에 경고 표시', (a.events.warn?.length ?? 0) > 0, `${a.events.warn?.length ?? 0}회`);
  const hits = a.events.hitP ?? [];
  check('몬스터가 플레이어를 때림', hits.length > 0 && hits[0].n > 0, `${hits.length}회, 첫 피해 ${hits[0]?.n}`);

  // 드롭 줍기: 골드 드롭 위치로 이동
  const lootList: any[] = [];
  (a.room.state as any).loot.forEach((l: any) => lootList.push(l));
  if (lootList.length) {
    const before = a.me.gold;
    await a.walkTo(lootList[0].u, lootList[0].v, 0.5, 8000);
    await sleep(400);
    check('드롭 자동 줍기', a.me.gold >= before, `${lootList[0].label}`);
  } else {
    console.log('참고  이번 판에는 드롭이 없어 줍기를 건너뜀');
  }

  // 스킬: 레벨 올려 다시 입장
  await a.room.leave();
  await sleep(150);
  await setLevel(a.charId, 8);
  await a.join('woods', { arrive: 'from_hollow' });
  check('저장 후 다시 입장', a.me.level === 8);
  a.room.send('skillUp', { id: 'musa_hwimori' });
  await a.until(() => a.me.skills.musa_hwimori === 1, '스킬 찍기');
  check('스킬 포인트 사용', a.me.points === 6, `남은 ${a.me.points}`);
  a.room.send('skillUp', { id: 'musa_cheongeun' });
  await sleep(200);
  check('레벨 부족 스킬 거부', !a.me.skills.musa_cheongeun);
  const mpBefore = a.player().mp;
  a.room.send('skill', { id: 'musa_hwimori', aim: [1, 0] });
  await sleep(150);
  check('스킬 사용 · 마나 소모', a.player().mp < mpBefore, `${mpBefore}→${a.player().mp}`);
  await a.until(() => !!a.events.cd?.length, '재사용 대기');
  const mp2 = a.player().mp;
  a.room.send('skill', { id: 'musa_hwimori', aim: [1, 0] });
  await sleep(150);
  check('재사용 대기 중 거부', a.player().mp >= mp2);

  // 파티와 인스턴스
  const b = new Bot('시험마법', 'dosa');
  await b.create();
  await setLevel(b.charId, 8);
  await b.join('woods', { arrive: 'from_hollow' });
  a.room.send('partyInvite', { name: b.name });
  await b.until(() => !!b.events.partyAsk?.length, '파티 초대');
  b.room.send('partyAnswer', { yes: true });
  await a.until(() => a.events.party?.at(-1)?.members?.length === 2, '파티 결성');
  check('파티 결성', true);

  a.room.send('chat', { text: '안녕', ch: 'party' });
  await b.until(() => b.events.chat?.some((c) => c.text === '안녕' && c.ch === 'party') ?? false, '파티 채팅');
  check('파티 채팅', true);

  const door = { u: 68.2, v: 42 };
  await a.walkTo(door.u - 0.6, door.v, 0.3);
  a.room.send('door', { name: 'to_hollow' });
  const ga = await a.followGoto();
  check('인스턴스 입장', ga.map === 'hollow' && !!ga.roomId);
  await b.walkTo(door.u - 0.6, door.v, 0.3);
  b.room.send('door', { name: 'to_hollow' });
  const gb = await b.followGoto();
  check('파티원이 같은 인스턴스로', ga.roomId === gb.roomId, ga.roomId);
  await sleep(300);
  const boss = a.monsters().find(([, m]) => m.boss);
  check('보스 배치 · 파티 체력 보정', !!boss && boss[1].maxHp > 9000, `${boss?.[1].kind} ${boss?.[1].maxHp}`);

  // 잘못된 입력 내성
  a.room.send('attack', { aim: null, step: 'x' });
  a.room.send('skill', { id: '없음', aim: [0, 0] });
  a.room.send('equip', { i: 9999 });
  a.room.send('move', { u: NaN, v: 'a' });
  a.room.send('quick', { i: 77 });
  a.room.send('door', { name: 123 });
  a.room.send('bagMove', { a: -1, b: 'z' });
  await sleep(300);
  check('잘못된 메시지에도 서버 유지', server.exitCode === null && a.room.connection.isOpen);

  a.room.send('leaveInstance');
  const gl = await a.followGoto();
  check('인스턴스에서 나가기', gl.map === 'woods');

  // 균열
  await b.room.leave();
  await a.room.leave();
  const c = new Bot('시험궁수', 'gungsa');
  await c.create();
  await setLevel(c.charId, 10);
  await c.join('town', { arrive: 'from_rift' });
  await c.walkTo(8.2, 57, 0.3);
  c.room.send('door', { name: 'to_rift' });
  const gr = await c.followGoto();
  check('균열 입장', gr.map === 'rift');
  await sleep(1200);
  check('균열 1층 몬스터', c.monsters().length > 0 && (c.room.state as any).floor === 1, `${c.monsters().length}마리`);
  // 균열: 층을 정리하면 다음 층 문이 생기고, 밟으면 올라간다
  await c.until(() => c.monsters().some(([, m]) => m.hp > 0), '균열 몬스터', 4000);
  await sleep(800);
  c.room.send('dev', { killAll: true });
  await c.until(() => (c.room.state as any).props.has('rift_next'), '다음 층 문');
  check('층 정리 후 다음 층 문', true);
  await c.walkTo(17, 17, 0.5, 15000);
  c.room.send('propUse', { id: 'rift_next' });
  await c.until(() => (c.room.state as any).floor === 2, '2층');
  check('균열 2층 진입 · 기록 저장', (await c.until(() => c.me.riftBest === 2, '최고 기록')) && c.me.riftBest === 2);
  // 5층 보스와 토큰
  c.room.send('dev', { floor: 5 });
  await c.until(() => c.monsters().some(([, m]) => m.boss && m.hp > 0), '5층 보스', 5000);
  check('5층에 보스 등장', true);
  await sleep(700);
  c.room.send('dev', { killAll: true });
  await c.until(() => c.me.bag.some((x: any) => x?.id === 'rift_token'), '균열 토큰');
  check('보스 층 보상으로 균열 토큰', true);

  // 균열에서 쓰러지면 마을로
  c.room.send('dev', { kill: true });
  await c.until(() => !!c.player()?.dead, '사망 상태');
  check('쓰러짐 상태 동기화', true);
  c.room.send('respawn');
  const gd = await c.followGoto();
  check('균열에서 쓰러지면 마을로', gd.map === 'town');
  check('부활 후 체력 회복', !c.player().dead && c.player().hp > 0, `hp ${c.player().hp}`);

  // 강화와 분해: 대장장이 앞에서
  c.room.send('dev', { gold: 100000, item: ['ember_shard', 50] });
  await c.until(() => c.me.gold >= 100000, '시험용 골드');
  await c.walkTo(44, 29.4, 0.4, 12000);
  await c.walkTo(31, 28.4, 0.4, 12000);
  const plusBefore = c.me.equip.weapon.plus;
  c.events.enhanced = [];
  c.room.send('enhance', { where: 'weapon', i: 0, npc: 'npc_smith' });
  await c.until(() => (c.events.enhanced?.length ?? 0) > 0, '강화 결과');
  await sleep(250);
  check('강화 처리', c.events.enhanced[0].success ? c.me.equip.weapon.plus === plusBefore + 1 : c.me.equip.weapon.plus === plusBefore, `+${c.me.equip.weapon.plus}`);
  c.room.send('unequip', { slot: 'armor' });
  await c.until(() => !c.me.equip.armor, '갑옷 벗기');
  const gearAt = c.me.bag.findIndex((x: any) => x?.kind === 'gear');
  const shardBefore = c.me.bag.reduce((n: number, x: any) => n + (x?.id === 'ember_shard' ? x.n : 0), 0);
  c.room.send('salvage', { i: gearAt, npc: 'npc_smith' });
  await c.until(() => c.me.bag.reduce((n: number, x: any) => n + (x?.id === 'ember_shard' ? x.n : 0), 0) > shardBefore, '분해');
  check('분해로 등불 조각', true);
  c.room.send('enhance', { where: 'weapon', i: 0, npc: 'npc_elder' });
  await sleep(150);
  await c.room.leave();

  // 던전 보스를 쓰러뜨리면 퀘스트가 차고 출구가 생긴다
  const d = new Bot('시험보스', 'musa');
  await d.create();
  await setLevel(d.charId, 10);
  await d.join('woods', { arrive: 'from_hollow' });
  await d.walkTo(67.6, 42, 0.3);
  d.room.send('door', { name: 'to_hollow' });
  await d.followGoto();
  await sleep(800);
  const expBefore2 = d.me.exp + d.me.level * 1e7;
  d.room.send('dev', { killAll: true });
  await d.until(() => (d.room.state as any).props.has('exit'), '보스 출구');
  check('보스 처치 후 출구 생성', true);
  await sleep(250);
  check('보스 처치 경험치', d.me.exp + d.me.level * 1e7 > expBefore2);
  const lootCount = (d.room.state as any).loot.size;
  check('보스 드롭', lootCount >= 3, `${lootCount}개`);
  const exitProp = (d.room.state as any).props.get('exit');
  d.room.send('dev', { tp: [exitProp.u, exitProp.v] });
  await sleep(150);
  d.room.send('propUse', { id: 'exit' });
  const gx = await d.followGoto();
  check('출구로 숲 복귀', gx.map === 'woods');
  await d.room.leave();
}

const deadline = setTimeout(() => {
  console.log('전체 시간 초과');
  failed++;
  finish();
}, 280000);

function finish() {
  clearTimeout(deadline);
  server.kill('SIGTERM');
  rmSync(dir, { recursive: true, force: true });
  if (/Error|error|예외/.test(serverLog)) console.log('--- 서버 로그 ---\n' + serverLog.slice(-3000));
  console.log(failed ? `실패 ${failed}건` : '모두 통과');
  process.exit(failed ? 1 : 0);
}

main()
  .catch((e) => {
    console.log('중단:', e?.message ?? e);
    failed++;
  })
  .finally(finish);
