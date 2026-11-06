// 장비 겉모습 키: 서버가 만들고 모든 클라이언트가 읽는다
import { describe, expect, it } from 'vitest';
import { gearKey, gearVisualKey, parseGearKey, pcSheet, plusGlow, rollGear } from '../../shared/items';

describe('장비 겉모습 키', () => {
  const equip = { weapon: { ...rollGear('sword_3', 2), plus: 7 }, armor: rollGear('armor_1', 0) };

  it('입은 장비만 슬롯 자리에 적는다', () => {
    const key = gearKey(equip);
    expect(key).toBe('sword_3.2.7,,armor_1.0.0,,,');
    const worn = parseGearKey(key);
    expect(worn.weapon).toEqual({ base: 'sword_3', tier: 3, rarity: 2, glow: 2 });
    expect(worn.armor?.tier).toBe(1);
    expect(worn.helm).toBeUndefined();
  });

  it('강화 빛 단계가 같으면 같은 모델을 쓴다', () => {
    expect(plusGlow(3)).toBe(0);
    expect(plusGlow(4)).toBe(1);
    expect(plusGlow(9)).toBe(2);
    expect(plusGlow(10)).toBe(3);
    expect(gearVisualKey('sword_1.0.4,,,,,')).toBe(gearVisualKey('sword_1.0.6,,,,,'));
    expect(gearVisualKey('sword_1.0.6,,,,,')).not.toBe(gearVisualKey('sword_1.0.7,,,,,'));
  });

  it('모르는 장비나 슬롯이 틀린 값은 무시한다', () => {
    expect(parseGearKey('nope.0.0,sword_1.0.0,,,,')).toEqual({});
    expect(parseGearKey('')).toEqual({});
  });

  it('모델 이름에 장비가 들어간다', () => {
    expect(pcSheet('mage', 1)).toBe('pc_mage_b');
    expect(pcSheet('mage', 1, 'staff_2.0.0,,,,,')).toBe('pc_mage_b#staff_2.0.0,,,,,');
  });
});
