// 움직임 확인 영상: 프레임을 하나씩 돌려 찍고 ffmpeg로 묶는다. 화면에 창을 띄우지 않는다.
// 사용: node tools/lookdev/film.mjs <출력.mp4>
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const out = resolve(process.argv[2] ?? 'film.mp4');
const tmp = mkdtempSync(join(tmpdir(), 'film-'));
mkdirSync(tmp, { recursive: true });
const vite = await createServer({ configFile: resolve('vite.config.ts'), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const url = `http://127.0.0.1:${vite.httpServer.address().port}/lookdev.html`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.LD);
await page.evaluate(() => window.LD.size(960, 540, 2));
await page.evaluate(() => window.LD.load('town'));
const FPS = 30;
const N = FPS * 9;
await page.evaluate(() => {
  const L = window.LD;
  L.cast([
    ['pc_musa_a', 24, 31, 90, 'walk'],
    ['pc_dosa_a', 23, 32, 90, 'walk'],
    ['pc_gungsa_b', 22.6, 30.2, 90, 'walk'],
    ['daramjwi', 34, 31, -90, 'walk'],
    ['metdwaeji', 35, 32.6, -90, 'walk'],
    ['npc_elder', 26.6, 26.4, 20, 'idle'],
    ['npc_merchant', 36.4, 27.1, -50, 'idle'],
  ]);
});
for (let f = 0; f < N; f++) {
  const t = f / FPS;
  await page.evaluate(([t]) => {
    const L = window.LD;
    const A = L.actors;
    const dt = 1 / 30;
    // 앞 2.6초: 양쪽에서 걸어온다. 잠시 마주 본 뒤 3.4초부터 전투 동작.
    const stopAt = [28.2, 27.2, 26.9, 30.2, 31];
    for (let i = 0; i < 5; i++) {
      const a = A[i];
      const dir = i < 3 ? 1 : -1;
      const speed = i < 3 ? 2.2 : 1.5;
      if ((a.u - stopAt[i]) * dir < 0) {
        a.u += dir * speed * dt;
      } else if (a.anim === 'walk') {
        a.anim = 'idle';
        a.p = 0;
      }
    }
    if (t > 3.4) {
      const k = Math.floor((t - 3.4) / 0.62);
      if (k !== L._k) {
        L._k = k;
        const c = ['attack1', 'attack2', 'attack3'][k % 3];
        A[0].anim = c;
        A[0].p = 0;
        A[1].anim = k % 3 === 2 ? 'spin' : 'cast';
        A[1].p = 0;
        A[2].anim = c;
        A[2].p = 0;
        A[3].anim = k % 2 ? 'hit' : 'attack';
        A[3].p = 0;
        A[4].anim = k % 2 ? 'attack' : 'hit';
        A[4].p = 0;
      }
    }
    L.tick(dt);
    L.shot(29 + t * 0.2, 31.2, 12 + t);
  }, [t]);
  await page.locator('#stage3d').screenshot({ path: join(tmp, `f${String(f).padStart(4, '0')}.png`) });
}
await browser.close();
await vite.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out]);
rmSync(tmp, { recursive: true, force: true });
console.log(out);
