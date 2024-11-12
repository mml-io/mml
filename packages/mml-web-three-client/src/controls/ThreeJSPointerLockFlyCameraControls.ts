import { EventHandlerCollection } from "mml-web";
import * as THREE from "three";

import { ThreeJSControls } from "./ThreeJSControls";

const WorldUp = new THREE.Vector3(0, 1, 0);

// Creates a set of 5DOF flight controls that requires clicking the element to capture the mouse before being able to rotate and position the camera
export class ThreeJSPointerLockFlyCameraControls implements ThreeJSControls {
  public readonly type = "pointer-lock-fly";

  private enabled = false;

  private camera: THREE.Camera;
  private domElement: HTMLElement;

  private speed: number;
  private vForward = new THREE.Vector3();
  private vUp = new THREE.Vector3();
  private vRight = new THREE.Vector3();
  private vMovement = new THREE.Vector3();

  private forward = false;
  private backward = false;
  private left = false;
  private right = false;
  private up = false;
  private down = false;

  // Set to constrain the pitch of the camera
  // Range is 0 to Math.PI radians
  private minPolarAngle = 0; // radians
  private maxPolarAngle = Math.PI; // radians

  // This is an addition to the original PointerLockControls class
  private invertedMouseY = false;

  private tempEuler = new THREE.Euler(0, 0, 0, "YXZ");

  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDown = false;

  constructor(camera: THREE.Camera, domElement: HTMLElement, speed = 15.0) {
    this.camera = camera;
    this.domElement = domElement;
    this.domElement.style.userSelect = "none";
    this.speed = speed;
  }

  public enable() {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.eventHandlerCollection.add(this.domElement, "click", this.onClickCanvas.bind(this));
    this.eventHandlerCollection.add(document, "keydown", this.onKeyDown.bind(this));
    this.eventHandlerCollection.add(document, "keyup", this.onKeyUp.bind(this));
    this.eventHandlerCollection.add(window, "blur", this.onBlur.bind(this));
    this.eventHandlerCollection.add(document, "mousemove", this.onMouseMove.bind(this));
    this.eventHandlerCollection.add(document, "mousedown", this.onMouseDown.bind(this));
    this.eventHandlerCollection.add(document, "mouseup", this.onMouseUp.bind(this));
    this.eventHandlerCollection.add(document, "wheel", this.onMouseWheel.bind(this));
  }

  public disable() {
    if (!this.enabled) {
      return;
    }
    this.eventHandlerCollection.clear();
    this.enabled = false;
  }

  // This is an addition to the original PointerLockControls class
  public setInvert(invert: boolean) {
    this.invertedMouseY = invert;
  }

  public dispose() {
    this.disable();
  }

  public update(dt: number) {
    if (this.domElement.ownerDocument.pointerLockElement !== this.domElement) {
      return;
    }
    this.camera.getWorldDirection(this.vForward);
    this.vRight.crossVectors(this.vForward, WorldUp);
    this.vRight.normalize();
    this.vUp.crossVectors(this.vRight, this.vForward);
    this.vUp.normalize();

    this.vMovement.set(0, 0, 0);
    this.vMovement.addScaledVector(this.vForward, Number(this.forward) - Number(this.backward));
    this.vMovement.addScaledVector(this.vUp, Number(this.up) - Number(this.down));
    this.vMovement.addScaledVector(this.vRight, Number(this.right) - Number(this.left));
    this.vMovement.normalize();
    this.vMovement.multiplyScalar(this.speed * dt);

    this.camera.position.add(this.vMovement);
  }

  private onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.forward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.left = true;
        break;
      case "ArrowDown":
      case "KeyS":
        this.backward = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = true;
        break;
      case "Space":
        this.up = true;
        break;
      case "ShiftLeft":
        this.down = true;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.forward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.left = false;
        break;
      case "ArrowDown":
      case "KeyS":
        this.backward = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = false;
        break;
      case "Space":
        this.up = false;
        break;
      case "ShiftLeft":
        this.down = false;
        break;
    }
  }

  private onBlur() {
    this.mouseDown = false;
    this.forward = false;
    this.left = false;
    this.backward = false;
    this.right = false;
    this.up = false;
    this.down = false;
  }

  private onClickCanvas() {
    this.domElement.requestPointerLock();
  }

  private onMouseDown() {
    this.mouseDown = true;
  }

  private onMouseMove(event: MouseEvent) {
    if (this.domElement.ownerDocument.pointerLockElement !== this.domElement) {
      return;
    }
    const movementX = event.movementX;
    let movementY = event.movementY;

    // This is an addition to the original PointerLockControls class
    if (this.invertedMouseY) {
      movementY *= -1;
    }

    this.tempEuler.setFromQuaternion(this.camera.quaternion);

    this.tempEuler.y -= movementX * 0.002;
    this.tempEuler.x -= movementY * 0.002;

    this.tempEuler.x = Math.max(
      Math.PI / 2 - this.maxPolarAngle,
      Math.min(Math.PI / 2 - this.minPolarAngle, this.tempEuler.x),
    );

    this.camera.quaternion.setFromEuler(this.tempEuler);
  }
  private onMouseUp() {
    this.mouseDown = false;
  }

  private onMouseWheel(event: WheelEvent) {
    if (!this.mouseDown) {
      return;
    }
    this.speed -= event.deltaY * 0.1;

    // restrict to a reasonable min and max
    this.speed = Math.max(5, Math.min(this.speed, 1000));
  }
}
