import { MElement, MMLColor, MMLGraphicsInterface } from "@mml-io/mml-web";

import * as ThreeJSElements from "./elements";
import { ThreeJSGraphicsAdapter } from "./ThreeJSGraphicsAdapter";
import * as ThreeJSVisualizers from "./visualizers";

export const ThreeJSGraphicsInterface: MMLGraphicsInterface<ThreeJSGraphicsAdapter> = {
  MElementGraphicsInterface: (element) => new ThreeJSElements.ThreeJSMElement(element),
  MMLDebugHelperGraphicsInterface: (debugHelper) =>
    new ThreeJSElements.ThreeJSDebugHelper(debugHelper),
  MMLAudioGraphicsInterface: (element) => new ThreeJSElements.ThreeJSAudio(element),
  MMLCapsuleGraphicsInterface: (element) => new ThreeJSElements.ThreeJSCapsule(element),
  MMLChatProbeGraphicsInterface: (element) => new ThreeJSElements.ThreeJSChatProbe(element),
  MMLCubeGraphicsInterface: (element) => new ThreeJSElements.ThreeJSCube(element),
  MMLCylinderGraphicsInterface: (element) => new ThreeJSElements.ThreeJSCylinder(element),
  MMLFrameGraphicsInterface: (element) => new ThreeJSElements.ThreeJSFrame(element),
  MMLImageGraphicsInterface: (element, updateMeshCallback) =>
    new ThreeJSElements.ThreeJSImage(element, updateMeshCallback),
  MMLInteractionGraphicsInterface: (element) => new ThreeJSElements.ThreeJSInteraction(element),
  MMLLabelGraphicsInterface: (element) => new ThreeJSElements.ThreeJSLabel(element),
  MMLLightGraphicsInterface: (element) => new ThreeJSElements.ThreeJSLight(element),
  MMLOverlayGraphicsInterface: (element) => new ThreeJSElements.ThreeJSOverlay(element),
  MMLLinkGraphicsInterface: (element) => new ThreeJSElements.ThreeJSLink(element),
  MMLModelGraphicsInterface: (element, updateMeshCallback) =>
    new ThreeJSElements.ThreeJSModel(element, updateMeshCallback),
  MMLPlaneGraphicsInterface: (element) => new ThreeJSElements.ThreeJSPlane(element),
  MMLPositionProbeGraphicsInterface: (element) => new ThreeJSElements.ThreeJSPositionProbe(element),
  MMLPromptGraphicsInterface: (element) => new ThreeJSElements.ThreeJSPrompt(element),
  MMLSphereGraphicsInterface: (element) => new ThreeJSElements.ThreeJSSphere(element),
  MMLTransformableGraphicsInterface: (element) => new ThreeJSElements.ThreeJSTransformable(element),
  MMLVideoGraphicsInterface: (element, updateMeshCallback: () => void) =>
    new ThreeJSElements.ThreeJSVideo(element, updateMeshCallback),
  MMLAnimationGraphicsInterface: (element) => new ThreeJSElements.ThreeJSAnimation(element),
  RemoteDocumentGraphicsInterface: (element) => new ThreeJSElements.ThreeJSRemoteDocument(element),
  BillboardVisualizerGraphicsInterface: (
    element: MElement<ThreeJSGraphicsAdapter>,
    svgContent: string,
    size: number,
    color?: MMLColor,
  ) => new ThreeJSVisualizers.ThreeJSBillboardVisualizer(element, svgContent, size, color),
  ModelVisualizerGraphicsInterface: (
    element: MElement<ThreeJSGraphicsAdapter>,
    url: string,
    scale: number,
  ) => new ThreeJSVisualizers.ThreeJSModelVisualizer(element, url, scale),
  PointLightHelperVisualizerGraphicsInterface: (
    element: MElement<ThreeJSGraphicsAdapter>,
    distance: number | null,
    color: MMLColor,
  ) => new ThreeJSVisualizers.ThreeJSPointLightHelperVisualizer(element, distance, color),
  SpotLightHelperVisualizerGraphicsInterface: (
    element: MElement<ThreeJSGraphicsAdapter>,
    angleDeg: number,
    distance: number | null,
    color: MMLColor,
  ) => new ThreeJSVisualizers.ThreeJSSpotLightHelperVisualizer(element, angleDeg, distance, color),
};
