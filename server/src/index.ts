// 서버 진입점: 로그인·캐릭터 REST API + Colyseus 방 + 정적 파일
import { Server, defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASS_IDS, type ClassId } from '../../shared/classes';
import { gearKey } from '../../shared/items';
import { newChar } from './char';
import * as db from './db';
import * as hub from './hub';
import { GameRoom } from './room';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 2567);
const NAME_RE = /^[가-힣a-zA-Z0-9]{2,10}$/;

const app = express();
app.use(express.json({ limit: '16kb' }));

const authed = (req: express.Request) => db.accountByToken((req.headers.authorization ?? '').replace(/^Bearer /, ''));

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, online: hub.onlineCount() });
});

app.post('/api/guest', (_req, res) => {
  const a = db.createGuest();
  res.json({ token: a.token, guest: true });
});

app.post('/api/register', (req, res) => {
  const { login, pw } = req.body ?? {};
  const guestToken = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const r = db.register(String(login ?? ''), String(pw ?? ''), guestToken || undefined);
  if ('error' in r) return void res.status(400).json({ err: r.error });
  res.json({ token: r.token, guest: false, login: r.login });
});

app.post('/api/login', (req, res) => {
  const { login, pw } = req.body ?? {};
  const r = db.login(String(login ?? ''), String(pw ?? ''));
  if ('error' in r) return void res.status(400).json({ err: r.error });
  res.json({ token: r.token, guest: !!r.guest, login: r.login });
});

app.get('/api/me', (req, res) => {
  const a = authed(req);
  if (!a) return void res.status(401).json({ err: '로그인이 필요해요' });
  res.json({ guest: !!a.guest, login: a.login });
});

app.delete('/api/account', (req, res) => {
  const a = authed(req);
  if (!a) return void res.status(401).json({ err: '로그인이 필요해요' });
  db.deleteAccount(a.id);
  res.json({ ok: true });
});

const charSummary = (c: ReturnType<typeof db.listChars>[number]) => ({ id: c.id, name: c.name, cls: c.cls, look: c.look, level: c.level, map: c.map, gear: gearKey(c.equip) });

app.get('/api/chars', (req, res) => {
  const a = authed(req);
  if (!a) return void res.status(401).json({ err: '로그인이 필요해요' });
  res.json({ chars: db.listChars(a.id).map(charSummary) });
});

app.post('/api/chars', (req, res) => {
  const a = authed(req);
  if (!a) return void res.status(401).json({ err: '로그인이 필요해요' });
  const name = String(req.body?.name ?? '').trim();
  const cls = req.body?.cls as ClassId;
  const look = Math.max(0, Math.min(2, Number(req.body?.look) || 0));
  if (!NAME_RE.test(name)) return void res.status(400).json({ err: '이름은 한글·영문·숫자 2~10자예요' });
  if (!CLASS_IDS.includes(cls)) return void res.status(400).json({ err: '직업을 고르세요' });
  if (db.listChars(a.id).length >= 6) return void res.status(400).json({ err: '캐릭터는 6개까지예요' });
  if (db.nameTaken(name)) return void res.status(400).json({ err: '이미 있는 이름이에요' });
  const c = newChar(db.newId(), a.id, name, cls, look);
  db.insertChar(c);
  res.json({ char: charSummary(c) });
});

app.delete('/api/chars/:id', (req, res) => {
  const a = authed(req);
  if (!a) return void res.status(401).json({ err: '로그인이 필요해요' });
  db.deleteChar(a.id, req.params.id);
  res.json({ ok: true });
});

app.get('/api/rift', (_req, res) => {
  res.json({ board: db.riftBoard(10) });
});

// 빌드된 클라이언트가 있으면 함께 서비스한다
const dist = join(here, '../../client/dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: 'index.html' }));
}

const httpServer = createServer(app);

export const gameServer: Server = defineServer({
  transport: new WebSocketTransport({ server: httpServer }),
  rooms: {
    town: defineRoom(GameRoom, { map: 'town' }),
    woods: defineRoom(GameRoom, { map: 'woods' }),
    ashfield: defineRoom(GameRoom, { map: 'ashfield' }),
    instance: defineRoom(GameRoom),
  },
});

await gameServer.listen(PORT);
console.log(`등불길 서버: http://localhost:${PORT}`);
