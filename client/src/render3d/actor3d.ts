// 움직이는 인물 하나의 3D 모습. 동작 재생, 옷자락·머리카락, 뼈 행렬 올리기.
import * as THREE from 'three';
import { monsterAsset } from './monsters3d';
import { humanAsset, retarget, type BuiltRig, type CharAsset, type Chain, type Panel } from './chars';
import { pcAsset } from './pc';
import { skinnedAsset } from './skinned';
import { uberMaterial } from './stage';

const D2R = Math.PI / 180;

export function assetOf(id: string): CharAsset | null {
  // '이름@old': 블렌더 모델이 있어도 예전 코드 모델을 쓴다 (그림 점검 비교용)
  if (id.endsWith('@old')) {
    const base = id.slice(0, -4);
    return pcAsset(base, true) ?? monsterAsset(base);
  }
  return pcAsset(id) ?? humanAsset(id) ?? skinnedAsset(id) ?? monsterAsset(id);
}

function lerpPose(a: Record<string, number>, b: Record<string, number>, t: number) {
  const o: Record<string, number> = { ...a };
  for (const k in b) {
    const x = a[k];
    if (x === undefined) o[k] = b[k];
    else o[k] = x + (b[k] - x) * t;
  }
  return o;
}

const tmpM = new THREE.Matrix4();

function boneTexture(data: Float32Array, n: number) {
  const tex = new THREE.DataTexture(data, 4, n, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export class ActorView {
  asset: CharAsset;
  built: BuiltRig;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  tex: THREE.DataTexture;
  data: Float32Array;
  root: THREE.Object3D;
  heading = 0;
  headingTo = 0;
  time = 0;
  scale = 1;
  px = 0;
  pz = 0;
  vx = 0;
  vz = 0;
  sway = Math.random() * 10;

  constructor(
    public id: string,
    parent: THREE.Object3D,
  ) {
    const a = assetOf(id);
    if (!a) throw new Error(`모델 없음: ${id}`);
    this.asset = a;
    a.refs = (a.refs ?? 0) + 1;
    this.built = a.rigFactory();
    this.root = this.built.rig.root;
    const n = Math.max(1, this.built.bones.length);
    this.data = new Float32Array(4 * 4 * n);
    this.tex = boneTexture(this.data, n);
    this.mat = uberMaterial({ bones: this.tex, skinned: a.skinned, map: a.map ?? null });
    this.mat.uniforms.uFur.value = a.fur ?? 0;
    this.mat.uniforms.uEmKey.value = a.emKey ? 1 : 0;
    this.mesh = new THREE.Mesh(a.geometry, this.mat);
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }

  /** 장비를 바꿔 입는다. 위치와 방향은 그대로 두고 몸만 바꾼다 */
  setSheet(id: string) {
    if (id === this.id) return;
    const a = assetOf(id);
    if (!a) return;
    a.refs = (a.refs ?? 0) + 1;
    this.asset.refs = (this.asset.refs ?? 1) - 1;
    this.id = id;
    this.asset = a;
    this.mat.uniforms.uFur.value = a.fur ?? 0;
    this.mat.uniforms.uEmKey.value = a.emKey ? 1 : 0;
    this.built = a.rigFactory();
    this.root = this.built.rig.root;
    const n = Math.max(1, this.built.bones.length);
    if (n !== this.tex.image.height) {
      this.tex.dispose();
      this.data = new Float32Array(4 * 4 * n);
      this.tex = boneTexture(this.data, n);
      this.mat.uniforms.uBoneTex.value = this.tex;
    }
    this.mesh.geometry = a.geometry;
  }

  setFlash(r: number, g: number, b: number, a: number) {
    this.mat.uniforms.uFlash.value.set(r, g, b, a);
  }

  setAlpha(a: number) {
    this.mat.uniforms.uAlpha.value = a * (this.asset.alpha ?? 1);
  }

  /** name 동작의 p(0~1 또는 그 이상) 지점 자세 */
  poseAt(name: string, p: number) {
    const an = this.asset.anims[name] ?? this.asset.anims.idle;
    const poses = an.poses;
    const n = poses.length;
    const f = an.loop ? ((p % 1) + 1) % 1 : Math.min(p, 0.9999);
    const x = f * (an.loop ? n : n - 1);
    const i = Math.floor(x);
    const t = x - i;
    const a = poses[i % n];
    const b = poses[(i + 1) % n];
    return an.loop || i + 1 < n ? lerpPose(a, b, t) : a;
  }

  /**
   * 한 프레임 갱신.
   * x, y, z: 월드 위치 / heading: 몸이 볼 방향(라디안, 0 = +v) / dt: 경과
   */
  update(dt: number, name: string, p: number, x: number, y: number, z: number, heading: number, scale: number) {
    this.time += dt;
    // 방향은 부드럽게 돈다
    let d = heading - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * 16);
    if (dt === 0) this.heading = heading;

    const dtv = Math.max(dt, 1e-3);
    const nvx = (x - this.px) / dtv;
    const nvz = (z - this.pz) / dtv;
    this.px = x;
    this.pz = z;
    const k = Math.min(1, dt * 12);
    this.vx += (Math.min(8, Math.max(-8, nvx)) - this.vx) * k;
    this.vz += (Math.min(8, Math.max(-8, nvz)) - this.vz) * k;

    const raw = this.poseAt(name, p);
    const pose = this.asset.retarget ? retarget(raw) : raw;
    const b = this.built;
    if (b.rig.play) b.rig.play(name, p);
    else b.rig.apply(pose);
    b.strings?.update(pose);
    const root = this.root;
    root.position.set(x, y, z);
    root.rotation.set(0, this.heading, 0);
    root.scale.setScalar(scale * this.asset.baseScale);
    this.scale = scale;

    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    // 몸 기준 속도. +z가 앞, +x가 왼쪽
    const vf = this.vx * s + this.vz * c;
    const vl = this.vx * c - this.vz * s;
    this.cloth(dt, b.panels, b.chains, vf, vl, pose);

    root.updateMatrixWorld(true);
    this.writeBones();
  }

  private cloth(dt: number, panels: Panel[], chains: Chain[], vf: number, vl: number, pose: Record<string, number>) {
    const step = Math.min(dt, 1 / 30);
    const rig = this.built.rig;
    if (panels.length && rig.thighL) {
      const hx = rig.hips.position.x;
      const hz = rig.hips.position.z;
      const fL = rig.shinL.position;
      const fR = rig.shinR.position;
      const tL = rig.thighL.position;
      const tR = rig.thighR.position;
      const hipRot = (pose.hry ?? 0) * D2R;
      for (const q of panels) {
        const az = q.a + hipRot;
        const sa = Math.sin(az);
        const ca = Math.cos(az);
        // 무릎이 자락을 밀어낸다
        const push = (kx: number, kz: number, ox: number, side: number) => {
          const dx = kx - ox;
          const dz = kz;
          const out = dx * sa + dz * ca;
          const near = Math.max(0, Math.min(1, (sa * side + 0.75) / 1.1));
          return out * near;
        };
        const pushL = push(fL.x - hx, fL.z - hz, tL.x - hx, 1);
        const pushR = push(fR.x - hx, fR.z - hz, tR.x - hx, -1);
        const legOut = Math.max(pushL, pushR, 0) * 1.1;
        const drag = -(vl * sa + vf * ca) * 0.085;
        const breeze = Math.sin(this.time * 1.7 + q.a * 2 + this.sway) * 0.022;
        const target = Math.max(q.flare * 0.5, q.flare + legOut + drag + breeze);
        const acc = (target - q.ang) * 170 - q.vel * 19;
        q.vel += acc * step;
        q.ang += q.vel * step;
        q.ang = Math.max(-0.12, Math.min(0.72, q.ang));
        const tgt2 = -q.ang * 0.34 + q.vel * 0.05 + drag * 0.5;
        const acc2 = (tgt2 - q.ang2) * 120 - q.vel2 * 13;
        q.vel2 += acc2 * step;
        q.ang2 += q.vel2 * step;
        q.top.rotation.x = -q.ang;
        q.low.rotation.x = -q.ang2;
      }
    }
    for (const ch of chains) {
      const gust = Math.sin(this.time * 2.3 + this.sway) * 0.05;
      for (let i = 0; i < ch.nodes.length; i++) {
        const prev = i === 0 ? 0 : ch.ang[i - 1];
        const target = ch.rest + -vf * 0.13 + gust * (i + 1) + (i === 0 ? 0 : prev * -0.12);
        const acc = (target - ch.ang[i]) * ch.stiff * (1 + i * 0.25) - ch.vel[i] * (5 + ch.stiff * 0.18);
        ch.vel[i] += acc * step;
        ch.ang[i] += ch.vel[i] * step;
        ch.ang[i] = Math.max(-1.1, Math.min(1.5, ch.ang[i]));
        // 뒤로 들리는 쪽이 +
        ch.nodes[i].rotation.x = -ch.ang[i] * (i === 0 ? 1 : 0.55);
        ch.nodes[i].rotation.z = Math.sin(this.time * 1.9 + i + this.sway) * 0.03 - vl * 0.03;
      }
    }
  }

  private writeBones() {
    const { bones } = this.built;
    const d = this.data;
    for (let i = 0; i < bones.length; i++) {
      const o = bones[i];
      let hide = false;
      for (let q: THREE.Object3D | null = o; q; q = q.parent) {
        if (!q.visible) {
          hide = true;
          break;
        }
      }
      if (hide && !this.built.bindInv) tmpM.makeScale(0, 0, 0).setPosition(this.root.position);
      else if (this.built.bindInv) tmpM.multiplyMatrices(o.matrixWorld, this.built.bindInv[i]);
      else tmpM.copy(o.matrixWorld);
      d.set(tmpM.elements, i * 16);
    }
    this.tex.needsUpdate = true;
  }

  dispose() {
    this.asset.refs = (this.asset.refs ?? 1) - 1;
    this.mesh.parent?.remove(this.mesh);
    this.mat.dispose();
    this.tex.dispose();
  }
}
