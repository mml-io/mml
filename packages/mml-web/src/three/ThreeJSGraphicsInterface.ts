import * as THREE from "three";

import { ThreeJSCube } from "./ThreeJSCube";
import { ThreeJSCylinder } from "./ThreeJSCylinder";
import { ThreeJSImage } from "./ThreeJSImage";
import { ThreeJSLight } from "./ThreeJSLight";
import { ThreeJSMElement } from "./ThreeJSMElement";
import { ThreeJSModel } from "./ThreeJSModel";
import { ThreeJSPlane } from "./ThreeJSPlane";
import { ThreeJSRemoteDocument } from "./ThreeJSRemoteDocument";
import { ThreeJSSphere } from "./ThreeJSSphere";
import { ThreeJSTransformable } from "./ThreeJSTransformable";
import { MMLGraphicsInterface } from "../MMLGraphicsInterface";

export const ThreeJSGraphicsInterface: MMLGraphicsInterface<THREE.Group> = {
  MElementGraphicsInterface: ThreeJSMElement,
  MMLCubeGraphicsInterface: ThreeJSCube,
  MMLSphereGraphicsInterface: ThreeJSSphere,
  MMLPlaneGraphicsInterface: ThreeJSPlane,
  MMLImageGraphicsInterface: ThreeJSImage,
  MMLCylinderGraphicsInterface: ThreeJSCylinder,
  MMLTransformableGraphicsInterface: ThreeJSTransformable,
  RemoteDocumentGraphicsInterface: ThreeJSRemoteDocument,
  MMLLightGraphicsInterface: ThreeJSLight,
  MMLModelGraphicsInterface: ThreeJSModel,
};
