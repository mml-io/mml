import {
  AnimatedAttributeHelper,
  AnimationType,
  AttributeHandler,
  floatParser,
  MElement,
  MMLScene,
  TransformableElement,
  CameraVisualizerGraphics,
  isEditorModeScene,
} from "@mml-io/mml-web";
import { PerspectiveCamera } from "three";

import { GameThreeJSAdapter } from "../GameThreeJSAdapter";

const defaultCameraFov = 50;
const defaultCameraPriority = 1;

export type MCameraProps = {
  fov: number;
  priority: number;
};

export class CameraGraphics {
  threeJSCamera: PerspectiveCamera;
  scene: MMLScene<GameThreeJSAdapter>;
  priority: number;

  constructor(public cameraElement: MCamera<GameThreeJSAdapter>) {
    this.scene = cameraElement.getScene() as MMLScene<GameThreeJSAdapter>;
    this.scene.getGraphicsAdapter().registerCamera(this);

    const renderer = this.scene.getGraphicsAdapter().getRenderer();
    const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;

    this.threeJSCamera = new PerspectiveCamera(75, aspect, 0.01, 1000);
    cameraElement.getContainer().add(this.threeJSCamera);
    this.priority = cameraElement.props.priority;
  }

  getCamera() {
    return this.threeJSCamera;
  }

  setFOV(fov: number) {
    this.threeJSCamera.fov = fov;
    this.threeJSCamera.updateProjectionMatrix();
  }

  setPriority(priority: number) {
    this.priority = priority;
    this.scene.getGraphicsAdapter().updateCameraPriority(this);
  }

  dispose() {
    this.threeJSCamera.removeFromParent();
    this.scene.getGraphicsAdapter().unregisterCamera(this);
  }
}

export class MCamera<G extends GameThreeJSAdapter> extends TransformableElement<G> {
  static tagName = "m-camera";

  private cameraGraphics: CameraGraphics | null = null;
  private cameraVisualizerGraphics: CameraVisualizerGraphics<G> | null = null;

  public props: MCameraProps = {
    fov: defaultCameraFov,
    priority: defaultCameraPriority,
  };

  private cameraAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    fov: [
      AnimationType.Number,
      defaultCameraFov,
      (newValue: number) => {
        this.props.fov = newValue;
        this.cameraGraphics?.setFOV(newValue);
      },
    ],
  });

  private static attributeHandler = new AttributeHandler<MCamera<GameThreeJSAdapter>>({
    fov: (instance, newValue) => {
      const fovValue = newValue !== null ? parseFloat(newValue) : defaultCameraFov;
      instance.cameraAnimatedAttributeHelper.elementSetAttribute("fov", fovValue);
    },
    priority: (instance, newValue) => {
      let priorityValue = floatParser(newValue);
      if (priorityValue === null) {
        priorityValue = defaultCameraPriority;
      }
      instance.props.priority = priorityValue;
      instance.cameraGraphics?.setPriority(priorityValue);
    },
  });

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...MCamera.attributeHandler.getAttributes(),
    ];
  }

  constructor() {
    super();
  }

  public getContentBounds(): null {
    return null;
  }

  public parentTransformed(): void {
    // no-op
  }

  public isClickable(): boolean {
    return false;
  }

  // protected onSelectionChanged(selected: boolean): void {
    // this.cameraVisualizerGraphics?.setSelected(selected);
  // }

  public getCameraGraphics(): CameraGraphics | null {
    return this.cameraGraphics;
  }

  public addSideEffectChild(child: MElement<G>): void {
    this.cameraAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement<G>): void {
    this.cameraAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.cameraGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    MCamera.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this.getScene().hasGraphicsAdapter() || this.cameraGraphics) {
      return;
    }

    this.cameraGraphics = new CameraGraphics(this);
    if (isEditorModeScene(this.getScene())) {
      this.cameraVisualizerGraphics = new CameraVisualizerGraphics<G>(this);
    }

    for (const name of MCamera.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.cameraAnimatedAttributeHelper.reset();
    this.cameraGraphics?.dispose();
    this.cameraVisualizerGraphics?.dispose();
    this.cameraGraphics = null;
    this.cameraVisualizerGraphics = null;
    super.disconnectedCallback();
  }
}
