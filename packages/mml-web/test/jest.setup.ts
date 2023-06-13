







import ResizeObserver from "resize-observer-polyfill";
Object.defineProperty(window, "ResizeObserver", {
  writable: false,
  configurable: false,
  value: ResizeObserver,
});
