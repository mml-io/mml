import {
  calculateContentSize,
  StaticFileVideoSource,
  Video,
  VideoGraphics,
  VideoSource,
  WHEPVideoSource,
} from "mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

const audioRefDistance = 1;
const audioRolloffFactor = 1;

const disabledVideoMaterial = new THREE.MeshStandardMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
});

export class ThreeJSVideo extends VideoGraphics<ThreeJSGraphicsAdapter> {
  private videoSource: VideoSource | null = null;
  private videoMaterial: THREE.MeshStandardMaterial;

  private mesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  >;

  private loadedVideoState: {
    video: HTMLVideoElement;
    audio: THREE.PositionalAudio;
    videoTexture: THREE.VideoTexture | null;
  } | null = null;

  constructor(
    private video: Video<ThreeJSGraphicsAdapter>,
    private updateMeshCallback: () => void,
  ) {
    super(video, updateMeshCallback);

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    // Video material is only applied once a video is played
    this.videoMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, disabledVideoMaterial);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.video.getContainer().add(this.mesh);
  }

  public getWidthAndHeight(): { width: number; height: number } {
    return {
      width: this.mesh.scale.x,
      height: this.mesh.scale.y,
    };
  }

  public syncVideoTime() {
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

      if (this.video.isDisabled()) {
        videoTag.muted = true;
      }

      if (this.videoSource) {
        this.videoSource.syncVideoSource(this.video.props);
      }
    }
  }

  private getAudioListener() {
    return this.video.getScene().getGraphicsAdapter().getAudioListener();
  }

  public enable(): void {
    this.updateVideo();
  }
  public disable(): void {
    this.updateVideo();
  }

  public getCollisionElement(): THREE.Object3D {
    return this.mesh;
  }

  public setSrc(): void {
    this.updateVideo();
  }

  public setWidth(): void {
    this.updateWidthAndHeight();
  }

  public setHeight(): void {
    this.updateWidthAndHeight();
  }

  public setEnabled(): void {
    this.updateVideo();
  }

  public setCastShadows(): void {
    this.updateVideo();
  }

  public setLoop(): void {
    this.updateVideo();
  }

  public setVolume(): void {
    this.updateVideo();
  }

  public setEmissive(): void {
    this.updateVideo();
    this.updateMaterialEmissiveIntensity();
  }

  public setStartTime(): void {
    this.updateVideo();
  }

  public setPauseTime(): void {
    this.updateVideo();
  }

  private updateVideo() {
    if (!this.video.isConnected) {
      return;
    }

    if (!this.video.props.enabled) {
      this.clearSource();
      return;
    }

    if (!this.video.props.src) {
      this.clearSource();
    } else {
      const contentAddress = this.video.contentSrcToContentAddress(this.video.props.src);
      if (this.videoSource === null || this.videoSource.getContentAddress() !== contentAddress) {
        this.clearSource();

        const video = document.createElement("video");
        video.playsInline = true;
        // Muted allows autoplay immediately without the user needing to interact with the document
        // Video will be unmuted when the audiocontext is available
        video.muted = true;
        video.autoplay = true;
        video.crossOrigin = "anonymous";

        const audioListener = this.getAudioListener();
        const audioContext = audioListener.context;

        const audio = new THREE.PositionalAudio(audioListener);
        audio.setMediaElementSource(video);
        audio.setVolume(this.video.props.volume);
        audio.setRefDistance(audioRefDistance);
        audio.setRolloffFactor(audioRolloffFactor);
        this.loadedVideoState = {
          video,
          audio,
          videoTexture: null,
        };
        this.updateMaterialEmissiveIntensity();
        this.video.getContainer().add(audio);

        const url = new URL(contentAddress);
        if (WHEPVideoSource.isWHEPURL(url)) {
          this.videoSource = new WHEPVideoSource(url, video);
        } else {
          this.videoSource = new StaticFileVideoSource(url, video, this.video.props, () => {
            return this.video.getDocumentTime();
          });
        }

        audioContext.addEventListener("statechange", () => {
          this.syncVideoTime();
        });
        video.addEventListener("loadeddata", () => {
          if (!this.loadedVideoState || this.loadedVideoState.video !== video) {
            // Video was changed before it loaded
            return;
          }

          const videoTexture = new THREE.VideoTexture(video);
          this.videoMaterial.map = videoTexture;
          this.videoMaterial.needsUpdate = true;
          this.mesh.material = this.videoMaterial;
          this.loadedVideoState.videoTexture = videoTexture;

          this.syncVideoTime();
          this.updateWidthAndHeight();
          this.updateMaterialEmissiveIntensity();
        });
      }
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
    if (this.loadedVideoState) {
      const tag = this.loadedVideoState.video;
      // There is an existing src - stop playing to allow changing it
      tag.pause();
      tag.src = "";
      tag.load();
      this.loadedVideoState = null;
      this.mesh.material = disabledVideoMaterial;
      this.updateWidthAndHeight();
    }
  }

  dispose() {
    this.clearSource();
    if (this.loadedVideoState) {
      this.loadedVideoState = null;
    }
  }

  private updateMaterialEmissiveIntensity() {
    if (this.loadedVideoState && this.loadedVideoState.videoTexture) {
      if (this.video.props.emissive > 0) {
        this.videoMaterial.emissive = new THREE.Color(0xffffff);
        this.videoMaterial.emissiveMap = this.loadedVideoState.videoTexture;
        this.videoMaterial.emissiveIntensity = this.video.props.emissive;
        this.videoMaterial.needsUpdate = true;
      } else {
        this.videoMaterial.emissive = new THREE.Color(0x000000);
        this.videoMaterial.emissiveMap = null;
        this.videoMaterial.emissiveIntensity = 1;
        this.videoMaterial.needsUpdate = true;
      }
    }
  }

  private updateWidthAndHeight() {
    const mesh = this.mesh;

    const { width, height } = calculateContentSize({
      content: this.loadedVideoState
        ? {
            width: this.loadedVideoState.video.videoWidth,
            height: this.loadedVideoState.video.videoHeight,
          }
        : undefined,
      width: this.video.props.width,
      height: this.video.props.height,
    });
    mesh.scale.x = width;
    mesh.scale.y = height;

    this.updateMeshCallback();
  }
}
