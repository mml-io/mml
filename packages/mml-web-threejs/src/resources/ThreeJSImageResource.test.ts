import * as THREE from "three";
import { vi } from "vitest";

import { ThreeJSImageLoader } from "./ThreeJSImageLoader";
import { ThreeJSImageResource } from "./ThreeJSImageResource";

describe("ThreeJSImageResource", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  function mockLoaderToLoadImageWithAlpha(alphaAt0_0: number, width = 4, height = 2) {
    vi.spyOn(ThreeJSImageLoader, "load").mockImplementation((_url, onLoad) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      const imageData = ctx.createImageData(width, height);
      for (let i = 0; i < width * height; i++) {
        const base = i * 4;
        imageData.data[base + 0] = 255;
        imageData.data[base + 1] = 255;
        imageData.data[base + 2] = 255;
        imageData.data[base + 3] = 255;
      }
      // set pixel 0,0 alpha
      imageData.data[3] = alphaAt0_0;
      ctx.putImageData(imageData, 0, 0);
      setTimeout(() => onLoad(canvas as unknown as HTMLImageElement));
      return document.createElement("img") as any as HTMLImageElement;
    });
  }

  test("notifies multiple handles and late subscribers on success", async () => {
    mockLoaderToLoadImageWithAlpha(255);

    const onRemove = vi.fn();
    const resource = new ThreeJSImageResource("/tex.png", onRemove);
    const handle1 = resource.createHandle();
    const handle2 = resource.createHandle();

    const results: any[] = [];
    handle1.onLoad((r) => results.push(r));
    handle2.onLoad((r) => results.push(r));

    await new Promise((r) => setTimeout(r, 0));

    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r).toBeTruthy();
      if (!(r instanceof Error)) {
        expect(r.width).toBe(4);
        expect(r.height).toBe(2);
        expect(typeof r.hasTransparency).toBe("boolean");
        expect(r.texture).toBeInstanceOf(THREE.CanvasTexture);
      }
    }

    // Late subscriber receives immediate
    const handle3 = resource.createHandle();
    const immediate = handle3.getResult();
    expect(immediate && !(immediate instanceof Error)).toBe(true);
  });

  test("reports transparency when any pixel alpha < 255", async () => {
    mockLoaderToLoadImageWithAlpha(0);
    const resource = new ThreeJSImageResource("/alpha.png", vi.fn());
    const handle = resource.createHandle();

    const result = await new Promise<any>((resolve) => handle.onLoad(resolve));
    expect(!(result instanceof Error) && result.hasTransparency).toBe(true);
  });

  test("propagates error to all handles", async () => {
    vi.spyOn(ThreeJSImageLoader, "load").mockImplementation((_url, _onLoad, onError) => {
      const img = document.createElement("img") as any as HTMLImageElement;
      setTimeout(() => onError(new ErrorEvent("error", { message: "boom" })), 0);
      return img;
    });

    const resource = new ThreeJSImageResource("/err.png", vi.fn());
    const h1 = resource.createHandle();
    const h2 = resource.createHandle();
    const p1 = new Promise((resolve) => h1.onLoad(resolve as any));
    const p2 = new Promise((resolve) => h2.onLoad(resolve as any));
    const [r1, r2]: any = await Promise.all([p1, p2]);
    expect(r1).toBeInstanceOf(Error);
    expect(r2).toBeInstanceOf(Error);
  });

  test("disposing last handle aborts and triggers onRemove; disposing texture on last handle", async () => {
    mockLoaderToLoadImageWithAlpha(255);
    const onRemove = vi.fn();
    const resource = new ThreeJSImageResource("/tex.png", onRemove);
    const h = resource.createHandle();

    await new Promise((r) => setTimeout(r, 0));
    const result = h.getResult() as any;
    expect(result && !(result instanceof Error)).toBe(true);
    const texture: THREE.CanvasTexture = result.texture;
    const disposeSpy = vi.spyOn(texture, "dispose");

    h.dispose();
    expect(onRemove).toHaveBeenCalled();
    expect(disposeSpy).toHaveBeenCalled();
  });
});
