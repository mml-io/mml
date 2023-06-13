






import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";


import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";
import { GLTFResult } from "../src/utils/gltf";








    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;
















































    const loadModelPromise: Promise<GLTFResult> = (element as any).latestSrcModelPromise;
    expect(loadModelPromise).toBeTruthy();
    await loadModelPromise;
    expect(element.getCharacter().name).toBe(testNode.name);









