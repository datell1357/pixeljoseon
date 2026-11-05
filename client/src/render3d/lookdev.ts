// 그림 점검용 페이지. 게임 없이 지도와 모델만 띄운다. 배포에 들어가지 않는다.
import type { MapData } from '@shared/mapdata';
import { PX_U, PX_V } from '@shared/core';
import { ActorView } from './actor3d';
import { Stage3D } from './stage';

const parent = document.getElementById('game')!;
const stage = new Stage3D(parent);

const api = {
  stage,
  errors: [] as string[],
  async load(name: string) {
    const m = (await (await fetch(`/maps/${name}.json`)).json()) as MapData;
    stage.loadMap(m);
    return { w: m.w, h: m.h };
  },
  actors: [] as { v: ActorView; anim: string; u: number; w: number; dir: number; p: number; s: number; dur: number }[],
  /** 인물 세우기: [id, u, v, 방향(도), 동작, 진행도, 크기] */
  cast(list: [string, number, number, number, string?, number?, number?][]) {
    for (const a of api.actors) a.v.dispose();
    api.actors = list.map(([id, u, v, deg, anim, p, s]) => ({ v: new ActorView(id, stage.actors), anim: anim ?? 'idle', u, w: v, dir: (deg * Math.PI) / 180, p: p ?? 0, s: s ?? 1, dur: 1 }));
    api.tick(0);
  },
  tick(dt: number) {
    for (const a of api.actors) {
      const an = a.v.asset.anims[a.anim] ?? a.v.asset.anims.idle;
      a.p += dt / an.dur;
      a.v.update(dt, a.anim, a.p, a.u, stage.terrain?.heightAt(a.u, a.w) ?? 0, a.w, a.dir, a.s);
    }
  },
  size(w: number, h: number, k: number) {
    stage.setSize(w, h, k);
  },
  shot(u: number, v: number, t: number) {
    stage.time = t;
    stage.setView(Math.round(u * PX_U), Math.round(v * PX_V));
    stage.render(0);
    stage.renderer.getContext().finish();
    return { ...stage.stats };
  },
  bench(u: number, v: number, n: number) {
    stage.setView(Math.round(u * PX_U), Math.round(v * PX_V));
    const gl = stage.renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      stage.setView(Math.round(u * PX_U) + i, Math.round(v * PX_V));
      stage.render(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return { ms: (performance.now() - t0) / n, ...stage.stats };
  },
};
(window as unknown as { LD: typeof api }).LD = api;
window.addEventListener('error', (e) => api.errors.push(String(e.message)));
