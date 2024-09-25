import { MMLGraphicsInterface } from "mml-web";

import * as ThreeJSElements from "./elements";
import { ThreeJSGraphicsAdapter } from "./ThreeJSGraphicsAdapter";

export const ThreeJSGraphicsInterface: MMLGraphicsInterface<ThreeJSGraphicsAdapter> = {
  MElementGraphicsInterface: (element) => new ThreeJSElements.ThreeJSMElement(element),
  MMLDebugHelperGraphicsInterface: (debugHelper) =>
    new ThreeJSElements.ThreeJSDebugHelper(debugHelper),
  MMLAudioGraphicsInterface: (element) => new ThreeJSElements.ThreeJSAudio(element),
  MMLChatProbeGraphicsInterface: (element) => new ThreeJSElements.ThreeJSChatProbe(element),
  MMLCubeGraphicsInterface: (element) => new ThreeJSElements.ThreeJSCube(element),
  MMLCylinderGraphicsInterface: (element) => new ThreeJSElements.ThreeJSCylinder(element),
  MMLFrameGraphicsInterface: (element) => new ThreeJSElements.ThreeJSFrame(element),
  MMLImageGraphicsInterface: (element, updateMeshCallback) =>
    new ThreeJSElements.ThreeJSImage(element, updateMeshCallback),
  MMLInteractionGraphicsInterface: (element) => new ThreeJSElements.ThreeJSInteraction(element),
  MMLLabelGraphicsInterface: (element) => new ThreeJSElements.ThreeJSLabel(element),
  MMLLightGraphicsInterface: (element) => new ThreeJSElements.ThreeJSLight(element),
  MMLModelGraphicsInterface: (element, updateMeshCallback) =>
    new ThreeJSElements.ThreeJSModel(element, updateMeshCallback),
  MMLPlaneGraphicsInterface: (element) => new ThreeJSElements.ThreeJSPlane(element),
  MMLPositionProbeGraphicsInterface: (element) => new ThreeJSElements.ThreeJSPositionProbe(element),
  MMLPromptGraphicsInterface: (element) => new ThreeJSElements.ThreeJSPrompt(element),
  MMLSphereGraphicsInterface: (element) => new ThreeJSElements.ThreeJSSphere(element),
  MMLTransformableGraphicsInterface: (element) => new ThreeJSElements.ThreeJSTransformable(element),
  MMLVideoGraphicsInterface: (element, updateMeshCallback: () => void) =>
    new ThreeJSElements.ThreeJSVideo(element, updateMeshCallback),
  RemoteDocumentGraphicsInterface: (element) => new ThreeJSElements.ThreeJSRemoteDocument(element),
};
