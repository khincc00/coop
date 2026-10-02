// Minimal browser globals so three.js loaders run under Node (textures are not decoded).
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
const fakeEl = () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getContext: () => null });
globalThis.document ??= { createElementNS: fakeEl, createElement: fakeEl };
