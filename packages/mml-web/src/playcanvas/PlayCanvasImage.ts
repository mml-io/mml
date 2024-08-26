import * as playcanvas from "playcanvas";

import { Image, MELEMENT_PROPERTY_NAME, MImageProps, MImageProps } from "../elements";
import { LoadingInstanceManager } from "../loading";
import { ImageGraphics } from "../MMLGraphicsInterface";
import { calculateContentSize } from "../utils/calculateContentSize";

type ImageLoadedState = {
  asset: playcanvas.Asset;
};

export class PlayCanvasImage extends ImageGraphics {
  private srcLoadingInstanceManager = new LoadingInstanceManager(`${Image.tagName}.src`);
  private latestSrcImagePromise: Promise<playcanvas.Asset> | null = null;

  private entity: playcanvas.Entity;
  private modelComponent: playcanvas.ModelComponent;
  private collisionComponent: playcanvas.CollisionComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();
  protected loadedState: ImageLoadedState | null = null;

  constructor(private image: Image) {
    super(image);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity("image-internal");
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = image;
    this.modelComponent = this.entity.addComponent("render", {
      type: "plane",
      material: this.material,
    })! as playcanvas.ModelComponent;
    this.entity.rotate(90, 0, 0);
    this.collisionComponent = this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0, 0.5),
    });
    image.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  private updateHeightAndWidth() {
    const loadedImage = this.loadedState?.asset.resource;

    console.log("updateHeightAndWidth.loadedImage", loadedImage?.width, loadedImage?.height);

    const { width, height } = calculateContentSize({
      content: loadedImage ? { width: loadedImage.width, height: loadedImage.height } : undefined,
      width: this.image.props.width,
      height: this.image.props.height,
    });
    console.log("updateHeightAndWidth.result", width, height);

    this.entity.setLocalScale(width, 1, height);
    this.collisionComponent.halfExtents.set(width / 2, 0, height / 2);
    this.collisionComponent.onSetHalfExtents();

    // TODO
    // this.applyBounds();
    // this.collideableHelper.updateCollider(mesh);
  }

  setWidth(width: number, mImageProps: MImageProps): void {
    this.updateHeightAndWidth();
  }

  setHeight(height: number, mImageProps: MImageProps): void {
    this.updateHeightAndWidth();
  }

  setSrc(src: string | null, mImageProps: MImageProps): void {
    console.log("setSrc", src);
    const playcanvasEntity = this.image.getContainer() as playcanvas.Entity;
    if (this.loadedState !== null) {
      // this.collideableHelper.removeColliders();
      playcanvasEntity.removeComponent("render");
      playcanvasEntity.removeComponent("collision");
      this.loadedState = null;
      // if (this.registeredParentAttachment) {
      //   this.registeredParentAttachment.unregisterAttachment(this);
      //   this.registeredParentAttachment = null;
      // }
      // this.applyBounds();
    }
    if (!src) {
      this.srcLoadingInstanceManager.abortIfLoading();
      // this.socketChildrenByBone.forEach((children) => {
      //   children.forEach((child) => {
      //     this.getContainer().addChild(child.getContainer());
      //   });
      // });
      // this.applyBounds();
      return;
    }

    const contentSrc = this.image.contentSrcToContentAddress(src);
    const srcModelPromise = this.asyncLoadSourceAsset(contentSrc, (loaded, total) => {
      this.srcLoadingInstanceManager.setProgress(loaded / total);
    });
    this.srcLoadingInstanceManager.start(this.image.getLoadingProgressManager(), contentSrc);
    this.latestSrcImagePromise = srcModelPromise;
    srcModelPromise
      .then((asset) => {
        if (this.latestSrcImagePromise !== srcModelPromise || !this.image.isConnected) {
          // TODO
          // If we've loaded a different image since, or we're no longer connected, dispose of this one
          return;
        }
        console.log("loaded", asset);
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
        this.updateHeightAndWidth();

        this.srcLoadingInstanceManager.finish();
      })
      .catch((err) => {
        console.error("Error loading m-model.src", err);
        this.srcLoadingInstanceManager.error(err);
      });
  }

  setCastShadows(castShadows: boolean, mImageProps: MImageProps): void {
    // TODO - not casting shadows?
    this.modelComponent.castShadows = castShadows;
  }

  setOpacity(opacity: number, mImageProps: MImageProps): void {
    if (opacity === 1) {
      this.material.blendType = playcanvas.BLEND_NONE;
    } else {
      this.material.blendType = playcanvas.BLEND_NORMAL;
    }
    this.material.opacity = opacity;
    this.material.update();
  }

  async asyncLoadSourceAsset(
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<playcanvas.Asset> {
    return new Promise<playcanvas.Asset>((resolve, reject) => {
      const asset = new playcanvas.Asset(url, "texture", { url });
      this.image.getScene().getRenderer().assets.add(asset);
      this.image.getScene().getRenderer().assets.load(asset);
      asset.ready((asset) => {
        resolve(asset);
      });
    });
  }

  dispose() {
    if (this.loadedState) {
      this.loadedState.asset.unload();
      this.loadedState = null;
    }
    this.entity.destroy();
  }
}
