// 캐릭터 규칙 단위 시험
import { describe, expect, it } from 'vitest';
import { CLASSES, SKILLS, baseStats, expToNext, mitigate } from '../../shared/classes';
import { GEAR, MAX_PLUS, enhanceCost, gearStats, rollGear, salvageYield } from '../../shared/items';
import { MONSTERS } from '../../shared/monsters';
import { QUESTS, npcMark, questAvailable, questComplete } from '../../shared/quests';
import * as C from '../src/char';

const fresh = (cls: 'musa' | 'dosa' | 'gungsa' = 'musa') => C.newChar('id', 'acc', '시험', cls, 0);

describe('새 캐릭터', () => {
  it('직업 무기와 물약을 갖고 시작한다', () => {
    for (const cls of ['musa', 'dosa', 'gungsa'] as const) {
      const c = fresh(cls);
      expect(GEAR[c.equip.weapon!.base].cls).toBe(cls);
      expect(C.countItem(c, 'bohyeolhwan')).toBe(5);
      expect(c.hp).toBe(C.computeStats(c).maxHp);
    }
  });
});

describe('가방', () => {
  it('묶음은 99개씩 나뉘고 넘치면 남은 수를 돌려준다', () => {
    const c = fresh();
    c.bag = c.bag.map(() => null);
    expect(C.addStack(c, 'jeongcheol', 150)).toBe(0);
    expect(c.bag.filter(Boolean).length).toBe(2);
    expect(C.countItem(c, 'jeongcheol')).toBe(150);
    c.bag = Array(32).fill({ kind: 'stack', id: 'jimseung_teol', n: 99 }).map((x) => ({ ...x }));
    expect(C.addStack(c, 'jeongcheol', 5)).toBe(5);
  });

  it('개수가 모자라면 꺼내지 않는다', () => {
    const c = fresh();
    expect(C.removeItem(c, 'bohyeolhwan', 99)).toBe(false);
    expect(C.countItem(c, 'bohyeolhwan')).toBe(5);
    expect(C.removeItem(c, 'bohyeolhwan', 5)).toBe(true);
    expect(C.countItem(c, 'bohyeolhwan')).toBe(0);
  });

  it('레벨과 직업이 맞아야 착용하고, 벗은 장비는 가방으로 간다', () => {
    const c = fresh();
    C.addGear(c, rollGear('hwando_2', 0));
    const i = c.bag.findIndex((x) => x?.kind === 'gear');
    expect(C.equipFromBag(c, i).ok).toBe(false);
    c.level = 6;
    const old = c.equip.weapon!.uid;
    expect(C.equipFromBag(c, i).ok).toBe(true);
    expect(c.equip.weapon!.base).toBe('hwando_2');
    expect((c.bag[i] as { gear: { uid: string } }).gear.uid).toBe(old);
    C.addGear(c, rollGear('chorongdae_1', 0));
    expect(C.equipFromBag(c, c.bag.findIndex((x) => x?.kind === 'gear' && x.gear.base === 'chorongdae_1')).ok).toBe(false);
  });
});

describe('성장', () => {
  it('경험치가 차면 레벨이 오르고 남은 값이 이어진다', () => {
    const c = fresh();
    const need = expToNext(1);
    expect(C.gainExp(c, need + 5)).toBe(1);
    expect(c.level).toBe(2);
    expect(c.exp).toBe(5);
  });

  it('스킬은 레벨·포인트·최고 단계를 지킨다', () => {
    const c = fresh();
    expect(C.skillUp(c, 'musa_hwimori').ok).toBe(false);
    c.level = 2;
    expect(C.skillUp(c, 'musa_hwimori').ok).toBe(true);
    expect(C.skillUp(c, 'musa_hwimori').ok).toBe(false);
    c.level = 30;
    for (let i = 0; i < 4; i++) expect(C.skillUp(c, 'musa_hwimori').ok).toBe(true);
    expect(C.skillUp(c, 'musa_hwimori').ok).toBe(false);
    expect(C.skillUp(c, 'dosa_bingyeolbu').ok).toBe(false);
  });

  it('직업마다 스킬 데이터가 모두 있다', () => {
    for (const cls of Object.values(CLASSES)) {
      expect(cls.skills.length).toBe(5);
      for (const id of cls.skills) expect(SKILLS[id].cls).toBe(cls.id);
    }
  });
});

describe('강화와 분해', () => {
  it('성공하면 오르고 능력치도 오른다', () => {
    const c = fresh();
    c.gold = 99999;
    C.addStack(c, 'jeongcheol', 90);
    const g = c.equip.weapon!;
    const before = gearStats(g).atk!;
    const r = C.enhance(c, 'weapon', 0, () => 0);
    expect(r.ok && r.success).toBe(true);
    expect(g.plus).toBe(1);
    expect(gearStats(g).atk!).toBeGreaterThan(before);
  });

  it('높은 단계에서 실패하면 내려가고, 재료가 없으면 거부한다', () => {
    const c = fresh();
    c.gold = 99999;
    C.addStack(c, 'jeongcheol', 90);
    const g = c.equip.weapon!;
    g.plus = 7;
    expect(enhanceCost(g).drop).toBe(true);
    C.enhance(c, 'weapon', 0, () => 0.999);
    expect(g.plus).toBe(6);
    g.plus = MAX_PLUS;
    expect(C.enhance(c, 'weapon', 0, () => 0).ok).toBe(false);
    const poor = fresh();
    expect(C.enhance(poor, 'weapon', 0, () => 0).ok).toBe(false);
  });

  it('분해하면 등불 조각이 나온다', () => {
    const c = fresh();
    c.bag = c.bag.map(() => null);
    const g = rollGear('hwando_2', 2);
    C.addGear(c, g);
    const r = C.salvage(c, 0);
    expect(r.ok).toBe(true);
    expect(C.countItem(c, 'jeongcheol')).toBe(salvageYield(g));
  });
});

describe('퀘스트', () => {
  it('선행 퀘스트를 끝내야 다음이 열린다', () => {
    const c = fresh();
    const second = QUESTS.find((q) => q.id === 'q_merchant_tusk')!;
    c.level = 5;
    expect(questAvailable(c, second)).toBe(false);
    C.acceptQuest(c, 'q_first_light');
    for (let i = 0; i < 5; i++) C.onKill(c, 'daramjwi');
    const first = QUESTS[0];
    expect(questComplete(c, first)).toBe(true);
    expect(npcMark(c, 'npc_elder')).toBe('?');
    const gold = c.gold;
    expect(C.turnInQuest(c, 'q_first_light').ok).toBe(true);
    expect(c.gold).toBe(gold + first.rewards.gold);
    expect(questAvailable(c, second)).toBe(true);
    expect(npcMark(c, 'npc_merchant')).toBe('!');
  });

  it('모으기 퀘스트는 끝낼 때 아이템을 가져간다', () => {
    const c = fresh();
    c.level = 5;
    c.quests.done.push('q_first_light');
    C.acceptQuest(c, 'q_merchant_tusk');
    expect(C.turnInQuest(c, 'q_merchant_tusk').ok).toBe(false);
    C.addStack(c, 'eomni', 3);
    expect(C.turnInQuest(c, 'q_merchant_tusk').ok).toBe(true);
    expect(C.countItem(c, 'eomni')).toBe(0);
  });

  it('보상 장비는 직업에 맞게 나온다', () => {
    const c = fresh('gungsa');
    c.level = 5;
    c.quests.done.push('q_first_light');
    C.acceptQuest(c, 'q_smith_iron');
    for (let i = 0; i < 8; i++) C.onKill(c, 'neoguri');
    C.turnInQuest(c, 'q_smith_iron');
    const g = c.bag.find((x) => x?.kind === 'gear');
    expect(g && g.kind === 'gear' && GEAR[g.gear.base].cls).toBe('gungsa');
  });

  it('퀘스트가 가리키는 몬스터·아이템·NPC·지도가 모두 있다', () => {
    for (const q of QUESTS) {
      if (q.goal.type === 'kill') expect(MONSTERS[q.goal.mon]).toBeTruthy();
      if (q.rewards.gear) for (const id of Object.values(q.rewards.gear.base)) expect(GEAR[id]).toBeTruthy();
    }
  });
});

describe('밸런스', () => {
  it('방어력은 피해를 줄이되 0으로 만들지 않는다', () => {
    expect(mitigate(100, 0)).toBe(100);
    expect(mitigate(100, 50)).toBe(50);
    expect(mitigate(100, 500)).toBeGreaterThan(0);
  });

  it('1레벨 수호자는 버섯을 몇 대에 잡고, 버섯에게는 오래 버틴다', () => {
    const c = fresh();
    const s = C.computeStats(c);
    const hits = Math.ceil(MONSTERS.daramjwi.hp / mitigate(s.atk, MONSTERS.daramjwi.def));
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(5);
    const hurt = mitigate(MONSTERS.daramjwi.dmg, s.def);
    expect(s.maxHp / hurt).toBeGreaterThan(15);
  });

  it('직업별 체력·마나가 레벨에 따라 오른다', () => {
    for (const id of ['musa', 'dosa', 'gungsa'] as const) {
      expect(baseStats(id, 10).maxHp).toBeGreaterThan(baseStats(id, 1).maxHp);
      expect(baseStats(id, 10).atk).toBeGreaterThan(baseStats(id, 1).atk);
    }
  });
});
