import { TILE as t } from './levels.js';

export const TS = 16;

const SOLID = new Uint8Array(32);
for (const id of [t.GROUND, t.BRICK, t.QCOIN, t.QPOWER, t.USED, t.STEEL, t.SANDBAG, t.FRAGILE, t.METAL, t.GATE, t.BRIDGE, t.PIPE, t.LOCK])
  SOLID[id] = 1;
const CLING = new Uint8Array(32);
for (const id of [t.GROUND, t.BRICK, t.USED, t.STEEL, t.SANDBAG, t.FRAGILE, t.QCOIN, t.QPOWER]) CLING[id] = 1;

export const TILE_HP = { [t.STEEL]: 5, [t.SANDBAG]: 3, [t.BRICK]: 2, [t.FRAGILE]: 1 };

export class World {
  constructor(def) {
    this.def = def;
    this.w = def.w;
    this.h = def.h;
    this.tiles = new Uint8Array(def.tiles);
    this.hp = new Float32Array(this.w * this.h);
    this.bump = new Map(); // "x,y" → time left of the bump animation
    for (let i = 0; i < this.tiles.length; i++) this.hp[i] = TILE_HP[this.tiles[i]] || 0;
    this.pxW = this.w * TS;
    this.pxH = this.h * TS;
  }
  get(x, y) {
    if (x < 0 || x >= this.w) return t.METAL;
    if (y < 0 || y >= this.h) return t.EMPTY;
    return this.tiles[y * this.w + x];
  }
  set(x, y, id) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tiles[y * this.w + x] = id;
    this.hp[y * this.w + x] = TILE_HP[id] || 0;
  }
  solid(id) {
    return SOLID[id] === 1;
  }
  clingable(id) {
    return CLING[id] === 1;
  }
  solidAt(px, py) {
    return SOLID[this.get(Math.floor(px / TS), Math.floor(py / TS))] === 1;
  }
}

// Axis-separated AABB vs tiles, then vs one-way "platform" rectangles (heads, tank, see-saw…).
export function moveAndCollide(world, e, dt, platforms = null) {
  e.hitL = e.hitR = false;
  e.hitU = null;
  const wasGround = e.onGround;
  e.onGround = false;
  e.onPlat = null;
  e.groundTile = 0;
  // ---- X
  e.x += e.vx * dt;
  {
    const y0 = Math.floor((e.y + 1) / TS);
    const y1 = Math.floor((e.y + e.h - 1) / TS);
    if (e.vx > 0) {
      const tx = Math.floor((e.x + e.w) / TS);
      for (let y = y0; y <= y1; y++)
        if (world.solid(world.get(tx, y))) {
          e.x = tx * TS - e.w;
          e.vx = 0;
          e.hitR = true;
          break;
        }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x / TS);
      for (let y = y0; y <= y1; y++)
        if (world.solid(world.get(tx, y))) {
          e.x = (tx + 1) * TS;
          e.vx = 0;
          e.hitL = true;
          break;
        }
    }
  }
  // ---- Y
  const prevBottom = e.y + e.h;
  e.y += e.vy * dt;
  const x0 = Math.floor((e.x + 1) / TS);
  const x1 = Math.floor((e.x + e.w - 1) / TS);
  if (e.vy >= 0) {
    const ty = Math.floor((e.y + e.h) / TS);
    for (let x = x0; x <= x1; x++) {
      const id = world.get(x, ty);
      if (world.solid(id) || (id === t.GIRDER && prevBottom <= ty * TS + 1 && !e.dropThrough)) {
        e.y = ty * TS - e.h;
        e.vy = 0;
        e.onGround = true;
        e.groundTile = id;
        e.groundRow = ty;
        break;
      }
    }
  } else {
    const ty = Math.floor(e.y / TS);
    let best = null;
    const cx = e.x + e.w / 2;
    for (let x = x0; x <= x1; x++) {
      const id = world.get(x, ty);
      if (world.solid(id)) {
        const d = Math.abs((x + 0.5) * TS - cx);
        if (!best || d < best.d) best = { x, y: ty, id, d };
      }
    }
    if (best) {
      e.y = (ty + 1) * TS;
      e.vy = 0;
      e.hitU = best;
    }
  }
  // ---- platforms (only when falling onto them)
  if (platforms && !e.onGround && e.vy >= 0) {
    for (const p of platforms) {
      if (p.owner === e || p.ignore === e) continue;
      if (e.x + e.w <= p.x + 1 || e.x >= p.x + p.w - 1) continue;
      const bottom = e.y + e.h;
      if (prevBottom <= p.y + 3 + (p.slack || 0) && bottom >= p.y) {
        e.y = p.y - e.h;
        e.vy = 0;
        e.onGround = true;
        e.onPlat = p;
        break;
      }
    }
  }
  e.justLanded = e.onGround && !wasGround;
}

export function overlap(a, b, pad = 0) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}
