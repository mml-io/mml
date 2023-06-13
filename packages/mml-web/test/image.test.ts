/**
 * @jest-environment jsdom
 */

import { AudioContext } from "standardized-audio-context-mock";
import { Cache } from "three";

import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import * as Image from "../src/elements/Image";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";

beforeAll(() => {
  (window as any).AudioContext = AudioContext;
  registerCustomElementsToWindow(window);
  Cache.clear();
});

describe("m-image", () => {
  test("test attachment to scene", () => {
    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
    sceneAttachment.setMScene(scene);
    document.body.append(sceneAttachment);

    const element = document.createElement("m-image") as Image.Image;
    sceneAttachment.append(element);

    expect(scene.getThreeScene().children[0].children[0].children[0].children[0]).toBe(
      element.getImageMesh(),
    );

    expect(scene.getThreeScene()).toMatchObject({
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
                  children: expect.arrayContaining([element.getImageMesh()]),
                },
              ],
            },
          ],
        },
      ],
    });

    // Setting scale attribute - should affect the container of the element, but not the mesh itself
    expect(element.getContainer().scale.x).toBe(1);
    element.setAttribute("sx", "5");
    expect(element.getContainer().scale.x).toBe(5);

    // Setting the width attribute affects the mesh directly
    expect(element.getImageMesh().scale.x).toBe(1);
    element.setAttribute("width", "5");
    expect(element.getImageMesh().scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-image", Image.Image);
    expect(schema.name).toEqual(Image.Image.tagName);
  });

  test("images default to a width of 1 and use the source image aspect ratio", async () => {
    const image = document.createElement("m-image") as Image.Image;
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
    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    // wait for 1 second
    expect(image.getImageMesh().scale.y).toBe(0.5);
    expect(image.getImageMesh().scale.x).toBe(1);
  });

  test("setting height but not width preserves image aspect ratio", async () => {
    const image = document.createElement("m-image") as Image.Image;
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
    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    expect(image.getImageMesh().scale.y).toBe(10);
    expect(image.getImageMesh().scale.x).toBe(20);
  });

  test("setting width but not height preserves image aspect ratio", async () => {
    const image = document.createElement("m-image") as Image.Image;
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
    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    expect(image.getImageMesh().scale.y).toBe(5);
    expect(image.getImageMesh().scale.x).toBe(10);
  });

  test("setting width and height ignores aspect ratio", async () => {
    const image = document.createElement("m-image") as Image.Image;
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
    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    expect(image.getImageMesh().scale.y).toBe(12);
    expect(image.getImageMesh().scale.x).toBe(12);
  });
});
