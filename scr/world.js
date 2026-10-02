import * as THREE from 'three';
import { Kit, Batcher } from './kenney.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { layoutTown, layoutMap, MODELS, PAVE_H, SPAWN, T } from './town.js';
import { SITE_MAPS, siteFrame } from './sites.js';
import { LOCATIONS } from './locations.js';
import { buildGlobe } from './globe.js';
import { createTraffic, RoadGraph, CAR_MODELS } from './traffic.js';
import { createGarage, assignBays, VEHICLE_MODELS } from './vehicles.js';
import { Colliders, PavedTiles } from './collision.js';
import { PLANET_RADIUS, PLANET_CENTRE, bendGeometry, unbend, upAt, bend } from './planet.js';

// Pastel tiny planet built from Kenney kits: the main town on the north pole and five small towns
// round the planet (town.js lays out their maps, sites.js holds the small ones), the planet roads,
// forest and mountains between them (globe.js), and traffic on every road (traffic.js).
export const SKY = { top: '#8fc3ee', horizon: '#fbe3ec' };
export const FOG_COLOR = 0xf3e1ec;

const WATER = { color: 0x9ed9f2, roughness: 0.6 };
const WATER_Y = 0.07;
const BANK = { color: 0xf6e5c8, width: 0.7, height: 0.22 };

export async function createWorld(scene, manager) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(FOG_COLOR, 60, 320);

  // lights are re-aimed every frame to the local "up" of whoever the camera follows (see main.js)
  const hemi = new THREE.HemisphereLight(0xeef3ff, 0xf0d6e2, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1df, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const kit = new Kit(manager);
  await kit.load([...new Set([...MODELS, ...CAR_MODELS, ...VEHICLE_MODELS])]);

  const batch = new Batcher(kit);
  const maps = [{ id: 'town', layout: layoutTown(kit, batch) }];
  Object.entries(SITE_MAPS).forEach(([id, map], k) => {
    const loc = LOCATIONS.find((l) => l.id === id);
    const frame = siteFrame(loc.theta, loc.phi);
    maps.push({ id, layout: layoutMap(kit, batch, { map, frame, seed: 101 + k * 17, crossings: true, boats: true }) });
  });
  const colliders = new Colliders();
  const paved = new PavedTiles();
  for (const { layout } of maps) layout.colliders.forEach((c) => colliders.addMap(c, layout.frame));
  const rnd = maps[0].layout.rnd;
  const globe = buildGlobe({ kit, batch, colliders, paved, rnd, scene, snowMaterial, maps });
  const statics = new THREE.Group();
  batch.build(statics);
  scene.add(statics);

  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS, 192, 128),
    new THREE.MeshStandardMaterial({ color: 0xbfe7c8, roughness: 1 }),
  );
  ground.position.copy(PLANET_CENTRE);
  ground.receiveShadow = true;
  scene.add(ground);

  for (const { layout } of maps) {
    for (const p of layout.ponds) scene.add(pond(p, layout));
    scene.add(river(layout));
  }
  const clouds = makeClouds(rnd);
  scene.add(clouds);
  const life = makeLife(kit, scene, maps);

  // one road graph for the whole planet
  const graph = new RoadGraph();
  maps.forEach(({ layout }) => graph.addMap(layout));
  globe.chains.forEach((c) => graph.addChain(c));
  const traffic = createTraffic(kit, graph, rnd);
  traffic.cars.forEach((c) => scene.add(c.obj));

  // drivable vehicles in every parking bay: the main town's bays by the spawn point get the jetpack,
  // motorbikes, bicycles and one of every car; each small town gets a motorbike, bicycle and jetpack first
  const bays = [];
  for (const { id, layout } of maps) {
    if (id === 'town') bays.push(...assignBays(layout.bays, bend(SPAWN.clone())));
    else bays.push(...assignBays(layout.bays, layout.toWorld(0, 0, 0), ['moto', 'bike', 'jetpack']));
  }
  const garage = createGarage(kit, bays, scene);

  // to test whether a world point is on a town's paved ground, carry it back into that map's chart
  const inverse = maps.map(({ layout }) => (layout.frame ? layout.frame.clone().invert() : null));
  const _f = new THREE.Vector3();
  const world = {
    sun,
    hemi,
    traffic,
    garage,
    graph,
    locations: globe.locations,
    locationAt: (p) => globe.locationAt(p),
    spawn: SPAWN.clone(), // a point in the main town's map
    // height of the walking surface under world point p: roads and plazas are a little raised
    heightAt(p) {
      for (let k = 0; k < maps.length; k++) {
        const { layout } = maps[k];
        unbend(inverse[k] ? _f.copy(p).applyMatrix4(inverse[k]) : p, _f);
        if (Math.abs(_f.x) < layout.half + 2 && Math.abs(_f.z) < layout.half + 2) return layout.isPaved(_f.x, _f.z) ? PAVE_H : 0;
      }
      return paved.covers(p) ? PAVE_H : 0;
    },
    // push a walker or vehicle (chart-local pos, radius r) out of buildings, trees, water and cars
    // (`skip`: a vehicle's own body)
    collide: (chart, pos, r, skip) => colliders.pushOut(chart, pos, r, skip),
    clipCamera: (chart, target, cam, skip) => colliders.clipCamera(chart, target, cam, skip),
    // lookAt: what the camera looks at; people: world positions cars must not run over
    update(dt, camera, lookAt, people) {
      clouds.rotation.y += dt * 0.01;
      hideInFront(clouds.children, camera, lookAt, 30);
      traffic.update(dt, people);
      garage.update(dt, world);
      colliders.dynamic = traffic.colliders().concat(garage.colliders());
      life(dt);
    },
  };
  return world;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SKY.top);
  grad.addColorStop(0.65, '#c9dcf5');
  grad.addColorStop(1, SKY.horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Flat-shaded lilac rock with a snow cap painted above `snowLine` metres over the ground.
function snowMaterial(color, snowLine) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.snowLine = { value: snowLine };
    sh.uniforms.planetCentre = { value: PLANET_CENTRE };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vHeight;\nuniform vec3 planetCentre;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 snowPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          snowPos = instanceMatrix * snowPos;
        #endif
        vHeight = length((modelMatrix * snowPos).xyz - planetCentre) - ${PLANET_RADIUS.toFixed(1)};`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHeight;\nuniform float snowLine;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.98, 1.0), smoothstep(snowLine - 1.5, snowLine + 1.5, vHeight));`,
      );
  };
  return mat;
}

// Bend flat map-chart geometry onto the sphere and carry it to the map's place.
function onPlanet(geo, layout) {
  bendGeometry(geo);
  return layout.frame ? geo.applyMatrix4(layout.frame) : geo;
}

// A map's river and lake tiles: one tessellated water sheet and sandy banks wherever water meets land.
function river(layout) {
  const { water: tiles, tileX } = layout;
  const wet = new Set(tiles.map(([i, j]) => `${i},${j}`));
  const sheets = [];
  const banks = [];
  for (const [i, j] of tiles) {
    sheets.push(new THREE.PlaneGeometry(T, T, 3, 3).rotateX(-Math.PI / 2).translate(tileX(i), WATER_Y, tileX(j)));
    for (const [di, dj] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      if (wet.has(`${i + di},${j + dj}`)) continue;
      const g = new THREE.BoxGeometry(di ? BANK.width : T + BANK.width, BANK.height, dj ? BANK.width : T + BANK.width, di ? 1 : 4, 1, dj ? 1 : 4);
      banks.push(g.toNonIndexed().translate(tileX(i) + (di * T) / 2, BANK.height / 2, tileX(j) + (dj * T) / 2));
    }
  }
  const g = new THREE.Group();
  if (!tiles.length) return g;
  const water = new THREE.Mesh(onPlanet(mergeGeometries(sheets), layout), new THREE.MeshStandardMaterial(WATER));
  water.receiveShadow = true;
  g.add(water);
  if (banks.length) {
    const bank = new THREE.Mesh(onPlanet(mergeGeometries(banks), layout), new THREE.MeshStandardMaterial({ color: BANK.color, roughness: 1, flatShading: true }));
    bank.receiveShadow = bank.castShadow = true;
    g.add(bank);
  }
  return g;
}

function pond({ x, z, r, y = 0 }, layout) {
  const g = new THREE.Group();
  const flat = (geo, lift) => onPlanet(geo.rotateX(-Math.PI / 2).translate(x, y + lift, z), layout);
  const water = new THREE.Mesh(flat(new THREE.RingGeometry(0, r, 48, 6), 0.03), new THREE.MeshStandardMaterial(WATER));
  const rim = new THREE.Mesh(flat(new THREE.RingGeometry(r, r + 0.6, 48), 0.05), new THREE.MeshStandardMaterial({ color: 0xf6e5c8, roughness: 1 }));
  water.receiveShadow = rim.receiveShadow = true;
  g.add(water, rim);
  return g;
}

// Little things that move: windmill blades, chimney smoke and campfire flames.
function makeLife(kit, scene, maps) {
  const blades = [];
  for (const { layout } of maps) {
    for (const m of layout.spinners) {
      const mill = kit.clone('industrial/windmill');
      mill.matrixAutoUpdate = false;
      mill.matrix.copy(m).multiply(mill.matrix.clone().compose(mill.position, mill.quaternion, mill.scale)); // keep the kit's recentring
      mill.traverse((o) => {
        if (o.isMesh) o.castShadow = o.receiveShadow = true;
      });
      scene.add(mill);
      const b = mill.getObjectByName('blades');
      if (b) blades.push({ b, speed: 1.2 + Math.random() * 0.8 });
    }
  }

  const puffGeo = new THREE.IcosahedronGeometry(1, 0);
  const puffs = [];
  for (const { layout } of maps) {
    for (const top of layout.smokers) {
      const up = upAt(top);
      for (let k = 0; k < 5; k++) {
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xf4ecf8, emissiveIntensity: 0.4, transparent: true, flatShading: true });
        const puff = new THREE.Mesh(puffGeo, mat);
        scene.add(puff);
        puffs.push({ puff, top, up, phase: k / 5, drift: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize() });
      }
    }
  }

  const flames = [];
  const flameGeo = new THREE.ConeGeometry(0.35, 1.1, 5);
  const flameMats = [0xffb35c, 0xff8a7a, 0xffe08a].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  for (const { layout } of maps) {
    for (const p of layout.fires) {
      const up = upAt(p);
      for (let k = 0; k < 3; k++) {
        const f = new THREE.Mesh(flameGeo, flameMats[k]);
        f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
        scene.add(f);
        flames.push({ f, p, up, k });
      }
    }
  }

  let t = 0;
  return (dt) => {
    t += dt;
    for (const { b, speed } of blades) b.rotation.x += dt * speed;
    for (const s of puffs) {
      const a = (t * 0.25 + s.phase) % 1; // 0 → 1 over four seconds
      s.puff.position.copy(s.top).addScaledVector(s.up, 0.4 + a * 7).addScaledVector(s.drift, a * 2.5);
      s.puff.scale.setScalar(0.5 + a * 1.6);
      s.puff.material.opacity = 0.85 * (1 - a);
    }
    for (const { f, p, up, k } of flames) {
      const flicker = 0.75 + 0.25 * Math.sin(t * (9 + k * 3) + k * 2);
      f.scale.set(1 - k * 0.2, flicker * (1.1 - k * 0.25), 1 - k * 0.2);
      f.position.copy(p).addScaledVector(up, 0.45 * flicker * (1.1 - k * 0.25));
    }
  };
}

// Low-poly clouds drifting round the planet; the group spins about the planet's axis.
function makeClouds(rnd) {
  const group = new THREE.Group();
  group.position.copy(PLANET_CENTRE);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff0f6, emissiveIntensity: 0.35, flatShading: true });
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < 22; k++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rnd() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(geo, mat);
      const s = 4 + rnd() * 5;
      puff.scale.set(s * 1.3, s * 0.8, s);
      puff.position.set((p - puffs / 2) * 5 + rnd() * 3, rnd() * 3, rnd() * 4);
      puff.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      cloud.add(puff);
    }
    const th = Math.acos(1 - 2 * rnd());
    const ph = rnd() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    cloud.position.copy(dir).multiplyScalar(PLANET_RADIUS + 30 + rnd() * 18);
    cloud.quaternion.setFromUnitVectors(up, dir);
    cloud.rotateY(rnd() * Math.PI);
    group.add(cloud);
  }
  return group;
}

// The isometric camera sits far away, so clouds on its side of the planet would cover the view.
// Hide any that are more than `margin` metres nearer the camera than what it looks at.
const _fwd = new THREE.Vector3();
const _p = new THREE.Vector3();
function hideInFront(objects, camera, lookAt, margin) {
  camera.getWorldDirection(_fwd);
  const targetDepth = _p.copy(lookAt).sub(camera.position).dot(_fwd);
  for (const o of objects) {
    if (!camera.isOrthographicCamera) {
      o.visible = true;
      continue;
    }
    o.visible = o.getWorldPosition(_p).sub(camera.position).dot(_fwd) > targetDepth - margin;
  }
}
