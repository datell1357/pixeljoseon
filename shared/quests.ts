// 퀘스트와 NPC 대사
import type { ItemStack } from './items';

export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  /** 이전에 끝내야 하는 퀘스트 */
  after?: string;
  minLevel: number;
  intro: string;
  done: string;
  goal: QuestGoal;
  rewards: { exp: number; gold: number; items?: [string, number][]; gear?: { base: Record<string, string>; rarity: 0 | 1 | 2 | 3 } };
  /** 진행 안내 (어디로) */
  hint: string;
  where: string;
}

export type QuestGoal =
  | { type: 'kill'; mon: string; n: number; label: string }
  | { type: 'collect'; item: string; n: number; label: string }
  | { type: 'talk'; npc: string; label: string }
  | { type: 'reach'; map: string; label: string }
  | { type: 'rift'; floor: number; label: string };

const classWeapon = (tier: number) => ({
  warrior: `sword_${tier}`,
  mage: `staff_${tier}`,
  archer: `bow_${tier}`,
});

export const QUESTS: QuestDef[] = [
  {
    id: 'q_first_light', title: '첫 등불', giver: 'npc_elder', minLevel: 1,
    intro: '어서 오게. 등불마루에 온 걸 환영하네. 해가 진 뒤로 숲의 버섯들이 마을 어귀까지 내려왔어. 동쪽 문으로 나가 다섯만 쫓아 주게.',
    done: '이렇게 빨리? 등불을 맡길 만한 사람이 왔구먼. 이건 약소하지만 받아 두게.',
    goal: { type: 'kill', mon: 'mushroom', n: 5, label: '버섯 병사 처치' },
    rewards: { exp: 90, gold: 40, items: [['potion_hp_s', 5]] },
    hint: '마을 동쪽 문을 나가면 이끼숲이에요.', where: 'woods',
  },
  {
    id: 'q_merchant_tusk', title: '어금니 값', giver: 'npc_merchant', after: 'q_first_light', minLevel: 2,
    intro: '멧돼지 어금니는 귀한 물건이라오. 셋만 구해 주면 값은 후하게 쳐 드리지. 숲 가운데 공터에 많아요.',
    done: '좋은 물건이네! 약속한 대로 치렀소. 앞으로도 잘 부탁하오.',
    goal: { type: 'collect', item: 'boar_tusk', n: 3, label: '멧돼지 어금니 모으기' },
    rewards: { exp: 180, gold: 120, items: [['potion_mp_s', 5]] },
    hint: '이끼숲의 가시 멧돼지가 떨어뜨려요.', where: 'woods',
  },
  {
    id: 'q_smith_iron', title: '쓸 만한 무기', giver: 'npc_smith', after: 'q_first_light', minLevel: 3,
    intro: '그 무기로 숲 깊은 곳에 간다고? 도깨비불 여덟만 잡아 오게. 그럼 내가 제대로 된 걸 하나 쥐여 주지.',
    done: '배짱은 있군. 약속한 무기일세. 강화는 언제든 내게 맡기게.',
    goal: { type: 'kill', mon: 'wisp', n: 8, label: '이끼 도깨비불 처치' },
    rewards: { exp: 320, gold: 80, gear: { base: classWeapon(2), rarity: 1 } },
    hint: '이끼숲 북쪽 늪 근처에 떠다녀요.', where: 'woods',
  },
  {
    id: 'q_hollow', title: '고목의 속', giver: 'npc_elder', after: 'q_smith_iron', minLevel: 6,
    intro: '숲이 이렇게 된 까닭은 고목왕이 깨어났기 때문일세. 숲 동쪽 끝의 빈터 동굴로 들어가 잠재워 주게. 혼자라면 물약을 넉넉히 챙기고.',
    done: '고목왕이 쓰러졌다니! 마을 사람들이 오늘은 푹 자겠구먼. 벌판으로 가는 길도 이제 열렸네.',
    goal: { type: 'kill', mon: 'elder', n: 1, label: '이끼 고목왕 쓰러뜨리기' },
    rewards: { exp: 1100, gold: 500, items: [['ember_shard', 10], ['potion_hp_l', 3]] },
    hint: '이끼숲 동쪽 끝의 동굴이에요.', where: 'hollow',
  },
  {
    id: 'q_guard_field', title: '잿빛 벌판 정찰', giver: 'npc_guard', after: 'q_hollow', minLevel: 9,
    intro: '숲 너머 벌판에서 등불이 하나씩 꺼지고 있다는 보고다. 가서 늑대 무리를 줄이고 무사히 돌아와라.',
    done: '수고했다. 벌판 곳곳에 꺼진 등불 신도들이 보였다니… 심상치 않군.',
    goal: { type: 'kill', mon: 'ashwolf', n: 10, label: '잿빛 늑대 처치' },
    rewards: { exp: 2200, gold: 600, items: [['potion_hp_l', 4], ['potion_mp_l', 2]] },
    hint: '이끼숲 북쪽 끝 문을 나가면 잿빛 벌판이에요.', where: 'ashfield',
  },
  {
    id: 'q_keeper_core', title: '꺼지지 않는 불씨', giver: 'npc_keeper', after: 'q_guard_field', minLevel: 11,
    intro: '창고의 등잔 기름이 다 됐어. 재의 심 여섯이면 한 해는 버텨. 골렘과 벌레들이 지니고 다니지.',
    done: '이걸로 마을 등불은 걱정 없겠어. 고마워. 창고 한 칸 더 내어 줄게.',
    goal: { type: 'collect', item: 'ash_core', n: 6, label: '재의 심 모으기' },
    rewards: { exp: 3200, gold: 900, items: [['ember_shard', 15]] },
    hint: '잿빛 벌판의 골렘·신도·늑대가 떨어뜨려요.', where: 'ashfield',
  },
  {
    id: 'q_cultists', title: '꺼진 등불 신도', giver: 'npc_guard', after: 'q_guard_field', minLevel: 12,
    intro: '신도들을 그대로 두면 안 된다. 열두 명을 처치해 그들의 의식을 끊어라.',
    done: '잘했다. 그들이 섬기는 자의 이름을 들었다. 꺼진 등불지기…',
    goal: { type: 'kill', mon: 'cultist', n: 12, label: '꺼진 등불 신도 처치' },
    rewards: { exp: 4800, gold: 1100, gear: { base: classWeapon(3), rarity: 2 } },
    hint: '잿빛 벌판 서쪽 제단 근처예요.', where: 'ashfield',
  },
  {
    id: 'q_warden', title: '꺼진 등불지기', giver: 'npc_elder', after: 'q_cultists', minLevel: 16,
    intro: '오래전 이 길의 등불을 지키던 자가 어둠에 먹혔네. 벌판 깊은 곳 용광로에 있다지. 파티를 꾸려 가게. 그를 쓰러뜨리면 등불길이 다시 이어질 걸세.',
    done: '…돌아왔구먼. 저 멀리까지 등불이 켜지는 게 보이네. 고맙네, 등불지기여.',
    goal: { type: 'kill', mon: 'warden', n: 1, label: '꺼진 등불지기 쓰러뜨리기' },
    rewards: { exp: 16000, gold: 4000, items: [['ember_shard', 30]], gear: { base: classWeapon(4), rarity: 2 } },
    hint: '잿빛 벌판 북동쪽 용광로 입구예요.', where: 'furnace',
  },
  {
    id: 'q_rift', title: '균열 끝까지', giver: 'npc_keeper', after: 'q_warden', minLevel: 18,
    intro: '등불마루 서쪽의 균열은 끝이 없어. 스무 층까지 내려가 봐. 토큰은 상인이 장비로 바꿔 줄 거야.',
    done: '스무 층이라니… 정말 끝이 없는 사람이네.',
    goal: { type: 'rift', floor: 20, label: '균열 20층 도달' },
    rewards: { exp: 22000, gold: 8000, items: [['rift_token', 30]] },
    hint: '마을 서쪽의 보랏빛 문으로 들어가요.', where: 'rift',
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  sheet: string;
  lines: string[];
  shop?: boolean;
  forge?: boolean;
  vault?: boolean;
  rift?: boolean;
}

export const NPCS: Record<string, NpcDef> = {
  npc_elder: { id: 'npc_elder', name: '담우', title: '마을 어른', sheet: 'npc_elder', lines: ['등불은 혼자 켜지 않는 법이지. 길에서 만나는 이들과 함께 가게.', '해 지기 전에 물약을 챙겨 두게.'] },
  npc_merchant: { id: 'npc_merchant', name: '보따', title: '떠돌이 상인', sheet: 'npc_merchant', shop: true, rift: true, lines: ['좋은 물건 많아요. 천천히 봐요.'] },
  npc_smith: { id: 'npc_smith', name: '철구', title: '대장장이', sheet: 'npc_smith', forge: true, lines: ['쓰던 장비는 버리지 말고 가져오게. 조각으로 녹여 줄 테니.'] },
  npc_guard: { id: 'npc_guard', name: '하진', title: '경비대장', sheet: 'npc_guard', lines: ['경계를 늦추지 마라.', '위험한 공격은 바닥에 먼저 빨갛게 표시된다. 구르거나 비켜라.'] },
  npc_keeper: { id: 'npc_keeper', name: '유림', title: '창고지기', sheet: 'npc_keeper', vault: true, lines: ['맡길 물건 있어? 잘 넣어 둘게.'] },
};

// ─── 퀘스트 판정: 서버와 화면이 같은 규칙을 쓴다 ─────────────

export interface QuestView {
  level: number;
  riftBest: number;
  bag: (ItemStack | null)[];
  quests: { active: Record<string, number>; done: string[] };
}

export function countInBag(c: Pick<QuestView, 'bag'>, id: string): number {
  let n = 0;
  for (const it of c.bag) if (it?.kind === 'stack' && it.id === id) n += it.n;
  return n;
}

export function questAvailable(c: QuestView, q: QuestDef): boolean {
  if (c.quests.done.includes(q.id)) return false;
  if (q.id in c.quests.active) return false;
  if (c.level < q.minLevel) return false;
  if (q.after && !c.quests.done.includes(q.after)) return false;
  return true;
}

export function questProgress(c: QuestView, q: QuestDef): { cur: number; need: number } {
  const g = q.goal;
  if (g.type === 'collect') return { cur: Math.min(g.n, countInBag(c, g.item)), need: g.n };
  if (g.type === 'kill') return { cur: c.quests.active[q.id] ?? 0, need: g.n };
  if (g.type === 'rift') return { cur: Math.min(g.floor, c.riftBest), need: g.floor };
  return { cur: c.quests.active[q.id] ?? 0, need: 1 };
}

export function questComplete(c: QuestView, q: QuestDef): boolean {
  const { cur, need } = questProgress(c, q);
  return cur >= need;
}

/** NPC 머리 위 표시: 끝낼 퀘스트가 있으면 ?, 받을 퀘스트가 있으면 ! */
export function npcMark(c: QuestView, npc: string): '' | '!' | '?' {
  for (const q of QUESTS) {
    if (q.giver === npc && q.id in c.quests.active && questComplete(c, q)) return '?';
  }
  for (const q of QUESTS) {
    if (q.giver === npc && questAvailable(c, q)) return '!';
  }
  return '';
}
