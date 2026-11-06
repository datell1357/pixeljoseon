// 직업과 스킬 데이터. 값은 전부 이 게임을 위해 새로 정한 것이다.

export type ClassId = 'musa' | 'dosa' | 'gungsa';
export const CLASS_IDS: ClassId[] = ['musa', 'dosa', 'gungsa'];
export const MAX_LEVEL = 30;

export interface ClassDef {
  id: ClassId;
  label: string;
  blurb: string;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  hpG: number;
  mpG: number;
  atkG: number;
  defG: number;
  speed: number;
  /** 기본 공격 3단. kind melee: 부채꼴 근접, shot: 탄환 */
  combo: AttackStep[];
  dodge: DodgeDef;
  guard: GuardDef;
  skills: string[];
}

export interface AttackStep {
  anim: 'attack1' | 'attack2' | 'attack3';
  kind: 'melee' | 'shot';
  mult: number;
  dur: number;
  /** 동작 시작 후 타격까지 시간 */
  impact: number;
  reach?: number;
  arc?: number;
  knock?: number;
  lunge?: number;
  proj?: ProjSpec;
}

export interface ProjSpec {
  kind: string;
  speed: number;
  range: number;
  r: number;
  pierce?: number;
  /** 착탄 폭발 반경 */
  blast?: number;
}

export interface DodgeDef {
  kind: 'gureugi' | 'chukjibeop' | 'dwittwigi';
  label: string;
  icon: string;
  dist: number;
  dur: number;
  iframes: number;
  cd: number;
  /** leap: 조준 반대 방향으로 뛴다 */
  backward?: boolean;
}

export interface GuardDef {
  label: string;
  icon: string;
  /** 방패 들고 있을 때 받는 피해 배율 */
  reduce: number;
  /** 시작 후 이 시간 안에 맞으면 패링 */
  parry: number;
  /** 유지 최대 시간 (0이면 누르는 동안) */
  maxHold: number;
  cd: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  musa: {
    id: 'musa',
    label: '무사',
    blurb: '환도와 방패 · 근접 · 튼튼함',
    hp: 130,
    mp: 50,
    atk: 12,
    def: 6,
    hpG: 22,
    mpG: 4,
    atkG: 2.6,
    defG: 1.2,
    speed: 3.0,
    combo: [
      { anim: 'attack1', kind: 'melee', mult: 1.0, dur: 0.34, impact: 0.13, reach: 1.45, arc: 120, knock: 0.15, lunge: 0.28 },
      { anim: 'attack2', kind: 'melee', mult: 1.1, dur: 0.34, impact: 0.13, reach: 1.45, arc: 120, knock: 0.15, lunge: 0.28 },
      { anim: 'attack3', kind: 'melee', mult: 1.7, dur: 0.48, impact: 0.22, reach: 1.7, arc: 150, knock: 0.7, lunge: 0.42 },
    ],
    dodge: { kind: 'gureugi', label: '구르기', icon: 'gureugi', dist: 2.8, dur: 0.38, iframes: 0.3, cd: 3.5 },
    guard: { label: '방패 들기', icon: 'deungpae', reduce: 0.25, parry: 0.22, maxHold: 0, cd: 0.6 },
    skills: ['musa_hwimori', 'musa_dolgyeok', 'musa_ttanggareugi', 'musa_horyeong', 'musa_cheongeun'],
  },
  dosa: {
    id: 'dosa',
    label: '도사',
    blurb: '부적과 도술 · 원거리 · 광역',
    hp: 90,
    mp: 110,
    atk: 15,
    def: 3,
    hpG: 13,
    mpG: 11,
    atkG: 3.1,
    defG: 0.7,
    speed: 2.9,
    combo: [
      { anim: 'attack1', kind: 'shot', mult: 0.9, dur: 0.36, impact: 0.15, proj: { kind: 'orb', speed: 9, range: 7.5, r: 0.3 } },
      { anim: 'attack2', kind: 'shot', mult: 1.0, dur: 0.36, impact: 0.15, proj: { kind: 'orb', speed: 9, range: 7.5, r: 0.3 } },
      { anim: 'attack3', kind: 'shot', mult: 1.5, dur: 0.5, impact: 0.24, proj: { kind: 'orb_big', speed: 8, range: 8, r: 0.42, blast: 1.2 } },
    ],
    dodge: { kind: 'chukjibeop', label: '축지법', icon: 'chukjibeop', dist: 3.6, dur: 0.22, iframes: 0.24, cd: 5 },
    guard: { label: '부적 막기', icon: 'bujeok_makgi', reduce: 0.5, parry: 0.3, maxHold: 0.5, cd: 5 },
    skills: ['dosa_hwabu', 'dosa_bingyeolbu', 'dosa_nakseong', 'dosa_hosinbu', 'dosa_yuseongu'],
  },
  gungsa: {
    id: 'gungsa',
    label: '궁사',
    blurb: '각궁과 올무 · 원거리 · 기동',
    hp: 105,
    mp: 70,
    atk: 13,
    def: 4,
    hpG: 16,
    mpG: 6,
    atkG: 2.9,
    defG: 0.9,
    speed: 3.2,
    combo: [
      { anim: 'attack1', kind: 'shot', mult: 0.85, dur: 0.28, impact: 0.12, proj: { kind: 'arrow', speed: 13, range: 8.5, r: 0.2 } },
      { anim: 'attack2', kind: 'shot', mult: 0.85, dur: 0.28, impact: 0.12, proj: { kind: 'arrow', speed: 13, range: 8.5, r: 0.2 } },
      { anim: 'attack3', kind: 'shot', mult: 1.6, dur: 0.48, impact: 0.28, proj: { kind: 'arrow_big', speed: 15, range: 9.5, r: 0.26, pierce: 2 } },
    ],
    dodge: { kind: 'dwittwigi', label: '뒤로 뛰기', icon: 'dwittwigi', dist: 3.2, dur: 0.36, iframes: 0.28, cd: 4, backward: true },
    guard: { label: '빗겨 내기', icon: 'bitgyeo_naegi', reduce: 0.5, parry: 0.26, maxHold: 0.5, cd: 4 },
    skills: ['gungsa_osi', 'gungsa_pyeonjeon', 'gungsa_olmu', 'gungsa_maenun', 'gungsa_hwasalbi'],
  },
};

export type SkillKind =
  | 'whirl' // 자기 주변 범위
  | 'charge' // 조준 방향 돌진
  | 'cone' // 부채꼴 충격파
  | 'buff' // 자신과 파티 강화
  | 'leapSmash' // 지점으로 뛰어올라 범위 타격
  | 'proj' // 탄환 하나
  | 'fan' // 부채꼴 탄환 여러 개
  | 'nova' // 자기 주변 범위 + 둔화
  | 'ground' // 지점 지연 폭발
  | 'groundMulti' // 지점 주변 여러 번 폭발
  | 'shield' // 흡수 보호막
  | 'trap'; // 설치형 덫

export interface SkillDef {
  id: string;
  cls: ClassId;
  name: string;
  desc: string;
  kind: SkillKind;
  /** 배우는 레벨 */
  req: number;
  maxRank: number;
  mp: number;
  cd: number;
  /** 시전 동작 시간 */
  dur: number;
  impact: number;
  anim: 'cast' | 'spin' | 'attack3';
  mult: number;
  multPerRank: number;
  r?: number;
  reach?: number;
  arc?: number;
  knock?: number;
  stun?: number;
  slow?: number;
  /** 시전 사거리 (지점 지정) */
  range?: number;
  delay?: number;
  count?: number;
  proj?: ProjSpec;
  buff?: { atk?: number; dr?: number; crit?: number; aspd?: number; dur: number; party?: boolean };
  shield?: number;
  ult?: boolean;
}

export const SKILLS: Record<string, SkillDef> = {
  // 수호자
  musa_hwimori: {
    id: 'musa_hwimori', cls: 'musa', name: '휘몰이 베기', desc: '몸을 돌려 주변 적을 모두 벱니다.',
    kind: 'whirl', req: 2, maxRank: 5, mp: 12, cd: 5, dur: 0.5, impact: 0.22, anim: 'spin',
    mult: 1.8, multPerRank: 0.3, r: 2.1, knock: 0.5,
  },
  musa_dolgyeok: {
    id: 'musa_dolgyeok', cls: 'musa', name: '돌격', desc: '앞으로 내달려 부딪힌 적을 기절시킵니다.',
    kind: 'charge', req: 4, maxRank: 5, mp: 14, cd: 8, dur: 0.4, impact: 0.05, anim: 'attack3',
    mult: 1.5, multPerRank: 0.25, reach: 5, r: 1.0, stun: 0.9, knock: 0.4,
  },
  musa_ttanggareugi: {
    id: 'musa_ttanggareugi', cls: 'musa', name: '땅 가르기', desc: '땅을 내리쳐 앞쪽 넓은 범위에 충격파를 보냅니다.',
    kind: 'cone', req: 7, maxRank: 5, mp: 20, cd: 10, dur: 0.6, impact: 0.3, anim: 'attack3',
    mult: 2.6, multPerRank: 0.4, reach: 4, arc: 80, knock: 0.9, stun: 0.5,
  },
  musa_horyeong: {
    id: 'musa_horyeong', cls: 'musa', name: '호령', desc: '자신과 파티원의 공격력을 높이고 받는 피해를 줄입니다.',
    kind: 'buff', req: 11, maxRank: 5, mp: 18, cd: 24, dur: 0.5, impact: 0.2, anim: 'cast',
    mult: 0, multPerRank: 0, buff: { atk: 0.2, dr: 0.2, dur: 10, party: true },
  },
  musa_cheongeun: {
    id: 'musa_cheongeun', cls: 'musa', name: '천근 내려치기', desc: '지정한 곳으로 뛰어올라 내려칩니다. 궁극기.',
    kind: 'leapSmash', req: 18, maxRank: 3, mp: 40, cd: 45, dur: 0.75, impact: 0.55, anim: 'attack3',
    mult: 6, multPerRank: 1.5, range: 6.5, r: 3, knock: 1.2, stun: 1.2, ult: true,
  },
  // 등불술사
  dosa_hwabu: {
    id: 'dosa_hwabu', cls: 'dosa', name: '화부(火符)', desc: '불 부적을 던져 터뜨립니다.',
    kind: 'proj', req: 2, maxRank: 5, mp: 12, cd: 3.5, dur: 0.42, impact: 0.2, anim: 'cast',
    mult: 2.1, multPerRank: 0.32, proj: { kind: 'fireball', speed: 8.5, range: 8.5, r: 0.45, blast: 1.7 },
  },
  dosa_bingyeolbu: {
    id: 'dosa_bingyeolbu', cls: 'dosa', name: '빙결부', desc: '주변을 얼려 적의 발을 묶습니다.',
    kind: 'nova', req: 4, maxRank: 5, mp: 18, cd: 9, dur: 0.42, impact: 0.2, anim: 'spin',
    mult: 1.4, multPerRank: 0.25, r: 3, slow: 0.55, stun: 0.3,
  },
  dosa_nakseong: {
    id: 'dosa_nakseong', cls: 'dosa', name: '낙성(落星)', desc: '지정한 곳에 별똥을 떨어뜨립니다. 떨어지기까지 잠시 걸립니다.',
    kind: 'ground', req: 7, maxRank: 5, mp: 26, cd: 11, dur: 0.5, impact: 0.3, anim: 'cast',
    mult: 3.6, multPerRank: 0.55, range: 8, r: 2.3, delay: 0.8, knock: 0.6,
  },
  dosa_hosinbu: {
    id: 'dosa_hosinbu', cls: 'dosa', name: '호신부', desc: '피해를 대신 받아 주는 부적의 막을 두릅니다.',
    kind: 'shield', req: 11, maxRank: 5, mp: 24, cd: 20, dur: 0.4, impact: 0.15, anim: 'cast',
    mult: 0, multPerRank: 0, shield: 3.2,
  },
  dosa_yuseongu: {
    id: 'dosa_yuseongu', cls: 'dosa', name: '유성우', desc: '넓은 곳에 별똥을 쏟아붓습니다. 궁극기.',
    kind: 'groundMulti', req: 18, maxRank: 3, mp: 55, cd: 50, dur: 0.8, impact: 0.3, anim: 'cast',
    mult: 1.9, multPerRank: 0.5, range: 8, r: 3.4, count: 9, delay: 0.5,
  },
  // 순찰자
  gungsa_osi: {
    id: 'gungsa_osi', cls: 'gungsa', name: '오시(五矢)', desc: '화살 다섯 대를 부채꼴로 쏩니다.',
    kind: 'fan', req: 2, maxRank: 5, mp: 11, cd: 4.5, dur: 0.42, impact: 0.2, anim: 'attack3',
    mult: 0.9, multPerRank: 0.14, count: 5, arc: 55, proj: { kind: 'arrow', speed: 13, range: 7, r: 0.22 },
  },
  gungsa_pyeonjeon: {
    id: 'gungsa_pyeonjeon', cls: 'gungsa', name: '편전', desc: '짧고 빠른 애기살로 일직선의 모든 적을 꿰뚫습니다.',
    kind: 'proj', req: 4, maxRank: 5, mp: 15, cd: 7, dur: 0.6, impact: 0.36, anim: 'attack3',
    mult: 2.8, multPerRank: 0.42, proj: { kind: 'arrow_big', speed: 18, range: 12, r: 0.32, pierce: 99 },
  },
  gungsa_olmu: {
    id: 'gungsa_olmu', cls: 'gungsa', name: '올무', desc: '올무를 놓습니다. 밟은 적은 묶이고 피해를 입습니다.',
    kind: 'trap', req: 7, maxRank: 5, mp: 16, cd: 12, dur: 0.36, impact: 0.2, anim: 'cast',
    mult: 2.4, multPerRank: 0.4, range: 6, r: 1.6, stun: 2.2,
  },
  gungsa_maenun: {
    id: 'gungsa_maenun', cls: 'gungsa', name: '매의 눈', desc: '치명타 확률과 공격 속도를 높입니다.',
    kind: 'buff', req: 11, maxRank: 5, mp: 18, cd: 22, dur: 0.36, impact: 0.15, anim: 'cast',
    mult: 0, multPerRank: 0, buff: { crit: 0.2, aspd: 0.3, dur: 10 },
  },
  gungsa_hwasalbi: {
    id: 'gungsa_hwasalbi', cls: 'gungsa', name: '화살비', desc: '지정한 곳에 화살을 비처럼 쏟아붓습니다. 궁극기.',
    kind: 'groundMulti', req: 18, maxRank: 3, mp: 42, cd: 42, dur: 0.7, impact: 0.3, anim: 'attack3',
    mult: 1.3, multPerRank: 0.35, range: 9, r: 3, count: 12, delay: 0.3,
  },
};

export const SKILL_KEYS = ['Q', 'E', 'R', 'F', 'V'];

/** 레벨업에 필요한 경험치 */
export function expToNext(level: number): number {
  return Math.round(60 * Math.pow(level, 1.75) + 40 * level);
}

export function skillMult(s: SkillDef, rank: number): number {
  return s.mult + s.multPerRank * Math.max(0, rank - 1);
}

/** 스킬 포인트: 2레벨부터 레벨당 1 */
export const skillPointsAt = (level: number) => Math.max(0, level - 1);

export interface BaseStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  crit: number;
  critDmg: number;
  speed: number;
  aspd: number;
  cdr: number;
  regenHp: number;
  regenMp: number;
}

export function baseStats(cls: ClassId, level: number): BaseStats {
  const c = CLASSES[cls];
  const l = level - 1;
  return {
    maxHp: Math.round(c.hp + c.hpG * l),
    maxMp: Math.round(c.mp + c.mpG * l),
    atk: c.atk + c.atkG * l,
    def: c.def + c.defG * l,
    crit: 0.08,
    critDmg: 1.6,
    speed: c.speed,
    aspd: 1,
    cdr: 0,
    regenHp: 0.6 + l * 0.08,
    regenMp: 1.4 + l * 0.1,
  };
}

/** 방어력이 반영된 피해. 방어 50이면 절반. */
export function mitigate(raw: number, def: number): number {
  return raw * (100 / (100 + Math.max(0, def) * 2));
}
