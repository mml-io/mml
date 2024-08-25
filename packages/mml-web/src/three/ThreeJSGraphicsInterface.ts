import * as THREE from "three";

import { ThreeJSCube } from "./ThreeJSCube";
import { ThreeJSLight } from "./ThreeJSLight";
import { ThreeJSMElement } from "./ThreeJSMElement";
import { ThreeJSModel } from "./ThreeJSModel";
import { ThreeJSRemoteDocument } from "./ThreeJSRemoteDocument";
import { ThreeJSTransformable } from "./ThreeJSTransformable";
import { MMLGraphicsInterface } from "../MMLGraphicsInterface";

export const ThreeJSGraphicsInterface: MMLGraphicsInterface<THREE.Group> = {
  MElementGraphicsInterface: ThreeJSMElement,
  MMLCubeGraphicsInterface: ThreeJSCube,
  MMLTransformableGraphicsInterface: ThreeJSTransformable,
  RemoteDocumentGraphicsInterface: ThreeJSRemoteDocument,
  MMLLightGraphicsInterface: ThreeJSLight,
  MMLModelGraphicsInterface: ThreeJSModel,
};
