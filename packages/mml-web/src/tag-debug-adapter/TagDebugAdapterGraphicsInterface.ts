import { Matr4, Vect3 } from "../math";
import { MMLGraphicsInterface } from "../scene";
import { TagDebugGraphicsAdapter } from "./StandaloneTagDebugAdapter";
import { TagDebugAdapterDebugHelper } from "./TagDebugAdapterDebugHelper";
import { TagDebugAdapterElement } from "./TagDebugAdapterElement";
import { TagDebugMElement } from "./TagDebugMElement";

export const TagDebugAdapterGraphicsInterface: MMLGraphicsInterface<TagDebugGraphicsAdapter> = {
  MElementGraphicsInterface: (element) => new TagDebugMElement(element),
  MMLDebugHelperGraphicsInterface: (debugHelper) => new TagDebugAdapterDebugHelper(debugHelper),
  MMLCubeGraphicsInterface: TagDebugAdapterElement(
    {
      setWidth: "width",
      setHeight: "height",
      setDepth: "depth",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity",
    },
    {},
  ),
  MMLSphereGraphicsInterface: TagDebugAdapterElement(
    {
      setRadius: "radius",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity",
    },
    {},
  ),
  MMLPlaneGraphicsInterface: TagDebugAdapterElement(
    {
      setWidth: "width",
      setHeight: "height",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity",
    },
    {},
  ),
  MMLImageGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setWidth: "width",
      setHeight: "height",
      setEmissive: "emissive",
      setCastShadows: "cast-shadows",
      setOpacity: "opacity",
    },
    {
      getWidthAndHeight: () => ({ width: 0, height: 0 }),
    },
  ),
  MMLAudioGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setEnabled: "enabled",
      setLoop: "loop",
      setLoopDuration: "loop-duration",
      setVolume: "volume",
      setStartTime: "start-time",
      setPauseTime: "pause-time",
      setConeAngle: "cone-angle",
      setConeFalloffAngle: "cone-falloff-angle",
      setDebug: "debug",
    },
    {
      syncAudioTime: () => {},
    },
  ),
  MMLCylinderGraphicsInterface: TagDebugAdapterElement(
    {
      setRadius: "radius",
      setHeight: "height",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity",
    },
    {},
  ),
  MMLTransformableGraphicsInterface: TagDebugAdapterElement(
    {
      setX: "x",
      setY: "y",
      setZ: "z",
      setRotationX: "rx",
      setRotationY: "ry",
      setRotationZ: "rz",
      setScaleX: "sx",
      setScaleY: "sy",
      setScaleZ: "sz",
      setVisible: "visible",
      setSocket: "socket",
    },
    {
      getWorldMatrix: () => {
        return new Matr4();
      },
      getWorldPosition: () => {
        return new Vect3(0, 0, 0);
      },
      getLocalPosition: () => {
        return new Vect3(0, 0, 0);
      },
      getVisible: () => {
        return true;
      },
    },
  ),
  RemoteDocumentGraphicsInterface: TagDebugAdapterElement(
    {},
    {
      showError() {
        // no-op
      },
      dispose() {
        // no-op
      },
    },
  ),
  MMLLightGraphicsInterface: TagDebugAdapterElement(
    {
      setEnabled: "enabled",
      setDebug: "debug",
      setCastShadows: "cast-shadows",
      setAngle: "angle",
      setIntensity: "intensity",
      setDistance: "distance",
      setType: "type",
      setColor: "color",
    },
    {},
  ),
  MMLLinkGraphicsInterface: TagDebugAdapterElement(
    {
      setHref: "href",
      setTarget: "target",
    },
    {},
  ),
  MMLModelGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setDebug: "debug",
      setCastShadows: "cast-shadows",
      setAnim: "anim",
      setAnimEnabled: "anim-enabled",
      setAnimStartTime: "anim-start-time",
      setAnimPauseTime: "anim-pause-time",
      setAnimLoop: "anim-loop",
    },
    {
      getBoundingBox: () => ({
        centerOffset: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 },
      }),
      hasLoadedAnimation: () => false,
      hasLoadedModel: () => false,
      transformed: () => false,
    },
  ),
  MMLVideoGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setWidth: "width",
      setHeight: "height",
      setEnabled: "enabled",
      setCastShadows: "cast-shadows",
      setLoop: "loop",
      setVolume: "volume",
      setEmissive: "emissive",
      setStartTime: "start-time",
      setPauseTime: "pause-time",
    },
    {
      syncVideoTime: () => {},
      getWidthAndHeight: () => ({ width: 0, height: 0 }),
    },
  ),
  MMLFrameGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setDebug: "debug",
      setLoadRange: "load-range",
      setUnloadRange: "unload-range",
      setMinX: "min-x",
      setMaxX: "max-x",
      setMinY: "min-y",
      setMaxY: "max-y",
      setMinZ: "min-z",
      setMaxZ: "max-z",
    },
    {},
  ),
  MMLLabelGraphicsInterface: TagDebugAdapterElement(
    {
      setContent: "content",
      setFontSize: "font-size",
      setAlignment: "alignment",
      setPadding: "padding",
      setColor: "color",
      setFontColor: "font-color",
      setEmissive: "emissive",
      setWidth: "width",
      setHeight: "height",
      setCastShadows: "cast-shadows",
    },
    {},
  ),
  MMLPromptGraphicsInterface: TagDebugAdapterElement(
    {
      setMessage: "message",
      setPlaceholder: "placeholder",
      setPrefill: "prefill",
      setDebug: "debug",
    },
    {},
  ),
  MMLInteractionGraphicsInterface: TagDebugAdapterElement(
    {
      setRange: "range",
      setInFocus: "in-focus",
      setLineOfSight: "line-of-sight",
      setPriority: "priority",
      setPrompt: "prompt",
      setDebug: "debug",
    },
    {},
  ),
  MMLChatProbeGraphicsInterface: TagDebugAdapterElement(
    {
      setRange: "range",
      setDebug: "debug",
    },
    {},
  ),
  MMLPositionProbeGraphicsInterface: TagDebugAdapterElement(
    {
      setRange: "range",
      setDebug: "debug",
    },
    {},
  ),
  MMLAnimationGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setWeight: "weight",
      setLoop: "loop",
      setStartTime: "start-time",
      setPauseTime: "pause-time",
    },
    {},
  ),
};
