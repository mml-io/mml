import { Camera, Euler, Vector3 } from "three";

import { EventHandlerCollection } from "../utils/events/EventHandlerCollection";

const WorldUp = new Vector3(0, 1, 0);

type TouchState = {
  touch: Touch;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

// Creates a set of 5DOF flight controls that requires dragging the mouse to move the rotation and position of the camera
export class DragFlyCameraControls {
  private enabled = false;

  private camera: Camera;
  private domElement: HTMLElement;

  private speed: number;
  private vForward = new Vector3();
  private vUp = new Vector3();
  private vRight = new Vector3();
  private vMovement = new Vector3();

  //private locked = false;
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

  private tempEuler = new Euler(0, 0, 0, "YXZ");

  private eventHandlerCollection: EventHandlerCollection = new EventHandlerCollection();
  private mouseDown = false;

  // Touch zooming and panning
  private touchesMap = new Map<number, TouchState>();
  private isMoving = false;
  private panStartX: number;
  private panStartY: number;
  private zoomTimestamp: number;
  private debounceTime = 20;
  private clickTimestamp: number;
  private clickTime = 200;

  constructor(camera: Camera, domElement: HTMLElement, speed = 15.0) {
    this.camera = camera;
    this.domElement = domElement;
    this.speed = speed;
  }

  public enable() {
    if (this.enabled) {
      return;
    }

    document.addEventListener("touchstart", (e) => {
      e.preventDefault();
    }, { passive: false });

    this.enabled = true;
    this.eventHandlerCollection.add(document, "keydown", this.onKeyDown.bind(this));
    this.eventHandlerCollection.add(document, "keyup", this.onKeyUp.bind(this));
    this.eventHandlerCollection.add(window, "blur", this.onBlur.bind(this));
    this.eventHandlerCollection.add(document, "mousemove", this.onMouseMove.bind(this));
    this.eventHandlerCollection.add(this.domElement, "mousedown", this.onMouseDown.bind(this));
    this.eventHandlerCollection.add(document, "mouseup", this.onMouseUp.bind(this));
    this.eventHandlerCollection.add(document, "wheel", this.onMouseWheel.bind(this));
    this.eventHandlerCollection.add(document, "touchstart", this.handleTouchStart.bind(this));
    this.eventHandlerCollection.add(document, "touchend", this.handleTouchEnd.bind(this));
    this.eventHandlerCollection.add(document, "touchmove", this.handleTouchMove.bind(this));
    // this.eventHandlerCollection.add(document, "click", this.handleClick.bind(this));
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
    if (!this.mouseDown) {
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
    if (!this.mouseDown) {
      return;
    }
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

  private onMouseDown() {
    this.mouseDown = true;
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.mouseDown) {
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

  // private handleClick(event: TouchEvent) {
  //   console.log("Click event detected with the following details: ", event);
  // }

  // Function to handle touch start event
  private handleTouchStart(event: TouchEvent) {
    let startX: number;
    let startY: number;

    for (const touch of Array.from(event.touches)) {
      if (!this.touchesMap.has(touch.identifier)) {
        startX = touch.clientX;
        startY = touch.clientY;

        this.touchesMap.set(touch.identifier, {
          touch,
          startX,
          startY,
          currentX: startX,
          currentY: startY,
        });
      }
    }

    if (event.touches.length === 1) {
      this.panStartX = event.touches[0].clientX;
      this.panStartY = event.touches[0].clientY;
      this.clickTimestamp = Date.now();
    }
  }
  // Function to handle touch end event
  private handleTouchEnd(event: TouchEvent) {
    if (this.isMoving) {
      this.zoomTimestamp = Date.now();
    }
    this.isMoving = false;

    const remainingTouches = new Set(Array.from(event.touches).map((touch) => touch.identifier));

    for (const [touchId] of this.touchesMap) {
      if (!remainingTouches.has(touchId)) {
        this.touchesMap.delete(touchId);
      }
    }

    if (Date.now() - this.clickTimestamp < this.clickTime) {
      /* this is a click */
      // Create and dispatch a new mouse event with specific x and y coordinates
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: this.panStartX,
        clientY: this.panStartY,
      });
      window.dispatchEvent(clickEvent);
    }
  }

  // Function to handle touch move event
  private handleTouchMove(event: TouchEvent) {
    for (const touch of Array.from(event.touches)) {
      const touchState = this.touchesMap.get(touch.identifier);
      if (!touchState) {
        throw new Error("Touch identifier not found.");
      }
      touchState.touch = touch;
    }

    if (event.touches.length > 1) {
      let currentAverageX = 0;
      let latestAverageX = 0;
      let currentAverageY = 0;
      let latestAverageY = 0;
      for (const [, touch] of this.touchesMap) {
        currentAverageX += touch.currentX;
        currentAverageY += touch.currentY;
        latestAverageX += touch.touch.clientX;
        latestAverageY += touch.touch.clientY;
      }

      currentAverageX = currentAverageX / this.touchesMap.size;
      currentAverageY = currentAverageY / this.touchesMap.size;
      latestAverageX = latestAverageX / this.touchesMap.size;
      latestAverageY = latestAverageY / this.touchesMap.size;
      let currentAverageDX = 0;
      let currentAverageDY = 0;
      let latestAverageDX = 0;
      let latestAverageDY = 0;
      for (const [, touch] of this.touchesMap) {
        currentAverageDX += Math.abs(touch.currentX - currentAverageX);
        currentAverageDY += Math.abs(touch.currentY - currentAverageY);
        latestAverageDX += Math.abs(touch.touch.clientX - latestAverageX);
        latestAverageDY += Math.abs(touch.touch.clientY - latestAverageY);
      }

      const currentDistance = Math.hypot(currentAverageDX, currentAverageDY);
      const latestDistance = Math.hypot(latestAverageDX, latestAverageDY);
      const deltaDistance = latestDistance - currentDistance;

      this.camera.getWorldDirection(this.vForward);
      this.vRight.crossVectors(this.vForward, WorldUp);
      this.vRight.normalize();
      this.vUp.crossVectors(this.vRight, this.vForward);
      this.vUp.normalize();

      this.vMovement.set(0, 0, 0);
      this.vMovement.addScaledVector(this.vForward, deltaDistance);
      this.vMovement.multiplyScalar(0.01);

      this.camera.position.add(this.vMovement);
      this.isMoving = true;
    } else if (event.touches.length === 1) {
      // Pan
      if (!this.zoomTimestamp || Date.now() > this.zoomTimestamp + this.debounceTime) {
        this.isMoving = false;

        const movementX = event.touches[0].clientX - this.panStartX;
        let movementY = event.touches[0].clientY - this.panStartY;

        // Update the start coordinates for the next move event
        this.panStartX = event.touches[0].clientX;
        this.panStartY = event.touches[0].clientY;

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
    }

    for (const touch of Array.from(event.touches)) {
      const touchState = this.touchesMap.get(touch.identifier);
      if (!touchState) {
        throw new Error("Touch identifier not found.");
      }
      touchState.currentX = touch.clientX;
      touchState.currentY = touch.clientY;
    }
  }
}
