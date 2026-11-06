// 굽기 도구의 뼈대·동작 코드(순수 JS)를 그대로 쓴다
declare module '@bake/rig.js' {
  export const Human: any;
  export const Quad: any;
  export const Rig: any;
  export const STAND: any;
  export const bakeKeys: (n: number, keys: any[], base?: any, loop?: boolean) => any[];
  export const trotFrames: (n: number, opt?: any) => any[];
}
declare module '@bake/humans.js' {
  export const musaAnims: () => any;
  export const dosaAnims: () => any;
  export const gungsaAnims: () => any;
  export const idleFrames: (n: number, base: any, amp?: number) => any[];
}
declare module '@bake/monsters.js' {
  export const MONSTERS: Record<string, { build: () => any; float?: boolean }>;
}
declare module '@bake/bosses.js' {
  export const BOSSES: Record<string, { build: () => any }>;
}
