// Keyboard → the stick-style input Player expects.
// WASD / arrows move (walk), hold Shift to run, Space jumps (or climbs with a jetpack), C / Ctrl descends.
const KEYBOARD_WALK = 0.5; // stick magnitude without Shift; Player walks below 0.5 and runs above

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set(); // keys that went down since the last read()
    target.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  is(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  // Consumes one-shot presses; call once per frame.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  read() {
    let x = (this.is('KeyD', 'ArrowRight') ? 1 : 0) - (this.is('KeyA', 'ArrowLeft') ? 1 : 0);
    let y = (this.is('KeyW', 'ArrowUp') ? 1 : 0) - (this.is('KeyS', 'ArrowDown') ? 1 : 0);
    const len = Math.hypot(x, y);
    const mag = this.is('ShiftLeft', 'ShiftRight') ? 1 : KEYBOARD_WALK;
    if (len > 0) {
      x = (x / len) * mag;
      y = (y / len) * mag;
    }
    return {
      x,
      y,
      jump: this.is('Space'),
      jumpPressed: this.wasPressed('Space'),
      descend: this.is('KeyC', 'ControlLeft', 'ControlRight'),
      flyPressed: false, // flying is for the jetpack now (see vehicles.js)
    };
  }

  endFrame() {
    this.pressed.clear();
  }
}

export const IDLE_INPUT = { x: 0, y: 0, jump: false, jumpPressed: false, descend: false, flyPressed: false };
