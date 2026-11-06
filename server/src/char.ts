// 캐릭터 데이터와 순수 규칙: 능력치, 가방, 레벨, 퀘스트, 강화.
// 네트워크·방을 모르므로 단위 테스트가 쉽다.
import { CLASSES, MAX_LEVEL, SKILLS, baseStats, expToNext, skillPointsAt, type BaseStats, type ClassId } from '../../shared/classes';
import {
  BAG_SIZE,
  CONSUMABLES,
  GEAR,
  MAX_PLUS,
  MAX_STACK,
  SLOTS,
  enhanceCost,
  gearStats,
  rollGear,
  salvageYield,
  sellPrice,
  type GearInstance,
  type ItemStack,
  type Slot,
  type StatKey,
} from '../../shared/items';
import { QUEST_BY_ID, countInBag, questAvailable, questComplete } from '../../shared/quests';

export interface CharData {
  id: string;
  account: string;
  name: string;
  cls: ClassId;
  look: number;
  level: number;
  exp: number;
  gold: number;
  hp: number;
  mp: number;
  map: string;
  u: number;
  v: number;
  bag: (ItemStack | null)[];
  vault: (ItemStack | null)[];
  equip: Partial<Record<Slot, GearInstance>>;
  skills: Record<string, number>;
  /** 물약 단축칸 */
  quick: (string | null)[];
  quests: { active: Record<string, number>; done: string[] };
  riftBest: number;
  kills: number;
  tut: number;
  lastWay?: string;
}

export function newChar(id: string, account: string, name: string, cls: ClassId, look: number): CharData {
  const weapon = cls === 'musa' ? 'sword_1' : cls === 'dosa' ? 'staff_1' : 'bow_1';
  const c: CharData = {
    id,
    account,
    name,
    cls,
    look,
    level: 1,
    exp: 0,
    gold: 50,
    hp: 0,
    mp: 0,
    map: 'town',
    u: -1,
    v: -1,
    bag: Array(BAG_SIZE).fill(null),
    vault: Array(24).fill(null),
    equip: { weapon: rollGear(weapon, 0), armor: rollGear('armor_1', 0) },
    skills: {},
    quick: ['potion_hp_s', 'potion_mp_s', null, null],
    quests: { active: {}, done: [] },
    riftBest: 0,
    kills: 0,
    tut: 0,
  };
  addStack(c, 'potion_hp_s', 5);
  addStack(c, 'potion_mp_s', 3);
  addStack(c, 'scroll_home', 1);
  const s = computeStats(c);
  c.hp = s.maxHp;
  c.mp = s.maxMp;
  return c;
}

export function computeStats(c: CharData): BaseStats {
  const s = baseStats(c.cls, c.level);
  for (const slot of SLOTS) {
    const g = c.equip[slot];
    if (!g) continue;
    for (const [k, v] of Object.entries(gearStats(g)) as [StatKey, number][]) s[k] += v;
  }
  s.maxHp = Math.round(s.maxHp);
  s.maxMp = Math.round(s.maxMp);
  s.cdr = Math.min(0.4, s.cdr);
  s.crit = Math.min(0.75, s.crit);
  return s;
}

// ─── 가방 ─────────────────────────────────────────

export const countItem = (c: CharData, id: string) => countInBag(c, id);

/** 묶음 아이템을 넣고, 넣지 못한 개수를 돌려준다 */
export function addStack(c: CharData, id: string, n: number): number {
  for (const it of c.bag) {
    if (n <= 0) break;
    if (it?.kind === 'stack' && it.id === id && it.n < MAX_STACK) {
      const take = Math.min(n, MAX_STACK - it.n);
      it.n += take;
      n -= take;
    }
  }
  for (let i = 0; i < c.bag.length && n > 0; i++) {
    if (!c.bag[i]) {
      const take = Math.min(n, MAX_STACK);
      c.bag[i] = { kind: 'stack', id, n: take };
      n -= take;
    }
  }
  return n;
}

export function removeItem(c: CharData, id: string, n: number): boolean {
  if (countItem(c, id) < n) return false;
  for (let i = c.bag.length - 1; i >= 0 && n > 0; i--) {
    const it = c.bag[i];
    if (it?.kind === 'stack' && it.id === id) {
      const take = Math.min(n, it.n);
      it.n -= take;
      n -= take;
      if (it.n <= 0) c.bag[i] = null;
    }
  }
  return true;
}

export function addGear(c: CharData, g: GearInstance): boolean {
  const i = c.bag.findIndex((x) => !x);
  if (i < 0) return false;
  c.bag[i] = { kind: 'gear', gear: g };
  return true;
}

export const freeSlots = (c: CharData) => c.bag.filter((x) => !x).length;

export function sortBag(c: CharData) {
  const items = c.bag.filter(Boolean) as ItemStack[];
  const rank = (it: ItemStack) => {
    if (it.kind === 'gear') {
      const b = GEAR[it.gear.base];
      return `0${SLOTS.indexOf(b.slot)}${9 - it.gear.rarity}${String(99 - b.req).padStart(2, '0')}`;
    }
    const d = CONSUMABLES[it.id];
    return `${d?.material ? 2 : 1}${it.id}`;
  };
  items.sort((a, b) => rank(a).localeCompare(rank(b)));
  c.bag = [...items, ...Array(BAG_SIZE - items.length).fill(null)];
}

export type Result = { ok: true; msg?: string } | { ok: false; msg: string };

export function equipFromBag(c: CharData, i: number): Result {
  const it = c.bag[i];
  if (!it || it.kind !== 'gear') return { ok: false, msg: '장비가 아니에요' };
  const b = GEAR[it.gear.base];
  if (b.req > c.level) return { ok: false, msg: `${b.req}레벨부터 쓸 수 있어요` };
  if (b.cls && b.cls !== c.cls) return { ok: false, msg: `${CLASSES[b.cls].label} 전용이에요` };
  const old = c.equip[b.slot];
  c.equip[b.slot] = it.gear;
  c.bag[i] = old ? { kind: 'gear', gear: old } : null;
  return { ok: true };
}

export function unequip(c: CharData, slot: Slot): Result {
  const g = c.equip[slot];
  if (!g) return { ok: false, msg: '착용 중이 아니에요' };
  if (!addGear(c, g)) return { ok: false, msg: '가방이 가득 찼어요' };
  delete c.equip[slot];
  return { ok: true };
}

export function buy(c: CharData, id: string, n = 1): Result {
  const stack = CONSUMABLES[id];
  if (stack) {
    const cost = stack.price * n;
    if (stack.price <= 0) return { ok: false, msg: '살 수 없어요' };
    if (c.gold < cost) return { ok: false, msg: '돈이 모자라요' };
    const left = addStack(c, id, n);
    const bought = n - left;
    if (bought <= 0) return { ok: false, msg: '가방이 가득 찼어요' };
    c.gold -= stack.price * bought;
    return { ok: true };
  }
  const g = GEAR[id];
  if (!g) return { ok: false, msg: '없는 물건이에요' };
  if (c.gold < g.price) return { ok: false, msg: '돈이 모자라요' };
  if (!addGear(c, rollGear(id, 0))) return { ok: false, msg: '가방이 가득 찼어요' };
  c.gold -= g.price;
  return { ok: true };
}

export function sell(c: CharData, i: number, n?: number): Result {
  const it = c.bag[i];
  if (!it) return { ok: false, msg: '빈 칸이에요' };
  if (it.kind === 'gear') {
    c.gold += sellPrice(it.gear);
    c.bag[i] = null;
    return { ok: true };
  }
  const d = CONSUMABLES[it.id];
  const take = Math.min(n ?? it.n, it.n);
  c.gold += (d?.sell ?? 1) * take;
  it.n -= take;
  if (it.n <= 0) c.bag[i] = null;
  return { ok: true };
}

export function enhance(c: CharData, where: 'bag' | Slot, i: number, rand: () => number = Math.random): Result & { success?: boolean; plus?: number } {
  const g = where === 'bag' ? (c.bag[i]?.kind === 'gear' ? (c.bag[i] as { gear: GearInstance }).gear : undefined) : c.equip[where];
  if (!g) return { ok: false, msg: '강화할 장비를 고르세요' };
  if (g.plus >= MAX_PLUS) return { ok: false, msg: '더 강화할 수 없어요' };
  const cost = enhanceCost(g);
  if (c.gold < cost.gold) return { ok: false, msg: '돈이 모자라요' };
  if (countItem(c, 'ember_shard') < cost.shards) return { ok: false, msg: '등불 조각이 모자라요' };
  c.gold -= cost.gold;
  removeItem(c, 'ember_shard', cost.shards);
  if (rand() < cost.rate) {
    g.plus += 1;
    return { ok: true, success: true, plus: g.plus };
  }
  if (cost.drop) g.plus = Math.max(0, g.plus - 1);
  return { ok: true, success: false, plus: g.plus };
}

export function salvage(c: CharData, i: number): Result & { shards?: number } {
  const it = c.bag[i];
  if (!it || it.kind !== 'gear') return { ok: false, msg: '장비만 분해할 수 있어요' };
  const shards = salvageYield(it.gear);
  c.bag[i] = null;
  const left = addStack(c, 'ember_shard', shards);
  if (left > 0) return { ok: true, shards: shards - left, msg: '가방이 가득 차 일부를 잃었어요' };
  return { ok: true, shards };
}

// ─── 성장 ─────────────────────────────────────────

/** 경험치를 더하고 오른 레벨 수를 돌려준다 */
export function gainExp(c: CharData, amount: number): number {
  if (c.level >= MAX_LEVEL) return 0;
  c.exp += Math.round(amount);
  let ups = 0;
  while (c.level < MAX_LEVEL && c.exp >= expToNext(c.level)) {
    c.exp -= expToNext(c.level);
    c.level += 1;
    ups++;
  }
  if (c.level >= MAX_LEVEL) c.exp = 0;
  return ups;
}

export const spentPoints = (c: CharData) => Object.values(c.skills).reduce((a, b) => a + b, 0);
export const freePoints = (c: CharData) => skillPointsAt(c.level) - spentPoints(c);

export function skillUp(c: CharData, id: string): Result {
  const s = SKILLS[id];
  if (!s || s.cls !== c.cls) return { ok: false, msg: '배울 수 없는 스킬이에요' };
  if (c.level < s.req) return { ok: false, msg: `${s.req}레벨부터 배울 수 있어요` };
  const rank = c.skills[id] ?? 0;
  if (rank >= s.maxRank) return { ok: false, msg: '최고 단계예요' };
  if (freePoints(c) <= 0) return { ok: false, msg: '스킬 포인트가 없어요' };
  c.skills[id] = rank + 1;
  return { ok: true };
}

export function resetSkills(c: CharData): Result {
  const cost = c.level * 20;
  if (spentPoints(c) === 0) return { ok: false, msg: '찍은 스킬이 없어요' };
  if (c.gold < cost) return { ok: false, msg: `${cost} 냥이 필요해요` };
  c.gold -= cost;
  c.skills = {};
  return { ok: true };
}

// ─── 퀘스트 ─────────────────────────────────────────

export function acceptQuest(c: CharData, id: string): Result {
  const q = QUEST_BY_ID[id];
  if (!q) return { ok: false, msg: '없는 퀘스트예요' };
  if (!questAvailable(c, q)) return { ok: false, msg: '아직 받을 수 없어요' };
  c.quests.active[id] = 0;
  return { ok: true };
}

/** 몬스터 처치 반영. 바뀐 퀘스트가 있으면 true */
export function onKill(c: CharData, mon: string): boolean {
  let changed = false;
  for (const id of Object.keys(c.quests.active)) {
    const q = QUEST_BY_ID[id];
    if (q?.goal.type === 'kill' && q.goal.mon === mon && c.quests.active[id] < q.goal.n) {
      c.quests.active[id] += 1;
      changed = true;
    }
  }
  c.kills += 1;
  return changed;
}

export function onReach(c: CharData, map: string): boolean {
  let changed = false;
  for (const id of Object.keys(c.quests.active)) {
    const q = QUEST_BY_ID[id];
    if (q?.goal.type === 'reach' && q.goal.map === map && !c.quests.active[id]) {
      c.quests.active[id] = 1;
      changed = true;
    }
  }
  return changed;
}

export function turnInQuest(c: CharData, id: string): Result & { levels?: number } {
  const q = QUEST_BY_ID[id];
  if (!q || !(id in c.quests.active)) return { ok: false, msg: '받은 퀘스트가 아니에요' };
  if (!questComplete(c, q)) return { ok: false, msg: '아직 끝나지 않았어요' };
  const r = q.rewards;
  const needSlots = (r.gear ? 1 : 0) + (r.items?.filter(([it]) => countItem(c, it) === 0).length ?? 0);
  const freed = q.goal.type === 'collect' ? 1 : 0;
  if (freeSlots(c) + freed < needSlots) return { ok: false, msg: '가방에 빈칸이 필요해요' };
  if (q.goal.type === 'collect') removeItem(c, q.goal.item, q.goal.n);
  delete c.quests.active[id];
  c.quests.done.push(id);
  c.gold += r.gold;
  for (const [it, n] of r.items ?? []) addStack(c, it, n);
  if (r.gear) addGear(c, rollGear(r.gear.base[c.cls], r.gear.rarity));
  const levels = gainExp(c, r.exp);
  return { ok: true, levels };
}
