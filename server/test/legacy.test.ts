import { describe, expect, it } from 'vitest';
import { migrateChar } from '../../shared/legacy';
import { CLASSES, SKILLS } from '../../shared/classes';
import { CONSUMABLES, GEAR } from '../../shared/items';

describe('예전 저장 데이터', () => {
  it('옛 직업·스킬 id를 지금 id로 바꾼다', () => {
    const c = migrateChar({ cls: 'dosa', skills: { dosa_hwabu: 3, dosa_bingyeolbu: 1 } });
    expect(c.cls).toBe('dosa');
    expect(c.skills).toEqual({ dosa_hwabu: 3, dosa_bingyeolbu: 1 });
    expect(CLASSES[c.cls as keyof typeof CLASSES]).toBeTruthy();
    for (const k of Object.keys(c.skills)) expect(SKILLS[k]).toBeTruthy();
  });
  it('이미 새 id면 그대로 둔다', () => {
    const c = migrateChar({ cls: 'musa', skills: { musa_hwimori: 2 } });
    expect(c).toEqual({ cls: 'musa', skills: { musa_hwimori: 2 } });
  });
  it('가방·창고·장비·단축칸의 옛 아이템 id를 바꾼다', () => {
    const c = migrateChar({
      cls: 'warrior', skills: {},
      bag: [{ kind: 'gear', gear: { base: 'sword_2' } }, { kind: 'stack', id: 'potion_hp_s', n: 3 }, null],
      vault: [{ kind: 'stack', id: 'rift_token', n: 9 }],
      equip: { weapon: { base: 'sword_1' }, armor: { base: 'armor_1' } },
      quick: ['potion_hp_s', null],
    });
    expect(c.bag).toEqual([{ kind: 'gear', gear: { base: 'hwando_2' } }, { kind: 'stack', id: 'bohyeolhwan', n: 3 }, null]);
    expect(c.vault).toEqual([{ kind: 'stack', id: 'jeoseung_yeopjeon', n: 9 }]);
    expect(c.equip).toEqual({ weapon: { base: 'hwando_1' }, armor: { base: 'gabot_1' } });
    expect(c.quick).toEqual(['bohyeolhwan', null]);
    for (const id of ['hwando_2', 'hwando_1', 'gabot_1']) expect(GEAR[id]).toBeTruthy();
    for (const id of ['bohyeolhwan', 'jeoseung_yeopjeon']) expect(CONSUMABLES[id]).toBeTruthy();
  });
});
