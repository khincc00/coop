import * as THREE from 'three';
import { Player } from './player.js';
import { SurfaceChart, bend, surfaceFrame, upAt } from './planet.js';

// A character walking on the planet. Player (player.js) does its usual flat physics inside a small
// surface chart centred under the character; after every step the chart is re-centred on where the
// character got to, carrying its axes along, so walking straight goes right round the planet.
// Player's pos keeps only the height (x and z are always back to 0 after a step) and its velocity,
// facing and the camera yaw all stay in the chart's axes.
const NO_BOUNDS = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
const Y = new THREE.Vector3(0, 1, 0);
const _yaw = new THREE.Quaternion();
const _g = new THREE.Vector3();

export class Walker {
  constructor(character, world, flatSpawn) {
    this.world = world;
    this.chart = new SurfaceChart(bend(new THREE.Vector3(flatSpawn.x, 0, flatSpawn.z)), surfaceFrame(flatSpawn));
    this.player = new Player(character, new THREE.Vector3(), NO_BOUNDS, (x, z) => world.heightAt(this.chart.toWorld(x, 0, z, _g)));
    this.position = new THREE.Vector3(); // world position of the feet
    this.sync();
  }

  step(dt, input, camYaw, radius) {
    const pl = this.player;
    pl.setInput(input, camYaw);
    pl.update(dt);
    this.world.collide(this.chart, pl.pos, radius);
    this.recentre();
  }

  // Shift by chart-local (x, z) metres, e.g. to keep two characters apart.
  nudge(x, z) {
    this.player.pos.x += x;
    this.player.pos.z += z;
    this.recentre();
  }

  recentre() {
    const pl = this.player;
    this.chart.move(pl.pos.x, pl.pos.z);
    pl.pos.x = pl.pos.z = 0;
    this.sync();
  }

  sync() {
    this.chart.toWorld(0, this.player.pos.y, 0, this.position);
  }

  // Put the character down at world point p (keeps roughly the current facing).
  teleport(p) {
    const q = new THREE.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(this.chart.quat), upAt(p)).multiply(this.chart.quat);
    this.chart.set(p, q);
    this.player.pos.set(0, this.world.heightAt(this.chart.point), 0);
    this.player.vel.set(0, 0, 0);
    this.sync();
  }

  // Riding: the walker's chart follows the vehicle, so the camera and everything else follows too.
  followVehicle() {
    const v = this.vehicle;
    this.chart.set(v.chart.point, v.chart.quat);
    this.player.pos.set(0, v.y, 0);
    this.player.vel.set(0, 0, 0);
    this.player.yaw = v.yaw;
    this.sync();
  }

  updateVisual(dt) {
    const c = this.player.character;
    c.root.visible = this.vehicle?.kind !== 'car'; // inside a car the driver is out of sight
    if (this.vehicle) {
      if (this.vehicle.kind === 'car') return;
      // sat on a motorbike or bicycle
      c.play('ride', 0.25);
      c.update(dt);
      this.vehicle.seat(c.hips, c.root.position);
      c.root.quaternion.copy(this.vehicle.obj.quaternion);
      c.pivot.rotation.x = 0;
      return;
    }
    this.player.updateVisual(dt);
    const root = this.player.character.root;
    root.position.copy(this.position);
    root.quaternion.copy(this.chart.quat).multiply(_yaw.setFromAxisAngle(Y, this.player.yaw));
  }
}
