// 블렌더에서 만든 스킨드 모델(glb). 정점마다 뼈 넷을 가중치로 섞고, 동작은 클립으로 재생한다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { BuiltRig, CharAsset } from './chars';

/** 시트 이름 → 모델 파일. 여기 있는 짐승은 코드로 지은 모델 대신 이 모델을 쓴다 */
const FILES: Record<string, string> = Object.fromEntries(['fox', 'wolf', 'dhole', 'raccoon', 'gumiho', 'tiger', 'bear', 'boar'].map((n) => [n, `/models/${n}.glb`]));
/** 도트 느낌: 동작을 초당 이만큼으로 끊어 재생한다 */
const STEP_FPS = 12;

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

export function skinnedAsset(id: string): CharAsset | null {
  return loaded.get(id) ?? null;
}

function findSkinned(root: THREE.Object3D) {
  let m: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!m && (o as THREE.SkinnedMesh).isSkinnedMesh) m = o as THREE.SkinnedMesh;
  });
  if (!m) throw new Error('스킨드 메시 없음');
  return m as THREE.SkinnedMesh;
}

function build(id: string, scene: THREE.Object3D, clips: THREE.AnimationClip[]): CharAsset {
  scene.updateMatrixWorld(true);
  const src = findSkinned(scene);
  const geo = src.geometry.clone();
  const n = geo.getAttribute('position').count;
  // 셰이더가 쓰는 보조값: 반짝임 0, 빛남 0, 바람 0, 외곽선 부위 번호
  // 외곽선 부위 번호는 정점을 가장 많이 끄는 뼈의 부위로 정한다: 다리와 몸, 머리, 꼬리 사이에 선이 생긴다
  const boneNames = src.skeleton.bones.map((b) => b.name);
  const part = (nm: string) => {
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
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.flipY = false;
    map.needsUpdate = true;
  }
  const byName = new Map(clips.map((c) => [c.name, c]));
  const anims: CharAsset['anims'] = {};
  for (const [name, loop] of [['idle', true], ['walk', true], ['attack', false], ['hit', false], ['death', false], ['sweep', false], ['slam', false], ['cast', false]] as const) {
    const c = byName.get(name);
    if (c) anims[name] = { frames: Math.round(c.duration * 24), dur: c.duration, loop, poses: [{}] };
  }
  const bindIndex = src.skeleton.bones.map((b) => b.name);
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
        const t = Math.floor(f * clip.duration * STEP_FPS) / STEP_FPS;
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
  void id;
  return { geometry: geo, boneOrder: bindIndex, rigFactory, anims, retarget: false, height, baseScale: 2.05, fur: 0.45, map, skinned: true } as CharAsset;
}
