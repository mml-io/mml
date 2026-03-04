import {
  navigateToTestPage,
  readThreeSceneRenderInfo,
  takeAndCompareScreenshot,
} from "./testing-utils";

describe("m-model auto-instancing", () => {
  test("auto-instances duplicate meshes to reduce draw calls", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await navigateToTestPage(page, "m-model-auto-instancing.html/reset");

    // Wait for the model to load
    await page.waitForFunction(
      () => {
        const model = document.querySelector("m-model");
        if (!model) return false;
        return (model as any).modelGraphics?.getBoundingBox() !== null;
      },
      { timeout: 30000, polling: 100 },
    );

    await takeAndCompareScreenshot(page);

    const renderInfo = await readThreeSceneRenderInfo(page);
    if (renderInfo) {
      // auto-instancing should have created at least one InstancedMesh
      expect(renderInfo.instancedMeshCount).toBeGreaterThan(0);

      // each InstancedMesh consolidates multiple meshes, so total instances
      // should exceed the number of InstancedMesh objects
      expect(renderInfo.totalInstanceCount).toBeGreaterThan(renderInfo.instancedMeshCount);

      // draw calls should be less than the total number of mesh instances
      expect(renderInfo.drawCalls).toBeLessThan(
        renderInfo.totalInstanceCount + renderInfo.regularMeshCount,
      );

      // for the particular test model, we expect all instances to be
      // consolidated into a single draw call
      expect(renderInfo.drawCalls).toBe(1);
    }

    await page.close();
  }, 60000);
});
