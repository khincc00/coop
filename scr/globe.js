import * as THREE from 'three';
import { PLANET_RADIUS, surfacePoint, upAt, unbend, standAt, bendGeometry } from './planet.js';
import { T, PAVE_LIFT, PLANET_ROAD_START, FLOWER_SCALE, TREES, PINES, FLOWERS, BUSHES, ROCKS, MOUNTAINS } from './town.js';
import { SITE_SIZE } from './sites.js';
import { LOCATIONS } from './locations.js';

// Everything between the towns, placed straight on the sphere: the planet roads, the forest,
// snow and mountains, plus the floating name tags and mission markers of every location.
const R = PLANET_RADIUS;
const HALF_PI = Math.PI / 2;
// The planet roads are great circles, so straight Kenney tiles lie on them without gaps: the equator,
// and the meridians phi = 0 / π and phi = ±π/2 that carry the main town's avenues to the south pole.
const MERIDIANS = [-HALF_PI, 0, HALF_PI, Math.PI];
const SITE_LINK = (((SITE_SIZE - 1) / 2 + 1) * T) / R; // angle from a small town's centre to where its avenues hand over
const ROAD_CLEAR = 7; // metres kept free of trees either side of a road's centre line

export function buildGlobe({ kit, batch, colliders, paved, rnd, scene, snowMaterial, maps }) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const range = (a, b) => a + rnd() * (b - a);
  const Y = new THREE.Vector3(0, 1, 0);

  // Stand a model at world point p facing `forward`; optionally block people with its footprint.
  function place(name, p, forward, scale = 1, { lift = 0, collide = false, shadow = true, material } = {}) {
    const m = standAt(p, forward, scale, lift);
    batch.add(name, m, { shadow, material });
    if (!collide) return;
    const box = kit.get(name).box;
    const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale;
    colliders.add({ c: p.clone(), r: 0.4 * Math.max((box.max.x - box.min.x) * s.x, (box.max.z - box.min.z) * s.z), top: lift + box.max.y * s.y });
  }
  const tangentAt = (p, v) => v.clone().addScaledVector(upAt(p), -v.dot(upAt(p))).normalize();
  const randomForward = (p) => tangentAt(p, new THREE.Vector3(range(-1, 1), range(-1, 1), range(-1, 1)));

  // ---- planet roads ----
  const chains = []; // each road between two towns as a list of tile centres, for the traffic
  function roadRun(from, to, pointAt, directionAt, sideAt) {
    const n = Math.max(1, Math.round(Math.abs(to - from) / (T / R)));
    const step = (to - from) / n;
    const len = Math.abs(step) * R;
    const chain = [];
    for (let k = 0; k <= n; k++) {
      const a = from + k * step;
      const p = pointAt(a);
      const ax = tangentAt(p, directionAt(a));
      // straight tiles run along their local x, so their +z (forward) is x × up
      place('roads/road-straight', p, new THREE.Vector3().crossVectors(ax, upAt(p)), new THREE.Vector3(len, T, T), { lift: PAVE_LIFT, shadow: false });
      paved.add({ c: p.clone(), ax, hx: len / 2, hz: T / 2 });
      if (k % 3 === 1) {
        const side = sideAt(a).multiplyScalar(k % 2 ? 1 : -1);
        const q = p.clone().addScaledVector(side, 0.44 * T);
        place('roads/light-curved', q, side, T); // the arm points along -z: face it away from the road
        colliders.add({ c: q, r: 0.15, top: 4 });
      }
      chain.push(p);
    }
    chains.push(chain);
  }
  const meridianTangent = (ph) => (th) => new THREE.Vector3(Math.cos(th) * Math.cos(ph), -Math.sin(th), Math.cos(th) * Math.sin(ph));
  const equatorTangent = (ph) => new THREE.Vector3(-Math.sin(ph), 0, Math.cos(ph));
  for (const ph of MERIDIANS) {
    const along = (th) => surfacePoint(th, ph);
    const side = () => equatorTangent(ph);
    roadRun(PLANET_ROAD_START / R, HALF_PI - SITE_LINK, along, meridianTangent(ph), side); // main town → equator town
    roadRun(HALF_PI + SITE_LINK, Math.PI - SITE_LINK, along, meridianTangent(ph), side); // equator town → south pole
    roadRun(ph + SITE_LINK, ph + HALF_PI - SITE_LINK, (a) => surfacePoint(HALF_PI, a), equatorTangent, () => Y.clone()); // along the equator
  }

  // ---- where the towns are ----
  const inv = maps.map((m) => (m.layout.frame ? m.layout.frame.clone().invert() : null));
  const _f = new THREE.Vector3();
  const inMap = (p, pad) =>
    maps.some((m, k) => {
      unbend(inv[k] ? _f.copy(p).applyMatrix4(inv[k]) : p, _f);
      return Math.abs(_f.x) < m.layout.half + pad && Math.abs(_f.z) < m.layout.half + pad;
    });
  function roadDistance(p) {
    const u = upAt(p);
    const th = Math.acos(THREE.MathUtils.clamp(u.y, -1, 1));
    let d = Math.abs(th - HALF_PI) * R; // equator
    if (th > PLANET_ROAD_START / R - 0.05) d = Math.min(d, Math.asin(Math.min(1, Math.abs(u.x))) * R, Math.asin(Math.min(1, Math.abs(u.z))) * R);
    return d;
  }

  // ---- labels and mission markers ----
  const locations = [];
  const extras = new THREE.Group();
  for (const loc of LOCATIONS) {
    const map = maps.find((m) => m.id === loc.id) ?? maps.find((m) => m.id === 'town');
    const centre = surfacePoint(loc.theta, loc.phi);
    // the marker sits on the grassy corner of the town's roundabout
    const point = map.layout.toWorld(6.5, 0, 6.5);
    locations.push({ id: loc.id, name: loc.name, desc: loc.desc, centre, point, radius: loc.radius });
    const ring = bendGeometry(new THREE.RingGeometry(1.8, 2.4, 40, 1).rotateX(-Math.PI / 2).translate(6.5, 0.25, 6.5));
    if (map.layout.frame) ring.applyMatrix4(map.layout.frame);
    extras.add(new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xff8fbf, transparent: true, opacity: 0.85, side: THREE.DoubleSide })));
    extras.add(label(loc.name, centre.clone().addScaledVector(upAt(centre), loc.id === 'alun-alun' ? 24 : 20)));
  }

  // ---- the south pole: snowfield and snowy peaks between the roads ----
  const pole = maps.find((m) => m.id === 'puncak-salju');
  if (pole) {
    const snow = bendGeometry(new THREE.RingGeometry(0, 48, 96, 24).rotateX(-Math.PI / 2).translate(0, 0.03, 0)).applyMatrix4(pole.layout.frame);
    const field = new THREE.Mesh(snow, new THREE.MeshStandardMaterial({ color: 0xf7f5ff, roughness: 1 }));
    field.receiveShadow = true;
    extras.add(field);
    const mat = snowMaterial(0xc9c3ea, 9);
    for (let k = 0; k < 16; k++) {
      const a = Math.PI / 4 + Math.floor(k / 4) * HALF_PI + ((k % 4) - 1.5) * 0.18 + range(-0.05, 0.05);
      const d = range(62, 74);
      const p = pole.layout.toWorld(Math.cos(a) * d, 0, Math.sin(a) * d);
      const name = pick(MOUNTAINS);
      const size = kit.get(name).box.getSize(new THREE.Vector3());
      const wd = range(16, 26);
      const ht = range(15, 26);
      place(name, p, randomForward(p), new THREE.Vector3(wd / size.x, ht / size.y, wd / size.z), { lift: -1, shadow: false, material: mat, collide: true });
    }
  }
  scene.add(extras);

  // ---- forest, flowers and rocks everywhere else ----
  const randomPoint = () => surfacePoint(Math.acos(1 - 2 * rnd()), rnd() * Math.PI * 2);
  for (let k = 0; k < 11000; k++) {
    const p = randomPoint();
    if (roadDistance(p) < ROAD_CLEAR || inMap(p, 4)) continue;
    if (rnd() > 0.42) continue;
    const th = Math.acos(upAt(p).y);
    const scale = range(2.6, 4.2);
    // pines take over towards the cold south
    place(pick(rnd() < THREE.MathUtils.smoothstep(th, 1.7, 2.5) ? PINES : TREES), p, randomForward(p), scale);
    colliders.add({ c: p, r: 0.12 * scale, top: 2 });
  }
  for (let k = 0; k < 4000; k++) {
    const p = randomPoint();
    if (roadDistance(p) < 4 || inMap(p, 0)) continue;
    const roll = rnd();
    if (roll < 0.55) place(pick(FLOWERS), p, randomForward(p), FLOWER_SCALE, { shadow: false });
    else if (roll < 0.85) place(pick(BUSHES), p, randomForward(p), 4);
    else if (roadDistance(p) > 8) place(pick(ROCKS), p, randomForward(p), range(3, 6), { collide: true });
  }

  // ---- mountain ranges on the southern half, between the roads ----
  const mountainMat = snowMaterial(0xc4b3e3, 24);
  for (let k = 0; k < 20; k++) {
    const th = range(1.95, 2.4);
    const ph = MERIDIANS[k % 4] + Math.PI / 4 + range(-0.4, 0.4);
    const p = surfacePoint(th, ph);
    if (roadDistance(p) < 20 || inMap(p, 14)) continue;
    const name = pick(MOUNTAINS);
    const size = kit.get(name).box.getSize(new THREE.Vector3());
    const wd = range(22, 36);
    const ht = range(16, 30);
    place(name, p, randomForward(p), new THREE.Vector3(wd / size.x, ht / size.y, wd / size.z), { lift: -1, shadow: false, material: mountainMat, collide: true });
  }

  return {
    chains,
    locations,
    // where is world point p? (the named location whose radius it is inside, or null)
    locationAt(p) {
      return locations.find((l) => l.centre.distanceTo(p) < l.radius) ?? null;
    },
  };
}

// Floating name tag that always faces the camera.
function label(text, position) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 44px system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 56;
  c.width = w;
  c.height = 76;
  g.font = font;
  g.fillStyle = 'rgba(255, 255, 255, 0.92)';
  g.beginPath();
  g.roundRect(2, 2, w - 4, 72, 36);
  g.fill();
  g.fillStyle = '#7a5aa6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  const h = 3.8;
  sprite.scale.set((h * w) / 76, h, 1);
  sprite.position.copy(position);
  sprite.renderOrder = 10;
  return sprite;
}
