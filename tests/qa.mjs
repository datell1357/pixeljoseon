// 시각 점검: 직업별 스킬과 보스전을 헤드리스로 돌려 스크린샷을 남긴다.
// 실행: node tests/qa.mjs [출력 폴더] [warrior|mage|archer]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? join(tmpdir(), 'lantern-qa');
const CLASSES = process.argv[3] ? [process.argv[3]] : ['warrior', 'mage', 'archer'];
mkdirSync(OUT, { recursive: true });
const PORT = 2604;
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'lantern-qa-'));
const server = spawn('npx', ['tsx', 'server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT), LANTERN_DB: join(dir, 't.sqlite'), LANTERN_DEV: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) {
  try {
    await fetch(`${BASE}/api/ping`);
    break;
  } catch {
    await sleep(200);
  }
}
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--mute-audio'] });
const errors = new Set();

for (const cls of CLASSES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.add(`${cls} pageerror: ${e.message} ${(e.stack ?? '').split('\n').slice(1, 3).join(' ')}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/404/.test(m.text())) errors.add(`${cls} console: ${m.text().slice(0, 500)}`);
  });
  const shot = (name) => page.screenshot({ path: join(OUT, `${cls}_${name}.png`) });
  const dev = (m) => page.evaluate((x) => window.__world.room.send('dev', x), m);
  const ready = (map) => page.waitForFunction((n) => window.__world?.ready && window.__world.map.name === n, map, { timeout: 20000 });

  await page.goto(BASE);
  await page.waitForFunction(() => !!document.querySelector('.btn.gold.big:not([disabled])'), null, { timeout: 90000 });
  await page.click('.btn.gold.big');
  await page.waitForSelector('.createbox');
  await page.click(`.clscard:nth-child(${['warrior', 'mage', 'archer'].indexOf(cls) + 1})`);
  await page.fill('.namefield input', `시험${cls.slice(0, 3)}`);
  await page.click('.createopts .btn.gold');
  await ready('town');
  await sleep(900);
  await dev({ level: 20, full: true });
  await sleep(300);

  // 숲에서 스킬 시연
  await dev({ goto: 'woods', arrive: 'from_town' });
  await ready('woods');
  await sleep(700);
  await dev({ tp: [24, 44], full: true });
  await sleep(1400);

  const aimNearest = async () => {
    const p = await page.evaluate(() => {
      const w = window.__world;
      let b = null;
      let bd = 1e9;
      w.room.state.monsters.forEach((m) => {
        if (m.hp <= 0) return;
        const d = Math.hypot(m.u - w.me.u, m.v - w.me.v);
        if (d < bd) {
          bd = d;
          b = m;
        }
      });
      const cam = w.cameras.main;
      const k = innerWidth / window.__game.scale.width;
      const tu = b ? b.u : w.me.u + 2;
      const tv = b ? b.v : w.me.v;
      return [((tu - tv) * 32 - cam.worldView.x) * k, ((tu + tv) * 16 - 10 - cam.worldView.y) * k];
    });
    await page.mouse.move(p[0], p[1]);
  };

  await aimNearest();
  await page.mouse.down();
  await sleep(350);
  await shot('attack');
  await sleep(350);
  await page.mouse.up();
  for (const [i, key] of ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyV'].entries()) {
    await dev({ full: true });
    await aimNearest();
    await page.keyboard.press(key);
    await sleep(i === 2 ? 520 : 300);
    await shot(`skill${i + 1}`);
    await sleep(900);
  }
  await page.keyboard.press('Space');
  await sleep(130);
  await shot('dodge');
  await sleep(500);

  // 패널
  await page.keyboard.press('KeyK');
  await sleep(250);
  await shot('skillpanel');
  await page.keyboard.press('KeyK');
  await page.keyboard.press('KeyI');
  await page.keyboard.press('KeyC');
  await sleep(250);
  await shot('bagequip');
  await page.keyboard.press('Escape');

  // 첫 보스
  await dev({ goto: 'hollow', arrive: 'start' });
  await ready('hollow');
  await sleep(800);
  await shot('hollow');
  await dev({ tp: [20, 18], full: true });
  await sleep(2200);
  await shot('boss1_a');
  for (let i = 0; i < 16; i++) {
    await dev({ full: true });
    await aimNearest();
    await page.mouse.down();
    await sleep(420);
    await page.mouse.up();
    if (i % 3 === 0) await page.keyboard.press(['KeyQ', 'KeyE', 'KeyR'][(i / 3) % 3]);
    if (i === 8) await shot('boss1_b');
  }
  await shot('boss1_c');

  // 잿빛 벌판
  await dev({ goto: 'ashfield', arrive: 'from_woods' });
  await ready('ashfield');
  await sleep(1000);
  await shot('ashfield');
  await dev({ tp: [36, 18], full: true });
  await sleep(2500);
  await shot('ashfield_fight');

  // 두 번째 보스
  await dev({ goto: 'furnace', arrive: 'start' });
  await ready('furnace');
  await sleep(800);
  await dev({ level: 30, tp: [22, 21], full: true });
  await sleep(2500);
  await shot('boss2_a');
  for (let i = 0; i < 12; i++) {
    await dev({ full: true });
    await aimNearest();
    await page.mouse.down();
    await sleep(420);
    await page.mouse.up();
    if (i === 6) await shot('boss2_b');
  }
  await shot('boss2_c');

  // 균열
  await dev({ goto: 'rift', arrive: 'start' });
  await ready('rift');
  await sleep(1800);
  await shot('rift');

  // 마을로 돌아와 상점
  await dev({ goto: 'town', arrive: 'start' });
  await ready('town');
  await sleep(1200);
  await shot('town_final');
  await ctx.close();
  console.log('완료', cls);
}

await browser.close();
server.kill('SIGTERM');
rmSync(dir, { recursive: true, force: true });
console.log('오류', errors.size);
for (const e of errors) console.log(e.slice(0, 600));
if (/Error|예외/.test(serverLog)) console.log('--- 서버 ---\n' + serverLog.slice(-1500));
process.exit(errors.size ? 1 : 0);
