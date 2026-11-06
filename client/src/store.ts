// 화면과 게임이 함께 보는 상태
import { signal } from '@preact/signals';
import type { BaseStats, ClassId } from '@shared/classes';
import type { GearInstance, ItemStack, Slot } from '@shared/items';
import type { MapData } from '@shared/mapdata';

export type Screen = 'title' | 'chars' | 'create' | 'loading' | 'game';

export interface Me {
  name: string;
  cls: ClassId;
  look: number;
  level: number;
  exp: number;
  expNext: number;
  gold: number;
  bag: (ItemStack | null)[];
  vault: (ItemStack | null)[];
  equip: Partial<Record<Slot, GearInstance>>;
  skills: Record<string, number>;
  points: number;
  quick: (string | null)[];
  quests: { active: Record<string, number>; done: string[] };
  stats: BaseStats;
  riftBest: number;
  kills: number;
}

export interface CharSummary {
  id: string;
  name: string;
  cls: ClassId;
  look: number;
  level: number;
  map: string;
  gear?: string;
}

export interface Vitals {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  shield: number;
  dead: boolean;
}

export interface PartyMember {
  id: string;
  name: string;
  cls: string;
  level: number;
  hp: number;
  map: string;
  on: boolean;
  leader: boolean;
}

export interface ChatLine {
  id: number;
  from: string;
  text: string;
  ch: string;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'good' | 'warn' | 'info';
}

export interface LootLine {
  id: number;
  label: string;
  rarity: number;
}

export const screen = signal<Screen>('title');
export const loadProgress = signal(0);
export const assetsReady = signal(false);
export const serverOnline = signal<number | null>(null);
export const serverDown = signal(false);
export const chars = signal<CharSummary[]>([]);
export const isGuest = signal(true);
export const loginName = signal<string | null>(null);

export const me = signal<Me | null>(null);
export const vitals = signal<Vitals>({ hp: 1, maxHp: 1, mp: 1, maxMp: 1, shield: 0, dead: false });
export const mapData = signal<MapData | null>(null);
export const party = signal<{ id: string; members: PartyMember[] } | null>(null);
export const partyAsk = signal<string | null>(null);
export const chatLines = signal<ChatLine[]>([]);
export const chatOpen = signal(false);
export const toasts = signal<Toast[]>([]);
export const lootFeed = signal<LootLine[]>([]);
export const cooldowns = signal<Record<string, { end: number; total: number }>>({});
export const buffs = signal<{ id: string; end: number; total: number }[]>([]);
export const boss = signal<{ name: string; hp: number; maxHp: number; level: number } | null>(null);
export const floor = signal<{ n: number; remain: number } | null>(null);
export const riftBoard = signal<{ name: string; cls: string; floor: number }[]>([]);

export type PanelId = 'bag' | 'equip' | 'skills' | 'quests' | 'map' | 'party' | 'settings' | 'help';
export const panels = signal<Partial<Record<PanelId, boolean>>>({});
export const npcOpen = signal<string | null>(null);
export const npcTab = signal<'talk' | 'shop' | 'forge' | 'vault' | 'rift'>('talk');
export const prompt = signal<{ label: string; key: string } | null>(null);
export const bigText = signal<{ id: number; title: string; sub?: string } | null>(null);
export const isTouch = signal(false);
export const settings = signal(loadSettings());
export const enterError = signal('');

export interface Settings {
  sfx: number;
  music: number;
  shake: boolean;
  names: boolean;
  /** 화면 확대: 0은 자동 */
  zoom: number;
  /** 그래픽: auto는 느리면 스스로 낮춘다 */
  gfx: 'auto' | 'high' | 'low';
}

function loadSettings(): Settings {
  const def: Settings = { sfx: 0.8, music: 0.5, shake: true, names: true, zoom: 0, gfx: 'auto' };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem('lantern-settings') ?? '{}') };
  } catch {
    return def;
  }
}

export function saveSettings(s: Settings) {
  settings.value = s;
  try {
    localStorage.setItem('lantern-settings', JSON.stringify(s));
  } catch {
    // 저장 공간을 못 써도 게임은 돈다
  }
}

let seq = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 2800) {
  const id = seq++;
  toasts.value = [...toasts.value.slice(-3), { id, text, kind }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, ms);
}

export function addLoot(label: string, rarity: number) {
  const id = seq++;
  lootFeed.value = [...lootFeed.value.slice(-5), { id, label, rarity }];
  setTimeout(() => {
    lootFeed.value = lootFeed.value.filter((t) => t.id !== id);
  }, 3400);
}

export function addChat(from: string, text: string, ch: string) {
  chatLines.value = [...chatLines.value.slice(-80), { id: seq++, from, text, ch }];
}

export function showBig(title: string, sub?: string, ms = 2600) {
  const id = seq++;
  bigText.value = { id, title, sub };
  setTimeout(() => {
    if (bigText.value?.id === id) bigText.value = null;
  }, ms);
}

export function togglePanel(id: PanelId) {
  const next = { ...panels.value };
  next[id] = !next[id];
  panels.value = next;
}

export function closeAll(): boolean {
  let closed = false;
  if (npcOpen.value) {
    npcOpen.value = null;
    closed = true;
  }
  if (Object.values(panels.value).some(Boolean)) {
    panels.value = {};
    closed = true;
  }
  return closed;
}

export function setCooldown(id: string, t: number) {
  cooldowns.value = { ...cooldowns.value, [id]: { end: performance.now() + t * 1000, total: t } };
}

export function cooldownLeft(id: string): number {
  const c = cooldowns.value[id];
  if (!c) return 0;
  return Math.max(0, (c.end - performance.now()) / 1000);
}
