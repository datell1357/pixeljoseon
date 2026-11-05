// 뼈대와 포즈. 포즈는 평평한 키-값 객체이고, 프레임 사이는 선형 보간한다.
import { THREE, D2R, group, at } from './kit.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4();
const _x = V();
const _y = V();
const _z = V();

/** 2본 IK. 관절 위치와 실제 도달점을 돌려준다 */
function solve2(A, T, l1, l2, pole) {
  const dir = T.clone().sub(A);
  let d = dir.length();
  if (d < 1e-4) {
    dir.set(0, -1, 0);
    d = 1e-4;
  } else dir.divideScalar(d);
  d = Math.min(d, l1 + l2 - 1e-3);
  d = Math.max(d, Math.abs(l1 - l2) + 1e-3);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1);
  perp.normalize();
  const K = A.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  const E = A.clone().addScaledVector(dir, d);
  return { K, E };
}

/** 뼈를 from에서 to로 향하게 놓는다. 뼈는 지역 -Y로 뻗고, 지역 +Z가 pole 쪽을 본다 */
function placeBone(o, from, to, pole) {
  o.position.copy(from);
  _y.copy(from).sub(to).normalize();
  _z.copy(pole).addScaledVector(_y, -pole.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  o.quaternion.setFromRotationMatrix(_m);
}

/** 키프레임 → 프레임 배열. keys: [[프레임, 포즈, 이징?]...]. loop면 끝에서 처음으로 이어 보간 */
export function bakeKeys(n, keys, base = {}, loop = false) {
  const full = keys.map(([f, p, e]) => [f, { ...base, ...p }, e]);
  const out = [];
  for (let f = 0; f < n; f++) {
    let a = full[0];
    let b = null;
    for (let i = 0; i < full.length; i++) {
      if (full[i][0] <= f) {
        a = full[i];
        b = full[i + 1] ?? (loop ? [full[0][0] + n, full[0][1], full[0][2]] : null);
      }
    }
    if (!b || a[0] === f) {
      out.push({ ...a[1] });
      continue;
    }
    let t = (f - a[0]) / (b[0] - a[0]);
    const e = a[2];
    if (e === 'in') t = t * t;
    else if (e === 'out') t = 1 - (1 - t) * (1 - t);
    else if (e === 'io') t = t * t * (3 - 2 * t);
    const p = {};
    for (const k of new Set([...Object.keys(a[1]), ...Object.keys(b[1])])) {
      const x = a[1][k] ?? base[k] ?? 0;
      const y = b[1][k] ?? base[k] ?? 0;
      p[k] = x + (y - x) * t;
    }
    out.push(p);
  }
  return out;
}

/** 일반 뼈대: 이름 붙은 노드에 'name.rx' 같은 키로 포즈를 건다 */
export class Rig {
  constructor() {
    this.root = new THREE.Group();
    this.nodes = {};
    this.rest = new Map();
    this.anims = {};
    this.post = null;
  }
  /** 노드를 등록하고 쉬는 자세를 기억한다 */
  node(name, parent, x = 0, y = 0, z = 0) {
    const g = name && this.nodes[name] ? this.nodes[name] : new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.order = 'YXZ';
    (parent ?? this.root).add(g);
    this.nodes[name] = g;
    this.rest.set(g, { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() });
    return g;
  }
  remember() {
    for (const g of Object.values(this.nodes)) this.rest.set(g, { p: g.position.clone(), r: g.rotation.clone(), s: g.scale.clone() });
  }
  apply(pose) {
    for (const [g, r] of this.rest) {
      g.position.copy(r.p);
      g.rotation.copy(r.r);
      g.scale.copy(r.s);
    }
    for (const k in pose) {
      const dot = k.indexOf('.');
      if (dot < 0) continue;
      const g = this.nodes[k.slice(0, dot)];
      if (!g) continue;
      const v = pose[k];
      switch (k.slice(dot + 1)) {
        case 'rx': g.rotation.x += v * D2R; break;
        case 'ry': g.rotation.y += v * D2R; break;
        case 'rz': g.rotation.z += v * D2R; break;
        case 'px': g.position.x += v; break;
        case 'py': g.position.y += v; break;
        case 'pz': g.position.z += v; break;
        case 'sx': g.scale.x *= v; break;
        case 'sy': g.scale.y *= v; break;
        case 'sz': g.scale.z *= v; break;
        case 's': g.scale.multiplyScalar(v); break;
        case 'v': g.visible = v > 0.5; break;
      }
    }
    if (this.post) this.post(pose);
  }
}

export const STAND = {
  // 온몸 (구르기·쓰러짐): 발 목표까지 함께 움직인다
  Px: 0, Py: 0, Pz: 0, Prx: 0, Pry: 0, Prz: 0,
  // 엉덩이 위치·회전
  hx: 0, hy: 0, hz: 0, hrx: 0, hry: 0, hrz: 0,
  // 가슴, 머리
  crx: 0, cry: 0, crz: 0, drx: 0, dry: 0, drz: 0,
  // 손 목표 (극좌표: a 방위각 도, 0=앞, -90=오른쪽, +90=왼쪽 / r 반지름 / y 높이)
  Ra: -70, Rr: 0.3, Ry: 0.46, La: 70, Lr: 0.3, Ly: 0.46,
  // 손에 든 물건 방향 (y 방위각, p 올림각, r 비틀기)
  Wy: 0, Wp: 0, Wr: 0, Vy: 0, Vp: 0, Vr: 0,
  // 발 목표 (쉬는 자리에서의 차이, p 앞꿈치 내림, a 발끝 벌림)
  Fx: 0, Fy: 0, Fz: 0, Fp: 0, Fa: 0, Gx: 0, Gy: 0, Gz: 0, Gp: 0, Ga: 0,
  // 망토
  c1: 8, c2: 6,
  // 기타
  draw: 0, arrow: 0, glow: 1,
};

/** 사람형 뼈대. 팔다리는 IK로 풀어서 발이 땅에 붙고 손이 몸을 뚫지 않는다 */
export class Human extends Rig {
  constructor(dims = {}) {
    super();
    const d = (this.d = {
      hipH: 0.42, hipW: 0.1, thigh: 0.195, shin: 0.195, ankle: 0.05, stance: 0.115,
      toe: 0.12, heel: 0.05, spine: 0.03, shoulderY: 0.32, shoulderW: 0.205, upper: 0.17, fore: 0.17, headY: 0.36,
      ...dims,
    });
    this.pivot = this.node('pivot');
    this.hips = this.node('hips', this.pivot, 0, d.hipH, 0);
    this.chest = this.node('chest', this.hips, 0, d.spine, 0);
    this.head = this.node('head', this.chest, 0, d.headY, 0);
    this.upperL = this.node('upperL', this.pivot);
    this.foreL = this.node('foreL', this.pivot);
    this.handL = this.node('handL', this.pivot);
    this.upperR = this.node('upperR', this.pivot);
    this.foreR = this.node('foreR', this.pivot);
    this.handR = this.node('handR', this.pivot);
    this.thighL = this.node('thighL', this.pivot);
    this.shinL = this.node('shinL', this.pivot);
    this.footL = this.node('footL', this.pivot);
    this.thighR = this.node('thighR', this.pivot);
    this.shinR = this.node('shinR', this.pivot);
    this.footR = this.node('footR', this.pivot);
    this.gripL = this.node('gripL', this.pivot);
    this.gripR = this.node('gripR', this.pivot);
    this.cape1 = null;
    this.cape2 = null;
    for (const n of ['pivot', 'hips', 'chest', 'head', 'gripL', 'gripR', 'footL', 'footR']) this.nodes[n].rotation.order = 'YXZ';
    this.post2 = null;
  }
  apply(pose) {
    const P = { ...STAND, ...pose };
    const d = this.d;
    super.apply(pose);
    this.pivot.position.set(P.Px, P.Py, P.Pz);
    this.pivot.rotation.set(P.Prx * D2R, P.Pry * D2R, P.Prz * D2R);
    this.hips.position.set(P.hx, d.hipH + P.hy, P.hz);
    this.hips.rotation.set(P.hrx * D2R, P.hry * D2R, P.hrz * D2R);
    this.chest.rotation.set(P.crx * D2R, P.cry * D2R, P.crz * D2R);
    this.head.rotation.set(P.drx * D2R, P.dry * D2R, P.drz * D2R);
    this.hips.updateMatrix();
    this.chest.updateMatrix();
    const hipM = this.hips.matrix;
    const chestM = new THREE.Matrix4().multiplyMatrices(hipM, this.chest.matrix);

    // 다리
    const poleF = V(0, 0, 1).applyAxisAngle(V(0, 1, 0), P.hry * D2R);
    const leg = (side, fx, fy, fz, fp, fa, thigh, shin, foot) => {
      const H = V(side * d.hipW, 0, 0).applyMatrix4(hipM);
      // 발이 기울면 발끝이나 뒤꿈치가 땅을 파고들지 않게 발목을 들어 올린다
      const lift = fp > 0 ? d.toe * Math.sin(fp * D2R) : d.heel * Math.sin(-fp * D2R);
      const T = V(side * d.stance + fx, d.ankle + fy + lift, fz);
      const pole = poleF.clone().add(V(side * 0.25, 0, 0)).normalize();
      const { K, E } = solve2(H, T, d.thigh, d.shin, pole);
      placeBone(thigh, H, K, pole);
      placeBone(shin, K, E, pole);
      foot.position.copy(E);
      foot.rotation.set(fp * D2R, (P.hry * 0.5 + side * fa) * D2R, 0);
    };
    leg(1, P.Fx, P.Fy, P.Fz, P.Fp, P.Fa, this.thighL, this.shinL, this.footL);
    leg(-1, P.Gx, P.Gy, P.Gz, P.Gp, P.Ga, this.thighR, this.shinR, this.footR);

    // 손에 든 물건이 칸 밖으로 나가지 않게 손 위치와 기울기를 조금씩 고친다
    const pivotM = this.pivot.updateMatrix() || this.pivot.matrix;
    const fit = (hold, a, r, y, yaw, pitch) => {
      if (!hold || P.nofit) return [r, y, pitch];
      const slide = hold === d.holdR ? P.Wslide ?? 0 : 0;
      const fwd = hold.fwd + slide;
      const back = hold.back - slide;
      const lim = d.limits ?? { R: 0.97, down: 16, up: 72 };
      const end = V();
      for (let it = 0; it < 24; it++) {
        const hx = r * Math.sin(a * D2R) + P.hx;
        const hz = r * Math.cos(a * D2R) + P.hz;
        const hy = y + P.hy;
        const cp = Math.cos(pitch * D2R);
        const dv = V(Math.sin(yaw * D2R) * cp, Math.sin(pitch * D2R), Math.cos(yaw * D2R) * cp);
        let bad = 0;
        let badKind = '';
        for (const k of [fwd, -back]) {
          end.set(hx + dv.x * k, hy + dv.y * k, hz + dv.z * k).applyMatrix4(pivotM);
          const R = Math.hypot(end.x, end.z);
          const dn = 22.63 * R - 39.19 * end.y;
          const up = 39.19 * end.y + 22.63 * R;
          if (R > lim.R) {
            bad = R - lim.R;
            badKind = k > 0 ? 'R' : 'Rb';
          } else if (dn > lim.down) {
            bad = (dn - lim.down) / 40;
            badKind = 'down';
          } else if (up > lim.up) {
            bad = (up - lim.up) / 40;
            badKind = 'up';
          }
          if (bad) break;
        }
        if (!bad) break;
        if (badKind === 'R' || badKind === 'Rb') {
          if (r > 0.16) r = Math.max(0.16, r - Math.min(0.05, bad + 0.01));
          else pitch += pitch >= 0 ? 6 : -6;
        } else if (badKind === 'down') {
          pitch += 5;
          if (r > 0.16) r -= 0.02;
        } else {
          pitch -= 5;
          y -= 0.02;
        }
      }
      return [r, y, pitch];
    };
    const [fRr, fRy, fWp] = fit(d.holdR, P.Ra, P.Rr, P.Ry, P.Wy, P.Wp);
    P.Rr = fRr;
    P.Ry = fRy;
    P.Wp = fWp;
    const [fLr, fLy, fVp] = fit(d.holdL, P.La, P.Lr, P.Ly, P.Vy, P.Vp);
    P.Lr = fLr;
    P.Ly = fLy;
    P.Vp = fVp;

    // 팔
    const arm = (side, a, r, y, upper, fore, hand, grip, yaw, pitch, roll) => {
      const S = V(side * d.shoulderW, d.shoulderY, 0).applyMatrix4(chestM);
      const T = V(r * Math.sin(a * D2R) + P.hx, y + P.hy, r * Math.cos(a * D2R) + P.hz);
      const pole = V(side * 0.75, -0.6, -0.55).normalize();
      const { K, E } = solve2(S, T, d.upper, d.fore, pole);
      placeBone(upper, S, K, pole);
      placeBone(fore, K, E, pole);
      hand.position.copy(E);
      grip.position.copy(E);
      grip.rotation.set(-pitch * D2R, yaw * D2R, roll * D2R);
    };
    arm(1, P.La, P.Lr, P.Ly, this.upperL, this.foreL, this.handL, this.gripL, P.Vy, P.Vp, P.Vr);
    arm(-1, P.Ra, P.Rr, P.Ry, this.upperR, this.foreR, this.handR, this.gripR, P.Wy, P.Wp, P.Wr);

    if (this.cape1) this.cape1.rotation.set(P.c1 * D2R, 0, 0);
    if (this.cape2) this.cape2.rotation.set(P.c2 * D2R, 0, 0);
    if (this.cape1) this.cape1.scale.y = P.capeS ?? 1;
    if (this.slideNode) this.slideNode.position.z = P.Wslide ?? 0;
    if (this.post2) this.post2(P);
  }
}

/** 걷기 8프레임 (두 번의 내딛음). 발은 땅에 붙어 뒤로 밀리고, 들 때만 뜬다 */
export function walkFrames(n, opt = {}) {
  const { stride = 0.17, lift = 0.075, bob = 0.012, sway = 0.008, arm = 16, twist = 7, lean = 4, extra = null } = opt;
  const out = [];
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * Math.PI * 2;
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    const zL = stride * c;
    const zR = -zL;
    const yL = lift * Math.max(0, -s);
    const yR = lift * Math.max(0, s);
    const p = {
      Fz: zL, Fy: yL, Fp: 4 - 16 * c,
      Gz: zR, Gy: yR, Gp: 4 + 16 * c,
      hy: -bob * Math.cos(2 * ph) - bob,
      hx: sway * s,
      hrz: -1 * s,
      hry: twist * 0.5 * c,
      cry: -twist * c,
      crx: lean,
      drx: -lean * 0.4,
      c1: 22 + 5 * Math.cos(2 * ph),
      c2: 10 + 4 * Math.sin(2 * ph),
    };
    if (extra) Object.assign(p, extra(ph, c, s, i));
    p._arm = arm * c;
    out.push(p);
  }
  return out;
}

/** 네 발 짐승. 발 목표는 땅에 고정, 몸은 키프레임으로 움직인다 */
export class Quad extends Rig {
  constructor(dims = {}) {
    super();
    const d = (this.d = { bodyH: 0.42, hipX: 0.15, frontZ: 0.32, backZ: -0.34, upper: 0.2, lower: 0.2, ankle: 0.03, front: 1, back: -1, ...dims });
    this.pivot = this.node('pivot');
    this.body = this.node('body', this.pivot, 0, d.bodyH, 0);
    this.legs = {};
    for (const [n, x, z] of [['FL', 1, d.frontZ], ['FR', -1, d.frontZ], ['BL', 1, d.backZ], ['BR', -1, d.backZ]]) {
      this.legs[n] = { upper: this.node('u' + n, this.pivot), lower: this.node('l' + n, this.pivot), foot: this.node('f' + n, this.pivot), x: x * d.hipX, z, pole: n[0] === 'F' ? d.front : d.back };
    }
  }
  apply(pose) {
    const P = pose;
    const g = (k, v = 0) => P[k] ?? v;
    super.apply(pose);
    const d = this.d;
    this.pivot.position.set(g('Px'), g('Py'), g('Pz') + (d.shift ?? 0));
    this.pivot.rotation.set(g('Prx') * D2R, g('Pry') * D2R, g('Prz') * D2R);
    this.body.position.set(0, d.bodyH + g('By'), g('Bz'));
    this.body.rotation.set(g('Brx') * D2R, g('Bry') * D2R, g('Brz') * D2R);
    this.body.updateMatrix();
    for (const n in this.legs) {
      const L = this.legs[n];
      const H = V(L.x, -0.02, L.z).applyMatrix4(this.body.matrix);
      const T = V(L.x + g(n + 'x'), d.ankle + g(n + 'y'), L.z + g(n + 'z'));
      const pole = V(0, 0, L.pole);
      const { K, E } = solve2(H, T, d.upper, d.lower, pole);
      placeBone(L.upper, H, K, pole);
      placeBone(L.lower, K, E, pole);
      L.foot.position.copy(E);
    }
    if (this.post2) this.post2(P);
  }
}
/** 짐승 걸음: 대각선 다리끼리 함께 */
export function trotFrames(n, { stride = 0.14, lift = 0.07, bob = 0.012, extra = null } = {}) {
  const out = [];
  const leg = (ph) => ({ z: stride * Math.cos(ph), y: lift * Math.max(0, -Math.sin(ph)) });
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * Math.PI * 2;
    const a = leg(ph);
    const b = leg(ph + Math.PI);
    const p = {
      FLz: a.z, FLy: a.y, BRz: a.z, BRy: a.y, FRz: b.z, FRy: b.y, BLz: b.z, BLy: b.y,
      By: -bob * Math.cos(2 * ph), Brz: 2 * Math.sin(ph), Bry: 2.5 * Math.cos(ph),
    };
    if (extra) Object.assign(p, extra(ph, Math.cos(ph), Math.sin(ph), i));
    out.push(p);
  }
  return out;
}
