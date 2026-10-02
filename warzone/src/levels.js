// Zone layouts, built with a small tile builder so coordinates stay readable.
// Coordinates are tiles (16px). An object at (x, y) stands with its feet on row y + 1.
//
// Ability budget used to design every co-op gate (see players.js for the numbers):
//   Plumber jump ≈ 4.8 tiles · Gunner jump ≈ 3.4 tiles · Gunner standing on Plumber ≈ 4.3 tiles
//   Gunner throw ≈ 8 tiles · POGO CANNON ≈ 13.5 tiles · SEE-SAW launch ≈ 13.5 tiles
//   Jetpack hover 2.5 s ≈ 14 tiles across (≈ 13 tiles while carrying the Plumber), Plumber jump ≈ 6 across
//   Metal (M) can't be wall-clung; ground/brick/steel can.

export const TILE = {
  EMPTY: 0,
  GROUND: 1,
  BRICK: 2,
  QCOIN: 3,
  QPOWER: 4,
  USED: 5,
  STEEL: 6,
  SANDBAG: 7,
  WIRE: 8,
  FRAGILE: 9,
  GIRDER: 10,
  METAL: 11,
  SPIKE: 12,
  GATE: 13,
  BRIDGE: 14,
  PIPE: 15,
  LAVA: 16,
  LOCK: 17,
};
const t = TILE;

class Builder {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.objs = [];
  }
  set(x, y, id) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = id;
  }
  rect(x0, y0, x1, y1, id) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, id);
    return this;
  }
  ground(x0, x1, top, id = t.GROUND) {
    return this.rect(x0, top, x1, this.h - 1, id);
  }
  row(x0, x1, y, id) {
    return this.rect(x0, y, x1, y, id);
  }
  o(type, x, y, props = {}) {
    this.objs.push({ type, x, y, ...props });
    return this;
  }
  coins(x0, x1, y) {
    for (let x = x0; x <= x1; x++) this.o('coin', x, y);
    return this;
  }
  pipe(id, x, top, h, to, color = 0) {
    this.rect(x, top, x + 1, top + h - 1, t.PIPE);
    return this.o('pipe', x, top, { id, h, to, color });
  }
  // a door made of gate tiles (vertical strip), opened by any trigger with the same id
  door(id, x, y0, y1, props = {}) {
    this.rect(x, y0, x, y1, t.GATE);
    return this.o('door', x, y0, { id, x0: x, x1: x, y0, y1, ...props });
  }
  hatch(id, x0, x1, y) {
    this.rect(x0, y, x1, y, t.GATE);
    return this.o('door', x0, y, { id, x0, x1, y0: y, y1: y });
  }
  bridge(id, x0, x1, y, tile = t.GIRDER) {
    return this.o('bridge', x0, y, { id, x0, x1, y0: y, y1: y, tile });
  }
  done(meta) {
    return { w: this.w, h: this.h, tiles: this.tiles, objs: this.objs, ...meta };
  }
}

// ======================================================================== ZONE 1
function zone1() {
  const b = new Builder(232, 28);
  const G = 24;
  b.ground(0, 75, G);
  // trench start
  b.rect(0, 0, 0, G - 1, t.METAL);
  b.o('spawn', 3, G - 1, { who: 'plumber' });
  b.o('spawn', 5, G - 1, { who: 'gunner' });
  b.o('sign', 8, G - 1, { text: 'MUSHROOM WARZONE! Kalian cuma bisa lolos BARENG. PLUMBER: W lompat, S di udara = GROUND POUND. GUNNER: K tembak, J lompat.' });
  b.row(12, 16, G - 4, t.BRICK);
  b.set(12, G - 4, t.QCOIN);
  b.set(14, G - 4, t.QPOWER);
  b.set(16, G - 4, t.QCOIN);
  b.coins(19, 23, G - 2);
  b.o('enemy', 22, G - 1, { kind: 'goomba' });
  b.o('enemy', 29, G - 1, { kind: 'goomba' });
  b.rect(26, G - 1, 27, G - 1, t.SANDBAG);
  b.row(26, 27, G - 1, t.SANDBAG);

  // STEEL WALL (gunner only)
  b.o('sign', 35, G - 1, { text: 'TEMBOK BAJA: cuma peluru & granat GUNNER yang mempan. PLUMBER, minggir dulu!' });
  b.rect(40, 0, 41, G - 4, t.METAL);
  b.rect(40, G - 3, 41, G - 1, t.STEEL);
  b.o('enemy', 47, G - 1, { kind: 'trooper' });
  b.coins(44, 48, G - 3);
  b.o('enemy', 52, G - 1, { kind: 'goomba' });

  // TALL LEDGE: the gunner needs a boost off the plumber's head
  b.o('sign', 51, G - 1, { text: 'GUNNER pendek lompatnya: naik ke KEPALA PLUMBER dulu, baru lompat!' });
  b.ground(56, 75, G - 4);
  b.o('checkpoint', 58, G - 5);
  b.o('enemy', 63, G - 5, { kind: 'goomba' });
  b.o('enemy', 68, G - 9, { kind: 'parakoopa' });
  b.coins(62, 66, G - 7);

  // WIDE PIT: carry the plumber across with the jetpack
  b.o('sign', 71, G - 5, { text: 'JURANG! GUNNER: deketin PLUMBER, tekan I buat ANGKAT. Lompat (J) lalu TAHAN J = JETPACK. I lagi = lempar.' });
  // pit x 76..86
  b.ground(87, 104, G - 4);
  b.o('enemy', 92, G - 5, { kind: 'trooper' });
  b.row(94, 98, G - 8, t.BRICK);
  b.set(96, G - 8, t.QPOWER);
  b.o('enemy', 101, G - 5, { kind: 'goomba' });
  b.o('pickup', 89, G - 5, { kind: 'grenade' });

  // PIPE PUZZLE: lever lives in a sealed room only the plumber can pipe into
  b.ground(105, 160, G);
  b.o('sign', 107, G - 1, { text: 'PIPA KECIL: PLUMBER berdiri di atas pipa, tekan S buat masuk. Cari TUAS (F) di dalam! GUNNER kegedean.' });
  b.pipe('p1a', 112, G - 2, 2, 'p1b', 0);
  // sealed chamber in the sky
  b.rect(112, 6, 127, 15, t.METAL);
  b.rect(113, 7, 126, 12, t.EMPTY);
  b.pipe('p1b', 115, 11, 2, 'p1a', 0);
  b.pipe('p1c', 120, 11, 2, 'p1d', 1);
  b.o('lever', 124, 12, { opens: 'd1' });
  b.coins(117, 119, 8);
  b.pipe('p1d', 124, G - 2, 2, 'p1c', 1);
  b.o('enemy', 118, G - 1, { kind: 'goomba' });
  b.o('enemy', 121, G - 1, { kind: 'trooper' });
  b.rect(128, 0, 128, G - 7, t.METAL);
  b.door('d1', 128, G - 6, G - 1);
  b.o('checkpoint', 131, G - 1);
  b.row(137, 137, G - 1, t.SANDBAG);
  b.row(137, 137, G - 2, t.SANDBAG);
  b.o('enemy', 146, G - 1, { kind: 'bunker' });
  b.o('enemy', 141, G - 1, { kind: 'goomba' });
  b.coins(139, 143, G - 4);

  // POGO CANNON: lever on a girder 12 tiles up
  b.o('sign', 152, G - 1, { text: 'POGO CANNON: PLUMBER berdiri di kepala GUNNER. GUNNER jongkok (PANAH BAWAH) lalu TEMBAK (K). Boom, terbang!' });
  b.row(158, 164, G - 12, t.GIRDER);
  b.o('lever', 161, G - 13, { opens: 'd2' });
  b.coins(158, 164, G - 14);
  b.rect(168, 0, 169, G - 5, t.METAL);
  b.door('d2', 168, G - 4, G - 1);
  b.door('d2', 169, G - 4, G - 1);

  // POW + armour
  b.ground(161, 231, G);
  b.o('checkpoint', 172, G - 1);
  b.o('pickup', 175, G - 1, { kind: 'hmg' });
  b.o('pow', 180, G - 1);
  b.o('enemy', 184, G - 1, { kind: 'trooper' });
  b.o('enemy', 190, G - 1, { kind: 'minitank' });
  b.row(178, 182, G - 5, t.BRICK);
  b.set(180, G - 5, t.QPOWER);
  b.o('enemy', 194, G - 1, { kind: 'shyguy' });
  b.row(186, 187, G - 1, t.WIRE);

  // BOSS ARENA x 200..229
  b.o('sign', 196, G - 1, { text: 'BOS DI DEPAN! Masuk BERDUA, nanti pintunya ketutup.' });
  b.rect(230, 0, 231, G - 1, t.METAL);
  b.row(203, 207, G - 5, t.GIRDER);
  b.row(222, 226, G - 5, t.GIRDER);
  b.row(212, 217, G - 9, t.GIRDER);
  b.o('arena', 200, 0, { x0: 200, x1: 229, y0: 8, y1: G - 1, lock: [199, 0, 199, G - 1], boss: 'piranha', bx: 218, by: G - 1 });

  return b.done({
    name: 'ZONE 1 · MUSHROOM TRENCHES',
    short: 'MUSHROOM TRENCHES',
    zone: 0,
    music: 0,
  });
}

// ======================================================================== ZONE 2 (vertical)
function zone2() {
  const W = 60;
  const H = 120;
  const b = new Builder(W, H);
  b.rect(0, 0, 1, H - 1, t.METAL);
  b.rect(W - 2, 0, W - 1, H - 1, t.METAL);
  b.rect(0, 0, W - 1, 29, t.METAL);
  b.ground(2, W - 3, 116);
  const slab = (y, ...holes) => {
    b.row(2, W - 3, y, t.METAL);
    for (const [a, c] of holes) b.row(a, c, y, t.EMPTY);
  };
  slab(104, [52, 55]);
  slab(92, [26, 29]);
  slab(80, [52, 55]);
  slab(68, [3, 6]);
  slab(56, [50, 53]);
  slab(44, [4, 7]);

  // ---- F1: steel wall, static girder ladder up
  b.o('spawn', 4, 115, { who: 'plumber' });
  b.o('spawn', 6, 115, { who: 'gunner' });
  b.o('sign', 9, 115, { text: 'PIPE FACTORY SIEGE: naik terus sampai atap pabrik. Jangan pisah kejauhan!' });
  b.row(12, 16, 112, t.BRICK);
  b.set(14, 112, t.QPOWER);
  b.o('enemy', 20, 115, { kind: 'goomba' });
  b.rect(30, 105, 31, 112, t.METAL);
  b.rect(30, 113, 31, 115, t.STEEL);
  b.o('enemy', 38, 115, { kind: 'trooper' });
  b.o('enemy', 44, 115, { kind: 'goomba' });
  b.coins(34, 40, 113);
  for (const y of [113, 110, 107, 104]) b.row(52, 55, y, t.GIRDER);

  // ---- F2: SEE-SAW MORTAR → shoot the sky switch → ladder appears
  b.o('checkpoint', 48, 103);
  b.o('sign', 33, 103, { text: 'SEE-SAW MORTAR: GUNNER berdiri di ujung kiri, PLUMBER GROUND POUND ujung kanan. GUNNER tembak saklar di langit!' });
  b.o('seesaw', 10, 103);
  b.rect(2, 95, 8, 96, t.METAL); // shield so the switch can't be shot from the floor
  b.o('target', 3, 93, { opens: 'f2' });
  b.hatch('f2', 26, 29, 92);
  for (const y of [101, 98, 95]) b.bridge('f2', 26, 29, y);
  b.bridge('f2', 26, 29, 92);
  b.o('enemy', 40, 103, { kind: 'goomba' });
  b.o('enemy', 20, 98, { kind: 'parakoopa' });
  b.coins(14, 18, 99);

  // ---- F3: PIPE-SYNC (20 s valve) behind a gate
  b.o('checkpoint', 24, 91);
  b.o('sign', 30, 91, { text: 'PIPE-SYNC: PLUMBER masuk pipa, TAHAN F di valve 20 detik. GUNNER jagain dari serbuan!' });
  b.rect(2, 81, 15, 91, t.METAL);
  b.rect(3, 82, 14, 88, t.EMPTY);
  b.pipe('p2a', 32, 90, 2, 'p2b', 0);
  b.pipe('p2b', 4, 87, 2, 'p2a', 0);
  b.pipe('p2c', 8, 87, 2, 'p2d', 1);
  b.pipe('p2d', 36, 90, 2, 'p2c', 1);
  b.o('valve', 12, 88, { opens: 'f3', time: 20, spawns: [[20, 82], [39, 82], [28, 82]] });
  b.door('f3', 40, 81, 91);
  b.o('enemy', 48, 91, { kind: 'shyguy' });
  b.coins(44, 49, 89);
  for (const y of [89, 86, 83, 80]) b.row(52, 55, y, t.GIRDER);

  // ---- F4: steel wall, bunker, POW, wall-jump shaft + lever ladder
  b.o('checkpoint', 50, 79);
  b.rect(34, 69, 35, 76, t.METAL);
  b.rect(34, 77, 35, 79, t.STEEL);
  b.o('enemy', 44, 79, { kind: 'bunker' });
  b.o('enemy', 28, 79, { kind: 'trooper' });
  b.o('pow', 22, 79);
  b.o('pickup', 40, 79, { kind: 'shotgun' });
  b.o('sign', 12, 79, { text: 'WALL JUMP: PLUMBER nempel tembok (tahan arah) lalu lompat bolak-balik. Tarik tuas di atas buat GUNNER!' });
  b.rect(2, 69, 2, 79, t.GROUND);
  b.rect(7, 69, 7, 76, t.GROUND);
  for (const y of [77, 74, 71]) b.bridge('f4', 3, 6, y);
  b.bridge('f4', 3, 6, 68);
  b.o('enemy', 16, 79, { kind: 'goomba' });

  // ---- F5: carry over the spike floor, POGO up
  b.o('lever', 9, 67, { opens: 'f4' });
  b.o('checkpoint', 12, 67);
  b.row(21, 30, 67, t.SPIKE);
  b.o('sign', 15, 67, { text: 'LANTAI DURI: GUNNER angkat PLUMBER (I) lalu jetpack nyebrang.' });
  b.o('enemy', 26, 62, { kind: 'parakoopa' });
  b.o('enemy', 38, 67, { kind: 'trooper' });
  b.o('sign', 44, 67, { text: 'POGO CANNON lagi! GUNNER jongkok + tembak, PLUMBER tarik tuas di atas.' });
  b.o('lever', 47, 55, { opens: 'f5' });
  for (const y of [65, 62, 59]) b.bridge('f5', 50, 53, y);
  b.bridge('f5', 50, 53, 56);

  // ---- F6: gauntlet to the roof
  b.o('checkpoint', 46, 55);
  b.o('pickup', 42, 55, { kind: 'rocket' });
  b.rect(37, 53, 37, 55, t.SANDBAG);
  b.o('enemy', 30, 55, { kind: 'bunker' });
  b.row(22, 26, 51, t.GIRDER);
  b.o('enemy', 24, 50, { kind: 'shyguy' });
  b.o('enemy', 16, 55, { kind: 'minitank' });
  b.o('enemy', 34, 55, { kind: 'trooper' });
  b.coins(10, 14, 52);
  for (const y of [53, 50, 47, 44]) b.row(4, 7, y, t.GIRDER);

  // ---- roof arena
  b.row(12, 17, 39, t.GIRDER);
  b.row(40, 45, 39, t.GIRDER);
  b.row(26, 33, 35, t.GIRDER);
  b.o('arena', 2, 30, { x0: 2, x1: 57, y0: 30, y1: 43, lock: [4, 44, 7, 44], boss: 'gunship', bx: 30, by: 33 });

  return b.done({ name: 'ZONE 2 · PIPE FACTORY SIEGE', short: 'PIPE FACTORY SIEGE', zone: 1, music: 1 });
}

// ======================================================================== ZONE 3
function zone3() {
  const b = new Builder(262, 30);
  const G = 24;
  b.rect(0, 0, 0, G - 1, t.METAL);
  b.ground(0, 20, G);
  b.o('spawn', 3, G - 1, { who: 'plumber' });
  b.o('spawn', 5, G - 1, { who: 'gunner' });
  b.o('sign', 8, G - 1, { text: 'POW SKY FORTRESS: jatuh = balik ke pijakan terakhir, tapi nyawa berkurang. Kompak!' });
  // cloud hops
  b.row(23, 24, G - 2, t.GIRDER);
  b.row(27, 28, G - 4, t.GIRDER);
  b.ground(31, 74, G);
  b.o('enemy', 36, G - 1, { kind: 'trooper' });
  b.o('enemy', 40, G - 6, { kind: 'parakoopa' });
  b.rect(45, 8, 46, G - 4, t.METAL);
  b.rect(45, G - 3, 46, G - 1, t.STEEL);
  b.o('enemy', 54, G - 1, { kind: 'bunker' });
  b.o('enemy', 50, G - 1, { kind: 'goomba' });
  b.o('enemy', 58, G - 1, { kind: 'goomba' });
  b.row(50, 54, G - 5, t.BRICK);
  b.set(52, G - 5, t.QPOWER);

  // TANK BRIDGE: drive SV-001 to the edge, hold ↓ to extend the barrel, plumber climbs the pillar lever
  b.o('checkpoint', 62, G - 1);
  b.o('tank', 64, G - 1);
  b.o('sign', 68, G - 1, { text: 'TANK BRIDGE: GUNNER naik tank (I), tahan PANAH BAWAH buat manjangin MONCONG. PLUMBER jalan di moncong, tarik tuas di pilar!' });
  // pit x 75..94, pillar x 81..82
  b.rect(81, G - 4, 82, 29, t.METAL);
  b.o('lever', 81, G - 5, { opens: 'bridge3' });
  b.bridge('bridge3', 75, 94, G, t.BRIDGE);
  b.ground(95, 132, G);
  b.o('checkpoint', 97, G - 1);
  b.o('enemy', 104, G - 1, { kind: 'minitank' });
  b.o('enemy', 112, G - 1, { kind: 'minitank' });
  b.o('enemy', 118, G - 1, { kind: 'bunker' });
  b.o('enemy', 108, G - 7, { kind: 'parakoopa' });
  b.o('enemy', 124, G - 1, { kind: 'trooper' });
  b.row(120, 122, G - 1, t.SANDBAG);
  b.o('pow', 128, G - 1);

  // SEE-SAW + sky switch
  b.ground(133, 170, G);
  b.o('checkpoint', 136, G - 1);
  b.o('sign', 139, G - 1, { text: 'SEE-SAW MORTAR: GUNNER di ujung kiri, PLUMBER ground pound kanan. Tembak saklar di langit!' });
  b.o('seesaw', 145, G - 1);
  b.rect(155, 11, 161, 12, t.METAL);
  b.o('target', 158, 9, { opens: 'g3' });
  b.rect(168, 0, 169, G - 5, t.METAL);
  b.door('g3', 168, G - 4, G - 1);
  b.door('g3', 169, G - 4, G - 1);
  b.o('enemy', 162, G - 1, { kind: 'goomba' });

  // PIPE-SYNC (short)
  b.o('checkpoint', 172, G - 1);
  b.o('sign', 174, G - 1, { text: 'PIPE-SYNC: PLUMBER ke valve, tahan 15 detik. GUNNER bertahan!' });
  b.pipe('p3a', 178, G - 2, 2, 'p3b', 0);
  b.rect(172, 4, 187, 12, t.METAL);
  b.rect(173, 5, 186, 10, t.EMPTY);
  b.pipe('p3b', 174, 9, 2, 'p3a', 0);
  b.pipe('p3c', 179, 9, 2, 'p3d', 1);
  b.o('valve', 184, 10, { opens: 'g4', time: 15, spawns: [[176, 14], [190, 14], [194, 16]] });
  b.pipe('p3d', 192, G - 2, 2, 'p3c', 1);
  b.rect(198, 0, 199, G - 7, t.METAL);
  b.door('g4', 198, G - 6, G - 1);
  b.door('g4', 199, G - 6, G - 1);
  b.ground(171, 225, G);

  // pressure plates
  b.o('checkpoint', 202, G - 1);
  b.o('pickup', 204, G - 1, { kind: 'flame' });
  b.o('sign', 206, G - 1, { text: 'PELAT TEKAN: satu berdiri di pelat biar pintu kebuka, yang lain lewat, terus gantian.' });
  b.o('plate', 210, G - 1, { opens: 'g5' });
  b.rect(214, 0, 214, G - 6, t.METAL);
  b.door('g5', 214, G - 5, G - 1, { hold: true });
  b.o('plate', 217, G - 1, { opens: 'g5' });
  b.o('pickup', 220, G - 1, { kind: 'grenade' });

  // BOWSER SLUG arena x 228..257
  b.o('sign', 223, G - 1, { text: 'BOWSER SLUG. Kepala = titik lemah. Stomp + POGO buat sampai ke atas!' });
  b.ground(226, 261, G);
  b.rect(258, 0, 261, G - 1, t.METAL);
  b.row(231, 235, G - 6, t.GIRDER);
  b.row(250, 254, G - 6, t.GIRDER);
  b.o('arena', 228, 0, { x0: 228, x1: 257, y0: 8, y1: G - 1, lock: [227, 0, 227, G - 1], boss: 'bowser', bx: 246, by: G - 1 });

  return b.done({ name: 'ZONE 3 · POW SKY FORTRESS', short: 'POW SKY FORTRESS', zone: 2, music: 2, bottomless: true });
}

export const ZONES = [zone1, zone2, zone3];
