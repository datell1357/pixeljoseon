// 지도 파일 형식. tools/genmaps.ts가 만들고 서버·클라이언트가 읽는다.
import type { SolidGrid } from './core';

export interface MapObject {
  type: 'door' | 'arrive' | 'npc' | 'waystone' | 'lantern';
  name: string;
  u: number;
  v: number;
  r?: number;
  /** door: 이동할 지도 */
  target?: string;
  /** door: 도착 지점 이름 */
  arrive?: string;
  /** door: 안내 문구 */
  label?: string;
  /** door: 필요 레벨 */
  minLevel?: number;
  /** door: 끝내야 하는 퀘스트 */
  needQuest?: string;
  /** door: 인스턴스 입구 */
  instance?: boolean;
  /** npc: 바라보는 방향 */
  dir?: number;
}

export interface SpawnGroup {
  mon: string;
  u: number;
  v: number;
  /** 흩어지는 반경 */
  r: number;
  n: number;
  level: number;
  /** 다시 나타나기까지 초. 0이면 다시 안 나온다 */
  respawn: number;
  /** 무리: 하나가 싸우면 같이 달려든다 */
  pack?: boolean;
}

export interface MapData {
  name: string;
  title: string;
  w: number;
  h: number;
  base: string;
  /** 위에 덮는 지형 순서 */
  layers: string[];
  /** 지형별 꼭짓점 격자: (h+1)줄, 줄마다 (w+1)글자 */
  corners: Record<string, string[]>;
  props: [string, number, number][];
  /** 바닥 장식: 큰 격자 그림 없이 소품 층 아래에 깐다 */
  decals: [string, number, number][];
  objects: MapObject[];
  spawns: SpawnGroup[];
  solid: SolidGrid;
  /** 화면 전체 색조 */
  tint: [number, number, number];
  /** 어두운 정도 0~1 (등불 빛이 살아난다) */
  dark: number;
  bg: string;
  music: string;
  safe?: boolean;
  instance?: boolean;
  /** 지도에 보여 줄 지형 색 */
  color: string;
}

export const MAP_NAMES = ['town', 'woods', 'hollow', 'ashfield', 'furnace', 'rift'] as const;
export type MapName = (typeof MAP_NAMES)[number];
export const PERSISTENT_MAPS: string[] = ['town', 'woods', 'ashfield'];
