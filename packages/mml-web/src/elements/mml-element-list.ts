import { VirtualHTMLElement } from "../virtual-dom";
import { Animation } from "./Animation";
import { AttributeAnimation } from "./AttributeAnimation";
import { AttributeLerp } from "./AttributeLerp";
import { Audio } from "./Audio";
import { Character } from "./Character";
import { ChatProbe } from "./ChatProbe";
import { Cube } from "./Cube";
import { Cylinder } from "./Cylinder";
import { Frame } from "./Frame";
import { Group } from "./Group";
import { Image } from "./Image";
import { Interaction } from "./Interaction";
import { Label } from "./Label";
import { Light } from "./Light";
import { Link } from "./Link";
import { Model } from "./Model";
import { Overlay } from "./Overlay";
import { Plane } from "./Plane";
import { PositionProbe } from "./PositionProbe";
import { Prompt } from "./Prompt";
import { RemoteDocument } from "./RemoteDocument";
import { Sphere } from "./Sphere";
import { Video } from "./Video";

export type MMLElementClass = { tagName: string } & (new () => VirtualHTMLElement);

/**
 * All MML custom element classes that should be registered for both DOM and virtual modes.
 */
export const MML_ELEMENTS: MMLElementClass[] = [
  RemoteDocument,
  Light,
  Model,
  Character,
  Cube,
  Frame,
  Cylinder,
  Plane,
  Label,
  Group,
  Prompt,
  Link,
  Overlay,
  Sphere,
  Image,
  Video,
  Audio,
  PositionProbe,
  ChatProbe,
  Interaction,
  Animation,
  AttributeAnimation,
  AttributeLerp,
];
