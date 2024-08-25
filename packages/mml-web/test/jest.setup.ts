import { TextDecoder, TextEncoder } from "util";

import { jest } from "@jest/globals";
import jestFetchMock from "jest-fetch-mock";
import ResizeObserverPolyfill from "resize-observer-polyfill";

import { MockAudioContext } from "./mocks/MockAudioContext";

jestFetchMock.enableMocks();

(window as any).TextEncoder = TextEncoder;
(window as any).TextDecoder = TextDecoder;

(window as any).URL.createObjectURL = jest.fn();

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
