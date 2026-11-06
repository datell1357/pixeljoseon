// 게임 중 화면: 상태 막대, 스킬 칸, 미니맵, 채팅, 알림
import { useEffect, useRef, useState } from 'preact/hooks';
import { CLASSES, SKILLS, SKILL_KEYS } from '@shared/classes';
import { CONSUMABLES } from '@shared/items';
import { QUEST_BY_ID, questComplete, questProgress } from '@shared/quests';
import type { MapData } from '@shared/mapdata';
import { sfx } from '../audio';
import { worldScene } from '../game/boot';
import { input } from '../game/world';
import { send } from '../net';
import {
  bigText,
  boss,
  buffs,
  chatLines,
  chatOpen,
  cooldowns,
  floor,
  isTouch,
  lootFeed,
  mapData,
  me,
  panels,
  party,
  partyAsk,
  prompt,
  toasts,
  togglePanel,
  vitals,
  type PanelId,
} from '../store';
import { Bar, Icon, Tooltip } from './common';
import { Panels } from './panels';

const RARITY_TEXT = ['#d7d3c8', '#7ee08a', '#6fb7ff', '#c79bff'];

function Vitals() {
  const m = me.value;
  const v = vitals.value;
  if (!m) return null;
  return (
    <div class="vitals">
      <div class="vname">
        <b class="lv">{m.level}</b>
        <span>{m.name}</span>
        <small>{CLASSES[m.cls].label}</small>
      </div>
      <Bar cls="hp" value={v.hp} max={v.maxHp} label={`${v.hp} / ${v.maxHp}${v.shield > 0 ? ` +${v.shield}` : ''}`} />
      <Bar cls="mp" value={v.mp} max={v.maxMp} label={`${v.mp} / ${v.maxMp}`} />
      <Buffs />
    </div>
  );
}

function Buffs() {
  const list = buffs.value;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!list.length) return;
    const t = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [list.length]);
  if (!list.length) return null;
  const now = performance.now();
  return (
    <div class="buffs">
      {list.map((b) => (
        <div class="buff" key={b.id} title={SKILLS[b.id]?.name}>
          <Icon id={b.id} kind="skills" size={24} />
          <span>{Math.max(0, Math.ceil((b.end - now) / 1000))}</span>
        </div>
      ))}
    </div>
  );
}

function PartyFrames() {
  const p = party.value;
  const m = me.value;
  if (!p || !m) return null;
  return (
    <div class="partyframes">
      {p.members
        .filter((x) => x.name !== m.name)
        .map((x) => (
          <div class={`pmember ${x.on ? '' : 'off'}`} key={x.id}>
            <div class="pname">
              <b>{x.level || '-'}</b>
              <span>{x.name || '접속 끊김'}</span>
              {x.leader ? <i title="파티장">★</i> : null}
            </div>
            <Bar cls="hp thin" value={x.hp} max={1} />
          </div>
        ))}
    </div>
  );
}

function BossBar() {
  const b = boss.value;
  if (!b) return null;
  return (
    <div class="bossbar" role="status">
      <div class="bosshead">
        <b>{b.name}</b>
        <span>{Math.ceil((b.hp / b.maxHp) * 100)}%</span>
      </div>
      <Bar cls="boss" value={b.hp} max={b.maxHp} />
    </div>
  );
}

function FloorInfo() {
  const f = floor.value;
  if (!f) return null;
  return (
    <div class="floorinfo">
      <b>{f.n}층</b>
      <span>{f.remain > 0 ? `남은 적 ${f.remain}` : '정리 완료'}</span>
    </div>
  );
}

function CdOverlay({ id }: { id: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const txt = useRef<HTMLElement>(null);
  const c = cooldowns.value[id];
  useEffect(() => {
    if (!c) return;
    let raf = 0;
    const draw = () => {
      const left = (c.end - performance.now()) / 1000;
      const el = ref.current;
      if (el) el.style.height = `${Math.max(0, left / c.total) * 100}%`;
      if (txt.current) txt.current.textContent = left > 0 ? (left >= 1 ? String(Math.ceil(left)) : left.toFixed(1)) : '';
      if (left > 0) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [c]);
  return (
    <>
      <span class="cdfill" ref={ref} />
      <b class="cdtext" ref={txt} />
    </>
  );
}

function SkillBtn({ id, keyLabel, onPress, name, desc, locked, cost, icon }: { id: string; keyLabel: string; onPress: () => void; name: string; desc?: string; locked?: boolean; cost?: number; icon: string }) {
  const v = vitals.value;
  const lack = cost !== undefined && v.mp < cost;
  return (
    <button
      type="button"
      class={`skill ${locked ? 'locked' : ''} ${lack ? 'nomana' : ''}`}
      title={desc ? `${name} · ${desc}` : name}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
    >
      <Icon id={icon} kind="skills" size={32} />
      <CdOverlay id={id} />
      <kbd>{keyLabel}</kbd>
    </button>
  );
}

function QuickSlot({ i }: { i: number }) {
  const m = me.value;
  const id = m?.quick[i];
  const d = id ? CONSUMABLES[id] : null;
  const count = id && m ? m.bag.reduce((n, it) => n + (it?.kind === 'stack' && it.id === id ? it.n : 0), 0) : 0;
  const cdKey = d?.home ? 'home' : d?.hp ? 'potHp' : 'potMp';
  return (
    <button
      type="button"
      class={`skill quick ${d && !count ? 'locked' : ''}`}
      title={d?.name ?? '빈 칸 · 가방에서 물약을 우클릭하세요'}
      onPointerDown={(e) => {
        e.preventDefault();
        send('quick', { i });
      }}
    >
      {d ? <Icon id={d.icon} size={32} /> : null}
      {d ? <CdOverlay id={cdKey} /> : null}
      {d ? <span class="count">{count}</span> : null}
      <kbd>{i + 1}</kbd>
    </button>
  );
}

function ActionBar() {
  const m = me.value;
  if (!m) return null;
  const c = CLASSES[m.cls];
  const world = () => worldScene();
  return (
    <div class="actionbar">
      <div class="abgroup">
        {[0, 1, 2, 3].map((i) => (
          <QuickSlot i={i} key={i} />
        ))}
      </div>
      <div class="abgroup">
        <SkillBtn id="dodge" keyLabel="Space" icon={c.dodge.icon} name={c.dodge.label} desc="잠깐 무적이 되어 피합니다" onPress={() => world()?.tryDodge()} />
        <SkillBtn id="guard" keyLabel="우클릭" icon={c.guard.icon} name={c.guard.label} desc="막 시작할 때 맞으면 패링: 피해 없음, 다음 공격 2배" onPress={() => {}} />
      </div>
      <div class="abgroup">
        {c.skills.map((id, i) => {
          const s = SKILLS[id];
          const rank = m.skills[id] ?? 0;
          return (
            <SkillBtn
              key={id}
              id={id}
              keyLabel={SKILL_KEYS[i]}
              icon={id}
              name={`${s.name}${rank ? ` ${rank}단계` : ''}`}
              desc={s.desc}
              locked={rank <= 0}
              cost={s.mp}
              onPress={() => world()?.tryCast(id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ExpBar() {
  const m = me.value;
  if (!m) return null;
  const pct = m.expNext > 0 ? (m.exp / m.expNext) * 100 : 0;
  return (
    <div class="expbar" title={`경험치 ${m.exp} / ${m.expNext}`}>
      <i style={{ width: `${pct}%` }} />
      <span>{pct.toFixed(1)}%</span>
    </div>
  );
}

const MENU: { id: PanelId; label: string; key: string }[] = [
  { id: 'bag', label: '가방', key: 'I' },
  { id: 'equip', label: '장비', key: 'C' },
  { id: 'skills', label: '스킬', key: 'K' },
  { id: 'quests', label: '퀘스트', key: 'L' },
  { id: 'map', label: '지도', key: 'M' },
  { id: 'party', label: '파티', key: 'P' },
  { id: 'settings', label: '설정', key: 'Esc' },
];

function Menu() {
  const m = me.value;
  return (
    <nav class="menu" aria-label="메뉴">
      {MENU.map((x) => (
        <button
          type="button"
          key={x.id}
          class={`menubtn ${panels.value[x.id] ? 'on' : ''}`}
          onClick={() => {
            sfx('click');
            togglePanel(x.id);
          }}
        >
          {x.label}
          <kbd>{x.key}</kbd>
          {x.id === 'skills' && (m?.points ?? 0) > 0 ? <i class="dotnew" /> : null}
        </button>
      ))}
    </nav>
  );
}

function QuestTracker() {
  const m = me.value;
  if (!m) return null;
  const ids = Object.keys(m.quests.active);
  if (!ids.length) {
    if (m.quests.done.length === 0) {
      return (
        <div class="tracker">
          <div class="tq">
            <b>시작하기</b>
            <span>담우 어른과 대화해 첫 임무를 받으세요</span>
          </div>
        </div>
      );
    }
    return null;
  }
  return (
    <div class="tracker">
      {ids.slice(0, 4).map((id) => {
        const q = QUEST_BY_ID[id];
        if (!q) return null;
        const { cur, need } = questProgress(m, q);
        const done = questComplete(m, q);
        return (
          <div class={`tq ${done ? 'done' : ''}`} key={id}>
            <b>{q.title}</b>
            <span>{done ? '완료 · 돌아가서 보고하세요' : `${q.goal.label} ${cur}/${need}`}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 미니맵 ─────────────────────────────────

const MINI = 2;

export function bakeMini(map: MapData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.w * MINI + 4;
  c.height = map.h * MINI + 4;
  const g = c.getContext('2d')!;
  const colors: Record<string, string> = {
    meadow: '#567a48',
    paddy: '#b49a3e',
    yard: '#b8a784',
    dirt: '#7a6648',
    cobble: '#7c7a78',
    water: '#3a6a9a',
    forest: '#2f4a33',
    ash: '#4d4440',
    scorch: '#3a2a26',
    stone: '#6a6668',
    lava: '#c0562a',
  };
  const solid = map.solid.rows;
  for (let v = 0; v < map.h; v++) {
    for (let u = 0; u < map.w; u++) {
      let col = map.color;
      for (const l of map.layers) {
        if (map.corners[l]?.[v]?.[u] === '1' && colors[l]) col = colors[l];
      }
      const blockedCell = solid[v * 2]?.[u * 2] === '1' && solid[v * 2 + 1]?.[u * 2 + 1] === '1';
      if (blockedCell) col = shade(col);
      g.fillStyle = col;
      g.fillRect(u * MINI + 2, v * MINI + 2, MINI, MINI);
    }
  }
  return c;
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * 0.45;
  const gg = ((n >> 8) & 255) * 0.45;
  const b = (n & 255) * 0.45;
  return `rgb(${r | 0},${gg | 0},${b | 0})`;
}

export function miniProject(map: MapData, u: number, v: number): [number, number] {
  void map;
  return [u * MINI + 2, v * MINI + 2];
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const map = mapData.value;
  useEffect(() => {
    if (!map) return;
    const base = bakeMini(map);
    const cv = ref.current!;
    const W = cv.width;
    const H = cv.height;
    const g = cv.getContext('2d')!;
    const draw = () => {
      const w = worldScene();
      g.fillStyle = '#0b0a12';
      g.fillRect(0, 0, W, H);
      if (!w) return;
      const [px, py] = miniProject(map, w.me.u, w.me.v);
      g.drawImage(base, W / 2 - px, H / 2 - py);
      for (const d of w.dots()) {
        const [x, y] = miniProject(map, d.u, d.v);
        g.fillStyle = d.c;
        const sx = x - px + W / 2;
        const sy = y - py + H / 2;
        g.fillRect(Math.round(sx - d.r / 2), Math.round(sy - d.r / 2), d.r, d.r);
      }
    };
    draw();
    const t = setInterval(draw, 200);
    return () => clearInterval(t);
  }, [map]);
  return (
    <div class="minimap">
      <div class="maptitle">{map?.title}</div>
      <canvas ref={ref} width={176} height={112} onClick={() => togglePanel('map')} />
    </div>
  );
}

// ─── 채팅 ─────────────────────────────────

function Chat() {
  const [text, setText] = useState('');
  const [ch, setCh] = useState<'all' | 'party'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const open = chatOpen.value;
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatLines.value.length]);
  const submit = (e: Event) => {
    e.preventDefault();
    const t = text.trim();
    if (t) send('chat', { text: t, ch });
    setText('');
    chatOpen.value = false;
    inputRef.current?.blur();
  };
  return (
    <div class={`chat ${open ? 'open' : ''}`}>
      <div class="chatlog" ref={logRef} aria-live="polite">
        {chatLines.value.slice(-40).map((l) => (
          <p key={l.id} class={`c-${l.ch}`}>
            {l.from ? <b>{l.from}</b> : null}
            {l.text}
          </p>
        ))}
      </div>
      {open ? (
        <form class="chatform" onSubmit={submit}>
          <button type="button" class="chtab" onClick={() => setCh(ch === 'all' ? 'party' : 'all')}>
            {ch === 'all' ? '전체' : '파티'}
          </button>
          <input
            ref={inputRef}
            value={text}
            maxLength={120}
            aria-label="채팅 입력"
            onInput={(e) => setText(e.currentTarget.value)}
            onBlur={() => {
              setTimeout(() => (chatOpen.value = false), 80);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                chatOpen.value = false;
              }
            }}
          />
        </form>
      ) : (
        <button type="button" class="chathint" onClick={() => (chatOpen.value = true)}>
          Enter 채팅
        </button>
      )}
    </div>
  );
}

function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div class={`toast ${t.kind}`} key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function LootFeed() {
  return (
    <div class="lootfeed">
      {lootFeed.value.map((l) => (
        <div class="lootline" key={l.id} style={{ color: RARITY_TEXT[l.rarity] }}>
          {l.label}
        </div>
      ))}
    </div>
  );
}

function BigText() {
  const b = bigText.value;
  if (!b) return null;
  return (
    <div class="bigtext" key={b.id}>
      <h2>{b.title}</h2>
      {b.sub ? <p>{b.sub}</p> : null}
    </div>
  );
}

function Prompt() {
  const p = prompt.value;
  if (!p) return null;
  return (
    <button type="button" class="promptbox" onClick={() => worldScene()?.interact()}>
      <kbd>{p.key}</kbd>
      {p.label}
    </button>
  );
}

function PartyAsk() {
  const from = partyAsk.value;
  if (!from) return null;
  const answer = (yes: boolean) => {
    send('partyAnswer', { yes });
    partyAsk.value = null;
  };
  return (
    <div class="panel partyask" role="alertdialog">
      <p>
        <b>{from}</b>님이 파티에 초대했어요
      </p>
      <div class="row">
        <button type="button" class="btn" onClick={() => answer(false)}>
          거절
        </button>
        <button type="button" class="btn gold" onClick={() => answer(true)}>
          함께하기
        </button>
      </div>
    </div>
  );
}

function DeathScreen() {
  if (!vitals.value.dead) return null;
  return (
    <div class="deathscreen" role="alertdialog">
      <h2>쓰러졌어요</h2>
      <button type="button" class="btn gold big" onClick={() => send('respawn')}>
        일어나기
      </button>
    </div>
  );
}

function InstanceLeave() {
  const map = mapData.value;
  if (!map?.instance) return null;
  return (
    <button type="button" class="leavebtn" onClick={() => send('leaveInstance')}>
      던전 나가기
    </button>
  );
}

// ─── 터치 조작 ─────────────────────────────

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  useEffect(() => {
    input.usedTouch = true;
    return () => {
      input.moveX = 0;
      input.moveY = 0;
    };
  }, []);
  const move = (e: PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy);
    const max = r.width / 2;
    const k = l > max ? max / l : 1;
    input.moveX = l > 8 ? (dx * k) / max : 0;
    input.moveY = l > 8 ? (dy * k) / max : 0;
    if (knob.current) knob.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  return (
    <div
      class="joystick"
      ref={base}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType === 'touch') move(e);
      }}
      onPointerUp={() => {
        input.moveX = 0;
        input.moveY = 0;
        if (knob.current) knob.current.style.transform = '';
      }}
      onPointerCancel={() => {
        input.moveX = 0;
        input.moveY = 0;
        if (knob.current) knob.current.style.transform = '';
      }}
    >
      <div class="knob" ref={knob} />
    </div>
  );
}

function TouchButtons() {
  return (
    <button
      type="button"
      class="touchattack"
      onPointerDown={(e) => {
        e.preventDefault();
        input.attack = true;
      }}
      onPointerUp={() => (input.attack = false)}
      onPointerCancel={() => (input.attack = false)}
    >
      공격
    </button>
  );
}

export function Hud() {
  return (
    <div class={`hud ${isTouch.value ? 'touch' : ''}`}>
      <div id="hurt" />
      <div class="vignette" />
      <div class="hudtl">
        <Vitals />
        <InstanceLeave />
        <PartyFrames />
      </div>
      <div class="hudtc">
        <BossBar />
        <FloorInfo />
        <Toasts />
      </div>
      <div class="hudtr">
        <Minimap />
        <QuestTracker />
        <LootFeed />
      </div>
      <div class="hudbl">
        <Chat />
      </div>
      <div class="hudbc">
        <Prompt />
        <ActionBar />
      </div>
      <div class="hudbr">
        <Menu />
      </div>
      <ExpBar />
      <BigText />
      <PartyAsk />
      <DeathScreen />
      {isTouch.value ? (
        <>
          <Joystick />
          <TouchButtons />
        </>
      ) : null}
      <Panels />
      <Tooltip />
    </div>
  );
}
