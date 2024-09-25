import { Audio, MAudioProps } from "../elements";
import { GraphicsAdapter } from "../GraphicsAdapter";

export abstract class AudioGraphics<G extends GraphicsAdapter = GraphicsAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element: Audio<G>) {}

  abstract enable(): void;

  abstract disable(): void;

  abstract setSrc(src: string | null, mAudioProps: MAudioProps): void;

  abstract setStartTime(startTime: number, mAudioProps: MAudioProps): void;

  abstract setPauseTime(pauseTime: number | null, mAudioProps: MAudioProps): void;

  abstract setLoopDuration(loopDuration: number | null, mAudioProps: MAudioProps): void;

  abstract setLoop(loop: boolean, mAudioProps: MAudioProps): void;

  abstract setEnabled(enabled: boolean, mAudioProps: MAudioProps): void;

  abstract setVolume(volume: number, mAudioProps: MAudioProps): void;

  abstract setConeAngle(coneAngle: number | null, mAudioProps: MAudioProps): void;

  abstract setConeFalloffAngle(coneFalloffAngle: number | null, mAudioProps: MAudioProps): void;

  abstract setDebug(debug: boolean, mAudioProps: MAudioProps): void;

  abstract syncAudioTime(): void;

  abstract dispose(): void;
}
