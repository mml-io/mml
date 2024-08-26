import { AttributeAnimation } from "./AttributeAnimation";
import { Cube } from "./Cube";
import { Cylinder } from "./Cylinder";
import { Group } from "./Group";
import { Light } from "./Light";
import { MElement } from "./MElement";
import { Model } from "./Model";
import { Plane } from "./Plane";
import { RemoteDocument } from "./RemoteDocument";
import { Sphere } from "./Sphere";

export function registerCustomElementsToWindow(targetWindow: Window) {
  // TODO - copy the classes to generate window-specific classes rather than overwriting the superclass on each call
  const targetHTMLElement = (targetWindow as any)["HTMLElement"] as typeof HTMLElement;
  MElement.overwriteSuperclass(targetHTMLElement);
  targetWindow.customElements.define(RemoteDocument.tagName, RemoteDocument);
  targetWindow.customElements.define(Light.tagName, Light);
  targetWindow.customElements.define(Model.tagName, Model);
  // targetWindow.customElements.define(Character.tagName, Character);
  targetWindow.customElements.define(Cube.tagName, Cube);
  // targetWindow.customElements.define(Frame.tagName, Frame);
  targetWindow.customElements.define(Cylinder.tagName, Cylinder);
  targetWindow.customElements.define(Plane.tagName, Plane);
  // targetWindow.customElements.define(Label.tagName, Label);
  targetWindow.customElements.define(Group.tagName, Group);
  // targetWindow.customElements.define(Prompt.tagName, Prompt);
  targetWindow.customElements.define(Sphere.tagName, Sphere);
  // targetWindow.customElements.define(Image.tagName, Image);
  // targetWindow.customElements.define(Video.tagName, Video);
  // targetWindow.customElements.define(Audio.tagName, Audio);
  // targetWindow.customElements.define(PositionProbe.tagName, PositionProbe);
  // targetWindow.customElements.define(ChatProbe.tagName, ChatProbe);
  // targetWindow.customElements.define(Interaction.tagName, Interaction);
  targetWindow.customElements.define(AttributeAnimation.tagName, AttributeAnimation);
}
