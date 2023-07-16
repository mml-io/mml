import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";

const audioRefDistance = 1;
const audioRolloffFactor = 1;

const disabledVideoMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const defaultVideoWidth = null;
const defaultVideoHeight = null;
const defaultVideoVolume = 1;
const defaultVideoLoop = true;
const defaultVideoEnabled = true;
const defaultVideoStartTime = 0;
const defaultVideoPauseTime = null;
const defaultVideoSrc = null;
const defaultVideoCastShadows = true;

export class Video extends TransformableElement {
  static tagName = "m-video";
  private documentTimeListener: { remove: () => void };
  private delayedStartTimer: NodeJS.Timeout | null = null;
  private delayedPauseTimer: NodeJS.Timeout | null = null;

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Video.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  private mesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  >;
  private collideableHelper = new CollideableHelper(this);

  private loadedVideoState: {
    paused: boolean;
    video: HTMLVideoElement;
    audio: THREE.PositionalAudio;
    material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    videoTexture: THREE.VideoTexture;
  } | null = null;

  // Parsed attribute values
  private props = {
    startTime: defaultVideoStartTime,
    pauseTime: defaultVideoPauseTime as number | null,
    src: defaultVideoSrc as string | null,
    loop: defaultVideoLoop,
    enabled: defaultVideoEnabled,
    volume: defaultVideoVolume,
    width: defaultVideoWidth as number | null,
    height: defaultVideoHeight as number | null,
  };

  private static attributeHandler = new AttributeHandler<Video>({
    width: (instance, newValue) => {
      instance.props.width = parseFloatAttribute(newValue, defaultVideoWidth);
      instance.updateHeightAndWidth();
    },
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultVideoHeight);
      instance.updateHeightAndWidth();
    },
    enabled: (instance, newValue) => {
      instance.props.enabled = parseBoolAttribute(newValue, defaultVideoEnabled);
      instance.updateVideo();
    },
    loop: (instance, newValue) => {
      instance.props.loop = parseBoolAttribute(newValue, defaultVideoLoop);
      instance.updateVideo();
    },
    "start-time": (instance, newValue) => {
      instance.props.startTime = parseFloatAttribute(newValue, defaultVideoStartTime);
      if (instance.loadedVideoState) {
        instance.syncVideoTime();
      }
    },
    "pause-time": (instance, newValue) => {
      instance.props.pauseTime = parseFloatAttribute(newValue, defaultVideoPauseTime);
      if (instance.loadedVideoState) {
        instance.syncVideoTime();
      }
    },
    src: (instance, newValue) => {
      instance.props.src = newValue;
      instance.updateVideo();
    },
    volume: (instance, newValue) => {
      instance.props.volume = parseFloatAttribute(newValue, defaultVideoVolume);
      if (instance.loadedVideoState) {
        instance.loadedVideoState?.audio.setVolume(instance.props.volume);
      }
    },
    "cast-shadows": (instance, newValue) => {
      instance.mesh.castShadow = parseBoolAttribute(newValue, defaultVideoCastShadows);
    },
  });

  constructor() {
    super();

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.container.add(this.mesh);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Video.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  private syncVideoTime() {
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }

    if (!this.props.src) {
      this.mesh.material = disabledVideoMaterial;
      return;
    }

    if (this.loadedVideoState) {
      const videoTag = this.loadedVideoState.video;

      if (videoTag.readyState === 0) {
        return;
      }

      if (!this.props.enabled) {
        this.loadedVideoState.paused = true;
        videoTag.pause();
        this.mesh.material = disabledVideoMaterial;
        return;
      } else {
        this.loadedVideoState.paused = false;
        this.mesh.material = this.loadedVideoState.material;
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
            this.syncVideoTime();
          }, this.props.pauseTime - documentTime);
          this.delayedPauseTimer = delayedPauseTimer;
        } else {
          // The video should be paused because the pauseTime is in the past
          let totalPlaybackTime = (this.props.pauseTime - this.props.startTime) / 1000.0;
          if (totalPlaybackTime < 0) {
            // The pauseTime is before the startTime - set the video's time to zero (i.e. unplayed)
            totalPlaybackTime = 0;
          }
          if (this.props.loop) {
            totalPlaybackTime = totalPlaybackTime % videoTag.duration;
          } else if (totalPlaybackTime > videoTag.duration) {
            totalPlaybackTime = videoTag.duration;
          }
          this.loadedVideoState.paused = true;
          videoTag.pause();
          videoTag.currentTime = totalPlaybackTime;
          return;
        }
      }

      let currentTime = 0;
      if (documentTime) {
        currentTime = (documentTime - this.props.startTime) / 1000;
      } else {
        currentTime = (this.props.startTime ? this.props.startTime : 0) / 1000;
      }
      let desiredVideoTime;
      if (currentTime < 0) {
        // The video should not start yet
        videoTag.currentTime = 0;
        this.loadedVideoState.paused = true;
        videoTag.pause();
        const delayedStartTimer = setTimeout(() => {
          if (this.delayedStartTimer === delayedStartTimer) {
            this.delayedStartTimer = null;
          }
          this.syncVideoTime();
        }, -currentTime * 1000);
        this.delayedStartTimer = delayedStartTimer;
        return;
      } else if (this.props.loop) {
        desiredVideoTime = currentTime % videoTag.duration;
      } else {
        desiredVideoTime = currentTime;
      }

      let delta = desiredVideoTime - videoTag.currentTime;
      if (this.props.loop) {
        // Check if the delta wrapping around is smaller (i.e. the desired and current are closer together if we wrap around)
        const loopedDelta = delta - videoTag.duration;
        if (Math.abs(delta) > Math.abs(loopedDelta)) {
          delta = loopedDelta;
        }
      }

      if (Math.abs(delta) < 0.1) {
        // Do nothing - this is close enough - set the playback rate to 1
        videoTag.playbackRate = 1;
      } else if (Math.abs(delta) > 0.5) {
        videoTag.currentTime = desiredVideoTime;
        videoTag.playbackRate = 1;
      } else {
        if (delta > 0) {
          videoTag.playbackRate = 1.02;
        } else {
          videoTag.playbackRate = 0.98;
        }
      }

      if (desiredVideoTime >= videoTag.duration) {
        this.loadedVideoState.paused = true;
        videoTag.pause();
      } else {
        this.loadedVideoState.paused = false;

        const audioListener = this.getAudioListener();
        const audioContext = audioListener.context;
        if (audioContext.state === "running") {
          videoTag.muted = false;
        }

        videoTag.play().catch((e) => {
          console.error("failed to play", e);
        });
      }
    }
  }

  private documentTimeChanged() {
    if (this.loadedVideoState) {
      this.syncVideoTime();
    }
  }

  private updateVideo() {
    if (!this.isConnected) {
      return;
    }

    const audioListener = this.getAudioListener();
    const audioContext = audioListener.context;

    if (!this.loadedVideoState) {
      const video = document.createElement("video");
      video.addEventListener("pause", () => {
        if (this.loadedVideoState?.paused) {
          // Pause is intentional
          return;
        }
        // The video was likely paused (unintentionally) by the user using system controls
        this.syncVideoTime();
      });

      const material = this.mesh.material;
      const videoTexture = new THREE.VideoTexture(video);
      material.map = videoTexture;
      material.needsUpdate = true;

      const audio = new THREE.PositionalAudio(audioListener);
      audio.setMediaElementSource(video);
      audio.setVolume(this.props.volume);
      audio.setRefDistance(audioRefDistance);
      audio.setRolloffFactor(audioRolloffFactor);
      this.loadedVideoState = {
        paused: false,
        video,
        audio,
        material,
        videoTexture,
      };
      this.container.add(audio);
    }

    const tag = this.loadedVideoState.video;
    if (!this.props.src) {
      if (!tag.paused) {
        this.loadedVideoState.paused = true;
        // TODO - this should remove the frame - not just pause it
        tag.pause();
        tag.src = "";
      }
    } else {
      // Muted allows autoplay immediately without the user needing to interact with the document
      // Video will be unmuted when the audiocontext is available
      tag.muted = true;
      tag.autoplay = true;
      tag.crossOrigin = "anonymous";
      tag.loop = this.props.loop;

      const contentAddress = this.contentSrcToContentAddress(this.props.src);
      if (tag.src !== contentAddress) {
        if (tag.src) {
          // There is an existing src - stop playing to allow changing it
          this.loadedVideoState.paused = true;
          tag.pause();
        }

        try {
          tag.src = contentAddress;
        } catch (e) {
          console.error("src failed to switch", e);
        }
      }

      audioContext.addEventListener("statechange", () => {
        this.syncVideoTime();
      });
      tag.addEventListener("loadeddata", () => {
        this.syncVideoTime();
        this.updateHeightAndWidth();
      });
    }

    this.syncVideoTime();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });

    this.updateVideo();
    this.collideableHelper.updateCollider(this.mesh);
  }

  disconnectedCallback() {
    if (this.loadedVideoState) {
      this.loadedVideoState.paused = true;
      this.loadedVideoState.video.pause();
      this.loadedVideoState.video.src = "";
      this.loadedVideoState = null;
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
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }

  public getMesh(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  > {
    return this.mesh;
  }

  private updateHeightAndWidth() {
    if (this.loadedVideoState) {
      const height = this.props.height;
      const width = this.props.width;
      const loadedWidth = this.loadedVideoState.video.videoWidth;
      const loadedHeight = this.loadedVideoState.video.videoHeight;

      if (height && width) {
        this.mesh.scale.x = width;
        this.mesh.scale.y = height;
      } else if (height && !width) {
        this.mesh.scale.y = height;
        // compute width
        this.mesh.scale.x = (this.mesh.scale.y * loadedWidth) / loadedHeight;
      } else if (!height && width) {
        this.mesh.scale.x = width;
        // compute height
        this.mesh.scale.y = (this.mesh.scale.x * loadedHeight) / loadedWidth;
      } else {
        this.mesh.scale.x = 1;
        // compute height
        this.mesh.scale.y = loadedHeight / loadedWidth;
      }
    } else {
      this.mesh.scale.x = this.props.width !== null ? this.props.width : 1;
      this.mesh.scale.y = this.props.height !== null ? this.props.height : 1;
    }
    this.collideableHelper.updateCollider(this.mesh);
  }
}
