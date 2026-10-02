import * as THREE from 'three';
import { T, ROAD_SURFACE } from './town.js';
import { PLANET_CENTRE, PLANET_RADIUS, upAt } from './planet.js';

// Traffic on every road of the planet: the towns' street grids and the planet roads between them
// form one graph of road tiles in world space. Cars wander it tile by tile, picking a turn at every
// junction. Traffic keeps left (as in Indonesia), so roundabouts run clockwise. Cars brake for
// people and for the car ahead, whichever road they are on.
export const CAR_MODELS = ['sedan', 'taxi', 'van', 'police', 'hatchback-sports', 'suv', 'delivery', 'ambulance', 'sedan-sports', 'garbage-truck', 'truck', 'tractor']
  .map((c) => `cars/${c}`);
const CAR_COUNT = 40;
const CAR_SCALE = 1.15;
const LANE = 0.22 * T; // lane centre from the road centre line
const RING = 0.82 * T; // lane radius round a roundabout
const ROUNDABOUT_HALF = 1.5 * T;
const SPEED = [6, 9]; // m/s
const ACCEL = 4;
const BRAKE = 16;
const LOOK_AHEAD = { car: 6.5, person: 5 }; // metres

const _v = new THREE.Vector3();

// ---- road graph ----
export class RoadGraph {
  constructor() {
    this.nodes = [];
  }

  node(p) {
    const n = { p: p.clone(), up: upAt(p), nbrs: [], ring: null, link: false };
    this.nodes.push(n);
    return n;
  }

  join(a, b) {
    if (a === b) return;
    if (!a.nbrs.includes(b)) a.nbrs.push(b);
    if (!b.nbrs.includes(a)) b.nbrs.push(a);
  }

  // A town map (layoutMap result): its road tiles, roundabouts and the links where planet roads join.
  addMap(layout) {
    const { roads, tileX, toWorld, frame } = layout;
    const key = (i, j) => `${i},${j}`;
    const byKey = new Map();
    const at = (i, j) => toWorld(tileX(i), 0, tileX(j));
    for (const [i, j] of roads.tiles) byKey.set(key(i, j), this.node(at(i, j)));
    for (const [i, j] of roads.links) {
      const n = this.node(at(i, j));
      n.link = true; // a planet road will take this node's place (see addChain)
      byKey.set(key(i, j), n);
    }
    for (const [i, j] of roads.roundabouts) {
      const n = this.node(at(i, j));
      // the roundabout's own axes (map x and z) decide which way is clockwise
      const e1 = new THREE.Vector3(1, 0, 0);
      const e2 = new THREE.Vector3(0, 0, 1);
      if (frame) {
        e1.transformDirection(frame);
        e2.transformDirection(frame);
      }
      const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0).transformDirection(frame ?? new THREE.Matrix4()), n.up);
      n.ring = { e1: e1.applyQuaternion(tilt), e2: e2.applyQuaternion(tilt) };
      byKey.set(`ring ${i},${j}`, n);
    }
    const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
    for (const [i, j] of roads.tiles) {
      const a = byKey.get(key(i, j));
      for (const d of roads.sides(i, j)) {
        const [di, dj] = DIRS[d];
        const b = byKey.get(key(i + di, j + dj)) ?? byKey.get(`ring ${i + 2 * di},${j + 2 * dj}`);
        if (b) this.join(a, b);
      }
    }
  }

  // A planet road: tile centres in order. Its two ends replace the towns' link nodes there.
  addChain(points) {
    const chain = points.map((p) => this.node(p));
    for (let k = 1; k < chain.length; k++) this.join(chain[k - 1], chain[k]);
    for (const end of [chain[0], chain[chain.length - 1]]) {
      const link = this.nodes.find((n) => n.link && n.p.distanceTo(end.p) < 1.5);
      if (!link) continue;
      for (const nb of link.nbrs) {
        nb.nbrs = nb.nbrs.filter((x) => x !== link);
        this.join(end, nb);
      }
      this.nodes = this.nodes.filter((n) => n !== link);
    }
  }
}

// direction along the ground at node a towards node b
function dirTo(a, b) {
  _v.subVectors(b.p, a.p);
  return _v.addScaledVector(a.up, -_v.dot(a.up)).normalize().clone();
}
// distance from node a's centre to its boundary with neighbour b
function halfTo(a, b) {
  if (a.ring) return ROUNDABOUT_HALF;
  const d = a.p.distanceTo(b.p);
  return b.ring ? d - ROUNDABOUT_HALF : d / 2;
}
const left = (n, d) => new THREE.Vector3().crossVectors(n.up, d); // left of travel direction d at node n

export function createTraffic(kit, graph, rnd) {
  const starts = graph.nodes.filter((n) => !n.ring && n.nbrs.length >= 2);
  const cars = [];
  const taken = new Set();
  for (let k = 0; k < CAR_COUNT && taken.size < starts.length; k++) {
    let n;
    do n = starts[Math.floor(rnd() * starts.length)];
    while (taken.has(n));
    taken.add(n);
    cars.push(new Car(kit, CAR_MODELS[k % CAR_MODELS.length], n, rnd));
  }
  return {
    cars,
    // people: world positions
    update(dt, people) {
      for (const car of cars) car.update(dt, cars, people);
    },
    // car bodies as world-space box colliders (see collision.js)
    colliders() {
      return cars.map((car) => car.collider());
    },
  };
}

class Car {
  constructor(kit, name, start, rnd) {
    this.rnd = rnd;
    this.obj = kit.clone(name);
    this.obj.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.wheels = [];
    this.obj.traverse((o) => o.name.startsWith('wheel') && this.wheels.push(o));
    // sit the lowest point of the model (the tyres) on the asphalt
    const box = kit.get(name).box;
    this.y = ROAD_SURFACE - box.min.y * CAR_SCALE;
    this.half = {
      w: ((box.max.x - box.min.x) / 2) * CAR_SCALE + 0.05,
      l: ((box.max.z - box.min.z) / 2) * CAR_SCALE + 0.05,
      c: ((box.max.z + box.min.z) / 2) * CAR_SCALE, // body centre along the car
      top: this.y + box.max.y * CAR_SCALE,
    };
    this.cruise = SPEED[0] + rnd() * (SPEED[1] - SPEED[0]);
    this.speed = 0;
    this.pos = new THREE.Vector3(); // on the ground
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.stuck = 0;
    this.ignoreCars = 0;
    // come from a random neighbour into the start tile
    this.prev = start.nbrs[Math.floor(rnd() * start.nbrs.length)];
    this.next = start;
    this.nextSegment();
    this.s = rnd() * this.length;
    this.place();
  }

  // Build the path across the next node (tile or roundabout), then move on past it.
  nextSegment() {
    const N = this.next;
    const P = this.prev;
    const dIn = dirTo(N, P).negate();
    const options = N.nbrs.filter((n) => n !== P);
    let out;
    if (!options.length) out = P; // dead end: turn round
    else if (N.ring) out = options[Math.floor(this.rnd() * options.length)];
    else {
      const straight = options.find((n) => dirTo(N, n).dot(dIn) > 0.9);
      out = straight && this.rnd() < 0.5 ? straight : options[Math.floor(this.rnd() * options.length)];
    }
    const dOut = dirTo(N, out);
    const E = N.p.clone().addScaledVector(dIn, -halfTo(N, P)).addScaledVector(left(N, dIn), LANE);
    const X = N.p.clone().addScaledVector(dOut, halfTo(N, out)).addScaledVector(left(N, dOut), LANE);
    if (N.ring) {
      // round the island clockwise (increasing angle in the roundabout's own axes)
      const { e1, e2 } = N.ring;
      const angle = (d) => Math.atan2(d.dot(e2), d.dot(e1));
      const slip = 0.45;
      const a0 = angle(dIn.clone().negate()) + slip;
      let a1 = angle(dOut) - slip;
      while (a1 < a0 + 0.3) a1 += Math.PI * 2;
      const pts = [E];
      const steps = Math.ceil((a1 - a0) / 0.35);
      for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        pts.push(N.p.clone().addScaledVector(e1, Math.cos(a) * RING).addScaledVector(e2, Math.sin(a) * RING));
      }
      pts.push(X);
      this.curve = new THREE.CatmullRomCurve3(pts);
      this.limit = 0.6;
    } else if (out === P) {
      const reach = dIn.clone().multiplyScalar(0.5 * T);
      this.curve = new THREE.CubicBezierCurve3(E, E.clone().add(reach), X.clone().add(reach), X);
      this.limit = 0.35;
    } else if (dOut.dot(dIn) > 0.9) {
      this.curve = new THREE.LineCurve3(E, X);
      this.limit = 1;
    } else {
      // corner where the two lane lines cross
      const C = E.clone().addScaledVector(dIn, X.clone().sub(E).dot(dIn));
      this.curve = new THREE.QuadraticBezierCurve3(E, C, X);
      this.limit = 0.6;
    }
    this.length = this.curve.getLength();
    this.prev = N;
    this.next = out;
  }

  place() {
    const u = THREE.MathUtils.clamp(this.s / this.length, 0, 1);
    this.curve.getPointAt(u, this.pos);
    upAt(this.pos, this.up);
    this.pos.copy(PLANET_CENTRE).addScaledVector(this.up, PLANET_RADIUS); // back onto the curved ground
    this.curve.getTangentAt(u, this.fwd);
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    const x = _v.crossVectors(this.up, this.fwd);
    this.obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, this.up, this.fwd));
    this.obj.position.copy(this.pos).addScaledVector(this.up, this.y);
    this.obj.scale.setScalar(CAR_SCALE);
  }

  // Is world point p within `reach` metres ahead of us and roughly in our lane?
  ahead(p, reach, halfWidth) {
    _v.subVectors(p, this.pos);
    if (Math.abs(_v.dot(this.up)) > 3) return false;
    const along = _v.dot(this.fwd);
    const lateral = Math.abs(_v.dot(_side.crossVectors(this.up, this.fwd)));
    return along > 0 && along < reach && lateral < halfWidth;
  }

  update(dt, cars, people) {
    const byPerson = people.some((p) => this.ahead(p, LOOK_AHEAD.person + this.half.l, 1.8));
    let byCar = false;
    if (this.ignoreCars > 0) this.ignoreCars -= dt;
    else byCar = cars.some((c) => c !== this && c.pos.distanceToSquared(this.pos) < 64 && this.ahead(c.pos, LOOK_AHEAD.car, 1.3));
    // two cars nose to nose at a junction could wait for each other forever; after a while, go
    this.stuck = byCar ? this.stuck + dt : 0;
    if (this.stuck > 2.5) {
      this.ignoreCars = 1.5;
      this.stuck = 0;
    }
    const target = byPerson || byCar ? 0 : this.cruise * this.limit;
    this.speed += THREE.MathUtils.clamp(target - this.speed, -BRAKE * dt, ACCEL * dt);
    this.speed = Math.max(0, this.speed);

    this.s += this.speed * dt;
    while (this.s >= this.length) {
      this.s -= this.length;
      this.nextSegment();
    }
    this.place();
    for (const w of this.wheels) w.rotation.x += (this.speed * dt) / (0.3 * CAR_SCALE);
  }

  collider() {
    const x = new THREE.Vector3().crossVectors(this.up, this.fwd); // across the car
    return {
      c: this.pos.clone().addScaledVector(this.fwd, this.half.c),
      ax: x,
      hx: this.half.w,
      hz: this.half.l,
      top: this.half.top,
    };
  }
}
const _side = new THREE.Vector3();
