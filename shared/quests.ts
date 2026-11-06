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
  musa: `hwando_${tier}`,
  dosa: `chorongdae_${tier}`,
  gungsa: `gakgung_${tier}`,
});

export const QUESTS: QuestDef[] = [
  {
    id: 'q_first_light', title: '첫 사냥', giver: 'npc_elder', minLevel: 1,
    intro: '어서 오게. 초롱골에 온 걸 환영하네. 가을걷이 철인데 다람쥐들이 곳간 알곡을 죄다 털어 가고 있어. 동쪽 다리를 건너 솔모루 숲에서 다섯 마리만 쫓아 주게.',
    done: '벌써? 쓸 만한 사람이 왔구먼. 약소하지만 받아 두게.',
    goal: { type: 'kill', mon: 'daramjwi', n: 5, label: '다람쥐 쫓기' },
    rewards: { exp: 90, gold: 40, items: [['bohyeolhwan', 5]] },
    hint: '마을 동쪽 다리를 건너면 솔모루 숲이에요.', where: 'woods',
  },
  {
    id: 'q_merchant_tusk', title: '어금니 값', giver: 'npc_merchant', after: 'q_first_light', minLevel: 2,
    intro: '멧돼지 어금니는 한양 약재상에서 값을 잘 쳐 준다오. 셋만 구해 주면 후하게 드리지. 숲 남쪽 골짜기에 많소.',
    done: '좋은 물건이오! 약속한 대로 치렀소. 앞으로도 잘 부탁하오.',
    goal: { type: 'collect', item: 'eomni', n: 3, label: '멧돼지 어금니 모으기' },
    rewards: { exp: 180, gold: 120, items: [['cheongsimhwan', 5]] },
    hint: '솔모루 숲의 멧돼지가 떨어뜨려요.', where: 'woods',
  },
  {
    id: 'q_smith_iron', title: '쓸 만한 무기', giver: 'npc_smith', after: 'q_first_light', minLevel: 3,
    intro: '그 무기로 숲 깊은 곳에 간다고? 밭을 파헤치는 너구리 여덟만 잡아 오게. 그럼 제대로 된 걸 하나 쥐여 주지.',
    done: '배짱은 있군. 약속한 무기일세. 강화는 언제든 내게 맡기게.',
    goal: { type: 'kill', mon: 'neoguri', n: 8, label: '너구리 잡기' },
    rewards: { exp: 320, gold: 80, gear: { base: classWeapon(2), rarity: 1 } },
    hint: '솔모루 숲 북쪽 늪가에 살아요.', where: 'woods',
  },
  {
    id: 'q_hollow', title: '여우굴', giver: 'npc_elder', after: 'q_smith_iron', minLevel: 6,
    intro: '요즘 숲에서 사람들이 홀려 길을 잃는다네. 숲 동쪽 끝 여우굴에 꼬리 아홉 달린 구미호가 산다는 소문이 있어. 혼자라면 약을 넉넉히 챙겨 가게.',
    done: '구미호를 물리쳤다니! 마을 사람들이 오늘은 발 뻗고 자겠구먼. 화전골로 가는 고갯길도 이제 열렸네.',
    goal: { type: 'kill', mon: 'gumiho', n: 1, label: '구미호 물리치기' },
    rewards: { exp: 1100, gold: 500, items: [['jeongcheol', 10], ['bohyeoltang', 3]] },
    hint: '솔모루 숲 동쪽 끝의 굴이에요.', where: 'hollow',
  },
  {
    id: 'q_guard_field', title: '화전골 정찰', giver: 'npc_guard', after: 'q_hollow', minLevel: 9,
    intro: '숲 너머 화전골이 불탄 뒤로 늑대 떼가 내려온다는 보고다. 가서 열 마리만 줄이고 무사히 돌아와라.',
    done: '수고했다. 그런데 화전골 바위틈에서 범 발자국을 봤다니… 심상치 않군.',
    goal: { type: 'kill', mon: 'neukdae', n: 10, label: '늑대 잡기' },
    rewards: { exp: 2200, gold: 600, items: [['bohyeoltang', 4], ['jeonggitang', 2]] },
    hint: '솔모루 숲 북쪽 끝 고개를 넘으면 화전골이에요.', where: 'ashfield',
  },
  {
    id: 'q_keeper_core', title: '겨울나기', giver: 'npc_keeper', after: 'q_guard_field', minLevel: 11,
    intro: '곳간에 겨울 이불 감이 다 떨어졌어. 짐승 가죽 여섯이면 한겨울도 버텨. 화전골 늑대랑 곰이 지니고 다니지.',
    done: '이걸로 올겨울은 걱정 없겠어. 고마워. 곳간 한 칸 더 내어 줄게.',
    goal: { type: 'collect', item: 'jimseung_gajuk', n: 6, label: '짐승 가죽 모으기' },
    rewards: { exp: 3200, gold: 900, items: [['jeongcheol', 15]] },
    hint: '화전골의 늑대·승냥이·곰·범이 떨어뜨려요.', where: 'ashfield',
  },
  {
    id: 'q_cultists', title: '호환(虎患)', giver: 'npc_guard', after: 'q_guard_field', minLevel: 12,
    intro: '화전골에 범이 들어 사람을 해친다. 이대로 두면 마을까지 내려온다. 범 여덟을 잡아라.',
    done: '착호갑사 못지않구나. 그런데 범들이 쇠부리터 쪽에서 쫓겨 내려왔다는 말이 있다. 그 안에 무언가 있다.',
    goal: { type: 'kill', mon: 'horangi', n: 8, label: '범 잡기' },
    rewards: { exp: 4800, gold: 1100, gear: { base: classWeapon(3), rarity: 2 } },
    hint: '화전골 서쪽 바위산이에요.', where: 'ashfield',
  },
  {
    id: 'q_warden', title: '불가사리', giver: 'npc_elder', after: 'q_cultists', minLevel: 16,
    intro: '옛 쇠부리터에서 쇠를 먹는 괴물 불가사리가 깨어났다네. 솥이며 농기구며 쇠붙이란 쇠붙이는 다 먹어 치우고 점점 커진다지. 패를 꾸려 가게. 그놈을 잠재우면 이 고을 등불이 다시 이어질 걸세.',
    done: '…돌아왔구먼. 저 멀리까지 등불이 켜지는 게 보이네. 고맙네.',
    goal: { type: 'kill', mon: 'bulgasari', n: 1, label: '불가사리 잠재우기' },
    rewards: { exp: 16000, gold: 4000, items: [['jeongcheol', 30]], gear: { base: classWeapon(4), rarity: 2 } },
    hint: '화전골 북동쪽 쇠부리터 입구예요.', where: 'furnace',
  },
  {
    id: 'q_rift', title: '저승길 끝까지', giver: 'npc_keeper', after: 'q_warden', minLevel: 18,
    intro: '마을 서쪽 홍살문 너머의 저승길은 끝이 없어. 스무 층까지 내려가 봐. 저승 엽전은 보부상이 장비로 바꿔 줄 거야.',
    done: '스무 층이라니… 정말 겁이 없는 사람이네.',
    goal: { type: 'rift', floor: 20, label: '저승길 20층 도달' },
    rewards: { exp: 22000, gold: 8000, items: [['jeoseung_yeopjeon', 30]] },
    hint: '마을 서쪽 홍살문 너머 보랏빛 문으로 들어가요.', where: 'rift',
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
  npc_elder: { id: 'npc_elder', name: '담우', title: '마을 어른', sheet: 'npc_elder', lines: ['등불은 혼자 켜지 않는 법이지. 길에서 만나는 이들과 함께 가게.', '해 지기 전에 약을 챙겨 두게.'] },
  npc_merchant: { id: 'npc_merchant', name: '보따', title: '보부상', sheet: 'npc_merchant', shop: true, rift: true, lines: ['좋은 물건 많소. 천천히 보시오.'] },
  npc_smith: { id: 'npc_smith', name: '철구', title: '대장장이', sheet: 'npc_smith', forge: true, lines: ['쓰던 장비는 버리지 말고 가져오게. 녹여서 정철로 만들어 줄 테니.'] },
  npc_guard: { id: 'npc_guard', name: '하진', title: '포교', sheet: 'npc_guard', lines: ['경계를 늦추지 마라.', '위험한 공격은 바닥에 먼저 빨갛게 표시된다. 구르거나 비켜라.'] },
  npc_keeper: { id: 'npc_keeper', name: '유림', title: '곳간지기', sheet: 'npc_keeper', vault: true, lines: ['맡길 물건 있어? 잘 넣어 둘게.'] },
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
