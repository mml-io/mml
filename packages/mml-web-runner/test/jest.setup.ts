// Mock the pause method for HTMLMediaElement
Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value() {
    // Add any custom logic if needed, otherwise leave the function empty
  },
});

import ResizeObserver from "resize-observer-polyfill";
Object.defineProperty(window, "ResizeObserver", {
  writable: false,
  configurable: false,
  value: ResizeObserver,
});
