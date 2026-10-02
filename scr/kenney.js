import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Kenney kits (CC0, kenney.nl) copied from "aset kenney/" into public/assets/kenney/<pack>/.
// Models are referenced as 'pack/name', e.g. 'roads/road-straight'.
const BASE = 'assets/kenney/';

// How much each pack is pushed towards pastel: lift = lighten, soften = desaturate.
const PASTEL = {
  roads: { lift: 0.22, soften: 0.25 },
  suburban: { lift: 0.18, soften: 0.15 },
  commercial: { lift: 0.3, soften: 0.3 },
  cars: { lift: 0.2, soften: 0.15 },
  nature: { lift: 0.12, soften: 0.12 },
  furniture: { lift: 0.15, soften: 0.15 },
  industrial: { lift: 0.25, soften: 0.25 },
  food: { lift: 0.15, soften: 0.1 },
};

// The colormaps are atlases of 32×128 px swatches (16 columns × 4 rows on a 512 px sheet).
// Overrides repaint a whole swatch in a new colour but keep its light→dark shading.
// Suburban: (1,1) is the roof, (7,2) the walls. Each house variant gets its own pair.
export const ROOF_COLORS = ['#f4a6c0', '#b9a6f0', '#8fdcc2', '#ffbe98', '#9cc8f5', '#f5d77e', '#f59a9a'];
const WALL_COLORS = ['#fff3e6', '#f3efff', '#fff8ec', '#fff0f3', '#f4f9ff', '#fdf5ff', '#fffaf0'];
const SUBURBAN_SWATCHES = (v) => [
  { col: 1, row: 1, color: ROOF_COLORS[v] },
  { col: 7, row: 2, color: WALL_COLORS[v], shade: 0.3 },
];
// Commercial: (1,2) is the slate trim and roof edge, (3,2) the dark roof tops. One pair per facade variant.
const COMMERCIAL_SWATCHES = [
  ['#a3a9d6', '#cdc5e8'],
  ['#8fc9bd', '#cfeae1'],
  ['#e0a9ba', '#f5d6de'],
].map(([trim, roof]) => [
  { col: 1, row: 2, color: trim },
  { col: 3, row: 2, color: roof },
]);
// Commercial facades: the default colormap plus the two variations shipped with the kit.
const COMMERCIAL_TEXTURES = ['Textures/colormap.png', 'Textures/variation-a.png', 'Textures/variation-b.png'];
export const COMMERCIAL_VARIANTS = COMMERCIAL_TEXTURES.length;

const _hsl = {};
export function pastelize(color, { lift, soften }) {
  color.getHSL(_hsl, THREE.SRGBColorSpace);
  return color.setHSL(_hsl.h, _hsl.s * (1 - soften), _hsl.l + (1 - _hsl.l) * lift, THREE.SRGBColorSpace);
}

const _c = new THREE.Color();
function readColor(px, i) {
  return _c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace);
}

function pastelPixels(img, amount, swatches = []) {
  const canvas = document.createElement('canvas');
  const w = (canvas.width = img.width);
  canvas.height = img.height;
  const g = canvas.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, w, canvas.height);
  const px = data.data;
  const sw = w / 16;
  const sh = canvas.height / 4;
  const overrides = new Map();
  for (const o of swatches) {
    // reference lightness: the middle of the swatch
    const mid = ((o.row * sh + sh / 2) * w + o.col * sw + sw / 2) * 4;
    const ref = readColor(px, mid).getHSL({}, THREE.SRGBColorSpace).l;
    const target = new THREE.Color(o.color).getHSL({}, THREE.SRGBColorSpace);
    overrides.set(`${o.col},${o.row}`, { ref, target, shade: o.shade ?? 0.6 });
  }
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      readColor(px, i);
      const o = overrides.get(`${Math.floor(x / sw)},${Math.floor(y / sh)}`);
      if (o) {
        _c.getHSL(_hsl, THREE.SRGBColorSpace);
        const l = THREE.MathUtils.clamp(o.target.l + (_hsl.l - o.ref) * o.shade, 0, 1);
        _c.setHSL(o.target.h, o.target.s, l, THREE.SRGBColorSpace);
      } else {
        pastelize(_c, amount);
      }
      _c.getRGB(_c, THREE.SRGBColorSpace);
      px[i] = _c.r * 255;
      px[i + 1] = _c.g * 255;
      px[i + 2] = _c.b * 255;
    }
  }
  g.putImageData(data, 0, 0);
  return canvas;
}

async function fetchBitmap(url) {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

export class Kit {
  constructor(manager) {
    this.loader = new GLTFLoader(manager);
    this.models = new Map(); // 'pack/name' → { parts, box, scene }
    this.textures = new Map(); // 'pack|variant' → pastel texture
    this.variantMats = new Map();
  }

  async load(names) {
    await this.prepareTextures(names);
    await Promise.all(
      [...new Set(names)].map(async (name) => {
        const gltf = await this.loader.loadAsync(`${BASE}${name}.glb`);
        this.models.set(name, this.prepare(name, gltf.scene));
      }),
    );
  }

  // One pastel texture per pack (and per roof / facade variant), shared by every model in it.
  async prepareTextures(names) {
    const packs = new Set(names.map((n) => n.split('/')[0]));
    const jobs = [];
    const make = async (key, url, amount, swatches) => {
      const tex = new THREE.CanvasTexture(pastelPixels(await fetchBitmap(url), amount, swatches));
      tex.flipY = false; // glTF UV convention
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter; // the colormaps are flat swatches; keep the edges crisp
      this.textures.set(key, tex);
    };
    for (const pack of ['roads', 'cars', 'industrial', 'food']) {
      if (packs.has(pack)) jobs.push(make(`${pack}|0`, `${BASE}${pack}/Textures/colormap.png`, PASTEL[pack]));
    }
    if (packs.has('suburban')) {
      ROOF_COLORS.forEach((_, v) =>
        jobs.push(make(`suburban|${v}`, `${BASE}suburban/Textures/colormap.png`, PASTEL.suburban, SUBURBAN_SWATCHES(v))),
      );
    }
    if (packs.has('commercial')) {
      COMMERCIAL_TEXTURES.forEach((file, v) =>
        jobs.push(make(`commercial|${v}`, `${BASE}commercial/${file}`, PASTEL.commercial, COMMERCIAL_SWATCHES[v])),
      );
    }
    await Promise.all(jobs);
  }

  prepare(name, scene) {
    const pack = name.split('/')[0];
    if (pack === 'furniture' || pack === 'industrial') {
      // these kits' pivots sit off to one side; move them to the footprint centre like the other kits
      const c = new THREE.Box3().setFromObject(scene).getCenter(new THREE.Vector3());
      scene.position.set(-c.x, 0, -c.z);
    }
    scene.updateMatrixWorld(true);
    const parts = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m.map) {
        m.map.dispose();
        m.map = this.textures.get(`${pack}|0`) ?? m.map;
      } else {
        pastelize(m.color, PASTEL[pack]);
      }
      m.metalness = 0; // nature kit ships metallicFactor 1, which renders black without an env map
      m.roughness = 1;
      parts.push({ geometry: o.geometry, material: m, matrix: o.matrixWorld.clone(), pack });
    });
    return { parts, box: new THREE.Box3().setFromObject(scene), scene };
  }

  get(name) {
    const m = this.models.get(name);
    if (!m) throw new Error(`model not loaded: ${name}`);
    return m;
  }

  // Same material with the roof / facade variant texture swapped in.
  material(part, variant) {
    if (!variant) return part.material;
    const key = `${part.material.uuid}|${variant}`;
    let mat = this.variantMats.get(key);
    if (!mat) {
      mat = part.material.clone();
      mat.map = this.textures.get(`${part.pack}|${variant}`) ?? part.material.map;
      this.variantMats.set(key, mat);
    }
    return mat;
  }

  // Independent copy for things that move (cars). Shares geometry and materials.
  clone(name) {
    return this.get(name).scene.clone(true);
  }
}

// Collects placements and turns every (model, variant, material) into one InstancedMesh per part,
// so a town of thousands of props costs a few hundred draw calls.
export class Batcher {
  constructor(kit) {
    this.kit = kit;
    this.groups = new Map();
  }

  add(name, matrix, { variant = 0, material = null, shadow = true } = {}) {
    const key = `${name}|${variant}|${material?.uuid ?? ''}|${shadow}`;
    let g = this.groups.get(key);
    if (!g) {
      g = { name, variant, material, shadow, matrices: [] };
      this.groups.set(key, g);
    }
    g.matrices.push(matrix);
  }

  build(parent) {
    const tmp = new THREE.Matrix4();
    for (const g of this.groups.values()) {
      for (const part of this.kit.get(g.name).parts) {
        const mesh = new THREE.InstancedMesh(
          part.geometry,
          g.material ?? this.kit.material(part, g.variant),
          g.matrices.length,
        );
        g.matrices.forEach((m, i) => mesh.setMatrixAt(i, tmp.multiplyMatrices(m, part.matrix)));
        mesh.computeBoundingSphere();
        mesh.castShadow = g.shadow;
        mesh.receiveShadow = true;
        parent.add(mesh);
      }
    }
    this.groups.clear();
  }
}
