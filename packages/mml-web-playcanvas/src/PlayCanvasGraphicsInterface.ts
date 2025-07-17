import { MMLGraphicsInterface } from "@mml-io/mml-web";

import * as PlayCanvasElements from "./elements";
import { PlayCanvasGraphicsAdapter } from "./PlayCanvasGraphicsAdapter";

export const PlayCanvasGraphicsInterface: MMLGraphicsInterface<PlayCanvasGraphicsAdapter> = {
  MElementGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasMElement(element),
  MMLDebugHelperGraphicsInterface: (debugHelper) =>
    new PlayCanvasElements.PlayCanvasDebugHelper(debugHelper),
  MMLAudioGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasAudio(element),
  MMLChatProbeGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasChatProbe(element),
  MMLCubeGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasCube(element),
  MMLCylinderGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasCylinder(element),
  MMLFrameGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasFrame(element),
  MMLImageGraphicsInterface: (element, updateMeshCallback: () => void) =>
    new PlayCanvasElements.PlayCanvasImage(element, updateMeshCallback),
  MMLInteractionGraphicsInterface: (element) =>
    new PlayCanvasElements.PlayCanvasInteraction(element),
  MMLLabelGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasLabel(element),
  MMLLightGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasLight(element),
  MMLLinkGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasLink(element),
  MMLModelGraphicsInterface: (element, updateMeshCallback: () => void) =>
    new PlayCanvasElements.PlayCanvasModel(element, updateMeshCallback),
  MMLPlaneGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasPlane(element),
  MMLPositionProbeGraphicsInterface: (element) =>
    new PlayCanvasElements.PlayCanvasPositionProbe(element),
  MMLPromptGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasPrompt(element),
  MMLSphereGraphicsInterface: (element) => new PlayCanvasElements.PlayCanvasSphere(element),
  MMLTransformableGraphicsInterface: (element) =>
    new PlayCanvasElements.PlayCanvasTransformable(element),
  MMLVideoGraphicsInterface: (element, updateMeshCallback: () => void) =>
    new PlayCanvasElements.PlayCanvasVideo(element, updateMeshCallback),
  RemoteDocumentGraphicsInterface: (element) =>
    new PlayCanvasElements.PlayCanvasRemoteDocument(element),
  MMLAnimationGraphicsInterface: (element) => {
    void element; // TODO: Implement
    return undefined as any;
  },
};
