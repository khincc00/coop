import * as THREE from 'three';
import { SurfaceChart, upAt } from './planet.js';

// Vehicles anyone can use: every kind of car from the Kenney car kit, plus a motorbike, a bicycle
// and a jetpack (built here from simple shapes in the same pastel low-poly style). They wait in the
// parking bays ('v' tiles of the maps). Walk up and press E to get in or put the jetpack on.
//   maxSpeed m/s · accel m/s² · turn rad/s at speed · circles: collision circles along the body
//   (offset forward in metres, radius) · seat: where a rider sits (forward, height) · reverse factor
const CAR = { kind: 'car', maxSpeed: 14, accel: 6, turn: 1.6, circles: [[0.8, 0.85], [-0.8, 0.85]] };
export const VEHICLE_TYPES = {
  sedan: { ...CAR, name: 'Sedan' },
  'sedan-sports': { ...CAR, name: 'Mobil Sport', maxSpeed: 18, accel: 8 },
  'hatchback-sports': { ...CAR, name: 'Hatchback Sport', maxSpeed: 17, accel: 8 },
  suv: { ...CAR, name: 'SUV', maxSpeed: 14, accel: 6 },
  'suv-luxury': { ...CAR, name: 'SUV Mewah', maxSpeed: 15, accel: 6.5 },
  taxi: { ...CAR, name: 'Taksi' },
  police: { ...CAR, name: 'Mobil Polisi', maxSpeed: 17, accel: 7.5 },
  ambulance: { ...CAR, name: 'Ambulans', maxSpeed: 15, accel: 6, circles: [[1, 0.85], [-0.9, 0.85]] },
  firetruck: { ...CAR, name: 'Mobil Pemadam', maxSpeed: 12, accel: 4, turn: 1.2, circles: [[1.4, 0.9], [0, 0.9], [-1.4, 0.9]] },
  van: { ...CAR, name: 'Van', maxSpeed: 12, accel: 5, turn: 1.4 },
  delivery: { ...CAR, name: 'Mobil Boks', maxSpeed: 12, accel: 4.5, turn: 1.3, circles: [[1.1, 0.9], [-1, 0.9]] },
  truck: { ...CAR, name: 'Truk', maxSpeed: 11, accel: 4, turn: 1.2, circles: [[1.3, 0.9], [0, 0.9], [-1.3, 0.9]] },
  'garbage-truck': { ...CAR, name: 'Truk Sampah', maxSpeed: 10, accel: 3.5, turn: 1.2, circles: [[1.3, 0.9], [0, 0.9], [-1.3, 0.9]] },
  race: { ...CAR, name: 'Mobil Balap', maxSpeed: 22, accel: 10, turn: 1.8 },
  'race-future': { ...CAR, name: 'Mobil Balap Futuristik', maxSpeed: 24, accel: 11, turn: 1.9 },
  'kart-oobi': { ...CAR, name: 'Gokart', maxSpeed: 13, accel: 9, turn: 2.3, circles: [[0.4, 0.7], [-0.4, 0.7]] },
  tractor: { ...CAR, name: 'Traktor', maxSpeed: 7, accel: 3, turn: 1.4 },
  moto: { kind: 'moto', name: 'Motor', maxSpeed: 17, accel: 9, turn: 2, circles: [[0.45, 0.42], [-0.45, 0.42]], seat: [-0.15, 0.86] },
  bike: { kind: 'bike', name: 'Sepeda', maxSpeed: 6.5, accel: 3, turn: 2.2, circles: [[0.35, 0.35], [-0.35, 0.35]], seat: [-0.22, 0.92] },
  jetpack: { kind: 'jetpack', name: 'Jetpack', circles: [[0, 0.4]] },
};
export const CAR_KINDS = Object.keys(VEHICLE_TYPES).filter((k) => VEHICLE_TYPES[k].kind === 'car');
export const VEHICLE_MODELS = CAR_KINDS.map((k) => `cars/${k}`);
const CAR_SCALE = 1.15;
const BRAKE = 12;
const DRAG = 3;
const REACH = 3.2; // how close you must be to use a vehicle
// where a worn jetpack sits on a character: on the back, relative to the character's hip pivot
export const JETPACK_SPOT = new THREE.Vector3(0, 0.22, -0.2);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...extra });
const PASTEL = { body: [0xf59a9a, 0x9cc8f5, 0xb9a6f0, 0x8fdcc2, 0xf5d77e], dark: 0x4a4a5e, tyre: 0x3c3c4a, metal: 0xc9c9d8 };

// A wheel turning about the vehicle's x axis: tyre (torus) and hub.
function wheel(radius, tube, color) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(radius - tube, tube, 6, 14), mat(PASTEL.tyre));
  tyre.rotation.y = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, tube * 1.6, 8), mat(color));
  hub.rotation.z = Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(tube * 1.2, radius * 1.7, tube * 0.6), mat(PASTEL.metal));
  g.add(tyre, hub, spoke);
  return g;
}
function rod(from, to, r, color) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

function buildMoto(color) {
  const g = new THREE.Group();
  const wheels = [wheel(0.34, 0.1, color), wheel(0.34, 0.1, color)];
  wheels[0].position.set(0, 0.34, 0.68);
  wheels[1].position.set(0, 0.34, -0.66);
  g.add(...wheels);
  g.add(box(0.26, 0.28, 0.85, color, 0, 0.6, 0)); // body
  g.add(box(0.34, 0.22, 0.42, color, 0, 0.8, 0.22)); // tank
  g.add(box(0.3, 0.09, 0.55, PASTEL.dark, 0, 0.82, -0.22)); // seat
  g.add(box(0.22, 0.08, 0.4, color, 0, 0.66, -0.62)); // rear fender
  g.add(rod([0, 0.36, 0.68], [0, 1.0, 0.5], 0.03, PASTEL.metal)); // fork
  g.add(rod([-0.32, 1.02, 0.48], [0.32, 1.02, 0.48], 0.025, PASTEL.dark)); // handlebar
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0xfff3b0, { emissive: 0xffe9a0, emissiveIntensity: 0.6 }));
  lamp.position.set(0, 0.88, 0.62);
  g.add(lamp, rod([0.1, 0.45, -0.2], [0.12, 0.42, -0.75], 0.035, PASTEL.metal)); // exhaust
  return { group: g, wheels };
}

function buildBike(color) {
  const g = new THREE.Group();
  const wheels = [wheel(0.34, 0.035, color), wheel(0.34, 0.035, color)];
  wheels[0].position.set(0, 0.34, 0.52);
  wheels[1].position.set(0, 0.34, -0.52);
  g.add(...wheels);
  const pedal = [0, 0.38, -0.02];
  g.add(rod(pedal, [0, 0.82, 0.32], 0.025, color)); // down tube
  g.add(rod([0, 0.86, -0.24], [0, 0.82, 0.32], 0.025, color)); // top tube
  g.add(rod(pedal, [0, 0.88, -0.25], 0.025, color)); // seat tube
  g.add(rod(pedal, [0, 0.34, -0.52], 0.02, color)); // chain stay
  g.add(rod([0, 0.86, -0.24], [0, 0.34, -0.52], 0.02, color)); // seat stay
  g.add(rod([0, 0.34, 0.52], [0, 1.0, 0.38], 0.022, PASTEL.metal)); // fork
  g.add(rod([-0.28, 1.0, 0.38], [0.28, 1.0, 0.38], 0.02, PASTEL.dark)); // handlebar
  g.add(box(0.14, 0.05, 0.26, PASTEL.dark, 0, 0.92, -0.25)); // saddle
  const crank = new THREE.Group();
  crank.position.set(...pedal);
  crank.add(box(0.04, 0.32, 0.04, PASTEL.metal, 0.06, 0, 0), box(0.1, 0.03, 0.06, PASTEL.dark, 0.11, 0.16, 0), box(0.1, 0.03, 0.06, PASTEL.dark, 0.11, -0.16, 0));
  g.add(crank);
  return { group: g, wheels, crank };
}

// Jetpack: two tanks on a back plate, nozzles underneath and flames that show while flying.
export function buildJetpack(color) {
  const g = new THREE.Group();
  g.add(box(0.36, 0.42, 0.07, PASTEL.dark, 0, 0, 0.05));
  const flames = [];
  for (const x of [-0.12, 0.12]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 10), mat(color));
    tank.position.set(x, 0.02, -0.06);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
    cap.position.set(x, 0.23, -0.06);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.1, 8), mat(PASTEL.metal));
    nozzle.position.set(x, -0.24, -0.06);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.9 }));
    flame.rotation.x = Math.PI;
    flame.position.set(x, -0.54, -0.06);
    flame.visible = false;
    g.add(tank, cap, nozzle, flame);
    flames.push(flame);
  }
  return { group: g, flames };
}

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();

export class Vehicle {
  constructor(type, point, forward, kit, colorIndex = 0) {
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    this.name = this.spec.name;
    this.kind = this.spec.kind;
    this.driver = null;
    this.speed = 0;
    this.yaw = 0; // heading in the chart: forward is (sin yaw, cos yaw)
    this.steer = 0;
    this.roll = 0;
    this.y = 0;
    const up = upAt(point);
    const fz = forward.clone().addScaledVector(up, -forward.dot(up)).normalize();
    this.chart = new SurfaceChart(point, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, fz), up, fz)));
    this.obj = new THREE.Group();
    this.wheels = [];
    this.frontWheels = [];
    const color = PASTEL.body[colorIndex % PASTEL.body.length];
    if (this.kind === 'car') {
      const model = kit.clone(`cars/${type}`);
      const box = kit.get(`cars/${type}`).box;
      model.scale.setScalar(CAR_SCALE);
      model.position.y = -box.min.y * CAR_SCALE;
      model.traverse((o) => {
        if (o.isMesh) o.castShadow = o.receiveShadow = true;
        if (o.name.startsWith('wheel')) {
          o.rotation.order = 'YXZ';
          this.wheels.push(o);
          if (o.name.includes('front')) this.frontWheels.push(o);
        }
      });
      this.obj.add(model);
      this.half = { w: ((box.max.x - box.min.x) / 2) * CAR_SCALE, l: ((box.max.z - box.min.z) / 2) * CAR_SCALE, top: (box.max.y - box.min.y) * CAR_SCALE };
      this.wheelRadius = 0.3 * CAR_SCALE;
    } else if (this.kind === 'moto' || this.kind === 'bike') {
      const built = this.kind === 'moto' ? buildMoto(color) : buildBike(color);
      this.obj.add(built.group);
      this.wheels = built.wheels;
      this.frontWheels = [built.wheels[0]];
      this.crank = built.crank;
      this.half = { w: 0.3, l: this.kind === 'moto' ? 1 : 0.85, top: 1.1 };
      this.wheelRadius = 0.34;
    } else {
      // jetpack standing on a little landing pad
      const built = buildJetpack(color);
      built.group.position.y = 0.45;
      this.pack = built;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 16), mat(0xf6e5c8));
      pad.position.y = 0.03;
      this.obj.add(pad, built.group);
      this.half = { w: 0.4, l: 0.4, top: 0.9 };
    }
    this.obj.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
  }

  // ctl: { throttle: -1..1, steer: -1..1 } from the driver, or nothing (parked / coasting)
  update(dt, ctl, world) {
    if (this.kind === 'jetpack') return this.place();
    if (!ctl && Math.abs(this.speed) < 0.01) {
      this.speed = 0; // parked: nothing to do
      return;
    }
    const s = this.spec;
    const throttle = ctl?.throttle ?? 0;
    const target = throttle > 0 ? s.maxSpeed : throttle < 0 ? -s.maxSpeed * 0.35 : 0;
    const braking = throttle !== 0 && Math.sign(throttle) !== Math.sign(this.speed) && Math.abs(this.speed) > 0.2;
    const rate = braking ? BRAKE : throttle ? s.accel : DRAG;
    this.speed += THREE.MathUtils.clamp(target - this.speed, -rate * dt, rate * dt);
    this.steer += ((ctl?.steer ?? 0) - this.steer) * (1 - Math.exp(-8 * dt));
    // steering bites harder as speed picks up, and reverses when backing up
    this.yaw -= this.steer * s.turn * THREE.MathUtils.clamp(Math.abs(this.speed) / 4, 0, 1) * Math.sign(this.speed) * dt;

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const move = new THREE.Vector3(fx * this.speed * dt, 0, fz * this.speed * dt);
    // keep every collision circle along the body out of walls, trees, water and other cars
    let bump = 0;
    for (const [off, r] of s.circles) {
      const p = new THREE.Vector3(move.x + fx * off, this.y + 0.3, move.z + fz * off);
      const before = p.clone();
      world.collide(this.chart, p, r, this);
      move.x += p.x - before.x;
      move.z += p.z - before.z;
      bump += Math.hypot(p.x - before.x, p.z - before.z);
    }
    if (bump > 0.01) this.speed *= Math.exp(-6 * dt) * (bump > 0.05 ? 0.6 : 1);
    this.chart.move(move.x, move.z);
    const ground = world.heightAt(this.chart.point);
    this.y += (ground - this.y) * (1 - Math.exp(-12 * dt));

    for (const w of this.wheels) w.rotation.x += (this.speed * dt) / this.wheelRadius;
    for (const w of this.frontWheels) w.rotation.y = this.steer * 0.45;
    if (this.crank) this.crank.rotation.x += (this.speed * dt) / 0.6;
    // two-wheelers lean into the turn
    const lean = this.kind === 'car' ? 0 : -this.steer * THREE.MathUtils.clamp(Math.abs(this.speed) / this.spec.maxSpeed, 0, 1) * 0.4;
    this.roll += (lean - this.roll) * (1 - Math.exp(-6 * dt));
    this.place();
  }

  place() {
    this.chart.toWorld(0, this.y, 0, this.obj.position);
    this.obj.quaternion.copy(this.chart.quat).multiply(_q.setFromAxisAngle(Y, this.yaw)).multiply(_q.setFromAxisAngle(Z, this.roll));
  }

  // where a rider's feet go (world), with the rider's hips on the seat
  seat(hips, out = new THREE.Vector3()) {
    const [forward, height] = this.spec.seat;
    this.obj.updateMatrixWorld();
    return this.obj.localToWorld(out.set(0, height - hips, forward));
  }

  collider() {
    const up = upAt(this.chart.point);
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).applyQuaternion(this.chart.quat);
    return { c: this.chart.point.clone(), ax: new THREE.Vector3().crossVectors(up, f), hx: this.half.w, hz: this.half.l, top: this.y + this.half.top, owner: this };
  }
}

// All the vehicles of the world: one in every parking bay.
export function createGarage(kit, bays, scene) {
  const vehicles = bays.map(({ point, forward, type }, k) => {
    const v = new Vehicle(type, point, forward, kit, k);
    v.place();
    scene.add(v.obj);
    return v;
  });
  return {
    vehicles,
    // the free vehicle nearest world point p, if one is within reach
    nearest(p) {
      let best = null;
      let bestD = REACH;
      for (const v of vehicles) {
        if (v.driver || v.worn) continue;
        const d = v.chart.point.distanceTo(p);
        if (d < bestD) [best, bestD] = [v, d];
      }
      return best;
    },
    update(dt, world) {
      for (const v of vehicles) if (!v.worn) v.update(dt, v.driver?.controls, world);
    },
    colliders() {
      return vehicles.filter((v) => !v.worn).map((v) => v.collider());
    },
  };
}

// Which vehicle waits in which bay: the bays nearest `start` get the jetpack, motorbikes and bicycles,
// then every kind of car in turn.
export function assignBays(bays, start, extras = ['jetpack', 'moto', 'bike', 'moto', 'bike']) {
  const order = [...bays].sort((a, b) => a.point.distanceTo(start) - b.point.distanceTo(start));
  const list = [...extras, ...CAR_KINDS];
  order.forEach((bay, k) => (bay.type = list[k % list.length]));
  return order;
}

