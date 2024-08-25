import {
  Cube,
  Light,
  LightProps,
  LightTypes,
  MCubeProps,
  MElement,
  MModelProps,
  RemoteDocument,
  TransformableElement,
  TransformableElementProps,
} from "./elements";
import { Model } from "./elements/Model";

export type MMLColor = {
  r: number;
  g: number;
  b: number;
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
  RemoteDocumentGraphicsInterface: new (element: RemoteDocument) => RemoteDocumentGraphics;
  MElementGraphicsInterface: new (element: MElement) => MElementGraphics<C>;
  MMLTransformableGraphicsInterface: new (element: TransformableElement) => TransformableGraphics;
  MMLCubeGraphicsInterface: new (element: Cube) => CubeGraphics;
  MMLLightGraphicsInterface: new (element: Light) => LightGraphics;
  MMLModelGraphicsInterface: new (element: Model) => ModelGraphics;
}
