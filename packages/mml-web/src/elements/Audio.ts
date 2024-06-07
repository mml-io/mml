import * as THREE from "three";
import { PositionalAudioHelper } from "three/addons/helpers/PositionalAudioHelper.js";

import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

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
const defaultAudioLoopDuration = null;
const defaultAudioEnabled = true;
const defaultAudioStartTime = 0;
const defaultAudioPauseTime = null;
const defaultAudioSrc = null;
const defaultAudioInnerConeAngle: number = 360;
const defaultAudioOuterConeAngle = 0;
const defaultAudioDebug = false;

function clampAudioConeAngle(angle: number) {
  return Math.max(Math.min(angle, 360), 0);
}

function extendAudioToDuration(
  context: AudioContext,
  buffer: AudioBuffer,
  seconds: number,
): AudioBuffer {
  const updatedBuffer = context.createBuffer(
    buffer.numberOfChannels,
    Math.ceil(seconds * buffer.sampleRate),
    buffer.sampleRate,
  );
  for (let channelNumber = 0; channelNumber < buffer.numberOfChannels; channelNumber++) {
    const channelData = buffer.getChannelData(channelNumber);
    const updatedChannelData = updatedBuffer.getChannelData(channelNumber);
    updatedChannelData.set(channelData, 0);
  }
  return updatedBuffer;
}

export class Audio extends TransformableElement {
  static tagName = "m-audio";

  private audioAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    volume: [
      AnimationType.Number,
      defaultAudioVolume,
      (newValue: number) => {
        this.props.volume = newValue;
        if (this.positionalAudio) {
          this.positionalAudio.setVolume(this.props.volume);
        }
      },
    ],
    "cone-angle": [
      AnimationType.Number,
      defaultAudioInnerConeAngle,
      (newValue: number | null) => {
        this.props.innerCone = newValue === null ? null : clampAudioConeAngle(newValue);

        if (this.positionalAudio) {
          this.positionalAudio.setDirectionalCone(
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
        if (this.positionalAudio) {
          this.positionalAudio.setDirectionalCone(
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
  private delayedPauseTimer: NodeJS.Timeout | null = null;
  private audioDebugHelper: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private audioDebugConeX: PositionalAudioHelper | null;
  private audioDebugConeY: PositionalAudioHelper | null;
  private audioContextStateChangedListener = () => {
    this.syncAudioTime();
  };

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Audio.attributeHandler.getAttributes()];
  }

  private positionalAudio: THREE.PositionalAudio | null = null;

  private loadedAudioState: {
    loadedAudio:
      | {
          mode: "LOADED";
          buffer: AudioBuffer;
          currentSource: {
            sourceNode: AudioBufferSourceNode;
            contextStartTime: number;
          } | null;
          paddedBuffer?: {
            buffer: AudioBuffer;
            totalDuration: number;
          };
        }
      | {
          mode: "LOADING";
          abortController: AbortController;
        }
      | null;
    currentSrc: string;
  } | null = null;

  private props = {
    startTime: defaultAudioStartTime,
    pauseTime: defaultAudioPauseTime as number | null,
    src: defaultAudioSrc as string | null,
    loop: defaultAudioLoop,
    loopDuration: defaultAudioLoopDuration as number | null,
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
    "loop-duration": (instance, newValue) => {
      instance.props.loopDuration = parseFloatAttribute(newValue, null);
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
      instance.props.debug = parseBoolAttribute(newValue, defaultAudioDebug);
      instance.updateDebugVisualisation();
    },
  });

  constructor() {
    super();
  }

  protected enable() {
    this.syncAudioTime();
  }

  protected disable() {
    this.syncAudioTime();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromMatrixWorldProvider(this.container);
  }

  public addSideEffectChild(child: MElement): void {
    this.audioAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.audioAnimatedAttributeHelper.removeSideEffectChild(child);
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
    if (!this.positionalAudio) {
      return;
    }
    const audioContext = this.positionalAudio.context;
    if (audioContext.state !== "running") {
      return;
    }

    if (this.delayedPauseTimer !== null) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }

    if (
      !this.loadedAudioState ||
      !this.loadedAudioState.loadedAudio ||
      this.loadedAudioState.loadedAudio.mode !== "LOADED"
    ) {
      return;
    }

    const loadedAudio = this.loadedAudioState.loadedAudio;
    const audioBuffer = loadedAudio.buffer;
    let currentSource = loadedAudio.currentSource;

    if (!this.props.enabled) {
      if (currentSource) {
        currentSource.sourceNode.stop();
        loadedAudio.currentSource = null;
      }
      return;
    }

    const documentTime = this.getDocumentTime()!;
    if (this.props.pauseTime !== null) {
      const timeUntilPause = this.props.pauseTime - documentTime;
      if (timeUntilPause < 2) {
        // The audio should be paused because the pauseTime is in the past or very close
        if (currentSource) {
          currentSource.sourceNode.stop();
          loadedAudio.currentSource = null;
        }
        return;
      } else {
        // The pause time is in the future
        const delayedPauseTimer = setTimeout(() => {
          if (this.delayedPauseTimer === delayedPauseTimer) {
            this.delayedPauseTimer = null;
          }
          this.syncAudioTime();
        }, timeUntilPause);
        this.delayedPauseTimer = delayedPauseTimer;
      }
    }

    const currentTime = (documentTime - this.props.startTime) / 1000;
    const audioDuration = audioBuffer.duration;

    let loopDurationSeconds: number | null = null;
    if (this.props.loopDuration !== null && this.props.loopDuration > 0) {
      loopDurationSeconds = this.props.loopDuration / 1000;
    }

    let desiredAudioTime: number;
    if (this.props.loop) {
      if (currentTime < 0) {
        desiredAudioTime = currentTime;
      } else {
        if (loopDurationSeconds === null) {
          desiredAudioTime = currentTime % audioDuration;
        } else {
          desiredAudioTime = currentTime % loopDurationSeconds;
        }
      }
    } else {
      desiredAudioTime = currentTime;
      if (desiredAudioTime > audioDuration) {
        // The audio should stop because it has reached the end
        if (currentSource) {
          currentSource.sourceNode.stop();
          loadedAudio.currentSource = null;
        }
        return;
      }
    }

    const loopDurationShorterThanDuration =
      loopDurationSeconds && loopDurationSeconds < audioDuration;
    let playbackLength = audioDuration;
    if (loopDurationShorterThanDuration) {
      playbackLength = loopDurationSeconds!;
    }

    if (currentSource) {
      if (
        loopDurationSeconds !== null &&
        !loopDurationShorterThanDuration &&
        (!loadedAudio.paddedBuffer || loadedAudio.paddedBuffer.totalDuration < loopDurationSeconds)
      ) {
        /*
         The loop duration is set, and it is longer than the audio file, and
         either there is no existing padding, or the existing padding is too
         short. Dispose of the existing audio source and create a new one.
        */
        currentSource.sourceNode.stop();
        loadedAudio.currentSource = null;
        currentSource = null;
      } else {
        if (this.props.startTime > documentTime) {
          currentSource.sourceNode.stop();
          loadedAudio.currentSource = null;
          currentSource = null;
        } else {
          const unloopedCurrentAudioPoint =
            (audioContext.currentTime - currentSource.contextStartTime) /
            currentSource.sourceNode.playbackRate.value;

          if (unloopedCurrentAudioPoint < 0) {
            // Audio should not be playing yet, so stop it and it will be rescheduled
            currentSource.sourceNode.stop();
            loadedAudio.currentSource = null;
            currentSource = null;
          } else {
            if (
              loopDurationSeconds !== null &&
              currentSource.sourceNode.loopEnd !== loopDurationSeconds
            ) {
              currentSource.sourceNode.loopEnd = loopDurationSeconds;
            }

            const currentAudioPoint = unloopedCurrentAudioPoint % playbackLength;

            let delta = desiredAudioTime - currentAudioPoint;
            if (this.props.loop) {
              // Check if the delta wrapping around is smaller (i.e. the desired and current are closer together if we wrap around)
              const loopedDelta = delta - playbackLength;
              if (Math.abs(delta) > Math.abs(loopedDelta)) {
                delta = loopedDelta;
              }
            }

            if (Math.abs(delta) > 0.5) {
              // We need to skip to the correct point as playback has drifted too far. Remove the audio source and a new one will be created
              currentSource.sourceNode.stop();
              loadedAudio.currentSource = null;
              currentSource = null;
            } else {
              if (Math.abs(delta) < 0.1) {
                // Do nothing - this is close enough - set the playback rate to 1
                currentSource.sourceNode.playbackRate.value = 1;
              } else {
                if (delta > 0) {
                  currentSource.sourceNode.playbackRate.value = 1.01;
                } else {
                  currentSource.sourceNode.playbackRate.value = 0.99;
                }
              }
              // Calculate a start time that produces the current time as calculated time the next time it is checked
              currentSource.contextStartTime =
                audioContext.currentTime -
                currentAudioPoint / currentSource.sourceNode.playbackRate.value;
            }
          }
        }
      }
    }

    if (!currentSource) {
      // There is no current source (or it was removed) - create a new one
      const currentSourceNode = this.positionalAudio.context.createBufferSource();

      let buffer = audioBuffer;
      if (loopDurationSeconds && !loopDurationShorterThanDuration) {
        // The loop duration requires longer audio than the original audio - pad it with silence
        if (
          loadedAudio.paddedBuffer &&
          loadedAudio.paddedBuffer.totalDuration === loopDurationSeconds
        ) {
          // The padding is already the correct length
          buffer = loadedAudio.paddedBuffer.buffer;
        } else {
          const paddedBuffer = extendAudioToDuration(
            this.positionalAudio.context,
            audioBuffer,
            loopDurationSeconds,
          );
          loadedAudio.paddedBuffer = {
            buffer: paddedBuffer,
            totalDuration: loopDurationSeconds,
          };
          buffer = paddedBuffer;
        }
      }

      currentSourceNode.buffer = buffer;
      currentSourceNode.loop = this.props.loop;
      currentSourceNode.loopStart = 0;
      if (loopDurationSeconds) {
        currentSourceNode.loopEnd = loopDurationSeconds;
      }
      let contextStartTime;
      if (desiredAudioTime < 0) {
        // The audio should not have started yet - schedule it to start in the future
        const timeFromNowToStart = -desiredAudioTime;
        contextStartTime = audioContext.currentTime + timeFromNowToStart;
        currentSourceNode.start(contextStartTime);
      } else {
        /*
         The audio should have been playing already. Start playing from an
         offset into the file and set the contextStartTime to when it should
         have started
        */
        contextStartTime = audioContext.currentTime - desiredAudioTime;
        currentSourceNode.start(0, desiredAudioTime);
      }
      loadedAudio.currentSource = {
        sourceNode: currentSourceNode,
        contextStartTime,
      };
      this.positionalAudio.setNodeSource(currentSourceNode);
    }
  }

  private documentTimeChanged() {
    if (this.loadedAudioState) {
      this.syncAudioTime();
    }
  }

  private clearAudio() {
    if (this.loadedAudioState) {
      if (this.loadedAudioState.loadedAudio) {
        if (this.loadedAudioState.loadedAudio.mode === "LOADING") {
          this.loadedAudioState.loadedAudio.abortController.abort();
        } else {
          if (this.loadedAudioState.loadedAudio.currentSource?.sourceNode) {
            this.loadedAudioState.loadedAudio.currentSource.sourceNode.stop();
          }
        }
      }
      this.loadedAudioState = null;
    }
  }

  private updateAudio() {
    if (!this.isConnected) {
      return;
    }

    const audioListener = this.getAudioListener();
    const audioContext = audioListener.context;

    if (!this.props.src) {
      this.clearAudio();
    } else {
      const contentAddress = this.contentSrcToContentAddress(this.props.src);
      if (this.loadedAudioState && this.loadedAudioState.currentSrc === contentAddress) {
        // Already loaded this audio src
      } else {
        this.clearAudio();

        const abortController = new AbortController();

        this.loadedAudioState = {
          loadedAudio: {
            mode: "LOADING",
            abortController,
          },
          currentSrc: contentAddress,
        };

        if (contentAddress.startsWith("data:")) {
          // Construct an AudioBuffer from the data URL
          const base64 = contentAddress.split(",", 2)[1];
          if (!base64) {
            return;
          }
          let arrayBuffer;

          try {
            const binary = atob(base64);
            const uint8Array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              uint8Array[i] = binary.charCodeAt(i);
            }
            arrayBuffer = uint8Array.buffer;
          } catch (e) {
            console.error("Failed to decode base64 data URL", e);
            return;
          }
          audioContext
            .decodeAudioData(arrayBuffer)
            .then((audioBuffer) => {
              if (abortController.signal.aborted) {
                return;
              }
              if (this.loadedAudioState && this.loadedAudioState.currentSrc === contentAddress) {
                this.loadedAudioState.loadedAudio = {
                  mode: "LOADED",
                  buffer: audioBuffer,
                  currentSource: null,
                };
                this.syncAudioTime();
              }
            })
            .catch((e) => {
              console.error("Failed to decode data URI audio data", e);
            });
          return;
        }

        fetch(contentAddress, {
          signal: abortController.signal,
        }).then((response) => {
          if (response.ok) {
            response
              .arrayBuffer()
              .then((buffer) => {
                if (abortController.signal.aborted) {
                  return;
                }
                audioContext.decodeAudioData(buffer).then((audioBuffer) => {
                  if (abortController.signal.aborted) {
                    return;
                  }
                  if (
                    this.loadedAudioState &&
                    this.loadedAudioState.currentSrc === contentAddress
                  ) {
                    this.loadedAudioState.loadedAudio = {
                      mode: "LOADED",
                      buffer: audioBuffer,
                      currentSource: null,
                    };
                    this.syncAudioTime();
                  }
                });
              })
              .catch((e) => {
                console.error("Failed to decode fetched audio data", e);
              });
          }
        });
      }
    }

    this.syncAudioTime();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });

    const audioListener = this.getAudioListener();
    this.positionalAudio = new THREE.PositionalAudio(audioListener);
    this.positionalAudio.context.addEventListener(
      "statechange",
      this.audioContextStateChangedListener,
    );
    this.positionalAudio.setVolume(this.props.volume);
    this.positionalAudio.setDirectionalCone(
      this.props.innerCone ?? defaultAudioInnerConeAngle,
      this.props.outerCone,
      0,
    );
    this.positionalAudio.setRefDistance(audioRefDistance);
    this.positionalAudio.setRolloffFactor(audioRolloffFactor);
    this.container.add(this.positionalAudio);

    this.updateAudio();
    this.updateDebugVisualisation();
  }

  disconnectedCallback() {
    if (this.positionalAudio) {
      this.positionalAudio.context.removeEventListener(
        "statechange",
        this.audioContextStateChangedListener,
      );
      this.positionalAudio.disconnect();
      this.positionalAudio.removeFromParent();
      this.positionalAudio = null;
    }

    this.clearAudio();

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
      const positionalAudio = this.positionalAudio;
      if (positionalAudio) {
        if (!this.audioDebugConeX && this.props.innerCone) {
          this.audioDebugConeX = new PositionalAudioHelper(positionalAudio, 10);
          positionalAudio.add(this.audioDebugConeX);
          this.audioDebugConeY = new PositionalAudioHelper(positionalAudio, 10);
          this.audioDebugConeY.rotation.z = Math.PI / 2;
          positionalAudio.add(this.audioDebugConeY);
        }
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
