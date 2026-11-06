// 예전 이름 → 새 이름. 저장된 캐릭터를 불러올 때 옛 id를 지금 id로 바꾼다. 저장 파일 자체는 고치지 않는다.

export const LEGACY_CLASS: Record<string, string> = { musa: 'musa', dosa: 'dosa', gungsa: 'gungsa' };

export const LEGACY_SKILL: Record<string, string> = {
  musa_hwimori: 'musa_hwimori', musa_dolgyeok: 'musa_dolgyeok', musa_ttanggareugi: 'musa_ttanggareugi', musa_horyeong: 'musa_horyeong', musa_cheongeun: 'musa_cheongeun',
  dosa_hwabu: 'dosa_hwabu', dosa_bingyeolbu: 'dosa_bingyeolbu', dosa_nakseong: 'dosa_nakseong', dosa_hosinbu: 'dosa_hosinbu', dosa_yuseongu: 'dosa_yuseongu',
  gungsa_osi: 'gungsa_osi', gungsa_pyeonjeon: 'gungsa_pyeonjeon', gungsa_olmu: 'gungsa_olmu', gungsa_maenun: 'gungsa_maenun', gungsa_hwasalbi: 'gungsa_hwasalbi',
};

const pick = (table: Record<string, string>, v: string) => table[v] ?? v;

/** 저장된 캐릭터 한 명의 옛 id를 지금 id로 바꾼다 (제자리에서) */
export function migrateChar<T extends { cls: string; skills: Record<string, number> }>(c: T): T {
  c.cls = pick(LEGACY_CLASS, c.cls);
  const skills: Record<string, number> = {};
  for (const [k, v] of Object.entries(c.skills ?? {})) skills[pick(LEGACY_SKILL, k)] = v;
  c.skills = skills;
  return c;
}
