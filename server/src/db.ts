// SQLite 저장소. Node 내장 node:sqlite를 쓴다.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { CharData } from './char';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.LANTERN_DB ?? join(here, '../../data/lantern.sqlite');
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    login TEXT UNIQUE,
    pwhash TEXT,
    token TEXT UNIQUE NOT NULL,
    guest INTEGER NOT NULL DEFAULT 1,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chars (
    id TEXT PRIMARY KEY,
    account TEXT NOT NULL,
    name TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS chars_account ON chars(account);
  CREATE TABLE IF NOT EXISTS rift_board (
    char TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cls TEXT NOT NULL,
    floor INTEGER NOT NULL,
    at INTEGER NOT NULL
  );
`);

const hash = (pw: string, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
const verify = (pw: string, stored: string) => {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex');
  const b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
};
const newId = () => randomBytes(9).toString('base64url');
const newToken = () => randomBytes(24).toString('base64url');

export interface Account {
  id: string;
  login: string | null;
  token: string;
  guest: number;
}

export function createGuest(): Account {
  const a: Account = { id: newId(), login: null, token: newToken(), guest: 1 };
  db.prepare('INSERT INTO accounts (id, token, guest, created) VALUES (?, ?, 1, ?)').run(a.id, a.token, Date.now());
  return a;
}

export function accountByToken(token: unknown): Account | undefined {
  if (typeof token !== 'string' || !token) return undefined;
  return db.prepare('SELECT id, login, token, guest FROM accounts WHERE token = ?').get(token) as Account | undefined;
}

export function register(login: string, pw: string, guestToken?: string): Account | { error: string } {
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(login)) return { error: '아이디는 영문·숫자 3~16자예요' };
  if (pw.length < 6 || pw.length > 64) return { error: '비밀번호는 6자 이상이에요' };
  if (db.prepare('SELECT 1 FROM accounts WHERE login = ?').get(login)) return { error: '이미 쓰는 아이디예요' };
  const guest = accountByToken(guestToken);
  if (guest?.guest) {
    db.prepare('UPDATE accounts SET login = ?, pwhash = ?, guest = 0 WHERE id = ?').run(login, hash(pw), guest.id);
    return { ...guest, login, guest: 0 };
  }
  const a: Account = { id: newId(), login, token: newToken(), guest: 0 };
  db.prepare('INSERT INTO accounts (id, login, pwhash, token, guest, created) VALUES (?, ?, ?, ?, 0, ?)').run(a.id, login, hash(pw), a.token, Date.now());
  return a;
}

export function login(loginName: string, pw: string): Account | { error: string } {
  const row = db.prepare('SELECT id, login, token, guest, pwhash FROM accounts WHERE login = ?').get(loginName) as (Account & { pwhash: string }) | undefined;
  if (!row || !verify(pw, row.pwhash)) return { error: '아이디나 비밀번호가 틀렸어요' };
  return { id: row.id, login: row.login, token: row.token, guest: row.guest };
}

export function deleteAccount(id: string) {
  db.prepare('DELETE FROM chars WHERE account = ?').run(id);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

export function listChars(account: string): CharData[] {
  const rows = db.prepare('SELECT data FROM chars WHERE account = ? ORDER BY seen DESC').all(account) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function loadChar(id: string): CharData | undefined {
  const row = db.prepare('SELECT data FROM chars WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}

export const nameTaken = (name: string) => !!db.prepare('SELECT 1 FROM chars WHERE name = ?').get(name);

export function insertChar(c: CharData) {
  db.prepare('INSERT INTO chars (id, account, name, data, seen) VALUES (?, ?, ?, ?, ?)').run(c.id, c.account, c.name, JSON.stringify(c), Date.now());
}

export function saveChar(c: CharData) {
  db.prepare('UPDATE chars SET data = ?, seen = ? WHERE id = ?').run(JSON.stringify(c), Date.now(), c.id);
}

export function deleteChar(account: string, id: string) {
  db.prepare('DELETE FROM chars WHERE id = ? AND account = ?').run(id, account);
  db.prepare('DELETE FROM rift_board WHERE char = ?').run(id);
}

export function recordRift(c: CharData, floor: number) {
  db.prepare(
    `INSERT INTO rift_board (char, name, cls, floor, at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(char) DO UPDATE SET floor = excluded.floor, at = excluded.at WHERE excluded.floor > floor`,
  ).run(c.id, c.name, c.cls, floor, Date.now());
}

export function riftBoard(limit = 10) {
  return db.prepare('SELECT name, cls, floor FROM rift_board ORDER BY floor DESC, at ASC LIMIT ?').all(limit) as { name: string; cls: string; floor: number }[];
}

export { newId };
