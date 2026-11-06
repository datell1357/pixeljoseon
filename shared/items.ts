// 아이템 정의와 생성 규칙
import type { ClassId } from './classes';

export type Slot = 'weapon' | 'helm' | 'armor' | 'boots' | 'ring' | 'amulet';
export const SLOTS: Slot[] = ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet'];
export const SLOT_LABEL: Record<Slot, string> = {
  weapon: '무기',
  helm: '투구',
  armor: '갑옷',
  boots: '신발',
  ring: '가락지',
  amulet: '노리개',
};

export type Rarity = 0 | 1 | 2 | 3;
export const RARITY_LABEL = ['일반', '고급', '희귀', '영웅'];
export const RARITY_COLOR = ['#d7d3c8', '#7ee08a', '#6fb7ff', '#c79bff'];

export type StatKey = 'atk' | 'def' | 'maxHp' | 'maxMp' | 'crit' | 'critDmg' | 'speed' | 'aspd' | 'cdr' | 'regenHp' | 'regenMp';

export const STAT_LABEL: Record<StatKey, string> = {
  atk: '공격력',
  def: '방어력',
  maxHp: '체력',
  maxMp: '기력',
  crit: '치명타 확률',
  critDmg: '치명타 피해',
  speed: '이동 속도',
  aspd: '공격 속도',
  cdr: '재사용 감소',
  regenHp: '체력 회복',
  regenMp: '기력 회복',
};

export const PERCENT_STATS: StatKey[] = ['crit', 'critDmg', 'aspd', 'cdr'];

export function formatStat(k: StatKey, v: number): string {
  if (PERCENT_STATS.includes(k)) return `+${Math.round(v * 100)}%`;
  if (k === 'speed') return `+${v.toFixed(2)}`;
  if (k === 'regenHp' || k === 'regenMp') return `+${v.toFixed(1)}/초`;
  return `+${Math.round(v)}`;
}

export interface GearBase {
  id: string;
  name: string;
  slot: Slot;
  icon: string;
  cls?: ClassId;
  req: number;
  tier: number;
  stats: Partial<Record<StatKey, number>>;
  price: number;
}

const mk = (id: string, name: string, slot: Slot, icon: string, req: number, tier: number, stats: GearBase['stats'], price: number, cls?: ClassId): GearBase => ({ id, name, slot, icon, req, tier, stats, price, cls });

export const GEAR: Record<string, GearBase> = Object.fromEntries(
  [
    mk('sword_1', '무딘 환도', 'weapon', 'sword_1', 1, 1, { atk: 4 }, 40, 'warrior'),
    mk('sword_2', '환도', 'weapon', 'sword_2', 6, 2, { atk: 11 }, 260, 'warrior'),
    mk('sword_3', '청강 환도', 'weapon', 'sword_3', 12, 3, { atk: 22, maxHp: 30 }, 1100, 'warrior'),
    mk('sword_4', '청등 대도', 'weapon', 'sword_4', 20, 4, { atk: 42, maxHp: 80 }, 5200, 'warrior'),
    mk('staff_1', '등잔 지팡이', 'weapon', 'staff_1', 1, 1, { atk: 5 }, 40, 'mage'),
    mk('staff_2', '놋쇠 초롱대', 'weapon', 'staff_2', 6, 2, { atk: 13, maxMp: 12 }, 260, 'mage'),
    mk('staff_3', '천년목 가지', 'weapon', 'staff_3', 12, 3, { atk: 26, maxMp: 30 }, 1100, 'mage'),
    mk('staff_4', '꺼지지 않는 청사초롱', 'weapon', 'staff_4', 20, 4, { atk: 50, maxMp: 70 }, 5200, 'mage'),
    mk('bow_1', '목궁', 'weapon', 'bow_1', 1, 1, { atk: 4 }, 40, 'archer'),
    mk('bow_2', '각궁', 'weapon', 'bow_2', 6, 2, { atk: 12, crit: 0.01 }, 260, 'archer'),
    mk('bow_3', '덩굴 각궁', 'weapon', 'bow_3', 12, 3, { atk: 24, crit: 0.03 }, 1100, 'archer'),
    mk('bow_4', '새벽 각궁', 'weapon', 'bow_4', 20, 4, { atk: 46, crit: 0.05 }, 5200, 'archer'),
    mk('helm_1', '가죽 벙거지', 'helm', 'helm_1', 1, 1, { def: 1, maxHp: 6 }, 30),
    mk('helm_2', '철 투구', 'helm', 'helm_2', 7, 2, { def: 4, maxHp: 22 }, 220),
    mk('helm_3', '흑철 투구', 'helm', 'helm_3', 14, 3, { def: 9, maxHp: 60 }, 1000),
    mk('armor_1', '누비 철릭', 'armor', 'armor_1', 1, 1, { def: 2, maxHp: 10 }, 40),
    mk('armor_2', '쇄자갑', 'armor', 'armor_2', 7, 2, { def: 6, maxHp: 34 }, 280),
    mk('armor_3', '흑철 찰갑', 'armor', 'armor_3', 14, 3, { def: 13, maxHp: 90 }, 1200),
    mk('boots_1', '짚신', 'boots', 'boots_1', 1, 1, { def: 1, speed: 0.04 }, 30),
    mk('boots_2', '가죽 목화', 'boots', 'boots_2', 7, 2, { def: 3, speed: 0.1 }, 220),
    mk('boots_3', '축지 목화', 'boots', 'boots_3', 14, 3, { def: 6, speed: 0.2 }, 1000),
    mk('ring_1', '구리 가락지', 'ring', 'ring_1', 4, 1, { crit: 0.02 }, 120),
    mk('ring_2', '호박 가락지', 'ring', 'ring_2', 13, 3, { crit: 0.05, atk: 5 }, 1200),
    mk('amulet_1', '초롱 노리개', 'amulet', 'amulet_1', 4, 1, { maxMp: 14, regenMp: 0.5 }, 120),
    mk('amulet_2', '새벽 노리개', 'amulet', 'amulet_2', 13, 3, { maxMp: 40, regenMp: 1.2, cdr: 0.04 }, 1200),
  ].map((g) => [g.id, g]),
);

export interface ConsumableDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  price: number;
  sell: number;
  hp?: number;
  mp?: number;
  home?: boolean;
  /** 재료 (사용 불가) */
  material?: boolean;
  cd?: number;
}

export const CONSUMABLES: Record<string, ConsumableDef> = {
  potion_hp_s: { id: 'potion_hp_s', name: '보혈환', icon: 'potion_hp_s', desc: '체력을 60 회복합니다.', price: 12, sell: 3, hp: 60, cd: 4 },
  potion_hp_l: { id: 'potion_hp_l', name: '보혈탕', icon: 'potion_hp_l', desc: '체력을 280 회복합니다.', price: 60, sell: 15, hp: 280, cd: 4 },
  potion_mp_s: { id: 'potion_mp_s', name: '청심환', icon: 'potion_mp_s', desc: '기력을 40 회복합니다.', price: 12, sell: 3, mp: 40, cd: 4 },
  potion_mp_l: { id: 'potion_mp_l', name: '정기탕', icon: 'potion_mp_l', desc: '기력을 160 회복합니다.', price: 60, sell: 15, mp: 160, cd: 4 },
  scroll_home: { id: 'scroll_home', name: '귀향 부적', icon: 'scroll_home', desc: '초롱골로 돌아갑니다.', price: 30, sell: 8, home: true, cd: 1 },
  ember_shard: { id: 'ember_shard', name: '정철 조각', icon: 'ember_shard', desc: '장비를 강화할 때 씁니다.', price: 0, sell: 4, material: true },
  moss_core: { id: 'moss_core', name: '짐승 털', icon: 'moss_core', desc: '숲 짐승의 털. 팔면 돈이 됩니다.', price: 0, sell: 6, material: true },
  boar_tusk: { id: 'boar_tusk', name: '멧돼지 어금니', icon: 'boar_tusk', desc: '단단한 어금니. 퀘스트에 씁니다.', price: 0, sell: 8, material: true },
  ash_core: { id: 'ash_core', name: '짐승 가죽', icon: 'ash_core', desc: '큰 짐승의 가죽. 곳간지기가 겨울나기에 씁니다.', price: 0, sell: 14, material: true },
  warden_seal: { id: 'warden_seal', name: '불가사리 쇠비늘', icon: 'warden_seal', desc: '쇠를 먹고 자란 불가사리의 비늘.', price: 0, sell: 300, material: true },
  rift_token: { id: 'rift_token', name: '저승 엽전', icon: 'rift_token', desc: '저승길 깊은 곳에서 얻는 엽전. 보부상이 장비와 바꿔 줍니다.', price: 0, sell: 10, material: true },
};

/** 드롭 장비 강화용 품질에 따른 추가 능력 수 */
export const AFFIX_COUNT: Record<Rarity, number> = { 0: 0, 1: 1, 2: 2, 3: 3 };
export const RARITY_MULT: Record<Rarity, number> = { 0: 1, 1: 1.1, 2: 1.25, 3: 1.45 };

const AFFIXES: { k: StatKey; base: number; perTier: number; slots?: Slot[] }[] = [
  { k: 'atk', base: 1.5, perTier: 2.4 },
  { k: 'def', base: 1, perTier: 1.5 },
  { k: 'maxHp', base: 8, perTier: 14 },
  { k: 'maxMp', base: 6, perTier: 8 },
  { k: 'crit', base: 0.01, perTier: 0.008 },
  { k: 'critDmg', base: 0.04, perTier: 0.03 },
  { k: 'aspd', base: 0.015, perTier: 0.012 },
  { k: 'speed', base: 0.03, perTier: 0.025, slots: ['boots', 'amulet'] },
  { k: 'cdr', base: 0.01, perTier: 0.008, slots: ['helm', 'amulet', 'ring'] },
  { k: 'regenHp', base: 0.3, perTier: 0.3 },
  { k: 'regenMp', base: 0.2, perTier: 0.2 },
];

export interface GearInstance {
  uid: string;
  base: string;
  rarity: Rarity;
  plus: number;
  affixes: [StatKey, number][];
}

export type ItemStack =
  | { kind: 'gear'; gear: GearInstance }
  | { kind: 'stack'; id: string; n: number };

export function rollGear(baseId: string, rarity: Rarity, rand: () => number = Math.random): GearInstance {
  const base = GEAR[baseId];
  const pool = AFFIXES.filter((a) => !a.slots || a.slots.includes(base.slot));
  const affixes: [StatKey, number][] = [];
  const count = AFFIX_COUNT[rarity];
  const used = new Set<StatKey>();
  while (affixes.length < count && used.size < pool.length) {
    const a = pool[Math.floor(rand() * pool.length)];
    if (used.has(a.k)) continue;
    used.add(a.k);
    const v = (a.base + a.perTier * base.tier) * (0.8 + rand() * 0.4);
    affixes.push([a.k, Number(v.toFixed(3))]);
  }
  return { uid: `${Date.now().toString(36)}${Math.floor(rand() * 1e9).toString(36)}`, base: baseId, rarity, plus: 0, affixes };
}

export const MAX_PLUS = 10;
/** 강화당 기본 능력치 상승 */
export const PLUS_RATE = 0.09;

/** 강화 비용과 성공률 */
export function enhanceCost(g: GearInstance) {
  const tier = GEAR[g.base].tier;
  const p = g.plus;
  return {
    gold: Math.round((60 + p * p * 40) * tier),
    shards: 1 + Math.floor(p * 0.8) + (tier - 1),
    rate: Math.max(0.3, 1 - p * 0.08),
    /** 실패 시 단계 하락 */
    drop: p >= 6,
  };
}

/** 분해 시 얻는 등불 조각 수 */
export function salvageYield(g: GearInstance): number {
  const tier = GEAR[g.base].tier;
  return (1 + g.rarity * 2) * tier + g.plus;
}

export function gearStats(g: GearInstance): Partial<Record<StatKey, number>> {
  const base = GEAR[g.base];
  const out: Partial<Record<StatKey, number>> = {};
  const m = RARITY_MULT[g.rarity] * (1 + g.plus * PLUS_RATE);
  for (const [k, v] of Object.entries(base.stats) as [StatKey, number][]) out[k] = (out[k] ?? 0) + v * m;
  for (const [k, v] of g.affixes) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** 겉모습에 필요한 값만 추린 장비 한 벌. 슬롯 순서는 SLOTS와 같고 방 상태로 모두에게 동기화된다. */
export function gearKey(equip: Partial<Record<Slot, GearInstance>>): string {
  return SLOTS.map((s) => {
    const g = equip[s];
    return g ? `${g.base}.${g.rarity}.${g.plus}` : '';
  }).join(',');
}

export interface WornPiece {
  base: string;
  /** 같은 슬롯 안의 단계. sword_3이면 3 */
  tier: number;
  rarity: Rarity;
  /** 강화 빛 단계 0~3 */
  glow: number;
}

/** 강화 수치를 빛 단계로. +4, +7, +10에서 눈에 띄게 달라진다 */
export function plusGlow(plus: number): number {
  return plus >= 10 ? 3 : plus >= 7 ? 2 : plus >= 4 ? 1 : 0;
}

export function parseGearKey(key: string): Partial<Record<Slot, WornPiece>> {
  const out: Partial<Record<Slot, WornPiece>> = {};
  const parts = key.split(',');
  SLOTS.forEach((slot, i) => {
    const [base, rarity, plus] = (parts[i] ?? '').split('.');
    const def = GEAR[base];
    if (!def || def.slot !== slot) return;
    const r = Number(rarity);
    out[slot] = { base, tier: Number(base.split('_')[1]) || 1, rarity: (r >= 0 && r <= 3 ? r : 0) as Rarity, glow: plusGlow(Number(plus) || 0) };
  });
  return out;
}

/** 강화 수치가 달라도 빛 단계가 같으면 모델을 다시 짓지 않도록 키를 줄인다 */
export function gearVisualKey(key: string): string {
  const worn = parseGearKey(key);
  return SLOTS.map((s) => {
    const w = worn[s];
    return w ? `${w.base}.${w.rarity}.${w.glow}` : '';
  }).join(',');
}

/** 인물 모델 이름. 장비가 없으면 처음 입는 옷차림으로 보여 준다 */
export function pcSheet(cls: string, look: number, gear?: string): string {
  const base = `pc_${cls}_${'abc'[look] ?? 'a'}`;
  return gear === undefined ? base : `${base}#${gearVisualKey(gear)}`;
}

export function sellPrice(g: GearInstance): number {
  return Math.round(GEAR[g.base].price * 0.2 * (1 + g.rarity * 0.6) * (1 + g.plus * 0.2));
}

export function itemName(it: ItemStack): string {
  if (it.kind === 'gear') {
    const b = GEAR[it.gear.base];
    return (it.gear.plus ? `+${it.gear.plus} ` : '') + b.name;
  }
  return CONSUMABLES[it.id]?.name ?? it.id;
}

/** 상인이 파는 물건 */
export const SHOP_STOCK: string[] = [
  'potion_hp_s', 'potion_mp_s', 'potion_hp_l', 'potion_mp_l', 'scroll_home',
  'sword_1', 'staff_1', 'bow_1', 'sword_2', 'staff_2', 'bow_2',
  'helm_1', 'armor_1', 'boots_1', 'ring_1', 'amulet_1',
  'helm_2', 'armor_2', 'boots_2',
];

/** 저승 엽전 교환 */
export const RIFT_STOCK: { base: string; tokens: number; rarity: Rarity }[] = [
  { base: 'helm_3', tokens: 12, rarity: 1 },
  { base: 'armor_3', tokens: 14, rarity: 1 },
  { base: 'boots_3', tokens: 12, rarity: 1 },
  { base: 'ring_2', tokens: 16, rarity: 2 },
  { base: 'amulet_2', tokens: 16, rarity: 2 },
];

/** 레벨대별 드롭 후보 장비 */
export function dropPool(level: number, cls?: ClassId): string[] {
  return Object.values(GEAR)
    .filter((g) => g.req <= level + 2 && g.req >= level - 9 && (!g.cls || !cls || g.cls === cls))
    .map((g) => g.id);
}

export function rollRarity(bonus: number, r: number): Rarity {
  if (r < 0.015 + bonus * 0.3) return 3;
  if (r < 0.09 + bonus) return 2;
  if (r < 0.32 + bonus) return 1;
  return 0;
}

export const BAG_SIZE = 32;
export const MAX_STACK = 99;
