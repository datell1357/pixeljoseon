// docs/ART_SPEC.md의 목록과 수치를 코드로 옮긴 것. 굽기와 검사가 함께 쓴다. (브라우저에서도 읽는다)
export const DIRS8 = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
export const DIRS5 = ['S', 'SW', 'W', 'NW', 'N'];
/** 화면 방향 → 바라보는 (u,v) */
export const DIRV = { S: [1, 1], SW: [0, 1], W: [-1, 1], NW: [-1, 0], N: [-1, -1], NE: [0, -1], E: [1, -1], SE: [1, 0] };

const A = (frames, dur, loop = false) => ({ frames, dur, loop });
export const ANIMS = {
  player: { idle: A(6, 1.2, true), walk: A(8, 0.64, true), attack1: A(6, 0.32), attack2: A(6, 0.32), attack3: A(7, 0.46), cast: A(7, 0.5), spin: A(6, 0.5), dodge: A(6, 0.38), guard: A(3, 0.12), hit: A(3, 0.24), death: A(8, 0.8) },
  npc: { idle: A(6, 1.2, true) },
  monster: { idle: A(4, 0.8, true), walk: A(6, 0.6, true), attack: A(6, 0.5), hit: A(3, 0.24), death: A(7, 0.7) },
  boss: { idle: A(6, 1.4, true), walk: A(8, 1.0, true), slam: A(8, 0.9), sweep: A(8, 0.8), cast: A(8, 1.0), hit: A(3, 0.3), death: A(12, 1.6) },
};
export const IDS = {
  player: ['musa', 'dosa', 'gungsa'].flatMap((c) => ['a', 'b', 'c'].map((v) => `pc_${c}_${v}`)),
  npc: ['npc_elder', 'npc_merchant', 'npc_smith', 'npc_guard', 'npc_keeper'],
  monster: ['mushroom', 'boar', 'wisp', 'ashwolf', 'emberbug', 'golem', 'cultist', 'shade'],
  boss: ['elder', 'warden'],
};
export const PROP_IDS = ('house_a house_b house_c tavern smithy shop_stall well big_lantern lantern_post fence_u fence_v crate barrel sign bench tree_oak tree_pine bush rock_s rock_l stump log hay cart ' +
  'tree_moss_l tree_moss_s tree_moss_dead mush_cluster mossy_rock fallen_log ruin_pillar ruin_arch fern ' +
  'tree_dead ash_rock_s ash_rock_l ember_vent broken_cart bone_pile ' +
  'wall_stone wall_ash pillar torch door_arch chest chest_open rubble statue ' +
  'portal_arch waystone').split(' ');
export const TERRAIN_FULL = 'grass meadow forest dirt cobble ash scorch cave stone water lava'.split(' ');
export const TERRAIN_EDGE = 'meadow forest dirt cobble ash scorch stone water lava'.split(' ');
export const ITEM_IDS = 'sword_1 sword_2 sword_3 sword_4 staff_1 staff_2 staff_3 staff_4 bow_1 bow_2 bow_3 bow_4 helm_1 helm_2 helm_3 armor_1 armor_2 armor_3 boots_1 boots_2 boots_3 ring_1 ring_2 amulet_1 amulet_2 potion_hp_s potion_hp_l potion_mp_s potion_mp_l scroll_home ember_shard moss_core boar_tusk ash_core warden_seal gold rift_token key'.split(' ');
export const SKILL_IDS = 'musa_hwimori musa_dolgyeok musa_ttanggareugi musa_horyeong musa_cheongeun dosa_hwabu dosa_bingyeolbu dosa_nakseong dosa_hosinbu dosa_yuseongu gungsa_osi gungsa_pyeonjeon gungsa_olmu gungsa_maenun gungsa_hwasalbi roll blink leap deungpae bujeok_makgi bitgyeo_naegi'.split(' ');

export const insideTile = (x, y) => {
  if (y < 0 || y >= 32) return false;
  const half = y < 16 ? (y + 1) * 2 : (32 - y) * 2;
  return x >= 32 - half && x < 32 + half;
};
