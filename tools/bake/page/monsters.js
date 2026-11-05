// 일반 몬스터 여덟 종.
import { THREE, D2R, at, group, eg, box, rbox, sph, cyl, cone, tor, bone, lathe, taper, blob, strut, rawMesh, rng } from './kit.js';
import { M, G, GLOW } from './core.js';
import { Human, Quad, Rig, bakeKeys, walkFrames, trotFrames } from './rig.js';
import { addLegs, addArms, cap, skinMat } from './parts.js';
import { robeSkirt, idleFrames, hood } from './humans.js';

const anim = (frames, dur, poses, loop = false) => ({ frames, dur, poses, loop });
const flat = (mat, rx, ry, rz, seed, disp = 0.2, detail = 1) => blob(rx, ry, rz, mat, { seed, disp, detail, flat: true });

// ---------- 버섯 병사 ----------
function buildMushroom() {
  const h = new Human({ holdR: { fwd: 0.58, back: 0.1 }, hipH: 0.24, thigh: 0.11, shin: 0.11, ankle: 0.045, stance: 0.11, hipW: 0.1, spine: 0.02, shoulderY: 0.2, shoulderW: 0.235, upper: 0.12, fore: 0.12, headY: 0.47, toe: 0.09 });
  const stem = M('#ecdfc4', { thr: [0.3, 0.46, 0.88] });
  const red = M('#c93e2e', { thr: [0.3, 0.46, 0.86], hi: 0.2 });
  const under = M('#d7b58e');
  // 몸통 = 굵은 줄기
  const b = eg(group(), 'stem');
  b.add(at(lathe([[0.15, -0.08], [0.25, 0.0], [0.265, 0.14], [0.24, 0.32], [0.2, 0.56], [0.0, 0.56]], stem, 14), 0, 0, 0));
  // 얼굴
  for (const s of [1, -1]) {
    b.add(at(sph(0.042, 0.06, 0.014, M('#241a2c', { e: 1 }), 8), s * 0.09, 0.3, 0.222, 0, s * 22));
    b.add(at(box(0.09, 0.022, 0.02, M('#6a2a22', { e: 1 })), s * 0.09, 0.372, 0.212, 8, s * 22, s * -16));
  }
  b.add(at(box(0.08, 0.016, 0.01, M('#7a4a3a', { e: 1 })), 0, 0.2, 0.255));
  h.chest.add(b);
  // 갓
  const c = eg(group(), 'cap');
  c.add(at(lathe([[0, 0.28], [0.19, 0.26], [0.34, 0.16], [0.44, 0.03], [0.47, -0.05], [0.4, -0.09], [0.0, -0.06]], red, 18), 0, 0.12, 0));
  const spot = M('#fff3dc', { thr: [0.24, 0.3, 0.98], ao: 0 });
  for (const [az, el, r] of [[0, 62, 0.075], [60, 40, 0.06], [-60, 40, 0.06], [120, 50, 0.07], [-120, 50, 0.07], [180, 50, 0.06], [30, 20, 0.05], [-30, 20, 0.05], [90, 14, 0.05], [-90, 14, 0.05], [150, 16, 0.05], [-150, 16, 0.05], [0, 90, 0.07]]) {
    const a = az * D2R;
    const e = el * D2R;
    const R = 0.43;
    c.add(at(sph(r, r * 0.45, r, spot, 8), Math.sin(a) * Math.cos(e) * R * 1.0, 0.12 + Math.sin(e) * 0.29 + 0.01, Math.cos(a) * Math.cos(e) * R));
  }
  c.add(at(cyl(0.39, 0.39, 0.015, under, 14), 0, 0.035, 0));
  h.head.add(c);
  addLegs(h, { thigh: stem, shin: stem, boot: M('#6a4a30'), rT: 0.07, rS: 0.065, bootW: 0.15, bootL: 0.2, bootH: 0.09 });
  addArms(h, { upper: stem, fore: stem, hand: stem, rU: 0.055, rF: 0.05, rH: 0.06 });
  // 나무 곤봉 (오른손)
  const club = eg(group(), 'club');
  const w = M('#8a5c34', { noise: [12, 0.12] });
  club.add(at(cyl(0.028, 0.03, 0.3, w, 8), 0, 0, 0.06, 90));
  club.add(at(cyl(0.1, 0.06, 0.34, w, 8), 0, 0, 0.36, 90));
  club.add(at(cone(0.03, 0.08, M('#4a3020'), 5), 0.1, 0, 0.42, 0, 0, -90));
  club.add(at(cone(0.03, 0.08, M('#4a3020'), 5), -0.1, 0, 0.36, 0, 0, 90));
  club.add(at(cone(0.03, 0.08, M('#4a3020'), 5), 0, 0.09, 0.44));
  h.gripR.add(club);
  const B = { Ra: -66, Rr: 0.36, Ry: 0.36, Wy: -10, Wp: 28, La: 62, Lr: 0.34, Ly: 0.32, Fz: 0.03, Gz: -0.03 };
  const K = (n, keys) => bakeKeys(n, keys, B);
  h.remember();
  h.anims = {
    idle: anim(4, 0.8, bakeKeys(4, [[0, {}], [1, { hy: -0.012, Ry: 0.35, Ly: 0.31, crx: 1 }], [2, { hy: -0.02, Ry: 0.34, Ly: 0.3, crx: 2, drx: -2 }], [3, { hy: -0.012, Ry: 0.35, Ly: 0.31, crx: 1 }]], B, true), true),
    walk: anim(6, 0.6, walkFrames(6, {
      stride: 0.11, lift: 0.07, bob: 0.012,
      extra: (ph, c, s) => ({ ...B, Ra: -66 + 12 * c, La: 62 + 10 * c, hrz: -5 * s, crz: -5 * s, Ry: 0.36, Ly: 0.32, c1: 0, c2: 0, crx: 3, drx: -2 }),
    }), true),
    attack: anim(6, 0.5, K(6, [
      [0, { hy: -0.02, crx: -4, cry: -12, Ra: -62, Rr: 0.34, Ry: 0.56, Wy: -22, Wp: 80, Gz: -0.08 }],
      [1, { hy: 0.0, crx: -10, drx: -4, cry: -16, Ra: -70, Rr: 0.32, Ry: 0.64, Wy: -24, Wp: 118, Gz: -0.1, Fz: 0.04 }],
      [2, { hy: -0.05, hz: 0.03, crx: 10, drx: -6, cry: 6, Ra: -14, Rr: 0.42, Ry: 0.5, Wy: -2, Wp: 10, Fz: 0.13, Gz: -0.12 }],
      [3, { hy: -0.07, hz: 0.03, crx: 13, drx: -6, cry: 8, Ra: -10, Rr: 0.44, Ry: 0.3, Wy: 0, Wp: -22, Fz: 0.14, Gz: -0.13 }],
      [4, { hy: -0.06, hz: 0.03, crx: 11, drx: -6, cry: 6, Ra: -12, Rr: 0.43, Ry: 0.32, Wy: 0, Wp: -18, Fz: 0.13, Gz: -0.12 }],
      [5, { hy: -0.025, hz: 0.01, crx: 4, Ra: -40, Rr: 0.38, Ry: 0.34, Wy: -6, Wp: 12, Fz: 0.07, Gz: -0.07 }],
    ])),
    hit: anim(3, 0.24, K(3, [
      [0, { hz: -0.04, hy: -0.03, crx: -18, drx: -8, Ra: -84, Lr: 0.36, La: 84, Ry: 0.42, Ly: 0.38 }],
      [1, { hz: -0.05, hy: -0.05, crx: -12, drx: -4, Ra: -78, La: 78, Ry: 0.39, Ly: 0.35 }],
      [2, { hz: -0.02, hy: -0.02, crx: -3, Ra: -70, La: 66 }],
    ])),
    death: anim(7, 0.7, K(7, [
      [0, { hz: -0.04, hy: -0.03, crx: -16, drx: -8, Ra: -84, La: 84, Ry: 0.42, Ly: 0.38 }],
      [1, { hz: -0.05, hy: -0.08, crx: -14, drx: -10, Ra: -92, La: 92, Ry: 0.34, Ly: 0.32, Fz: 0.06, Gz: 0.02 }],
      [2, { Prz: 16, Py: 0.0, hy: -0.1, crx: -8, Ra: -100, La: 100, Rr: 0.4, Lr: 0.4, Ry: 0.28, Ly: 0.28 }],
      [3, { Prz: 42, Py: 0.06, Px: 0.16, hy: -0.1, Ra: -106, La: 106, Rr: 0.42, Lr: 0.42, Ry: 0.26, Ly: 0.26 }],
      [4, { Prz: 72, Py: 0.26, Px: 0.34, hy: -0.08, Ra: -110, La: 110, Rr: 0.44, Lr: 0.44, Ry: 0.24, Ly: 0.24 }],
      [5, { Prz: 88, Py: 0.36, Px: 0.46, hy: -0.06, Ra: -112, La: 112, Rr: 0.44, Lr: 0.44, Ry: 0.22, Ly: 0.22 }],
      [6, { Prz: 90, Py: 0.34, Px: 0.46, hy: -0.06, Ra: -114, La: 114, Rr: 0.44, Lr: 0.44, Ry: 0.2, Ly: 0.2 }],
    ])),
  };
  return h;
}

// ---------- 멧돼지 ----------
function buildBoar() {
  const q = new Quad({ bodyH: 0.44, hipX: 0.15, frontZ: 0.3, backZ: -0.34, upper: 0.18, lower: 0.2, shift: -0.1 });
  const hide = M('#6a4630', { noise: [16, 0.2], thr: [0.3, 0.46, 0.84] });
  const hideD = M('#4a3024', { noise: [16, 0.2] });
  const belly = M('#8c6a4e');
  const bodyG = eg(group(), 'body');
  bodyG.add(at(sph(0.3, 0.29, 0.5, hide, 18), 0, 0.03, -0.02));
  bodyG.add(at(sph(0.31, 0.3, 0.28, hideD, 16), 0, 0.09, 0.22));
  bodyG.add(at(sph(0.2, 0.14, 0.32, belly, 12), 0, -0.14, 0));
  q.body.add(bodyG);
  // 등 가시: 두 줄 + 가운데 큰 줄
  const sp = eg(group(), 'spikes');
  const bm = M('#e0d3b0', { thr: [0.3, 0.46, 0.8] });
  const tip = M('#a33a2a', { e: 1 });
  for (let i = 0; i < 7; i++) {
    const z = 0.42 - i * 0.14;
    const y = 0.32 + 0.05 * Math.sin((i / 6) * Math.PI);
    const l = 0.2 + 0.08 * Math.sin((i / 6) * Math.PI);
    sp.add(at(cone(0.045, l, bm, 5), 0, y + l / 2 - 0.02, z, -22));
    if (i > 0 && i < 6)
      for (const s of [1, -1]) sp.add(at(cone(0.033, l * 0.65, bm, 5), s * 0.13, y - 0.03 + l * 0.2, z + 0.03, -18, 0, s * -26));
  }
  q.body.add(sp);
  // 꼬리
  const tail = q.node('tail', q.body, 0, 0.1, -0.5);
  tail.add(eg(at(tor(0.05, 0.016, hideD, Math.PI * 1.5, 10, 4), 0, 0.02, -0.04, 0, 90), 'tail'));
  // 머리
  const head = q.node('head', q.body, 0, 0.04, 0.48);
  const hg = eg(group(), 'head');
  hg.add(at(sph(0.22, 0.21, 0.25, hideD, 14), 0, 0, 0.06));
  hg.add(at(cyl(0.14, 0.11, 0.2, hide, 10), 0, -0.05, 0.27, 94));
  hg.add(at(sph(0.115, 0.09, 0.03, M('#c98a78'), 10), 0, -0.05, 0.375));
  for (const s of [1, -1]) {
    hg.add(at(sph(0.018, 0.022, 0.01, M('#3a2020', { e: 1 }), 5), s * 0.045, -0.05, 0.402));
    // 눈, 귀
    hg.add(at(sph(0.03, 0.036, 0.012, M('#ffd27a', { e: 1 }), 6), s * 0.13, 0.05, 0.22, 0, s * 26));
    hg.add(at(sph(0.015, 0.02, 0.008, M('#201018', { e: 1 }), 5), s * 0.135, 0.05, 0.232, 0, s * 26));
    hg.add(at(cone(0.06, 0.15, hide, 5), s * 0.16, 0.2, -0.02, -14, 0, s * -22));
  }
  q.body.add(eg(head, 'headn'));
  head.add(hg);
  // 엄니
  const tu = eg(group(), 'tusk');
  const ivory = M('#f4ead0', { thr: [0.3, 0.46, 0.84] });
  for (const s of [1, -1]) tu.add(at(cone(0.034, 0.19, ivory, 6), s * 0.115, 0.01, 0.31, 18, 0, s * -22));
  head.add(tu);
  // 다리
  for (const n in q.legs) {
    const L = q.legs[n];
    L.upper.add(eg(bone(0.09, 0.06, q.d.upper, hideD), n));
    L.lower.add(eg(bone(0.055, 0.042, q.d.lower, M('#3a2a22')), n));
    L.foot.add(eg(at(sph(0.058, 0.04, 0.07, M('#221a1a'), 8), 0, -0.01, 0.015), n));
  }
  q.remember();
  q.anims = {
    idle: anim(4, 0.8, bakeKeys(4, [[0, {}], [1, { By: -0.008, 'head.rx': 2 }], [2, { By: -0.014, 'head.rx': 4, 'tail.rz': 14 }], [3, { By: -0.008, 'head.rx': 2 }]], {}, true), true),
    walk: anim(6, 0.6, trotFrames(6, { stride: 0.13, lift: 0.07, extra: (ph, c) => ({ 'head.rx': 3 * Math.cos(2 * ph), 'tail.rz': 18 * c }) }), true),
    // 머리 들이받기
    attack: anim(6, 0.5, bakeKeys(6, [
      [0, { Bz: -0.08, By: -0.05, Brx: 8, 'head.rx': 22, FLz: -0.06, FRz: -0.04, BLz: -0.1, BRz: -0.1 }],
      [1, { Bz: -0.14, By: -0.08, Brx: 12, 'head.rx': 30, FLz: -0.08, FRz: -0.06, BLz: -0.14, BRz: -0.14 }],
      [2, { Bz: 0.1, By: -0.02, Brx: 6, 'head.rx': 26, FLz: 0.12, FRz: 0.04, BLz: 0.02, BRz: -0.04, BLy: 0.05 }],
      [3, { Bz: 0.15, By: 0.02, Brx: -12, 'head.rx': -24, FLz: 0.14, FRz: 0.1, BLz: 0.05, BRz: 0.01 }],
      [4, { Bz: 0.11, By: 0.0, Brx: -4, 'head.rx': -6, FLz: 0.11, FRz: 0.09, BLz: 0.04, BRz: 0.01 }],
      [5, { Bz: 0.06, By: -0.01, Brx: 0, 'head.rx': 4, FLz: 0.05, FRz: 0.04, BLz: 0.02, BRz: 0.0 }],
    ])),
    hit: anim(3, 0.24, bakeKeys(3, [
      [0, { Bz: -0.08, By: 0.02, Brx: -8, 'head.rx': -16, 'head.ry': 8 }],
      [1, { Bz: -0.1, By: -0.02, Brx: -3, 'head.rx': -6, 'head.ry': 4 }],
      [2, { Bz: -0.04, By: -0.01, 'head.rx': 2 }],
    ])),
    death: anim(7, 0.7, bakeKeys(7, [
      [0, { Bz: -0.06, By: 0.01, Brx: -10, 'head.rx': -18 }],
      [1, { Bz: -0.08, By: -0.06, Brx: -4, 'head.rx': -8, Brz: 6, FLz: 0.06, FRz: 0.04 }],
      [2, { Prz: 18, By: -0.1, Bz: -0.06, 'head.rx': 4 }],
      [3, { Prz: 46, Py: 0.06, Px: 0.14, By: -0.14, Bz: -0.04, 'head.rx': 10 }],
      [4, { Prz: 74, Py: 0.14, Px: 0.26, By: -0.16, 'head.rx': 14, FLy: 0.1, BLy: 0.1 }],
      [5, { Prz: 90, Py: 0.19, Px: 0.34, By: -0.17, 'head.rx': 16, FLy: 0.12, BLy: 0.12, FRy: 0.03, BRy: 0.03 }],
      [6, { Prz: 88, Py: 0.17, Px: 0.34, By: -0.18, 'head.rx': 18, FLy: 0.1, BLy: 0.1, FRy: 0.02, BRy: 0.02 }],
    ])),
  };
  return q;
}

// ---------- 도깨비불 ----------
function buildWisp() {
  const r = new Rig();
  const floatN = r.node('float', r.root, 0, 0.62, 0);
  // 이끼 덩어리 몸
  const moss = M('#4a6e36', { noise: [14, 0.3], thr: [0.32, 0.5, 0.82], pat: { c: '#79994a', f: 7, thr: 0.58 }, ao: 0 });
  const body = r.node('body', floatN);
  const bg = eg(group(), 'moss');
  bg.add(at(flat(moss, 0.24, 0.17, 0.24, 3, 0.16, 2), 0, -0.05, 0));
  bg.add(at(flat(moss, 0.1, 0.08, 0.1, 5, 0.2, 1), 0.17, -0.14, 0.08));
  bg.add(at(flat(moss, 0.09, 0.07, 0.09, 7, 0.2, 1), -0.16, -0.15, 0.06));
  bg.add(at(cone(0.05, 0.18, M('#3a5a2c'), 5), 0.05, -0.26, 0.03, 180));
  bg.add(at(cone(0.04, 0.14, M('#3a5a2c'), 5), -0.08, -0.24, -0.04, 180));
  body.add(bg);
  // 불꽃: 세 겹
  const fl = r.node('flame', floatN, 0, 0.1, 0);
  const outerM = GLOW.green();
  const flameShape = (rad, h, m) => lathe([[0, 0], [rad * 0.72, 0.03], [rad, 0.16 * h], [rad * 0.8, 0.42 * h], [rad * 0.38, 0.74 * h], [0, h]], m, 14);
  const of = eg(group(), 'flame');
  of.add(flameShape(0.3, 0.74, outerM));
  for (const [x, z, hh, rr, name] of [[0.17, 0.08, 0.5, 0.11, 't1'], [-0.16, 0.06, 0.44, 0.1, 't2'], [0.0, -0.17, 0.48, 0.11, 't3']]) {
    const n = r.node(name, fl, x, 0.14, z);
    n.add(eg(flameShape(rr, hh, outerM), 'flame'));
  }
  fl.add(of);
  // 눈: 불꽃 표면에
  const eye = r.node('eyes', fl, 0, 0.17, 0.27);
  for (const s of [1, -1]) eye.add(eg(at(sph(0.04, 0.058, 0.02, M('#16402a', { e: 1 }), 8), s * 0.09, 0, -0.012, 0, s * 18), 'flame'));
  // 떠다니는 불티
  const sparkM = M('#b8ffb0', { e: 1 });
  const sparks = [];
  for (let i = 0; i < 3; i++) {
    const n = r.node('sp' + i, floatN);
    n.add(eg(sph(0.03, 0.03, 0.03, sparkM, 6), 'sp' + i));
    sparks.push(n);
  }
  r.remember();
  const fx = (t, big = 1, y = 0, z = 0) => {
    const p = {
      'float.py': y + 0.03 * Math.sin(t),
      'float.pz': z,
      'body.rz': 4 * Math.sin(t + 1),
      'flame.sy': big * (1 + 0.035 * Math.sin(t * 2)),
      'flame.sx': big * (1 - 0.03 * Math.sin(t * 2)),
      'flame.sz': big * (1 - 0.03 * Math.sin(t * 2)),
      'flame.rz': 3 * Math.sin(t),
      't1.sy': 1 + 0.2 * Math.sin(t * 2),
      't2.sy': 1 + 0.2 * Math.sin(t * 2 + 2.1),
      't3.sy': 1 + 0.2 * Math.sin(t * 2 + 4.2),
    };
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      p[`sp${i}.px`] = Math.cos(a) * 0.36;
      p[`sp${i}.pz`] = Math.sin(a) * 0.36;
      p[`sp${i}.py`] = 0.1 + 0.16 * Math.sin(t + i * 2);
    }
    return p;
  };
  const loopN = (n, f) => [...Array(n)].map((_, i) => f((i / n) * Math.PI * 2, i));
  r.anims = {
    idle: anim(4, 0.8, loopN(4, (t) => fx(t)), true),
    walk: anim(6, 0.6, loopN(6, (t) => ({ ...fx(t, 1, 0, 0), 'float.rx': 5, 'flame.rx': -5 })), true),
    attack: anim(6, 0.5, [
      { ...fx(0.0, 0.92, -0.03, -0.08), 'float.rx': -10 },
      { ...fx(1.0, 0.82, -0.06, -0.14), 'float.rx': -14 },
      { ...fx(2.0, 1.18, 0.0, 0.16), 'float.rx': 22 },
      { ...fx(3.0, 1.2, -0.02, 0.18), 'float.rx': 26 },
      { ...fx(4.0, 1.16, 0.0, 0.18), 'float.rx': 14 },
      { ...fx(5.0, 1.05, 0.01, 0.08), 'float.rx': 4 },
    ]),
    hit: anim(3, 0.24, [
      { ...fx(0.3, 0.84, 0.03, -0.14), 'float.rx': -18 },
      { ...fx(1.3, 0.9, 0.0, -0.16), 'float.rx': -10 },
      { ...fx(2.3, 0.98, 0.0, -0.06), 'float.rx': -3 },
    ]),
    death: anim(7, 0.7, [
      { ...fx(0.3, 1.12, 0.04, -0.06), 'float.rx': -10 },
      { ...fx(1.3, 0.96, 0.02, -0.06), 'float.rx': -8 },
      { ...fx(2.3, 0.72, -0.04, -0.04), 'body.rx': 8 },
      { ...fx(3.3, 0.52, -0.14, -0.02), 'body.rx': 18 },
      { ...fx(4.3, 0.34, -0.26, 0), 'body.rx': 28, 'eyes.v': 0, 'sp0.v': 0 },
      { ...fx(5.3, 0.18, -0.38, 0), 'body.rx': 38, 'eyes.v': 0, 'sp0.v': 0, 'sp1.v': 0 },
      { ...fx(6.3, 0.02, -0.46, 0), 'body.rx': 44, 'eyes.v': 0, 'sp0.v': 0, 'sp1.v': 0, 'sp2.v': 0},
    ]),
  };
  return r;
}

// ---------- 재 늑대 ----------
function buildWolf() {
  const q = new Quad({ bodyH: 0.56, hipX: 0.11, frontZ: 0.34, backZ: -0.36, upper: 0.26, lower: 0.28, front: -1, back: -1, shift: 0.02 });
  const fur = M('#8a8580', { noise: [15, 0.18], thr: [0.34, 0.5, 0.84] });
  const furD = M('#5e5a58', { noise: [15, 0.18] });
  const b = eg(group(), 'body');
  b.add(at(sph(0.2, 0.2, 0.46, fur, 16), 0, 0.02, -0.02));
  b.add(at(sph(0.225, 0.235, 0.26, fur, 14), 0, 0.05, 0.22));
  b.add(at(sph(0.13, 0.1, 0.32, M('#b0aba4'), 10), 0, -0.13, 0.02));
  q.body.add(b);
  // 등줄기 빛
  const glow = M('#ff5a2a', { e: 1 });
  const glowH = M('#ffb04a', { e: 1 });
  const ridge = eg(group(), 'ridge');
  for (let i = 0; i < 9; i++) {
    const z = 0.42 - i * 0.1;
    const y = 0.24 + 0.05 * Math.sin((i / 8) * Math.PI) - (i > 6 ? 0.03 : 0);
    const h = 0.08 + 0.05 * ((i + 1) % 2);
    ridge.add(at(cone(0.034, h, i % 2 ? glowH : glow, 4), 0, y + h / 2, z, -12));
  }
  q.body.add(ridge);
  // 꼬리 두 마디
  const t1 = q.node('tail', q.body, 0, 0.1, -0.46);
  t1.rotation.x = 0;
  t1.add(eg(at(sph(0.082, 0.082, 0.16, fur, 10), 0, 0.02, -0.13, -24), 'tail'));
  const t2 = q.node('tail2', t1, 0, 0.07, -0.24);
  t2.add(eg(at(sph(0.06, 0.06, 0.12, furD, 8), 0, 0.02, -0.08, -18), 'tail'));
  t2.add(eg(at(cone(0.028, 0.09, glow, 4), 0, 0.07, -0.1, -40), 'tail'));
  // 머리
  const head = q.node('head', q.body, 0, 0.16, 0.42);
  const hg = eg(group(), 'head');
  hg.add(at(sph(0.15, 0.14, 0.17, fur, 12), 0, 0.03, 0.06));
  hg.add(at(cyl(0.085, 0.05, 0.22, furD, 8), 0, -0.01, 0.26, 86));
  hg.add(at(sph(0.04, 0.032, 0.03, M('#201c20', { e: 1 }), 6), 0, 0.01, 0.37));
  for (const s of [1, -1]) {
    hg.add(at(cone(0.06, 0.17, furD, 4), s * 0.09, 0.2, 0.0, -8, 0, s * -10));
    hg.add(at(sph(0.034, 0.024, 0.012, M('#ff3a2a', { e: 1 }), 6), s * 0.098, 0.06, 0.18, 0, s * 26));
  }
  head.add(hg);
  const jaw = q.node('jaw', head, 0, -0.05, 0.16);
  jaw.add(eg(at(cyl(0.06, 0.04, 0.18, M('#4e4a48'), 7), 0, -0.02, 0.09, 88), 'jaw'));
  jaw.add(eg(at(cone(0.014, 0.05, M('#f4ead0', { e: 1 }), 4), 0.03, 0.03, 0.16), 'jaw'));
  jaw.add(eg(at(cone(0.014, 0.05, M('#f4ead0', { e: 1 }), 4), -0.03, 0.03, 0.16), 'jaw'));
  for (const n in q.legs) {
    const L = q.legs[n];
    L.upper.add(eg(bone(0.075, 0.045, q.d.upper, fur), n));
    L.lower.add(eg(bone(0.042, 0.032, q.d.lower, furD), n));
    L.foot.add(eg(at(sph(0.05, 0.034, 0.07, M('#3a3634'), 7), 0, -0.002, 0.03), n));
  }
  q.remember();
  q.anims = {
    idle: anim(4, 0.8, bakeKeys(4, [[0, { 'tail.rx': -8 }], [1, { By: -0.008, 'tail.ry': 8, 'tail.rx': -8, 'head.rx': 1 }], [2, { By: -0.016, 'tail.rx': -8, 'head.rx': 3 }], [3, { By: -0.008, 'tail.ry': -8, 'tail.rx': -8, 'head.rx': 1 }]], {}, true), true),
    walk: anim(6, 0.6, trotFrames(6, { stride: 0.17, lift: 0.1, bob: 0.014, extra: (ph, c) => ({ 'tail.ry': 7 * c, 'tail.rx': -10, 'head.rx': 2 * Math.cos(2 * ph) }) }), true),
    attack: anim(6, 0.5, bakeKeys(6, [
      [0, { Bz: -0.02, By: -0.1, Brx: 7, 'head.rx': 6, BLz: -0.04, BRz: -0.04, FLz: -0.01, FRz: -0.01, 'tail.rx': -22 }],
      [1, { Bz: -0.03, By: -0.16, Brx: 10, 'head.rx': 10, BLz: -0.06, BRz: -0.06, FLz: -0.02, FRz: -0.02, 'tail.rx': -30, 'jaw.rx': 10 }],
      [2, { Py: 0.16, Bz: 0.06, By: 0.0, Brx: -14, 'head.rx': -8, FLz: 0.16, FRz: 0.14, FLy: 0.1, FRy: 0.1, BLz: -0.14, BRz: -0.12, BLy: 0.05, 'jaw.rx': 36, 'tail.rx': -2 }],
      [3, { Py: 0.08, Bz: 0.1, By: -0.04, Brx: 8, 'head.rx': 8, FLz: 0.18, FRz: 0.15, BLz: -0.02, BRz: -0.04, BLy: 0.06, 'jaw.rx': 42, 'tail.rx': 8 }],
      [4, { Bz: 0.08, By: -0.08, Brx: 7, 'head.rx': 12, FLz: 0.14, FRz: 0.12, BLz: 0.03, BRz: 0.02, 'jaw.rx': 2, 'tail.rx': 2 }],
      [5, { Bz: 0.03, By: -0.03, Brx: 2, 'head.rx': 4, FLz: 0.05, FRz: 0.04, BLz: 0.01, BRz: 0.0, 'tail.rx': -6 }],
    ])),
    hit: anim(3, 0.24, bakeKeys(3, [
      [0, { Bz: -0.03, By: 0.02, Brx: -8, 'head.rx': -18, 'head.ry': 8, 'jaw.rx': 18, 'tail.rx': -18 }],
      [1, { Bz: -0.04, By: -0.03, Brx: -3, 'head.rx': -8, 'head.ry': 4, 'jaw.rx': 8, 'tail.rx': -18 }],
      [2, { Bz: -0.015, By: -0.015, 'head.rx': 2, 'tail.rx': -12 }],
    ])),
    death: anim(7, 0.7, bakeKeys(7, [
      [0, { Bz: -0.03, By: 0.01, Brx: -10, 'head.rx': -18, 'jaw.rx': 20, 'tail.rx': -18 }],
      [1, { Bz: -0.03, By: -0.1, Brx: -4, 'head.rx': -8, Brz: 8, FLz: 0.08, FRz: 0.06, 'jaw.rx': 14, 'tail.rx': -18 }],
      [2, { Prz: 18, By: -0.16, Bz: -0.03, 'head.rx': 4, 'jaw.rx': 8, 'tail.rx': -18 }],
      [3, { Prz: 46, Py: 0.05, Px: 0.1, By: -0.24, Bz: -0.02, 'head.rx': 12, 'jaw.rx': 6, 'tail.rx': -8 }],
      [4, { Prz: 74, Py: 0.1, Px: 0.22, By: -0.3, 'head.rx': 18, FLy: 0.12, BLy: 0.12, 'tail.rx': 10 }],
      [5, { Prz: 90, Py: 0.15, Px: 0.3, By: -0.33, 'head.rx': 22, FLy: 0.14, BLy: 0.14, FRy: 0.03, BRy: 0.03, 'tail.rx': 16 }],
      [6, { Prz: 88, Py: 0.13, Px: 0.3, By: -0.34, 'head.rx': 24, FLy: 0.12, BLy: 0.12, FRy: 0.02, BRy: 0.02, 'tail.rx': 18 }],
    ])),
  };
  return q;
}

// ---------- 불씨 딱정벌레 ----------
function buildBug() {
  const r = new Rig();
  const body = r.node('body', r.root, 0, 0.13, 0);
  const shell = M('#2e1f20', { noise: [14, 0.14], thr: [0.3, 0.5, 0.86] });
  const dark = M('#231a1c');
  const g = eg(group(), 'shell');
  g.add(at(sph(0.2, 0.13, 0.27, shell, 14), 0, 0.03, -0.03));
  // 등껍질 가운데 금
  const crack = M('#ff8a2a', { e: 1 });
  const crack2 = M('#ffd263', { e: 1 });
  g.add(at(box(0.024, 0.02, 0.44, crack), 0, 0.152, -0.03, 4));
  g.add(at(box(0.02, 0.02, 0.2, crack2), 0.075, 0.135, 0.0, 6, 22, 16));
  g.add(at(box(0.02, 0.02, 0.2, crack2), -0.075, 0.135, 0.0, 6, -22, -16));
  g.add(at(box(0.02, 0.02, 0.16, crack), 0.085, 0.12, -0.15, -12, -18, 18));
  g.add(at(box(0.02, 0.02, 0.16, crack), -0.085, 0.12, -0.15, -12, 18, -18));
  // 불티 구멍
  const hot = M('#ff7a2a', { e: 1 });
  const hot2 = M('#ffd873', { e: 1 });
  for (const [x, y, z, s, m] of [[0.09, 0.13, 0.03, 0.03, hot], [-0.1, 0.12, -0.06, 0.035, hot], [0.08, 0.1, -0.16, 0.032, hot2], [-0.07, 0.11, 0.07, 0.022, hot2], [0.12, 0.08, -0.08, 0.02, hot2]]) g.add(at(sph(s, s * 0.6, s, m, 7), x, y, z));
  body.add(g);
  // 배 끝 불빛
  const tail = r.node('tailglow', body, 0, 0.0, -0.27);
  tail.add(eg(sph(0.085, 0.075, 0.085, GLOW.ember(), 10), 'glow'));
  const head = r.node('head', body, 0, 0.0, 0.25);
  head.add(eg(sph(0.09, 0.07, 0.075, dark, 10), 'head'));
  for (const s of [1, -1]) {
    head.add(eg(at(sph(0.02, 0.022, 0.012, M('#ffb04a', { e: 1 }), 5), s * 0.05, 0.02, 0.06), 'head'));
    head.add(eg(strut([s * 0.035, 0.045, 0.05], [s * 0.1, 0.13, 0.16], 0.01, 0.008, dark, 4), 'head'));
    head.add(eg(at(cone(0.016, 0.06, M('#5a3a30'), 4), s * 0.045, -0.02, 0.1, 80, 0, s * -30), 'head'));
  }
  const legs = [];
  for (const [i, z] of [[0, 0.13], [1, -0.02], [2, -0.17]])
    for (const s of [1, -1]) {
      const n = r.node(`leg${i}${s > 0 ? 'L' : 'R'}`, body, s * 0.15, -0.02, z);
      n.add(eg(strut([0, 0, 0], [s * 0.12, -0.03, (1 - i) * 0.03], 0.016, 0.012, dark, 5), n.uuid));
      n.add(eg(strut([s * 0.12, -0.03, (1 - i) * 0.03], [s * 0.17, -0.1, (1 - i) * 0.06], 0.012, 0.008, dark, 5), n.uuid));
      legs.push(n);
    }
  r.remember();
  const gait = (i, n, amp = 1, lift = 1) => {
    const ph = (i / n) * Math.PI * 2;
    const p = {};
    for (let k = 0; k < 3; k++)
      for (const [s, nm] of [[1, 'L'], [-1, 'R']]) {
        const set = (k + (s > 0 ? 0 : 1)) % 2;
        const a = ph + set * Math.PI;
        p[`leg${k}${nm}.ry`] = s * 22 * amp * Math.cos(a);
        p[`leg${k}${nm}.rz`] = s * 15 * lift * Math.max(0, -Math.sin(a));
      }
    return p;
  };
  const base = (o) => o;
  r.anims = {
    idle: anim(4, 0.8, [0, 1, 2, 3].map((i) => ({ ...gait(0, 4, 0.12, 0), 'body.py': -0.004 - 0.004 * Math.sin((i / 4) * 6.28), 'tailglow.s': 1 + 0.16 * Math.sin((i / 4) * 6.28) })), true),
    walk: anim(6, 0.6, [0, 1, 2, 3, 4, 5].map((i) => ({ ...gait(i, 6), 'body.py': 0.006 * Math.cos((i / 6) * 12.56), 'body.rz': 3 * Math.sin((i / 6) * 6.28), 'tailglow.s': 1 + 0.12 * Math.cos((i / 6) * 6.28) })), true),
    attack: anim(6, 0.5, bakeKeys(6, [
      [0, { 'body.pz': -0.04, 'body.rx': -8, 'head.rx': -14, 'tailglow.s': 1.1 }],
      [1, { 'body.pz': -0.08, 'body.py': 0.04, 'body.rx': -20, 'head.rx': -24, 'tailglow.s': 1.3 }],
      [2, { 'body.pz': 0.14, 'body.py': 0.03, 'body.rx': 8, 'head.rx': 12, 'tailglow.s': 1.5 }],
      [3, { 'body.pz': 0.2, 'body.py': 0.0, 'body.rx': 10, 'head.rx': 18, 'tailglow.s': 1.3 }],
      [4, { 'body.pz': 0.14, 'body.rx': 4, 'head.rx': 6, 'tailglow.s': 1.1 }],
      [5, { 'body.pz': 0.04, 'body.rx': 1, 'head.rx': 2, 'tailglow.s': 1 }],
    ])),
    hit: anim(3, 0.24, bakeKeys(3, [
      [0, { 'body.pz': -0.06, 'body.py': 0.03, 'body.rx': -14, 'tailglow.s': 1.4 }],
      [1, { 'body.pz': -0.08, 'body.py': 0.01, 'body.rx': -6, 'tailglow.s': 1.2 }],
      [2, { 'body.pz': -0.03, 'body.rx': -2 }],
    ])),
    // 뒤집혀 다리를 버둥대다 꺼진다
    death: anim(7, 0.7, bakeKeys(7, [
      [0, { 'body.py': 0.06, 'body.rz': 40 }],
      [1, { 'body.py': 0.12, 'body.rz': 110 }],
      [2, { 'body.py': 0.08, 'body.rz': 180, 'leg0L.rz': -20, 'leg0R.rz': 20 }],
      [3, { 'body.py': 0.06, 'body.rz': 180, 'leg0L.rz': 20, 'leg0R.rz': -20, 'leg1L.rz': -20, 'leg1R.rz': 20 }],
      [4, { 'body.py': 0.06, 'body.rz': 180, 'leg1L.rz': 20, 'leg1R.rz': -20, 'leg2L.rz': -20, 'leg2R.rz': 20, 'tailglow.s': 0.7 }],
      [5, { 'body.py': 0.06, 'body.rz': 180, 'leg2L.rz': 12, 'leg2R.rz': -12, 'tailglow.s': 0.4 }],
      [6, { 'body.py': 0.05, 'body.rz': 180, 'tailglow.s': 0.2 }],
    ])),
  };
  return r;
}

// ---------- 골렘 ----------
function buildGolem() {
  const h = new Human({ hipH: 0.46, thigh: 0.225, shin: 0.225, ankle: 0.08, stance: 0.24, hipW: 0.2, spine: 0.04, shoulderY: 0.5, shoulderW: 0.4, upper: 0.27, fore: 0.3, headY: 0.62, toe: 0.15, heel: 0.08 });
  const rock = M('#7f7b76', { thr: [0.4, 0.58, 0.84] });
  const rockD = M('#635f5c', { thr: [0.4, 0.58, 0.84] });
  const glow = M('#ff8a2a', { e: 1 });
  const glowH = M('#ffd263', { e: 1 });
  const tor1 = eg(group(), 'torso');
  tor1.add(at(flat(rock, 0.42, 0.38, 0.32, 11, 0.12, 1), 0, 0.42, 0));
  tor1.add(at(flat(rockD, 0.33, 0.25, 0.26, 13, 0.14, 1), 0, 0.1, 0));
  // 가슴의 금
  const cr = (x, y, z, l, rz, m = glow, w = 0.028) => tor1.add(at(box(w, l, 0.03, m), x, y, z, -8, 0, rz));
  cr(0.02, 0.45, 0.32, 0.26, 12, glowH, 0.036);
  cr(-0.08, 0.34, 0.3, 0.18, -36);
  cr(0.14, 0.34, 0.28, 0.16, 40);
  cr(-0.2, 0.52, 0.26, 0.14, 62);
  cr(0.12, 0.13, 0.25, 0.14, 20);
  h.chest.add(tor1);
  // 금에서 새는 빛은 이 노드로 모아 끌 수 있게
  h.head.position.y = 0.62;
  const hd = eg(group(), 'head');
  hd.add(at(flat(rock, 0.2, 0.17, 0.19, 17, 0.14, 1), 0, 0.08, 0.06));
  for (const s of [1, -1]) hd.add(at(box(0.075, 0.03, 0.02, glowH), s * 0.075, 0.09, 0.235, 0, s * 12, s * -12));
  h.head.add(hd);
  addLegs(h, { thigh: rockD, shin: rock, boot: rockD, rT: 0.14, rS: 0.13, bootW: 0.27, bootL: 0.34, bootH: 0.15 });
  // 큰 팔: 어깨 바위 + 큰 주먹
  for (const [u, f, g, s] of [[h.upperL, h.foreL, h.handL, 1], [h.upperR, h.foreR, h.handR, -1]]) {
    u.add(eg(at(flat(rock, 0.2, 0.17, 0.2, 21 + s, 0.14, 1), 0, -0.06, 0), 'u' + s));
    u.add(eg(at(flat(rockD, 0.11, 0.17, 0.11, 25 + s, 0.14, 1), 0, -0.2, 0), 'u' + s));
    f.add(eg(at(flat(rock, 0.15, 0.2, 0.15, 29 + s, 0.14, 1), 0, -0.14, 0), 'f' + s));
    f.add(eg(at(box(0.024, 0.14, 0.02, glow), s * 0.04, -0.16, 0.14, 0, 0, 10), 'f' + s));
    g.add(eg(at(flat(rock, 0.2, 0.18, 0.2, 33 + s, 0.14, 1), 0, -0.04, 0), 'f' + s));
  }
  const B = { hy: -0.02, Ra: -72, Rr: 0.6, Ry: 0.46, La: 72, Lr: 0.6, Ly: 0.46, crx: 6, drx: -4, Fz: 0.03, Gz: -0.03 };
  const K = (n, keys) => bakeKeys(n, keys, B);
  h.remember();
  h.anims = {
    idle: anim(4, 0.8, bakeKeys(4, [[0, {}], [1, { hy: -0.028, Ry: 0.45, Ly: 0.45, crx: 7 }], [2, { hy: -0.034, Ry: 0.44, Ly: 0.44, crx: 8, drx: -5 }], [3, { hy: -0.028, Ry: 0.45, Ly: 0.45, crx: 7 }]], B, true), true),
    walk: anim(6, 0.6, walkFrames(6, {
      stride: 0.16, lift: 0.08, bob: 0.018,
      extra: (ph, c, s) => ({ ...B, Ra: -72 + 16 * c, La: 72 + 16 * c, hrz: -3.5 * s, crz: -3 * s, cry: -8 * c, Ry: 0.46, Ly: 0.46, crx: 7, c1: 0, c2: 0 }),
    }), true),
    attack: anim(6, 0.5, K(6, [
      [0, { hy: -0.04, crx: -2, Ra: -60, Rr: 0.5, Ry: 0.82, La: 60, Lr: 0.5, Ly: 0.82 }],
      [1, { hy: 0.0, crx: -14, drx: -6, Ra: -36, Rr: 0.3, Ry: 1.22, La: 36, Lr: 0.3, Ly: 1.22 }],
      [2, { hy: -0.06, hz: 0.04, crx: 12, Ra: -24, Rr: 0.58, Ry: 0.8, La: 24, Lr: 0.58, Ly: 0.8, Fz: 0.1, Gz: -0.1 }],
      [3, { hy: -0.13, hz: 0.06, crx: 24, drx: 4, Ra: -20, Rr: 0.62, Ry: 0.2, La: 20, Lr: 0.62, Ly: 0.2, Fz: 0.12, Gz: -0.12 }],
      [4, { hy: -0.12, hz: 0.06, crx: 22, drx: 3, Ra: -22, Rr: 0.62, Ry: 0.22, La: 22, Lr: 0.62, Ly: 0.22, Fz: 0.12, Gz: -0.12 }],
      [5, { hy: -0.05, hz: 0.02, crx: 10, Ra: -52, Rr: 0.62, Ry: 0.38, La: 52, Lr: 0.62, Ly: 0.38, Fz: 0.06, Gz: -0.06 }],
    ])),
    hit: anim(3, 0.24, K(3, [
      [0, { hz: -0.04, hy: -0.03, crx: -8, drx: -10, cry: -8, Ra: -84, La: 84, Ry: 0.52, Ly: 0.52 }],
      [1, { hz: -0.05, hy: -0.05, crx: -4, drx: -6, cry: -4, Ra: -80, La: 80, Ry: 0.5, Ly: 0.5 }],
      [2, { hz: -0.02, hy: -0.03, crx: 2, Ra: -74, La: 74 }],
    ])),
    // 무너져 내린다
    death: anim(7, 0.7, K(7, [
      [0, { hz: -0.03, hy: -0.03, crx: -8, drx: -10, Ra: -86, La: 86, Ry: 0.5, Ly: 0.5 }],
      [1, { hy: -0.1, crx: 6, drx: 2, Ra: -92, La: 92, Ry: 0.44, Ly: 0.44 }],
      [2, { hy: -0.18, hz: 0.0, crx: 14, drx: 6, Ra: -96, La: 96, Ry: 0.42, Ly: 0.42, Fz: 0.1, Gz: 0.06 }],
      [3, { Pz: -0.04, hy: -0.25, crx: 22, drx: 10, crz: 6, Ra: -100, La: 100, Rr: 0.64, Lr: 0.64, Ry: 0.46, Ly: 0.44, Fz: 0.12, Gz: 0.08 }],
      [4, { Pz: -0.08, hy: -0.29, crx: 30, drx: 14, crz: 9, Ra: -104, La: 104, Rr: 0.66, Lr: 0.66, Ry: 0.48, Ly: 0.46, Fz: 0.13, Gz: 0.09 }],
      [5, { Pz: -0.1, hy: -0.31, crx: 36, drx: 17, crz: 11, Ra: -106, La: 106, Rr: 0.68, Lr: 0.68, Ry: 0.5, Ly: 0.48, Fz: 0.13, Gz: 0.09 }],
      [6, { Pz: -0.1, hy: -0.32, crx: 38, drx: 18, crz: 11, Ra: -108, La: 108, Rr: 0.68, Lr: 0.68, Ry: 0.51, Ly: 0.49, Fz: 0.13, Gz: 0.09 }],
    ])),
  };
  return h;
}

/** 해진 로브 자락 (아랫단이 찢어졌다) */
function tattered(rTop, rBot, height, mat, seed = 5, depth = 0.16) {
  const g = new THREE.CylinderGeometry(rTop, rBot, height, 28, 4, true);
  const p = g.attributes.position;
  const r = rng(seed);
  const memo = new Map();
  for (let i = 0; i < p.count; i++) {
    const down = 0.5 - p.getY(i) / height;
    const th = Math.atan2(p.getX(i), p.getZ(i));
    const k = 1 + 0.08 * down * Math.sin(th * 7);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
    if (down > 0.99) {
      const key = Math.round(th * 100);
      if (!memo.has(key)) memo.set(key, r() * depth);
      p.setY(i, p.getY(i) + memo.get(key));
    }
  }
  g.translate(0, -height / 2, 0);
  g.computeVertexNormals();
  return rawMesh(g, mat);
}

// ---------- 광신도 ----------
function buildCultist() {
  const h = new Human({});
  const robe = M('#2e2934', { side: THREE.DoubleSide, thr: [0.34, 0.52, 0.94] });
  const robeL = M('#3a3442', { side: THREE.DoubleSide, thr: [0.34, 0.52, 0.94] });
  // 얼굴은 어둠 속. 눈만 희미하게
  const face = eg(group(), 'head');
  face.add(at(sph(0.26, 0.25, 0.25, M('#17131c', { e: 1 }), 16), 0, 0.26, 0));
  for (const s of [1, -1]) face.add(at(sph(0.03, 0.022, 0.01, M('#b8aee0', { e: 1 }), 6), s * 0.095, 0.25, 0.235, 0, s * 22));
  h.head.add(face);
  const { g: hoodG, m: hoodM } = hood(h, '#26212c', '#3a3342', { theta: 118, tilt: 54, r: 0.3, rim: 0.03 });
  hoodG.add(at(cone(0.15, 0.3, hoodM, 8), 0, 0.5, -0.2, -60));
  h.head.add(hoodG);
  const t = eg(group(), 'torso');
  t.add(at(sph(0.19, 0.21, 0.155, robe, 14), 0, 0.17, 0));
  t.add(at(lathe([[0.08, 0.37], [0.2, 0.3], [0.25, 0.2], [0.22, 0.14], [0.08, 0.14]], robeL, 12), 0, 0, 0));
  h.chest.add(t);
  const skirtN = h.node('skirt', h.hips, 0, 0.03, 0);
  const skH = 0.42;
  skirtN.add(eg(tattered(0.16, 0.31, skH, robe, 5, 0.13), 'skirt'));
  h.hips.add(eg(at(cyl(0.17, 0.17, 0.035, M('#5a4a3a'), 12), 0, 0.03, 0), 'belt'));
  addLegs(h, { thigh: M('#1c1820'), shin: M('#1c1820'), boot: M('#2a2228'), rT: 0.05, rS: 0.045, bootW: 0.12, bootL: 0.2, bootH: 0.08 });
  addArms(h, { upper: robe, fore: robe, hand: M('#a79a94', { thr: [0.34, 0.5, 0.95] }), rU: 0.058, rF: 0.056, rH: 0.046 });
  // 찢어진 소매
  for (const f of [h.foreL, h.foreR]) f.add(eg(at(tattered(0.055, 0.11, 0.17, robeL, 8, 0.06), 0, -0.04, 0), f.uuid));
  // 꺼진 등불
  const lamp = eg(group(), 'lantern');
  const iron = M('#3c3c44', { metal: 1 });
  const chain = h.node('chain', lamp);
  chain.add(at(box(0.012, 0.16, 0.012, iron), 0, -0.08, 0));
  const body = h.node('lampBody', lamp, 0, -0.26, 0);
  body.add(at(cyl(0.1, 0.1, 0.2, M('#4c4e5c', { thr: [0.34, 0.52, 0.8] }), 8), 0, 0, 0));
  body.add(at(cyl(0.035, 0.03, 0.08, M('#2a2830'), 6), 0, -0.05, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    body.add(at(box(0.016, 0.22, 0.016, iron), Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1));
  }
  body.add(at(cone(0.13, 0.1, iron, 8), 0, 0.15, 0));
  body.add(at(tor(0.035, 0.008, iron, Math.PI * 2, 8, 3), 0, 0.2, 0));
  body.add(at(cyl(0.11, 0.09, 0.025, iron, 8), 0, -0.115, 0));
  h.gripR.add(lamp);
  h.post2 = () => {
    h.gripR.rotation.set(0, 0, 0);
    skirtN.scale.y = Math.min(1.1, Math.max(0.45, (h.hips.position.y - 0.0) / skH));
  };
  const B = { hy: -0.015, crx: 8, drx: -2, Ra: -44, Rr: 0.34, Ry: 0.56, La: 44, Lr: 0.22, Ly: 0.44, Fz: 0.02, Gz: -0.03 };
  const K = (n, keys) => bakeKeys(n, keys, B);
  h.remember();
  h.anims = {
    idle: anim(4, 0.8, bakeKeys(4, [[0, {}], [1, { hy: -0.022, crx: 9, Ry: 0.55 }], [2, { hy: -0.028, crx: 10, Ry: 0.54, drx: -3 }], [3, { hy: -0.022, crx: 9, Ry: 0.55 }]], B, true), true),
    walk: anim(6, 0.6, walkFrames(6, {
      stride: 0.12, lift: 0.05, bob: 0.01,
      extra: (ph, c, s) => ({ ...B, Ra: -44 + 8 * c, La: 44 + 6 * c, Ry: 0.56 + 0.01 * Math.cos(2 * ph), Ly: 0.44, crx: 10, hrz: -2 * s }),
    }), true),
    // 등불을 들어 올리는 시전
    attack: anim(6, 0.5, K(6, [
      [0, { hy: -0.03, crx: 14, Ra: -34, Rr: 0.26, Ry: 0.46, La: 34, Lr: 0.16, Ly: 0.46 }],
      [1, { hy: -0.05, crx: 18, drx: 4, Ra: -24, Rr: 0.22, Ry: 0.42, La: 26, Lr: 0.14, Ly: 0.42 }],
      [2, { hy: 0.005, crx: -6, drx: -10, Ra: -30, Rr: 0.22, Ry: 1.02, La: 40, Lr: 0.36, Ly: 0.74, 'chain.v': 0, 'lampBody.py': 0.34 }],
      [3, { hy: 0.012, crx: -12, drx: -14, Ra: -34, Rr: 0.2, Ry: 1.1, La: 48, Lr: 0.4, Ly: 0.82, 'chain.v': 0, 'lampBody.py': 0.42 }],
      [4, { hy: 0.008, crx: -10, drx: -12, Ra: -34, Rr: 0.2, Ry: 1.1, La: 50, Lr: 0.4, Ly: 0.8, 'chain.v': 0, 'lampBody.py': 0.42 }],
      [5, { hy: -0.015, crx: 2, drx: -4, Ra: -30, Rr: 0.32, Ry: 0.78, La: 46, Lr: 0.28, Ly: 0.56 }],
    ])),
    hit: anim(3, 0.24, K(3, [
      [0, { hz: -0.05, hy: -0.03, crx: -8, drx: -14, Ra: -60, Rr: 0.36, Ry: 0.6, La: 72, Lr: 0.3, Ly: 0.52 }],
      [1, { hz: -0.06, hy: -0.05, crx: -2, drx: -8, Ra: -54, Rr: 0.35, Ry: 0.58, La: 62, Lr: 0.27, Ly: 0.48 }],
      [2, { hz: -0.02, hy: -0.03, crx: 5, Ra: -48, Ry: 0.57, La: 50, Ly: 0.45 }],
    ])),
    // 무릎 꿇으며 앞으로 무너진다
    death: anim(7, 0.7, K(7, [
      [0, { hz: -0.04, hy: -0.03, crx: -8, drx: -14, Ra: -60, Rr: 0.36, Ry: 0.6, La: 72, Lr: 0.3, Ly: 0.52 }],
      [1, { hy: -0.1, crx: 6, drx: -6, Ra: -56, Rr: 0.36, Ry: 0.46, La: 66, Lr: 0.3, Ly: 0.42, Fz: 0.1, Gz: 0.06 }],
      [2, { hy: -0.2, crx: 20, drx: 4, Ra: -50, Rr: 0.38, Ry: 0.32, La: 60, Lr: 0.32, Ly: 0.3, Fz: 0.14, Gz: 0.1 }],
      [3, { Pz: -0.08, hy: -0.2, crx: 36, drx: -8, Ra: -46, Rr: 0.42, Ry: 0.5, La: 54, Lr: 0.34, Ly: 0.42, Fz: 0.15, Gz: 0.1 }],
      [4, { Pz: -0.18, hy: -0.2, crx: 58, drx: -22, Ra: -40, Rr: 0.46, Ry: 0.5, La: 48, Lr: 0.4, Ly: 0.4, Fz: 0.15, Gz: 0.1 }],
      [5, { Pz: -0.26, hy: -0.2, crx: 70, drx: -32, Ra: -34, Rr: 0.48, Ry: 0.5, La: 42, Lr: 0.44, Ly: 0.38, Fz: 0.14, Gz: 0.1 }],
      [6, { Pz: -0.26, hy: -0.21, crx: 72, drx: -34, Ra: -34, Rr: 0.48, Ry: 0.5, La: 42, Lr: 0.44, Ly: 0.38, Fz: 0.14, Gz: 0.1 }],
    ])),
  };
  return h;
}

// ---------- 그림자 ----------
function buildShade() {
  const h = new Human({ hipH: 0.5, thigh: 0.24, shin: 0.24, shoulderW: 0.21, upper: 0.21, fore: 0.21, headY: 0.34 });
  const A = 0.74;
  const body = M('#5a3f8c', { alpha: A, thr: [0.3, 0.5, 0.9], side: THREE.DoubleSide, ao: 0 });
  const bodyD = M('#3f2c6a', { alpha: A, thr: [0.3, 0.5, 0.9], side: THREE.DoubleSide, ao: 0 });
  const eye = M('#f0d8ff', { e: 1 });
  const hd = eg(group(), 'head');
  hd.add(at(sph(0.23, 0.26, 0.23, body, 16), 0, 0.26, 0));
  hd.add(at(cone(0.09, 0.26, body, 6), 0, 0.5, -0.12, -40));
  hd.add(at(cone(0.07, 0.22, body, 6), 0.1, 0.46, -0.13, -50, 0, -30));
  hd.add(at(cone(0.07, 0.22, body, 6), -0.1, 0.46, -0.13, -50, 0, 30));
  for (const s of [1, -1]) hd.add(at(sph(0.04, 0.05, 0.012, eye, 6), s * 0.09, 0.26, 0.21, 0, s * 22));
  h.head.add(hd);
  const t = eg(group(), 'torso');
  t.add(at(sph(0.2, 0.24, 0.14, body, 14), 0, 0.16, 0));
  h.chest.add(t);
  // 아래는 흩어지는 자락 (다리는 희미하게 비친다)
  const skirtN = h.node('skirt', h.hips, 0, 0.04, 0);
  const skH = 0.46;
  skirtN.add(eg(tattered(0.14, 0.27, skH, bodyD, 9, 0.2), 'skirt'));
  addLegs(h, { thigh: bodyD, shin: bodyD, boot: bodyD, rT: 0.05, rS: 0.035, bootW: 0.09, bootL: 0.16, bootH: 0.05 });
  addArms(h, { upper: body, fore: body, hand: body, rU: 0.052, rF: 0.045, rH: 0.05 });
  // 긴 손톱: 손에서 아래로 뻗게, 쥔 물건처럼 방향을 포즈로 준다
  const nail = M('#e6d6ff', { thr: [0.3, 0.46, 0.8] });
  for (const [grip, s] of [[h.gripL, 1], [h.gripR, -1]]) {
    const c = eg(group(), 'claw' + s);
    for (const [x, y, ry, rx] of [[0.05, 0.02, 12, -6], [0.018, 0.04, 2, -12], [-0.02, 0.03, -6, -8], [-0.055, -0.01, -16, 0]]) {
      c.add(at(cone(0.022, 0.4, nail, 5), x, y, 0.2, 90 + rx, 0, -ry));
    }
    grip.add(c);
  }
  h.post2 = () => {
    skirtN.scale.y = Math.min(1.1, Math.max(0.45, h.hips.position.y / skH));
  };
  const B = { hy: 0.0, crx: 10, drx: -4, Ra: -68, Rr: 0.34, Ry: 0.54, Wy: -30, Wp: -48, La: 68, Lr: 0.34, Ly: 0.54, Vy: 30, Vp: -48, Fz: 0.02, Gz: -0.02 };
  const K = (n, keys) => bakeKeys(n, keys, B);
  h.remember();
  h.anims = {
    idle: anim(4, 0.8, bakeKeys(4, [[0, {}], [1, { hy: 0.012, crx: 11, Ry: 0.55, Ly: 0.55 }], [2, { hy: 0.02, crx: 12, Ry: 0.56, Ly: 0.56, Wp: -44, Vp: -44 }], [3, { hy: 0.012, crx: 11, Ry: 0.55, Ly: 0.55 }]], B, true), true),
    walk: anim(6, 0.6, walkFrames(6, {
      stride: 0.1, lift: 0.04, bob: 0.0,
      extra: (ph, c, s) => ({ ...B, hy: 0.012 * Math.cos(2 * ph), Ra: -68 + 12 * c, La: 68 + 12 * c, Ry: 0.54, Ly: 0.54, crx: 16, drx: -8 }),
    }), true),
    attack: anim(6, 0.5, K(6, [
      [0, { hy: -0.02, crx: -2, cry: -18, Ra: -90, Rr: 0.34, Ry: 0.82, Wy: -100, Wp: 30, La: 80, Ly: 0.56 }],
      [1, { hy: 0.0, crx: -8, cry: -26, Ra: -110, Rr: 0.3, Ry: 0.92, Wy: -130, Wp: 40, La: 90, Ly: 0.56 }],
      [2, { hy: -0.05, hz: 0.06, crx: 18, cry: 6, Ra: -16, Rr: 0.46, Ry: 0.66, Wy: -20, Wp: -8, La: 80, Ly: 0.5, Fz: 0.1, Gz: -0.1 }],
      [3, { hy: -0.07, hz: 0.07, crx: 24, cry: 26, Ra: 44, Rr: 0.42, Ry: 0.44, Wy: 60, Wp: -28, La: 100, Ly: 0.48, Fz: 0.11, Gz: -0.11 }],
      [4, { hy: -0.06, hz: 0.05, crx: 20, cry: 24, Ra: 56, Rr: 0.38, Ry: 0.42, Wy: 72, Wp: -36, La: 92, Ly: 0.5, Fz: 0.09, Gz: -0.09 }],
      [5, { hy: -0.02, hz: 0.02, crx: 12, cry: 8, Ra: -30, Rr: 0.34, Ry: 0.5, Wy: -20, Wp: -40, La: 76, Ly: 0.52 }],
    ])),
    hit: anim(3, 0.24, K(3, [
      [0, { hz: -0.06, hy: 0.0, crx: -10, drx: -14, Ra: -84, Ry: 0.62, La: 84, Ly: 0.62, Wp: -20, Vp: -20 }],
      [1, { hz: -0.07, hy: -0.03, crx: -4, drx: -6, Ra: -78, Ry: 0.58, La: 78, Ly: 0.58, Wp: -30, Vp: -30 }],
      [2, { hz: -0.02, hy: -0.01, crx: 6, Ra: -70, La: 70, Wp: -44, Vp: -44 }],
    ])),
    // 위로 흩어지듯 사그라든다
    death: anim(7, 0.7, K(7, [
      [0, { hz: -0.05, crx: -12, drx: -14, Ra: -86, Ry: 0.66, La: 86, Ly: 0.66, Wp: -10, Vp: -10 }],
      [1, { hy: -0.06, crx: 0, drx: -10, Ra: -96, Ry: 0.72, La: 96, Ly: 0.72, Wp: 10, Vp: 10, 'pivot.sx': 1.04, 'pivot.sz': 1.04 }],
      [2, { hy: -0.14, crx: 14, drx: 0, Ra: -100, Ry: 0.6, La: 100, Ly: 0.6, 'pivot.sy': 0.9, 'pivot.sx': 1.08, 'pivot.sz': 1.08 }],
      [3, { hy: -0.22, crx: 26, drx: 8, Ra: -104, Ry: 0.46, La: 104, Ly: 0.46, 'pivot.sy': 0.76, 'pivot.sx': 1.14, 'pivot.sz': 1.14 }],
      [4, { hy: -0.28, crx: 36, drx: 12, Ra: -108, Ry: 0.34, La: 108, Ly: 0.34, 'pivot.sy': 0.58, 'pivot.sx': 1.2, 'pivot.sz': 1.2 }],
      [5, { hy: -0.32, crx: 44, drx: 14, Ra: -110, Ry: 0.26, La: 110, Ly: 0.26, 'pivot.sy': 0.4, 'pivot.sx': 0.98, 'pivot.sz': 0.98 }],
      [6, { hy: -0.34, crx: 50, drx: 14, Ra: -112, Ry: 0.2, La: 112, Ly: 0.2, 'pivot.sy': 0.22, 'pivot.sx': 0.6, 'pivot.sz': 0.6 }],
    ])),
  };
  return h;
}

export const MONSTERS = {
  mushroom: { kind: 'monster', build: buildMushroom },
  boar: { kind: 'monster', build: buildBoar },
  wisp: { kind: 'monster', build: buildWisp, float: true },
  ashwolf: { kind: 'monster', build: buildWolf },
  emberbug: { kind: 'monster', build: buildBug },
  golem: { kind: 'monster', build: buildGolem },
  cultist: { kind: 'monster', build: buildCultist },
  shade: { kind: 'monster', build: buildShade },
};
