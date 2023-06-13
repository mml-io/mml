import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";

const defaultAudioVolume = 1;
const defaultAudioRefDistance = 1;
const defaultAudioRolloffFactor = 1;
const defaultAudioLoop = true;
const defaultAudioEnabled = true;
const defaultAudioStartTime = 0;
const defaultAudioPauseTime = null;
const defaultAudioSrc = null;

export class Audio extends TransformableElement {
  static tagName = "m-audio";
  private documentTimeListener: { remove: () => void };
  private delayedStartTimer: NodeJS.Timeout | null = null;
  private delayedPauseTimer: NodeJS.Timeout | null = null;

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Audio.attributeHandler.getAttributes()];
  }

  private timer: NodeJS.Timer | null = null;
  private debugMeshes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];

  private loadedAudioState: {
    paused: boolean;
    audioElement: HTMLAudioElement;
    positionalAudio: THREE.PositionalAudio;
  } | null = null;

  private props = {
    startTime: defaultAudioStartTime,
    pauseTime: defaultAudioPauseTime as number | null,
    src: defaultAudioSrc as string | null,
    loop: defaultAudioLoop,
    enabled: defaultAudioEnabled,
    volume: defaultAudioVolume,
    refDistance: defaultAudioRefDistance,
    rolloffFactor: defaultAudioRolloffFactor,
    debug: false,
  };

  private static DebugGeometry = new THREE.SphereGeometry(1, 16, 16, 1);
  private static DebugMaterials = [
    new THREE.MeshBasicMaterial({
      color: 0xffa500,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    }),
    new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    }),
  ];

  private static attributeHandler = new AttributeHandler<Audio>({
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultAudioEnabled);
      instance.updateAudio();
    },
    loop: (instance, newValue) => {
      instance.props.loop = parseBoolAttribute(newValue, defaultAudioLoop);
      instance.updateAudio();
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultAudioStartTime);
      if (instance.loadedAudioState) {
        instance.syncAudioTime();
      }
    },
    "pause-time": (instance, newValue) => {
      instance.props.pauseTime = parseFloatAttribute(newValue, defaultAudioPauseTime);
      if (instance.loadedAudioState) {
        instance.syncAudioTime();
      }
    },
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.updateAudio();
    },
    volume: (instance, newValue) => {
      instance.props.volume = parseFloatAttribute(newValue, defaultAudioVolume);
      if (instance.loadedAudioState) {
        instance.loadedAudioState?.positionalAudio.setVolume(instance.props.volume);
      }
    },
    "ref-distance": (instance, newValue) => {
      instance.props.refDistance = parseFloatAttribute(newValue, defaultAudioRefDistance);
      if (instance.loadedAudioState) {
        instance.loadedAudioState?.positionalAudio.setRefDistance(instance.props.refDistance);
      }
    },
    "roll-off": (instance, newValue) => {
      instance.props.rolloffFactor = parseFloatAttribute(newValue, defaultAudioRolloffFactor);
      if (instance.loadedAudioState) {
        instance.loadedAudioState?.positionalAudio.setRefDistance(instance.props.rolloffFactor);
      }
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, false);
    },
  });

  constructor() {
    super();
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Audio.attributeHandler.handle(this, name, newValue);
    this.updateDebugVisualisation();
  }

  private syncAudioTime() {
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }

    if (!this.props.src) {
      return;
    }

    if (this.loadedAudioState) {
      const audioTag = this.loadedAudioState.audioElement;

      if (audioTag.readyState === 0) {
        return;
      }

      if (!this.props.enabled) {
        this.loadedAudioState.paused = true;
        audioTag.pause();
        return;
      } else {
        this.loadedAudioState.paused = false;
      }

      const documentTime = this.getDocumentTime();

      if (this.delayedPauseTimer !== null) {
        clearTimeout(this.delayedPauseTimer);
        this.delayedPauseTimer = null;
      }

      if (this.props.pauseTime !== null) {
        if (documentTime !== null && this.props.pauseTime > documentTime) {
          // The pause time is in the future
          const delayedPauseTimer = setTimeout(() => {
            if (this.delayedPauseTimer === delayedPauseTimer) {
              this.delayedPauseTimer = null;
            }
            this.syncAudioTime();
          }, this.props.pauseTime - documentTime);
          this.delayedPauseTimer = delayedPauseTimer;
        } else {
          // The audio should be paused because the pauseTime is in the past
          let totalPlaybackTime = (this.props.pauseTime - this.props.startTime) / 1000.0;
          if (totalPlaybackTime < 0) {
            // The pauseTime is before the startTime - set the audio's time to zero (i.e. unplayed)
            totalPlaybackTime = 0;
          }
          if (this.props.loop) {
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
        currentTime = (documentTime - this.props.startTime) / 1000;
      } else {
        currentTime = (this.props.startTime ? this.props.startTime : 0) / 1000;
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
      } else if (this.props.loop) {
        desiredAudioTime = currentTime % audioTag.duration;
      } else {
        desiredAudioTime = currentTime;
      }

      let delta = desiredAudioTime - audioTag.currentTime;
      if (this.props.loop) {
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

        const audioListener = this.getAudioListener();
        const audioContext = audioListener.context;
        if (audioContext.state === "running") {
          audioTag.muted = false;
        }

        audioTag.play().catch((e) => {
          console.error("failed to play", e);
        });
      }
    }
  }

  private documentTimeChanged() {
    if (this.loadedAudioState) {
      this.syncAudioTime();
    }
  }

  private updateAudio() {
    if (!this.isConnected) {
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

      const positionalAudio = new THREE.PositionalAudio(audioListener);

      positionalAudio.setMediaElementSource(audio);

      this.loadedAudioState = {
        paused: false,
        audioElement: audio,
        positionalAudio,
      };

      this.container.add(positionalAudio);
    }

    const tag = this.loadedAudioState.audioElement;
    if (!this.props.src) {
      if (!tag.paused) {
        this.loadedAudioState.paused = true;
        // TODO - this should remove the frame - not just pause it
        tag.pause();
        tag.src = "";

    } else {
      // Muted allows autoplay immediately without the user needing to interact with the document
      // Audio will be unmuted when the audiocontext is available
      tag.muted = true;
      tag.autoplay = true;
      tag.crossOrigin = "anonymous";
      tag.loop = this.props.loop;

      if (tag.src !== this.props.src) {
        if (tag.src) {
          // There is an existing src - stop playing to allow changing it
          this.loadedAudioState.paused = true;
          tag.pause();
        }

        try {
          tag.src = this.props.src;
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

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();


    this.updateAudio();
  }

  disconnectedCallback() {
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
    this.documentTimeListener.remove();
    super.disconnectedCallback();
  }

  private clearDebugVisualisation() {
    if (this.debugMeshes.length > 0) {
      this.debugMeshes.forEach((m) => m.removeFromParent());
      this.debugMeshes.length = 0;
    }
  }

  private updateDebugVisualisation() {
    if (!this.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.isConnected && !this.debugMeshes.length) {
        for (let i = 0; i < 2; ++i) {
          const mesh = new THREE.Mesh(Audio.DebugGeometry, Audio.DebugMaterials[i]);
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          // add to scene so no parent-driven scaling occurs
          this.getScene().getRootContainer().add(mesh);
          this.debugMeshes.push(mesh);
        }
      }

      if (this.debugMeshes.length === 2) {
        const worldPos = new THREE.Vector3();
        this.container.getWorldPosition(worldPos);

        const outerRadius =
          (this.props.refDistance / 0.5 + this.props.refDistance * (this.props.rolloffFactor - 1)) /
          this.props.rolloffFactor;
        this.debugMeshes[0].position.copy(worldPos);
        this.debugMeshes[0].scale.set(
          this.props.refDistance,
          this.props.refDistance,
          this.props.refDistance,
        );
        this.debugMeshes[1].position.copy(worldPos);
        this.debugMeshes[1].scale.set(outerRadius, outerRadius, outerRadius);
      }
    }
  }
}
