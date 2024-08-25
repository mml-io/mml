import fs from "fs";
import path from "path";
import url from "url";

import { jest } from "@jest/globals";

import { ModelLoader } from "../build/index";

// Stub the DracoLoader to avoid errors when attempting to load Workers
jest.spyOn(ModelLoader as any, "getDracoLoader").mockImplementation(() => {
  return {};
});

const dirname = url.fileURLToPath(new URL(".", import.meta.url));

describe("model-loader", () => {
  test("load glb", async () => {
    const modelLoader = new ModelLoader();
    const buffer = fs.readFileSync(path.resolve(path.join(dirname, "./test-files/cube.glb")));
    const model = await modelLoader.loadFromBuffer(new Uint8Array(buffer).buffer, "cube.glb");
    expect(model.group).toBeDefined();
    expect(model.group.children[0].name).toEqual("Cube");
  });

  test("load gltf", async () => {
    const modelLoader = new ModelLoader();
    const buffer = fs.readFileSync(path.resolve(path.join(dirname, "./test-files/cube.gltf")));
    const model = await modelLoader.loadFromBuffer(new Uint8Array(buffer).buffer, "cube.gltf");
    expect(model.group).toBeDefined();
    expect(model.group.children[0].name).toEqual("Cube");
  });

  test("load fbx", async () => {
    const modelLoader = new ModelLoader();
    const buffer = fs.readFileSync(path.resolve(path.join(dirname, "./test-files/cube.fbx")));
    const model = await modelLoader.loadFromBuffer(new Uint8Array(buffer).buffer, "cube.fbx");
    expect(model.group).toBeDefined();
    expect(model.group.children[0].name).toEqual("Cube");
  });

  test.skip("load DRACO-compressed glb", async () => {
    // TODO - configure DracoLoader to run in NodeJS for testing
  });
});
