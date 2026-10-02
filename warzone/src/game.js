import { ZONES, TILE as t } from './levels.js';
import { World, TS, moveAndCollide, overlap } from './world.js';
import { Plumber, Gunner, GRAVITY, PHYS, WEAPONS } from './players.js';
import { makeEnemy, makeBoss } from './enemies.js';
import { sfx, playMusic, stopMusic } from './audio.js';
import { flash } from './art.js';

export const VW = 480;
export const VH = 270;
const rand = (a, b) => a + Math.random() * (b - a);
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

// ====================================================================== SV-001 TANK
class Tank {
  constructor(x, feetY, timed) {
    this.w = 52;
    this.h = 32;
    this.x = x;
    this.y = feetY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.face = 1;
    this.hp = timed ? 30 : 45;
    this.maxHp = this.hp;
    this.timer = timed ? 15 : Infinity;
    this.timed = timed;
    this.driver = null;
    this.ext = 0;
    this.aimUp = false;
    this.cd = 0;
    this.cannonCd = 0;
    this.home = { x, y: feetY };
    this.dead = false;
    this.respawnT = 0;
    this.anim = 0;
    this.flash = 0;
    this.onGround = false;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  barrel() {
    const len = 18 + this.ext;
    const bx = this.face > 0 ? this.x + 33 : this.x + this.w - 33 - len;
    return { x: bx, y: this.y + 8, w: len, h: 5, len };
  }
  platforms() {
    if (this.dead) return [];
    const p = [
      { x: this.x + (this.face > 0 ? 11 : this.w - 11 - 26), y: this.y - 1, w: 26, owner: this, kind: 'tank' },
      { x: this.x, y: this.y + 14, w: this.w, owner: this, kind: 'tank' },
    ];
    if (this.ext > 6) {
      const b = this.barrel();
      p.push({ x: b.x, y: b.y, w: b.w, owner: this, kind: 'barrel' });
    }
    return p;
  }
  damage(game, d) {
    if (this.dead) return;
    this.hp -= d;
    this.flash = 0.06;
    sfx('hit');
    if (this.hp <= 0) this.destroy(game);
  }
  destroy(game) {
    if (this.dead) return;
    this.dead = true;
    game.explode(this.cx, this.cy, 0, true, 'fx');
    game.shake(6);
    if (this.driver) game.exitTank(this.driver, this, true);
    if (!this.timed) this.respawnT = 3;
  }
  update(game, dt) {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.dead) {
      if (!this.timed) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) {
          this.dead = false;
          this.hp = this.maxHp;
          this.x = this.home.x;
          this.y = this.home.y - this.h - 30;
          this.vx = this.vy = 0;
          this.ext = 0;
          game.smoke(this.cx, this.cy, 10);
        }
      } else this.gone = true;
      return;
    }
    this.cd = Math.max(0, this.cd - dt);
    this.cannonCd = Math.max(0, this.cannonCd - dt);
    const d = this.driver;
    let dir = 0;
    if (d) {
      const inp = game.input.p('gunner');
      dir = (inp.right.down ? 1 : 0) - (inp.left.down ? 1 : 0);
      if (dir) this.face = dir;
      // edge brake so SV-001 never drives into a pit
      if (dir && this.onGround) {
        const fx = dir > 0 ? this.x + this.w + 2 : this.x - 2;
        const below = game.world.get(Math.floor(fx / TS), Math.floor((this.y + this.h + 3) / TS));
        if (!game.world.solid(below) && below !== t.GIRDER) dir = 0;
      }
      if (inp.down.down) this.ext = Math.min(80, this.ext + 110 * dt);
      else this.ext = Math.max(0, this.ext - 150 * dt);
      this.aimUp = inp.up.down;
      if (inp.fire.down && this.cd <= 0) {
        this.cd = 0.085;
        if (this.aimUp) game.playerBullet(this.x + this.w / 2 + this.face * 4 + rand(-3, 3), this.y - 4, rand(-25, 25), -470, 'pistol', 1);
        else {
          const vx = this.x + (this.face > 0 ? 6 : this.w - 6);
          game.playerBullet(vx, this.y + 5, this.face * 470, rand(-20, 20), 'pistol', 1);
        }
        sfx('hmg');
      }
      if (inp.grenade.pressed && this.cannonCd <= 0) {
        const b = this.barrel();
        const tip = this.face > 0 ? b.x + b.w : b.x;
        game.playerBullet(tip, b.y + 2, this.face * 320, 0, 'cannon', 9);
        game.addFx('muzzle', tip, b.y + 2, this.face < 0);
        this.cannonCd = 0.7;
        this.vx -= this.face * 40;
        game.shake(3);
        sfx('rocket');
      }
      if (inp.action.pressed) game.exitTank(d, this, false);
      if (this.timed) {
        this.timer -= dt;
        if (this.timer <= 0) this.destroy(game);
      }
    } else {
      this.ext = Math.max(0, this.ext - 150 * dt);
    }
    this.vx = approach(this.vx, dir * 88, 500 * dt);
    this.vy = Math.min(this.vy + GRAVITY * dt, 430);
    moveAndCollide(game.world, this, dt);
    if (this.y > game.world.pxH + 40) this.destroy(game);
    // crush whatever is in front
    for (const e of game.enemies) {
      if (e.dead || !e.active) continue;
      if (overlap(this, e, 1)) e.damage(game, 6 * dt * 10 * (Math.abs(this.vx) > 10 ? 1 : 0.2), 'tank');
    }
    if (d) {
      d.x = this.x + this.w / 2 - d.w / 2;
      d.y = this.y - 8;
      d.vx = this.vx;
      d.vy = 0;
      d.face = this.face;
      d.lastSafe = this.onGround ? { x: d.x, y: this.y + this.h - d.h } : d.lastSafe;
    }
  }
  draw(ctx, A) {
    if (this.dead) return;
    const idx = Math.min(5, Math.round(this.ext / 16));
    const frames = A.tank[idx];
    let img = frames[Math.abs(this.vx) > 5 ? Math.floor(this.anim * 10) % 2 : 0];
    if (this.flash > 0) img = flash(img);
    const x = Math.round(this.x - 1);
    const y = Math.round(this.y + this.h - img.height + 1);
    if (this.face > 0) ctx.drawImage(img, x, y);
    else {
      ctx.save();
      ctx.translate(x + this.w + 2, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    if (this.driver) {
      // gunner's helmet peeking out of the hatch
      const hx = Math.round(this.x + (this.face > 0 ? 18 : this.w - 30));
      ctx.fillStyle = '#14101c';
      ctx.fillRect(hx - 1, y - 5, 14, 7);
      ctx.fillStyle = '#5c8c30';
      ctx.fillRect(hx, y - 4, 12, 5);
      ctx.fillStyle = '#9cc850';
      ctx.fillRect(hx + 2, y - 4, 3, 1);
    }
    // hp bar
    ctx.fillStyle = '#14101c';
    ctx.fillRect(Math.round(this.x + 6), y - 9, 40, 4);
    ctx.fillStyle = this.hp / this.maxHp > 0.35 ? '#9cc850' : '#d8281c';
    ctx.fillRect(Math.round(this.x + 7), y - 8, Math.max(0, 38 * (this.hp / this.maxHp)), 2);
  }
}

// ====================================================================== GAME
export class Game {
  constructor(A, input) {
    this.A = A;
    this.input = input;
    this.mode = 'title';
    this.ready = { plumber: false, gunner: false };
    this.titleT = 0;
    this.zoneIndex = 0;
    this.startZoneChoice = 0;
    this.lives = 3;
    this.score = 0;
    this.coins = 0;
    this.time = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.flashT = 0;
    this.msg = null;
    this.views = [];
    this.paused = false;
    this.plumber = new Plumber(0, 0);
    this.gunner = new Gunner(0, 0);
    this.players = [this.gunner, this.plumber]; // gunner first: the plumber rides on top of him
    this.stats = { kills: 0, pows: 0, revives: 0, time: 0 };
  }

  // -------------------------------------------------------------- zone setup
  startGame(zone = 0) {
    this.lives = 3;
    this.score = 0;
    this.coins = 0;
    this.gunner.setWeapon('pistol');
    this.gunner.grenades = 3;
    this.plumber.meter = 0;
    this.gunner.meter = 0;
    this.loadZone(zone);
  }

  loadZone(i) {
    this.zoneIndex = i;
    const def = ZONES[i]();
    this.def = def;
    this.world = new World(def);
    this.enemies = [];
    this.bullets = [];
    this.shots = [];
    this.particles = [];
    this.fx = [];
    this.texts = [];
    this.corpses = [];
    this.pickups = [];
    this.pipes = [];
    this.doors = [];
    this.bridges = [];
    this.levers = [];
    this.targets = [];
    this.valves = [];
    this.plates = [];
    this.seesaws = [];
    this.signs = [];
    this.checkpoints = [];
    this.pows = [];
    this.tanks = [];
    this.arena = null;
    this.boss = null;
    this.bothDownT = 0;
    this.zoneTime = 0;
    this.stats = { kills: 0, pows: 0, revives: 0, time: 0 };
    let spawnP = { x: 48, y: 100 };
    let spawnG = { x: 80, y: 100 };
    for (const o of def.objs) {
      const px = o.x * TS;
      const feet = (o.y + 1) * TS;
      switch (o.type) {
        case 'spawn':
          if (o.who === 'plumber') spawnP = { x: px + 2, y: feet };
          else spawnG = { x: px + 2, y: feet };
          break;
        case 'enemy':
          this.enemies.push(makeEnemy(o.kind, px + 1, feet));
          break;
        case 'coin':
          this.pickups.push({ kind: 'coin', x: px + 4, y: o.y * TS + 2, w: 8, h: 12, static: true });
          break;
        case 'pickup':
          this.pickups.push({ kind: o.kind, x: px + 1, y: feet - 14, w: 14, h: 14, vx: 0, vy: 0, static: false });
          break;
        case 'pipe':
          this.pipes.push({ ...o });
          break;
        case 'door':
          this.doors.push({ ...o, open: false });
          break;
        case 'bridge':
          this.bridges.push({ ...o, built: false });
          break;
        case 'lever':
          this.levers.push({ x: px + 1, y: feet - 16, w: 14, h: 16, on: false, opens: o.opens });
          break;
        case 'target':
          this.targets.push({ x: px + 1, y: o.y * TS - 2, w: 14, h: 20, hit: false, opens: o.opens });
          break;
        case 'valve':
          this.valves.push({ x: px, y: feet - 16, w: 16, h: 16, progress: 0, time: o.time, done: false, spawns: o.spawns, spawnT: 1, opens: o.opens, spin: 0 });
          break;
        case 'plate':
          this.plates.push({ x: px, y: feet - 4, w: 16, h: 4, down: false, opens: o.opens });
          break;
        case 'seesaw':
          this.seesaws.push({ x: px, y: feet - 7, w: 112, tilt: 0, cool: 0 });
          break;
        case 'sign':
          this.signs.push({ x: px, y: feet - 16, w: 16, h: 16, text: o.text });
          break;
        case 'checkpoint':
          this.checkpoints.push({ x: px, y: feet - 32, w: 14, h: 32, on: false, feet });
          break;
        case 'pow':
          this.pows.push({ x: px + 1, y: feet - 18, w: 14, h: 18, freed: false, t: 0, vx: 0 });
          break;
        case 'tank':
          this.tanks.push(new Tank(px, feet, false));
          break;
        case 'arena':
          this.arena = {
            x0: o.x0 * TS,
            x1: (o.x1 + 1) * TS,
            y0: o.y0 * TS,
            y1: (o.y1 + 1) * TS,
            lock: o.lock,
            boss: o.boss,
            bx: o.bx * TS,
            by: (o.by + 1) * TS,
            started: false,
            done: false,
          };
          break;
      }
    }
    this.spawnP = spawnP;
    this.spawnG = spawnG;
    this.checkpoint = { p: { ...spawnP }, g: { ...spawnG } };
    for (const p of this.players) this.resetPlayer(p);
    this.plumber.place(spawnP.x, spawnP.y);
    this.gunner.place(spawnG.x, spawnG.y);
    this.views = [];
    this.mode = 'play';
    this.banner = { text: def.name, t: 3.2 };
    playMusic(def.music);
  }

  resetPlayer(p) {
    p.state = 'normal';
    p.hp = p.maxHp;
    p.inv = 1.5;
    p.vx = p.vy = 0;
    p.revive = 0;
    p.onPlat = null;
    if (p.who === 'gunner') {
      p.carrying = false;
      p.tank = null;
      p.fuel = PHYS.jetFuel;
      if (p.crouch) {
        p.crouch = false;
        p.h = 20;
      }
    } else {
      p.pound = 0;
      p.cling = 0;
      p.star = 0;
      p.pipe = null;
    }
  }

  // -------------------------------------------------------------- helpers called by entities
  shake(a) {
    this.shakeAmp = Math.max(this.shakeAmp, a);
    this.shakeT = 0.25;
  }
  flashScreen(t) {
    this.flashT = t;
  }
  popText(x, y, text, color = '#f8f8f0') {
    // don't stack the same hint on top of itself
    if (this.texts.some((t2) => t2.text === text && t2.life > 0.9 && Math.abs(t2.x - x) < 40)) return;
    this.texts.push({ x, y, text, color, life: 1.3 });
  }
  burst(x, y, n, colors, speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.3, 0.7), max: 0.7, color: colors[i % colors.length], size: 2, grav: 300 });
    }
  }
  debris(tx, ty, colors) {
    for (let i = 0; i < 4; i++)
      this.particles.push({ x: tx * TS + 4 + (i % 2) * 8, y: ty * TS + 4 + Math.floor(i / 2) * 8, vx: (i % 2 ? 1 : -1) * rand(40, 90), vy: -rand(150, 260), life: 1, max: 1, color: colors[i % colors.length], size: 5, grav: 900 });
  }
  smoke(x, y, n = 4, small = false) {
    for (let i = 0; i < n; i++)
      this.particles.push({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-20, 20), vy: rand(-40, -10), life: rand(0.3, 0.6), max: 0.6, color: small ? '#a4a4b0' : '#5c5c6c', size: small ? 2 : 4, grav: -20 });
  }
  dust(x, y) {
    for (let i = 0; i < 4; i++)
      this.particles.push({ x, y, vx: rand(-50, 50), vy: rand(-40, -5), life: 0.3, max: 0.3, color: '#e8d0a8', size: 2, grav: 0 });
  }
  jetFlame(g) {
    const bx = g.face > 0 ? g.x : g.x + g.w;
    this.particles.push({ x: bx + rand(-1, 1), y: g.y + 16, vx: rand(-10, 10), vy: rand(80, 140), life: 0.15, max: 0.15, color: Math.random() < 0.5 ? '#f88830' : '#f8c830', size: 3, grav: 0 });
  }
  addFx(kind, x, y, flip = false, dy = 0) {
    const dur = kind === 'muzzle' ? 0.06 : kind === 'bigBoom' ? 0.5 : 0.4;
    this.fx.push({ kind, x, y, t: 0, dur, flip, dy });
  }
  addEnemy(e) {
    this.enemies.push(e);
  }
  spawnEnemyAt(kind, x, y) {
    const e = makeEnemy(kind, x, y);
    e.active = true;
    this.enemies.push(e);
    this.smoke(x, y - 8, 6);
    return e;
  }

  // -------------------------------------------------------------- platforms
  platformsFor(e) {
    const list = [];
    for (const o of this.players) {
      if (o === e || o.state !== 'normal') continue;
      if (e.onPlat && e.onPlat.owner === o) {
        /* keep */
      }
      // no stacking loops: if o is standing on e, e can't stand on o
      if (o.onPlat && o.onPlat.owner === e) continue;
      list.push({ x: o.x, y: o.y, w: o.w, owner: o, kind: 'head' });
    }
    for (const tk of this.tanks) if (tk.driver !== e) list.push(...tk.platforms());
    for (const s of this.seesaws) {
      const tl = s.tilt * 4;
      list.push({ x: s.x, y: s.y + tl, w: s.w / 2, owner: s, half: -1, kind: 'seesaw', slack: 8 });
      list.push({ x: s.x + s.w / 2, y: s.y - tl, w: s.w / 2, owner: s, half: 1, kind: 'seesaw', slack: 8 });
    }
    for (const en of this.enemies) if (en.solidTop && !en.dead) list.push({ x: en.x, y: en.y, w: en.w, owner: en, kind: 'bunker' });
    return list;
  }

  // -------------------------------------------------------------- tiles
  bumpTile(p, hit) {
    const w = this.world;
    const { x, y, id } = hit;
    w.bump.set(`${x},${y}`, 0.15);
    if (id === t.QCOIN) {
      w.set(x, y, t.USED);
      this.collectCoin(x * TS + 8, y * TS - 8, p);
      this.particles.push({ x: x * TS + 4, y: y * TS - 12, vx: 0, vy: -220, life: 0.45, max: 0.45, color: 'coin', size: 0, grav: 700 });
    } else if (id === t.QPOWER) {
      w.set(x, y, t.USED);
      this.pickups.push({ kind: 'mushroom', x: x * TS + 1, y: y * TS - 15, w: 14, h: 14, vx: 50, vy: -120, static: false });
      sfx('power');
    } else if (id === t.BRICK && p.who === 'plumber') {
      this.breakTile(x, y);
    } else sfx('bump');
    // knock out enemies standing on the bumped block
    for (const e of this.enemies)
      if (!e.dead && Math.abs(e.y + e.h - y * TS) < 3 && e.x + e.w > x * TS && e.x < x * TS + TS) e.damage(this, 99, 'bump');
  }

  breakTile(x, y) {
    const id = this.world.get(x, y);
    this.world.set(x, y, t.EMPTY);
    const col =
      id === t.STEEL ? ['#a4a4b0', '#5c5c6c'] : id === t.SANDBAG ? ['#b0642c', '#5c3418'] : ['#b0642c', '#f88830'];
    this.debris(x, y, col);
    sfx('brick');
    this.score += 20;
  }

  damageTile(x, y, d, explosive = false) {
    const w = this.world;
    const id = w.get(x, y);
    const breakable = id === t.STEEL || id === t.SANDBAG || (explosive && (id === t.BRICK || id === t.FRAGILE));
    if (!breakable) return false;
    const i = y * w.w + x;
    w.hp[i] -= d;
    if (w.hp[i] <= 0) this.breakTile(x, y);
    else if (Math.random() < 0.5) this.particles.push({ x: x * TS + 8, y: y * TS + 8, vx: rand(-60, 60), vy: rand(-90, -20), life: 0.25, max: 0.25, color: '#f8f8f0', size: 1, grav: 400 });
    return true;
  }

  groundPound(p) {
    this.shake(5);
    sfx('pound');
    this.dust(p.x, p.y + p.h);
    this.dust(p.x + p.w, p.y + p.h);
    const w = this.world;
    if (p.groundRow !== undefined && !p.onPlat) {
      const x0 = Math.floor((p.x + 1) / TS);
      const x1 = Math.floor((p.x + p.w - 1) / TS);
      for (let x = x0; x <= x1; x++) {
        const id = w.get(x, p.groundRow);
        if (id === t.FRAGILE || id === t.BRICK) this.breakTile(x, p.groundRow);
      }
    }
    for (const e of this.enemies) {
      if (e.dead || !e.active) continue;
      if (Math.abs(e.cx - p.cx) < 64 && Math.abs(e.y + e.h - (p.y + p.h)) < 20) {
        e.stun = 2;
        e.damage(this, e.kind === 'minitank' ? 3 : 1, 'pound');
      }
    }
    // SEE-SAW MORTAR
    const pl = p.onPlat;
    if (pl && pl.kind === 'seesaw') {
      const s = pl.owner;
      s.tilt = pl.half;
      for (const o of this.players) {
        if (o === p || o.state !== 'normal') continue;
        if (o.onPlat && o.onPlat.owner === s && o.onPlat.half === -pl.half) {
          o.vy = -PHYS.seesaw;
          o.onGround = false;
          o.y -= 3;
          o.pogoTrail = 0.6;
          this.popText(o.cx, o.y - 8, 'MORTAR!', '#f8c830');
          sfx('pogo');
          this.shake(4);
        }
      }
    }
  }

  // -------------------------------------------------------------- co-op actions
  pogo(g, p) {
    if (p.state === 'carried') g.carrying = false;
    p.state = 'normal';
    p.vy = -PHYS.pogo;
    p.onGround = false;
    p.y -= 3;
    p.pogoTrail = 0.7;
    p.pound = 0;
    sfx('pogo');
    this.shake(4);
    this.addFx('boom', p.cx, p.y + p.h + 4);
    this.popText(p.cx, p.y - 10, 'POGO CANNON!', '#f88830');
  }

  plumberInteract(p) {
    for (const l of this.levers) {
      if (!l.on && overlap(p, l, 6)) {
        l.on = true;
        sfx('lever');
        this.popText(l.x + 7, l.y - 8, 'TUAS DITARIK!', '#9cc850');
        this.signal(l.opens);
        return;
      }
    }
  }

  gunnerInteract(g) {
    for (const l of this.levers)
      if (!l.on && overlap(g, l, 6)) return this.popText(l.x + 7, l.y - 8, 'Cuma PLUMBER yang bisa!', '#f88830');
    for (const v of this.valves) if (!v.done && overlap(g, v, 6)) return this.popText(v.x + 8, v.y - 8, 'Cuma PLUMBER!', '#f88830');
  }

  signal(id) {
    let any = false;
    for (const d of this.doors)
      if (d.id === id && !d.open && !d.hold) {
        this.setDoor(d, true);
        any = true;
      }
    for (const b of this.bridges)
      if (b.id === id && !b.built) {
        b.built = true;
        for (let y = b.y0; y <= b.y1; y++)
          for (let x = b.x0; x <= b.x1; x++) {
            this.world.set(x, y, b.tile);
            this.particles.push({ x: x * TS + 8, y: y * TS + 4, vx: 0, vy: -30, life: 0.4, max: 0.4, color: '#f8c830', size: 2, grav: 0 });
          }
        any = true;
      }
    if (any) {
      sfx('gate');
      this.shake(2);
    }
  }

  setDoor(d, open) {
    if (d.open === open) return;
    if (!open) {
      // don't crush anyone standing in the doorway
      const r = { x: d.x0 * TS, y: d.y0 * TS, w: (d.x1 - d.x0 + 1) * TS, h: (d.y1 - d.y0 + 1) * TS };
      for (const p of this.players) if (overlap(p, r)) return;
      for (const tk of this.tanks) if (overlap(tk, r)) return;
    }
    d.open = open;
    for (let y = d.y0; y <= d.y1; y++) for (let x = d.x0; x <= d.x1; x++) this.world.set(x, y, open ? t.EMPTY : t.GATE);
    if (!d.hold) sfx('gate');
    else sfx('lever');
  }

  pipeUnder(p) {
    for (const pp of this.pipes) {
      const top = pp.y * TS;
      if (Math.abs(p.y + p.h - top) < 2 && p.cx > pp.x * TS + 3 && p.cx < pp.x * TS + 29) return pp;
    }
    return null;
  }
  pipeById(id) {
    return this.pipes.find((p) => p.id === id);
  }
  onPipeExit() {}

  tankNear(g) {
    return this.tanks.find((tk) => !tk.dead && !tk.driver && overlap(g, tk, 6));
  }
  enterTank(g, tk) {
    if (g.carrying) {
      g.carrying = false;
      this.plumber.state = 'normal';
    }
    g.state = 'tank';
    g.tank = tk;
    tk.driver = g;
    if (g.crouch) {
      g.crouch = false;
      g.h = 20;
    }
    sfx('tank');
    this.popText(tk.cx, tk.y - 14, 'SV-001!', '#9cc850');
  }
  exitTank(g, tk, forced) {
    tk.driver = null;
    g.tank = null;
    g.state = 'normal';
    g.x = tk.x + tk.w / 2 - g.w / 2;
    g.y = tk.y - g.h - 2;
    g.vy = -260;
    g.inv = Math.max(g.inv, forced ? 1.5 : 0.3);
  }
  callTank(g) {
    const x = g.cx - 26;
    const feet = g.y + g.h - 30;
    const probe = { x, y: feet - 32, w: 52, h: 32 };
    const w = this.world;
    for (let yy = probe.y; yy < probe.y + probe.h; yy += 8)
      for (let xx = probe.x; xx < probe.x + probe.w; xx += 8)
        if (w.solidAt(xx, yy)) {
          this.popText(g.cx, g.y - 10, 'GAK MUAT DI SINI!', '#f88830');
          return false;
        }
    const tk = new Tank(x, feet, true);
    tk.face = g.face;
    this.tanks.push(tk);
    this.enterTank(g, tk);
    this.flashScreen(0.1);
    this.popText(g.cx, g.y - 24, 'SV-001 TANK CALL!', '#9cc850');
    return true;
  }

  collectCoin(x, y, who) {
    this.coins++;
    this.score += 50;
    this.plumber.addMeter(4);
    this.gunner.addMeter(2);
    sfx('coin');
  }

  // -------------------------------------------------------------- weapons
  playerBullet(x, y, vx, vy, kind, dmg, extra = {}) {
    const size = { pistol: [6, 3], hmg: [7, 3], shotgun: [4, 4], rocket: [10, 5], flame: [8, 8], cannon: [9, 6], grenade: [6, 7] }[kind] || [5, 4];
    this.bullets.push({ x: x - size[0] / 2, y: y - size[1] / 2, w: size[0], h: size[1], vx, vy, kind, dmg, life: 0.8, hits: new Set(), t: 0, ...extra });
  }
  fireWeapon(g, kind, m) {
    const dx = m.dx;
    const dy = m.dy;
    if (kind === 'pistol') {
      this.playerBullet(m.x, m.y, dx * 430 + (dy ? rand(-8, 8) : 0), dy * 430 + (dx ? rand(-8, 8) : 0), 'pistol', 1);
      sfx('pistol');
    } else if (kind === 'hmg') {
      const a = rand(-0.06, 0.06);
      const s = 470;
      this.playerBullet(m.x, m.y, (dx * Math.cos(a) - dy * Math.sin(a)) * s, (dx * Math.sin(a) + dy * Math.cos(a)) * s, 'hmg', 1.1);
      sfx('hmg');
    } else if (kind === 'shotgun') {
      for (let i = 0; i < 7; i++) {
        const a = -0.32 + (i / 6) * 0.64 + rand(-0.04, 0.04);
        const s = rand(340, 420);
        this.playerBullet(m.x, m.y, (dx * Math.cos(a) - dy * Math.sin(a)) * s, (dx * Math.sin(a) + dy * Math.cos(a)) * s, 'shotgun', 1.6, { life: 0.24, pierce: true });
      }
      sfx('shotgun');
      this.shake(2);
    } else if (kind === 'rocket') {
      this.playerBullet(m.x, m.y, dx * 140, dy * 140, 'rocket', 7, { life: 1.6, ax: dx * 700, ay: dy * 700 });
      sfx('rocket');
    } else if (kind === 'flame') {
      this.playerBullet(m.x, m.y, dx * 230 + rand(-15, 15), dy * 230 + rand(-25, 5), 'flame', 0.55, { life: 0.34, pierce: true });
      sfx('flame');
    }
    this.addFx('muzzle', m.x, m.y, dx < 0, dy);
  }
  spawnGrenade(g) {
    this.bullets.push({ x: g.cx - 3, y: g.y + 2, w: 6, h: 7, vx: g.face * 175 + g.vx * 0.4, vy: -250, kind: 'grenade', dmg: 8, life: 1.5, hits: new Set(), t: 0, bounces: 0 });
  }

  explode(x, y, radius, big, src) {
    this.addFx(big ? 'bigBoom' : 'boom', x, y);
    sfx(big ? 'boom' : 'smallBoom');
    this.shake(big ? 6 : 3);
    if (!radius) return;
    const dmg = big ? 10 : 6;
    if (src === 'player') {
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.cx - x, e.cy - y) < radius + Math.max(e.w, e.h) / 2) e.damage(this, dmg, 'explosion');
      }
      if (this.boss && !this.boss.dead) {
        for (const z of this.boss.hitZones())
          if (x > z.x - radius && x < z.x + z.w + radius && y > z.y - radius && y < z.y + z.h + radius) {
            this.boss.damage(this, dmg * Math.max(0.5, z.mul));
            break;
          }
      }
      const r = Math.ceil(radius / TS);
      const tx = Math.floor(x / TS);
      const ty = Math.floor(y / TS);
      for (let yy = ty - r; yy <= ty + r; yy++)
        for (let xx = tx - r; xx <= tx + r; xx++)
          if (Math.hypot((xx + 0.5) * TS - x, (yy + 0.5) * TS - y) < radius + 8) this.damageTile(xx, yy, 4, true);
      // a blast on the downed plumber's bubble revives him too
      const pl = this.plumber;
      if (pl.state === 'downed' && Math.hypot(pl.cx - x, pl.cy - y) < radius + 12) pl.revive += 0.5;
    } else if (src === 'enemy') {
      for (const p of this.players) {
        if (!p.alive) continue;
        if (Math.hypot(p.cx - x, p.cy - y) < radius + 6) p.hurt(this, 1, x);
      }
      for (const tk of this.tanks) if (!tk.dead && tk.driver && Math.hypot(tk.cx - x, tk.cy - y) < radius + 20) tk.damage(this, 3);
    }
  }

  enemyShot(x, y, vx, vy, kind) {
    const size = { bullet: [5, 4], cannon: [7, 7], grenade: [6, 7], fireball: [8, 8], shell: [10, 7], wave: [12, 14] }[kind] || [5, 5];
    if (kind === 'bullet') sfx('enemyShot');
    this.shots.push({ x: x - size[0] / 2, y: y - size[1] / 2, w: size[0], h: size[1], vx, vy, kind, life: kind === 'wave' ? 2.6 : 3, bounces: 0, t: 0 });
  }

  // -------------------------------------------------------------- events
  onEnemyKilled(e, how, quiet = false) {
    this.stats.kills++;
    this.score += e.score;
    if (how === 'stomp' || how === 'pound' || how === 'star') this.plumber.addMeter(7);
    else this.gunner.addMeter(6);
    if (quiet) return;
    if (['minitank', 'bunker', 'bill'].includes(e.kind) || how === 'explosion') this.explode(e.cx, e.cy, 0, e.kind === 'minitank' || e.kind === 'bunker', 'fx');
    else if (how === 'stomp' && e.kind === 'goomba') this.corpses.push({ img: this.A.goombaDead, x: e.x, y: e.y + e.h, face: e.face, life: 0.6 });
    else this.burst(e.cx, e.cy, 8, ['#f8f8f0', '#f8c830', '#d8281c']);
    if (how === 'stomp') sfx('stomp');
    this.popText(e.cx, e.y - 4, `${e.score}`, '#f8f8f0');
    if (Math.random() < 0.3) this.pickups.push({ kind: 'coin', x: e.cx - 4, y: e.y, w: 8, h: 12, vx: rand(-30, 30), vy: -180, static: false, life: 8 });
  }

  onPlayerDown(p) {
    if (p.who === 'gunner' && p.carrying) {
      p.carrying = false;
      this.plumber.state = 'normal';
    }
    if (p.who === 'plumber' && p.state === 'downed' && this.gunner.carrying) this.gunner.carrying = false;
    this.popText(p.cx, p.y - 10, p.who === 'plumber' ? 'TEMBAK GELEMBUNGNYA!' : 'STOMP GELEMBUNGNYA!', '#f8c830');
  }

  onBleedOut(p) {
    const other = p === this.plumber ? this.gunner : this.plumber;
    this.lives--;
    if (this.lives < 0) return this.gameOver();
    this.resetPlayer(p);
    const anchor = other.state === 'tank' && other.tank ? { x: other.tank.cx, y: other.tank.y } : other.lastSafe;
    p.place(anchor.x, anchor.y + (other.state === 'tank' ? 0 : other.h));
    p.inv = 2;
    this.popText(p.cx, p.y - 10, '-1 NYAWA', '#d8281c');
  }

  fallOut(p) {
    if (p.state === 'downed') return;
    p.hp -= 1;
    p.vx = p.vy = 0;
    p.x = p.lastSafe.x;
    p.y = p.lastSafe.y;
    p.pound = 0;
    p.cling = 0;
    sfx('hurt');
    if (p.hp <= 0) p.goDown(this);
    else {
      p.inv = 1.5;
      this.popText(p.cx, p.y - 10, 'AUW!', '#d8281c');
    }
  }

  gameOver() {
    this.mode = 'gameover';
    this.modeT = 0;
    stopMusic();
    sfx('over');
  }

  respawnAll() {
    this.lives--;
    if (this.lives < 0) return this.gameOver();
    // a lost boss fight resets the arena
    if (this.arena && this.arena.started && !this.arena.done) this.resetArena();
    for (const p of this.players) this.resetPlayer(p);
    this.plumber.place(this.checkpoint.p.x, this.checkpoint.p.y);
    this.gunner.place(this.checkpoint.g.x, this.checkpoint.g.y);
    for (const tk of this.tanks) if (tk.driver) tk.driver = null;
    this.popText(this.gunner.cx, this.gunner.y - 20, '-1 NYAWA · BALIK KE CHECKPOINT', '#d8281c');
    this.views = [];
  }

  resetArena() {
    const a = this.arena;
    a.started = false;
    this.boss = null;
    const [x0, y0, x1, y1] = a.lock;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.world.get(x, y) === t.LOCK) this.world.set(x, y, t.EMPTY);
    this.enemies = this.enemies.filter((e) => !(e.cx > a.x0 && e.cx < a.x1 && e.cy > a.y0 && e.cy < a.y1));
    playMusic(this.def.music);
  }

  onBossDying() {
    this.flashScreen(0.2);
    this.shots = [];
  }
  onBossDead(b) {
    this.score += 10000;
    this.arena.done = true;
    this.clearT = 2.2;
    stopMusic();
    sfx('clear');
  }

  // -------------------------------------------------------------- main update
  update(dt) {
    this.time += dt;
    this.input.update();
    if (this.mode === 'title') return this.updateTitle(dt);
    if (this.mode === 'gameover') {
      this.modeT += dt;
      const a = this.input.p('plumber');
      const b = this.input.p('gunner');
      if (this.modeT > 1.5 && (a.jump.pressed || b.jump.pressed)) {
        const z = this.zoneIndex;
        const score = Math.floor(this.score / 2);
        this.startGame(z);
        this.score = score;
      }
      return;
    }
    if (this.mode === 'clear' || this.mode === 'victory') {
      this.modeT += dt;
      this.updateFx(dt);
      const a = this.input.p('plumber');
      const b = this.input.p('gunner');
      if (this.modeT > 1.5 && (a.jump.pressed || b.jump.pressed)) {
        if (this.mode === 'victory') {
          this.mode = 'title';
          this.ready = { plumber: false, gunner: false };
          stopMusic();
        } else this.loadZone(this.zoneIndex + 1);
      }
      return;
    }
    if (this.paused) return;
    this.zoneTime += dt;
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT <= 0) this.shakeAmp = 0;
    this.flashT = Math.max(0, this.flashT - dt);

    // tanks first (players ride them), then the gunner, then the plumber (who rides the gunner)
    for (const o of [...this.players, ...this.tanks]) {
      o.px = o.x;
      o.py = o.y;
    }
    for (const tk of this.tanks) tk.update(this, dt);
    this.tanks = this.tanks.filter((tk) => !tk.gone);
    for (const p of this.players) {
      if (p.onPlat && p.state === 'normal') {
        const own = p.onPlat.owner;
        if (own.px !== undefined) {
          const dx = own.x - own.px;
          const dy = own.y - own.py;
          if (Math.abs(dx) < 20) p.x += dx;
          if (Math.abs(dy) < 20) p.y += dy;
        }
      }
      p.update(this, dt);
    }
    // gunner can't fit into pipes
    const g = this.gunner;
    if (g.state === 'normal' && g.crouch && g.groundTile === t.PIPE && this.input.p('gunner').down.pressed) this.popText(g.cx, g.y - 12, 'KEGEDEAN! Pipa buat PLUMBER', '#f88830');

    this.updateObjects(dt);
    for (const e of this.enemies) {
      e.wake(this);
      if (e.active && !e.dead) e.update(this, dt);
    }
    if (this.boss) {
      this.boss.update(this, dt);
      if (this.boss.dead) this.boss = null;
    }
    this.updateBullets(dt);
    this.updateShots(dt);
    this.collidePlayers(dt);
    this.updatePickups(dt);
    this.updateFx(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // both down at once → lose a life, back to the checkpoint
    if (this.plumber.state === 'downed' && this.gunner.state === 'downed') {
      this.bothDownT += dt;
      if (this.bothDownT > 1.6) {
        this.bothDownT = 0;
        this.respawnAll();
      }
    } else this.bothDownT = 0;

    if (this.clearT !== undefined && this.clearT > 0) {
      this.clearT -= dt;
      if (this.clearT <= 0) {
        this.clearT = undefined;
        this.stats.time = this.zoneTime;
        this.modeT = 0;
        this.mode = this.zoneIndex >= ZONES.length - 1 ? 'victory' : 'clear';
        if (this.mode === 'victory') playMusic(0);
      }
    }
    this.updateCamera(dt);
  }

  updateTitle(dt) {
    this.titleT += dt;
    const a = this.input.p('plumber');
    const b = this.input.p('gunner');
    if (a.jump.pressed) {
      this.ready.plumber = !this.ready.plumber;
      sfx('select');
    }
    if (b.jump.pressed) {
      this.ready.gunner = !this.ready.gunner;
      sfx('select');
    }
    const k = this.input.keys;
    if (k.has('Digit1') || this.input.lastTaps.has('Digit1')) this.startZoneChoice = 0;
    if (k.has('Digit2') || this.input.lastTaps.has('Digit2')) this.startZoneChoice = 1;
    if (k.has('Digit3') || this.input.lastTaps.has('Digit3')) this.startZoneChoice = 2;
    if (this.ready.plumber && this.ready.gunner) {
      this.readyT = (this.readyT || 0) + dt;
      if (this.readyT > 0.9) {
        this.readyT = 0;
        this.ready = { plumber: false, gunner: false };
        this.startGame(this.startZoneChoice);
      }
    } else this.readyT = 0;
  }

  updateObjects(dt) {
    const pl = this.plumber;
    // checkpoints
    for (const c of this.checkpoints) {
      if (c.on) continue;
      for (const p of this.players)
        if (p.alive && Math.abs(p.cx - (c.x + 7)) < 18 && Math.abs(p.y + p.h - c.feet) < 40) {
          for (const o of this.checkpoints) if (o !== c && o.on) o.on = false;
          c.on = true;
          this.checkpoint = { p: { x: c.x - 10, y: c.feet }, g: { x: c.x + 14, y: c.feet } };
          sfx('select');
          this.popText(c.x + 7, c.y - 6, 'CHECKPOINT', '#9cc850');
          // a checkpoint also tops up both players a little
          for (const o of this.players) if (o.alive) o.hp = Math.max(o.hp, 2);
          break;
        }
    }
    // valves (PIPE-SYNC)
    for (const v of this.valves) {
      if (v.done) continue;
      const holding = pl.state === 'normal' && pl.interacting && overlap(pl, v, 8);
      v.holding = holding;
      if (holding) {
        v.progress += dt;
        v.spin += dt * 6;
      }
      if (v.progress > 0) {
        v.spawnT -= dt;
        const alive = this.enemies.filter((e) => !e.dead && e.active).length;
        if (v.spawnT <= 0 && alive < 7) {
          const [sx, sy] = v.spawns[Math.floor(Math.random() * v.spawns.length)];
          const kinds = ['goomba', 'goomba', 'trooper', 'parakoopa', 'goomba', 'shyguy'];
          this.spawnEnemyAt(kinds[Math.floor(Math.random() * kinds.length)], sx * TS, (sy + 1) * TS);
          v.spawnT = rand(1.6, 2.6);
        }
      }
      if (v.progress >= v.time) {
        v.done = true;
        this.signal(v.opens);
        this.popText(v.x + 8, v.y - 10, 'VALVE KEBUKA!', '#9cc850');
        sfx('clear');
      }
    }
    // pressure plates hold doors open
    const pressed = new Set();
    for (const p of this.plates) {
      p.down = false;
      for (const o of [...this.players, ...this.tanks]) {
        if (o.dead || (o.state && o.state !== 'normal' && o.state !== 'tank')) continue;
        if (o.x + o.w > p.x + 2 && o.x < p.x + p.w - 2 && Math.abs(o.y + o.h - (p.y + p.h)) < 6) p.down = true;
      }
      if (p.down) pressed.add(p.opens);
    }
    for (const d of this.doors) if (d.hold) this.setDoor(d, pressed.has(d.id));
    // POWs
    for (const w of this.pows) {
      if (w.freed) {
        w.t += dt;
        if (w.t > 1.4) w.x += -70 * dt;
        continue;
      }
      for (const p of this.players)
        if (p.alive && overlap(p, w)) {
          w.freed = true;
          this.lives++;
          this.stats.pows++;
          this.score += 1000;
          sfx('pow');
          this.popText(w.x + 7, w.y - 10, 'POW RESCUED! +1 NYAWA', '#f8c830');
          const drops = ['hmg', 'grenade', 'rocket', 'mushroom', 'shotgun', 'flame'];
          const kind = drops[(this.stats.pows - 1 + this.zoneIndex) % drops.length];
          this.pickups.push({ kind, x: w.x, y: w.y, w: 14, h: 14, vx: 40, vy: -200, static: false });
          break;
        }
    }
    this.pows = this.pows.filter((w) => w.t < 4);
    for (const s of this.seesaws) s.tilt *= 1 - Math.min(1, dt * 0.8);
    // boss arena
    const a = this.arena;
    if (a && !a.started && !a.done) {
      const inside = (p) => p.cx > a.x0 + 4 && p.cx < a.x1 && p.cy > a.y0 && p.cy < a.y1 + 8;
      const ins = this.players.map(inside);
      if (ins[0] && ins[1] && this.players.every((p) => p.alive)) this.startBoss();
      else if (ins[0] !== ins[1]) this.waitHint = 0.2;
    }
    if (this.waitHint) this.waitHint = Math.max(0, this.waitHint - dt);
  }

  startBoss() {
    const a = this.arena;
    a.started = true;
    const [x0, y0, x1, y1] = a.lock;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.world.get(x, y) === t.EMPTY) this.world.set(x, y, t.LOCK);
    this.boss = makeBoss(a.boss, a.bx, a.by, a);
    this.banner = { text: `BOSS: ${this.boss.name}`, t: 2.5, boss: true };
    playMusic(3);
    this.shake(6);
    sfx('boom');
  }

  updateBullets(dt) {
    const w = this.world;
    for (const b of this.bullets) {
      b.t += dt;
      b.life -= dt;
      if (b.ax !== undefined) {
        b.vx += b.ax * dt;
        b.vy += b.ay * dt;
        const s = Math.hypot(b.vx, b.vy);
        if (s > 420) {
          b.vx *= 420 / s;
          b.vy *= 420 / s;
        }
        if (Math.random() < 0.6) this.smoke(b.x + b.w / 2, b.y + b.h / 2, 1, true);
      }
      if (b.kind === 'grenade') b.vy += GRAVITY * 0.9 * dt;
      if (b.kind === 'flame') {
        b.vx *= 1 - dt * 2;
        b.vy -= 60 * dt;
        b.w = b.h = 6 + b.t * 30;
      }
      const ox = b.x;
      const oy = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const tx = Math.floor(cx / TS);
      const ty = Math.floor(cy / TS);
      const id = w.get(tx, ty);
      if (w.solid(id) && id !== t.LOCK) {
        if (b.kind === 'grenade') {
          // bounce
          const wasX = w.solid(w.get(Math.floor((ox + b.w / 2) / TS), ty));
          if (wasX) b.vx = -b.vx * 0.5;
          else b.vy = -Math.abs(b.vy) * 0.45;
          b.x = ox;
          b.y = oy;
          b.vx *= 0.75;
          b.bounces++;
          if (b.bounces > 2) b.life = 0;
        } else if (b.kind === 'rocket' || b.kind === 'cannon') {
          b.life = 0;
          this.explode(cx, cy, b.kind === 'cannon' ? 34 : 30, b.kind === 'cannon', 'player');
          b.exploded = true;
        } else {
          const tileD = b.kind === 'shotgun' ? 1.4 : b.kind === 'flame' ? 0.2 : 1;
          if (this.damageTile(tx, ty, tileD)) {
            if (b.vy === 0 || Math.abs(b.vx) > Math.abs(b.vy)) this.damageTile(tx, ty - 1, tileD);
            else this.damageTile(tx - 1, ty, tileD * 0.3), this.damageTile(tx + 1, ty, tileD * 0.3);
          }
          b.life = 0;
          this.particles.push({ x: cx, y: cy, vx: -b.vx * 0.1, vy: -40, life: 0.12, max: 0.12, color: '#f8c830', size: 2, grav: 0 });
        }
      }
      if (b.life <= 0) {
        if (b.kind === 'grenade' && !b.exploded) {
          b.exploded = true;
          this.explode(cx, cy, 34, false, 'player');
        }
        continue;
      }
      // enemies
      for (const e of this.enemies) {
        if (e.dead || !e.shootable || b.hits.has(e)) continue;
        if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
          if (b.kind === 'rocket' || b.kind === 'grenade' || b.kind === 'cannon') {
            b.life = 0;
            b.exploded = true;
            this.explode(cx, cy, b.kind === 'rocket' ? 30 : 34, b.kind !== 'rocket', 'player');
            break;
          }
          e.damage(this, b.dmg, 'shot');
          b.hits.add(e);
          if (!b.pierce) {
            b.life = 0;
            break;
          }
        }
      }
      if (b.life <= 0) continue;
      // boss
      if (this.boss && !this.boss.dead && this.boss.dying <= 0) {
        const zones = this.boss.hitZones();
        // weak points first
        zones.sort((a2, b2) => b2.mul - a2.mul);
        for (const z of zones) {
          if (b.hits.has(z.mul)) continue;
          if (b.x < z.x + z.w && b.x + b.w > z.x && b.y < z.y + z.h && b.y + b.h > z.y) {
            if (b.kind === 'rocket' || b.kind === 'grenade' || b.kind === 'cannon') {
              b.life = 0;
              b.exploded = true;
              this.explode(cx, cy, 0, false, 'fx');
              this.boss.damage(this, b.dmg * Math.max(0.6, z.mul));
            } else {
              this.boss.damage(this, b.dmg * z.mul);
              if (z.mul >= 1) this.particles.push({ x: cx, y: cy, vx: 0, vy: -30, life: 0.15, max: 0.15, color: '#f8f8f0', size: 3, grav: 0 });
              if (!b.pierce) b.life = 0;
              else b.hits.add(z.mul);
            }
            break;
          }
        }
      }
      if (b.life <= 0) continue;
      // sky switches
      for (const tg of this.targets) {
        if (tg.hit) continue;
        if (b.x < tg.x + tg.w && b.x + b.w > tg.x && b.y < tg.y + tg.h && b.y + b.h > tg.y) {
          tg.hit = true;
          b.life = 0;
          sfx('lever');
          this.popText(tg.x + 7, tg.y - 6, 'SAKLAR KENA!', '#9cc850');
          this.signal(tg.opens);
        }
      }
      // revive the downed plumber by shooting his bubble
      const pl = this.plumber;
      if (pl.state === 'downed' && b.life > 0 && Math.hypot(cx - pl.cx, cy - pl.cy) < 18) {
        pl.revive += b.kind === 'flame' ? 0.06 : b.kind === 'hmg' ? 0.15 : 0.25;
        b.life = 0;
        this.burst(cx, cy, 3, ['#f8f8f0', '#68a8f8']);
        sfx('coin');
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -50 && b.x < w.pxW + 50 && b.y > -80 && b.y < w.pxH + 50);
  }

  updateShots(dt) {
    const w = this.world;
    for (const s of this.shots) {
      s.t += dt;
      s.life -= dt;
      if (s.kind === 'cannon' || s.kind === 'grenade' || s.kind === 'fireball') s.vy += GRAVITY * dt * (s.kind === 'fireball' ? 0.8 : 1);
      if (s.kind === 'wave') {
        s.x += s.vx * dt;
        if (Math.random() < 0.5) this.particles.push({ x: s.x + s.w / 2, y: s.y + s.h, vx: rand(-20, 20), vy: rand(-90, -40), life: 0.3, max: 0.3, color: '#f88830', size: 3, grav: 200 });
        if (w.solidAt(s.x + (s.vx > 0 ? s.w : 0), s.y + s.h / 2)) s.life = 0;
      } else {
        const oy = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const id = w.get(Math.floor(cx / TS), Math.floor(cy / TS));
        if (w.solid(id) || (id === t.GIRDER && s.vy > 0 && s.kind !== 'bullet' && s.kind !== 'shell')) {
          if (s.kind === 'fireball' && s.bounces < 3 && !w.solid(w.get(Math.floor(cx / TS), Math.floor((oy + s.h / 2) / TS)))) {
            s.y = oy;
            s.vy = -230;
            s.bounces++;
          } else if (s.kind === 'grenade' && s.bounces < 1) {
            s.y = oy;
            s.vy = -Math.abs(s.vy) * 0.35;
            s.vx *= 0.5;
            s.bounces++;
          } else {
            s.life = 0;
            if (s.kind === 'cannon' || s.kind === 'grenade') this.explode(cx, cy, 24, false, 'enemy');
          }
        }
      }
      if (s.life <= 0) {
        if ((s.kind === 'grenade' || s.kind === 'cannon') && !s.boomed) {
          s.boomed = true;
          this.explode(s.x + s.w / 2, s.y + s.h / 2, 24, false, 'enemy');
        }
        continue;
      }
      // hit tanks
      for (const tk of this.tanks) {
        if (tk.dead || !tk.driver) continue;
        if (overlap(s, tk)) {
          tk.damage(this, s.kind === 'shell' ? 3 : 1);
          if (s.kind !== 'wave') s.life = 0;
          if (s.kind === 'cannon' || s.kind === 'grenade') {
            s.boomed = true;
            this.explode(s.x, s.y, 0, false, 'fx');
          }
        }
      }
      if (s.life <= 0) continue;
      for (const p of this.players) {
        if (!p.alive || p.state === 'pipe' || p.state === 'tank') continue;
        if (overlap(s, p, -1)) {
          if (s.kind === 'cannon' || s.kind === 'grenade') {
            s.life = 0;
            s.boomed = true;
            this.explode(s.x + s.w / 2, s.y + s.h / 2, 24, false, 'enemy');
          } else {
            p.hurt(this, 1, s.x);
            if (s.kind !== 'wave') s.life = 0;
          }
          break;
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.y < w.pxH + 40);
  }

  collidePlayers(dt) {
    const pl = this.plumber;
    const gn = this.gunner;
    // stomp / touch enemies
    for (const p of this.players) {
      if (!p.alive || p.state === 'pipe' || p.state === 'tank' || p.state === 'carried') continue;
      const prevBottom = p.y + p.h - p.vy * dt - 2;
      for (const e of this.enemies) {
        if (e.dead || !e.active) continue;
        if (!overlap(p, e, -1)) continue;
        const fromAbove = p.vy > 0 && prevBottom <= e.y + 7;
        if (p === pl) {
          if (fromAbove && e.stompable) {
            const pounding = pl.pound === 2;
            e.stomp(this, pl);
            if (pounding && !e.dead) e.damage(this, 3, 'stomp');
            pl.vy = -(this.input.p('plumber').jump.down ? PHYS.stompBounceHeld : PHYS.stompBounce);
            pl.pound = 0;
            pl.inv = Math.max(pl.inv, 0.15);
            sfx('stomp');
            this.dust(pl.cx, pl.y + pl.h);
            continue;
          }
          if (pl.star > 0) {
            e.damage(this, 99, 'star');
            continue;
          }
        } else if (fromAbove && e.stompable) {
          // the gunner's boots: a weaker bounce
          e.damage(this, 1, 'shot');
          p.vy = -230;
          sfx('stomp');
          continue;
        }
        if (e.kind === 'shell') {
          e.touchedBy(this, p);
          continue;
        }
        if (e.touchHurts && e.stun <= 0) p.hurt(this, 1, e.cx);
      }
      // bosses
      const b = this.boss;
      if (b && !b.dead && b.dying <= 0) {
        let bounced = false;
        if (p.vy > 0) {
          for (const z of b.stompZones()) {
            if (p.x + p.w > z.x && p.x < z.x + z.w && prevBottom <= z.y + 8 && p.y + p.h >= z.y) {
              const dmg = p === pl ? z.dmg * (pl.pound === 2 ? 1.5 : 1) : z.dmg * 0.3;
              b.damage(this, dmg);
              p.vy = -PHYS.stompBounceHeld;
              p.y = z.y - p.h - 1;
              if (p === pl) pl.pound = 0;
              p.inv = Math.max(p.inv, 0.35);
              sfx('stomp');
              bounced = true;
              break;
            }
          }
        }
        if (!bounced)
          for (const z of b.hurtZones())
            if (overlap(p, z, -1)) {
              if (p === pl && pl.star > 0) b.damage(this, 25 * dt);
              else p.hurt(this, 1, b.cx);
              break;
            }
      }
    }
    // tanks vs boss contact
    if (this.boss && !this.boss.dead && this.boss.dying <= 0)
      for (const tk of this.tanks)
        if (!tk.dead && tk.driver) for (const z of this.boss.hurtZones()) if (overlap(tk, z)) tk.damage(this, 6 * dt);
    // revive the downed gunner: stomp his bubble, or hold F next to it
    if (gn.state === 'downed' && pl.alive && pl.state === 'normal') {
      const d = Math.hypot(pl.cx - gn.cx, pl.cy - gn.cy);
      if (d < 18 && pl.vy > 0 && pl.y + pl.h < gn.cy) {
        gn.revive += 0.5;
        pl.vy = -PHYS.stompBounceHeld;
        sfx('stomp');
        this.burst(gn.cx, gn.cy - 8, 4, ['#f8f8f0', '#68a8f8']);
      } else if (d < 26 && pl.interacting) gn.revive += dt * 0.8;
    }
    if (gn.revive >= 1 || pl.revive >= 1) this.stats.revives++;
  }

  updatePickups(dt) {
    const w = this.world;
    for (const k of this.pickups) {
      if (!k.static) {
        k.vy = Math.min((k.vy || 0) + GRAVITY * dt, 400);
        if (k.kind === 'mushroom' && k.landed) k.vx = k.vx || 50;
        moveAndCollide(w, k, dt);
        if (k.onGround) {
          k.landed = true;
          if (k.kind !== 'mushroom') k.vx *= 0.8;
        }
        if (k.kind === 'mushroom' && (k.hitL || k.hitR)) k.vx = -(k.vx || 50) || 50;
        if (k.kind === 'mushroom' && k.hitL) k.vx = 50;
        if (k.kind === 'mushroom' && k.hitR) k.vx = -50;
        if (k.y > w.pxH + 20) k.gone = true;
        if (k.life !== undefined) {
          k.life -= dt;
          if (k.life <= 0) k.gone = true;
        }
      }
      for (const p of this.players) {
        if (!p.alive || p.state === 'pipe') continue;
        const box = p.state === 'tank' && p.tank ? p.tank : p;
        if (!overlap(box, k)) continue;
        k.gone = true;
        this.collect(k, p);
        break;
      }
    }
    this.pickups = this.pickups.filter((k) => !k.gone);
  }

  collect(k, p) {
    const g = this.gunner;
    if (k.kind === 'coin') return this.collectCoin(k.x, k.y, p);
    if (k.kind === 'mushroom') {
      if (p.hp < p.maxHp) {
        p.hp++;
        this.popText(p.cx, p.y - 8, '+1 HP', '#d8281c');
      } else {
        p.addMeter(30);
        this.score += 1000;
        this.popText(p.cx, p.y - 8, 'ULTI +30%', '#f8c830');
      }
      sfx('power');
      return;
    }
    if (k.kind === 'grenade') {
      g.grenades += 5;
      this.popText(p.cx, p.y - 8, '+5 GRANAT', '#9cc850');
      sfx('select');
      return;
    }
    if (WEAPONS[k.kind]) {
      g.setWeapon(k.kind);
      this.popText(p.cx, p.y - 8, WEAPONS[k.kind].name + '!', '#f8c830');
      sfx('power');
    }
  }

  updateFx(dt) {
    for (const q of this.particles) {
      q.life -= dt;
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.dur);
    for (const tx of this.texts) {
      tx.life -= dt;
      tx.y -= 18 * dt;
    }
    this.texts = this.texts.filter((tx) => tx.life > 0);
    for (const c of this.corpses) c.life -= dt;
    this.corpses = this.corpses.filter((c) => c.life > 0);
    if (this.world) for (const [k, v] of this.world.bump) v - dt <= 0 ? this.world.bump.delete(k) : this.world.bump.set(k, v - dt);
  }

  // -------------------------------------------------------------- camera (dynamic split screen)
  focus(p) {
    if (p.state === 'tank' && p.tank) return { x: p.tank.cx, y: p.tank.cy };
    return { x: p.cx, y: p.cy };
  }
  updateCamera(dt) {
    const w = this.world;
    const a = this.arena && this.arena.started && !this.arena.done ? this.arena : null;
    const minX = a ? a.x0 - 16 : 0;
    const maxX = a ? a.x1 + 16 : w.pxW;
    const minY = a ? Math.min(a.y0 - 24, a.y1 - VH) : 0;
    const maxY = a ? a.y1 + 48 : w.pxH;
    const clamp = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
    const f = this.players.map((p) => this.focus(p));
    const dx = Math.abs(f[0].x - f[1].x);
    const dy = Math.abs(f[0].y - f[1].y);
    let layout;
    if (dx < VW - 110 && dy < VH - 90) {
      layout = [{ x: 0, y: 0, w: VW, h: VH, tx: (f[0].x + f[1].x) / 2, ty: (f[0].y + f[1].y) / 2 - 10 }];
    } else if (dx / VW >= dy / VH) {
      const [l, r] = f[0].x < f[1].x ? [f[0], f[1]] : [f[1], f[0]];
      layout = [
        { x: 0, y: 0, w: VW / 2, h: VH, tx: l.x, ty: l.y - 10, who: l },
        { x: VW / 2, y: 0, w: VW / 2, h: VH, tx: r.x, ty: r.y - 10, who: r },
      ];
    } else {
      const [u, d] = f[0].y < f[1].y ? [f[0], f[1]] : [f[1], f[0]];
      layout = [
        { x: 0, y: 0, w: VW, h: VH / 2, tx: u.x, ty: u.y, who: u },
        { x: 0, y: VH / 2, w: VW, h: VH / 2, tx: d.x, ty: d.y, who: d },
      ];
    }
    const prev = this.views;
    const single = prev.length === 1 ? prev[0] : null;
    this.views = layout.map((v, i) => {
      const goalX = clamp(v.tx - v.w / 2, minX, maxX - v.w);
      const goalY = clamp(v.ty - v.h / 2, minY, maxY - v.h);
      let old = prev.length === layout.length ? prev[i] : null;
      if (!old && single && layout.length === 2) old = { camX: single.camX + (v.x - 0) * 0 + (layout[0].h === VH ? (i === 0 ? 0 : VW / 2) : 0), camY: single.camY + (layout[0].w === VW ? (i === 0 ? 0 : VH / 2) : 0) };
      const k = Math.min(1, dt * 7);
      const camX = old ? old.camX + (goalX - old.camX) * k : goalX;
      const camY = old ? old.camY + (goalY - old.camY) * k : goalY;
      return { ...v, camX, camY };
    });
  }

  // -------------------------------------------------------------- text state for automated tests
  textState() {
    const p = (o) => ({ x: Math.round(o.x), y: Math.round(o.y), vx: Math.round(o.vx), vy: Math.round(o.vy), hp: o.hp, state: o.state, onGround: o.onGround, meter: Math.round(o.meter) });
    return {
      coords: 'pixels, origin top-left, +x right, +y down, 16px tiles',
      mode: this.mode,
      zone: this.zoneIndex,
      ready: this.ready,
      lives: this.lives,
      coins: this.coins,
      score: this.score,
      plumber: this.mode === 'title' ? null : { ...p(this.plumber), pound: this.plumber.pound, cling: +this.plumber.cling.toFixed(2), star: +this.plumber.star.toFixed(1) },
      gunner: this.mode === 'title' ? null : { ...p(this.gunner), weapon: this.gunner.weapon, ammo: this.gunner.ammo === Infinity ? 'inf' : this.gunner.ammo, grenades: this.gunner.grenades, fuel: +this.gunner.fuel.toFixed(2), crouch: this.gunner.crouch, carrying: this.gunner.carrying },
      views: this.views.length,
      enemies: this.enemies ? this.enemies.filter((e) => e.active).slice(0, 12).map((e) => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), hp: +e.hp.toFixed(1) })) : [],
      boss: this.boss ? { name: this.boss.name, hp: Math.round(this.boss.hp), max: this.boss.maxHp } : null,
      doors: this.doors ? this.doors.map((d) => ({ id: d.id, open: d.open })) : [],
      valves: this.valves ? this.valves.map((v) => ({ progress: +v.progress.toFixed(1), time: v.time, done: v.done })) : [],
      tanks: this.tanks ? this.tanks.map((tk) => ({ x: Math.round(tk.x), y: Math.round(tk.y), hp: Math.round(tk.hp), ext: Math.round(tk.ext), driven: !!tk.driver })) : [],
    };
  }
}
