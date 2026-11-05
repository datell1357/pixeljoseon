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
  id: 'bite',
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
  mushroom: {
    id: 'mushroom', name: '버섯 병사', ai: 'melee', sheet: 'mushroom',
    hp: 42, dmg: 7, def: 1, speed: 1.35, r: 0.32, exp: 16, gold: [2, 6], detect: 5, leash: 9,
    attacks: [hit({ id: 'club' })],
    drops: [['moss_core', 0.14]],
  },
  boar: {
    id: 'boar', name: '가시 멧돼지', ai: 'charger', sheet: 'boar',
    hp: 70, dmg: 11, def: 2, speed: 1.5, r: 0.38, exp: 28, gold: [3, 8], detect: 6, leash: 10,
    attacks: [
      hit({ id: 'gore', windup: 0.4, r: 1.5, mult: 0.8 }),
      { id: 'rush', anim: 'attack', windup: 0.75, recover: 0.8, cd: 5, mult: 1.5, shape: 'line', r: 6, width: 1, range: 6, minRange: 2.2, charge: 7.5 },
    ],
    drops: [['boar_tusk', 0.2]],
  },
  wisp: {
    id: 'wisp', name: '이끼 도깨비불', ai: 'ranged', sheet: 'wisp', flying: true,
    hp: 38, dmg: 12, def: 0, speed: 1.3, r: 0.3, exp: 32, gold: [3, 9], detect: 7.5, leash: 11, kite: 4,
    attacks: [
      { id: 'spit', anim: 'attack', windup: 0.5, recover: 0.5, cd: 2.2, mult: 1, shape: 'line', r: 7, width: 0.5, range: 7, proj: { kind: 'wisp', speed: 5, range: 8, r: 0.28 } },
    ],
    drops: [['moss_core', 0.18]],
  },
  ashwolf: {
    id: 'ashwolf', name: '잿빛 늑대', ai: 'charger', sheet: 'ashwolf',
    hp: 150, dmg: 38, def: 6, speed: 2.1, r: 0.36, exp: 80, gold: [8, 18], detect: 7, leash: 12,
    attacks: [
      hit({ id: 'bite', windup: 0.32, recover: 0.35, cd: 1.3 }),
      { id: 'pounce', anim: 'attack', windup: 0.6, recover: 0.7, cd: 5.5, mult: 1.4, shape: 'line', r: 5, width: 1, range: 5, minRange: 2, charge: 8.5 },
    ],
    drops: [['ash_core', 0.1]],
  },
  emberbug: {
    id: 'emberbug', name: '불씨 벌레', ai: 'swarm', sheet: 'emberbug',
    hp: 58, dmg: 26, def: 2, speed: 2.5, r: 0.24, exp: 36, gold: [4, 9], detect: 6, leash: 10, scale: 0.9,
    attacks: [hit({ id: 'nip', windup: 0.25, recover: 0.3, cd: 1.1, r: 1.1, range: 0.95, mult: 0.8 })],
    deathBlast: { r: 1.3, mult: 1, delay: 0.55 },
    drops: [['ash_core', 0.05]],
  },
  golem: {
    id: 'golem', name: '재 골렘', ai: 'melee', sheet: 'golem', poise: true,
    hp: 340, dmg: 60, def: 14, speed: 1.05, r: 0.5, exp: 130, gold: [12, 26], detect: 5.5, leash: 10, scale: 1.05,
    attacks: [
      hit({ id: 'fist', windup: 0.6, recover: 0.7, cd: 2, r: 1.9, range: 1.6, arc: 130 }),
      { id: 'stomp', anim: 'attack', windup: 0.95, recover: 0.9, cd: 7, mult: 1.5, shape: 'circle', r: 2.8, range: 2.4 },
    ],
    drops: [['ash_core', 0.2]],
  },
  cultist: {
    id: 'cultist', name: '꺼진 등불 신도', ai: 'caster', sheet: 'cultist',
    hp: 125, dmg: 50, def: 4, speed: 1.35, r: 0.32, exp: 100, gold: [10, 22], detect: 8, leash: 12, kite: 5,
    attacks: [
      { id: 'cinder', anim: 'attack', windup: 0.9, recover: 0.8, cd: 3.2, mult: 1.1, shape: 'circle', r: 1.5, range: 7.5, atTarget: true, burn: true },
    ],
    drops: [['ash_core', 0.14]],
  },
  shade: {
    id: 'shade', name: '그림자', ai: 'melee', sheet: 'shade', flying: true,
    hp: 90, dmg: 24, def: 3, speed: 2.2, r: 0.3, exp: 50, gold: [6, 14], detect: 9, leash: 20,
    attacks: [hit({ id: 'claw', windup: 0.3, recover: 0.3, cd: 1.2 })],
  },
  elder: {
    id: 'elder', name: '이끼 고목왕', ai: 'boss', sheet: 'elder', boss: true, poise: true,
    hp: 9000, dmg: 50, def: 6, speed: 0.95, r: 0.95, exp: 1200, gold: [90, 160], detect: 14, leash: 99, scale: 1,
    attacks: [
      hit({ id: 'sweep', anim: 'sweep', windup: 0.65, recover: 0.8, cd: 3.2, mult: 1.1, r: 3, arc: 150, range: 2.8, weight: 3 }),
      { id: 'slam', anim: 'slam', windup: 0.95, recover: 1, cd: 7, mult: 1.6, shape: 'circle', r: 3.6, range: 3.4, weight: 2 },
      { id: 'roots', anim: 'cast', windup: 0.9, recover: 0.7, cd: 8, mult: 1.2, shape: 'circle', r: 1.3, range: 12, atTarget: true, scatter: { count: 5, spread: 2.6, stagger: 0.18 }, weight: 2 },
      { id: 'spores', anim: 'cast', windup: 0.8, recover: 0.8, cd: 9, mult: 0.9, shape: 'line', r: 10, width: 0.6, range: 11, proj: { kind: 'wisp', speed: 5, range: 11, r: 0.32, count: 9, arc: 360 }, below: 0.7, weight: 2 },
      { id: 'quake', anim: 'slam', windup: 1.3, recover: 1.1, cd: 14, mult: 1.7, shape: 'ring', r: 7, inner: 2.6, range: 14, below: 0.45, weight: 2 },
    ],
    phases: [
      { at: 0.66, say: '숲이 깨어난다…', summon: { kind: 'mushroom', count: 4 } },
      { at: 0.33, say: '뿌리를 내려라!', speedMul: 1.25, summon: { kind: 'wisp', count: 3 } },
    ],
    drops: [['moss_core', 1], ['moss_core', 1], ['moss_core', 0.6]],
  },
  warden: {
    id: 'warden', name: '꺼진 등불지기', ai: 'boss', sheet: 'warden', boss: true, poise: true,
    hp: 24000, dmg: 190, def: 22, speed: 1.2, r: 0.95, exp: 6000, gold: [320, 520], detect: 16, leash: 99,
    attacks: [
      hit({ id: 'sweep', anim: 'sweep', windup: 0.6, recover: 0.7, cd: 3, mult: 1.1, r: 3.4, arc: 170, range: 3, weight: 3 }),
      { id: 'dash', anim: 'sweep', windup: 0.8, recover: 0.9, cd: 7, mult: 1.3, shape: 'line', r: 9, width: 1.8, range: 9, minRange: 3, charge: 11, weight: 2 },
      { id: 'slam', anim: 'slam', windup: 1, recover: 1, cd: 8, mult: 1.8, shape: 'circle', r: 4.2, range: 3.6, weight: 2 },
      { id: 'embers', anim: 'cast', windup: 0.9, recover: 0.7, cd: 9, mult: 1.1, shape: 'circle', r: 1.5, range: 14, atTarget: true, burn: true, scatter: { count: 7, spread: 3.4, stagger: 0.14 }, weight: 2 },
      { id: 'snuff', anim: 'cast', windup: 1.5, recover: 1.1, cd: 16, mult: 2.2, shape: 'ring', r: 9, inner: 3, range: 16, below: 0.6, weight: 2 },
      { id: 'chains', anim: 'cast', windup: 0.9, recover: 0.9, cd: 11, mult: 1, shape: 'line', r: 11, width: 0.7, range: 12, proj: { kind: 'chain', speed: 7, range: 12, r: 0.36, count: 12, arc: 360 }, below: 0.5, weight: 2 },
    ],
    phases: [
      { at: 0.7, say: '등불을… 꺼라…', summon: { kind: 'cultist', count: 2 } },
      { at: 0.4, say: '어둠이 곧 길이다.', speedMul: 1.3, summon: { kind: 'shade', count: 5 } },
    ],
    drops: [['warden_seal', 1], ['ash_core', 1], ['ash_core', 1]],
  },
};

/** 몬스터 수치가 기준으로 삼는 레벨 */
export const DESIGN_LEVEL: Record<string, number> = {
  mushroom: 1, boar: 3, wisp: 5, ashwolf: 9, emberbug: 11, golem: 12, cultist: 12, shade: 8, elder: 8, warden: 18,
};

/** 균열 층수에 따른 배율 */
export function riftScale(floor: number) {
  return {
    hp: 1 + floor * 0.22 + Math.pow(floor, 1.5) * 0.06,
    dmg: 1 + floor * 0.11,
    exp: 1 + floor * 0.16,
  };
}
