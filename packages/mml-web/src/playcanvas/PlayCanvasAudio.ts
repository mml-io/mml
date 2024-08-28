import * as playcanvas from "playcanvas";

import { Audio, MAudioProps } from "../elements";
import { LoadingInstanceManager } from "../loading";
import { AudioGraphics } from "../MMLGraphicsInterface";

type AudioLoadedState = {
  asset: playcanvas.Asset;
};

export class PlayCanvasAudio extends AudioGraphics {
  private soundComponent: playcanvas.SoundComponent;
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Audio.tagName}.src`);
  private latestSrcAudioPromise: Promise<playcanvas.Asset> | null = null;
  protected loadedState: AudioLoadedState | null = null;
  private delayedStartTimer: NodeJS.Timeout | null = null;
  private delayedPauseTimer: NodeJS.Timeout | null = null;

  constructor(private audio: Audio) {
    super(audio);
    const audioEntity = this.audio.getContainer() as playcanvas.Entity;
    this.soundComponent = audioEntity.addComponent("sound", {
      positional: true,
      distanceModel: "inverse",
      volume: audio.props.volume,
    } as playcanvas.SoundComponent);
  }

  setSrc(src: string | null, mAudioProps: MAudioProps): void {
    console.log("setSrc", src);
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
          // TODO
          // If we've loaded a different audio since, or we're no longer connected, dispose of this one
          return;
        }
        console.log("loaded", asset);
        this.latestSrcAudioPromise = null;
        this.loadedState = {
          asset,
        };

        const sound = asset;
        // TODO - timing
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
          console.log({ slot });
          slot.stop();
          slot.overlap = false;
          this.syncAudioTime();

          // setInterval(() => {
          //   const instance = slot.instances[0]!;
          //   console.log({
          //     duration: instance.duration,
          //     currentTime: instance.currentTime,
          //     pitch: instance.pitch,
          //     startTime: instance.startTime,
          //     volume: instance.volume,
          //     isPlaying: instance.isPlaying,
          //   });
          // }, 1000);
        }

        this.srcLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  setStartTime(startTime: number, mAudioProps: MAudioProps): void {
    this.syncAudioTime();
  }
  setPauseTime(pauseTime: number | null, mAudioProps: MAudioProps): void {
    this.syncAudioTime();
  }
  setLoopDuration(loopDuration: number | null, mAudioProps: MAudioProps): void {
    throw new Error("Method not implemented.");
  }
  syncAudioTime(): void {
    console.log("syncAudioTime");

    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }

    if (!this.audio.props.src) {
      return;
    }

    const slot = this.soundComponent.slot("slot");
    if (slot) {
      if (!this.audio.props.enabled || this.audio.isDisabled()) {
        slot.stop();
        console.log("Disabled");
        return;
      }

      const documentTime = this.audio.getDocumentTime();

      if (this.delayedPauseTimer !== null) {
        clearTimeout(this.delayedPauseTimer);
        this.delayedPauseTimer = null;
      }

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
          console.log("Paused after pause time");
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
        console.log("Delayed start");
        return;
      } else if (this.audio.props.loop) {
        desiredAudioTime = currentTime % slot.duration;
      } else {
        desiredAudioTime = currentTime;
      }

      if (desiredAudioTime >= slot.duration) {
        slot.pause();
        console.log("Paused after duration");
        return;
      } else {
        console.log("Playing");
      }

      if (!slot.isPlaying) {
        slot.play();
      }
      const soundInstance = slot.instances[0];

      let delta = desiredAudioTime - soundInstance.currentTime;
      if (this.audio.props.loop) {
        // Check if the delta wrapping around is smaller (i.e. the desired and current are closer together if we wrap around)
        const loopedDelta = delta - slot.duration;
        if (Math.abs(delta) > Math.abs(loopedDelta)) {
          delta = loopedDelta;
        }
      }
      console.log({ desiredAudioTime, currentTime: soundInstance.currentTime, delta });

      if (Math.abs(delta) < 0.1) {
        // Do nothing - this is close enough - set the playback rate to 1
        slot.pitch = 1;
      } else if (Math.abs(delta) > 0.5) {
        slot.pitch = 1;
        slot.pause();
        soundInstance.currentTime = desiredAudioTime;
        slot.resume();
        console.log("Jumping");
        return;
      } else {
        if (delta > 0) {
          console.log("Speeding up");
          slot.pitch = 1.02;
        } else {
          console.log("Slowing down");
          slot.pitch = 0.98;
        }
      }
    }
  }

  enable(): void {
    throw new Error("Method not implemented.");
  }
  disable(): void {
    throw new Error("Method not implemented.");
  }
  setLoop(loop: boolean, mAudioProps: MAudioProps): void {
    throw new Error("Method not implemented.");
  }
  setEnabled(enabled: boolean, mAudioProps: MAudioProps): void {
    throw new Error("Method not implemented.");
  }
  setVolume(volume: number, mAudioProps: MAudioProps): void {
    this.soundComponent.volume = volume;
  }
  setConeAngle(coneAngle: number | null, mAudioProps: MAudioProps): void {
    throw new Error("Method not implemented.");
  }
  setConeFalloffAngle(coneFalloffAngle: number | null, mAudioProps: MAudioProps): void {
    throw new Error("Method not implemented.");
  }
  setDebug(debug: boolean, mAudioProps: MAudioProps): void {
    throw new Error("Method not implemented.");
  }

  private async asyncLoadSourceAsset(
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      const asset = new playcanvas.Asset(url, "audio", { url });
      this.audio.getScene().getRenderer().assets.add(asset);
      this.audio.getScene().getRenderer().assets.load(asset);
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
    const audioEntity = this.audio.getContainer() as playcanvas.Entity;
    audioEntity.removeComponent("sound");
  }
}
