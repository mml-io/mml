import * as THREE from "three";

import { MElement } from "./elements/";
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

export type TouchPosition = {
  x: number;
  y: number;
};

let touchTimestamp: number;
const dragIntervalMinimumMilliseconds = 30;

const dragIntervalAttrName = "drag-interval";
export const dragStartEventName = "dragstart";
export const dragMoveEventName = "dragmove";
export const dragEndEventName = "dragend";

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
  private pressIdToTouchPosition = new Map<number, TouchPosition>();
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
    this.eventHandlerCollection.add(clickTarget, "touchmove", this.handleTouchMove.bind(this));
    this.eventHandlerCollection.add(clickTarget, "touchend", this.handleTouchEnd.bind(this));
  }

  public get isDragging(): boolean {
    return this.dragIdToElementMap.size > 0;
  }

  private getPressId(event: MouseEvent | TouchEvent) {
    if (event instanceof MouseEvent) return event.button;

    return event.changedTouches[event.changedTouches.length - 1].identifier;
  }

  private handleMouseDown(e: MouseEvent) {
    this.mouseDownTime = Date.now();
    this.mouseMoveDelta = 0;
    this.handleDragStart(e);
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.mouseDownTime) {
      this.mouseMoveDelta += Math.abs(event.movementX) + Math.abs(event.movementY);
    }
    const currentTime = performance.now();

    const dragData = this.dragIdToElementMap.get(this.getPressId(event));

    if (dragData) {
      let listeningInterval = getDragInterval(dragData.mElement);

      if (listeningInterval === null) {
        dragData.lastUpdate = currentTime;
      }

      listeningInterval = Math.max(listeningInterval as number, dragIntervalMinimumMilliseconds);

      if (dragData.lastUpdate < currentTime - listeningInterval) {
        dragData.lastUpdate = currentTime;
        this.handleDrag(event);
      }
    }
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

    const pressId = this.getPressId(event);
    const dragData = this.dragIdToElementMap.get(pressId);

    if (dragData) {
      this.pressIdToTouchPosition.delete(pressId);
      dragData.mElement.dispatchEvent(
        new CustomEvent(dragEndEventName, {
          bubbles: true,
          detail: {
            dragId: this.getPressId(event),
            type: "click",
          },
        }),
      );
      this.dragIdToElementMap.delete(pressId);
    }
  }

  private handleTouchStart(event: TouchEvent) {
    const pressId = this.getPressId(event);
    /* remember the x and y position of the touch, so that it can be used in touchEnd */
    this.pressIdToTouchPosition.set(pressId, {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
    });

    /* remember the start time of the touch to calculate the touch duration in touchEnd */
    touchTimestamp = Date.now();

    this.handleDragStart(event);
  }

  private handleTouchMove(event: TouchEvent) {
    const currentTime = performance.now();

    const pressId = this.getPressId(event);
    /* remember the x and y position of the touch, so that it can be used in touchEnd */

    this.pressIdToTouchPosition.set(pressId, {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
    });

    const dragData = this.dragIdToElementMap.get(this.getPressId(event));

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
    const { element, intersection } = this.getFirstIntersectionElement(event) || {};

    if (!element || !intersection) return;

    if (Date.now() - touchTimestamp < touchThresholdMilliseconds) {
      /* a short touch, i.e., a click */
      if ((event.detail as any).element) {
        // Avoid infinite loop of handling click events that originated from this trigger
        return;
      }

      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
        }),
      );
    }

    const {
      changedTouches,
      changedTouches: { length },
    } = event;

    if (this.dragIdToElementMap.get(changedTouches[length - 1].identifier)) {
      element.dispatchEvent(
        new CustomEvent(dragEndEventName, {
          bubbles: true,
          detail: {
            dragId: this.getPressId(event),
            type: "touch",
          },
        }),
      );

      this.dragIdToElementMap.delete(changedTouches[length - 1].identifier);
    }
  }

  private getIntersectionsMouse(event: MouseEvent) {
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

  private getIntersectionsTouch(event: TouchEvent) {
    let x = 0;
    let y = 0;
    if (!document.pointerLockElement) {
      const pressId = this.getPressId(event);

      const touchPosition = this.pressIdToTouchPosition.get(pressId);
      let offsetX = touchPosition?.x || 0;
      let offsetY = touchPosition?.y || 0;

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
    return this.raycaster.intersectObject(this.scene.getRootContainer(), true);
  }

  private getFirstIntersectionElement(event: MouseEvent | TouchEvent) {
    let intersections: THREE.Intersection[] = [];
    if (window.TouchEvent && event instanceof window.TouchEvent) {
      intersections = this.getIntersectionsTouch(event);
    } else if (event instanceof MouseEvent) {
      intersections = this.getIntersectionsMouse(event);
    }

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

  private handleDragStart(event: MouseEvent | TouchEvent) {
    if ((event.detail as any).element) {
      // Avoid infinite loop of handling click events that originated from this trigger
      return;
    }

    const { element, intersection } = this.getFirstIntersectionElement(event) || {};
    if (!element || !intersection || !getDragInterval(element)) return;
    const pressId = this.getPressId(event);

    this.dragIdToElementMap.set(pressId, {
      mElement: element,
      lastUpdate: performance.now(),
    });

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
      new CustomEvent(dragStartEventName, {
        bubbles: true,
        detail: {
          position: {
            ...elementRelative.position,
          },
          dragId: this.getPressId(event),
          type: event instanceof MouseEvent ? "click" : "touch",
        },
      }),
    );
  }

  private handleDrag(event: MouseEvent | TouchEvent) {
    if ((event.detail as any).element) {
      // Avoid infinite loop of handling click events that originated from this trigger
      return;
    }

    const { element, intersection } = this.getFirstIntersectionElement(event) || {};

    if (!element || !intersection) return;

    // Check whether the drag event is for the same element as the drag start event
    const dragData = this.dragIdToElementMap.get(this.getPressId(event));

    if (!dragData || dragData.mElement !== element) return;

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
      new CustomEvent(dragMoveEventName, {
        bubbles: true,
        detail: {
          position: {
            ...elementRelative.position,
          },
          dragId: this.getPressId(event),
          type: event instanceof MouseEvent ? "click" : "touch",
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
          pressId: this.getPressId(event),
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
