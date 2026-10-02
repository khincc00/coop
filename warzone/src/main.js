import { buildArt, flash } from './art.js';
import { Input } from './input.js';
import { Game, VW, VH } from './game.js';
import { drawGame, drawHud } from './render.js';
import { initAudio, toggleMute } from './audio.js';

const screen = document.getElementById('screen');
const sctx = screen.getContext('2d');
const low = document.createElement('canvas');
low.width = VW;
low.height = VH;
const lctx = low.getContext('2d');

let S = 2;
let ox = 0;
let oy = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  screen.width = Math.floor(innerWidth * dpr);
  screen.height = Math.floor(innerHeight * dpr);
  screen.style.width = innerWidth + 'px';
  screen.style.height = innerHeight + 'px';
  const fit = Math.min(screen.width / VW, screen.height / VH);
  S = fit >= 2 ? Math.floor(fit) : fit; // integer scaling when there's room, keeps pixels square
  ox = Math.floor((screen.width - VW * S) / 2);
  oy = Math.floor((screen.height - VH * S) / 2);
}
addEventListener('resize', resize);
resize();

await document.fonts.load('16px "Press Start 2P"').catch(() => {});
const A = buildArt();
A.flash = flash;
const input = new Input();
const game = new Game(A, input);

addEventListener('keydown', (e) => {
  initAudio();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.mode === 'play') game.paused = !game.paused;
  }
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('pointerdown', initAudio);

function render() {
  drawGame(lctx, game);
  sctx.fillStyle = '#14101c';
  sctx.fillRect(0, 0, screen.width, screen.height);
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(low, ox, oy, VW * S, VH * S);
  drawHud(sctx, game, S, ox, oy);
}

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let manual = false; // set by advanceTime() so automated tests drive the clock
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!manual) {
    acc += dt;
    while (acc >= STEP) {
      game.update(STEP);
      acc -= STEP;
    }
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.getElementById('boot')?.remove();

// ---- test hooks
window.advanceTime = (ms) => {
  manual = true;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) game.update(STEP);
  render();
};
window.render_game_to_text = () => JSON.stringify(game.textState());
window.__wz = game;
