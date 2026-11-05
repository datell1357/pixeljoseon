// 창: 가방, 장비, 스킬, 퀘스트, 지도, 파티, 설정, NPC (대화·상점·강화·창고)
import { useEffect, useRef, useState } from 'preact/hooks';
import { CLASSES, SKILLS, SKILL_KEYS, skillMult } from '@shared/classes';
import {
  CONSUMABLES,
  GEAR,
  MAX_PLUS,
  RARITY_COLOR,
  RIFT_STOCK,
  SHOP_STOCK,
  SLOTS,
  SLOT_LABEL,
  enhanceCost,
  itemName,
  salvageYield,
  type GearInstance,
  type Slot,
} from '@shared/items';
import { NPCS, QUESTS, QUEST_BY_ID, countInBag, questAvailable, questComplete, questProgress, type QuestDef } from '@shared/quests';
import { sfx } from '../audio';
import { applyScale, worldScene } from '../game/boot';
import { backToChars, send, register } from '../net';
import { isGuest, loginName, mapData, me, npcOpen, npcTab, panels, party, riftBoard, saveSettings, settings, toast, togglePanel, type Me, type PanelId } from '../store';
import { CharPreview, Icon, ItemSlot, Panel, hideTip } from './common';
import { bakeMini, miniProject } from './hud';

const close = (id: PanelId) => () => {
  hideTip();
  togglePanel(id);
};

// ─── 가방 ─────────────────────────────────

/** 가방 칸을 눌렀을 때: 열린 NPC 창에 따라 뜻이 달라진다 */
function bagClick(i: number, m: Me, select?: (i: number) => void) {
  const npc = npcOpen.value;
  const it = m.bag[i];
  if (!it) return;
  hideTip();
  if (npc && NPCS[npc]) {
    if (npcTab.value === 'shop') {
      send('sell', { i, npc });
      return;
    }
    if (npcTab.value === 'vault') {
      send('vaultPut', { i, npc });
      return;
    }
    if (npcTab.value === 'forge' && select) {
      select(i);
      return;
    }
  }
  send('useBag', { i });
  sfx('click');
}

function bagContext(i: number, m: Me) {
  const it = m.bag[i];
  if (!it || it.kind !== 'stack') return;
  const d = CONSUMABLES[it.id];
  if (!d || d.material) return;
  const taken = m.quick.indexOf(it.id);
  if (taken >= 0) {
    send('quickSet', { i: taken, id: null });
    return;
  }
  let slot = m.quick.indexOf(null);
  if (slot < 0) slot = d.hp ? 0 : d.mp ? 1 : 3;
  send('quickSet', { i: slot, id: it.id });
  toast(`${d.name}을(를) ${slot + 1}번 칸에 넣었어요`, 'info', 1400);
}

function bagHint(): string {
  const npc = npcOpen.value;
  if (npc && npcTab.value === 'shop') return '눌러서 판매';
  if (npc && npcTab.value === 'vault') return '눌러서 창고에 넣기';
  if (npc && npcTab.value === 'forge') return '눌러서 고르기';
  return '눌러서 사용 · 착용';
}

function BagGrid({ m, select, selected }: { m: Me; select?: (i: number) => void; selected?: number }) {
  return (
    <div class="baggrid">
      {m.bag.map((it, i) => (
        <ItemSlot key={i} item={it} selected={selected === i} hint={bagHint()} onClick={() => bagClick(i, m, select)} onContext={() => bagContext(i, m)} />
      ))}
    </div>
  );
}

function BagPanel() {
  const m = me.value;
  if (!m) return null;
  return (
    <Panel title="가방" onClose={close('bag')} class="bagwin">
      <BagGrid m={m} select={(i) => (forgeSelect.value = i)} selected={npcTab.value === 'forge' && npcOpen.value ? forgeSelect.value : undefined} />
      <footer class="bagfoot">
        <span class="gold">
          <Icon id="gold" size={24} />
          {m.gold.toLocaleString()}
        </span>
        <button type="button" class="btn small" onClick={() => send('bagSort')}>
          정리
        </button>
      </footer>
    </Panel>
  );
}

// ─── 장비 ─────────────────────────────────

const STAT_ROWS: [string, (m: Me) => string][] = [
  ['체력', (m) => String(m.stats.maxHp)],
  ['마나', (m) => String(m.stats.maxMp)],
  ['공격력', (m) => m.stats.atk.toFixed(0)],
  ['방어력', (m) => m.stats.def.toFixed(0)],
  ['치명타', (m) => `${(m.stats.crit * 100).toFixed(0)}%`],
  ['치명 피해', (m) => `${(m.stats.critDmg * 100).toFixed(0)}%`],
  ['공격 속도', (m) => `${(m.stats.aspd * 100).toFixed(0)}%`],
  ['이동 속도', (m) => m.stats.speed.toFixed(2)],
  ['재사용 감소', (m) => `${(m.stats.cdr * 100).toFixed(0)}%`],
];

function EquipPanel() {
  const m = me.value;
  if (!m) return null;
  return (
    <Panel title="장비" onClose={close('equip')} class="equipwin">
      <div class="equipgrid">
        {SLOTS.map((s) => {
          const g = m.equip[s];
          return (
            <div class="equipcell" key={s}>
              <ItemSlot
                item={g ? { kind: 'gear', gear: g } : null}
                ghost={SLOT_LABEL[s]}
                hint="눌러서 벗기"
                onClick={() => {
                  if (g) {
                    hideTip();
                    send('unequip', { slot: s });
                    sfx('equip');
                  }
                }}
                size={56}
              />
            </div>
          );
        })}
      </div>
      <dl class="statlist">
        {STAT_ROWS.map(([k, fn]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{fn(m)}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

// ─── 스킬 ─────────────────────────────────

function SkillsPanel() {
  const m = me.value;
  if (!m) return null;
  const c = CLASSES[m.cls];
  return (
    <Panel title={`스킬 · 남은 포인트 ${m.points}`} onClose={close('skills')} class="skillwin">
      <div class="skilllist">
        {c.skills.map((id, i) => {
          const s = SKILLS[id];
          const rank = m.skills[id] ?? 0;
          const locked = m.level < s.req;
          return (
            <div class={`skillrow ${locked ? 'locked' : ''}`} key={id}>
              <div class="sicon">
                <Icon id={id} kind="skills" size={40} />
                <kbd>{SKILL_KEYS[i]}</kbd>
              </div>
              <div class="sinfo">
                <b>
                  {s.name}
                  {s.ult ? <em>궁극기</em> : null}
                </b>
                <p>{s.desc}</p>
                <small>
                  {locked ? `${s.req}레벨부터` : `마나 ${s.mp} · 재사용 ${s.cd}초${s.mult ? ` · 위력 ${Math.round(skillMult(s, Math.max(1, rank)) * 100)}%` : ''}`}
                </small>
              </div>
              <div class="srank">
                <div class="pips">
                  {Array.from({ length: s.maxRank }, (_, n) => (
                    <i key={n} class={n < rank ? 'on' : ''} />
                  ))}
                </div>
                <button type="button" class="btn small gold" disabled={locked || rank >= s.maxRank || m.points <= 0} onClick={() => send('skillUp', { id })} aria-label={`${s.name} 올리기`}>
                  +
                </button>
              </div>
            </div>
          );
        })}
        <div class="skillrow basic">
          <div class="sicon">
            <Icon id={c.dodge.icon} kind="skills" size={40} />
            <kbd>Space</kbd>
          </div>
          <div class="sinfo">
            <b>{c.dodge.label}</b>
            <p>움직이는 동안 공격을 맞지 않아요. 재사용 {c.dodge.cd}초.</p>
          </div>
        </div>
        <div class="skillrow basic">
          <div class="sicon">
            <Icon id={c.guard.icon} kind="skills" size={40} />
            <kbd>우클릭</kbd>
          </div>
          <div class="sinfo">
            <b>{c.guard.label}</b>
            <p>막 들었을 때 맞으면 패링이에요. 피해 없이 적이 휘청이고, 다음 공격이 2배가 돼요.</p>
          </div>
        </div>
      </div>
      <footer class="bagfoot">
        <span class="muted">초기화 비용 {m.level * 20} 골드</span>
        <button type="button" class="btn small" onClick={() => send('skillReset', {})}>
          초기화
        </button>
      </footer>
    </Panel>
  );
}

// ─── 퀘스트 ─────────────────────────────────

function rewardText(q: QuestDef, m: Me) {
  const parts = [`경험치 ${q.rewards.exp.toLocaleString()}`, `${q.rewards.gold.toLocaleString()} 골드`];
  for (const [id, n] of q.rewards.items ?? []) parts.push(`${CONSUMABLES[id]?.name} ×${n}`);
  if (q.rewards.gear) parts.push(GEAR[q.rewards.gear.base[m.cls]]?.name ?? '장비');
  return parts.join(' · ');
}

function QuestsPanel() {
  const m = me.value;
  if (!m) return null;
  const active = Object.keys(m.quests.active).map((id) => QUEST_BY_ID[id]).filter(Boolean);
  const next = QUESTS.filter((q) => questAvailable(m, q));
  return (
    <Panel title="퀘스트" onClose={close('quests')} class="questwin">
      {active.length === 0 ? <p class="muted">진행 중인 퀘스트가 없어요.</p> : null}
      {active.map((q) => {
        const { cur, need } = questProgress(m, q);
        const done = questComplete(m, q);
        return (
          <article class={`questcard ${done ? 'done' : ''}`} key={q.id}>
            <header>
              <b>{q.title}</b>
              <span>{done ? '완료' : `${cur} / ${need}`}</span>
            </header>
            <p>{done ? `${NPCS[q.giver]?.name}에게 돌아가세요.` : `${q.goal.label} · ${q.hint}`}</p>
            <small>보상: {rewardText(q, m)}</small>
          </article>
        );
      })}
      {next.length ? (
        <>
          <h3>받을 수 있어요</h3>
          {next.map((q) => (
            <article class="questcard avail" key={q.id}>
              <header>
                <b>{q.title}</b>
                <span>{NPCS[q.giver]?.name}</span>
              </header>
            </article>
          ))}
        </>
      ) : null}
      <p class="muted">끝낸 퀘스트 {m.quests.done.length} / {QUESTS.length}</p>
    </Panel>
  );
}

// ─── 지도 ─────────────────────────────────

function MapPanel() {
  const ref = useRef<HTMLCanvasElement>(null);
  const map = mapData.value;
  useEffect(() => {
    if (!map || !ref.current) return;
    const base = bakeMini(map);
    const cv = ref.current;
    cv.width = base.width;
    cv.height = base.height;
    const g = cv.getContext('2d')!;
    const draw = () => {
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(base, 0, 0);
      const w = worldScene();
      if (!w) return;
      for (const d of w.dots()) {
        const [x, y] = miniProject(map, d.u, d.v);
        g.fillStyle = d.c;
        g.fillRect(Math.round(x - d.r / 2), Math.round(y - d.r / 2), d.r, d.r);
      }
    };
    draw();
    const t = setInterval(draw, 250);
    return () => clearInterval(t);
  }, [map]);
  return (
    <Panel title={map?.title ?? '지도'} onClose={close('map')} class="mapwin">
      <canvas ref={ref} class="fullmap" />
      <ul class="legend">
        <li>
          <i style={{ background: '#fff' }} />나
        </li>
        <li>
          <i style={{ background: '#8fe89a' }} />
          다른 모험가
        </li>
        <li>
          <i style={{ background: '#8fd0ff' }} />
          마을 사람
        </li>
        <li>
          <i style={{ background: '#ffd25a' }} />
          출구
        </li>
        <li>
          <i style={{ background: '#d8887a' }} />
          몬스터
        </li>
      </ul>
    </Panel>
  );
}

// ─── 파티 ─────────────────────────────────

function PartyPanel() {
  const p = party.value;
  const [name, setName] = useState('');
  const w = worldScene();
  const nearby: string[] = [];
  if (w) {
    (w.room.state as any).players.forEach((pl: any, sid: string) => {
      if (sid !== w.sid) nearby.push(pl.name);
    });
  }
  const members = new Set(p?.members.map((x) => x.name));
  const invite = (n: string) => send('partyInvite', { name: n });
  return (
    <Panel title="파티" onClose={close('party')} class="partywin">
      {p ? (
        <ul class="memberlist">
          {p.members.map((x) => (
            <li key={x.id} class={x.on ? '' : 'off'}>
              <b>{x.leader ? '★ ' : ''}{x.name || '접속 끊김'}</b>
              <span>{x.on ? `Lv.${x.level} ${CLASSES[x.cls as keyof typeof CLASSES]?.label ?? ''}` : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">아직 혼자예요. 같이 사냥하면 경험치가 더 들어와요.</p>
      )}
      <form
        class="inviteform"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) invite(name.trim());
          setName('');
        }}
      >
        <input value={name} maxLength={10} placeholder="캐릭터 이름" aria-label="초대할 이름" onInput={(e) => setName(e.currentTarget.value)} />
        <button type="submit" class="btn small gold">
          초대
        </button>
      </form>
      {nearby.filter((n) => !members.has(n)).length ? (
        <>
          <h3>근처 모험가</h3>
          <ul class="memberlist">
            {nearby
              .filter((n) => !members.has(n))
              .map((n) => (
                <li key={n}>
                  <b>{n}</b>
                  <button type="button" class="btn small" onClick={() => invite(n)}>
                    초대
                  </button>
                </li>
              ))}
          </ul>
        </>
      ) : null}
      {p ? (
        <footer class="bagfoot">
          <span />
          <button type="button" class="btn small danger" onClick={() => send('partyLeave')}>
            파티 나가기
          </button>
        </footer>
      ) : null}
    </Panel>
  );
}

// ─── 설정 ─────────────────────────────────

function ClaimForm() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  if (!isGuest.value) return <p class="muted">계정: {loginName.value}</p>;
  return (
    <form
      class="claimform"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr('');
        try {
          await register(id.trim(), pw);
          toast('계정을 만들었어요. 다른 기기에서도 이어서 할 수 있어요', 'good', 4000);
        } catch (ex) {
          setErr(String((ex as Error).message));
        }
      }}
    >
      <h3>계정 만들기</h3>
      <p class="muted">지금은 이 브라우저에만 저장돼요. 계정을 만들면 캐릭터를 그대로 옮겨요.</p>
      <input value={id} placeholder="아이디 (영문·숫자 3~16자)" maxLength={16} aria-label="아이디" autoComplete="username" onInput={(e) => setId(e.currentTarget.value)} />
      <input type="password" value={pw} placeholder="비밀번호 (6자 이상)" maxLength={64} aria-label="비밀번호" autoComplete="new-password" onInput={(e) => setPw(e.currentTarget.value)} />
      {err ? <p class="err" role="alert">{err}</p> : null}
      <button type="submit" class="btn small gold">
        만들기
      </button>
    </form>
  );
}

function SettingsPanel() {
  const s = settings.value;
  return (
    <Panel title="설정" onClose={close('settings')} class="setwin">
      <label class="setrow">
        효과음
        <input type="range" min="0" max="1" step="0.05" value={s.sfx} onInput={(e) => saveSettings({ ...s, sfx: Number(e.currentTarget.value) })} />
      </label>
      <label class="setrow">
        음악
        <input type="range" min="0" max="1" step="0.05" value={s.music} onInput={(e) => saveSettings({ ...s, music: Number(e.currentTarget.value) })} />
      </label>
      <label class="setrow">
        화면 흔들림
        <input type="checkbox" checked={s.shake} onChange={(e) => saveSettings({ ...s, shake: e.currentTarget.checked })} />
      </label>
      <label class="setrow">
        이름 표시
        <input type="checkbox" checked={s.names} onChange={(e) => saveSettings({ ...s, names: e.currentTarget.checked })} />
      </label>
      <div class="setrow">
        화면 확대
        <div class="seg" role="group" aria-label="화면 확대">
          {[
            [0, '자동'],
            [1, '1배'],
            [2, '2배'],
            [3, '3배'],
          ].map(([v, label]) => (
            <button
              type="button"
              key={v}
              class={s.zoom === v ? 'on' : ''}
              aria-pressed={s.zoom === v}
              onClick={() => {
                saveSettings({ ...s, zoom: v as number });
                applyScale();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <h3>조작</h3>
      <dl class="keyhelp">
        <div><dt>WASD</dt><dd>이동</dd></div>
        <div><dt>왼쪽 클릭</dt><dd>공격 · 누르고 있으면 연속</dd></div>
        <div><dt>우클릭</dt><dd>막기 · 맞는 순간 들면 패링</dd></div>
        <div><dt>Space</dt><dd>회피</dd></div>
        <div><dt>Q E R F V</dt><dd>스킬</dd></div>
        <div><dt>1 2 3 4</dt><dd>물약</dd></div>
        <div><dt>G</dt><dd>대화</dd></div>
        <div><dt>Enter</dt><dd>채팅</dd></div>
      </dl>
      <ClaimForm />
      <footer class="bagfoot">
        <span />
        <button
          type="button"
          class="btn small"
          onClick={() => {
            panels.value = {};
            void backToChars();
          }}
        >
          캐릭터 고르기
        </button>
      </footer>
    </Panel>
  );
}

// ─── NPC ─────────────────────────────────

import { signal } from '@preact/signals';
const forgeSelect = signal<number | undefined>(undefined);
const forgeEquip = signal<Slot | undefined>(undefined);

function TalkTab({ npc, m }: { npc: string; m: Me }) {
  const def = NPCS[npc];
  const [viewing, setViewing] = useState<string | null>(null);
  const mine = QUESTS.filter((q) => q.giver === npc);
  const turnIn = mine.filter((q) => q.id in m.quests.active && questComplete(m, q));
  const avail = mine.filter((q) => questAvailable(m, q));
  const prog = mine.filter((q) => q.id in m.quests.active && !questComplete(m, q));
  const q = viewing ? QUEST_BY_ID[viewing] : (turnIn[0] ?? avail[0] ?? null);
  const line = def.lines[Math.abs(hash(npc + m.level)) % def.lines.length];
  if (q) {
    const isDone = q.id in m.quests.active && questComplete(m, q);
    const isActive = q.id in m.quests.active;
    return (
      <div class="talk">
        <h3>{q.title}</h3>
        <p class="speech">{isDone ? q.done : q.intro}</p>
        <div class="goalbox">
          <b>{q.goal.label}</b>
          {isActive ? <span>{questProgress(m, q).cur} / {questProgress(m, q).need}</span> : null}
          <small>{q.hint}</small>
        </div>
        <p class="reward">보상: {rewardText(q, m)}</p>
        <div class="row">
          {viewing ? (
            <button type="button" class="btn" onClick={() => setViewing(null)}>
              목록
            </button>
          ) : null}
          {isDone ? (
            <button
              type="button"
              class="btn gold"
              onClick={() => {
                send('qTurnIn', { id: q.id, npc });
                setViewing(null);
              }}
            >
              보상 받기
            </button>
          ) : !isActive ? (
            <button
              type="button"
              class="btn gold"
              onClick={() => {
                send('qAccept', { id: q.id, npc });
                setViewing(null);
              }}
            >
              맡을게요
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div class="talk">
      <p class="speech">{line}</p>
      {prog.length ? (
        <>
          <h3>맡은 일</h3>
          {prog.map((x) => (
            <button type="button" class="questline" key={x.id} onClick={() => setViewing(x.id)}>
              {x.title}
              <span>{questProgress(m, x).cur}/{questProgress(m, x).need}</span>
            </button>
          ))}
        </>
      ) : null}
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function ShopTab({ npc, m }: { npc: string; m: Me }) {
  return (
    <div class="shop">
      <p class="muted">가방에서 아이템을 누르면 팔 수 있어요.</p>
      <div class="shoplist">
        {SHOP_STOCK.map((id) => {
          const stack = CONSUMABLES[id];
          const g = GEAR[id];
          const name = stack?.name ?? g?.name;
          const price = stack?.price ?? g?.price ?? 0;
          const icon = stack?.icon ?? g?.icon;
          const sub = stack ? stack.desc : `${SLOT_LABEL[g.slot]} · ${g.req}레벨${g.cls ? ` · ${CLASSES[g.cls].label}` : ''}`;
          const wrong = g?.cls && g.cls !== m.cls;
          return (
            <button type="button" class={`shoprow ${wrong ? 'dim' : ''}`} key={id} disabled={m.gold < price} onClick={() => send('buy', { id, npc })}>
              <Icon id={icon} size={32} />
              <span class="shopname">
                <b>{name}</b>
                <small>{sub}</small>
              </span>
              <span class="price">{price.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RiftTab({ npc, m }: { npc: string; m: Me }) {
  const tokens = countInBag(m, 'rift_token');
  return (
    <div class="shop">
      <p class="muted">균열 토큰 {tokens}개 · 최고 기록 {m.riftBest}층</p>
      <div class="shoplist">
        {RIFT_STOCK.map((s, i) => {
          const g = GEAR[s.base];
          return (
            <button type="button" class="shoprow" key={s.base} disabled={tokens < s.tokens} onClick={() => send('riftBuy', { i, npc })}>
              <Icon id={g.icon} size={32} />
              <span class="shopname">
                <b style={{ color: RARITY_COLOR[s.rarity] }}>{g.name}</b>
                <small>{SLOT_LABEL[g.slot]} · {g.req}레벨</small>
              </span>
              <span class="price">토큰 {s.tokens}</span>
            </button>
          );
        })}
      </div>
      {riftBoard.value.length ? (
        <>
          <h3>균열 순위</h3>
          <ol class="board">
            {riftBoard.value.map((r) => (
              <li key={r.name}>
                <b>{r.name}</b>
                <span>{r.floor}층</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}

function ForgeTab({ npc, m }: { npc: string; m: Me }) {
  const bagI = forgeSelect.value;
  const eqS = forgeEquip.value;
  let g: GearInstance | undefined;
  if (eqS) g = m.equip[eqS];
  else if (bagI !== undefined) {
    const it = m.bag[bagI];
    if (it?.kind === 'gear') g = it.gear;
  }
  const cost = g ? enhanceCost(g) : null;
  const shards = countInBag(m, 'ember_shard');
  return (
    <div class="forge">
      <p class="muted">착용 중인 장비나 가방의 장비를 고르세요.</p>
      <div class="forgeeq">
        {SLOTS.map((s) => {
          const e = m.equip[s];
          return (
            <ItemSlot
              key={s}
              item={e ? { kind: 'gear', gear: e } : null}
              ghost={SLOT_LABEL[s]}
              selected={eqS === s}
              onClick={() => {
                if (!e) return;
                forgeEquip.value = s;
                forgeSelect.value = undefined;
              }}
            />
          );
        })}
      </div>
      {g && cost ? (
        <div class="forgebox">
          <b style={{ color: RARITY_COLOR[g.rarity] }}>{itemName({ kind: 'gear', gear: g })}</b>
          {g.plus >= MAX_PLUS ? (
            <p class="muted">더 강화할 수 없어요.</p>
          ) : (
            <>
              <p>
                성공 확률 <b>{Math.round(cost.rate * 100)}%</b>
                {cost.drop ? ' · 실패하면 한 단계 내려가요' : ''}
              </p>
              <p class={m.gold < cost.gold ? 'lack' : ''}>골드 {cost.gold.toLocaleString()} / {m.gold.toLocaleString()}</p>
              <p class={shards < cost.shards ? 'lack' : ''}>등불 조각 {cost.shards} / {shards}</p>
              <button
                type="button"
                class="btn gold"
                disabled={m.gold < cost.gold || shards < cost.shards}
                onClick={() => {
                  if (eqS) send('enhance', { where: eqS, i: 0, npc });
                  else send('enhance', { where: 'bag', i: bagI, npc });
                  sfx('forge');
                }}
              >
                강화
              </button>
            </>
          )}
          {!eqS && bagI !== undefined ? (
            <button
              type="button"
              class="btn danger"
              onClick={() => {
                send('salvage', { i: bagI, npc });
                forgeSelect.value = undefined;
              }}
            >
              분해 · 등불 조각 {salvageYield(g)}개
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function VaultTab({ npc, m }: { npc: string; m: Me }) {
  return (
    <div class="vault">
      <p class="muted">가방에서 누르면 넣고, 여기서 누르면 꺼내요. 같은 계정이 아니라 이 캐릭터의 창고예요.</p>
      <div class="baggrid vaultgrid">
        {m.vault.map((it, i) => (
          <ItemSlot key={i} item={it} hint="눌러서 꺼내기" onClick={() => send('vaultTake', { i, npc })} />
        ))}
      </div>
    </div>
  );
}

function NpcPanel() {
  const npc = npcOpen.value;
  const m = me.value;
  useEffect(() => {
    if (npc) {
      forgeSelect.value = undefined;
      forgeEquip.value = undefined;
    }
  }, [npc]);
  if (!npc || !m) return null;
  const def = NPCS[npc];
  if (!def) return null;
  const tabs: [typeof npcTab.value, string][] = [['talk', '대화']];
  if (def.shop) tabs.push(['shop', '상점']);
  if (def.rift) tabs.push(['rift', '토큰 교환']);
  if (def.forge) tabs.push(['forge', '강화']);
  if (def.vault) tabs.push(['vault', '창고']);
  const openBagFor = (t: typeof npcTab.value) => {
    npcTab.value = t;
    if (t !== 'talk' && t !== 'rift' && !panels.value.bag) panels.value = { ...panels.value, bag: true };
  };
  return (
    <Panel
      title={`${def.name} · ${def.title}`}
      onClose={() => {
        hideTip();
        npcOpen.value = null;
      }}
      class="npcwin"
    >
      <div class="npcbody">
        <div class="npcprev">
          <CharPreview sheet={def.sheet} scale={2} />
        </div>
        <div class="npcmain">
          {tabs.length > 1 ? (
            <div class="tabs" role="tablist">
              {tabs.map(([id, label]) => (
                <button type="button" role="tab" key={id} aria-selected={npcTab.value === id} class={npcTab.value === id ? 'on' : ''} onClick={() => openBagFor(id)}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {npcTab.value === 'talk' ? <TalkTab npc={npc} m={m} /> : null}
          {npcTab.value === 'shop' ? <ShopTab npc={npc} m={m} /> : null}
          {npcTab.value === 'rift' ? <RiftTab npc={npc} m={m} /> : null}
          {npcTab.value === 'forge' ? <ForgeTab npc={npc} m={m} /> : null}
          {npcTab.value === 'vault' ? <VaultTab npc={npc} m={m} /> : null}
        </div>
      </div>
    </Panel>
  );
}

export function Panels() {
  const p = panels.value;
  return (
    <>
      {p.bag ? <BagPanel /> : null}
      {p.equip ? <EquipPanel /> : null}
      {p.skills ? <SkillsPanel /> : null}
      {p.quests ? <QuestsPanel /> : null}
      {p.map ? <MapPanel /> : null}
      {p.party ? <PartyPanel /> : null}
      {p.settings ? <SettingsPanel /> : null}
      <NpcPanel />
    </>
  );
}
