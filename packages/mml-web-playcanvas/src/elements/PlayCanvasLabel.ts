import { CanvasText, Label, LabelGraphics, MELEMENT_PROPERTY_NAME, MLabelProps } from "mml-web";
import * as playcanvas from "playcanvas";

import { PlayCanvasGraphicsAdapter } from "../PlayCanvasGraphicsAdapter";

export class PlayCanvasLabel extends LabelGraphics<PlayCanvasGraphicsAdapter> {
  private entity: playcanvas.Entity;
  private renderComponent: playcanvas.RenderComponent;
  private material: playcanvas.StandardMaterial = new playcanvas.StandardMaterial();
  private canvasText: CanvasText = new CanvasText();

  constructor(private label: Label<PlayCanvasGraphicsAdapter>) {
    super(label);

    /*
     The primitive must be in an internal entity to allow using setLocalScale
     without affecting children.
    */
    this.entity = new playcanvas.Entity(
      "label-internal",
      label.getScene().getGraphicsAdapter().getPlayCanvasApp(),
    );
    (this.entity as any)[MELEMENT_PROPERTY_NAME] = label;
    this.renderComponent = this.entity.addComponent("render", {
      type: "plane",
      material: this.material,
      castShadows: this.label.props.castShadows,
    }) as playcanvas.RenderComponent;
    this.entity.rotate(90, 0, 0);
    this.entity.addComponent("collision", {
      type: "box",
      halfExtents: new playcanvas.Vec3(0.5, 0, 0.5),
    });
    label.getContainer().addChild(this.entity);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): playcanvas.Entity {
    return this.entity;
  }

  private updateSize(mLabelProps: MLabelProps): void {
    this.entity.setLocalScale(mLabelProps.width, 1, mLabelProps.height);
    if (this.entity.collision) {
      this.entity.collision.halfExtents.set(mLabelProps.width / 2, 0, mLabelProps.height / 2);
      // @ts-expect-error - accessing onSetHalfExtents private method
      this.entity.collision.onSetHalfExtents();
    }
  }

  public setWidth(width: number, mLabelProps: MLabelProps): void {
    this.updateSize(mLabelProps);
    this.redrawText();
  }

  public setHeight(height: number, mLabelProps: MLabelProps): void {
    this.updateSize(mLabelProps);
    this.redrawText();
  }
  public setContent(): void {
    this.redrawText();
  }
  public setAlignment(): void {
    this.redrawText();
  }
  public setFontSize(): void {
    this.redrawText();
  }
  public setPadding(): void {
    this.redrawText();
  }
  public setColor(): void {
    this.redrawText();
  }
  public setFontColor(): void {
    this.redrawText();
  }
  public setEmissive(): void {
    // TODO
  }

  private redrawText() {
    if (!this.material) {
      return;
    }
    const canvas = this.canvasText.renderText(this.label.props.content, {
      bold: true,
      fontSize: this.label.props.fontSize * 2,
      paddingPx: this.label.props.padding,
      textColorRGB255A1: {
        r: this.label.props.fontColor.r * 255,
        g: this.label.props.fontColor.g * 255,
        b: this.label.props.fontColor.b * 255,
        a: 1.0,
      },
      backgroundColorRGB255A1: {
        r: this.label.props.color.r * 255,
        g: this.label.props.color.g * 255,
        b: this.label.props.color.b * 255,
        a: 1.0,
      },
      dimensions: {
        width: this.label.props.width * 200,
        height: this.label.props.height * 200,
      },
      alignment: this.label.props.alignment,
    });

    const texture = new playcanvas.Texture(
      this.label.getScene().getGraphicsAdapter().getPlayCanvasApp().graphicsDevice,
      {
        width: canvas.width,
        height: canvas.height,
      },
    );
    texture.setSource(canvas);
    this.material.diffuseMap = texture;
    this.material.update();
    texture.destroy();
  }

  setCastShadows(castShadows: boolean): void {
    this.renderComponent.castShadows = castShadows;
  }

  dispose() {
    this.entity.destroy();
  }
}
