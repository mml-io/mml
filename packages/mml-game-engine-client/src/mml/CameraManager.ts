import * as THREE from "three";

import { CameraGraphics } from "./elements/Camera";
import { MCharacterController } from "./elements/CharacterController";
import { GameThreeJSAdapter } from "./GameThreeJSAdapter";

export class CameraManager {
  private cameras: CameraGraphics[] = [];
  private sortedCameras: CameraGraphics[] = [];
  private camerasDirty: boolean = false;
  private controllersDirty: boolean = false;

  private mmlCharacterControllers: MCharacterController<GameThreeJSAdapter>[] = [];
  private sortedMMLCharacterControllers: MCharacterController<GameThreeJSAdapter>[] = [];

  private camera: THREE.PerspectiveCamera;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      1, // maybe we'll update more settings other than FOV after init
      0.01,
      1000,
    );
    this.camera.position.z = 10;
    this.camera.position.y = 5;
  }

  getDefaultCamera() {
    return this.camera;
  }

  getCamera() {
    // Only re-sort if cameras have been added/removed
    if (this.camerasDirty) {
      this.sortedCameras = this.cameras.slice().sort((a, b) => {
        // First, sort by priority (higher priority takes precedence)
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }

        // If priorities are equal, sort by document order
        const aElement = a.cameraElement;
        const bElement = b.cameraElement;

        // compareDocumentPosition returns a bitmask
        // If a comes before b in document order, the result will include DOCUMENT_POSITION_FOLLOWING (4)
        const position = aElement.compareDocumentPosition(bElement);

        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1; // a comes before b
        } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1; // a comes after b
        }

        return 0; // same position (shouldn't happen for different elements)
      });
      this.camerasDirty = false;
    }

    const firstCamera = this.sortedCameras[0];
    if (firstCamera) {
      // There is a camera with the highest priority and precedence in the document
      return firstCamera.getCamera();
    }

    if (this.controllersDirty) {
      this.sortedMMLCharacterControllers = this.mmlCharacterControllers
        .slice()
        .sort((aElement, bElement) => {
          // compareDocumentPosition returns a bitmask
          // If a comes before b in document order, the result will include DOCUMENT_POSITION_FOLLOWING (4)
          const position = aElement.compareDocumentPosition(bElement);

          if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
            return -1; // a comes before b
          } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
            return 1; // a comes after b
          }

          return 0; // same position (shouldn't happen for different elements)
        });
      this.controllersDirty = false;
    }

    const firstCharacterController = this.sortedMMLCharacterControllers[0];
    if (firstCharacterController) {
      return firstCharacterController.getCamera();
    }

    return this.camera;
  }

  registerCamera(camera: CameraGraphics) {
    this.cameras.push(camera);
    this.camerasDirty = true;
  }

  updateCameraPriority(_camera: CameraGraphics) {
    this.camerasDirty = true;
  }

  unregisterCamera(camera: CameraGraphics) {
    this.cameras = this.cameras.filter((c) => c !== camera);
    this.camerasDirty = true;
  }

  registerCharacterController(controller: MCharacterController<GameThreeJSAdapter>) {
    this.mmlCharacterControllers.push(controller);
    this.controllersDirty = true;
  }

  updateCharacterController() {
    this.controllersDirty = true;
  }

  unregisterCharacterController(controller: MCharacterController<GameThreeJSAdapter>) {
    this.mmlCharacterControllers = this.mmlCharacterControllers.filter((c) => c !== controller);
    this.controllersDirty = true;
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.cameras.forEach((camera) => {
      camera.getCamera().aspect = width / height;
      camera.getCamera().updateProjectionMatrix();
    });
  }
}
