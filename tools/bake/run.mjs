#!/usr/bin/env node
// 등불길 아트 굽기. 사용법: npm run bake [-- 대상...]
//   대상 없음 = 전부. 대상: 캐릭터 id, chars players npcs monsters bosses props terrain icons preview check
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './lib/png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const ART = join(ROOT, 'client/public/art');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

async function openPage(browser) {
  const ctx = await browser.newContext();
  await ctx.route('http://bake.local/**', async (route) => {
    const url = new URL(route.request().url());
    const path = join(ROOT, decodeURIComponent(url.pathname));
    if (!path.startsWith(ROOT)) return route.abort();
    try {
      const body = await readFile(path);
      await route.fulfill({ status: 200, contentType: MIME[extname(path)] ?? 'application/octet-stream', body });
    } catch {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      const t = m.text();
      if (!/GPU stall|GL Driver Message|swiftshader/i.test(t)) console.error('[page]', t);
    }
  });
  await page.goto('http://bake.local/tools/bake/page/index.html');
  await page.waitForFunction(() => window.BAKE?.ready === true, null, { timeout: 60000 });
  return page;
}

async function writeSheet(path, w, h, b64) {
  const raw = Buffer.from(b64, 'base64');
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.length);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encodePNG(w, h, rgba));
}

/** JSON은 anims 표까지 읽기 좋게 */
async function writeJson(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(obj, null, 1) + '\n');
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const jobs = Number(process.env.BAKE_JOBS ?? 3);
  const want = new Set(args);
  const all = want.size === 0;
  const t0 = Date.now();

  const has = (k) => all || want.has(k);
  const GROUPS = ['chars', 'players', 'npcs', 'monsters', 'bosses', 'props', 'terrain', 'icons', 'preview', 'check'];
  const nodeOnly = [...want].every((k) => ['terrain', 'icons', 'preview', 'check'].includes(k)) && !all;

  let browser = null;
  if (!nodeOnly) {
    // 헤드리스 전용. 창을 띄우지 않는다.
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    });
    const pages = [];
    for (let i = 0; i < jobs; i++) pages.push(await openPage(browser));
    console.log('렌더러:', await pages[0].evaluate(() => window.BAKE.info()));
    const chars = await pages[0].evaluate(() => window.BAKE.chars());
    const kindOf = { players: 'player', npcs: 'npc', monsters: 'monster', bosses: 'boss' };
    const unknown = [...want].filter((k) => !GROUPS.includes(k) && !(k in chars));
    if (unknown.length) throw new Error(`모르는 대상: ${unknown.join(', ')}\n쓸 수 있는 대상: ${GROUPS.join(' ')} 또는 캐릭터 id`);
    const picked = Object.keys(chars).filter((id) => all || want.has('chars') || want.has(id) || [...want].some((k) => kindOf[k] === chars[id]));
    const queue = [...picked];
    await Promise.all(pages.map(async (page) => {
      while (queue.length) {
        const id = queue.shift();
        const t = Date.now();
        const r = await page.evaluate((i) => window.BAKE.bakeChar(i), id);
        await writeSheet(join(ART, 'chars', id + '.png'), r.w, r.h, r.rgba);
        await writeJson(join(ART, 'chars', id + '.json'), r.json);
        console.log(`  ${id}: ${r.w}x${r.h} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
      }
    }));
    if (has('props')) {
      const hasProps = await pages[0].evaluate(() => !!window.BAKE.bakeProps);
      if (hasProps) {
        const t = Date.now();
        const r = await pages[0].evaluate(() => window.BAKE.bakeProps());
        await writeSheet(join(ART, 'props/props.png'), r.w, r.h, r.rgba);
        await writeJson(join(ART, 'props/props.json'), r.json);
        console.log(`  props: ${r.w}x${r.h}, ${Object.keys(r.json).length}개 (${((Date.now() - t) / 1000).toFixed(1)}s)`);
      }
    }
    await browser.close();
  }
  if (has('terrain')) {
    const { bakeTerrain } = await import('./terrain.mjs');
    await bakeTerrain(ART);
    console.log('  terrain 완료');
  }
  if (has('icons')) {
    const { bakeIcons } = await import('./icons.mjs');
    await bakeIcons(ART);
    console.log('  icons 완료');
  }
  const checkOnly = want.size === 1 && want.has('check');
  if (!checkOnly) {
    const { makePreviews } = await import('./preview.mjs');
    await makePreviews(ROOT, args);
  }
  if (all || want.has('check')) {
    const { runCheck } = await import('./check.mjs');
    const ok = await runCheck(ROOT);
    if (!ok) process.exitCode = 1;
  }
  console.log(`끝 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
