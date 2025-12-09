import {
  calculateContentSize,
  EventHandlerCollection,
  MELEMENT_PROPERTY_NAME,
  StaticFileVideoSource,
  Video,
  VideoGraphics,
  VideoSource,
  WHEPVideoSource,
} from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { createPlaneModel } from "../plane/plane";
import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

const audioRefDistance = 1;
const audioRolloffFactor = 1;

export class PlayCanvasVideo extends VideoGraphics<PlayCanvasGraphicsAdapter> {
  private videoSource: VideoSource | null = null;
  private videoMaterial: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();
  private disabledVideoMaterial = new playcanvas.StandardMaterial();

  private entity: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private meshInstance: playcanvas.MeshInstance;

  private loadedVideoState: {
    video: HTMLVideoElement;
    videoLoadEventCollection: EventHandlerCollection;
    videoTexture: playcanvas.Texture | null;
    audio: {
      gainNode: GainNode;
      audioNode: AudioNode;
      panner: PannerNode;
    } | null;
  } | null = null;
  private documentTimeTickListener: { remove: () => void };

  private eventCollection = new EventHandlerCollection();

  constructor(
    private video: Video<PlayCanvasGraphicsAdapter>,
    private updateMeshCallback: () => void,
  ) {
    super(video, updateMeshCallback);
    this.disabledVideoMaterial.diffuse = new playcanvas.Color(0, 0, 0);

    this.documentTimeTickListener = this.video.addDocumentTimeTickListener(() => {
      this.tick();
    });

    this.eventCollection.add(this.getAudioContext(), "statechange", () => {
      this.syncVideoTime();
    });

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity(
      "video-internal",
      video.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = video;

    const { model, meshInstance } = createPlaneModel(
      this.video.getScene().getGraphicsAdapter().getPlayCanvasApp(),
      this.disabledVideoMaterial,
    );
    this.modelComponent = this.entity.addComponent("model", {}) as playcanvas.ModelComponent;
    this.modelComponent.model = model;
    this.meshInstance = meshInstance;

    this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0, 0.5),
    });
    video.getContainer().addChild(this.entity);
  }

  private getPlayCanvasApp(): playcanvas.AppBase {
    return this.video.getScene().getGraphicsAdapter().getPlayCanvasApp();
  }

  getWidthAndHeight(): { width: number; height: number } {
    return {
      width: this.entity.getLocalScale().x,
      height: this.entity.getLocalScale().y,
    };
  }

  private getAudioContext(): AudioContext {
    const playcanvasApp = this.getPlayCanvasApp();
    const soundSystem = playcanvasApp.systems.sound;
    if (!soundSystem || !soundSystem.context) {
      throw new Error("Playcanvas sound system not enabled or context not available");
    }
    return soundSystem.context as AudioContext;
  }

  public syncVideoTime() {
    if (this.loadedVideoState) {
      const videoTag = this.loadedVideoState.video;
      if (videoTag.readyState === 0) {
        return;
      }

      const audioContext = this.getAudioContext();
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

  public enable(): void {
    this.updateVideo();
  }

  public disable(): void {
    this.updateVideo();
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
    if (this.loadedVideoState?.audio) {
      this.loadedVideoState.audio.gainNode.gain.value = this.video.props.volume;
    }
  }

  public setEmissive(): void {
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
        const videoLoadEventCollection = new EventHandlerCollection();
        this.loadedVideoState = {
          video,
          videoLoadEventCollection,
          videoTexture: null,
          audio: null,
        };
        video.loop = this.video.props.loop;

        const url = new URL(contentAddress);
        if (WHEPVideoSource.isWHEPURL(url)) {
          this.videoSource = new WHEPVideoSource(url, video);
        } else {
          this.videoSource = new StaticFileVideoSource(url, video, this.video.props, () => {
            return this.video.getDocumentTime();
          });
        }

        videoLoadEventCollection.add(video, "loadeddata", () => {
          if (!this.loadedVideoState || this.loadedVideoState.video !== video) {
            // Video was changed before it loaded
            return;
          }

          // Create a texture to hold the video frame data
          this.loadedVideoState.videoTexture = new playcanvas.Texture(
            this.getPlayCanvasApp().graphicsDevice,
            {
              format: playcanvas.PIXELFORMAT_R8_G8_B8,
              mipmaps: false,
              width: video.videoWidth,
              height: video.videoHeight,
            },
          );
          this.loadedVideoState.videoTexture.setSource(this.loadedVideoState.video);
          this.videoMaterial.diffuseMap = this.loadedVideoState.videoTexture;
          this.videoMaterial.update();
          this.meshInstance.material = this.videoMaterial;
          this.syncVideoTime();
          this.updateWidthAndHeight();
          this.updateMaterialEmissiveIntensity();

          // playcanvas doesn't support positional audio for video elements so use the audio context directly
          const audioContext = this.getAudioContext();

          const pos = this.entity.getPosition();
          // TODO - initial orientation
          const orientationX = 1.0;
          const orientationY = 0.0;
          const orientationZ = 0.0;

          const panner = new PannerNode(audioContext, {
            panningModel: "HRTF",
            distanceModel: "inverse",
            positionX: pos.x,
            positionY: pos.y,
            positionZ: pos.z,
            orientationX,
            orientationY,
            orientationZ,
            refDistance: audioRefDistance,
            rolloffFactor: audioRolloffFactor,
          });

          const gainNode = audioContext.createGain();
          gainNode.gain.value = this.video.props.volume;
          const stereoPanner = new StereoPannerNode(audioContext, { pan: 0 });
          const audioNode = audioContext.createMediaElementSource(video);
          audioNode
            .connect(gainNode)
            .connect(stereoPanner)
            .connect(panner)
            .connect(audioContext.destination);

          this.loadedVideoState.audio = { gainNode, audioNode, panner };
        });
      }
    }

    if (this.videoSource) {
      this.syncVideoTime();
    }
  }

  private tick() {
    const videoTexture = this.loadedVideoState?.videoTexture;
    if (videoTexture) {
      videoTexture.upload();
    }
    const audio = this.loadedVideoState?.audio;
    if (audio) {
      /// Update the position
      const pos = this.entity.getPosition();
      const rotation = this.entity.getEulerAngles();
      audio.panner.positionX.value = pos.x;
      audio.panner.positionY.value = pos.y;
      audio.panner.positionZ.value = pos.z;
      audio.panner.orientationX.value = Math.cos(rotation.y);
      audio.panner.orientationY.value = 0;
      audio.panner.orientationZ.value = Math.sin(rotation.y);
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
      if (this.loadedVideoState.audio) {
        this.loadedVideoState.audio.audioNode.disconnect();
        this.loadedVideoState.audio = null;
      }
      if (this.loadedVideoState.videoTexture) {
        this.loadedVideoState.videoTexture.destroy();
        this.loadedVideoState.videoTexture = null;
      }
      this.loadedVideoState.videoLoadEventCollection.clear();
      this.loadedVideoState = null;
      this.meshInstance.material = this.disabledVideoMaterial;
      this.updateWidthAndHeight();
    }
  }

  private updateMaterialEmissiveIntensity() {
    if (this.loadedVideoState?.videoTexture && this.video.props.emissive) {
      this.videoMaterial.emissiveMap = this.loadedVideoState.videoTexture;
      this.videoMaterial.emissiveIntensity = this.video.props.emissive;
    } else {
      this.videoMaterial.emissiveMap = null;
      this.videoMaterial.emissiveIntensity = 0;
    }
    this.videoMaterial.update();
  }

  dispose() {
    this.clearSource();
    this.documentTimeTickListener.remove();
    this.eventCollection.clear();
    this.entity.destroy();
  }

  getCollisionElement(): playcanvas.Entity {
    return this.entity;
  }

  private updateWidthAndHeight() {
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

    this.entity.setLocalScale(width, height, 1);
    if (this.entity.collision) {
      this.entity.collision.halfExtents.set(width / 2, height / 2, 0);
      // @ts-expect-error - accessing onSetHalfExtents private method
      this.entity.collision.onSetHalfExtents();
    }

    this.updateMeshCallback();
  }
}
