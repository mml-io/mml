





import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { Cylinder } from "../src/elements/Cylinder";

import { RemoteDocument } from "../src/elements/RemoteDocument";
import { FullScreenMScene } from "../src/FullScreenMScene";






describe("m-cylinder", () => {

    const scene = new FullScreenMScene();
    const sceneAttachment = document.createElement("m-remote-document") as RemoteDocument;



    const element = document.createElement("m-cylinder") as Cylinder;



      element.getCylinder(),













                  children: expect.arrayContaining([element.getCylinder()]),














    expect(element.getCylinder().scale.x).toBe(1);
    element.setAttribute("radius", "2.5");
    expect(element.getCylinder().scale.x).toBe(5);



    const schema = testElementSchemaMatchesObservedAttributes("m-cylinder", Cylinder);
    expect(schema.name).toEqual(Cylinder.tagName);


