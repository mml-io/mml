import { jest } from "@jest/globals";
import { ThreeJSResourceManager } from "@mml-io/mml-web-threejs";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";

import { Image } from "../build/index";
import { registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-image", () => {
  test("test attachment to scene", async () => {
    const { scene, element } = await createSceneAttachedElement<Image>("m-image");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const imageMesh = container.children[0 /* element mesh */] as THREE.Mesh;
    expect(imageMesh).toBeDefined();
    expect(element.getContainer()).toBe(container);

    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene().children[0]
        .children[0].children[0].children[0],
    ).toBe(imageMesh);

    expect((scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()).toMatchObject({
      // Scene
      children: [
        // Scene Root Container
        {
          children: [
            // Scene Attachment Container
            {
              children: [
                // Element Container
                {
                  children: expect.arrayContaining([imageMesh]),
                },
              ],
            },
          ],
        },
      ],
    });

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect((element.getContainer() as THREE.Object3D).scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect((element.getContainer() as THREE.Object3D).scale.x).toBe(5);

    // Setting the width attribute - should affect the mesh
    expect(imageMesh.scale.x).toBe(1);
    element.setAttribute("width", "5");
    expect(imageMesh.scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-image", Image);
    expect(schema.name).toEqual(Image.tagName);
  });

  test("images default to a width of 1 and use the source image aspect ratio", async () => {
    const { element: image, scene } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    // mock the resource manager loadImage to synchronously deliver an image
    const ga = scene.getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const loadImageSpy = jest.spyOn(rm, "loadImage").mockImplementation(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (
          cb: (
            result:
              | { texture: THREE.Texture; width: number; height: number; hasTransparency: boolean }
              | Error,
          ) => void,
        ) => {
          const img = document.createElement("canvas");
          img.width = originalImageWidth;
          img.height = originalImageHeight;
          const texture = new THREE.CanvasTexture(img as any);
          cb({
            texture,
            width: originalImageWidth,
            height: originalImageHeight,
            hasTransparency: false,
          });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    image.setAttribute("src", "SOME_ASSET_URL");

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0] as THREE.Mesh;
    expect(loadImageSpy).toHaveBeenCalled();
    expect(imageMesh.scale.y).toBe(0.5);
    expect(imageMesh.scale.x).toBe(1);

    loadImageSpy.mockRestore();
  });

  test("setting height but not width preserves image aspect ratio", async () => {
    const { element: image, scene } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    const ga = scene.getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const loadImageSpy = jest.spyOn(rm, "loadImage").mockImplementation(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (
          cb: (
            result:
              | { texture: THREE.Texture; width: number; height: number; hasTransparency: boolean }
              | Error,
          ) => void,
        ) => {
          const img = document.createElement("canvas");
          img.width = originalImageWidth;
          img.height = originalImageHeight;
          const texture = new THREE.CanvasTexture(img as any);
          cb({
            texture,
            width: originalImageWidth,
            height: originalImageHeight,
            hasTransparency: false,
          });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    image.setAttribute("src", "SOME_ASSET_URL");
    image.setAttribute("height", "10");

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0] as THREE.Mesh;
    expect(loadImageSpy).toHaveBeenCalled();
    expect(imageMesh.scale.y).toBe(10);
    expect(imageMesh.scale.x).toBe(20);

    loadImageSpy.mockRestore();
  });

  test("setting width but not height preserves image aspect ratio", async () => {
    const { element: image, scene } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    const ga = scene.getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const loadImageSpy = jest.spyOn(rm, "loadImage").mockImplementation(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (
          cb: (
            result:
              | { texture: THREE.Texture; width: number; height: number; hasTransparency: boolean }
              | Error,
          ) => void,
        ) => {
          const img = document.createElement("canvas");
          img.width = originalImageWidth;
          img.height = originalImageHeight;
          const texture = new THREE.CanvasTexture(img as any);
          cb({
            texture,
            width: originalImageWidth,
            height: originalImageHeight,
            hasTransparency: false,
          });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    image.setAttribute("src", "SOME_ASSET_URL");
    image.setAttribute("width", "10");

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0] as THREE.Mesh;
    expect(loadImageSpy).toHaveBeenCalled();
    expect(imageMesh.scale.y).toBe(5);
    expect(imageMesh.scale.x).toBe(10);

    loadImageSpy.mockRestore();
  });

  test("collider is updated", async () => {
    const { scene, remoteDocument } = await createTestScene();
    const image = document.createElement("m-image") as Image;
    expect(Array.from((scene as any).colliders)).toEqual([]);
    const addColliderSpy = jest.spyOn(scene, "addCollider");
    const updateColliderSpy = jest.spyOn(scene, "updateCollider");
    const removeColliderSpy = jest.spyOn(scene, "removeCollider");
    remoteDocument.append(image);

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0] as THREE.Mesh;
    expect(removeColliderSpy).toHaveBeenCalledTimes(0);
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(addColliderSpy).toHaveBeenNthCalledWith(1, imageMesh, image);
    expect(Array.from((scene as any).colliders)).toEqual([imageMesh]);

    const originalImageWidth = 200;
    const originalImageHeight = 100;

    const ga = scene.getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const loadImageSpy = jest.spyOn(rm, "loadImage").mockImplementation(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (
          cb: (
            result:
              | { texture: THREE.Texture; width: number; height: number; hasTransparency: boolean }
              | Error,
          ) => void,
        ) => {
          const img = document.createElement("canvas");
          img.width = originalImageWidth;
          img.height = originalImageHeight;
          const texture = new THREE.CanvasTexture(img as any);
          cb({
            texture,
            width: originalImageWidth,
            height: originalImageHeight,
            hasTransparency: false,
          });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    image.setAttribute("width", "10");
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);
    expect(imageMesh.scale.y).toBe(1);
    expect(imageMesh.scale.x).toBe(10);

    image.setAttribute("src", "SOME_ASSET_URL");
    expect(loadImageSpy).toHaveBeenCalled();
    expect(updateColliderSpy).toHaveBeenCalledTimes(3);
    expect(imageMesh.scale.y).toBe(5);
    expect(imageMesh.scale.x).toBe(10);

    image.setAttribute("collide", "true");
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledTimes(3);
    expect(Array.from((scene as any).colliders)).toEqual([imageMesh]);
    expect(updateColliderSpy).toHaveBeenNthCalledWith(1, imageMesh, image);
    expect(removeColliderSpy).toHaveBeenCalledTimes(0);

    loadImageSpy.mockRestore();
  });

  test("setting width and height ignores aspect ratio", async () => {
    const { element: image, scene } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    const ga = scene.getGraphicsAdapter() as StandaloneThreeJSAdapter;
    const rm = ga.getResourceManager() as ThreeJSResourceManager;
    const loadImageSpy = jest.spyOn(rm, "loadImage").mockImplementation(() => {
      const handle = {
        onProgress: () => {},
        onLoad: (
          cb: (
            result:
              | { texture: THREE.Texture; width: number; height: number; hasTransparency: boolean }
              | Error,
          ) => void,
        ) => {
          const img = document.createElement("canvas");
          img.width = originalImageWidth;
          img.height = originalImageHeight;
          const texture = new THREE.CanvasTexture(img as any);
          cb({
            texture,
            width: originalImageWidth,
            height: originalImageHeight,
            hasTransparency: false,
          });
        },
        getResult: () => null,
        dispose: () => {},
      };
      return handle as any;
    });

    image.setAttribute("src", "SOME_ASSET_URL");
    image.setAttribute("width", "12");
    image.setAttribute("height", "12");

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0] as THREE.Mesh;
    expect(loadImageSpy).toHaveBeenCalled();
    expect(imageMesh.scale.y).toBe(12);
    expect(imageMesh.scale.x).toBe(12);

    loadImageSpy.mockRestore();
  });
});
