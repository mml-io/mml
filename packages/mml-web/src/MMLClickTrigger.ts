import * as THREE from "three";

import { MElement } from "./elements/MElement";
import { IMMLScene } from "./MMLScene";
import { EventHandlerCollection } from "./utils/events/EventHandlerCollection";

const mouseMovePixelsThreshold = 10;
const mouseMoveTimeThresholdMilliseconds = 500;

export class MMLClickTrigger {
  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private scene: IMMLScene;
  private raycaster: THREE.Raycaster;
  private clickTarget: Document | HTMLElement;
  private elementsHolder: Document | HTMLElement;
  private mouseDownTime: number | null = null;
  private mouseMoveDelta = 0;

  static init(
    clickTarget: Document | HTMLElement,
    elementsHolder: Document | HTMLElement,
    scene: IMMLScene,
  ): MMLClickTrigger {
    return new MMLClickTrigger(clickTarget, elementsHolder, scene);
  }

  private constructor(
    clickTarget: Document | HTMLElement,
    elementsHolder: Document | HTMLElement,
    scene: IMMLScene,
  ) {
    this.clickTarget = clickTarget;
    this.elementsHolder = elementsHolder;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();

    this.eventHandlerCollection.add(clickTarget, "mousedown", this.handleMouseDown.bind(this));
    this.eventHandlerCollection.add(clickTarget, "mouseup", this.handleMouseUp.bind(this));
    this.eventHandlerCollection.add(clickTarget, "mousemove", this.handleMouseMove.bind(this));
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
            if (this.elementsHolder.contains(mElement)) {
              /*
                 Only dispatch the event if the element in the scene is a child of the container - this handles the case
                 where there are multiple documents in the same THREE.js scene and the events should only be handled by
                 their respective handlers.
                */

              mElement.dispatchEvent(
                new MouseEvent("click", {
                  bubbles: true,
                }),
              );
            }
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
          (mesh.material as THREE.Material).transparent === true &&
          (mesh.material as THREE.Material).opacity < 1) ||
        ((mesh.material as THREE.MeshLambertMaterial) &&
          (mesh.material as THREE.MeshLambertMaterial).wireframe === true) ||
        ((mesh.material as THREE.MeshPhongMaterial) &&
          (mesh.material as THREE.MeshPhongMaterial).wireframe === true) ||
        ((mesh.material as THREE.MeshPhysicalMaterial) &&
          (mesh.material as THREE.MeshPhysicalMaterial).wireframe === true) ||
        ((mesh.material as THREE.MeshStandardMaterial) &&
          (mesh.material as THREE.MeshStandardMaterial).wireframe === true)
      ) {
        return true;
      }
    }
    return false;
  }
}
