export type VideoSourceProps = {
  startTime: number | null;
  pauseTime: number | null;
  loop: boolean;
  enabled: boolean;
  volume: number;
  width: number | null;
  height: number | null;
};

export interface VideoSource {
  getContentAddress(): string;
  syncVideoSource(props: VideoSourceProps): void;
  dispose(): void;
}
