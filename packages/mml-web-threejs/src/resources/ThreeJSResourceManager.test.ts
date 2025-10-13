import { jest } from "@jest/globals";
import * as THREE from "three";

import * as modelLoaderMock from "./__mocks__/model-loader";

jest.mock("@mml-io/model-loader", () => modelLoaderMock);

import { ThreeJSImageLoader } from "./ThreeJSImageLoader";
import { ThreeJSModelResource } from "./ThreeJSModelResource";
import { ThreeJSResourceManager } from "./ThreeJSResourceManager";

// Avoid GLTF parsing path and KTX2 detection by mocking ModelLoader.load to resolve immediately
jest.mock("@mml-io/model-loader", () => {
  return {
    ModelLoader: class {
      load(): Promise<{ group: THREE.Group; animations: any[] }> {
        return Promise.resolve({ group: new THREE.Group(), animations: [] });
      }
    },
  };
});

describe("ThreeJSResourceManager", () => {
  test("deduplicates image resources and recreates after last handle disposed", async () => {
    const rm = new ThreeJSResourceManager();
    const url = "/image.png";

    const loaderSpy = jest.spyOn(ThreeJSImageLoader, "load").mockImplementation((u, onLoad) => {
      const img = document.createElement("img") as any as HTMLImageElement;
      Object.defineProperty(img, "width", { value: 2 });
      Object.defineProperty(img, "height", { value: 2 });
      setTimeout(() => onLoad(img));
      return img;
    });

    const h1 = rm.loadImage(url);
    const h2 = rm.loadImage(url);

    await new Promise((r) => setTimeout(r, 0));
    expect(loaderSpy).toHaveBeenCalledTimes(1);

    h1.dispose();
    h2.dispose();

    const h3 = rm.loadImage(url);
    await new Promise((r) => setTimeout(r, 0));
    expect(loaderSpy).toHaveBeenCalledTimes(2);
    h3.dispose();
  });

  test("deduplicates label resources by options key", () => {
    const rm = new ThreeJSResourceManager();
    const options = {
      content: "hi",
      fontSize: 8,
      paddingPx: 1,
      textColorRGB255A1: { r: 255, g: 255, b: 255, a: 1 },
      backgroundColorRGB255A1: { r: 0, g: 0, b: 0, a: 1 },
      dimensions: { width: 2, height: 2 },
      alignment: "center",
      bold: true,
    } as const;

    const h1 = rm.loadLabel(options);
    const h2 = rm.loadLabel({ ...options });

    expect(h1).toBeTruthy();
    expect(h2).toBeTruthy();

    h1.dispose();
    h2.dispose();
  });

  test("deduplicates model resources and recreates after last handle disposed", async () => {
    const rm = new ThreeJSResourceManager();
    const url = "/model.glb";

    // Force ThreeJSModelResource to use our fake loader to avoid GLTF parsing/webgl
    (ThreeJSModelResource as any).modelLoader = {
      load: jest.fn(() => Promise.resolve({ group: new THREE.Group(), animations: [] })),
    };
    const h1 = rm.loadModel(url);
    const h2 = rm.loadModel(url);

    await new Promise((r) => setTimeout(r, 0));
    h1.dispose();
    h2.dispose();

    const h3 = rm.loadModel(url);
    await new Promise((r) => setTimeout(r, 0));
    h3.dispose();
  });
});
