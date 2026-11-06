// 서버 연결: REST 로그인, 방 입장·이동, 메시지 분배
import { Client, type Room } from '@colyseus/sdk';
import type { MapData } from '@shared/mapdata';
import { sfx, playMusic } from './audio';
import { showTitleScene, startWorld, stopWorld, worldEvent } from './game/boot';
import {
  addChat,
  addLoot,
  buffs,
  chars,
  enterError,
  isGuest,
  loginName,
  mapData,
  me,
  npcOpen,
  panels,
  party,
  partyAsk,
  riftBoard,
  screen,
  serverDown,
  serverOnline,
  setCooldown,
  showBig,
  toast,
  type CharSummary,
  type Me,
} from './store';

const SERVER = location.port === '5173' ? `http://${location.hostname}:2567` : location.origin;
const TOKEN_KEY = 'lantern-token';
let client: Client | null = null;
let room: Room | null = null;
let current: CharSummary | null = null;
let token = readToken();
let moving = false;
const mapCache = new Map<string, MapData>();

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeToken(t: string) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 시크릿 창 등: 이번 접속 동안만 유지
  }
}

export const hasToken = () => !!token;
export const currentRoom = () => room;
export const send = (type: string, msg?: unknown) => room?.send(type, msg);

async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const r = await fetch(`${SERVER}${path}`, {
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.err ?? `서버 응답 ${r.status}`);
  return data as T;
}

export async function pingServer() {
  try {
    const d = await api<{ online: number }>('/api/ping');
    serverOnline.value = d.online;
    serverDown.value = false;
  } catch {
    serverDown.value = true;
    serverOnline.value = null;
  }
}

export async function startGuest() {
  const d = await api<{ token: string }>('/api/guest', {});
  writeToken(d.token);
  isGuest.value = true;
}

export async function resumeSession(): Promise<boolean> {
  if (!token) return false;
  try {
    const d = await api<{ guest: boolean; login: string | null }>('/api/me');
    isGuest.value = d.guest;
    loginName.value = d.login;
    await refreshChars();
    return true;
  } catch {
    writeToken('');
    return false;
  }
}

export async function login(id: string, pw: string) {
  const d = await api<{ token: string; login: string }>('/api/login', { login: id, pw });
  writeToken(d.token);
  isGuest.value = false;
  loginName.value = d.login;
  await refreshChars();
}

/** 게스트면 지금 캐릭터를 그대로 정식 계정으로 옮긴다 */
export async function register(id: string, pw: string) {
  const d = await api<{ token: string; login: string }>('/api/register', { login: id, pw });
  writeToken(d.token);
  isGuest.value = false;
  loginName.value = d.login;
}

export function logout() {
  void leaveRoom();
  writeToken('');
  me.value = null;
  chars.value = [];
  screen.value = 'title';
  showTitleScene();
}

export async function refreshChars() {
  const d = await api<{ chars: CharSummary[] }>('/api/chars');
  chars.value = d.chars;
  return d.chars;
}

export async function createChar(name: string, cls: string, look: number) {
  const d = await api<{ char: CharSummary }>('/api/chars', { name, cls, look });
  await refreshChars();
  return d.char;
}

export async function deleteChar(id: string) {
  await api(`/api/chars/${id}`, undefined, 'DELETE');
  await refreshChars();
}

export async function deleteAccount() {
  await api('/api/account', undefined, 'DELETE');
  logout();
}

async function fetchMap(name: string): Promise<MapData> {
  let m = mapCache.get(name);
  if (!m) {
    const r = await fetch(`/maps/${name}.json`);
    m = (await r.json()) as MapData;
    mapCache.set(name, m);
  }
  return m;
}

async function leaveRoom() {
  const r = room;
  room = null;
  stopWorld();
  if (r) {
    r.removeAllListeners?.();
    try {
      await r.leave();
    } catch {
      // 이미 끊긴 경우
    }
  }
}

function wire(r: Room) {
  r.onMessage('*', (type: string | number, msg: any) => {
    switch (type) {
      case 'me':
        me.value = msg as Me;
        break;
      case 'toast':
        toast(msg.text, msg.kind);
        if (msg.kind === 'warn') sfx('deny');
        break;
      case 'lootToast':
        addLoot(msg.label, msg.rarity);
        break;
      case 'cd':
        setCooldown(msg.id, msg.t);
        break;
      case 'buff':
        buffs.value = [...buffs.value.filter((b) => b.id !== msg.id), { id: msg.id, end: performance.now() + msg.t * 1000, total: msg.t }];
        break;
      case 'chat':
        addChat(msg.from, msg.text, msg.ch);
        break;
      case 'party':
        party.value = msg;
        break;
      case 'partyAsk':
        partyAsk.value = msg.from;
        sfx('quest');
        break;
      case 'sfx':
        sfx(msg.id);
        break;
      case 'skillFail':
        if (msg.why === 'mp') toast('기력이 모자라요', 'warn', 1400);
        sfx('deny');
        break;
      case 'enhanced':
        sfx(msg.success ? 'levelup' : 'deny');
        toast(msg.success ? `강화 성공! +${msg.plus}` : `강화 실패 · 현재 +${msg.plus}`, msg.success ? 'good' : 'warn');
        break;
      case 'qProg':
        break;
      case 'rift':
        riftBoard.value = msg.board ?? [];
        break;
      case 'riftFloor':
        showBig(`${msg.floor}층`, '저승길');
        break;
      case 'riftClear':
        showBig('층 정리', '가운데 빛으로 들어가세요');
        break;
      case 'bossDead':
        showBig(msg.name, '쓰러뜨렸어요', 3400);
        sfx('levelup');
        break;
      case 'kicked':
        toast(msg.text, 'warn', 6000);
        break;
      case 'goto':
        void moveTo(msg.map, msg.arrive, msg.roomId);
        return;
      default:
        break;
    }
    worldEvent(String(type), msg);
  });
  r.onLeave((code: number) => {
    // 일부러 나간 게 아니면 마을로 다시 잇는다
    if (r === room && code !== 4000 && code !== 1000 && !moving) void reconnect();
  });
  r.onError((_code: number, message?: string) => {
    if (message) toast(message, 'warn');
  });
}

async function reconnect() {
  if (!current || moving) return;
  toast('서버와 끊겼어요 · 다시 연결 중', 'warn', 4000);
  for (let i = 0; i < 6; i++) {
    await new Promise((res) => setTimeout(res, 1500 + i * 1000));
    try {
      await moveTo(current.map === 'town' ? 'town' : current.map);
      toast('다시 연결됐어요', 'good');
      return;
    } catch {
      // 다음 시도
    }
  }
  toast('연결할 수 없어요', 'warn', 6000);
  screen.value = 'chars';
}

export async function enterGame(c: CharSummary) {
  current = c;
  screen.value = 'loading';
  try {
    await moveTo(c.map || 'town');
  } catch (e) {
    console.error('입장 실패', (e as Error)?.stack ?? e);
    enterError.value = String((e as Error)?.message ?? e);
    screen.value = 'chars';
    throw e;
  }
}

export async function moveTo(map: string, arrive?: string, roomId?: string) {
  if (!current) return;
  if (moving) return;
  moving = true;
  npcOpen.value = null;
  panels.value = { ...panels.value, map: false };
  try {
    client ??= new Client(SERVER);
    const data = await fetchMap(map);
    await leaveRoom();
    const options = { token, charId: current.id, arrive };
    let joined: Room;
    if (roomId) {
      joined = await client.joinById(roomId, options);
    } else {
      joined = await client.joinOrCreate(map, options);
    }
    room = joined;
    current = { ...current, map };
    mapData.value = data;
    wire(joined);
    // 첫 상태가 도착한 뒤에 화면을 시작한다
    await new Promise<void>((resolve) => {
      if ((joined.state as { mapName?: string } | undefined)?.mapName) resolve();
      else joined.onStateChange.once(() => resolve());
    });
    buffs.value = [];
    startWorld(joined, data);
    playMusic(data.music);
    screen.value = 'game';
  } catch (e) {
    // 입장에 실패하면 마을로 돌려보낸다
    if (map !== 'town') {
      moving = false;
      toast('이동하지 못했어요 · 마을로 돌아가요', 'warn');
      return moveTo('town', 'start');
    }
    throw e;
  } finally {
    moving = false;
  }
}

export async function backToChars() {
  await leaveRoom();
  current = null;
  me.value = null;
  party.value = null;
  panels.value = {};
  playMusic('');
  await refreshChars();
  screen.value = 'chars';
  showTitleScene();
}
