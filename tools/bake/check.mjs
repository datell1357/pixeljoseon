// 굽기 결과 검사. npm run bake -- check 또는 node tools/bake/check.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img } from './lib/img.mjs';
import { ANIMS, IDS, DIRS8, DIRS5, DIRV, PROP_IDS, TERRAIN_FULL, TERRAIN_EDGE, ITEM_IDS, SKILL_IDS, insideTile } from './lib/spec.mjs';

export async function runCheck(root) {
  const ART = join(root, 'client/public/art');
  const fails = [];
  const warns = [];
  const fail = (s) => fails.push(s);
  const warn = (s) => warns.push(s);
  const rows = [];

  // ---------- 방향표: 명세대로 화면을 보는가 ----------
  const screen = ([u, v]) => [(u - v) * 32, (u + v) * 16];
  const expectDir = { S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1], N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1] };
  for (const d of DIRS8) {
    const [x, y] = screen(DIRV[d]);
    const [ex, ey] = expectDir[d];
    if (Math.sign(x) !== ex || Math.sign(y) !== ey) fail(`방향표 ${d}: 화면 (${x},${y})`);
  }

  // ---------- 캐릭터 ----------
  const loadChar = (id) => {
    const j = join(ART, 'chars', id + '.json');
    const p = join(ART, 'chars', id + '.png');
    if (!existsSync(j) || !existsSync(p)) return null;
    return { meta: JSON.parse(readFileSync(j, 'utf8')), img: Img.load(p) };
  };
  const NO_FEET = new Set(['wisp', 'shade']);
  const WIDE_BODY = new Set(['boar', 'ashwolf', 'emberbug']);
  for (const [kind, ids] of Object.entries(IDS)) {
    for (const id of ids) {
      const c = loadChar(id);
      if (!c) {
        fail(`${id}: 파일 없음`);
        continue;
      }
      const { meta, img } = c;
      const boss = kind === 'boss';
      const cell = boss ? 192 : 96;
      const anchor = boss ? [96, 150] : [48, 76];
      if (meta.cell?.[0] !== cell || meta.cell?.[1] !== cell) fail(`${id}: cell ${meta.cell}`);
      if (meta.anchor?.[0] !== anchor[0] || meta.anchor?.[1] !== anchor[1]) fail(`${id}: anchor ${meta.anchor}`);
      if (meta.mirror !== boss) fail(`${id}: mirror ${meta.mirror}`);
      const dirs = boss ? DIRS5 : DIRS8;
      if (JSON.stringify(meta.dirs) !== JSON.stringify(dirs)) fail(`${id}: dirs ${meta.dirs}`);
      if (img.w > 4096 || img.h > 4096) fail(`${id}: 시트 ${img.w}x${img.h} > 4096`);
      if (img.w !== meta.cols * cell) fail(`${id}: 폭 ${img.w} != cols*cell`);
      const want = ANIMS[kind];
      const got = Object.keys(meta.anims);
      if (JSON.stringify(got.slice().sort()) !== JSON.stringify(Object.keys(want).sort())) fail(`${id}: 동작 목록 ${got}`);
      let total = 0;
      const stat = { id, kind, clip: 0, empty: 0, topJump: 0, botRange: 0, footMin: 99, footMax: -99, alpha: 0 };
      const idleTops = [];
      const idleBots = [];
      const idleAreas = [];
      for (const [name, a] of Object.entries(meta.anims)) {
        const w = want[name];
        if (!w) continue;
        if (a.frames !== w.frames) fail(`${id}.${name}: frames ${a.frames} != ${w.frames}`);
        if (a.dur !== w.dur) fail(`${id}.${name}: dur ${a.dur} != ${w.dur}`);
        if (!!a.loop !== !!w.loop) fail(`${id}.${name}: loop`);
        if (a.start !== total) fail(`${id}.${name}: start ${a.start} != ${total}`);
        total += a.frames * dirs.length;
        for (let di = 0; di < dirs.length; di++) {
          const tops = [];
          const bots = [];
          for (let f = 0; f < a.frames; f++) {
            const fi = a.start + di * a.frames + f;
            const ox = (fi % meta.cols) * cell;
            const oy = Math.floor(fi / meta.cols) * cell;
            if (oy + cell > img.h) {
              fail(`${id}.${name}: 프레임 ${fi}가 시트 밖`);
              continue;
            }
            let top = cell;
            let bot = -1;
            let area = 0;
            // 보스는 무기가 발밑까지 내려오므로 발끝은 가운데 띠에서만 잰다
            const band = boss ? 34 : cell;
            let clip = false;
            for (let y = 0; y < cell; y++)
              for (let x = 0; x < cell; x++) {
                const v = img.data[((oy + y) * img.w + ox + x) * 4 + 3];
                if (v === 0) continue;
                area++;
                if (v !== 255) stat.alpha++;
                if (y < top) top = y;
                if (y > bot && Math.abs(x - anchor[0]) <= band) bot = y;
                if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) clip = true;
              }
            if (area === 0) {
              stat.empty++;
              fail(`${id}.${name} ${dirs[di]} f${f}: 빈 프레임`);
              continue;
            }
            if (clip) {
              stat.clip++;
              fail(`${id}.${name} ${dirs[di]} f${f}: 칸 경계에 닿음`);
            }
            tops.push(top);
            bots.push(bot);
            if (name === 'idle' && f === 0) {
              idleTops.push(top);
              idleBots.push(bot);
              idleAreas.push(area);
            }
          }
          if (!a.loop || tops.length !== a.frames) continue;
          // 반복 동작: 키 튐과 발
          for (let f = 0; f < a.frames; f++) {
            const d = Math.abs(tops[f] - tops[(f + 1) % a.frames]);
            if (d > stat.topJump) stat.topJump = d;
            const jumpLimit = id === 'wisp' ? 5 : boss ? 4 : 2;
            if (d > jumpLimit) warn(`${id}.${name} ${dirs[di]}: f${f}→f${(f + 1) % a.frames} 머리 끝 ${d}px 튐`);
          }
          const br = Math.max(...bots) - Math.min(...bots);
          // 옆을 볼 때(화면 가로 이동)는 발바닥 높이가 거의 일정해야 한다
          const lateral = dirs[di] === 'E' || dirs[di] === 'W';
          if (lateral && br > stat.botRange) stat.botRange = br;
          if (!NO_FEET.has(id) && name === 'walk' && lateral && br > (boss ? 8 : 4)) warn(`${id}.walk ${dirs[di]}: 발바닥 높이 변화 ${br}px`);
          if (name === 'idle' && !NO_FEET.has(id)) {
            if (br > (boss ? 3 : 1)) warn(`${id}.idle ${dirs[di]}: 숨쉬는 동안 발이 ${br}px 움직임`);
            for (const b of bots) {
              const gap = b - anchor[1];
              stat.footMin = Math.min(stat.footMin, gap);
              stat.footMax = Math.max(stat.footMax, gap);
            }
          }
        }
      }
      if (total > meta.cols * Math.floor(img.h / cell)) fail(`${id}: 프레임 ${total}개가 격자 ${meta.cols}x${Math.floor(img.h / cell)}에 안 들어감`);
      // 방향 전환 일관성
      const topSpread = Math.max(...idleTops) - Math.min(...idleTops);
      const botSpread = Math.max(...idleBots) - Math.min(...idleBots);
      stat.dirTop = topSpread;
      stat.dirBot = botSpread;
      const limit = boss ? 22 : 16;
      if (!WIDE_BODY.has(id) && topSpread > limit) warn(`${id}: 방향별 머리 끝 차이 ${topSpread}px`);
      if (!WIDE_BODY.has(id) && botSpread > limit) warn(`${id}: 방향별 발끝 차이 ${botSpread}px`);
      // 발이 앵커에 닿는가
      if (!NO_FEET.has(id) && (stat.footMin < -3 || stat.footMax > (boss ? 30 : WIDE_BODY.has(id) ? 22 : 12))) warn(`${id}: 쉬는 자세 발끝-앵커 ${stat.footMin}~${stat.footMax}px`);
      if (stat.alpha > 0 && id !== 'shade') fail(`${id}: 반투명 픽셀 ${stat.alpha}개 (이진화 위반)`);
      rows.push(stat);
    }
  }

  // ---------- 얼굴 방향 실측: 눈 색 픽셀로 잰다 ----------
  const eyeTest = (id, rgb, tol = 0) => {
    const c = loadChar(id);
    if (!c) return;
    const { meta, img } = c;
    const [W] = meta.cell;
    const a = meta.anims.idle;
    const out = {};
    meta.dirs.forEach((d, di) => {
      const fi = a.start + di * a.frames;
      const ox = (fi % meta.cols) * W;
      const oy = Math.floor(fi / meta.cols) * W;
      let n = 0;
      let sx = 0;
      for (let y = 0; y < W; y++)
        for (let x = 0; x < W; x++) {
          const p = img.get(ox + x, oy + y);
          if (p[3] && Math.abs(p[0] - rgb[0]) <= tol && Math.abs(p[1] - rgb[1]) <= tol && Math.abs(p[2] - rgb[2]) <= tol) {
            n++;
            sx += x;
          }
        }
      out[d] = { n, x: n ? sx / n - meta.anchor[0] : null };
    });
    const line = meta.dirs.map((d) => `${d}:${out[d].n ? out[d].n + 'px@' + out[d].x.toFixed(1) : '없음'}`).join(' ');
    console.log(`[얼굴 방향] ${id} ${line}`);
    if (!out.S?.n) fail(`${id}: S인데 눈이 안 보임`);
    if (out.N?.n) fail(`${id}: N인데 눈이 보임`);
    if (out.E?.n && !(out.E.x > 0)) fail(`${id}: E인데 눈이 왼쪽`);
    if (out.W?.n && !(out.W.x < 0)) fail(`${id}: W인데 눈이 오른쪽`);
    if (out.SE?.n && !(out.SE.x > 0)) fail(`${id}: SE인데 눈이 왼쪽`);
    if (out.SW?.n && !(out.SW.x < 0)) fail(`${id}: SW인데 눈이 오른쪽`);
  };
  eyeTest('pc_warrior_a', [36, 26, 44]);
  eyeTest('pc_mage_a', [36, 26, 44]);
  eyeTest('pc_archer_a', [36, 26, 44]);
  eyeTest('ashwolf', [255, 58, 42]);

  // ---------- 소품 ----------
  const pj = join(ART, 'props/props.json');
  if (!existsSync(pj)) fail('props.json 없음');
  else {
    const props = JSON.parse(readFileSync(pj, 'utf8'));
    const img = Img.load(join(ART, 'props/props.png'));
    if (img.w > 4096 || img.h > 4096) fail(`props 시트 ${img.w}x${img.h}`);
    for (const id of PROP_IDS) if (!props[id]) fail(`소품 ${id} 없음`);
    for (const id of Object.keys(props)) if (!PROP_IDS.includes(id)) warn(`명세에 없는 소품 ${id}`);
    const boxes = [];
    for (const [id, p] of Object.entries(props)) {
      for (const k of ['x', 'y', 'w', 'h', 'ax', 'ay', 'hu']) if (typeof p[k] !== 'number') fail(`${id}: ${k} 숫자 아님`);
      if (!Array.isArray(p.fp) || p.fp.length !== 4 || !(p.fp[0] < p.fp[2]) || !(p.fp[1] < p.fp[3])) fail(`${id}: fp ${p.fp}`);
      if (typeof p.solid !== 'boolean') fail(`${id}: solid`);
      if (p.x < 0 || p.y < 0 || p.x + p.w > img.w || p.y + p.h > img.h) fail(`${id}: 시트 밖`);
      let area = 0;
      let semi = 0;
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++) {
          const a = img.alpha(p.x + x, p.y + y);
          if (a) area++;
          if (a && a !== 255) semi++;
        }
      if (!area) fail(`${id}: 빈 그림`);
      if (semi) fail(`${id}: 반투명 ${semi}px`);
      if (p.ax < 0 || p.ax > p.w) warn(`${id}: 앵커 x ${p.ax}가 그림 밖`);
      // 앵커 아래로 그림이 차지 영역보다 많이 내려가면 축척이 어긋난 것
      const maxDown = (p.fp[2] + p.fp[3]) * 16;
      const down = p.h - p.ay;
      if (down > maxDown + 32 && !/tree|arch|fern|bush|mush|bone|rubble|ember/.test(id)) warn(`${id}: 앵커 아래 ${down}px (차지 영역 ${maxDown}px)`);
      for (const b of boxes) if (p.x < b.x + b.w && b.x < p.x + p.w && p.y < b.y + b.h && b.y < p.y + p.h) fail(`${id}와 ${b.id} 겹침`);
      boxes.push({ id, ...p });
    }
    // 벽: 정확히 1칸, 높이 1.4
    for (const id of ['wall_stone', 'wall_ash']) {
      const p = props[id];
      if (!p) continue;
      if (JSON.stringify(p.fp) !== '[-0.5,-0.5,0.5,0.5]') fail(`${id}: fp`);
      if (p.w !== 64) fail(`${id}: 폭 ${p.w} != 64`);
      if (p.h !== 32 + 55) fail(`${id}: 높이 ${p.h} != 87`);
      if (p.hu !== 1.4) fail(`${id}: 높이값`);
      if (p.ax !== 32 || p.ay !== 71) fail(`${id}: 앵커 ${p.ax},${p.ay}`);
      // 윗면 위쪽 절반과 앞면이 빈틈 없는가
      let holes = 0;
      for (let x = 0; x < 64; x++) {
        const a = x < 32 ? x : 63 - x;
        const topY = 16 - Math.floor(a / 2) - 1;
        const botY = 16 + Math.floor(a / 2) + 55;
        for (let y = topY; y <= botY; y++) if (!img.alpha(p.x + x, p.y + y)) holes++;
      }
      if (holes) fail(`${id}: 구멍 ${holes}px`);
    }
    // 울타리: 이어 붙이는 방향으로 정확히 32,16 간격인지 (폭이 1칸 이상)
    if (props.fence_u && props.fence_u.w < 32) fail('fence_u가 1칸보다 짧음');
    if (props.fence_v && props.fence_v.w < 32) fail('fence_v가 1칸보다 짧음');
    rows.props = Object.keys(props).length;
  }

  // ---------- 지형 ----------
  const tj = join(ART, 'terrain/terrain.json');
  if (!existsSync(tj)) fail('terrain.json 없음');
  else {
    const t = JSON.parse(readFileSync(tj, 'utf8'));
    const img = Img.load(join(ART, 'terrain/terrain.png'));
    if (t.tw !== 64 || t.th !== 32 || t.cols !== 16) fail('terrain 격자값');
    if (img.w !== t.cols * t.tw) fail('terrain 폭');
    if (img.w > 4096 || img.h > 4096) fail('terrain 크기');
    const pos = (n) => [(n % t.cols) * t.tw, Math.floor(n / t.cols) * t.th];
    const px = (n, x, y) => {
      const [ox, oy] = pos(n);
      return img.get(ox + x, oy + y);
    };
    const nTiles = t.cols * Math.floor(img.h / t.th);
    for (const name of TERRAIN_FULL) {
      const f = t.full[name];
      if (!f || f.length !== 4) {
        fail(`full.${name}`);
        continue;
      }
      for (const n of f) {
        if (n >= nTiles) fail(`full.${name} 칸 ${n} 밖`);
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 64; x++) {
            const a = px(n, x, y)[3];
            if (insideTile(x, y) && a !== 255) fail(`full.${name}[${n}] (${x},${y}) 빈칸`);
            if (!insideTile(x, y) && a !== 0) fail(`full.${name}[${n}] (${x},${y}) 마름모 밖`);
          }
      }
    }
    for (const name of TERRAIN_EDGE) {
      const s = t.edge[name];
      if (typeof s !== 'number') {
        fail(`edge.${name}`);
        continue;
      }
      if (s + 16 > nTiles) fail(`edge.${name} 칸 범위 밖`);
      for (let m = 0; m < 16; m++) {
        const n = s + m;
        let filled = 0;
        let outside = 0;
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 64; x++) {
            const a = px(n, x, y)[3];
            if (a) filled++;
            if (!insideTile(x, y) && a) outside++;
          }
        if (outside) fail(`edge.${name}[${m}] 마름모 밖 ${outside}px`);
        if (m === 0 && filled) fail(`edge.${name}[0]이 비어 있지 않음`);
        if (m === 15 && filled !== 1088) fail(`edge.${name}[15]가 꽉 차지 않음 (${filled})`);
        if (m > 0 && m < 15 && !filled) fail(`edge.${name}[${m}] 빈칸`);
        // 꼭짓점 네 곳이 마스크와 맞는가
        const corners = [[32, 1, 1], [62, 16, 2], [32, 30, 4], [1, 16, 8]];
        for (const [x, y, bit] of corners) {
          const a = px(n, x, y)[3];
          if (m & bit ? a !== 255 : a !== 0) fail(`edge.${name}[${m}] 꼭짓점 bit ${bit} 알파 ${a}`);
        }
      }
    }
    // 이음새: 이웃이 겹치는 2px 줄의 색이 정확히 같은가
    const overlapMismatch = (a, b, dx, dy, alphaOnly = false) => {
      let bad = 0;
      let cnt = 0;
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 64; x++) {
          if (!insideTile(x, y) || !insideTile(x - dx, y - dy)) continue;
          const pa = px(a, x, y);
          const pb = px(b, x - dx, y - dy);
          cnt++;
          if (alphaOnly ? pa[3] !== pb[3] : pa[0] !== pb[0] || pa[1] !== pb[1] || pa[2] !== pb[2] || pa[3] !== pb[3]) bad++;
        }
      return [bad, cnt];
    };
    let fullBad = 0;
    let fullCnt = 0;
    for (const name of TERRAIN_FULL)
      for (const a of t.full[name] ?? [])
        for (const b of t.full[name] ?? [])
          for (const [dx, dy] of [[32, 16], [-32, 16]]) {
            const [bad, cnt] = overlapMismatch(a, b, dx, dy);
            fullBad += bad;
            fullCnt += cnt;
            if (bad) warn(`이음새 full ${name} ${a}+${b} (${dx},${dy}): ${bad}/${cnt}px 다름`);
          }
    let edgeBad = 0;
    let edgeCnt = 0;
    for (const name of TERRAIN_EDGE) {
      const s = t.edge[name];
      for (let a = 0; a < 16; a++)
        for (let b = 0; b < 16; b++) {
          // a의 동쪽 변(E,S) = b의 서쪽 변(N,W): 칸 오프셋 (32,16)
          const aE = (a >> 1) & 1;
          const aS = (a >> 2) & 1;
          const bN = b & 1;
          const bW = (b >> 3) & 1;
          if (aE === bN && aS === bW) {
            const [bad, cnt] = overlapMismatch(s + a, s + b, 32, 16, true);
            edgeBad += bad;
            edgeCnt += cnt;
            if (bad) warn(`이음새 edge ${name} ${a}+${b} (u축): 알파 ${bad}/${cnt}px 다름`);
          }
          // a의 남쪽 변(S,W) = b의 북쪽 변(E,N): 칸 오프셋 (-32,16)
          const aW = (a >> 3) & 1;
          const bE = (b >> 1) & 1;
          if (aS === bE && aW === bN) {
            const [bad, cnt] = overlapMismatch(s + a, s + b, -32, 16, true);
            edgeBad += bad;
            edgeCnt += cnt;
            if (bad) warn(`이음새 edge ${name} ${a}+${b} (v축): 알파 ${bad}/${cnt}px 다름`);
          }
        }
    }
    rows.seam = { fullBad, fullCnt, edgeBad, edgeCnt };
    // 줄 전체가 빈틈 없이 덮이는가 (폭 공식 검사): 중앙 영역을 격자로 깔아 구멍을 센다
    let holes = 0;
    for (let y = 40; y < 72; y++)
      for (let x = 64; x < 128; x++) {
        let covered = false;
        for (let a = -3; a <= 6 && !covered; a++)
          for (let b = -3; b <= 6 && !covered; b++) {
            const ox = (a - b) * 32 + 64;
            const oy = (a + b) * 16;
            if (insideTile(x - ox, y - oy)) covered = true;
          }
        if (!covered) holes++;
      }
    if (holes) fail(`마름모 격자 구멍 ${holes}px`);
    rows.gridHoles = holes;
  }

  // ---------- 아이콘 ----------
  for (const [name, ids] of [['items', ITEM_IDS], ['skills', SKILL_IDS]]) {
    const j = join(ART, 'icons', name + '.json');
    if (!existsSync(j)) {
      fail(`${name}.json 없음`);
      continue;
    }
    const m = JSON.parse(readFileSync(j, 'utf8'));
    const img = Img.load(join(ART, 'icons', name + '.png'));
    if (m.cell !== 32 || m.cols !== 8) fail(`${name} 격자값`);
    if (JSON.stringify(m.ids) !== JSON.stringify(ids)) fail(`${name} ids가 명세와 다름`);
    if (img.w !== 8 * 32 || img.h !== Math.ceil(ids.length / 8) * 32) fail(`${name} 크기 ${img.w}x${img.h}`);
    ids.forEach((id, k) => {
      const ox = (k % 8) * 32;
      const oy = Math.floor(k / 8) * 32;
      let area = 0;
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++) {
          const a = img.alpha(ox + x, oy + y);
          if (a) area++;
          if (a && a !== 255) fail(`${name}.${id}: 반투명`);
        }
      if (area < 40) fail(`${name}.${id}: 거의 비어 있음 (${area}px)`);
    });
  }

  // ---------- 보고 ----------
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n[캐릭터] id / 경계닿음 / 반복 머리 튐 최대 / 옆걸음 발 변화 / 쉬는 발-앵커 / 방향별 머리·발 차이');
  for (const r of rows) {
    console.log(`  ${pad(r.id, 15)} clip ${pad(r.clip, 3)} 튐 ${pad(r.topJump + 'px', 5)} 발변화 ${pad(r.botRange + 'px', 5)} 발-앵커 ${pad(r.footMin === 99 ? '-' : r.footMin + '~' + r.footMax, 7)} 방향차 ${r.dirTop}/${r.dirBot}${r.alpha ? '  반투명 ' + r.alpha + 'px' : ''}`);
  }
  console.log(`[소품] ${rows.props ?? 0}개`);
  if (rows.seam) console.log(`[지형 이음새] full 다른 픽셀 ${rows.seam.fullBad}/${rows.seam.fullCnt}, edge 알파 다른 픽셀 ${rows.seam.edgeBad}/${rows.seam.edgeCnt}, 격자 구멍 ${rows.gridHoles}`);
  const show = (t, l) => {
    if (!l.length) return;
    console.log(`\n${t} ${l.length}건`);
    for (const s of l.slice(0, 80)) console.log('  ' + s);
    if (l.length > 80) console.log(`  ... 외 ${l.length - 80}건`);
  };
  show('[경고]', warns);
  show('[실패]', fails);
  console.log(`\n결과: 실패 ${fails.length}, 경고 ${warns.length}`);
  return fails.length === 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const ok = await runCheck(root);
  process.exit(ok ? 0 : 1);
}
