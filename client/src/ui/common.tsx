// 화면 공용 조각: 아이콘, 아이템 설명, 인물 미리보기
import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { CONSUMABLES, GEAR, RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, STAT_LABEL, enhanceCost, formatStat, gearStats, sellPrice, type GearInstance, type ItemStack, type StatKey } from '@shared/items';
import { CLASSES } from '@shared/classes';
import { DIRS } from '@shared/core';
import { DIR_VEC } from '@shared/core';
import { stageOrNull } from '../game/boot';
import { iconSheets } from '../game/assets';
import { ActorView } from '../render3d/actor3d';
import { PORTRAIT } from '../render3d/stage';
import * as THREE from 'three';
import { me } from '../store';

export function Icon({ id, size = 32, kind = 'items' }: { id: string; size?: number; kind?: 'items' | 'skills' }) {
  const sheet = iconSheets[kind];
  const i = sheet ? sheet.ids.indexOf(id) : -1;
  if (!sheet || i < 0) return <span class="icon missing" style={{ width: `${size}px`, height: `${size}px` }} />;
  const k = size / sheet.cell;
  const x = (i % sheet.cols) * sheet.cell * k;
  const y = Math.floor(i / sheet.cols) * sheet.cell * k;
  const rows = Math.ceil(sheet.ids.length / sheet.cols);
  return (
    <span
      class="icon"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundImage: `url(/art/icons/${kind}.png)`,
        backgroundPosition: `-${x}px -${y}px`,
        backgroundSize: `${sheet.cols * sheet.cell * k}px ${rows * sheet.cell * k}px`,
      }}
    />
  );
}

export function itemIcon(it: ItemStack) {
  return it.kind === 'gear' ? GEAR[it.gear.base].icon : (CONSUMABLES[it.id]?.icon ?? it.id);
}

export function ItemSlot({
  item,
  onClick,
  onContext,
  selected,
  hint,
  size = 48,
  ghost,
}: {
  item: ItemStack | null | undefined;
  onClick?: () => void;
  onContext?: () => void;
  selected?: boolean;
  hint?: string;
  size?: number;
  ghost?: string;
}) {
  const rarity = item?.kind === 'gear' ? item.gear.rarity : 0;
  const plus = item?.kind === 'gear' ? item.gear.plus : 0;
  return (
    <button
      type="button"
      class={`slot r${rarity} ${item ? 'full' : 'empty'} ${selected ? 'sel' : ''}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext?.();
      }}
      onMouseEnter={(e) => item && showTip(item, e.currentTarget as HTMLElement, hint)}
      onMouseLeave={() => hideTip()}
    >
      {item ? <Icon id={itemIcon(item)} size={size - 16} /> : ghost ? <span class="ghost">{ghost}</span> : null}
      {item?.kind === 'stack' && item.n > 1 ? <span class="count">{item.n}</span> : null}
      {plus > 0 ? <span class="plus">+{plus}</span> : null}
    </button>
  );
}

// ─── 아이템 설명 ─────────────────────────────────

const tip = signal<{ item: ItemStack; x: number; y: number; hint?: string } | null>(null);

export function showTip(item: ItemStack, el: HTMLElement, hint?: string) {
  const r = el.getBoundingClientRect();
  const left = r.left > window.innerWidth / 2;
  tip.value = { item, x: left ? r.left - 8 : r.right + 8, y: r.top, hint };
  tipSide = left ? 'left' : 'right';
}

let tipSide: 'left' | 'right' = 'right';
export const hideTip = () => {
  tip.value = null;
};

function GearStats({ g }: { g: GearInstance }) {
  const b = GEAR[g.base];
  const stats = gearStats(g);
  const cur = me.value?.equip[b.slot];
  const curStats = cur && cur.uid !== g.uid ? gearStats(cur) : null;
  const baseKeys = Object.keys(b.stats) as StatKey[];
  const affixKeys = g.affixes.map((a) => a[0]);
  return (
    <div class="tipstats">
      {[...new Set([...baseKeys, ...affixKeys])].map((k) => {
        const v = stats[k] ?? 0;
        const old = curStats?.[k] ?? 0;
        const diff = curStats ? v - old : 0;
        return (
          <div class={`tipline ${affixKeys.includes(k) && !baseKeys.includes(k) ? 'affix' : ''}`} key={k}>
            <span>{STAT_LABEL[k]}</span>
            <b>
              {formatStat(k, v)}
              {curStats && Math.abs(diff) > 0.0005 ? <i class={diff > 0 ? 'up' : 'down'}>{diff > 0 ? '▲' : '▼'}</i> : null}
            </b>
          </div>
        );
      })}
    </div>
  );
}

export function Tooltip() {
  const t = tip.value;
  if (!t) return null;
  const { item } = t;
  const style = {
    top: `${Math.min(t.y, window.innerHeight - 280)}px`,
    [tipSide === 'right' ? 'left' : 'right']: `${tipSide === 'right' ? t.x : window.innerWidth - t.x}px`,
  };
  if (item.kind === 'gear') {
    const g = item.gear;
    const b = GEAR[g.base];
    const lvOk = (me.value?.level ?? 0) >= b.req;
    const clsOk = !b.cls || b.cls === me.value?.cls;
    return (
      <div class="tooltip" style={style}>
        <div class="tipname" style={{ color: RARITY_COLOR[g.rarity] }}>
          {g.plus ? `+${g.plus} ` : ''}
          {b.name}
        </div>
        <div class="tipsub">
          {RARITY_LABEL[g.rarity]} {SLOT_LABEL[b.slot]}
          {b.cls ? ` · ${CLASSES[b.cls].label} 전용` : ''}
        </div>
        <GearStats g={g} />
        <div class={`tipreq ${lvOk && clsOk ? '' : 'bad'}`}>{b.req}레벨 이상</div>
        <div class="tipsell">판매 {sellPrice(g)}냥</div>
        {t.hint ? <div class="tiphint">{t.hint}</div> : null}
      </div>
    );
  }
  const d = CONSUMABLES[item.id];
  if (!d) return null;
  return (
    <div class="tooltip" style={style}>
      <div class="tipname">{d.name}</div>
      <div class="tipdesc">{d.desc}</div>
      {d.sell ? <div class="tipsell">판매 {d.sell}냥</div> : null}
      {t.hint ? <div class="tiphint">{t.hint}</div> : null}
    </div>
  );
}

export { enhanceCost };

// ─── 인물 미리보기 ─────────────────────────────

export function CharPreview({ sheet, scale = 3, anim = 'idle', dir = 0, spin = false, size }: { sheet: string; scale?: number; anim?: string; dir?: number; spin?: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = PORTRAIT;
    cv.height = PORTRAIT;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let view: ActorView | null = null;
    const holder = new THREE.Group();
    const start = performance.now();
    let last = start;
    let wait = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const stage = stageOrNull();
      if (!stage) return;
      // 미리보기는 초당 20번이면 충분하다
      wait += now - last;
      const dt = (now - last) / 1000;
      last = now;
      if (wait < 50) return;
      const step = wait / 1000;
      wait = 0;
      void dt;
      if (!view) {
        try {
          view = new ActorView(sheet, holder);
        } catch {
          return;
        }
      }
      const t = (now - start) / 1000;
      const a = view.asset.anims[anim] ?? view.asset.anims.idle;
      const v = DIR_VEC[dir] ?? DIR_VEC[0];
      const heading = spin ? Math.sin(t * 0.6) * 0.9 : dir === 0 ? 0 : Math.atan2(v[0], v[1]);
      view.update(step, anim, t / a.dur, 0, 0, 0, heading, 1);
      stage.portrait(view, ctx);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      view?.dispose();
    };
  }, [sheet, anim, dir, spin]);
  const px = size ?? PORTRAIT * scale;
  return <canvas ref={ref} class="preview" style={{ width: `${px}px`, height: `${px}px` }} aria-label={`${sheet} 미리보기`} />;
}

export function Panel({ title, onClose, children, class: cls = '' }: { title: string; onClose: () => void; children: ComponentChildren; class?: string }) {
  return (
    <div class={`panel win ${cls}`} role="dialog" aria-label={title}>
      <header class="winhead">
        <h2>{title}</h2>
        <button type="button" class="x" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </header>
      <div class="winbody">{children}</div>
    </div>
  );
}

export function Bar({ value, max, cls, label }: { value: number; max: number; cls: string; label?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div class={`bar ${cls}`}>
      <i style={{ width: `${p * 100}%` }} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
