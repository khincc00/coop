import { TS, moveAndCollide } from './world.js';
import { TILE as t } from './levels.js';
import { GRAVITY } from './players.js';
import { sfx } from './audio.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Enemy {
  constructor(kind, x, y, w, h, hp) {
    this.kind = kind;
    this.w = w;
    this.h = h;
    this.x = x;
    this.y = y - h;
    this.vx = 0;
    this.vy = 0;
    this.hp = hp;
    this.maxHp = hp;
    this.face = -1;
    this.t = rand(0, 2);
    this.anim = 0;
    this.flash = 0;
    this.stun = 0;
    this.dead = false;
    this.active = false;
    this.score = 100;
    this.stompable = true;
    this.touchHurts = true;
    this.shootable = true;
    this.gravity = true;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  wake(game) {
    if (this.active) return;
    for (const p of game.players)
      if (Math.abs(p.cx - this.cx) < 300 && Math.abs(p.cy - this.cy) < 190) {
        this.active = true;
        return;
      }
  }
  damage(game, dmg, how = 'shot') {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.07;
    if (this.hp <= 0) this.die(game, how);
    else sfx('hit');
  }
  die(game, how) {
    this.dead = true;
    game.onEnemyKilled(this, how);
  }
  // returns true when the plumber should bounce
  stomp(game, p) {
    this.die(game, 'stomp');
    return true;
  }
  physics(game, dt) {
    if (this.gravity) this.vy = Math.min(this.vy + GRAVITY * dt, 420);
    moveAndCollide(game.world, this, dt);
    if (this.y > game.world.pxH + 40) this.dead = true;
  }
  edgeAhead(game) {
    const w = game.world;
    const tx = Math.floor((this.face > 0 ? this.x + this.w + 2 : this.x - 2) / TS);
    const ty = Math.floor((this.y + this.h + 2) / TS);
    const id = w.get(tx, ty);
    return !(w.solid(id) || id === t.GIRDER);
  }
  nearest(game) {
    let best = null;
    let bd = Infinity;
    for (const p of game.players) {
      if (!p.alive || p.state === 'pipe') continue;
      const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best ? { p: best, d: bd, dx: best.cx - this.cx, dy: best.cy - this.cy } : null;
  }
  walk(game, dt, speed) {
    this.vx = this.face * speed;
    if (this.onGround && (this.hitL || this.hitR || this.edgeAhead(game))) this.face *= -1;
  }
  baseUpdate(game, dt) {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.stun > 0) {
      this.stun -= dt;
      this.vx = 0;
      this.physics(game, dt);
      return false;
    }
    return true;
  }
  drawImg(ctx, img, ox = 0, oy = 0, flip = this.face > 0) {
    const x = Math.round(this.x + this.w / 2 - img.width / 2 + ox);
    const y = Math.round(this.y + this.h - img.height + 1 + oy);
    if (flip) {
      ctx.save();
      ctx.translate(x + img.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else ctx.drawImage(img, x, y);
  }
  flashed(A, img) {
    return this.flash > 0 ? A.flash(img) : img;
  }
}

// ---------------------------------------------------------------- 1. REBEL GOOMBA
class Goomba extends Enemy {
  constructor(x, y) {
    super('goomba', x, y, 14, 13, 1);
    this.shootT = rand(1.5, 3.5);
    this.aimT = 0;
    this.squash = 0;
  }
  update(game, dt) {
    if (!this.baseUpdate(game, dt)) return;
    const n = this.nearest(game);
    this.shootT -= dt;
    if (this.aimT > 0) {
      this.aimT -= dt;
      this.vx = 0;
      if (this.aimT <= 0) {
        game.enemyShot(this.cx + this.face * 8, this.y + 9, this.face * 150, 0, 'bullet');
        this.shootT = rand(2.5, 4.5);
      }
    } else {
      this.walk(game, dt, 32);
      if (n && this.shootT <= 0 && Math.abs(n.dx) < 190 && Math.abs(n.dy) < 30) {
        this.face = Math.sign(n.dx) || 1;
        this.aimT = 0.45;
      }
    }
    this.physics(game, dt);
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.goomba[this.aimT > 0 ? 0 : Math.floor(this.anim * 6) % 2]));
    if (this.aimT > 0 && Math.floor(this.aimT * 20) % 2) ctx.fillStyle = '#f8c830', ctx.fillRect(this.cx + this.face * 9 - 1, this.y + 8, 2, 2);
  }
}

// ---------------------------------------------------------------- 2. KOOPA TROOPER (+ shell)
class Trooper extends Enemy {
  constructor(x, y) {
    super('trooper', x, y, 13, 21, 3);
    this.shootT = rand(1, 3);
    this.burst = 0;
    this.burstT = 0;
    this.score = 200;
  }
  update(game, dt) {
    if (!this.baseUpdate(game, dt)) return;
    const n = this.nearest(game);
    this.shootT -= dt;
    if (this.burst > 0) {
      this.vx = 0;
      this.burstT -= dt;
      if (this.burstT <= 0) {
        game.enemyShot(this.cx + this.face * 10, this.y + 11, this.face * 170, 0, 'bullet');
        this.burst--;
        this.burstT = 0.14;
      }
    } else {
      this.walk(game, dt, 24);
      if (n && this.shootT <= 0 && Math.abs(n.dx) < 220 && Math.abs(n.dy) < 40) {
        this.face = Math.sign(n.dx) || 1;
        this.burst = 3;
        this.burstT = 0.35;
        this.shootT = rand(2.6, 3.8);
      }
    }
    this.physics(game, dt);
  }
  stomp(game) {
    this.dead = true;
    game.addEnemy(new Shell(this.x, this.y + this.h));
    game.onEnemyKilled(this, 'stomp', true);
    return true;
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.trooper[Math.floor(this.anim * 5) % 2]));
  }
}

export class Shell extends Enemy {
  constructor(x, y) {
    super('shell', x, y, 14, 11, 2);
    this.active = true;
    this.touchHurts = false;
    this.kickCd = 0.3;
    this.score = 50;
  }
  update(game, dt) {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.kickCd = Math.max(0, this.kickCd - dt);
    if (this.vx !== 0) {
      if (this.hitL || this.hitR) {
        this.face *= -1;
        sfx('bump');
      }
      this.vx = this.face * 250;
      // bowling: kill whatever we hit
      for (const e of game.enemies)
        if (e !== this && !e.dead && e.kind !== 'bunker' && Math.abs(e.cx - this.cx) < (e.w + this.w) / 2 && Math.abs(e.cy - this.cy) < (e.h + this.h) / 2)
          e.damage(game, 5, 'shell');
    }
    this.physics(game, dt);
  }
  touchedBy(game, p) {
    if (this.kickCd > 0) return;
    if (this.vx === 0) {
      this.face = p.cx < this.cx ? 1 : -1;
      this.vx = this.face * 250;
      this.kickCd = 0.25;
      sfx('stomp');
    }
  }
  stomp(game) {
    if (this.vx !== 0) {
      this.vx = 0;
      this.kickCd = 0.3;
      sfx('stomp');
      return true;
    }
    this.touchedBy(game, game.plumber);
    return true;
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.shell[this.vx ? Math.floor(this.anim * 14) % 2 : 0]));
  }
}

// ---------------------------------------------------------------- 3. PARAKOOPA GUNNER (flying)
class Parakoopa extends Enemy {
  constructor(x, y) {
    super('parakoopa', x, y, 16, 18, 2);
    this.gravity = false;
    this.x0 = this.x;
    this.y0 = this.y;
    this.shootT = rand(1, 2.5);
    this.score = 200;
  }
  update(game, dt) {
    if (!this.baseUpdate(game, dt)) return;
    this.t += dt;
    const n = this.nearest(game);
    if (n) {
      this.face = Math.sign(n.dx) || 1;
      this.x0 += Math.sign(n.dx) * Math.min(Math.abs(n.dx) > 90 ? 22 : 0, 22) * dt;
    }
    this.x = this.x0 + Math.sin(this.t * 0.9) * 40;
    this.y = this.y0 + Math.sin(this.t * 1.8) * 14;
    this.shootT -= dt;
    if (n && this.shootT <= 0 && n.d < 230) {
      const s = 150 / n.d;
      game.enemyShot(this.cx + this.face * 8, this.y + 12, n.dx * s, n.dy * s, 'bullet');
      this.shootT = rand(1.8, 2.6);
    }
  }
  stomp(game) {
    this.die(game, 'stomp');
    return true;
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.parakoopa[Math.floor(this.anim * 8) % 2]));
  }
}

// ---------------------------------------------------------------- 4. KOOPA TANK MINI
class MiniTank extends Enemy {
  constructor(x, y) {
    super('minitank', x, y, 28, 19, 12);
    this.shootT = rand(1.5, 2.5);
    this.score = 500;
  }
  update(game, dt) {
    if (!this.baseUpdate(game, dt)) return;
    const n = this.nearest(game);
    if (n) {
      this.face = Math.sign(n.dx) || 1;
      const want = Math.abs(n.dx) > 110 ? 20 : 0;
      this.vx = this.face * want;
      if (this.edgeAhead(game) || this.hitL || this.hitR) this.vx = 0;
      this.shootT -= dt;
      if (this.shootT <= 0 && Math.abs(n.dx) < 260) {
        const tt = 0.9;
        game.enemyShot(this.cx + this.face * 16, this.y + 4, n.dx / tt, -GRAVITY * tt * 0.5 + n.dy / tt, 'cannon');
        this.shootT = rand(2.4, 3.2);
        sfx('rocket');
      }
    }
    this.physics(game, dt);
  }
  stomp(game) {
    this.damage(game, 3, 'stomp');
    return true;
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.minitank[Math.abs(this.vx) > 1 ? Math.floor(this.anim * 8) % 2 : 0]));
  }
}

// ---------------------------------------------------------------- 5. BILL BLASTER BUNKER (+ bullet bill)
class Bunker extends Enemy {
  constructor(x, y) {
    super('bunker', x + 0, y, 16, 30, 14);
    this.gravity = false;
    this.stompable = false;
    this.touchHurts = false;
    this.shootT = rand(1, 2);
    this.score = 800;
    this.solidTop = true;
  }
  update(game, dt) {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    const n = this.nearest(game);
    this.shootT -= dt;
    if (n && this.shootT <= 0 && Math.abs(n.dx) < 280 && Math.abs(n.dx) > 20 && Math.abs(n.dy) < 80) {
      const d = Math.sign(n.dx);
      game.addEnemy(new Bill(this.cx + d * 10 - 7, this.y + 15, d));
      game.smoke(this.cx + d * 10, this.y + 8, 4);
      sfx('rocket');
      this.shootT = rand(2.8, 3.6);
    }
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.bunker), 0, 0, false);
  }
}

class Bill extends Enemy {
  constructor(x, y, dir) {
    super('bill', x, y, 15, 13, 1);
    this.face = dir;
    this.gravity = false;
    this.active = true;
    this.life = 5;
    this.score = 100;
  }
  update(game, dt) {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.life -= dt;
    this.x += this.face * 105 * dt;
    if (this.life <= 0 || game.world.solidAt(this.cx + this.face * 8, this.cy)) this.die(game, 'crash');
    if (Math.random() < 0.3) game.smoke(this.cx - this.face * 8, this.cy, 1, true);
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.bill));
  }
}

// ---------------------------------------------------------------- 6. SHY GUY GRENADIER
class ShyGuy extends Enemy {
  constructor(x, y) {
    super('shyguy', x, y, 12, 16, 1);
    this.throwT = rand(1, 2.5);
    this.score = 200;
  }
  update(game, dt) {
    if (!this.baseUpdate(game, dt)) return;
    const n = this.nearest(game);
    this.vx = 0;
    if (n) {
      this.face = Math.sign(n.dx) || 1;
      this.throwT -= dt;
      if (this.throwT <= 0 && Math.abs(n.dx) < 220) {
        const tt = 0.85;
        game.enemyShot(this.cx, this.y, n.dx / tt, -GRAVITY * tt * 0.5 + n.dy / tt, 'grenade');
        this.throwT = rand(2.4, 3.2);
        sfx('grenade');
      }
    }
    this.physics(game, dt);
  }
  draw(ctx, A) {
    this.drawImg(ctx, this.flashed(A, A.shyguy[this.throwT < 0.4 ? 1 : 0]));
  }
}

export function makeEnemy(kind, x, y) {
  switch (kind) {
    case 'goomba':
      return new Goomba(x, y);
    case 'trooper':
      return new Trooper(x, y);
    case 'parakoopa':
      return new Parakoopa(x, y);
    case 'minitank':
      return new MiniTank(x, y);
    case 'bunker':
      return new Bunker(x, y);
    case 'shyguy':
      return new ShyGuy(x, y);
  }
  return new Goomba(x, y);
}

// ====================================================================== BOSSES
class Boss {
  constructor(name, x, y, w, h, hp) {
    this.name = name;
    this.x = x;
    this.y = y - h;
    this.w = w;
    this.h = h;
    this.hp = hp;
    this.maxHp = hp;
    this.t = 0;
    this.anim = 0;
    this.flash = 0;
    this.dead = false;
    this.dying = 0;
    this.face = -1;
    this.stun = 0;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  damage(game, dmg) {
    if (this.dying > 0 || this.dead) return;
    this.hp -= dmg;
    this.flash = 0.06;
    sfx('bossHit');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = 2.6;
      game.onBossDying(this);
    }
  }
  updateDying(game, dt) {
    this.dying -= dt;
    this.anim += dt;
    if (Math.random() < 0.35) game.explode(this.x + Math.random() * this.w, this.y + Math.random() * this.h, 0, Math.random() < 0.3, 'boss');
    game.shake(4);
    if (this.dying <= 0) {
      this.dead = true;
      game.explode(this.cx, this.cy, 0, true, 'boss');
      game.onBossDead(this);
    }
  }
  nearestPlayer(game) {
    let best = null;
    let bd = Infinity;
    for (const p of game.players) {
      if (!p.alive) continue;
      const d = Math.abs(p.cx - this.cx);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }
  img(A, img) {
    return img;
  }
  overlayFlash(ctx, A, img, x, y, flip) {
    if (this.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (flip) {
      ctx.translate(x + img.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(A.flash(img), 0, 0);
    } else ctx.drawImage(A.flash(img), x, y);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- BOSS 1: PIRANHA TANK
class PiranhaTank extends Boss {
  constructor(x, y, arena) {
    super('PIRANHA TANK', x, y, 74, 32, 80);
    this.arena = arena;
    this.phase = 'closed';
    this.phaseT = 2.5;
    this.open = 0;
    this.shotT = 1;
    this.spawnT = 0;
    this.vx = -26;
  }
  // world-space rects
  head() {
    const hy = this.y - 28 + (1 - this.open) * 18;
    return { x: this.x + 20, y: hy, w: 34, h: 22 };
  }
  hitZones() {
    const z = [{ x: this.x, y: this.y, w: this.w, h: this.h, mul: 0.4 }];
    if (this.open > 0.6) z.push({ ...this.head(), mul: 1.5 });
    return z;
  }
  stompZones() {
    if (this.open > 0.6) return [{ ...this.head(), dmg: 8 }];
    return [{ x: this.x + 12, y: this.y - 4, w: 50, h: 8, dmg: 2 }];
  }
  hurtZones() {
    const z = [{ x: this.x + 2, y: this.y + 6, w: this.w - 4, h: this.h - 6 }];
    if (this.open > 0.6) {
      const h = this.head();
      z.push({ x: h.x + 2, y: h.y + 8, w: h.w - 4, h: h.h - 8 });
    }
    return z;
  }
  update(game, dt) {
    if (this.dying > 0) return this.updateDying(game, dt);
    this.t += dt;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    const rage = this.hp < this.maxHp / 2;
    // drive back and forth inside the arena
    this.x += this.vx * (rage ? 1.5 : 1) * dt;
    if (this.x < this.arena.x0 + 8) this.vx = Math.abs(this.vx);
    if (this.x + this.w > this.arena.x1 - 8) this.vx = -Math.abs(this.vx);
    const target = this.nearestPlayer(game);
    this.face = target && target.cx < this.cx ? -1 : 1;

    this.phaseT -= dt;
    if (this.phase === 'closed') {
      this.open = Math.max(0, this.open - dt * 3);
      this.shotT -= dt;
      if (this.shotT <= 0 && target) {
        const tt = 1;
        const dx = target.cx - (this.x + (this.face > 0 ? 72 : 4));
        game.enemyShot(this.x + (this.face > 0 ? 72 : 4), this.y + 4, dx / tt, -GRAVITY * 0.5 * tt + (target.cy - this.y) / tt, 'cannon');
        sfx('rocket');
        this.shotT = rage ? 1.0 : 1.5;
      }
      if (this.phaseT <= 0) {
        this.phase = 'open';
        this.phaseT = rage ? 2.2 : 2.8;
        this.spit = 3;
        this.spitT = 0.5;
      }
    } else {
      this.open = Math.min(1, this.open + dt * 3);
      this.spitT -= dt;
      if (this.spit > 0 && this.spitT <= 0 && target) {
        const h = this.head();
        const sx = h.x + (this.face > 0 ? h.w : 0);
        const dx = target.cx - sx;
        game.enemyShot(sx, h.y + 10, Math.sign(dx) * (90 + Math.random() * 70), -200 - Math.random() * 120, 'fireball');
        sfx('flame');
        this.spit--;
        this.spitT = 0.45;
      }
      if (this.phaseT <= 0) {
        this.phase = 'closed';
        this.phaseT = rage ? 2 : 2.8;
        if (rage) {
          this.spawnT++;
          if (this.spawnT % 2 === 1) game.spawnEnemyAt('goomba', this.arena.x0 + 24, this.arena.y0 + 40);
        }
      }
    }
  }
  draw(ctx, A) {
    const frames = A.piranha[Math.round(this.open * 4)];
    const img = this.img(A, frames[Math.floor(this.anim * 6) % 2]);
    const x = Math.round(this.x + this.w / 2 - img.width / 2);
    const y = Math.round(this.y + this.h - img.height + 1);
    if (this.face > 0) ctx.drawImage(img, x, y);
    else {
      ctx.save();
      ctx.translate(x + img.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    this.overlayFlash(ctx, A, img, x, y, this.face < 0);
  }
}

// ---------------------------------------------------------------- BOSS 2: MECHA LAKITU GUNSHIP
class Gunship extends Boss {
  constructor(x, y, arena) {
    super('MECHA LAKITU GUNSHIP', x, y, 84, 44, 150);
    this.arena = arena;
    this.baseY = arena.y0 + 50;
    this.y = this.baseY;
    this.dropT = 1.5;
    this.mgT = 3;
    this.swoopT = 9;
    this.swoop = 0;
    this.burst = 0;
  }
  cockpit() {
    return { x: this.x + 34, y: this.y, w: 18, h: 12 };
  }
  hitZones() {
    return [
      { x: this.x, y: this.y + 6, w: this.w, h: this.h - 6, mul: 1 },
      { ...this.cockpit(), mul: 1.6 },
    ];
  }
  stompZones() {
    return [
      { ...this.cockpit(), dmg: 12 },
      { x: this.x + 8, y: this.y + 6, w: this.w - 16, h: 6, dmg: 3 },
    ];
  }
  hurtZones() {
    return [{ x: this.x + 6, y: this.y + 16, w: this.w - 12, h: this.h - 18 }];
  }
  update(game, dt) {
    if (this.dying > 0) {
      this.y += 20 * dt;
      return this.updateDying(game, dt);
    }
    this.t += dt;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    const rage = this.hp < this.maxHp / 2;
    const target = this.nearestPlayer(game);
    const ax0 = this.arena.x0 + 4;
    const ax1 = this.arena.x1 - this.w - 4;
    // drift toward a point above the nearest player
    const want = target ? Math.max(ax0, Math.min(ax1, target.cx - this.w / 2 + Math.sin(this.t * 0.7) * 90)) : this.x;
    this.x += Math.max(-70, Math.min(70, (want - this.x) * 1.2)) * dt * (rage ? 1.3 : 1);
    this.swoopT -= dt;
    let wantY = this.baseY + Math.sin(this.t * 1.3) * 10;
    if (this.swoopT <= 0) {
      this.swoop = 3.2;
      this.swoopT = rage ? 8 : 10;
    }
    if (this.swoop > 0) {
      this.swoop -= dt;
      wantY = this.arena.y1 - this.h - 6; // hangs low: stomp the cockpit!
    }
    this.y += (wantY - this.y) * Math.min(1, dt * 2.2);
    // attacks
    this.dropT -= dt;
    if (this.dropT <= 0 && this.swoop <= 0) {
      game.enemyShot(this.cx + (Math.random() - 0.5) * 40, this.y + this.h, (Math.random() - 0.5) * 60, 40, 'grenade');
      this.dropT = rage ? 1.0 : 1.5;
    }
    this.mgT -= dt;
    if (this.mgT <= 0 && target) {
      this.burst = rage ? 7 : 5;
      this.burstT = 0;
      this.mgT = rage ? 2.4 : 3.2;
    }
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0 && target) {
        for (const gx of [this.x + 15, this.x + 71]) {
          const dx = target.cx - gx;
          const dy = target.cy - (this.y + 44);
          const d = Math.hypot(dx, dy) || 1;
          game.enemyShot(gx, this.y + 44, (dx / d) * 160, (dy / d) * 160, 'bullet');
        }
        this.burst--;
        this.burstT = 0.13;
      }
    }
    if (rage && Math.random() < dt * 0.15 && game.enemies.filter((e) => !e.dead).length < 4)
      game.spawnEnemyAt('parakoopa', this.cx, this.y + 20);
  }
  draw(ctx, A) {
    const img = this.img(A, this.swoop > 0 ? A.gunshipHurt : A.gunship[Math.floor(this.anim * 14) % 2]);
    const x = Math.round(this.x + this.w / 2 - img.width / 2);
    const y = Math.round(this.y - 1);
    ctx.drawImage(img, x, y);
    this.overlayFlash(ctx, A, img, x, y, false);
  }
}

// ---------------------------------------------------------------- BOSS 3: BOWSER SLUG
class BowserSlug extends Boss {
  constructor(x, y, arena) {
    super('BOWSER SLUG', x, y, 116, 100, 300);
    this.arena = arena;
    this.vx = 0;
    this.vy = 0;
    this.cannonT = 1.5;
    this.breathT = 4;
    this.jumpT = 8;
    this.mouth = 0;
    this.side = 0;
    this.groundY = this.y;
    this.inAir = false;
  }
  phase() {
    return this.hp > this.maxHp * 0.66 ? 0 : this.hp > this.maxHp * 0.33 ? 1 : 2;
  }
  // local coordinates are authored for the right-facing sprite and mirrored when facing left
  local(x, y, w, h) {
    const lx = this.face > 0 ? x : this.w - x - w;
    return { x: this.x + lx, y: this.y + y, w, h };
  }
  head() {
    return this.local(58, -4, 46, 32);
  }
  hitZones() {
    return [
      { ...this.local(0, 30, this.w, 70), mul: 0.2 },
      { ...this.head(), mul: 1 },
    ];
  }
  stompZones() {
    return [
      { ...this.head(), h: 10, dmg: 10 },
      { ...this.local(24, 4, 34, 8), dmg: 3 },
    ];
  }
  hurtZones() {
    return [this.local(4, 36, this.w - 8, 62)];
  }
  update(game, dt) {
    if (this.dying > 0) return this.updateDying(game, dt);
    this.t += dt;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    const ph = this.phase();
    const sp = [1, 1.25, 1.55][ph];
    const target = this.nearestPlayer(game);
    if (target && !this.inAir) this.face = target.cx < this.cx ? -1 : 1;
    // creep toward the players
    if (!this.inAir && target) {
      const dx = target.cx - this.cx;
      this.x += Math.sign(dx) * (Math.abs(dx) > 90 ? 16 : 0) * sp * dt;
    }
    this.x = Math.max(this.arena.x0 + 2, Math.min(this.arena.x1 - this.w - 2, this.x));
    this.mouth = Math.max(0, this.mouth - dt * 2);
    // cannon arms
    this.cannonT -= dt * sp;
    if (this.cannonT <= 0) {
      const front = this.local(this.w, 34, 6, 6);
      const back = this.local(-6, 32, 6, 6);
      const use = this.side++ % 2 ? front : back;
      const dir = use === front ? this.face : -this.face;
      game.enemyShot(use.x, use.y, dir * 170, 0, 'shell');
      sfx('rocket');
      this.cannonT = 1.7;
    }
    // fire breath
    this.breathT -= dt * sp;
    if (this.breathT <= 0 && target) {
      this.mouth = 1;
      const m = this.local(this.w - 12, 22, 4, 4);
      for (let i = 0; i < 3 + ph; i++)
        game.enemyShot(m.x, m.y, this.face * (110 + i * 45), -140 - Math.random() * 90, 'fireball');
      sfx('flame');
      this.breathT = 4.2;
    }
    // jump slam → ground shockwaves
    this.jumpT -= dt * sp;
    if (this.jumpT <= 0 && !this.inAir) {
      this.inAir = true;
      this.vy = -360;
      this.jumpT = 9;
    }
    if (this.inAir) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.inAir = false;
        game.shake(10);
        sfx('boom');
        game.enemyShot(this.x - 4, this.y + this.h - 10, -150, 0, 'wave');
        game.enemyShot(this.x + this.w + 4, this.y + this.h - 10, 150, 0, 'wave');
        if (ph === 2 && game.enemies.filter((e) => !e.dead).length < 3) game.spawnEnemyAt('minitank', this.arena.x0 + 30, this.arena.y0 + 20);
      }
    }
  }
  draw(ctx, A) {
    const ph = this.phase();
    const img = this.img(A, A.bowser[this.mouth > 0.3 ? 1 : 0][Math.floor(this.anim * 4) % 2][ph]);
    // sprite faces right; mirror when facing left
    const x = Math.round(this.x + this.w / 2 - img.width / 2);
    const y = Math.round(this.y + this.h - img.height + 2);
    if (this.face > 0) ctx.drawImage(img, x, y);
    else {
      ctx.save();
      ctx.translate(x + img.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    this.overlayFlash(ctx, A, img, x, y, this.face < 0);
  }
}

export function makeBoss(kind, x, y, arena) {
  if (kind === 'gunship') return new Gunship(x, y, arena);
  if (kind === 'bowser') return new BowserSlug(x, y, arena);
  return new PiranhaTank(x, y, arena);
}
