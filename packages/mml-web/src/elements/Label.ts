import * as THREE from "three";

import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseEnumAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { THREECanvasTextTexture } from "../utils/CanvasText";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

enum labelAlignment {
  left = "left",
  center = "center",
  right = "right",
}

const defaultLabelColor = new THREE.Color(0xffffff);
const defaultFontColor = new THREE.Color(0x000000);
const defaultLabelAlignment = labelAlignment.left;
const defaultLabelFontSize = 24;
const defaultLabelPadding = 8;
const defaultLabelWidth = 1;
const defaultLabelHeight = 1;
const defaultLabelCastShadows = true;
const defaultEmissive = 0;

export class Label extends TransformableElement {
  static tagName = "m-label";

  private labelAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    color: [
      AnimationType.Color,
      defaultLabelColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        this.redrawText();
      },
    ],
    "font-color": [
      AnimationType.Color,
      defaultFontColor,
      (newValue: THREE.Color) => {
        this.props.fontColor = newValue;
        this.redrawText();
      },
    ],
    width: [
      AnimationType.Number,
      defaultLabelWidth,
      (newValue: number) => {
        this.props.width = newValue;
        this.redrawText();
      },
    ],
    height: [
      AnimationType.Number,
      defaultLabelHeight,
      (newValue: number) => {
        this.props.height = newValue;
        this.redrawText();
      },
    ],
    padding: [
      AnimationType.Number,
      defaultLabelPadding,
      (newValue: number) => {
        this.props.padding = newValue;
        this.redrawText();
      },
    ],
    "font-size": [
      AnimationType.Number,
      defaultLabelFontSize,
      (newValue: number) => {
        this.props.fontSize = newValue;
        this.redrawText();
      },
    ],
  });

  private static planeGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

  private props = {
    content: "",
    alignment: defaultLabelAlignment,
    width: defaultLabelWidth,
    height: defaultLabelHeight,
    fontSize: defaultLabelFontSize,
    padding: defaultLabelPadding,
    color: defaultLabelColor,
    fontColor: defaultFontColor,
    castShadows: defaultLabelCastShadows,
    emissive: defaultEmissive as number,
  };
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;

  private static attributeHandler = new AttributeHandler<Label>({
    width: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultLabelWidth),
      );
    },
    height: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultLabelHeight),
      );
    },
    color: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultLabelColor),
      );
    },
    "font-color": (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "font-color",
        parseColorAttribute(newValue, defaultFontColor),
      );
    },
    "font-size": (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "font-size",
        parseFloatAttribute(newValue, defaultLabelFontSize),
      );
    },
    padding: (instance, newValue) => {
      instance.labelAnimatedAttributeHelper.elementSetAttribute(
        "padding",
        parseFloatAttribute(newValue, defaultLabelPadding),
      );
    },
    content: (instance, newValue) => {
      instance.props.content = newValue || "";
      instance.redrawText();
    },
    alignment: (instance, newValue) => {
      instance.props.alignment = parseEnumAttribute(
        newValue,
        labelAlignment,
        defaultLabelAlignment,
      );
      instance.redrawText();
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultLabelCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
    emissive: (instance, newValue) => {
      instance.props.emissive = parseFloatAttribute(newValue, defaultEmissive);
      instance.updateMaterialEmissiveIntensity();
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [...TransformableElement.observedAttributes, ...Label.attributeHandler.getAttributes()];
  }

  constructor() {
    super();

    this.mesh = new THREE.Mesh(Label.planeGeometry);
    this.mesh.scale.x = this.props.width;
    this.mesh.scale.y = this.props.height;
    this.mesh.castShadow = this.props.castShadows;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.mesh.scale.x, this.mesh.scale.y, 0),
      this.container,
    );
  }

  public addSideEffectChild(child: MElement): void {
    this.labelAnimatedAttributeHelper.addSideEffectChild(child);

    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    this.labelAnimatedAttributeHelper.removeSideEffectChild(child);

    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return true;
  }

  public getLabel(): THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.Material | Array<THREE.Material>
  > | null {
    return this.mesh;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Label.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this.material = new THREE.MeshStandardMaterial({
      transparent: false,
    });
    this.mesh.material = this.material;
    this.redrawText();
  }

  public disconnectedCallback(): void {
    if (this.material) {
      this.material.dispose();
      this.mesh.material = [];
      this.material = null;
    }
    super.disconnectedCallback();
  }

  private updateMaterialEmissiveIntensity() {
    if (this.material) {
      const map = this.material.map as THREE.Texture;
      if (this.props.emissive > 0) {
        this.material.emissive = new THREE.Color(0xffffff);
        this.material.emissiveMap = map;
        this.material.emissiveIntensity = this.props.emissive;
        this.material.needsUpdate = true;
      } else {
        this.material.emissive = new THREE.Color(0x000000);
        this.material.emissiveMap = null;
        this.material.emissiveIntensity = 1;
        this.material.needsUpdate = true;
      }
    }
  }

  private redrawText() {
    if (!this.material) {
      return;
    }
    if (this.material.map) {
      this.material.map.dispose();
    }
    const { texture, width, height } = THREECanvasTextTexture(this.props.content, {
      bold: true,
      fontSize: this.props.fontSize * 2,
      paddingPx: this.props.padding,
      textColorRGB255A1: {
        r: this.props.fontColor.r * 255,
        g: this.props.fontColor.g * 255,
        b: this.props.fontColor.b * 255,
        a: 1.0,
      },
      backgroundColorRGB255A1: {
        r: this.props.color.r * 255,
        g: this.props.color.g * 255,
        b: this.props.color.b * 255,
        a: 1.0,
      },
      dimensions: {
        width: this.props.width * 200,
        height: this.props.height * 200,
      },
      alignment: this.props.alignment,
    });

    this.material.map = texture;
    this.material.needsUpdate = true;
    this.updateMaterialEmissiveIntensity();

    this.mesh.scale.x = width / 200;
    this.mesh.scale.y = height / 200;
  }
}
