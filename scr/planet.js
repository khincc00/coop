import * as THREE from 'three';

// Tiny planet. The world is a real sphere of radius R centred below the origin, with the town on
// the north pole. Two kinds of coordinates are used:
//  - the town chart: the town is laid out on a flat grid (town.js) and wrapped onto the sphere around
//    the pole, a flat point at distance d from the origin landing d metres down the sphere;
//  - surface charts: small flat maps that travel with whoever walks, so player physics can stay flat
//    (player.js) while the walker goes all the way round the planet.
export const PLANET_RADIUS = 100;
const R = PLANET_RADIUS;
export const PLANET_CENTRE = new THREE.Vector3(0, -R, 0);

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();

// Point on the sphere at polar angle theta (0 = north pole, where the town is) and azimuth phi,
// h metres above the ground. phi = 0 points along +X, phi = π/2 along +Z.
export function surfacePoint(theta, phi, h = 0, out = new THREE.Vector3()) {
  const r = R + h;
  return out.set(r * Math.sin(theta) * Math.cos(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phi)).add(PLANET_CENTRE);
}

export function upAt(p, out = new THREE.Vector3()) {
  return out.subVectors(p, PLANET_CENTRE).normalize();
}

// Height of world point p above the ground.
export const heightOf = (p) => p.distanceTo(PLANET_CENTRE) - R;

// ---- town chart ----

// Flat town point (x, height, z) → world.
export function bend(p, out = new THREE.Vector3()) {
  const d = Math.hypot(p.x, p.z);
  if (d < 1e-6) return out.set(p.x, p.y, p.z);
  const th = d / R;
  const r = R + p.y;
  const s = (r * Math.sin(th)) / d;
  return out.set(p.x * s, r * Math.cos(th) - R, p.z * s);
}

// World → flat town point (x, height, z). The inverse of bend.
export function unbend(w, out = new THREE.Vector3()) {
  _v.subVectors(w, PLANET_CENTRE);
  const r = _v.length();
  const th = Math.acos(THREE.MathUtils.clamp(_v.y / r, -1, 1));
  const xz = Math.hypot(_v.x, _v.z);
  const d = th * R;
  return xz < 1e-9 ? out.set(0, r - R, 0) : out.set((_v.x / xz) * d, r - R, (_v.z / xz) * d);
}

// Rotation taking flat town directions to the tilted ground at flat point p (flat +Y → local up).
const _axis = new THREE.Vector3();
export function surfaceFrame(p, out = new THREE.Quaternion()) {
  const d = Math.hypot(p.x, p.z);
  if (d < 1e-6) return out.identity();
  return out.setFromAxisAngle(_axis.set(p.z / d, 0, -p.x / d), d / R);
}

// A model placed in the town chart with matrix m: move it onto the sphere, shaping it with the
// local stretch of the wrap so that neighbouring tiles still meet.
const _p = new THREE.Vector3();
const _J = new THREE.Matrix4();
const _L = new THREE.Matrix4();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
export function townToPlanet(m, out = new THREE.Matrix4()) {
  _p.setFromMatrixPosition(m);
  const ground = _w.set(_p.x, 0, _p.z);
  const e = 0.05;
  const col = (dx, dy, dz) =>
    bend(_a.set(ground.x + dx, dy, ground.z + dz), _a).sub(bend(_b.set(ground.x - dx, -dy, ground.z - dz), _b)).divideScalar(2 * e).clone();
  _J.makeBasis(col(e, 0, 0), col(0, e, 0), col(0, 0, e));
  _L.copy(m).setPosition(0, 0, 0);
  return out.multiplyMatrices(_J, _L).setPosition(bend(_p, _v));
}

// Bend every vertex of a flat town-chart geometry onto the sphere (for one-off meshes: water, banks).
export function bendGeometry(geo) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    bend(_v.fromBufferAttribute(pos, i), _v);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---- surface charts ----

// Local flat map round a point on the ground. quat turns local axes into world ones (local +Y = up).
// Local x/z are metres along the ground; toWorld/toLocal are exact great-circle walks, so the chart is
// accurate near its centre and is re-centred (move) every frame by whoever uses it.
export class SurfaceChart {
  constructor(point, quat) {
    this.point = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.inv = new THREE.Quaternion();
    this.set(point, quat);
  }

  set(point, quat) {
    upAt(point, _v);
    this.point.copy(PLANET_CENTRE).addScaledVector(_v, R); // keep it on the ground
    this.quat.copy(quat);
    this.inv.copy(quat).invert();
    return this;
  }

  // Rotation (about the planet centre) that walks the centre to local (x, z).
  walk(x, z, out = new THREE.Quaternion()) {
    const dist = Math.hypot(x, z);
    if (dist < 1e-9) return out.identity();
    const up = upAt(this.point, _w);
    const dir = _v.set(x / dist, 0, z / dist).applyQuaternion(this.quat);
    return out.setFromAxisAngle(_axis.crossVectors(up, dir).normalize(), dist / R);
  }

  toWorld(x, h, z, out = new THREE.Vector3()) {
    this.walk(x, z, _q);
    const up = upAt(this.point, out).applyQuaternion(_q);
    return out.multiplyScalar(R + h).add(PLANET_CENTRE);
  }

  // Frame (local axes → world) at local (x, z), carried along from the centre.
  frameAt(x, z, out = new THREE.Quaternion()) {
    return this.walk(x, z, out).multiply(this.quat);
  }

  toLocal(w, out = new THREE.Vector3()) {
    const up = upAt(this.point, _w);
    const u = upAt(w, _v);
    const cos = THREE.MathUtils.clamp(up.dot(u), -1, 1);
    const ang = Math.acos(cos);
    const h = heightOf(w);
    const t = u.addScaledVector(up, -cos);
    const len = t.length();
    if (len < 1e-9) return out.set(0, h, 0);
    t.multiplyScalar((ang * R) / len).applyQuaternion(this.inv);
    return out.set(t.x, h, t.z);
  }

  dirToLocal(v, out = new THREE.Vector3()) {
    return out.copy(v).applyQuaternion(this.inv);
  }

  // Re-centre on local (x, z), carrying the axes along (parallel transport).
  move(x, z) {
    this.walk(x, z, _q);
    this.point.sub(PLANET_CENTRE).applyQuaternion(_q).add(PLANET_CENTRE);
    this.quat.premultiply(_q);
    this.inv.copy(this.quat).invert();
  }
}

// Matrix for a model standing at world point p with its +Z facing `forward` (any vector; it is
// flattened onto the ground) and its feet `lift` metres up.
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
export function standAt(p, forward, scale = 1, lift = 0, out = new THREE.Matrix4()) {
  upAt(p, _y);
  _z.copy(forward).addScaledVector(_y, -forward.dot(_y)).normalize();
  _x.crossVectors(_y, _z);
  const s = typeof scale === 'number' ? _a.set(scale, scale, scale) : scale;
  out.makeBasis(_x.multiplyScalar(s.x), _y.clone().multiplyScalar(s.y), _z.multiplyScalar(s.z));
  return out.setPosition(_b.copy(p).addScaledVector(upAt(p, _v), lift));
}
