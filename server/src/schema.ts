// 모든 클라이언트에 자동 동기화되는 방 상태
import { schema, t, type SchemaType } from '@colyseus/schema';

export const PlayerS = schema(
  {
    name: t.string(),
    cls: t.string(),
    look: t.uint8(),
    u: t.float32(),
    v: t.float32(),
    dir: t.uint8(),
    anim: t.string(),
    hp: t.int32(),
    maxHp: t.int32(),
    mp: t.int32(),
    maxMp: t.int32(),
    level: t.uint8(),
    dead: t.boolean(),
    party: t.string(),
    /** 비트: 1 보호막, 2 공격 강화, 4 매의 눈, 8 방패, 16 둔화 */
    fx: t.uint8(),
    shield: t.int32(),
  },
  'PlayerS',
);
export type PlayerS = SchemaType<typeof PlayerS>;

export const MonS = schema(
  {
    kind: t.string(),
    u: t.float32(),
    v: t.float32(),
    dir: t.uint8(),
    anim: t.string(),
    /** 비반복 동작을 다시 재생할 때 올린다 */
    seq: t.uint16(),
    hp: t.int32(),
    maxHp: t.int32(),
    level: t.uint8(),
    boss: t.boolean(),
    elite: t.boolean(),
    /** 비트: 1 기절, 2 둔화 */
    fx: t.uint8(),
  },
  'MonS',
);
export type MonS = SchemaType<typeof MonS>;

export const LootS = schema(
  {
    u: t.float32(),
    v: t.float32(),
    icon: t.string(),
    label: t.string(),
    rarity: t.uint8(),
    gold: t.int32(),
    owner: t.string(),
  },
  'LootS',
);
export type LootS = SchemaType<typeof LootS>;

export const PropS = schema(
  {
    kind: t.string(),
    u: t.float32(),
    v: t.float32(),
    label: t.string(),
    /** 문처럼 밟으면 작동하는 물건의 반경 */
    r: t.float32(),
  },
  'PropS',
);
export type PropS = SchemaType<typeof PropS>;

export const RoomStateS = schema(
  {
    mapName: t.string(),
    players: t.map(PlayerS),
    monsters: t.map(MonS),
    loot: t.map(LootS),
    /** 실행 중 생기는 문·보물 상자 */
    props: t.map(PropS),
    floor: t.uint16(),
    /** 남은 몬스터 수 (균열) */
    remain: t.uint16(),
  },
  'RoomStateS',
);
export type RoomStateS = SchemaType<typeof RoomStateS>;
