// 앱 아이콘 만들기: 구운 등불 소품을 어두운 바탕에 얹는다. 실행: node tools/appicon.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const props = JSON.parse(readFileSync('client/public/art/props/props.json', 'utf8'));
const png = readFileSync('client/public/art/props/props.png').toString('base64');
const f = props.big_lantern;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
for (const size of [192, 512]) {
  const data = await page.evaluate(
    async ({ png, f, size }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.fillStyle = '#0b0a12';
      g.fillRect(0, 0, size, size);
      const glow = g.createRadialGradient(size / 2, size * 0.34, 0, size / 2, size * 0.34, size * 0.5);
      glow.addColorStop(0, 'rgba(255,190,100,0.75)');
      glow.addColorStop(0.5, 'rgba(255,150,60,0.18)');
      glow.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, size, size);
      g.imageSmoothingEnabled = false;
      const h = size * 0.86;
      const w = (f.w / f.h) * h;
      g.drawImage(img, f.x, f.y, f.w, f.h, (size - w) / 2, (size - h) / 2, w, h);
      return c.toDataURL('image/png').split(',')[1];
    },
    { png, f, size },
  );
  writeFileSync(`client/public/icon-${size}.png`, Buffer.from(data, 'base64'));
}
await browser.close();
console.log('완료');
