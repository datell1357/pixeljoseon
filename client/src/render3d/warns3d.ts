// 공격 범위 표시: 땅 위에 깔리는 장판. 땅 높낮이를 따른다.
// 그리는 순서: 땅·길·소품 → 장판(깊이 검사 없이 덮음) → 인물. 그래서 길이나 돌턱에 가리지 않고, 인물은 장판 위에 선다.
// 모양(원·도넛·부채꼴·직선)은 조각 셰이더가 계산해 가장자리가 매끄럽다.
import * as THREE from 'three';
import type { TerrainData } from './terrain';

const SHAPES: Record<string, number> = { circle: 0, ring: 1, cone: 2, line: 3 };
/** 땅을 따라 굽히는 격자 칸 수 */
const GRID = 20;

const VERT = /* glsl */ `
out vec2 vQ;
void main(){
  vQ = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vQ;
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oN;
uniform int uShape;
uniform vec2 uDir;
uniform float uR, uInner, uHalf, uW, uP, uFade, uSoft, uPulse;
uniform vec3 uCol;
void main(){
  vec2 q = vQ;
  float d = length(q);
  float e;     // 가장자리까지 거리(안쪽 +)
  float k;     // 차오름 기준 0~1
  if(uShape==0){ e = uR-d; k = d/uR; }
  else if(uShape==1){ e = min(uR-d, d-uInner); k = 1.-(d-uInner)/max(uR-uInner,1e-3); }
  else if(uShape==2){
    float a = acos(clamp(dot(q/max(d,1e-4), uDir),-1.,1.));
    e = min(uR-d, (uHalf-a)*d);
    if(d<.02) e = min(uR-d, .02);
    k = d/uR;
  } else {
    float al = dot(q,uDir);
    float sd = abs(q.x*uDir.y-q.y*uDir.x);
    e = min(min(al, uR-al), uW*.5-sd);
    k = al/uR;
  }
  float aa = fwidth(e)*1.2;
  float inside = smoothstep(-aa, aa, e);
  if(inside<=0.) discard;
  // 테두리: 또렷한 띠와 안쪽으로 번지는 빛
  float rim = 1.-smoothstep(.07, .07+aa*2., e);
  float glow = (1.-smoothstep(0., .45, e))*.28;
  // 차오르는 면: 터질 때가 가까울수록 앞쪽 끝까지 진해진다
  float filled = smoothstep(uP+.02, uP-.02, k);
  float fill = uSoft>.5 ? 0. : (.14 + .26*filled);
  // 차오르는 앞선
  float front = uSoft>.5 ? 0. : (1.-smoothstep(0., .04, abs(k-uP)))*step(.03,uP)*.6;
  float a = max(max(fill, glow*(uSoft>.5 ? .6 : 1.)), max(rim*(uSoft>.5 ? .55 : .9 + .1*uPulse), front));
  vec3 c = mix(uCol, vec3(1.,.95,.85), rim*uP*uP*.55 + front*.35);
  oC = vec4(c, a*inside*uFade);
  oN = vec4(0.);
}`;

export interface WarnShape {
  shape: string;
  u: number;
  v: number;
  du?: number;
  dv?: number;
  r: number;
  inner?: number;
  arc?: number;
  width?: number;
  friendly?: boolean;
  soft?: boolean;
}

interface Mark {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}

export class WarnLayer {
  private marks = new Map<object, Mark>();
  private pool: Mark[] = [];

  constructor(
    private scene: THREE.Scene,
    private terrain: () => TerrainData | null,
  ) {}

  private make(): Mark {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      // 불투명 목록에 넣어 그리는 순서(renderOrder)를 인물보다 앞에 고정한다
      transparent: false,
      depthWrite: false,
      depthTest: false,
      // 색만 섞는다. 알파(빛 번짐 값)와 법선 칸은 그대로 둔다
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: {
        uShape: { value: 0 },
        uDir: { value: new THREE.Vector2(1, 0) },
        uR: { value: 1 },
        uInner: { value: 0 },
        uHalf: { value: 1 },
        uW: { value: 1 },
        uP: { value: 0 },
        uFade: { value: 1 },
        uSoft: { value: 0 },
        uPulse: { value: 0 },
        uCol: { value: new THREE.Color() },
      },
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.userData.noShadow = true;
    return { mesh, mat };
  }

  /** 모양을 덮는 사각 격자를 땅 높이에 맞춰 짓는다. uv에 중심 기준 좌표(게임 단위)를 담는다 */
  private shape(mk: Mark, w: WarnShape) {
    const r = w.r;
    let u0 = -r, u1 = r, v0 = -r, v1 = r;
    if (w.shape === 'line') {
      const du = w.du ?? 1, dv = w.dv ?? 0, h = (w.width ?? 1) / 2;
      const xs = [0, du * r].flatMap((x) => [x - dv * h, x + dv * h]);
      const zs = [0, dv * r].flatMap((z) => [z + du * h, z - du * h]);
      u0 = Math.min(...xs); u1 = Math.max(...xs); v0 = Math.min(...zs); v1 = Math.max(...zs);
    }
    const pad = 0.1;
    u0 -= pad; u1 += pad; v0 -= pad; v1 += pad;
    const t = this.terrain();
    const n = GRID + 1;
    const pos = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const lu = u0 + ((u1 - u0) * i) / GRID;
        const lv = v0 + ((v1 - v0) * j) / GRID;
        const k = j * n + i;
        pos[k * 3] = w.u + lu;
        pos[k * 3 + 1] = (t?.groundAt(w.u + lu, w.v + lv) ?? 0) + 0.03;
        pos[k * 3 + 2] = w.v + lv;
        uv[k * 2] = lu;
        uv[k * 2 + 1] = lv;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = j * n + i;
        idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    const g = mk.mesh.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const U = mk.mat.uniforms;
    U.uShape.value = SHAPES[w.shape] ?? 0;
    const l = Math.hypot(w.du ?? 1, w.dv ?? 0) || 1;
    U.uDir.value.set((w.du ?? 1) / l, (w.dv ?? 0) / l);
    U.uR.value = r;
    U.uInner.value = w.inner ?? 0;
    U.uHalf.value = (((w.arc ?? 90) / 2) * Math.PI) / 180;
    U.uW.value = w.width ?? 1;
    U.uSoft.value = w.soft ? 1 : 0;
    U.uCol.value.set(w.friendly ? 0xffcf6a : 0xff4a36);
  }

  /** 표시 하나를 그린다. key는 같은 표시를 알아보는 물체(경고 기록 자체) */
  set(key: object, w: WarnShape, p: number, fade: number, pulse: number) {
    let mk = this.marks.get(key);
    if (!mk) {
      mk = this.pool.pop() ?? this.make();
      this.shape(mk, w);
      this.scene.add(mk.mesh);
      this.marks.set(key, mk);
    }
    const U = mk.mat.uniforms;
    U.uP.value = p;
    U.uFade.value = fade;
    U.uPulse.value = pulse;
  }

  /** 이번 프레임에 그리지 않은 표시는 치운다 */
  sweep(alive: Set<object>) {
    for (const [k, mk] of this.marks) {
      if (alive.has(k)) continue;
      this.scene.remove(mk.mesh);
      this.marks.delete(k);
      if (this.pool.length < 16) this.pool.push(mk);
      else {
        mk.mesh.geometry.dispose();
        mk.mat.dispose();
      }
    }
  }

  clear() {
    this.sweep(new Set());
  }
}
