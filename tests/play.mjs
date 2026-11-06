// 브라우저 통합 시험: 실제 화면을 헤드리스로 띄워 시작부터 전투까지 진행하고 스크린샷을 남긴다.
// 실행: node tests/play.mjs [출력 폴더]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? join(tmpdir(), 'lantern-shots');
mkdirSync(OUT, { recursive: true });
const PORT = 2601;
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'lantern-play-'));
const server = spawn('npx', ['tsx', 'server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT), LANTERN_DB: join(dir, 't.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '통과' : '실패'}  ${name}${extra ? ` (${extra})` : ''}`);
  if (!ok) failed++;
};

for (let i = 0; i < 80; i++) {
  try {
    await fetch(`${BASE}/api/ping`);
    break;
  } catch {
    await sleep(200);
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-webgl', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack ?? ''}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()} ${m.location()?.url ?? ''}`);
});

const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const world = (expr) => page.evaluate(expr);

try {
  await page.goto(BASE);
  await page.waitForFunction(() => !!document.querySelector('.btn.gold.big:not([disabled])'), null, { timeout: 90000 });
  await sleep(2000);
  await shot('01_title');
  check('시작 화면', true);

  await page.click('.btn.gold.big');
  await page.waitForSelector('.createbox', { timeout: 10000 });
  await sleep(600);
  await shot('02_create');
  await page.click('.clscard:nth-child(1)');
  await page.fill('.namefield input', '시험기사');
  await shot('03_create_filled');
  await page.click('.createopts .btn.gold');
  await page.waitForSelector('.actionbar', { timeout: 20000 });
  await page.waitForFunction(() => window.__world?.ready === true, null, { timeout: 20000 });
  await sleep(1500);
  await shot('04_town');
  const self = await world(`({u: __world.me.u, v: __world.me.v, map: __world.map.name, npcs: __world.npcs.size, props: __stage.chunks.length, grounds: __stage.terrainMesh ? 1 : 0})`);
  check('마을 진입', self.map === 'town', JSON.stringify(self));

  // 걷기: 키보드 입력으로 실제로 움직이는지
  const before = await world(`[__world.me.u, __world.me.v]`);
  await page.keyboard.down('KeyD');
  await sleep(700);
  await page.keyboard.up('KeyD');
  await sleep(150);
  const after = await world(`[__world.me.u, __world.me.v]`);
  check('D 키로 화면 오른쪽 이동(+u)', after[0] > before[0] && Math.abs(after[1] - before[1]) < 0.01, `${before} → ${after}`);
  await shot('05_walk');

  // NPC 대화와 퀘스트: 어른에게 걸어간다 (시험용으로 위치를 옮기지 않고 입력으로)
  // 지도 충돌 격자로 길을 찾아 키보드로만 걷는다
  const route = (u, v) =>
    page.evaluate(
      ([tu, tv]) => {
        const w = window.__world;
        const { rows, res } = w.map.solid;
        const W = rows[0].length;
        const H = rows.length;
        const clear = (x, y) => {
          // 캐릭터 몸통만큼 여유를 두고 지나간다
          for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (rows[y + dy]?.charCodeAt(x + dx) !== 48) return false;
          }
          return true;
        };
        const start = [Math.floor(w.me.u * res), Math.floor(w.me.v * res)];
        const goal = [Math.floor(tu * res), Math.floor(tv * res)];
        const key = (x, y) => y * W + x;
        const prev = new Map([[key(...start), -1]]);
        const q = [start];
        let found = false;
        for (let i = 0; i < q.length && i < 40000; i++) {
          const [x, y] = q[i];
          if (Math.abs(x - goal[0]) <= 1 && Math.abs(y - goal[1]) <= 1) {
            goal[0] = x;
            goal[1] = y;
            found = true;
            break;
          }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny)) || !clear(nx, ny)) continue;
            prev.set(key(nx, ny), key(x, y));
            q.push([nx, ny]);
          }
        }
        if (!found) return [[tu, tv]];
        const out = [];
        let c = key(...goal);
        while (c !== -1 && c !== undefined) {
          out.push([(c % W + 0.5) / res, (Math.floor(c / W) + 0.5) / res]);
          c = prev.get(c);
        }
        out.reverse();
        return out.filter((_, i) => i % 3 === 0 || i === out.length - 1);
      },
      [u, v],
    );

  const walkTo = async (u, v, stop = 0.7, ms = 20000) => {
    const end = Date.now() + ms;
    const held = new Set();
    const setKey = async (k, on) => {
      if (on && !held.has(k)) {
        held.add(k);
        await page.keyboard.down(k);
      } else if (!on && held.has(k)) {
        held.delete(k);
        await page.keyboard.up(k);
      }
    };
    const startMap = await world(`__world.map.name`);
    const path = await route(u, v);
    outer: for (const [wu, wv] of path) {
      while (Date.now() < end) {
        const [mu, mv, mapNow] = await world(`[__world.me.u, __world.me.v, __world.map.name]`);
        if (mapNow !== startMap) break outer;
        if (Math.hypot(u - mu, v - mv) < stop) break;
        const du = wu - mu;
        const dv = wv - mv;
        if (Math.hypot(du, dv) < 0.45) break;
        const sx = du;
        const sy = dv;
        await setKey('KeyD', sx > 0.18);
        await setKey('KeyA', sx < -0.18);
        await setKey('KeyS', sy > 0.18);
        await setKey('KeyW', sy < -0.18);
        await sleep(30);
      }
    }
    for (const k of [...held]) await setKey(k, false);
    await sleep(120);
    const [mu, mv] = await world(`[__world.me.u, __world.me.v]`);
    return Math.hypot(u - mu, v - mv) < stop + 1;
  };

  const arrived = await walkTo(27.3, 27.2, 0.5);
  check('어른에게 걸어감', arrived);
  await sleep(300);
  check('대화 안내 표시', !!(await page.$('.promptbox')));
  await shot('06_prompt');
  await page.keyboard.press('KeyG');
  await page.waitForSelector('.npcwin', { timeout: 3000 });
  await sleep(300);
  await shot('07_dialog');
  await page.click('.talk .btn.gold');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(200);
  check('퀘스트 추적 표시', (await page.locator('.tq').first().innerText()).includes('첫 등불'));

  // 패널들
  for (const [key, sel, name] of [
    ['KeyI', '.bagwin', '08_bag'],
    ['KeyC', '.equipwin', '09_equip'],
    ['KeyK', '.skillwin', '10_skills'],
    ['KeyL', '.questwin', '11_quests'],
    ['KeyM', '.mapwin', '12_map'],
    ['KeyP', '.partywin', '13_party'],
  ]) {
    await page.keyboard.press(key);
    await sleep(250);
    check(`창 열기 ${sel}`, !!(await page.$(sel)));
    await shot(name);
    await page.keyboard.press(key);
    await sleep(80);
  }

  // 숲으로 이동
  await walkTo(58, 30, 0.8, 35000);
  await page.waitForFunction(() => window.__world?.map?.name === 'woods' && window.__world?.ready, null, { timeout: 15000 });
  await sleep(1200);
  await shot('14_woods');
  check('숲으로 이동', true);

  // 가장 가까운 버섯과 싸운다
  const fight = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await page.$('.deathscreen')) {
        await page.click('.deathscreen .btn');
        return false;
      }
      const hp = await world(`(() => { const p = __world.room.state.players.get(__world.sid); return p ? p.hp / p.maxHp : 1 })()`);
      if (hp < 0.45) await page.keyboard.press('Digit1');
      const t = await world(`(() => { let b=null,bd=1e9; const w=__world; w.room.state.monsters.forEach((m,id)=>{ if(m.hp<=0) return; const d=Math.hypot(m.u-w.me.u,m.v-w.me.v); if(d<bd){bd=d;b={u:m.u,v:m.v,d,id}} }); return b })()`);
      if (!t) {
        await sleep(200);
        continue;
      }
      if (t.d > 1.3) {
        await walkTo(t.u, t.v, 1.1, 2500);
      } else {
        // 마우스를 대상 위로 옮겨 클릭
        const p = await world(`(() => { const cam=__world.cameras.main; const x=${t.u}*40, y=${t.v}*22-14; const pt=cam.getScreenPoint? null:null; const sx=(x-cam.worldView.x)*cam.zoom, sy=(y-cam.worldView.y)*cam.zoom; const k=window.innerWidth/__game.scale.width; return [sx*k, sy*k] })()`);
        await page.mouse.move(p[0], p[1]);
        await page.mouse.down();
        await sleep(450);
        await page.mouse.up();
      }
    }
    return true;
  };
  await fight(6000);
  await shot('15_combat');
  const perf = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    let n = 0;
    const tick = () => {
      n++;
      if (performance.now() - t0 > 2500) res({ fps: Math.round((n * 1000) / (performance.now() - t0)), calls: __stage.stats.calls, tris: __stage.stats.tris });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  console.log('참고  프레임', JSON.stringify(perf));
  const alive = await fight(30000);
  await shot('16_combat2');
  check('물약을 쓰며 살아남음', alive);
  const hud = await page.evaluate(() => document.querySelector('.tq span')?.textContent);
  check('처치가 퀘스트에 반영', /[1-5]\/5|완료/.test(hud ?? ''), hud);
  const level = await page.locator('.vname .lv').innerText();
  console.log('참고  레벨', level);
} catch (e) {
  console.log('중단:', e.message);
  failed++;
  await shot('zz_fail').catch(() => {});
}

const uniq = [...new Set(errors)];
check('브라우저 오류 없음', uniq.length === 0, uniq.slice(0, 6).join(' | ').slice(0, 1800));
await browser.close();
server.kill('SIGTERM');
rmSync(dir, { recursive: true, force: true });
if (/Error|예외/.test(serverLog)) console.log('--- 서버 로그 ---\n' + serverLog.slice(-2000));
console.log(failed ? `실패 ${failed}건` : '모두 통과', '· 스크린샷:', OUT);
process.exit(failed ? 1 : 0);
