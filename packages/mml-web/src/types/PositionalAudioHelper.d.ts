declare module "three/addons/helpers/PositionalAudioHelper.js" {
  import { Object3D, PositionalAudio } from "three";
  export class PositionalAudioHelper extends Object3D {
    constructor(
      audio: PositionalAudio,
      range?: number,
      divisionsInnerAngle?: number,
      divisionsOuterAngle?: number,
    );
    audio: PositionalAudio;
    range: number;
    divisionsInnerAngle: number;
    divisionsOuterAngle: number;
    matrixAutoUpdate: boolean;
    update(): void;
    dispose(): void;
  }
}
