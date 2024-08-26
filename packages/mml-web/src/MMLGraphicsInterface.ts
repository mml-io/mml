import {
  Cube,
  Light,
  LightProps,
  LightTypes,
  MCubeProps,
  MElement,
  MModelProps,
  MPlaneProps,
  Plane,
  RemoteDocument,
  TransformableElement,
  TransformableElementProps,
} from "./elements";
import { Cylinder, MCylinderProps } from "./elements/Cylinder";
import { Image, MImageProps } from "./elements/Image";
import { Model } from "./elements/Model";
import { MSphereProps, Sphere } from "./elements/Sphere";
import { DebugHelper } from "./utils/DebugHelper";

export type MMLColor = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

export abstract class MElementGraphics<C> {
  constructor(element: MElement) {}

  abstract getContainer(): C;

  abstract dispose(): void;
}

export abstract class RemoteDocumentGraphics {
  constructor(element: RemoteDocument) {}

  abstract dispose(): void;
}

export abstract class TransformableGraphics {
  constructor(element: TransformableElement) {}

  abstract setX(x: number, transformableElementProps: TransformableElementProps): void;
  abstract setY(y: number, transformableElementProps: TransformableElementProps): void;
  abstract setZ(z: number, transformableElementProps: TransformableElementProps): void;
  abstract setRotationX(
    rotationX: number,
    transformableElementProps: TransformableElementProps,
  ): void;
  abstract setRotationY(
    rotationY: number,
    transformableElementProps: TransformableElementProps,
  ): void;
  abstract setRotationZ(
    rotationZ: number,
    transformableElementProps: TransformableElementProps,
  ): void;
  abstract setScaleX(scaleX: number, transformableElementProps: TransformableElementProps): void;
  abstract setScaleY(scaleY: number, transformableElementProps: TransformableElementProps): void;
  abstract setScaleZ(scaleZ: number, transformableElementProps: TransformableElementProps): void;

  abstract setVisibility(visible: boolean): void;

  abstract dispose(): void;
}

export abstract class ModelGraphics {
  constructor(element: Model) {}

  abstract enable(): void;
  abstract disable(): void;

  abstract setSrc(src: string | null, mModelProps: MModelProps): void;
  abstract setDebug(debug: boolean, mModelProps: MModelProps): void;

  abstract dispose(): void;
}

export abstract class ImageGraphics {
  constructor(element: Image) {}

  abstract enable(): void;
  abstract disable(): void;

  abstract setSrc(src: string | null, mImageProps: MImageProps): void;
  abstract setWidth(width: number | null, mImageProps: MImageProps): void;
  abstract setHeight(height: number | null, mImageProps: MImageProps): void;
  abstract setOpacity(opacity: number, mImageProps: MImageProps): void;
  abstract setCastShadows(castShadows: boolean, mImageProps: MImageProps): void;

  abstract dispose(): void;
}

export abstract class DebugHelperGraphics {
  constructor(debugHelper: DebugHelper) {}

  abstract dispose(): void;
}

export abstract class CubeGraphics {
  constructor(element: Cube) {}

  abstract enable(): void;
  abstract disable(): void;

  abstract setWidth(width: number, mCubeProps: MCubeProps): void;
  abstract setHeight(height: number, mCubeProps: MCubeProps): void;
  abstract setDepth(depth: number, mCubeProps: MCubeProps): void;
  abstract setColor(color: MMLColor, mCubeProps: MCubeProps): void;
  abstract setOpacity(opacity: number, mCubeProps: MCubeProps): void;
  abstract setCastShadows(castShadows: boolean, mCubeProps: MCubeProps): void;

  abstract dispose(): void;
}

export abstract class PlaneGraphics {
  constructor(element: Plane) {}

  abstract enable(): void;
  abstract disable(): void;

  abstract setWidth(width: number, mPlaneProps: MPlaneProps): void;
  abstract setHeight(height: number, mPlaneProps: MPlaneProps): void;
  abstract setDepth(depth: number, mPlaneProps: MPlaneProps): void;
  abstract setColor(color: MMLColor, mPlaneProps: MPlaneProps): void;
  abstract setOpacity(opacity: number, mPlaneProps: MPlaneProps): void;
  abstract setCastShadows(castShadows: boolean, mPlaneProps: MPlaneProps): void;

  abstract dispose(): void;
}

export abstract class CylinderGraphics {
  constructor(element: Cylinder) {}

  abstract enable(): void;
  abstract disable(): void;

  abstract setRadius(radius: number, mCylinderProps: MCylinderProps): void;
  abstract setHeight(height: number, mCylinderProps: MCylinderProps): void;
  abstract setColor(color: MMLColor, mCylinderProps: MCylinderProps): void;
  abstract setOpacity(opacity: number, mCylinderProps: MCylinderProps): void;
  abstract setCastShadows(castShadows: boolean, mCylinderProps: MCylinderProps): void;

  abstract dispose(): void;
}

export abstract class SphereGraphics {
  constructor(element: Sphere) {}

  abstract enable(): void;
  abstract disable(): void;

  abstract setRadius(width: number, mSphereProps: MSphereProps): void;
  abstract setColor(color: MMLColor, mSphereProps: MSphereProps): void;
  abstract setOpacity(opacity: number, mSphereProps: MSphereProps): void;
  abstract setCastShadows(castShadows: boolean, mSphereProps: MSphereProps): void;

  abstract dispose(): void;
}

export abstract class LightGraphics {
  constructor(element: Light) {}

  abstract enable(): void;
  abstract disable(): void;

  abstract setEnabled(enabled: boolean, mLightProps: LightProps): void;
  abstract setDebug(debug: boolean, mLightProps: LightProps): void;
  abstract setCastShadow(castShadow: boolean, mLightProps: LightProps): void;
  abstract setAngle(angle: number, mLightProps: LightProps): void;
  abstract setIntensity(intensity: number, mLightProps: LightProps): void;
  abstract setDistance(distance: number, mLightProps: LightProps): void;
  abstract setType(type: LightTypes, mLightProps: LightProps): void;
  abstract setColor(color: MMLColor, mLightProps: LightProps): void;

  abstract dispose(): void;
}

export interface MMLGraphicsInterface<C> {
  MMLDebugHelperGraphicsInterface: new (debugHelper: DebugHelper) => DebugHelperGraphics;
  RemoteDocumentGraphicsInterface: new (element: RemoteDocument) => RemoteDocumentGraphics;
  MElementGraphicsInterface: new (element: MElement) => MElementGraphics<C>;
  MMLTransformableGraphicsInterface: new (element: TransformableElement) => TransformableGraphics;
  MMLImageGraphicsInterface: new (element: Image) => ImageGraphics;
  MMLCubeGraphicsInterface: new (element: Cube) => CubeGraphics;
  MMLPlaneGraphicsInterface: new (element: Plane) => PlaneGraphics;
  MMLSphereGraphicsInterface: new (element: Sphere) => SphereGraphics;
  MMLCylinderGraphicsInterface: new (element: Cylinder) => CylinderGraphics;
  MMLLightGraphicsInterface: new (element: Light) => LightGraphics;
  MMLModelGraphicsInterface: new (element: Model) => ModelGraphics;
}
