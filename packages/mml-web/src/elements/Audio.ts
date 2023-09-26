import * as THREE from "three";
import { PositionalAudioHelper } from "three/addons/helpers/PositionalAudioHelper.js";

import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";

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

const defaultAudioVolume = 1;
const defaultAudioLoop = true;
const defaultAudioEnabled = true;
const defaultAudioStartTime = 0;
const defaultAudioPauseTime = null;
const defaultAudioSrc = null;
const defaultAudioInnerConeAngle: number = 360;
const defaultAudioOuterConeAngle = 0;

function clampAudioConeAngle(angle: number) {
  return Math.max(Math.min(angle, 360), 0);
}

export class Audio extends TransformableElement {
  static tagName = "m-audio";

  private audioAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    volume: [
      AnimationType.Number,
      defaultAudioVolume,
      (newValue: number) => {
        this.props.volume = newValue;
        if (this.loadedAudioState) {
          this.loadedAudioState?.positionalAudio.setVolume(this.props.volume);
        }
      },
    ],
    "cone-angle": [
      AnimationType.Number,
      defaultAudioInnerConeAngle,
      (newValue: number | null) => {
        this.props.innerCone = newValue === null ? null : clampAudioConeAngle(newValue);

        if (this.loadedAudioState) {
          this.loadedAudioState.positionalAudio.setDirectionalCone(
            this.props.innerCone ?? defaultAudioInnerConeAngle,
            this.props.outerCone ?? defaultAudioOuterConeAngle,
            0,
          );
        }

        this.updateDebugVisualisation();
      },
    ],
    "cone-falloff-angle": [
      AnimationType.Number,
      defaultAudioOuterConeAngle,
      (newValue: number) => {
        this.props.outerCone = clampAudioConeAngle(newValue);
        if (this.loadedAudioState) {
          this.loadedAudioState.positionalAudio.setDirectionalCone(
            this.props.innerCone ?? defaultAudioInnerConeAngle,
            this.props.outerCone,
            0,
          );

          this.updateDebugVisualisation();
        }
      },
    ],
  });

  private documentTimeListener: { remove: () => void };
  private delayedStartTimer: NodeJS.Timeout | null = null;
  private delayedPauseTimer: NodeJS.Timeout | null = null;
  private audioDebugHelper: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private audioDebugConeX: PositionalAudioHelper | null;
  private audioDebugConeY: PositionalAudioHelper | null;

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Audio.attributeHandler.getAttributes()];
  }

  private positionalAudio: THREE.PositionalAudio;

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
    innerCone: null as number | null,
    outerCone: defaultAudioOuterConeAngle,
    debug: false,
  };

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
      instance.audioAnimatedAttributeHelper.elementSetAttribute(
        "volume",
        parseFloatAttribute(newValue, defaultAudioVolume),
      );
    },
    "cone-angle": (instance, newValue) => {
      instance.audioAnimatedAttributeHelper.elementSetAttribute(
        "cone-angle",
        parseFloatAttribute(newValue, null),
      );
    },
    "cone-falloff-angle": (instance, newValue) => {
      instance.audioAnimatedAttributeHelper.elementSetAttribute(
        "cone-falloff-angle",
        parseFloatAttribute(newValue, defaultAudioOuterConeAngle),
      );
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, false);
      instance.updateDebugVisualisation();
    },
  });

  constructor() {
    super();
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.audioAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.audioAnimatedAttributeHelper.removeAnimation(child, attr);
      }
    }
    super.removeSideEffectChild(child);
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

      this.positionalAudio = new THREE.PositionalAudio(audioListener);
      this.positionalAudio.setMediaElementSource(audio);
      this.positionalAudio.setVolume(this.props.volume);
      this.positionalAudio.setDirectionalCone(
        this.props.innerCone ?? defaultAudioInnerConeAngle,
        this.props.outerCone,
        0,
      );
      this.positionalAudio.setRefDistance(audioRefDistance);
      this.positionalAudio.setRolloffFactor(audioRolloffFactor);

      this.loadedAudioState = {
        paused: false,
        audioElement: audio,
        positionalAudio: this.positionalAudio,
      };

      this.container.add(this.positionalAudio);
    }

    const tag = this.loadedAudioState.audioElement;
    if (!this.props.src) {
      if (!tag.paused) {
        this.loadedAudioState.paused = true;
        // TODO - this should remove the frame - not just pause it
        tag.pause();
        tag.src = "";
      }
    } else {
      // Muted allows autoplay immediately without the user needing to interact with the document
      // Audio will be unmuted when the audiocontext is available
      tag.muted = true;
      tag.autoplay = true;
      tag.crossOrigin = "anonymous";
      tag.loop = this.props.loop;

      const contentAddress = this.contentSrcToContentAddress(this.props.src);
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

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });

    this.updateAudio();
    this.updateDebugVisualisation();
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
    this.clearDebugVisualisation();
    super.disconnectedCallback();
  }

  private clearDebugVisualisation() {
    if (this.audioDebugHelper) {
      this.audioDebugHelper.removeFromParent();
      this.audioDebugHelper = null;
    }
    if (this.audioDebugConeX) {
      this.audioDebugConeX.removeFromParent();
      this.audioDebugConeX = null;
      this.audioDebugConeY?.removeFromParent();
      this.audioDebugConeY = null;
    }
  }

  private updateDebugVisualisation() {
    if (!this.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (!this.audioDebugHelper) {
        this.audioDebugHelper = new THREE.Mesh(debugAudioGeometry, debugAudioMaterial);
        this.container.add(this.audioDebugHelper);
      }
      if (!this.audioDebugConeX && this.props.innerCone) {
        this.audioDebugConeX = new PositionalAudioHelper(this.positionalAudio, 10);
        this.positionalAudio.add(this.audioDebugConeX);
        this.audioDebugConeY = new PositionalAudioHelper(this.positionalAudio, 10);
        this.audioDebugConeY.rotation.z = Math.PI / 2;
        this.positionalAudio.add(this.audioDebugConeY);
      }
      if (!this.props.innerCone && this.audioDebugConeX) {
        this.audioDebugConeX.removeFromParent();
        this.audioDebugConeX = null;
        this.audioDebugConeY?.removeFromParent();
        this.audioDebugConeY = null;
      }
    }
    this.audioDebugConeX?.update();
    this.audioDebugConeY?.update();
  }
}
