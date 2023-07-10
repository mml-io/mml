import { Audio } from "./Audio";
import { Character } from "./Character";
import { Cube } from "./Cube";
import { Cylinder } from "./Cylinder";
import { Frame } from "./Frame";
import { Group } from "./Group";
import { Image } from "./Image";
import { Interaction } from "./Interaction";
import { Label } from "./Label";
import { Light } from "./Light";
import { MElement } from "./MElement";
import { Model } from "./Model";
import { Plane } from "./Plane";
import { PositionProbe } from "./PositionProbe";
import { Prompt } from "./Prompt";
import { RemoteDocument } from "./RemoteDocument";
import { Sphere } from "./Sphere";
import { Video } from "./Video";

export function registerCustomElementsToWindow(targetWindow: Window) {
  // TODO - copy the classes to generate window-specific classes rather than overwriting the superclass on each call
  const targetHTMLElement = (targetWindow as any)["HTMLElement"] as typeof HTMLElement;
  MElement.overwriteSuperclass(targetHTMLElement);
  targetWindow.customElements.define(RemoteDocument.tagName, RemoteDocument);
  targetWindow.customElements.define(Light.tagName, Light);
  targetWindow.customElements.define(Model.tagName, Model);
  targetWindow.customElements.define(Character.tagName, Character);
  targetWindow.customElements.define(Cube.tagName, Cube);
  targetWindow.customElements.define(Frame.tagName, Frame);
  targetWindow.customElements.define(Cylinder.tagName, Cylinder);
  targetWindow.customElements.define(Plane.tagName, Plane);
  targetWindow.customElements.define(Label.tagName, Label);
  targetWindow.customElements.define(Group.tagName, Group);
  targetWindow.customElements.define(Prompt.tagName, Prompt);
  targetWindow.customElements.define(Sphere.tagName, Sphere);
  targetWindow.customElements.define(Image.tagName, Image);
  targetWindow.customElements.define(Video.tagName, Video);
  targetWindow.customElements.define(Audio.tagName, Audio);
  targetWindow.customElements.define(PositionProbe.tagName, PositionProbe);
  targetWindow.customElements.define(Interaction.tagName, Interaction);
}
