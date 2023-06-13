






import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";


import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";









    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;







      element.getImageMesh(),













                  children: expect.arrayContaining([element.getImageMesh()]),














    expect(element.getImageMesh().scale.x).toBe(1);

    expect(element.getImageMesh().scale.x).toBe(5);























    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    // wait for 1 second
    expect(image.getImageMesh().scale.y).toBe(0.5);
    expect(image.getImageMesh().scale.x).toBe(1);



















    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    expect(image.getImageMesh().scale.y).toBe(10);
    expect(image.getImageMesh().scale.x).toBe(20);



















    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    expect(image.getImageMesh().scale.y).toBe(5);
    expect(image.getImageMesh().scale.x).toBe(10);




















    expect((image as any).srcApplyPromise).toBeTruthy();
    await (image as any).srcApplyPromise;
    expect(image.getImageMesh().scale.y).toBe(12);
    expect(image.getImageMesh().scale.x).toBe(12);


