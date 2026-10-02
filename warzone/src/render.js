import { TILE as t } from './levels.js';
import { TS } from './world.js';
import { VW, VH } from './game.js';
import { WEAPONS } from './players.js';
import { flash, PAL } from './art.js';

const FONT = '"Press Start 2P", monospace';

function drawFlip(ctx, img, x, y, flip) {
  x = Math.round(x);
  y = Math.round(y);
  if (!flip) return ctx.drawImage(img, x, y);
  ctx.save();
  ctx.translate(x + img.width, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ------------------------------------------------------------------ background
function drawBg(ctx, g, v, camX, camY) {
  const A = g.A;
  const z = g.def.zone;
  const L = A.bg[z];
  const w = g.world;
  const yoff = Math.max(-40, Math.min(150, (w.pxH - VH - camY) * 0.1));
  ctx.drawImage(L[0], 0, 0, 640, 270, v.x, v.y - (VH - v.h) / 2, 640, 270);
  for (const [i, f] of [[1, 0.18], [2, 0.42]]) {
    const off = -((camX * f) % 640);
    for (let x = off; x < v.w; x += 640) ctx.drawImage(L[i], Math.round(v.x + x), Math.round(v.y + v.h - 270 + yoff * (i === 1 ? 0.6 : 1) + (VH - v.h) * 0.0));
  }
}

// ------------------------------------------------------------------ tiles
function drawTiles(ctx, g, camX, camY, vw, vh) {
  const A = g.A;
  const w = g.world;
  const z = g.def.zone;
  const Z = A.tiles[z];
  const x0 = Math.max(0, Math.floor(camX / TS));
  const x1 = Math.min(w.w - 1, Math.floor((camX + vw) / TS));
  const y0 = Math.max(0, Math.floor(camY / TS));
  const y1 = Math.min(w.h - 1, Math.floor((camY + vh) / TS));
  const qf = Math.floor(g.time * 3) % 2;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const id = w.tiles[y * w.w + x];
      if (!id || id === t.PIPE) continue;
      let img = null;
      let oy = 0;
      switch (id) {
        case t.GROUND: {
          const up = w.get(x, y - 1);
          img = up === t.GROUND || up === t.METAL || up === t.STEEL ? Z.ground : Z.groundTop;
          break;
        }
        case t.BRICK:
          img = A.brick;
          break;
        case t.QCOIN:
        case t.QPOWER:
          img = A.q[qf];
          break;
        case t.USED:
          img = A.used;
          break;
        case t.STEEL: {
          const r = w.hp[y * w.w + x] / 5;
          img = A.steel[r > 0.66 ? 0 : r > 0.33 ? 1 : 2];
          break;
        }
        case t.SANDBAG:
          img = A.sandbag[w.hp[y * w.w + x] < 3 ? 1 : 0];
          break;
        case t.WIRE:
          img = A.wire;
          break;
        case t.FRAGILE:
          img = A.fragile;
          break;
        case t.GIRDER:
          img = Z.girder;
          break;
        case t.METAL:
          img = Z.metal;
          break;
        case t.SPIKE:
          img = A.spike;
          break;
        case t.GATE:
          img = A.gate;
          break;
        case t.BRIDGE:
          img = A.bridge;
          break;
        case t.LAVA:
          img = A.lava[qf];
          break;
        case t.LOCK: {
          const a = 0.35 + 0.25 * Math.sin(g.time * 10 + y);
          ctx.fillStyle = `rgba(216,40,28,${a})`;
          ctx.fillRect(x * TS + 5, y * TS, 6, TS);
          ctx.fillStyle = `rgba(248,200,48,${a})`;
          ctx.fillRect(x * TS + 7, y * TS, 2, TS);
          continue;
        }
      }
      if (id === t.BRICK || id === t.QCOIN || id === t.QPOWER || id === t.USED) {
        const b = w.bump.get(`${x},${y}`);
        if (b) oy = -Math.sin((b / 0.15) * Math.PI) * 5;
      }
      if (img) ctx.drawImage(img, x * TS, y * TS + oy);
    }
}

// ------------------------------------------------------------------ objects
function drawObjects(ctx, g) {
  const A = g.A;
  const tm = g.time;
  for (const s of g.signs) ctx.drawImage(A.sign, s.x - 1, s.y - 1);
  for (const c of g.checkpoints) ctx.drawImage(A.flag[c.on ? 1 : 0], c.x, c.y);
  for (const l of g.levers) {
    ctx.drawImage(A.lever[l.on ? 1 : 0], l.x - 1, l.y - 1);
    if (!l.on && Math.floor(tm * 3) % 2) {
      ctx.fillStyle = PAL.Y;
      ctx.fillRect(l.x + 5, l.y - 9, 4, 5);
      ctx.fillRect(l.x + 5, l.y - 3, 4, 2);
    }
  }
  for (const v of g.valves) {
    ctx.drawImage(A.valve[Math.floor(v.spin * 2) % 4], v.x - 1, v.y - 1);
    if (v.progress > 0 && !v.done) {
      ctx.fillStyle = PAL.K;
      ctx.fillRect(v.x - 6, v.y - 8, 28, 5);
      ctx.fillStyle = v.holding ? PAL.L : PAL.O;
      ctx.fillRect(v.x - 5, v.y - 7, 26 * (v.progress / v.time), 3);
    }
  }
  for (const tg of g.targets) {
    ctx.drawImage(A.target[tg.hit ? 1 : 0], tg.x - 1, tg.y + 2);
    if (!tg.hit && Math.floor(tm * 2) % 2) {
      ctx.fillStyle = PAL.R;
      ctx.fillRect(tg.x + 5, tg.y - 8, 4, 5);
      ctx.fillRect(tg.x + 5, tg.y - 2, 4, 2);
    }
  }
  for (const p of g.plates) ctx.drawImage(A.plate[p.down ? 1 : 0], p.x - 1, p.y - 2);
  for (const s of g.seesaws) {
    const cx = s.x + s.w / 2;
    ctx.fillStyle = PAL.K;
    ctx.beginPath();
    ctx.moveTo(cx - 10, s.y + 8);
    ctx.lineTo(cx + 10, s.y + 8);
    ctx.lineTo(cx, s.y);
    ctx.fill();
    ctx.fillStyle = PAL.m;
    ctx.beginPath();
    ctx.moveTo(cx - 8, s.y + 7);
    ctx.lineTo(cx + 8, s.y + 7);
    ctx.lineTo(cx, s.y + 1);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, s.y + 2);
    ctx.rotate(s.tilt * 0.07);
    ctx.fillStyle = PAL.K;
    ctx.fillRect(-s.w / 2 - 1, -3, s.w + 2, 7);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? PAL.Y : PAL.R;
      ctx.fillRect(-s.w / 2 + i * 16, -2, 16, 5);
    }
    ctx.fillStyle = PAL.W;
    ctx.fillRect(-s.w / 2 + 2, -2, 10, 1);
    ctx.restore();
  }
  for (const w of g.pows) drawFlip(ctx, A.pow[w.freed ? 1 + (Math.floor(w.t * 4) % 2) : 0], w.x - 1, w.y - 1, w.freed && w.t > 1.4);
  for (const k of g.pickups) {
    if (k.kind === 'coin') ctx.drawImage(A.coin[Math.floor(tm * 8 + k.x) % 4], Math.round(k.x - 1), Math.round(k.y - 1));
    else if (k.kind === 'mushroom') ctx.drawImage(A.mushroom, Math.round(k.x - 1), Math.round(k.y - 1));
    else if (A.crates[k.kind]) {
      const bob = k.onGround ? Math.round(Math.sin(tm * 4 + k.x) * 1.5) : 0;
      ctx.drawImage(A.crates[k.kind], Math.round(k.x - 1), Math.round(k.y - 1 + bob));
    }
  }
  for (const c of g.corpses) drawFlip(ctx, c.img, c.x - 1, c.y - c.img.height + 1, c.face > 0);
}

function drawPipes(ctx, g) {
  const A = g.A;
  for (const p of g.pipes) {
    const x = p.x * TS;
    const y = p.y * TS;
    for (let i = 1; i < p.h; i++) {
      ctx.fillStyle = PAL.K;
      ctx.fillRect(x + 1, y + i * TS, 30, TS);
      ctx.drawImage(A.pipeBody[p.color], x + 2, y + i * TS);
    }
    ctx.drawImage(A.pipeTop[p.color], x - 1, y - 1);
  }
}

// ------------------------------------------------------------------ players
function playerImg(g, p) {
  const A = g.A;
  const [pose, f] = p.pose();
  const set = A[p.who][pose] || A[p.who].idle;
  let img = set[f % set.length];
  if (p.who === 'plumber' && p.star > 0) {
    const cols = ['#f8c830', '#f8f8f0', '#d8281c', null];
    const c = cols[Math.floor(g.time * 16) % 4];
    if (c) img = flash(img, c);
  } else if (p.flashT > 0) img = flash(img);
  return img;
}

function drawPlayer(ctx, g, p) {
  const A = g.A;
  if (p.state === 'out' || p.state === 'tank') return;
  if (p.state === 'downed') {
    const img = playerImg(g, p);
    const cx = p.cx;
    const cy = p.cy;
    ctx.globalAlpha = 0.85;
    drawFlip(ctx, img, cx - img.width / 2, cy - img.height / 2, p.face < 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(A.bubble, Math.round(cx - 13), Math.round(cy - 13));
    // bleed timer + revive progress
    ctx.fillStyle = PAL.K;
    ctx.fillRect(Math.round(cx - 14), Math.round(cy - 22), 28, 6);
    ctx.fillStyle = PAL.R;
    ctx.fillRect(Math.round(cx - 13), Math.round(cy - 21), 26 * Math.max(0, p.bleed / 15), 2);
    ctx.fillStyle = PAL.L;
    ctx.fillRect(Math.round(cx - 13), Math.round(cy - 19), 26 * Math.min(1, p.revive), 2);
    return;
  }
  if (p.inv > 0 && p.state === 'normal' && Math.floor(g.time * 20) % 2 && !(p.star > 0)) return;
  const img = playerImg(g, p);
  const x = p.cx - img.width / 2;
  const y = p.y + p.h - img.height + 1;
  if (p.pogoTrail > 0 && p.vy < 0) {
    ctx.globalAlpha = 0.35;
    drawFlip(ctx, flash(img, PAL.O), x, y + 10, p.face < 0);
    ctx.globalAlpha = 0.18;
    drawFlip(ctx, flash(img, PAL.Y), x, y + 20, p.face < 0);
    ctx.globalAlpha = 1;
  }
  drawFlip(ctx, img, x, y, p.face < 0);
  if (p.who === 'gunner') {
    const wimg = A.weapons[p.weapon];
    const hx = p.cx + p.face * 3;
    const hy = p.crouch ? p.y + 7 : p.y + 11;
    ctx.save();
    ctx.translate(Math.round(hx), Math.round(hy));
    if (p.face < 0) ctx.scale(-1, 1);
    if (p.aim === 'up') ctx.rotate(-Math.PI / 2);
    else if (p.aim === 'down') ctx.rotate(Math.PI / 2);
    ctx.drawImage(wimg, -2, -Math.floor(wimg.height / 2));
    ctx.restore();
  }
  // player marker so nobody loses track in the chaos
  const mx = Math.round(p.cx);
  const my = Math.round(p.y - (p.who === 'gunner' && p.carrying ? 26 : 9));
  ctx.fillStyle = PAL.K;
  ctx.fillRect(mx - 4, my - 4, 9, 4);
  ctx.fillRect(mx - 2, my, 5, 2);
  ctx.fillStyle = p.who === 'plumber' ? PAL.R : PAL.L;
  ctx.fillRect(mx - 3, my - 3, 7, 2);
  ctx.fillRect(mx - 1, my - 1, 3, 2);
}

// ------------------------------------------------------------------ projectiles / fx
function drawProjectiles(ctx, g) {
  const A = g.A;
  for (const b of g.bullets) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    switch (b.kind) {
      case 'pistol':
        ctx.fillStyle = PAL.K;
        ctx.fillRect(x - 1, y - 1, b.w + 2, b.h + 2);
        ctx.fillStyle = PAL.Y;
        ctx.fillRect(x, y, b.w, b.h);
        ctx.fillStyle = PAL.W;
        ctx.fillRect(x + 1, y + 1, b.w - 2, 1);
        break;
      case 'hmg':
        ctx.fillStyle = PAL.O;
        ctx.fillRect(x, y, b.w, b.h);
        ctx.fillStyle = PAL.W;
        ctx.fillRect(x + 1, y + 1, b.w - 2, 1);
        break;
      case 'shotgun':
        ctx.fillStyle = PAL.W;
        ctx.fillRect(x, y, 3, 3);
        break;
      case 'rocket': {
        ctx.save();
        ctx.translate(x + b.w / 2, y + b.h / 2);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = PAL.K;
        ctx.fillRect(-6, -3, 13, 6);
        ctx.fillStyle = PAL.G;
        ctx.fillRect(-5, -2, 9, 4);
        ctx.fillStyle = PAL.R;
        ctx.fillRect(4, -2, 2, 4);
        ctx.fillStyle = Math.floor(g.time * 30) % 2 ? PAL.Y : PAL.O;
        ctx.fillRect(-9, -1, 4, 2);
        ctx.restore();
        break;
      }
      case 'flame': {
        const r = b.w / 2;
        ctx.fillStyle = b.t < 0.1 ? PAL.W : b.t < 0.2 ? PAL.Y : PAL.O;
        ctx.globalAlpha = Math.max(0.2, 1 - b.t / 0.4);
        ctx.beginPath();
        ctx.arc(x + r, y + r, r, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'grenade':
        ctx.drawImage(A.grenade, x - 1, y - 2);
        break;
      case 'cannon':
        ctx.fillStyle = PAL.K;
        ctx.fillRect(x - 1, y - 1, b.w + 2, b.h + 2);
        ctx.fillStyle = PAL.Y;
        ctx.fillRect(x, y, b.w, b.h);
        ctx.fillStyle = PAL.O;
        ctx.fillRect(x, y + b.h - 2, b.w, 2);
        break;
    }
  }
  for (const s of g.shots) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    switch (s.kind) {
      case 'bullet':
        ctx.fillStyle = PAL.K;
        ctx.fillRect(x - 1, y - 1, 7, 6);
        ctx.fillStyle = Math.floor(s.t * 20) % 2 ? '#f86890' : PAL.R;
        ctx.fillRect(x, y, 5, 4);
        ctx.fillStyle = PAL.W;
        ctx.fillRect(x + 1, y + 1, 2, 1);
        break;
      case 'cannon':
        ctx.fillStyle = PAL.K;
        ctx.beginPath();
        ctx.arc(x + 3.5, y + 3.5, 4.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = PAL.m;
        ctx.fillRect(x + 1, y + 1, 2, 2);
        break;
      case 'grenade':
        ctx.drawImage(A.grenade, x - 1, y - 2);
        if (Math.floor(s.t * 12) % 2) {
          ctx.fillStyle = PAL.R;
          ctx.fillRect(x + 2, y - 3, 2, 2);
        }
        break;
      case 'fireball': {
        const f = Math.floor(s.t * 16) % 2;
        ctx.fillStyle = PAL.K;
        ctx.fillRect(x - 1, y - 1, 10, 10);
        ctx.fillStyle = f ? PAL.O : PAL.R;
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = PAL.Y;
        ctx.fillRect(x + 2, y + 2, 4, 4);
        break;
      }
      case 'shell':
        ctx.fillStyle = PAL.K;
        ctx.fillRect(x - 1, y - 1, 12, 9);
        ctx.fillStyle = PAL.M;
        ctx.fillRect(x, y, 10, 7);
        ctx.fillStyle = PAL.R;
        ctx.fillRect(s.vx > 0 ? x + 7 : x, y, 3, 7);
        break;
      case 'wave': {
        const h = 10 + Math.sin(s.t * 30) * 3;
        ctx.fillStyle = PAL.K;
        ctx.fillRect(x - 1, y + s.h - h - 1, s.w + 2, h + 1);
        ctx.fillStyle = PAL.O;
        ctx.fillRect(x, y + s.h - h, s.w, h);
        ctx.fillStyle = PAL.Y;
        ctx.fillRect(x + 3, y + s.h - h + 3, s.w - 6, h - 3);
        break;
      }
    }
  }
}

function drawFx(ctx, g) {
  const A = g.A;
  for (const q of g.particles) {
    if (q.color === 'coin') {
      ctx.drawImage(A.coin[Math.floor(q.life * 20) % 4], Math.round(q.x), Math.round(q.y));
      continue;
    }
    ctx.fillStyle = q.color;
    const s = q.size;
    ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s);
  }
  for (const f of g.fx) {
    const k = Math.min(4, Math.floor((f.t / f.dur) * 5));
    if (f.kind === 'boom') ctx.drawImage(A.boom[k], Math.round(f.x - 17), Math.round(f.y - 17));
    else if (f.kind === 'bigBoom') ctx.drawImage(A.bigBoom[k], Math.round(f.x - 33), Math.round(f.y - 33));
    else if (f.kind === 'muzzle') {
      const img = A.muzzle[Math.floor(f.t * 60) % 2];
      ctx.save();
      ctx.translate(Math.round(f.x), Math.round(f.y));
      if (f.dy) ctx.rotate(f.dy > 0 ? Math.PI / 2 : -Math.PI / 2);
      else if (f.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -2, -6);
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------ views
function drawView(ctx, g, v) {
  const sx = g.shakeAmp ? (Math.random() - 0.5) * g.shakeAmp * 2 : 0;
  const sy = g.shakeAmp ? (Math.random() - 0.5) * g.shakeAmp * 2 : 0;
  const camX = Math.round(v.camX + sx);
  const camY = Math.round(v.camY + sy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  drawBg(ctx, g, v, camX, camY);
  ctx.translate(v.x - camX, v.y - camY);
  drawTiles(ctx, g, camX, camY, v.w, v.h);
  drawObjects(ctx, g);
  for (const e of g.enemies) if (e.active || Math.abs(e.cx - (camX + v.w / 2)) < v.w) e.draw(ctx, g.A, g);
  if (g.boss) g.boss.draw(ctx, g.A, g);
  for (const tk of g.tanks) tk.draw(ctx, g.A);
  drawPlayer(ctx, g, g.gunner);
  drawPlayer(ctx, g, g.plumber);
  drawPipes(ctx, g);
  drawProjectiles(ctx, g);
  drawFx(ctx, g);
  ctx.restore();
  return { camX, camY };
}

export function drawGame(ctx, g) {
  ctx.imageSmoothingEnabled = false;
  if (g.mode === 'title') return drawTitle(ctx, g);
  if (!g.views.length) g.updateCamera(1);
  g.drawn = g.views.map((v) => ({ ...v, ...drawView(ctx, g, v) }));
  // split divider
  if (g.views.length === 2) {
    const v = g.views[1];
    ctx.fillStyle = PAL.K;
    if (v.x > 0) ctx.fillRect(v.x - 2, 0, 4, VH);
    else ctx.fillRect(0, v.y - 2, VW, 4);
    ctx.fillStyle = PAL.Y;
    if (v.x > 0) ctx.fillRect(v.x - 1, 0, 2, VH);
    else ctx.fillRect(0, v.y - 1, VW, 2);
  }
  if (g.flashT > 0) {
    ctx.fillStyle = `rgba(248,248,240,${Math.min(0.8, g.flashT * 5)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  if (g.mode === 'gameover' || g.mode === 'clear' || g.mode === 'victory' || g.paused) {
    ctx.fillStyle = 'rgba(20,16,28,0.72)';
    ctx.fillRect(0, 0, VW, VH);
  }
}

// ------------------------------------------------------------------ title (low-res part)
function drawTitle(ctx, g) {
  const A = g.A;
  const L = A.bg[0];
  const off = (g.titleT * 20) % 640;
  ctx.drawImage(L[0], 0, 0);
  for (const [i, f] of [[1, 0.4], [2, 1]]) {
    const o = -((off * f) % 640);
    ctx.drawImage(L[i], Math.round(o), 0);
    ctx.drawImage(L[i], Math.round(o + 640), 0);
  }
  // ground strip
  const Z = A.tiles[0];
  for (let x = 0; x < VW; x += 16) {
    ctx.drawImage(Z.groundTop, x - (Math.floor(off * 2) % 16), VH - 32);
    ctx.drawImage(Z.ground, x - (Math.floor(off * 2) % 16), VH - 16);
  }
  ctx.drawImage(Z.groundTop, VW - (Math.floor(off * 2) % 16), VH - 32);
  ctx.drawImage(Z.ground, VW - (Math.floor(off * 2) % 16), VH - 16);
  ctx.fillStyle = 'rgba(20,16,28,0.35)';
  ctx.fillRect(0, 0, VW, VH);
}

// ================================================================== HUD (screen resolution)
export function drawHud(sctx, g, S, ox, oy) {
  sctx.imageSmoothingEnabled = false;
  const X = (x) => ox + x * S;
  const Y = (y) => oy + y * S;
  const text = (s, x, y, size = 8, color = PAL.W, align = 'left', shadow = true) => {
    sctx.font = `${Math.round(size * S)}px ${FONT}`;
    sctx.textAlign = align;
    sctx.textBaseline = 'top';
    if (shadow) {
      sctx.fillStyle = PAL.K;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) sctx.fillText(s, X(x) + dx * Math.max(1, S * 0.5), Y(y) + dy * Math.max(1, S * 0.5));
    }
    sctx.fillStyle = color;
    sctx.fillText(s, X(x), Y(y));
  };
  const img = (im, x, y, scale = 1) => sctx.drawImage(im, X(x), Y(y), im.width * S * scale, im.height * S * scale);
  const bar = (x, y, w, h, frac, col, back = '#3a3040') => {
    sctx.fillStyle = PAL.K;
    sctx.fillRect(X(x - 1), Y(y - 1), (w + 2) * S, (h + 2) * S);
    sctx.fillStyle = back;
    sctx.fillRect(X(x), Y(y), w * S, h * S);
    sctx.fillStyle = col;
    sctx.fillRect(X(x), Y(y), w * S * Math.max(0, Math.min(1, frac)), h * S);
  };
  const wrap = (s, max, size) => {
    sctx.font = `${Math.round(size * S)}px ${FONT}`;
    const words = s.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (sctx.measureText(test).width / S > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const A = g.A;

  if (g.mode === 'title') return drawTitleHud(g, text, img, bar, wrap, S, X, Y, sctx);

  // world-space floating texts (crisp at screen res), per view
  if (g.drawn)
    for (const v of g.drawn) {
      sctx.save();
      sctx.beginPath();
      sctx.rect(X(v.x), Y(v.y), v.w * S, v.h * S);
      sctx.clip();
      for (const tx of g.texts) {
        const sx = tx.x - v.camX + v.x;
        const sy = tx.y - v.camY + v.y;
        sctx.globalAlpha = Math.min(1, tx.life * 2);
        text(tx.text, sx, sy, 6, tx.color, 'center');
      }
      sctx.globalAlpha = 1;
      // P1 / P2 tags when split
      if (g.drawn.length === 2)
        for (const p of g.players) {
          const f = g.focus(p);
          const sx = f.x - v.camX + v.x;
          const sy = f.y - v.camY + v.y;
          if (sx > v.x && sx < v.x + v.w && sy > v.y && sy < v.y + v.h) text(p.who === 'plumber' ? 'P1' : 'P2', sx, sy - 30, 5, p.who === 'plumber' ? '#f87858' : PAL.L, 'center');
        }
      sctx.restore();
    }

  const pl = g.plumber;
  const gn = g.gunner;
  // ---- P1 panel
  sctx.fillStyle = 'rgba(20,16,28,0.55)';
  sctx.fillRect(X(4), Y(4), 118 * S, 38 * S);
  text('P1 PLUMBER', 8, 8, 6, '#f87858');
  for (let i = 0; i < pl.maxHp; i++) img(A.heart[i < pl.hp ? 1 : 0], 8 + i * 12, 17);
  const starReady = pl.meter >= 100 && !(pl.star > 0);
  text(pl.star > 0 ? `STAR ${pl.star.toFixed(1)}` : starReady ? 'G = STAR!' : 'STAR', 8, 31, 5, starReady || pl.star > 0 ? PAL.Y : PAL.M);
  bar(62, 31, 54, 4, pl.star > 0 ? pl.star / 8 : pl.meter / 100, pl.star > 0 ? PAL.W : starReady ? (Math.floor(g.time * 6) % 2 ? PAL.Y : PAL.O) : PAL.Y);
  img(A.star, 46, 16);
  // ---- P2 panel
  sctx.fillStyle = 'rgba(20,16,28,0.55)';
  sctx.fillRect(X(VW - 140), Y(4), 136 * S, 38 * S);
  text('P2 GUNNER', VW - 136, 8, 6, PAL.L);
  for (let i = 0; i < gn.maxHp; i++) img(A.heart[i < gn.hp ? 1 : 0], VW - 136 + i * 12, 17);
  const wname = gn.state === 'tank' ? 'SV-001' : gn.weapon === 'pistol' ? 'PISTOL' : gn.weapon.toUpperCase();
  text(gn.state === 'tank' ? wname : `${wname} ${gn.ammo === Infinity ? 'INF' : gn.ammo}`, VW - 8, 8, 6, PAL.Y, 'right');
  img(A.grenade, VW - 92, 16);
  text(`x${gn.grenades}`, VW - 80, 19, 6, PAL.W);
  img(A.weapons[gn.weapon], VW - 48, 18);
  const tankT = g.tanks.find((tk) => tk.driver && tk.timed);
  text('JET', VW - 136, 31, 5, PAL.M);
  bar(VW - 116, 31, 34, 4, gn.fuel / 2.5, PAL.U);
  const tankReady = gn.meter >= 100;
  text(tankT ? `${tankT.timer.toFixed(0)}s` : tankReady ? 'O=TANK' : 'TANK', VW - 76, 31, 5, tankReady || tankT ? PAL.L : PAL.M);
  bar(VW - 40, 31, 34, 4, tankT ? tankT.timer / 15 : gn.meter / 100, tankReady ? (Math.floor(g.time * 6) % 2 ? PAL.L : PAL.G) : PAL.G);
  // ---- center
  img(A.powIcon, VW / 2 - 58, 7);
  text(`x${Math.max(0, g.lives)}`, VW / 2 - 45, 9, 7, PAL.W);
  img(A.coin[0], VW / 2 - 12, 6);
  text(`x${g.coins}`, VW / 2 - 1, 9, 7, PAL.Y);
  text(String(g.score).padStart(7, '0'), VW / 2 + 70, 9, 7, PAL.W, 'right');
  text(g.def.short, VW / 2, 21, 5, PAL.M, 'center');

  // boss bar
  if (g.boss) {
    const b = g.boss;
    text(b.name, VW / 2, VH - 26, 6, '#f87858', 'center');
    bar(VW / 2 - 110, VH - 16, 220, 6, b.hp / b.maxHp, b.hp / b.maxHp > 0.33 ? PAL.R : Math.floor(g.time * 8) % 2 ? PAL.Y : PAL.R);
  }
  // valve progress
  const v = g.valves.find((q) => q.progress > 0 && !q.done);
  if (v) {
    text(v.holding ? `PIPE-SYNC ${Math.ceil(v.time - v.progress)}s` : 'PLUMBER! BALIK KE VALVE (TAHAN F)', VW / 2, 34, 6, v.holding ? PAL.L : PAL.O, 'center');
    bar(VW / 2 - 70, 44, 140, 4, v.progress / v.time, PAL.L);
  }
  // downed warnings
  let wy = 56;
  for (const p of g.players)
    if (p.state === 'downed') {
      const msg = p.who === 'plumber' ? `P1 DOWN! ${Math.ceil(p.bleed)}s  GUNNER: TEMBAK GELEMBUNGNYA` : `P2 DOWN! ${Math.ceil(p.bleed)}s  PLUMBER: STOMP / TAHAN F`;
      text(msg, VW / 2, wy, 6, Math.floor(g.time * 4) % 2 ? PAL.R : PAL.W, 'center');
      wy += 11;
    }
  if (g.waitHint > 0 && !g.boss) text('TUNGGU PARTNER! MASUK ARENA BERDUA', VW / 2, wy, 6, PAL.Y, 'center');

  // sign text
  let sign = null;
  for (const s of g.signs) for (const p of g.players) if (p.alive && Math.abs(p.cx - (s.x + 8)) < 30 && Math.abs(p.cy - (s.y + 8)) < 40) sign = s;
  if (sign && g.mode === 'play') {
    const lines = wrap(sign.text, 300, 6);
    const h = lines.length * 10 + 10;
    const y0 = VH - h - (g.boss ? 36 : 10);
    sctx.fillStyle = 'rgba(20,16,28,0.86)';
    sctx.fillRect(X(VW / 2 - 160), Y(y0), 320 * S, h * S);
    sctx.strokeStyle = PAL.Y;
    sctx.lineWidth = Math.max(1, S);
    sctx.strokeRect(X(VW / 2 - 160) + S / 2, Y(y0) + S / 2, 320 * S - S, h * S - S);
    lines.forEach((ln, i) => text(ln, VW / 2, y0 + 6 + i * 10, 6, PAL.W, 'center', false));
  }

  // banner
  if (g.banner && g.mode === 'play') {
    const a = Math.min(1, g.banner.t * 2);
    sctx.globalAlpha = a;
    sctx.fillStyle = 'rgba(20,16,28,0.75)';
    sctx.fillRect(X(0), Y(VH / 2 - 22), VW * S, 40 * S);
    text(g.banner.text, VW / 2, VH / 2 - 14, g.banner.boss ? 11 : 10, g.banner.boss ? '#f87858' : PAL.Y, 'center');
    text(g.banner.boss ? 'KERJA SAMA ATAU MATI BERDUA' : 'MISI: SELAMAT BERDUA', VW / 2, VH / 2 + 4, 6, PAL.W, 'center');
    sctx.globalAlpha = 1;
  }

  if (g.paused && g.mode === 'play') {
    text('PAUSE', VW / 2, VH / 2 - 20, 14, PAL.Y, 'center');
    text('P / ESC lanjut  ·  M mute', VW / 2, VH / 2 + 6, 6, PAL.W, 'center');
  }
  if (g.mode === 'gameover') {
    text('GAME OVER', VW / 2, VH / 2 - 40, 18, PAL.R, 'center');
    text('Nyawa habis. Kompakan lagi ya.', VW / 2, VH / 2, 7, PAL.W, 'center');
    if (g.modeT > 1.5 && Math.floor(g.time * 2) % 2) text('LOMPAT (W / J) = CONTINUE ZONA INI', VW / 2, VH / 2 + 24, 7, PAL.Y, 'center');
  }
  if (g.mode === 'clear' || g.mode === 'victory') {
    const vic = g.mode === 'victory';
    text(vic ? 'MISSION COMPLETE!' : 'ZONE CLEAR!', VW / 2, 56, vic ? 16 : 18, PAL.Y, 'center');
    text(vic ? 'Bowser Slug tumbang. Mushroom Kingdom merdeka!' : g.def.name, VW / 2, 86, 7, PAL.W, 'center');
    const st = g.stats;
    const rows = [
      ['SKOR', String(g.score)],
      ['MUSUH DIHABISI', String(st.kills)],
      ['POW DISELAMATKAN', String(st.pows)],
      ['REVIVE', String(st.revives)],
      ['WAKTU', `${Math.floor(st.time / 60)}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`],
      ['NYAWA SISA', String(g.lives)],
    ];
    sctx.fillStyle = 'rgba(20,16,28,0.6)';
    sctx.fillRect(X(VW / 2 - 120), Y(104), 240 * S, 92 * S);
    rows.forEach(([k, val], i) => {
      text(k, VW / 2 - 110, 112 + i * 14, 7, PAL.M);
      text(val, VW / 2 + 110, 112 + i * 14, 7, PAL.W, 'right');
    });
    img(A.plumber.idle[0], VW / 2 - 196, 140, 3);
    img(A.gunner.idle[0], VW / 2 + 138, 134, 3);
    if (g.modeT > 1.5 && Math.floor(g.time * 2) % 2) text(vic ? 'LOMPAT = KE MENU' : 'LOMPAT (W / J) = ZONA BERIKUTNYA', VW / 2, VH - 22, 7, PAL.Y, 'center');
  }
}

function drawTitleHud(g, text, img, bar, wrap, S, X, Y, textCtx) {
  const A = g.A;
  const bob = Math.sin(g.titleT * 3) * 2;
  text('MUSHROOM', VW / 2, 18 + bob, 24, '#f87858', 'center');
  text('WARZONE', VW / 2, 46 + bob, 24, PAL.L, 'center');
  text('CO-OP ONLY  ·  RUN & GUN PLATFORMER', VW / 2, 78, 6, PAL.Y, 'center');
  text('Dunia jamur dikudeta pasukan Rebel. Sendirian lemah, berdua broken.', VW / 2, 90, 5, PAL.W, 'center');

  const card = (x, who, title, color, lines, ready) => {
    const h = 132;
    const y = 104;
    const w = 196;
    const ctx = textCtx;
    ctx.fillStyle = 'rgba(20,16,28,0.82)';
    ctx.fillRect(X(x), Y(y), w * S, h * S);
    ctx.strokeStyle = ready ? color : PAL.m;
    ctx.lineWidth = Math.max(1, S);
    ctx.strokeRect(X(x) + S / 2, Y(y) + S / 2, w * S - S, h * S - S);
    const sp = who === 'plumber' ? A.plumber : A.gunner;
    const f = ready ? sp.run[Math.floor(g.titleT * 10) % 4] : sp.idle[0];
    img(f, x + 10, y + 14, 3);
    if (who === 'gunner') img(A.weapons.pistol, x + 36, y + 42, 3);
    text(title, x + 70, y + 8, 7, color);
    lines.forEach((ln, i) => text(ln, x + 70, y + 22 + i * 10, 5, i % 2 ? PAL.W : PAL.M, 'left', false));
    text(ready ? 'SIAP!' : `TEKAN ${who === 'plumber' ? 'W' : 'J'}`, x + w / 2, y + h - 16, 8, ready ? color : Math.floor(g.titleT * 3) % 2 ? PAL.W : PAL.M, 'center');
  };
  card(28, 'plumber', 'P1 · PLUMBER', '#f87858', ['A/D jalan  W lompat', 'S di udara = GROUND POUND', 'nempel tembok = WALL JUMP', 'S di atas pipa = MASUK', 'F tuas / valve / revive', 'G STAR POWER (8 dtk)', 'Stomp musuh = mati'], g.ready.plumber);
  card(VW - 224, 'gunner', 'P2 · GUNNER', PAL.L, ['PANAH jalan/aim/jongkok', 'J lompat, tahan = JETPACK', 'K tembak   L granat', '3 koin = 1 granat', 'I angkat / lempar / tank', 'O SV-001 TANK CALL', 'Hancurin BAJA & SANDBAG'], g.ready.gunner);
  const both = g.ready.plumber && g.ready.gunner;
  text(both ? 'BERANGKAT!' : 'TIDAK BISA MAIN SENDIRI · DUA-DUANYA HARUS SIAP', VW / 2, VH - 26, 6, both ? PAL.Y : PAL.W, 'center');
  text(`ZONA AWAL: ${g.startZoneChoice + 1}  (tekan 1/2/3)  ·  Gamepad 1 = P1, Gamepad 2 = P2`, VW / 2, VH - 14, 5, PAL.M, 'center');
}

