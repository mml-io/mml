import * as THREE from "three";

import { MElement } from "./elements/MElement";
import { IMMLScene } from "./MMLScene";
import { EventHandlerCollection } from "./utils/events/EventHandlerCollection";
import { getRelativePositionAndRotationRelativeToObject } from "./utils/position-utils";

export type DragData = {
  mElement: MElement;
  lastUpdate: number;
};

const mouseMovePixelsThreshold = 10;
const mouseMoveTimeThresholdMilliseconds = 500;
const touchThresholdMilliseconds = 200;

let touchX: number;
let touchY: number;
let touchTimestamp: number;
const dragIntervalMinimumMilliseconds = 100;

const dragIntervalAttrName = "drag-interval";
export const dragEventName = "drag";

export function getDragInterval(mElement: MElement): null | number {
  const dragEventsAttr = mElement.getAttribute(dragIntervalAttrName);
  if (dragEventsAttr === null) {
    return null;
  }
  const parsed = parseFloat(dragEventsAttr);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
}


/**
 * The MMLClickTrigger class is responsible for handling click events on the MML scene and raycasts into the scene to
 * determine which object was clicked and then dispatches events to those elements.
 */
export class MMLClickTrigger {
  private dragIdToElementMap = new Map<number, DragData>();
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
    this.eventHandlerCollection.add(clickTarget, "touchend", this.handleTouchEnd.bind(this));
  }

  private handleMouseDown(e: MouseEvent) {
    this.mouseDownTime = Date.now();
    this.mouseMoveDelta = 0;
    this.handleDragStart(e);
  }

  private handleMouseUp(event: MouseEvent) {
    this.dragIdToElementMap.delete(event.button);

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

  private getIntersections(event: MouseEvent) {
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
    return this.raycaster.intersectObject(this.scene.getRootContainer(), true);
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.mouseDownTime) {
      this.mouseMoveDelta += Math.abs(event.movementX) + Math.abs(event.movementY);
    }
    const currentTime = performance.now();

    const dragData = this.dragIdToElementMap.get(event.button);

    if (dragData) {
      let listeningInterval = getDragInterval(dragData.mElement);
      if (listeningInterval === null) {
        dragData.lastUpdate = currentTime;
      } else {
        listeningInterval = Math.max(listeningInterval, dragIntervalMinimumMilliseconds);
        if (dragData.lastUpdate < currentTime - listeningInterval) {
          dragData.lastUpdate = currentTime;
          this.handleDrag(event);
        }
      }
    }
  }

  private handleTouchEnd(event: TouchEvent) {
    if (Date.now() - touchTimestamp < touchThresholdMilliseconds) {
      /* a short touch, i.e., a click */
      if ((event.detail as any).element) {
        // Avoid infinite loop of handling click events that originated from this trigger
        return;
      }
      let x = 0;
      let y = 0;
      if (!document.pointerLockElement) {
        let offsetX = touchX;
        let offsetY = touchY;
        let width = window.innerWidth;
        let height = window.innerHeight;
        if (this.clickTarget instanceof HTMLElement) {
          width = this.clickTarget.offsetWidth;
          height = this.clickTarget.offsetHeight;
        }
        if (event.target) {
          /* get the equivalent of event.offset in a mouse event */
          const bcr = (event.target as HTMLElement).getBoundingClientRect();
          offsetX = offsetX - bcr.x;
          offsetY = offsetY - bcr.y;
        }
        x = (offsetX / width) * 2 - 1;
        y = -((offsetY / height) * 2 - 1);
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
  }

  private handleTouchStart(event: TouchEvent) {
    /* remember the x and y position of the touch, so that it can be used in touchEnd */
    touchX = event.touches[0].clientX;
    touchY = event.touches[0].clientY;

    /* remember the start time of the touch to calculate the touch duration in touchEnd */
    touchTimestamp = Date.now();
  }

  private getFirstIntersectionElement(event: MouseEvent) {
    const intersections = this.getIntersections(event);

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
            return {
              element: mElement,
              intersection,
            };
          }

          obj = obj.parent;
        }
      }
    }
  }

  private handleDragStart(event: MouseEvent) {
    if ((event.detail as any).element) {
      // Avoid infinite loop of handling click events that originated from this trigger
      return;
    }

    const { element } = this.getFirstIntersectionElement(event) || {};

    if (element && getDragInterval(element)) {
      this.dragIdToElementMap.set(event.button, {
        mElement: element,
        lastUpdate: performance.now(),
      });
    }

    console.log(this.dragIdToElementMap.get(event.button));
  }

  private handleDrag(event: MouseEvent) {
    if ((event.detail as any).element) {
      // Avoid infinite loop of handling click events that originated from this trigger
      return;
    }

    const { element, intersection } = this.getFirstIntersectionElement(event) || {};

    if (!element || !intersection) {
      return;
    }

    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      {
        position: intersection.point,
        rotation: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      element.getContainer(),
    );

    element.dispatchEvent(
      new CustomEvent(dragEventName, {
        bubbles: true,
        detail: {
          position: {
            ...elementRelative.position,
          },
          dragId: event.button,
        },
      }),
    );
  }

  private handleClick(event: MouseEvent) {
    if ((event.detail as any).element) {
      // Avoid infinite loop of handling click events that originated from this trigger
      return;
    }

    const { element, intersection } = this.getFirstIntersectionElement(event) || {};

    if (!element || !intersection) {
      return;
    }

    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      {
        position: intersection.point,
        rotation: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
      element.getContainer(),
    );

    element.dispatchEvent(
      new CustomEvent("click", {
        bubbles: true,
        detail: {
          position: {
            ...elementRelative.position,
          },
          dragId: event.button,
        },
      }),
    );
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
