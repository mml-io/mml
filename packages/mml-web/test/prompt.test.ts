





import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";


import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";








    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;






    expect(scene.getThreeScene().children[0].children[0].children[0]).toBe(
      element.getContainer(),










              children: expect.arrayContaining([element.getContainer()]),

















