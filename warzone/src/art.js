// All art is drawn procedurally in a 16-colour SNES x NEO GEO palette and given a chunky black
// outline, so every sprite, tile and effect stays consistent without any image files.

export const PAL = {
  K: '#14101c', // outline / black
  W: '#f8f8f0',
  R: '#d8281c', // mushroom red
  r: '#8c1418',
  O: '#f88830',
  Y: '#f8c830',
  y: '#b07818',
  G: '#5c8c30', // military green
  g: '#34561c',
  L: '#9cc850',
  B: '#b0642c',
  b: '#5c3418',
  S: '#f8b880',
  U: '#3868d8',
  u: '#1c3478',
  M: '#a4a4b0',
  m: '#5c5c6c',
};

export const T = 16; // tile size in pixels

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Draw with a pixel helper, then wrap in a 1px outline (8-neighbour = chunky NEO GEO look).
export function sprite(w, h, draw, outline = true) {
  const c = canvas(w, h);
  const g = c.getContext('2d', { willReadFrequently: true });
  const P = (x, y, ww = 1, hh = 1, col = 'K') => {
    g.fillStyle = PAL[col] || col;
    g.fillRect(x, y, ww, hh);
  };
  draw(P, g);
  return outline ? addOutline(c) : c;
}

function addOutline(src) {
  const w = src.width;
  const h = src.height;
  const o = canvas(w + 2, h + 2);
  const og = o.getContext('2d');
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  og.fillStyle = PAL.K;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 10) continue;
      og.fillRect(x, y, 3, 3);
    }
  og.drawImage(src, 1, 1);
  return o;
}

const flashCache = new WeakMap();
export function flash(img, color = '#fff') {
  let byCol = flashCache.get(img);
  if (!byCol) flashCache.set(img, (byCol = {}));
  if (byCol[color]) return byCol[color];
  const c = canvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  byCol[color] = c;
  return c;
}

// ---------------------------------------------------------------- PLAYERS
// PLUMBER: red cap, mustache, blue overalls, ammo belt. 14x16 → 16x18 with outline.
function plumber(pose, f = 0) {
  return sprite(14, 16, (P) => {
    let legA = 0;
    let legB = 0;
    let armF = 0;
    let bob = 0;
    if (pose === 'run') {
      legA = [0, 2, 0, -2][f];
      legB = -legA;
      armF = [1, 0, -1, 0][f];
      bob = f % 2;
    }
    const y0 = bob;
    // cap
    P(3, 0 + y0, 6, 1, 'R');
    P(2, 1 + y0, 8, 1, 'R');
    P(2, 2 + y0, 5, 1, 'R');
    P(7, 2 + y0, 6, 1, 'r');
    P(5, 1 + y0, 2, 1, 'W');
    // hair + face
    P(2, 3 + y0, 2, 3, 'b');
    P(4, 3 + y0, 7, 4, 'S');
    P(11, 4 + y0, 2, 2, 'S');
    P(8, 3 + y0, 1, 2, 'K');
    P(8, 5 + y0, 4, 1, 'b');
    P(4, 4 + y0, 1, 1, 'B');
    if (pose === 'down') {
      P(8, 3 + y0, 1, 2, 'S');
      P(7, 4 + y0, 3, 1, 'K');
    }
    // shirt + overalls
    P(3, 7 + y0, 8, 2, 'R');
    P(4, 8, 6, 5, 'U');
    P(5, 7 + y0, 1, 1, 'U');
    P(8, 7 + y0, 1, 1, 'U');
    P(5, 8, 1, 1, 'Y');
    P(8, 8, 1, 1, 'Y');
    P(3, 11, 8, 1, 'y'); // ammo belt
    P(4, 11, 1, 1, 'Y');
    P(6, 11, 1, 1, 'Y');
    P(8, 11, 1, 1, 'Y');
    // arms
    if (pose === 'jump' || pose === 'cling') {
      P(10, 2, 2, 5, 'R');
      P(10, 0, 3, 2, 'W');
      P(2, 8, 2, 2, 'R');
      P(1, 9, 2, 2, 'W');
    } else if (pose === 'carried') {
      P(1, 5, 2, 4, 'R');
      P(11, 5, 2, 4, 'R');
      P(0, 3, 3, 2, 'W');
      P(11, 3, 3, 2, 'W');
    } else {
      P(2, 8 + armF, 2, 2, 'R');
      P(1, 10 + armF, 2, 2, 'W');
      P(10, 8 - armF, 2, 2, 'R');
      P(11, 10 - armF, 2, 2, 'W');
    }
    // legs
    if (pose === 'jump') {
      P(3, 13, 3, 2, 'U');
      P(9, 12, 3, 2, 'U');
      P(1, 14, 4, 2, 'b');
      P(10, 13, 4, 2, 'b');
    } else if (pose === 'pound') {
      P(4, 12, 6, 2, 'U');
      P(3, 14, 3, 2, 'b');
      P(8, 14, 3, 2, 'b');
    } else {
      P(4 + legA, 13, 3, 2, 'U');
      P(7 + legB, 13, 3, 2, 'U');
      P(3 + legA, 15, 4, 1, 'b');
      P(7 + legB, 15, 4, 1, 'b');
    }
  });
}

function plumberCrouch() {
  return sprite(14, 11, (P) => {
    P(3, 0, 6, 1, 'R');
    P(2, 1, 8, 1, 'R');
    P(7, 2, 6, 1, 'r');
    P(2, 2, 5, 1, 'R');
    P(4, 3, 7, 3, 'S');
    P(2, 3, 2, 2, 'b');
    P(8, 3, 1, 1, 'K');
    P(8, 5, 4, 1, 'b');
    P(3, 6, 8, 3, 'U');
    P(2, 6, 2, 2, 'R');
    P(10, 6, 2, 2, 'R');
    P(2, 9, 4, 2, 'b');
    P(8, 9, 4, 2, 'b');
  });
}

// GUNNER: green helmet, red scarf, vest with pouches, jetpack on the back. 16x21.
function gunner(pose, f = 0) {
  return sprite(16, 21, (P) => {
    let legA = 0;
    let legB = 0;
    let bob = 0;
    if (pose === 'run') {
      legA = [0, 2, 0, -2][f];
      legB = -legA;
      bob = f % 2;
    }
    const y = bob;
    // jetpack
    P(0, 7 + y, 3, 8, 'M');
    P(1, 7 + y, 1, 8, 'm');
    P(0, 15 + y, 3, 1, 'y');
    // helmet
    P(4, 0 + y, 8, 1, 'G');
    P(3, 1 + y, 10, 3, 'G');
    P(3, 3 + y, 10, 1, 'g');
    P(5, 1 + y, 2, 1, 'L');
    P(12, 3 + y, 2, 1, 'g');
    // face
    P(4, 4 + y, 8, 4, 'S');
    P(9, 5 + y, 1, 1, 'K');
    P(11, 5 + y, 1, 1, 'K');
    P(9, 7 + y, 3, 1, 'B');
    if (pose === 'down') {
      P(9, 5 + y, 3, 1, 'K');
    }
    // scarf
    P(3, 8 + y, 10, 2, 'R');
    P(2, 9 + y, 2, 3, 'R');
    // vest
    P(3, 10, 10, 5, 'G');
    P(4, 11, 2, 2, 'g');
    P(9, 11, 2, 2, 'g');
    P(3, 14, 10, 1, 'b');
    P(7, 14, 2, 1, 'Y');
    // legs
    if (pose === 'jump') {
      P(4, 15, 3, 3, 'g');
      P(9, 15, 3, 2, 'g');
      P(3, 18, 4, 2, 'b');
      P(10, 17, 4, 2, 'b');
    } else {
      P(4 + legA, 15, 3, 4, 'g');
      P(9 + legB, 15, 3, 4, 'g');
      P(3 + legA, 19, 5, 2, 'b');
      P(9 + legB, 19, 5, 2, 'b');
    }
    if (pose === 'carry') {
      P(3, 0, 2, 2, 'S');
      P(11, 0, 2, 2, 'S');
    }
  });
}

function gunnerCrouch() {
  return sprite(16, 15, (P) => {
    P(0, 5, 3, 6, 'M');
    P(1, 5, 1, 6, 'm');
    P(4, 0, 8, 1, 'G');
    P(3, 1, 10, 3, 'G');
    P(3, 3, 10, 1, 'g');
    P(5, 1, 2, 1, 'L');
    P(4, 4, 8, 3, 'S');
    P(9, 5, 1, 1, 'K');
    P(11, 5, 1, 1, 'K');
    P(3, 7, 10, 2, 'R');
    P(3, 9, 10, 3, 'G');
    P(3, 12, 10, 1, 'b');
    P(2, 13, 6, 2, 'b');
    P(9, 13, 6, 2, 'b');
  });
}

// Weapon held by the gunner, pointing right. The pivot is the hand at (2, h/2).
function weapon(kind) {
  switch (kind) {
    case 'hmg':
      return sprite(14, 6, (P) => {
        P(0, 2, 3, 3, 'S');
        P(2, 1, 9, 3, 'm');
        P(4, 0, 4, 1, 'M');
        P(11, 2, 3, 1, 'M');
        P(5, 4, 2, 2, 'y');
      });
    case 'shotgun':
      return sprite(14, 5, (P) => {
        P(0, 1, 3, 3, 'S');
        P(2, 2, 3, 3, 'b');
        P(4, 1, 10, 2, 'm');
        P(6, 3, 4, 1, 'B');
      });
    case 'rocket':
      return sprite(15, 6, (P) => {
        P(0, 2, 3, 3, 'S');
        P(2, 0, 12, 4, 'G');
        P(2, 0, 12, 1, 'L');
        P(13, 0, 2, 4, 'm');
        P(5, 4, 2, 2, 'm');
      });
    case 'flame':
      return sprite(13, 6, (P) => {
        P(0, 2, 3, 3, 'S');
        P(2, 1, 6, 4, 'R');
        P(3, 1, 4, 1, 'O');
        P(8, 2, 5, 2, 'm');
        P(12, 1, 1, 4, 'M');
      });
    default:
      return sprite(10, 5, (P) => {
        P(0, 1, 3, 3, 'S');
        P(2, 0, 7, 2, 'm');
        P(8, 0, 2, 1, 'M');
        P(3, 2, 2, 3, 'b');
      });
  }
}

// ---------------------------------------------------------------- ENEMIES
function goomba(f, dead = false) {
  return sprite(16, 15, (P) => {
    if (dead) {
      P(1, 9, 14, 4, 'B');
      P(2, 12, 12, 1, 'b');
      P(3, 7, 10, 2, 'G');
      P(5, 10, 2, 1, 'K');
      P(9, 10, 2, 1, 'K');
      return;
    }
    // helmet
    P(4, 0, 8, 1, 'G');
    P(3, 1, 10, 3, 'G');
    P(2, 3, 12, 1, 'g');
    P(6, 1, 2, 1, 'L');
    // mushroom head
    P(1, 4, 14, 5, 'B');
    P(0, 6, 16, 3, 'B');
    P(4, 5, 3, 3, 'W');
    P(9, 5, 3, 3, 'W');
    P(5, 6, 2, 2, 'K');
    P(9, 6, 2, 2, 'K');
    P(3, 4, 4, 1, 'K');
    P(9, 4, 4, 1, 'K');
    P(5, 9, 6, 1, 'b');
    // body
    P(4, 10, 8, 2, 'S');
    // rifle
    P(9, 10, 7, 2, 'm');
    P(8, 11, 2, 2, 'b');
    // feet
    const a = f % 2 === 0 ? 0 : 1;
    P(2 + a, 12, 5, 3, 'b');
    P(9 - a, 12, 5, 3, 'b');
  });
}

function trooper(f) {
  return sprite(16, 22, (P) => {
    const a = f % 2;
    // shell
    P(1, 8, 9, 10, 'G');
    P(2, 9, 7, 8, 'g');
    P(3, 10, 2, 2, 'L');
    P(6, 13, 2, 2, 'L');
    P(1, 17, 9, 1, 'W');
    // head
    P(7, 1, 7, 7, 'L');
    P(10, 2, 2, 3, 'W');
    P(11, 3, 1, 2, 'K');
    P(13, 5, 2, 2, 'L');
    P(6, 0, 7, 2, 'r'); // beret
    P(11, 0, 2, 1, 'R');
    // belly + rifle
    P(9, 8, 4, 9, 'Y');
    P(9, 11, 7, 2, 'm');
    P(14, 10, 2, 1, 'm');
    // legs
    P(3 + a, 18, 4, 4, 'L');
    P(8 - a, 18, 4, 4, 'L');
    P(2 + a, 20, 5, 2, 'b');
    P(8 - a, 20, 5, 2, 'b');
  });
}

function shell(f = 0) {
  return sprite(16, 12, (P) => {
    P(1, 2, 14, 8, 'G');
    P(3, 0, 10, 2, 'G');
    P(3, 3, 10, 5, 'g');
    P(1, 9, 14, 2, 'W');
    const s = f % 2 ? 2 : 0;
    P(4 + s, 4, 3, 2, 'L');
    P(9 - s, 4, 3, 2, 'L');
  });
}

function parakoopa(f) {
  return sprite(20, 20, (P) => {
    // wings / jet
    const w = f % 2 ? 2 : 0;
    P(0, 3 - w, 6, 3, 'W');
    P(1, 6 - w, 4, 2, 'W');
    P(5, 8, 3, 7, 'M');
    P(5, 15, 3, 2, 'O');
    // shell
    P(6, 7, 9, 9, 'R');
    P(7, 8, 7, 7, 'r');
    P(8, 9, 2, 2, 'W');
    P(6, 15, 9, 1, 'W');
    // head
    P(11, 1, 7, 6, 'L');
    P(14, 2, 2, 3, 'W');
    P(15, 3, 1, 2, 'K');
    P(17, 4, 2, 2, 'L');
    P(10, 0, 6, 1, 'G');
    // machine gun
    P(12, 11, 8, 3, 'm');
    P(18, 10, 2, 1, 'M');
    P(14, 14, 2, 2, 'y');
    P(9, 16, 3, 3, 'L');
    P(13, 16, 3, 3, 'L');
  });
}

function minitank(f) {
  return sprite(30, 21, (P) => {
    // cannon
    P(18, 6, 12, 3, 'm');
    P(27, 5, 3, 5, 'M');
    // bowser shell turret
    P(6, 1, 14, 9, 'G');
    P(5, 4, 16, 6, 'G');
    P(8, 0, 2, 2, 'W');
    P(12, 0, 2, 2, 'W');
    P(16, 0, 2, 2, 'W');
    P(7, 3, 12, 1, 'L');
    P(11, 5, 4, 3, 'R'); // red star patch
    P(12, 4, 2, 1, 'R');
    // hull
    P(1, 10, 28, 5, 'g');
    P(1, 10, 28, 1, 'G');
    P(3, 12, 2, 1, 'Y');
    P(24, 12, 2, 1, 'Y');
    // tracks
    P(0, 15, 30, 6, 'm');
    for (let i = 0; i < 6; i++) P(2 + i * 5 + (f % 2) * 2, 16, 3, 4, 'M');
    P(0, 20, 30, 1, 'K');
  });
}

function bunker() {
  return sprite(16, 30, (P) => {
    P(1, 0, 14, 4, 'm');
    P(0, 2, 16, 14, 'K');
    P(2, 4, 12, 10, 'm');
    P(4, 6, 8, 6, 'K');
    P(6, 7, 4, 3, 'W'); // skull
    P(6, 8, 1, 1, 'K');
    P(9, 8, 1, 1, 'K');
    P(1, 16, 14, 2, 'M');
    P(2, 18, 12, 12, 'm');
    P(4, 20, 8, 8, 'K');
    P(0, 24, 16, 6, 'B');
    P(0, 24, 16, 1, 'y');
    P(5, 27, 6, 1, 'b');
  });
}

function bill() {
  return sprite(16, 14, (P) => {
    P(3, 0, 13, 14, 'K');
    P(1, 2, 3, 10, 'K');
    P(0, 4, 1, 6, 'K');
    P(3, 1, 13, 2, 'm');
    P(11, 3, 3, 4, 'W');
    P(12, 4, 1, 2, 'K');
    P(9, 9, 4, 3, 'M');
    P(14, 0, 2, 14, 'm');
  });
}

function shyguy(f) {
  return sprite(14, 17, (P) => {
    const a = f % 2;
    P(3, 0, 8, 2, 'G'); // helmet
    P(2, 2, 10, 1, 'g');
    P(2, 3, 10, 8, 'R');
    P(4, 3, 7, 6, 'W'); // mask
    P(6, 4, 1, 2, 'K');
    P(9, 4, 1, 2, 'K');
    P(7, 7, 2, 1, 'K');
    P(1, 10, 12, 4, 'R');
    P(1, 12, 12, 1, 'b');
    P(10, 7 - a * 2, 3, 3, 'G'); // grenade in hand
    P(11, 6 - a * 2, 1, 1, 'M');
    P(2, 14, 4, 3, 'U');
    P(8, 14, 4, 3, 'U');
  });
}

function pow(freed, f = 0) {
  return sprite(14, 18, (P) => {
    // bald head + big beard
    P(4, 0, 7, 5, 'S');
    P(3, 2, 9, 3, 'S');
    P(7, 2, 1, 1, 'K');
    P(10, 2, 1, 1, 'K');
    P(3, 4, 10, 4, 'W');
    P(4, 8, 8, 2, 'W');
    // tank top + pants
    P(4, 8, 7, 5, 'W');
    P(3, 10, 2, 3, 'S');
    P(10, 10, 2, 3, 'S');
    P(4, 13, 7, 3, 'B');
    P(3, 16, 4, 2, 'b');
    P(8, 16, 4, 2, 'b');
    if (!freed) {
      P(2, 10, 11, 1, 'y');
      P(2, 12, 11, 1, 'y');
      P(2, 14, 11, 1, 'y');
    } else {
      P(11, f % 2 ? 1 : 3, 3, 2, 'S'); // salute
      P(11, 3, 2, 6, 'S');
    }
  });
}

// ---------------------------------------------------------------- BOSSES
function piranhaTank(f, open) {
  return sprite(76, 60, (P) => {
    // stem + head (drawn first, the turret hides its base)
    if (open > 0) {
      const hy = 18 - Math.round(open * 18);
      P(34, hy + 18, 6, 20, 'G');
      P(26, hy + 26, 8, 4, 'L');
      P(40, hy + 22, 8, 4, 'L');
      P(22, hy, 30, 22, 'R');
      P(20, hy + 4, 34, 14, 'R');
      P(25, hy + 2, 4, 4, 'W');
      P(42, hy + 3, 5, 5, 'W');
      P(31, hy + 12, 4, 3, 'W');
      P(46, hy + 14, 4, 3, 'W');
      // mouth
      P(38, hy + 8, 16, 8, 'K');
      for (let i = 0; i < 4; i++) P(39 + i * 4, hy + 8, 2, 2, 'W');
      for (let i = 0; i < 4; i++) P(40 + i * 4, hy + 14, 2, 2, 'W');
      P(24, hy - 2, 26, 3, 'G'); // tiny helmet
    }
    // turret
    P(14, 30, 46, 12, 'G');
    P(18, 28, 38, 3, 'L');
    P(14, 30, 46, 2, 'g');
    P(56, 33, 20, 5, 'm');
    P(72, 31, 4, 9, 'M');
    P(30, 34, 10, 6, 'R');
    P(32, 33, 6, 1, 'R');
    // hull
    P(2, 42, 72, 8, 'g');
    P(2, 42, 72, 2, 'G');
    for (let i = 0; i < 6; i++) P(6 + i * 12, 45, 3, 2, 'Y');
    // tracks
    P(0, 50, 76, 10, 'm');
    for (let i = 0; i < 12; i++) P(2 + i * 6 + (f % 2) * 3, 51, 3, 8, 'M');
    P(0, 59, 76, 1, 'K');
  });
}

function gunship(f, hurt) {
  return sprite(86, 46, (P) => {
    // rotors
    const r = f % 2 ? 14 : 4;
    P(6, 0, 26 - r, 2, 'M');
    P(54 + r, 0, 26 - r, 2, 'M');
    P(18, 2, 2, 6, 'm');
    P(66, 2, 2, 6, 'm');
    // cloud hull
    P(8, 8, 70, 20, 'W');
    P(2, 14, 82, 12, 'W');
    P(14, 4, 20, 8, 'W');
    P(50, 4, 22, 8, 'W');
    P(4, 24, 78, 3, 'M');
    // armour belt
    P(6, 26, 74, 8, 'm');
    P(6, 26, 74, 2, 'M');
    for (let i = 0; i < 7; i++) P(10 + i * 10, 29, 2, 2, 'Y');
    // cockpit lakitu
    P(34, 0, 18, 12, 'U');
    P(36, 2, 14, 8, 'U');
    P(37, 3, 12, 8, 'Y');
    P(39, 5, 3, 3, 'K');
    P(45, 5, 3, 3, 'K');
    P(36, 4, 14, 2, 'u'); // goggles band
    // guns
    P(12, 34, 6, 10, 'm');
    P(68, 34, 6, 10, 'm');
    P(13, 42, 4, 4, 'K');
    P(69, 42, 4, 4, 'K');
    P(38, 34, 10, 8, 'R');
    P(40, 36, 6, 4, hurt ? 'W' : 'O');
  });
}

function bowser(f, phase, mouth) {
  return sprite(124, 104, (P) => {
    // ---- Bowser torso rising from the tank
    // shell back
    P(28, 10, 40, 40, 'G');
    P(32, 6, 32, 6, 'G');
    for (let i = 0; i < 5; i++) {
      P(30 + i * 8, 2, 4, 6, 'W');
      P(31 + i * 8, 0, 2, 2, 'W');
    }
    P(28, 46, 40, 4, 'W');
    // body
    P(48, 18, 34, 34, 'Y');
    P(54, 24, 22, 24, 'Y');
    for (let i = 0; i < 4; i++) P(56, 26 + i * 6, 18, 1, 'y');
    // head
    P(62, 2, 34, 26, 'Y');
    P(66, 0, 26, 4, 'Y');
    P(84, 12, 18, 14, 'Y'); // snout
    P(58, 0, 10, 8, 'R'); // hair
    P(54, 4, 8, 12, 'R');
    P(64, -2, 4, 6, 'W'); // horns
    P(80, -2, 4, 6, 'W');
    P(80, 6, 6, 5, 'W'); // eye
    P(83, 7, 2, 3, phase >= 2 ? 'R' : 'K');
    P(76, 4, 12, 2, 'r'); // brow
    P(96, 14, 3, 3, 'K'); // nostril
    // jaw
    const mj = Math.round(mouth * 8);
    P(84, 22, 18, 3 + mj, 'K');
    P(86, 22, 2, 3, 'W');
    P(92, 22, 2, 3, 'W');
    P(98, 22, 2, 3, 'W');
    P(82, 25 + mj, 20, 6, 'Y');
    // spiked cuff arms → cannons
    P(70, 38, 18, 10, 'm');
    P(86, 36, 30, 8, 'm');
    P(112, 34, 6, 12, 'M');
    P(74, 36, 4, 3, 'W');
    P(80, 36, 4, 3, 'W');
    P(26, 34, 16, 10, 'm');
    P(4, 32, 26, 8, 'm');
    P(0, 30, 6, 12, 'M');
    // ---- tank hull
    P(6, 52, 112, 22, 'g');
    P(6, 52, 112, 3, 'G');
    P(12, 58, 100, 12, 'm');
    P(52, 58, 16, 12, 'R');
    P(56, 56, 8, 2, 'R');
    for (let i = 0; i < 9; i++) P(14 + i * 12, 60, 3, 3, 'Y');
    P(0, 72, 124, 6, 'B');
    P(0, 72, 124, 1, 'O'); // lava glow seam
    // treads
    P(0, 78, 124, 24, 'm');
    for (let i = 0; i < 15; i++) P(3 + i * 8 + (f % 2) * 4, 80, 4, 20, 'M');
    for (let i = 0; i < 6; i++) {
      P(8 + i * 20, 84, 12, 12, 'K');
      P(11 + i * 20, 87, 6, 6, 'm');
    }
  });
}

// ---------------------------------------------------------------- VEHICLE SV-001
function tank(f, barrelLen) {
  const w = 52 + Math.max(0, barrelLen - 18);
  return sprite(w, 34, (P) => {
    // barrel
    P(34, 9, barrelLen, 4, 'm');
    P(34, 9, barrelLen, 1, 'M');
    P(34 + barrelLen - 3, 8, 3, 6, 'M');
    // turret
    P(12, 2, 26, 13, 'G');
    P(14, 0, 18, 3, 'G');
    P(12, 2, 26, 2, 'L');
    P(20, 6, 6, 6, 'R'); // red star
    P(22, 4, 2, 2, 'R');
    P(18, 8, 2, 2, 'R');
    P(26, 8, 2, 2, 'R');
    P(6, 4, 8, 2, 'm'); // vulcan
    P(2, 4, 5, 1, 'M');
    // hull
    P(2, 15, 48, 8, 'G');
    P(0, 17, 52, 4, 'g');
    P(2, 15, 48, 1, 'L');
    P(8, 18, 6, 2, 'Y');
    P(40, 18, 6, 2, 'Y');
    // tracks
    P(2, 23, 48, 11, 'm');
    for (let i = 0; i < 8; i++) P(3 + i * 6 + (f % 2) * 3, 24, 3, 9, 'M');
    for (let i = 0; i < 5; i++) P(5 + i * 10, 26, 6, 6, 'K');
    P(2, 33, 48, 1, 'K');
  });
}

// ---------------------------------------------------------------- PICKUPS & UI
function crate(letter, col) {
  return sprite(14, 14, (P, g) => {
    P(0, 0, 14, 14, 'B');
    P(1, 1, 12, 12, 'y');
    P(2, 2, 10, 10, col);
    g.fillStyle = PAL.W;
    const L = LETTERS[letter];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) if (L[y][x] === '1') g.fillRect(5 + x, 4 + y + 0.5 - 0.5, 1, 1);
  });
}
const LETTERS = {
  H: ['1001', '1001', '1111', '1001', '1001'],
  S: ['0111', '1000', '0110', '0001', '1110'],
  R: ['1110', '1001', '1110', '1010', '1001'],
  F: ['1111', '1000', '1110', '1000', '1000'],
  G: ['0111', '1000', '1011', '1001', '0111'],
};

function coin(f) {
  const widths = [8, 6, 2, 6];
  const w = widths[f];
  return sprite(8, 12, (P) => {
    const x = (8 - w) / 2;
    P(x, 0, w, 12, 'Y');
    if (w > 2) P(x + 1, 1, w - 2, 10, 'O');
    if (w > 4) P(x + 2, 2, w - 4, 8, 'Y');
    P(x, 0, 1, 12, 'W');
  });
}

function mushroom() {
  return sprite(14, 14, (P) => {
    P(2, 0, 10, 2, 'R');
    P(0, 2, 14, 6, 'R');
    P(4, 1, 4, 3, 'W');
    P(1, 4, 3, 3, 'W');
    P(10, 4, 3, 3, 'W');
    P(3, 8, 8, 6, 'S');
    P(5, 9, 1, 2, 'K');
    P(8, 9, 1, 2, 'K');
    P(1, 7, 12, 1, 'G'); // camo band
  });
}

function grenadeIcon() {
  return sprite(8, 10, (P) => {
    P(1, 2, 6, 8, 'G');
    P(2, 3, 2, 2, 'L');
    P(2, 0, 4, 2, 'm');
    P(5, 0, 3, 1, 'M');
  });
}

function heart(full) {
  return sprite(9, 8, (P) => {
    const c = full ? 'R' : 'm';
    P(1, 0, 3, 1, c);
    P(5, 0, 3, 1, c);
    P(0, 1, 9, 3, c);
    P(1, 4, 7, 1, c);
    P(2, 5, 5, 1, c);
    P(3, 6, 3, 1, c);
    P(4, 7, 1, 1, c);
    if (full) P(1, 1, 2, 1, 'W');
  });
}

function powIcon() {
  return sprite(10, 10, (P) => {
    P(2, 0, 6, 4, 'S');
    P(1, 3, 8, 4, 'W');
    P(3, 7, 4, 3, 'W');
    P(3, 1, 1, 1, 'K');
    P(6, 1, 1, 1, 'K');
  });
}

function starIcon() {
  return sprite(11, 11, (P) => {
    P(5, 0, 1, 3, 'Y');
    P(4, 2, 3, 2, 'Y');
    P(0, 4, 11, 2, 'Y');
    P(2, 6, 7, 2, 'Y');
    P(1, 8, 3, 2, 'Y');
    P(7, 8, 3, 2, 'Y');
    P(4, 5, 1, 2, 'K');
    P(6, 5, 1, 2, 'K');
  });
}

function bubble() {
  return sprite(26, 26, (P, g) => {
    g.fillStyle = 'rgba(160,220,255,0.45)';
    g.beginPath();
    g.arc(13, 13, 12.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = PAL.W;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(13, 13, 12, 0, Math.PI * 2);
    g.stroke();
    P(6, 5, 3, 2, 'W');
    P(5, 7, 2, 2, 'W');
  }, false);
}

// ---------------------------------------------------------------- PROPS
function pipeTop(col) {
  return sprite(32, 14, (P) => {
    P(0, 0, 32, 14, col[0]);
    P(2, 1, 4, 12, col[1]);
    P(8, 1, 2, 12, col[1]);
    P(26, 1, 4, 12, col[2]);
    P(0, 0, 32, 1, col[1]);
  });
}
function pipeBody(col) {
  return sprite(28, 16, (P) => {
    P(0, 0, 28, 16, col[0]);
    P(2, 0, 4, 16, col[1]);
    P(7, 0, 2, 16, col[1]);
    P(22, 0, 4, 16, col[2]);
  }, false);
}

function lever(on) {
  return sprite(14, 16, (P) => {
    P(1, 11, 12, 5, 'm');
    P(2, 12, 10, 3, 'M');
    if (on) {
      P(8, 2, 2, 10, 'M');
      P(8, 0, 4, 4, 'L');
    } else {
      P(4, 2, 2, 10, 'M');
      P(2, 0, 4, 4, 'R');
    }
  });
}

function valve(a) {
  return sprite(16, 16, (P, g) => {
    P(6, 8, 4, 8, 'm');
    g.save();
    g.translate(8, 7);
    g.rotate(a);
    g.fillStyle = PAL.R;
    g.fillRect(-7, -1, 14, 3);
    g.fillRect(-1, -7, 3, 14);
    g.fillStyle = PAL.Y;
    g.fillRect(-2, -2, 5, 5);
    g.restore();
  });
}

function target(hit) {
  return sprite(14, 14, (P) => {
    P(2, 0, 10, 14, hit ? 'L' : 'W');
    P(0, 2, 14, 10, hit ? 'L' : 'W');
    P(3, 3, 8, 8, hit ? 'G' : 'R');
    P(5, 5, 4, 4, hit ? 'L' : 'W');
    P(6, 6, 2, 2, hit ? 'G' : 'R');
  });
}

function plate(down) {
  return sprite(16, 5, (P) => {
    P(0, 3, 16, 2, 'm');
    P(2, down ? 2 : 0, 12, down ? 1 : 3, 'Y');
  });
}

function flag(on) {
  return sprite(14, 32, (P) => {
    P(1, 0, 2, 32, 'M');
    P(0, 30, 6, 2, 'm');
    P(3, 1, 10, 7, on ? 'R' : 'm');
    if (on) {
      P(6, 3, 4, 3, 'W');
      P(7, 2, 2, 1, 'W');
    }
  });
}

function sign() {
  return sprite(16, 16, (P) => {
    P(7, 8, 2, 8, 'b');
    P(0, 0, 16, 10, 'B');
    P(1, 1, 14, 8, 'y');
    P(3, 3, 10, 1, 'b');
    P(3, 5, 8, 1, 'b');
  });
}

// ---------------------------------------------------------------- TILES
// Each zone tints its ground differently.
const ZONE_GROUND = [
  { top: ['L', 'G'], dirt: ['B', 'b'] },
  { top: ['M', 'm'], dirt: ['m', 'K'] },
  { top: ['W', 'M'], dirt: ['M', 'm'] },
];

function groundTile(z, top) {
  const zg = ZONE_GROUND[z];
  return sprite(16, 16, (P) => {
    if (z === 1) {
      P(0, 0, 16, 16, '#4c4c5c');
      P(0, 0, 16, 1, '#6c6c7c');
      P(0, 15, 16, 1, PAL.K);
      P(15, 0, 1, 16, PAL.K);
      P(2, 2, 1, 1, PAL.M);
      P(13, 2, 1, 1, PAL.M);
      P(2, 13, 1, 1, PAL.M);
      P(13, 13, 1, 1, PAL.M);
      if (top) {
        P(0, 0, 16, 3, PAL.Y);
        for (let i = 0; i < 4; i++) P(i * 4, 0, 2, 3, PAL.K);
      }
      return;
    }
    if (z === 2) {
      P(0, 0, 16, 16, '#8c8cb0');
      P(1, 1, 14, 14, '#a8a8c8');
      P(0, 15, 16, 1, '#5c5c80');
      P(4, 4, 3, 2, '#c8c8e0');
      P(9, 9, 4, 2, '#c8c8e0');
      if (top) {
        P(0, 0, 16, 4, PAL.W);
        P(0, 4, 16, 1, '#d8e8f8');
        P(2, 4, 4, 2, PAL.W);
        P(10, 4, 4, 2, PAL.W);
      }
      return;
    }
    P(0, 0, 16, 16, zg.dirt[0]);
    for (let i = 0; i < 6; i++) P((i * 7 + 3) % 15, (i * 5 + 4) % 15, 2, 2, zg.dirt[1]);
    if (top) {
      P(0, 0, 16, 4, zg.top[0]);
      P(0, 4, 16, 1, zg.top[1]);
      P(1, 5, 2, 1, zg.top[1]);
      P(7, 5, 3, 1, zg.top[1]);
      P(13, 5, 2, 1, zg.top[1]);
    }
  }, false);
}

function brickTile() {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, 'B');
    P(0, 0, 16, 1, 'O');
    P(0, 7, 16, 1, 'b');
    P(0, 15, 16, 1, 'b');
    P(7, 0, 1, 7, 'b');
    P(3, 8, 1, 7, 'b');
    P(11, 8, 1, 7, 'b');
  }, false);
}

function qTile(f, used) {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, 'K');
    P(1, 1, 14, 14, used ? 'b' : f % 2 ? 'O' : 'Y');
    if (!used) {
      P(2, 2, 1, 1, 'B');
      P(13, 2, 1, 1, 'B');
      P(2, 13, 1, 1, 'B');
      P(13, 13, 1, 1, 'B');
      P(6, 3, 4, 1, 'b');
      P(5, 4, 2, 2, 'b');
      P(9, 4, 2, 3, 'b');
      P(7, 7, 2, 2, 'b');
      P(7, 11, 2, 2, 'b');
    } else {
      P(2, 2, 1, 1, 'K');
      P(13, 2, 1, 1, 'K');
      P(2, 13, 1, 1, 'K');
      P(13, 13, 1, 1, 'K');
    }
  }, false);
}

function steelTile(dmg) {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, 'm');
    P(1, 1, 14, 14, 'M');
    P(1, 1, 14, 1, 'W');
    P(2, 2, 2, 2, 'm');
    P(12, 2, 2, 2, 'm');
    P(2, 12, 2, 2, 'm');
    P(12, 12, 2, 2, 'm');
    P(4, 7, 8, 2, 'm');
    if (dmg > 0) {
      P(6, 2, 1, 5, 'K');
      P(7, 6, 2, 1, 'K');
    }
    if (dmg > 1) {
      P(9, 9, 1, 5, 'K');
      P(4, 10, 5, 1, 'K');
      P(3, 4, 2, 1, 'K');
    }
  }, false);
}

function sandbagTile(dmg) {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, 'b');
    P(0, 1, 8, 7, 'B');
    P(8, 1, 8, 7, 'B');
    P(4, 9, 8, 6, 'B');
    P(0, 9, 3, 6, 'B');
    P(13, 9, 3, 6, 'B');
    P(1, 2, 5, 1, 'O');
    P(9, 2, 5, 1, 'O');
    P(5, 10, 5, 1, 'O');
    if (dmg > 0) {
      P(10, 4, 3, 2, 'y');
      P(6, 12, 2, 2, 'y');
    }
  }, false);
}

function wireTile() {
  return sprite(16, 16, (P) => {
    P(0, 10, 1, 6, 'b');
    P(15, 10, 1, 6, 'b');
    for (let i = 0; i < 16; i += 2) {
      P(i, 9 + ((i / 2) % 2) * 2, 2, 1, 'M');
      P(i, 13 - ((i / 2) % 2) * 2, 2, 1, 'M');
    }
    for (let i = 1; i < 16; i += 4) {
      P(i, 8, 1, 3, 'W');
      P(i + 2, 12, 1, 3, 'W');
    }
  }, false);
}

function fragileTile() {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, 'B');
    P(0, 0, 16, 1, 'O');
    P(3, 2, 1, 5, 'K');
    P(4, 6, 4, 1, 'K');
    P(8, 7, 1, 6, 'K');
    P(9, 12, 4, 1, 'K');
    P(12, 3, 1, 4, 'K');
    P(0, 15, 16, 1, 'b');
  }, false);
}

function girderTile(z) {
  return sprite(16, 16, (P) => {
    const c = z === 2 ? 'W' : 'R';
    const d = z === 2 ? 'M' : 'r';
    P(0, 0, 16, 5, c);
    P(0, 0, 16, 1, 'Y');
    P(0, 4, 16, 1, d);
    P(2, 1, 2, 2, d);
    P(12, 1, 2, 2, d);
  }, false);
}

function metalTile(z) {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, z === 0 ? '#4a3a2a' : '#3a3a4c');
    P(1, 1, 14, 14, z === 0 ? '#6a5236' : '#54546c');
    P(1, 1, 14, 1, z === 0 ? '#8a6c48' : '#74748c');
    P(3, 3, 1, 1, PAL.M);
    P(12, 3, 1, 1, PAL.M);
    P(3, 12, 1, 1, PAL.M);
    P(12, 12, 1, 1, PAL.M);
  }, false);
}

function spikeTile() {
  return sprite(16, 16, (P) => {
    P(0, 12, 16, 4, 'm');
    for (let i = 0; i < 4; i++) {
      P(i * 4 + 1, 6, 2, 6, 'M');
      P(i * 4 + 1, 3, 2, 3, 'W');
      P(i * 4, 9, 4, 3, 'M');
    }
  }, false);
}

function gateTile() {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, 'K');
    P(1, 0, 14, 16, 'Y');
    for (let i = -16; i < 16; i += 6) for (let y = 0; y < 16; y++) {
      const x = i + y;
      if (x >= 1 && x < 15) P(x, y, 3 > 15 - x ? 15 - x : 3, 1, 'K');
    }
    P(0, 0, 1, 16, 'm');
    P(15, 0, 1, 16, 'm');
  }, false);
}

function bridgeTile() {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 6, 'B');
    P(0, 0, 16, 1, 'O');
    P(0, 5, 16, 1, 'b');
    P(5, 0, 1, 6, 'b');
    P(11, 0, 1, 6, 'b');
    P(0, 6, 16, 2, 'm');
  }, false);
}

function lavaTile(f) {
  return sprite(16, 16, (P) => {
    P(0, 0, 16, 16, 'R');
    P(0, 0, 16, 3, 'O');
    P(f % 2 ? 2 : 8, 1, 5, 1, 'Y');
    P(f % 2 ? 10 : 1, 6, 3, 2, 'O');
  }, false);
}

// ---------------------------------------------------------------- FX
function explosion(size, f) {
  const c = canvas(size, size);
  const g = c.getContext('2d', { willReadFrequently: true });
  const r = size / 2;
  const t = f / 5;
  const blobs = 7;
  const draw = (rad, col) => {
    g.fillStyle = col;
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + f;
      const d = r * 0.35 * Math.min(1, t * 2);
      g.beginPath();
      g.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, rad, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(r, r, rad * 1.1, 0, Math.PI * 2);
    g.fill();
  };
  if (f < 4) {
    draw(r * (0.3 + t * 0.55), f < 2 ? PAL.O : '#4a3a3a');
    draw(r * (0.25 + t * 0.4), f < 1 ? PAL.W : f < 3 ? PAL.O : PAL.R);
    draw(r * (0.18 + t * 0.2), f < 2 ? PAL.Y : PAL.O);
  } else {
    draw(r * 0.6, '#3a3030');
    draw(r * 0.4, '#5a4a4a');
  }
  // quantise to pixels (crisp edges)
  const d = g.getImageData(0, 0, size, size);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 100 ? 255 : 0;
  g.putImageData(d, 0, 0);
  return addOutline(c);
}

function muzzle(f) {
  return sprite(12, 10, (P) => {
    P(0, 3, 6, 4, 'Y');
    P(4, f ? 1 : 2, 6, f ? 8 : 6, 'O');
    P(2, 4, 8, 2, 'W');
    P(10, 4, 2, 2, 'Y');
  });
}

// ---------------------------------------------------------------- BACKGROUNDS (parallax)
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function bgLayer(zone, layer) {
  const W = 640;
  const H = 270;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const R = rng(17 + zone * 31 + layer * 7);
  const px = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  if (layer === 0) {
    // sky bands (no smooth gradients: dithered 16-bit bands)
    const bands = [
      ['#f8a860', '#f88850', '#e86848', '#c84848', '#984060', '#683860'],
      ['#584870', '#685078', '#806080', '#987088', '#b08088', '#c89080'],
      ['#3870c8', '#4888d8', '#60a0e8', '#80b8f0', '#a0d0f8', '#c8e8f8'],
    ][zone];
    const order = zone === 2 ? bands : [...bands].reverse();
    const bh = H / order.length;
    order.forEach((col, i) => px(0, i * bh, W, bh + 1, col));
    for (let i = 0; i < order.length - 1; i++)
      for (let x = 0; x < W; x += 2) px(x + ((i % 2) ? 1 : 0), (i + 1) * bh - 1, 1, 1, order[i + 1]);
    if (zone === 0) {
      // smoke columns from the war
      for (let i = 0; i < 5; i++) {
        const x = R() * W;
        for (let y = H * 0.75; y > 20; y -= 6) {
          const rr = 6 + (H - y) * 0.06 + R() * 4;
          g.fillStyle = 'rgba(70,50,60,0.35)';
          g.beginPath();
          g.arc(x + Math.sin(y * 0.05) * 10, y, rr, 0, 7);
          g.fill();
        }
      }
      g.fillStyle = 'rgba(248,224,160,0.35)';
      g.beginPath();
      g.arc(374, 66, 26, 0, 7);
      g.fill();
      g.fillStyle = '#f8e0a0';
      g.beginPath();
      g.arc(374, 66, 16, 0, 7);
      g.fill(); // low sun
    }
    if (zone === 2) {
      for (let i = 0; i < 9; i++) {
        const x = R() * W;
        const y = 20 + R() * 120;
        cloud(g, x, y, 20 + R() * 30, '#f8f8f8', '#d8e8f8');
      }
    }
    return c;
  }
  if (zone === 0) {
    if (layer === 1) {
      // distant mushroom hills
      for (let i = 0; i < 9; i++) {
        const x = i * 80 + R() * 30;
        const h = 60 + R() * 50;
        hill(g, x, H - 40, 50 + R() * 30, h, '#88a058', '#6c8448');
      }
      return c;
    }
    // giant war-torn mushrooms + sandbag silhouettes
    for (let i = 0; i < 6; i++) {
      const x = i * 110 + R() * 40;
      const h = 70 + R() * 40;
      px(x + 14, H - h, 12, h, '#e8d0a8');
      px(x + 14, H - h, 3, h, '#c8b088');
      g.fillStyle = i % 2 ? '#c83828' : '#a03020';
      g.beginPath();
      g.ellipse(x + 20, H - h, 34, 20, 0, Math.PI, 0);
      g.fill();
      px(x - 14, H - h - 1, 68, 3, '#701818');
      g.fillStyle = '#f8f0e0';
      g.beginPath();
      g.arc(x + 8, H - h - 10, 5, 0, 7);
      g.arc(x + 30, H - h - 12, 6, 0, 7);
      g.fill();
    }
    for (let x = 0; x < W; x += 24) px(x, H - 14 - (x % 48 ? 0 : 4), 22, 14, '#5a4630');
    return c;
  }
  if (zone === 1) {
    if (layer === 1) {
      // factory silhouettes, chimneys
      for (let i = 0; i < 8; i++) {
        const x = i * 84 + R() * 20;
        const h = 90 + R() * 80;
        px(x, H - h, 60, h, '#3c3450');
        px(x + 8, H - h - 40, 10, 40, '#3c3450');
        for (let w = 0; w < 5; w++) px(x + 8 + (w % 3) * 16, H - h + 14 + Math.floor(w / 3) * 20, 8, 6, '#c89048');
      }
      return c;
    }
    // big green pipes running through
    for (let i = 0; i < 4; i++) {
      const y = 40 + i * 55 + R() * 20;
      px(0, y, W, 14, '#2c5c30');
      px(0, y + 2, W, 3, '#4c8c48');
      for (let x = (R() * 100) | 0; x < W; x += 120) {
        px(x, y - 3, 10, 20, '#2c5c30');
        px(x + 2, y - 3, 2, 20, '#4c8c48');
      }
    }
    return c;
  }
  // zone 2 sky fortress
  if (layer === 1) {
    for (let i = 0; i < 4; i++) airship(g, 40 + i * 160 + R() * 40, 60 + R() * 80, 0.6 + R() * 0.3, '#7080a8', '#5868a0');
    return c;
  }
  for (let i = 0; i < 7; i++) {
    const x = R() * W;
    const y = 140 + R() * 100;
    cloud(g, x, y, 30 + R() * 30, '#ffffff', '#c8dcf0');
    px(x - 4, y - 40 - R() * 30, 14, 60, '#3c8c40');
    px(x - 8, y - 70, 22, 10, '#3c8c40');
    px(x - 4, y - 70, 4, 70, '#70c060');
  }
  return c;
}

function hill(g, x, base, w, h, col, shade) {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x + w / 2, base, w / 2, h, 0, Math.PI, 0);
  g.fill();
  g.fillRect(x, base, w, 40);
  g.fillStyle = shade;
  g.fillRect(x + w * 0.3, base - h * 0.5, 3, 6);
  g.fillRect(x + w * 0.6, base - h * 0.5, 3, 6);
}

function cloud(g, x, y, r, col, shade) {
  g.fillStyle = shade;
  g.beginPath();
  g.arc(x, y + 3, r * 0.6, 0, 7);
  g.arc(x + r * 0.7, y + 3, r * 0.5, 0, 7);
  g.arc(x - r * 0.7, y + 3, r * 0.45, 0, 7);
  g.fill();
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, y, r * 0.6, 0, 7);
  g.arc(x + r * 0.7, y, r * 0.45, 0, 7);
  g.arc(x - r * 0.7, y, r * 0.4, 0, 7);
  g.fill();
}

function airship(g, x, y, s, col, shade) {
  g.fillStyle = shade;
  g.fillRect(x, y, 120 * s, 22 * s);
  g.fillStyle = col;
  g.fillRect(x + 10 * s, y - 8 * s, 90 * s, 10 * s);
  g.fillRect(x + 40 * s, y - 30 * s, 8 * s, 24 * s);
  g.fillRect(x + 70 * s, y - 24 * s, 8 * s, 18 * s);
  g.fillRect(x - 10 * s, y + 6 * s, 14 * s, 6 * s);
  g.fillStyle = '#a03030';
  g.fillRect(x + 44 * s, y - 30 * s, 16 * s, 8 * s);
}

// ---------------------------------------------------------------- BUILD EVERYTHING
export function buildArt() {
  const A = {};
  A.plumber = {
    idle: [plumber('idle')],
    run: [0, 1, 2, 3].map((f) => plumber('run', f)),
    jump: [plumber('jump')],
    cling: [plumber('cling')],
    pound: [plumber('pound')],
    crouch: [plumberCrouch()],
    carried: [plumber('carried')],
    down: [plumber('down')],
  };
  A.gunner = {
    idle: [gunner('idle')],
    run: [0, 1, 2, 3].map((f) => gunner('run', f)),
    jump: [gunner('jump')],
    crouch: [gunnerCrouch()],
    carry: [gunner('carry')],
    down: [gunner('down')],
  };
  A.weapons = {};
  for (const k of ['pistol', 'hmg', 'shotgun', 'rocket', 'flame']) A.weapons[k] = weapon(k);
  A.goomba = [0, 1].map((f) => goomba(f));
  A.goombaDead = goomba(0, true);
  A.trooper = [0, 1].map((f) => trooper(f));
  A.shell = [0, 1].map((f) => shell(f));
  A.parakoopa = [0, 1].map((f) => parakoopa(f));
  A.minitank = [0, 1].map((f) => minitank(f));
  A.bunker = bunker();
  A.bill = bill();
  A.shyguy = [0, 1].map((f) => shyguy(f));
  A.pow = [pow(false), pow(true, 0), pow(true, 1)];
  A.piranha = [];
  for (let o = 0; o <= 4; o++) A.piranha.push([0, 1].map((f) => piranhaTank(f, o / 4)));
  A.gunship = [0, 1].map((f) => gunship(f, false));
  A.gunshipHurt = gunship(0, true);
  A.bowser = [];
  for (const mouth of [0, 1]) A.bowser.push([0, 1].map((f) => [0, 1, 2].map((p) => bowser(f, p, mouth))));
  A.tank = [];
  for (const len of [18, 34, 50, 66, 82, 98]) A.tank.push([0, 1].map((f) => tank(f, len)));
  A.crates = {
    hmg: crate('H', 'R'),
    shotgun: crate('S', 'U'),
    rocket: crate('R', 'G'),
    flame: crate('F', 'O'),
    grenade: crate('G', 'g'),
  };
  A.coin = [0, 1, 2, 3].map((f) => coin(f));
  A.mushroom = mushroom();
  A.grenade = grenadeIcon();
  A.heart = [heart(false), heart(true)];
  A.powIcon = powIcon();
  A.star = starIcon();
  A.bubble = bubble();
  A.pipeColors = [
    ['#38a838', '#88e070', '#1c6c1c'],
    ['#c83828', '#f88870', '#701810'],
    ['#3868d8', '#88b8f8', '#1c3478'],
  ];
  A.pipeTop = A.pipeColors.map(pipeTop);
  A.pipeBody = A.pipeColors.map(pipeBody);
  A.lever = [lever(false), lever(true)];
  A.valve = [0, 1, 2, 3].map((i) => valve((i * Math.PI) / 8));
  A.target = [target(false), target(true)];
  A.plate = [plate(false), plate(true)];
  A.flag = [flag(false), flag(true)];
  A.sign = sign();
  A.tiles = [0, 1, 2].map((z) => ({
    ground: groundTile(z, false),
    groundTop: groundTile(z, true),
    metal: metalTile(z),
    girder: girderTile(z),
  }));
  A.brick = brickTile();
  A.q = [qTile(0), qTile(1)];
  A.used = qTile(0, true);
  A.steel = [steelTile(0), steelTile(1), steelTile(2)];
  A.sandbag = [sandbagTile(0), sandbagTile(1)];
  A.wire = wireTile();
  A.fragile = fragileTile();
  A.spike = spikeTile();
  A.gate = gateTile();
  A.bridge = bridgeTile();
  A.lava = [lavaTile(0), lavaTile(1)];
  A.boom = [0, 1, 2, 3, 4].map((f) => explosion(32, f));
  A.bigBoom = [0, 1, 2, 3, 4].map((f) => explosion(64, f));
  A.muzzle = [muzzle(0), muzzle(1)];
  A.bg = [0, 1, 2].map((z) => [0, 1, 2].map((l) => bgLayer(z, l)));
  return A;
}
