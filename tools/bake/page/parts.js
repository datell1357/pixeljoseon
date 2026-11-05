// 사람형 공통 부품: 머리, 팔다리, 무기.
import { THREE, D2R, at, group, eg, box, rbox, sph, cyl, cone, tor, bone, lathe, taper, rawMesh, scale } from './kit.js';
import { M } from './core.js';

const HEAD_CY = 0.27;
const FACE = [0.275, 0.262, 0.262];
export const EYE = '#241a2c';

/** 구의 윗부분 덮개 (머리카락, 투구). theta: 위에서부터 덮는 각(도), tilt: 뒤로 젖힘(도) */
export function cap(rx, ry, rz, theta, tilt, mat, seg = 20) {
  const g = new THREE.SphereGeometry(1, seg, 12, 0, Math.PI * 2, 0, theta * D2R);
  const m = rawMesh(g, mat);
  m.scale.set(rx, ry, rz);
  m.rotation.x = -tilt * D2R;
  return m;
}
/** 앞쪽을 틔운 구 껍질 (두건) */
export function shell(r, openDeg, mat, seg = 20) {
  const a = (openDeg / 2) * D2R;
  // SphereGeometry의 phi 0은 -X 쪽이므로 +Z(앞)가 비도록 돌린다
  const g = new THREE.SphereGeometry(r, seg, 14, Math.PI / 2 + a, Math.PI * 2 - 2 * a);
  return rawMesh(g, mat);
}

/** 피부색 단계: 붉은 그림자가 너무 진하지 않게 직접 정한다 */
export function skinMat(hexStr) {
  const v = parseInt(hexStr.slice(1), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const mix = (m, a) => m.map((k, i) => Math.round(Math.min(255, [r, g, b][i] * k + a[i])));
  return M(hexStr, {
    bias: 0.1,
    ramp: [mix([0.66, 0.56, 0.58], [8, 0, 10]), mix([0.84, 0.74, 0.74], [4, 0, 6]), [r, g, b], mix([1, 1, 1], [12, 24, 26])],
    thr: [0.34, 0.52, 0.96],
  });
}

export function addFace(h, { skin, eye = EYE, cy = HEAD_CY, scaleF = 1, eyeY = -0.02, eyeA = 0.4, eyeS = 1.15 }) {
  const skinM = typeof skin === 'string' ? skinMat(skin) : skin;
  const f = FACE.map((v) => v * scaleF);
  const g = eg(group(), 'head');
  g.add(at(sph(f[0], f[1], f[2], skinM, 24), 0, cy, 0));
  const eyeM = M(eye, { e: 1 });
  const glint = M('#ffffff', { e: 1 });
  for (const side of [1, -1]) {
    const a = side * eyeA;
    const px = f[0] * Math.sin(a) * Math.cos(eyeY);
    const py = cy + f[1] * Math.sin(eyeY);
    const pz = f[2] * Math.cos(a) * Math.cos(eyeY);
    const e = at(sph(0.038 * eyeS, 0.056 * eyeS, 0.014, eyeM, 10), px, py, pz, 0, a / D2R, 0);
    g.add(e);
    g.add(at(sph(0.014 * eyeS, 0.018 * eyeS, 0.008, glint, 6), px * 1.0 + side * -0.008, py + 0.022, pz + 0.012, 0, a / D2R, 0));
  }
  h.head.add(g);
  return g;
}

/** 앞머리: [방위각, 고도, 크기] 목록을 머리 구 표면에 얹는다 */
export function addBangs(g, mat, list, cy = HEAD_CY, R = 0.27) {
  for (const [az, el, sc] of list) {
    const a = az * D2R;
    const e = el * D2R;
    const m = sph(0.095 * sc, 0.066 * sc, 0.05 * sc, mat, 8);
    m.position.set(R * Math.sin(a) * Math.cos(e), cy + R * Math.sin(e), R * Math.cos(a) * Math.cos(e));
    m.rotation.order = 'YXZ';
    m.rotation.set(-e, a, 0);
    g.add(m);
  }
}

export function addLegs(h, { thigh, shin, boot, rT = 0.075, rS = 0.062, bootW = 0.135, bootL = 0.235, bootH = 0.1 }) {
  const d = h.d;
  for (const [t, s, f] of [[h.thighL, h.shinL, h.footL], [h.thighR, h.shinR, h.footR]]) {
    t.add(eg(bone(rT, rS + 0.005, d.thigh, thigh), t.uuid));
    s.add(eg(bone(rS + 0.005, rS, d.shin, shin), s.uuid));
    f.add(eg(at(rbox(bootW, bootH, bootL, 0.045, boot), 0, -d.ankle + bootH / 2, 0.042), s.uuid));
  }
}
export function addArms(h, { upper, fore, hand, rU = 0.058, rF = 0.05, rH = 0.056 }) {
  const d = h.d;
  for (const [u, f, g] of [[h.upperL, h.foreL, h.handL], [h.upperR, h.foreR, h.handR]]) {
    u.add(eg(bone(rU, rU - 0.004, d.upper, upper), u.uuid));
    f.add(eg(bone(rF + 0.004, rF, d.fore, fore), u.uuid));
    g.add(eg(sph(rH, rH, rH, hand, 10), u.uuid));
  }
}

// ---------- 무기 (지역 +Z가 앞쪽, 손잡이가 원점) ----------
export function sword({ blade = '#d7dee8', guard = '#e0b040', grip = '#6a3f28', len = 0.6, wid = 0.078 } = {}) {
  const bm = M(blade, { metal: 1, thr: [0.3, 0.5, 0.72] });
  const gm = M(guard, { metal: 1 });
  const hm = M(grip);
  const g = eg(group(), 'sword');
  const b = rawMesh(new THREE.CylinderGeometry(wid * 0.72, wid * 0.72, len, 4), bm);
  b.rotation.x = Math.PI / 2;
  b.scale.set(1, 1, 0.5);
  b.position.z = len / 2 + 0.08;
  g.add(b);
  const tip = rawMesh(new THREE.ConeGeometry(wid * 0.72, 0.1, 4), bm);
  tip.rotation.x = Math.PI / 2;
  tip.scale.set(1, 1, 0.5);
  tip.position.z = len + 0.08 + 0.05;
  g.add(tip);
  g.add(at(rbox(0.2, 0.045, 0.05, 0.015, gm), 0, 0, 0.07));
  g.add(at(cyl(0.024, 0.024, 0.14, hm, 8), 0, 0, 0, 90));
  g.add(at(sph(0.034, 0.034, 0.034, gm, 8), 0, 0, -0.08));
  return g;
}
export function roundShield({ face = '#4b6fb5', rim = '#c9d2de', boss = '#e0b040', back = '#6a4a30', emblem = '#e8e2d0', r = 0.27 } = {}) {
  const g = eg(group(), 'shield');
  const disc = rawMesh(new THREE.CylinderGeometry(r, r, 0.045, 24), M(face));
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const rimM = tor(r, 0.03, M(rim, { metal: 1 }), Math.PI * 2, 28, 6);
  g.add(rimM);
  g.add(at(sph(0.075, 0.075, 0.04, M(boss, { metal: 1 }), 12), 0, 0, 0.03));
  // 앞면 십자 무늬
  const em = M(emblem);
  g.add(at(box(0.05, r * 1.75, 0.01, em), 0, 0, 0.026));
  g.add(at(box(r * 1.75, 0.05, 0.01, em), 0, 0, 0.026));
  return g;
}
/** 막대(지팡이·창): 지역 +Z가 위쪽 끝, 원점이 손 */
export function shaft(len, back, r, mat) {
  const c = cyl(r, r, len, mat, 8);
  c.rotation.x = Math.PI / 2;
  c.position.z = (len - 2 * back) / 2;
  return c;
}
