// 보스 둘: 이끼 고목(elder), 등불 기사(warden).
import { THREE, D2R, at, group, eg, box, rbox, sph, cyl, cone, tor, bone, lathe, taper, blob, strut, rawMesh, rng } from './kit.js';
import { M, G, GLOW } from './core.js';
import { Human, bakeKeys, walkFrames } from './rig.js';
import { robeSkirt } from './humans.js';

const anim = (frames, dur, poses, loop = false) => ({ frames, dur, poses, loop });

/** 나무껍질 기둥: 세로 골이 진 원뿔대. 원점 아래쪽 */
function barkColumn(rBot, rTop, h, mat, folds = 7, depth = 0.08, seed = 1) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 28, 6, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const th = Math.atan2(p.getX(i), p.getZ(i));
    const y = p.getY(i) / h + 0.5;
    const k = 1 + depth * Math.sin(th * folds + seed + y * 2.2) + depth * 0.5 * Math.sin(th * (folds * 2 + 1) + y * 5 + seed);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  return rawMesh(g, mat);
}

// ---------- 이끼 고목 ----------
function buildElder() {
  const h = new Human({ hipH: 0.84, hipW: 0.36, thigh: 0.46, shin: 0.46, ankle: 0.13, stance: 0.46, spine: 0.08, shoulderY: 1.22, shoulderW: 0.72, upper: 0.66, fore: 0.74, headY: 1.3, toe: 0.26, heel: 0.12, limits: { R: 2.0, down: 38, up: 146 } });
  const bark = M('#5e4a33', { noise: [5, 0.2], thr: [0.32, 0.5, 0.84], pat: { c: '#6d9440', f: 2.3, thr: 0.6 } });
  const barkD = M('#46362a', { noise: [5, 0.2], thr: [0.32, 0.5, 0.84], pat: { c: '#5d8238', f: 2.6, thr: 0.62 } });
  const moss = M('#588a3c', { noise: [6, 0.3], thr: [0.34, 0.5, 0.8], pat: { c: '#7ea84c', f: 2.2, thr: 0.6 }, ao: 0 });
  const mossD = M('#3f7038', { noise: [7, 0.26] });
  // 줄기 몸통
  const t = eg(group(), 'trunk');
  t.add(at(barkColumn(0.74, 0.62, 1.45, bark, 7, 0.07, 1), 0, -0.08, 0));
  t.add(at(sph(0.62, 0.3, 0.62, bark, 18), 0, 1.36, 0));
  // 어깨 이끼
  for (const [x, y, z, r, s] of [[-0.56, 1.28, 0.05, 0.36, 3], [0.56, 1.28, 0.05, 0.36, 4], [0, 1.42, -0.45, 0.42, 5], [0.28, 1.3, 0.42, 0.26, 6], [-0.3, 1.32, 0.42, 0.24, 7]]) t.add(at(blob(r, r * 0.72, r, moss, { seed: s, disp: 0.14 }), x, y, z));
  // 늘어진 이끼
  const r = rng(11);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r();
    const len = 0.22 + r() * 0.34;
    t.add(at(taper(0.1, 0.03, len, 0.03, 0.015, mossD), Math.sin(a) * 0.68, 1.12 - len / 2, Math.cos(a) * 0.68, 0, (a * 180) / Math.PI));
  }
  h.chest.add(t);
  // 호박색 옹이 눈 (앞쪽)
  const eyeNode = h.node('eye', h.chest, 0, 0.72, 0.62);
  const eyeG = eg(group(), 'eye');
  eyeG.add(at(tor(0.25, 0.09, barkD, Math.PI * 2, 18, 8), 0, 0, 0.02));
  eyeG.add(at(sph(0.24, 0.24, 0.13, G('#b8641a', '#ee9a22', '#ffcf4a', '#fff6c0', [0.45, 0.68, 0.84]), 16), 0, 0, 0.04));
  eyeG.add(at(sph(0.05, 0.13, 0.03, M('#3a1c0a', { e: 1 }), 8), 0, 0, 0.17));
  eyeNode.add(eyeG);
  // 꺼진 눈 (쓰러질 때)
  const eyeOff = h.node('eyeOff', h.chest, 0, 0.72, 0.62);
  eyeOff.add(eg(at(sph(0.24, 0.24, 0.12, M('#5a3a1c', { thr: [0.4, 0.6, 0.9] }), 12), 0, 0, 0.04), 'eyeoff'));
  // 엉덩이
  h.hips.add(eg(at(sph(0.68, 0.36, 0.6, barkD, 16), 0, -0.02, 0), 'pelvis'));
  // 수관(머리 자리)
  const c = eg(group(), 'canopy');
  const canopy = M('#47783a', { noise: [5.5, 0.34], thr: [0.34, 0.5, 0.78], pat: { c: '#6a9c44', f: 2.1, thr: 0.58 }, ao: 0 });
  for (const [x, y, z, rr, s] of [[0, 0.62, -0.04, 0.82, 21], [0.58, 0.42, 0.04, 0.5, 22], [-0.58, 0.44, 0.02, 0.52, 23], [0.05, 0.42, 0.5, 0.46, 24], [-0.05, 0.44, -0.58, 0.54, 25], [0.26, 0.96, 0.12, 0.46, 26], [-0.3, 0.9, -0.14, 0.44, 27]]) c.add(at(blob(rr, rr * 0.82, rr, canopy, { seed: s, disp: 0.13 }), x, y - 0.14, z));
  // 수관에서 늘어진 이끼
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const len = 0.3 + (i % 3) * 0.14;
    c.add(at(taper(0.09, 0.025, len, 0.03, 0.012, mossD), Math.sin(a) * 0.82, 0.04 - len / 2, Math.cos(a) * 0.82, 0, (a * 180) / Math.PI));
  }
  h.head.add(c);
  // 다리: 뿌리처럼
  const legW = (b, r1, r2, len) => eg(bone(r1, r2, len, b, 10), b.uuid + len);
  for (const [u, l, f, sd] of [[h.thighL, h.shinL, h.footL, 1], [h.thighR, h.shinR, h.footR, -1]]) {
    u.add(eg(bone(0.26, 0.2, h.d.thigh, barkD, 10), 'leg' + sd));
    l.add(eg(bone(0.2, 0.2, h.d.shin, bark, 10), 'leg' + sd));
    const fg = eg(group(), 'leg' + sd);
    fg.add(at(blob(0.3, 0.15, 0.34, barkD, { seed: 30 + sd, disp: 0.1 }), 0, -0.02, 0.05));
    for (const [a, len] of [[-34, 0.46], [0, 0.56], [34, 0.46], [165, 0.34]]) {
      const c2 = cone(0.09, len, barkD, 7);
      c2.rotation.order = 'YXZ';
      c2.rotation.set(Math.PI / 2 + 0.12, a * D2R, 0);
      c2.position.set(Math.sin(a * D2R) * 0.25, -0.08, Math.cos(a * D2R) * 0.25 + 0.05);
      fg.add(c2);
    }
    f.add(fg);
  }
  // 팔: 큰 나뭇가지
  for (const [u, l, hn, sd] of [[h.upperL, h.foreL, h.handL, 1], [h.upperR, h.foreR, h.handR, -1]]) {
    const a1 = eg(group(), 'arm' + sd);
    a1.add(bone(0.25, 0.17, h.d.upper, bark, 9));
    a1.add(at(blob(0.3, 0.2, 0.3, moss, { seed: 40 + sd, disp: 0.16 }), 0, -0.18, 0.02));
    a1.add(strut([0, -0.34, 0], [sd * 0.42, -0.72, 0.16], 0.075, 0.02, bark, 6));
    u.add(a1);
    const a2 = eg(group(), 'arm' + sd);
    a2.add(bone(0.17, 0.12, h.d.fore, barkD, 9));
    a2.add(strut([0, -0.3, 0], [sd * 0.38, -0.56, 0.16], 0.06, 0.016, barkD, 6));
    a2.add(at(blob(0.2, 0.14, 0.2, moss, { seed: 44 + sd, disp: 0.16 }), sd * 0.05, -0.42, 0));
    // 손가락 가지
    for (const [x, z, l2] of [[0.15, 0.1, 0.42], [-0.14, 0.1, 0.4], [0.02, -0.15, 0.36], [0.02, 0.18, 0.46]])
      a2.add(strut([0, -h.d.fore, 0], [x * 1.7, -h.d.fore - l2 * 1.25, z * 1.7], 0.09, 0.018, barkD, 6));
    l.add(a2);
  }
  const B = { hy: -0.03, crx: 3, Ra: -82, Rr: 1.12, Ry: 0.92, La: 82, Lr: 1.12, Ly: 0.92, Fz: 0.08, Gz: -0.08, 'eyeOff.v': 0 };
  const K = (n, keys) => bakeKeys(n, keys, B);
  h.remember();
  const breathe = (i, n, d = 1) => {
    const t = (i / n) * Math.PI * 2;
    return { ...B, hy: -0.03 - 0.02 * (1 - Math.cos(t)) * d, crx: 3 + 1.4 * Math.sin(t) * d, crz: 1.2 * Math.sin(t) * d, drx: -1.4 * Math.sin(t) * d, drz: 2 * Math.cos(t) * d, Ry: 0.92 - 0.024 * (1 - Math.cos(t)) * d, Ly: 0.92 - 0.024 * (1 - Math.cos(t + 0.6)) * d };
  };
  h.anims = {
    idle: anim(6, 1.4, [0, 1, 2, 3, 4, 5].map((i) => breathe(i, 6)), true),
    walk: anim(8, 1.0, walkFrames(8, {
      stride: 0.3, lift: 0.14, bob: 0.018, sway: 0.03,
      extra: (ph, c, s) => ({ ...B, hy: -0.06 + 0.024 * Math.cos(2 * ph), hrz: -1.2 * s, crz: -1 * s, cry: -6 * c, drz: 0.8 * s, Ra: -82 + 14 * c, La: 82 + 14 * c, Ry: 0.92, Ly: 0.92, crx: 5 }),
    }), true),
    // 두 팔을 머리 위로 들었다가 땅을 친다
    slam: anim(8, 0.9, K(8, [
      [0, { hy: -0.08, crx: 8, Ra: -70, Rr: 1.1, Ry: 1.0, La: 70, Lr: 1.1, Ly: 1.0 }],
      [1, { hy: -0.03, crx: -5, drx: -4, Ra: -66, Rr: 0.92, Ry: 1.9, La: 66, Lr: 0.92, Ly: 1.9 }],
      [2, { hy: 0.0, crx: -12, drx: -8, Ra: -60, Rr: 0.72, Ry: 2.42, La: 60, Lr: 0.72, Ly: 2.42 }],
      [3, { hy: 0.0, crx: -14, drx: -9, Ra: -58, Rr: 0.7, Ry: 2.46, La: 58, Lr: 0.7, Ly: 2.46 }],
      [4, { hy: -0.1, hz: 0.08, crx: 8, drx: -4, Ra: -50, Rr: 1.2, Ry: 1.5, La: 50, Lr: 1.2, Ly: 1.5, Fz: 0.2, Gz: -0.2 }],
      [5, { hy: -0.26, hz: 0.1, crx: 15, drx: -10, Ra: -46, Rr: 1.2, Ry: 0.3, La: 46, Lr: 1.2, Ly: 0.3, Fz: 0.24, Gz: -0.24 }],
      [6, { hy: -0.24, hz: 0.1, crx: 14, drx: -10, Ra: -48, Rr: 1.2, Ry: 0.34, La: 48, Lr: 1.2, Ly: 0.34, Fz: 0.24, Gz: -0.24 }],
      [7, { hy: -0.12, hz: 0.05, crx: 8, drx: -3, Ra: -64, Rr: 1.14, Ry: 0.7, La: 64, Lr: 1.14, Ly: 0.7, Fz: 0.16, Gz: -0.16 }],
    ])),
    // 오른팔로 크게 후리기
    sweep: anim(8, 0.8, K(8, [
      [0, { cry: -14, hry: -6, hy: -0.06, Ra: -110, Rr: 1.2, Ry: 1.2, La: 66, Ly: 1.0 }],
      [1, { cry: -28, hry: -12, hy: -0.08, Ra: -142, Rr: 1.22, Ry: 1.34, La: 58, Ly: 1.04 }],
      [2, { cry: -30, hry: -14, hy: -0.09, Ra: -152, Rr: 1.22, Ry: 1.36, La: 54, Ly: 1.04 }],
      [3, { cry: -4, hry: 0, hy: -0.12, hz: 0.05, Ra: -62, Rr: 1.28, Ry: 1.0, La: 70, Ly: 0.96, Fz: 0.2, Gz: -0.2 }],
      [4, { cry: 22, hry: 10, hy: -0.14, hz: 0.08, Ra: 12, Rr: 1.3, Ry: 0.84, La: 96, Ly: 0.9, Fz: 0.24, Gz: -0.22 }],
      [5, { cry: 32, hry: 14, hy: -0.13, hz: 0.07, Ra: 62, Rr: 1.22, Ry: 0.8, La: 116, Ly: 0.88, Fz: 0.24, Gz: -0.22 }],
      [6, { cry: 28, hry: 12, hy: -0.1, hz: 0.05, Ra: 58, Rr: 1.18, Ry: 0.84, La: 108, Ly: 0.9, Fz: 0.18, Gz: -0.16 }],
      [7, { cry: 10, hry: 4, hy: -0.06, hz: 0.02, Ra: -40, Rr: 1.14, Ry: 0.9, La: 88, Ly: 0.92, Fz: 0.12, Gz: -0.12 }],
    ])),
    // 팔을 벌리고 가슴의 눈을 빛낸다
    cast: anim(8, 1.0, K(8, [
      [0, { hy: -0.08, crx: 8, 'eye.s': 0.92, Ra: -60, Rr: 0.95, Ry: 0.72, La: 60, Lr: 0.95, Ly: 0.72 }],
      [1, { hy: -0.12, crx: 12, 'eye.s': 0.86, Ra: -46, Rr: 0.85, Ry: 0.6, La: 46, Lr: 0.85, Ly: 0.6 }],
      [2, { hy: -0.03, crx: -8, drx: -6, 'eye.s': 1.2, Ra: -96, Rr: 1.1, Ry: 1.68, La: 96, Lr: 1.1, Ly: 1.68 }],
      [3, { hy: 0.0, crx: -12, drx: -8, 'eye.s': 1.42, Ra: -102, Rr: 1.05, Ry: 2.06, La: 102, Lr: 1.05, Ly: 2.06 }],
      [4, { hy: 0.0, crx: -13, drx: -8, 'eye.s': 1.5, Ra: -104, Rr: 1.04, Ry: 2.12, La: 104, Lr: 1.04, Ly: 2.1 }],
      [5, { hy: 0.0, crx: -12, drx: -8, 'eye.s': 1.42, Ra: -102, Rr: 1.05, Ry: 2.08, La: 102, Lr: 1.05, Ly: 2.1 }],
      [6, { hy: -0.03, crx: -6, drx: -4, 'eye.s': 1.2, Ra: -96, Rr: 1.1, Ry: 1.62, La: 96, Lr: 1.1, Ly: 1.62 }],
      [7, { hy: -0.05, crx: 0, 'eye.s': 1.04, Ra: -86, Rr: 1.12, Ry: 1.08, La: 86, Lr: 1.12, Ly: 1.08 }],
    ])),
    hit: anim(3, 0.3, K(3, [
      [0, { hz: -0.08, hy: -0.05, crx: -10, drx: -8, 'eye.s': 0.84, Ra: -92, La: 92, Ry: 1.08, Ly: 1.08 }],
      [1, { hz: -0.1, hy: -0.08, crx: -5, drx: -4, 'eye.s': 0.9, Ra: -88, La: 88, Ry: 1.0, Ly: 1.0 }],
      [2, { hz: -0.04, hy: -0.05, crx: 1, 'eye.s': 0.96, Ra: -84, La: 84, Ry: 0.94, Ly: 0.94 }],
    ])),
    // 무릎이 꺾이며 주저앉고 눈이 꺼진다
    death: anim(12, 1.6, bakeKeys(12, [
      [0, { hz: -0.04, hy: -0.05, crx: -6, drx: -5, 'eye.s': 1.2, Ra: -96, La: 96, Ry: 1.2, Ly: 1.2 }],
      [1, { hz: -0.05, hy: -0.1, crx: -7, drx: -5, 'eye.s': 1.3, Ra: -102, La: 102, Ry: 1.34, Ly: 1.34 }],
      [2, { hz: -0.05, hy: -0.16, crx: -5, drx: -3, 'eye.s': 1.1, Ra: -104, La: 104, Ry: 1.2, Ly: 1.2 }],
      [3, { hz: -0.04, hy: -0.24, crx: -2, drx: -2, 'eye.s': 0.95, Ra: -100, La: 100, Ry: 1.05, Ly: 1.05, Fz: 0.14, Gz: -0.04 }],
      [4, { hz: -0.02, hy: -0.34, crx: 4, drx: 0, 'eye.s': 0.85, Ra: -96, La: 96, Ry: 0.95, Ly: 0.95, Fz: 0.18, Gz: -0.02 }],
      [5, { hy: -0.42, crx: 8, drx: 2, 'eye.s': 0.72, Ra: -90, La: 90, Ry: 0.88, Ly: 0.86, Fz: 0.2, Gz: 0.0 }],
      [6, { hz: 0.0, hy: -0.48, crx: 12, drx: 4, crz: 4, 'eye.s': 0.56, Ra: -82, La: 84, Ry: 0.82, Ly: 0.78, Fz: 0.22, Gz: 0.02 }],
      [7, { hz: 0.0, hy: -0.52, crx: 16, drx: 5, crz: 6, 'eye.s': 0.4, Ra: -76, La: 78, Ry: 0.76, Ly: 0.72, Fz: 0.24, Gz: 0.02 }],
      [8, { hz: 0.0, hy: -0.55, crx: 19, drx: 6, crz: 7, 'eye.v': 0, 'eyeOff.v': 1, Ra: -72, La: 74, Ry: 0.72, Ly: 0.7, Fz: 0.24, Gz: 0.02 }],
      [9, { hz: 0.0, hy: -0.57, crx: 21, drx: 7, crz: 8, 'eye.v': 0, 'eyeOff.v': 1, Ra: -70, La: 72, Ry: 0.72, Ly: 0.7, Fz: 0.24, Gz: 0.02 }],
      [10, { hz: 0.0, hy: -0.58, crx: 22, drx: 7, crz: 8, 'eye.v': 0, 'eyeOff.v': 1, Ra: -70, La: 72, Ry: 0.72, Ly: 0.7, Fz: 0.24, Gz: 0.02 }],
      [11, { hz: 0.0, hy: -0.58, crx: 22, drx: 7, crz: 8, 'eye.v': 0, 'eyeOff.v': 1, Ra: -70, La: 72, Ry: 0.72, Ly: 0.7, Fz: 0.24, Gz: 0.02 }],
    ], B)),
  };
  return h;
}

// ---------- 등불 기사 ----------
function buildWarden() {
  const h = new Human({ hipH: 1.0, hipW: 0.3, thigh: 0.54, shin: 0.54, ankle: 0.14, stance: 0.36, spine: 0.08, shoulderY: 1.1, shoulderW: 0.74, upper: 0.62, fore: 0.62, headY: 1.2, toe: 0.3, heel: 0.14, limits: { R: 2.0, down: 38, up: 146 } });
  const steel = M('#3d4454', { metal: 1, thr: [0.36, 0.56, 0.9], ramp: [[24, 26, 38], [38, 42, 56], [61, 68, 84], [110, 120, 142]] });
  const steelL = M('#566076', { metal: 1, thr: [0.36, 0.56, 0.86], ramp: [[34, 38, 52], [56, 62, 80], [86, 96, 118], [150, 162, 184]] });
  const trim = M('#a58a4a', { metal: 1 });
  const under = M('#23232e');
  const blueFire = GLOW.blue();
  // 흉갑
  const t = eg(group(), 'torso');
  t.add(at(sph(0.66, 0.68, 0.47, steel, 20), 0, 0.68, 0));
  t.add(at(sph(0.5, 0.36, 0.38, steelL, 16), 0, 0.2, 0));
  t.add(at(box(0.08, 1.04, 0.05, trim), 0, 0.68, 0.46, -2));
  t.add(at(box(0.74, 0.07, 0.05, trim), 0, 0.84, 0.4, -18));
  // 가슴에 비치는 푸른 틈
  t.add(at(box(0.05, 0.3, 0.03, blueFire), 0.18, 0.62, 0.43, -4, 8, 8));
  t.add(at(box(0.04, 0.22, 0.03, blueFire), -0.2, 0.56, 0.42, -4, -8, -14));
  h.chest.add(t);
  // 목깃과 불꽃
  const gorget = eg(group(), 'gorget');
  gorget.add(at(lathe([[0.2, 1.14], [0.42, 1.2], [0.46, 1.32], [0.36, 1.3], [0.2, 1.24]], steelL, 14), 0, 0, 0));
  h.chest.add(gorget);
  const neckFl = h.node('neckFlame', h.chest, 0, 1.24, 0);
  for (const [x, z, s, n] of [[0.26, 0.1, 1, 'nf1'], [-0.26, 0.08, 0.9, 'nf2'], [0.03, -0.26, 1.05, 'nf3']]) neckFl.add(eg(at(cone(0.1 * s, 0.36 * s, blueFire, 7), x, 0.16 * s, z), 'neckfire'));
  // 어깨 갑옷 + 가시
  for (const s of [1, -1]) {
    const p = eg(group(), 'pauld' + s);
    p.add(at(sph(0.38, 0.3, 0.38, steelL, 14), s * 0.78, 1.14, 0));
    p.add(at(tor(0.34, 0.03, trim, Math.PI * 2, 18, 5), s * 0.78, 1.0, 0, 90));
    for (const [dx, dz] of [[0.12, 0.1], [0.14, -0.14], [-0.06, 0]]) p.add(at(cone(0.075, 0.34, trim, 5), s * (0.78 + dx), 1.46, dz, 0, 0, s * -14));
    h.chest.add(p);
    const fl = h.node('shFlame' + s, h.chest, s * 0.82, 1.42, 0);
    fl.add(eg(at(cone(0.09, 0.3, blueFire, 6), s * -0.2, 0.02, 0.1), 'shf' + s));
  }
  // 허리 치마 갑옷
  const sk = eg(group(), 'tasset');
  sk.add(at(robeSkirt(0.44, 0.62, 0.48, M('#3e4454', { side: THREE.DoubleSide, thr: [0.36, 0.56, 0.9], ramp: [[22, 24, 34], [34, 38, 50], [50, 56, 72], [78, 86, 106]] }), 8, 0.08), 0, 0.02, 0));
  sk.add(at(cyl(0.47, 0.47, 0.08, trim, 14), 0, 0.03, 0));
  h.hips.add(sk);
  // 망토 (찢어진 남색)
  const capeM = M('#2a3560', { side: THREE.DoubleSide, thr: [0.3, 0.5, 0.95], ramp: [[20, 24, 44], [28, 34, 62], [38, 48, 84], [48, 60, 104]] });
  h.cape1 = h.node('cape1', h.chest, 0, 1.18, -0.38);
  const c1 = new THREE.CylinderGeometry(0.6, 0.78, 1.1, 22, 3, true, Math.PI - 1.75, 3.5);
  c1.computeVertexNormals();
  const cm1 = rawMesh(c1, capeM);
  cm1.scale.z = 0.5;
  h.cape1.add(eg(at(cm1, 0, -0.55, 0.05), 'cape'));
  h.cape2 = h.node('cape2', h.cape1, 0, -1.08, -0.02);
  const c2 = new THREE.CylinderGeometry(0.78, 0.9, 0.62, 24, 2, true, Math.PI - 1.75, 3.5);
  const p2 = c2.attributes.position;
  const rr = rng(5);
  const memo = new Map();
  for (let i = 0; i < p2.count; i++) {
    if (p2.getY(i) < -0.3) {
      const k = Math.round(p2.getX(i) * 100) + Math.round(p2.getZ(i) * 10000);
      if (!memo.has(k)) memo.set(k, rr() * 0.34);
      p2.setY(i, p2.getY(i) + memo.get(k));
    }
  }
  c2.computeVertexNormals();
  const cm2 = rawMesh(c2, capeM);
  cm2.scale.z = 0.5;
  h.cape2.add(eg(at(cm2, 0, -0.3, 0.05), 'cape'));
  // 다리
  for (const [u, l, f, s] of [[h.thighL, h.shinL, h.footL, 1], [h.thighR, h.shinR, h.footR, -1]]) {
    u.add(eg(bone(0.22, 0.18, h.d.thigh, under, 10), 'tg' + s));
    u.add(eg(at(cyl(0.22, 0.19, 0.38, steel, 10), 0, -0.22, 0.02), 'tg' + s));
    l.add(eg(bone(0.17, 0.17, h.d.shin, steel, 10), 'sh' + s));
    l.add(eg(at(sph(0.17, 0.17, 0.14, steelL, 10), 0, 0, 0.1), 'knee' + s));
    l.add(eg(at(box(0.05, 0.42, 0.04, trim), 0, -0.26, 0.165), 'sh' + s));
    f.add(eg(at(rbox(0.32, 0.22, 0.56, 0.08, steelL), 0, -0.03, 0.1), 'sh' + s));
  }
  // 팔
  for (const [u, l, g, s] of [[h.upperL, h.foreL, h.handL, 1], [h.upperR, h.foreR, h.handR, -1]]) {
    u.add(eg(bone(0.17, 0.14, h.d.upper, under, 10), 'ar' + s));
    u.add(eg(at(cyl(0.17, 0.15, 0.36, steel, 10), 0, -0.34, 0), 'ar' + s));
    l.add(eg(bone(0.14, 0.14, h.d.fore, steel, 10), 'fr' + s));
    l.add(eg(at(cyl(0.16, 0.19, 0.24, steelL, 10), 0, -0.46, 0), 'fr' + s));
    g.add(eg(at(rbox(0.26, 0.26, 0.26, 0.06, steelL), 0, 0, 0), 'fr' + s));
  }
  // 왼손 불꽃 (시전)
  const hf = h.node('handFire', h.handL);
  hf.add(eg(at(lathe([[0, 0], [0.16, 0.06], [0.2, 0.2], [0.13, 0.44], [0.05, 0.64], [0, 0.74]], blueFire, 12), 0, 0.1, 0), 'handfire'));
  // 머리 대신 등불
  const lamp = eg(group(), 'lantern');
  const iron = M('#34343f', { metal: 1 });
  lamp.add(at(cyl(0.1, 0.12, 0.14, iron, 8), 0, 0.03, 0));
  lamp.add(at(cyl(0.33, 0.27, 0.05, iron, 8), 0, 0.12, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    lamp.add(strut([Math.cos(a) * 0.3, 0.13, Math.sin(a) * 0.3], [Math.cos(a) * 0.35, 0.74, Math.sin(a) * 0.35], 0.022, 0.022, iron, 4));
  }
  lamp.add(at(tor(0.34, 0.022, iron, Math.PI * 2, 14, 4), 0, 0.46, 0, 90));
  lamp.add(at(cone(0.46, 0.34, iron, 8), 0, 0.92, 0));
  lamp.add(at(tor(0.08, 0.026, iron, Math.PI * 2, 10, 4), 0, 1.13, 0));
  h.head.add(lamp);
  const flame = h.node('headFlame', h.head, 0, 0.16, 0);
  flame.add(eg(lathe([[0, 0], [0.22, 0.04], [0.29, 0.18], [0.22, 0.38], [0.08, 0.58], [0, 0.68]], G('#1c58c8', '#3a92ee', '#96d8ff', '#ecfdff', [0.3, 0.6, 0.84]), 12), 'flame'));
  // 철퇴: 손잡이(오른손) + 사슬 + 가시 쇠공
  const grip = eg(group(), 'handle');
  grip.add(at(cyl(0.05, 0.05, 0.7, M('#3c3028'), 8), 0, 0, 0.1, 90));
  grip.add(at(cyl(0.09, 0.075, 0.1, trim, 8), 0, 0, 0.46, 90));
  h.gripR.add(grip);
  const ball = eg(group(), 'ball');
  const ballM = M('#4e5262', { metal: 1, thr: [0.36, 0.56, 0.84] });
  ball.add(sph(0.34, 0.34, 0.34, ballM, 18));
  const ico = new THREE.IcosahedronGeometry(1, 0).attributes.position;
  const seen = new Set();
  for (let i = 0; i < ico.count; i++) {
    const v = new THREE.Vector3(ico.getX(i), ico.getY(i), ico.getZ(i)).normalize();
    const k = v.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(k)) continue;
    seen.add(k);
    const c = cone(0.1, 0.3, M('#a58a4a', { metal: 1 }), 6);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    c.position.copy(v).multiplyScalar(0.4);
    ball.add(c);
  }
  h.pivot.add(ball);
  h.ballNode = ball;
  const N = 9;
  const links = [];
  const linkM = M('#7a7f8e', { metal: 1, thr: [0.36, 0.56, 0.8] });
  for (let i = 0; i < N; i++) {
    const m = eg(sph(0.058, 0.058, 0.058, linkM, 8), 'chain');
    h.pivot.add(m);
    links.push(m);
  }
  h.linkNodes = links;
  const A = new THREE.Vector3();
  h.post2 = (P) => {
    h.gripR.updateMatrix();
    A.set(0, 0, 0.5).applyMatrix4(h.gripR.matrix);
    const a = (P.Ma ?? -60) * D2R;
    const Bp = new THREE.Vector3((P.Mr ?? 1.3) * Math.sin(a) + P.hx, P.My ?? 0.36, (P.Mr ?? 1.3) * Math.cos(a) + P.hz);
    ball.position.copy(Bp);
    ball.rotation.set(P.Mspin ? P.Mspin * D2R : 0.4, 0.3, 0);
    const sag = P.Msag ?? 0.2;
    links.forEach((m, i) => {
      const t = (i + 0.5) / N;
      m.position.lerpVectors(A, Bp, t);
      m.position.y -= sag * 4 * t * (1 - t);
    });
  };
  const B = { hy: -0.04, crx: 5, drx: -3, Ra: -74, Rr: 1.12, Ry: 1.16, Wy: -34, Wp: -32, La: 70, Lr: 1.05, Ly: 1.06, Fz: 0.1, Gz: -0.1, c1: 6, c2: 5, Ma: -44, Mr: 1.42, My: 0.42, Msag: 0.14, 'handFire.s': 0.001 };
  const K = (n, keys) => bakeKeys(n, keys, B);
  h.remember();
  const flick = (i, n) => {
    const t = (i / n) * Math.PI * 2;
    return { 'headFlame.sy': 1 + 0.2 * Math.sin(t * 2), 'headFlame.sx': 1 - 0.1 * Math.sin(t * 2), 'headFlame.sz': 1 - 0.1 * Math.sin(t * 2), 'nf1.sy': 1, 'neckFlame.sy': 1 + 0.18 * Math.sin(t * 2 + 1), 'neckFlame.ry': i * 40, 'shFlame1.sy': 1 + 0.2 * Math.sin(t * 2 + 2), 'shFlame-1.sy': 1 + 0.2 * Math.sin(t * 2 + 4) };
  };
  const addFlick = (arr, keep = {}) => arr.map((p, i) => ({ ...p, ...flick(i, arr.length), ...keep }));
  h.anims = {
    idle: anim(6, 1.4, addFlick([0, 1, 2, 3, 4, 5].map((i) => {
      const t = (i / 6) * Math.PI * 2;
      return { ...B, hy: -0.04 - 0.024 * (1 - Math.cos(t)), crx: 5 + 1.4 * Math.sin(t), drx: -3 - 2 * Math.sin(t), Ry: 1.16 - 0.03 * (1 - Math.cos(t)), Ly: 1.06 - 0.03 * (1 - Math.cos(t)), My: 0.42, c1: 6 + 2 * Math.sin(t), c2: 5 + 2 * Math.cos(t) };
    })), true),
    walk: anim(8, 1.0, addFlick(walkFrames(8, {
      stride: 0.32, lift: 0.15, bob: 0.02, sway: 0.03,
      extra: (ph, c, s) => ({ ...B, hy: -0.07 + 0.026 * Math.cos(2 * ph), hrz: -1 * s, crz: -0.8 * s, cry: -5 * c, Ra: -74 + 10 * c, La: 70 + 12 * c, Ry: 1.16, Ly: 1.06, Ma: -44 + 8 * c, My: 0.44 + 0.04 * Math.cos(2 * ph), crx: 7, c1: 14 + 3 * Math.cos(2 * ph), c2: 8 }),
    })), true),
    // 철퇴를 머리 위로 휘돌려 내리찍기
    slam: anim(8, 0.9, addFlick(K(8, [
      [0, { hy: -0.08, crx: 6, cry: -14, Ra: -96, Rr: 1.05, Ry: 1.3, Wy: -90, Wp: 6, Ma: -120, Mr: 1.5, My: 0.9, Msag: 0.2, La: 60, Gz: -0.18 }],
      [1, { hy: -0.05, crx: -4, cry: -20, Ra: -84, Rr: 0.9, Ry: 1.96, Wy: -60, Wp: 50, Ma: -150, Mr: 1.2, My: 2.3, Msag: 0.1, La: 56, Gz: -0.2 }],
      [2, { hy: -0.02, crx: -6, cry: -14, Ra: -50, Rr: 0.62, Ry: 2.3, Wy: -20, Wp: 80, Ma: -40, Mr: 0.5, My: 2.86, Msag: 0.06, La: 56, Ly: 1.16, Gz: -0.2, c1: 12 }],
      [3, { hy: -0.03, crx: -7, cry: -8, Ra: -38, Rr: 0.56, Ry: 2.32, Wy: -10, Wp: 86, Ma: -10, Mr: 0.7, My: 2.84, Msag: 0.04, La: 58, Ly: 1.18, Gz: -0.2, c1: 14 }],
      [4, { hy: -0.1, hz: 0.06, crx: 8, cry: 2, Ra: -22, Rr: 0.95, Ry: 1.8, Wy: -6, Wp: 28, Ma: -8, Mr: 1.3, My: 2.2, Msag: 0.02, La: 76, Fz: 0.24, Gz: -0.24, c1: 14 }],
      [5, { hy: -0.24, hz: 0.06, crx: 16, drx: -6, cry: 4, Ra: -16, Rr: 0.9, Ry: 1.0, Wy: -4, Wp: -22, Ma: -6, Mr: 1.3, My: 0.42, Msag: 0.04, La: 86, Fz: 0.28, Gz: -0.28, c1: 18, c2: 10 }],
      [6, { hy: -0.22, hz: 0.06, crx: 15, drx: -6, cry: 4, Ra: -18, Rr: 0.9, Ry: 0.96, Wy: -4, Wp: -26, Ma: -6, Mr: 1.3, My: 0.4, Msag: 0.1, La: 86, Fz: 0.28, Gz: -0.28, c1: 22, c2: 10 }],
      [7, { hy: -0.12, hz: 0.03, crx: 8, cry: 0, Ra: -52, Rr: 1.0, Ry: 1.08, Wy: -22, Wp: -28, Ma: -28, Mr: 1.4, My: 0.4, Msag: 0.16, La: 78, Fz: 0.18, Gz: -0.18 }],
    ]))),
    // 크게 휘돌리기
    sweep: anim(8, 0.8, addFlick(K(8, [
      [0, { hy: -0.06, cry: -20, hry: -6, Ra: -112, Rr: 1.12, Ry: 1.3, Wy: -112, Wp: 0, Ma: -130, Mr: 1.5, My: 0.9, Msag: 0.12, La: 58, Gz: -0.16 }],
      [1, { hy: -0.08, cry: -32, hry: -12, Ra: -140, Rr: 1.12, Ry: 1.36, Wy: -146, Wp: 2, Ma: -168, Mr: 1.54, My: 1.1, Msag: 0.06, La: 52, Gz: -0.18 }],
      [2, { hy: -0.1, cry: -24, hry: -8, Ra: -112, Rr: 0.98, Ry: 1.34, Wy: -96, Wp: 0, Ma: -126, Mr: 1.56, My: 1.2, Msag: 0.02, La: 60, Gz: -0.2, c1: 20 }],
      [3, { hy: -0.14, cry: -2, hz: 0.06, Ra: -36, Rr: 0.98, Ry: 1.22, Wy: -24, Wp: 0, Ma: -46, Mr: 1.5, My: 1.2, Msag: 0.0, La: 80, Fz: 0.24, Gz: -0.22, c1: 16 }],
      [4, { hy: -0.16, cry: 22, hry: 8, hz: 0.08, Ra: 36, Rr: 0.98, Ry: 1.16, Wy: 42, Wp: 0, Ma: 38, Mr: 1.5, My: 1.16, Msag: 0.0, La: 104, Fz: 0.26, Gz: -0.24, c1: 18, c2: 10 }],
      [5, { hy: -0.15, cry: 34, hry: 12, hz: 0.07, Ra: 72, Rr: 0.98, Ry: 1.1, Wy: 84, Wp: -6, Ma: 96, Mr: 1.5, My: 1.0, Msag: 0.04, La: 118, Fz: 0.26, Gz: -0.24, c1: 16, c2: 10 }],
      [6, { hy: -0.11, cry: 28, hry: 10, hz: 0.05, Ra: 58, Rr: 0.98, Ry: 1.1, Wy: 66, Wp: -18, Ma: 120, Mr: 1.5, My: 0.66, Msag: 0.12, La: 106, Fz: 0.2, Gz: -0.18, c1: 12 }],
      [7, { hy: -0.07, cry: 10, hz: 0.02, Ra: -24, Rr: 1.12, Ry: 1.14, Wy: -20, Wp: -28, Ma: 40, Mr: 1.36, My: 0.42, Msag: 0.16, La: 84, Fz: 0.14, Gz: -0.14 }],
    ]))),
    // 왼손에 푸른 불꽃을 피운다
    cast: anim(8, 1.0, K(8, [
      [0, { hy: -0.08, crx: 8, La: 40, Lr: 0.86, Ly: 0.9, 'handFire.s': 0.3, 'headFlame.s': 0.9 }],
      [1, { hy: -0.12, crx: 12, drx: 4, La: 30, Lr: 0.8, Ly: 0.84, 'handFire.s': 0.46, 'headFlame.s': 0.82 }],
      [2, { hy: -0.03, crx: -6, drx: -6, La: 44, Lr: 0.82, Ly: 2.16, 'handFire.s': 0.86, 'headFlame.s': 1.2, 'neckFlame.sy': 1.3 }],
      [3, { hy: 0.0, crx: -5, drx: -4, La: 46, Lr: 0.82, Ly: 2.1, 'handFire.s': 0.78, 'headFlame.s': 1.2, 'neckFlame.sy': 1.5, c1: 14 }],
      [4, { hy: 0.0, crx: -5, drx: -4, La: 46, Lr: 0.82, Ly: 2.12, 'handFire.s': 0.86, 'headFlame.sy': 1.2, 'headFlame.s': 1.2, 'neckFlame.sy': 1.7, c1: 16 }],
      [5, { hy: 0.0, crx: -5, drx: -4, La: 46, Lr: 0.82, Ly: 2.1, 'handFire.s': 0.78, 'headFlame.s': 1.2, 'neckFlame.sy': 1.5, c1: 14 }],
      [6, { hy: -0.03, crx: -4, drx: -4, La: 50, Lr: 0.88, Ly: 1.9, 'handFire.s': 0.6, 'headFlame.s': 1.14, 'neckFlame.sy': 1.2 }],
      [7, { hy: -0.05, crx: 2, La: 62, Lr: 1.0, Ly: 1.3, 'handFire.s': 0.1, 'headFlame.s': 1 }],
    ])),
    hit: anim(3, 0.3, addFlick(K(3, [
      [0, { hz: -0.05, hy: -0.06, crx: -6, drx: -6, cry: -6, Ra: -86, Ry: 1.26, La: 84, Ly: 1.16, Ma: -50, My: 0.5, c1: 16 }],
      [1, { hz: -0.06, hy: -0.1, crx: -3, drx: -4, cry: -3, Ra: -82, Ry: 1.2, La: 78, Ly: 1.1, Ma: -48, My: 0.44, c1: 12 }],
      [2, { hz: -0.04, hy: -0.06, crx: 2, Ra: -76, Ry: 1.17, La: 72, Ly: 1.07, Ma: -45, My: 0.42 }],
    ]))),
    // 무릎 꿇고 등불이 꺼진다
    death: anim(12, 1.6, bakeKeys(12, [
      [0, { hz: -0.04, hy: -0.06, crx: -6, drx: -6, Ra: -88, Ry: 1.3, La: 86, Ly: 1.2, Ma: -56, Mr: 1.4, My: 0.6, 'headFlame.s': 1.3, 'neckFlame.s': 1.2 }],
      [1, { hz: -0.05, hy: -0.12, crx: -7, drx: -8, Ra: -92, Ry: 1.36, La: 90, Ly: 1.26, Ma: -56, Mr: 1.4, My: 0.7, 'headFlame.s': 1.4, 'neckFlame.s': 1.2 }],
      [2, { hz: -0.04, hy: -0.2, crx: -4, drx: -5, Ra: -86, Rr: 1.05, Ry: 1.16, La: 86, Ly: 1.1, Ma: -56, Mr: 1.4, My: 0.5, 'headFlame.s': 1.2, 'neckFlame.s': 1 }],
      [3, { hz: -0.02, hy: -0.32, crx: 2, drx: -2, Ra: -80, Rr: 1.1, Ry: 0.92, Wp: -40, La: 80, Ly: 0.92, Ma: -56, Mr: 1.4, My: 0.4, Fz: 0.24, Gz: -0.1, 'headFlame.s': 1, 'neckFlame.s': 0.9 }],
      [4, { hy: -0.46, crx: 10, drx: 6, Ra: -74, Rr: 1.1, Ry: 0.72, Wp: -48, La: 76, Ly: 0.74, Ma: -52, Mr: 1.4, My: 0.36, Fz: 0.3, Gz: -0.12, 'headFlame.s': 0.85, 'neckFlame.s': 0.8 }],
      [5, { hz: 0.03, hy: -0.58, crx: 16, drx: 12, Ra: -70, Rr: 1.1, Ry: 0.56, Wp: -56, La: 72, Ly: 0.56, Ma: -50, Mr: 1.4, My: 0.36, Fz: 0.32, Gz: -0.12, 'headFlame.s': 0.72, 'neckFlame.s': 0.7 }],
      [6, { hz: 0.05, hy: -0.66, crx: 22, drx: 18, Ra: -66, Rr: 1.1, Ry: 0.44, Wp: -60, La: 68, Ly: 0.44, Ma: -48, Mr: 1.4, My: 0.36, Fz: 0.32, Gz: -0.12, 'headFlame.s': 0.56, 'neckFlame.s': 0.56 }],
      [7, { hz: 0.06, hy: -0.7, crx: 26, drx: 24, Ra: -64, Rr: 1.1, Ry: 0.38, Wp: -62, La: 66, Ly: 0.38, Ma: -48, Mr: 1.4, My: 0.36, Fz: 0.32, Gz: -0.12, 'headFlame.s': 0.42, 'neckFlame.s': 0.42 }],
      [8, { hz: 0.07, hy: -0.72, crx: 28, drx: 28, Ra: -62, Rr: 1.1, Ry: 0.36, Wp: -62, La: 64, Ly: 0.36, Ma: -48, Mr: 1.4, My: 0.36, Fz: 0.32, Gz: -0.12, 'headFlame.s': 0.3, 'neckFlame.s': 0.28 }],
      [9, { hz: 0.08, hy: -0.73, crx: 30, drx: 30, Ra: -62, Rr: 1.1, Ry: 0.34, Wp: -62, La: 64, Ly: 0.34, Ma: -48, Mr: 1.4, My: 0.36, Fz: 0.32, Gz: -0.12, 'headFlame.s': 0.18, 'neckFlame.s': 0.16 }],
      [10, { hz: 0.08, hy: -0.74, crx: 31, drx: 31, Ra: -62, Rr: 1.1, Ry: 0.33, Wp: -62, La: 64, Ly: 0.33, Ma: -48, Mr: 1.4, My: 0.36, Fz: 0.32, Gz: -0.12, 'headFlame.s': 0.08, 'neckFlame.s': 0.06 }],
      [11, { hz: 0.08, hy: -0.74, crx: 32, drx: 32, Ra: -62, Rr: 1.1, Ry: 0.33, Wp: -62, La: 64, Ly: 0.33, Ma: -48, Mr: 1.4, My: 0.36, Fz: 0.32, Gz: -0.12, 'headFlame.v': 0, 'neckFlame.v': 0, 'shFlame1.v': 0, 'shFlame-1.v': 0 }],
    ], B)),
  };
  // 쇠공이 칸 밖으로 나가지 않게 기본값을 포즈에 채운다
  return h;
}

export const BOSSES = {
  elder: { kind: 'boss', build: buildElder },
  warden: { kind: 'boss', build: buildWarden },
};
