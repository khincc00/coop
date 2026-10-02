import * as THREE from 'three';
import { loadCharacterAssets, Character, CHARACTERS } from './character.js';
import { IDLE_INPUT, Input } from './input.js';
import { createWorld } from './world.js';
import { Walker } from './walker.js';
import { PLANET_CENTRE, bend, upAt } from './planet.js';
import { JETPACK_SPOT } from './vehicles.js';

const CAM_DIST = { min: 2, max: 12, start: 5 };
const CAM_PITCH = { min: -0.3, max: 1.2, start: 0.35 };
const CAM_TARGET_HEIGHT = 1.2;
const MOUSE_SENS = 0.0025;
const PLAYER_GAP = 0.7; // characters push each other apart below this distance
const PLAYER_RADIUS = 0.4;
// Isometric view: true-iso pitch, orthographic, follows the active character. V toggles, Z/X rotate.
const ISO_PITCH = Math.atan(1 / Math.SQRT2);
const ISO_ZOOM = { min: 10, max: 150, start: 45 }; // half the visible height, metres
const ISO_DIST = 400;
const ISO_GLOBE_ZOOM = [50, 150]; // zooming out across this range slides the view onto the planet's centre
const SUN_OFFSET = new THREE.Vector3(0.45, 0.8, 0.35).setLength(150);
const DRIVE_CAM_DIST = { car: 8, moto: 5.5, bike: 5 }; // follow camera pulls back for bigger vehicles

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const persp = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1500);
const iso = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
const input = new Input();

const loadingEl = document.getElementById('loading');
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, done, total) => {
  loadingEl.textContent = `Memuat aset… ${done}/${total}`;
};

const [world, assets] = await Promise.all([createWorld(scene, manager), loadCharacterAssets(manager)]);
loadingEl.remove();

const walkers = CHARACTERS.map((def, i) => {
  const character = new Character(assets[def.id]);
  scene.add(character.root);
  const spawn = world.spawn.clone().add(new THREE.Vector3((i - (CHARACTERS.length - 1) / 2) * 1.5, 0, 0));
  return new Walker(character, world, spawn);
});
let active = 0;

const cam = {
  mode: 'iso',
  yaw: 0,
  pitch: CAM_PITCH.start,
  dist: CAM_DIST.start,
  isoYaw: Math.PI / 4,
  isoYawTarget: Math.PI / 4,
  isoZoom: ISO_ZOOM.start,
};
const camYaw = () => (cam.mode === 'iso' ? cam.isoYaw : cam.yaw);
function setMode(mode) {
  cam.mode = mode;
  if (mode === 'iso') document.exitPointerLock?.();
  else cam.yaw = cam.isoYaw; // keep facing the same way when dropping into third person
}

// The camera follows a smoothed point above the active character and a smoothed copy of its chart's
// axes, so it turns with the planet as the character walks round it.
const camTarget = new THREE.Vector3();
const camQuat = new THREE.Quaternion();
function snapCamera() {
  const w = walkers[active];
  camTarget.copy(w.position).addScaledVector(upAt(w.position), CAM_TARGET_HEIGHT);
  camQuat.copy(w.chart.quat);
}

const nameEl = document.getElementById('active-name');
function setActive(i) {
  active = (i + walkers.length) % walkers.length;
  nameEl.textContent = CHARACTERS[active].name;
}
setActive(0);
snapCamera();

// dev-only handle for poking at the game from the console / automated screenshots
if (import.meta.env.DEV) {
  window.coop = {
    walkers,
    cam,
    world,
    renderer,
    setActive,
    setMode,
    // put character i at a town-map point, or at a named location
    teleport(i, x, z) {
      walkers[i].teleport(bend(new THREE.Vector3(x, 0, z)));
      if (i === active) snapCamera();
    },
    goto(i, id) {
      walkers[i].teleport(world.locations.find((l) => l.id === id).point);
      if (i === active) snapCamera();
    },
  };
}

// Mouse look: click to lock the pointer (Esc releases); dragging works without the lock too.
const canvas = renderer.domElement;
let dragging = false;
canvas.addEventListener('click', () => cam.mode === 'follow' && canvas.requestPointerLock?.());
canvas.addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas && !dragging) return;
  if (cam.mode === 'iso') {
    cam.isoYawTarget -= e.movementX * MOUSE_SENS;
    cam.isoYaw = cam.isoYawTarget;
    return;
  }
  cam.yaw -= e.movementX * MOUSE_SENS;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + e.movementY * MOUSE_SENS, CAM_PITCH.min, CAM_PITCH.max);
});
canvas.addEventListener('wheel', (e) => {
  if (cam.mode === 'iso') {
    cam.isoZoom = THREE.MathUtils.clamp(cam.isoZoom * Math.exp(e.deltaY * 0.001), ISO_ZOOM.min, ISO_ZOOM.max);
    return;
  }
  cam.dist = THREE.MathUtils.clamp(cam.dist * Math.exp(e.deltaY * 0.001), CAM_DIST.min, CAM_DIST.max);
});

addEventListener('resize', () => {
  persp.aspect = innerWidth / innerHeight;
  persp.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function separateWalkers() {
  for (let i = 0; i < walkers.length; i++) {
    for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i];
      const b = walkers[j];
      if (a.vehicle || b.vehicle) continue;
      const d = a.position.distanceTo(b.position);
      if (d >= PLAYER_GAP || d === 0) continue;
      const push = (PLAYER_GAP - d) / 2;
      // each moves away from the other, in its own chart
      const bl = a.chart.toLocal(b.position);
      const al = b.chart.toLocal(a.position);
      const dl = Math.hypot(bl.x, bl.z) || 1;
      const dm = Math.hypot(al.x, al.z) || 1;
      a.nudge((-bl.x / dl) * push, (-bl.z / dl) * push);
      b.nudge((-al.x / dm) * push, (-al.z / dm) * push);
    }
  }
}

const lookAt = new THREE.Vector3();
const up = new THREE.Vector3();
const offset = new THREE.Vector3();
const localTarget = new THREE.Vector3();
const localCam = new THREE.Vector3();
const ground = new THREE.Vector3();

function updateCamera(dt) {
  const w = walkers[active];
  const k = 1 - Math.exp(-10 * dt);
  camTarget.lerp(ground.copy(w.position).addScaledVector(upAt(w.position), CAM_TARGET_HEIGHT), k);
  camQuat.slerp(w.chart.quat, k);
  up.set(0, 1, 0).applyQuaternion(camQuat);
  lookAt.copy(camTarget);

  let camera;
  let shadowReach;
  if (cam.mode === 'iso') {
    camera = iso;
    cam.isoYaw += (cam.isoYawTarget - cam.isoYaw) * (1 - Math.exp(-8 * dt));
    const h = cam.isoZoom;
    const aspect = innerWidth / innerHeight;
    iso.left = -h * aspect;
    iso.right = h * aspect;
    iso.top = h;
    iso.bottom = -h;
    iso.updateProjectionMatrix();
    lookAt.lerp(PLANET_CENTRE, THREE.MathUtils.smoothstep(h, ...ISO_GLOBE_ZOOM));
    const cp = Math.cos(ISO_PITCH);
    offset.set(Math.sin(cam.isoYaw) * cp, Math.sin(ISO_PITCH), Math.cos(cam.isoYaw) * cp).multiplyScalar(ISO_DIST);
    // orthographic fog is measured from the far-away camera; the far side of the planet fades out
    scene.fog.near = ISO_DIST + 60 + h * 0.5;
    scene.fog.far = ISO_DIST + 360 + h;
    shadowReach = Math.min(h * Math.max(1, aspect) * 1.5, 160);
  } else {
    camera = persp;
    // behind the wheel the camera swings round behind the vehicle as it drives
    if (w.vehicle && Math.abs(w.vehicle.speed) > 1) {
      const behind = w.vehicle.yaw + Math.PI;
      cam.yaw += Math.atan2(Math.sin(behind - cam.yaw), Math.cos(behind - cam.yaw)) * (1 - Math.exp(-2.5 * dt));
    }
    // work in the character's chart so the camera can be pulled in front of walls
    w.chart.toLocal(camTarget, localTarget);
    const cp = Math.cos(cam.pitch);
    localCam.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp).multiplyScalar(cam.dist).add(localTarget);
    world.clipCamera(w.chart, localTarget, localCam, w.vehicle);
    localCam.y = Math.max(localCam.y, world.heightAt(w.chart.toWorld(localCam.x, 0, localCam.z, ground)) + 0.2);
    offset.subVectors(localCam, localTarget);
    scene.fog.near = 60;
    scene.fog.far = 420;
    shadowReach = 25;
  }
  camera.position.copy(lookAt).add(offset.applyQuaternion(camQuat));
  camera.up.copy(up);
  camera.lookAt(lookAt);

  // Light comes from the same direction relative to the ground wherever we are on the planet.
  world.hemi.position.copy(up);
  const s = world.sun.shadow.camera;
  if (s.right !== shadowReach) {
    s.left = s.bottom = -shadowReach;
    s.right = s.top = shadowReach;
    s.near = 1;
    s.far = 450;
    s.updateProjectionMatrix();
  }
  world.sun.target.position.copy(w.position);
  world.sun.position.copy(SUN_OFFSET).applyQuaternion(camQuat).add(w.position);
  return camera;
}

// ---- vehicles ----
// E gets in or out of the nearest vehicle, or puts the jetpack on / takes it off.
function useVehicle(w) {
  const c = w.player.character;
  if (w.vehicle) {
    const v = w.vehicle;
    v.driver = null;
    w.vehicle = null;
    w.controls = null;
    // step out on the vehicle's left
    const side = v.half.w + 0.8;
    w.chart.set(v.chart.point, v.chart.quat);
    w.player.pos.set(0, v.y, 0);
    w.player.yaw = v.yaw;
    w.player.grounded = true;
    w.nudge(Math.cos(v.yaw) * side, -Math.sin(v.yaw) * side);
    c.play('idle', 0.2);
    return;
  }
  if (w.jetpack) {
    const v = w.jetpack;
    // leave it standing where you are, back on its pad
    v.pack.group.removeFromParent();
    v.pack.group.position.set(0, 0.45, 0);
    v.pack.group.rotation.set(0, 0, 0);
    v.pack.flames.forEach((f) => (f.visible = false));
    v.obj.add(v.pack.group);
    v.chart.set(w.chart.point, w.chart.quat);
    v.yaw = w.player.yaw;
    v.y = world.heightAt(w.chart.point);
    v.place();
    v.obj.visible = true;
    v.worn = null;
    w.jetpack = null;
    w.player.flying = false;
    return;
  }
  const v = world.garage.nearest(w.position);
  if (!v) return;
  if (v.kind === 'jetpack') {
    v.worn = w;
    w.jetpack = v;
    v.obj.visible = false;
    v.pack.group.removeFromParent();
    v.pack.group.position.copy(JETPACK_SPOT);
    c.pivot.add(v.pack.group);
    w.player.flying = true;
    w.player.vel.y = 4; // lift off
    return;
  }
  v.driver = w;
  w.vehicle = v;
  w.followVehicle();
  if (cam.mode === 'follow') cam.dist = Math.max(cam.dist, DRIVE_CAM_DIST[v.kind]);
}

// Jetpack flames burn while flying, harder when climbing or moving.
function flicker(w) {
  const pl = w.player;
  const push = THREE.MathUtils.clamp(0.5 + Math.hypot(pl.vel.x, pl.vel.z) / 11 + Math.max(0, pl.vel.y) / 6, 0.4, 1.4);
  for (const f of w.jetpack.pack.flames) {
    f.visible = pl.flying;
    f.scale.set(1, push * (0.85 + Math.random() * 0.3), 1);
  }
}

// What E would do right now, shown at the bottom of the screen.
const promptEl = document.getElementById('prompt');
let shownPrompt = '';
function updatePrompt() {
  const w = walkers[active];
  let text = '';
  if (w.vehicle) text = `<b>E</b> turun dari ${w.vehicle.name} · <b>W/S</b> gas / rem · <b>A/D</b> belok`;
  else if (w.jetpack) text = '<b>E</b> lepas jetpack · <b>Spasi</b> naik · <b>C</b> turun · <b>WASD</b> terbang';
  else {
    const v = world.garage.nearest(w.position);
    if (v) text = `<b>E</b> ${v.kind === 'jetpack' ? 'pakai' : 'naik'} ${v.name}`;
  }
  if (text === shownPrompt) return;
  shownPrompt = text;
  promptEl.innerHTML = text;
  promptEl.classList.toggle('show', !!text);
}

// Name of the place the active character is standing in, shown at the top of the screen.
const placeEl = document.getElementById('place');
let shownPlace = null;
function updatePlace() {
  const here = world.locationAt(walkers[active].position);
  if (here === shownPlace) return;
  shownPlace = here;
  placeEl.classList.toggle('show', !!here);
  if (here) placeEl.innerHTML = `📍 <b>${here.name}</b><br /><small>${here.desc}</small>`;
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (input.wasPressed('KeyV')) setMode(cam.mode === 'iso' ? 'follow' : 'iso');
  if (input.wasPressed('KeyZ')) cam.isoYawTarget -= Math.PI / 2;
  if (input.wasPressed('KeyX')) cam.isoYawTarget += Math.PI / 2;
  if (input.wasPressed('KeyE')) useVehicle(walkers[active]);
  if (input.wasPressed('Tab')) setActive(active + (input.is('ShiftLeft', 'ShiftRight') ? -1 : 1));
  CHARACTERS.forEach((_, i) => {
    if (input.wasPressed(`Digit${i + 1}`)) setActive(i);
  });

  const controls = input.read();
  walkers.forEach((w, i) => {
    if (w.vehicle) {
      // driving: W/S throttle and brake/reverse, A/D steer
      w.controls = i === active ? {
        throttle: (input.is('KeyW', 'ArrowUp') ? 1 : 0) - (input.is('KeyS', 'ArrowDown') ? 1 : 0),
        steer: (input.is('KeyD', 'ArrowRight') ? 1 : 0) - (input.is('KeyA', 'ArrowLeft') ? 1 : 0),
      } : null;
      return;
    }
    if (w.jetpack) w.player.flying = true; // a jetpack keeps you in the air: Space climbs, C sinks
    w.step(dt, i === active ? controls : IDLE_INPUT, camYaw(), PLAYER_RADIUS);
  });
  separateWalkers();
  walkers.forEach((w) => w.updateVisual(dt));
  input.endFrame();

  const camera = updateCamera(dt);
  world.update(dt, camera, lookAt, walkers.map((w) => w.position));
  walkers.forEach((w) => w.vehicle && w.followVehicle());
  walkers.forEach((w) => w.jetpack && flicker(w));
  updatePlace();
  updatePrompt();
  renderer.render(scene, camera);
});
