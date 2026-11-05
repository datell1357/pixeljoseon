// 코드로 저폴리 모델을 만드는 도구 모음.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

export const D2R = Math.PI / 180;

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 메시 배치: at(mesh, x,y,z, rxDeg,ryDeg,rzDeg) */
export function at(o, x = 0, y = 0, z = 0, rx, ry, rz) {
  o.position.set(x, y, z);
  if (rx !== undefined || ry !== undefined || rz !== undefined) o.rotation.set((rx ?? 0) * D2R, (ry ?? 0) * D2R, (rz ?? 0) * D2R);
  return o;
}
export const scale = (o, x, y = x, z = x) => (o.scale.set(x, y, z), o);
export function group(...kids) {
  const g = new THREE.Group();
  for (const k of kids) if (k) g.add(k);
  return g;
}
/** 같은 외곽선 그룹으로 묶는다 */
export function eg(o, name) {
  o.userData.eg = name;
  return o;
}
const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

export const box = (w, h, d, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat);
export const rbox = (w, h, d, r, mat, seg = 2) => mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)), mat);
export const sph = (rx, ry, rz, mat, seg = 16) => {
  const m = mesh(new THREE.SphereGeometry(1, seg, Math.max(8, seg - 4)), mat);
  m.scale.set(rx, ry ?? rx, rz ?? rx);
  return m;
};
export const cyl = (r1, r2, h, mat, seg = 12) => mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
export const cone = (r, h, mat, seg = 10) => mesh(new THREE.ConeGeometry(r, h, seg), mat);
export const tor = (R, r, mat, arc = Math.PI * 2, seg = 20, tube = 8) => mesh(new THREE.TorusGeometry(R, r, tube, seg, arc), mat);
/** 회전체. 점은 어느 순서로 줘도 바깥이 앞면이 되게 정리한다 */
export const lathe = (pts, mat, seg = 16) => {
  const p = pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts;
  return mesh(new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat);
};
/** 아래로 뻗는 뼈 모양 캡슐: 원점에서 -Y로 len */
export function bone(r1, r2, len, mat, seg = 10) {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(r1, r2, len, seg), mat);
  c.position.y = -len / 2;
  g.add(c);
  g.add(at(sph(r1, r1, r1, mat, seg), 0, 0, 0));
  g.add(at(sph(r2, r2, r2, mat, seg), 0, -len, 0));
  return g;
}
/** 두 점을 잇는 원기둥 */
export function strut(a, b, r1, r2, mat, seg = 8) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const m = mesh(new THREE.CylinderGeometry(r2, r1, d.length(), seg), mat);
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
/** 위아래 폭이 다른 상자 (로브 자락, 망토) */
export function taper(wTop, wBot, h, dTop, dBot, mat, flat = true) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    p.setX(i, p.getX(i) * (top ? wTop : wBot));
    p.setZ(i, p.getZ(i) * (top ? dTop : dBot));
    p.setY(i, p.getY(i) * h);
  }
  g.computeVertexNormals();
  return mesh(flat ? g : g, mat);
}
/** 울퉁불퉁한 덩어리. flat이면 각진 돌, 아니면 둥근 나뭇잎 뭉치 */
export function blob(rx, ry, rz, mat, { seed = 1, disp = 0.18, detail = 2, flat = false } = {}) {
  const r = rng(seed);
  let g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const memo = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!memo.has(k)) memo.set(k, 1 + (r() - 0.5) * 2 * disp);
    const s = memo.get(k);
    p.setXYZ(i, p.getX(i) * s * rx, p.getY(i) * s * ry, p.getZ(i) * s * rz);
  }
  if (flat) g.computeVertexNormals();
  else {
    // 같은 자리 꼭짓점의 법선을 합쳐 매끈하게
    g.computeVertexNormals();
    const acc = new Map();
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      const v = acc.get(k) ?? [0, 0, 0];
      v[0] += n.getX(i);
      v[1] += n.getY(i);
      v[2] += n.getZ(i);
      acc.set(k, v);
    }
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      const v = acc.get(k);
      const l = Math.hypot(...v) || 1;
      n.setXYZ(i, v[0] / l, v[1] / l, v[2] / l);
    }
  }
  return mesh(g, mat);
}
/** 다각형을 돌출한 판 (XY 평면, 두께 d는 Z) */
export function extrude(pts, d, mat, bevel = 0) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -d / 2);
  return mesh(g, mat);
}
export { mesh as rawMesh };
