import { jest } from "@jest/globals";
import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-three-client";
import * as THREE from "three";
import { Cache } from "three";

import { Image } from "../build/index";
import { registerCustomElementsToWindow } from "../build/index";
import { createSceneAttachedElement, createTestScene } from "./scene-test-utils";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";

beforeAll(() => {
  registerCustomElementsToWindow(window);
  Cache.clear();
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
    const { element: image } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    // mock calls to THREE's Cache class to prevent the loaders attempting to
    // fetch images from the web
    const cacheSpy = jest.spyOn(Cache, "get").mockImplementation(() => {
      const htmlImageElement = document.createElement("img");
      htmlImageElement.width = originalImageWidth;
      htmlImageElement.height = originalImageHeight;
      return htmlImageElement;
    });

    image.setAttribute("src", "SOME_ASSET_URL");
    expect(cacheSpy).toHaveBeenCalled();
    expect((image as any).imageGraphics.srcApplyPromise).toBeTruthy();
    await (image as any).imageGraphics.srcApplyPromise;

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0];
    expect(imageMesh.scale.y).toBe(0.5);
    expect(imageMesh.scale.x).toBe(1);
  });

  test("setting height but not width preserves image aspect ratio", async () => {
    const { element: image } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    // mock calls to THREE's Cache class to prevent the loaders attempting to
    // fetch images from the web
    const cacheSpy = jest.spyOn(Cache, "get").mockImplementation(() => {
      const htmlImageElement = document.createElement("img");
      htmlImageElement.width = originalImageWidth;
      htmlImageElement.height = originalImageHeight;
      return htmlImageElement;
    });

    image.setAttribute("src", "SOME_ASSET_URL");
    expect(cacheSpy).toHaveBeenCalled();
    image.setAttribute("height", "10");
    expect((image as any).imageGraphics.srcApplyPromise).toBeTruthy();
    await (image as any).imageGraphics.srcApplyPromise;

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0];
    expect(imageMesh.scale.y).toBe(10);
    expect(imageMesh.scale.x).toBe(20);
  });

  test("setting width but not height preserves image aspect ratio", async () => {
    const { element: image } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    // mock calls to THREE's Cache class to prevent the loaders attempting to
    // fetch images from the web
    const cacheSpy = jest.spyOn(Cache, "get").mockImplementation(() => {
      const htmlImageElement = document.createElement("img");
      htmlImageElement.width = originalImageWidth;
      htmlImageElement.height = originalImageHeight;
      return htmlImageElement;
    });

    image.setAttribute("src", "SOME_ASSET_URL");
    expect(cacheSpy).toHaveBeenCalled();
    image.setAttribute("width", "10");
    expect((image as any).imageGraphics.srcApplyPromise).toBeTruthy();
    await (image as any).imageGraphics.srcApplyPromise;

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0];
    expect(imageMesh.scale.y).toBe(5);
    expect(imageMesh.scale.x).toBe(10);
  });

  test("collider is updated", async () => {
    const { scene, remoteDocument } = await createTestScene();
    const image = document.createElement("m-image") as Image;
    expect(Array.from((scene as any).colliders)).toEqual([]);
    const addColliderSpy = jest.spyOn(scene, "addCollider");
    const updateColliderSpy = jest.spyOn(scene, "updateCollider");
    const removeColliderSpy = jest.spyOn(scene, "removeCollider");
    remoteDocument.append(image);

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0];
    expect(removeColliderSpy).toHaveBeenCalledTimes(0);
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(addColliderSpy).toHaveBeenNthCalledWith(1, imageMesh, image);
    expect(Array.from((scene as any).colliders)).toEqual([imageMesh]);

    const originalImageWidth = 200;
    const originalImageHeight = 100;

    // mock calls to THREE's Cache class to prevent the loaders attempting to
    // fetch images from the web
    const cacheSpy = jest.spyOn(Cache, "get").mockImplementation(() => {
      const htmlImageElement = document.createElement("img");
      htmlImageElement.width = originalImageWidth;
      htmlImageElement.height = originalImageHeight;
      return htmlImageElement;
    });

    image.setAttribute("width", "10");
    expect(updateColliderSpy).toHaveBeenCalledTimes(1);
    expect(imageMesh.scale.y).toBe(1);
    expect(imageMesh.scale.x).toBe(10);

    image.setAttribute("src", "SOME_ASSET_URL");
    expect(cacheSpy).toHaveBeenCalled();
    expect((image as any).imageGraphics.srcApplyPromise).toBeTruthy();
    await (image as any).imageGraphics.srcApplyPromise;
    expect(updateColliderSpy).toHaveBeenCalledTimes(3);
    expect(imageMesh.scale.y).toBe(5);
    expect(imageMesh.scale.x).toBe(10);

    image.setAttribute("collide", "true");
    expect(addColliderSpy).toHaveBeenCalledTimes(1);
    expect(updateColliderSpy).toHaveBeenCalledTimes(3);
    expect(Array.from((scene as any).colliders)).toEqual([imageMesh]);
    expect(updateColliderSpy).toHaveBeenNthCalledWith(1, imageMesh, image);
    expect(removeColliderSpy).toHaveBeenCalledTimes(0);
  });

  test("setting width and height ignores aspect ratio", async () => {
    const { element: image } = await createSceneAttachedElement<Image>("m-image");
    const originalImageWidth = 200;
    const originalImageHeight = 100;

    // mock calls to THREE's Cache class to prevent the loaders attempting to
    // fetch images from the web
    const cacheSpy = jest.spyOn(Cache, "get").mockImplementation(() => {
      const htmlImageElement = document.createElement("img");
      htmlImageElement.width = originalImageWidth;
      htmlImageElement.height = originalImageHeight;
      return htmlImageElement;
    });

    image.setAttribute("src", "SOME_ASSET_URL");
    expect(cacheSpy).toHaveBeenCalled();
    image.setAttribute("width", "12");
    image.setAttribute("height", "12");
    expect((image as any).imageGraphics.srcApplyPromise).toBeTruthy();
    await (image as any).imageGraphics.srcApplyPromise;

    const imageMesh = (image.getContainer() as THREE.Object3D).children[0];
    expect(imageMesh.scale.y).toBe(12);
    expect(imageMesh.scale.x).toBe(12);
  });
});
