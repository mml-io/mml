import {
  calculateContentSize,
  Image,
  ImageGraphics,
  LoadingInstanceManager,
  MELEMENT_PROPERTY_NAME,
} from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

import { createPlaneModel } from "../plane/plane";
import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

type ImageLoadedState = {
  asset: playcanvas.Asset;
};

export class PlayCanvasImage extends ImageGraphics<PlayCanvasGraphicsAdapter> {
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Image.tagName}.src`);
  private latestSrcImagePromise: Promise<playcanvas.Asset> | null = null;
  private entity: playcanvas.Entity;

  private internalEntity: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();
  protected loadedState: ImageLoadedState | null = null;
  constructor(
    private image: Image<PlayCanvasGraphicsAdapter>,
    private updateMeshCallback: () => void,
  ) {
    super(image, updateMeshCallback);

    this.entity = image.getContainer() as playcanvas.Entity;

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.internalEntity = new playcanvas.Entity(
      "image-internal",
      image.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
    (this.internalEntity as any)[MELEMENT_PROPERTY_NAME] = image;

    const { model } = createPlaneModel(this.getPlayCanvasApp(), this.material);
    this.modelComponent = this.internalEntity.addComponent(
      "model",
      {},
    ) as playcanvas.ModelComponent;
    this.modelComponent.model = model;

    // Use the collision component of the element's entity
    this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0, 0.5),
    });
    this.entity.addChild(this.internalEntity);
  }

  disable(): void {}

  enable(): void {}

  getWidthAndHeight(): { width: number; height: number } {
    return {
      width: this.internalEntity.getLocalScale().x,
      height: this.internalEntity.getLocalScale().y,
    };
  }

  getCollisionElement(): playcanvas.Entity {
    return this.entity;
  }

  private getPlayCanvasApp(): playcanvas.AppBase {
    return this.image.getScene().getGraphicsAdapter().getPlayCanvasApp();
  }

  private updateWidthAndHeight() {
    const loadedImage = this.loadedState?.asset.resource;

    const { width, height } = calculateContentSize({
      content: loadedImage ? { width: loadedImage.width, height: loadedImage.height } : undefined,
      width: this.image.props.width,
      height: this.image.props.height,
    });

    // Update the size of the visual representation
    this.internalEntity.setLocalScale(width, height, 1);

    // Update the collision shape
    if (this.entity.collision) {
      this.entity.collision.halfExtents.set(width / 2, height / 2, 0);
      // @ts-expect-error - accessing onSetHalfExtents private method
      this.entity.collision.onSetHalfExtents();
    }

    this.updateMeshCallback();
  }

  setWidth(): void {
    this.updateWidthAndHeight();
  }

  setHeight(): void {
    this.updateWidthAndHeight();
  }

  private clearImage() {
    if (this.material) {
      this.material.diffuseMap = null;
      this.material.opacityMap = null;
      this.material.emissiveMap = null;
      this.material.update();
    }
    this.updateWidthAndHeight();
  }

  public setSrc(src: string | null): void {
    if (this.loadedState !== null) {
      this.loadedState.asset.unload();
      this.loadedState = null;
    }
    if (!src) {
      this.clearImage();
      this.srcLoadingInstanceManager.abortIfLoading();
      return;
    }

    const contentSrc = this.image.contentSrcToContentAddress(src);
    const srcImagePromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    this.srcLoadingInstanceManager.start(this.image.getLoadingProgressManager(), contentSrc);
    this.latestSrcImagePromise = srcImagePromise;
    srcImagePromise
      .then((asset) => {
        if (this.latestSrcImagePromise !== srcImagePromise || !this.image.isConnected) {
          // TODO
          // If we've loaded a different image since, or we're no longer connected, dispose of this one
          return;
        }
        this.latestSrcImagePromise = null;
        this.loadedState = {
          asset,
        };

        const texture = asset.resource;
        texture.premultiplyAlpha = true;
        this.material.diffuseMap = texture;
        this.material.blendType = playcanvas.BLEND_NORMAL;
        this.material.opacityMap = texture;
        this.material.update();
        this.updateWidthAndHeight();
        this.updateMaterialEmissiveIntensity();
        this.srcLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-image.src", err);
        this.clearImage();
        this.srcLoadingInstanceManager.error(err);
      });
  }

  setCastShadows(castShadows: boolean): void {
    this.modelComponent.castShadows = castShadows;
  }

  setOpacity(opacity: number): void {
    if (opacity === 1) {
      this.material.blendType = playcanvas.BLEND_NONE;
    } else {
      this.material.blendType = playcanvas.BLEND_NORMAL;
    }
    this.material.opacity = opacity;
    this.material.update();
  }

  setEmissive(): void {
    this.updateMaterialEmissiveIntensity();
  }

  private updateMaterialEmissiveIntensity() {
    if (this.image.props.emissive) {
      this.material.emissiveMap = this.material.diffuseMap;
      this.material.emissiveIntensity = this.image.props.emissive;
    } else {
      this.material.emissiveMap = null;
      this.material.emissiveIntensity = 0;
    }
    this.material.update();
  }

  private async asyncLoadSourceAsset(
    url: string,
    // TODO - report progress
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      const asset = new playcanvas.Asset(url, "texture", { url });
      this.getPlayCanvasApp().assets.add(asset);
      this.getPlayCanvasApp().assets.load(asset);
      asset.ready((asset) => {
        resolve(asset);
      });
      asset.on("error", (err) => {
        reject(err);
      });
    });
  }

  dispose() {
    if (this.loadedState) {
      this.loadedState.asset.unload();
      this.loadedState = null;
    }
    this.internalEntity.destroy();
  }
}
