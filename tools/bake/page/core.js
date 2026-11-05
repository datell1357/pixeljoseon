// 굽기 핵심: 카메라, 셀 셰이딩 재질, 슈퍼샘플 → 도트 변환(최근접, 알파 이진화, 1px 외곽선).
import * as THREE from 'three';

/** 수평 1유닛당 픽셀 (x=(u-v)*32, y=(u+v)*16 이 정확히 나오는 값) */
export const PX = 32 * Math.SQRT2;
export const SS = 4;
const EL = (30 * Math.PI) / 180;
const SQ = Math.SQRT1_2;
export const CAM_DIR = new THREE.Vector3(Math.cos(EL) * SQ, Math.sin(EL), Math.cos(EL) * SQ);

// 빛: 화면 왼쪽 위 + 약간 앞쪽. 세계 좌표에 고정이라 몸이 돌아도 빛은 그대로다.
const left = new THREE.Vector3(-SQ, 0, SQ);
const toCam = new THREE.Vector3(SQ, 0, SQ);
export const LIGHT = new THREE.Vector3().addScaledVector(left, 0.72).add(new THREE.Vector3(0, 0.92, 0)).addScaledVector(toCam, 0.38).normalize();

// ---------- 색 ----------
function toHsl(hexStr) {
  const v = parseInt(hexStr.slice(1), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function fromHsl(h, s, l) {
  h = ((h % 1) + 1) % 1;
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const toward = (h, target, amt) => {
  let d = target - h;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return h + d * amt;
};
export function makeRamp(hexStr, kind = 'matte', hiK = 0.34) {
  const [h, s, l] = toHsl(hexStr);
  const k = kind === 'metal' ? 1 : 0;
  const hi = fromHsl(toward(h, 0.13, 0.12), s * 0.95, l + (1 - l) * (k ? 0.62 : hiK));
  const base = fromHsl(h, s, l);
  const mid = fromHsl(toward(h, 0.68, 0.1), s * 1.02 + 0.02, l * (k ? 0.74 : 0.8));
  const sh = fromHsl(toward(h, 0.7, 0.2), s * 1.05 + 0.05, l * (k ? 0.5 : 0.58));
  return [sh, mid, base, hi];
}

// ---------- 재질 ----------
const VERT = /* glsl */ `
out vec3 vN; out vec3 vO; out vec3 vW;
void main(){
  vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  vO = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */ `
precision highp float;
in vec3 vN; in vec3 vO; in vec3 vW;
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oI;
uniform vec3 uRamp[4]; uniform vec3 uRamp2[4];
uniform vec3 uThr; uniform vec3 uL; uniform vec3 uV;
uniform float uEmis, uBias, uAlpha, uId, uAO;
uniform vec2 uNoise; uniform vec4 uPat;
float hash(vec3 p){ p = fract(p*0.3183099+vec3(.71,.113,.419)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec3 band(vec3 r[4], float h){ return h<uThr.x ? r[0] : h<uThr.y ? r[1] : h<uThr.z ? r[2] : r[3]; }
void main(){
  vec3 col;
  if(uEmis>1.5){
    // 빛나는 재질: 카메라를 향한 면일수록 뜨겁다 (어느 방향에서 봐도 안쪽이 밝다)
    float f = dot(normalize(gl_FrontFacing ? vN : -vN), uV);
    col = f>uThr.z ? uRamp[3] : f>uThr.y ? uRamp[2] : f>uThr.x ? uRamp[1] : uRamp[0];
  }
  else if(uEmis>0.5){ col = uRamp[2]; }
  else {
    vec3 N = normalize(gl_FrontFacing ? vN : -vN);
    float h = dot(N,uL)*0.5+0.5 + uBias;
    if(uNoise.y>0.0) h += (vnoise(vO*uNoise.x)-0.5)*uNoise.y;
    if(uAO>0.0) h -= (1.0-smoothstep(0.0,0.42,vW.y))*uAO;
    bool second=false;
    if(uPat.x>0.0){
      float m = vnoise(vO*uPat.x)*0.6 + vnoise(vO*uPat.x*2.3+3.1)*0.4;
      if(uPat.w>uPat.z) m += (smoothstep(uPat.z,uPat.w,vW.y)-0.5)*0.9;
      second = m>uPat.y;
    }
    col = second ? band(uRamp2,h) : band(uRamp,h);
  }
  oC = vec4(col/255.0, uAlpha);
  float z = gl_FragCoord.z;
  float zh = floor(z*255.0)/255.0;
  oI = vec4(uId/255.0, zh, fract(z*255.0), 1.0);
}`;

const vec3s = (r) => r.map((c) => new THREE.Vector3(c[0], c[1], c[2]));

/**
 * 셀 재질. opts: e(발광), bias, noise:[주파수,세기], pat:{c,f,thr,y0,y1}(두 번째 색 얼룩),
 * ramp:[그림자,중간,기본,밝은], metal, alpha(0~1), ao, thr:[t0,t1,t2], side
 */
export function M(hexStr, opts = {}) {
  const ramp = vec3s(opts.ramp ?? makeRamp(hexStr, opts.metal ? 'metal' : 'matte', opts.hi ?? 0.34));
  const ramp2 = vec3s(opts.pat ? makeRamp(opts.pat.c) : makeRamp(hexStr));
  const thr = opts.thr ?? (opts.metal ? [0.36, 0.56, 0.84] : [0.3, 0.46, 0.84]);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    glslVersion: THREE.GLSL3,
    blending: THREE.NoBlending,
    side: opts.side ?? THREE.FrontSide,
    uniforms: {
      uRamp: { value: ramp },
      uRamp2: { value: ramp2 },
      uThr: { value: new THREE.Vector3(...thr) },
      uL: { value: LIGHT },
      uV: { value: CAM_DIR },
      uEmis: { value: opts.glow ? 2 : opts.e ? 1 : 0 },
      uBias: { value: opts.bias ?? 0 },
      uAlpha: { value: opts.alpha ?? 1 },
      uId: { value: 1 },
      uAO: { value: opts.ao ?? 0.1 },
      uNoise: { value: new THREE.Vector2(opts.noise?.[0] ?? 0, opts.noise?.[1] ?? 0) },
      uPat: { value: new THREE.Vector4(opts.pat?.f ?? 0, opts.pat?.thr ?? 0.5, opts.pat?.y0 ?? 0, opts.pat?.y1 ?? 0) },
    },
  });
  return mat;
}

const rgb = (h) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
/** 빛나는 재질: 가장자리 → 중심 네 단계 색 */
export function G(rim, mid, hot, core, thr = [0.28, 0.58, 0.84], alpha = 1) {
  return M(rim, { glow: 1, ramp: [rim, mid, hot, core].map(rgb), thr, alpha });
}
export const GLOW = {
  lamp: () => G('#e8922e', '#ffc44c', '#ffe68a', '#fffbe2'),
  fire: () => G('#d9531e', '#ff8a2a', '#ffc24a', '#fff2c0'),
  ember: () => G('#c8421c', '#ff7a2a', '#ffb84a', '#ffe9a0'),
  green: () => G('#1fae58', '#3fdc78', '#8df39e', '#eaffd2', [0.2, 0.52, 0.8]),
  blue: () => G('#1c58c8', '#3a92ee', '#96d8ff', '#ecfdff', [0.22, 0.52, 0.8]),
  amber: () => G('#b8641a', '#ee9a22', '#ffcf4a', '#fff6c0', [0.25, 0.55, 0.82]),
};

/** 부위별 외곽선 그룹 번호를 매긴다. userData.eg가 같은 메시끼리는 안쪽 외곽선이 생기지 않는다. */
export function assignEdgeGroups(root) {
  const ids = new Map();
  let next = 1;
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let p = o;
    let key = null;
    while (p) {
      if (p.userData.eg !== undefined) {
        key = p.userData.eg;
        break;
      }
      p = p.parent;
    }
    if (key === null) key = o.uuid;
    if (!ids.has(key)) ids.set(key, next++);
    const id = ids.get(key);
    const ck = o.material.uuid + ':' + id;
    if (!cache.has(ck)) {
      const m = o.material.clone();
      m.uniforms.uRamp.value = o.material.uniforms.uRamp.value;
      m.uniforms.uRamp2.value = o.material.uniforms.uRamp2.value;
      m.uniforms.uL.value = LIGHT;
      m.uniforms.uV.value = CAM_DIR;
      m.uniforms.uId.value = id;
      cache.set(ck, m);
    }
    o.material = cache.get(ck);
  });
  if (next > 250) console.warn('외곽선 그룹이 너무 많습니다', next);
}

// ---------- 렌더 ----------
let renderer = null;
export function getRenderer() {
  if (renderer) return renderer;
  const canvas = new OffscreenCanvas(16, 16);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  return renderer;
}

const rtCache = new Map();
function getRT(w, h) {
  const k = w + 'x' + h;
  if (!rtCache.has(k)) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      count: 2,
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      samples: 0,
    });
    rtCache.set(k, { rt, col: new Uint8Array(w * h * 4), idb: new Uint8Array(w * h * 4) });
  }
  return rtCache.get(k);
}

/** W×H 칸에 (ax,ay)를 원점으로 찍는 직교 카메라 */
export function makeCamera(W, H, ax, ay) {
  const cam = new THREE.OrthographicCamera(-ax / PX, (W - ax) / PX, ay / PX, -(H - ay) / PX, 1, 81);
  cam.position.copy(CAM_DIR).multiplyScalar(40);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

const OUTLINE = [24, 18, 32];

/**
 * 한 장 찍어 도트로 변환한다.
 * opts.coverage: 칸이 불투명이 되는 최소 표본 수(16개 중)
 * opts.outline: false면 바깥 외곽선 없음
 */
export function shot(scene, cam, W, H, opts = {}) {
  const r = getRenderer();
  const sw = W * SS;
  const sh = H * SS;
  const { rt, col, idb } = getRT(sw, sh);
  r.setRenderTarget(rt);
  r.clear();
  r.render(scene, cam);
  r.readRenderTargetPixels(rt, 0, 0, sw, sh, col, undefined, 0);
  r.readRenderTargetPixels(rt, 0, 0, sw, sh, idb, undefined, 1);
  r.setRenderTarget(null);
  return resolve(col, idb, W, H, opts);
}

const keysBuf = new Int32Array(16);
const cntBuf = new Int32Array(16);
function resolve(col, idb, W, H, opts) {
  const need = opts.coverage ?? 6;
  const out = new Uint8ClampedArray(W * H * 4);
  const id = new Uint8Array(W * H);
  const dep = new Float32Array(W * H);
  const sw = W * SS;
  const sh = H * SS;
  for (let y = 0; y < H; y++) {
    const sy0 = sh - (y + 1) * SS; // 읽은 버퍼는 아래에서 위로
    for (let x = 0; x < W; x++) {
      const sx0 = x * SS;
      let covered = 0;
      let nKeys = 0;
      for (let j = 0; j < SS; j++) {
        let p = (sy0 + j) * sw + sx0;
        for (let i = 0; i < SS; i++, p++) {
          if (col[p * 4 + 3] === 0) continue;
          covered++;
          const k = idb[p * 4];
          let m = -1;
          for (let q = 0; q < nKeys; q++)
            if (keysBuf[q] === k) {
              m = q;
              break;
            }
          if (m < 0) {
            keysBuf[nKeys] = k;
            cntBuf[nKeys] = 1;
            nKeys++;
          } else cntBuf[m]++;
        }
      }
      if (covered < need) continue;
      // 가장 많은 부위를 고르고, 그 부위 안에서 가장 많은 색을 고른다. (섞인 색이 생기지 않는다)
      let bestK = keysBuf[0];
      let bestC = cntBuf[0];
      for (let q = 1; q < nKeys; q++)
        if (cntBuf[q] > bestC) {
          bestC = cntBuf[q];
          bestK = keysBuf[q];
        }
      let nC = 0;
      let dSum = 0;
      let dN = 0;
      for (let j = 0; j < SS; j++) {
        let p = (sy0 + j) * sw + sx0;
        for (let i = 0; i < SS; i++, p++) {
          if (col[p * 4 + 3] === 0 || idb[p * 4] !== bestK) continue;
          const c = col[p * 4] | (col[p * 4 + 1] << 8) | (col[p * 4 + 2] << 16) | (col[p * 4 + 3] << 24);
          dSum += idb[p * 4 + 1] / 255 + idb[p * 4 + 2] / 255 / 255;
          dN++;
          let m = -1;
          for (let q = 0; q < nC; q++)
            if (keysBuf[q] === c) {
              m = q;
              break;
            }
          if (m < 0) {
            keysBuf[nC] = c;
            cntBuf[nC] = 1;
            nC++;
          } else cntBuf[m]++;
        }
      }
      let c = keysBuf[0];
      let cc = cntBuf[0];
      for (let q = 1; q < nC; q++)
        if (cntBuf[q] > cc) {
          cc = cntBuf[q];
          c = keysBuf[q];
        }
      const o = (y * W + x) * 4;
      out[o] = c & 255;
      out[o + 1] = (c >> 8) & 255;
      out[o + 2] = (c >> 16) & 255;
      out[o + 3] = (c >>> 24) & 255;
      id[y * W + x] = bestK;
      dep[y * W + x] = dSum / dN;
    }
  }
  // 안쪽 외곽선: 앞 부위와 맞닿은 뒤 부위 쪽 픽셀을 어둡게
  const eps = opts.innerEps ?? 0.0008;
  const inner = opts.inner === false ? null : new Uint8Array(W * H);
  if (inner) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (id[i] === 0) continue;
        const test = (j) => id[j] !== 0 && id[j] !== id[i] && dep[i] - dep[j] > eps;
        if ((x > 0 && test(i - 1)) || (x < W - 1 && test(i + 1)) || (y > 0 && test(i - W)) || (y < H - 1 && test(i + W))) inner[i] = 1;
      }
    for (let i = 0; i < W * H; i++)
      if (inner[i]) {
        const o = i * 4;
        out[o] = out[o] * 0.42 + OUTLINE[0] * 0.2;
        out[o + 1] = out[o + 1] * 0.38 + OUTLINE[1] * 0.2;
        out[o + 2] = out[o + 2] * 0.42 + OUTLINE[2] * 0.25;
      }
  }
  // 바깥 외곽선: 불투명과 맞닿은 투명 칸을 어두운 색으로
  if (opts.outline !== false) {
    const add = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (id[i] !== 0) continue;
        let n = -1;
        if (x > 0 && id[i - 1]) n = i - 1;
        else if (x < W - 1 && id[i + 1]) n = i + 1;
        else if (y > 0 && id[i - W]) n = i - W;
        else if (y < H - 1 && id[i + W]) n = i + W;
        if (n >= 0) add.push(i, n);
      }
    for (let a = 0; a < add.length; a += 2) {
      const o = add[a] * 4;
      const s = add[a + 1] * 4;
      out[o] = OUTLINE[0] + out[s] * 0.08;
      out[o + 1] = OUTLINE[1] + out[s + 1] * 0.08;
      out[o + 2] = OUTLINE[2] + out[s + 2] * 0.08;
      out[o + 3] = Math.min(255, out[s + 3] < 255 ? out[s + 3] + 30 : 255);
    }
  }
  return out;
}

/** 큰 RGBA 버퍼를 base64로 (CDP로 넘길 때) */
export function toBase64(u8) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
