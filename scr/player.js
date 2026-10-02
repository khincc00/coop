import * as THREE from 'three';

const GRAVITY = -30;
// Speeds suit the characters' size and the clips (recorded at about 1.24 m/s walking and 3.3 m/s
// running), so the animations play only a little faster than recorded and the feet stay planted.
const WALK_SPEED = 1.5;
const RUN_SPEED = 4.5;
const WALK_CLIP_SPEED = 1.24; // m/s the walk clip covers at normal playback
const RUN_CLIP_SPEED = 3.3;
const GROUND_ACCEL = 40;
const AIR_ACCEL = 18;
const JUMP_VELOCITY = 7.2; // about 0.85 m high
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.14;
const RADIUS = 0.4;
const HARD_LANDING_SPEED = -16;
const FOOT_LIFT = 0; // raise to ~0.08 once a road mesh is draped slightly above the ground
const SNAP_DOWN = 0.6; // while walking, follow the ground down slopes instead of taking off
const FLY_SPEED = 11; // horizontal and vertical
const FLY_ACCEL = 30;
const FLY_CEILING = 400; // metres above sea level
const KEYBOARD_WALK = 0.5; // stick magnitude the keyboard gives without Shift (see input.js)

export class Player {
  // bounds: { minX, maxX, minZ, maxZ } in metres; the player can't walk past them.
  // heightAt(x, z): ground height in metres.
  constructor(character, spawn, bounds, heightAt) {
    this.character = character;
    this.bounds = bounds;
    this.heightAt = heightAt;
    this.pos = spawn.clone();
    this.pos.y = heightAt(spawn.x, spawn.z) + FOOT_LIFT;
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; // facing -Z, away from the camera
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.landLock = 0;
    this.flying = false;
    this.lean = 0;
    this.input = { x: 0, y: 0, jump: false, jumpPressed: false, descend: false, flyPressed: false };
    this.camYaw = 0;
  }

  setInput(input, camYaw) {
    this.input = input;
    this.camYaw = camYaw;
    if (input.jumpPressed) this.jumpBuffer = JUMP_BUFFER;
  }

  update(dt) {
    const inp = this.input;
    if (inp.flyPressed) {
      this.flying = !this.flying;
      this.landLock = 0;
      if (this.flying) this.grounded = false;
    }
    if (this.flying) {
      this.updateFlying(dt);
      return;
    }
    this.jumpBuffer -= dt;
    this.coyote -= dt;
    this.landLock -= dt;

    // Camera-relative move direction.
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    let wx = -sin * inp.y + cos * inp.x;
    let wz = -cos * inp.y - sin * inp.x;
    const mag = Math.min(1, Math.hypot(wx, wz));
    if (this.landLock > 0) wx = wz = 0;

    // Stick magnitude picks the speed: light push walks, full push runs.
    const speed = mag < 0.5 ? (mag / 0.5) * WALK_SPEED : WALK_SPEED + ((mag - 0.5) / 0.5) * (RUN_SPEED - WALK_SPEED);
    const len = Math.hypot(wx, wz) || 1;
    const tx = (wx / len) * speed;
    const tz = (wz / len) * speed;
    const accel = (this.grounded ? GROUND_ACCEL : AIR_ACCEL) * dt;
    const dx = tx - this.vel.x;
    const dz = tz - this.vel.z;
    const dlen = Math.hypot(dx, dz);
    if (dlen <= accel || dlen === 0) {
      this.vel.x = tx;
      this.vel.z = tz;
    } else {
      this.vel.x += (dx / dlen) * accel;
      this.vel.z += (dz / dlen) * accel;
    }

    if (mag > 0.05 && this.landLock <= 0) {
      const target = Math.atan2(wx, wz);
      let diff = target - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += diff * (1 - Math.exp(-14 * dt));
    }

    // Jump (with coyote time and input buffering).
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0) && this.landLock <= 0) {
      this.vel.y = JUMP_VELOCITY;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.character.play('jump', 0.08, 1.2, true);
    }
    // Releasing jump early gives a shorter hop.
    if (!inp.jump && this.vel.y > 0 && !this.grounded) this.vel.y += GRAVITY * dt * 1.5;
    this.vel.y += GRAVITY * dt;

    const vyBefore = this.vel.y;
    this.pos.addScaledVector(this.vel, dt);

    // Keep inside the map.
    const b = this.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, b.minX + RADIUS, b.maxX - RADIUS);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, b.minZ + RADIUS, b.maxZ - RADIUS);

    const ground = this.heightAt(this.pos.x, this.pos.z) + FOOT_LIFT;
    if (this.pos.y <= ground) {
      this.pos.y = ground;
      this.vel.y = 0;
      if (!this.grounded) this.onLand(vyBefore);
      this.grounded = true;
    } else if (this.grounded && this.vel.y <= 0 && this.pos.y - ground < SNAP_DOWN) {
      this.pos.y = ground;
      this.vel.y = 0;
    } else if (this.grounded) {
      this.grounded = false;
      this.coyote = COYOTE_TIME;
    }
  }

  // Free flight: camera-relative horizontal movement, Space up, C / Ctrl down, no gravity.
  updateFlying(dt) {
    const inp = this.input;
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    const wx = -sin * inp.y + cos * inp.x;
    const wz = -cos * inp.y - sin * inp.x;
    const mag = Math.hypot(wx, wz);
    const speed = FLY_SPEED * Math.min(1, mag / KEYBOARD_WALK);
    const target = new THREE.Vector3(
      mag > 0 ? (wx / mag) * speed : 0,
      ((inp.jump ? 1 : 0) - (inp.descend ? 1 : 0)) * FLY_SPEED,
      mag > 0 ? (wz / mag) * speed : 0,
    );
    const diff = target.sub(this.vel);
    const step = FLY_ACCEL * dt;
    if (diff.length() > step) diff.setLength(step);
    this.vel.add(diff);

    if (mag > 0.05) {
      let d = Math.atan2(wx, wz) - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-8 * dt));
    }

    this.pos.addScaledVector(this.vel, dt);
    const b = this.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, b.minX + RADIUS, b.maxX - RADIUS);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, b.minZ + RADIUS, b.maxZ - RADIUS);
    const ground = this.heightAt(this.pos.x, this.pos.z) + FOOT_LIFT;
    if (this.pos.y < ground) {
      this.pos.y = ground;
      this.vel.y = Math.max(0, this.vel.y);
    }
    if (this.pos.y > FLY_CEILING) {
      this.pos.y = FLY_CEILING;
      this.vel.y = Math.min(0, this.vel.y);
    }
  }

  onLand(vy) {
    if (vy < HARD_LANDING_SPEED) {
      this.landLock = 0.35;
      this.vel.x = this.vel.z = 0;
      this.character.play('land', 0.08, 2.2, true);
    }
  }

  updateVisual(dt) {
    const c = this.character;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    // lean forward when flying fast, like a superhero
    const leanTarget = this.flying ? THREE.MathUtils.clamp(hs / FLY_SPEED, 0, 1) * 1.2 : 0;
    this.lean += (leanTarget - this.lean) * (1 - Math.exp(-6 * dt));
    c.pivot.rotation.x = this.lean;
    if (this.flying) {
      if (hs < 1) c.play('idle', 0.3); // hover
      else c.play('fall', 0.3);
    } else if (this.landLock > 0) {
      // keep the landing clip
    } else if (this.grounded) {
      if (hs < 0.3) c.play('idle', 0.25);
      else if (hs < WALK_SPEED + 0.6) c.play('walk', 0.2, THREE.MathUtils.clamp(hs / (WALK_CLIP_SPEED * c.stride), 0.6, 1.8));
      else c.play('run', 0.2, THREE.MathUtils.clamp(hs / (RUN_CLIP_SPEED * c.stride), 0.8, 1.8));
    } else if (this.vel.y < 0 || c.current !== 'jump') {
      c.play('fall', 0.3);
    }
    c.update(dt);
    c.root.position.copy(this.pos);
    c.root.rotation.y = this.yaw;
  }
}
