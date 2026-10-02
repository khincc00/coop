// Two-player local input: one keyboard split in half, plus up to two gamepads.
// Every action exposes `down` (held) and `pressed` (went down this frame).

export const BINDINGS = {
  plumber: {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    jump: ['KeyW', 'Space'],
    action: ['KeyF'],
    special: ['KeyE'],
    ultimate: ['KeyG'],
  },
  gunner: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['KeyJ', 'Numpad0'],
    fire: ['KeyK', 'Numpad1'],
    grenade: ['KeyL', 'Numpad2'],
    action: ['KeyI', 'Numpad3'],
    ultimate: ['KeyO', 'Numpad5'],
  },
};

// Standard gamepad layout: 0=A 1=B 2=X 3=Y 4=LB 5=RB 12-15=dpad
const PAD = {
  plumber: { jump: [0], action: [2, 5], special: [1], ultimate: [3] },
  gunner: { jump: [0], fire: [2], grenade: [1], action: [5, 4], ultimate: [3] },
};

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'grenade', 'action', 'special', 'ultimate'];

export class Input {
  constructor() {
    this.keys = new Set();
    this.lastTaps = new Set();
    this.taps = new Set(); // keys pressed since the last update (so quick taps are never lost)
    this.virtual = new Set(); // test hook: "plumber.jump" etc.
    this.state = { plumber: {}, gunner: {} };
    for (const who of ['plumber', 'gunner'])
      for (const a of ACTIONS) this.state[who][a] = { down: false, pressed: false, released: false };
    this.anyPressed = false;
    addEventListener('keydown', (e) => {
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (!e.repeat) this.taps.add(e.code);
      this.keys.add(e.code);
      this.lastKey = e.code;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  update() {
    const taps = this.taps;
    this.taps = new Set();
    this.lastTaps = taps;
    const pads = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean);
    for (const [i, who] of ['plumber', 'gunner'].entries()) {
      const pad = pads[i];
      for (const a of ACTIONS) {
        let down = (BINDINGS[who][a] || []).some((k) => this.keys.has(k) || taps.has(k)) || this.virtual.has(`${who}.${a}`);
        if (pad) {
          const ax = pad.axes[0] || 0;
          const ay = pad.axes[1] || 0;
          if (a === 'left') down ||= ax < -0.4 || !!pad.buttons[14]?.pressed;
          else if (a === 'right') down ||= ax > 0.4 || !!pad.buttons[15]?.pressed;
          else if (a === 'up') down ||= ay < -0.5 || !!pad.buttons[12]?.pressed;
          else if (a === 'down') down ||= ay > 0.5 || !!pad.buttons[13]?.pressed;
          else down ||= (PAD[who][a] || []).some((b) => pad.buttons[b]?.pressed);
        }
        const s = this.state[who][a];
        s.pressed = down && !s.down;
        s.released = !down && s.down;
        s.down = down;
      }
    }
  }

  p(who) {
    return this.state[who];
  }
}
