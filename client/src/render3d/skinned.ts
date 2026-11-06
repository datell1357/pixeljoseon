// 블렌더에서 만든 스킨드 모델(glb). 정점마다 뼈 넷을 가중치로 섞고, 동작은 클립으로 재생한다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuiltRig, CharAsset } from './chars';

/** 시트 이름 → 모델 파일. 여기 있는 짐승은 코드로 지은 모델 대신 이 모델을 쓴다 */
export const FILES: Record<string, string> = Object.fromEntries(['yeou', 'neukdae', 'seungnyangi', 'neoguri', 'gumiho', 'horangi', 'bandalgom', 'metdwaeji', 'daramjwi', 'bakjwi', 'bulgasari', 'pc_musa', 'pc_dosa', 'pc_gungsa', 'npc_elder', 'npc_merchant', 'npc_smith', 'npc_guard', 'npc_keeper'].map((n) => [n, `/models/${n}.glb`]));
/** 도트 모드에서는 동작을 초당 이만큼으로 끊어 재생한다. 0이면 끊지 않는다(사실적 모드) */
let stepFps = 12;
export function setSkinnedStepFps(n: number) {
  stepFps = n;
}
/** 사람 모델 배율: 블렌더 미터 → 게임 단위. 무사(상투 포함 약 1.85m)가 예전 코드 모델 키 1.98이 되게 모두 같은 배율을 쓴다(모자 높이로 몸 크기가 달라지지 않게) */
const HUMAN_SCALE = 1.98 / 1.85;

const loaded = new Map<string, CharAsset>();

/** 게임 시작 전에 모델 파일을 모두 읽어 둔다 */
export async function preloadSkinned() {
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(FILES).map(async ([id, url]) => {
      try {
        const g = await loader.loadAsync(url);
        loaded.set(id, build(id, g.scene, g.animations));
      } catch (e) {
        console.warn(`모델을 읽지 못해 예전 모델을 씁니다: ${id}`, e);
      }
    }),
  );
}

/** 블렌더 모델 상태: 'ok' 불러옴, 'failed' 파일은 있는데 못 읽음, 'none' 블렌더 모델 없음 */
export function skinnedStatus(id: string): 'ok' | 'failed' | 'none' {
  if (!FILES[id]) return 'none';
  return loaded.has(id) ? 'ok' : 'failed';
}

export function skinnedAsset(id: string): CharAsset | null {
  return loaded.get(id) ?? null;
}

/** 몸 메시. 장비 조각(이름 g_…)은 따로 다룬다 */
function findSkinned(root: THREE.Object3D) {
  let m: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!m && (o as THREE.SkinnedMesh).isSkinnedMesh && !o.name.startsWith('g_')) m = o as THREE.SkinnedMesh;
  });
  if (!m) throw new Error('스킨드 메시 없음');
  return m as THREE.SkinnedMesh;
}

function build(id: string, scene: THREE.Object3D, clips: THREE.AnimationClip[]): CharAsset {
  scene.updateMatrixWorld(true);
  const src = findSkinned(scene);
  const geo = plainGeo(src.geometry);
  const n = geo.getAttribute('position').count;
  // 셰이더가 쓰는 보조값: 반짝임 0, 빛남 0, 바람 0, 외곽선 부위 번호
  // 외곽선 부위 번호는 정점을 가장 많이 끄는 뼈의 부위로 정한다: 다리와 몸, 머리, 꼬리 사이에 선이 생긴다
  const boneNames = src.skeleton.bones.map((b) => b.name);
  const human = id.startsWith('pc_') || id.startsWith('npc_');
  const part = (nm: string) => {
    if (human) {
      // 사람 뼈: 이름 끝 _l/_r이 옆
      const hs = nm.endsWith('_l') ? 0 : 1;
      if (/^(clavicle|upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/.test(nm)) return 10 + hs;
      if (/^(thigh|calf|foot|ball)/.test(nm)) return 12 + hs;
      if (/^(head|neck)/.test(nm)) return 15;
      return 16;
    }
    const side = nm.endsWith('L') ? 0 : 1;
    if (/^fire/.test(nm)) return 20;
    const tm = /^t(\d+)_/.exec(nm);
    if (tm) return 30 + Number(tm[1]);
    if (/^(scap|uarm|farm|paw)/.test(nm)) return 10 + side;
    if (/^(thigh|shin|meta|hpaw)/.test(nm)) return 12 + side;
    if (/^tail/.test(nm)) return 14;
    if (/^(head|jaw|ear)/.test(nm)) return 15;
    return 16;
  };
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  const aux = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const score = new Map<number, number>();
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (w <= 0) continue;
      const pt = part(boneNames[Math.round(si.getComponent(i, k))] ?? '');
      score.set(pt, (score.get(pt) ?? 0) + w);
    }
    let best = 16;
    let bw = -1;
    for (const [pt, w] of score) if (w > bw) { bw = w; best = pt; }
    aux[i * 4 + 3] = best / 255;
    // 여우불은 스스로 빛난다
    if (best === 20) aux[i * 4 + 1] = 0.8;
  }
  geo.setAttribute('aux', new THREE.BufferAttribute(aux, 4));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  const map = (src.material as THREE.MeshStandardMaterial).map ?? null;
  if (map) {
    map.colorSpace = THREE.NoColorSpace;
    // 사람은 얼굴 결이 살아야 해서 부드럽게 거른다
    map.magFilter = map.minFilter = human ? THREE.LinearFilter : THREE.NearestFilter;
    map.generateMipmaps = false;
    map.flipY = false;
    map.needsUpdate = true;
  }
  const byName = new Map(clips.map((c) => [c.name, c]));
  const anims: CharAsset['anims'] = {};
  const LOOPS = new Set(['idle', 'walk']);
  for (const c of clips) {
    const name = c.name;
    const loop = LOOPS.has(name);
    anims[name] = { frames: Math.round(c.duration * 24), dur: c.duration, loop, poses: [{}] };
  }
  const bindIndex = src.skeleton.bones.map((b) => b.name);
  // 장비 조각: 몸과 같은 뼈 번호·좌표로 맞춰 둔다. 붙일 때 몸 형상과 합친다
  const gear = new Map<string, THREE.BufferGeometry>();
  const toBody = src.bindMatrixInverse.clone();
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.name.startsWith('g_')) return;
    const g = plainGeo(m.geometry);
    const remap = m.skeleton.bones.map((b) => Math.max(0, bindIndex.indexOf(b.name)));
    const idx = g.getAttribute('skinIndex');
    for (let i = 0; i < idx.count; i++) for (let k = 0; k < 4; k++) idx.setComponent(i, k, remap[Math.round(idx.getComponent(i, k))] ?? 0);
    g.applyMatrix4(toBody.clone().multiply(m.bindMatrix));
    const cnt = g.getAttribute('position').count;
    const ax = new Float32Array(cnt * 4);
    // 외곽선 부위 번호: 몸과 다른 번호라 무기 둘레에 선이 생긴다
    for (let i = 0; i < cnt; i++) ax[i * 4 + 3] = 18 / 255;
    g.setAttribute('aux', new THREE.BufferAttribute(ax, 4));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cnt * 3).fill(1), 3));
    gear.set(m.name, g);
  });
  const bindInv = src.skeleton.boneInverses.map((m) => m.clone().multiply(src.bindMatrix));

  const rigFactory = (): BuiltRig => {
    const root = cloneSkinned(scene);
    const holder = new THREE.Group();
    holder.add(root);
    const sk = findSkinned(root);
    sk.visible = false;
    const bones = bindIndex.map((nm) => sk.skeleton.bones.find((b) => b.name === nm)!);
    const mixer = new THREE.AnimationMixer(root);
    let cur = '';
    let action: THREE.AnimationAction | null = null;
    const rig = {
      root: holder,
      apply() {},
      /** name 동작의 진행도 p(0~1) 지점을 끊어서 재생한다 */
      play(name: string, p: number) {
        const clip = byName.get(name) ?? byName.get('idle');
        if (!clip) return;
        if (cur !== clip.name) {
          mixer.stopAllAction();
          action = mixer.clipAction(clip);
          action.play();
          cur = clip.name;
        }
        const loop = anims[clip.name]?.loop ?? false;
        const f = loop ? ((p % 1) + 1) % 1 : Math.min(Math.max(p, 0), 0.999);
        const t = stepFps > 0 ? Math.floor(f * clip.duration * stepFps) / stepFps : f * clip.duration;
        action!.time = t;
        mixer.update(0);
      },
    };
    return { rig, bones, panels: [], chains: [], bindInv } as BuiltRig;
  };

  // 쉬는 자세 높이
  const proto = rigFactory();
  (proto.rig as { play: (n: string, p: number) => void }).play('idle', 0);
  proto.rig.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const height = Math.max(0.3, box.max.y);
  const asset = { geometry: geo, boneOrder: bindIndex, rigFactory, anims, retarget: false, height, baseScale: human ? HUMAN_SCALE : 2.05, fur: id === 'bulgasari' ? 0.2 : 0.45, map, skinned: true, emKey: id === 'bulgasari' } as CharAsset;
  if (gear.size) gearParts.set(id, gear);
  return asset;
}

/** 위치·법선·UV·뼈 번호·가중치만 남기고 형식을 하나로 맞춘다(조각끼리 합칠 수 있게) */
function plainGeo(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  const f32 = (name: string, size: number) => {
    const a = src.getAttribute(name);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
    return new THREE.BufferAttribute(out, size);
  };
  g.setAttribute('position', f32('position', 3));
  g.setAttribute('normal', f32('normal', 3));
  if (src.getAttribute('uv')) g.setAttribute('uv', f32('uv', 2));
  const si = src.getAttribute('skinIndex');
  const idx = new Uint16Array(si.count * 4);
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) idx[i * 4 + k] = si.getComponent(i, k);
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', f32('skinWeight', 4));
  if (src.index) {
    const ix = src.index;
    const out = new Uint32Array(ix.count);
    for (let i = 0; i < ix.count; i++) out[i] = ix.getX(i);
    g.setIndex(new THREE.BufferAttribute(out, 1));
  }
  return g;
}

const gearParts = new Map<string, Map<string, THREE.BufferGeometry>>();
const combos = new Map<string, CharAsset>();

/** 붙일 장비 조각 하나: 조각 이름, 색 곱(희귀도), 빛 세기 */
export interface GearPick {
  name: string;
  tint?: [number, number, number];
  glow?: number;
}

/** 모델에 그 이름의 장비 조각이 있는가 */
export function hasGearPart(id: string, name: string) {
  return !!gearParts.get(id)?.has(name);
}

/** 몸에 장비 조각을 합친 모델. 같은 조합은 함께 쓴다 */
export function skinnedWithGear(id: string, picks: GearPick[]): CharAsset | null {
  const base = loaded.get(id);
  if (!base) return null;
  const parts = gearParts.get(id);
  const use = picks.filter((p) => parts?.has(p.name));
  if (!use.length) return base;
  const key = id + '|' + use.map((p) => `${p.name}:${p.tint?.join('/') ?? ''}:${p.glow ?? 0}`).join(',');
  const hit = combos.get(key);
  if (hit) return hit;
  const geos = [base.geometry];
  for (const p of use) {
    const g = parts!.get(p.name)!.clone();
    const n = g.getAttribute('position').count;
    if (p.tint) {
      const c = g.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) c.setXYZ(i, p.tint[0], p.tint[1], p.tint[2]);
    }
    if (p.glow) {
      const a = g.getAttribute('aux') as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) a.setY(i, p.glow);
    }
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  if (!merged) return base;
  const a = { ...base, geometry: merged, refs: 0 } as CharAsset;
  combos.set(key, a);
  // 오래 안 쓴 조합은 버린다
  if (combos.size > 48) {
    for (const [k, v] of combos) {
      if ((v.refs ?? 0) <= 0) {
        v.geometry.dispose();
        combos.delete(k);
        if (combos.size <= 40) break;
      }
    }
  }
  return a;
}
