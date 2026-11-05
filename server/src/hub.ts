// 방을 넘나드는 정보: 접속자 목록, 파티, 전체 채팅
import type { Client } from '@colyseus/core';
import type { CharData } from './char';

export interface Online {
  char: CharData;
  client: Client;
  roomId: string;
  map: string;
  party?: string;
  /** 파티 초대를 보낸 사람 */
  invitedBy?: string;
  hpRatio: number;
  /** 방을 옮기는 중인 채로 끊겼을 때 정리하는 타이머 */
  leaveTimer?: ReturnType<typeof setTimeout>;
}

export interface Party {
  id: string;
  leader: string;
  members: string[];
  /** 지도 이름 → 인스턴스 방 번호 */
  instances: Record<string, string>;
}

export const PARTY_MAX = 4;

const online = new Map<string, Online>();
const byName = new Map<string, string>();
const parties = new Map<string, Party>();
/** 파티 소속은 방을 옮겨도 유지한다 */
const partyOf = new Map<string, string>();
let nextParty = 1;

export const onlineCount = () => online.size;
export const getOnline = (charId: string) => online.get(charId);
export const findByName = (name: string) => {
  const id = byName.get(name);
  return id ? online.get(id) : undefined;
};

export function register(o: Online) {
  const p = partyOf.get(o.char.id);
  if (p && parties.has(p)) o.party = p;
  online.set(o.char.id, o);
  byName.set(o.char.name, o.char.id);
  sendPartyState(o.party);
}

export function unregister(charId: string, client: Client) {
  const o = online.get(charId);
  if (!o || o.client !== client) return;
  online.delete(charId);
  byName.delete(o.char.name);
  // 파티는 잠시 끊겨도 유지한다. 방을 옮기는 중일 수 있어서다.
  sendPartyState(o.party);
}

export function broadcastChat(from: string, text: string, channel: 'all' | 'party', partyId?: string) {
  const msg = { from, text, ch: channel, at: Date.now() };
  if (channel === 'party') {
    const p = partyId ? parties.get(partyId) : undefined;
    if (!p) return false;
    for (const id of p.members) online.get(id)?.client.send('chat', msg);
    return true;
  }
  for (const o of online.values()) o.client.send('chat', msg);
  return true;
}

export function systemChat(text: string) {
  for (const o of online.values()) o.client.send('chat', { from: '', text, ch: 'sys', at: Date.now() });
}

// ─── 파티 ─────────────────────────────────────────

export function getParty(id?: string) {
  return id ? parties.get(id) : undefined;
}

export function invite(from: Online, targetName: string): string | null {
  const t = findByName(targetName);
  if (!t) return '접속 중이 아니에요';
  if (t.char.id === from.char.id) return '자기 자신은 초대할 수 없어요';
  if (t.party) return '이미 파티에 있어요';
  const p = getParty(from.party);
  if (p && p.leader !== from.char.id) return '파티장만 초대할 수 있어요';
  if (p && p.members.length >= PARTY_MAX) return '파티가 가득 찼어요';
  t.invitedBy = from.char.id;
  t.client.send('partyAsk', { from: from.char.name });
  return null;
}

export function answerInvite(me: Online, yes: boolean) {
  const inviterId = me.invitedBy;
  me.invitedBy = undefined;
  if (!inviterId) return;
  const inviter = online.get(inviterId);
  if (!inviter) {
    me.client.send('toast', { text: '초대한 사람이 나갔어요', kind: 'warn' });
    return;
  }
  if (!yes) {
    inviter.client.send('toast', { text: `${me.char.name}님이 거절했어요`, kind: 'warn' });
    return;
  }
  if (me.party) return;
  let p = getParty(inviter.party);
  if (!p) {
    p = { id: `p${nextParty++}`, leader: inviter.char.id, members: [inviter.char.id], instances: {} };
    parties.set(p.id, p);
    inviter.party = p.id;
    partyOf.set(inviter.char.id, p.id);
  }
  if (p.members.length >= PARTY_MAX) {
    me.client.send('toast', { text: '파티가 가득 찼어요', kind: 'warn' });
    return;
  }
  p.members.push(me.char.id);
  me.party = p.id;
  partyOf.set(me.char.id, p.id);
  sendPartyState(p.id);
}

export function leaveParty(charId: string) {
  const pid = partyOf.get(charId);
  const p = pid ? parties.get(pid) : undefined;
  partyOf.delete(charId);
  const o = online.get(charId);
  if (o) {
    o.party = undefined;
    o.client.send('party', null);
  }
  if (!p) return;
  p.members = p.members.filter((m) => m !== charId);
  if (p.members.length <= 1) {
    for (const m of p.members) {
      partyOf.delete(m);
      const x = online.get(m);
      if (x) {
        x.party = undefined;
        x.client.send('party', null);
      }
    }
    parties.delete(p.id);
    return;
  }
  if (p.leader === charId) p.leader = p.members[0];
  sendPartyState(p.id);
}

export function sendPartyState(pid?: string) {
  const p = getParty(pid);
  if (!p) return;
  const members = p.members.map((id) => {
    const o = online.get(id);
    return o
      ? { id, name: o.char.name, cls: o.char.cls, level: o.char.level, hp: o.hpRatio, map: o.map, on: true, leader: id === p.leader }
      : { id, name: '', cls: '', level: 0, hp: 0, map: '', on: false, leader: id === p.leader };
  });
  for (const id of p.members) online.get(id)?.client.send('party', { id: p.id, members });
}

/** 끊긴 지 오래된 파티원을 정리할 때 쓴다 */
export function dropFromPartyIfGone(charId: string) {
  if (!online.has(charId)) leaveParty(charId);
}

export const partyMembersOnline = (pid?: string): Online[] => {
  const p = getParty(pid);
  if (!p) return [];
  return p.members.map((m) => online.get(m)).filter(Boolean) as Online[];
};
