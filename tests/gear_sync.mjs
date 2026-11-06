// 다른 플레이어의 겉모습 시험: 두 명이 접속해 한 명이 갑옷을 벗으면 다른 사람 화면의 모델도 바뀌는지 본다. 헤드리스.
// 실행: node tests/gear_sync.mjs [출력 폴더]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? join(tmpdir(), 'lantern-gear-sync');
mkdirSync(OUT, { recursive: true });
const PORT = 2607;
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'lantern-sync-'));
const server = spawn('npx', ['tsx', 'server/src/index.ts'], { env: { ...process.env, PORT: String(PORT), LANTERN_DB: join(dir, 't.sqlite') }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) {
  try {
    await fetch(`${BASE}/api/ping`);
    break;
  } catch {
    await sleep(200);
  }
}
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-webgl', '--ignore-gpu-blocklist', '--mute-audio'] });
const errors = [];
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '통과' : '실패'}  ${name}${extra ? ` (${extra})` : ''}`);
  if (!ok) failed++;
};
async function join_(name, card) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE);
  await page.waitForFunction(() => !!document.querySelector('.btn.gold.big:not([disabled])'), null, { timeout: 90000 });
  await page.click('.btn.gold.big');
  await page.waitForSelector('.createbox', { timeout: 10000 });
  await page.click(`.clscard:nth-child(${card})`);
  await page.fill('.namefield input', name);
  await page.click('.createopts .btn.gold');
  await page.waitForFunction(() => window.__world?.ready === true, null, { timeout: 30000 });
  return page;
}
try {
  const a = await join_('입는사람', 1);
  const b = await join_('보는사람', 2);
  await b.waitForFunction(() => window.__world.others.size > 0, null, { timeout: 10000 });
  const seen = () => b.evaluate(() => [...window.__world.others.values()][0].a.sheetId);
  const before = await seen();
  check('다른 사람 화면에 장비가 보임', before.includes('hwando_1') && before.includes('gabot_1'), before);
  await b.screenshot({ path: join(OUT, 'other_before.png') });
  await a.keyboard.press('KeyC');
  await sleep(300);
  await a.click('.equipcell:nth-child(3) .slot');
  await b.waitForFunction(() => ![...window.__world.others.values()][0].a.sheetId.includes('gabot_1'), null, { timeout: 5000 });
  check('벗으면 다른 사람 화면도 바뀜', true, await seen());
  await sleep(400);
  await b.screenshot({ path: join(OUT, 'other_after.png') });
} catch (e) {
  check('시험 진행', false, e.message);
}
check('브라우저 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.kill('SIGTERM');
rmSync(dir, { recursive: true, force: true });
console.log(failed ? `실패 ${failed}건` : '모두 통과');
process.exit(failed ? 1 : 0);
