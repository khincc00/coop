import * as THREE from 'three';
import { ROOF_COLORS, COMMERCIAL_VARIANTS } from './kenney.js';
import { townToPlanet, bend } from './planet.js';

// Town layout on a square tile grid. Kenney road tiles are 1×1 units; one unit = T metres.
export const T = 6;

// Map plans: one character per tile, north (-Z) at the top. Edit freely — roads auto-tile and
// every building turns to face a road it touches. The main town (below) gets a ring road right
// round the outside; the smaller towns in sites.js draw their ring road into the map border. In
// both, the middle row and column are the avenues that carry on round the planet.
//   #  road        =  bridge (road over water)   O  roundabout (3×3)
//   h  houses      d  shops                      t  towers (grouped 2×2)
//   i  industry    P  paved plaza                p  park
//   f  farm field  c  camp                       ~  water
//   m  market stall  k  parking                  g  picnic garden
//   n  pine wood   v  parking bay with a vehicle anyone can drive (see vehicles.js)
//   .  lawn
export const TOWN_MAP = [
  '.hh#h...h#h..#iiiiii#iiiii.',
  '.hh#hhhhh#hhh#iiiiii#iiiii.',
  '.hh#hhhhh#hhh#iiiiii#iiiii.',
  '.hh#hhhhh#hhh##############',
  '##############iiiiii#iiiii.',
  '.hhhhhhhhhhhh#iiiiii#iiiii.',
  '.hhhhhhhhhhhh#vvvvvv#vvvvv.',
  '###########################',
  '.fffff.#ttttd#vvvvv#h.h#h..',
  '.fffff.#ttttd#vpppv#h.h#h..',
  '.fffff.#ttttd#vpppv#h.h#h..',
  '.fffff.#ttttd#ppppv#h.h#h..',
  '.fffff.#ddddOOOpppv#h.h#h..',
  '############OOO############',
  'ccccccc#ddddOOOdddd#h.h#h..',
  'c~~~~cc#dPPPd#dttPd#h.h#h..',
  'c~~~~cc#dPPPd#dttPd#h.h#h..',
  'c~~~~cc#dPPPd#dPPPd#h.h#h..',
  'ccccccc#ddddd#ddddd#h.h#h..',
  '###########################',
  '~~~~=~~~~~~~~=~~~~~~~~=~~~~',
  '~~~~=~~~~~~~~=~~~~~~~~=~~~~',
  'pppp#pppppppp#pppppppp#pppp',
  '###########################',
  '.hhhhh#hhhhhh#hhhhh#hhh#hh.',
  '.hhhhh#hhhhhh#hhhhh#hhh#hh.',
  '.hhhhh#hhhhhh#hhhhh#hhh#hh.',
];
export const N = TOWN_MAP.length;
const AVENUE = (N - 1) / 2;
export const PLANET_ROAD_START = (AVENUE + 2) * T; // metres from the pole to where the town hands over

export const FLOWER_SCALE = 2.4;
// Road / plaza tiles are 0.02 units thick. They are lifted a little more because on the planet a flat
// 6 m tile sags below the curved ground in its middle.
export const PAVE_LIFT = 0.06;
export const PAVE_H = 0.02 * T + PAVE_LIFT;
export const ROAD_SURFACE = PAVE_LIFT + 0.01 * T - 0.02; // asphalt, minus a little for the sag

export const tileX = (i) => (i - (N - 1) / 2) * T; // tile centre → metres
export const worldTile = (x) => Math.round(x / T + (N - 1) / 2); // metres → tile index
export const SPAWN = new THREE.Vector3(tileX(14), 0, tileX(11) + 1); // corner of the park, by the roundabout
export const TOWN_HALF = (N / 2 + 1) * T; // half-width of the town including its ring road

export const HOUSES = 'abcdefghijklmnopqrstu'.split('').map((c) => `suburban/building-type-${c}`);
export const SHOPS = 'abcdfgh'.split('').map((c) => `commercial/building-${c}`);
const TOWERS = [
  ...'abcde'.split('').map((c) => `commercial/building-skyscraper-${c}`),
  'commercial/building-i',
  'commercial/building-l',
  'commercial/building-m',
];
export const FACTORIES = 'abdegkmprst'.split('').map((c) => `industrial/building-${c}`);
export const YARD_PROPS = [
  'industrial/detail-tank-large', 'industrial/shipping-container-a', 'industrial/shipping-container-b',
  'industrial/shipping-container-c', 'industrial/chimney-large', 'industrial/solar-panel-landscape-group',
];
export const TREES = ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed', 'tree_blocks', 'tree_plateau', 'tree_cone']
  .flatMap((t) => [t, t, `${t}_fall`])
  .concat(['tree_pineRoundA', 'tree_pineRoundC', 'tree_pineRoundE', 'tree_pineTallA', 'tree_simple', 'tree_tall'])
  .map((t) => `nature/${t}`);
export const FLOWERS = ['flower_purpleA', 'flower_purpleB', 'flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB']
  .map((t) => `nature/${t}`);
export const BUSHES = ['plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall'].map((t) => `nature/${t}`);
export const ROCKS = ['rock_largeA', 'rock_largeB', 'rock_largeC', 'stone_largeA', 'stone_largeB'].map((t) => `nature/${t}`);
export const CROPS = ['crops_cornStageD', 'crops_wheatStageB', 'crop_pumpkin', 'crop_melon', 'crop_carrot', 'crops_leafsStageB']
  .map((t) => `nature/${t}`);
export const PINES = ['tree_pineRoundA', 'tree_pineRoundB', 'tree_pineRoundC', 'tree_pineRoundD', 'tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC']
  .map((t) => `nature/${t}`);
const STALL_FOOD = ['watermelon', 'pumpkin', 'bread', 'pineapple', 'fish', 'cake', 'loaf', 'apple', 'cabbage', 'pizza', 'burger', 'donut', 'cheese', 'corn', 'carrot']
  .map((t) => `food/${t}`);
const PARKED = ['van', 'truck', 'delivery', 'suv', 'sedan', 'taxi', 'tractor', 'truck-flat', 'hatchback-sports', 'police']
  .map((t) => `cars/${t}`);
const TENTS = ['nature/tent_detailedOpen', 'nature/tent_detailedClosed', 'nature/tent_smallOpen'];
const CAR_SCALE = 1.15;
export const MOUNTAINS = ['rock_tallB', 'rock_tallC', 'rock_tallD', 'rock_tallG', 'rock_tallI', 'stone_tallB', 'stone_tallC']
  .map((t) => `nature/${t}`);

// Road tiles and the sides they connect at rotation 0 (N = -Z, E = +X, S = +Z, W = -X).
export const ROAD_SHAPES = [
  ['roads/road-crossroad', 'NESW'],
  ['roads/road-intersection', 'ESW'],
  ['roads/road-straight', 'EW'],
  ['roads/road-bend', 'SW'],
  ['roads/road-end-round', 'E'],
];
export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const TURN = { E: 'N', N: 'W', W: 'S', S: 'E' }; // where a side ends up after +90° about Y
const BUILDING = new Set(['h', 'd', 't', 'i']);

export const MODELS = [
  ...ROAD_SHAPES.map(([m]) => m),
  'roads/road-crossing', 'roads/road-straight-barrier', 'roads/road-roundabout', 'roads/tile-low',
  'roads/light-square', 'roads/light-curved',
  ...HOUSES, ...SHOPS, ...TOWERS, ...FACTORIES, ...YARD_PROPS,
  'industrial/water-tower', 'industrial/windmill',
  'suburban/tree-large', 'suburban/tree-small', 'suburban/fence', 'suburban/planter',
  'commercial/detail-parasol-a', 'commercial/detail-parasol-b',
  ...TREES, ...FLOWERS, ...BUSHES, ...ROCKS, ...CROPS, ...MOUNTAINS,
  'nature/grass_large', 'nature/lily_large', 'nature/lily_small', 'nature/statue_obelisk',
  'nature/crops_dirtRow', 'nature/fence_simple', 'nature/log_stack', 'nature/stump_round',
  ...TENTS, 'nature/campfire_stones', 'nature/campfire_logs', 'nature/canoe', 'nature/log', 'nature/log_stackLarge',
  ...PINES, ...STALL_FOOD, ...PARKED, 'food/barrel',
  'furniture/bench', 'furniture/tableCross', 'furniture/tableCrossCloth', 'furniture/cardboardBoxClosed', 'furniture/trashcan',
];

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const layoutTown = (kit, batch) =>
  layoutMap(kit, batch, { map: TOWN_MAP, ring: 'outside', seed: 7, downtown: (i, j) => i >= 7 && i <= 19 && j >= 7 && j <= 19 });

// Lays one map out into `batch` (static instanced props) and returns what the world needs at runtime.
// The map is built flat round the north pole and wrapped onto the sphere (townToPlanet); `frame`
// (a rotation about the planet centre) then carries it to its place on the planet.
//   ring: 'outside' adds a ring road round the map; 'inside' means the map draws its own
//   downtown(i, j): tiles that get square street lights and zebra crossings
//   crossings: zebra crossings next to every junction
export function layoutMap(kit, batch, { map, ring = 'inside', seed = 7, frame = null, downtown = () => false, crossings = false, boats = false }) {
  const N = map.length;
  map.forEach((row, j) => {
    if (row.length !== N) throw new Error(`map row ${j} has ${row.length} tiles, expected ${N}`);
  });
  const tileX = (i) => (i - (N - 1) / 2) * T;
  const worldTile = (x) => Math.round(x / T + (N - 1) / 2);
  const AVENUE = (N - 1) / 2;
  const edge = ring === 'outside' ? 2 : 1; // links sit just outside the outermost road
  const PLANET_ROAD_STARTS = [[AVENUE, -edge], [AVENUE, N - 1 + edge], [-edge, AVENUE], [N - 1 + edge, AVENUE]];
  const toPlanet = (m) => (frame ? new THREE.Matrix4().multiplyMatrices(frame, townToPlanet(m)) : townToPlanet(m));
  const toWorld = (x, y, z) => {
    const p = bend(new THREE.Vector3(x, y, z));
    return frame ? p.applyMatrix4(frame) : p;
  };
  const bays = []; // { point, forward }: where a drivable vehicle waits, nose towards the road
  const spinners = []; // windmills, built as separate objects so their blades can turn
  const smokers = []; // chimney tops
  const fires = []; // campfires
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const range = (a, b) => a + rnd() * (b - a);

  const colliders = []; // { minX, maxX, minZ, maxZ, top } boxes and { x, z, r, top } circles
  const paved = new Set(); // tiles whose surface sits PAVE_H above the grass
  const ponds = []; // { x, z, r, y? } water discs, drawn by world.js
  const water = []; // [i, j] tiles of river / lake, drawn by world.js

  const key = (i, j) => `${i},${j}`;
  const at = (i, j) => map[j]?.[i] ?? ' ';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // Place a model. rot is about Y; +Z (the model's front) ends up pointing at (sin rot, cos rot).
  // collide: square-on models get their footprint box, anything turned at an angle gets a circle.
  function put(name, x, z, rot = 0, scale = 1, { y = 0, collide = false, variant = 0, shadow = true } = {}) {
    const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
    q.setFromAxisAngle(up, rot);
    const m = toPlanet(m4.compose(new THREE.Vector3(x, y, z), q, s));
    if (name === 'industrial/windmill') spinners.push(m);
    else batch.add(name, m, { variant, shadow });
    const box = kit.get(name).box;
    if (name.includes('chimney')) smokers.push(toWorld(x, y + box.max.y * s.y, z));
    if (name.includes('campfire')) fires.push(toWorld(x, y + 0.1, z));
    if (!collide) return;
    const top = y + box.max.y * s.y;
    const quarterTurns = rot / (Math.PI / 2);
    if (Math.abs(quarterTurns - Math.round(quarterTurns)) > 0.01) {
      const r = 0.4 * Math.max((box.max.x - box.min.x) * s.x, (box.max.z - box.min.z) * s.z);
      colliders.push({ x, z, r, top });
      return;
    }
    const [x0, x1, z0, z1] = [box.min.x * s.x, box.max.x * s.x, box.min.z * s.z, box.max.z * s.z];
    const fp = [
      [x0, x1, z0, z1],
      [z0, z1, -x1, -x0],
      [-x1, -x0, -z1, -z0],
      [-z1, -z0, x0, x1],
    ][Math.round(quarterTurns) & 3];
    colliders.push({ minX: x + fp[0], maxX: x + fp[1], minZ: z + fp[2], maxZ: z + fp[3], top });
  }
  const facing = (nx, nz) => Math.atan2(nx, nz);
  const tree = (x, z, scale, collide = true) => {
    put(pick(TREES), x, z, rnd() * Math.PI * 2, scale);
    if (collide) colliders.push({ x, z, r: 0.12 * scale, top: 2 });
  };
  const flowers = (x, z, n = 3, spread = 1.2) => {
    for (let k = 0; k < n; k++) put(pick(FLOWERS), x + range(-spread, spread), z + range(-spread, spread), rnd() * 6, FLOWER_SCALE, { shadow: false });
  };
  const pave = (i, j) => {
    put('roads/tile-low', tileX(i), tileX(j), 0, T, { y: PAVE_LIFT, shadow: false });
    paved.add(key(i, j));
  };

  // Model facing outward normal n, its front `gap` metres inside edge point (ex, ez).
  function putFacing(name, ex, ez, nx, nz, gap, scale, opts) {
    const front = kit.get(name).box.max.z * scale;
    put(name, ex - nx * (gap + front), ez - nz * (gap + front), facing(nx, nz), scale, { collide: true, ...opts });
  }
  const size = (name) => kit.get(name).box.getSize(new THREE.Vector3());

  // ---- road network ----
  // the ring road round the map, plus the connection points to the planet roads
  const extraRoads = new Set();
  if (ring === 'outside') {
    for (let k = -1; k <= N; k++) {
      for (const [i, j] of [[k, -1], [k, N], [-1, k], [N, k]]) extraRoads.add(key(i, j));
    }
  }
  const planetLinks = new Set(PLANET_ROAD_STARTS.map(([i, j]) => key(i, j)));
  const isRoad = (i, j) => at(i, j) === '#' || at(i, j) === '=' || extraRoads.has(key(i, j)) || planetLinks.has(key(i, j));
  const isO = (i, j) => at(i, j) === 'O';
  const isRoundaboutCentre = (i, j) => isO(i, j) && Object.values(DIRS).every(([di, dj]) => isO(i + di, j + dj));
  // a road joins a roundabout only at the middle of each side
  const joins = (i, j, di, dj) => isRoad(i + di, j + dj) || isRoundaboutCentre(i + 2 * di, j + 2 * dj);
  const sides = (i, j) =>
    Object.entries(DIRS)
      .filter(([, [di, dj]]) => joins(i, j, di, dj))
      .map(([d]) => d);
  const frontage = (i, j) => Object.values(DIRS).filter(([di, dj]) => at(i + di, j + dj) === '#');
  const inDowntown = downtown;

  const roadTiles = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (isRoad(i, j)) roadTiles.push([i, j]);
  for (const k of extraRoads) roadTiles.push(k.split(',').map(Number));
  const drawnRoads = roadTiles;

  for (const [i, j] of drawnRoads) {
    const want = sides(i, j).sort().join('');
    let placed = false;
    for (const [model, conn] of ROAD_SHAPES) {
      let c = conn.split('');
      for (let r = 0; r < 4 && !placed; r++, c = c.map((d) => TURN[d])) {
        if ([...c].sort().join('') !== want) continue;
        placed = true;
        let name = model;
        const [di, dj] = DIRS[c[0]];
        const nearJunction = sides(i + di, j + dj).length > 2 || sides(i - di, j - dj).length > 2;
        if (model === 'roads/road-straight' && at(i, j) === '=') name = 'roads/road-straight-barrier';
        else if (model === 'roads/road-straight' && (inDowntown(i, j) || crossings) && nearJunction) name = 'roads/road-crossing';
        put(name, tileX(i), tileX(j), (r * Math.PI) / 2, T, { y: PAVE_LIFT, shadow: false });
        // street lights on every other plain straight tile, arm reaching over the road
        if (name === 'roads/road-straight' && (i + j) % 2 === 0) {
          const along = c.includes('E') ? [1, 0] : [0, 1];
          const flip = (i + j) % 4 === 0 ? 1 : -1;
          const [sx, sz] = [along[1] * flip, along[0] * flip];
          const x = tileX(i) + sx * 0.44 * T;
          const z = tileX(j) + sz * 0.44 * T;
          put(inDowntown(i, j) ? 'roads/light-square' : 'roads/light-curved', x, z, Math.atan2(sx, sz), T);
          colliders.push({ x, z, r: 0.15, top: 4 });
        }
      }
      if (placed) break;
    }
    if (!placed) console.warn('no road tile for', i, j, want);
    paved.add(key(i, j));
  }

  const roundabouts = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (isO(i, j)) paved.add(key(i, j));
      if (!isRoundaboutCentre(i, j)) continue;
      roundabouts.push([i, j]);
      const x = tileX(i);
      const z = tileX(j);
      put('roads/road-roundabout', x, z, 0, T, { y: PAVE_LIFT, shadow: false });
      put('nature/statue_obelisk', x, z, 0, 5, { y: PAVE_H });
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        put(pick(FLOWERS), x + Math.cos(a) * 1.3, z + Math.sin(a) * 1.3, a, FLOWER_SCALE, { y: PAVE_H, shadow: false });
      }
      colliders.push({ x, z, r: 1.9, top: 1 });
    }
  }

  // ---- zones ----
  const used = new Set();
  const take = (...tiles) => tiles.forEach(([i, j]) => used.add(key(i, j)));
  const free = (i, j, c) => at(i, j) === c && !used.has(key(i, j));
  // a building's front sits this far back from the tile edge (the sidewalk is part of the road tile)
  const GAP = 0.6;

  // How deep a building facing n from tile (i, j) may go before it runs into its neighbour behind.
  function roomBehind(i, j, [nx, nz]) {
    const c = at(i - nx, j - nz);
    return BUILDING.has(c) || c === '#' ? T - 0.3 : 2 * T - 1;
  }

  const QUAD = [[0, 0], [1, 0], [0, 1], [1, 1]];
  // Towers: claim 2×2 squares of 't' first.
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (!QUAD.every(([a, b]) => free(i + a, j + b, 't'))) continue;
      const quad = QUAD.map(([a, b]) => [i + a, j + b]);
      take(...quad);
      quad.forEach(([a, b]) => pave(a, b));
      put(pick(TOWERS), tileX(i + 0.5), tileX(j + 0.5), (Math.floor(rnd() * 4) * Math.PI) / 2, T, {
        y: PAVE_H, collide: true, variant: Math.floor(rnd() * COMMERCIAL_VARIANTS),
      });
    }
  }

  // Industry: 2×2 yards get a factory facing whichever road one of them touches.
  let waterTower = false;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const quad = QUAD.map(([a, b]) => [i + a, j + b]);
      if (!quad.every(([a, b]) => free(a, b, 'i'))) continue;
      // outward normal of a yard side that touches a road
      const n = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([nx, nz]) =>
        quad.some(([a, b]) => {
          const onSide = (nx < 0 ? a === i : nx > 0 ? a === i + 1 : true) && (nz < 0 ? b === j : nz > 0 ? b === j + 1 : true);
          return onSide && at(a + nx, b + nz) === '#';
        }),
      );
      if (!n) continue;
      take(...quad);
      quad.forEach(([a, b]) => pave(a, b));
      const name = pick(FACTORIES);
      const sz = size(name);
      const s = Math.min(4.6, (2 * T - GAP - 0.5) / sz.z, (2 * T - 0.8) / sz.x);
      const cx = tileX(i + 0.5);
      const cz = tileX(j + 0.5);
      putFacing(name, cx + n[0] * T, cz + n[1] * T, n[0], n[1], GAP, s, { y: PAVE_H });
      if (!waterTower && rnd() < 0.3) {
        waterTower = true;
        put('industrial/water-tower', cx - n[0] * T * 0.75 + n[1] * T * 0.7, cz - n[1] * T * 0.75 + n[0] * T * 0.7, 0, 4, { y: PAVE_H, collide: true });
      }
    }
  }

  // Houses: pair neighbouring tiles that share a road into one wider lot.
  const backFences = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (!free(i, j, 'h')) continue;
      const fronts = frontage(i, j);
      if (!fronts.length) continue;
      // the next tile (east or south) along the road, if it is a free house tile on the same road
      const pairable = (n) => {
        const [lx, lz] = n[0] ? [0, 1] : [1, 0];
        return free(i + lx, j + lz, 'h') && at(i + lx + n[0], j + lz + n[1]) === '#' ? [lx, lz] : null;
      };
      const n = fronts.find(pairable) ?? pick(fronts);
      const lat = rnd() < 0.85 ? pairable(n) : null;
      const tiles = lat ? [[i, j], [i + lat[0], j + lat[1]]] : [[i, j]];
      take(...tiles);
      const room = Math.min(...tiles.map(([a, b]) => roomBehind(a, b, n)));
      // centre of the lot frontage
      const ex = tileX(i + (lat ? lat[0] / 2 : 0)) + (n[0] * T) / 2;
      const ez = tileX(j + (lat ? lat[1] / 2 : 0)) + (n[1] * T) / 2;
      const width = tiles.length * T - 0.6;
      const name = lat ? pick(HOUSES) : pick(HOUSES.filter((h) => size(h).x * 4.6 <= width));
      const sz = size(name);
      const s = Math.min(lat ? 5.6 : 4.8, width / sz.x, (room - GAP) / sz.z);
      putFacing(name, ex, ez, n[0], n[1], GAP, s, { variant: Math.floor(rnd() * ROOF_COLORS.length) });
      // a bush or planter by the front corner, a tree out back if there is room
      const side = rnd() < 0.5 ? -1 : 1;
      const [px, pz] = [Math.abs(n[1]), Math.abs(n[0])];
      put(rnd() < 0.5 ? 'suburban/planter' : pick(BUSHES),
        ex + px * side * (width / 2 - 0.6) - n[0] * 0.4, ez + pz * side * (width / 2 - 0.6) - n[1] * 0.4,
        facing(n[0], n[1]), rnd() < 0.5 ? T : 3, { collide: true });
      if (room > T) {
        const tx = ex - n[0] * (room - 1.5) + px * range(-2, 2);
        const tz = ez - n[1] * (room - 1.5) + pz * range(-2, 2);
        put(rnd() < 0.5 ? 'suburban/tree-large' : 'suburban/tree-small', tx, tz, rnd() * 6, T);
        colliders.push({ x: tx, z: tz, r: 0.4, top: 3 });
      } else {
        backFences.push({ ex, ez, n, width });
      }
    }
  }
  // back-to-back gardens get a fence along the shared edge (drawn once, from the north/west house)
  const FENCE_LEN = 0.48 * T;
  for (const { ex, ez, n, width } of backFences) {
    if (n[0] > 0 || n[1] > 0) continue;
    const bx = ex - n[0] * T;
    const bz = ez - n[1] * T;
    const along = n[0] ? [0, 1] : [1, 0];
    const count = Math.round(width / FENCE_LEN);
    for (let k = 0; k < count; k++) {
      const o = (k - (count - 1) / 2) * FENCE_LEN;
      put('suburban/fence', bx + along[0] * o, bz + along[1] * o, n[0] ? Math.PI / 2 : 0, T);
    }
    const hw = (count * FENCE_LEN) / 2;
    colliders.push(n[0]
      ? { minX: bx - 0.15, maxX: bx + 0.15, minZ: bz - hw, maxZ: bz + hw, top: 1.6 }
      : { minX: bx - hw, maxX: bx + hw, minZ: bz - 0.15, maxZ: bz + 0.15, top: 1.6 });
  }

  // Farm fields and camps: each connected patch of 'f' / 'c' is one region (with its bounding box).
  const regions = { f: [], c: [] };
  const seen = new Set();
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const c = at(i, j);
      if ((c !== 'f' && c !== 'c') || seen.has(key(i, j))) continue;
      const r = { i0: i, j0: j, i1: i, j1: j, tiles: [] };
      const stack = [[i, j]];
      seen.add(key(i, j));
      while (stack.length) {
        const [a, b] = stack.pop();
        r.tiles.push([a, b]);
        r.i0 = Math.min(r.i0, a);
        r.j0 = Math.min(r.j0, b);
        r.i1 = Math.max(r.i1, a);
        r.j1 = Math.max(r.j1, b);
        for (const [di, dj] of Object.values(DIRS)) {
          if (at(a + di, b + dj) === c && !seen.has(key(a + di, b + dj))) {
            seen.add(key(a + di, b + dj));
            stack.push([a + di, b + dj]);
          }
        }
      }
      regions[c].push(r);
    }
  }

  // Everything else, tile by tile. (Parks run after this pass so they know where the ponds are.)
  const parkTiles = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (used.has(key(i, j))) continue;
      const c = at(i, j);
      const x = tileX(i);
      const z = tileX(j);
      if (c === 'd') {
        const fronts = frontage(i, j);
        if (!fronts.length) {
          plaza(i, j);
          continue;
        }
        pave(i, j);
        const n = pick(fronts);
        const name = pick(SHOPS);
        const s = Math.min(T, (roomBehind(i, j, n) - GAP) / size(name).z);
        putFacing(name, x + (n[0] * T) / 2, z + (n[1] * T) / 2, n[0], n[1], GAP, s, {
          y: PAVE_H, variant: Math.floor(rnd() * COMMERCIAL_VARIANTS),
        });
      } else if (c === 't' || c === 'P') {
        plaza(i, j);
      } else if (c === 'i') {
        pave(i, j);
        const name = pick(YARD_PROPS);
        put(name, x + range(-1, 1), z + range(-1, 1), (Math.floor(rnd() * 4) * Math.PI) / 2, name.includes('container') ? 2.6 : 4, { y: PAVE_H, collide: true });
      } else if (c === 'v') {
        pave(i, j);
        const fronts = frontage(i, j);
        const [nx, nz] = fronts.length ? pick(fronts) : [0, 1];
        const point = toWorld(x, 0, z);
        bays.push({ point, forward: toWorld(x + nx, 0, z + nz).sub(point).normalize() });
      } else if (c === 'm') {
        stall(i, j);
      } else if (c === 'k') {
        parking(i, j);
      } else if (c === 'g') {
        picnic(i, j);
      } else if (c === 'n') {
        pines(i, j);
      } else if (c === 'p') {
        parkTiles.push([i, j]);
        // one pond per park: a step further in from the first tile deep enough, if the park allows
        const deep = (a, b) => [-1, 0, 1].every((u) => [-1, 0, 1].every((v) => at(a + u, b + v) === 'p'));
        const clear = ponds.every((p) => Math.hypot(p.x - x, p.z - z) > 3 * T);
        if (deep(i, j) && clear) deep(i + 1, j + 1) ? pond(i + 1, j + 1) : pond(i, j);
      } else if (c === '~' || c === '=') {
        water.push([i, j]);
        if (c === '~') {
          // someone who lands in the water leaves it only towards dry land, never into the next tile
          const dry = (di, dj) => at(i + di, j + dj) !== '~' && at(i + di, j + dj) !== '=';
          const exits = { '-x': dry(-1, 0), '+x': dry(1, 0), '-z': dry(0, -1), '+z': dry(0, 1) };
          colliders.push({ minX: x - T / 2, maxX: x + T / 2, minZ: z - T / 2, maxZ: z + T / 2, top: 0.5, exits });
          if (boats && rnd() < 0.18) put('nature/canoe', x + range(-1, 1), z + range(-1, 1), rnd() * 6, 4, { y: 0.08 });
          else if (boats && rnd() < 0.3) put(rnd() < 0.5 ? 'nature/lily_large' : 'nature/lily_small', x + range(-2, 2), z + range(-2, 2), rnd() * 6, 4, { y: 0.08, shadow: false });
        }
      } else if (c === '.' || c === 'h') {
        lawn(i, j);
      }
    }
  }
  for (const [i, j] of parkTiles) park(i, j);
  regions.f.forEach(farm);
  regions.c.forEach(camp);

  // Market stall facing the road: a trestle table under a parasol, food on top, crates beside it.
  function stall(i, j) {
    pave(i, j);
    const fronts = frontage(i, j);
    const [nx, nz] = fronts.length ? pick(fronts) : [0, 1];
    const rot = facing(nx, nz);
    const [lx, lz] = [nz, -nx]; // along the table
    const x = tileX(i) - nx * 0.6;
    const z = tileX(j) - nz * 0.6;
    put('furniture/tableCrossCloth', x, z, rot, 1.2, { y: PAVE_H, collide: true });
    put(rnd() < 0.5 ? 'commercial/detail-parasol-a' : 'commercial/detail-parasol-b', x - nx * 0.9, z - nz * 0.9, rot, T * 0.9, { y: PAVE_H });
    for (let k = -1; k <= 1; k++) put(pick(STALL_FOOD), x + lx * k * 0.75, z + lz * k * 0.75, rnd() * 6, 1.3, { y: PAVE_H + 1 });
    put('food/barrel', x + lx * 1.9, z + lz * 1.9, rnd() * 6, 1.5, { y: PAVE_H, collide: 'circle' });
    put('furniture/cardboardBoxClosed', x - lx * 1.8 - nx * 0.6, z - lz * 1.8 - nz * 0.6, rot, 2.4, { y: PAVE_H });
  }

  // Parking bay: a parked vehicle nose-in towards the road.
  function parking(i, j) {
    pave(i, j);
    const fronts = frontage(i, j);
    const [nx, nz] = fronts.length ? pick(fronts) : [0, 1];
    const name = pick(PARKED);
    put(name, tileX(i), tileX(j), facing(nx, nz), CAR_SCALE, { y: PAVE_H - kit.get(name).box.min.y * CAR_SCALE, collide: true });
  }

  // Lawn with a picnic table, a bin, flowers and a shady tree.
  function picnic(i, j) {
    const x = tileX(i);
    const z = tileX(j);
    put('furniture/tableCross', x + range(-0.5, 0.5), z + range(-0.5, 0.5), (Math.floor(rnd() * 4) * Math.PI) / 2, 1.1, { collide: true });
    put('furniture/trashcan', x + 2.2, z - 2.2, 0, 1.3, { collide: 'circle' });
    tree(x - 2 + range(-0.5, 0.5), z + 2 + range(-0.5, 0.5), range(2.8, 3.4));
    flowers(x, z, 3, 2.6);
  }

  function pines(i, j) {
    const x = tileX(i);
    const z = tileX(j);
    for (let k = 0, n = 2 + Math.floor(rnd() * 2); k < n; k++) {
      const px = x + range(-2.2, 2.2);
      const pz = z + range(-2.2, 2.2);
      put(pick(PINES), px, pz, rnd() * 6, range(3, 4.4));
      colliders.push({ x: px, z: pz, r: 0.4, top: 2 });
    }
    if (rnd() < 0.3) put(pick(rnd() < 0.5 ? ROCKS : BUSHES), x + range(-2, 2), z + range(-2, 2), rnd() * 6, rnd() < 0.5 ? 3 : 4, { collide: true });
  }

  // One tile of a campsite: a tent, a campfire with logs round it, pines or firewood.
  function campTile(i, j) {
    const x = tileX(i);
    const z = tileX(j);
    const roll = rnd();
    if (roll < 0.32) {
      put(pick(TENTS), x, z, (Math.floor(rnd() * 4) * Math.PI) / 2, 5, { collide: true });
    } else if (roll < 0.5) {
      put('nature/campfire_logs', x, z, 0, 4);
      colliders.push({ x, z, r: 0.9, top: 0.6 });
      for (const a of [0.4, 2.5, 4.4]) put('nature/log', x + Math.cos(a) * 2.4, z + Math.sin(a) * 2.4, -a, 4, { collide: true });
    } else if (roll < 0.85) {
      pines(i, j);
    } else {
      put('nature/log_stackLarge', x, z, rnd() * 6, 4, { collide: true });
    }
  }

  // Paved plaza tile; the middle of a 3×3 plaza gets a fountain.
  function plaza(i, j) {
    pave(i, j);
    const x = tileX(i);
    const z = tileX(j);
    const ring = [-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => at(i + a, j + b)));
    if (ring.every((c) => c === 'P')) {
      ponds.push({ x, z, r: 2.6, y: PAVE_H });
      colliders.push({ x, z, r: 3, top: 1 });
      put('nature/statue_obelisk', x, z, 0, 3.5, { y: PAVE_H });
      for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        put('suburban/planter', x + a * 4.6, z + b * 4.6, 0, T, { y: PAVE_H, collide: true });
        put('suburban/tree-small', x + a * 4.6, z + b * 4.6, 0, 4, { y: PAVE_H + 0.5 });
      }
      return;
    }
    const roll = rnd();
    if (roll < 0.3) {
      put(rnd() < 0.5 ? 'commercial/detail-parasol-a' : 'commercial/detail-parasol-b', x, z, 0, T, { y: PAVE_H, collide: true });
      put('furniture/bench', x + 1.6, z, -Math.PI / 2, 2.6, { y: PAVE_H, collide: true });
    } else if (roll < 0.6) {
      put('suburban/planter', x + range(-1, 1), z + range(-1, 1), 0, T, { y: PAVE_H, collide: true });
    } else if (roll < 0.8) {
      put('furniture/bench', x, z + range(-1, 1), (Math.floor(rnd() * 4) * Math.PI) / 2, 2.6, { y: PAVE_H, collide: true });
    }
  }

  function pond(i, j) {
    const x = tileX(i);
    const z = tileX(j);
    const r = 5.5;
    ponds.push({ x, z, r });
    colliders.push({ x, z, r: r + 0.3, top: 0.5 });
    for (let k = 0; k < 7; k++) {
      const a = rnd() * Math.PI * 2;
      const d = range(1, r - 0.8);
      put(rnd() < 0.5 ? 'nature/lily_large' : 'nature/lily_small', x + Math.cos(a) * d, z + Math.sin(a) * d, rnd() * 6, 4, { y: 0.08, shadow: false });
    }
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      put(pick(FLOWERS), x + Math.cos(a) * (r + 1), z + Math.sin(a) * (r + 1), a, FLOWER_SCALE, { shadow: false });
    }
  }

  // Grass tile with trees and flowers; benches look at the river or the pond when there is one.
  function park(i, j) {
    const x = tileX(i);
    const z = tileX(j);
    if (ponds.some((p) => p.x === x && p.z === z)) return;
    const toWater = Object.values(DIRS).find(([di, dj]) => at(i + di, j + dj) === '~');
    if (toWater) {
      const [wx, wz] = toWater;
      put('furniture/bench', x + wx * 1.5, z + wz * 1.5, facing(wx, wz), 2.6, { collide: true });
      if (i % 2) put('roads/light-curved', x + wx * 2.6 + wz * 2, z + wz * 2.6 + wx * 2, facing(-wx, -wz), T * 0.8);
      if (rnd() < 0.6) tree(x - wx * 1.5 + range(-2, 2), z - wz * 1.5 + range(-2, 2), range(2.6, 3.4));
      flowers(x, z, 2, 2.5);
      return;
    }
    const toPond = ponds.find((p) => !p.y && Math.hypot(p.x - x, p.z - z) < T * 1.5);
    if (toPond && rnd() < 0.6) {
      const dx = toPond.x - x;
      const dz = toPond.z - z;
      const d = Math.hypot(dx, dz);
      put('furniture/bench', x - (dx / d) * 0.5, z - (dz / d) * 0.5, Math.atan2(dx, dz), 2.6, { collide: true });
      return;
    }
    if (rnd() < 0.55) tree(x + range(-1.8, 1.8), z + range(-1.8, 1.8), range(2.8, 3.6));
    if (rnd() < 0.4) put(pick(BUSHES), x + range(-2, 2), z + range(-2, 2), rnd() * 6, 4, { collide: true });
    flowers(x, z, 3, 2.5);
  }

  function lawn(i, j) {
    const x = tileX(i);
    const z = tileX(j);
    const roll = rnd();
    if (roll < 0.35) tree(x + range(-1.5, 1.5), z + range(-1.5, 1.5), range(2.5, 3.3));
    else if (roll < 0.55) put(pick(BUSHES), x + range(-2, 2), z + range(-2, 2), rnd() * 6, 4, { collide: true });
    if (rnd() < 0.5) flowers(x, z, 2, 2.4);
  }

  function farm({ i0, j0, i1, j1 }) {
    const x0 = tileX(i0) - T / 2;
    const z0 = tileX(j0) - T / 2;
    const w = (i1 - i0 + 1) * T;
    const h = (j1 - j0 + 1) * T;
    const m = 1.5; // margin
    const L = 4; // fence segment
    for (let d = m + L / 2; d < w - m; d += L) {
      put('nature/fence_simple', x0 + d, z0 + m + L / 2, 0, L); // north
      if (Math.abs(d - w / 2) > L / 2) put('nature/fence_simple', x0 + d, z0 + h - m - L / 2, Math.PI, L); // south, with a gate
    }
    for (let d = m + L / 2; d < h - m; d += L) {
      put('nature/fence_simple', x0 + w - m - L / 2, z0 + d, -Math.PI / 2, L); // east
      put('nature/fence_simple', x0 + m + L / 2, z0 + d, Math.PI / 2, L); // west
    }
    // a windmill in the field's north-east corner, crops everywhere else
    const mx = x0 + w - m - 3;
    const mz = z0 + m + 3;
    put('industrial/windmill', mx, mz, -Math.PI / 2, 5, { collide: true });
    let row = 0;
    for (let z = z0 + m + 2.5; z < z0 + h - m - 3; z += 2.6, row++) {
      const crop = CROPS[row % CROPS.length];
      for (let x = x0 + m + 2.5; x < x0 + w - m - 2; x += 4) {
        if (Math.hypot(x - mx, z - mz) < 4.5) continue;
        put('nature/crops_dirtRow', x, z, 0, 4, { shadow: false });
        put(crop, x - 0.9, z, 0, 2.8);
        put(crop, x + 0.9, z, 0, 2.8);
      }
    }
    put('nature/log_stack', x0 + w / 2 + 3.5, z0 + h - 0.8, 0, 4, { collide: true });
    // fence colliders on the north, east and west sides (the south side has the gate)
    colliders.push({ minX: x0 + m - 0.2, maxX: x0 + m + 0.2, minZ: z0 + m, maxZ: z0 + h - m, top: 1.2 });
    colliders.push({ minX: x0 + w - m - 0.2, maxX: x0 + w - m + 0.2, minZ: z0 + m, maxZ: z0 + h - m, top: 1.2 });
    colliders.push({ minX: x0 + m, maxX: x0 + w - m, minZ: z0 + m - 0.2, maxZ: z0 + m + 0.2, top: 1.2 });
  }

  function camp({ i0, j0, i1, j1, tiles }) {
    const lake = [];
    const campTiles = [];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (at(i, j) === '~') lake.push([i, j]);
        if (at(i, j) === 'c') campTiles.push([i, j]);
      }
    }
    // a camp without its own lake is laid out tile by tile
    if (!lake.length) {
      tiles.forEach(([i, j]) => campTile(i, j));
      return;
    }
    const lx = lake.reduce((s, [i]) => s + tileX(i), 0) / lake.length;
    const lz = lake.reduce((s, [, j]) => s + tileX(j), 0) / lake.length;
    put('nature/canoe', lx - 2, lz, 0.6, 4, { y: 0.08 });
    put('nature/lily_large', lx + 4, lz - 2, 0, 4, { y: 0.08 });
    put('nature/lily_small', lx - 6, lz + 3, 0, 4, { y: 0.08 });
    // tents and the campfire on the east shore, trees and reeds elsewhere
    const ti = i1 - 0.5;
    const tj = (j0 + j1) / 2;
    const tx = tileX(ti);
    const tz = tileX(tj);
    put('nature/tent_detailedOpen', tx + 1, tz - 4, -Math.PI / 2, 5, { collide: true });
    put('nature/tent_smallOpen', tx + 1, tz + 4.5, -Math.PI / 2, 5, { collide: true });
    put('nature/campfire_stones', tx - 2.5, tz, 0, 4);
    put('nature/log', tx - 2.5, tz + 2.2, Math.PI / 2, 4, { collide: true });
    put('nature/stump_round', tx - 2.5, tz - 2.2, 0, 4, { collide: true });
    for (const [i, j] of campTiles) {
      if (i >= i1 - 1 && Math.abs(j - tj) <= 1.5) continue;
      const nearWater = Object.values(DIRS).some(([di, dj]) => at(i + di, j + dj) === '~');
      if (nearWater) put(rnd() < 0.5 ? pick(BUSHES) : 'nature/grass_large', tileX(i) + range(-2, 2), tileX(j) + range(-2, 2), rnd() * 6, 4);
      else if (rnd() < 0.7) tree(tileX(i) + range(-1.5, 1.5), tileX(j) + range(-1.5, 1.5), range(2.6, 3.6));
    }
  }

  return {
    colliders, // flat, in this map's chart
    ponds,
    water,
    tileX,
    frame,
    half: (N / 2 + (ring === 'outside' ? 1 : 0)) * T, // half-width including any ring road
    isPaved: (x, z) => paved.has(key(worldTile(x), worldTile(z))),
    toWorld,
    bays,
    spinners,
    smokers,
    fires,
    rnd,
    // the road network, for traffic: tiles (drawn), the links where planet roads take over,
    // sides(i, j) (including towards links and roundabouts) and roundabout centres
    roads: { tiles: roadTiles, links: PLANET_ROAD_STARTS, sides, roundabouts, isRoad },
  };
}
