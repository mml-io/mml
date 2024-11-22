import { Audio, MAudioProps } from "@mml-io/mml-web";
import { AudioGraphics } from "@mml-io/mml-web";
import { LoadingInstanceManager } from "@mml-io/mml-web";
import * as THREE from "three";
import { PositionalAudioHelper } from "three/addons/helpers/PositionalAudioHelper.js";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

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

export class ThreeJSAudio extends AudioGraphics<ThreeJSGraphicsAdapter> {
  private audioDebugHelper: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private audioDebugConeX: PositionalAudioHelper | null;
  private audioDebugConeY: PositionalAudioHelper | null;
  private audioContextStateChangedListener = () => {
    this.syncAudioTime();
  };

  private documentTimeListener: { remove: () => void };
  private delayedPauseTimer: NodeJS.Timeout | null = null;
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Audio.tagName}.src`);

  private positionalAudio: THREE.PositionalAudio;

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
          srcLoadPromise: Promise<AudioBuffer>;
          abortController: AbortController;
        }
      | null;
    currentSrc: string;
  } | null = null;

  constructor(private audio: Audio<ThreeJSGraphicsAdapter>) {
    super(audio);

    this.documentTimeListener = this.audio.addDocumentTimeListener(() => {
      if (this.loadedAudioState) {
        this.syncAudioTime();
      }
    });

    const audioListener = this.getAudioListener();
    this.positionalAudio = new THREE.PositionalAudio(audioListener);
    this.positionalAudio.context.addEventListener(
      "statechange",
      this.audioContextStateChangedListener,
    );
    this.positionalAudio.setVolume(this.audio.props.volume);
    this.positionalAudio.setDirectionalCone(
      this.audio.props.coneFalloffAngle ?? 360,
      this.audio.props.coneAngle,
      0,
    );
    this.positionalAudio.setRefDistance(audioRefDistance);
    this.positionalAudio.setRolloffFactor(audioRolloffFactor);
    this.audio.getContainer().add(this.positionalAudio);

    this.updateAudio();
    this.updateDebugVisualisation();
  }

  disable(): void {}

  enable(): void {}

  public syncAudioTime() {
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

    if (!this.audio.props.enabled || this.audio.isDisabled()) {
      if (currentSource) {
        currentSource.sourceNode.stop();
        loadedAudio.currentSource = null;
      }
      return;
    }

    const documentTime = this.audio.getDocumentTime();
    if (this.audio.props.pauseTime !== null) {
      const timeUntilPause = this.audio.props.pauseTime - documentTime;
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

    const currentTime = (documentTime - this.audio.props.startTime) / 1000;
    const audioDuration = audioBuffer.duration;

    let loopDurationSeconds: number | null = null;
    if (this.audio.props.loopDuration !== null && this.audio.props.loopDuration > 0) {
      loopDurationSeconds = this.audio.props.loopDuration / 1000;
    }

    let desiredAudioTime: number;
    if (this.audio.props.loop) {
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

    const loopDurationLongerThanAudioDuration =
      loopDurationSeconds && loopDurationSeconds > audioDuration;
    const playbackLength = loopDurationSeconds ? loopDurationSeconds : audioDuration;

    if (currentSource) {
      if (currentSource.sourceNode.loop !== this.audio.props.loop) {
        // The loop setting has changed - remove the existing audio source and a new one will be created
        currentSource.sourceNode.stop();
        loadedAudio.currentSource = null;
        currentSource = null;
      } else if (
        loopDurationSeconds !== null &&
        loopDurationLongerThanAudioDuration &&
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
      } else if (
        loopDurationSeconds === null &&
        currentSource.sourceNode.loopEnd !== audioBuffer.duration
      ) {
        // The loop duration has been removed - reset the loop end to the audio duration
        currentSource.sourceNode.stop();
        loadedAudio.currentSource = null;
        currentSource = null;
      } else {
        if (this.audio.props.startTime > documentTime) {
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
            if (this.audio.props.loop) {
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
      if (loopDurationSeconds && loopDurationLongerThanAudioDuration) {
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
      currentSourceNode.loop = this.audio.props.loop;
      currentSourceNode.loopStart = 0;
      if (loopDurationSeconds) {
        currentSourceNode.loopEnd = loopDurationSeconds;
      } else {
        currentSourceNode.loopEnd = audioBuffer.duration;
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
    if (!this.audio.isConnected) {
      return;
    }

    const audioListener = this.getAudioListener();
    const audioContext = audioListener.context;

    if (!this.audio.props.src) {
      this.clearAudio();
    } else {
      const contentAddress = this.audio.contentSrcToContentAddress(this.audio.props.src);
      if (this.loadedAudioState && this.loadedAudioState.currentSrc === contentAddress) {
        // Already loaded this audio src
      } else {
        this.clearAudio();

        const abortController = new AbortController();

        this.srcLoadingInstanceManager.start(
          this.audio.getLoadingProgressManager(),
          contentAddress,
        );
        const srcLoadPromise = this.asyncLoadSourceAsset(
          contentAddress,
          abortController,
          audioContext,
          (loaded, total) => {
            this.srcLoadingInstanceManager.setProgress(loaded / total);
          },
        );
        this.loadedAudioState = {
          loadedAudio: {
            mode: "LOADING",
            abortController,
            srcLoadPromise,
          },
          currentSrc: contentAddress,
        };
        srcLoadPromise
          .then((buffer) => {
            if (
              this.loadedAudioState &&
              this.loadedAudioState.loadedAudio?.mode === "LOADING" &&
              this.loadedAudioState.loadedAudio.srcLoadPromise === srcLoadPromise
            ) {
              this.loadedAudioState.loadedAudio = {
                mode: "LOADED",
                buffer,
                currentSource: null,
              };
              this.srcLoadingInstanceManager.finish();
              this.syncAudioTime();
            }
          })
          .catch((e) => {
            if (
              this.loadedAudioState &&
              this.loadedAudioState.loadedAudio?.mode === "LOADING" &&
              this.loadedAudioState.loadedAudio.srcLoadPromise === srcLoadPromise
            ) {
              console.error("Failed to load audio", e);
              this.srcLoadingInstanceManager.error(e);
              this.clearAudio();
            }
          });
      }
    }

    this.syncAudioTime();
  }

  async asyncLoadSourceAsset(
    contentAddress: string,
    abortController: AbortController,
    audioContext: AudioContext,
    // TODO - implement progress
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onProgress: (loaded: number, total: number) => void,
  ): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      (async () => {
        if (contentAddress.startsWith("data:")) {
          // Construct an AudioBuffer from the data URL
          const base64 = contentAddress.split(",", 2)[1];
          if (!base64) {
            reject(new Error("Invalid data URL"));
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
              resolve(audioBuffer);
            })
            .catch((e) => {
              console.error("Failed to decode data URI audio data", e);
            });
          return;
        }

        const response = await fetch(contentAddress, {
          signal: abortController.signal,
        });

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
                resolve(audioBuffer);
              });
            })
            .catch((e) => {
              console.error("Failed to decode fetched audio data", e);
            });
        } else {
          console.error("Failed to fetch audio data", response);
        }
      })();
    });
  }

  setSrc(): void {
    this.updateAudio();
  }
  setStartTime(): void {
    if (this.loadedAudioState) {
      this.syncAudioTime();
    }
  }
  setPauseTime(): void {
    if (this.loadedAudioState) {
      this.syncAudioTime();
    }
  }
  setLoopDuration(): void {
    if (this.loadedAudioState) {
      this.syncAudioTime();
    }
  }
  setLoop(): void {
    this.updateAudio();
  }
  setEnabled(): void {
    this.updateAudio();
  }
  setVolume(volume: number): void {
    this.positionalAudio.setVolume(volume);
  }
  setConeAngle(coneAngle: number | null, mAudioProps: MAudioProps): void {
    this.positionalAudio.setDirectionalCone(
      mAudioProps.coneAngle,
      mAudioProps.coneFalloffAngle ?? 360,
      0,
    );
    this.updateDebugVisualisation();
  }
  setConeFalloffAngle(coneFalloffAngle: number | null, mAudioProps: MAudioProps): void {
    this.positionalAudio.setDirectionalCone(
      mAudioProps.coneAngle,
      mAudioProps.coneFalloffAngle ?? 360,
      0,
    );
    this.updateDebugVisualisation();
  }

  setDebug(): void {
    this.updateDebugVisualisation();
  }

  dispose() {
    if (this.positionalAudio) {
      this.positionalAudio.context.removeEventListener(
        "statechange",
        this.audioContextStateChangedListener,
      );
      this.positionalAudio.disconnect();
      this.positionalAudio.removeFromParent();
    }

    this.clearAudio();

    if (this.delayedPauseTimer) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }
    this.documentTimeListener.remove();
    this.clearDebugVisualisation();
    this.srcLoadingInstanceManager.dispose();
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
        this.audioDebugConeX.removeFromParent();
        this.audioDebugConeX = null;
        this.audioDebugConeY?.removeFromParent();
        this.audioDebugConeY = null;
      }
    }
    this.audioDebugConeX?.update();
    this.audioDebugConeY?.update();
  }

  private getAudioListener() {
    return this.audio.getScene().getGraphicsAdapter().getAudioListener();
  }
}
