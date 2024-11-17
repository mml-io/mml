import { MModelProps, Model } from "../elements";
import { IVect3 } from "../math/Vect3";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class ModelGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Model<G>, updateMeshCallback: () => void) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getBoundingBox(): {
    centerOffset: IVect3;
    size: IVect3;
  } | null;

  abstract transformed(): void;

  abstract getCollisionElement(): G["collisionType"];

  abstract hasLoadedModel(): boolean;

  abstract hasLoadedAnimation(): boolean;

  abstract setSrc(src: string | null, mModelProps: MModelProps): void;

  abstract setAnim(anim: string | null, mModelProps: MModelProps): void;

  abstract setAnimEnabled(animEnabled: boolean | null, mModelProps: MModelProps): void;

  abstract setAnimLoop(animLoop: boolean | null, mModelProps: MModelProps): void;

  abstract setAnimStartTime(animStartTime: number | null, mModelProps: MModelProps): void;

  abstract setAnimPauseTime(animPauseTime: number | null, mModelProps: MModelProps): void;

  abstract setDebug(debug: boolean, mModelProps: MModelProps): void;

  abstract setCastShadows(castShadows: boolean, mModelProps: MModelProps): void;

  abstract dispose(): void;
}
