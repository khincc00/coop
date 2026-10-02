// Tiny chiptune synth: every sound is generated, nothing is loaded.
let ac = null;
let master = null;
let musicGain = null;
let noiseBuf = null;
let musicTimer = null;
let muted = false;

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  master = ac.createGain();
  master.gain.value = 0.35;
  master.connect(ac.destination);
  musicGain = ac.createGain();
  musicGain.gain.value = 0.18;
  musicGain.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

function tone(type, f0, f1, dur, vol = 0.3, when = 0, dest = master) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.4, freq = 1200, when = 0) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.05);
}

const last = {};
export function sfx(name) {
  if (!ac || muted) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 35) return; // de-dupe spam
  last[name] = now;
  switch (name) {
    case 'jump': tone('square', 380, 760, 0.14, 0.18); break;
    case 'jumpBig': tone('square', 300, 900, 0.22, 0.2); break;
    case 'pistol': tone('square', 900, 200, 0.07, 0.15); noise(0.05, 0.15, 3000); break;
    case 'hmg': tone('sawtooth', 600, 150, 0.05, 0.1); noise(0.04, 0.12, 2500); break;
    case 'shotgun': noise(0.22, 0.5, 2000); tone('square', 200, 60, 0.15, 0.2); break;
    case 'rocket': noise(0.3, 0.25, 900); tone('sawtooth', 200, 500, 0.25, 0.1); break;
    case 'flame': noise(0.08, 0.12, 700); break;
    case 'enemyShot': tone('square', 500, 300, 0.06, 0.08); break;
    case 'boom': noise(0.6, 0.7, 900); tone('sine', 120, 30, 0.5, 0.5); break;
    case 'smallBoom': noise(0.3, 0.4, 1400); tone('sine', 160, 50, 0.25, 0.3); break;
    case 'coin': tone('square', 988, 988, 0.06, 0.15); tone('square', 1319, 1319, 0.25, 0.15, 0.06); break;
    case 'stomp': tone('square', 220, 80, 0.12, 0.25); break;
    case 'pound': noise(0.35, 0.6, 600); tone('sine', 90, 30, 0.3, 0.5); break;
    case 'bump': tone('square', 160, 120, 0.08, 0.2); break;
    case 'brick': noise(0.2, 0.4, 2500); break;
    case 'hit': tone('square', 300, 100, 0.1, 0.12); break;
    case 'hurt': tone('sawtooth', 400, 80, 0.3, 0.25); break;
    case 'down': tone('triangle', 600, 100, 0.8, 0.3); break;
    case 'revive': [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.15, i * 0.07)); break;
    case 'power': [262, 330, 392, 523, 659, 784].forEach((f, i) => tone('square', f, f, 0.08, 0.15, i * 0.05)); break;
    case 'pipe': [0, 1, 2].forEach((i) => tone('square', 400 - i * 100, 300 - i * 100, 0.08, 0.15, i * 0.09)); break;
    case 'lever': tone('square', 200, 400, 0.08, 0.2); tone('square', 600, 600, 0.12, 0.15, 0.09); break;
    case 'gate': noise(0.6, 0.25, 400); tone('sawtooth', 80, 160, 0.6, 0.1); break;
    case 'pow': [784, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.15, i * 0.08)); break;
    case 'grenade': tone('triangle', 500, 250, 0.12, 0.15); break;
    case 'jet': noise(0.06, 0.06, 1500); break;
    case 'pogo': noise(0.4, 0.6, 1800); tone('square', 150, 1200, 0.3, 0.25); break;
    case 'tank': [110, 147, 196].forEach((f, i) => tone('sawtooth', f, f, 0.15, 0.15, i * 0.1)); break;
    case 'bossHit': tone('square', 140, 90, 0.06, 0.15); break;
    case 'select': tone('square', 660, 990, 0.1, 0.2); break;
    case 'clear': [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.14, 0.18, i * 0.13)); break;
    case 'over': [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f, 0.3, 0.25, i * 0.25)); break;
  }
}

// Marching chip loop. Each zone gets its own key / tempo.
const SONGS = [
  { bpm: 150, root: 45, bass: [0, 0, 7, 0, 5, 5, 3, 5], lead: [12, 15, 17, 19, 17, 15, 12, 10, 12, 15, 19, 22, 19, 17, 15, 12] },
  { bpm: 140, root: 43, bass: [0, 0, 3, 3, 5, 5, 7, 6], lead: [7, 10, 12, 10, 7, 5, 3, 5, 7, 10, 15, 14, 12, 10, 7, 3] },
  { bpm: 162, root: 47, bass: [0, 7, 5, 7, 0, 3, 5, 6], lead: [12, 12, 19, 17, 15, 17, 12, 10, 15, 19, 24, 22, 19, 17, 15, 14] },
  { bpm: 176, root: 40, bass: [0, 0, 1, 0, 0, 0, 3, 1], lead: [12, 13, 12, 15, 12, 13, 18, 17, 12, 13, 12, 15, 19, 18, 15, 13] }, // boss
];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export function playMusic(index) {
  stopMusic();
  if (!ac) return;
  const song = SONGS[index] || SONGS[0];
  const step = 60 / song.bpm / 2;
  let i = 0;
  let next = ac.currentTime + 0.05;
  const tick = () => {
    while (next < ac.currentTime + 0.25) {
      const when = next - ac.currentTime;
      const b = song.bass[Math.floor(i / 2) % song.bass.length];
      if (i % 2 === 0) tone('triangle', mtof(song.root + b), mtof(song.root + b), step * 1.8, 0.5, when, musicGain);
      const l = song.lead[i % song.lead.length];
      if (i % 4 !== 3) tone('square', mtof(song.root + 12 + l), mtof(song.root + 12 + l), step * 0.8, 0.16, when, musicGain);
      if (i % 4 === 2) {
        const t = ac.currentTime + when;
        const s = ac.createBufferSource();
        s.buffer = noiseBuf;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        s.connect(g).connect(musicGain);
        s.start(t);
        s.stop(t + 0.06);
      }
      next += step;
      i++;
    }
  };
  tick();
  musicTimer = setInterval(tick, 80);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
