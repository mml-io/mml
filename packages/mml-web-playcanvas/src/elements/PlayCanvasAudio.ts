import { Audio, AudioGraphics, LoadingInstanceManager } from "mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

type AudioLoadedState = {
  asset: playcanvas.Asset;
};

export class PlayCanvasAudio extends AudioGraphics<PlayCanvasGraphicsAdapter> {
  private soundComponent: playcanvas.SoundComponent;
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Audio.tagName}.src`);
  private latestSrcAudioPromise: Promise<playcanvas.Asset> | null = null;
  protected loadedState: AudioLoadedState | null = null;
  private delayedStartTimer: NodeJS.Timeout | null = null;
  private delayedPauseTimer: NodeJS.Timeout | null = null;

  constructor(private audio: Audio<PlayCanvasGraphicsAdapter>) {
    super(audio);
    const audioEntity = this.audio.getContainer() as playcanvas.Entity;
    this.soundComponent = audioEntity.addComponent("sound", {
      positional: true,
      distanceModel: "inverse",
      volume: audio.props.volume,
    } as playcanvas.SoundComponent) as playcanvas.SoundComponent;
  }

  private getPlayCanvasApp(): playcanvas.AppBase {
    return this.audio.getScene().getGraphicsAdapter().getPlayCanvasApp();
  }

  setSrc(src: string | null): void {
    if (this.loadedState !== null) {
      this.soundComponent.removeSlot("slot");
      this.loadedState.asset.unload();
      this.loadedState = null;
    }
    if (!src) {
      this.srcLoadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.audio.contentSrcToContentAddress(src);
    const srcAudioPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    this.srcLoadingInstanceManager.start(this.audio.getLoadingProgressManager(), contentSrc);
    this.latestSrcAudioPromise = srcAudioPromise;
    srcAudioPromise
      .then((asset) => {
        if (this.latestSrcAudioPromise !== srcAudioPromise || !this.audio.isConnected) {
          // TODO - dispose?
          // If we've loaded a different audio since, or we're no longer connected, dispose of this one
          return;
        }
        this.latestSrcAudioPromise = null;
        this.loadedState = {
          asset,
        };

        const sound = asset;
        this.soundComponent.addSlot("slot", {
          volume: 1,
          pitch: 1,
          asset: sound.id,
          loop: true,
          overlap: false,
          autoPlay: false,
        });

        const slot = this.soundComponent.slot("slot");
        if (slot) {
          slot.stop();
          slot.overlap = false;
          this.syncAudioTime();
        }

        this.srcLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-audio.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  public setStartTime(): void {
    this.syncAudioTime();
  }

  public setPauseTime(): void {
    this.syncAudioTime();
  }

  public setLoopDuration(): void {
    this.syncAudioTime();
  }

  public syncAudioTime(): void {
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }
    if (this.delayedPauseTimer !== null) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }

    if (!this.audio.props.src) {
      return;
    }

    const slot = this.soundComponent.slot("slot");
    if (slot) {
      if (!this.audio.props.enabled || this.audio.isDisabled()) {
        slot.stop();
        return;
      }

      const documentTime = this.audio.getDocumentTime();

      if (this.audio.props.pauseTime !== null) {
        if (documentTime !== null && this.audio.props.pauseTime > documentTime) {
          // The pause time is in the future
          const delayedPauseTimer = setTimeout(() => {
            if (this.delayedPauseTimer === delayedPauseTimer) {
              this.delayedPauseTimer = null;
            }
            this.syncAudioTime();
          }, this.audio.props.pauseTime - documentTime);
          this.delayedPauseTimer = delayedPauseTimer;
        } else {
          slot.pause();
          return;
        }
      }

      let currentTime: number;
      if (documentTime) {
        currentTime = (documentTime - this.audio.props.startTime) / 1000;
      } else {
        currentTime = (this.audio.props.startTime ? this.audio.props.startTime : 0) / 1000;
      }
      let desiredAudioTime;
      if (currentTime < 0) {
        // The audio should not start yet
        slot.pause();
        const delayedStartTimer = setTimeout(() => {
          if (this.delayedStartTimer === delayedStartTimer) {
            this.delayedStartTimer = null;
          }
          this.syncAudioTime();
        }, -currentTime * 1000);
        this.delayedStartTimer = delayedStartTimer;
        return;
      } else if (this.audio.props.loop) {
        const slotDuration = slot.duration;
        desiredAudioTime = currentTime % slotDuration;
      } else {
        desiredAudioTime = currentTime;
      }

      if (desiredAudioTime >= slot.duration) {
        slot.pause();
        return;
      } else {
        // playing
      }

      if (!slot.isPlaying) {
        slot.play();
      }
      const soundInstance = slot.instances[0];

      // TODO - handle loop-duration

      let delta = desiredAudioTime - soundInstance.currentTime;
      if (this.audio.props.loop) {
        // Check if the delta wrapping around is smaller (i.e. the desired and current are closer together if we wrap around)
        const loopedDelta = delta - slot.duration;
        if (Math.abs(delta) > Math.abs(loopedDelta)) {
          delta = loopedDelta;
        }
      }

      if (Math.abs(delta) < 0.1) {
        // Do nothing - this is close enough - set the playback rate to 1
        slot.pitch = 1;
      } else if (Math.abs(delta) > 0.5) {
        slot.pitch = 1;
        slot.pause();
        soundInstance.currentTime = desiredAudioTime;
        slot.resume();
        return;
      } else {
        if (delta > 0) {
          slot.pitch = 1.02;
        } else {
          slot.pitch = 0.98;
        }
      }
    }
  }

  enable(): void {
    // TODO
  }
  disable(): void {
    // TODO
  }
  setLoop(): void {
    // TODO
  }
  setEnabled(): void {
    // TODO
  }
  setVolume(): void {
    this.soundComponent.volume = this.audio.props.volume;
  }
  setConeAngle(): void {
    // TODO
  }
  setConeFalloffAngle(): void {
    // TODO
  }
  setDebug(): void {
    // TODO
  }

  private async asyncLoadSourceAsset(
    url: string,
    // TODO - report progress
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      const asset = new playcanvas.Asset(url, "audio", { url });
      this.getPlayCanvasApp().assets.add(asset);
      this.getPlayCanvasApp().assets.load(asset);
      asset.ready((asset) => {
        resolve(asset);
      });
      // Listen for errors
      asset.on("error", (err) => {
        console.error("Error loading audio asset", err);
        reject(err);
      });
    });
  }

  dispose() {
    if (this.delayedPauseTimer) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }
    const audioEntity = this.audio.getContainer() as playcanvas.Entity;
    audioEntity.removeComponent("sound");
  }
}
