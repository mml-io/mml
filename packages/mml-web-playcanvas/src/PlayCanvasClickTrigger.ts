import {
  EventHandlerCollection,
  getRelativePositionAndRotationRelativeToObject,
  MElement,
} from "@mml-io/mml-web";
import * as playcanvas from "playcanvas";

const mouseMovePixelsThreshold = 10;
const mouseMoveTimeThresholdMilliseconds = 500;

/**
 * The PlayCanvasClickTrigger class is responsible for handling click events on the MML scene and raycasts into the scene to
 * determine which object was clicked and then dispatches events to those elements.
 */
export class PlayCanvasClickTrigger {
  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDownTime: number | null = null;
  private mouseMoveDelta = 0;

  static init(
    playcanvasApp: playcanvas.AppBase,
    clickTarget: Document | HTMLElement,
    camera: playcanvas.Entity,
  ): PlayCanvasClickTrigger {
    return new PlayCanvasClickTrigger(playcanvasApp, clickTarget, camera);
  }

  private constructor(
    private playcanvasApp: playcanvas.AppBase,
    private clickTarget: Document | HTMLElement,
    private camera: playcanvas.Entity,
  ) {
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
      x = event.offsetX;
      y = event.offsetY;
    }

    const cameraEntity = this.camera;
    const from = cameraEntity.getPosition();
    const cameraComponent = cameraEntity.camera;
    if (!cameraComponent) {
      console.warn("No camera component found on the camera entity. Cannot raycast.");
      return;
    }

    // The pc.Vec3 to raycast to (the click position projected onto the camera's far clip plane)
    const to = cameraComponent.screenToWorld(x, y, cameraComponent.farClip);

    // Raycast between the two points and return the closest hit result
    const rigidbodySystem = this.playcanvasApp.systems.rigidbody;
    if (!rigidbodySystem) {
      console.warn("No rigidbody system found in the PlayCanvas app. Cannot raycast.");
      return;
    }
    const intersections = rigidbodySystem.raycastAll(from, to);
    // sort the intersections by distance
    intersections.sort((a, b) => a.point.distance(from) - b.point.distance(from));
    for (const intersection of intersections) {
      let obj: playcanvas.GraphNode | null = intersection.entity;
      currentIntersection: while (obj) {
        const mElement = MElement.getMElementFromObject(obj);
        if (!mElement) {
          // The intersection object is not an MElement, so we move up to the parent recursively which may be an MElement
          obj = obj.parent;
          continue currentIntersection;
        }

        if (!mElement.isClickable()) {
          // This is not a clickable element (or it is explicitly set to not be clickable), so we ignore it and pass through to the next intersection
          break currentIntersection;
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
          mElement,
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
    }
  }

  dispose() {
    this.eventHandlerCollection.clear();
  }
}
