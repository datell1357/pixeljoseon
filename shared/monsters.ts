// 몬스터와 보스 패턴

export type AiKind = 'melee' | 'charger' | 'ranged' | 'caster' | 'swarm' | 'boss';

export type TelegraphShape = 'circle' | 'cone' | 'line' | 'ring';

export interface MonAttack {
  id: string;
  anim: string;
  /** 경고 후 판정까지 시간 */
  windup: number;
  /** 판정 뒤 경직 */
  recover: number;
  cd: number;
  mult: number;
  shape: TelegraphShape;
  /** circle/ring: 반경, cone/line: 길이 */
  r: number;
  /** ring: 안쪽 안전 반경 */
  inner?: number;
  arc?: number;
  width?: number;
  /** 대상 위치에 찍는 공격 (false면 자기 기준) */
  atTarget?: boolean;
  /** 사거리 (이 안에 있어야 쓴다) */
  range: number;
  minRange?: number;
  /** 탄환 공격 */
  proj?: { kind: string; speed: number; range: number; r: number; count?: number; arc?: number };
  /** 돌진: 판정 시 대상 쪽으로 달려간다 */
  charge?: number;
  summon?: { kind: string; count: number };
  /** 대상 주변에 여러 번 찍기 */
  scatter?: { count: number; spread: number; stagger: number };
  burn?: boolean;
  slow?: number;
  /** 보스 단계 제한: 체력 비율이 이 값 이하일 때만 */
  below?: number;
  weight?: number;
}

export interface MonDef {
  id: string;
  name: string;
  ai: AiKind;
  sheet: string;
  hp: number;
  dmg: number;
  def: number;
  speed: number;
  r: number;
  exp: number;
  gold: [number, number];
  detect: number;
  leash: number;
  scale?: number;
  attacks: MonAttack[];
  /** 드롭: [아이템 id, 확률] */
  drops?: [string, number][];
  boss?: boolean;
  /** 맞아도 경직 안 함 */
  poise?: boolean;
  flying?: boolean;
  /** 원거리: 유지 거리 */
  kite?: number;
  /** 쓰러질 때 터짐 */
  deathBlast?: { r: number; mult: number; delay: number };
  /** 체력 비율 단계 진입 시 함성/패턴 */
  phases?: { at: number; say: string; speedMul?: number; summon?: { kind: string; count: number } }[];
}

const hit = (over: Partial<MonAttack>): MonAttack => ({
  id: 'mulgi',
  anim: 'attack',
  windup: 0.45,
  recover: 0.45,
  cd: 1.6,
  mult: 1,
  shape: 'cone',
  r: 1.5,
  arc: 110,
  range: 1.35,
  ...over,
});

export const MONSTERS: Record<string, MonDef> = {
  // 내부 id와 모델 이름은 짐승 이름의 로마자 표기다. 보이는 이름과 모델은 sheet와 name이 정한다.
  // 일반 몬스터는 조선 땅의 짐승으로, 다람쥐부터 범까지 지역을 따라 강해진다. 설화 속 요괴는 보스만 맡는다.
  daramjwi: {
    id: 'daramjwi', name: '다람쥐', ai: 'melee', sheet: 'daramjwi',
    hp: 38, dmg: 6, def: 0, speed: 1.6, r: 0.26, exp: 16, gold: [2, 6], detect: 5, leash: 9, scale: 1,
    attacks: [hit({ id: 'galgi', windup: 0.35, recover: 0.4, cd: 1.4, r: 1.2, range: 1.0 })],
    drops: [['moss_core', 0.14]],
  },
  neoguri: {
    id: 'neoguri', name: '너구리', ai: 'melee', sheet: 'neoguri',
    hp: 56, dmg: 9, def: 1, speed: 1.45, r: 0.3, exp: 24, gold: [3, 8], detect: 6, leash: 10, scale: 0.78,
    attacks: [hit({ id: 'mulgi', windup: 0.4, recover: 0.45, cd: 1.5, r: 1.3, range: 1.1 })],
    drops: [['moss_core', 0.18]],
  },
  metdwaeji: {
    id: 'metdwaeji', name: '멧돼지', ai: 'charger', sheet: 'metdwaeji',
    hp: 86, dmg: 13, def: 2, speed: 1.5, r: 0.38, exp: 32, gold: [3, 9], detect: 6, leash: 10,
    attacks: [
      hit({ id: 'eomni', windup: 0.4, r: 1.5, mult: 0.8 }),
      { id: 'doljin', anim: 'attack', windup: 0.75, recover: 0.8, cd: 5, mult: 1.5, shape: 'line', r: 6, width: 1, range: 6, minRange: 2.2, charge: 7.5 },
    ],
    drops: [['boar_tusk', 0.2]],
  },
  yeou: {
    id: 'yeou', name: '여우', ai: 'melee', sheet: 'yeou',
    hp: 80, dmg: 16, def: 2, speed: 2.0, r: 0.3, exp: 40, gold: [4, 10], detect: 7, leash: 11, scale: 0.72,
    attacks: [
      hit({ id: 'mulgi', windup: 0.3, recover: 0.35, cd: 1.25 }),
      { id: 'deopchigi', anim: 'attack', windup: 0.55, recover: 0.6, cd: 5, mult: 1.2, shape: 'line', r: 4, width: 0.9, range: 4, minRange: 1.8, charge: 6 },
    ],
    drops: [['moss_core', 0.2]],
  },
  neukdae: {
    id: 'neukdae', name: '늑대', ai: 'charger', sheet: 'neukdae',
    hp: 150, dmg: 38, def: 6, speed: 2.1, r: 0.36, exp: 80, gold: [8, 18], detect: 7, leash: 12,
    attacks: [
      hit({ id: 'mulgi', windup: 0.32, recover: 0.35, cd: 1.3 }),
      { id: 'deopchigi', anim: 'attack', windup: 0.6, recover: 0.7, cd: 5.5, mult: 1.4, shape: 'line', r: 5, width: 1, range: 5, minRange: 2, charge: 8.5 },
    ],
    drops: [['ash_core', 0.1]],
  },
  seungnyangi: {
    id: 'seungnyangi', name: '승냥이', ai: 'swarm', sheet: 'seungnyangi',
    hp: 120, dmg: 34, def: 4, speed: 2.4, r: 0.3, exp: 70, gold: [6, 14], detect: 7, leash: 11, scale: 0.84,
    attacks: [hit({ id: 'kkamulgi', windup: 0.25, recover: 0.3, cd: 1.1, r: 1.3, range: 1.1, mult: 0.85 })],
    drops: [['ash_core', 0.08]],
  },
  bandalgom: {
    id: 'bandalgom', name: '반달가슴곰', ai: 'melee', sheet: 'bandalgom', poise: true,
    hp: 340, dmg: 60, def: 14, speed: 1.15, r: 0.5, exp: 130, gold: [12, 26], detect: 5.5, leash: 10, scale: 1.5,
    attacks: [
      hit({ id: 'appal', windup: 0.6, recover: 0.7, cd: 2, r: 1.9, range: 1.6, arc: 130 }),
      { id: 'naeryeochigi', anim: 'attack', windup: 0.95, recover: 0.9, cd: 7, mult: 1.5, shape: 'circle', r: 2.8, range: 2.4 },
    ],
    drops: [['ash_core', 0.2]],
  },
  horangi: {
    id: 'horangi', name: '호랑이', ai: 'charger', sheet: 'horangi',
    hp: 300, dmg: 72, def: 8, speed: 2.25, r: 0.46, exp: 150, gold: [14, 30], detect: 8, leash: 13, scale: 1.3,
    attacks: [
      hit({ id: 'balteop', windup: 0.36, recover: 0.4, cd: 1.4, r: 1.9, range: 1.6, arc: 120 }),
      { id: 'deopchigi', anim: 'attack', windup: 0.65, recover: 0.75, cd: 5, mult: 1.6, shape: 'line', r: 6, width: 1.3, range: 6, minRange: 2.2, charge: 9 },
    ],
    drops: [['ash_core', 0.24]],
  },
  bakjwi: {
    id: 'bakjwi', name: '박쥐', ai: 'melee', sheet: 'bakjwi', flying: true,
    hp: 140, dmg: 48, def: 4, speed: 2.3, r: 0.3, exp: 90, gold: [8, 18], detect: 9, leash: 20, scale: 0.9,
    attacks: [hit({ id: 'mulgi', windup: 0.28, recover: 0.3, cd: 1.1 })],
  },
  gumiho: {
    id: 'gumiho', name: '구미호', ai: 'boss', sheet: 'gumiho', boss: true, poise: true,
    hp: 9000, dmg: 50, def: 6, speed: 1.15, r: 0.95, exp: 1200, gold: [90, 160], detect: 14, leash: 99, scale: 2.3,
    attacks: [
      hit({ id: 'kkorichigi', anim: 'sweep', windup: 0.65, recover: 0.8, cd: 3.2, mult: 1.1, r: 3, arc: 150, range: 2.8, weight: 3 }),
      { id: 'deopchigi', anim: 'slam', windup: 0.95, recover: 1, cd: 7, mult: 1.6, shape: 'circle', r: 3.6, range: 3.4, weight: 2 },
      { id: 'yeoubul', anim: 'cast', windup: 0.9, recover: 0.7, cd: 8, mult: 1.2, shape: 'circle', r: 1.3, range: 12, atTarget: true, scatter: { count: 5, spread: 2.6, stagger: 0.18 }, weight: 2 },
      { id: 'yeouguseul', anim: 'cast', windup: 0.8, recover: 0.8, cd: 9, mult: 0.9, shape: 'line', r: 10, width: 0.6, range: 11, proj: { kind: 'yeoubul', speed: 5, range: 11, r: 0.32, count: 9, arc: 360 }, below: 0.7, weight: 2 },
      { id: 'ulbujitgi', anim: 'slam', windup: 1.3, recover: 1.1, cd: 14, mult: 1.7, shape: 'ring', r: 7, inner: 2.6, range: 14, below: 0.45, weight: 2 },
    ],
    phases: [
      { at: 0.66, say: '사람 냄새가 나는구나…', summon: { kind: 'yeou', count: 4 } },
      { at: 0.33, say: '꼬리 아홉을 다 보여 주마!', speedMul: 1.25, summon: { kind: 'yeou', count: 3 } },
    ],
    drops: [['moss_core', 1], ['moss_core', 1], ['moss_core', 0.6]],
  },
  bulgasari: {
    id: 'bulgasari', name: '불가사리', ai: 'boss', sheet: 'bulgasari', boss: true, poise: true,
    hp: 24000, dmg: 190, def: 22, speed: 1.2, r: 0.95, exp: 6000, gold: [320, 520], detect: 16, leash: 99, scale: 2.4,
    attacks: [
      hit({ id: 'hwidureugi', anim: 'sweep', windup: 0.6, recover: 0.7, cd: 3, mult: 1.1, r: 3.4, arc: 170, range: 3, weight: 3 }),
      { id: 'doljin', anim: 'sweep', windup: 0.8, recover: 0.9, cd: 7, mult: 1.3, shape: 'line', r: 9, width: 1.8, range: 9, minRange: 3, charge: 11, weight: 2 },
      { id: 'jitbapgi', anim: 'slam', windup: 1, recover: 1, cd: 8, mult: 1.8, shape: 'circle', r: 4.2, range: 3.6, weight: 2 },
      { id: 'soemul', anim: 'cast', windup: 0.9, recover: 0.7, cd: 9, mult: 1.1, shape: 'circle', r: 1.5, range: 14, atTarget: true, burn: true, scatter: { count: 7, spread: 3.4, stagger: 0.14 }, weight: 2 },
      { id: 'ttangullim', anim: 'cast', windup: 1.5, recover: 1.1, cd: 16, mult: 2.2, shape: 'ring', r: 9, inner: 3, range: 16, below: 0.6, weight: 2 },
      { id: 'soebanul', anim: 'cast', windup: 0.9, recover: 0.9, cd: 11, mult: 1, shape: 'line', r: 11, width: 0.7, range: 12, proj: { kind: 'soebanul', speed: 7, range: 12, r: 0.36, count: 12, arc: 360 }, below: 0.5, weight: 2 },
    ],
    phases: [
      { at: 0.7, say: '그르르… 쇠 냄새…', summon: { kind: 'bakjwi', count: 3 } },
      { at: 0.4, say: '쿠워어어어!', speedMul: 1.3, summon: { kind: 'bakjwi', count: 5 } },
    ],
    drops: [['warden_seal', 1], ['ash_core', 1], ['ash_core', 1]],
  },
};

/** 몬스터 수치가 기준으로 삼는 레벨 */
export const DESIGN_LEVEL: Record<string, number> = {
  daramjwi: 1, neoguri: 3, metdwaeji: 5, yeou: 6, neukdae: 9, seungnyangi: 10, bandalgom: 12, horangi: 14, bakjwi: 15, gumiho: 8, bulgasari: 18,
};

/** 균열 층수에 따른 배율 */
export function riftScale(floor: number) {
  return {
    hp: 1 + floor * 0.22 + Math.pow(floor, 1.5) * 0.06,
    dmg: 1 + floor * 0.11,
    exp: 1 + floor * 0.16,
  };
}
