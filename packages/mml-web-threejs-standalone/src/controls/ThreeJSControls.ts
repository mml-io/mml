import { IVect3 } from "@mml-io/mml-web";

export interface ThreeJSControls {
  type: string;
  enable: () => void;
  disable: () => void;
  fitContent: (boundingBox: { min: IVect3; max: IVect3 }) => void;
  update: (dt: number) => void;
  dispose: () => void;
}
