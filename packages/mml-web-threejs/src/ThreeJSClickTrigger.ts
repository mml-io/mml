import {
  EventHandlerCollection,
  getRelativePositionAndRotationRelativeToObject,
  MElement,
} from "@mml-io/mml-web";
import * as THREE from "three";

const mouseMovePixelsThreshold = 10;
const mouseMoveTimeThresholdMilliseconds = 500;

/**
 * Callback type for scene clicks. Receives the clicked MElement (or null if nothing was hit).
 * Return true to prevent the default click event dispatch.
 */
export type SceneClickCallback = (
  element: MElement<any> | null,
  event: MouseEvent,
) => boolean | void;

/**
 * The ThreeJSClickTrigger class is responsible for handling click events on the MML scene and raycasts into the scene to
 * determine which object was clicked and then dispatches events to those elements.
 */
export class ThreeJSClickTrigger {
  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private raycaster: THREE.Raycaster;
  private mouseDownTime: number | null = null;
  private mouseMoveDelta = 0;
  private sceneClickCallback: SceneClickCallback | null = null;

  static init(
    clickTarget: Document | HTMLElement,
    rootContainer: THREE.Object3D,
    camera: THREE.Camera,
  ): ThreeJSClickTrigger {
    return new ThreeJSClickTrigger(clickTarget, rootContainer, camera);
  }

  private constructor(
    private clickTarget: Document | HTMLElement,
    private rootContainer: THREE.Object3D,
    private camera: THREE.Camera,
  ) {
    this.raycaster = new THREE.Raycaster();

    this.eventHandlerCollection.add(clickTarget, "mousedown", this.handleMouseDown.bind(this));
    this.eventHandlerCollection.add(clickTarget, "mouseup", this.handleMouseUp.bind(this));
    this.eventHandlerCollection.add(clickTarget, "mousemove", this.handleMouseMove.bind(this));
  }

  /**
   * Set a callback to be invoked on every scene click.
   * The callback receives the clicked MElement (or null) and can return true to prevent default handling.
   */
  public setSceneClickCallback(callback: SceneClickCallback | null): void {
    this.sceneClickCallback = callback;
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
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const intersections = this.raycaster.intersectObject(this.rootContainer, true);

    // Find the first valid MElement hit (for selection callback)
    let hitElement: MElement<any> | null = null;
    let hitIntersection: THREE.Intersection | null = null;

    if (intersections.length > 0) {
      for (const intersection of intersections) {
        if (this.shouldIgnoreForSelection(intersection.object)) {
          continue;
        }

        let obj: THREE.Object3D | null = intersection.object;
        currentIntersection: while (obj) {
          /*
             Ignore scene objects that have a transparent or wireframe material
             (skip this check in editor mode - when sceneClickCallback is set)
            */
          if (!this.sceneClickCallback && this.isMaterialIgnored(obj)) {
            break currentIntersection;
          }

          const mElement = MElement.getMElementFromObject(obj);
          if (!mElement) {
            // The intersection object is not an MElement, so we move up to the parent recursively which may be an MElement
            obj = obj.parent;
            continue currentIntersection;
          }

          // Found a valid MElement
          hitElement = mElement;
          hitIntersection = intersection;
          break;
        }
        if (hitElement) break;
      }
    }

    // Call scene click callback first (for selection handling)
    if (this.sceneClickCallback) {
      const preventDefault = this.sceneClickCallback(hitElement, event);
      if (preventDefault) {
        return;
      }
    }

    // Default click event dispatch for clickable elements
    if (hitElement && hitIntersection && hitElement.isClickable()) {
      const elementRelative = getRelativePositionAndRotationRelativeToObject(
        {
          position: hitIntersection.point,
          rotation: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        hitElement,
      );
      hitElement.dispatchEvent(
        new CustomEvent("click", {
          bubbles: true,
          detail: {
            position: {
              ...elementRelative.position,
            },
          },
        }),
      );
    }
  }

  dispose() {
    this.eventHandlerCollection.clear();
  }

  private shouldIgnoreForSelection(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData?.visualizerClickable === false) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private isMaterialIgnored(obj: THREE.Object3D): boolean {
    const mesh = obj as THREE.Mesh;
    if (mesh) {
      if (
        ((mesh.material as THREE.MeshLambertMaterial) &&
          (mesh.material as THREE.MeshLambertMaterial).wireframe) ||
        ((mesh.material as THREE.MeshPhongMaterial) &&
          (mesh.material as THREE.MeshPhongMaterial).wireframe) ||
        ((mesh.material as THREE.MeshPhysicalMaterial) &&
          (mesh.material as THREE.MeshPhysicalMaterial).wireframe) ||
        ((mesh.material as THREE.MeshStandardMaterial) &&
          (mesh.material as THREE.MeshStandardMaterial).wireframe) ||
        ((mesh.material as THREE.LineBasicMaterial) &&
          (mesh.material as THREE.LineBasicMaterial).isLineBasicMaterial)
      ) {
        return true;
      }
    }
    return false;
  }
}
