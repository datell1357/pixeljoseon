// 룩데브 촬영. 화면을 띄우지 않고 헤드리스 Chrome으로 찍는다.
// 사용: node tools/lookdev/run.mjs <출력폴더> town:30:30 town:20:24 ...   옵션 --bench
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const out = resolve(args.shift() ?? 'tmp');
const bench = args.includes('--bench');
const castArg = args.find((a) => a.startsWith('--cast='));
const cast = castArg ? JSON.parse(castArg.slice(7)) : null;
const settle = Number((args.find((a) => a.startsWith('--settle=')) ?? '--settle=0').slice(9));
const shots = args.filter((a) => !a.startsWith('--'));
mkdirSync(out, { recursive: true });

const vite = await createServer({ configFile: resolve('vite.config.ts'), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const addr = vite.httpServer.address();
const url = `http://127.0.0.1:${addr.port}/lookdev.html`;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 900)}`);
});
page.on('pageerror', (e) => errors.push(`[page] ${String(e).slice(0, 900)}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.LD, null, { timeout: 60000 }).catch((e) => errors.push(String(e)));
let cur = '';
try {
  const sz = (args.find((a) => a.startsWith("--size=")) ?? "--size=960,540,2").slice(7).split(",").map(Number);
  await page.evaluate((s) => window.LD.size(s[0], s[1], s[2]), sz);
  for (const s of shots) {
    const [map, u, v, name, t] = s.split(':');
    if (map !== cur) {
      const t0 = Date.now();
      await page.evaluate((m) => window.LD.load(m), map);
      console.log('load', map, Date.now() - t0, 'ms');
      cur = map;
    }
    if (cast) {
      await page.evaluate(([c, n]) => {
        window.LD.cast(c);
        for (let i = 0; i < n; i++) window.LD.tick(1 / 60);
      }, [cast, settle]);
    }
    const st = await page.evaluate(([a, b, c]) => window.LD.shot(a, b, c), [Number(u), Number(v), Number(t ?? 12)]);
    const file = join(out, `${name ?? `${map}_${u}_${v}`}.png`);
    await page.locator('#stage3d').screenshot({ path: file });
    console.log(file, JSON.stringify(st));
    if (bench) console.log('bench', JSON.stringify(await page.evaluate(([a, b]) => window.LD.bench(a, b, 120), [Number(u), Number(v)])));
  }
} catch (e) {
  errors.push(String(e).slice(0, 1200));
}
const uniq = [...new Set(errors)];
console.log(uniq.length ? `오류 ${uniq.length}건\n${uniq.slice(0, 12).join('\n')}` : '오류 없음');
await browser.close();
await vite.close();
