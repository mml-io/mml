import * as THREE from "three";

import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import { StaticFileVideoSource } from "../utils/video/StaticFileVideoSource";
import { VideoSource } from "../utils/video/VideoSource";
import { WHEPVideoSource } from "../utils/video/WHEPVideoSource";

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
const defaultEmissive = 0;

export class Video extends TransformableElement {
  static tagName = "m-video";

  private videoAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    width: [
      AnimationType.Number,
      defaultVideoWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.updateHeightAndWidth();
      },
    ],
    height: [
      AnimationType.Number,
      defaultVideoHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.updateHeightAndWidth();
      },
    ],
  });

  private documentTimeListener: { remove: () => void };
  private videoSource: VideoSource | null = null;

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
    emissive: defaultEmissive as number,
  };

  private static attributeHandler = new AttributeHandler<Video>({
    width: (instance, newValue) => {
      instance.videoAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultVideoWidth),
      );
    },
    height: (instance, newValue) => {
      instance.videoAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultVideoHeight),
      );
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
    emissive: (instance, newValue) => {
      instance.props.emissive = parseFloatAttribute(newValue, defaultEmissive);
      if (instance.loadedVideoState) {
        instance.updateMaterialEmissiveIntensity();
      }
    },
  });

  protected enable() {
    this.collideableHelper.enable();
    this.syncVideoTime();
  }

  protected disable() {
    this.collideableHelper.disable();
    this.syncVideoTime();
  }

  constructor() {
    super();

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.container.add(this.mesh);
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.mesh.scale.x, this.mesh.scale.y, 0),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.videoAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.videoAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
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
    if (this.loadedVideoState) {
      const videoTag = this.loadedVideoState.video;
      if (videoTag.readyState === 0) {
        return;
      }

      const audioListener = this.getAudioListener();
      const audioContext = audioListener.context;
      if (audioContext.state === "running") {
        videoTag.muted = false;
      }

      if (this.isDisabled()) {
        videoTag.muted = true;
      }

      if (this.videoSource) {
        this.videoSource.syncVideoSource(this.props);
      }
    }
  }

  private documentTimeChanged() {
    this.syncVideoTime();
  }

  private updateVideo() {
    if (!this.isConnected) {
      return;
    }

    const audioListener = this.getAudioListener();
    const audioContext = audioListener.context;

    if (!this.loadedVideoState) {
      const video = document.createElement("video");
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
        video,
        audio,
        material,
        videoTexture,
      };
      this.updateMaterialEmissiveIntensity();
      this.container.add(audio);
    }

    if (!this.props.enabled) {
      this.clearSource();
      return;
    }

    if (!this.props.src) {
      this.clearSource();
    } else {
      const tag = this.loadedVideoState.video;
      // Muted allows autoplay immediately without the user needing to interact with the document
      // Video will be unmuted when the audiocontext is available
      tag.muted = true;
      tag.autoplay = true;
      tag.crossOrigin = "anonymous";
      tag.loop = this.props.loop;

      const contentAddress = this.contentSrcToContentAddress(this.props.src);
      if (this.videoSource === null || this.videoSource.getContentAddress() !== contentAddress) {
        this.clearSource();

        const url = new URL(contentAddress);
        if (WHEPVideoSource.isWHEPURL(url)) {
          this.videoSource = new WHEPVideoSource(url, tag);
        } else {
          this.videoSource = new StaticFileVideoSource(url, tag, () => {
            return this.getDocumentTime();
          });
        }
      }

      audioContext.addEventListener("statechange", () => {
        this.syncVideoTime();
      });
      tag.addEventListener("loadeddata", () => {
        if (this.loadedVideoState) {
          this.mesh.material = this.loadedVideoState.material;
        }
        this.syncVideoTime();
        this.updateHeightAndWidth();
      });
    }

    if (this.videoSource) {
      this.syncVideoTime();
    }
  }

  private clearSource() {
    if (this.videoSource) {
      this.videoSource.dispose();
      this.videoSource = null;
    }
    const tag = this.loadedVideoState?.video;
    if (tag && tag.src) {
      // There is an existing src - stop playing to allow changing it
      tag.pause();
      tag.src = "";
      tag.load();
      this.mesh.material = disabledVideoMaterial;
      this.updateHeightAndWidth();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });

    this.updateVideo();
    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  disconnectedCallback() {
    this.clearSource();
    if (this.loadedVideoState) {
      this.loadedVideoState = null;
    }
    this.documentTimeListener.remove();
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }

  public getVideoMesh(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  > {
    return this.mesh;
  }

  private updateMaterialEmissiveIntensity() {
    if (this.loadedVideoState) {
      const material = this.loadedVideoState.material as THREE.MeshStandardMaterial;
      if (this.props.emissive > 0) {
        const videoTexture = new THREE.VideoTexture(this.loadedVideoState.video);
        material.emissive = new THREE.Color(0xffffff);
        material.emissiveMap = videoTexture;
        material.emissiveIntensity = this.props.emissive;
        material.needsUpdate = true;
      } else {
        material.emissive = new THREE.Color(0x000000);
        material.emissiveMap = null;
        material.emissiveIntensity = 1;
        material.needsUpdate = true;
      }
    }
  }

  private updateHeightAndWidth() {
    if (this.loadedVideoState && this.loadedVideoState.video.videoWidth > 0) {
      const height = this.props.height;
      const width = this.props.width;
      const loadedWidth = Math.max(this.loadedVideoState.video.videoWidth, 1);
      const loadedHeight = Math.max(this.loadedVideoState.video.videoHeight, 1);
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
    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }
}
