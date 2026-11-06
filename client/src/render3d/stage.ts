// 실시간 3D 무대: 낮은 해상도로 그리고 최근접으로 키워 도트처럼 보이게 한다.
import * as THREE from 'three';
import { PX_H, PX_U, PX_V } from '@shared/core';
import type { MapData } from '@shared/mapdata';
import type { ActorView } from './actor3d';
import { atmosphereOf, type Atmos } from './atmos';
import { setLeafDensity } from './geo';
import { clearPropCache, propGeometry, propOnWater, propVariants, PROP_LIGHTS, propSpin } from './props';
import {
  BLUR_FRAG,
  BRIGHT_FRAG,
  FS_VERT,
  GRASS_FRAG,
  GRASS_VERT,
  MAX_LAMPS,
  POST_FRAG,
  TERRAIN_FRAG,
  TERRAIN_VERT,
  UBER_FRAG,
  UBER_VERT,
  WATER_FRAG,
} from './shaders';
import { TerrainData } from './terrain';

const CHUNK = 12;
const SHADOW_SIZE = 3072;
const SHADOW_SPAN = 50;
export const PORTRAIT = 128;
const COS_E = PX_H / PX_U;
const SIN_E = PX_V / PX_U;
export const CAM_DIR = new THREE.Vector3(0, SIN_E, COS_E).normalize();

/** 모든 재질이 같이 쓰는 값 */
export const shared = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.5, 0.7, 0.5).normalize() },
  uSunCol: { value: new THREE.Color(1, 0.9, 0.7) },
  uSky: { value: new THREE.Color(0.4, 0.5, 0.7) },
  uGnd: { value: new THREE.Color(0.25, 0.22, 0.28) },
  uShadowMat: { value: new THREE.Matrix4() },
  uShadowMap: { value: null as THREE.Texture | null },
  uLampPos: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4()) },
  uLampCol: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
  uLampN: { value: 0 },
  uCamPx: { value: new THREE.Vector2() },
  uPass: { value: 0 },
  uCloud: { value: 1 },
  uViewDir: { value: CAM_DIR.clone() },
  uFocus: { value: new THREE.Vector3() },
  uFocusOn: { value: 0 },
};

export function uberMaterial(opts: { cut?: boolean; side?: THREE.Side; bones?: THREE.Texture; skinned?: boolean; map?: THREE.Texture | null } = {}) {
  const defines: Record<string, number> = {};
  if (opts.bones) defines.USE_BONES = 1;
  if (opts.skinned) defines.USE_SKIN = 1;
  if (opts.map) defines.USE_MAP = 1;
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines,
    vertexShader: UBER_VERT,
    fragmentShader: UBER_FRAG,
    uniforms: { ...shared, uAlpha: { value: 1 }, uFlash: { value: new THREE.Vector4(0, 0, 0, 0) }, uCut: { value: opts.cut ? 1 : 0 }, uBoneTex: { value: opts.bones ?? null }, uFur: { value: 0 }, uMap: { value: opts.map ?? null }, uEmKey: { value: 0 } },
    blending: THREE.NoBlending,
    side: opts.side ?? THREE.DoubleSide,
  });
}

interface ChunkInst {
  mesh: THREE.InstancedMesh;
  cx: number;
  cz: number;
}

interface Lamp {
  x: number;
  y: number;
  z: number;
  r: number;
  col: THREE.Color;
  ph: number;
  k: number;
}

export class Stage3D {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  scene = new THREE.Scene();
  actors = new THREE.Group();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 500);
  sunCam = new THREE.OrthographicCamera(-SHADOW_SPAN / 2, SHADOW_SPAN / 2, SHADOW_SPAN / 2, -SHADOW_SPAN / 2, 1, 160);
  w = 640;
  h = 360;
  k = 2;
  cx = 0;
  cy = 0;
  main!: THREE.WebGLRenderTarget;
  shadow: THREE.WebGLRenderTarget;
  bright!: THREE.WebGLRenderTarget;
  b1a!: THREE.WebGLRenderTarget;
  b1b!: THREE.WebGLRenderTarget;
  b2a!: THREE.WebGLRenderTarget;
  b2b!: THREE.WebGLRenderTarget;
  fsScene = new THREE.Scene();
  fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fsQuad: THREE.Mesh;
  postMat: THREE.ShaderMaterial;
  brightMat: THREE.ShaderMaterial;
  blurMat: THREE.ShaderMaterial;
  statics = uberMaterial({ cut: true });
  terrainMat: THREE.ShaderMaterial | null = null;
  grassMat: THREE.ShaderMaterial | null = null;
  terrain: TerrainData | null = null;
  chunks: ChunkInst[] = [];
  grassChunks: { mesh: THREE.Mesh; cx: number; cz: number }[] = [];
  terrainMesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  lamps: Lamp[] = [];
  ghosts: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; tex: THREE.DataTexture; t: number }[] = [];
  atmos: Atmos | null = null;
  map: MapData | null = null;
  grassGeo: THREE.BufferGeometry;
  time = 0;
  stats = { calls: 0, tris: 0 };
  blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  /** 1: 전부 / 0: 그림자·풀 끄고 잎 줄임 */
  quality = 1;
  /** 프레임이 오래 느리면 부른다 */
  onSlow: (() => void) | null = null;
  private lastNow = 0;
  private shadowTick = 0;
  private shadowLive: boolean | null = null;
  private slowEma = 16;
  private slowN = 0;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'stage3d';
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', imageRendering: 'pixelated', zIndex: '0' });
    parent.prepend(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.scene.matrixWorldAutoUpdate = true;
    this.scene.add(this.actors);

    this.blank.needsUpdate = true;
    this.black.needsUpdate = true;
    const sd = new THREE.DepthTexture(SHADOW_SIZE, SHADOW_SIZE, THREE.UnsignedIntType);
    this.shadow = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, { depthTexture: sd, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    shared.uShadowMap.value = sd;

    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.postMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FS_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tC: { value: null },
        tN: { value: null },
        tD: { value: null },
        tB1: { value: null },
        tB2: { value: null },
        uRes: { value: new THREE.Vector2() },
        uCamPx: shared.uCamPx,
        uTime: shared.uTime,
        uDepthRange: { value: 499 },
        uSunDir: shared.uSunDir,
        uInvVP: { value: new THREE.Matrix4() },
        uMapSize: { value: new THREE.Vector2(60, 60) },
        uFogCol: { value: new THREE.Color() },
        uFog: { value: 1 },
        uShadowTint: { value: new THREE.Color(1, 1, 1) },
        uHighTint: { value: new THREE.Color(1, 1, 1) },
        uSat: { value: 1 },
        uHalo: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4()) },
        uHaloCol: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
        uHaloN: { value: 0 },
        uHaloK: { value: 1 },
        uKey: { value: 0 },
      },
    });
    this.brightMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FS_VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false, uniforms: { tC: { value: null } } });
    this.blurMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false, uniforms: { tC: { value: null }, uDir: { value: new THREE.Vector2() } } });
    this.fsQuad = new THREE.Mesh(tri, this.postMat);
    this.fsQuad.frustumCulled = false;
    this.fsScene.add(this.fsQuad);

    // 풀잎 다발: 잎 세 장
    const pos: number[] = [];
    const blade = (x: number, z: number, h: number, w: number, lean: number) => {
      pos.push(x - w, 0, z, x + w, 0, z, x + lean * 0.5 - w * 0.5, h * 0.55, z);
      pos.push(x + w, 0, z, x + lean * 0.5 + w * 0.5, h * 0.55, z, x + lean * 0.5 - w * 0.5, h * 0.55, z);
      pos.push(x + lean * 0.5 - w * 0.5, h * 0.55, z, x + lean * 0.5 + w * 0.5, h * 0.55, z, x + lean, h, z);
    };
    blade(-0.05, 0.02, 0.26, 0.022, -0.05);
    blade(0.03, -0.02, 0.32, 0.024, 0.05);
    blade(0.08, 0.03, 0.2, 0.02, 0.07);
    this.grassGeo = new THREE.BufferGeometry();
    this.grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.setSize(640, 360, 2);
  }

  setSize(w: number, h: number, k: number) {
    w = Math.max(2, w);
    h = Math.max(2, h);
    this.w = w;
    this.h = h;
    this.k = k;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w * k}px`;
    this.canvas.style.height = `${h * k}px`;
    this.main?.dispose();
    this.main?.depthTexture?.dispose();
    const dt = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.main = new THREE.WebGLRenderTarget(w, h, { count: 2, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: dt });
    const mk = (d: number) => new THREE.WebGLRenderTarget(Math.max(2, Math.floor(w / d)), Math.max(2, Math.floor(h / d)), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    for (const r of [this.bright, this.b1a, this.b1b, this.b2a, this.b2b]) r?.dispose();
    this.bright = mk(2);
    this.b1a = mk(2);
    this.b1b = mk(2);
    this.b2a = mk(5);
    this.b2b = mk(5);
    const u = this.postMat.uniforms;
    u.uRes.value.set(w, h);
    u.tC.value = this.main.textures[0];
    u.tN.value = this.main.textures[1];
    u.tD.value = dt;
    u.tB1.value = this.b1b.texture;
    u.tB2.value = this.b2b.texture;
  }

  // ─── 지도 ─────────────────────────────────────

  clearMap() {
    for (const c of this.chunks) {
      this.scene.remove(c.mesh);
      c.mesh.dispose();
    }
    this.chunks = [];
    for (const g of this.grassChunks) {
      this.scene.remove(g.mesh);
      g.mesh.geometry.dispose();
    }
    this.grassChunks = [];
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
    }
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
    }
    this.terrainMesh = this.waterMesh = null;
    this.terrain?.dispose();
    this.terrain = null;
    this.lamps = [];
  }

  /** 다음 프레임에 그림자를 바로 다시 그린다 */
  invalidateShadow() {
    this.shadowLive = null;
  }

  loadMap(map: MapData) {
    this.clearMap();
    this.map = map;
    this.shadowLive = null;
    const at = (this.atmos = atmosphereOf(map));
    shared.uSunDir.value.copy(at.sunDir).normalize();
    shared.uSunCol.value.copy(at.sun);
    shared.uSky.value.copy(at.sky);
    shared.uGnd.value.copy(at.gnd);
    shared.uCloud.value = at.cloud;
    const pu = this.postMat.uniforms;
    pu.uFogCol.value.copy(at.fog);
    pu.uFog.value = at.fogAmt;
    pu.uShadowTint.value.copy(at.shadowTint);
    pu.uHighTint.value.copy(at.highTint);
    pu.uSat.value = at.sat;
    pu.uMapSize.value.set(map.w, map.h);
    pu.uHaloK.value = at.halo;
    this.renderer.setClearColor(at.fog, 1);

    const t = (this.terrain = new TerrainData(map));
    const tu = {
      ...shared,
      uSplat: { value: t.splat },
      uMapSize: { value: new THREE.Vector2(map.w, map.h) },
      uBase: { value: t.baseKind },
      uKinds: { value: t.kindsVec },
      uKindN: { value: t.kindN },
      uBiome: { value: at.ground },
    };
    this.terrainMat?.dispose();
    this.terrainMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: tu, blending: THREE.NoBlending });
    this.terrainMesh = new THREE.Mesh(t.buildMesh(), this.terrainMat);
    this.terrainMesh.frustumCulled = false;
    this.terrainMesh.userData.noShadow = true;
    this.scene.add(this.terrainMesh);
    if (t.waterIdx >= 0) {
      const g = new THREE.PlaneGeometry(map.w + 2, map.h + 2);
      g.rotateX(-Math.PI / 2);
      g.translate(map.w / 2, -0.14, map.h / 2);
      const wm = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: TERRAIN_VERT, fragmentShader: WATER_FRAG, uniforms: { ...tu, uWaterIdx: { value: t.waterIdx } }, blending: THREE.NoBlending });
      this.waterMesh = new THREE.Mesh(g, wm);
      this.waterMesh.frustumCulled = false;
      this.waterMesh.userData.noShadow = true;
      this.scene.add(this.waterMesh);
    }

    this.grassMat ??= new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG, uniforms: { ...shared }, blending: THREE.NoBlending, side: THREE.DoubleSide });
    for (const c of t.grassChunks(CHUNK, at.ground)) {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', this.grassGeo.getAttribute('position'));
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(c.pos, 3));
      g.setAttribute('iCol', new THREE.InstancedBufferAttribute(c.col, 3));
      g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(c.seed, 2));
      g.instanceCount = c.n;
      const m = new THREE.Mesh(g, this.grassMat);
      m.frustumCulled = false;
      m.userData.noShadow = true;
      this.scene.add(m);
      this.grassChunks.push({ mesh: m, cx: c.cx, cz: c.cz });
    }

    // 소품: 칸·종류·변형별로 묶는다
    const groups = new Map<string, { id: string; variant: number; cx: number; cz: number; items: [number, number, number][] }>();
    const hash = (a: number, b: number) => {
      let h = (Math.round(a * 37) * 374761393 + Math.round(b * 37) * 668265263) | 0;
      h = (h ^ (h >>> 13)) * 1274126177;
      return (h ^ (h >>> 16)) >>> 0;
    };
    const clearSpots = map.objects.filter((o) => o.type === 'door' || o.type === 'arrive');
    const place = (id: string, u: number, v: number) => {
      // 문 앞을 가리는 나무는 심지 않는다 (충돌은 그대로)
      if (id.startsWith('tree_') && clearSpots.some((o) => Math.abs(o.u - u) < 2.6 && v - o.v > -0.5 && v - o.v < 4.2)) return;
      const n = propVariants(id);
      const hv = hash(u, v);
      const variant = hv % n;
      const cx = Math.floor(u / CHUNK);
      const cz = Math.floor(v / CHUNK);
      const key = `${id}|${variant}|${cx}|${cz}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { id, variant, cx, cz, items: [] }));
      g.items.push([u, v, hv]);
    };
    for (const [id, u, v] of map.props) place(id, u, v);
    for (const [id, u, v] of t.outerProps()) place(id, u, v);
    const mx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const g of groups.values()) {
      const geo = propGeometry(g.id, g.variant);
      const mesh = new THREE.InstancedMesh(geo, this.statics, g.items.length);
      const spin = propSpin(g.id);
      g.items.forEach(([u, v, hv], i) => {
        const a = spin ? ((hv >>> 8) % 628) / 100 : 0;
        const k = spin ? 0.88 + (((hv >>> 18) % 100) / 100) * 0.3 : 1;
        q.setFromAxisAngle(up, a);
        p.set(u, propOnWater(g.id) ? 0 : t.heightAt(u, v), v);
        s.set(k, k, k);
        mesh.setMatrixAt(i, mx.compose(p, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.chunks.push({ mesh, cx: g.cx, cz: g.cz });
    }

    // 빛
    const warm = at.lamp;
    for (const o of map.objects) {
      if (o.type === 'lantern' || o.type === 'waystone') {
        const big = (o.r ?? 5) >= 6;
        this.lamps.push({ x: o.u + (big ? 0 : 0.42), y: big ? 2.0 : 1.95, z: o.v + (big ? 0.6 : 0), r: (o.r ?? 5) * 1.05, col: warm.clone(), ph: Math.random() * 10, k: 1 });
      }
    }
    for (const [id, u, v] of map.props) {
      const l = PROP_LIGHTS[id];
      if (!l) continue;
      // 지도 객체로 이미 넣은 등불은 건너뛴다
      if (this.lamps.some((m) => Math.abs(m.x - u) < 0.6 && Math.abs(m.z - v) < 0.6)) continue;
      this.lamps.push({ x: u + l.x, y: l.y, z: v + l.z, r: l.r, col: new THREE.Color(l.col), ph: Math.random() * 10, k: l.k });
    }
  }

  /** 게임 중에 생기고 없어지는 소품 (저승길 문 등) */
  addProp(id: string, u: number, v: number) {
    const m = new THREE.Mesh(propGeometry(id, 0), this.statics);
    m.position.set(u, this.terrain?.heightAt(u, v) ?? 0, v);
    m.frustumCulled = false;
    this.scene.add(m);
    return m;
  }

  removeProp(o: THREE.Object3D) {
    this.scene.remove(o);
  }

  /** 그래픽 수준을 바꾼다. 잎 모델을 다시 지으므로 지도를 다시 읽는다. */
  setQuality(q: number) {
    if (q === this.quality) return;
    this.quality = q;
    setLeafDensity(q > 0 ? 1 : 0.32);
    clearPropCache();
    if (this.map) this.loadMap(this.map);
  }

  // ─── 잔상 ─────────────────────────────────────

  ghost(view: ActorView) {
    const tex = new THREE.DataTexture(view.data.slice(), 4, view.tex.image.height, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    const mat = uberMaterial({ bones: tex });
    mat.uniforms.uFlash.value.set(0.62, 0.82, 1, 0.75);
    mat.uniforms.uAlpha.value = 0.5;
    const mesh = new THREE.Mesh(view.mesh.geometry, mat);
    mesh.frustumCulled = false;
    this.actors.add(mesh);
    this.ghosts.push({ mesh, mat, tex, t: 0 });
  }

  private updateGhosts(dt: number) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.t += dt;
      g.mat.uniforms.uAlpha.value = 0.5 * (1 - g.t / 0.2);
      if (g.t >= 0.2) {
        this.actors.remove(g.mesh);
        g.mat.dispose();
        g.tex.dispose();
        this.ghosts.splice(i, 1);
      }
    }
  }

  // ─── 미리보기 ─────────────────────────────────

  private pv: { rt: THREE.WebGLRenderTarget; out: THREE.WebGLRenderTarget; scene: THREE.Scene; cam: THREE.OrthographicCamera; buf: Uint8Array; img: ImageData } | null = null;

  /** 인물 미리보기를 2D 캔버스에 그린다. 창 UI에서 쓴다. */
  portrait(view: ActorView, ctx: CanvasRenderingContext2D) {
    const size = PORTRAIT;
    if (!this.pv) {
      const dt = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
      const rt = new THREE.WebGLRenderTarget(size, size, { count: 2, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: dt });
      const out = new THREE.WebGLRenderTarget(size, size, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
      const cam = new THREE.OrthographicCamera(-size / 2 / PX_U, size / 2 / PX_U, size / 2 / PX_U, -size / 2 / PX_U, 1, 500);
      cam.position.set(CAM_DIR.x * 200, 0.92 + CAM_DIR.y * 200, CAM_DIR.z * 200);
      cam.lookAt(0, 0.92, 0);
      cam.updateMatrixWorld(true);
      this.pv = { rt, out, cam, scene: new THREE.Scene(), buf: new Uint8Array(size * size * 4), img: new ImageData(size, size) };
    }
    const { rt, out, cam, scene, buf, img } = this.pv;
    const r = this.renderer;
    const parent = view.mesh.parent;
    scene.add(view.mesh);
    const lampN = shared.uLampN.value;
    const cloud = shared.uCloud.value;
    const map = shared.uShadowMap.value;
    const focus = shared.uFocusOn.value;
    const sun = shared.uSunDir.value.clone();
    const sc = shared.uSunCol.value.clone();
    const sk = shared.uSky.value.clone();
    const gn = shared.uGnd.value.clone();
    shared.uLampN.value = 0;
    shared.uCloud.value = 0;
    shared.uShadowMap.value = this.blank;
    shared.uFocusOn.value = 0;
    shared.uPass.value = 0;
    shared.uSunDir.value.set(-0.5, 0.7, 0.6).normalize();
    shared.uSunCol.value.setRGB(0.95, 0.82, 0.62);
    shared.uSky.value.setRGB(0.5, 0.55, 0.7);
    shared.uGnd.value.setRGB(0.36, 0.32, 0.38);
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(rt);
    r.clear(true, true, true);
    r.render(scene, cam);
    const u = this.postMat.uniforms;
    const save = { tC: u.tC.value, tN: u.tN.value, tD: u.tD.value, tB1: u.tB1.value, tB2: u.tB2.value, res: u.uRes.value.clone(), fog: u.uFog.value, hn: u.uHaloN.value, key: u.uKey.value, tint: u.uShadowTint.value.clone(), high: u.uHighTint.value.clone(), sat: u.uSat.value };
    u.tC.value = rt.textures[0];
    u.tN.value = rt.textures[1];
    u.tD.value = rt.depthTexture;
    u.tB1.value = this.black;
    u.tB2.value = this.black;
    u.uRes.value.set(size, size);
    u.uFog.value = 0;
    u.uHaloN.value = 0;
    u.uKey.value = 1;
    this.fs(this.postMat, out);
    u.tC.value = save.tC;
    u.tN.value = save.tN;
    u.tD.value = save.tD;
    u.tB1.value = save.tB1;
    u.tB2.value = save.tB2;
    u.uRes.value.copy(save.res);
    u.uFog.value = save.fog;
    u.uHaloN.value = save.hn;
    u.uKey.value = save.key;
    shared.uLampN.value = lampN;
    shared.uCloud.value = cloud;
    shared.uShadowMap.value = map;
    shared.uFocusOn.value = focus;
    shared.uSunDir.value.copy(sun);
    shared.uSunCol.value.copy(sc);
    shared.uSky.value.copy(sk);
    shared.uGnd.value.copy(gn);
    if (this.atmos) r.setClearColor(this.atmos.fog, 1);
    r.readRenderTargetPixels(out, 0, 0, size, size, buf);
    r.setRenderTarget(null);
    if (parent) parent.add(view.mesh);
    // 위아래가 뒤집혀 있다
    const row = size * 4;
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * row, (size - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
  }

  // ─── 카메라 ───────────────────────────────────

  /** cx, cy: 화면 좌표(논리 픽셀)에서 화면 가운데가 볼 땅 위 점 */
  setView(cx: number, cy: number) {
    this.cx = cx;
    this.cy = cy;
  }

  setFocus(u: number, v: number, h: number, on: boolean) {
    shared.uFocus.value.set(u, h, v);
    shared.uFocusOn.value = on ? 1 : 0;
  }

  private updateCamera() {
    const { w, h, camera: c } = this;
    const hw = w / 2 / PX_U;
    const hh = h / 2 / PX_U;
    c.left = -hw;
    c.right = hw;
    c.top = hh;
    c.bottom = -hh;
    c.near = 1;
    c.far = 500;
    const tu = this.cx / PX_U;
    const tv = this.cy / PX_V;
    c.position.set(tu + CAM_DIR.x * 200, CAM_DIR.y * 200, tv + CAM_DIR.z * 200);
    c.up.set(0, 1, 0);
    c.lookAt(tu, 0, tv);
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
    // 화면 왼쪽 위 픽셀의 월드 고정 번호. 체크무늬 점이 땅에 붙게 한다.
    shared.uCamPx.value.set(Math.round(this.cx - w / 2), Math.round(this.cy - h / 2));
    this.postMat.uniforms.uInvVP.value.multiplyMatrices(c.projectionMatrixInverse, new THREE.Matrix4()).premultiply(c.matrixWorld);
  }

  private updateSun() {
    const dir = shared.uSunDir.value;
    const tu = this.cx / PX_U;
    const tv = this.cy / PX_V;
    const c = this.sunCam;
    const texel = SHADOW_SPAN / SHADOW_SIZE;
    // 그림자 격자에 맞춰 옮겨야 움직일 때 그림자 경계가 떨리지 않는다
    c.position.set(tu + dir.x * 70, dir.y * 70, tv + dir.z * 70);
    c.up.set(0, 1, 0);
    c.lookAt(tu, 0, tv);
    c.updateMatrixWorld(true);
    const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0);
    const upv = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
    const ax = c.position.dot(right);
    const ay = c.position.dot(upv);
    c.position.addScaledVector(right, Math.round(ax / texel) * texel - ax);
    c.position.addScaledVector(upv, Math.round(ay / texel) * texel - ay);
    c.updateMatrixWorld(true);
    c.updateProjectionMatrix();
    shared.uShadowMat.value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
  }

  private updateLamps() {
    const tu = this.cx / PX_U;
    const tv = this.cy / PX_V;
    const t = this.time;
    const list = this.lamps
      .map((l) => ({ l, d: Math.hypot(l.x - tu, (l.z - tv) * 0.7) - l.r * 0.5 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LAMPS);
    const u = this.postMat.uniforms;
    const screen = (x: number, y: number, z: number): [number, number] => [x * PX_U - this.cx + this.w / 2, this.h - (z * PX_V - y * PX_H - this.cy + this.h / 2)];
    let n = 0;
    let hn = 0;
    const lampK = this.atmos?.lampK ?? 1;
    const my = this.atmos?.myLight ?? 0;
    if (my > 0 && shared.uFocusOn.value > 0) {
      const f = shared.uFocus.value;
      const c = this.atmos!.lamp;
      const k = 0.62 * (0.96 + Math.sin(t * 5.3) * 0.03);
      shared.uLampPos.value[n].set(f.x, f.y + 0.7, f.z, my);
      shared.uLampCol.value[n].set(c.r * k, c.g * k, c.b * k);
      n++;
    }
    for (const { l } of list) {
      if (n >= MAX_LAMPS) break;
      const flick = 0.92 + Math.sin(t * 3.1 + l.ph) * 0.05 + Math.sin(t * 7.7 + l.ph * 2) * 0.03;
      const k = flick * l.k * lampK;
      shared.uLampPos.value[n].set(l.x, l.y, l.z, l.r * (0.97 + (flick - 0.92) * 0.3));
      shared.uLampCol.value[n].set(l.col.r * k, l.col.g * k, l.col.b * k);
      n++;
      const [sx, sy] = screen(l.x, l.y, l.z);
      if (sx > -160 && sx < this.w + 160 && sy > -160 && sy < this.h + 160) {
        u.uHalo.value[hn].set(sx, sy, 34 + l.r * 6, 0.32 * flick);
        u.uHaloCol.value[hn].set(l.col.r, l.col.g, l.col.b);
        hn++;
      }
    }
    shared.uLampN.value = n;
    u.uHaloN.value = hn;
  }

  /** 화면 안(또는 그림자에 걸리는 곳)에 있는 칸만 켠다 */
  private cull(extra: number) {
    const hw = this.w / 2 / PX_U + extra;
    const hh = this.h / 2 / PX_V + extra;
    const tu = this.cx / PX_U;
    const tv = this.cy / PX_V;
    const vis = (cx: number, cz: number, up: number) => {
      const x0 = cx * CHUNK;
      const z0 = cz * CHUNK;
      return x0 + CHUNK + 2 > tu - hw && x0 - 2 < tu + hw && z0 + CHUNK + 2 > tv - hh && z0 - 2 - up < tv + hh + up;
    };
    for (const c of this.chunks) c.mesh.visible = vis(c.cx, c.cz, 8);
    return vis;
  }

  // ─── 그리기 ───────────────────────────────────

  private fs(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.fsQuad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  render(dt: number) {
    if (!this.map) return;
    // 프레임이 계속 느리면 알린다
    const now = performance.now();
    if (this.lastNow) {
      const ms = now - this.lastNow;
      if (ms < 500) {
        this.slowEma += (ms - this.slowEma) * 0.03;
        this.slowN++;
        if (this.slowN > 150 && this.slowEma > 36 && this.quality > 0) {
          this.slowN = 0;
          this.onSlow?.();
        }
      }
    }
    this.lastNow = now;
    this.time += dt;
    shared.uTime.value = this.time;
    this.updateGhosts(dt);
    this.renderer.info.reset();
    this.updateCamera();
    this.updateLamps();
    const r = this.renderer;

    // 그림자: 세 프레임에 한 번만 그려 부담을 줄인다. 표는 월드 기준이라 카메라가 움직여도 맞다.
    this.shadowTick = (this.shadowTick + 1) % 3;
    const wantShadow = !!this.atmos?.sunShadow && this.quality > 0;
    if (wantShadow && (this.shadowTick === 0 || !this.shadowLive)) {
      this.shadowLive = true;
      this.updateSun();
      shared.uPass.value = 1;
      const vis = this.cull(8);
      void vis;
      const hide: THREE.Object3D[] = [];
      for (const o of this.scene.children) {
        if (o.userData.noShadow) {
          if (o.visible) hide.push(o);
          o.visible = false;
        }
      }
      // 그림자를 그리는 동안에는 그림자 표를 읽지 않게 빈 표로 바꿔 둔다
      shared.uShadowMap.value = this.blank;
      r.setRenderTarget(this.shadow);
      r.clear(true, true, true);
      r.render(this.scene, this.sunCam);
      shared.uShadowMap.value = this.shadow.depthTexture;
      for (const o of hide) o.visible = true;
    } else if (!wantShadow && this.shadowLive !== false) {
      this.shadowLive = false;
      r.setRenderTarget(this.shadow);
      r.clear(true, true, true);
    }

    // 본 장면
    shared.uPass.value = 0;
    const vis = this.cull(0.5);
    for (const g of this.grassChunks) g.mesh.visible = this.quality > 0 && vis(g.cx, g.cz, 1);
    r.setRenderTarget(this.main);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);

    // 빛 번짐
    this.brightMat.uniforms.tC.value = this.main.textures[0];
    this.fs(this.brightMat, this.bright);
    const blur = (src: THREE.WebGLRenderTarget, a: THREE.WebGLRenderTarget, b: THREE.WebGLRenderTarget, s: number) => {
      this.blurMat.uniforms.tC.value = src.texture;
      this.blurMat.uniforms.uDir.value.set(s / a.width, 0);
      this.fs(this.blurMat, a);
      this.blurMat.uniforms.tC.value = a.texture;
      this.blurMat.uniforms.uDir.value.set(0, s / a.height);
      this.fs(this.blurMat, b);
    };
    blur(this.bright, this.b1a, this.b1b, 1);
    blur(this.b1b, this.b2a, this.b2b, 1.6);

    this.fs(this.postMat, null);
    this.stats.calls = r.info.render.calls;
    this.stats.tris = r.info.render.triangles;
  }
}
