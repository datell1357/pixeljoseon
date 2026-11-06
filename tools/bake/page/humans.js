// 플레이어 세 직업의 모델과 동작.
import { THREE, D2R, at, group, eg, box, rbox, sph, cyl, cone, tor, bone, lathe, taper, rawMesh, scale, strut } from './kit.js';
import { M, G, GLOW } from './core.js';
import { Human, bakeKeys, walkFrames, STAND } from './rig.js';
import { addFace, addBangs, addLegs, addArms, cap, shell, sword, roundShield, shaft, skinMat } from './parts.js';

export const SKIN = { a: '#f3c8a2', b: '#eebb90', c: '#d9a077' };

// ---------- 공통 동작 조각 ----------
const f = (obj) => obj;

/** 숨쉬기: n프레임 반복. amp 만큼 가슴과 손이 오르내린다 */
export function idleFrames(n, base, amp = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t);
    out.push({
      ...base,
      hy: (base.hy ?? 0) - 0.01 * amp * (1 - c) * 0.5 - 0.004,
      crx: (base.crx ?? 0) + 1.6 * amp * Math.sin(t),
      drx: (base.drx ?? 0) - 1.2 * amp * Math.sin(t),
      Ry: (base.Ry ?? STAND.Ry) - 0.006 * amp * (1 - c),
      Ly: (base.Ly ?? STAND.Ly) - 0.006 * amp * (1 - c),
      c1: (base.c1 ?? STAND.c1) + 2 * Math.sin(t),
      c2: (base.c2 ?? STAND.c2) + 2 * Math.cos(t),
    });
  }
  return out;
}

/** 앞구르기: 몸을 웅크린 공의 중심 (높이 cy, 앞쪽 cz)을 축으로 θ만큼 돈 온몸 오프셋 */
export function rollAt(theta, cy = 0.44, cz = 0.16, dz = -0.12) {
  const t = theta * D2R;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { Prx: theta, Py: cy - (cy * c - cz * s), Pz: cz - (cy * s + cz * c) + dz };
}
/** 뒤로 눕기: 몸을 뒤로 눕히며 몸 중심이 앵커 위에 오게 */
export function fallBack(deg, pz, py) {
  return { Prx: -deg, Pz: pz, Py: py };
}

// ---------- 전사 ----------
const W_STANCE = {
  hy: -0.012, Fz: 0.05, Gz: -0.06, Fx: 0.012, Gx: -0.012, Ga: 8, Fa: 6,
  Ra: -62, Rr: 0.33, Ry: 0.48, Wy: -34, Wp: 62,
  La: 62, Lr: 0.3, Ly: 0.5, Vy: 42, Vp: 0,
  cry: 4, c1: 10, c2: 8,
};
export function warriorAnims() {
  const b = W_STANCE;
  const K = (n, keys, loop = false) => bakeKeys(n, keys, b, loop);
  return {
    idle: { frames: 6, dur: 1.2, loop: true, poses: idleFrames(6, b) },
    walk: {
      frames: 8, dur: 0.64, loop: true,
      poses: walkFrames(8, {
        stride: 0.17, lift: 0.08,
        extra: (ph, c, s) => ({
          Ra: -56 + 14 * c, Rr: 0.33, Ry: 0.46 + 0.015 * Math.cos(2 * ph), Wy: -14, Wp: 24,
          La: 60 - 8 * c, Lr: 0.3, Ly: 0.5 + 0.012 * Math.cos(2 * ph), Vy: 38, Vp: 0,
        }),
      }),
    },
    // 베기: 오른쪽 뒤에서 왼쪽 앞으로 가로지른다
    attack1: {
      frames: 6, dur: 0.32, loop: false,
      poses: K(6, [
        [0, { cry: -22, hry: -8, Ra: -112, Rr: 0.42, Ry: 0.72, Wy: -128, Wp: 16, La: 72, Ly: 0.48, hy: -0.02, Gz: -0.1 }],
        [1, { cry: -36, hry: -14, Ra: -138, Rr: 0.42, Ry: 0.76, Wy: -152, Wp: 22, La: 82, Ly: 0.48, hy: -0.03, Gz: -0.12, c1: 16 }],
        [2, { cry: 8, hry: 2, hz: 0.04, Ra: -22, Rr: 0.5, Ry: 0.68, Wy: -26, Wp: 2, La: 96, Ly: 0.46, hy: -0.04, Fz: 0.14, Gz: -0.12, crx: 7, c1: 28 }],
        [3, { cry: 34, hry: 14, hz: 0.05, Ra: 52, Rr: 0.46, Ry: 0.6, Wy: 66, Wp: -6, La: 118, Lr: 0.26, Ly: 0.44, hy: -0.05, Fz: 0.15, Gz: -0.13, crx: 9, c1: 34, c2: 12 }],
        [4, { cry: 36, hry: 14, hz: 0.04, Ra: 66, Rr: 0.42, Ry: 0.54, Wy: 84, Wp: -14, La: 118, Lr: 0.26, Ly: 0.44, hy: -0.045, Fz: 0.14, Gz: -0.12, crx: 8, c1: 22, c2: 14 }],
        [5, { cry: 16, hry: 6, hz: 0.02, Ra: 8, Rr: 0.36, Ry: 0.5, Wy: 18, Wp: 6, La: 84, Lr: 0.28, Ly: 0.47, hy: -0.025, Fz: 0.09, Gz: -0.09, crx: 3 }],
      ]),
    },
    // 되베기: 왼쪽에서 오른쪽 뒤로 되돌아 벤다
    attack2: {
      frames: 6, dur: 0.32, loop: false,
      poses: K(6, [
        [0, { cry: 28, hry: 10, Ra: 60, Rr: 0.34, Ry: 0.74, Wy: 74, Wp: 18, La: 110, Lr: 0.26, Ly: 0.46, hy: -0.02, Fz: 0.08, Gz: -0.08 }],
        [1, { cry: 40, hry: 16, Ra: 82, Rr: 0.34, Ry: 0.8, Wy: 104, Wp: 24, La: 122, Lr: 0.25, Ly: 0.46, hy: -0.03, Fz: 0.09, Gz: -0.09, c1: 16 }],
        [2, { cry: -6, hry: -4, hz: 0.03, Ra: 2, Rr: 0.5, Ry: 0.66, Wy: 2, Wp: 0, La: 96, Lr: 0.28, Ly: 0.48, hy: -0.045, Fz: 0.05, Gz: -0.15, crx: 6, c1: 30 }],
        [3, { cry: -34, hry: -14, hz: 0.04, Ra: -70, Rr: 0.47, Ry: 0.58, Wy: -80, Wp: -8, La: 62, Lr: 0.3, Ly: 0.5, hy: -0.05, Fz: 0.05, Gz: -0.16, crx: 8, c1: 34, c2: 12 }],
        [4, { cry: -38, hry: -15, hz: 0.03, Ra: -86, Rr: 0.43, Ry: 0.52, Wy: -98, Wp: -14, La: 58, Lr: 0.3, Ly: 0.5, hy: -0.045, Fz: 0.05, Gz: -0.15, crx: 7, c1: 22, c2: 14 }],
        [5, { cry: -14, hry: -6, hz: 0.015, Ra: -66, Rr: 0.36, Ry: 0.48, Wy: -40, Wp: 12, La: 60, Lr: 0.3, Ly: 0.5, hy: -0.025, Fz: 0.05, Gz: -0.09, crx: 2 }],
      ]),
    },
    // 내려치기: 머리 위로 크게 들었다가 땅까지
    attack3: {
      frames: 7, dur: 0.46, loop: false,
      poses: K(7, [
        [0, { cry: -14, crx: -6, Ra: -72, Rr: 0.3, Ry: 0.86, Wy: -34, Wp: 74, La: 56, Lr: 0.3, Ly: 0.58, Vy: 30, hy: -0.025, Fz: 0.03, Gz: -0.08 }],
        [1, { cry: -20, crx: -10, drx: -6, Ra: -80, Rr: 0.27, Ry: 1.02, Wy: -30, Wp: 112, La: 50, Lr: 0.32, Ly: 0.64, Vy: 20, hy: 0.0, Fz: 0.03, Gz: -0.08, c1: 14 }],
        [2, { cry: -22, crx: -13, drx: -7, Ra: -82, Rr: 0.26, Ry: 1.06, Wy: -28, Wp: 128, La: 48, Lr: 0.32, Ly: 0.68, Vy: 16, Py: 0.035, hy: 0.01, Fz: 0.05, Fy: 0.03, Gz: -0.1, c1: 16 }],
        [3, { cry: -2, crx: 10, drx: -2, hz: 0.03, Ra: -10, Rr: 0.42, Ry: 0.84, Wy: -2, Wp: 26, La: 78, Lr: 0.3, Ly: 0.46, Vy: 60, hy: -0.05, Fz: 0.14, Gz: -0.14, c1: 34, c2: 14 }],
        [4, { cry: 6, crx: 18, drx: -6, hz: 0.03, Ra: -6, Rr: 0.38, Ry: 0.36, Wy: 0, Wp: -13, La: 92, Lr: 0.3, Ly: 0.42, Vy: 76, hy: -0.105, Fz: 0.18, Gz: -0.2, c1: 42, c2: 18 }],
        [5, { cry: 6, crx: 17, drx: -6, hz: 0.03, Ra: -6, Rr: 0.38, Ry: 0.34, Wy: 0, Wp: -12, La: 92, Lr: 0.3, Ly: 0.42, Vy: 76, hy: -0.1, Fz: 0.18, Gz: -0.2, c1: 26, c2: 12 }],
        [6, { cry: 2, crx: 8, drx: -2, hz: 0.02, Ra: -30, Rr: 0.4, Ry: 0.42, Wy: -10, Wp: 6, La: 76, Lr: 0.3, Ly: 0.46, Vy: 56, hy: -0.06, Fz: 0.12, Gz: -0.13, c1: 16 }],
      ]),
    },
    // 시전: 검을 높이 치켜들고 기합
    cast: {
      frames: 7, dur: 0.5, loop: false,
      poses: K(7, [
        [0, { hy: -0.03, crx: 8, Ra: -40, Rr: 0.3, Ry: 0.5, Wy: -20, Wp: 30 }],
        [1, { hy: -0.05, crx: 12, drx: 6, Ra: -30, Rr: 0.26, Ry: 0.46, Wy: -14, Wp: 40, La: 64, Ly: 0.46 }],
        [2, { hy: 0, crx: -8, drx: -8, Ra: -82, Rr: 0.27, Ry: 1.0, Wy: -22, Wp: 84, La: 66, Lr: 0.34, Ly: 0.5, c1: 22 }],
        [3, { hy: 0.012, crx: -12, drx: -12, Ra: -84, Rr: 0.26, Ry: 1.06, Wy: -18, Wp: 88, La: 70, Lr: 0.36, Ly: 0.5, c1: 34, c2: 14 }],
        [4, { hy: 0.012, crx: -12, drx: -12, Ra: -84, Rr: 0.26, Ry: 1.06, Wy: -18, Wp: 88, La: 70, Lr: 0.36, Ly: 0.5, c1: 30, c2: 16 }],
        [5, { hy: -0.01, crx: -4, drx: -4, Ra: -78, Rr: 0.28, Ry: 0.92, Wy: -22, Wp: 74, La: 66, Ly: 0.5, c1: 18 }],
        [6, { hy: -0.015, crx: 2, Ra: -46, Rr: 0.3, Ry: 0.58, Wy: -14, Wp: 34 }],
      ]),
    },
    // 팽이 회전베기: 한 바퀴를 6프레임에
    spin: {
      frames: 6, dur: 0.5, loop: false,
      poses: bakeKeys(6, [0, 1, 2, 3, 4, 5].map((i) => [i, {
        Pry: i * 60, hy: -0.045, crx: 6, cry: 8, Fz: 0.1, Gz: -0.1, Fx: 0.03, Gx: -0.03,
        Ra: -92, Rr: 0.38, Ry: 0.66, Wy: -88, Wp: 6, Wr: 30,
        La: 110, Lr: 0.3, Ly: 0.56, Vy: 130, Vp: 0,
        c1: 44, c2: 10,
      }]), b),
    },
    // 앞구르기
    dodge: {
      frames: 6, dur: 0.38, loop: false,
      poses: (() => {
        const tuck = { hy: -0.15, crx: 62, drx: 30, Fy: 0.17, Gy: 0.15, Fz: 0.16, Gz: 0.1, Ra: -44, Rr: 0.2, Ry: 0.3, Wy: -14, Wp: -24, La: 44, Lr: 0.2, Ly: 0.32, Vy: 14, Vp: -12, c1: 6, c2: 4, capeS: 0.62 };
        return [
          { ...b, hy: -0.13, crx: 32, drx: -6, Fz: 0.15, Gz: -0.13, Ra: -44, Rr: 0.3, Ry: 0.34, Wy: -16, Wp: 0, La: 44, Lr: 0.26, Ly: 0.36, c1: 24 },
          { ...b, ...tuck, ...rollAt(60, 0.44, 0.16, -0.24) },
          { ...b, ...tuck, ...rollAt(145) },
          { ...b, ...tuck, ...rollAt(225) },
          { ...b, ...tuck, ...rollAt(305) },
          { ...b, hy: -0.11, crx: 20, drx: -4, Fz: 0.12, Gz: -0.12, Ra: -50, Rr: 0.32, Ry: 0.38, Wy: -14, Wp: 8, La: 50, Lr: 0.28, Ly: 0.4, c1: 16 },
        ];
      })(),
    },
    // 방패 올리기 (마지막 프레임 유지)
    guard: {
      frames: 3, dur: 0.12, loop: false,
      poses: K(3, [
        [0, { hy: -0.03, cry: 10, La: 40, Lr: 0.34, Ly: 0.56, Vy: 24, Ra: -66, Ry: 0.46 }],
        [1, { hy: -0.05, cry: 18, crx: 6, La: 12, Lr: 0.42, Ly: 0.66, Vy: 6, Vp: 6, Ra: -80, Rr: 0.3, Ry: 0.46, Wy: -30, Wp: 30 }],
        [2, { hy: -0.06, cry: 20, crx: 8, drx: 4, La: 8, Lr: 0.42, Ly: 0.7, Vy: 2, Vp: 8, Ra: -86, Rr: 0.3, Ry: 0.46, Wy: -36, Wp: 34, Fz: 0.09, Gz: -0.11 }],
      ]),
    },
    hit: {
      frames: 3, dur: 0.24, loop: false,
      poses: K(3, [
        [0, { hz: -0.05, hy: -0.03, crx: -16, drx: -14, cry: -8, Ra: -80, Rr: 0.36, Ry: 0.54, La: 84, Lr: 0.34, Ly: 0.58, Wy: -40, Wp: 30, c1: 22 }],
        [1, { hz: -0.06, hy: -0.05, crx: -10, drx: -6, cry: -4, Ra: -74, Rr: 0.34, Ry: 0.5, La: 78, Lr: 0.32, Ly: 0.54, Wy: -30, Wp: 26, c1: 18 }],
        [2, { hz: -0.02, hy: -0.03, crx: -2, Ra: -62, Rr: 0.33, Ry: 0.47, La: 66, Ly: 0.5, Wy: -20, Wp: 24 }],
      ]),
    },
    // 뒤로 쓰러짐
    death: {
      frames: 8, dur: 0.8, loop: false,
      poses: fallPoses(8, b, (i) => ({
        Ra: -82 - i * 4, Rr: 0.36 + i * 0.012, Ry: 0.56 - i * 0.02, Wy: -40 - i * 9, Wp: 20 - i * 2,
        La: 84 + i * 5, Lr: 0.34 + i * 0.016, Ly: 0.58 - i * 0.02, Vy: 42,
      })),
    },
  };
}

/** 곡면 망토 두 조각 */
export function addCape(h, color, dark, { y = 0.35, z = -0.135, w = 0.2, l1 = 0.34, l2 = 0.28, flare = 1 } = {}) {
  const m = M(color, { side: THREE.DoubleSide, thr: [0.3, 0.5, 0.9], hi: 0.14 });
  h.cape1 = h.node('cape1', h.chest, 0, y, z);
  h.cape1.add(eg(at(arcSheet(w, w * 1.18, l1, m), 0, -l1 / 2, 0.02), 'cape'));
  h.cape2 = h.node('cape2', h.cape1, 0, -l1, 0);
  h.cape2.add(eg(at(arcSheet(w * 1.18, w * 1.3 * flare, l2, m), 0, -l2 / 2, 0.02), 'cape'));
  h.cape1.add(eg(at(cyl(0.15, 0.175, 0.05, M(dark), 10), 0, 0.01, 0.13, 8), 'collar'));
}
/** 뒤로 볼록한 곡면 천 (망토, 자락) */
export function arcSheet(rTop, rBot, height, mat, zScale = 0.55, arc = 200, folds = 5) {
  const g = new THREE.CylinderGeometry(rTop, rBot, height, 28, 3, true, Math.PI - (arc / 2) * D2R, arc * D2R);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const th = Math.atan2(p.getX(i), p.getZ(i));
    const down = 0.5 - p.getY(i) / height; // 위 0 ~ 아래 1
    const k = 1 + (0.03 + 0.11 * down) * Math.sin(th * folds * 2);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  const m = rawMesh(g, mat);
  m.scale.z = zScale;
  return m;
}

function buildWarrior(pal) {
  const h = new Human({ holdR: { fwd: 0.78, back: 0.1 } });
  const steel = M('#a9b4c6', { metal: 1 });
  const steelD = M('#7b879b', { metal: 1 });
  const gold = M('#dcae45', { metal: 1 });
  const under = M('#3d3a4a');
  const capeM = M(pal.cape, { side: THREE.DoubleSide });
  const capeIn = M(pal.capeDark, { side: THREE.DoubleSide });
  const hair = M(pal.hair);

  addFace(h, { skin: pal.skin });
  // 머리카락: 뒤로 젖힌 덮개 + 앞머리 + 삐침
  const hg = eg(group(), 'hair');
  hg.add(at(cap(0.296, 0.288, 0.29, 92, 40, hair), 0, 0.272, -0.004));
  addBangs(hg, hair, [[-30, 46, 0.9], [2, 50, 1], [32, 46, 0.9], [-72, 22, 0.85], [72, 22, 0.85]]);
  for (const [x, y, z, rx, rz, sc] of [[-0.02, 0.59, -0.05, -20, 0, 1], [-0.14, 0.56, -0.08, -30, 26, 0.85], [0.13, 0.56, -0.08, -30, -24, 0.85], [0, 0.46, -0.24, -70, 0, 0.9]])
    hg.add(at(cone(0.07 * sc, 0.15 * sc, hair, 6), x, y, z, rx, 0, rz));
  h.head.add(hg);

  // 몸통: 판금 흉갑
  const torso = eg(group(), 'torso');
  torso.add(at(sph(0.208, 0.2, 0.158, steel, 18), 0, 0.2, 0));
  torso.add(at(sph(0.17, 0.12, 0.13, steelD, 14), 0, 0.05, 0));
  torso.add(at(box(0.04, 0.26, 0.02, gold), 0, 0.19, 0.152, -6));
  torso.add(at(cyl(0.088, 0.1, 0.06, under, 10), 0, 0.36, 0));
  h.chest.add(torso);
  // 어깨 갑옷
  for (const s of [1, -1]) {
    const pa = eg(group(), 'pauld' + s);
    pa.add(at(sph(0.098, 0.082, 0.098, steel, 12), s * 0.215, 0.335, 0));
    pa.add(at(tor(0.082, 0.014, gold, Math.PI * 2, 14, 5), s * 0.215, 0.295, 0, 90));
    h.chest.add(pa);
  }
  // 허리 치마 갑옷
  const skirt = eg(group(), 'torso');
  skirt.add(at(cyl(0.165, 0.2, 0.15, steelD, 12), 0, -0.05, 0));
  skirt.add(at(cyl(0.17, 0.17, 0.035, gold, 12), 0, 0.03, 0));
  h.hips.add(skirt);

  addLegs(h, { thigh: under, shin: steel, boot: steelD, rT: 0.07, rS: 0.066 });
  addArms(h, { upper: under, fore: steel, hand: steelD, rU: 0.055, rF: 0.056, rH: 0.06 });

  // 망토: 위아래 두 조각
  addCape(h, pal.cape, pal.capeDark);

  h.gripR.add(sword({ blade: '#dfe6ef', guard: pal.trim, grip: '#5e3a26' }));
  const sh = roundShield({ face: pal.shield, emblem: pal.emblem, rim: '#cfd7e3', boss: pal.trim });
  h.gripL.add(at(sh, 0, 0, 0.05));
  h.remember();
  h.anims = warriorAnims();
  return h;
}

const WARRIOR = {
  a: { skin: SKIN.a, hair: '#7a4a28', cape: '#3f62b0', capeDark: '#2c4583', shield: '#3f62b0', emblem: '#e9e3cf', trim: '#e0b040' },
  b: { skin: SKIN.b, hair: '#d8a93c', cape: '#b23a38', capeDark: '#7e2729', shield: '#b23a38', emblem: '#f0d9a0', trim: '#e0b040' },
  c: { skin: SKIN.c, hair: '#2c2838', cape: '#3f8a5c', capeDark: '#2a6041', shield: '#3f8a5c', emblem: '#e6edd2', trim: '#cfd8e6' },
};

// ---------- 공통 조각 ----------
/** 접힌 주름이 있는 치마·로브 자락 (원점이 허리, 아래로 h) */
export function robeSkirt(rTop, rBot, h, mat, folds = 7, depth = 0.06) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 32, 3, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const th = Math.atan2(p.getX(i), p.getZ(i));
    const down = 0.5 - p.getY(i) / h;
    const k = 1 + depth * down * Math.sin(th * folds);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.translate(0, -h / 2, 0);
  g.computeVertexNormals();
  return rawMesh(g, mat);
}
/** 천 두건: 뒤로 젖힌 덮개와 얼굴 테두리 */
export function hood(h, color, trim, { theta = 112, tilt = 52, r = 0.298, rim = 0.024 } = {}) {
  const m = M(color, { side: THREE.DoubleSide, thr: [0.3, 0.48, 0.9] });
  const g = eg(group(), 'hood');
  g.add(at(cap(r, r * 0.98, r * 1.02, theta, tilt, m, 24), 0, 0.272, -0.004));
  // 얼굴 둘레 테두리
  const t = (theta * Math.PI) / 180;
  const rr = tor(r * Math.sin(t), rim, M(trim), Math.PI * 2, 24, 6);
  const piv = group(rr);
  rr.position.z = 0;
  rr.rotation.x = Math.PI / 2;
  rr.position.y = r * Math.cos(t);
  piv.rotation.x = (-tilt * Math.PI) / 180;
  piv.position.set(0, 0.272, -0.004);
  g.add(piv);
  return { g, m };
}
function legsFor(h, pants, boots, opt = {}) {
  addLegs(h, { thigh: M(pants), shin: M(pants), boot: M(boots), ...opt });
}
/** 공통 쓰러짐: 뒤로 넘어져 몸 중심이 앵커 위에 온다 */
export function fallPoses(n, b, hands) {
  const keys = [
    [0, { hz: -0.04, hy: -0.03, crx: -14, drx: -14, ...hands(0) }],
    [1, { hz: -0.08, hy: -0.08, crx: -16, drx: -18, Fz: 0.1, Gz: 0.04, ...hands(1) }],
    [2, { ...fallBack(22, 0.16, 0.0), hy: -0.1, crx: -8, drx: -10, Fz: 0.12, Gz: 0.06, c1: 18, ...hands(2) }],
    [3, { ...fallBack(50, 0.34, 0.1), hy: -0.08, crx: -4, drx: -6, Fz: 0.12, Gz: 0.08, c1: 12, ...hands(3) }],
    [4, { ...fallBack(76, 0.5, 0.2), hy: -0.03, drx: 0, Fz: 0.08, Gz: 0.06, c1: 4, c2: 4, ...hands(4) }],
    [5, { ...fallBack(90, 0.58, 0.24), drx: 4, Fz: 0.05, Gz: 0.03, c1: 0, c2: 0, ...hands(5) }],
    [6, { ...fallBack(86, 0.56, 0.26), crx: 2, drx: 2, Fz: 0.03, Gz: 0.02, c1: 0, c2: 0, ...hands(6) }],
    [7, { ...fallBack(90, 0.58, 0.23), drx: 6, Fz: 0.02, Gz: 0.02, c1: 0, c2: 0, ...hands(7) }],
  ];
  return bakeKeys(n, keys, b);
}

// ---------- 마법사 ----------
const M_STANCE = {
  hy: -0.006, Fz: 0.03, Gz: -0.03,
  Ra: -56, Rr: 0.31, Ry: 0.48, Wy: -4, Wp: 84,
  La: 40, Lr: 0.22, Ly: 0.46, Vy: 0, Vp: 0,
  c1: 6, c2: 5,
};
export function mageAnims() {
  const b = M_STANCE;
  const K = (n, keys, loop = false) => bakeKeys(n, keys, b, loop);
  return {
    idle: { frames: 6, dur: 1.2, loop: true, poses: idleFrames(6, b) },
    walk: {
      frames: 8, dur: 0.64, loop: true,
      poses: walkFrames(8, {
        stride: 0.155, lift: 0.07,
        extra: (ph, c) => ({
          Ra: -56 + 7 * c, Rr: 0.31, Ry: 0.48 + 0.012 * Math.cos(2 * ph), Wy: -4, Wp: 84 - 3 * c,
          La: 40 - 6 * c, Lr: 0.22, Ly: 0.46 + 0.01 * Math.cos(2 * ph),
          c1: 10, c2: 6,
        }),
      }),
    },
    // 지팡이 찌르기
    attack1: {
      frames: 6, dur: 0.32, loop: false,
      poses: K(6, [
        [0, { Wslide: -0.06, cry: -16, hry: -6, hy: -0.03, crx: -4, Ra: -74, Rr: 0.22, Ry: 0.6, Wy: -4, Wp: 58, La: 54, Lr: 0.24, Gz: -0.08 }],
        [1, { Wslide: -0.14, cry: -24, hry: -10, hy: -0.04, crx: -6, Ra: -80, Rr: 0.2, Ry: 0.62, Wy: -4, Wp: 42, La: 60, Lr: 0.24, Gz: -0.1 }],
        [2, { Wslide: -0.3, cry: 14, hry: 6, hz: 0.03, hy: -0.05, crx: 8, Ra: -26, Rr: 0.24, Ry: 0.58, Wy: -6, Wp: 10, La: 80, Lr: 0.24, Ly: 0.42, Fz: 0.11, Gz: -0.11 }],
        [3, { Wslide: -0.3, cry: 20, hry: 8, hz: 0.04, hy: -0.055, crx: 10, Ra: -20, Rr: 0.25, Ry: 0.58, Wy: -6, Wp: 8, La: 88, Lr: 0.24, Ly: 0.42, Fz: 0.12, Gz: -0.12 }],
        [4, { Wslide: -0.2, cry: 12, hry: 4, hz: 0.03, hy: -0.04, crx: 6, Ra: -32, Rr: 0.26, Ry: 0.54, Wy: -6, Wp: 30, La: 70, Lr: 0.24, Ly: 0.44, Fz: 0.08, Gz: -0.08 }],
        [5, { cry: 4, hy: -0.02, crx: 2, Ra: -42, Rr: 0.31, Ry: 0.56, Wy: -3, Wp: 72, La: 50, Fz: 0.05, Gz: -0.05 }],
      ]),
    },
    // 지팡이 휘두르기
    attack2: {
      frames: 6, dur: 0.32, loop: false,
      poses: K(6, [
        [0, { cry: -26, hry: -10, hy: -0.03, Ra: -112, Rr: 0.28, Ry: 0.62, Wy: -120, Wp: 44, La: 48, Gz: -0.08 }],
        [1, { cry: -38, hry: -14, hy: -0.04, Ra: -136, Rr: 0.28, Ry: 0.66, Wy: -146, Wp: 48, La: 52, Gz: -0.1 }],
        [2, { cry: 2, hry: 2, hz: 0.03, hy: -0.05, crx: 6, Ra: -30, Rr: 0.36, Ry: 0.66, Wy: -34, Wp: 38, La: 76, Lr: 0.24, Fz: 0.11, Gz: -0.11 }],
        [3, { cry: 32, hry: 12, hz: 0.04, hy: -0.055, crx: 8, Ra: 44, Rr: 0.34, Ry: 0.62, Wy: 50, Wp: 36, La: 112, Lr: 0.22, Fz: 0.12, Gz: -0.12 }],
        [4, { cry: 36, hry: 14, hz: 0.03, hy: -0.045, crx: 6, Ra: 62, Rr: 0.32, Ry: 0.58, Wy: 72, Wp: 42, La: 118, Lr: 0.22, Fz: 0.1, Gz: -0.1 }],
        [5, { cry: 14, hry: 6, hy: -0.02, crx: 2, Ra: -12, Rr: 0.31, Ry: 0.54, Wy: -2, Wp: 68, La: 70, Fz: 0.05, Gz: -0.05 }],
      ]),
    },
    // 두 손 뻗기 (강한 주문)
    attack3: {
      frames: 7, dur: 0.46, loop: false,
      poses: K(7, [
        [0, { hy: -0.03, crx: 2, Ra: -50, Rr: 0.24, Ry: 0.52, Wy: -24, Wp: 74, La: 44, Lr: 0.2, Ly: 0.52 }],
        [1, { hy: -0.05, crx: -8, drx: -4, Ra: -48, Rr: 0.16, Ry: 0.56, Wy: -30, Wp: 70, La: 38, Lr: 0.12, Ly: 0.56, Gz: -0.08 }],
        [2, { hy: -0.05, crx: -12, drx: -6, Ra: -44, Rr: 0.13, Ry: 0.6, Wy: -34, Wp: 68, La: 32, Lr: 0.1, Ly: 0.6, Gz: -0.1 }],
        [3, { hz: 0.05, hy: -0.06, crx: 12, Ra: -32, Rr: 0.46, Ry: 0.62, Wy: -40, Wp: 58, La: 22, Lr: 0.48, Ly: 0.62, Fz: 0.13, Gz: -0.13, c1: 20 }],
        [4, { hz: 0.05, hy: -0.06, crx: 12, Ra: -30, Rr: 0.47, Ry: 0.64, Wy: -40, Wp: 58, La: 20, Lr: 0.49, Ly: 0.64, Fz: 0.13, Gz: -0.13, c1: 18 }],
        [5, { hz: 0.04, hy: -0.05, crx: 8, Ra: -36, Rr: 0.43, Ry: 0.6, Wy: -34, Wp: 62, La: 26, Lr: 0.44, Ly: 0.58, Fz: 0.12, Gz: -0.12 }],
        [6, { hz: 0.02, hy: -0.025, crx: 3, Ra: -48, Rr: 0.33, Ry: 0.54, Wy: -10, Wp: 74, La: 38, Lr: 0.28, Ly: 0.5, Fz: 0.06, Gz: -0.06 }],
      ]),
    },
    // 시전: 지팡이를 높이 들어 빛을 모은다
    cast: {
      frames: 7, dur: 0.5, loop: false,
      poses: K(7, [
        [0, { hy: -0.03, crx: 6, drx: 4, Ra: -46, Rr: 0.28, Ry: 0.46, Wy: -2, Wp: 82, La: 34, Lr: 0.18, Ly: 0.42 }],
        [1, { hy: -0.05, crx: 10, drx: 6, Ra: -40, Rr: 0.26, Ry: 0.42, Wy: -2, Wp: 82, La: 30, Lr: 0.16, Ly: 0.38 }],
        [2, { hy: -0.01, crx: -8, drx: -8, Ra: -30, Rr: 0.22, Ry: 0.82, Wy: -2, Wp: 86, La: 56, Lr: 0.3, Ly: 0.72, c1: 14 }],
        [3, { hy: 0.006, crx: -12, drx: -12, Ra: -26, Rr: 0.2, Ry: 0.9, Wy: -2, Wp: 88, La: 64, Lr: 0.34, Ly: 0.84, c1: 18 }],
        [4, { hy: 0.006, crx: -12, drx: -12, Ra: -26, Rr: 0.2, Ry: 0.9, Wy: -2, Wp: 88, La: 66, Lr: 0.34, Ly: 0.86, c1: 16 }],
        [5, { hy: -0.015, crx: -4, drx: -4, Ra: -34, Rr: 0.26, Ry: 0.74, Wy: -2, Wp: 86, La: 54, Lr: 0.3, Ly: 0.66 }],
        [6, { hy: -0.015, crx: 2, Ra: -50, Rr: 0.3, Ry: 0.56, Wy: -3, Wp: 84, La: 42, Lr: 0.24, Ly: 0.5 }],
      ]),
    },
    // 지팡이 땅 찍기
    spin: {
      frames: 6, dur: 0.5, loop: false,
      poses: K(6, [
        [0, { hy: 0.0, crx: -6, drx: -6, Ra: -70, Rr: 0.32, Ry: 0.72, Wy: -8, Wp: 88, La: 46, Lr: 0.26, Ly: 0.6 }],
        [1, { hy: 0.012, crx: -10, drx: -10, Ra: -74, Rr: 0.32, Ry: 0.84, Wy: -8, Wp: 88, La: 54, Lr: 0.3, Ly: 0.7, Fy: 0.02, Gy: 0.0, c1: 12 }],
        [2, { hz: 0.05, hy: -0.08, crx: 12, drx: -9, Ra: -30, Rr: 0.42, Ry: 0.5, Wy: 0, Wp: 88, La: 70, Lr: 0.28, Ly: 0.46, Fz: 0.14, Gz: -0.14, c1: 22 }],
        [3, { hz: 0.05, hy: -0.1, crx: 14, drx: -10, Ra: -28, Rr: 0.42, Ry: 0.49, Wy: 0, Wp: 89, La: 78, Lr: 0.28, Ly: 0.44, Fz: 0.15, Gz: -0.15, c1: 24 }],
        [4, { hz: 0.045, hy: -0.085, crx: 12, drx: -9, Ra: -32, Rr: 0.42, Ry: 0.5, Wy: 0, Wp: 88, La: 70, Lr: 0.27, Ly: 0.45, Fz: 0.14, Gz: -0.14, c1: 16 }],
        [5, { hz: 0.02, hy: -0.03, crx: 6, Ra: -36, Rr: 0.36, Ry: 0.5, Wy: -2, Wp: 86, La: 52, Lr: 0.24, Ly: 0.46, Fz: 0.07, Gz: -0.07 }],
      ]),
    },
    // 몸을 웅크렸다 펴기 (순간이동 앞뒤)
    dodge: {
      frames: 6, dur: 0.38, loop: false,
      poses: K(6, [
        [0, { hy: -0.08, crx: 22, drx: 6, Ra: -40, Rr: 0.22, Ry: 0.42, Wp: 80, La: 30, Lr: 0.14, Ly: 0.42, 'pivot.sy': 0.98, c1: 10 }],
        [1, { hy: -0.14, crx: 40, drx: 10, Ra: -30, Rr: 0.16, Ry: 0.36, Wp: 72, La: 22, Lr: 0.12, Ly: 0.36, 'pivot.sy': 0.86, 'pivot.sx': 1.08, 'pivot.sz': 1.08, c1: 14 }],
        [2, { hy: 0.012, crx: -8, drx: -10, Ra: -14, Rr: 0.1, Ry: 0.92, Wy: 0, Wp: 88, La: 14, Lr: 0.1, Ly: 0.92, 'pivot.sy': 1.12, 'pivot.sx': 0.88, 'pivot.sz': 0.88, Fy: 0.02, Gy: 0.02, c1: 3, c2: 2 }],
        [3, { hy: 0.012, crx: -10, drx: -12, Ra: -12, Rr: 0.1, Ry: 0.96, Wy: 0, Wp: 88, La: 12, Lr: 0.1, Ly: 0.96, 'pivot.sy': 1.14, 'pivot.sx': 0.86, 'pivot.sz': 0.86, Fy: 0.03, Gy: 0.03, c1: 3, c2: 2 }],
        [4, { hy: -0.12, crx: 30, drx: 6, Ra: -34, Rr: 0.2, Ry: 0.38, Wp: 76, La: 26, Lr: 0.14, Ly: 0.38, 'pivot.sy': 0.88, 'pivot.sx': 1.06, 'pivot.sz': 1.06 }],
        [5, { hy: -0.05, crx: 10, drx: 2, Ra: -48, Rr: 0.28, Ry: 0.46, Wp: 82, La: 36, Lr: 0.2, Ly: 0.44 }],
      ]),
    },
    // 왼손을 앞으로 내밀어 막기
    guard: {
      frames: 3, dur: 0.12, loop: false,
      poses: K(3, [
        [0, { hy: -0.03, cry: 8, Ra: -70, Rr: 0.28, Ry: 0.54, Wp: 80, La: 30, Lr: 0.32, Ly: 0.62 }],
        [1, { hy: -0.05, cry: 14, crx: 6, Ra: -78, Rr: 0.26, Ry: 0.56, Wp: 78, La: 14, Lr: 0.42, Ly: 0.76 }],
        [2, { hy: -0.06, cry: 16, crx: 8, Ra: -82, Rr: 0.26, Ry: 0.58, Wp: 78, La: 10, Lr: 0.44, Ly: 0.8, Fz: 0.08, Gz: -0.1 }],
      ]),
    },
    hit: {
      frames: 3, dur: 0.24, loop: false,
      poses: K(3, [
        [0, { hz: -0.05, hy: -0.03, crx: -16, drx: -14, cry: -8, Ra: -72, Rr: 0.34, Ry: 0.58, Wp: 74, La: 80, Lr: 0.32, Ly: 0.56, c1: 16 }],
        [1, { hz: -0.06, hy: -0.05, crx: -10, drx: -6, cry: -4, Ra: -66, Rr: 0.33, Ry: 0.54, Wp: 78, La: 68, Lr: 0.28, Ly: 0.52, c1: 12 }],
        [2, { hz: -0.02, hy: -0.03, crx: -2, Ra: -58, Rr: 0.31, Ry: 0.51, Wp: 82, La: 46, Lr: 0.24, Ly: 0.48 }],
      ]),
    },
    death: {
      frames: 8, dur: 0.8, loop: false,
      poses: fallPoses(8, b, (i) => ({
        Ra: -70 - Math.min(i, 3) * 8, Rr: 0.32, Ry: 0.56 - Math.min(i, 3) * 0.07, Wy: -14 + Math.min(i, 3) * 4, Wp: 74 + Math.min(i, 3) * 4, nofit: 1,
        La: 70 + i * 6, Lr: 0.3 + i * 0.015, Ly: 0.54 - i * 0.015,
        ...(i >= 3 ? { drx: 8 + i * 5, Py: 0.14 + (i - 3) * 0.05 } : {}),
      })),
    },
  };
}

function staffMesh({ wood = '#6a4a30', metal = '#b58a3e', hot = '#fff2bc', glow = '#ffcf5e' }) {
  const g = eg(group(), 'staff');
  const w = M(wood, { noise: [14, 0.1] });
  g.add(shaft(1.24, 0.52, 0.025, w));
  // 끝의 작은 등불: 지팡이 끝을 구부려 매달았다
  const top = 0.72;
  g.add(at(tor(0.06, 0.018, w, Math.PI * 1.25, 10, 5), 0, 0.0, top + 0.03, 0, 90, -30));
  const lamp = group();
  const iron = M('#4a4a54', { metal: 1 });
  lamp.add(at(sph(0.08, 0.1, 0.08, GLOW.lamp(), 10), 0, 0, 0));
  lamp.add(at(cone(0.1, 0.08, M(metal, { metal: 1 }), 8), 0, 0.12, 0));
  lamp.add(at(cyl(0.085, 0.065, 0.03, M(metal, { metal: 1 }), 8), 0, -0.09, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    lamp.add(at(box(0.014, 0.17, 0.014, iron), Math.cos(a) * 0.078, 0, Math.sin(a) * 0.078));
  }
  // 지팡이 지역 +Z = 위. 등불은 세계에서 위를 보게 묶는다
  const holder = group(at(lamp, 0, 0, 0, 90, 0, 0));
  g.add(at(holder, 0, 0, top + 0.13));
  return g;
}

function buildMage(pal) {
  const h = new Human({ hipH: 0.42, holdR: { fwd: 1.05, back: 0.52 } });
  addFace(h, { skin: pal.skin });
  const hairM = M(pal.hair);
  const hg = eg(group(), 'hair');
  addBangs(hg, hairM, [[-30, 13, 0.62], [4, 17, 0.72], [34, 13, 0.62], [-62, 0, 0.6], [62, 0, 0.6]], 0.272, 0.262);
  h.head.add(hg);
  const { g: hoodG, m: hoodM } = hood(h, pal.robe, pal.trim, { theta: 113, tilt: 50 });
  // 뾰족한 두건 끝
  hoodG.add(at(cone(0.15, 0.3, hoodM, 10), 0, 0.53, -0.16, -46));
  hoodG.add(at(cone(0.075, 0.2, hoodM, 8), 0, 0.615, -0.31, -80));
  h.head.add(hoodG);
  const robeM = M(pal.robe, { thr: [0.3, 0.48, 0.9] });
  const robeD = M(pal.robeDark, { thr: [0.3, 0.48, 0.9] });
  const trimM = M(pal.trim);
  const torso = eg(group(), 'torso');
  torso.add(at(sph(0.19, 0.2, 0.155, robeM, 16), 0, 0.17, 0));
  torso.add(at(cyl(0.11, 0.14, 0.06, hoodM, 10), 0, 0.345, -0.01));
  // 앞섶
  torso.add(at(box(0.05, 0.26, 0.02, trimM), 0, 0.17, 0.148, -4));
  // 어깨 망토 같은 윗옷
  torso.add(at(lathe([[0.1, 0.36], [0.2, 0.29], [0.245, 0.2], [0.245, 0.17], [0.1, 0.17]], hoodM, 14), 0, 0, 0));
  h.chest.add(torso);
  // 치마 자락: 엉덩이 높이에 맞춰 늘고 준다
  const skirtH = 0.37;
  const skirtN = h.node('skirt', h.hips, 0, 0.03, 0);
  const sk = eg(group(), 'skirt');
  sk.add(robeSkirt(0.16, 0.285, skirtH, M(pal.robe, { side: THREE.DoubleSide, thr: [0.3, 0.48, 0.9] }), 7, 0.1));
  sk.add(at(robeSkirt(0.277, 0.292, 0.05, M(pal.trim, { side: THREE.DoubleSide }), 7, 0.0), 0, -skirtH + 0.05, 0));
  sk.add(at(cyl(0.27, 0.27, 0.01, M(pal.robeDark), 16), 0, -skirtH + 0.012, 0));
  skirtN.add(sk);
  const belt = eg(group(), 'belt');
  belt.add(at(cyl(0.175, 0.175, 0.045, trimM, 12), 0, 0.035, 0));
  belt.add(at(sph(0.032, 0.03, 0.02, M('#e0b040', { metal: 1 }), 6), 0, 0.035, 0.17));
  belt.add(at(rbox(0.08, 0.1, 0.05, 0.02, M('#7a5a36')), 0.15, -0.03, 0.09));
  h.hips.add(belt);
  addLegs(h, { thigh: M('#3a3442'), shin: M('#3a3442'), boot: M(pal.boot), rT: 0.05, rS: 0.045, bootW: 0.125, bootL: 0.2, bootH: 0.08 });
  addArms(h, { upper: robeM, fore: robeM, hand: skinMat(pal.skin), rU: 0.06, rF: 0.06, rH: 0.046 });
  // 소매: 팔꿈치에서 손목으로 넓어진다
  for (const f of [h.foreL, h.foreR]) f.add(eg(at(cyl(0.062, 0.1, 0.12, robeD, 10), 0, -0.13, 0), f.uuid));
  h.slideNode = group(staffMesh({}));
  h.gripR.add(h.slideNode);
  h.post2 = (P) => {
    const y = h.hips.position.y + 0.03;
    skirtN.scale.y = Math.min(1.12, Math.max(0.5, (y - 0.03) / skirtH));
    // 걸을 때 앞서는 발 쪽으로 자락이 흔들린다
    skirtN.rotation.set(0.5 * (P.Fz + P.Gz), 0, 0.42 * (P.Gz - P.Fz));
  };
  h.remember();
  h.anims = mageAnims();
  return h;
}
const MAGE = {
  a: { skin: SKIN.a, hair: '#c9d4e8', robe: '#4a3f9c', robeDark: '#352c72', trim: '#e4c35a', boot: '#3c2f58' },
  b: { skin: SKIN.b, hair: '#9e3f2e', robe: '#a83b4e', robeDark: '#792a38', trim: '#ecd9a4', boot: '#4c2630' },
  c: { skin: SKIN.c, hair: '#26303a', robe: '#2f7f88', robeDark: '#205c63', trim: '#d9e2b0', boot: '#22424a' },
};

// ---------- 궁수 ----------
const A_STANCE = {
  hy: -0.008, Fz: 0.04, Gz: -0.05, Fx: 0.01, Gx: -0.01,
  Ra: -66, Rr: 0.28, Ry: 0.46, Wy: 0, Wp: 0,
  La: 62, Lr: 0.37, Ly: 0.6, Vy: 30, Vp: 8, Vr: 14,
  c1: 6, c2: 5,
};
/** 활 쏘는 자세 조각: draw 0~1 */
function aim(draw, { lean = 0, crouch = 0, up = 0 } = {}) {
  const y = 0.8 + up * 0.12 - crouch;
  const pullR = 0.42 - draw * 0.32;
  return {
    cry: -34, hry: -12, dry: 26, crx: lean, hy: -0.02 - crouch,
    La: 26, Lr: 0.5, Ly: y - 0.14, Vy: 16, Vp: 6 + up * 30, Vr: 18,
    Ra: -2, Rr: pullR, Ry: y + (draw > 0 ? -0.08 : -0.16), Fz: 0.1, Gz: -0.1, draw, arrow: draw > 0 ? 1 : 0,
  };
}
export function archerAnims() {
  const b = A_STANCE;
  const K = (n, keys) => bakeKeys(n, keys, b);
  const release = (o = {}) => ({ ...aim(0, o), arrow: 0, draw: 0, La: 26, Lr: 0.52, Ra: -34, Rr: 0.12, Ry: 0.72, crx: -4 });
  return {
    idle: { frames: 6, dur: 1.2, loop: true, poses: idleFrames(6, b) },
    walk: {
      frames: 8, dur: 0.64, loop: true,
      poses: walkFrames(8, {
        stride: 0.18, lift: 0.085,
        extra: (ph, c) => ({
          Ra: -66 - 12 * c, Rr: 0.28, Ry: 0.46 + 0.012 * Math.cos(2 * ph),
          La: 58 + 8 * c, Lr: 0.34, Ly: 0.56 + 0.012 * Math.cos(2 * ph), Vy: 26, Vp: 8, Vr: 12,
          c1: 14, c2: 7,
        }),
      }),
    },
    // 빠른 활쏘기
    attack1: {
      frames: 6, dur: 0.32, loop: false,
      poses: K(6, [
        [0, { ...aim(0.15), Ra: -14 }],
        [1, { ...aim(0.6), crx: -3 }],
        [2, { ...aim(0.95), crx: -5 }],
        [3, { ...release(), cry: -38 }],
        [4, { ...release(), cry: -30, La: 18, Lr: 0.5, Ry: 0.68 }],
        [5, { cry: -12, hry: -4, dry: 8, Ra: -50, Rr: 0.26, Ry: 0.54, La: 40, Lr: 0.42, Ly: 0.68, Vy: 14, Vp: 8, Fz: 0.07, Gz: -0.07 }],
      ]),
    },
    // 두 번째: 반대쪽 발로 내딛으며 낮게 쏜다
    attack2: {
      frames: 6, dur: 0.32, loop: false,
      poses: K(6, [
        [0, { ...aim(0.2, { crouch: 0.03 }), Fz: 0.05, Gz: -0.13 }],
        [1, { ...aim(0.65, { crouch: 0.05 }), Fz: 0.06, Gz: -0.14, crx: 3 }],
        [2, { ...aim(1, { crouch: 0.06 }), Fz: 0.07, Gz: -0.15, crx: 4 }],
        [3, { ...release({ crouch: 0.06 }), Fz: 0.07, Gz: -0.15, Ry: 0.66 }],
        [4, { ...release({ crouch: 0.045 }), Fz: 0.06, Gz: -0.13, Ry: 0.6, La: 20, Lr: 0.48 }],
        [5, { cry: -12, hry: -4, dry: 8, hy: -0.02, Ra: -52, Rr: 0.26, Ry: 0.52, La: 42, Lr: 0.42, Ly: 0.66, Vy: 14, Vp: 8, Fz: 0.05, Gz: -0.08 }],
      ]),
    },
    // 크게 당기기
    attack3: {
      frames: 7, dur: 0.46, loop: false,
      poses: K(7, [
        [0, { ...aim(0.1, { lean: -2 }), Fz: 0.12, Gz: -0.13 }],
        [1, { ...aim(0.55, { lean: -6, crouch: 0.02 }), Fz: 0.13, Gz: -0.15 }],
        [2, { ...aim(1, { lean: -10, crouch: 0.03 }), Rr: 0.02, Ry: 0.82, Fz: 0.14, Gz: -0.16 }],
        [3, { ...aim(1, { lean: -11, crouch: 0.035 }), Rr: 0.0, Ry: 0.82, Fz: 0.14, Gz: -0.16 }],
        [4, { ...release({ lean: -14, crouch: 0.02 }), hz: -0.05, Lr: 0.54, Ry: 0.84, Ra: -60, Rr: 0.16, Fz: 0.12, Gz: -0.18 }],
        [5, { ...release({ lean: -8, crouch: 0.03 }), hz: -0.04, Ry: 0.74, Ra: -50, Rr: 0.18, Fz: 0.11, Gz: -0.16 }],
        [6, { cry: -14, hry: -4, dry: 10, hy: -0.02, Ra: -56, Rr: 0.26, Ry: 0.54, La: 40, Lr: 0.42, Ly: 0.68, Vy: 14, Vp: 8, Fz: 0.07, Gz: -0.09 }],
      ]),
    },
    // 시전: 활을 하늘로
    cast: {
      frames: 7, dur: 0.5, loop: false,
      poses: K(7, [
        [0, { hy: -0.03, crx: 4, cry: -14, dry: 10, La: 30, Lr: 0.38, Ly: 0.56, Vy: 10, Vp: 18, Ra: -40, Rr: 0.26, Ry: 0.6 }],
        [1, { hy: -0.05, crx: 8, cry: -20, dry: 14, La: 22, Lr: 0.36, Ly: 0.52, Vy: 8, Vp: 16, Ra: -24, Rr: 0.26, Ry: 0.58, arrow: 1, draw: 0.4 }],
        [2, { hy: -0.03, crx: -12, drx: -18, cry: -26, dry: 20, La: 34, Lr: 0.36, Ly: 0.96, Vy: 14, Vp: 58, Ra: -20, Rr: 0.1, Ry: 0.74, arrow: 1, draw: 0.7, Fz: 0.09, Gz: -0.1 }],
        [3, { hy: -0.03, crx: -14, drx: -20, cry: -28, dry: 22, La: 34, Lr: 0.36, Ly: 1.0, Vy: 14, Vp: 62, Ra: -18, Rr: 0.06, Ry: 0.76, arrow: 1, draw: 1, Fz: 0.09, Gz: -0.1 }],
        [4, { hy: -0.03, crx: -16, drx: -20, cry: -30, dry: 22, La: 34, Lr: 0.36, Ly: 1.02, Vy: 14, Vp: 62, Ra: -46, Rr: 0.16, Ry: 0.86, Fz: 0.09, Gz: -0.1 }],
        [5, { hy: -0.03, crx: -8, drx: -8, cry: -20, dry: 14, La: 20, Lr: 0.34, Ly: 0.86, Vy: 8, Vp: 40, Ra: -48, Rr: 0.2, Ry: 0.7, Fz: 0.07, Gz: -0.08 }],
        [6, { hy: -0.015, cry: -8, dry: 4, La: 44, Lr: 0.36, Ly: 0.62, Vy: 18, Vp: 12, Ra: -60, Rr: 0.26, Ry: 0.5 }],
      ]),
    },
    // 뒤로 몸을 돌리며 쏘기
    spin: {
      frames: 6, dur: 0.5, loop: false,
      poses: K(6, [
        [0, { ...aim(0.3), Pry: 0, Fz: 0.1, Gz: -0.1 }],
        [1, { ...aim(0.6), Pry: 70, hy: -0.05, Py: 0.03, Fz: 0.05, Gz: -0.05, Fy: 0.03, c1: 26 }],
        [2, { ...aim(0.8), Pry: 150, hy: -0.03, Py: 0.07, Fy: 0.05, Gy: 0.02, Fz: 0.03, Gz: -0.03, c1: 34 }],
        [3, { ...aim(1), Pry: 240, hy: -0.04, Py: 0.05, Fy: 0.03, Gy: 0.02, c1: 30 }],
        [4, { ...release(), Pry: 330, hy: -0.04, Fz: 0.1, Gz: -0.12, c1: 16 }],
        [5, { ...release(), Pry: 360, hy: -0.035, Ra: -40, Rr: 0.2, Ry: 0.62, La: 26, Lr: 0.46, Ly: 0.72, Fz: 0.09, Gz: -0.1 }],
      ]),
    },
    // 웅크렸다 뛰어오르기
    dodge: {
      frames: 6, dur: 0.38, loop: false,
      poses: K(6, [
        [0, { hy: -0.13, crx: 24, drx: -6, Fz: 0.1, Gz: -0.12, Ra: -46, Rr: 0.26, Ry: 0.36, La: 46, Lr: 0.3, Ly: 0.68, Vy: 16, Vr: 50 }],
        [1, { Py: 0.2, hy: -0.04, crx: 18, drx: -6, Fy: 0.1, Fz: 0.08, Gy: 0.02, Gz: -0.12, Ra: -70, Rr: 0.3, Ry: 0.5, La: 66, Lr: 0.36, Ly: 0.56, Vy: 30, c1: 20 }],
        [2, { Py: 0.42, hy: -0.12, crx: 30, drx: -10, Fy: 0.2, Fz: 0.1, Gy: 0.2, Gz: 0.02, Ra: -56, Rr: 0.24, Ry: 0.42, La: 50, Lr: 0.3, Ly: 0.46, Vy: 24, c1: 30, c2: 12 }],
        [3, { Py: 0.4, hy: -0.12, crx: 26, drx: -10, Fy: 0.18, Fz: 0.1, Gy: 0.2, Gz: 0.04, Ra: -56, Rr: 0.24, Ry: 0.42, La: 50, Lr: 0.3, Ly: 0.46, Vy: 24, c1: 34, c2: 14 }],
        [4, { Py: 0.16, hy: -0.04, crx: 12, drx: -4, Fy: 0.06, Fz: 0.1, Gy: 0.04, Gz: -0.1, Ra: -72, Rr: 0.3, Ry: 0.56, La: 70, Lr: 0.36, Ly: 0.62, Vy: 30, c1: 40, c2: 16 }],
        [5, { hy: -0.12, crx: 20, drx: -4, Fz: 0.11, Gz: -0.12, Ra: -52, Rr: 0.28, Ry: 0.38, La: 50, Lr: 0.32, Ly: 0.68, Vy: 20, Vr: 50, c1: 12 }],
      ]),
    },
    // 활을 앞으로 비껴 막기
    guard: {
      frames: 3, dur: 0.12, loop: false,
      poses: K(3, [
        [0, { hy: -0.03, cry: 8, La: 30, Lr: 0.36, Ly: 0.66, Vy: 6, Vp: 2, Vr: 40, Ra: -50, Rr: 0.26, Ry: 0.52 }],
        [1, { hy: -0.05, cry: 14, crx: 6, La: 10, Lr: 0.42, Ly: 0.74, Vy: 2, Vp: 0, Vr: 66, Ra: -36, Rr: 0.26, Ry: 0.56 }],
        [2, { hy: -0.06, cry: 16, crx: 8, La: 6, Lr: 0.42, Ly: 0.78, Vy: 0, Vp: 0, Vr: 74, Ra: -32, Rr: 0.26, Ry: 0.58, Fz: 0.09, Gz: -0.11 }],
      ]),
    },
    hit: {
      frames: 3, dur: 0.24, loop: false,
      poses: K(3, [
        [0, { hz: -0.05, hy: -0.03, crx: -16, drx: -14, cry: -8, Ra: -84, Rr: 0.34, Ry: 0.56, La: 80, Lr: 0.36, Ly: 0.62, Vy: 40, Vr: 24, c1: 16 }],
        [1, { hz: -0.06, hy: -0.05, crx: -10, drx: -6, cry: -4, Ra: -78, Rr: 0.32, Ry: 0.52, La: 72, Lr: 0.35, Ly: 0.6, Vy: 34, Vr: 18, c1: 12 }],
        [2, { hz: -0.02, hy: -0.03, crx: -2, Ra: -68, Rr: 0.29, Ry: 0.47, La: 60, Ly: 0.56 }],
      ]),
    },
    death: {
      frames: 8, dur: 0.8, loop: false,
      poses: fallPoses(8, b, (i) => ({
        Ra: -74 - i * 5, Rr: 0.32 + i * 0.012, Ry: 0.54 - i * 0.02,
        La: 66 + i * 4, Lr: 0.3, Ly: 0.56 - i * 0.015, Vy: i < 2 ? 30 : 60, Vr: i < 2 ? 14 : 0, Vp: 0,
      })),
    },
  };
}
function bowMesh({ wood = '#8a5a32', wrap = '#3e2a1c', R = 0.68, arcDeg = 50 }) {
  const g = eg(group(), 'bow');
  const w = M(wood, { thr: [0.3, 0.46, 0.8] });
  const arc = (arcDeg * 2 * Math.PI) / 180;
  const t = tor(R, 0.031, w, arc, 16, 6);
  const piv = group(t);
  t.rotation.z = (-arcDeg * Math.PI) / 180;
  piv.rotation.y = -Math.PI / 2;
  piv.position.z = -R;
  g.add(piv);
  const tipY = R * Math.sin((arcDeg * Math.PI) / 180);
  const tipZ = -R + R * Math.cos((arcDeg * Math.PI) / 180);
  // 젖혀진 끝
  g.add(strut([0, tipY, tipZ], [0, tipY + 0.08, tipZ + 0.05], 0.031, 0.014, w, 6));
  g.add(strut([0, -tipY, tipZ], [0, -tipY - 0.08, tipZ + 0.05], 0.031, 0.014, w, 6));
  g.add(at(cyl(0.032, 0.032, 0.13, M(wrap), 8), 0, 0, 0.002));
  g.tips = [new THREE.Vector3(0, tipY, tipZ), new THREE.Vector3(0, -tipY, tipZ)];
  return g;
}
function buildArcher(pal) {
  const h = new Human({ hipH: 0.42 });
  addFace(h, { skin: pal.skin });
  const hairM = M(pal.hair);
  const hg = eg(group(), 'hair');
  addBangs(hg, hairM, [[-30, 12, 0.64], [2, 15, 0.74], [32, 12, 0.64], [-62, 0, 0.6], [62, 0, 0.6]], 0.272, 0.262);
  h.head.add(hg);
  const { g: hoodG, m: hoodM } = hood(h, pal.hood, pal.hoodTrim, { theta: 112, tilt: 46, rim: 0.02 });
  // 뒤로 늘어진 두건 꼬리와 어깨 덮개
  hoodG.add(at(cone(0.13, 0.3, hoodM, 8), 0, 0.42, -0.26, -128));
  hoodG.add(at(lathe([[0.1, 0.06], [0.17, 0.02], [0.2, -0.03], [0.18, -0.05], [0.1, -0.05]], hoodM, 14), 0, 0, -0.01));
  h.head.add(hoodG);
  const shirt = M(pal.shirt);
  const vest = M(pal.vest, { noise: [10, 0.1], thr: [0.3, 0.46, 0.9] });
  const belt = M('#4a3220');
  const torso = eg(group(), 'torso');
  torso.add(at(sph(0.185, 0.2, 0.15, vest, 14), 0, 0.17, 0));
  torso.add(at(box(0.09, 0.3, 0.02, shirt), 0, 0.17, 0.142, -3));
  torso.add(at(cyl(0.1, 0.13, 0.05, hoodM, 10), 0, 0.345, -0.01));
  // 가슴 끈
  for (const y of [0.1, 0.17, 0.24]) torso.add(at(box(0.1, 0.014, 0.012, M('#3e2a1c')), 0, y, 0.152, -3));
  h.chest.add(torso);
  // 짧은 치마 자락
  const sk = eg(group(), 'skirtA');
  sk.add(at(robeSkirt(0.16, 0.21, 0.18, M(pal.vest, { side: THREE.DoubleSide, noise: [10, 0.1] }), 6, 0.08), 0, 0.03, 0));
  sk.add(at(cyl(0.168, 0.168, 0.04, belt, 12), 0, 0.03, 0));
  sk.add(at(box(0.05, 0.04, 0.02, M('#d9b24a', { metal: 1 })), 0, 0.03, 0.17));
  h.hips.add(sk);
  addLegs(h, { thigh: M(pal.pants), shin: M(pal.boot), boot: M(pal.boot), rT: 0.066, rS: 0.058 });
  addArms(h, { upper: shirt, fore: M(pal.bracer), hand: skinMat(pal.skin), rU: 0.05, rF: 0.05, rH: 0.046 });
  // 화살통: 등에 비스듬히
  const q = eg(group(), 'quiver');
  q.add(at(cyl(0.075, 0.06, 0.42, M(pal.quiver, { noise: [10, 0.1] }), 10), 0, 0, 0));
  q.add(at(tor(0.076, 0.012, M('#d9b24a', { metal: 1 }), Math.PI * 2, 12, 4), 0, 0.2, 0, 90));
  for (const [x, z, c] of [[-0.03, 0.02, '#e8e2d0'], [0.03, -0.02, pal.fletch], [0.0, 0.03, '#e8e2d0'], [0.035, 0.03, pal.fletch]]) {
    q.add(at(cyl(0.008, 0.008, 0.16, M('#c8ad78'), 4), x, 0.28, z));
    q.add(at(box(0.04, 0.09, 0.012, M(c)), x, 0.38, z));
  }
  const qp = group(q);
  qp.rotation.z = (-24 * Math.PI) / 180;
  qp.position.set(0.04, 0.2, -0.2);
  qp.rotation.x = (-10 * Math.PI) / 180;
  h.chest.add(qp);
  const strap = eg(group(), 'strap');
  strap.add(at(tor(0.2, 0.012, belt, Math.PI * 2, 18, 4), 0, 0.2, 0, 0, 0, 45));
  strap.scale.set(1, 1, 0.82);
  h.chest.add(strap);
  // 활과 화살
  const bow = bowMesh({ wood: pal.bow });
  h.gripL.add(bow);
  const strM = M('#efe6cf', { e: 1 });
  const s1 = group(rawMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, -0.5, 0), strM));
  const s2 = group(rawMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, -0.5, 0), strM));
  eg(s1, 'string');
  eg(s2, 'string');
  h.pivot.add(s1);
  h.pivot.add(s2);
  const arrow = eg(group(), 'arrow');
  const am = M('#d8c090');
  arrow.add(rawMesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5), am));
  arrow.add(at(cone(0.04, 0.1, M('#cfd7e3', { metal: 1 }), 5), 0, 0, 1.02, 90));
  arrow.add(at(box(0.012, 0.07, 0.1, M(pal.fletch)), 0, 0, 0.06));
  arrow.add(at(box(0.07, 0.012, 0.1, M(pal.fletch)), 0, 0, 0.06));
  h.pivot.add(arrow);
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const N = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const lay = (o, from, to) => {
    o.position.copy(from);
    Y.copy(from).sub(to);
    const len = Y.length() || 1e-3;
    Y.divideScalar(len);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Y);
    o.scale.set(1, len, 1);
  };
  h.post2 = (P) => {
    h.gripL.updateMatrix();
    A.copy(bow.tips[0]).applyMatrix4(h.gripL.matrix);
    B.copy(bow.tips[1]).applyMatrix4(h.gripL.matrix);
    // 시위 가운데: 안 당기면 곧은 줄, 당기면 오른손으로
    N.copy(A).add(B).multiplyScalar(0.5);
    if (P.draw > 0) N.lerp(h.handR.position, Math.min(1, P.draw * 1.4));
    lay(s1, A, N);
    lay(s2, B, N);
    arrow.visible = P.arrow > 0.5;
    if (arrow.visible) {
      const G = h.gripL.position;
      const d = new THREE.Vector3().copy(G).sub(N);
      const len = Math.max(0.2, d.length());
      arrow.position.copy(N);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
      arrow.scale.set(1, 1, Math.min(1, len + 0.16));
    }
  };
  h.remember();
  h.anims = archerAnims();
  return h;
}
const ARCHER = {
  a: { skin: SKIN.a, hair: '#a3652e', hood: '#8a6236', hoodTrim: '#b39155', shirt: '#6fa04e', bracer: '#6a4a2c', vest: '#6e4a2a', pants: '#4a5240', boot: '#4f3522', quiver: '#6a4528', fletch: '#c8483c', bow: '#94602f' },
  b: { skin: SKIN.b, hair: '#e6c86a', hood: '#6e563c', hoodTrim: '#9a8058', shirt: '#5c8ab4', bracer: '#574632', vest: '#5a4830', pants: '#3f4656', boot: '#3e3a2c', quiver: '#5a4a2e', fletch: '#e8e2d0', bow: '#74502e' },
  c: { skin: SKIN.c, hair: '#3a2a26', hood: '#96502f', hoodTrim: '#c28650', shirt: '#a84e62', bracer: '#6a3c2c', vest: '#70402c', pants: '#3e3844', boot: '#33262c', quiver: '#4a3430', fletch: '#e0b040', bow: '#7e4c2c' },
};

export const PLAYERS = {};
for (const v of ['a', 'b', 'c']) {
  PLAYERS['pc_warrior_' + v] = { kind: 'player', build: () => buildWarrior(WARRIOR[v]) };
  PLAYERS['pc_mage_' + v] = { kind: 'player', build: () => buildMage(MAGE[v]) };
  PLAYERS['pc_archer_' + v] = { kind: 'player', build: () => buildArcher(ARCHER[v]) };
}
