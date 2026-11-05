// 마을 사람 다섯. idle만 있다.
import { THREE, at, group, eg, box, rbox, sph, cyl, cone, tor, lathe, taper, blob, strut, rawMesh } from './kit.js';
import { M, GLOW } from './core.js';
import { Human } from './rig.js';
import { addFace, addBangs, addLegs, addArms, cap, skinMat, shaft } from './parts.js';
import { robeSkirt, idleFrames, addCape, hood } from './humans.js';

const idleOnly = (b) => ({ idle: { frames: 6, dur: 1.2, loop: true, poses: idleFrames(6, b, 0.8) } });
function robeBody(h, color, dark, trim, { w = 0.19, skirtH = 0.37, r0 = 0.16, r1 = 0.28 } = {}) {
  const m = M(color, { thr: [0.3, 0.48, 0.92] });
  const t = eg(group(), 'torso');
  t.add(at(sph(w, 0.2, 0.155, m, 14), 0, 0.17, 0));
  h.chest.add(t);
  const skirtN = h.node('skirt', h.hips, 0, 0.03, 0);
  const sk = eg(group(), 'skirt');
  sk.add(robeSkirt(r0, r1, skirtH, M(color, { side: THREE.DoubleSide, thr: [0.3, 0.48, 0.92] }), 7, 0.1));
  if (trim) sk.add(at(robeSkirt(r1 - 0.008, r1 + 0.006, 0.05, M(trim, { side: THREE.DoubleSide }), 7, 0), 0, -skirtH + 0.05, 0));
  skirtN.add(sk);
  h.post2 = () => {
    skirtN.scale.y = Math.min(1.12, Math.max(0.5, (h.hips.position.y - 0.0) / skirtH));
  };
  return m;
}

// 지팡이 든 흰 수염 노인
function buildElder() {
  const h = new Human({});
  addFace(h, { skin: '#eebf9c', eyeS: 0.9 });
  const white = M('#eef0ee', { thr: [0.3, 0.46, 0.9] });
  const hg = eg(group(), 'hair');
  hg.add(at(cap(0.29, 0.28, 0.29, 80, 62, white), 0, 0.27, -0.01));
  h.head.add(hg);
  // 흰 눈썹과 긴 수염
  const beard = eg(group(), 'beard');
  for (const s of [1, -1]) beard.add(at(sph(0.06, 0.022, 0.03, white, 6), s * 0.1, 0.32, 0.235, 0, s * 22));
  beard.add(at(lathe([[0.0, 0], [0.08, 0.03], [0.17, 0.14], [0.2, 0.26], [0.0, 0.3]], white, 12), 0, -0.1, 0.16));
  h.head.add(beard);
  robeBody(h, '#4f8a4a', '#39683a', '#d9c98a');
  h.hips.add(eg(at(cyl(0.17, 0.17, 0.04, M('#7a5a36'), 12), 0, 0.03, 0), 'belt'));
  addLegs(h, { thigh: M('#3a3442'), shin: M('#3a3442'), boot: M('#5a3f2a'), rT: 0.05, rS: 0.045, bootW: 0.125, bootL: 0.2, bootH: 0.08 });
  addArms(h, { upper: M('#4f8a4a'), fore: M('#4f8a4a'), hand: skinMat('#eebf9c'), rU: 0.056, rF: 0.056, rH: 0.046 });
  const st = eg(group(), 'staff');
  const w = M('#7a5a36', { noise: [14, 0.1] });
  st.add(shaft(1.42, 0.5, 0.03, w));
  st.add(at(tor(0.09, 0.03, w, Math.PI * 1.4, 10, 5), 0.07, 0, 0.95, 0, 90, 0));
  h.gripR.add(st);
  h.remember();
  h.anims = idleOnly({ hy: -0.03, crx: 12, drx: -9, Ra: -48, Rr: 0.33, Ry: 0.52, Wy: 0, Wp: 88, La: 34, Lr: 0.26, Ly: 0.52, Fz: 0.02, Gz: -0.02 });
  return h;
}

// 큰 배낭의 행상
function buildMerchant() {
  const h = new Human({});
  addFace(h, { skin: '#e8b48a' });
  const hairM = M('#6a4a2c');
  const hg = eg(group(), 'hair');
  hg.add(at(cap(0.29, 0.28, 0.29, 90, 44, hairM), 0, 0.27, 0));
  h.head.add(hg);
  // 넓은 챙 모자
  const hat = eg(group(), 'hat');
  const straw = M('#d9b95a', { noise: [20, 0.14], thr: [0.3, 0.46, 0.82] });
  hat.add(at(lathe([[0.42, 0], [0.4, 0.02], [0.25, 0.03], [0.22, 0.12], [0.16, 0.2], [0, 0.22]], straw, 16), 0, 0.42, 0, -8));
  hat.add(at(tor(0.235, 0.018, M('#b5533a'), Math.PI * 2, 16, 4), 0, 0.47, -0.006, 82));
  h.head.add(hat);
  const yellow = M('#e0b53c', { thr: [0.3, 0.48, 0.9] });
  const tt = eg(group(), 'torso');
  tt.add(at(sph(0.19, 0.2, 0.15, yellow, 14), 0, 0.17, 0));
  tt.add(at(box(0.05, 0.28, 0.02, M('#b58a2a')), 0, 0.17, 0.148, -4));
  h.chest.add(tt);
  const sk = eg(group(), 'skirtA');
  sk.add(at(robeSkirt(0.16, 0.22, 0.2, M('#d4a634', { side: THREE.DoubleSide }), 6, 0.08), 0, 0.03, 0));
  sk.add(at(cyl(0.168, 0.168, 0.04, M('#6a4a2c'), 12), 0, 0.03, 0));
  sk.add(at(rbox(0.09, 0.1, 0.05, 0.02, M('#8a5a30')), 0.15, -0.03, 0.09));
  h.hips.add(sk);
  addLegs(h, { thigh: M('#5a4a38'), shin: M('#5a4a38'), boot: M('#4f3522'), rT: 0.066, rS: 0.058 });
  addArms(h, { upper: yellow, fore: yellow, hand: skinMat('#e8b48a'), rU: 0.05, rF: 0.05, rH: 0.046 });
  // 큰 배낭: 등보다 넓고 머리 위까지
  const pack = eg(group(), 'pack');
  const canvas = M('#8a6a44', { noise: [11, 0.12], thr: [0.3, 0.46, 0.84] });
  const strap = M('#5a3f2a');
  pack.add(at(rbox(0.52, 0.7, 0.34, 0.08, canvas), 0, 0.36, -0.32));
  pack.add(at(rbox(0.5, 0.05, 0.34, 0.02, strap), 0, 0.3, -0.325));
  pack.add(at(box(0.05, 0.72, 0.36, strap), 0.14, 0.36, -0.32));
  pack.add(at(box(0.05, 0.72, 0.36, strap), -0.14, 0.36, -0.32));
  // 둘둘 만 이불과 냄비
  pack.add(at(cyl(0.11, 0.11, 0.62, M('#a83b3b'), 10), 0, 0.82, -0.3, 0, 0, 90));
  pack.add(at(cyl(0.1, 0.085, 0.13, M('#55555f', { metal: 1 }), 10), 0.3, 0.3, -0.3));
  pack.add(at(rbox(0.16, 0.2, 0.06, 0.02, M('#6a8a4a')), -0.3, 0.26, -0.3));
  pack.add(at(sph(0.045, 0.06, 0.045, GLOW.lamp(), 8), 0.3, 0.54, -0.28));
  pack.add(at(tor(0.22, 0.016, strap, Math.PI * 2, 16, 4), 0, 0.2, -0.02, 0, 0, 0));
  h.chest.add(pack);
  h.remember();
  h.anims = idleOnly({ hy: -0.012, crx: 10, drx: -8, Ra: -36, Rr: 0.22, Ry: 0.72, La: 36, Lr: 0.22, Ly: 0.72, Fz: 0.03, Gz: -0.03 });
  return h;
}

// 앞치마, 망치
function buildSmith() {
  const h = new Human({ shoulderW: 0.235 });
  addFace(h, { skin: '#d9a077' });
  const hg = eg(group(), 'beard');
  const dark = M('#3a2a22');
  // 대머리에 짙은 수염과 머리띠
  hg.add(at(lathe([[0.0, 0], [0.08, 0.02], [0.18, 0.08], [0.2, 0.14], [0.12, 0.17], [0, 0.17]], dark, 12), 0, 0.0, 0.11));
  hg.add(at(cap(0.285, 0.278, 0.285, 56, 26, M('#a8483a', { thr: [0.3, 0.46, 0.92] }), 18), 0, 0.27, 0));
  hg.add(at(sph(0.05, 0.04, 0.05, M('#a8483a'), 6), 0.12, 0.42, -0.2));
  h.head.add(hg);
  const shirt = M('#7a6a5a');
  const tt = eg(group(), 'torso');
  tt.add(at(sph(0.22, 0.21, 0.165, shirt, 14), 0, 0.17, 0));
  h.chest.add(tt);
  // 가죽 앞치마
  const apron = eg(group(), 'apron');
  const lm = M('#7a4a2c', { noise: [11, 0.1], thr: [0.3, 0.46, 0.9] });
  apron.add(at(taper(0.26, 0.3, 0.34, 0.02, 0.02, lm), 0, 0.16, 0.16));
  h.chest.add(apron);
  const ap2 = eg(group(), 'apron2');
  ap2.add(at(taper(0.3, 0.36, 0.34, 0.02, 0.02, lm), 0, -0.14, 0.17));
  ap2.add(at(cyl(0.18, 0.18, 0.05, M('#4a3020'), 12), 0, 0.03, 0));
  h.hips.add(ap2);
  h.hips.add(eg(at(cyl(0.17, 0.2, 0.14, M('#4a4048'), 12), 0, -0.05, 0), 'pelvis'));
  addLegs(h, { thigh: M('#4a4048'), shin: M('#4a4048'), boot: M('#332620'), rT: 0.075, rS: 0.068, bootW: 0.145 });
  addArms(h, { upper: skinMat('#d9a077'), fore: skinMat('#d9a077'), hand: skinMat('#d9a077'), rU: 0.072, rF: 0.066, rH: 0.06 });
  // 망치
  const hm = eg(group(), 'hammer');
  hm.add(shaft(0.52, 0.08, 0.026, M('#8a5c34')));
  hm.add(at(rbox(0.26, 0.15, 0.15, 0.02, M('#6a6a78', { metal: 1 })), 0, 0, 0.42));
  h.gripR.add(hm);
  h.remember();
  h.anims = idleOnly({ hy: -0.012, crx: 3, Ra: -66, Rr: 0.36, Ry: 0.46, Wy: -20, Wp: 62, La: 58, Lr: 0.3, Ly: 0.44, Fz: 0.03, Gz: -0.03 });
  return h;
}

// 붉은 망토, 창
function buildGuard() {
  const h = new Human({ holdR: { fwd: 1.24, back: 0.52 } });
  addFace(h, { skin: '#eebb90' });
  const steel = M('#a0a9b8', { metal: 1 });
  const hg = eg(group(), 'helm');
  hg.add(at(cap(0.3, 0.292, 0.3, 90, 18, steel), 0, 0.27, 0));
  hg.add(at(box(0.04, 0.2, 0.03, steel), 0, 0.33, 0.29, -8));
  hg.add(at(tor(0.296, 0.018, M('#e0b040', { metal: 1 }), Math.PI * 2, 20, 4), 0, 0.27, -0.005, 72));
  // 붉은 깃털
  const plume = M('#c43a34', { thr: [0.3, 0.46, 0.88] });
  hg.add(at(sph(0.05, 0.09, 0.14, plume, 8), 0, 0.59, -0.02));
  hg.add(at(sph(0.04, 0.08, 0.11, plume, 8), 0, 0.53, -0.18));
  h.head.add(hg);
  const tt = eg(group(), 'torso');
  tt.add(at(sph(0.2, 0.2, 0.158, steel, 16), 0, 0.2, 0));
  tt.add(at(sph(0.16, 0.12, 0.13, M('#7b879b', { metal: 1 }), 12), 0, 0.05, 0));
  tt.add(at(box(0.04, 0.22, 0.02, M('#c43a34')), 0, 0.2, 0.15, -6));
  h.chest.add(tt);
  for (const s of [1, -1]) h.chest.add(eg(at(sph(0.09, 0.075, 0.09, steel, 10), s * 0.21, 0.33, 0), 'pa' + s));
  const sk = eg(group(), 'skirtA');
  sk.add(at(robeSkirt(0.16, 0.21, 0.16, M('#a83432', { side: THREE.DoubleSide }), 6, 0.08), 0, 0.03, 0));
  sk.add(at(cyl(0.17, 0.17, 0.035, M('#5a3f2a'), 12), 0, 0.03, 0));
  h.hips.add(sk);
  addLegs(h, { thigh: M('#3d3a4a'), shin: steel, boot: M('#7b879b', { metal: 1 }), rT: 0.068, rS: 0.062 });
  addArms(h, { upper: M('#3d3a4a'), fore: steel, hand: M('#7b879b', { metal: 1 }), rU: 0.05, rF: 0.052, rH: 0.05 });
  addCape(h, '#b53632', '#7e2729', { flare: 1.1 });
  // 창
  const sp = eg(group(), 'spear');
  const w = M('#7a5a36', { noise: [14, 0.1] });
  sp.add(shaft(1.5, 0.52, 0.024, w));
  sp.add(at(cone(0.06, 0.26, M('#d7dee8', { metal: 1 }), 4), 0, 0, 1.1, 90));
  sp.add(at(box(0.16, 0.03, 0.03, M('#e0b040', { metal: 1 })), 0, 0, 0.97));
  sp.add(at(box(0.012, 0.09, 0.12, M('#c43a34')), 0, -0.05, 0.9));
  h.gripR.add(sp);
  h.remember();
  h.anims = idleOnly({ hy: -0.004, Ra: -58, Rr: 0.34, Ry: 0.54, Wy: 0, Wp: 88, La: 60, Lr: 0.25, Ly: 0.42, Fz: 0.02, Gz: -0.02, c1: 6, c2: 5 });
  return h;
}

// 열쇠 꾸러미, 보라 옷
function buildKeeper() {
  const h = new Human({});
  addFace(h, { skin: '#f0c4a4', eyeS: 1.0 });
  const hairM = M('#b6b4c0');
  const hg = eg(group(), 'hair');
  hg.add(at(cap(0.292, 0.285, 0.29, 92, 40, hairM), 0, 0.27, 0));
  addBangs(hg, hairM, [[-34, 42, 0.9], [34, 42, 0.9], [-74, 12, 0.8], [74, 12, 0.8]], 0.27, 0.27);
  // 올림머리
  hg.add(at(sph(0.13, 0.12, 0.13, hairM, 10), 0, 0.54, -0.1));
  hg.add(at(cyl(0.012, 0.012, 0.26, M('#e0b040', { metal: 1 }), 5), 0, 0.56, -0.1, 0, 0, 72));
  h.head.add(hg);
  robeBody(h, '#6d4a9c', '#503674', '#d9c38a');
  h.chest.add(eg(at(lathe([[0.06, 0.37], [0.2, 0.3], [0.245, 0.21], [0.2, 0.15], [0.06, 0.15]], M('#553a7c', { side: THREE.DoubleSide }), 12), 0, 0, 0), 'shawl'));
  h.hips.add(eg(at(cyl(0.17, 0.17, 0.04, M('#3a2a22'), 12), 0, 0.03, 0), 'belt'));
  addLegs(h, { thigh: M('#3a3442'), shin: M('#3a3442'), boot: M('#3a2a3e'), rT: 0.05, rS: 0.045, bootW: 0.125, bootL: 0.2, bootH: 0.08 });
  addArms(h, { upper: M('#6d4a9c'), fore: M('#6d4a9c'), hand: skinMat('#f0c4a4'), rU: 0.056, rF: 0.056, rH: 0.046 });
  // 열쇠 꾸러미: 왼손에 큰 고리
  const kr = eg(group(), 'keys');
  const g = M('#e8c04e', { metal: 1, thr: [0.3, 0.46, 0.72] });
  kr.add(at(tor(0.1, 0.016, g, Math.PI * 2, 16, 4), 0, -0.1, 0.0));
  for (const [x, z, l] of [[-0.06, 0.03, 0.14], [0.0, 0.05, 0.17], [0.07, 0.02, 0.15]]) {
    kr.add(at(box(0.016, l, 0.016, g), x, -0.2 - l / 2 + 0.02, z));
    kr.add(at(box(0.05, 0.016, 0.016, g), x + 0.015, -0.2 - l + 0.03, z));
    kr.add(at(tor(0.022, 0.008, g, Math.PI * 2, 8, 3), x, -0.2, z));
  }
  h.gripL.add(kr);
  h.post3 = null;
  h.remember();
  h.anims = idleOnly({ hy: -0.006, crx: 4, Ra: -30, Rr: 0.22, Ry: 0.5, La: 50, Lr: 0.36, Ly: 0.66, Vy: 0, Vp: 0, Fz: 0.02, Gz: -0.02 });
  return h;
}

export const NPCS = {
  npc_elder: { kind: 'npc', build: buildElder },
  npc_merchant: { kind: 'npc', build: buildMerchant },
  npc_smith: { kind: 'npc', build: buildSmith },
  npc_guard: { kind: 'npc', build: buildGuard },
  npc_keeper: { kind: 'npc', build: buildKeeper },
};
