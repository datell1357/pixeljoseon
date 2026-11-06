// 게임 밖 화면: 시작, 캐릭터 고르기·만들기, 불러오기
import { useEffect, useState } from 'preact/hooks';
import { CLASSES, CLASS_IDS, type ClassId } from '@shared/classes';
import { pcSheet } from '@shared/items';
import { sfx } from '../audio';
import { createChar, deleteChar, enterGame, hasToken, login, logout, pingServer, resumeSession, startGuest, refreshChars } from '../net';
import { assetsReady, chars, enterError, isGuest, loadProgress, screen, serverDown, serverOnline, type CharSummary } from '../store';
import { CharPreview } from './common';
import { Hud } from './hud';

const MAP_LABEL: Record<string, string> = { town: '초롱골', woods: '솔모루 숲', ashfield: '화전골' };
/** 구운 그림의 색 변형과 맞춘 견본 */
const LOOK_COLORS: Record<ClassId, string[]> = {
  warrior: ['#3f6ab0', '#b83a3a', '#2f8a56'],
  mage: ['#4a3aa8', '#b03a5a', '#2f9a90'],
  archer: ['#5f8f4a', '#4a7ab0', '#a84a5a'],
};

function LoadLine() {
  if (assetsReady.value) return null;
  return (
    <div class="loadline" role="status">
      <i style={{ width: `${Math.round(loadProgress.value * 100)}%` }} />
      <span>그림 불러오는 중 {Math.round(loadProgress.value * 100)}%</span>
    </div>
  );
}

function Title() {
  const [form, setForm] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    void pingServer();
    const t = setInterval(pingServer, 15000);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    setBusy(true);
    setErr('');
    sfx('click');
    try {
      const resumed = hasToken() && (await resumeSession());
      if (!resumed) await startGuest();
      const list = resumed ? chars.value : await refreshChars();
      screen.value = list.length ? 'chars' : 'create';
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(id.trim(), pw);
      screen.value = chars.value.length ? 'chars' : 'create';
    } catch (ex) {
      setErr(String((ex as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="screen title">
      <div class="titleglow" />
      <div class="titlebox">
        <h1 class="logo">등불길</h1>
        <p class="tagline">꺼져 가는 길에 다시 등불을 켜는 실시간 액션 RPG</p>
        {form ? (
          <form class="panel loginform" onSubmit={submit}>
            <label>
              아이디
              <input value={id} onInput={(e) => setId(e.currentTarget.value)} autoComplete="username" maxLength={16} autoFocus />
            </label>
            <label>
              비밀번호
              <input type="password" value={pw} onInput={(e) => setPw(e.currentTarget.value)} autoComplete="current-password" maxLength={64} />
            </label>
            {err ? <p class="err" role="alert">{err}</p> : null}
            <div class="row">
              <button type="button" class="btn" onClick={() => setForm(false)}>
                돌아가기
              </button>
              <button type="submit" class="btn gold" disabled={busy}>
                로그인
              </button>
            </div>
          </form>
        ) : (
          <div class="startbox">
            {err ? <p class="err" role="alert">{err}</p> : null}
            <button type="button" class="btn gold big" disabled={busy || serverDown.value || !assetsReady.value} onClick={start}>
              {busy ? '접속 중' : hasToken() ? '이어서 하기' : '바로 시작'}
            </button>
            <button type="button" class="link" onClick={() => setForm(true)}>
              계정이 있어요 · 로그인
            </button>
          </div>
        )}
        <p class={`server ${serverDown.value ? 'off' : 'on'}`}>
          <i />
          {serverDown.value ? '서버에 연결할 수 없어요' : serverOnline.value === null ? '서버 찾는 중' : `서버 연결됨 · ${serverOnline.value}명 접속 중`}
        </p>
      </div>
      <LoadLine />
    </div>
  );
}

function CharCard({ c, onPick, onDelete }: { c: CharSummary; onPick: () => void; onDelete: () => void }) {
  return (
    <div class="panel charcard">
      <button type="button" class="charpick" onClick={onPick} aria-label={`${c.name}로 시작`}>
        <CharPreview sheet={pcSheet(c.cls, c.look, c.gear)} scale={1.5} />
        <b>{c.name}</b>
        <span>
          Lv.{c.level} {CLASSES[c.cls].label}
        </span>
        <small>{MAP_LABEL[c.map] ?? '초롱골'}</small>
      </button>
      <button type="button" class="link danger" onClick={onDelete}>
        삭제
      </button>
    </div>
  );
}

function CharSelect() {
  const err = enterError.value;
  const [confirm, setConfirm] = useState<CharSummary | null>(null);
  const pick = async (c: CharSummary) => {
    enterError.value = '';
    sfx('click');
    await enterGame(c).catch(() => {});
  };
  return (
    <div class="screen chars">
      <h2 class="screenhead">캐릭터 고르기</h2>
      <div class="charlist">
        {chars.value.map((c) => (
          <CharCard key={c.id} c={c} onPick={() => void pick(c)} onDelete={() => setConfirm(c)} />
        ))}
        {chars.value.length < 6 ? (
          <button type="button" class="panel charnew" onClick={() => (screen.value = 'create')}>
            <span>+</span>새 캐릭터
          </button>
        ) : null}
      </div>
      {err ? <p class="err" role="alert">{err}</p> : null}
      <div class="row">
        <button type="button" class="btn" onClick={logout}>
          {isGuest.value ? '처음 화면' : '로그아웃'}
        </button>
      </div>
      {confirm ? (
        <div class="modalbg">
          <div class="panel confirm" role="alertdialog">
            <p>
              <b>{confirm.name}</b>을(를) 삭제할까요? 되돌릴 수 없어요.
            </p>
            <div class="row">
              <button type="button" class="btn" onClick={() => setConfirm(null)}>
                취소
              </button>
              <button
                type="button"
                class="btn danger"
                onClick={async () => {
                  await deleteChar(confirm.id);
                  setConfirm(null);
                  if (!chars.value.length) screen.value = 'create';
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CharCreate() {
  const [cls, setCls] = useState<ClassId>('warrior');
  const [look, setLook] = useState(0);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const c = CLASSES[cls];

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const made = await createChar(name.trim(), cls, look);
      sfx('levelup');
      await enterGame(made).catch(() => {});
    } catch (ex) {
      setErr(String((ex as Error).message));
      setBusy(false);
    }
  };

  return (
    <div class="screen create">
      <h2 class="screenhead">새 캐릭터</h2>
      <form class="panel createbox" onSubmit={submit}>
        <div class="createprev">
          <CharPreview sheet={pcSheet(cls, look)} scale={2} spin />
        </div>
        <div class="createopts">
          <div class="clsrow">
            {CLASS_IDS.map((id) => (
              <button type="button" key={id} class={`clscard ${id === cls ? 'on' : ''}`} onClick={() => setCls(id)} aria-pressed={id === cls}>
                <b>{CLASSES[id].label}</b>
                <small>{CLASSES[id].blurb}</small>
              </button>
            ))}
          </div>
          <dl class="clsstat">
            <div>
              <dt>체력</dt>
              <dd>{c.hp}</dd>
            </div>
            <div>
              <dt>기력</dt>
              <dd>{c.mp}</dd>
            </div>
            <div>
              <dt>공격</dt>
              <dd>{c.atk}</dd>
            </div>
            <div>
              <dt>방어</dt>
              <dd>{c.def}</dd>
            </div>
            <div>
              <dt>회피</dt>
              <dd>{c.dodge.label}</dd>
            </div>
          </dl>
          <div class="lookrow">
            <span>옷 색</span>
            {[0, 1, 2].map((i) => (
              <button type="button" key={i} class={`look ${i === look ? 'on' : ''}`} style={{ background: LOOK_COLORS[cls][i] }} onClick={() => setLook(i)} aria-label={`색 ${i + 1}`} aria-pressed={i === look} />
            ))}
          </div>
          <label class="namefield">
            이름
            <input value={name} maxLength={10} placeholder="한글·영문·숫자 2~10자" onInput={(e) => setName(e.currentTarget.value)} autoFocus />
          </label>
          {err ? <p class="err" role="alert">{err}</p> : null}
          <div class="row">
            <button
              type="button"
              class="btn"
              onClick={() => {
                screen.value = chars.value.length ? 'chars' : 'title';
              }}
            >
              돌아가기
            </button>
            <button type="submit" class="btn gold" disabled={busy || name.trim().length < 2}>
              {busy ? '만드는 중' : '만들기'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function App() {
  const s = screen.value;
  if (s === 'title') return <Title />;
  if (s === 'chars') return <CharSelect />;
  if (s === 'create') return <CharCreate />;
  if (s === 'loading')
    return (
      <div class="screen loading">
        <p>길을 밝히는 중</p>
      </div>
    );
  return <Hud />;
}
