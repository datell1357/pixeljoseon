import { describe, expect, it } from 'vitest';
import { migrateChar } from '../../shared/legacy';
import { CLASSES, SKILLS } from '../../shared/classes';

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
});
