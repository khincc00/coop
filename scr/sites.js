import * as THREE from 'three';
import { PLANET_CENTRE } from './planet.js';

// The small towns round the planet, one per named location (ids match locations.js). Each is a
// 13×13 map (legend in town.js) centred on a crossroads of the planet roads, which run through it
// as its middle row and column, with a ring road round the border so every street connects.
// Map north (-Z) faces the main town; the planet roads leave from the ends of the avenues.
export const SITE_SIZE = 13;

export const SITE_MAPS = {
  // lakeside resort: a big lake with a shore park, holiday cottages round picnic lawns,
  // a market square with a fountain, and a car park by a pond
  'telaga-biru': [
    '#############',
    '#~~~~p#hhhhh#',
    '#~~~~p#hgggh#',
    '#~~~~p#hgggh#',
    '#~~~~p#hgggh#',
    '#ppppOOOhhhh#',
    '#####OOO#####',
    '#mmmmOOOvvgk#',
    '#mPPPm#gpppg#',
    '#mPPPm#kpppk#',
    '#mPPPm#gpppg#',
    '#mmmmm#vgkgv#',
    '#############',
  ],
  // campground in a pine forest: tents and campfires, cabins among the pines, a fishing pond,
  // and a camp store with picnic tables
  'pondok-pinus': [
    '#############',
    '#ccccc#nhnhn#',
    '#ccccc#hnnnh#',
    '#ccccc#nnnnn#',
    '#ccccc#hnnnh#',
    '#ccccOOOnhnn#',
    '#####OOO#####',
    '#ppppOOOmmvv#',
    '#p~~~p#gnngv#',
    '#p~~~p#gnnnm#',
    '#p~~~p#gnngk#',
    '#ppppp#kmgmk#',
    '#############',
  ],
  // farming village: two fenced fields with windmills, farmhouses, a village green with picnic
  // tables, and a farmers' market round a fountain square
  'ladang-kincir': [
    '#############',
    '#ffffh#hffff#',
    '#ffffh#hffff#',
    '#ffffh#hffff#',
    '#ffffh#hffff#',
    '#hhhhOOOhhhh#',
    '#####OOO#####',
    '#hhhhOOOhmmh#',
    '#hgggh#hPPPh#',
    '#hgggh#vPPPv#',
    '#hgggh#hPPPh#',
    '#hhhhh#hmvmh#',
    '#############',
  ],
  // industrial harbour: factories and yards, a harbour basin with containers on the quay,
  // workers' housing and shops round a park, a truck park with food stalls
  'kilang-awan': [
    '#############',
    '#iiiii#~~~~~#',
    '#iiiii#~~~~~#',
    '#iiiii#~~~~~#',
    '#iiiii#iiiii#',
    '#iiiiOOOiiii#',
    '#####OOO#####',
    '#ddddOOOvvkk#',
    '#hpppd#iiiik#',
    '#hpppd#iiiim#',
    '#hpppd#kmmmk#',
    '#hhhhh#kvvkk#',
    '#############',
  ],
  // snowy mountain village round the south pole: chalets among pines, a sledging green with
  // picnic tables, and a winter market round a fountain square
  'puncak-salju': [
    '#############',
    '#hnhnh#hhnhh#',
    '#nnnnh#hgggn#',
    '#hnnnn#ngggh#',
    '#nnnnh#hgggn#',
    '#hnhnOOOhnhh#',
    '#####OOO#####',
    '#mvmvOOOhnhh#',
    '#mPPPm#nnnnh#',
    '#mPPPm#hnnnn#',
    '#mPPPm#nnnnh#',
    '#mvmmm#hnhnh#',
    '#############',
  ],
};

// Rotation about the planet centre that carries a map built round the north pole to the
// crossroads at (theta, phi), with map north pointing back towards the main town.
export function siteFrame(theta, phi) {
  const up = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
  let south; // map +Z: down the meridian, away from the town
  if (theta > Math.PI - 1e-6) south = new THREE.Vector3(0, 0, -1);
  else south = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), -Math.sin(theta), Math.cos(theta) * Math.sin(phi));
  const x = new THREE.Vector3().crossVectors(up, south); // map +X = up × +Z
  const rot = new THREE.Matrix4().makeBasis(x, up, south);
  const toOrigin = new THREE.Matrix4().makeTranslation(-PLANET_CENTRE.x, -PLANET_CENTRE.y, -PLANET_CENTRE.z);
  const back = new THREE.Matrix4().makeTranslation(PLANET_CENTRE.x, PLANET_CENTRE.y, PLANET_CENTRE.z);
  return back.multiply(rot).multiply(toOrigin);
}
