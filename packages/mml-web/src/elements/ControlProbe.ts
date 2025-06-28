import { ThreeJSGraphicsAdapter } from "@mml-io/mml-web-threejs/build/ThreeJSGraphicsAdapter";

import { AnimatedAttributeHelper } from "../attribute-animation";
import { AttributeHandler, parseBoolAttribute, parseFloatAttribute } from "../attributes";
import { OrientedBoundingBox } from "../bounding-box";
import { GraphicsAdapter } from "../graphics";
import { Vect3 } from "../math";
import { AnimationType } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { TransformableElement } from "./TransformableElement";

const defaultControlsProbeInterval = 100;
const defaultControlsProbeMinimumInterval = 16; // ~60fps
const defaultControlsProbeDebug = false;
const defaultCameraDistance = 5;
const defaultCameraHeight = 2;
const defaultCameraSmoothing = 0.1;
const defaultUseOrbitControls = true;
const controlsProbeMovementEventName = "controlsmovement";

export type MControlProbeProps = {
  intervalMs: number;
  debug: boolean;
  cameraDistance: number;
  cameraHeight: number;
  cameraSmoothing: number;
  useOrbitControls: boolean;
};

export class ControlProbe<
  G extends GraphicsAdapter = GraphicsAdapter,
> extends TransformableElement<G> {
  static tagName = "m-control-probe";

  public props: MControlProbeProps = {
    intervalMs: defaultControlsProbeInterval,
    debug: defaultControlsProbeDebug,
    cameraDistance: defaultCameraDistance,
    cameraHeight: defaultCameraHeight,
    cameraSmoothing: defaultCameraSmoothing,
    useOrbitControls: defaultUseOrbitControls,
  };

  private static attributeHandler = new AttributeHandler<ControlProbe<GraphicsAdapter>>({
    interval: (instance, newValue) => {
      instance.props.intervalMs = Math.max(
        defaultControlsProbeMinimumInterval,
        parseFloatAttribute(newValue, defaultControlsProbeInterval),
      );
      instance.startEmitting();
    },
    debug: (instance, newValue) => {
      instance.props.debug = parseBoolAttribute(newValue, defaultControlsProbeDebug);
    },
    "camera-distance": (instance, newValue) => {
      instance.props.cameraDistance = parseFloatAttribute(newValue, defaultCameraDistance);
    },
    "camera-height": (instance, newValue) => {
      instance.props.cameraHeight = parseFloatAttribute(newValue, defaultCameraHeight);
    },
    "camera-smoothing": (instance, newValue) => {
      instance.props.cameraSmoothing = Math.max(
        0,
        Math.min(1, parseFloatAttribute(newValue, defaultCameraSmoothing)),
      );
    },
    "use-orbit-controls": (instance, newValue) => {
      instance.props.useOrbitControls = parseBoolAttribute(newValue, defaultUseOrbitControls);
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...ControlProbe.attributeHandler.getAttributes(),
    ];
  }

  private timer: NodeJS.Timeout | null = null;
  private keysPressed: Set<string> = new Set();
  private boundKeyDownHandler: (event: KeyboardEvent) => void;
  private boundKeyUpHandler: (event: KeyboardEvent) => void;
  private boundMouseDownHandler: (event: MouseEvent) => void;
  private boundMouseMoveHandler: (event: MouseEvent) => void;
  private boundMouseUpHandler: (event: MouseEvent) => void;
  private boundMouseWheelHandler: (event: WheelEvent) => void;
  private lastCameraPosition: { x: number; y: number; z: number } | null = null;

  // Orbit controls properties
  private mouseDown = false;
  private orbitYaw = 0;
  private orbitPitch = Math.PI * 0.3; // Start at a reasonable angle
  private orbitDistance = 5;

  constructor() {
    super();
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundKeyUpHandler = this.handleKeyUp.bind(this);
    this.boundMouseDownHandler = this.handleMouseDown.bind(this);
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundMouseUpHandler = this.handleMouseUp.bind(this);
    this.boundMouseWheelHandler = this.handleMouseWheel.bind(this);
  }

  protected enable() {
    // no-op
  }

  protected disable() {
    // no-op
  }

  public parentTransformed() {
    // Update camera position when the probe moves
    if (this.props.useOrbitControls) {
      this.updateOrbitCamera();
    } else {
      this.updateThirdPersonCamera();
    }
  }

  public getContentBounds(): OrientedBoundingBox | null {
    // Controls probe doesn't have physical bounds like position probe
    return null;
  }

  public isClickable(): boolean {
    return false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    ControlProbe.attributeHandler.handle(this, name, newValue);
  }

  private updateThirdPersonCamera() {
    if (!this.transformableElementGraphics) {
      return;
    }

    try {
      // Get the world position of this probe
      const worldMatrix = this.transformableElementGraphics.getWorldMatrix();
      const probePosition = {
        x: worldMatrix.data[12],
        y: worldMatrix.data[13],
        z: worldMatrix.data[14],
      };

      // Get the graphics adapter and check if it's ThreeJS
      const graphicsAdapter =
        this.getScene().getGraphicsAdapter() as unknown as ThreeJSGraphicsAdapter;

      // Calculate third-person camera position (behind and above the probe)
      const cameraOffset = {
        x: 0,
        y: this.props.cameraHeight,
        z: this.props.cameraDistance,
      };

      const desiredCameraPosition = {
        x: probePosition.x + cameraOffset.x,
        y: probePosition.y + cameraOffset.y,
        z: probePosition.z + cameraOffset.z,
      };

      // Apply smoothing to camera movement
      let finalCameraPosition = desiredCameraPosition;
      if (this.lastCameraPosition && this.props.cameraSmoothing > 0) {
        const smoothing = this.props.cameraSmoothing;
        finalCameraPosition = {
          x:
            this.lastCameraPosition.x +
            (desiredCameraPosition.x - this.lastCameraPosition.x) * smoothing,
          y:
            this.lastCameraPosition.y +
            (desiredCameraPosition.y - this.lastCameraPosition.y) * smoothing,
          z:
            this.lastCameraPosition.z +
            (desiredCameraPosition.z - this.lastCameraPosition.z) * smoothing,
        };
      }

      // Update camera position
      const camera = graphicsAdapter.getCamera();
      camera.position.set(finalCameraPosition.x, finalCameraPosition.y, finalCameraPosition.z);

      // Make camera look at the probe
      camera.lookAt(probePosition.x, probePosition.y, probePosition.z);

      // Store the current camera position for next frame smoothing
      this.lastCameraPosition = finalCameraPosition;

      if (this.props.debug) {
        console.log("Third-person camera updated:", {
          probePosition,
          cameraPosition: finalCameraPosition,
          distance: this.props.cameraDistance,
          height: this.props.cameraHeight,
        });
      }
    } catch (error) {
      if (this.props.debug) {
        console.warn("Controls probe failed to update third-person camera:", error);
      }
    }
  }

  private updateOrbitCamera() {
    if (!this.transformableElementGraphics) {
      return;
    }

    try {
      // Get the world position of this probe
      const worldMatrix = this.transformableElementGraphics.getWorldMatrix();
      const probePosition = {
        x: worldMatrix.data[12],
        y: worldMatrix.data[13],
        z: worldMatrix.data[14],
      };

      // Get the graphics adapter
      const graphicsAdapter =
        this.getScene().getGraphicsAdapter() as unknown as ThreeJSGraphicsAdapter;
      const camera = graphicsAdapter.getCamera();

      // Calculate orbit camera position using spherical coordinates
      const x = Math.sin(this.orbitPitch) * Math.cos(this.orbitYaw) * this.orbitDistance;
      const y = Math.cos(this.orbitPitch) * this.orbitDistance;
      const z = Math.sin(this.orbitPitch) * Math.sin(this.orbitYaw) * this.orbitDistance;

      // Position camera relative to probe
      camera.position.set(probePosition.x + x, probePosition.y + y, probePosition.z + z);

      // Make camera look at the probe
      camera.lookAt(probePosition.x, probePosition.y, probePosition.z);

      if (this.props.debug) {
        console.log("Orbit camera updated:", {
          probePosition,
          cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          yaw: this.orbitYaw,
          pitch: this.orbitPitch,
          distance: this.orbitDistance,
        });
      }
    } catch (error) {
      if (this.props.debug) {
        console.warn("Controls probe failed to update orbit camera:", error);
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key === "w" || key === "a" || key === "s" || key === "d" || key === " ") {
      this.keysPressed.add(key);
      if (this.props.debug) {
        console.log(`Controls probe: ${key === " " ? "space" : key} pressed`, this.keysPressed);
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key === "w" || key === "a" || key === "s" || key === "d" || key === " ") {
      this.keysPressed.delete(key);
      if (this.props.debug) {
        console.log(`Controls probe: ${key === " " ? "space" : key} released`, this.keysPressed);
      }
    }
  }

  private handleMouseDown(event: MouseEvent) {
    if (!this.props.useOrbitControls) return;
    this.mouseDown = true;
    if (this.props.debug) {
      console.log("Controls probe: Mouse down - orbit mode active");
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.props.useOrbitControls || !this.mouseDown) return;

    // Increased sensitivity and fixed directions
    const sensitivity = 0.006; // 3x faster than before (was 0.002)
    this.orbitYaw += event.movementX * sensitivity; // Positive for natural feel
    this.orbitPitch += event.movementY * -sensitivity; // Negative to invert Y (natural)

    // Constrain pitch to avoid flipping
    this.orbitPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.orbitPitch));

    this.updateOrbitCamera();

    if (this.props.debug) {
      console.log("Controls probe: Mouse move", { yaw: this.orbitYaw, pitch: this.orbitPitch });
    }
  }

  private handleMouseUp(event: MouseEvent) {
    if (!this.props.useOrbitControls) return;
    this.mouseDown = false;
    if (this.props.debug) {
      console.log("Controls probe: Mouse up - orbit mode inactive");
    }
  }

  private handleMouseWheel(event: WheelEvent) {
    if (!this.props.useOrbitControls) return;

    this.orbitDistance += event.deltaY * 0.01;
    this.orbitDistance = Math.max(1, Math.min(50, this.orbitDistance));

    this.updateOrbitCamera();

    if (this.props.debug) {
      console.log("Controls probe: Mouse wheel", { distance: this.orbitDistance });
    }
  }

  private calculateMovementVector(): { x: number; y: number; z: number } {
    let localX = 0; // Local left/right relative to camera
    let localZ = 0; // Local forward/back relative to camera
    let y = 0; // Up/down is always world-relative

    // WASD mapping in camera-local space:
    // W = forward (negative local Z), S = backward (positive local Z)
    // A = left (negative local X), D = right (positive local X)
    if (this.keysPressed.has("w")) localZ -= 1; // Forward
    if (this.keysPressed.has("s")) localZ += 1; // Backward
    if (this.keysPressed.has("a")) localX -= 1; // Left
    if (this.keysPressed.has("d")) localX += 1; // Right

    // Space = jump (+y) - always world-relative
    if (this.keysPressed.has(" ")) y += 1;

    // Normalize diagonal movement (only for local X and Z, not Y)
    if (localX !== 0 && localZ !== 0) {
      const length = Math.sqrt(localX * localX + localZ * localZ);
      localX /= length;
      localZ /= length;
    }

    // Get camera azimuth (yaw angle)
    let cameraAzimuth = 0;

    if (this.props.useOrbitControls) {
      // For orbit controls, use the stored yaw angle
      // Subtract π/2 to correct for coordinate system difference
      cameraAzimuth = this.orbitYaw - Math.PI / 2;
    } else {
      // For fixed camera, calculate azimuth from camera position relative to probe
      cameraAzimuth = this.calculateFixedCameraAzimuth();
    }

    // Rotate the local movement vector by the camera azimuth to get world coordinates
    const cos = Math.cos(cameraAzimuth);
    const sin = Math.sin(cameraAzimuth);

    const worldX = localX * cos - localZ * sin;
    const worldZ = localX * sin + localZ * cos;

    return { x: worldX, y, z: worldZ };
  }

  private calculateFixedCameraAzimuth(): number {
    if (!this.transformableElementGraphics) {
      return 0;
    }

    try {
      // Get probe position
      const worldMatrix = this.transformableElementGraphics.getWorldMatrix();
      const probePosition = {
        x: worldMatrix.data[12],
        y: worldMatrix.data[13],
        z: worldMatrix.data[14],
      };

      // Get graphics adapter
      const graphicsAdapter =
        this.getScene().getGraphicsAdapter() as unknown as ThreeJSGraphicsAdapter;
      const camera = graphicsAdapter.getCamera();

      // Calculate vector from probe to camera
      const cameraOffset = {
        x: camera.position.x - probePosition.x,
        z: camera.position.z - probePosition.z,
      };

      // Calculate azimuth angle (rotation around Y axis)
      // Subtract π/2 to align with our coordinate system where -Z is forward
      return Math.atan2(cameraOffset.x, cameraOffset.z) - Math.PI / 2;
    } catch (error) {
      if (this.props.debug) {
        console.warn("Failed to calculate fixed camera azimuth:", error);
      }
      return 0;
    }
  }

  private emitMovement() {
    const movementVector = this.calculateMovementVector();

    //console.log("Controls probe emitMovement", movementVector);

    // Only emit if there's actually movement or if we want to emit zero vectors too
    if (
      movementVector.x !== 0 ||
      movementVector.y !== 0 ||
      movementVector.z !== 0 ||
      this.keysPressed.size === 0
    ) {
      this.dispatchEvent(
        new CustomEvent(controlsProbeMovementEventName, {
          detail: {
            movement: movementVector,
            keysPressed: Array.from(this.keysPressed),
          },
        }),
      );

      if (this.props.debug) {
        console.log(
          "Controls probe movement:",
          movementVector,
          "Keys:",
          Array.from(this.keysPressed),
        );
      }
    }
  }

  public connectedCallback(): void {
    super.connectedCallback();

    // Add event listeners to the document for global key capture
    document.addEventListener("keydown", this.boundKeyDownHandler);
    document.addEventListener("keyup", this.boundKeyUpHandler);

    // Add mouse event listeners for orbit controls
    if (this.props.useOrbitControls) {
      document.addEventListener("mousedown", this.boundMouseDownHandler);
      document.addEventListener("mousemove", this.boundMouseMoveHandler);
      document.addEventListener("mouseup", this.boundMouseUpHandler);
      document.addEventListener("wheel", this.boundMouseWheelHandler);
    }

    for (const name of ControlProbe.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.startEmitting();

    // Set initial camera when connected
    setTimeout(() => {
      if (this.props.useOrbitControls) {
        this.updateOrbitCamera();
      } else {
        this.updateThirdPersonCamera();
      }
    }, 100); // Small delay to ensure graphics are initialized
  }

  public disconnectedCallback(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Remove event listeners
    document.removeEventListener("keydown", this.boundKeyDownHandler);
    document.removeEventListener("keyup", this.boundKeyUpHandler);

    // Remove mouse event listeners
    if (this.props.useOrbitControls) {
      document.removeEventListener("mousedown", this.boundMouseDownHandler);
      document.removeEventListener("mousemove", this.boundMouseMoveHandler);
      document.removeEventListener("mouseup", this.boundMouseUpHandler);
      document.removeEventListener("wheel", this.boundMouseWheelHandler);
    }

    // Clear pressed keys
    this.keysPressed.clear();

    super.disconnectedCallback();
  }

  private startEmitting() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.emitMovement();
    }, this.props.intervalMs);
  }
}
