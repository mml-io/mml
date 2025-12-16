import { MVideoProps, Video } from "../elements";
import { GraphicsAdapter } from "./GraphicsAdapter";

export abstract class VideoGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Video<G>, updateMeshCallback: () => void) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract getCollisionElement(): G["collisionType"] | null;

  abstract getWidthAndHeight(): { width: number; height: number };

  abstract setSrc(src: string | null, mVideoProps: MVideoProps): void;

  abstract setWidth(width: number | null, mVideoProps: MVideoProps): void;

  abstract setHeight(height: number | null, mVideoProps: MVideoProps): void;

  abstract setEnabled(enabled: boolean, mVideoProps: MVideoProps): void;

  abstract setCastShadows(castShadows: boolean, mVideoProps: MVideoProps): void;

  abstract setLoop(loop: boolean, mVideoProps: MVideoProps): void;

  abstract setVolume(volume: number, mVideoProps: MVideoProps): void;

  abstract setEmissive(emissive: number, mVideoProps: MVideoProps): void;

  abstract setStartTime(startTime: number, mVideoProps: MVideoProps): void;

  abstract setPauseTime(pauseTime: number | null, mVideoProps: MVideoProps): void;

  abstract syncVideoTime(): void;

  abstract dispose(): void;
}
