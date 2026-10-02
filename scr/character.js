import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Clip name → file in public/assets/anims (from "moving pack khin.zip").
const CLIPS = ['idle', 'walk', 'run', 'jump', 'fall', 'land'];
const EXTRA_CLIPS = ['idle2']; // alternatives a character can swap in (see `clips` below)
const ONE_SHOT = new Set(['jump', 'land']);

// Playable characters. Both use the same Mixamo skeleton and the same clip files; each gets its own
// feel from `clips` (which file plays for which move) and `style` (how the clips are reshaped):
//   stride   step length: shorter steps are played faster so the feet still keep up with the ground
//   armsIn   radians the upper arms are brought in towards the body
//   swing    per clip, how much each body part's motion is scaled round its average pose
//            (1 = as recorded, < 1 calmer, > 1 livelier)
// istri.glb is generated from "aset character/istri_mixamo.zip" by `npm run rig:istri`.
export const CHARACTERS = [
  { id: 'suami', name: 'Suami', model: 'assets/kurir.fbx' },
  {
    id: 'istri',
    name: 'Istri',
    model: 'assets/istri.glb',
    texture: 'assets/istri.jpg',
    clips: { idle: 'idle2' },
    style: {
      stride: 0.85,
      armsIn: 0.16,
      swing: {
        walk: { arms: 0.5, forearms: 0.6, hips: 1.9, spine: 0.55, head: 0.45, legs: 0.85 },
        run: { arms: 0.65, forearms: 0.7, hips: 1.5, spine: 0.7, head: 0.6, legs: 0.9 },
      },
    },
  },
];
// Mixamo bones belonging to each body part named in `swing`.
const PARTS = {
  arms: /(Left|Right)Arm$/,
  forearms: /(Left|Right)ForeArm$/,
  hips: /Hips$/,
  spine: /Spine\d?$/,
  head: /(Neck|Head)$/,
  legs: /(Left|Right)(UpLeg|Leg)$/,
};
// The clips were exported for suami's rig (kurir.fbx); their hips height is rescaled for other characters.
const CLIP_SOURCE = 'suami';

// Mixamo walk/run clips move the hips forward; pin hips X/Z so the physics drives movement.
function makeInPlace(clip) {
  const track = clip.tracks.find((t) => t.name.endsWith('Hips.position'));
  if (!track) return;
  const v = track.values;
  for (let i = 0; i < v.length; i += 3) {
    v[i] = 0;
    v[i + 2] = 0;
  }
}

function scaleHips(clip, factor) {
  const out = clip.clone();
  const track = out.tracks.find((t) => t.name.endsWith('Hips.position'));
  if (track) track.values = track.values.map((v) => v * factor);
  return out;
}

// Scale how far each keyframe turns away from the track's average rotation by k.
const _q = new THREE.Quaternion();
const _d = new THREE.Quaternion();
const _axis = new THREE.Vector3();
function scaleSwing(track, k) {
  const v = track.values;
  const mean = new THREE.Quaternion(0, 0, 0, 0);
  const ref = new THREE.Quaternion().fromArray(v, 0);
  for (let i = 0; i < v.length; i += 4) {
    _q.fromArray(v, i);
    const s = _q.dot(ref) < 0 ? -1 : 1;
    mean.x += _q.x * s;
    mean.y += _q.y * s;
    mean.z += _q.z * s;
    mean.w += _q.w * s;
  }
  mean.normalize();
  const inv = mean.clone().invert();
  for (let i = 0; i < v.length; i += 4) {
    _d.multiplyQuaternions(inv, _q.fromArray(v, i));
    if (_d.w < 0) _d.set(-_d.x, -_d.y, -_d.z, -_d.w);
    const angle = 2 * Math.acos(Math.min(1, _d.w));
    const s = Math.sqrt(1 - _d.w * _d.w);
    if (s > 1e-6) _d.setFromAxisAngle(_axis.set(_d.x / s, _d.y / s, _d.z / s), angle * k);
    _q.multiplyQuaternions(mean, _d).toArray(v, i);
  }
}

// Bring both upper arms in towards the body by `angle`: turn each arm about its shoulder, in the
// model's space, from where it points (as posed by the clip at its start) towards straight down.
function armsIn(clip, model, angle) {
  const pose = SkeletonUtils.clone(model);
  const mixer = new THREE.AnimationMixer(pose);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  pose.updateMatrixWorld(true);
  const down = new THREE.Vector3(0, -1, 0);
  for (const side of ['Left', 'Right']) {
    const arm = pose.getObjectByName(`mixamorig${side}Arm`);
    const fore = pose.getObjectByName(`mixamorig${side}ForeArm`);
    const track = clip.tracks.find((t) => t.name === `mixamorig${side}Arm.quaternion`);
    if (!arm || !fore || !track) continue;
    const dir = new THREE.Vector3().setFromMatrixPosition(fore.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(arm.matrixWorld)).normalize();
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().crossVectors(dir, down).normalize(), angle);
    const parent = arm.parent.getWorldQuaternion(new THREE.Quaternion());
    // the same turn expressed in the arm's parent space: parent⁻¹ · turn · parent
    const local = parent.clone().invert().multiply(turn).multiply(parent);
    const v = track.values;
    for (let i = 0; i < v.length; i += 4) _q.fromArray(v, i).premultiply(local).toArray(v, i);
  }
  mixer.stopAllAction();
}

// A character's own copy of a clip, reshaped by its style.
export function styleClip(clip, name, model, style) {
  if (!style) return clip;
  const out = clip.clone();
  const swing = style.swing?.[name];
  if (swing) {
    for (const track of out.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      const bone = track.name.slice(0, -'.quaternion'.length);
      const part = Object.keys(swing).find((p) => PARTS[p].test(bone));
      if (part) scaleSwing(track, swing[part]);
    }
  }
  if (style.armsIn) armsIn(out, model, style.armsIn);
  return out;
}

// A seated pose for riding a motorbike or bicycle, built from the clip's first frame: thighs
// forward, shins down to the pedals, arms reaching forward to the handlebars, a slight lean.
// Directions are in the model's space (it faces +Z, its left is +X). Returns a one-frame clip.
export function makeRideClip(model, clip) {
  const pose = SkeletonUtils.clone(model);
  const mixer = new THREE.AnimationMixer(pose);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  pose.updateMatrixWorld(true);
  const rootQ = pose.getWorldQuaternion(new THREE.Quaternion());
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  // turn `bone` so the direction to `child` points along `dir`
  const aim = (bone, child, dir) => {
    const B = pose.getObjectByName(`mixamorig${bone}`);
    const C = pose.getObjectByName(`mixamorig${child}`);
    if (!B || !C) return;
    const from = C.getWorldPosition(a).sub(B.getWorldPosition(b)).normalize();
    const to = dir.clone().normalize().applyQuaternion(rootQ);
    const turn = new THREE.Quaternion().setFromUnitVectors(from, to);
    const parent = B.parent.getWorldQuaternion(new THREE.Quaternion());
    B.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent));
    pose.updateMatrixWorld(true);
  };
  aim('Spine', 'Neck', new THREE.Vector3(0, 1, 0.3)); // lean forward a little
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    aim(`${side}UpLeg`, `${side}Leg`, new THREE.Vector3(s * 0.15, -0.25, 1));
    aim(`${side}Leg`, `${side}Foot`, new THREE.Vector3(s * 0.05, -1, 0.2));
    aim(`${side}Arm`, `${side}ForeArm`, new THREE.Vector3(s * 0.35, -0.45, 0.8));
    aim(`${side}ForeArm`, `${side}Hand`, new THREE.Vector3(s * 0.1, -0.2, 1));
  }
  const tracks = [];
  pose.traverse((o) => {
    if (o.isBone) tracks.push(new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, [0], o.quaternion.toArray()));
  });
  mixer.stopAllAction();
  return new THREE.AnimationClip('ride', -1, tracks);
}

function hipsHeight(model) {
  model.updateMatrixWorld(true);
  const hips = model.getObjectByName('mixamorigHips');
  return new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).y;
}

async function loadModel(def, manager) {
  if (def.model.endsWith('.glb')) {
    const gltf = await new GLTFLoader(manager).loadAsync(def.model);
    return gltf.scene;
  }
  const model = await new FBXLoader(manager).loadAsync(def.model);
  // kurir.fbx has no normals and unindexed triangles: weld and compute smooth normals.
  model.traverse((o) => {
    if (o.isMesh && !o.geometry.attributes.normal) {
      o.geometry = mergeVertices(o.geometry);
      o.geometry.computeVertexNormals();
    }
  });
  return model;
}

// Returns { [id]: { def, model, clips, texture } } for every entry in CHARACTERS.
export async function loadCharacterAssets(manager) {
  const fbx = new FBXLoader(manager);
  const texLoader = new THREE.TextureLoader(manager);
  const [animFiles, models, textures] = await Promise.all([
    Promise.all([...CLIPS, ...EXTRA_CLIPS].map((name) => fbx.loadAsync(`assets/anims/${name}.fbx`))),
    Promise.all(CHARACTERS.map((def) => loadModel(def, manager))),
    Promise.all(CHARACTERS.map((def) => (def.texture ? texLoader.loadAsync(def.texture) : null))),
  ]);
  const clips = {};
  [...CLIPS, ...EXTRA_CLIPS].forEach((name, i) => {
    const clip = animFiles[i].animations[0];
    clip.name = name;
    makeInPlace(clip);
    clips[name] = clip;
  });
  const sourceHips = hipsHeight(models[CHARACTERS.findIndex((d) => d.id === CLIP_SOURCE)]);

  const assets = {};
  CHARACTERS.forEach((def, i) => {
    const texture = textures[i];
    if (texture) texture.colorSpace = THREE.SRGBColorSpace;
    const factor = hipsHeight(models[i]) / sourceHips;
    const own = Object.fromEntries(
      CLIPS.map((n) => {
        const base = clips[def.clips?.[n] ?? n];
        const clip = styleClip(factor === 1 ? base : scaleHips(base, factor), n, models[i], def.style);
        clip.name = n;
        return [n, clip];
      }),
    );
    own.ride = makeRideClip(models[i], own.idle);
    assets[def.id] = { def, model: models[i], clips: own, texture, hips: hipsHeight(models[i]) };
  });
  return assets;
}

export class Character {
  constructor(assets, { tint = 0xffffff } = {}) {
    this.root = new THREE.Group();
    this.stride = assets.def.style?.stride ?? 1; // player.js speeds walk/run playback up by 1 / stride
    this.hips = assets.hips; // hip height above the feet, for sitting on a seat
    const model = SkeletonUtils.clone(assets.model);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // skinned bounds don't follow the animation
      const src = o.material;
      o.material = new THREE.MeshStandardMaterial({
        map: assets.texture || src.map,
        color: tint,
        roughness: 0.8,
        metalness: 0,
      });
    });
    // Pivot at hip height so the body can lean (e.g. forward while flying) without swinging round the feet.
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.9;
    model.position.y = -0.9;
    this.pivot.add(model);
    this.root.add(this.pivot);

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const [name, clip] of Object.entries(assets.clips)) {
      const action = this.mixer.clipAction(clip);
      if (ONE_SHOT.has(name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions[name] = action;
    }
    this.current = null;
    this.play('idle', 0);
  }

  play(name, fade = 0.2, timeScale = 1, restart = false) {
    const next = this.actions[name];
    next.timeScale = timeScale;
    if (this.current === name && !restart) return;
    const prev = this.current && this.actions[this.current];
    next.reset().setEffectiveWeight(1).play();
    if (prev && prev !== next) next.crossFadeFrom(prev, fade, false);
    this.current = name;
  }

  update(dt) {
    this.mixer.update(dt);
  }
}
