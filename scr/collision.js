import * as THREE from 'three';
import { bend, upAt } from './planet.js';

// Collision on the sphere. Colliders live in world space:
//   circle { c, r, top }                  c: point on the ground, r: radius
//   box    { c, ax, hx, hz, top, exits? }  ax: unit vector along the ground (the box's local x);
//                                         its local z is ax × up. hx/hz: half sizes.
// top is the height above the ground they block up to. exits (boxes, optional) lists the sides a
// person standing inside may leave by: { '-x', '+x', '-z', '+z' }.
// Walkers resolve collisions in their own surface chart (see planet.js), where everything nearby
// is flat enough to treat in 2D.
const CELL = 8;
const _v = new THREE.Vector3();
const _u = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

class SpatialHash {
  constructor() {
    this.cells = new Map();
  }

  add(item, reach) {
    const { c } = item;
    for (let i = Math.floor((c.x - reach) / CELL); i <= Math.floor((c.x + reach) / CELL); i++) {
      for (let j = Math.floor((c.y - reach) / CELL); j <= Math.floor((c.y + reach) / CELL); j++) {
        for (let k = Math.floor((c.z - reach) / CELL); k <= Math.floor((c.z + reach) / CELL); k++) {
          const key = `${i},${j},${k}`;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key).push(item);
        }
      }
    }
  }

  near(p, out = new Set()) {
    const i = Math.floor(p.x / CELL);
    const j = Math.floor(p.y / CELL);
    const k = Math.floor(p.z / CELL);
    for (let a = i - 1; a <= i + 1; a++) {
      for (let b = j - 1; b <= j + 1; b++) {
        for (let d = k - 1; d <= k + 1; d++) for (const it of this.cells.get(`${a},${b},${d}`) ?? []) out.add(it);
      }
    }
    return out;
  }
}

export class Colliders {
  constructor() {
    this.hash = new SpatialHash();
    this.dynamic = []; // rebuilt every frame (cars)
  }

  add(col) {
    this.hash.add(col, (col.r ?? Math.hypot(col.hx, col.hz)) + 1);
  }

  // Map colliders are flat boxes/circles in a town map's chart; carry them onto the sphere (and,
  // for the small towns, round to their place with `frame`).
  addMap(c, frame = null) {
    const place = (v) => (frame ? v.applyMatrix4(frame) : v);
    if (c.r !== undefined) {
      this.add({ c: place(bend(new THREE.Vector3(c.x, 0, c.z))), r: c.r, top: c.top });
      return;
    }
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    const e = 0.05;
    const ex = bend(_a.set(cx + e, 0, cz)).sub(bend(_b.set(cx - e, 0, cz))).divideScalar(2 * e);
    const ezLen = bend(_a.set(cx, 0, cz + e)).sub(bend(_b.set(cx, 0, cz - e))).length() / (2 * e);
    this.add({
      c: place(bend(new THREE.Vector3(cx, 0, cz))),
      ax: frame ? ex.clone().transformDirection(frame) : ex.clone().normalize(),
      hx: ((c.maxX - c.minX) / 2) * ex.length(),
      hz: ((c.maxZ - c.minZ) / 2) * ezLen,
      top: c.top,
      exits: c.exits,
    });
  }

  // Everything near local point (x, z) of a chart, in that chart's flat coordinates.
  local(chart, x, z) {
    const centre = chart.toWorld(x, 0, z, _u);
    const found = this.hash.near(centre);
    for (const d of this.dynamic) if (d.c.distanceToSquared(centre) < 400) found.add(d);
    const out = [];
    for (const col of found) {
      const p = chart.toLocal(col.c, _v);
      const l = { x: p.x, z: p.z, top: col.top, owner: col.owner };
      if (col.r !== undefined) l.r = col.r;
      else {
        const a = chart.dirToLocal(col.ax, _a);
        const len = Math.hypot(a.x, a.z) || 1;
        Object.assign(l, { ux: a.x / len, uz: a.z / len, hx: col.hx, hz: col.hz, exits: col.exits });
      }
      out.push(l);
    }
    return out;
  }

  // Push a person or vehicle (circle radius r at chart-local pos) out of everything it overlaps,
  // except colliders owned by `skip` (a vehicle's own body).
  pushOut(chart, pos, r, skip = null) {
    for (const c of this.local(chart, pos.x, pos.z)) {
      if (pos.y > c.top || (skip && c.owner === skip)) continue;
      if (c.r !== undefined) {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + r;
        if (d >= min || d < 1e-6) continue;
        pos.x += (dx / d) * (min - d);
        pos.z += (dz / d) * (min - d);
        continue;
      }
      // into the box's frame: lx along ax, lz along ax × up (= (-uz, ux) in the chart)
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const lx = dx * c.ux + dz * c.uz;
      const lz = -dx * c.uz + dz * c.ux;
      if (Math.abs(lx) > c.hx + r || Math.abs(lz) > c.hz + r) continue;
      const nx = THREE.MathUtils.clamp(lx, -c.hx, c.hx);
      const nz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
      let mx = 0;
      let mz = 0;
      const d = Math.hypot(lx - nx, lz - nz);
      if (d > 1e-6) {
        if (d >= r) continue;
        mx = ((lx - nx) / d) * (r - d);
        mz = ((lz - nz) / d) * (r - d);
      } else {
        // centre inside the box: leave by the nearest side it is allowed to leave by
        const sides = [
          ['-x', -c.hx - r - lx, 0],
          ['+x', c.hx + r - lx, 0],
          ['-z', 0, -c.hz - r - lz],
          ['+z', 0, c.hz + r - lz],
        ];
        const allowed = c.exits ? sides.filter(([s]) => c.exits[s]) : sides;
        const [, ex, ez] = (allowed.length ? allowed : sides).reduce((a, b) => (Math.hypot(a[1], a[2]) < Math.hypot(b[1], b[2]) ? a : b));
        mx = ex;
        mz = ez;
      }
      pos.x += mx * c.ux - mz * c.uz;
      pos.z += mx * c.uz + mz * c.ux;
    }
  }

  // Is chart-local point p (with its height in p.y) inside anything, padded by `pad`?
  blocked(list, p, pad, skip = null) {
    for (const c of list) {
      if (p.y > c.top || (skip && c.owner === skip)) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      if (c.r !== undefined) {
        if (Math.hypot(dx, dz) < c.r + pad) return true;
      } else if (Math.abs(dx * c.ux + dz * c.uz) < c.hx + pad && Math.abs(-dx * c.uz + dz * c.ux) < c.hz + pad) {
        return true;
      }
    }
    return false;
  }

  // Pull a follow camera (chart-local) in front of any wall between it and its target
  // (ignoring `skip`, the vehicle being driven).
  clipCamera(chart, target, cam, skip = null, pad = 0.3) {
    const list = this.local(chart, (target.x + cam.x) / 2, (target.z + cam.z) / 2);
    const p = new THREE.Vector3();
    const steps = Math.ceil(target.distanceTo(cam) / 0.25);
    for (let k = 1; k <= steps; k++) {
      p.lerpVectors(target, cam, k / steps);
      if (this.blocked(list, p, pad, skip)) {
        cam.lerpVectors(target, cam, (k - 1) / steps);
        return;
      }
    }
  }
}

// Raised walking surfaces (roads and plazas) placed straight on the sphere: squares { c, ax, hx, hz }.
export class PavedTiles {
  constructor() {
    this.hash = new SpatialHash();
  }

  add(tile) {
    this.hash.add(tile, Math.hypot(tile.hx, tile.hz) + 1);
  }

  covers(p) {
    for (const t of this.hash.near(p)) {
      const up = upAt(t.c, _u);
      _v.subVectors(p, t.c);
      const lz = _v.dot(_a.crossVectors(t.ax, up));
      if (Math.abs(_v.dot(t.ax)) <= t.hx && Math.abs(lz) <= t.hz && Math.abs(_v.dot(up)) < 3) return true;
    }
    return false;
  }
}
