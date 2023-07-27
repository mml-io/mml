import * as THREE from "three";

import { TransformableElement } from "./TransformableElement";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseEnumAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { THREECanvasTextTexture } from "../utils/CanvasText";

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

export class Label extends TransformableElement {
  static tagName = "m-label";

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
  };
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;

  private static attributeHandler = new AttributeHandler<Label>({
    width: (instance, newValue) => {
      instance.props.width = parseFloatAttribute(newValue, defaultLabelWidth);
      instance.redrawText();
    },
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultLabelHeight);
      instance.redrawText();
    },
    color: (instance, newValue) => {
      const color = parseColorAttribute(newValue, defaultLabelColor);
      instance.props.color = color;
      instance.redrawText();
    },
    "font-color": (instance, newValue) => {
      const color = parseColorAttribute(newValue, defaultFontColor);
      instance.props.fontColor = color;
      instance.redrawText();
    },
    "font-size": (instance, newValue) => {
      instance.props.fontSize = parseFloatAttribute(newValue, defaultLabelFontSize);
      instance.redrawText();
    },
    padding: (instance, newValue) => {
      instance.props.padding = parseFloatAttribute(newValue, defaultLabelPadding);
      instance.redrawText();
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
  });

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
      transparent: true,
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

  private redrawText() {
    if (!this.material) {
      return;
    }
    if (this.material.map) {
      this.material.map.dispose();
    }
    const { texture, width, height } = THREECanvasTextTexture(this.props.content, {
      bold: true,
      fontSize: this.props.fontSize,
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
        width: this.props.width * 100,
        height: this.props.height * 100,
      },
      alignment: this.props.alignment,
    });

    this.material.map = texture;
    this.material.needsUpdate = true;

    this.mesh.scale.x = width / 100;
    this.mesh.scale.y = height / 100;
  }
}
