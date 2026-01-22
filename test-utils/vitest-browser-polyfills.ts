import { vi } from "vitest";
import ResizeObserverPolyfill from "resize-observer-polyfill";
import { TextDecoder, TextEncoder } from "util";

import { MockAudioContext } from "./mocks/MockAudioContext";

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(""),
  blob: () => Promise.resolve(new Blob()),
});

// Set on both window and globalThis for complete polyfill coverage
(window as any).TextEncoder = TextEncoder;
(window as any).TextDecoder = TextDecoder;
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

(window as any).URL.createObjectURL = vi.fn();

// Mock the pause method for HTMLMediaElement
Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value() {
    // Add any custom logic if needed, otherwise leave the function empty
  },
});

Object.defineProperty(window, "ResizeObserver", {
  writable: false,
  configurable: false,
  value: ResizeObserverPolyfill,
});

Object.defineProperty(window, "AudioContext", {
  get(): typeof AudioContext {
    return MockAudioContext as unknown as typeof AudioContext;
  },
});

const documentStartTime = Date.now();
const timeline = {};
Object.defineProperty(timeline, "currentTime", {
  get: () => {
    return Date.now() - documentStartTime;
  },
});
(window.document as any).timeline = timeline;
