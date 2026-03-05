import { StandaloneThreeJSAdapter } from "@mml-io/mml-web-threejs-standalone";
import * as THREE from "three";

import { Label } from "../build/index";
import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { createModeContext, ModeContext } from "./test-mode-utils";

describe.each(["virtual", "dom"] as const)("m-label [%s mode]", (mode) => {
  let ctx: ModeContext;
  beforeAll(async () => {
    ctx = await createModeContext(mode);
  });
  afterAll(() => {
    ctx.cleanup();
  });

  test("test attachment to scene", { timeout: 30000 }, async () => {
    const { scene, element } = await ctx.createSceneAttachedElement<Label>("m-label");

    const container = (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene()
      .children[0 /* root container */].children[0 /* attachment container */]
      .children[0 /* element container */];
    const labelMesh = container.children[0 /* element mesh */] as THREE.Mesh;
    expect(labelMesh).toBeDefined();
    expect(element.getContainer()).toBe(container);

    expect(
      (scene.getGraphicsAdapter() as StandaloneThreeJSAdapter).getThreeScene().children[0]
        .children[0].children[0].children[0],
    ).toBe(labelMesh);

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
                  children: expect.arrayContaining([labelMesh]),
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
    expect(labelMesh.scale.x).toBe(1);
    element.setAttribute("width", "5");
    expect(labelMesh.scale.x).toBe(5);
  });

  test("observes the schema-specified attributes", () => {
    const schema = testElementSchemaMatchesObservedAttributes("m-label", Label);
    expect(schema.name).toEqual(Label.tagName);
  });
});
