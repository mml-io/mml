





import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";


import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";








    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;







      element.getLabel(),













                  children: expect.arrayContaining([element.getLabel()]),














    expect(element.getLabel().scale.x).toBe(1);

    expect(element.getLabel().scale.x).toBe(5);







