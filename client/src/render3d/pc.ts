// 플레이어 모델. 입은 장비에 따라 몸을 다시 짓는다.
// 얼굴·머리·옷 색은 캐릭터 것을 유지하고, 투구·갑옷·신발·반지·목걸이·무기가 겉모습을 바꾼다.
// 한 인물이 그리기 호출 하나로 끝나도록 조합마다 모델 하나를 굽고, 같은 조합은 함께 쓴다.
import * as THREE from 'three';
import { gungsaAnims, dosaAnims, musaAnims } from '@bake/humans.js';
import { parseGearKey, type Slot, type WornPiece } from '@shared/items';
import { Geo, mix, tone, v3, type Hex } from './geo';
import { skinnedAsset, skinnedWithGear, type GearPick } from './skinned';
import { Body, DIMS, SKINS, addChain, arms, bangs, belt, bonnet, finish, fineRings, gat, hairCap, head, headband, legs, pauldrons, pelvis, ponytail, skirtPanels, topknot, torso, torsoFront, torsoRings, type Build, type CharAsset } from './chars';

type Worn = Partial<Record<Slot, WornPiece>>;
type Cls = 'musa' | 'dosa' | 'gungsa';

const RARE: Hex[] = [0, 0x7ee08a, 0x6fb7ff, 0xc79bff];
const STEEL = 0x98a0ac;
const STEEL_D = 0x626874;
const ASH = 0x3a3840;
const ASH_L = 0x6c6976;
const EMBER = 0xff7a2a;
const MOSS = 0x9fffa8;
const WARDEN = 0x7fc8ff;
const BARE = 0xe6e0d0;

/** 강화 단계별 빛 세기 */
const GLOW = [0, 0.4, 0.75, 1];

/** 테두리 색: 등급이 높으면 등급 색으로 물든다 */
const tint = (c: Hex, p?: WornPiece) => (p && p.rarity ? mix(c, RARE[p.rarity], 0.92) : c);
/** 테두리 빛: 강화가 높거나 영웅 등급이면 스스로 빛난다 */
const trimGlow = (p?: WornPiece) => (p ? Math.max(GLOW[p.glow], p.rarity >= 3 ? 0.7 : p.rarity === 2 ? 0.4 : 0) : 0);

interface Look {
  coat: Hex;
  trim: Hex;
  /** 안에 받쳐 입는 옷 */
  under: Hex;
  /** 등에 두르는 끈과 목도리 */
  accent: Hex;
  hair: Hex;
  band: Hex;
  pants: Hex;
  hat: Hex;
  shield: Hex;
  ring: Hex;
  vest: Hex;
  female?: boolean;
  style: number;
  skin: number;
}

const LOOKS: Record<Cls, Record<string, Look>> = {
  musa: {
    a: { coat: 0x2c3f66, trim: 0xc9913e, under: 0x7a2c2c, accent: 0xa8302c, hair: 0x241c1c, band: 0xa8302c, pants: 0x38333e, hat: 0x5c432e, shield: 0x8a2c28, ring: 0x2c3f66, vest: 0x2c221c, style: 0, skin: 0 },
    b: { coat: 0x7a2c30, trim: 0xd2a24a, under: 0x263a5e, accent: 0xe6dcc4, hair: 0x2c1e1a, band: 0xe6dcc4, pants: 0x3a2e30, hat: 0x5c432e, shield: 0x2c3f66, ring: 0x7a2c30, vest: 0x2c221c, female: true, style: 1, skin: 1 },
    c: { coat: 0x2f4f46, trim: 0xb88a3c, under: 0x5a3a24, accent: 0x24302c, hair: 0x4a3024, band: 0x24302c, pants: 0x38362e, hat: 0x5c432e, shield: 0x5c4630, ring: 0x2f4f46, vest: 0x2c221c, style: 2, skin: 2 },
  },
  dosa: {
    a: { coat: 0xe6e0d0, trim: 0x2c4a6e, under: 0xe6e0d0, accent: 0x8a2f35, hair: 0x201a1e, band: 0x8a2f35, pants: 0x3a3640, hat: 0x1e1c22, shield: 0, ring: 0, vest: 0x3a3640, style: 0, skin: 0 },
    b: { coat: 0x6e8fa8, trim: 0xece4d0, under: 0x6e8fa8, accent: 0xd2a24a, hair: 0x2a2028, band: 0xd2a24a, pants: 0x3a3640, hat: 0x1e1c22, shield: 0, ring: 0, vest: 0x3a3640, female: true, style: 1, skin: 1 },
    c: { coat: 0x5c4670, trim: 0xd2a24a, under: 0x5c4670, accent: 0xe6dcc4, hair: 0xd8d4cc, band: 0xe6dcc4, pants: 0x3a3640, hat: 0x26222c, shield: 0, ring: 0, vest: 0x3a3640, style: 2, skin: 2 },
  },
  gungsa: {
    a: { coat: 0x56683e, trim: 0xc9a65a, under: 0x56683e, accent: 0xa8382e, hair: 0x241c18, band: 0xa8382e, pants: 0x4a4436, hat: 0x3c3028, shield: 0, ring: 0, vest: 0x6e4c30, style: 0, skin: 0 },
    b: { coat: 0x7d5a38, trim: 0xd2a24a, under: 0x7d5a38, accent: 0xe4dcc4, hair: 0x332019, pants: 0x423a30, band: 0xe4dcc4, hat: 0x2c2c2c, shield: 0, ring: 0, vest: 0x455840, female: true, style: 1, skin: 1 },
    c: { coat: 0x4a4f6a, trim: 0xb88a3c, under: 0x4a4f6a, accent: 0x3e5e6a, hair: 0x4a3226, pants: 0x38343e, band: 0x3e5e6a, hat: 0x4a3a2c, shield: 0, ring: 0, vest: 0x5c3c2c, style: 2, skin: 2 },
  },
};

// ─── 머리 ─────────────────────────────────────

function hair(b: Body, cls: Cls, L: Look, covered: boolean) {
  // 투구 아래에서는 머리가 눌린다
  const opt = { lift: covered ? 0.01 : 0.024 };
  const fringe = (o: Parameters<typeof bangs>[2]) => {
    if (!covered) bangs(b, L.hair, o);
  };
  hairStyle(b, cls, L, covered, opt, fringe);
}

function hairStyle(b: Body, cls: Cls, L: Look, covered: boolean, opt: { lift: number }, fringe: (o: Parameters<typeof bangs>[2]) => void) {
  if (cls === 'musa') {
    if (L.style === 0) {
      hairCap(b, L.hair, (a, i) => (Math.abs(a) < 1.15 ? 0.262 + (i % 2) * 0.012 : Math.abs(a) < 1.75 ? 0.15 : 0.1), opt);
      fringe({ front: 0.262, side: 0.12 });
      if (!covered) {
        topknot(b, L.hair);
        headband(b, L.band, true);
      }
    } else if (L.style === 1) {
      hairCap(b, L.hair, (a, i) => (Math.abs(a) < 0.95 ? 0.244 + (i % 2) * 0.022 : Math.abs(a) < 1.6 ? 0.095 + (i % 2) * 0.03 : 0.095), opt);
      fringe({ front: 0.232, side: 0.07, part: 1 });
      ponytail(b, L.hair, covered ? 0.12 : 0.3, covered ? -0.11 : -0.12, 5, 0.056);
      if (!covered) headband(b, L.band, false);
    } else {
      hairCap(b, L.hair, (a, i) => (Math.abs(a) < 1.1 ? 0.246 + (i % 2) * 0.03 : 0.15 + (i % 2) * 0.03), opt);
      fringe({ front: 0.24, side: 0.1, part: -1 });
      if (!covered) headband(b, L.band, true);
    }
  } else if (cls === 'dosa') {
    if (L.style === 0) {
      hairCap(b, L.hair, (a, i) => (Math.abs(a) < 1.2 ? 0.27 : Math.abs(a) < 1.8 ? 0.16 : 0.1 + (i % 2) * 0.02), opt);
      fringe({ front: 0.27, side: 0.11 });
      if (!covered) topknot(b, L.hair, 0xd2a24a);
    } else if (L.style === 1) {
      hairCap(b, L.hair, (a, i) => (Math.abs(a) < 0.9 ? 0.25 + (i % 2) * 0.016 : Math.abs(a) < 1.7 ? 0.09 + (i % 2) * 0.03 : 0.1), opt);
      fringe({ front: 0.25, side: 0.06, part: 1 });
      // 쪽 찐 머리와 비녀
      topknot(b, L.hair, 0xd2a24a, 0.2, -0.15, 1.2);
      ponytail(b, L.hair, 0.08, -0.08, 3, 0.05);
    } else {
      hairCap(b, L.hair, (a, i) => (Math.abs(a) < 1.0 ? 0.25 + (i % 2) * 0.03 : Math.abs(a) < 1.8 ? 0.07 + (i % 2) * 0.04 : 0.02 + (i % 2) * 0.04), opt);
      fringe({ front: 0.24, side: 0.03, part: -1 });
    }
  } else if (L.style === 1) {
    hairCap(b, L.hair, (a, i) => (Math.abs(a) < 1.0 ? 0.244 + (i % 2) * 0.02 : Math.abs(a) < 1.7 ? 0.1 + (i % 2) * 0.03 : 0.1), opt);
    fringe({ front: 0.235, side: 0.075, part: 1 });
    ponytail(b, L.hair, 0.14, -0.11, 5, 0.046);
    if (!covered) headband(b, L.band, false);
  } else {
    hairCap(b, L.hair, (a, i) => (Math.abs(a) < 1.15 ? 0.25 + (i % 2) * 0.02 : 0.13 + (i % 2) * 0.02), opt);
    fringe({ front: 0.25, side: 0.1 });
    if (!covered) headband(b, L.band, true);
  }
}

/** 투구 공통: 머리에 씌우는 둥근 판과 테 */
function dome(g: Geo, rings: number[][], a: Hex, c: Hex, sides = 14) {
  g.loft(rings, (_i, s) => (s % 2 ? a : c), sides, { flat: false });
}

/** 가죽 모자: 귀덮개와 앞 띠 */
function leatherCap(b: Body, band: Hex, em: number) {
  const leather = 0x6e4a2e;
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0.08 });
    const y = 0.23;
    dome(
      g,
      [
        [0, y, -0.002, 0.13, 0.136],
        [0, y + 0.05, -0.004, 0.13, 0.136],
        [0, y + 0.1, -0.006, 0.112, 0.118],
        [0, y + 0.15, -0.008, 0.07, 0.074],
        [0, y + 0.175, -0.008, 0.016, 0.016],
      ],
      leather,
      tone(leather, 0.84),
    );
    // 귀덮개
    g.set({ id: b.next() });
    for (const s of [-1, 1]) g.box(s * 0.128, y - 0.07, -0.02, 0.024, 0.16, 0.13, tone(leather, 0.74), 0.006);
    g.set({ id: b.next(), em });
    g.loft(
      [
        [0, y - 0.006, -0.002, 0.135, 0.141],
        [0, y + 0.03, -0.002, 0.135, 0.141],
      ],
      band,
      14,
      { capBot: false, capTop: false },
    );
    g.set({ em: 0 });
  });
}

/** 철 투구: 둥근 판에 챙, 볼끼, 꼭대기의 붉은 술 */
function ironHelm(b: Body, trim: Hex, em: number, w: WornPiece) {
  const id = b.next();
  const plate = w.rarity >= 2 ? mix(STEEL, RARE[w.rarity], 0.3) : STEEL;
  b.on('head', (g) => {
    g.set({ id, spec: 0.75 });
    const y = 0.236;
    dome(
      g,
      [
        [0, y, -0.002, 0.14, 0.146],
        [0, y + 0.06, -0.004, 0.134, 0.14],
        [0, y + 0.12, -0.006, 0.106, 0.112],
        [0, y + 0.17, -0.008, 0.06, 0.064],
        [0, y + 0.195, -0.008, 0.014, 0.014],
      ],
      plate,
      tone(plate, 0.78),
    );
    // 챙
    g.set({ id: b.next(), spec: 0.6 });
    g.loft(
      [
        [0, y - 0.018, 0.02, 0.17, 0.182],
        [0, y + 0.004, 0.006, 0.142, 0.15],
      ],
      STEEL_D,
      14,
    );
    // 테두리
    g.set({ id: b.next(), spec: 0.8, em });
    g.loft(
      [
        [0, y + 0.002, -0.002, 0.143, 0.149],
        [0, y + 0.03, -0.002, 0.143, 0.149],
      ],
      trim,
      14,
      { capBot: false, capTop: false },
    );
    // 꼭대기 꽂이
    g.tube([v3(0, y + 0.19, -0.008), v3(0, y + 0.26, -0.008)], [0.016, 0.005], trim, 4);
    g.set({ id: b.next(), spec: 0, em: 0 });
    g.rock(0, y + 0.255, -0.01, 0.056, 0.05, 0.056, w.rarity ? RARE[w.rarity] : 0xb5302a, 3, 0.2, 0);
    // 볼끼와 목 가리개
    g.set({ id: b.next(), spec: 0.2 });
    g.box(0, 0.145, -0.128, 0.22, 0.17, 0.018, 0x3e2c22, 0.004);
    for (const s of [-1, 1]) g.box(s * 0.132, 0.15, -0.04, 0.018, 0.17, 0.16, 0x3e2c22, 0.004);
    g.set({ id: b.next(), spec: 0.8 });
    for (const s of [-1, 1]) for (const yy of [0.1, 0.18]) g.box(s * 0.142, yy, -0.04, 0.008, 0.024, 0.024, trim);
    g.set({ spec: 0 });
  });
}

/** 재 강철 투구: 어두운 쇠에 달아오른 이음매, 위로 뻗은 날개 판, 뒤로 날리는 긴 깃 */
function ashHelm(b: Body, ember: Hex, em: number, plume: Hex) {
  const id = b.next();
  b.on('head', (g) => {
    g.set({ id, spec: 0.55 });
    const y = 0.232;
    dome(
      g,
      [
        [0, y, -0.002, 0.146, 0.152],
        [0, y + 0.07, -0.004, 0.14, 0.146],
        [0, y + 0.14, -0.006, 0.11, 0.116],
        [0, y + 0.2, -0.01, 0.062, 0.066],
        [0, y + 0.245, -0.012, 0.012, 0.012],
      ],
      ASH,
      ASH_L,
      12,
    );
    // 이마 판
    g.set({ id: b.next(), spec: 0.7 });
    g.loft(
      [
        [0, y - 0.02, 0.012, 0.166, 0.178],
        [0, y + 0.03, 0, 0.15, 0.158],
      ],
      ASH_L,
      12,
    );
    // 양옆 날개 판
    g.set({ id: b.next(), spec: 0.7 });
    for (const s of [-1, 1]) {
      g.tube([v3(s * 0.12, y + 0.03, -0.01), v3(s * 0.22, y + 0.09, -0.04), v3(s * 0.27, y + 0.22, -0.09)], [0.056, 0.04, 0.005], ASH_L, 4);
    }
    // 목 가리개: 층진 판
    g.set({ id: b.next(), spec: 0.4 });
    for (const [yy, w, z] of [[0.18, 0.28, -0.13], [0.11, 0.31, -0.142], [0.045, 0.34, -0.152]] as const) g.box(0, yy, z, w, 0.072, 0.02, yy > 0.1 ? ASH_L : ASH, 0.004);
    for (const s of [-1, 1]) g.box(s * 0.14, 0.14, -0.05, 0.022, 0.2, 0.17, ASH, 0.004);
    // 달아오른 이음매
    g.set({ id: b.next(), spec: 0, em: Math.max(0.85, em) });
    g.box(0, y + 0.1, 0.14, 0.014, 0.17, 0.012, ember);
    g.loft(
      [
        [0, y + 0.03, 0, 0.152, 0.16],
        [0, y + 0.044, 0, 0.152, 0.16],
      ],
      ember,
      12,
      { capBot: false, capTop: false },
    );
    g.set({ em: 0 });
  });
  addChain(b, 'head', 'plume', 0, 0.45, -0.07, 4, 0.13, (g, i, L) => {
    g.set({ id: b.next(), wind: 0.4 });
    g.box(0, -L / 2, 0, 0.074 - i * 0.012, L + 0.012, 0.016, tone(plume, i % 2 ? 0.84 : 1));
    g.set({ wind: 0 });
  }, 0.55, 20);
}

function helmet(b: Body, cls: Cls, L: Look, w: WornPiece) {
  const trim = tint(L.trim, w);
  const em = trimGlow(w);
  if (w.tier <= 1) {
    if (cls === 'dosa') gat(b, L.hat, trim);
    else if (cls === 'gungsa') bonnet(b, L.hat, trim);
    else leatherCap(b, trim, em);
    return;
  }
  if (w.tier === 2) return ironHelm(b, trim, em, w);
  ashHelm(b, tint(EMBER, w), em, L.accent);
}

// ─── 옷과 갑옷 ───────────────────────────────

/** 누빈 옷: 가로로 땀을 놓은 천 */
function quilted(col: Hex) {
  return (g: Geo, R: number[][]) => {
    const fine = fineRings(R, 3);
    g.loft(fine, (i) => (i % 2 ? col : tone(col, 0.82)), 14, { flat: false });
  };
}

/** 쇠사슬: 밝고 어두운 고리가 번갈아 놓여 아주 작은 점무늬로 읽힌다 */
function mail(R: number[][], g: Geo) {
  g.set({ spec: 0.55 });
  g.loft(fineRings(R, 3), (i, s) => ((i + s) % 2 ? STEEL : STEEL_D), 18, { flat: false });
  g.set({ spec: 0 });
}

/** 찰갑: 쇠 조각을 겹쳐 엮은 판. 줄마다 어긋나고, 아랫단이 살짝 벌어진다 */
function lamellar(R: number[][], g: Geo, a: Hex, c: Hex) {
  const fine = fineRings(R, 2);
  const rings: number[][] = [];
  for (let i = 0; i < fine.length - 1; i++) {
    const r = fine[i];
    const n = fine[i + 1];
    rings.push([r[0], r[1], r[2], r[3] + 0.012, r[4] + 0.012]);
    rings.push([n[0], n[1] - 0.004, n[2], n[3] - 0.002, n[4] - 0.002]);
  }
  rings.push(fine[fine.length - 1]);
  g.set({ spec: 0.5 });
  g.loft(rings, (i, s) => (i % 2 === 1 ? tone(a, 0.5) : (s + Math.floor(i / 2)) % 2 ? a : c), 14, { flat: false });
  g.set({ spec: 0 });
}

/** 앞에 늘어뜨린 천. 쇠사슬 위에 입어 캐릭터 색을 살린다 */
function tabard(b: Body, col: Hex, trim: Hex, em: number) {
  const R = torsoRings();
  const id = b.next();
  b.on('chest', (g) => {
    g.set({ id });
    const z = torsoFront(R, 0.22, 0) + 0.006;
    g.box(0, 0.2, z, 0.2, 0.42, 0.016, col, 0.003);
    g.set({ id: b.next(), em });
    g.box(0, -0.012, z + 0.002, 0.204, 0.022, 0.018, trim);
    g.box(0, 0.25, z + 0.008, 0.05, 0.05, 0.008, trim);
    g.set({ em: 0 });
  });
  b.on('hips', (g) => {
    g.set({ id });
    g.box(0, -0.2, 0.128, 0.2, 0.44, 0.016, col, 0.003);
    g.set({ id: b.next(), em });
    g.box(0, -0.414, 0.13, 0.204, 0.022, 0.018, trim);
    g.set({ em: 0 });
  });
}

/** 크게 솟은 어깨 판 */
function bigPauldrons(b: Body, ember: Hex, em: number, sides: number[] = [-1, 1]) {
  for (const s of sides) {
    const id = b.next();
    b.on('chest', (g) => {
      g.set({ id, spec: 0.6 });
      const x = s * DIMS.shoulderW;
      g.rotZ(s * -0.34, () => {
        g.move(x * 1.04, 0.45, 0, () => {
          g.loft(
            [
              [0, -0.1, 0, 0.124, 0.13],
              [0, -0.055, 0, 0.122, 0.128],
              [0, -0.05, 0, 0.102, 0.108],
              [0, -0.004, 0, 0.1, 0.106],
              [0, 0.002, 0, 0.078, 0.084],
              [0, 0.05, 0, 0.062, 0.068],
              [0, 0.08, 0, 0.012, 0.012],
            ],
            (i) => (i <= 1 ? ASH : i <= 3 ? ASH_L : tone(ASH_L, 1.24)),
            9,
          );
          g.set({ id: b.next(), spec: 0, em: Math.max(0.85, em) });
          g.loft(
            [
              [0, -0.112, 0, 0.126, 0.132],
              [0, -0.096, 0, 0.126, 0.132],
            ],
            ember,
            9,
            { capBot: false, capTop: false },
          );
          g.set({ em: 0 });
        });
      });
      g.set({ spec: 0 });
    });
  }
}

/** 등에 두른 망토. 움직이면 뒤로 날린다 */
function cape(b: Body, col: Hex, trim: Hex, em: number) {
  const id = b.next();
  const n = 4;
  const seg = 0.27;
  addChain(b, 'chest', 'cape', 0, 0.47, -0.12, n, seg, (g, i, L) => {
    const w = 0.28 + i * 0.03;
    g.set({ id, wind: 0.2 });
    g.box(0, -L / 2, 0, w, L + 0.01, 0.016, i % 2 ? tone(col, 0.86) : col);
    if (i === n - 1) {
      g.set({ id, em });
      g.box(0, -L + 0.012, 0.002, w + 0.004, 0.03, 0.02, trim);
      g.set({ em: 0 });
    }
    g.set({ wind: 0 });
  }, 0.12, 22);
}

/** 활잡이 조끼와 어깨끈, 목도리 */
function vest(b: Body, L: Look, vestCol: Hex, gap: Hex, em: number, trim: Hex) {
  const vid = b.next();
  b.on('chest', (g) => {
    g.set({ id: vid });
    g.loft(
      [
        [0, 0.02, 0, 0.14, 0.098],
        [0, 0.24, 0.006, 0.164, 0.112],
        [0, 0.38, 0.002, 0.178, 0.112],
      ],
      (_i, s) => (s === 2 || s === 3 ? gap : vestCol),
      10,
      { capTop: false, capBot: false, rot: Math.PI / 2 - (Math.PI * 2) / 10 - 0.3 },
    );
    if (em > 0) {
      g.set({ id: b.next(), em });
      g.loft(
        [
          [0, 0.02, 0, 0.144, 0.102],
          [0, 0.05, 0, 0.146, 0.104],
        ],
        trim,
        10,
        { capTop: false, capBot: false },
      );
      g.set({ em: 0 });
    }
  });
  const sid = b.next();
  b.on('chest', (g) => {
    g.set({ id: sid });
    g.tube([v3(-0.15, 0.38, 0.09), v3(0.02, 0.24, 0.128), v3(0.14, 0.05, 0.1)], 0.015, 0x3a2a20, 4);
    g.tube([v3(0.14, 0.05, -0.1), v3(0, 0.2, -0.128), v3(-0.15, 0.38, -0.09)], 0.015, 0x3a2a20, 4);
  });
  const nid = b.next();
  b.on('chest', (g) => {
    g.set({ id: nid });
    g.loft(
      [
        [0, 0.445, -0.01, 0.1, 0.085],
        [0, 0.51, -0.012, 0.085, 0.076],
      ],
      L.accent,
      9,
      { capTop: false },
    );
  });
  addChain(b, 'chest', 'scarf', 0.05, 0.47, -0.08, 3, 0.13, (g, i, len) => {
    g.set({ id: nid, wind: 0.5 });
    g.box(0, -len / 2, 0, 0.06 - i * 0.008, len + 0.01, 0.012, tone(L.accent, i % 2 ? 0.88 : 1));
    g.set({ wind: 0 });
  }, 0.3, 18);
}

/** 도사의 쇠사슬 어깨걸이 */
function mailCapelet(b: Body, trim: Hex, em: number) {
  const id = b.next();
  b.on('chest', (g) => {
    g.set({ id, spec: 0.55 });
    g.loft(
      [
        [0, 0.26, 0.002, 0.226, 0.146],
        [0, 0.33, 0.002, 0.226, 0.144],
        [0, 0.4, 0, 0.214, 0.128],
        [0, 0.46, -0.004, 0.17, 0.112],
        [0, 0.51, -0.01, 0.1, 0.082],
      ],
      (i, s) => ((i + s) % 2 ? STEEL : STEEL_D),
      22,
      { capBot: false, capTop: false },
    );
    g.set({ id: b.next(), em, spec: 0.3 });
    g.loft(
      [
        [0, 0.24, 0.002, 0.23, 0.15],
        [0, 0.265, 0.002, 0.23, 0.15],
      ],
      trim,
      14,
      { capBot: false, capTop: false },
    );
    g.set({ em: 0, spec: 0 });
  });
}

/** 도사의 재 강철 가슴판과 뒷깃 */
function ashBreastplate(b: Body, ember: Hex) {
  const id = b.next();
  b.on('chest', (g) => {
    g.set({ id, spec: 0.65 });
    g.loft(
      [
        [0, 0.06, 0.004, 0.168, 0.124],
        [0, 0.22, 0.01, 0.192, 0.138],
        [0, 0.36, 0.008, 0.21, 0.14],
        [0, 0.44, 0, 0.19, 0.118],
      ],
      (i, s) => (s % 2 ? ASH_L : tone(ASH_L, i === 1 ? 0.76 : 0.9)),
      12,
      { capBot: true, capTop: true },
    );
    g.set({ id: b.next(), em: 0.85, spec: 0 });
    g.box(0, 0.26, 0.15, 0.016, 0.3, 0.014, ember);
    g.box(0, 0.095, 0.132, 0.18, 0.016, 0.014, ember);
    g.set({ em: 0, id: b.next(), spec: 0.4 });
    // 높은 뒷깃
    g.box(0, 0.58, -0.12, 0.3, 0.2, 0.02, ASH_L, 0.004);
    for (const s of [-1, 1]) g.box(s * 0.16, 0.56, -0.05, 0.02, 0.16, 0.14, ASH, 0.004);
    g.set({ spec: 0 });
  });
}

function ribbons(b: Body, name: string, parent: string, x: number, y: number, z: number, col: Hex, n = 3, len = 0.13) {
  const id = b.next();
  addChain(b, parent, name, x, y, z, n, len, (g, i, L) => {
    g.set({ id, wind: 0.5 });
    g.box(0, -L / 2, 0, 0.042 - i * 0.006, L + 0.01, 0.01, tone(col, i % 2 ? 0.86 : 1));
    g.set({ wind: 0 });
  }, 0.26, 18);
}

function dressMusa(b: Body, L: Look, w: WornPiece | undefined, skin: Hex) {
  if (!w) return bareClothes(b, skin);
  const trim = tint(L.trim, w);
  const em = trimGlow(w);
  if (w.tier <= 1) {
    torso(b, { col: L.coat, collar: 0xe9e2d0, dark: L.under, shell: quilted(L.coat) });
    pelvis(b, L.pants);
    belt(b, 0x2c221c);
    skirtPanels(b, { n: 8, len: 0.42, col: L.coat, trim, trimEm: em, flare: 0.1, alt: tone(L.coat, 0.88) });
    arms(b, { sleeve: L.under, cuff: L.under, skin });
  } else if (w.tier === 2) {
    torso(b, { col: STEEL, collar: trim, collarEm: em, dark: L.under, shell: (g, R) => mail(R, g) });
    tabard(b, w.rarity >= 2 ? mix(L.coat, RARE[w.rarity], 0.4) : L.coat, trim, em);
    pauldrons(b, STEEL_D, trim);
    pelvis(b, L.pants);
    belt(b, 0x2c221c, trim);
    skirtPanels(b, { n: 8, len: 0.5, col: STEEL_D, alt: STEEL, ribs: tone(STEEL_D, 0.62), ribN: 3, trim, trimEm: em, flare: 0.08 });
    arms(b, { sleeve: STEEL, cuff: L.under, skin, bracer: 0x585c66, pat: (i, s) => ((i + s) % 2 ? STEEL : STEEL_D) });
  } else {
    const ember = tint(EMBER, w);
    torso(b, { col: ASH, collar: ember, collarEm: Math.max(0.7, em), dark: ASH_L, shell: (g, R) => lamellar(R, g, ASH_L, ASH) });
    tabard(b, L.coat, ember, Math.max(0.6, em));
    bigPauldrons(b, ember, em);
    pelvis(b, ASH);
    belt(b, ASH_L, ember);
    skirtPanels(b, { n: 10, len: 0.68, col: ASH, alt: ASH_L, ribs: tone(ASH, 0.55), ribN: 3, trim: ember, trimEm: Math.max(0.85, em), flare: 0.1, widthK: 1.2 });
    arms(b, { sleeve: ASH_L, cuff: ASH, skin, bracer: ASH_L, bracerEm: ember });
    cape(b, L.coat, ember, Math.max(0.5, em));
  }
}

function dressDosa(b: Body, L: Look, w: WornPiece | undefined, skin: Hex) {
  if (!w) return bareClothes(b, skin);
  const trim = tint(L.trim, w);
  const em = trimGlow(w);
  if (w.tier <= 1) {
    torso(b, { col: L.coat, collar: trim, collarEm: em, dark: L.accent, w: 0.97, shell: quilted(L.coat) });
    pelvis(b, L.pants);
    belt(b, L.accent, undefined, L.accent);
    skirtPanels(b, { n: 10, len: 0.84, col: L.coat, trim, trimEm: em, flare: 0.05, widthK: 1.3, alt: tone(L.coat, 0.9) });
    arms(b, { sleeve: L.coat, cuff: trim, skin, flare: 0.085, cuffEm: em });
  } else if (w.tier === 2) {
    torso(b, { col: L.coat, collar: trim, collarEm: em, dark: L.accent, w: 0.97 });
    mailCapelet(b, trim, em);
    pelvis(b, L.pants);
    belt(b, 0x2c221c, tint(0xc99a44, w), L.accent);
    skirtPanels(b, { n: 10, len: 0.84, col: L.coat, trim, trimEm: em, ribs: tone(L.coat, 0.72), ribN: 1, flare: 0.05, widthK: 1.3, alt: tone(L.coat, 0.88) });
    arms(b, { sleeve: L.coat, cuff: trim, skin, flare: 0.085, cuffEm: em });
  } else {
    const ember = tint(EMBER, w);
    const dark = mix(ASH, L.coat, 0.34);
    torso(b, { col: dark, collar: ember, collarEm: Math.max(0.7, em), dark: ASH_L, w: 0.97 });
    ashBreastplate(b, ember);
    pelvis(b, ASH);
    belt(b, ASH_L, ember);
    skirtPanels(b, { n: 10, len: 0.9, col: dark, alt: tone(dark, 1.3), trim: ember, trimEm: Math.max(0.85, em), flare: 0.07, widthK: 1.3 });
    arms(b, { sleeve: dark, cuff: ember, skin, flare: 0.1, cuffEm: Math.max(0.85, em) });
    ribbons(b, 'sashA', 'hips', 0.09, 0.02, 0.11, L.accent, 4, 0.15);
    ribbons(b, 'sashB', 'hips', -0.09, 0.02, 0.11, L.accent, 4, 0.15);
  }
}

function dressGungsa(b: Body, L: Look, w: WornPiece | undefined, skin: Hex) {
  if (!w) return bareClothes(b, skin);
  const trim = tint(L.trim, w);
  const em = trimGlow(w);
  if (w.tier <= 1) {
    torso(b, { col: L.coat, collar: 0xe4dcc8, dark: L.vest, w: 0.97, shell: quilted(L.coat) });
    vest(b, L, L.vest, L.coat, em, trim);
    pelvis(b, L.pants);
    belt(b, 0x3a2a20, trim);
    skirtPanels(b, { n: 8, len: 0.42, col: L.coat, trim, trimEm: em, flare: 0.09, alt: tone(L.coat, 0.88) });
    arms(b, { sleeve: L.coat, cuff: L.vest, skin, bracer: 0x54392a });
  } else if (w.tier === 2) {
    torso(b, { col: STEEL, collar: 0xe4dcc8, dark: L.vest, w: 0.97, shell: (g, R) => mail(R, g) });
    vest(b, L, L.vest, STEEL_D, em, trim);
    pauldrons(b, STEEL_D, trim);
    pelvis(b, L.pants);
    belt(b, 0x3a2a20, trim);
    skirtPanels(b, { n: 8, len: 0.44, col: L.coat, alt: tone(L.coat, 0.84), ribs: STEEL_D, ribN: 2, trim, trimEm: em, flare: 0.09 });
    arms(b, { sleeve: L.coat, cuff: L.vest, skin, bracer: 0x6a7078, pat: (i, s) => ((i + s) % 2 ? STEEL : STEEL_D) });
  } else {
    const ember = tint(EMBER, w);
    torso(b, { col: ASH, collar: ember, collarEm: Math.max(0.7, em), dark: ASH_L, w: 0.97, shell: (g, R) => lamellar(R, g, ASH_L, ASH) });
    vest(b, L, mix(ASH_L, L.vest, 0.6), ASH, Math.max(0.85, em), ember);
    bigPauldrons(b, ember, em, [1]);
    pelvis(b, ASH);
    belt(b, ASH_L, ember);
    skirtPanels(b, { n: 8, len: 0.54, col: ASH, alt: ASH_L, ribs: tone(ASH, 0.55), ribN: 2, trim: ember, trimEm: Math.max(0.85, em), flare: 0.1 });
    arms(b, { sleeve: ASH_L, cuff: ASH, skin, bracer: ASH_L, bracerEm: ember });
  }
}

/** 갑옷을 벗으면 흰 저고리와 바지만 남는다 */
function bareClothes(b: Body, skin: Hex) {
  torso(b, { col: BARE, collar: 0xd6cfbc, dark: 0xb0a890, w: 0.96 });
  pelvis(b, 0xd8d2c4);
  belt(b, 0x9c8a60);
  arms(b, { sleeve: BARE, cuff: BARE, skin });
}

// ─── 신 ───────────────────────────────────────

function footwear(b: Body, L: Look, w: WornPiece | undefined, pants: Hex, skin: Hex) {
  if (!w) {
    // 맨발
    legs(b, { pants, wrap: pants, boot: skin, sole: tone(skin, 0.8) });
    return;
  }
  const trim = tint(L.trim, w);
  const em = trimGlow(w);
  if (w.tier <= 1) {
    // 버선에 짚신, 행전을 맨 다리
    legs(b, { pants, wrap: 0xd8cfb8, boot: BARE, sole: 0xb79a58, strap: 0x8a7a5a });
    for (const side of ['L', 'R']) {
      const id = b.next();
      b.on(`foot${side}`, (g) => {
        g.set({ id });
        g.box(0, -0.042, 0.09, 0.105, 0.016, 0.03, 0x9c8a50);
        g.box(0, -0.048, 0.02, 0.105, 0.016, 0.03, 0x9c8a50);
      });
    }
    return;
  }
  if (w.tier === 2) {
    // 무릎까지 오는 가죽 장화
    const boot = 0x6b4228;
    legs(b, { pants, wrap: boot, boot, sole: 0x1e1612, strap: trim });
    for (const side of ['L', 'R']) {
      const id = b.next();
      b.on(`shin${side}`, (g) => {
        g.set({ id, em });
        g.loft(
          [
            [0, -DIMS.shin * 0.36, -0.006, 0.082, 0.088],
            [0, -DIMS.shin * 0.22, -0.004, 0.084, 0.09],
          ],
          mix(trim, 0x8a4a2e, 0.5),
          8,
        );
        g.set({ em: 0 });
      });
    }
    return;
  }
  // 바람 신발: 푸른빛이 돌고 끈이 날린다
  const pale = tint(0xcfe4ee, w);
  legs(b, { pants, wrap: tone(pale, 0.82), boot: pale, sole: 0x5f8296, strap: 0xeef8ff });
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const id = b.next();
    b.on(`foot${side}`, (g) => {
      g.set({ id, em: Math.max(0.8, em) });
      g.loft(
        [
          [0, 0.0, -0.004, 0.056, 0.076],
          [0, 0.018, -0.004, 0.056, 0.076],
        ],
        tint(0x9fe8ff, w),
        8,
        { capBot: false, capTop: false },
      );
      g.set({ em: 0, id: b.next() });
      // 뒤꿈치 날개
      g.tube([v3(s * 0.05, -0.02, -0.05), v3(s * 0.1, 0.04, -0.13), v3(s * 0.12, 0.13, -0.2)], [0.024, 0.016, 0.002], 0xeef8ff, 3);
    });
    ribbons(b, `wind${side}`, `shin${side}`, s * 0.04, -DIMS.shin * 0.82, -0.05, tint(0x9fe8ff, w), 3, 0.11);
  }
}

// ─── 반지와 목걸이 ───────────────────────────

function ring(b: Body, w: WornPiece) {
  const gem = w.tier >= 2 ? 0xffb030 : 0xe0824a;
  const band = w.tier >= 2 ? 0xd2a24a : 0xb06a3a;
  const id = b.next();
  b.on('handR', (g) => {
    g.set({ id, spec: 0.9 });
    // 작아서 손가락에 끼운 것처럼만 그리면 보이지 않는다. 손목 끈과 큰 보석으로 읽히게 한다
    g.loft(
      [
        [0, -0.012, 0, 0.044, 0.044],
        [0, 0.008, 0, 0.044, 0.044],
      ],
      band,
      6,
      { capBot: false, capTop: false },
    );
    g.set({ id: b.next(), spec: 0.6, em: Math.max(w.tier >= 2 ? 0.9 : 0.55, GLOW[w.glow]) });
    g.box(0, -0.05, 0.046, 0.05, 0.05, 0.024, tint(gem, w), 0.006);
    g.set({ em: 0, spec: 0 });
  });
}

function amulet(b: Body, w: WornPiece) {
  const R = torsoRings();
  const big = w.tier >= 2;
  const col = tint(big ? 0xbfe4ff : 0xffc060, w);
  const z = torsoFront(R, 0.34, 0) + 0.018;
  const id = b.next();
  b.on('chest', (g) => {
    g.set({ id, spec: 0.5 });
    for (const s of [-1, 1]) g.tube([v3(s * 0.08, 0.49, 0.03), v3(s * 0.058, 0.43, 0.1), v3(0, 0.355, z)], 0.007, big ? 0xd2a24a : 0x4a3626, 3);
    if (big) {
      // 구슬을 꿴 줄
      g.set({ id: b.next(), spec: 0.8, em: 0.35 });
      for (let i = 0; i < 6; i++) {
        const t = (i + 0.5) / 6;
        const s = i < 3 ? -1 : 1;
        const q = i < 3 ? t * 2 : (1 - t) * 2;
        g.box(s * 0.08 * (1 - q), 0.49 - 0.135 * q, 0.04 + (z - 0.04) * q, 0.02, 0.02, 0.02, 0xe8d8a8);
      }
      g.set({ em: 0, spec: 0 });
    }
  });
  addChain(b, 'chest', 'amulet', 0, 0.355, z, 1, 0.06, (g) => {
    const s = big ? 1.5 : 1;
    g.set({ id: b.next(), spec: 0.7 });
    g.box(0, -0.018, 0, 0.056 * s, 0.012, 0.03, big ? 0xd2a24a : 0x4a3626);
    g.set({ id: b.next(), em: Math.max(big ? 1 : 0.85, GLOW[w.glow]), spec: 0 });
    g.loft(
      [
        [0, -0.09 * s, 0, 0.014 * s, 0.014 * s],
        [0, -0.058 * s, 0, 0.03 * s, 0.03 * s],
        [0, -0.024, 0, 0.022 * s, 0.022 * s],
      ],
      col,
      6,
    );
    g.set({ em: 0 });
  }, 0, 26);
}

// ─── 무기 ─────────────────────────────────────

interface SwordDef {
  L: number;
  w: number;
  curve: number;
  blade: Hex;
  guard: Hex;
  grip: Hex;
  guardR: number;
  /** 기본 빛 */
  em: number;
  glow: Hex;
  moss?: boolean;
  lamp?: boolean;
}

const SWORDS: Record<number, SwordDef> = {
  // 견습 장검: 짧고 무딘 쇠, 나무 코등이
  1: { L: 0.64, w: 0.032, curve: -0.04, blade: 0xa2a8ae, guard: 0x6b4a30, grip: 0x4a3222, guardR: 0.042, em: 0, glow: 0xfff0c0 },
  // 철날 장검: 잘 벼린 환도
  2: { L: 0.88, w: 0.04, curve: -0.09, blade: 0xdce4ee, guard: 0xc99a44, grip: 0x3b2420, guardR: 0.056, em: 0, glow: 0xfff0c0 },
  // 이끼왕의 검: 이끼 낀 돌날에 푸른빛
  3: { L: 1.04, w: 0.056, curve: -0.13, blade: 0x7fae8a, guard: 0x4a5a30, grip: 0x3b2a1c, guardR: 0.076, em: 0.45, glow: MOSS, moss: true },
  // 청등 대도: 넓고 긴 날, 푸른 불꽃, 자루 끝의 등불
  4: { L: 1.34, w: 0.09, curve: -0.02, blade: 0xb6cbe8, guard: 0x2c3448, grip: 0x1c1c28, guardR: 0.11, em: 0.7, glow: WARDEN, lamp: true },
};

function sword(b: Body, w: WornPiece) {
  const d = SWORDS[w.tier] ?? SWORDS[1];
  const glowCol = w.rarity ? RARE[w.rarity] : d.glow;
  const edgeEm = Math.max(d.em, GLOW[w.glow], w.rarity ? 0.45 : 0);
  const edge = edgeEm > 0 ? mix(tone(d.blade, 1.12), glowCol, 0.85) : tone(d.blade, 1.12);
  const blade = w.glow > 0 ? mix(d.blade, glowCol, 0.25 + w.glow * 0.2) : d.blade;
  const id = b.next();
  // 낮은 해상도에서 칼날이 선으로만 보이지 않게 넓은 면을 바깥으로 돌려 쥔다
  b.on('gripR', (g) => g.rotZ(0.85, () => {
    const n = 8;
    const seg = (t: number) => ({ z: 0.1 + t * d.L, y: d.curve * t * t, w: d.w * (1 - t ** 5 * 0.85) });
    for (let i = 0; i < n; i++) {
      const a = seg(i / n);
      const c = seg((i + 1) / n);
      const eA = v3(0, a.y + a.w, a.z);
      const eB = v3(0, c.y + c.w, c.z);
      const bA = v3(0, a.y - a.w, a.z);
      const bB = v3(0, c.y - c.w, c.z);
      const t = 0.008 + d.w * 0.5;
      const mA = v3(t, a.y - a.w * 0.2, a.z);
      const mB = v3(t, c.y - c.w * 0.2, c.z);
      const mC = v3(-t, a.y - a.w * 0.2, a.z);
      const mD = v3(-t, c.y - c.w * 0.2, c.z);
      g.set({ id, spec: 1, em: edgeEm });
      g.quad(eA, eB, mB, mA, edge);
      g.quad(eB, eA, mC, mD, edge);
      g.set({ em: w.glow > 0 ? 0.4 + w.glow * 0.2 : edgeEm * 0.2 });
      g.quad(mA, mB, bB, bA, blade);
      g.quad(mD, mC, bA, bB, blade);
    }
    // +4부터 칼날을 따라 빛의 날이 하나 더 선다. +7, +10에서 커진다
    if (w.glow >= 1) {
      g.set({ id, spec: 0, em: 1, wind: w.glow >= 3 ? 0.3 : 0 });
      const ex = 0.026 * [0, 1, 2, 3.6][w.glow];
      for (let i = 0; i < n; i++) {
        const a = seg(i / n);
        const c = seg((i + 1) / n);
        const zz = (a.z + c.z) / 2;
        const len = c.z - a.z + 0.004;
        g.box(0, (a.y + a.w + c.y + c.w) / 2 + ex / 2, zz, 0.012, ex, len, glowCol);
        if (w.glow >= 2) g.box(0, (a.y - a.w + c.y - c.w) / 2 - ex / 2, zz, 0.012, ex, len, glowCol);
        // +10: 불꽃처럼 일어나는 조각
        if (w.glow >= 3 && i % 2 === 0) {
          g.box(0, (a.y + a.w) + ex * 1.5, zz, 0.012, ex * 0.8, len * 0.5, tone(glowCol, 1.3));
          g.box(0, (a.y - a.w) - ex * 1.5, zz + len * 0.4, 0.012, ex * 0.8, len * 0.5, tone(glowCol, 1.3));
        }
      }
      g.set({ wind: 0 });
    }
    // 코등이
    g.set({ id: b.next(), spec: 0.8, em: 0 });
    g.rotX(Math.PI / 2, () => g.loft([[0, -0.1, 0, d.guardR, d.guardR * 0.74], [0, -0.085, 0, d.guardR, d.guardR * 0.74]], d.guard, 8));
    g.set({ id: b.next(), spec: 0 });
    g.tube([v3(0, 0, -0.1), v3(0, 0, 0.09)], 0.022, (_i, s) => (s % 2 ? d.grip : tone(d.grip, 1.4)), 5);
    g.set({ id: b.next(), spec: 0.8 });
    g.rock(0, 0, -0.115, 0.024, 0.024, 0.024, d.guard, 3, 0, 0);
    if (d.moss) {
      g.set({ id: b.next(), spec: 0 });
      g.rock(0.02, 0.05, 0.13, 0.04, 0.032, 0.05, 0x4e6e30, 5, 0.22, 0);
      g.rock(-0.02, -0.04, 0.26, 0.032, 0.026, 0.042, 0x5c7a34, 7, 0.22, 0);
      g.rock(0.01, 0.03, 0.5, 0.026, 0.02, 0.036, 0x4e6e30, 9, 0.22, 0);
    }
    if (d.lamp) {
      g.set({ id: b.next(), em: 1, spec: 0 });
      g.loft(
        [
          [0, -0.26, 0, 0.018, 0.018],
          [0, -0.22, 0, 0.042, 0.042],
          [0, -0.16, 0, 0.042, 0.042],
          [0, -0.13, 0, 0.018, 0.018],
        ].map((r) => [r[0], r[2], r[1], r[3], r[4]]),
        WARDEN,
        6,
      );
      g.set({ em: 0 });
    }
    g.set({ spec: 0 });
  }));
}

function roundShield(b: Body, L: Look, tier: number, glow: number) {
  const P =
    tier <= 1
      ? { face: 0x6e4c30, ring: 0x5a3c26, rim: 0x3e2c20, boss: 0x6a6f7a, R: 0.23, em: 0 }
      : tier === 2
        ? { face: L.shield, ring: L.ring, rim: 0x8a8e96, boss: L.trim, R: 0.26, em: 0 }
        : tier === 3
          ? { face: 0x4a5a38, ring: 0x364428, rim: 0x6a5a3a, boss: MOSS, R: 0.27, em: 0.7 }
          : { face: 0x242a3a, ring: 0x3a4258, rim: 0x9fb0c8, boss: WARDEN, R: 0.3, em: 0.9 };
  const { R } = P;
  const id = b.next();
  b.on('gripL', (g) => {
    g.move(0, 0, 0.055, () => {
      g.rotX(Math.PI / 2, () => {
        g.set({ id, spec: 0.15 });
        g.loft(
          [
            [0, -0.03, 0, R * 0.98, R * 0.98],
            [0, 0.005, 0, R * 0.92, R * 0.92],
            [0, 0.03, 0, R * 0.64, R * 0.64],
            [0, 0.05, 0, R * 0.26, R * 0.26],
          ],
          (i, s) => (i === 0 ? tone(P.face, 0.9) : i === 1 ? (s % 4 === 0 ? tone(P.ring, 1.1) : P.ring) : s % 4 === 0 ? tone(P.face, 1.12) : P.face),
          16,
          { capBot: true },
        );
        g.set({ id: b.next(), spec: 0.8 });
        g.loft(
          [
            [0, -0.04, 0, R, R],
            [0, 0.012, 0, R, R],
            [0, 0.018, 0, R * 0.95, R * 0.95],
          ],
          P.rim,
          16,
          { capBot: false, capTop: false },
        );
        g.set({ id: b.next(), spec: 0.9, em: Math.max(P.em, GLOW[glow]) });
        g.loft(
          [
            [0, 0.05, 0, 0.09, 0.09],
            [0, 0.085, 0, 0.066, 0.066],
            [0, 0.095, 0, 0.02, 0.02],
          ],
          P.boss,
          8,
        );
        g.set({ spec: 0, em: 0 });
      });
    });
  });
}

function lampFlame(b: Body, bone: string, y: number, top: number, o: { s: number; frame: Hex; flame: Hex; core: Hex; em: number; band: Hex }) {
  const { s } = o;
  const id = b.next();
  addChain(b, bone, 'lamp', 0, y, top, 1, 0.1, (g) => {
    g.set({ id });
    g.box(0, -0.03, 0, 0.008, 0.07, 0.008, 0x201610);
    g.set({ id: b.next(), spec: 0.5 });
    g.loft([[0, -0.075 * s, 0, 0.055 * s, 0.055 * s], [0, -0.055 * s, 0, 0.03 * s, 0.03 * s]], o.frame, 6);
    g.set({ id: b.next(), em: o.em, spec: 0 });
    g.loft(
      [
        [0, -0.235 * s, 0, 0.055 * s, 0.055 * s],
        [0, -0.18 * s, 0, 0.09 * s, 0.09 * s],
        [0, -0.12 * s, 0, 0.09 * s, 0.09 * s],
        [0, -0.075 * s, 0, 0.055 * s, 0.055 * s],
      ],
      (i) => (i === 1 ? o.core : o.flame),
      8,
      { flat: false },
    );
    g.set({ id: b.next(), em: o.em * 0.7, spec: 0.3 });
    g.loft([[0, -0.245 * s, 0, 0.058 * s, 0.058 * s], [0, -0.215 * s, 0, 0.066 * s, 0.066 * s]], o.band, 8);
    g.set({ em: 0, spec: 0 });
  }, 0, 18);
}

function staff(b: Body, w: WornPiece) {
  const bone = 'gripR';
  const glowCol = w.rarity ? RARE[w.rarity] : 0xffd890;
  const ringEm = Math.max(GLOW[w.glow], w.rarity ? 0.4 : 0);
  const id = b.next();
  if (w.tier <= 1) {
    // 등잔 지팡이: 곧은 막대에 작은 등잔
    const top = 0.84;
    b.on(bone, (g) => {
      g.set({ id });
      g.tube([v3(0, 0, -0.56), v3(0, 0, 0), v3(0.003, 0, top)], [0.016, 0.02, 0.022], (_i, s) => (s % 2 ? 0x7a5636 : 0x8d6a44), 5);
      g.set({ id: b.next() });
      g.box(0, 0, top + 0.012, 0.09, 0.09, 0.024, 0x5a4230);
      g.set({ id: b.next(), em: 1 });
      g.loft(
        [
          [0, top + 0.02, 0, 0.026, 0.026],
          [0, top + 0.06, 0, 0.018, 0.018],
          [0, top + 0.1, 0, 0.002, 0.002],
        ].map((r) => [r[0], r[2], r[1], r[3], r[4]]),
        0xffc060,
        5,
      );
      g.set({ em: 0 });
    });
    return ringFx(b, bone, top + 0.05, w, ringEm, glowCol);
  }
  if (w.tier === 2) {
    // 구리 지팡이: 구부러진 끝에 초롱
    const top = 1.0;
    b.on(bone, (g) => {
      g.set({ id });
      g.tube([v3(0, 0, -0.62), v3(0, 0, 0), v3(0.004, 0, top * 0.5), v3(-0.004, 0, top)], [0.018, 0.024, 0.026, 0.03], (_i, s) => (s % 2 ? 0x5e3d28 : 0x6e4a30), 5);
      g.tube([v3(-0.004, 0, top), v3(0, 0.04, top + 0.1), v3(0, 0.14, top + 0.14), v3(0, 0.22, top + 0.07)], [0.028, 0.022, 0.018, 0.014], 0x5e3d28, 5);
      g.set({ id: b.next(), spec: 0.9 });
      for (const z of [0.3, 0.72, 0.9]) g.tube([v3(0, 0, top * z - 0.03), v3(0, 0, top * z + 0.03)], 0.033, 0xd07c44, 5);
      g.set({ spec: 0 });
    });
    lampFlame(b, bone, 0.22, top + 0.06, { s: 1, frame: 0x8a4e2c, flame: 0xffb65a, core: 0xffe6a8, em: 1, band: 0xd07c44 });
    return ringFx(b, bone, top + 0.02, w, ringEm, glowCol);
  }
  if (w.tier === 3) {
    // 이끼왕의 가지: 굽은 가지와 이끼, 가지 사이에 맺힌 푸른 빛
    const top = 1.12;
    const bark = (_i: number, s: number) => (s % 2 ? 0x46392a : 0x564836);
    b.on(bone, (g) => {
      g.set({ id });
      g.tube([v3(0.03, 0, -0.62), v3(-0.03, 0.02, -0.1), v3(0.03, -0.02, 0.4), v3(-0.03, 0.02, 0.8), v3(0, 0, top)], [0.018, 0.026, 0.03, 0.03, 0.036], bark, 5);
      for (const [x, y] of [[0.13, 0.05], [-0.12, 0.08], [0.02, 0.15], [0.04, -0.13]] as const) g.tube([v3(0, 0, top - 0.1), v3(x * 0.6, y * 0.6, top + 0.06), v3(x, y, top + 0.26)], [0.026, 0.016, 0.004], bark, 4);
      g.set({ id: b.next() });
      g.rock(0.03, 0.03, 0.42, 0.05, 0.044, 0.09, 0x4e6e30, 5, 0.22, 0);
      g.rock(-0.03, -0.02, 0.8, 0.046, 0.04, 0.08, 0x5c7a34, 6, 0.22, 0);
      g.rock(0, 0, top - 0.02, 0.06, 0.05, 0.05, 0x4e6e30, 7, 0.22, 0);
      g.set({ id: b.next(), em: 1 });
      g.rock(0, 0.01, top + 0.17, 0.07, 0.07, 0.07, MOSS, 3, 0.06, 1);
      g.set({ em: 0 });
    });
    return ringFx(b, bone, top + 0.17, w, ringEm, glowCol);
  }
  // 꺼지지 않는 등잔: 키 큰 검은 자루, 금테, 큰 등불
  const top = 1.28;
  b.on(bone, (g) => {
    g.set({ id, spec: 0.3 });
    g.tube([v3(0, 0, -0.7), v3(0, 0, 0), v3(0, 0, top)], [0.02, 0.026, 0.03], (_i, s) => (s % 2 ? 0x22202a : 0x2e2c38), 6);
    g.tube([v3(0, 0, top), v3(0, 0.07, top + 0.13), v3(0, 0.2, top + 0.18), v3(0, 0.34, top + 0.1)], [0.03, 0.024, 0.02, 0.016], 0x2e2c38, 5);
    g.set({ id: b.next(), spec: 1 });
    for (const z of [-0.5, 0.2, 0.62, 1.0, 1.2]) g.tube([v3(0, 0, z - 0.024), v3(0, 0, z + 0.024)], 0.036, 0xe0b45a, 6);
    g.set({ spec: 0 });
  });
  lampFlame(b, bone, 0.34, top + 0.1, { s: 1.5, frame: 0xe0b45a, flame: 0xffd27a, core: 0xfff4d0, em: 1, band: 0xe0b45a });
  ringFx(b, bone, top + 0.0, w, ringEm, glowCol);
}

/** 지팡이 머리에 뜬 빛 고리. 등급·강화가 높을수록 많아진다 */
function ringFx(b: Body, bone: string, z: number, w: WornPiece, em: number, col: Hex) {
  if (em <= 0) return;
  const n = w.glow >= 3 ? 3 : w.glow >= 2 ? 2 : 1;
  const id = b.next();
  b.on(bone, (g) => {
    g.set({ id, em: Math.max(0.7, em) });
    for (let k = 0; k < n; k++) {
      const r = 0.15 + k * 0.07;
      const zz = z + k * 0.12 - 0.05;
      const seg = 14;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        g.box(Math.cos(a) * r, Math.sin(a) * r, zz, 0.03, 0.03, 0.03, col);
      }
    }
    g.set({ em: 0 });
  });
}

interface BowDef {
  H: number;
  wood: Hex;
  wrap: Hex;
  r: number;
  moss?: boolean;
  tip?: Hex;
  string?: Hex;
}

const BOWS: Record<number, BowDef> = {
  // 사냥꾼의 활: 짧고 매끈한 나무 활
  1: { H: 0.52, wood: 0x7a5636, wrap: 0x3e2c20, r: 0.02 },
  // 곡궁: 끝이 젖혀진 각궁
  2: { H: 0.62, wood: 0x45302a, wrap: 0x9c4a30, r: 0.024 },
  // 이끼왕의 활: 덩굴이 감기고 끝이 푸르게 빛난다
  3: { H: 0.7, wood: 0x4a5a38, wrap: 0x2c3820, r: 0.028, moss: true, tip: MOSS, string: 0xc8ffd0 },
  // 새벽 활: 크고 흰 활, 금 장식, 새벽빛 시위
  4: { H: 0.82, wood: 0xe8dcc0, wrap: 0xd8a04a, r: 0.03, tip: 0xffc8a0, string: 0xffe0c0 },
};

function bow(b: Body, L: Look, w: WornPiece) {
  const d = BOWS[w.tier] ?? BOWS[1];
  const id = b.next();
  const pts: THREE.Vector3[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = -1 + (2 * i) / N;
    const z = -0.17 * t * t + 0.07 * t ** 4 + 0.02;
    pts.push(v3(0, t * d.H, z));
  }
  const glowCol = w.rarity ? RARE[w.rarity] : d.tip ?? 0xfff0c0;
  const em = Math.max(GLOW[w.glow], w.rarity ? 0.3 : 0);
  b.on('gripL', (g) => {
    g.set({ id, spec: w.tier >= 4 ? 0.6 : 0.18 });
    g.tube(pts, pts.map((_, i) => d.r - Math.abs(i - N / 2) * (d.r * 0.066)), (i) => (Math.abs(i - N / 2) < 1.5 ? d.wrap : i % 2 ? d.wood : tone(d.wood, 1.3)), 5);
    if (d.moss) {
      g.set({ id: b.next(), spec: 0 });
      for (const i of [3, 11]) g.rock(pts[i].x, pts[i].y, pts[i].z, 0.04, 0.05, 0.04, 0x4e6e30, i, 0.22, 0);
    }
    if (w.tier >= 4) {
      // 날개처럼 벌어진 금 장식
      g.set({ id: b.next(), spec: 1 });
      for (const i of [4, 10]) g.tube([pts[i], v3(0, pts[i].y * 1.06, pts[i].z + 0.1)], [0.022, 0.003], d.wrap, 3);
    }
    if (d.tip !== undefined || em > 0) {
      g.set({ id: b.next(), em: Math.max(d.tip !== undefined ? 0.85 : 0, em), spec: 0 });
      for (const i of [0, N]) g.rock(pts[i].x, pts[i].y, pts[i].z, 0.03, 0.03, 0.03, glowCol, i + 2, 0.08, 0);
    }
    if (w.glow >= 1) {
      g.set({ id: b.next(), em: 1 });
      const thick = 0.012 + w.glow * 0.012;
      for (let i = 0; i < N; i++) g.box(pts[i].x, (pts[i].y + pts[i + 1].y) / 2, (pts[i].z + pts[i + 1].z) / 2 - d.r, thick, Math.abs(pts[i + 1].y - pts[i].y) + 0.004, thick, glowCol);
    }
    g.set({ em: 0, spec: 0 });
  });
  // 화살통
  const qid = b.next();
  b.on('chest', (g) => {
    g.set({ id: qid });
    g.at(new THREE.Matrix4().makeRotationZ(-0.42).premultiply(new THREE.Matrix4().makeTranslation(0.03, 0.22, -0.15)), () => {
      g.loft(
        [
          [0, -0.2, 0, 0.05, 0.05],
          [0, 0.2, 0, 0.06, 0.06],
        ],
        (_i, s) => (s % 2 ? 0x5a3a26 : 0x6b4730),
        7,
      );
      g.set({ id: b.next(), spec: 0.6 });
      g.loft([[0, 0.16, 0, 0.062, 0.062], [0, 0.2, 0, 0.062, 0.062]], L.trim, 7);
      g.set({ id: b.next(), spec: 0 });
      for (const [x, z, c] of [[-0.022, 0.012, 0xe8e2d0], [0.022, -0.014, L.accent], [0, 0.024, 0xe8e2d0], [0.026, 0.022, L.accent]] as const) {
        g.box(x, 0.28, z, 0.01, 0.18, 0.01, 0xc8ad78);
        g.box(x, 0.36, z, 0.038, 0.08, 0.008, c);
      }
    });
  });
  return { H: d.H, string: d.string, em: d.string !== undefined ? 0.6 : 0.2 };
}

// ─── 조립 ─────────────────────────────────────

function buildPc(cls: Cls, look: string, worn: Worn): Build {
  const L = LOOKS[cls][look];
  const skin = SKINS[L.skin];
  const b = new Body();
  head(b, skin, { brow: L.hair === 0xd8d4cc ? 0x8a8680 : L.hair, blush: !!L.female, lash: !!L.female });
  hair(b, cls, L, !!worn.helm);
  if (worn.helm) helmet(b, cls, L, worn.helm);
  if (cls === 'musa') dressMusa(b, L, worn.armor, skin);
  else if (cls === 'dosa') dressDosa(b, L, worn.armor, skin);
  else dressGungsa(b, L, worn.armor, skin);
  const pants = worn.armor ? (worn.armor.tier >= 3 ? tone(L.pants, 0.72) : L.pants) : 0xd8d2c4;
  footwear(b, L, worn.boots, pants, skin);
  if (worn.ring) ring(b, worn.ring);
  if (worn.amulet) amulet(b, worn.amulet);
  let bowInfo: Build['bow'];
  const w = worn.weapon;
  if (cls === 'musa') {
    if (w) sword(b, w);
    // 방패는 막기의 일부라 늘 든다. 무기 단계에 맞춰 좋아진다
    roundShield(b, L, w?.tier ?? 1, w?.glow ?? 0);
  } else if (cls === 'dosa') {
    if (w) staff(b, w);
  } else if (w) {
    bowInfo = bow(b, L, w);
  }
  const anims = cls === 'musa' ? musaAnims() : cls === 'dosa' ? dosaAnims() : gungsaAnims();
  return { body: b, anims, bow: bowInfo };
}

const STARTER: Record<Cls, string> = {
  musa: 'hwando_1.0.0,,gabot_1.0.0,,,',
  dosa: 'chorongdae_1.0.0,,gabot_1.0.0,,,',
  gungsa: 'gakgung_1.0.0,,gabot_1.0.0,,,',
};

const cache = new Map<string, CharAsset>();
/** 장비 조합은 많으니 오래 안 쓴 모델은 버린다. 지금 쓰는 모델은 남긴다 */
const KEEP = 48;

function trim() {
  if (cache.size <= KEEP) return;
  for (const [k, a] of cache) {
    if (cache.size <= KEEP) break;
    if ((a.refs ?? 0) > 0) continue;
    a.geometry.dispose();
    cache.delete(k);
  }
}

const rgb = (c: Hex): [number, number, number] => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

/** 끝선(빛나는 테두리): 희귀도 색으로 물들고, 강화·희귀도가 높거나 마지막 단계면 빛난다 */
function edgePick(w: WornPiece, last: number): GearPick {
  const glow = Math.max(trimGlow(w), w.tier >= last ? 0.55 : 0);
  return { name: `g_${w.base}__e`, tint: w.rarity ? rgb(RARE[w.rarity]) : undefined, glow: glow || undefined };
}

/**
 * 블렌더 모델에 붙일 조각.
 * 기본 조각(d_…): 머리띠·갓·상투는 투구를, 기본 신발은 신발을 입으면 빠진다.
 * 장비 조각(g_…): 무기 4단계, 투구·신발 3단계, 갑옷은 2·3단계만(1단계 누비 철릭은 기본 옷).
 */
function gearPicks(worn: Worn): GearPick[] {
  const out: GearPick[] = [];
  if (!worn.helm) out.push({ name: 'd_band' }, { name: 'd_gat' }, { name: 'd_topknot' });
  if (!worn.boots) out.push({ name: 'd_boots' });
  const w = worn.weapon;
  if (w) out.push({ name: `g_${w.base}` }, edgePick(w, 4));
  for (const p of [worn.helm, worn.boots]) if (p) out.push({ name: `g_${p.base}` }, edgePick(p, 3));
  const a = worn.armor;
  if (a && a.tier >= 2) out.push({ name: `g_${a.base}` }, edgePick(a, 3));
  return out;
}

/** 주소에 ?human=old를 붙이면 블렌더 사람 모델 대신 예전 코드 모델을 쓴다 */
const OLD_HUMAN = typeof location !== 'undefined' && new URLSearchParams(location.search).get('human') === 'old';

/** pc_<직업>_<모습>#<gearVisualKey>. 뒤를 생략하면 처음 입는 옷차림이다. old면 블렌더 모델이 있어도 코드 모델 */
export function pcAsset(id: string, old = false): CharAsset | null {
  const m = /^pc_(musa|dosa|gungsa)_([abc])(?:#(.*))?$/.exec(id);
  if (!m) return null;
  // 블렌더 사람 모델: 입은 장비 조각을 몸에 붙인다. 모습(a·b·c)은 아직 한 벌
  if (!old && !OLD_HUMAN && skinnedAsset(`pc_${m[1]}`)) {
    const worn = parseGearKey(m[3] ?? STARTER[m[1] as Cls]);
    return skinnedWithGear(`pc_${m[1]}`, gearPicks(worn));
  }
  const hit = cache.get(id);
  if (hit) {
    // 최근에 쓴 것을 뒤로
    cache.delete(id);
    cache.set(id, hit);
    return hit;
  }
  const cls = m[1] as Cls;
  const worn = parseGearKey(m[3] ?? STARTER[cls]);
  const a = finish(id, buildPc(cls, m[2], worn));
  if ((worn.helm?.tier ?? 0) >= 2) a.height = 2.02;
  cache.set(id, a);
  trim();
  return a;
}
