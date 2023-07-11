import * as THREE from "three";

import { MElement } from "./elements/MElement";
import { IMMLScene } from "./MMLScene";
import { EventHandlerCollection } from "./utils/events/EventHandlerCollection";
import { getRelativePositionAndRotationRelativeToObject } from "./utils/position-utils";

const mouseMovePixelsThreshold = 10;
const mouseMoveTimeThresholdMilliseconds = 500;

/**
 * The MMLClickTrigger class is responsible for handling click events on the MML scene and raycasts into the scene to
 * determine which object was clicked and then dispatches events to those elements.
 */
export class MMLClickTrigger {
  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private scene: IMMLScene;
  private raycaster: THREE.Raycaster;
  private clickTarget: Document | HTMLElement;
  private mouseDownTime: number | null = null;
  private mouseMoveDelta = 0;

  static init(clickTarget: Document | HTMLElement, scene: IMMLScene): MMLClickTrigger {
    return new MMLClickTrigger(clickTarget, scene);
  }

  private constructor(clickTarget: Document | HTMLElement, scene: IMMLScene) {
    this.clickTarget = clickTarget;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();

    this.eventHandlerCollection.add(clickTarget, "mousedown", this.handleMouseDown.bind(this));
    this.eventHandlerCollection.add(clickTarget, "mouseup", this.handleMouseUp.bind(this));
    this.eventHandlerCollection.add(clickTarget, "mousemove", this.handleMouseMove.bind(this));
    this.eventHandlerCollection.add(clickTarget, "touchstart", this.handleTouchStart.bind(this));
  }

  private handleMouseDown() {
    this.mouseDownTime = Date.now();
    this.mouseMoveDelta = 0;
  }

  private handleMouseUp(event: MouseEvent) {
    if (!this.mouseDownTime) {
      return;
    }
    const duration = Date.now() - this.mouseDownTime;
    this.mouseDownTime = null;
    if (
      this.mouseMoveDelta < mouseMovePixelsThreshold &&
      duration < mouseMoveTimeThresholdMilliseconds
    ) {
      this.handleClick(event);
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.mouseDownTime) {
      this.mouseMoveDelta += Math.abs(event.movementX) + Math.abs(event.movementY);
    }
  }

  private handleTouchStart(event: TouchEvent) {
    if ((event.detail as any).element) {
      // Avoid infinite loop of handling click events that originated from this trigger
      return;
    }
    let x = 0;
    let y = 0;
    if (!document.pointerLockElement) {
      let width = window.innerWidth;
      let height = window.innerHeight;
      if (this.clickTarget instanceof HTMLElement) {
        width = this.clickTarget.offsetWidth;
        height = this.clickTarget.offsetHeight;
      }
      x = (event.touches[0].clientX / width) * 2 - 1;
      y = -((event.touches[0].clientY / height) * 2 - 1);
    }
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.scene.getCamera());
    const intersections = this.raycaster.intersectObject(this.scene.getRootContainer(), true);
    if (intersections.length > 0) {
      for (const intersection of intersections) {
        let obj: THREE.Object3D | null = intersection.object;
        while (obj) {
          /*
             Ignore scene objects that have a transparent or wireframe material
            */
          if (this.isMaterialIgnored(obj)) {
            break;
          }

          const mElement = MElement.getMElementFromObject(obj);
          if (mElement && mElement.isClickable()) {
            mElement.dispatchEvent(
              new MouseEvent("click", {
                bubbles: true,
              }),
            );
            return;
          }
          obj = obj.parent;
        }
      }
    }
  }

  private handleClick(event: MouseEvent) {
    if ((event.detail as any).element) {
      // Avoid infinite loop of handling click events that originated from this trigger
      return;
    }
    let x = 0;
    let y = 0;
    if (!document.pointerLockElement) {
      let width = window.innerWidth;
      let height = window.innerHeight;
      if (this.clickTarget instanceof HTMLElement) {
        width = this.clickTarget.offsetWidth;
        height = this.clickTarget.offsetHeight;
      }
      x = (event.offsetX / width) * 2 - 1;
      y = -((event.offsetY / height) * 2 - 1);
    }
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.scene.getCamera());
    const intersections = this.raycaster.intersectObject(this.scene.getRootContainer(), true);
    if (intersections.length > 0) {
      for (const intersection of intersections) {
        let obj: THREE.Object3D | null = intersection.object;
        while (obj) {
          /*
             Ignore scene objects that have a transparent or wireframe material
            */
          if (this.isMaterialIgnored(obj)) {
            break;
          }

          const mElement = MElement.getMElementFromObject(obj);
          if (mElement && mElement.isClickable()) {
            // let's get the intersection point relative to the element origin

            const elementRelative = getRelativePositionAndRotationRelativeToObject(
              {
                position: intersection.point,
                rotation: {
                  x: 0,
                  y: 0,
                  z: 0,
                },
              },
              mElement.getContainer(),
            );

            mElement.dispatchEvent(
              new CustomEvent("click", {
                bubbles: true,
                detail: {
                  position: {
                    ...elementRelative.position,
                  },
                },
              }),
            );
            return;
          }
          obj = obj.parent;
        }
      }
    }
  }

  dispose() {
    this.eventHandlerCollection.clear();
  }

  private isMaterialIgnored(obj: THREE.Object3D): boolean {
    const mesh = obj as THREE.Mesh;
    if (mesh) {
      if (
        ((mesh.material as THREE.Material) &&
          (mesh.material as THREE.Material).transparent &&
          (mesh.material as THREE.Material).opacity < 1) ||
        ((mesh.material as THREE.MeshLambertMaterial) &&
          (mesh.material as THREE.MeshLambertMaterial).wireframe) ||
        ((mesh.material as THREE.MeshPhongMaterial) &&
          (mesh.material as THREE.MeshPhongMaterial).wireframe) ||
        ((mesh.material as THREE.MeshPhysicalMaterial) &&
          (mesh.material as THREE.MeshPhysicalMaterial).wireframe) ||
        ((mesh.material as THREE.MeshStandardMaterial) &&
          (mesh.material as THREE.MeshStandardMaterial).wireframe)
      ) {
        return true;
      }
    }
    return false;
  }
}
