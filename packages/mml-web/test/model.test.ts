






import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";


import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";








    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;












































    expect((element as any).latestSrcModelPromise).toBeTruthy();
    await (element as any).latestSrcModelPromise;
    expect(element.getModel().name).toBe(testNode.name);









