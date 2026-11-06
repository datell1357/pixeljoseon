// 예전 이름 → 새 이름. 저장된 캐릭터를 불러올 때 옛 id를 지금 id로 바꾼다. 저장 파일 자체는 고치지 않는다.

export const LEGACY_CLASS: Record<string, string> = { musa: 'musa', dosa: 'dosa', gungsa: 'gungsa' };

export const LEGACY_SKILL: Record<string, string> = {
  musa_hwimori: 'musa_hwimori', musa_dolgyeok: 'musa_dolgyeok', musa_ttanggareugi: 'musa_ttanggareugi', musa_horyeong: 'musa_horyeong', musa_cheongeun: 'musa_cheongeun',
  dosa_hwabu: 'dosa_hwabu', dosa_bingyeolbu: 'dosa_bingyeolbu', dosa_nakseong: 'dosa_nakseong', dosa_hosinbu: 'dosa_hosinbu', dosa_yuseongu: 'dosa_yuseongu',
  gungsa_osi: 'gungsa_osi', gungsa_pyeonjeon: 'gungsa_pyeonjeon', gungsa_olmu: 'gungsa_olmu', gungsa_maenun: 'gungsa_maenun', gungsa_hwasalbi: 'gungsa_hwasalbi',
};

const GEAR_PREFIX: Record<string, string> = { sword: 'hwando', staff: 'chorongdae', bow: 'gakgung', helm: 'tugu', armor: 'gabot', boots: 'sin', ring: 'garakji', amulet: 'norigae' };

export const LEGACY_ITEM: Record<string, string> = {
  potion_hp_s: 'bohyeolhwan', potion_hp_l: 'bohyeoltang', potion_mp_s: 'cheongsimhwan', potion_mp_l: 'jeonggitang',
  scroll_home: 'gwihyang_bujeok', ember_shard: 'jeongcheol', moss_core: 'jimseung_teol', boar_tusk: 'eomni',
  ash_core: 'jimseung_gajuk', warden_seal: 'soebineul', rift_token: 'jeoseung_yeopjeon',
};

const pick = (table: Record<string, string>, v: string) => table[v] ?? v;

/** 옛 아이템 id → 지금 id. 장비는 'sword_2' 같은 꼴을 'hwando_2'로 */
export function itemId(id: string): string {
  const m = /^([a-z]+)_(\d+)$/.exec(id);
  if (m && GEAR_PREFIX[m[1]]) return `${GEAR_PREFIX[m[1]]}_${m[2]}`;
  return pick(LEGACY_ITEM, id);
}

type Stack = { kind: 'gear'; gear: { base: string } } | { kind: 'stack'; id: string } | null;
const fixStack = (x: Stack) => {
  if (!x) return;
  if (x.kind === 'gear') x.gear.base = itemId(x.gear.base);
  else x.id = itemId(x.id);
};

/** 저장된 캐릭터 한 명의 옛 id를 지금 id로 바꾼다 (제자리에서) */
export function migrateChar<T extends { cls: string; skills: Record<string, number>; bag?: unknown[]; vault?: unknown[]; equip?: Record<string, unknown>; quick?: (string | null)[] }>(c: T): T {
  c.cls = pick(LEGACY_CLASS, c.cls);
  const skills: Record<string, number> = {};
  for (const [k, v] of Object.entries(c.skills ?? {})) skills[pick(LEGACY_SKILL, k)] = v;
  c.skills = skills;
  for (const x of [...(c.bag ?? []), ...(c.vault ?? [])]) fixStack(x as Stack);
  for (const g of Object.values(c.equip ?? {})) if (g) (g as { base: string }).base = itemId((g as { base: string }).base);
  if (c.quick) c.quick = c.quick.map((q) => (q ? itemId(q) : q));
  return c;
}
