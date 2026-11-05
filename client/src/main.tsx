import { render } from 'preact';
import './style.css';
import { createGame } from './game/boot';
import { isTouch } from './store';
import { App } from './ui/app';

isTouch.value = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;

render(<App />, document.getElementById('ui')!);
void createGame();

// 화면을 끌어 선택되지 않게
document.addEventListener('dragstart', (e) => {
  if (!(e.target as HTMLElement)?.closest?.('input, textarea')) e.preventDefault();
});
