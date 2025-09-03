import {
  EventHandlerCollection,
  getRelativePositionAndRotationRelativeToObject,
  MElement,
  TransformableElement,
} from "@mml-io/mml-web";
import * as THREE from "three";

const mouseMovePixelsThreshold = 10;
const mouseMoveTimeThresholdMilliseconds = 500;

/**
 * The ThreeJSClickTrigger class is responsible for handling click events on the MML scene and raycasts into the scene to
 * determine which object was clicked and then dispatches events to those elements.
 */
export class ThreeJSClickTrigger {
  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private raycaster: THREE.Raycaster;
  private mouseDownTime: number | null = null;
  private mouseMoveDelta = 0;

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
    if (intersections.length > 0) {
      for (const intersection of intersections) {
        let obj: THREE.Object3D | null = intersection.object;
        currentIntersection: while (obj) {
          /*
             Ignore scene objects that have a transparent or wireframe material
            */
          if (this.isMaterialIgnored(obj)) {
            break currentIntersection;
          }

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

          // This is a clickable element, so we dispatch the click event to it
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
  }

  dispose() {
    this.eventHandlerCollection.clear();
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
