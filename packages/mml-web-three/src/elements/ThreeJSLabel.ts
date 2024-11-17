import { CanvasText, Label, LabelGraphics } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSLabel extends LabelGraphics<ThreeJSGraphicsAdapter> {
  static labelGeometry = new THREE.PlaneGeometry(1, 1);
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;
  private canvasText: CanvasText = new CanvasText();

  constructor(private label: Label<ThreeJSGraphicsAdapter>) {
    super(label);

    this.material = new THREE.MeshStandardMaterial({
      transparent: false,
    });
    this.mesh = new THREE.Mesh(ThreeJSLabel.labelGeometry, this.material);
    this.mesh.material = this.material;
    this.mesh.scale.x = this.label.props.width;
    this.mesh.scale.y = this.label.props.height;
    this.mesh.castShadow = this.label.props.castShadows;
    this.mesh.receiveShadow = true;
    this.redrawText();
    this.label.getContainer().add(this.mesh);
  }

  disable(): void {}

  enable(): void {}

  getCollisionElement(): THREE.Object3D {
    return this.mesh;
  }

  setContent(): void {
    this.redrawText();
  }

  setAlignment(): void {
    this.redrawText();
  }

  setFontSize(): void {
    this.redrawText();
  }

  setPadding(): void {
    this.redrawText();
  }

  setFontColor(): void {
    this.redrawText();
  }

  setEmissive(): void {
    this.updateMaterialEmissiveIntensity();
  }

  setColor(): void {
    this.redrawText();
  }

  setWidth(width: number): void {
    this.mesh.scale.x = width;
    this.redrawText();
  }

  setHeight(height: number): void {
    this.mesh.scale.y = height;
    this.redrawText();
  }

  setCastShadows(castShadows: boolean): void {
    this.mesh.castShadow = castShadows;
  }

  private redrawText() {
    if (!this.material) {
      return;
    }
    if (this.material.map) {
      this.material.map.dispose();
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

    const texture = new THREE.Texture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.needsUpdate = true;

    this.material.map = texture;
    this.material.needsUpdate = true;
    this.updateMaterialEmissiveIntensity();
  }

  private updateMaterialEmissiveIntensity() {
    if (this.material) {
      const map = this.material.map as THREE.Texture;
      if (this.label.props.emissive > 0) {
        this.material.emissive = new THREE.Color(0xffffff);
        this.material.emissiveMap = map;
        this.material.emissiveIntensity = this.label.props.emissive;
        this.material.needsUpdate = true;
      } else {
        this.material.emissive = new THREE.Color(0x000000);
        this.material.emissiveMap = null;
        this.material.emissiveIntensity = 1;
        this.material.needsUpdate = true;
      }
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    if (this.material) {
      if (this.material.map) {
        this.material.map.dispose();
      }
      this.material.dispose();
      this.material = null;
    }
  }
}
