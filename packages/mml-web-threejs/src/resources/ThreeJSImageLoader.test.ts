import { jest } from "@jest/globals";

import { ThreeJSImageLoader } from "./ThreeJSImageLoader";

describe("ThreeJSImageLoader", () => {
  test("calls onLoad when image loads and removes listeners", () => {
    const ac = new AbortController();
    const onLoad = jest.fn();
    const onError = jest.fn();

    const img = ThreeJSImageLoader.load("https://example.com/a.png", onLoad, onError, ac.signal);
    expect(img).toBeInstanceOf(HTMLImageElement);

    // Trigger load event
    img.dispatchEvent(new Event("load"));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad.mock.calls[0][0]).toBe(img);

    // Listeners should be removed after first event
    img.dispatchEvent(new Event("load"));
    expect(onLoad).toHaveBeenCalledTimes(1);
    img.dispatchEvent(new Event("error"));
    expect(onError).not.toHaveBeenCalled();
  });

  test("calls onError when image errors and removes listeners", () => {
    const ac = new AbortController();
    const onLoad = jest.fn();
    const onError = jest.fn();

    const img = ThreeJSImageLoader.load("https://example.com/b.png", onLoad, onError, ac.signal);
    expect(img).toBeInstanceOf(HTMLImageElement);

    // Trigger error event
    const errorEvent = new ErrorEvent("error", { message: "load failed" });
    img.dispatchEvent(errorEvent);
    expect(onError).toHaveBeenCalledTimes(1);

    // Listeners should be removed after first event
    img.dispatchEvent(new Event("error"));
    expect(onError).toHaveBeenCalledTimes(1);
    img.dispatchEvent(new Event("load"));
    expect(onLoad).not.toHaveBeenCalled();
  });

  test("aborting clears src and prevents callbacks", () => {
    const ac = new AbortController();
    const onLoad = jest.fn();
    const onError = jest.fn();

    const img = ThreeJSImageLoader.load("https://example.com/c.png", onLoad, onError, ac.signal);
    expect(img.getAttribute("src")).toBe("https://example.com/c.png");

    ac.abort();
    expect(img.getAttribute("src")).toBe("");

    // After abort, callbacks should not fire
    img.dispatchEvent(new Event("load"));
    img.dispatchEvent(new Event("error"));
    expect(onLoad).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
