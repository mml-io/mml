import * as THREE from "three";
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";

import {
  CSS3DObject,
  CSS3DRenderer,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
} from "../../../../node_modules/three/examples/jsm/renderers/CSS3DRenderer.js";

const cssFactor = 100;

export class MixerContext {
  update: () => void;
  rendererCss: CSS3DRenderer;
  private rendererWebgl: WebGLRenderer;
  public cssScene: Scene;
  private autoUpdateObjects: boolean;

  constructor(rendererWebgl: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    const updateFcts: Array<() => void> = [];
    this.update = () => {
      updateFcts.forEach((updateFct) => {
        updateFct();
      });
    };

    const rendererCss = new CSS3DRenderer();
    rendererCss.domElement.children[0].addEventListener("pointerdown", (event: MouseEvent) => {
      event.stopImmediatePropagation();
    });
    this.rendererCss = rendererCss;
    this.rendererWebgl = rendererWebgl;

    const cssCamera = new THREE.PerspectiveCamera(
      camera.fov,
      camera.aspect,
      camera.near * cssFactor,
      camera.far * cssFactor,
    );

    updateFcts.push(() => {
      cssCamera.quaternion.copy(camera.quaternion);
      cssCamera.position.copy(camera.position).multiplyScalar(cssFactor);
    });

    const cssScene = new THREE.Scene();
    this.cssScene = cssScene;

    this.autoUpdateObjects = true;
    updateFcts.push(() => {
      if (!this.autoUpdateObjects) return;
      cssScene.traverse(function (cssObject) {
        if (cssObject instanceof THREE.Scene) return;
        const mixerPlane = cssObject.userData.mixerPlane;
        if (mixerPlane === undefined) return;
        mixerPlane.update();
      });
    });

    updateFcts.push(() => {
      rendererCss.render(cssScene, cssCamera);
    });
  }
}

type MixerPlaneOpts = {
  planeW?: number;
  planeH?: number;
};

export class MixerPlane {
  public setDomElement: (newDomElement: any) => void;
  private update: () => void;
  public cssObject: CSS3DObject;
  object3d: any;
  private domElement: any;

  constructor(domElement: any, opts?: MixerPlaneOpts) {
    opts = opts || {};
    opts.planeW = opts.planeW !== undefined ? opts.planeW : 1;
    opts.planeH = opts.planeH !== undefined ? opts.planeH : 3 / 4;
    this.domElement = domElement;

    const updateFcts: Array<() => void> = [];
    this.update = () => {
      updateFcts.forEach((updateFct) => {
        updateFct();
      });
    };

    const planeW = opts.planeW;
    const planeH = opts.planeH;
    const planeMaterial = new THREE.MeshBasicMaterial({
      opacity: 0,
      color: new THREE.Color("black"),
      blending: THREE.NoBlending,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(opts.planeW, opts.planeH);
    this.object3d = new THREE.Mesh(geometry, planeMaterial);

    this.setDomElement = (newDomElement) => {
      // remove the oldDomElement
      const oldDomElement = domElement;
      if (oldDomElement.parentNode) {
        oldDomElement.parentNode.removeChild(oldDomElement);
      }
      this.domElement = domElement = newDomElement;
      cssObject.element = domElement;
      this.setDomElementSize(planeW, planeH);
    };

    this.setDomElementSize(planeW, planeH);

    const cssObject = new CSS3DObject(domElement);
    this.cssObject = cssObject;
    cssObject.scale.set(1, 1, 1);
    cssObject.userData.mixerPlane = this;

    updateFcts.push(() => {
      // get world position
      this.object3d.updateMatrixWorld();
      const worldMatrix = this.object3d.matrixWorld;

      // get position/quaternion/scale of object3d
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      worldMatrix.decompose(position, quaternion, scale);

      cssObject.quaternion.copy(quaternion);
      cssObject.position.copy(position).multiplyScalar(cssFactor);
      cssObject.scale.set(1, 1, 1); //.multiplyScalar(cssFactor / scaleFactor);
    });
  }

  setDomElementSize(width: number, height: number) {
    this.domElement.style.width = width * cssFactor + "px";
    this.domElement.style.height = height * cssFactor + "px";
  }
}
