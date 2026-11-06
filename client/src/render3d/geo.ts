// 코드로 모델을 짓는 도구. 모든 모델은 같은 정점 형식(위치·법선·색·보조값·uv)을 쓴다.
import * as THREE from 'three';

export type Hex = number;

export interface Surf {
  /** 금속·유약 반짝임 0~1 */
  spec?: number;
  /** 스스로 빛남 0~1 */
  em?: number;
  /** 바람에 흔들리는 정도 0~1 */
  wind?: number;
  /** 외곽선을 나누는 부위 번호. 0이면 외곽선 없음 */
  id?: number;
}

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rgb(h: Hex): [number, number, number] {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

export function mix(a: Hex, b: Hex, t: number): Hex {
  const x = rgb(a);
  const y = rgb(b);
  const c = (i: number) => Math.round((x[i] + (y[i] - x[i]) * t) * 255);
  return (c(0) << 16) | (c(1) << 8) | c(2);
}

/** 밝기를 k배. 어두운 쪽은 파랗게, 밝은 쪽은 따뜻하게 살짝 민다 */
export function tone(h: Hex, k: number): Hex {
  const [r, g, b] = rgb(h);
  const warm = k > 1 ? (k - 1) * 0.12 : 0;
  const cool = k < 1 ? (1 - k) * 0.1 : 0;
  const f = (v: number, d: number) => Math.round(Math.max(0, Math.min(1, v * k + d)) * 255);
  return (f(r, warm - cool * 0.6) << 16) | (f(g, 0) << 8) | f(b, cool - warm * 0.7);
}

let leafDensity = 1;
/** 낮은 그래픽에서 잎 카드 수를 줄인다 */
export function setLeafDensity(k: number) {
  leafDensity = k;
}

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const A = v3();
const B = v3();
const C = v3();
const D = v3();
const N = v3();

export class Geo {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  aux: number[] = [];
  uvs: number[] = [];
  bones: number[] = [];
  /** 정점이 따라갈 뼈 번호 */
  bone = 0;
  m = new THREE.Matrix4();
  nm = new THREE.Matrix3();
  surf: Required<Surf> = { spec: 0, em: 0, wind: 0, id: 1 };
  hasM = false;
  /** 낮을수록 어두워지는 접지 그늘. [높이 시작, 끝, 어두운 정도] */
  groundAO: [number, number, number] | null = null;

  set(s: Surf) {
    Object.assign(this.surf, s);
    return this;
  }

  /** 변환을 걸고 그린다 */
  at(m: THREE.Matrix4, fn: () => void) {
    const pm = this.m.clone();
    const ph = this.hasM;
    this.m.multiply(m);
    this.nm.getNormalMatrix(this.m);
    this.hasM = true;
    fn();
    this.m.copy(pm);
    this.nm.getNormalMatrix(this.m);
    this.hasM = ph;
    return this;
  }

  move(x: number, y: number, z: number, fn: () => void) {
    return this.at(new THREE.Matrix4().makeTranslation(x, y, z), fn);
  }

  rotY(a: number, fn: () => void) {
    return this.at(new THREE.Matrix4().makeRotationY(a), fn);
  }

  rotZ(a: number, fn: () => void) {
    return this.at(new THREE.Matrix4().makeRotationZ(a), fn);
  }

  rotX(a: number, fn: () => void) {
    return this.at(new THREE.Matrix4().makeRotationX(a), fn);
  }

  private vtx(p: THREE.Vector3, n: THREE.Vector3, c: [number, number, number], u = 0, v = 0) {
    const q = p.clone();
    const m = n.clone();
    if (this.hasM) {
      q.applyMatrix4(this.m);
      m.applyMatrix3(this.nm).normalize();
    }
    let k = 1;
    if (this.groundAO) {
      const [y0, y1, d] = this.groundAO;
      const t = Math.max(0, Math.min(1, (q.y - y0) / (y1 - y0)));
      k = 1 - d * (1 - t);
    }
    this.pos.push(q.x, q.y, q.z);
    this.nor.push(m.x, m.y, m.z);
    this.col.push(c[0] * k, c[1] * k, c[2] * k);
    this.aux.push(this.surf.spec, this.surf.em, this.surf.wind, this.surf.id / 255);
    this.uvs.push(u, v);
    this.bones.push(this.bone);
  }

  /** 면 법선 삼각형 */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, col: Hex) {
    N.copy(b).sub(a).cross(C.copy(c).sub(a)).normalize();
    const n = N.clone();
    const k = rgb(col);
    this.vtx(a, n, k);
    this.vtx(b, n, k);
    this.vtx(c, n, k);
    return this;
  }

  /** 네모. a b c d는 반시계로 */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, col: Hex) {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
    return this;
  }

  /** 모서리를 깎은 상자. 깎인 면이 빛을 받아 윤곽이 산다 */
  /** 법선이 center에서 바깥으로 퍼지는 사각형. 머리카락처럼 둥글게 빛을 받는 면에 쓴다 */
  quadS(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, col: Hex, center: THREE.Vector3) {
    const k = rgb(col);
    const n = (p: THREE.Vector3) => p.clone().sub(center).normalize();
    this.vtx(a, n(a), k);
    this.vtx(b, n(b), k);
    this.vtx(c, n(c), k);
    this.vtx(a, n(a), k);
    this.vtx(c, n(c), k);
    this.vtx(d, n(d), k);
    return this;
  }

  box(cx: number, cy: number, cz: number, w: number, h: number, d: number, col: Hex, bevel = 0) {
    const x = w / 2;
    const y = h / 2;
    const z = d / 2;
    const b = Math.min(bevel, x * 0.9, y * 0.9, z * 0.9);
    const P = (px: number, py: number, pz: number) => v3(cx + px, cy + py, cz + pz);
    if (b <= 0) {
      const a = [P(-x, -y, z), P(x, -y, z), P(x, y, z), P(-x, y, z), P(-x, -y, -z), P(x, -y, -z), P(x, y, -z), P(-x, y, -z)];
      this.quad(a[0], a[1], a[2], a[3], col);
      this.quad(a[5], a[4], a[7], a[6], col);
      this.quad(a[1], a[5], a[6], a[2], col);
      this.quad(a[4], a[0], a[3], a[7], col);
      this.quad(a[3], a[2], a[6], a[7], col);
      this.quad(a[4], a[5], a[1], a[0], col);
      return this;
    }
    const X = x - b;
    const Y = y - b;
    const Z = z - b;
    // 여섯 면
    this.quad(P(-X, -Y, z), P(X, -Y, z), P(X, Y, z), P(-X, Y, z), col);
    this.quad(P(X, -Y, -z), P(-X, -Y, -z), P(-X, Y, -z), P(X, Y, -z), col);
    this.quad(P(x, -Y, Z), P(x, -Y, -Z), P(x, Y, -Z), P(x, Y, Z), col);
    this.quad(P(-x, -Y, -Z), P(-x, -Y, Z), P(-x, Y, Z), P(-x, Y, -Z), col);
    this.quad(P(-X, y, Z), P(X, y, Z), P(X, y, -Z), P(-X, y, -Z), col);
    this.quad(P(-X, -y, -Z), P(X, -y, -Z), P(X, -y, Z), P(-X, -y, Z), col);
    // 깎인 모서리 12개
    this.quad(P(-X, Y, z), P(X, Y, z), P(X, y, Z), P(-X, y, Z), col);
    this.quad(P(X, Y, -z), P(-X, Y, -z), P(-X, y, -Z), P(X, y, -Z), col);
    this.quad(P(x, Y, Z), P(x, Y, -Z), P(X, y, -Z), P(X, y, Z), col);
    this.quad(P(-x, Y, -Z), P(-x, Y, Z), P(-X, y, Z), P(-X, y, -Z), col);
    this.quad(P(X, -Y, z), P(x, -Y, Z), P(x, Y, Z), P(X, Y, z), col);
    this.quad(P(x, -Y, -Z), P(X, -Y, -z), P(X, Y, -z), P(x, Y, -Z), col);
    this.quad(P(-X, -Y, -z), P(-x, -Y, -Z), P(-x, Y, -Z), P(-X, Y, -z), col);
    this.quad(P(-x, -Y, Z), P(-X, -Y, z), P(-X, Y, z), P(-x, Y, Z), col);
    this.quad(P(-X, -y, Z), P(X, -y, Z), P(X, -Y, z), P(-X, -Y, z), col);
    this.quad(P(X, -y, -Z), P(-X, -y, -Z), P(-X, -Y, -z), P(X, -Y, -z), col);
    this.quad(P(X, -y, Z), P(X, -y, -Z), P(x, -Y, -Z), P(x, -Y, Z), col);
    this.quad(P(-X, -y, -Z), P(-X, -y, Z), P(-x, -Y, Z), P(-x, -Y, -Z), col);
    // 꼭짓점 삼각형은 작아서 낮은 해상도에 보이지 않지만 틈을 막는다
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const a = P(sx * x, sy * Y, sz * Z);
          const c = P(sx * X, sy * y, sz * Z);
          const e = P(sx * X, sy * Y, sz * z);
          if (sx * sy * sz > 0) this.tri(a, c, e, col);
          else this.tri(a, e, c, col);
        }
      }
    }
    return this;
  }

  /**
   * 고리들을 이어 붙인 몸통. rings: [중심x,y,z, 반지름x, 반지름z] 순서로 아래에서 위로.
   * flat이면 각진 면, sides가 작을수록 각이 진다.
   */
  loft(rings: number[][], col: Hex | ((i: number, s: number) => Hex), sides = 6, opt: { flat?: boolean; capTop?: boolean; capBot?: boolean; rot?: number; pow?: number; faceFront?: number } = {}) {
    const { flat = true, capTop = true, capBot = true, rot = 0, pow = 1, faceFront = 0 } = opt;
    const pt = (r: number[], s: number) => {
      const a = (s / sides) * Math.PI * 2 + rot;
      const c = Math.cos(a);
      const n = Math.sin(a);
      // pow>1: 네모에 가까운 단면
      const cx = Math.sign(c) * Math.abs(c) ** (1 / pow);
      const cz = Math.sign(n) * Math.abs(n) ** (1 / pow);
      return v3(r[0] + cx * r[3], r[1], r[2] + cz * r[4]);
    };
    const colorAt = (i: number, s: number) => (typeof col === 'function' ? col(i, s) : col);
    for (let i = 0; i < rings.length - 1; i++) {
      for (let s = 0; s < sides; s++) {
        const a = pt(rings[i], s);
        const b = pt(rings[i], s + 1);
        const c = pt(rings[i + 1], s + 1);
        const d = pt(rings[i + 1], s);
        if (flat) {
          this.quad(a, d, c, b, colorAt(i, s));
        } else {
          const k = rgb(colorAt(i, s));
          const nrm = (r: number[], ss: number) => {
            const an = (ss / sides) * Math.PI * 2 + rot;
            const q = v3(Math.cos(an) / Math.max(r[3], 1e-3), 0.25 / Math.max(r[3], 1e-3) * 0.12, Math.sin(an) / Math.max(r[4], 1e-3)).normalize();
            // 얼굴은 앞쪽을 보게 눕혀 명암이 얼굴을 가르지 않게 한다
            if (faceFront > 0 && q.z > -0.2) q.lerp(v3(0, 0.3, 1).normalize(), faceFront).normalize();
            return q;
          };
          const na = nrm(rings[i], s);
          const nb = nrm(rings[i], s + 1);
          const nc = nrm(rings[i + 1], s + 1);
          const nd = nrm(rings[i + 1], s);
          this.vtx(a, na, k);
          this.vtx(d, nd, k);
          this.vtx(c, nc, k);
          this.vtx(a, na, k);
          this.vtx(c, nc, k);
          this.vtx(b, nb, k);
        }
      }
    }
    const cap = (r: number[], up: boolean, i: number) => {
      const o = v3(r[0], r[1], r[2]);
      for (let s = 0; s < sides; s++) {
        const a = pt(r, s);
        const b = pt(r, s + 1);
        if (up) this.tri(o, b, a, colorAt(i, s));
        else this.tri(o, a, b, colorAt(i, s));
      }
    };
    if (capTop && rings[rings.length - 1][3] > 0) cap(rings[rings.length - 1], true, rings.length - 1);
    if (capBot && rings[0][3] > 0) cap(rings[0], false, 0);
    return this;
  }

  /** 점들을 따라가는 관. 나무 줄기, 가지, 끈 */
  tube(points: THREE.Vector3[], radii: number[] | number, col: Hex | ((i: number, s: number) => Hex), sides = 5, flat = true) {
    const n = points.length;
    const rad = (i: number) => (typeof radii === 'number' ? radii : radii[Math.min(i, radii.length - 1)]);
    const frames: { p: THREE.Vector3; x: THREE.Vector3; z: THREE.Vector3 }[] = [];
    let up = v3(0, 0, 1);
    for (let i = 0; i < n; i++) {
      const t = (i === n - 1 ? A.copy(points[i]).sub(points[i - 1]) : A.copy(points[i + 1]).sub(points[i])).normalize().clone();
      if (Math.abs(t.dot(up)) > 0.95) up = v3(1, 0, 0);
      const x = v3().crossVectors(t, up).normalize();
      const z = v3().crossVectors(x, t).normalize();
      up = z.clone();
      frames.push({ p: points[i], x, z });
    }
    const pt = (i: number, s: number) => {
      const a = (s / sides) * Math.PI * 2;
      const f = frames[i];
      const r = rad(i);
      return f.p.clone().addScaledVector(f.x, Math.cos(a) * r).addScaledVector(f.z, Math.sin(a) * r);
    };
    const colorAt = (i: number, s: number) => (typeof col === 'function' ? col(i, s) : col);
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < sides; s++) {
        const a = pt(i, s);
        const b = pt(i, s + 1);
        const c = pt(i + 1, s + 1);
        const d = pt(i + 1, s);
        if (flat) {
          this.quad(a, d, c, b, colorAt(i, s));
        } else {
          const k = rgb(colorAt(i, s));
          const na = a.clone().sub(frames[i].p).normalize();
          const nb = b.clone().sub(frames[i].p).normalize();
          const nc = c.clone().sub(frames[i + 1].p).normalize();
          const nd = d.clone().sub(frames[i + 1].p).normalize();
          this.vtx(a, na, k);
          this.vtx(b, nb, k);
          this.vtx(c, nc, k);
          this.vtx(a, na, k);
          this.vtx(c, nc, k);
          this.vtx(d, nd, k);
        }
      }
    }
    return this;
  }

  /**
   * 격자 표면. P[i][j]에서 i는 길이 방향, j는 둘레 방향(닫힌 고리).
   * 정점마다 색을 따로 칠하고 법선은 이웃 정점에서 구해 매끈하게 빛을 받는다.
   * 감는 방향은 법선과 맞춰 자동으로 고른다.
   */
  surface(
    P: THREE.Vector3[][],
    col: (i: number, j: number) => Hex,
    opt: { capA?: boolean; capB?: boolean; fur?: { k: number; chance: number; dir: number; seed: number; mask?: (i: number, j: number) => boolean } } = {},
  ) {
    const n = P.length;
    const m = P[0].length;
    const cen = P.map((r) => r.reduce((a, p) => a.add(p), v3()).divideScalar(m));
    const N: THREE.Vector3[][] = [];
    const du = v3();
    const dv = v3();
    for (let i = 0; i < n; i++) {
      const row: THREE.Vector3[] = [];
      for (let j = 0; j < m; j++) {
        du.copy(P[Math.min(n - 1, i + 1)][j]).sub(P[Math.max(0, i - 1)][j]);
        dv.copy(P[i][(j + 1) % m]).sub(P[i][(j - 1 + m) % m]);
        const q = v3().crossVectors(du, dv);
        // 고리가 한 점으로 모이면 중심에서 바깥을 향하게
        const out = P[i][j].clone().sub(cen[i]);
        if (q.lengthSq() < 1e-12) q.copy(out.lengthSq() > 1e-12 ? out : du);
        if (out.lengthSq() > 1e-12 && q.dot(out) < 0) q.negate();
        row.push(q.normalize());
      }
      N.push(row);
    }
    const K = P.map((r, i) => r.map((_, j) => rgb(col(i, j))));
    const put = (i: number, j: number) => this.vtx(P[i][j], N[i][j], K[i][j]);
    const T = v3();
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < m; j++) {
        const j2 = (j + 1) % m;
        // 삼각형 면 법선이 정점 법선과 같은 쪽을 보게 감는다
        du.copy(P[i + 1][j]).sub(P[i][j]);
        dv.copy(P[i][j2]).sub(P[i][j]);
        T.crossVectors(du, dv);
        const avg = v3().add(N[i][j]).add(N[i + 1][j]).add(N[i][j2]);
        if (T.dot(avg) >= 0) {
          put(i, j); put(i + 1, j); put(i + 1, j2);
          put(i, j); put(i + 1, j2); put(i, j2);
        } else {
          put(i, j); put(i, j2); put(i + 1, j2);
          put(i, j); put(i + 1, j2); put(i + 1, j);
        }
      }
    }
    // 마개는 이웃 고리 반대쪽(바깥)을 본다
    const cap = (i: number, nb: number) => {
      const o = cen[i];
      const nn = o.clone().sub(cen[nb]);
      if (nn.lengthSq() < 1e-12) return;
      nn.normalize();
      for (let j = 0; j < m; j++) {
        const a = P[i][j];
        const b = P[i][(j + 1) % m];
        T.crossVectors(du.copy(a).sub(o), dv.copy(b).sub(o));
        const c = K[i][j];
        if (T.dot(nn) >= 0) { this.vtx(o, nn, c); this.vtx(a, nn, c); this.vtx(b, nn, c); }
        else { this.vtx(o, nn, c); this.vtx(b, nn, c); this.vtx(a, nn, c); }
      }
    };
    if (opt.capA && n > 1) cap(0, 1);
    if (opt.capB && n > 1) cap(n - 1, n - 2);
    // 털끝: 표면에서 비스듬히 뒤로 누운 작은 삼각형. 몸과 같은 법선으로 빛을 받아 외곽선만 털처럼 부서진다
    const fur = opt.fur;
    if (fur) {
      const r = rng(fur.seed);
      const back = v3();
      const side = v3();
      for (let i = 1; i < n - 1; i++) {
        for (let j = 0; j < m; j++) {
          if (r() > fur.chance || (fur.mask && !fur.mask(i, j))) continue;
          const p = P[i][j];
          const nn = N[i][j];
          const rad = p.distanceTo(cen[i]);
          const len = rad * fur.k * (0.7 + r() * 0.6);
          if (len < 1e-4) continue;
          back.copy(P[i + fur.dir][j]).sub(P[i - fur.dir][j]);
          back.addScaledVector(nn, -back.dot(nn));
          if (back.lengthSq() < 1e-12) continue;
          back.normalize();
          side.crossVectors(nn, back).normalize().multiplyScalar(len * (0.28 + r() * 0.14));
          // 둘레 방향으로 조금씩 엇갈려 줄지어 보이지 않게
          const o = p.clone().addScaledVector(nn, -len * 0.2).addScaledVector(side, (r() - 0.5) * 1.6);
          const tip = o.clone().addScaledVector(nn, len * (0.45 + r() * 0.3)).addScaledVector(back, len);
          const [cr, cg, cb] = K[i][j];
          const root: [number, number, number] = [cr * 0.86, cg * 0.86, cb * 0.86];
          const t = 1.04 + r() * 0.1;
          const end: [number, number, number] = [Math.min(1, cr * t), Math.min(1, cg * t), Math.min(1, cb * t)];
          this.vtx(o.clone().sub(side), nn, root);
          this.vtx(o.clone().add(side), nn, root);
          this.vtx(tip, nn, end);
        }
      }
    }
    return this;
  }

  /** 돌덩이: 찌그러진 팔면체 다듬기. 면이 각져서 찰흙처럼 보이지 않는다 */
  rock(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, col: Hex, seed = 1, jitter = 0.22, detail = 1) {
    const r = rng(seed);
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.getAttribute('position');
    const map = new Map<string, THREE.Vector3>();
    const off = (x: number, y: number, z: number) => {
      const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      let q = map.get(k);
      if (!q) {
        const d = 1 + (r() - 0.5) * jitter * 2;
        q = v3(cx + x * rx * d, cy + y * ry * d, cz + z * rz * d);
        map.set(k, q);
      }
      return q;
    };
    for (let i = 0; i < p.count; i += 3) {
      const a = off(p.getX(i), p.getY(i), p.getZ(i));
      const b = off(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1));
      const c = off(p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      const shade = 1 + (r() - 0.5) * 0.16;
      this.tri(a, b, c, tone(col, shade));
    }
    g.dispose();
    return this;
  }

  /**
   * 잎 덩어리: 타원체 표면에 작은 카드를 흩뿌린다.
   * 법선은 덩어리 중심에서 뻗어 나가게 해 덩어리 전체가 하나의 부피로 빛을 받는다.
   */
  leaves(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, cols: Hex[], seed: number, size = 0.3, long = 1, fill = 0.8) {
    const r = rng(seed);
    const c = v3(cx, cy, cz);
    const ax = v3();
    const ay = v3();
    const count = Math.max(4, Math.round(n * leafDensity));
    size /= Math.sqrt(leafDensity) * 1.05;
    for (let i = 0; i < count; i++) {
      // 위쪽 겉면에 더 많이
      const th = r() * Math.PI * 2;
      const uy = -0.45 + r() * 1.45;
      const sy = Math.max(-1, Math.min(1, uy));
      const sx = Math.sqrt(Math.max(0, 1 - sy * sy));
      const shell = fill + r() * (1 - fill) * 1.2;
      const p = v3(cx + Math.cos(th) * sx * rx * shell, cy + sy * ry * shell, cz + Math.sin(th) * sx * rz * shell);
      const nn = p.clone().sub(c);
      nn.set(nn.x / (rx * rx), nn.y / (ry * ry), nn.z / (rz * rz)).normalize();
      // 카드 방향은 멋대로
      const a = r() * Math.PI * 2;
      ax.set(Math.cos(a), (r() - 0.5) * 0.7, Math.sin(a)).normalize();
      ay.crossVectors(nn, ax).normalize();
      if (ay.y < 0) ay.negate();
      ay.y = Math.max(ay.y, 0.35);
      ay.normalize();
      const s = size * (0.75 + r() * 0.5);
      const w = s * 0.55;
      const h = s * long;
      const pick = cols[Math.floor(r() * cols.length)];
      // 낮은 쪽 카드는 어둡게: 덩어리 안쪽 그늘
      const k = rgb(tone(pick, 0.82 + 0.3 * Math.max(0, (sy + 0.45) / 1.45)));
      const P0 = p.clone().addScaledVector(ax, -w).addScaledVector(ay, -h);
      const P1 = p.clone().addScaledVector(ax, w).addScaledVector(ay, -h);
      const P2 = p.clone().addScaledVector(ax, w).addScaledVector(ay, h);
      const P3 = p.clone().addScaledVector(ax, -w).addScaledVector(ay, h);
      this.vtx(P0, nn, k, -1, -1);
      this.vtx(P1, nn, k, 1, -1);
      this.vtx(P2, nn, k, 1, 1);
      this.vtx(P0, nn, k, -1, -1);
      this.vtx(P2, nn, k, 1, 1);
      this.vtx(P3, nn, k, -1, 1);
    }
    return this;
  }

  get count() {
    return this.pos.length / 3;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.aux, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('bone', new THREE.Float32BufferAttribute(this.bones, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export { v3 };
