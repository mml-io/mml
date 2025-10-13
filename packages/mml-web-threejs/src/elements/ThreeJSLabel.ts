import { Label, LabelGraphics } from "@mml-io/mml-web";
import * as THREE from "three";

import { ThreeJSLabelHandle, ThreeJSLabelResourceResult } from "../resources/ThreeJSLabelHandle";
import { ThreeJSGraphicsAdapter } from "../ThreeJSGraphicsAdapter";

export class ThreeJSLabel extends LabelGraphics<ThreeJSGraphicsAdapter> {
  static labelGeometry = new THREE.PlaneGeometry(1, 1);
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;
  private latestLabelHandle: ThreeJSLabelHandle | null = null;
  private shouldDrawText: boolean = false;

  private static readonly MAX_TEXTURE_SIZE = 1024;

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

  allAttributesObserved(): void {
    // Only start drawing text after all attributes have been observed
    this.shouldDrawText = true;
    this.redrawText();
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
    if (!this.shouldDrawText) {
      return;
    }
    if (!this.material) {
      return;
    }
    if (this.latestLabelHandle) {
      this.latestLabelHandle.dispose();
      this.latestLabelHandle = null;
    }

    // Clamp the width and height to 1024px whilst maintaining the aspect ratio
    const desiredWidth = this.label.props.width * 200;
    const desiredHeight = this.label.props.height * 200;
    const scale = Math.min(
      ThreeJSLabel.MAX_TEXTURE_SIZE / desiredWidth,
      ThreeJSLabel.MAX_TEXTURE_SIZE / desiredHeight,
    );
    const clampedScale = Math.min(scale, 1);
    const clampedWidth = desiredWidth * clampedScale;
    const clampedHeight = desiredHeight * clampedScale;

    const handle = this.label
      .getScene()
      .getGraphicsAdapter()
      .getResourceManager()
      .loadLabel({
        content: this.label.props.content,
        fontSize: this.label.props.fontSize * 2 * clampedScale,
        paddingPx: this.label.props.padding * clampedScale,
        textColorRGB255A1: {
          r: this.label.props.fontColor.r * 255,
          g: this.label.props.fontColor.g * 255,
          b: this.label.props.fontColor.b * 255,
          a: this.label.props.fontColor.a ?? 1,
        },
        backgroundColorRGB255A1: {
          r: this.label.props.color.r * 255,
          g: this.label.props.color.g * 255,
          b: this.label.props.color.b * 255,
          a: this.label.props.color.a ?? 1,
        },
        dimensions: {
          width: clampedWidth,
          height: clampedHeight,
        },
        alignment: this.label.props.alignment,
        bold: true,
      });

    this.latestLabelHandle = handle;

    const apply = (result: ThreeJSLabelResourceResult | Error) => {
      if (result instanceof Error || !this.material) {
        return;
      }
      this.material.map = result.texture;
      const hasTransparency = (this.label.props.color.a ?? 1) < 1;
      this.material.transparent = hasTransparency;
      this.material.alphaTest = hasTransparency ? 0.01 : 0;
      this.material.needsUpdate = true;
      this.updateMaterialEmissiveIntensity();
    };

    const result = handle.getResult();
    if (result) {
      apply(result);
    } else {
      handle.onLoad(apply);
    }
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
    if (this.latestLabelHandle) {
      this.latestLabelHandle.dispose();
      this.latestLabelHandle = null;
    }
    if (this.material) {
      // Do not dispose shared texture here
      this.material.map = null;
      if (this.material.emissiveMap) {
        this.material.emissiveMap.dispose();
        this.material.emissiveMap = null;
      }
      this.material.dispose();
      this.material = null;
    }
  }
}
