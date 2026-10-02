import { TS, moveAndCollide } from './world.js';
import { TILE as t } from './levels.js';
import { sfx } from './audio.js';

export const GRAVITY = 1000;
const MAX_FALL = 430;

// Tuned so the Plumber jumps 1.5x as high as the Gunner (h = v² / 2g).
export const PHYS = {
  plumberJump: 392, // ≈ 77 px ≈ 4.8 tiles
  gunnerJump: 330, // ≈ 54 px ≈ 3.4 tiles (77 / 54 ≈ 1.42 → 1.5x with the hold boost)
  pogo: 640,
  throw: 470,
  seesaw: 660,
  stompBounce: 260,
  stompBounceHeld: 390,
  plumberSpeed: 122,
  gunnerSpeed: 96,
  jetFuel: 2.5,
  clingTime: 3,
};

export const WEAPONS = {
  pistol: { name: 'HEAVY PISTOL', cd: 0.15, auto: 0.24, ammo: Infinity },
  hmg: { name: 'HEAVY MACHINE GUN', cd: 0.065, auto: 0.065, ammo: 200 },
  shotgun: { name: 'SHOTGUN', cd: 0.55, auto: 0.55, ammo: 30 },
  rocket: { name: 'ROCKET LAUNCHER', cd: 0.6, auto: 0.6, ammo: 20 },
  flame: { name: 'FLAME SHOT', cd: 0.045, auto: 0.045, ammo: 150 },
};

const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

class Player {
  constructor(who, x, y, w, h) {
    this.who = who;
    this.w = w;
    this.h = h;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.face = 1;
    this.onGround = false;
    this.hp = 3;
    this.maxHp = 3;
    this.inv = 0;
    this.state = 'normal';
    this.anim = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.lastSafe = { x, y };
    this.meter = 0;
    this.bleed = 0;
    this.revive = 0;
    this.flashT = 0;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  get alive() {
    return this.state !== 'downed' && this.state !== 'out';
  }
  place(x, y) {
    this.x = x;
    this.y = y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.lastSafe = { x: this.x, y: this.y };
  }
  hurt(game, amount = 1, fromX = null) {
    if (this.inv > 0 || this.state === 'downed' || this.state === 'pipe' || this.state === 'out' || this.star > 0) return false;
    if (this.state === 'tank') return false; // the tank soaks it (handled by the tank)
    this.hp -= amount;
    this.inv = 1.4;
    this.flashT = 0.2;
    game.shake(3);
    if (fromX !== null) this.vx = (this.cx < fromX ? -1 : 1) * 140;
    this.vy = -220;
    if (this.hp <= 0) this.goDown(game);
    else sfx('hurt');
    return true;
  }
  goDown(game) {
    this.hp = 0;
    this.state = 'downed';
    this.bleed = 15;
    this.revive = 0;
    this.vx = 0;
    this.vy = 0;
    this.bubbleY = this.y;
    sfx('down');
    game.onPlayerDown(this);
  }
  reviveNow(game) {
    this.state = 'normal';
    this.hp = 2;
    this.inv = 2;
    this.vy = -250;
    this.revive = 0;
    sfx('revive');
    game.popText(this.cx, this.y - 6, 'REVIVE!', '#9cc850');
    game.burst(this.cx, this.cy, 16, ['#f8f8f0', '#9cc850', '#f8c830']);
  }
  addMeter(v) {
    this.meter = Math.min(100, this.meter + v);
  }
  // downed: drift as a bubble, bleed out
  updateDowned(game, dt) {
    this.bleed -= dt;
    this.anim += dt;
    this.bubbleY = approach(this.bubbleY, this.lastSafe.y - 8, 30 * dt);
    this.y = this.bubbleY + Math.sin(this.anim * 3) * 3;
    if (this.revive >= 1) this.reviveNow(game);
    else if (this.bleed <= 0) game.onBleedOut(this);
  }
  trackSafe(world) {
    if (this.onGround && !this.onPlat && this.groundTile !== t.SPIKE && this.groundTile !== t.LAVA) {
      // only remember spots with ground under both feet, so respawns never hang over a pit
      const l = world.get(Math.floor((this.x + 1) / TS), this.groundRow);
      const r = world.get(Math.floor((this.x + this.w - 1) / TS), this.groundRow);
      if (world.solid(l) && world.solid(r)) this.lastSafe = { x: this.x, y: this.y };
    }
  }
  hazards(game) {
    const w = game.world;
    // fell out of the world
    if (this.y > w.pxH + 40) {
      game.fallOut(this);
      return;
    }
    // spikes / wire / lava
    const x0 = Math.floor((this.x + 2) / TS);
    const x1 = Math.floor((this.x + this.w - 2) / TS);
    const y0 = Math.floor((this.y + 2) / TS);
    const y1 = Math.floor((this.y + this.h - 1) / TS);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const id = w.get(x, y);
        if (id === t.SPIKE || id === t.LAVA) {
          if (this.star > 0) continue;
          game.fallOut(this);
          return;
        }
        if (id === t.WIRE && this.inv <= 0) {
          this.hurt(game, 1, (x + 0.5) * TS);
          return;
        }
      }
  }
}

// ====================================================================== PLUMBER
export class Plumber extends Player {
  constructor(x, y) {
    super('plumber', x, y, 12, 15);
    this.cling = 0;
    this.clingDir = 0;
    this.wallLock = 0;
    this.pound = 0; // 0 none, 1 hang, 2 falling
    this.poundHang = 0;
    this.star = 0;
    this.pogoTrail = 0;
    this.pipe = null;
  }

  update(game, dt) {
    const inp = game.input.p('plumber');
    this.inv = Math.max(0, this.inv - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.star = Math.max(0, this.star - dt);
    this.pogoTrail = Math.max(0, this.pogoTrail - dt);
    this.anim += dt;
    if (this.state === 'downed') return this.updateDowned(game, dt);
    if (this.state === 'out') return;
    if (this.state === 'pipe') return this.updatePipe(game, dt);
    if (this.state === 'carried') {
      const g = game.gunner;
      this.x = g.x + (g.w - this.w) / 2;
      this.y = g.y - this.h;
      this.vx = g.vx;
      this.vy = 0;
      this.face = g.face;
      if (inp.jump.pressed) {
        this.state = 'normal';
        g.carrying = false;
        this.vy = -230;
        sfx('jump');
      }
      return;
    }

    // ultimate
    if (inp.ultimate.pressed && this.meter >= 100) {
      this.meter = 0;
      this.star = 8;
      sfx('power');
      game.popText(this.cx, this.y - 8, 'STAR POWER!', '#f8c830');
      game.flashScreen(0.15);
    }

    const dir = (inp.right.down ? 1 : 0) - (inp.left.down ? 1 : 0);
    const speed = this.star > 0 ? PHYS.plumberSpeed * 1.35 : PHYS.plumberSpeed;
    this.wallLock = Math.max(0, this.wallLock - dt);

    // ---- ground pound
    if (this.pound === 1) {
      this.poundHang -= dt;
      this.vx = 0;
      this.vy = 0;
      if (this.poundHang <= 0) {
        this.pound = 2;
        this.vy = 600;
      }
    } else if (this.pound === 2) {
      this.vx = 0;
      this.vy = 600;
    } else {
      if (this.wallLock <= 0) {
        const accel = this.onGround ? 1100 : 700;
        this.vx = approach(this.vx, dir * speed, accel * dt);
      }
      if (dir) this.face = dir;
      // gravity
      if (this.cling > 0 && this.cling < PHYS.clingTime) this.vy = Math.min(this.vy + GRAVITY * dt, 12);
      else if (this.cling >= PHYS.clingTime) this.vy = Math.min(this.vy + GRAVITY * dt, 70);
      else this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    }

    // ---- jumping
    this.coyote = this.onGround ? 0.09 : Math.max(0, this.coyote - dt);
    this.jumpBuf = inp.jump.pressed ? 0.12 : Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.pound === 0) {
      if (this.coyote > 0) {
        this.vy = -PHYS.plumberJump;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.onGround = false;
        sfx('jump');
      } else if (this.cling > 0) {
        this.vx = -this.clingDir * 185;
        this.vy = -365;
        this.face = -this.clingDir;
        this.wallLock = 0.17;
        this.cling = 0;
        this.jumpBuf = 0;
        sfx('jump');
        game.dust(this.clingDir > 0 ? this.x + this.w : this.x, this.cy);
      }
    }
    if (inp.jump.released && this.vy < -120 && this.pound === 0 && this.pogoTrail <= 0) this.vy *= 0.55;

    // ---- start ground pound
    if (!this.onGround && inp.down.pressed && this.pound === 0) {
      this.pound = 1;
      this.poundHang = 0.13;
      this.cling = 0;
      sfx('bump');
    }

    // ---- interact (levers, valves, reviving the gunner)
    this.interacting = inp.action.down;
    if (inp.action.pressed) game.plumberInteract(this);

    // ---- move
    const prevVy = this.vy;
    moveAndCollide(game.world, this, dt, game.platformsFor(this));

    // head bump
    if (this.hitU) game.bumpTile(this, this.hitU);

    // pipe entry: stand on a pipe and press down
    if (this.onGround && inp.down.pressed && this.groundTile === t.PIPE) {
      const p = game.pipeUnder(this);
      if (p) this.enterPipe(game, p);
    }

    // landing from a ground pound
    if (this.onGround && this.pound === 2) {
      this.pound = 0;
      game.groundPound(this);
    } else if (this.onGround) this.pound = 0;

    // ---- wall cling: in the air, pushing into a clingable wall
    this.updateCling(game, dir, dt, prevVy);

    if (this.onGround) this.trackSafe(game.world);
    this.hazards(game);
  }

  updateCling(game, dir, dt) {
    if (this.onGround || this.pound) {
      this.cling = 0;
      return;
    }
    const w = game.world;
    const side = (d) => {
      const tx = Math.floor((d > 0 ? this.x + this.w + 1 : this.x - 1) / TS);
      const ys = [Math.floor((this.y + 3) / TS), Math.floor((this.y + this.h - 3) / TS)];
      return ys.every((ty) => w.clingable(w.get(tx, ty)));
    };
    if (this.cling > 0) {
      if (!side(this.clingDir) || dir === -this.clingDir) {
        this.cling = 0;
        return;
      }
      this.cling += dt;
      this.face = -this.clingDir;
      return;
    }
    if (dir !== 0 && this.vy > -60 && this.wallLock <= 0 && side(dir)) {
      this.cling = 0.0001;
      this.clingDir = dir;
      this.vx = 0;
      this.vy = Math.min(this.vy, 0);
    }
  }

  enterPipe(game, pipe) {
    this.state = 'pipe';
    this.pipe = { from: pipe, to: game.pipeById(pipe.to), t: 0, phase: 'in' };
    this.x = pipe.x * TS + 16 - this.w / 2;
    this.vx = this.vy = 0;
    this.pound = 0;
    sfx('pipe');
  }

  updatePipe(game, dt) {
    const p = this.pipe;
    p.t += dt;
    if (p.phase === 'in') {
      this.y = p.from.y * TS - this.h + Math.min(1, p.t / 0.45) * (this.h + 2);
      if (p.t >= 0.45) {
        p.phase = 'out';
        p.t = 0;
        this.x = p.to.x * TS + 16 - this.w / 2;
        sfx('pipe');
        game.onPipeExit(this, p.to);
      }
    } else {
      this.y = p.to.y * TS + 2 - Math.min(1, p.t / 0.45) * (this.h + 2);
      if (p.t >= 0.45) {
        this.state = 'normal';
        this.y = p.to.y * TS - this.h;
        this.pipe = null;
        this.inv = Math.max(this.inv, 0.4);
      }
    }
  }

  pose() {
    if (this.state === 'downed') return ['down', 0];
    if (this.state === 'carried') return ['carried', 0];
    if (this.pound) return ['pound', 0];
    if (this.cling > 0) return ['cling', 0];
    if (!this.onGround) return ['jump', 0];
    if (Math.abs(this.vx) > 10) return ['run', Math.floor(this.anim * 12) % 4];
    return ['idle', 0];
  }
}

// ====================================================================== GUNNER
export class Gunner extends Player {
  constructor(x, y) {
    super('gunner', x, y, 12, 20);
    this.fuel = PHYS.jetFuel;
    this.jetting = false;
    this.weapon = 'pistol';
    this.ammo = Infinity;
    this.cd = 0;
    this.grenades = 3;
    this.aim = 'fwd';
    this.crouch = false;
    this.carrying = false;
    this.tank = null;
    this.muzzleT = 0;
    this.star = 0;
    this.jetSfx = 0;
  }

  setWeapon(kind) {
    this.weapon = kind;
    this.ammo = WEAPONS[kind].ammo;
  }

  update(game, dt) {
    const inp = game.input.p('gunner');
    this.inv = Math.max(0, this.inv - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.cd = Math.max(0, this.cd - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.anim += dt;
    if (this.state === 'downed') return this.updateDowned(game, dt);
    if (this.state === 'out') return;
    if (this.state === 'tank') return; // the tank drives the gunner

    if (inp.ultimate.pressed && this.meter >= 100) {
      if (game.callTank(this)) this.meter = 0;
    }

    const dir = (inp.right.down ? 1 : 0) - (inp.left.down ? 1 : 0);
    // crouch: shrink the hitbox from the top so whoever stands on our head drops with it
    const wantCrouch = inp.down.down && this.onGround;
    if (wantCrouch && !this.crouch) {
      this.crouch = true;
      this.y += 6;
      this.h = 14;
    } else if (!wantCrouch && this.crouch) {
      const w = game.world;
      const blocked = w.solidAt(this.x + 1, this.y - 5) || w.solidAt(this.x + this.w - 1, this.y - 5);
      if (!blocked) {
        this.crouch = false;
        this.y -= 6;
        this.h = 20;
      }
    }
    if (dir) this.face = dir;
    const speed = (this.crouch ? 0.35 : 1) * (this.carrying ? 0.9 : 1) * PHYS.gunnerSpeed;
    this.vx = approach(this.vx, dir * speed, (this.onGround ? 1000 : 650) * dt);
    this.aim = inp.up.down ? 'up' : inp.down.down && !this.onGround ? 'down' : 'fwd';

    // jump / jetpack hover
    this.coyote = this.onGround ? 0.09 : Math.max(0, this.coyote - dt);
    this.jumpBuf = inp.jump.pressed ? 0.12 : Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.coyote > 0 && !this.crouch) {
      this.vy = -PHYS.gunnerJump;
      this.coyote = 0;
      this.jumpBuf = 0;
      sfx('jump');
    }
    if (inp.jump.released && this.vy < -100 && !this.jetting) this.vy *= 0.6;
    this.jetting = !this.onGround && inp.jump.down && this.vy >= -30 && this.fuel > 0;
    if (this.jetting) {
      this.vy = approach(this.vy + GRAVITY * dt, 6, 2600 * dt);
      this.fuel = Math.max(0, this.fuel - dt * (this.carrying ? 1.3 : 1));
      game.jetFlame(this);
      this.jetSfx -= dt;
      if (this.jetSfx <= 0) {
        sfx('jet');
        this.jetSfx = 0.08;
      }
    } else this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    if (this.onGround) this.fuel = Math.min(PHYS.jetFuel, this.fuel + dt * 2.5);

    // fire
    const wdef = WEAPONS[this.weapon];
    if (inp.fire.down && this.cd <= 0) {
      this.fire(game);
      this.cd = inp.fire.pressed ? wdef.cd : wdef.auto;
    }

    if (inp.grenade.pressed) this.throwGrenade(game);
    if (inp.action.pressed) this.interact(game);

    moveAndCollide(game.world, this, dt, game.platformsFor(this));
    if (this.hitU) game.bumpTile(this, this.hitU);
    if (this.onGround) this.trackSafe(game.world);
    this.hazards(game);
  }

  muzzle() {
    const top = this.y;
    if (this.aim === 'up') return { x: this.cx + this.face * 2, y: top - 8, dx: 0, dy: -1 };
    if (this.aim === 'down') return { x: this.cx, y: this.y + this.h + 6, dx: 0, dy: 1 };
    const y = this.crouch ? top + 7 : top + 11;
    return { x: this.cx + this.face * 13, y, dx: this.face, dy: 0 };
  }

  fire(game) {
    const w = WEAPONS[this.weapon];
    this.cd = w.cd;
    this.muzzleT = 0.06;
    const m = this.muzzle();
    game.fireWeapon(this, this.weapon, m);
    if (this.ammo !== Infinity) {
      this.ammo--;
      if (this.ammo <= 0) {
        this.setWeapon('pistol');
        game.popText(this.cx, this.y - 8, 'AMMO HABIS', '#f88830');
      }
    }
    // POGO CANNON: crouched with the plumber on our head → blast him skyward
    const p = game.plumber;
    const near = Math.abs(p.cx - this.cx) < 13 && p.y + p.h <= this.y + 3 && p.y + p.h >= this.y - 12 && p.vy > -60;
    const onHead = (p.state === 'normal' && ((p.onPlat && p.onPlat.owner === this) || near)) || p.state === 'carried';
    if (this.crouch && onHead) game.pogo(this, p);
  }

  throwGrenade(game) {
    if (this.grenades <= 0) {
      if (game.coins >= 3) {
        game.coins -= 3;
        this.grenades++;
        game.popText(this.cx, this.y - 10, 'CRAFT! 3 KOIN = 1 GRANAT', '#f8c830');
      } else {
        game.popText(this.cx, this.y - 10, 'BUTUH 3 KOIN', '#a4a4b0');
        return;
      }
    }
    this.grenades--;
    game.spawnGrenade(this);
    sfx('grenade');
  }

  interact(game) {
    const p = game.plumber;
    if (this.carrying) {
      // throw the plumber
      this.carrying = false;
      p.state = 'normal';
      p.vx = this.face * 150;
      p.vy = -PHYS.throw;
      p.pogoTrail = 0.4;
      p.y -= 2;
      sfx('jumpBig');
      return;
    }
    const tank = game.tankNear(this);
    if (tank) {
      game.enterTank(this, tank);
      return;
    }
    if (p.state === 'normal' && Math.abs(p.cx - this.cx) < 20 && Math.abs(p.y + p.h - (this.y + this.h)) < 26 && !this.crouch) {
      this.carrying = true;
      p.state = 'carried';
      p.cling = 0;
      p.pound = 0;
      sfx('select');
      game.popText(this.cx, this.y - 22, 'ANGKAT!', '#f8f8f0');
      return;
    }
    game.gunnerInteract(this);
  }

  pose() {
    if (this.state === 'downed') return ['down', 0];
    if (this.crouch) return ['crouch', 0];
    if (this.carrying) return ['carry', 0];
    if (!this.onGround) return ['jump', 0];
    if (Math.abs(this.vx) > 10) return ['run', Math.floor(this.anim * 10) % 4];
    return ['idle', 0];
  }
}
