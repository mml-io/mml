import * as THREE from "three";
import { PositionalAudioHelper } from "three/addons/helpers/PositionalAudioHelper.js";

import { StandaloneThreeJSAdapter } from "./StandaloneThreeJSAdapter";
import { ThreeJSGraphicsInterface } from "./ThreeJSGraphicsInterface";
import { Audio, MAudioProps } from "../elements";
import { LoadingInstanceManager } from "../loading";
import { AudioGraphics } from "../MMLGraphicsInterface";

const debugAudioSphereSize = 0.25;
const debugAudioGeometry = new THREE.SphereGeometry(debugAudioSphereSize, 4, 2);
const debugAudioMaterial = new THREE.MeshBasicMaterial({
  wireframe: true,
  fog: false,
  toneMapped: false,
  color: 0x00ff00,
});
const audioRefDistance = 1;
const audioRolloffFactor = 1;

export class ThreeJSAudio extends AudioGraphics {
  private audioDebugHelper: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private audioDebugConeX: PositionalAudioHelper | null;
  private audioDebugConeY: PositionalAudioHelper | null;

  private delayedStartTimer: NodeJS.Timeout | null = null;
  private delayedPauseTimer: NodeJS.Timeout | null = null;
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Audio.tagName}.src`);

  private positionalAudio: THREE.PositionalAudio;

  private loadedAudioState: {
    paused: boolean;
    audioElement: HTMLAudioElement;
    positionalAudio: THREE.PositionalAudio;
  } | null = null;

  constructor(private audio: Audio) {
    super(audio);
  }

  disable(): void {}

  enable(): void {}

  public syncAudioTime() {
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }

    if (!this.audio.props.src) {
      return;
    }

    if (this.loadedAudioState) {
      const audioTag = this.loadedAudioState.audioElement;

      if (audioTag.readyState === 0) {
        return;
      }

      if (!this.audio.props.enabled || this.audio.isDisabled()) {
        this.loadedAudioState.paused = true;
        audioTag.pause();
        return;
      } else {
        this.loadedAudioState.paused = false;
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
          // The audio should be paused because the pauseTime is in the past
          let totalPlaybackTime =
            (this.audio.props.pauseTime - this.audio.props.startTime) / 1000.0;
          if (totalPlaybackTime < 0) {
            // The pauseTime is before the startTime - set the audio's time to zero (i.e. unplayed)
            totalPlaybackTime = 0;
          }
          if (this.audio.props.loop) {
            totalPlaybackTime = totalPlaybackTime % audioTag.duration;
          } else if (totalPlaybackTime > audioTag.duration) {
            totalPlaybackTime = audioTag.duration;
          }
          this.loadedAudioState.paused = true;
          audioTag.pause();
          audioTag.currentTime = totalPlaybackTime;
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
        audioTag.currentTime = 0;
        this.loadedAudioState.paused = true;
        audioTag.pause();
        const delayedStartTimer = setTimeout(() => {
          if (this.delayedStartTimer === delayedStartTimer) {
            this.delayedStartTimer = null;
          }
          this.syncAudioTime();
        }, -currentTime * 1000);
        this.delayedStartTimer = delayedStartTimer;
        return;
      } else if (this.audio.props.loop) {
        desiredAudioTime = currentTime % audioTag.duration;
      } else {
        desiredAudioTime = currentTime;
      }

      let delta = desiredAudioTime - audioTag.currentTime;
      if (this.audio.props.loop) {
        // Check if the delta wrapping around is smaller (i.e. the desired and current are closer together if we wrap around)
        const loopedDelta = delta - audioTag.duration;
        if (Math.abs(delta) > Math.abs(loopedDelta)) {
          delta = loopedDelta;
        }
      }

      if (Math.abs(delta) < 0.1) {
        // Do nothing - this is close enough - set the playback rate to 1
        audioTag.playbackRate = 1;
      } else if (Math.abs(delta) > 0.5) {
        audioTag.currentTime = desiredAudioTime;
        audioTag.playbackRate = 1;
      } else {
        if (delta > 0) {
          audioTag.playbackRate = 1.02;
        } else {
          audioTag.playbackRate = 0.98;
        }
      }

      if (desiredAudioTime >= audioTag.duration) {
        this.loadedAudioState.paused = true;
        audioTag.pause();
      } else {
        this.loadedAudioState.paused = false;

        // TODO - this should be on an interface that is present even when not in standalone mode
        const audioListener = this.getAudioListener();
        const audioContext = audioListener.context;
        if (audioContext.state === "running") {
          audioTag.play().catch((e) => {
            console.error("failed to play", e);
          });
        }
      }
    }
  }

  private updateAudio() {
    if (!this.audio.isConnected) {
      return;
    }

    const audioListener = this.getAudioListener();
    const audioContext = audioListener.context;

    if (!this.loadedAudioState) {
      const audio = document.createElement("audio");
      audio.addEventListener("pause", () => {
        if (this.loadedAudioState?.paused) {
          // Pause is intentional
          return;
        }
        // The audio was likely paused (unintentionally) by the user using system controls
        this.syncAudioTime();
      });

      this.positionalAudio = new THREE.PositionalAudio(audioListener);
      this.positionalAudio.setMediaElementSource(audio);
      this.positionalAudio.setVolume(this.audio.props.volume);
      this.positionalAudio.setDirectionalCone(
        this.audio.props.coneAngle,
        this.audio.props.coneFalloffAngle ?? 360,
        0,
      );
      this.positionalAudio.setRefDistance(audioRefDistance);
      this.positionalAudio.setRolloffFactor(audioRolloffFactor);

      this.loadedAudioState = {
        paused: false,
        audioElement: audio,
        positionalAudio: this.positionalAudio,
      };

      this.audio.getContainer().add(this.positionalAudio);
    }

    const tag = this.loadedAudioState.audioElement;
    if (!this.audio.props.src) {
      if (!tag.paused) {
        this.loadedAudioState.paused = true;
        tag.pause();
        tag.src = "";
        tag.remove();
        this.positionalAudio.disconnect();
        this.positionalAudio.remove();
        this.loadedAudioState = null;
      }
    } else {
      tag.autoplay = true;
      tag.crossOrigin = "anonymous";
      tag.loop = this.audio.props.loop;

      const contentAddress = this.audio.contentSrcToContentAddress(this.audio.props.src);
      if (tag.src !== contentAddress) {
        if (tag.src) {
          // There is an existing src - stop playing to allow changing it
          this.loadedAudioState.paused = true;
          tag.pause();
        }

        try {
          tag.src = contentAddress;
        } catch (e) {
          console.error("src failed to switch", e);
        }
      }

      audioContext.addEventListener("statechange", () => {
        this.syncAudioTime();
      });
      tag.addEventListener("loadeddata", () => {
        this.syncAudioTime();
      });
    }

    this.syncAudioTime();
  }

  setSrc(newValue: string | null, mAudioProps: MAudioProps): void {
    this.updateAudio();
  }
  setStartTime(startTime: number, mAudioProps: MAudioProps): void {
    if (this.loadedAudioState) {
      this.syncAudioTime();
    }
  }
  setPauseTime(pauseTime: number | null, mAudioProps: MAudioProps): void {
    if (this.loadedAudioState) {
      this.syncAudioTime();
    }
  }
  setLoopDuration(loopDuration: number | null, mAudioProps: MAudioProps): void {
    throw new Error("Method not implemented.");
  }
  setLoop(loop: boolean, mAudioProps: MAudioProps): void {
    this.updateAudio();
  }
  setEnabled(enabled: boolean, mAudioProps: MAudioProps): void {
    this.updateAudio();
  }
  setVolume(volume: number, mAudioProps: MAudioProps): void {
    if (this.loadedAudioState) {
      this.loadedAudioState?.positionalAudio.setVolume(volume);
    }
  }
  setConeAngle(coneAngle: number | null, mAudioProps: MAudioProps): void {
    if (this.loadedAudioState) {
      this.loadedAudioState.positionalAudio.setDirectionalCone(
        mAudioProps.coneAngle,
        mAudioProps.coneFalloffAngle ?? 360,
        0,
      );
    }
    this.updateDebugVisualisation();
  }
  setConeFalloffAngle(coneFalloffAngle: number | null, mAudioProps: MAudioProps): void {
    if (this.loadedAudioState) {
      this.loadedAudioState.positionalAudio.setDirectionalCone(
        mAudioProps.coneAngle,
        mAudioProps.coneFalloffAngle ?? 360,
        0,
      );
      this.updateDebugVisualisation();
    }
  }
  setDebug(debug: boolean, mAudioProps: MAudioProps): void {
    // TODO
  }

  dispose() {
    this.clearDebugVisualisation();

    if (this.loadedAudioState) {
      this.loadedAudioState.paused = true;
      this.loadedAudioState.audioElement.pause();
      this.loadedAudioState.audioElement.src = "";
      this.loadedAudioState = null;
    }
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }
    if (this.delayedPauseTimer) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }
    this.srcLoadingInstanceManager.dispose();
  }

  private clearDebugVisualisation() {
    if (this.audioDebugHelper) {
      this.audioDebugHelper.remove();
      this.audioDebugHelper = null;
    }
    if (this.audioDebugConeX) {
      this.audioDebugConeX.remove();
      this.audioDebugConeX = null;
      this.audioDebugConeY?.remove();
      this.audioDebugConeY = null;
    }
  }

  private updateDebugVisualisation() {
    if (!this.audio.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (!this.audioDebugHelper) {
        this.audioDebugHelper = new THREE.Mesh(debugAudioGeometry, debugAudioMaterial);
        this.audio.getContainer().add(this.audioDebugHelper);
      }
      if (!this.audioDebugConeX && this.audio.props.coneAngle) {
        this.audioDebugConeX = new PositionalAudioHelper(this.positionalAudio, 10);
        this.positionalAudio.add(this.audioDebugConeX);
        this.audioDebugConeY = new PositionalAudioHelper(this.positionalAudio, 10);
        this.audioDebugConeY.rotation.z = Math.PI / 2;
        this.positionalAudio.add(this.audioDebugConeY);
      }
      if (!this.audio.props.coneAngle && this.audioDebugConeX) {
        this.audioDebugConeX.remove();
        this.audioDebugConeX = null;
        this.audioDebugConeY?.remove();
        this.audioDebugConeY = null;
      }
    }
    this.audioDebugConeX?.update();
    this.audioDebugConeY?.update();
  }

  private getAudioListener() {
    const adapter = this.audio.getScene().getGraphicsAdapter() as StandaloneThreeJSAdapter;
    return adapter.getAudioListener();
  }
}
