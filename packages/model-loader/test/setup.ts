import { TextDecoder, TextEncoder } from "node:util";

// Polyfill TextEncoder/TextDecoder for jsdom environment
// These are needed by THREE.js loaders
Object.assign(globalThis, { TextEncoder, TextDecoder });
