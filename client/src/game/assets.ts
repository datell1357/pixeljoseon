// 구워 둔 그림의 설명 파일과, 코드로 그리는 효과용 텍스처
import type * as Phaser from 'phaser';

export interface IconSheet {
  cell: number;
  cols: number;
  ids: string[];
}

export const iconSheets: { items: IconSheet | null; skills: IconSheet | null } = { items: null, skills: null };

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(path);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** 게임을 띄우기 전에 설명 파일을 모두 읽는다 */
export async function loadDescriptors() {
  iconSheets.items = await getJson<IconSheet>('/art/icons/items.json');
  iconSheets.skills = await getJson<IconSheet>('/art/icons/skills.json');
}

export function preloadArt(scene: Phaser.Scene) {
  if (iconSheets.items) scene.load.image('icons_items', '/art/icons/items.png');
}

/** 아이콘 그림을 잘라 쓸 수 있게 프레임을 등록한다 */
export function registerPropFrames(scene: Phaser.Scene) {
  if (scene.textures.exists('icons_items') && iconSheets.items) {
    const it = scene.textures.get('icons_items');
    const { cell, cols, ids } = iconSheets.items;
    ids.forEach((id, i) => {
      if (!it.has(id)) it.add(id, 0, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
    });
  }
}

// ─── 효과 텍스처 ─────────────────────────────────────

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext(), w, h);
  tex.refresh();
}

function radial(g: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][]) {
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  for (const [t, c] of stops) grad.addColorStop(t, c);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

export function makeFxTextures(scene: Phaser.Scene) {
  make(scene, 'glow', 128, 128, (g, w, h) =>
    radial(g, w, h, [
      [0, 'rgba(255,255,255,1)'],
      [0.25, 'rgba(255,255,255,0.55)'],
      [0.6, 'rgba(255,255,255,0.14)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  make(scene, 'soft', 32, 32, (g, w, h) =>
    radial(g, w, h, [
      [0, 'rgba(255,255,255,1)'],
      [0.55, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  make(scene, 'shadow', 48, 24, (g, w, h) => {
    g.save();
    g.scale(1, 0.5);
    const grad = g.createRadialGradient(w / 2, h, 0, w / 2, h, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.62)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h * 2);
    g.restore();
  });
  make(scene, 'px', 4, 4, (g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 4, 4);
  });
  make(scene, 'ring', 96, 96, (g, w) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2);
    g.stroke();
  });
  make(scene, 'spark', 16, 16, (g, w, h) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w / 2 + 2, h / 2 - 2);
    g.lineTo(w, h / 2);
    g.lineTo(w / 2 + 2, h / 2 + 2);
    g.lineTo(w / 2, h);
    g.lineTo(w / 2 - 2, h / 2 + 2);
    g.lineTo(0, h / 2);
    g.lineTo(w / 2 - 2, h / 2 - 2);
    g.closePath();
    g.fill();
  });
  // 베기 초승달: 오른쪽을 향한다
  make(scene, 'slash', 128, 128, (g, w, h) => {
    const cx = w * 0.32;
    const cy = h / 2;
    const steps = 42;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const a = -1.25 + 2.5 * t;
      const taper = Math.sin(t * Math.PI);
      const r0 = 44 - taper * 15;
      const r1 = 56 + taper * 4;
      const alpha = 0.25 + 0.75 * t;
      g.fillStyle = `rgba(255,255,255,${alpha})`;
      g.beginPath();
      g.arc(cx, cy, r1, a, a + 0.08);
      g.arc(cx, cy, r0, a + 0.08, a, true);
      g.closePath();
      g.fill();
    }
  });
  make(scene, 'arrow', 32, 8, (g) => {
    g.fillStyle = '#e8dcc0';
    g.fillRect(4, 3, 22, 2);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(32, 4);
    g.lineTo(24, 0);
    g.lineTo(24, 8);
    g.closePath();
    g.fill();
    g.fillStyle = '#c9744a';
    g.fillRect(0, 1, 6, 2);
    g.fillRect(0, 5, 6, 2);
  });
  make(scene, 'orb', 24, 24, (g, w, h) =>
    radial(g, w, h, [
      [0, 'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,255,255,0.95)'],
      [0.75, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  make(scene, 'cross', 32, 32, (g, w) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(4, 4);
    g.lineTo(w - 4, w - 4);
    g.moveTo(w - 4, 4);
    g.lineTo(4, w - 4);
    g.stroke();
  });
  make(scene, 'bubble', 64, 64, (g, w, h) => {
    radial(g, w, h, [
      [0, 'rgba(255,255,255,0)'],
      [0.72, 'rgba(255,255,255,0.08)'],
      [0.92, 'rgba(255,255,255,0.7)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
  });
  // 길안내 화살표: 오른쪽을 향한다
  make(scene, 'guide', 16, 16, (g) => {
    g.fillStyle = '#ffd25a';
    g.strokeStyle = '#2a1a06';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(15, 8);
    g.lineTo(3, 1);
    g.lineTo(6, 8);
    g.lineTo(3, 15);
    g.closePath();
    g.stroke();
    g.fill();
  });
  // 그림이 없을 때 쓰는 자리 표시
  make(scene, 'placeholder', 32, 48, (g) => {
    g.fillStyle = '#c33';
    g.fillRect(8, 8, 16, 36);
  });
}
