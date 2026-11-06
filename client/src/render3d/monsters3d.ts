// 몬스터와 보스의 3D 모델. 짐승마다 제 뼈대와 동작을 갖는다 (beasts.ts).
import * as THREE from 'three';
import type { BuiltRig, CharAsset } from './chars';
import { BEASTS } from './beasts';

const cache = new Map<string, CharAsset>();

/** 쉬는 자세에서 모델 꼭대기 높이: 이름표와 체력 막대 자리 */
function restHeight(geometry: THREE.BufferGeometry, bones: THREE.Object3D[]) {
  const pos = geometry.getAttribute('position');
  const bi = geometry.getAttribute('bone');
  const v = new THREE.Vector3();
  let top = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(bones[Math.round(bi.getX(i))].matrixWorld);
    if (v.y > top) top = v.y;
  }
  return top;
}

export function monsterAsset(id: string): CharAsset | null {
  let a = cache.get(id);
  if (a) return a;
  const fn = BEASTS[id];
  if (!fn) return null;
  const beast = fn();
  const geometry = beast.b.g.build();
  const order = beast.b.order;
  const lookup = (rig: any, n: string): THREE.Object3D => {
    const o = rig.nodes[n];
    if (!o) throw new Error(`뼈 없음: ${id}.${n}`);
    return o;
  };
  const rigFactory = (): BuiltRig => {
    const rig = beast.rig();
    return { rig, bones: order.map((n) => lookup(rig, n)), panels: [], chains: [] };
  };
  const proto = rigFactory();
  proto.rig.apply(beast.anims.idle.poses[0]);
  proto.rig.root.updateMatrixWorld(true);
  const height = Math.max(0.3, restHeight(geometry, proto.bones));
  a = { geometry, boneOrder: order, rigFactory, anims: beast.anims, retarget: false, height, baseScale: 1.28, fur: beast.fur ?? 1 };
  cache.set(id, a);
  return a;
}
