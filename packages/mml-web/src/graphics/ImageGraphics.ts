import { Image, MImageProps } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class ImageGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Image<G>, updateMeshCallback: () => void) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract getWidthAndHeight(): { width: number; height: number };

  abstract setSrc(src: string | null, mImageProps: MImageProps): void;

  abstract setWidth(width: number | null, mImageProps: MImageProps): void;

  abstract setHeight(height: number | null, mImageProps: MImageProps): void;

  abstract setOpacity(opacity: number, mImageProps: MImageProps): void;

  abstract setEmissive(opacity: number, mImageProps: MImageProps): void;

  abstract setCastShadows(castShadows: boolean, mImageProps: MImageProps): void;

  abstract dispose(): void;
}
