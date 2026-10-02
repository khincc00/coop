// Auto-rig istri (unrigged OBJ from "aset character/istri_mixamo.zip") onto kurir's Mixamo skeleton,
// so every clip in public/assets/anims plays on her too.
//
//   npm run rig:istri          → public/assets/istri.glb + public/assets/istri.jpg
//   npm run rig:istri -- --debug  also dumps tools/.scratch/{warp.json,paint_front.bmp,paint_mask.bmp}
//
// How it works:
//  0. The glasses fused into the head are cut out (removeGlasses) and painted out of the texture
//     (cleanPaintedGlasses).
//  1. ISTRI_JOINTS places each Mixamo joint inside the istri mesh (T-pose, measured from front/side renders).
//  2. Kurir's skinned mesh is warped onto istri's proportions using its own skin weights
//     (each bone moves from the kurir joint to the istri joint and scales by REGION_SCALE).
//  3. Every istri vertex copies the averaged skin weights of its nearest warped-kurir vertices.
//  4. A new skeleton with kurir's bone orientations and istri's joint positions is bound and exported.
import './node-shims.mjs';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = path.join(ROOT, 'aset character/istri_mixamo.zip');
const KURIR = path.join(ROOT, 'public/assets/kurir.fbx');
const OUT_GLB = path.join(ROOT, 'public/assets/istri.glb');
const OUT_TEX = path.join(ROOT, 'public/assets/istri.jpg');
const DEBUG = process.argv.includes('--debug');

// Left-side joints in metres (Y up, facing +Z, feet at y=0). Right side is mirrored.
const ISTRI_JOINTS = {
  Hips: [0, 0.68, 0.02],
  Spine: [0, 0.75, 0.02],
  Spine1: [0, 0.832, 0.015],
  Spine2: [0, 0.925, 0.005],
  Neck: [0, 1.03, 0],
  Head: [0, 1.08, 0.01],
  HeadTop_End: [0, 1.55, 0.05],
  LeftUpLeg: [0.075, 0.64, 0.01],
  LeftLeg: [0.08, 0.35, 0.01],
  LeftFoot: [0.08, 0.095, -0.005],
  LeftToeBase: [0.095, 0.012, 0.08],
  LeftToe_End: [0.105, 0.012, 0.14],
  LeftShoulder: [0.06, 1.0, -0.005],
  LeftArm: [0.2, 0.975, 0],
  LeftForeArm: [0.31, 0.965, -0.005],
  LeftHand: [0.45, 0.957, 0],
};
// Finger joints aren't listed: they keep kurir's layout relative to the hand, scaled to istri's longer hands.
const HAND_SCALE = (0.655 - 0.45) / (0.585 - 0.4291);

// Per-bone thickness scale (world X, Y, Z) used only to warp kurir's mesh for weight transfer;
// the axis along the bone is replaced by the bone-length ratio.
function regionScale(name) {
  if (/Hand/.test(name)) return [HAND_SCALE, HAND_SCALE, HAND_SCALE];
  if (/Arm/.test(name)) return [1, 1.15, 1.15];
  if (/UpLeg|Leg$|Foot|Toe/.test(name)) return [1.1, 1, 1.1];
  if (/Head|Neck/.test(name)) return [1, 1, 1];
  return [1.45, 1, 1.3]; // hips, spine, shoulders
}

const K_NEAREST = 8;

const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

function istriJoint(name, kurirJoints) {
  const bare = name.replace('mixamorig', '');
  const right = bare.startsWith('Right');
  const key = right ? 'Left' + bare.slice(5) : bare;
  const mirror = (p) => (right ? [-p[0], p[1], p[2]] : p);
  if (ISTRI_JOINTS[key]) return new THREE.Vector3(...mirror(ISTRI_JOINTS[key]));
  if (/Hand.+\d/.test(key)) {
    const side = right ? 'Right' : 'Left';
    const kHand = kurirJoints[`mixamorig${side}Hand`];
    const iHand = new THREE.Vector3(...mirror(ISTRI_JOINTS.LeftHand));
    return kurirJoints[name].clone().sub(kHand).multiplyScalar(HAND_SCALE).add(iHand);
  }
  throw new Error(`no istri joint for ${name}`);
}

function loadIstriObj() {
  const text = execSync(`unzip -p "${ZIP}" istri.obj`, { maxBuffer: 1 << 30 }).toString();
  const pos = [];
  const uv = [];
  const nrm = [];
  const idx = [];
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') pos.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'vt') uv.push(+p[1], +p[2]);
    else if (p[0] === 'vn') nrm.push(+p[1], +p[2], +p[3]);
    else if (p[0] === 'f') {
      // trimesh export: v, vt and vn share one index, so the geometry can stay indexed
      const f = p.slice(1).map((s) => s.split('/').map(Number));
      if (f.length !== 3 || f.some(([a, b, c]) => a !== b || a !== c)) throw new Error('unexpected OBJ face: ' + line);
      idx.push(f[0][0] - 1, f[1][0] - 1, f[2][0] - 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return removeGlasses(g);
}

// The OBJ has glasses fused into the head, with a second pair of eyes painted on the lenses in front of
// the real eyeballs. Measured in the T-pose: the lens plates and rims sit ≥0.207 m forward (the face is
// behind that), the temples are thin bars at |x|≈0.16, y≈1.285 running back into the hijab.
const GLASSES = {
  front: { minZ: 0.207, maxAbsX: 0.18, minY: 1.18, maxY: 1.335 },
  nose: { maxAbsX: 0.045, belowY: 1.24 }, // nose tip also pokes past minZ; keep it
  temple: { minAbsX: 0.138, maxAbsX: 0.178, minY: 1.268, maxY: 1.305, minZ: -0.03 },
  lens: { minAbsX: 0.03, maxAbsX: 0.13, minY: 1.21, maxY: 1.31 }, // flood-fill seeds
};

function removeGlasses(geo) {
  const pos = geo.attributes.position;
  const index = geo.index.array;
  const nFaces = index.length / 3;

  // UV seams split vertices; weld by position so the mesh's real connectivity shows.
  const weldId = new Int32Array(pos.count);
  const ids = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
    if (!ids.has(k)) ids.set(k, ids.size);
    weldId[i] = ids.get(k);
  }
  const parent = Int32Array.from({ length: ids.size }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const faceWeld = (f, k) => weldId[index[f * 3 + k]];
  for (let f = 0; f < nFaces; f++) {
    const a = find(faceWeld(f, 0));
    parent[find(faceWeld(f, 1))] = a;
    parent[find(faceWeld(f, 2))] = a;
  }
  // The eyeballs and nose are separate pieces; the glasses belong to the big body piece.
  const sizes = new Map();
  for (let i = 0; i < ids.size; i++) sizes.set(find(i), (sizes.get(find(i)) || 0) + 1);
  const body = [...sizes].sort((a, b) => b[1] - a[1])[0][0];

  const { front, nose, temple, lens } = GLASSES;
  const isCandidate = new Uint8Array(nFaces);
  const seeds = [];
  for (let f = 0; f < nFaces; f++) {
    if (find(faceWeld(f, 0)) !== body) continue;
    let minAX = Infinity, maxAX = 0, minY = Infinity, maxY = -Infinity, minZ = Infinity;
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) {
      const v = index[f * 3 + k];
      const ax = Math.abs(pos.getX(v));
      const y = pos.getY(v);
      minAX = Math.min(minAX, ax);
      maxAX = Math.max(maxAX, ax);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, pos.getZ(v));
      cx += ax / 3;
      cy += y / 3;
    }
    const isNose = maxAX < nose.maxAbsX && minY < nose.belowY;
    const isFront = minZ > front.minZ && maxAX < front.maxAbsX && minY > front.minY && maxY < front.maxY && !isNose;
    const isTemple = minAX > temple.minAbsX && maxAX < temple.maxAbsX && minY > temple.minY && maxY < temple.maxY && minZ > temple.minZ;
    if (!isFront && !isTemple) continue;
    isCandidate[f] = 1;
    if (isFront && cx > lens.minAbsX && cx < lens.maxAbsX && cy > lens.minY && cy < lens.maxY) seeds.push(f);
  }

  // Keep only candidates connected to the lenses, so stray hijab/face bits in the boxes survive.
  const facesOf = new Map();
  for (let f = 0; f < nFaces; f++) {
    if (!isCandidate[f]) continue;
    for (let k = 0; k < 3; k++) {
      const w = faceWeld(f, k);
      if (!facesOf.has(w)) facesOf.set(w, []);
      facesOf.get(w).push(f);
    }
  }
  const remove = new Uint8Array(nFaces);
  seeds.forEach((f) => (remove[f] = 1));
  const queue = [...seeds];
  while (queue.length) {
    const f = queue.pop();
    for (let k = 0; k < 3; k++) {
      for (const g of facesOf.get(faceWeld(f, k))) {
        if (!remove[g]) {
          remove[g] = 1;
          queue.push(g);
        }
      }
    }
  }

  // Rebuild without those faces, dropping vertices nothing uses any more.
  const remap = new Int32Array(pos.count).fill(-1);
  const keep = [];
  const newIndex = [];
  const bodyFace = [];
  for (let f = 0; f < nFaces; f++) {
    if (remove[f]) continue;
    bodyFace.push(find(faceWeld(f, 0)) === body ? 1 : 0);
    for (let k = 0; k < 3; k++) {
      const v = index[f * 3 + k];
      if (remap[v] < 0) {
        remap[v] = keep.length;
        keep.push(v);
      }
      newIndex.push(remap[v]);
    }
  }
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const arr = new Float32Array(keep.length * attr.itemSize);
    keep.forEach((v, i) => arr.set(attr.array.subarray(v * attr.itemSize, (v + 1) * attr.itemSize), i * attr.itemSize));
    out.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
  }
  out.setIndex(newIndex);
  console.log(`removed glasses: ${remove.reduce((s, r) => s + r, 0)} of ${nFaces} triangles`);
  // bodyFace marks the head/body skin (not the separate eyeballs and nose) for cleanPaintedGlasses.
  return { geometry: out, bodyFace: Uint8Array.from(bodyFace) };
}

// sips writes 24-bit BGR, top-down (negative height), rows already 4-byte aligned for power-of-two widths.
function readBmp(buf) {
  const offset = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const height = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  if (bpp !== 24 || height > 0 || (width * 3) % 4) throw new Error('unexpected BMP layout from sips');
  return { width, height: -height, data: buf.subarray(offset) };
}

// The texture also has the glasses (frame, lens tint, cast shadow) painted onto the face skin. Render the
// face from the front, find the painted glasses' silhouette, repaint it with the surrounding skin except
// for the eyes, and write that back to the texels.
const PAINT = {
  scale: 4000, // render pixels per metre
  view: { minX: -0.17, maxX: 0.17, minY: 1.15, maxY: 1.37, minZ: 0.1 },
  frame: { maxAbsX: 0.16, minY: 1.19, maxY: 1.335 }, // where the painted frame can be
  closeGaps: 10, // px: join the frame's faint stretches before filling its inside
  pad: 10, // px grown outward to catch the frame's dark outline
  // eye pixels are looked for `inset` px inside the silhouette, grown by `grow`, and never kept within
  // `frameBand` px of its edge (that's the painted frame)
  eye: { inset: 30, grow: 4, frameBand: 48 },
  texelGutter: 4,
};

function cleanPaintedGlasses(geo, bodyFace, tex) {
  const { scale: SC, view } = PAINT;
  const W = Math.round((view.maxX - view.minX) * SC);
  const H = Math.round((view.maxY - view.minY) * SC);
  const N = W * H;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const index = geo.index.array;
  const texel = (u, v) => {
    const x = Math.min(tex.width - 1, Math.max(0, Math.floor(u * tex.width)));
    const y = Math.min(tex.height - 1, Math.max(0, Math.floor((1 - v) * tex.height)));
    return (y * tex.width + x) * 3; // BGR
  };
  const faces = [];
  for (let f = 0; f < index.length / 3; f++) {
    if (!bodyFace[f]) continue;
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const v = index[f * 3 + k];
      cx += pos.getX(v) / 3;
      cy += pos.getY(v) / 3;
      cz += pos.getZ(v) / 3;
    }
    if (cx > view.minX && cx < view.maxX && cy > view.minY && cy < view.maxY && cz > view.minZ) faces.push(f);
  }
  const corners = (f) => [0, 1, 2].map((k) => index[f * 3 + k]);
  const toScreen = (v) => [(pos.getX(v) - view.minX) * SC, (view.maxY - pos.getY(v)) * SC];
  // Calls fn(px, py, a, b, c) for pixel centres inside triangle (x, y), or within `grow` pixels of it
  // (barycentrics then extrapolate past 0).
  const raster = (xs, ys, w, h, grow, fn) => {
    const den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]);
    if (Math.abs(den) < 1e-12) return;
    // a = distance to the edge opposite corner 0 divided by that corner's altitude, etc.
    const edge = (i, j) => Math.hypot(xs[i] - xs[j], ys[i] - ys[j]);
    const eps = [edge(1, 2), edge(2, 0), edge(0, 1)].map((len) => (grow * len) / Math.abs(den));
    const g = Math.ceil(grow) + 1;
    const x0 = Math.max(0, Math.floor(Math.min(...xs)) - g), x1 = Math.min(w, Math.ceil(Math.max(...xs)) + g);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)) - g), y1 = Math.min(h, Math.ceil(Math.max(...ys)) + g);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const gx = px + 0.5, gy = py + 0.5;
        const a = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den;
        const b = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den;
        const c = 1 - a - b;
        if (a >= -eps[0] && b >= -eps[1] && c >= -eps[2]) fn(px, py, a, b, c);
      }
    }
  };

  // 1. Front render (orthographic, z-buffered) of the face skin.
  const img = new Float32Array(N * 3);
  const zbuf = new Float32Array(N).fill(-Infinity);
  for (const f of faces) {
    const vs = corners(f);
    const sc = vs.map(toScreen);
    raster(sc.map((p) => p[0]), sc.map((p) => p[1]), W, H, 0, (px, py, a, b, c) => {
      const i = py * W + px;
      const z = a * pos.getZ(vs[0]) + b * pos.getZ(vs[1]) + c * pos.getZ(vs[2]);
      if (z <= zbuf[i]) return;
      zbuf[i] = z;
      const t = texel(a * uv.getX(vs[0]) + b * uv.getX(vs[1]) + c * uv.getX(vs[2]), a * uv.getY(vs[0]) + b * uv.getY(vs[1]) + c * uv.getY(vs[2]));
      img[i * 3] = tex.data[t + 2];
      img[i * 3 + 1] = tex.data[t + 1];
      img[i * 3 + 2] = tex.data[t];
    });
  }
  const has = (i) => zbuf[i] > -Infinity;
  const R = (i) => img[i * 3], G = (i) => img[i * 3 + 1], B = (i) => img[i * 3 + 2];

  const grow = (m, n) => {
    let cur = m;
    for (let it = 0; it < n; it++) {
      const next = cur.slice();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (cur[i]) continue;
          if ((x > 0 && cur[i - 1]) || (x < W - 1 && cur[i + 1]) || (y > 0 && cur[i - W]) || (y < H - 1 && cur[i + W])) next[i] = 1;
        }
      cur = next;
    }
    return cur;
  };
  const invert = (m) => m.map((v) => 1 - v);
  const shrink = (m, n) => invert(grow(invert(m), n));

  // Pixels the border can reach without crossing `blocked`.
  const floodOutside = (blocked) => {
    const outside = new Uint8Array(N);
    const stack = [];
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) {
      const i = stack.pop();
      if (outside[i] || blocked[i]) continue;
      outside[i] = 1;
      const x = i % W;
      if (x > 0) stack.push(i - 1);
      if (x < W - 1) stack.push(i + 1);
      if (i >= W) stack.push(i - W);
      if (i < N - W) stack.push(i + W);
    }
    return outside;
  };
  const largest = (m, k) => {
    const label = new Int32Array(N);
    const sizes = [0];
    for (let s = 0; s < N; s++) {
      if (!m[s] || label[s]) continue;
      const id = sizes.length;
      let size = 0;
      const stack = [s];
      label[s] = id;
      while (stack.length) {
        const i = stack.pop();
        size++;
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= N || !m[j] || label[j]) continue;
          label[j] = id;
          stack.push(j);
        }
      }
      sizes.push(size);
    }
    const keep = new Set(sizes.map((n, id) => [n, id]).slice(1).sort((p, q) => q[0] - p[0]).slice(0, k).map(([, id]) => id));
    return label.map((id) => (keep.has(id) ? 1 : 0));
  };

  // 2. Painted frame: greyish over skin (skin has R-B > 70, hijab has R-B < 0). Close its gaps; everything
  //    the outside can't reach is the glasses' silhouette, lenses included.
  const grey = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wx = view.minX + (x + 0.5) / SC, wy = view.maxY - (y + 0.5) / SC;
      const inFrame = Math.abs(wx) < PAINT.frame.maxAbsX && wy > PAINT.frame.minY && wy < PAINT.frame.maxY;
      grey[i] = has(i) && inFrame && R(i) - B(i) > 0 && R(i) - B(i) < 70 && R(i) > 95 ? 1 : 0;
    }
  const sil = invert(floodOutside(shrink(grow(grey, PAINT.closeGaps), PAINT.closeGaps)));

  // The eyes (whites, iris, lashes) inside each lens are kept; they never reach into the frame band.
  const eyeRaw = new Uint8Array(N);
  const eyeZone = shrink(sil, PAINT.eye.inset);
  for (let i = 0; i < N; i++) {
    const r = R(i), g = G(i), b = B(i);
    eyeRaw[i] = has(i) && eyeZone[i] && (r < 90 || (g >= r - 8 && r > 170) || (r - b < 80 && r < 175 && g < 140)) ? 1 : 0;
  }
  const eyeBlobs = largest(invert(floodOutside(shrink(grow(eyeRaw, 8), 8))), 2);
  const protect = grow(eyeBlobs, PAINT.eye.grow);
  const notFrame = shrink(sil, PAINT.eye.frameBand);
  const padded = grow(sil, PAINT.pad);
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = padded[i] && has(i) && !(protect[i] && notFrame[i]) && R(i) - B(i) > -5 ? 1 : 0;

  // 3. Repaint the mask as a smooth (harmonic) blend of the skin around it, solved coarse-to-fine.
  const known = new Uint8Array(N);
  for (let i = 0; i < N; i++) known[i] = has(i) && !mask[i] && R(i) - B(i) > 70 ? 1 : 0;
  const harmonic = (val, kn, ok, w, h) => {
    const relax = (iters) => {
      const free = [];
      for (let i = 0; i < w * h; i++) if (ok[i] && !kn[i]) free.push(i);
      const next = new Float32Array(free.length * 3);
      for (let it = 0; it < iters; it++) {
        free.forEach((i, f) => {
          const x = i % w;
          let r = 0, g = 0, b = 0, n = 0;
          for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1]) {
            if (j < 0 || !ok[j]) continue;
            r += val[j * 3]; g += val[j * 3 + 1]; b += val[j * 3 + 2]; n++;
          }
          if (n) next.set([r / n, g / n, b / n], f * 3);
          else next.set(val.subarray(i * 3, i * 3 + 3), f * 3);
        });
        free.forEach((i, f) => val.set(next.subarray(f * 3, f * 3 + 3), i * 3));
      }
    };
    if (Math.min(w, h) < 16) return relax(400);
    const w2 = w >> 1, h2 = h >> 1;
    const cv = new Float32Array(w2 * h2 * 3), ck = new Uint8Array(w2 * h2), cok = new Uint8Array(w2 * h2);
    for (let y = 0; y < h2; y++)
      for (let x = 0; x < w2; x++) {
        const c = y * w2 + x;
        let n = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const i = (2 * y + dy) * w + 2 * x + dx;
          if (ok[i]) cok[c] = 1;
          if (!kn[i]) continue;
          ck[c] = 1;
          n++;
          for (let k = 0; k < 3; k++) cv[c * 3 + k] += val[i * 3 + k];
        }
        if (n) for (let k = 0; k < 3; k++) cv[c * 3 + k] /= n;
      }
    harmonic(cv, ck, cok, w2, h2);
    for (let y = 0; y < h2 * 2; y++)
      for (let x = 0; x < w2 * 2; x++) {
        const i = y * w + x;
        if (ok[i] && !kn[i]) val.set(cv.subarray(((y >> 1) * w2 + (x >> 1)) * 3, ((y >> 1) * w2 + (x >> 1)) * 3 + 3), i * 3);
      }
    relax(60);
  };
  const solveOk = new Uint8Array(N);
  for (let i = 0; i < N; i++) solveOk[i] = known[i] || mask[i] ? 1 : 0;
  harmonic(img, known, solveOk, W, H);
  if (DEBUG) {
    // front render after repainting, as a BMP next to the other debug output
    const head = Buffer.alloc(54);
    head.write('BM');
    head.writeUInt32LE(54 + N * 3, 2);
    head.writeUInt32LE(54, 10);
    head.writeUInt32LE(40, 14);
    head.writeInt32LE(W, 18);
    head.writeInt32LE(-H, 22);
    head.writeUInt16LE(1, 26);
    head.writeUInt16LE(24, 28);
    const px = Buffer.alloc(N * 3);
    for (let i = 0; i < N; i++) {
      const m = mask[i] ? 1 : 0;
      px[i * 3] = Math.min(255, img[i * 3 + 2]);
      px[i * 3 + 1] = Math.min(255, img[i * 3 + 1]);
      px[i * 3 + 2] = Math.min(255, img[i * 3]);
    }
    fs.mkdirSync(path.join(ROOT, 'tools/.scratch'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'tools/.scratch/paint_front.bmp'), Buffer.concat([head, px]));
    const mpx = Buffer.alloc(N * 3);
    for (let i = 0; i < N; i++) mpx.fill(mask[i] ? 255 : protect[i] ? 120 : 0, i * 3, i * 3 + 3);
    fs.writeFileSync(path.join(ROOT, 'tools/.scratch/paint_mask.bmp'), Buffer.concat([head, mpx]));
  }

  // 4. Write back: every texel of a visible face-skin triangle whose front pixel was repainted.
  let changed = 0;
  for (const f of faces) {
    const vs = corners(f);
    const us = vs.map((v) => uv.getX(v) * tex.width);
    const ts = vs.map((v) => (1 - uv.getY(v)) * tex.height);
    // grown by a few texels so UV-island borders don't keep the old frame colour (it bleeds in when downscaled)
    raster(us, ts, tex.width, tex.height, PAINT.texelGutter, (tx, ty, a, b, c) => {
      const sx = Math.floor(vs.reduce((s, v, k) => s + [a, b, c][k] * (pos.getX(v) - view.minX) * SC, 0));
      const sy = Math.floor(vs.reduce((s, v, k) => s + [a, b, c][k] * (view.maxY - pos.getY(v)) * SC, 0));
      if (sx < -2 || sy < -2 || sx >= W + 2 || sy >= H + 2) return;
      const i = Math.min(H - 1, Math.max(0, sy)) * W + Math.min(W - 1, Math.max(0, sx));
      const z = a * pos.getZ(vs[0]) + b * pos.getZ(vs[1]) + c * pos.getZ(vs[2]);
      if (!has(i) || zbuf[i] - z > 0.01) return; // off the face render, or hidden behind another surface
      // inside the triangle only masked texels change; the gutter always takes the (cleaned) render colour
      if (!mask[i] && a >= 0 && b >= 0 && c >= 0) return;
      const t = (ty * tex.width + tx) * 3;
      tex.data[t] = Math.round(img[i * 3 + 2]);
      tex.data[t + 1] = Math.round(img[i * 3 + 1]);
      tex.data[t + 2] = Math.round(img[i * 3]);
      changed++;
    });
  }
  console.log(`cleaned painted glasses: ${changed} texels`);
}

function loadKurir() {
  const model = new FBXLoader().parse(toArrayBuffer(fs.readFileSync(KURIR)), '');
  model.updateMatrixWorld(true);
  let mesh;
  model.traverse((o) => {
    if (o.isSkinnedMesh) mesh = o;
  });
  const joints = {};
  model.traverse((o) => {
    if (o.isBone) joints[o.name] = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
  });
  return { model, mesh, joints };
}

// Move kurir's bind-pose vertices onto istri's proportions with linear blend skinning.
function warpKurir(kurir, iJoints) {
  const { mesh, joints } = kurir;
  const bones = mesh.skeleton.bones;
  const xf = bones.map((bone) => {
    const kj = joints[bone.name];
    const ij = iJoints[bone.name];
    const child = bone.children.find((c) => c.isBone);
    const s = regionScale(bone.name).slice();
    if (child) {
      const kd = joints[child.name].clone().sub(kj);
      const id = iJoints[child.name].clone().sub(ij);
      const axis = [Math.abs(kd.x), Math.abs(kd.y), Math.abs(kd.z)].indexOf(Math.max(Math.abs(kd.x), Math.abs(kd.y), Math.abs(kd.z)));
      s[axis] = id.length() / kd.length();
    }
    return { kj, ij, s };
  });
  const pos = mesh.geometry.attributes.position;
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;
  const out = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (!w) continue;
      const { kj, ij, s } = xf[si.getComponent(i, k)];
      x += w * (ij.x + s[0] * (v.x - kj.x));
      y += w * (ij.y + s[1] * (v.y - kj.y));
      z += w * (ij.z + s[2] * (v.z - kj.z));
    }
    out.set([x, y, z], i * 3);
  }
  return out;
}

// Average the skin weights of the K nearest warped-kurir vertices (same body side only).
function transferWeights(istriGeo, warped, kurirMesh) {
  const CELL = 0.03;
  const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  const grid = new Map();
  for (let i = 0; i < warped.length / 3; i++) {
    const k = key(warped[i * 3], warped[i * 3 + 1], warped[i * 3 + 2]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const si = kurirMesh.geometry.attributes.skinIndex;
  const sw = kurirMesh.geometry.attributes.skinWeight;
  const pos = istriGeo.attributes.position;
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    const cz = Math.floor(pz / CELL);
    let found = [];
    for (let r = 1; r < 12 && found.length < K_NEAREST; r++) {
      found = [];
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (let dz = -r; dz <= r; dz++) {
            const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!cell) continue;
            for (const j of cell) {
              const wx = warped[j * 3];
              if (Math.abs(px) > 0.02 && Math.abs(wx) > 0.02 && Math.sign(px) !== Math.sign(wx)) continue;
              const d = (wx - px) ** 2 + (warped[j * 3 + 1] - py) ** 2 + (warped[j * 3 + 2] - pz) ** 2;
              found.push([d, j]);
            }
          }
    }
    found.sort((a, b) => a[0] - b[0]);
    const acc = new Map();
    for (const [d, j] of found.slice(0, K_NEAREST)) {
      const f = 1 / (Math.sqrt(d) + 1e-3);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(j, k);
        if (!w) continue;
        const b = si.getComponent(j, k);
        acc.set(b, (acc.get(b) || 0) + w * f);
      }
    }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = top.reduce((s, [, w]) => s + w, 0);
    top.forEach(([b, w], k) => {
      skinIndex[i * 4 + k] = b;
      skinWeight[i * 4 + k] = w / total;
    });
  }
  istriGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  istriGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
}

// Same hierarchy, names and bind orientations as kurir; only the joint positions change.
function buildSkeleton(kurirBones, kurirJoints, iJoints) {
  const bones = kurirBones.map((kb) => {
    const b = new THREE.Bone();
    b.name = kb.name;
    b.quaternion.copy(kb.quaternion);
    b.scale.copy(kb.scale);
    return b;
  });
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  let root;
  kurirBones.forEach((kb, i) => {
    const parent = kb.parent && kb.parent.isBone ? byName[kb.parent.name] : null;
    if (parent) parent.add(bones[i]);
    else root = bones[i];
  });
  // Set local positions top-down so world positions land on istri's joints.
  const place = (bone) => {
    const target = iJoints[bone.name].clone();
    if (bone.parent && bone.parent.isBone) {
      bone.parent.updateMatrixWorld(true);
      bone.position.copy(bone.parent.worldToLocal(target));
    } else {
      bone.position.copy(target);
    }
    bone.updateMatrixWorld(true);
    bone.children.filter((c) => c.isBone).forEach(place);
  };
  // kurir's root bone sits directly under the identity-transform FBX group, so its world rotation is its own.
  place(root);
  return { root, bones };
}

class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((r) => {
      this.result = r;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((r) => {
      this.result = `data:${blob.type};base64,${Buffer.from(r).toString('base64')}`;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader ??= NodeFileReader;

async function main() {
  const kurir = loadKurir();
  // Skinned bones first so skinIndex values stay valid, then the unskinned *_End / finger-tip bones.
  const kBones = [...kurir.mesh.skeleton.bones];
  let kRoot = kBones[0];
  while (kRoot.parent && kRoot.parent.isBone) kRoot = kRoot.parent;
  kRoot.traverse((o) => {
    if (o.isBone && !kBones.includes(o)) kBones.push(o);
  });
  const iJoints = Object.fromEntries(kBones.map((b) => [b.name, istriJoint(b.name, kurir.joints)]));

  const { geometry: geo, bodyFace } = loadIstriObj();
  const warped = warpKurir(kurir, iJoints);
  transferWeights(geo, warped, kurir.mesh);

  const { root, bones } = buildSkeleton(kBones, kurir.joints, iJoints);
  const material = new THREE.MeshStandardMaterial({ name: 'istri', roughness: 0.8 });
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = 'istri';
  const scene = new THREE.Group();
  scene.name = 'istri';
  scene.add(root, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);

  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  fs.writeFileSync(OUT_GLB, Buffer.from(glb));
  // sips (macOS) decodes the PNG to raw BMP so the painted frame can be cleaned, then writes a 2K JPEG
  // (the 4K PNG is 12 MB; 2K is plenty in game).
  const tmpPng = path.join(ROOT, 'tools/.istri_tex.png');
  const tmpBmp = path.join(ROOT, 'tools/.istri_tex.bmp');
  execSync(`unzip -p "${ZIP}" material_0.png > "${tmpPng}"`);
  execSync(`sips -s format bmp "${tmpPng}" --out "${tmpBmp}"`, { stdio: 'ignore' });
  const bmp = fs.readFileSync(tmpBmp);
  cleanPaintedGlasses(geo, bodyFace, readBmp(bmp));
  fs.writeFileSync(tmpBmp, bmp); // readBmp's pixels are a view into this buffer
  execSync(`sips -s format jpeg -s formatOptions 85 -Z 2048 "${tmpBmp}" --out "${OUT_TEX}"`, { stdio: 'ignore' });
  fs.unlinkSync(tmpPng);
  fs.unlinkSync(tmpBmp);

  if (DEBUG) {
    fs.mkdirSync(path.join(ROOT, 'tools/.scratch'), { recursive: true });
    const dump = {
      warped: Array.from(warped).map((v) => +v.toFixed(4)),
      joints: Object.fromEntries(Object.entries(iJoints).map(([k, v]) => [k, v.toArray()])),
      boneNames: kBones.map((b) => b.name),
      skinIndex: Array.from(geo.attributes.skinIndex.array),
      skinWeight: Array.from(geo.attributes.skinWeight.array).map((v) => +v.toFixed(3)),
    };
    fs.writeFileSync(path.join(ROOT, 'tools/.scratch/warp.json'), JSON.stringify(dump));
  }
  console.log(`wrote ${path.relative(ROOT, OUT_GLB)} (${(glb.byteLength / 1e6).toFixed(1)} MB, ${geo.attributes.position.count} verts) and ${path.relative(ROOT, OUT_TEX)}`);
}

main();
