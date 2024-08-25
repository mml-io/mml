import { VideoSource, VideoSourceProps } from "./VideoSource";

export class StaticFileVideoSource implements VideoSource {
  private delayedStartTimer: NodeJS.Timeout | null = null;
  private delayedPauseTimer: NodeJS.Timeout | null = null;
  private shouldBePaused = false;
  private pauseListener: () => void;
  private latestProps: VideoSourceProps | null = null;

  constructor(
    private srcURL: URL,
    private videoTag: HTMLVideoElement,
    private getDocumentTime: () => number | null,
  ) {
    this.pauseListener = () => {
      if (this.shouldBePaused) {
        // Pause is intentional
        return;
      }
      // The video was likely paused (unintentionally) by the user using system controls
      if (this.latestProps) {
        this.syncVideoSource(this.latestProps);
      }
    };
    videoTag.addEventListener("pause", this.pauseListener);

    try {
      videoTag.src = srcURL.toString();
    } catch (e) {
      console.error("src failed to switch", e);
    }
  }

  getContentAddress(): string {
    return this.srcURL.toString();
  }

  dispose() {
    this.videoTag.removeEventListener("pause", this.pauseListener);
    this.videoTag.src = "";
    if (this.delayedPauseTimer !== null) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }
    if (this.delayedStartTimer !== null) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }
  }

  syncVideoSource(props: VideoSourceProps): void {
    const documentTimeMilliseconds = this.getDocumentTime();
    this.latestProps = props;
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }
    if (this.delayedPauseTimer !== null) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }

    const startTimeMilliseconds = props.startTime ? props.startTime : 0;
    const pauseTimeMilliseconds = props.pauseTime;
    if (pauseTimeMilliseconds !== null) {
      if (documentTimeMilliseconds !== null && pauseTimeMilliseconds > documentTimeMilliseconds) {
        // The pause time is in the future
        const delayedPauseTimer = setTimeout(() => {
          if (this.delayedPauseTimer === delayedPauseTimer) {
            this.delayedPauseTimer = null;
          }
          this.syncVideoSource(this.latestProps!);
        }, pauseTimeMilliseconds - documentTimeMilliseconds);
        this.delayedPauseTimer = delayedPauseTimer;
      } else {
        // The video should be paused because the pauseTime is in the past
        let totalPlaybackTimeSeconds = (pauseTimeMilliseconds - startTimeMilliseconds) / 1000.0;
        if (totalPlaybackTimeSeconds < 0) {
          // The pauseTime is before the startTime - set the video's time to zero (i.e. unplayed)
          totalPlaybackTimeSeconds = 0;
        }
        if (props.loop) {
          totalPlaybackTimeSeconds = totalPlaybackTimeSeconds % this.videoTag.duration;
        } else if (totalPlaybackTimeSeconds > this.videoTag.duration) {
          totalPlaybackTimeSeconds = this.videoTag.duration;
        }
        this.shouldBePaused = true;
        this.videoTag.pause();
        this.videoTag.currentTime = totalPlaybackTimeSeconds;
        return;
      }
    }

    let currentTimeSeconds = 0;
    if (documentTimeMilliseconds) {
      currentTimeSeconds = (documentTimeMilliseconds - startTimeMilliseconds) / 1000;
    } else {
      currentTimeSeconds = startTimeMilliseconds / 1000;
    }
    let desiredVideoTimeSeconds;
    if (currentTimeSeconds < 0) {
      // The video should not start yet
      this.videoTag.currentTime = 0;
      this.shouldBePaused = true;
      this.videoTag.pause();
      const delayedStartTimer = setTimeout(() => {
        if (this.delayedStartTimer === delayedStartTimer) {
          this.delayedStartTimer = null;
        }
        this.syncVideoSource(this.latestProps!);
      }, -currentTimeSeconds * 1000);
      this.delayedStartTimer = delayedStartTimer;
      return;
    } else if (props.loop) {
      desiredVideoTimeSeconds = currentTimeSeconds % this.videoTag.duration;
    } else {
      desiredVideoTimeSeconds = currentTimeSeconds;
    }

    let delta = desiredVideoTimeSeconds - this.videoTag.currentTime;
    if (props.loop) {
      // Check if the delta wrapping around is smaller (i.e. the desired and current are closer together if we wrap around)
      const loopedDelta = delta - this.videoTag.duration;
      if (Math.abs(delta) > Math.abs(loopedDelta)) {
        delta = loopedDelta;
      }
    }

    if (Math.abs(delta) < 0.1) {
      // Do nothing - this is close enough - set the playback rate to 1
      this.videoTag.playbackRate = 1;
    } else if (Math.abs(delta) > 0.5) {
      this.videoTag.currentTime = desiredVideoTimeSeconds;
      this.videoTag.playbackRate = 1;
    } else {
      if (delta > 0) {
        this.videoTag.playbackRate = 1.02;
      } else {
        this.videoTag.playbackRate = 0.98;
      }
    }

    if (desiredVideoTimeSeconds >= this.videoTag.duration) {
      this.shouldBePaused = true;
      this.videoTag.pause();
      return;
    } else {
      this.shouldBePaused = false;
      if (this.videoTag.paused) {
        this.videoTag.play().catch((e) => {
          console.error("failed to play", e);
        });
      }
      return;
    }
  }
}
