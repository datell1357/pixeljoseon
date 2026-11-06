// 에셋 상태 페이지: 몬스터·인물 모델을 게임과 같은 렌더러로 돌려 보고, 아이콘을 한눈에 본다. 배포에 들어가지 않는다.
import type { MapData } from '@shared/mapdata';
import { PX_H, PX_U, PX_V } from '@shared/core';
import { DESIGN_LEVEL, MONSTERS } from '@shared/monsters';
import { CONSUMABLES, GEAR, pcSheet } from '@shared/items';
import { CLASSES, SKILLS } from '@shared/classes';
import { ActorView, assetOf } from './actor3d';
import { FILES, preloadSkinned, skinnedStatus } from './skinned';
import { Stage3D } from './stage';

type Entry = { id: string; name: string; group: string; scale: number; mon?: (typeof MONSTERS)[string]; note?: string };

const SCRIPT: Record<string, string> = {
  yeou: 'canid.py', neukdae: 'canid.py', seungnyangi: 'canid.py', neoguri: 'canid.py', gumiho: 'canid.py',
  horangi: 'big.py', bandalgom: 'big.py', metdwaeji: 'big.py', bulgasari: 'big.py', daramjwi: 'small.py', bakjwi: 'small.py',
};
const AI_LABEL: Record<string, string> = { melee: '근접', charger: '돌진', swarm: '무리', boss: '보스', ranged: '원거리' };
const ANIM_LABEL: Record<string, string> = {
  idle: '서기', walk: '걷기', attack: '공격', hit: '맞기', death: '쓰러짐', sweep: '휘두르기', slam: '짓누르기', cast: '울부짖기',
  attack1: '공격 1', attack2: '공격 2', attack3: '공격 3', spin: '회전', dodge: '구르기', guard: '막기',
};
/** 사람은 cast가 술법을 부리는 동작이다 */
const animLabel = (k: string) => (k === 'cast' && state.tab === 'people' ? '시전' : ANIM_LABEL[k] ?? k);

const monsters: Entry[] = Object.values(MONSTERS)
  .sort((a, b) => (DESIGN_LEVEL[a.id] ?? 0) + (a.boss ? 100 : 0) - ((DESIGN_LEVEL[b.id] ?? 0) + (b.boss ? 100 : 0)))
  .map((m) => ({ id: m.sheet, name: m.name, group: m.boss ? '보스' : '일반 짐승', scale: m.scale ?? 1, mon: m }));
const TOP: Record<string, string> = {
  musa: 'sword_4.3.10,helm_3.3.10,armor_3.3.10,boots_3.3.10,ring_2.3.10,amulet_2.3.10',
  dosa: 'staff_4.3.10,helm_3.3.10,armor_3.3.10,boots_3.3.10,ring_2.3.10,amulet_2.3.10',
  gungsa: 'bow_4.3.10,helm_3.3.10,armor_3.3.10,boots_3.3.10,ring_2.3.10,amulet_2.3.10',
};
const people: Entry[] = [
  ...Object.values(CLASSES).flatMap((c) => [
    { id: pcSheet(c.id, 0), name: `${c.label} · 처음 옷차림`, group: '플레이어', scale: 1 },
    { id: pcSheet(c.id, 0, TOP[c.id]), name: `${c.label} · 최고 장비 +10`, group: '플레이어', scale: 1 },
  ]),
  ...[['npc_elder', '담우 (마을 어른)'], ['npc_merchant', '보따 (보부상)'], ['npc_smith', '철구 (대장장이)'], ['npc_guard', '하진 (포교)'], ['npc_keeper', '유림 (곳간지기)']].map(([id, name]) => ({ id, name, group: 'NPC', scale: 1 })),
];

const $ = (id: string) => document.getElementById(id)!;
const el = (tag: string, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const stageBox = $('stage');
const stage = new Stage3D(stageBox);
let mapReady = false;
const SPOT = { u: 23, v: 35.4 };

const state = { tab: 'mon', entry: monsters[0], anim: 'idle', zoom: 0, compare: false, speed: 1, heading: 60, p: 0 };
let views: { v: ActorView; id: string; u: number; scale: number }[] = [];
const sizes = new Map<string, number>();

function status(e: Entry): { cls: string; text: string } {
  if (e.group === '플레이어' || e.group === 'NPC') return { cls: 'warn', text: '코드 모델' };
  const s = skinnedStatus(e.id);
  if (s === 'ok') return { cls: 'ok', text: '블렌더' };
  if (s === 'failed') return { cls: 'bad', text: '불러오기 실패' };
  return { cls: 'warn', text: '코드 모델' };
}

function buildTabs() {
  const tabs = $('tabs');
  tabs.innerHTML = '';
  for (const [k, label] of [['mon', '몬스터·보스'], ['people', '인물'], ['icons', '아이콘']]) {
    const b = el('button', state.tab === k ? 'on' : '', label);
    b.onclick = () => {
      state.tab = k;
      if (k === 'mon') state.entry = monsters[0];
      if (k === 'people') state.entry = people[0];
      state.anim = 'idle';
      render();
    };
    tabs.append(b);
  }
  const ok = monsters.filter((m) => skinnedStatus(m.id) === 'ok').length;
  const bad = monsters.filter((m) => skinnedStatus(m.id) === 'failed').length;
  $('summary').innerHTML = `<span>몬스터 <b>${monsters.length}</b>종</span><span>블렌더 <b>${ok}</b></span><span>코드 <b>${monsters.length - ok - bad}</b></span>${bad ? `<span style="color:var(--bad)">실패 <b>${bad}</b></span>` : ''}`;
}

function buildList(list: Entry[]) {
  const box = $('list');
  box.innerHTML = '';
  let group = '';
  for (const e of list) {
    if (e.group !== group) {
      group = e.group;
      box.append(el('h2', '', group));
    }
    const row = el('div', 'item' + (e === state.entry ? ' on' : ''));
    row.append(el('span', 'nm', e.name));
    const st = status(e);
    row.append(el('span', `badge ${st.cls}`, st.text));
    row.onclick = () => {
      state.entry = e;
      state.anim = 'idle';
      render();
    };
    box.append(row);
  }
}

function seg(label: string, opts: [string, string][], cur: string, set: (v: string) => void) {
  const wrap = el('div');
  wrap.append(el('label', '', label));
  const s = el('div', 'seg');
  for (const [v, t] of opts) {
    const b = el('button', v === cur ? 'on' : '', t);
    b.onclick = () => {
      set(v);
      render();
    };
    s.append(b);
  }
  wrap.append(s);
  return wrap;
}

function buildControls() {
  const c = $('controls');
  c.innerHTML = '';
  const a = assetOf(state.entry.id);
  const anims = a ? Object.keys(a.anims) : ['idle'];
  c.append(seg('동작', anims.map((k) => [k, animLabel(k)]), state.anim, (v) => { state.anim = v; state.p = 0; }));
  c.append(seg('확대', [['0', '화면에 맞춤'], ['2', '게임 배율'], ['4', '2배'], ['6', '3배']], String(state.zoom), (v) => { state.zoom = Number(v); resize(); }));
  c.append(seg('속도', [['1', '보통'], ['0.4', '느리게']], String(state.speed), (v) => { state.speed = Number(v); }));
  if (state.tab === 'mon') c.append(seg('비교', [['0', '새 모델만'], ['1', '예전 모델과 나란히']], state.compare ? '1' : '0', (v) => { state.compare = v === '1'; }));
}

async function fileSize(id: string) {
  if (sizes.has(id) || !FILES[id]) return;
  try {
    const r = await fetch(FILES[id], { method: 'HEAD' });
    sizes.set(id, Number(r.headers.get('content-length') ?? 0));
    if (state.entry.id === id) buildInfo();
  } catch {
    /* 크기를 못 읽으면 비워 둔다 */
  }
}

function tris(id: string) {
  const a = assetOf(id);
  if (!a) return 0;
  const g = a.geometry;
  return Math.round((g.index ? g.index.count : g.getAttribute('position').count) / 3);
}

function buildInfo() {
  const box = $('info');
  const e = state.entry;
  const a = assetOf(e.id);
  box.innerHTML = '';
  box.append(el('h3', '', e.name));
  const st = status(e);
  const sub = el('div', 'sub');
  sub.append(el('span', `badge ${st.cls}`, st.text));
  box.append(sub);
  const table = (rows: [string, string][]) => {
    const t = el('table');
    for (const [k, v] of rows) {
      const tr = el('tr');
      tr.append(el('td', '', k), el('td', '', v));
      t.append(tr);
    }
    return t;
  };
  if (e.mon) {
    const m = e.mon;
    box.append(el('h4', '', '게임 정보'));
    box.append(table([
      ['모델 이름', e.id], ['내부 id', m.id], ['기준 레벨', String(DESIGN_LEVEL[m.id] ?? '-')], ['행동', AI_LABEL[m.ai] ?? m.ai],
      ['체력 / 공격', `${m.hp} / ${m.dmg}`], ['방어 / 속도', `${m.def} / ${m.speed}`], ['화면 배율', String(m.scale ?? 1)],
      ['특징', [m.boss ? '보스' : '', m.flying ? '비행' : '', m.poise ? '경직 없음' : ''].filter(Boolean).join(', ') || '-'],
    ]));
  }
  if (a) {
    box.append(el('h4', '', '모델'));
    const sz = sizes.get(e.id);
    box.append(table([
      ['출처', a.skinned ? `블렌더 glb (tools/blender/${SCRIPT[e.id] ?? ''})` : '코드로 지은 모델'],
      ['파일', a.skinned ? `${FILES[e.id]}${sz ? ` · ${(sz / 1024).toFixed(0)}KB` : ''}` : '-'],
      ['삼각형', tris(e.id).toLocaleString()], ['뼈', String(a.boneOrder.length)], ['높이', `${(a.height * a.baseScale * e.scale).toFixed(2)}`],
      ['텍스처', a.map ? `${(a.map.image as { width: number }).width}px` : '정점 색'],
    ]));
    box.append(el('h4', '', '동작'));
    box.append(table(Object.entries(a.anims).map(([k, v]) => [animLabel(k), `${v.dur.toFixed(2)}초${v.loop ? ' · 반복' : ''}`])));
  } else {
    box.append(el('div', 'sub', '모델을 만들지 못했습니다.'));
  }
  void fileSize(e.id);
}

function placeActors() {
  for (const a of views) a.v.dispose();
  views = [];
  const e = state.entry;
  const ids = state.compare && state.tab === 'mon' ? [`${e.id}@old`, e.id] : [e.id];
  const a = assetOf(e.id);
  const span = a ? Math.max(1.2, a.height * a.baseScale * e.scale * 1.6) : 1.5;
  ids.forEach((id, i) => {
    try {
      const v = new ActorView(id, stage.actors);
      views.push({ v, id, u: SPOT.u + (i - (ids.length - 1) / 2) * span, scale: e.scale });
    } catch (err) {
      console.warn('모델을 띄우지 못함', id, err);
    }
  });
}

/** 화면에 맞춤: 모델(비교면 둘)이 들어가는 가장 큰 정수 배율 */
function fitZoom() {
  const e = state.entry;
  const a = assetOf(e.id);
  if (!a) return 2;
  const h = a.height * a.baseScale * e.scale;
  const needH = h * PX_H * 1.5;
  const needW = h * PX_U * (state.compare && state.tab === 'mon' ? 4.6 : 3.0);
  return Math.max(1, Math.min(8, Math.floor(Math.min(stageBox.clientHeight / needH, stageBox.clientWidth / needW))));
}

function resize() {
  const k = state.zoom || fitZoom();
  const w = Math.max(64, Math.floor(stageBox.clientWidth / k));
  const h = Math.max(64, Math.floor(stageBox.clientHeight / k));
  stage.setSize(w, h, k);
}

function buildIcons() {
  const grid = $('grid');
  grid.innerHTML = '';
  const names: Record<string, string> = {};
  for (const g of Object.values(GEAR)) names[g.icon] = g.name;
  for (const c of Object.values(CONSUMABLES)) names[c.icon] = c.name;
  for (const s of Object.values(SKILLS)) names[s.id] = s.name;
  const sheets: [string, string, string][] = [['items', '아이템', 'ok'], ['skills', '스킬', 'ok']];
  for (const [file, label, cls] of sheets) {
    grid.append(Object.assign(el('h2', '', `${label} 아이콘`), { style: 'grid-column:1/-1;margin:8px 0 0;font-size:14px;color:var(--dim)' }));
    void (async () => {
      const meta = (await (await fetch(`/art/icons/${file}.json`)).json()) as { cell: number; cols: number; ids: string[] };
      const img = new Image();
      img.src = `/art/icons/${file}.png`;
      await img.decode();
      const anchor = [...grid.querySelectorAll('h2')].find((h) => h.textContent === `${label} 아이콘`)!;
      let after: Element = anchor;
      meta.ids.forEach((id, i) => {
        const card = el('div', 'card');
        const cv = document.createElement('canvas');
        cv.width = cv.height = meta.cell;
        const cx = cv.getContext('2d')!;
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, (i % meta.cols) * meta.cell, Math.floor(i / meta.cols) * meta.cell, meta.cell, meta.cell, 0, 0, meta.cell, meta.cell);
        card.append(cv, el('div', 'nm', names[id] ?? id), el('div', 'id', id), el('span', `badge ${cls}`, cls === 'ok' ? '조선식' : '교체 필요 (예전 그림)'));
        after.after(card);
        after = card;
      });
    })();
  }
}

function render() {
  buildTabs();
  const icons = state.tab === 'icons';
  $('viewer').classList.toggle('hidden', icons);
  $('info').classList.toggle('hidden', icons);
  $('list').classList.toggle('hidden', icons);
  $('grid').classList.toggle('hidden', !icons);
  if (icons) {
    buildIcons();
    return;
  }
  buildList(state.tab === 'mon' ? monsters : people);
  buildControls();
  buildInfo();
  placeActors();
  resize();
  state.p = 0;
}

// 끌어서 돌리기
let drag: number | null = null;
stageBox.addEventListener('pointerdown', (e) => {
  drag = e.clientX;
  stageBox.setPointerCapture(e.pointerId);
});
stageBox.addEventListener('pointermove', (e) => {
  if (drag === null) return;
  state.heading += (e.clientX - drag) * 0.6;
  drag = e.clientX;
});
stageBox.addEventListener('pointerup', () => (drag = null));
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mapReady && views.length) {
    const a = views[views.length - 1].v.asset;
    const an = a.anims[state.anim] ?? a.anims.idle;
    state.p += (dt * state.speed) / an.dur;
    // 한 번 하는 동작은 끝난 뒤 잠깐 멈췄다가 다시 한다
    if (!an.loop && state.p > 1.35) state.p = 0;
    for (const x of views) {
      const g = stage.terrain?.groundAt(x.u, SPOT.v) ?? 0;
      x.v.update(dt, state.anim, Math.min(state.p, an.loop ? state.p : 0.999), x.u, g, SPOT.v, (state.heading * Math.PI) / 180, x.scale);
    }
    const h = a.height * a.baseScale * state.entry.scale;
    stage.setView(Math.round(SPOT.u * PX_U), Math.round(SPOT.v * PX_V - (h * PX_H) / 2));
    stage.render(dt);
  }
  requestAnimationFrame(frame);
}

(async () => {
  await preloadSkinned();
  const m = (await (await fetch('/maps/woods.json')).json()) as MapData;
  stage.loadMap(m);
  mapReady = true;
  resize();
  render();
  requestAnimationFrame(frame);
})();
