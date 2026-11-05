// 소품 모델. 원점 = 바닥 중심(앵커), 1유닛 = 1칸, x=u, z=v, y=높이.
import { THREE, D2R, at, group, eg, box, rbox, sph, cyl, cone, tor, lathe, taper, blob, extrude, strut, rng, rawMesh, scale } from './kit.js';
import { M, G, GLOW } from './core.js';

// ---------- 공통 재질 ----------
const woodL = () => M('#a97a48', { noise: [11, 0.12] });
const woodD = () => M('#6d4629', { noise: [11, 0.12] });
const woodG = () => M('#8c7a5e', { noise: [11, 0.14] });
const stoneM = (c = '#8f8d88') => M(c, { noise: [6, 0.2], thr: [0.32, 0.5, 0.82] });
const ironM = () => M('#4a4a54', { metal: 1 });
const lampM = () => M('#ffd873', { e: 1 });
const lampHot = () => M('#fff4c4', { e: 1 });
const leafM = (c) => M(c, { noise: [7, 0.3], thr: [0.34, 0.5, 0.78], ao: 0.05 });
const mossM = () => M('#5d8a3c', { noise: [12, 0.25], thr: [0.34, 0.5, 0.8] });

const tag = (o, name) => eg(o, name);

// ---------- 건물 ----------
function window1(wood, y = 0) {
  const g = group();
  g.add(box(0.36, 0.42, 0.03, wood));
  g.add(at(box(0.29, 0.35, 0.04, M('#ffd77a', { e: 1 })), 0, 0, 0.005));
  g.add(at(box(0.03, 0.35, 0.05, wood), 0, 0, 0.01));
  g.add(at(box(0.29, 0.03, 0.05, wood), 0, 0, 0.01));
  g.add(at(box(0.42, 0.04, 0.08, wood), 0, -0.22, 0.02));
  return g;
}
function door1(wood, frame, w = 0.46, h = 0.82) {
  const g = group();
  g.add(at(box(w + 0.09, h + 0.06, 0.03, frame), 0, (h + 0.06) / 2, 0));
  g.add(at(box(w, h, 0.045, wood), 0, h / 2, 0.005));
  for (const x of [-w / 4, w / 4]) g.add(at(box(0.012, h, 0.05, frame), x, h / 2, 0.006));
  g.add(at(sph(0.022, 0.022, 0.02, M('#d9b24a', { metal: 1 }), 6), w / 2 - 0.06, h * 0.48, 0.035));
  return g;
}
/** 지붕 경사 한 쪽: 겹친 띠. 앞(+z)쪽 경사를 원점 기준으로 만든다 */
function roofSlope(w, halfD, rh, eave, c1, c2, rows = 6) {
  const g = group();
  const ang = Math.atan2(rh, halfD);
  const L = Math.hypot(halfD, rh) + eave;
  const rowL = L / rows;
  for (let i = 0; i < rows; i++) {
    const t = (i + 0.5) * rowL;
    const m = box(w, 0.05, rowL * 1.3, i % 2 ? c1 : c2);
    const y = rh - Math.sin(ang) * t;
    const z = Math.cos(ang) * t;
    m.position.set(0, y + 0.03, z);
    m.rotation.x = ang + 0.05;
    g.add(m);
  }
  return g;
}

function house(o) {
  const {
    w = 2.5, d = 2.5, wallH = 1.3, roofH = 1.1, eave = 0.26, baseH = 0.2,
    wall = '#e6d7b4', timber = '#6d4629', roof = '#b5553a', roof2 = '#a24a33', stone = '#8d8a84', rows = 6,
    ridge = 'u', chimney = null, frame = true,
  } = o;
  const G = group();
  const inner = group();
  const wallM = M(wall, { noise: [5, 0.05] });
  const timberM = M(timber, { noise: [11, 0.1] });
  // 빛 쪽 경사(+v)는 기본색, 그늘 쪽 경사(+u)는 중간색이 되도록 문턱을 맞춘다
  const r1 = M(roof, { noise: [9, 0.03], thr: [0.3, 0.76, 1.2] });
  const r2 = M(roof2, { noise: [9, 0.03], thr: [0.3, 0.76, 1.2] });
  // 벽과 기초
  const body = tag(group(), 'wall');
  body.add(at(box(w, wallH, d, wallM), 0, baseH + wallH / 2, 0));
  inner.add(body);
  const base = tag(group(), 'base');
  base.add(at(box(w + 0.1, baseH, d + 0.1, stoneM(stone)), 0, baseH / 2, 0));
  inner.add(base);
  // 나무 뼈대
  const T = 0.07;
  const fr = tag(group(), 'timber');
  if (frame) {
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) fr.add(at(box(T, wallH, T, timberM), (x * w) / 2, baseH + wallH / 2, (z * d) / 2));
    for (const z of [1, -1]) {
      fr.add(at(box(w + T, T, T, timberM), 0, baseH + wallH, (z * d) / 2));
      fr.add(at(box(w + T, T * 0.8, T * 0.8, timberM), 0, baseH + wallH * 0.46, (z * d) / 2));
    }
    for (const x of [1, -1]) {
      fr.add(at(box(T, T, d + T, timberM), (x * w) / 2, baseH + wallH, 0));
      fr.add(at(box(T * 0.8, T * 0.8, d + T, timberM), (x * w) / 2, baseH + wallH * 0.46, 0));
    }
  }
  inner.add(fr);
  // 박공
  const top = baseH + wallH;
  for (const x of [1, -1]) {
    const tri = extrude([[-d / 2, 0], [d / 2, 0], [0, roofH]], 0.04, wallM);
    tri.rotation.y = Math.PI / 2;
    tri.position.set((x * w) / 2 - x * 0.01, top, 0);
    tag(tri, 'wall');
    inner.add(tri);
    if (frame) {
      fr.add(at(box(T * 0.7, roofH, T * 0.7, timberM), (x * w) / 2 + x * 0.01, top + roofH / 2, 0));
    }
  }
  // 지붕
  const roofG = tag(group(), 'roof');
  const rw = w + eave * 2;
  roofG.add(at(roofSlope(rw, d / 2, roofH, eave, r1, r2, rows), 0, top, 0));
  const back = roofSlope(rw, d / 2, roofH, eave, r1, r2, rows);
  back.rotation.y = Math.PI;
  back.position.set(0, top, 0);
  roofG.add(back);
  roofG.add(at(box(rw + 0.02, 0.09, 0.14, M(roof2, { thr: [0.3, 0.5, 0.74] })), 0, top + roofH + 0.03, 0));
  inner.add(roofG);
  if (chimney) {
    const ch = tag(group(), 'chimney');
    const [cx, cz, chH] = chimney;
    ch.add(at(box(0.36, chH, 0.36, stoneM('#9a948a')), cx, top + chH / 2, cz));
    ch.add(at(box(0.44, 0.08, 0.44, stoneM('#7d7870')), cx, top + chH, cz));
    ch.add(at(box(0.22, 0.03, 0.22, M('#28222a', { e: 1 })), cx, top + chH + 0.045, cz));
    inner.add(ch);
  }
  if (ridge === 'v') inner.rotation.y = -Math.PI / 2;
  G.add(inner);
  G.userData = { ...G.userData, top, baseH };
  G.inner = inner;
  G.dims = { w, d, top, baseH, wallH, timber: timberM };
  return G;
}
/** 집 벽 위의 물건 놓기: face 'z'는 +v(왼쪽 아래), 'x'는 +u(오른쪽 아래). along은 벽 따라 위치 */
function onFace(G, ridge, face, along, y, obj, name = 'fx') {
  const { w, d } = G.dims;
  const wW = ridge === 'v' ? d : w;
  const dD = ridge === 'v' ? w : d;
  if (face === 'z') at(obj, along, y, dD / 2 + 0.02, 0, 0, 0);
  else at(obj, wW / 2 + 0.02, y, -along, 0, 90, 0);
  G.add(tag(obj, name + Math.round(along * 100) + face + y));
  return obj;
}

const P = {};
const def = (id, fp, solid, h, build) => (P[id] = { fp, solid, h, build });

def('house_a', [-1.5, -1.5, 1.5, 1.5], true, 2.8, () => {
  const G = house({ ridge: 'u', wall: '#ead9b5', roof: '#b9583b', roof2: '#a84c33', chimney: [0.7, -0.45, 1.0] });
  const tm = woodD();
  onFace(G, 'u', 'z', -0.3, 0.2, door1(woodL(), tm));
  onFace(G, 'u', 'z', 0.68, 0.84, window1(tm));
  onFace(G, 'u', 'z', -0.82, 0.84, window1(tm));
  onFace(G, 'u', 'x', 0.45, 0.84, window1(tm));
  onFace(G, 'u', 'x', -0.5, 0.84, window1(tm));
  onFace(G, 'u', 'x', 0, 1.82, window1(tm));
  G.add(tag(at(box(0.6, 0.06, 0.34, stoneM('#a29d92')), -0.3, 0.05, 1.42), 'step'));
  return G;
});
def('house_b', [-1.5, -1.5, 1.5, 1.5], true, 2.9, () => {
  const G = house({ ridge: 'v', wall: '#d9c6a0', timber: '#59391f', roof: '#5f7a4a', roof2: '#536d40', chimney: [-0.6, 0.4, 1.0], w: 2.5, d: 2.4, roofH: 1.2 });
  const tm = woodD();
  onFace(G, 'v', 'z', 0, 0.2, door1(M('#7a4a2c', { noise: [11, 0.1] }), tm));
  onFace(G, 'v', 'z', 0.8, 0.84, window1(tm));
  onFace(G, 'v', 'z', -0.8, 0.84, window1(tm));
  onFace(G, 'v', 'z', 0, 1.86, window1(tm));
  onFace(G, 'v', 'x', 0.5, 0.84, window1(tm));
  onFace(G, 'v', 'x', -0.5, 0.84, window1(tm));
  G.add(tag(at(box(0.62, 0.06, 0.32, stoneM('#a29d92')), 0, 0.05, 1.38), 'step'));
  // 꽃 상자
  const fb = group(at(box(0.5, 0.1, 0.12, woodD()), 0, 0, 0));
  const r = rng(5);
  for (let i = 0; i < 7; i++) fb.add(at(sph(0.05, 0.05, 0.05, M(i % 2 ? '#e0637a' : '#f2cf55', { e: 1 }), 6), -0.2 + i * 0.066, 0.08, (r() - 0.5) * 0.06));
  onFace(G, 'v', 'x', 0.5, 0.56, fb);
  return G;
});
def('house_c', [-1.5, -1.5, 1.5, 1.5], true, 3.3, () => {
  const G = house({ ridge: 'u', w: 2.5, d: 2.2, wallH: 1.75, roofH: 1.0, wall: '#d4d2c4', timber: '#4a4150', roof: '#50608a', roof2: '#465578', stone: '#7e7c7c', chimney: [-0.7, 0.3, 1.0] });
  const tm = M('#4a4150', { noise: [11, 0.1] });
  onFace(G, 'u', 'z', 0.5, 0.2, door1(M('#6e4a6a', { noise: [11, 0.1] }), tm));
  onFace(G, 'u', 'z', -0.6, 0.72, window1(tm));
  onFace(G, 'u', 'z', -0.6, 1.5, window1(tm));
  onFace(G, 'u', 'z', 0.5, 1.5, window1(tm));
  onFace(G, 'u', 'x', 0.45, 0.72, window1(tm));
  onFace(G, 'u', 'x', -0.45, 0.72, window1(tm));
  onFace(G, 'u', 'x', 0, 1.5, window1(tm));
  onFace(G, 'u', 'x', 0, 2.3, window1(tm));
  G.add(tag(at(box(0.6, 0.06, 0.32, stoneM('#9d9a94')), 0.5, 0.05, 1.3), 'step'));
  return G;
});
def('tavern', [-2, -2, 2, 2], true, 3.8, () => {
  const G = house({ ridge: 'u', w: 3.5, d: 3.3, wallH: 2.1, roofH: 1.35, baseH: 0.32, wall: '#e2c999', timber: '#553318', roof: '#9c3f33', roof2: '#8a372d', rows: 8, eave: 0.3, stone: '#7f7a70', chimney: [1.0, -0.6, 1.2] });
  const tm = woodD();
  onFace(G, 'u', 'z', 0, 0.32, door1(M('#7c4a26', { noise: [11, 0.1] }), tm, 0.7, 0.95));
  for (const a of [-1.2, 1.2]) onFace(G, 'u', 'z', a, 1.0, window1(tm));
  for (const a of [-1.2, 0, 1.2]) onFace(G, 'u', 'z', a, 1.9, window1(tm));
  for (const a of [-1.0, 0, 1.0]) {
    onFace(G, 'u', 'x', a, 1.0, window1(tm));
    onFace(G, 'u', 'x', a, 1.9, window1(tm));
  }
  onFace(G, 'u', 'x', 0, 2.85, window1(tm));
  // 입구 처마
  const aw = tag(group(), 'porch');
  aw.add(at(box(1.5, 0.08, 0.72, M('#8a372d', { noise: [9, 0.1] })), 0, 1.5, 2.0, 18));
  for (const x of [-0.68, 0.68]) aw.add(at(box(0.08, 1.42, 0.08, woodD()), x, 0.71, 2.26));
  G.add(aw);
  G.add(tag(at(box(1.6, 0.08, 0.6, stoneM('#a29d92')), 0, 0.05, 2.02), 'step'));
  // 걸린 간판 (맥주잔)
  const sg = tag(group(), 'tsign');
  sg.add(at(box(0.04, 0.04, 0.5, ironM()), 1.72, 2.1, 1.85));
  const bd = at(box(0.05, 0.5, 0.5, woodL()), 1.72, 1.75, 2.0);
  sg.add(bd);
  sg.add(at(box(0.06, 0.26, 0.2, M('#f0c64e', { e: 1 })), 1.75, 1.75, 2.0));
  sg.add(at(box(0.065, 0.06, 0.22, M('#fff2d0', { e: 1 })), 1.76, 1.87, 2.0));
  G.add(sg);
  // 통
  for (const [x, z] of [[-1.15, 1.98], [-1.5, 1.92]]) G.add(tag(barrelMesh(), 'b' + x).translateX(x).translateZ(z));
  return G;
});
def('smithy', [-1.5, -1.5, 1.5, 1.5], true, 3, () => {
  const G = group();
  const stone = stoneM('#7c7a76');
  const wallG = tag(group(), 'wall');
  wallG.add(at(box(2.5, 1.5, 0.28, stone), 0, 0.75, -1.1));
  wallG.add(at(box(0.28, 1.5, 2.4, stone), -1.12, 0.75, 0));
  G.add(wallG);
  // 안쪽 그늘과 바닥
  G.add(tag(at(box(2.4, 0.06, 2.4, M('#4a4642', { noise: [6, 0.06] })), 0, 0.03, 0), 'floor'));
  G.add(tag(at(box(1.1, 0.008, 1.0, M('#6e4a2a', { e: 1 })), 0.32, 0.066, -0.12), 'floorglow'));
  // 대장간 화덕 (안쪽 왼쪽)
  const forge = tag(group(), 'forge');
  forge.add(at(box(0.9, 0.62, 0.8, stoneM('#696560')), 0.15, 0.31, -0.5));
  forge.add(at(box(0.66, 0.05, 0.56, M('#ff8a2a', { e: 1 })), 0.15, 0.64, -0.46));
  forge.add(at(box(0.38, 0.06, 0.3, M('#ffe28a', { e: 1 })), 0.15, 0.66, -0.46));
  forge.add(at(cone(0.16, 0.34, GLOW.fire(), 7), 0.15, 0.84, -0.46));
  G.add(forge);
  // 지붕 기둥
  const posts = tag(group(), 'posts');
  for (const [x, z] of [[1.12, 1.12], [1.12, -1.0], [-1.12, 1.12]]) posts.add(at(box(0.14, 1.5, 0.14, woodD()), x, 0.75, z));
  posts.add(at(box(2.5, 0.1, 0.1, woodD()), 0, 1.5, 1.12));
  posts.add(at(box(0.1, 0.1, 2.4, woodD()), 1.12, 1.5, 0));
  G.add(posts);
  // 지붕
  const r1 = M('#5c5a62', { noise: [9, 0.03], thr: [0.3, 0.76, 1.2] });
  const r2 = M('#514f58', { noise: [9, 0.03], thr: [0.3, 0.76, 1.2] });
  const roofG = tag(group(), 'roof');
  roofG.add(at(roofSlope(3.0, 1.2, 0.95, 0.28, r1, r2, 5), 0, 1.5, 0));
  const back = roofSlope(3.0, 1.2, 0.95, 0.28, r1, r2, 5);
  back.rotation.y = Math.PI;
  back.position.y = 1.5;
  roofG.add(back);
  roofG.add(at(box(3.02, 0.09, 0.14, r2), 0, 2.48, 0));
  G.add(roofG);
  // 박공 막기
  const tri = extrude([[-1.2, 0], [1.2, 0], [0, 0.95]], 0.05, M('#6d4629', { noise: [11, 0.12] }));
  tri.rotation.y = Math.PI / 2;
  tri.position.set(1.14, 1.5, 0);
  G.add(tag(tri, 'gable'));
  // 굴뚝
  const ch = tag(group(), 'chimney');
  ch.add(at(box(0.5, 2.8, 0.5, stoneM('#807b74')), -0.45, 1.4, -0.72));
  ch.add(at(box(0.6, 0.1, 0.6, stoneM('#68635c')), -0.45, 2.8, -0.72));
  ch.add(at(box(0.32, 0.03, 0.32, M('#ff9a3a', { e: 1 })), -0.45, 2.86, -0.72));
  G.add(ch);
  // 모루
  const an = tag(group(), 'anvil');
  an.add(at(box(0.3, 0.32, 0.26, woodD()), 0.5, 0.22, 0.8));
  an.add(at(box(0.22, 0.1, 0.16, ironM()), 0.5, 0.44, 0.8));
  an.add(at(box(0.5, 0.11, 0.2, M('#5c5c68', { metal: 1 })), 0.5, 0.54, 0.8));
  an.add(at(cone(0.08, 0.2, M('#5c5c68', { metal: 1 }), 6), 0.82, 0.54, 0.8, 0, 0, -90));
  G.add(an);
  // 벽에 건 망치와 집게 모양
  const rack = tag(group(), 'rack');
  rack.add(at(box(0.06, 0.5, 0.05, woodL()), 0.55, 0.95, -0.94));
  rack.add(at(box(0.18, 0.12, 0.08, ironM()), 0.55, 1.16, -0.94));
  rack.add(at(box(0.05, 0.5, 0.05, woodL()), 0.85, 0.95, -0.94));
  rack.add(at(box(0.14, 0.14, 0.06, ironM()), 0.85, 1.18, -0.94));
  G.add(rack);
  return G;
});
def('shop_stall', [-1, -0.7, 1, 0.7], true, 1.9, () => {
  const G = group();
  const c = tag(group(), 'counter');
  c.add(at(box(1.9, 0.62, 0.8, woodD()), 0, 0.31, 0.15));
  c.add(at(box(2.0, 0.07, 0.92, woodL()), 0, 0.65, 0.15));
  G.add(c);
  const posts = tag(group(), 'posts');
  for (const [x, z] of [[-0.92, 0.55], [0.92, 0.55], [-0.92, -0.42], [0.92, -0.42]]) posts.add(at(cyl(0.035, 0.04, x !== 0 && z > 0 ? 1.45 : 1.75, woodL(), 8), x, z > 0 ? 0.72 : 0.87, z));
  G.add(posts);
  // 줄무늬 차양
  const aw = tag(group(), 'awning');
  const a = M('#c8483c', { thr: [0.3, 0.5, 0.92] });
  const b = M('#f0e4c8', { thr: [0.3, 0.5, 0.92] });
  for (let i = 0; i < 7; i++) {
    const s = box(2.3 / 7, 0.04, 1.42, i % 2 ? a : b);
    s.position.set(-1.15 + (i + 0.5) * (2.3 / 7), 1.62, 0.07);
    s.rotation.x = 21 * D2R;
    aw.add(s);
    const f = box(2.3 / 7, 0.16, 0.03, i % 2 ? b : a);
    f.position.set(-1.15 + (i + 0.5) * (2.3 / 7), 1.3, 0.76);
    aw.add(f);
  }
  G.add(aw);
  // 물건들
  const g = tag(group(), 'goods');
  const r = rng(11);
  const cols = ['#c8483c', '#e0a43a', '#6fa04a', '#b8c0cc', '#d9d0b8'];
  for (let i = 0; i < 9; i++) {
    const x = -0.78 + (i % 5) * 0.38 + (r() - 0.5) * 0.08;
    const z = i < 5 ? 0.32 : -0.02;
    const col = cols[i % 5];
    g.add(i % 2 ? at(sph(0.08, 0.08, 0.08, M(col), 8), x, 0.77, z) : at(box(0.14, 0.14, 0.14, M(col)), x, 0.76, z));
  }
  G.add(g);
  return G;
});

// ---------- 마을 작은 것 ----------
function barrelMesh() {
  const g = group();
  const w = M('#8e5f34', { noise: [12, 0.1] });
  const b = M('#50505a', { metal: 1 });
  g.add(at(lathe([[0, 0], [0.2, 0], [0.25, 0.14], [0.27, 0.27], [0.25, 0.4], [0.2, 0.54], [0, 0.54]], w, 12), 0, 0, 0));
  g.add(at(tor(0.26, 0.016, b, Math.PI * 2, 16, 4), 0, 0.14, 0, 90));
  g.add(at(tor(0.26, 0.016, b, Math.PI * 2, 16, 4), 0, 0.4, 0, 90));
  g.add(at(cyl(0.2, 0.2, 0.012, M('#a9794a'), 12), 0, 0.541, 0));
  return g;
}
def('well', [-0.6, -0.6, 0.6, 0.6], true, 1.8, () => {
  const G = group();
  const ring = tag(group(), 'ring');
  ring.add(at(lathe([[0.38, 0], [0.56, 0], [0.56, 0.55], [0.5, 0.6], [0.38, 0.6], [0.38, 0]], stoneM('#96938c'), 14), 0, 0, 0));
  ring.add(at(cyl(0.38, 0.38, 0.02, M('#2c4a68', { e: 1 }), 14), 0, 0.44, 0));
  G.add(ring);
  const fr = tag(group(), 'frame');
  for (const s of [1, -1]) fr.add(at(box(0.08, 1.25, 0.08, woodD()), 0, 0.62, s * 0.5));
  fr.add(at(cyl(0.035, 0.035, 1.12, woodL(), 8), 0, 1.02, 0, 90));
  fr.add(at(box(0.28, 0.04, 0.04, woodD()), 0.14, 1.02, 0.6));
  G.add(fr);
  const roof = tag(group(), 'roof');
  const r1 = M('#8a4a33', { noise: [9, 0.1] });
  const s1 = roofSlope(0.86, 0.52, 0.38, 0.14, r1, M('#7c422e'), 3);
  s1.rotation.y = Math.PI / 2;
  s1.position.y = 1.22;
  roof.add(s1);
  const s2 = roofSlope(0.86, 0.52, 0.38, 0.14, r1, M('#7c422e'), 3);
  s2.rotation.y = -Math.PI / 2;
  s2.position.y = 1.22;
  roof.add(s2);
  G.add(roof);
  G.add(tag(at(cyl(0.008, 0.008, 0.36, M('#c8b890'), 4), 0, 0.84, 0), 'rope'));
  G.add(tag(at(cyl(0.085, 0.07, 0.13, woodL(), 8), 0, 0.62, 0), 'bucket'));
  return G;
});
function lanternHead(sc = 1) {
  const g = group();
  const iron = ironM();
  g.add(at(cyl(0.1 * sc, 0.07 * sc, 0.02 * sc, iron, 8), 0, 0, 0));
  g.add(at(sph(0.092 * sc, 0.13 * sc, 0.092 * sc, GLOW.lamp(), 12), 0, 0.13 * sc, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    g.add(at(box(0.016 * sc, 0.26 * sc, 0.016 * sc, iron), Math.cos(a) * 0.088 * sc, 0.13 * sc, Math.sin(a) * 0.088 * sc));
  }
  g.add(at(cone(0.13 * sc, 0.1 * sc, iron, 8), 0, 0.3 * sc, 0));
  g.add(at(sph(0.022 * sc, 0.022 * sc, 0.022 * sc, iron, 6), 0, 0.37 * sc, 0));
  return g;
}
def('big_lantern', [-0.6, -0.6, 0.6, 0.6], true, 3.4, () => {
  const G = group();
  const b = tag(group(), 'base');
  b.add(at(cyl(0.58, 0.62, 0.16, stoneM('#8e8b84'), 12), 0, 0.08, 0));
  b.add(at(cyl(0.4, 0.46, 0.2, stoneM('#9c9992'), 12), 0, 0.26, 0));
  G.add(b);
  const p = tag(group(), 'post');
  const iron = M('#3f3f4a', { metal: 1 });
  p.add(at(cyl(0.085, 0.13, 2.2, iron, 10), 0, 1.45, 0));
  p.add(at(tor(0.12, 0.022, M('#b58a3e', { metal: 1 }), Math.PI * 2, 12, 4), 0, 0.6, 0, 90));
  p.add(at(tor(0.095, 0.02, M('#b58a3e', { metal: 1 }), Math.PI * 2, 12, 4), 0, 2.0, 0, 90));
  G.add(p);
  G.add(tag(at(lanternHead(2.7), 0, 2.5, 0), 'lamp'));
  return G;
});
def('lantern_post', [-0.2, -0.2, 0.2, 0.2], true, 1.9, () => {
  const G = group();
  const p = tag(group(), 'post');
  p.add(at(cyl(0.05, 0.07, 1.42, woodD(), 8), 0, 0.71, 0));
  p.add(at(cyl(0.12, 0.15, 0.1, stoneM('#8e8b84'), 8), 0, 0.05, 0));
  p.add(at(box(0.42, 0.05, 0.05, woodD()), 0.14, 1.36, -0.14, 0, 45));
  p.add(at(box(0.02, 0.1, 0.02, ironM()), 0.26, 1.3, -0.26));
  G.add(p);
  G.add(tag(at(lanternHead(1.05), 0.26, 0.96, -0.26), 'lamp'));
  return G;
});
function fence(axis) {
  const G = group();
  const inner = tag(group(), 'fence');
  const w = M('#9b7346', { noise: [11, 0.12] });
  for (const x of [-0.5, 0.5]) inner.add(at(box(0.09, 0.62, 0.09, M('#7f5b36', { noise: [11, 0.12] })), x, 0.31, 0));
  inner.add(at(box(1.0, 0.07, 0.04, w), 0, 0.46, 0));
  inner.add(at(box(1.0, 0.07, 0.04, w), 0, 0.24, 0));
  if (axis === 'v') inner.rotation.y = -Math.PI / 2;
  G.add(inner);
  return G;
}
def('fence_u', [-0.5, -0.1, 0.5, 0.1], true, 0.65, () => fence('u'));
def('fence_v', [-0.1, -0.5, 0.1, 0.5], true, 0.65, () => fence('v'));
def('crate', [-0.3, -0.3, 0.3, 0.3], true, 0.6, () => {
  const G = tag(group(), 'crate');
  const s = 0.56;
  G.add(at(box(s, s, s, M('#a97f4a', { noise: [11, 0.1] })), 0, s / 2, 0));
  const fr = M('#7f5b36', { noise: [11, 0.1] });
  const t = 0.06;
  for (const x of [1, -1])
    for (const z of [1, -1]) G.add(at(box(t, s + 0.01, t, fr), (x * s) / 2, s / 2, (z * s) / 2));
  for (const y of [t / 2, s - t / 2]) {
    for (const z of [1, -1]) G.add(at(box(s + 0.01, t, t, fr), 0, y, (z * s) / 2));
    for (const x of [1, -1]) G.add(at(box(t, t, s + 0.01, fr), (x * s) / 2, y, 0));
  }
  const dg = box(t * 0.8, s * 1.25, 0.02, fr);
  dg.position.set(0, s / 2, s / 2 + 0.005);
  dg.rotation.z = 45 * D2R;
  G.add(dg);
  const dg2 = box(0.02, s * 1.25, t * 0.8, fr);
  dg2.position.set(s / 2 + 0.005, s / 2, 0);
  dg2.rotation.x = 45 * D2R;
  G.add(dg2);
  return G;
});
def('barrel', [-0.3, -0.3, 0.3, 0.3], true, 0.6, () => tag(barrelMesh(), 'barrel'));
def('sign', [-0.2, -0.2, 0.2, 0.2], true, 1.2, () => {
  const G = group();
  G.add(tag(at(box(0.09, 1.1, 0.09, woodD()), 0, 0.55, 0), 'post'));
  const b = tag(group(), 'board');
  b.add(at(box(0.82, 0.42, 0.06, woodL()), 0.1, 0.86, 0.08, 0, -8));
  b.add(at(box(0.5, 0.05, 0.07, M('#4a2f1c')), 0.1, 0.92, 0.09, 0, -8));
  b.add(at(box(0.38, 0.05, 0.07, M('#4a2f1c')), 0.06, 0.8, 0.09, 0, -8));
  G.add(b);
  return G;
});
def('bench', [-0.7, -0.35, 0.7, 0.35], true, 0.75, () => {
  const G = group();
  const inner = tag(group(), 'bench');
  const w = woodL();
  inner.add(at(box(1.3, 0.06, 0.34, w), 0, 0.33, 0));
  inner.add(at(box(1.3, 0.14, 0.05, w), 0, 0.68, -0.16, -8));
  for (const x of [-0.55, 0.55]) {
    inner.add(at(box(0.07, 0.33, 0.28, woodD()), x, 0.16, 0));
    inner.add(at(box(0.05, 0.4, 0.05, woodD()), x, 0.52, -0.16));
  }
  G.add(inner);
  return G;
});
function roundTree(o) {
  const { trunkH = 1.3, trunkR = 0.2, leaf = '#4f8f3e', bark = '#6d4a2c', blobs = [], seed = 3 } = o;
  const G = group();
  const t = tag(group(), 'trunk');
  const b = M(bark, { noise: [8, 0.18] });
  t.add(at(lathe([[0.34 + trunkR * 0.4, 0], [trunkR * 1.25, 0.12], [trunkR, 0.4], [trunkR * 0.86, trunkH], [0, trunkH]], b, 10), 0, 0, 0));
  G.add(t);
  const f = tag(group(), 'leaves');
  const m = leafM(leaf);
  blobs.forEach(([x, y, z, r], i) => f.add(at(blob(r, r * 0.86, r, m, { seed: seed + i * 7, disp: 0.13, detail: 2 }), x, y, z)));
  G.add(f);
  return G;
}
def('tree_oak', [-0.35, -0.35, 0.35, 0.35], true, 3.6, () => roundTree({
  trunkH: 1.5, blobs: [[0, 2.35, 0, 1.05], [0.72, 2.0, 0.25, 0.74], [-0.7, 2.05, 0.1, 0.78], [0.1, 1.95, 0.75, 0.74], [-0.15, 2.05, -0.7, 0.74], [0.25, 2.95, 0.15, 0.68], [-0.42, 2.75, 0.45, 0.58]],
}));
def('tree_pine', [-0.35, -0.35, 0.35, 0.35], true, 4.2, () => {
  const G = group();
  G.add(tag(at(lathe([[0.3, 0], [0.2, 0.1], [0.15, 0.5], [0.11, 1.4], [0, 1.4]], M('#5c3f28', { noise: [8, 0.18] }), 10), 0, 0, 0), 'trunk'));
  const f = tag(group(), 'leaves');
  const m = M('#2f6e50', { noise: [10, 0.16], thr: [0.34, 0.5, 0.8], ao: 0 });
  const tiers = [[0.75, 0.95, 1.2], [1.45, 0.8, 1.05], [2.1, 0.64, 0.95], [2.72, 0.46, 0.85], [3.28, 0.28, 0.7]];
  tiers.forEach(([y, r, h]) => {
    const g = new THREE.ConeGeometry(r, h, 11, 2);
    const p = g.attributes.position;
    const rand = rng(Math.round(y * 100));
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < -h / 2 + 0.01) {
        const k = 1 + (rand() - 0.5) * 0.28;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
    }
    g.computeVertexNormals();
    f.add(at(rawMesh(g, m), 0, y + h / 2 - 0.1, 0));
  });
  G.add(f);
  return G;
});
def('bush', [-0.2, -0.2, 0.2, 0.2], false, 0.7, () => {
  const G = tag(group(), 'leaves');
  const m = leafM('#4d8c3f');
  for (const [x, y, z, r, s] of [[0, 0.32, 0, 0.4, 1], [0.28, 0.22, 0.1, 0.27, 2], [-0.26, 0.24, 0.12, 0.28, 3], [0.03, 0.2, 0.3, 0.24, 4]]) G.add(at(blob(r, r * 0.85, r, m, { seed: s, disp: 0.14 }), x, y, z));
  const r = rng(4);
  for (let i = 0; i < 5; i++) G.add(at(sph(0.035, 0.035, 0.035, M('#e0506a', { e: 1 }), 5), -0.25 + r() * 0.5, 0.32 + r() * 0.3, 0.1 + r() * 0.22));
  return G;
});
const rockMesh = (rx, ry, rz, mat, seed, disp = 0.2, detail = 1) => blob(rx, ry, rz, mat, { seed, disp, detail, flat: true });
def('rock_s', [-0.3, -0.3, 0.3, 0.3], true, 0.45, () => {
  const G = tag(group(), 'rock');
  const m = M('#90908c', { thr: [0.38, 0.56, 0.82] });
  G.add(at(rockMesh(0.32, 0.27, 0.28, m, 5), 0, 0.2, 0));
  G.add(at(rockMesh(0.15, 0.12, 0.14, m, 8), 0.26, 0.09, 0.14));
  return G;
});
def('rock_l', [-0.6, -0.6, 0.6, 0.6], true, 1.0, () => {
  const G = tag(group(), 'rock');
  const m = M('#8a8a88', { thr: [0.38, 0.56, 0.82] });
  G.add(at(rockMesh(0.62, 0.55, 0.56, m, 9), 0, 0.46, 0));
  G.add(at(rockMesh(0.32, 0.27, 0.3, m, 12), 0.45, 0.2, 0.34));
  G.add(at(rockMesh(0.28, 0.2, 0.26, m, 15), -0.5, 0.14, 0.3));
  return G;
});
def('stump', [-0.3, -0.3, 0.3, 0.3], true, 0.45, () => {
  const G = tag(group(), 'stump');
  G.add(at(lathe([[0.42, 0], [0.3, 0.08], [0.25, 0.2], [0.24, 0.38], [0, 0.38]], M('#6d4a2c', { noise: [9, 0.16] }), 10), 0, 0, 0));
  G.add(at(cyl(0.235, 0.235, 0.012, M('#c8a26a', { e: 1 }), 12), 0, 0.385, 0));
  G.add(at(tor(0.14, 0.008, M('#92703f', { e: 1 }), Math.PI * 2, 12, 3), 0, 0.392, 0, 90));
  return G;
});
const logMesh = (len, r, barkC = '#6d4a2c') => {
  const g = group();
  g.add(at(cyl(r, r * 1.05, len, M(barkC, { noise: [8, 0.18] }), 10), 0, 0, 0, 0, 0, 90));
  for (const s of [1, -1]) {
    g.add(at(cyl(r * 0.92, r * 0.92, 0.01, M('#c8a26a', { e: 1 }), 10), (s * len) / 2 + s * 0.004, 0, 0, 0, 0, 90));
  }
  return g;
};
def('log', [-0.7, -0.35, 0.7, 0.35], true, 0.45, () => {
  const G = tag(group(), 'log');
  G.add(at(logMesh(1.3, 0.2), 0, 0.2, 0.08, 0, 6, 0));
  G.add(at(logMesh(1.1, 0.16), 0.05, 0.16, -0.22, 0, -4, 0));
  return G;
});
def('hay', [-0.7, -0.35, 0.7, 0.35], true, 0.75, () => {
  const G = tag(group(), 'hay');
  const m = M('#d9b95a', { noise: [18, 0.26], thr: [0.34, 0.5, 0.78] });
  const bale = (x, y, z, ry = 0) => {
    const g = group(at(rbox(0.68, 0.34, 0.42, 0.06, m), 0, 0, 0));
    const b = M('#8a6a30');
    for (const a of [-0.17, 0.17]) g.add(at(box(0.02, 0.35, 0.43, b), a, 0, 0));
    return at(g, x, y, z, 0, ry, 0);
  };
  G.add(bale(-0.33, 0.17, 0, 4));
  G.add(bale(0.35, 0.17, 0.02, -3));
  G.add(bale(0.0, 0.51, 0.0, 6));
  return G;
});
function cartMesh(broken = false, woodC = '#9b7346', darkC = '#6d4f30') {
  const G = group();
  const w = M(woodC, { noise: [11, 0.12] });
  const d = M(darkC, { noise: [11, 0.12] });
  const inner = group();
  const bed = tag(group(), 'bed');
  bed.add(at(box(1.3, 0.06, 0.74, d), 0, 0.4, 0));
  for (const s of [1, -1]) {
    bed.add(at(box(1.3, 0.3, 0.04, w), 0, 0.57, (s * 0.37)));
    bed.add(at(box(0.04, 0.3, 0.74, w), (s * 0.65), 0.57, 0));
    for (const x of [-0.45, 0, 0.45]) bed.add(at(box(0.05, 0.34, 0.05, d), x, 0.57, s * 0.385));
  }
  inner.add(bed);
  const wheel = (x, z, name) => {
    const g = tag(group(), name);
    g.add(at(tor(0.28, 0.035, d, Math.PI * 2, 18, 6), 0, 0, 0));
    g.add(at(cyl(0.06, 0.06, 0.08, d, 8), 0, 0, 0, 90));
    for (let i = 0; i < 4; i++) g.add(at(box(0.03, 0.54, 0.03, d), 0, 0, 0, 0, 0, i * 45));
    return at(g, x, 0.29, z);
  };
  inner.add(wheel(0.28, 0.44, 'w1'));
  if (!broken) inner.add(wheel(0.28, -0.44, 'w2'));
  const shaftG = tag(group(), 'shaft');
  shaftG.add(strut([-0.65, 0.42, 0.22], [-1.05, 0.08, 0.22], 0.025, 0.025, d));
  shaftG.add(strut([-0.65, 0.42, -0.22], [-1.05, 0.08, -0.22], 0.025, 0.025, d));
  inner.add(shaftG);
  G.add(inner);
  G.inner = inner;
  return G;
}
def('cart', [-0.7, -0.35, 0.7, 0.35], true, 0.9, () => {
  const G = cartMesh();
  const load = tag(group(), 'load');
  load.add(at(blob(0.42, 0.2, 0.28, M('#c9a45a', { noise: [14, 0.2] }), { seed: 3 }), -0.05, 0.72, 0));
  load.add(at(sph(0.13, 0.13, 0.13, M('#b8a080'), 8), 0.32, 0.72, 0.1));
  G.add(load);
  return G;
});

// ---------- 숲 ----------
function mossTree(o) {
  const { h = 2.4, r = 0.34, canopy = [], seed = 7, dead = false } = o;
  const G = group();
  const bark = M('#5a4630', { noise: [7, 0.2], pat: { c: '#6f9440', f: 4.5, thr: 0.58 }, thr: [0.3, 0.46, 0.84] });
  const t = tag(group(), 'trunk');
  const g = new THREE.LatheGeometry([[r * 1.9, 0], [r * 1.25, 0.12], [r, 0.42], [r * 0.82, h * 0.6], [r * 0.6, h], [0, h]].map(([x, y]) => new THREE.Vector2(x, y)), 10, 0);
  const p = g.attributes.position;
  const rand = rng(seed);
  // 울퉁불퉁한 줄기
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getX(i), p.getZ(i));
    const k = 1 + 0.12 * Math.sin(a * 5 + seed) * (1 - p.getY(i) / h);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  t.add(rawMesh(g, bark));
  // 뿌리
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    t.add(strut([Math.sin(a) * r * 0.7, 0.3, Math.cos(a) * r * 0.7], [Math.sin(a) * r * 2.6, 0.02, Math.cos(a) * r * 2.6], r * 0.32, r * 0.1, bark, 6));
  }
  // 가지
  const branches = o.branches ?? [];
  branches.forEach(([a, b]) => t.add(strut(a, b, r * 0.34, r * 0.1, bark, 6)));
  G.add(t);
  if (canopy.length) {
    const f = tag(group(), 'leaves');
    const m = M('#44743a', { noise: [8, 0.28], thr: [0.34, 0.5, 0.8], pat: { c: '#5f8f42', f: 3, thr: 0.62 }, ao: 0 });
    canopy.forEach(([x, y, z, cr], i) => f.add(at(blob(cr, cr * 0.8, cr, m, { seed: seed + i * 5, disp: 0.15 }), x, y, z)));
    // 늘어진 이끼
    const d = M('#7aa04a', { noise: [10, 0.2] });
    for (let i = 0; i < 8; i++) {
      const [x, y, z, cr] = canopy[i % canopy.length];
      const a = rand() * Math.PI * 2;
      f.add(at(taper(0.05, 0.015, 0.34 + rand() * 0.3, 0.03, 0.01, d), x + Math.cos(a) * cr * 0.85, y - cr * 0.55, z + Math.sin(a) * cr * 0.85));
    }
    G.add(f);
  }
  return G;
}
def('tree_moss_l', [-0.35, -0.35, 0.35, 0.35], true, 4.4, () => mossTree({ h: 2.6, r: 0.4, seed: 7,
  canopy: [[0, 3.2, 0, 1.2], [0.9, 2.75, 0.3, 0.8], [-0.9, 2.8, 0.2, 0.85], [0.1, 2.7, 0.95, 0.8], [-0.1, 2.75, -0.9, 0.8], [0.3, 3.75, 0.2, 0.68]],
  branches: [[[0.2, 1.8, 0.1], [0.85, 2.5, 0.3]], [[-0.2, 1.9, 0.1], [-0.85, 2.55, 0.2]]] }));
def('tree_moss_s', [-0.35, -0.35, 0.35, 0.35], true, 3, () => mossTree({ h: 1.7, r: 0.26, seed: 13,
  canopy: [[0, 2.15, 0, 0.82], [0.55, 1.85, 0.2, 0.55], [-0.55, 1.9, 0.15, 0.56], [0.05, 1.8, 0.6, 0.55]] }));
def('tree_moss_dead', [-0.35, -0.35, 0.35, 0.35], true, 3, () => mossTree({ h: 2.0, r: 0.3, seed: 19, canopy: [],
  branches: [[[0.1, 1.45, 0.05], [0.85, 2.15, 0.3]], [[0.5, 1.85, 0.18], [0.5, 2.65, 0.4]], [[-0.12, 1.6, 0], [-0.9, 2.2, 0.15]], [[-0.55, 1.9, 0.08], [-0.75, 2.6, 0.3]], [[0, 1.8, -0.1], [0.1, 2.5, -0.75]]] }));
def('mush_cluster', [-0.2, -0.2, 0.2, 0.2], false, 0.6, () => {
  const G = tag(group(), 'mush');
  const stem = M('#e8dcc4');
  const capC = M('#c8452f', { thr: [0.3, 0.46, 0.8] });
  const spot = M('#fff4e0', { e: 1 });
  for (const [x, z, h, r] of [[0, 0, 0.42, 0.2], [0.22, 0.12, 0.26, 0.13], [-0.2, 0.14, 0.3, 0.15], [0.05, 0.26, 0.17, 0.1]]) {
    G.add(at(cyl(r * 0.28, r * 0.36, h, stem, 8), x, h / 2, z));
    G.add(at(sph(r, r * 0.68, r, capC, 12), x, h, z));
    G.add(at(sph(r * 0.17, r * 0.12, r * 0.17, spot, 5), x + r * 0.3, h + r * 0.56, z + r * 0.3));
    G.add(at(sph(r * 0.15, r * 0.1, r * 0.15, spot, 5), x - r * 0.42, h + r * 0.46, z + r * 0.12));
  }
  return G;
});
def('mossy_rock', [-0.6, -0.6, 0.6, 0.6], true, 1.0, () => {
  const G = tag(group(), 'rock');
  const m = M('#7d8078', { thr: [0.38, 0.56, 0.82], pat: { c: '#5f8a3c', f: 5.5, thr: 0.56, y0: 0.15, y1: 0.95 } });
  G.add(at(rockMesh(0.62, 0.56, 0.56, m, 21, 0.14, 2), 0, 0.46, 0));
  G.add(at(rockMesh(0.32, 0.27, 0.28, m, 24, 0.16, 2), 0.44, 0.18, 0.36));
  return G;
});
def('fallen_log', [-0.7, -0.35, 0.7, 0.35], true, 0.6, () => {
  const G = tag(group(), 'log');
  const bark = M('#59452f', { noise: [8, 0.2], pat: { c: '#6f9440', f: 4, thr: 0.5, y0: 0.2, y1: 0.55 } });
  G.add(at(cyl(0.25, 0.3, 1.5, bark, 10), 0, 0.27, 0, 0, 12, 90));
  const c = Math.cos(12 * D2R);
  const s = Math.sin(12 * D2R);
  G.add(at(cyl(0.24, 0.24, 0.01, M('#b08f5e', { e: 1 }), 10), 0.75 * c, 0.27, -0.75 * s, 0, 12, 90));
  G.add(at(tor(0.13, 0.012, M('#6d4f30', { e: 1 }), Math.PI * 2, 10, 3), 0.76 * c, 0.27, -0.76 * s, 0, 90 + 12, 0));
  G.add(at(cone(0.06, 0.26, bark, 5), -0.1, 0.56, 0.05, 10, 0, -20));
  return G;
});
function ruinStone(c = '#8e9288') {
  return M(c, { noise: [5, 0.22], thr: [0.34, 0.52, 0.82], pat: { c: '#688f44', f: 3.2, thr: 0.62 } });
}
def('ruin_pillar', [-0.2, -0.2, 0.2, 0.2], true, 1.9, () => {
  const G = tag(group(), 'pillar');
  const m = ruinStone();
  G.add(at(box(0.56, 0.14, 0.56, m), 0, 0.07, 0));
  G.add(at(cyl(0.2, 0.23, 1.4, m, 8), 0, 0.84, 0));
  // 부러진 윗부분
  const g = new THREE.CylinderGeometry(0.17, 0.2, 0.34, 8);
  const p = g.attributes.position;
  const r = rng(3);
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) + (r() - 0.5) * 0.26);
  g.computeVertexNormals();
  G.add(at(rawMesh(g, m), 0, 1.68, 0));
  G.add(at(rockMesh(0.14, 0.09, 0.12, m, 5), 0.34, 0.08, 0.3));
  return G;
});
/** 아치: v축을 따라 양쪽 기둥(+u쪽을 바라봄). rO=바깥 반지름 */
function archMesh({ span = 1.0, pillarH = 1.5, t = 0.34, mat, keystone = null }) {
  const G = group();
  const inner = group();
  // 기둥
  const pillars = tag(group(), 'arch');
  for (const s of [1, -1]) {
    pillars.add(at(box(t * 1.5, 0.2, t * 1.5, mat), 0, 0.1, s * span));
    pillars.add(at(box(t, pillarH, t, mat), 0, pillarH / 2, s * span));
  }
  // 돌을 이어 만든 반원
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI;
    const b = box(t * 1.05, span * 0.42, t, mat);
    b.position.set(0, pillarH + Math.sin(a) * span, Math.cos(a) * span);
    b.rotation.x = -a + Math.PI / 2 + Math.PI / 2;
    pillars.add(b);
  }
  inner.add(pillars);
  if (keystone) inner.add(tag(at(keystone, 0, pillarH + span, 0), 'key'));
  G.add(inner);
  return G;
}
def('ruin_arch', [-0.1, -0.1, 0.1, 0.1], false, 2.8, () => archMesh({ span: 0.95, pillarH: 1.45, t: 0.32, mat: ruinStone() }));

def('fern', [-0.2, -0.2, 0.2, 0.2], false, 0.5, () => {
  const G = tag(group(), 'fern');
  const m = M('#5a9a48', { side: THREE.DoubleSide, thr: [0.3, 0.46, 0.8] });
  const m2 = M('#3f7d40', { side: THREE.DoubleSide, thr: [0.3, 0.46, 0.8] });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 360;
    const leaf = taper(0.11, 0.02, 0.55, 0.012, 0.008, i % 2 ? m : m2);
    leaf.position.y = 0.275;
    const pivot = group(leaf);
    pivot.rotation.order = 'YXZ';
    pivot.rotation.set((i % 2 ? 52 : 34) * D2R, a * D2R, 0);
    G.add(pivot);
  }
  return G;
});

// ---------- 잿벌판 ----------
def('tree_dead', [-0.35, -0.35, 0.35, 0.35], true, 3, () => {
  const G = tag(group(), 'tree');
  const b = M('#3c3433', { noise: [7, 0.2], thr: [0.3, 0.46, 0.82] });
  G.add(at(lathe([[0.42, 0], [0.26, 0.14], [0.2, 0.5], [0.15, 1.3], [0.1, 1.8], [0, 1.8]], b, 8), 0, 0, 0));
  for (const [a, e, r] of [[[0.08, 1.2, 0], [0.75, 1.9, 0.2], 0.09], [[0.5, 1.68, 0.14], [0.65, 2.45, 0.1], 0.05], [[0.5, 1.68, 0.14], [1.0, 2.0, 0.35], 0.04], [[-0.08, 1.45, 0.05], [-0.72, 2.2, 0.1], 0.08], [[-0.45, 1.86, 0.08], [-0.42, 2.6, 0.3], 0.045], [[0, 1.75, 0], [0.12, 2.65, -0.3], 0.07], [[0.06, 2.2, -0.15], [-0.28, 2.85, -0.5], 0.035]]) G.add(strut(a, e, r, r * 0.3, b, 6));
  // 불씨 난 금
  const e = M('#ff7a2a', { e: 1 });
  G.add(at(box(0.05, 0.3, 0.02, e), 0.04, 0.5, 0.23, 8));
  return G;
});
const ashRock = (seed) => M('#5c5650', { thr: [0.36, 0.54, 0.82], pat: { c: '#3a3534', f: 4, thr: 0.62 } });
def('ash_rock_s', [-0.3, -0.3, 0.3, 0.3], true, 0.45, () => {
  const G = tag(group(), 'rock');
  const m = ashRock();
  G.add(at(rockMesh(0.33, 0.26, 0.28, m, 31), 0, 0.2, 0));
  G.add(at(rockMesh(0.14, 0.11, 0.13, m, 33), -0.26, 0.08, 0.16));
  return G;
});
def('ash_rock_l', [-0.6, -0.6, 0.6, 0.6], true, 1.1, () => {
  const G = tag(group(), 'rock');
  const m = ashRock();
  G.add(at(rockMesh(0.62, 0.6, 0.55, m, 35), 0, 0.5, 0));
  G.add(at(rockMesh(0.3, 0.26, 0.28, m, 37), -0.44, 0.2, 0.32));
  G.add(at(rockMesh(0.24, 0.2, 0.22, m, 38), 0.48, 0.14, 0.3));
  const e = M('#ff7a2a', { e: 1 });
  G.add(at(box(0.04, 0.34, 0.02, e), 0.2, 0.46, 0.5, 12, 15, 8));
  return G;
});
def('ember_vent', [-0.2, -0.2, 0.2, 0.2], false, 0.45, () => {
  const G = group();
  const c = tag(group(), 'vent');
  const m = M('#3c3433', { thr: [0.36, 0.54, 0.82] });
  c.add(at(lathe([[0.62, 0], [0.42, 0.12], [0.26, 0.26], [0.2, 0.2], [0.14, 0.12], [0, 0.1]], m, 10), 0, 0, 0));
  for (const [x, z, s] of [[0.4, 0.3, 4], [-0.44, 0.24, 5], [0.05, -0.46, 6]]) c.add(at(rockMesh(0.14, 0.1, 0.12, m, s), x, 0.08, z));
  G.add(c);
  G.add(tag(at(cyl(0.2, 0.24, 0.02, M('#ff7a2a', { e: 1 }), 12), 0, 0.2, 0), 'glow'));
  G.add(tag(at(cyl(0.12, 0.14, 0.02, M('#ffd873', { e: 1 }), 10), 0, 0.215, 0), 'glow'));
  G.add(tag(at(cone(0.09, 0.3, GLOW.fire(), 8), 0.01, 0.38, 0), 'glow'));
  const r = rng(9);
  for (let i = 0; i < 4; i++) G.add(tag(at(sph(0.024, 0.024, 0.024, M('#ffb24a', { e: 1 }), 5), (r() - 0.5) * 0.3, 0.4 + r() * 0.3, (r() - 0.5) * 0.3), 'spark' + i));
  return G;
});
def('broken_cart', [-0.7, -0.35, 0.7, 0.35], true, 0.8, () => {
  const G = group();
  const c = cartMesh(true, '#5e5148', '#3b342e');
  c.inner.rotation.set(-14 * D2R, 0, 8 * D2R);
  c.inner.position.y = 0.02;
  G.add(c);
  const wh = tag(group(), 'wheel');
  const d = M('#3b342e');
  wh.add(at(tor(0.28, 0.035, d, Math.PI * 2, 18, 6), 0, 0, 0));
  wh.add(at(box(0.03, 0.54, 0.03, d), 0, 0, 0));
  wh.add(at(box(0.54, 0.03, 0.03, d), 0, 0, 0));
  G.add(at(wh, 0.15, 0.05, -0.75, 90, 0, 0));
  G.add(tag(at(box(0.5, 0.03, 0.1, M('#5e5148')), -0.5, 0.02, 0.62, 0, 30), 'plank'));
  return G;
});
def('bone_pile', [-0.2, -0.2, 0.2, 0.2], false, 0.4, () => {
  const G = tag(group(), 'bones');
  const m = M('#e0d8c4', { thr: [0.3, 0.46, 0.84] });
  const r = rng(17);
  for (let i = 0; i < 9; i++) {
    const a = r() * 360;
    const g = group(at(cyl(0.022, 0.022, 0.42, m, 6), 0, 0, 0, 0, 0, 90));
    g.add(at(sph(0.04, 0.04, 0.04, m, 6), 0.21, 0, 0));
    g.add(at(sph(0.04, 0.04, 0.04, m, 6), -0.21, 0, 0));
    G.add(at(g, (r() - 0.5) * 0.5, 0.05 + r() * 0.15, (r() - 0.5) * 0.5, (r() - 0.5) * 30, a, (r() - 0.5) * 22));
  }
  G.add(at(sph(0.14, 0.12, 0.15, m, 10), 0.03, 0.22, 0.05));
  G.add(at(sph(0.03, 0.035, 0.012, M('#201820', { e: 1 }), 6), 0.08, 0.23, 0.18));
  G.add(at(sph(0.03, 0.035, 0.012, M('#201820', { e: 1 }), 6), -0.02, 0.23, 0.19));
  return G;
});

// ---------- 던전 ----------
const dungeonStone = (c = '#7e7f88') => M(c, { noise: [5, 0.18], thr: [0.34, 0.52, 0.82] });
def('pillar', [-0.2, -0.2, 0.2, 0.2], true, 2.4, () => {
  const G = tag(group(), 'pillar');
  const m = dungeonStone();
  G.add(at(box(0.62, 0.16, 0.62, m), 0, 0.08, 0));
  G.add(at(box(0.5, 0.12, 0.5, m), 0, 0.22, 0));
  G.add(at(cyl(0.2, 0.23, 1.85, m, 10), 0, 1.2, 0));
  G.add(at(box(0.5, 0.12, 0.5, m), 0, 2.16, 0));
  G.add(at(box(0.62, 0.14, 0.62, m), 0, 2.29, 0));
  return G;
});
def('torch', [-0.2, -0.2, 0.2, 0.2], true, 1.5, () => {
  const G = group();
  const p = tag(group(), 'stand');
  const iron = M('#3f3f4a', { metal: 1 });
  p.add(at(cyl(0.035, 0.05, 1.04, iron, 8), 0, 0.52, 0));
  p.add(at(cyl(0.15, 0.2, 0.06, iron, 8), 0, 0.03, 0));
  p.add(at(lathe([[0.05, 0], [0.16, 0.12], [0.2, 0.2], [0.14, 0.14], [0, 0.1]], iron, 10), 0, 1.0, 0));
  G.add(p);
  const f = tag(group(), 'flame');
  f.add(at(lathe([[0.02, 0], [0.13, 0.07], [0.16, 0.18], [0.12, 0.34], [0.05, 0.5], [0, 0.6]], GLOW.fire(), 12), 0, 1.13, 0));
  G.add(f);
  return G;
});
def('door_arch', [-0.1, -0.1, 0.1, 0.1], false, 3, () => {
  const G = archMesh({ span: 1.0, pillarH: 1.6, t: 0.36, mat: dungeonStone('#737480') });
  // 안쪽 어둠: 입구처럼 보이게 안쪽을 메운다
  const inner = extrude(archShape(0.84, 1.6), 0.05, M('#141019', { e: 1 }));
  inner.rotation.y = Math.PI / 2;
  G.add(tag(inner, 'dark'));
  return G;
});
function archShape(span, pillarH) {
  const pts = [[-span, 0], [span, 0], [span, pillarH]];
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    pts.push([Math.cos(a) * span, pillarH + Math.sin(a) * span]);
  }
  pts.push([-span, pillarH]);
  return pts;
}
function chestMesh(open) {
  const G = group();
  const inner = tag(group(), 'chest');
  const w = M('#8a5a2e', { noise: [11, 0.1] });
  const b = M('#d9ad45', { metal: 1 });
  inner.add(at(box(0.76, 0.34, 0.5, w), 0, 0.17, 0));
  for (const x of [-0.3, 0.3]) inner.add(at(box(0.07, 0.36, 0.52, b), x, 0.175, 0));
  G.add(inner);
  const lid = tag(group(), 'lid');
  const cylL = cyl(0.25, 0.25, 0.76, w, 12);
  cylL.rotation.z = Math.PI / 2;
  cylL.scale.set(1, 1, 1);
  const lidIn = group(cylL);
  const flat = box(0.76, 0.01, 0.5, w);
  lidIn.add(flat);
  for (const x of [-0.3, 0.3]) {
    const band = cyl(0.26, 0.26, 0.07, b, 12);
    band.rotation.z = Math.PI / 2;
    band.position.x = x;
    lidIn.add(band);
  }
  if (open) {
    // 뒤쪽 경첩을 축으로 열렸다
    const hinge = group();
    lidIn.position.z = 0.25;
    hinge.add(lidIn);
    hinge.position.set(0, 0.34, -0.25);
    hinge.rotation.x = -105 * D2R;
    lid.add(hinge);
    // 안쪽 금화 더미
    const goldG = tag(group(), 'gold');
    goldG.add(at(box(0.68, 0.02, 0.42, M('#2b1a10', { e: 1 })), 0, 0.33, 0));
    goldG.add(at(blob(0.3, 0.09, 0.18, M('#f0c64e', { thr: [0.3, 0.44, 0.72], noise: [22, 0.34] }), { seed: 4 }), 0, 0.35, 0.02));
    G.add(goldG);
  } else {
    lidIn.position.set(0, 0.34, 0);
    // 반원만 보이도록 아래쪽은 상자 속에 묻는다
    lid.add(lidIn);
    lid.add(at(box(0.12, 0.17, 0.05, b), 0, 0.31, 0.26));
    lid.add(at(sph(0.03, 0.03, 0.02, M('#6a4a1c'), 6), 0, 0.3, 0.29));
  }
  G.add(lid);
  return G;
}
def('chest', [-0.4, -0.3, 0.4, 0.3], true, 0.6, () => chestMesh(false));
def('chest_open', [-0.4, -0.3, 0.4, 0.3], true, 0.9, () => chestMesh(true));
def('rubble', [-0.2, -0.2, 0.2, 0.2], false, 0.35, () => {
  const G = tag(group(), 'rubble');
  const m = M('#7e7f88', { thr: [0.36, 0.54, 0.82] });
  const r = rng(29);
  for (let i = 0; i < 9; i++) {
    const s = 0.07 + r() * 0.14;
    G.add(at(rockMesh(s * (0.8 + r() * 0.6), s * 0.7, s, m, i + 40), (r() - 0.5) * 0.85, s * 0.5, (r() - 0.5) * 0.85));
  }
  return G;
});
def('statue', [-0.6, -0.6, 0.6, 0.6], true, 2.9, () => {
  const G = group();
  const m = M('#9a9c9e', { thr: [0.34, 0.52, 0.84], noise: [6, 0.1] });
  const base = tag(group(), 'base');
  base.add(at(box(1.1, 0.26, 1.1, dungeonStone('#6f7078')), 0, 0.13, 0));
  base.add(at(box(0.84, 0.28, 0.84, dungeonStone('#7c7d86')), 0, 0.4, 0));
  G.add(base);
  // 등불을 든 기사 석상: +u+v(화면 아래)를 바라본다
  const body = tag(group(), 'body');
  body.rotation.y = 45 * D2R;
  body.position.y = 0.54;
  body.add(at(lathe([[0.32, 0], [0.26, 0.5], [0.2, 0.9], [0.25, 1.15], [0.16, 1.32], [0, 1.34]], m, 12), 0, 0, 0));
  body.add(at(sph(0.2, 0.22, 0.2, m, 12), 0, 1.5, 0));
  body.add(at(cap(0.22, 0.24, 0.22, 88, 12, m), 0, 1.5, 0));
  for (const s of [1, -1]) body.add(at(sph(0.13, 0.11, 0.13, m, 8), s * 0.26, 1.18, 0));
  body.add(at(strut([-0.26, 1.15, 0], [-0.36, 0.72, 0.18], 0.075, 0.065, m), 0, 0, 0));
  body.add(strut([0.26, 1.15, 0], [0.32, 1.3, 0.28], 0.075, 0.065, m));
  body.add(strut([0.32, 1.3, 0.28], [0.3, 1.72, 0.32], 0.065, 0.055, m));
  // 든 등불 (꺼진 돌)
  body.add(at(cyl(0.1, 0.1, 0.2, M('#ffcc66', { e: 1 }), 8), 0.3, 1.88, 0.32));
  body.add(at(cone(0.13, 0.1, m, 8), 0.3, 2.03, 0.32));
  body.add(at(cyl(0.12, 0.09, 0.03, m, 8), 0.3, 1.78, 0.32));
  // 칼
  body.add(strut([-0.36, 0.72, 0.18], [-0.36, 0.05, 0.32], 0.034, 0.024, m));
  body.add(at(box(0.26, 0.04, 0.06, m), -0.36, 0.66, 0.2));
  G.add(body);
  return G;
});
function cap(rx, ry, rz, theta, tilt, mat) {
  const g = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, theta * D2R);
  const m = rawMesh(g, mat);
  m.scale.set(rx, ry, rz);
  m.rotation.x = -tilt * D2R;
  return m;
}

// ---------- 공통 ----------
def('portal_arch', [-0.1, -0.1, 0.1, 0.1], false, 3, () => {
  const m = M('#8c8fa0', { noise: [5, 0.16], thr: [0.34, 0.52, 0.82] });
  const key = group(at(box(0.42, 0.42, 0.42, M('#a9acbc', { noise: [5, 0.1] })), 0, 0, 0));
  key.add(at(box(0.44, 0.16, 0.16, M('#ffcf6e', { e: 1 })), 0, 0, 0));
  const G = archMesh({ span: 1.05, pillarH: 1.6, t: 0.4, mat: m, keystone: key });
  return G;
});
def('waystone', [-0.2, -0.2, 0.2, 0.2], true, 2.1, () => {
  const G = group();
  const m = M('#858a94', { noise: [5, 0.16], thr: [0.34, 0.52, 0.82] });
  const s = tag(group(), 'stone');
  s.add(at(cyl(0.34, 0.4, 0.14, m, 8), 0, 0.07, 0));
  const g = new THREE.CylinderGeometry(0.12, 0.2, 1.3, 6);
  g.computeVertexNormals();
  s.add(at(rawMesh(g, m), 0, 0.79, 0));
  // 새긴 빛 무늬
  const e = M('#ffcf6e', { e: 1 });
  s.add(at(box(0.04, 0.42, 0.02, e), 0.1, 0.78, 0.13, 0, 45));
  s.add(at(box(0.14, 0.04, 0.02, e), 0.1, 0.86, 0.13, 0, 45));
  s.add(at(cyl(0.16, 0.13, 0.06, M('#50505a', { metal: 1 }), 8), 0, 1.47, 0));
  G.add(s);
  G.add(tag(at(lanternHead(1.25), 0, 1.5, 0), 'lamp'));
  return G;
});

export const PROPS = P;
