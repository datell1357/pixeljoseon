// 장비 단계 비교 사진. 직업마다 맨몸부터 최고 단계까지 줄지어 세운다. 헤드리스.
// 사용: node tools/lookdev/gear.mjs <출력폴더>
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const out = process.argv[2];
const LOOK = process.argv[3] ?? 'a';
const DEG = Number(process.argv[4] ?? 18);
const FILE = process.argv[5] ?? 'sheet.png';
const vite = await createServer({ configFile: resolve('vite.config.ts'), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const url = `http://127.0.0.1:${vite.httpServer.address().port}/lookdev.html`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 800)));
await page.goto(url);
await page.waitForFunction(() => window.LD);
await page.evaluate(() => window.LD.size(960, 540, 2));
// 소품을 치운 마을 바닥에 세운다
await page.evaluate(async () => {
  const m = await (await fetch('/maps/town.json')).json();
  m.props = [];
  m.objects = m.objects.filter((o) => o.type !== 'lantern');
  window.LD.stage.loadMap(m);
});
const W = { musa: 'sword', dosa: 'staff', gungsa: 'bow' };
const key = (cls, t, ring = '', am = '', r = 0, p = 0) => `${t.w ? `${W[cls]}_${t.w}.${r}.${p}` : ''},${t.h ? `helm_${t.h}.${r}.${p}` : ''},${t.a ? `armor_${t.a}.${r}.${p}` : ''},${t.b ? `boots_${t.b}.${r}.${p}` : ''},${ring},${am}`;
const tiers = [
  { t: {}, },
  { t: { w: 1, a: 1 } },
  { t: { w: 1, h: 1, a: 1, b: 1 } },
  { t: { w: 2, h: 2, a: 2, b: 2 }, ring: 'ring_1.0.0', am: 'amulet_1.0.0' },
  { t: { w: 3, h: 3, a: 3, b: 3 }, ring: 'ring_2.0.0', am: 'amulet_2.0.0' },
  { t: { w: 4, h: 3, a: 3, b: 3 }, ring: 'ring_2.0.0', am: 'amulet_2.0.0' },
];
// 등급·강화 사진: node tools/lookdev/gear.mjs <폴더> a 18 파일.png rare
const RARE = process.argv[6] === 'rare';
if (RARE) {
  tiers.length = 0;
  for (const [r, p] of [[0, 0], [1, 0], [2, 0], [3, 0], [2, 4], [3, 7], [3, 10]]) tiers.push({ t: { w: 2, h: 2, a: 2, b: 2 }, r, p, ring: `ring_2.${r}.${p}`, am: `amulet_2.${r}.${p}` });
}
const ANIM = process.argv[7] ?? 'idle';
const rows = [];
const cls = ['musa', 'dosa', 'gungsa'];
cls.forEach((c, row) => {
  tiers.forEach((q, i) => {
    rows.push([`pc_${c}_${LOOK}#${key(c, q.t, q.ring ?? '', q.am ?? '', q.r ?? 0, q.p ?? 0)}`, 6 + i * (RARE ? 2.6 : 3), 11 + row * 5, DEG, ANIM, 0.3, 1]);
  });
});
const t0 = Date.now();
const res = await page.evaluate((c) => { const a = performance.now(); window.LD.cast(c); for (let i = 0; i < 40; i++) window.LD.tick(1/60); return performance.now() - a; }, rows);
console.log('build 18 assets ms', Math.round(res));
const st = await page.evaluate(() => window.LD.shot(13.5, 14.8, 12));
await page.locator('#stage3d').screenshot({ path: `${out}/${FILE}` });
console.log(JSON.stringify(st));
console.log(errors.length ? errors.join('\n') : '오류 없음');
await browser.close();
await vite.close();
