import { AttributeHandler, MElement, MMLScene, Ray } from "@mml-io/mml-web";
import * as THREE from "three";

import {
  GamepadState,
  UniversalInputState,
  XBOX_GAMEPAD_MAPPING,
  GAMEPAD_MEANINGFUL_BUTTON_MAPPING,
} from "../control-manager/ControlTypes";
import { GameThreeJSAdapter } from "../GameThreeJSAdapter";

// Gamepad Manager (adapted from upstream)
export class GamepadManager {
  private static instance: GamepadManager | null = null;
  private gamepads = new Map<number, GamepadState>();
  private activeGamepadId: number | null = null;
  private lastInputTime = new Map<number, number>();
  private isPolling = false;
  private pollInterval: number | null = null;
  private deadzone = 0.1;

  private debug = false;

  private constructor() {
    this.setupEventListeners();
  }

  public static getInstance(): GamepadManager {
    if (!GamepadManager.instance) {
      GamepadManager.instance = new GamepadManager();
    }
    return GamepadManager.instance;
  }

  private setupEventListeners(): void {
    // Listen for gamepad connections
    window.addEventListener("gamepadconnected", (event: GamepadEvent) => {
      const gamepad = event.gamepad;
      if (this.debug) {
        console.log(
          `Gamepad connected: ${gamepad.id} (${gamepad.buttons.length} buttons, ${gamepad.axes.length} axes, mapping: "${gamepad.mapping}")`,
        );
      }

      this.gamepads.set(gamepad.index, {
        id: gamepad.index,
        connected: true,
        axes: new Array(gamepad.axes.length).fill(0),
        buttons: new Array(gamepad.buttons.length).fill(false),
        timestamp: Date.now(),
        mapping: gamepad.mapping,
      });

      // If this is the first gamepad, make it active
      if (this.activeGamepadId === null) {
        this.activeGamepadId = gamepad.index;
      }

      this.startPolling();
    });

    // Listen for gamepad disconnections
    window.addEventListener("gamepaddisconnected", (event: GamepadEvent) => {
      const gamepad = event.gamepad;
      if (this.debug) {
        console.log(`Gamepad disconnected: ${gamepad.id}`);
      }

      this.gamepads.delete(gamepad.index);
      this.lastInputTime.delete(gamepad.index);

      // If the active gamepad was disconnected, switch to another one
      if (this.activeGamepadId === gamepad.index) {
        this.activeGamepadId = this.getFirstConnectedGamepadId();
      }

      // Stop polling if no gamepads are connected
      if (this.gamepads.size === 0) {
        this.stopPolling();
      }
    });
  }

  private startPolling(): void {
    if (this.isPolling) return;

    this.isPolling = true;
    this.pollInterval = window.setInterval(() => {
      this.pollGamepads();
    }, 16); // ~60fps
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  private pollGamepads(): void {
    const gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) continue;

      const state = this.gamepads.get(gamepad.index);
      if (!state) continue;

      // Update axes with deadzone
      const newAxes = gamepad.axes.map((axis) => {
        return Math.abs(axis) < this.deadzone ? 0 : axis;
      });

      // Update buttons
      const newButtons = gamepad.buttons.map((button) => button.value);

      // Check if there was any input
      const hasInput = this.hasInputChanged(state, newAxes, newButtons);

      if (hasInput) {
        this.lastInputTime.set(gamepad.index, Date.now());

        // If this gamepad received input, make it the active one
        if (this.activeGamepadId !== gamepad.index) {
          this.activeGamepadId = gamepad.index;
          if (this.debug) {
            console.log(`Switched to gamepad ${gamepad.index} (${gamepad.id})`);
          }
        }

        // Update state
        state.axes = newAxes;
        state.buttons = newButtons;
        state.timestamp = Date.now();

        // Process axes with Y-axis flipping for intuitive coordinates
        this.processGamepadAxes(gamepad.index, state);

        // Dispatch events for the active gamepad
        this.dispatchGamepadEvents(gamepad.index, state);
      }
    }
  }

  private processGamepadAxes(gamepadId: number, state: GamepadState): void {
    // Detect the actual axis layout based on gamepad mapping and available axes
    const leftStickX = 0,
      leftStickY = 1;
    let rightStickX = 2,
      rightStickY = 3;
    void leftStickX;
    void leftStickY;

    // If the gamepad doesn't follow standard mapping, try to detect the layout
    if (state.mapping !== "standard" && state.axes.length >= 5) {
      // For non-standard gamepads, the right stick might be at different indices
      if (state.axes.length >= 5) {
        rightStickX = 3;
        rightStickY = 4;
        void rightStickX;
      }
    }

    // Store ALL available axes in processedAxes (with Y-axis flipping for intuitive coordinates)
    state.processedAxes = [...state.axes]; // Copy all raw axes first

    // Apply Y-axis flipping for intuitive coordinates (+Y = up, -Y = down)
    // Flip left stick Y-axis
    if (state.processedAxes[leftStickY] !== undefined) {
      state.processedAxes[leftStickY] = -state.processedAxes[leftStickY];
    }
    // Flip right stick Y-axis
    if (state.processedAxes[rightStickY] !== undefined) {
      state.processedAxes[rightStickY] = -state.processedAxes[rightStickY];
    }
  }

  private hasInputChanged(state: GamepadState, newAxes: number[], newButtons: number[]): boolean {
    const axisThreshold = 0.01;
    for (let i = 0; i < Math.min(state.axes.length, newAxes.length); i++) {
      if (Math.abs(state.axes[i] - newAxes[i]) > axisThreshold) {
        return true;
      }
    }

    const buttonThreshold = 0.01;
    for (let i = 0; i < Math.min(state.buttons.length, newButtons.length); i++) {
      if (Math.abs(state.buttons[i] - newButtons[i]) > buttonThreshold) {
        return true;
      }
    }

    return false;
  }

  private dispatchGamepadEvents(gamepadId: number, state: GamepadState): void {
    // Dispatch axis events
    this.dispatchAxisEvents(gamepadId, state);

    // Dispatch button events
    this.dispatchButtonEvents(gamepadId, state);
  }

  private dispatchAxisEvents(gamepadId: number, state: GamepadState): void {
    // Detect the actual axis layout based on gamepad mapping and available axes
    const leftStickX = 0,
      leftStickY = 1;
    let rightStickX = 2,
      rightStickY = 3;

    // If the gamepad doesn't follow standard mapping, try to detect the layout
    if (state.mapping !== "standard" && state.axes.length >= 5) {
      if (state.axes.length >= 5) {
        rightStickX = 3;
        rightStickY = 4;
      }
    }

    // Left stick - flip Y-axis for intuitive coordinates (+Y = up, -Y = down)
    const leftStick = {
      x: state.axes[leftStickX] || 0,
      y: -(state.axes[leftStickY] || 0), // Flip Y-axis
    };

    // Right stick - flip Y-axis for intuitive coordinates (+Y = up, -Y = down)
    const rightStick = {
      x: state.axes[rightStickX] || 0,
      y: -(state.axes[rightStickY] || 0), // Flip Y-axis
    };

    // Dispatch events for standard axes (0,1,2,3) for compatibility
    this.dispatchAxisEvent(gamepadId, 0, leftStick.x);
    this.dispatchAxisEvent(gamepadId, 1, leftStick.y);
    this.dispatchAxisEvent(gamepadId, 2, rightStick.x);
    this.dispatchAxisEvent(gamepadId, 3, rightStick.y);
  }

  private dispatchButtonEvents(gamepadId: number, state: GamepadState): void {
    // Check each button
    Object.entries(XBOX_GAMEPAD_MAPPING.buttons).forEach(([, buttonIndex]) => {
      const isPressed = state.buttons[buttonIndex] || 0;
      this.dispatchButtonEvent(gamepadId, buttonIndex, isPressed);
    });
  }

  private dispatchAxisEvent(gamepadId: number, axisIndex: number, value: number): void {
    const event = new CustomEvent("gamepad-axis", {
      detail: {
        gamepadId,
        axisIndex,
        value,
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(event);
  }

  private dispatchButtonEvent(gamepadId: number, buttonIndex: number, value: number): void {
    const event = new CustomEvent("gamepad-button", {
      detail: {
        gamepadId,
        buttonIndex,
        value,
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(event);
  }

  public getActiveGamepadId(): number | null {
    return this.activeGamepadId;
  }

  public getActiveGamepadState(): GamepadState | null {
    if (this.activeGamepadId === null) return null;
    return this.gamepads.get(this.activeGamepadId) || null;
  }

  public getConnectedGamepads(): GamepadState[] {
    return Array.from(this.gamepads.values()).filter((gp) => gp.connected);
  }

  private getFirstConnectedGamepadId(): number | null {
    const connected = this.getConnectedGamepads();
    return connected.length > 0 ? connected[0].id : null;
  }

  public setDeadzone(deadzone: number): void {
    this.deadzone = Math.max(0, Math.min(1, deadzone));
  }

  public destroy(): void {
    this.stopPolling();
    this.gamepads.clear();
    this.lastInputTime.clear();
    this.activeGamepadId = null;
  }
}

// Device detection
export const isMobileDevice = (): boolean => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
};

export class MouseManager {
  private mouseEventListeners = new Map<string, (event: MouseEvent) => void>();
  public lastMouseClientX = 0;
  public lastMouseClientY = 0;
  private listenedInputs = new Set<string>();
  private dispatchMouseEvent: (key: string, value: number) => void;

  constructor(dispatchMouseEvent: (key: string, value: number) => void) {
    this.dispatchMouseEvent = dispatchMouseEvent;
    this.setupMouseHandlers();
  }

  public updateMouseInputs(inputs: string[]): void {
    for (const input of inputs) {
      if (this.listenedInputs.has(input) || !input.startsWith("mouse")) {
        return;
      }
      this.listenedInputs.add(input);
    }
  }

  private setupMouseHandlers(): void {
    const onMouseMove = (event: MouseEvent) => {
      this.lastMouseClientX = event.clientX;
      this.lastMouseClientY = event.clientY;
    };
    
    const onMouseDown = (event: MouseEvent) => {
      console.log("mousedown", event.button);
      if (event.button === 0) {
        this.dispatchMouseEvent("mouseleft", 1.0);
      } else if (event.button === 1) {
        this.dispatchMouseEvent("mousemiddle", 1.0);
      } else if (event.button === 2) {
        this.dispatchMouseEvent("mouseright", 1.0);
      }
    };

    const onMouseUp = (event: MouseEvent) => {
      console.log("mouseup", event.button);
      if (event.button === 0) {
        this.dispatchMouseEvent("mouseleft", 0.0);
      } else if (event.button === 1) {
        this.dispatchMouseEvent("mousemiddle", 0.0);
      } else if (event.button === 2) {
        this.dispatchMouseEvent("mouseright", 0.0);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);

    this.mouseEventListeners.set("mousemove", onMouseMove);
    this.mouseEventListeners.set("mousedown", onMouseDown);
    this.mouseEventListeners.set("mouseup", onMouseUp);
  }

  public destroy(): void {
    this.mouseEventListeners.forEach((listener, type) => {
      if (type === "mousemove") {
        document.removeEventListener("mousemove", listener);
      }
    });
    this.mouseEventListeners.clear();
  }
}

// Universal mapping system
export class UniversalInputMapper {
  private static instance: UniversalInputMapper | null = null;
  private activeInputs = new Map<string, number>();
  private activeGamepadAxes = new Map<number, number>();
  private activeGamepadButtons = new Map<number, number>();
  // Virtual controls are now handled by ControlManager
  private inputState: UniversalInputState = {
    axes: new Array(4).fill(0),
    buttons: new Array(16).fill(false),
  };
  private gamepadEventListeners = new Map<string, (event: CustomEvent) => void>();
  private keyboardEventListeners = new Map<string, (event: KeyboardEvent) => void>();
  private debug = false;

  private constructor() {
    this.setupKeyboardHandlers();
    this.setupGamepadHandlers();
  }

  public static getInstance(): UniversalInputMapper {
    if (!UniversalInputMapper.instance) {
      UniversalInputMapper.instance = new UniversalInputMapper();
    }
    return UniversalInputMapper.instance;
  }

  private setupKeyboardHandlers(): void {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      console.log("keydown", key);
      this.activeInputs.set(key, 1.0);
      this.updateKeyboardState();
    };

    document.addEventListener("keydown", onKeyDown);

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      console.log("keyup", key);
      this.activeInputs.delete(key);
      this.updateKeyboardState();
    };

    document.addEventListener("keyup", onKeyUp);

    this.keyboardEventListeners.set("keydown", onKeyDown);
    this.keyboardEventListeners.set("keyup", onKeyUp);
  }

  private setupGamepadHandlers(): void {
    const axisListener = (event: CustomEvent) => {
      const { axisIndex, value } = event.detail;
      if (axisIndex >= 0 && axisIndex < this.inputState.axes.length) {
        this.inputState.axes[axisIndex] = value;
        this.activeGamepadAxes.set(axisIndex, value);
      }
    };

    const buttonListener = (event: CustomEvent) => {
      const { buttonIndex, value } = event.detail;
      if (buttonIndex >= 0 && buttonIndex < this.inputState.buttons.length) {
        this.inputState.buttons[buttonIndex] = value;
        this.activeGamepadButtons.set(buttonIndex, value);
      }
    };

    window.addEventListener("gamepad-axis", axisListener);
    window.addEventListener("gamepad-button", buttonListener);

    this.gamepadEventListeners.set("axis", axisListener);
    this.gamepadEventListeners.set("button", buttonListener);
  }

  private updateKeyboardState(normalized?: boolean): void {
    let leftX = 0,
      leftY = 0;
    if (this.activeInputs.has("a")) leftX -= 1;
    if (this.activeInputs.has("d")) leftX += 1;
    if (this.activeInputs.has("w")) leftY += 1;
    if (this.activeInputs.has("s")) leftY -= 1;

    if (normalized === true) {
      if (leftX !== 0 && leftY !== 0) {
        const magnitude = Math.sqrt(leftX * leftX + leftY * leftY);
        leftX /= magnitude;
        leftY /= magnitude;
      }
    }

    this.inputState.axes[0] = leftX;
    this.inputState.axes[1] = leftY;

    // TODO: have these properly mapped like done before in the MML repo implementation
    let rightX = 0,
      rightY = 0;
    if (this.activeInputs.has("arrowleft")) rightX -= 1;
    if (this.activeInputs.has("arrowright")) rightX += 1;
    if (this.activeInputs.has("arrowup")) rightY += 1;
    if (this.activeInputs.has("arrowdown")) rightY -= 1;

    if (normalized === true) {
      if (rightX !== 0 && rightY !== 0) {
        const magnitude = Math.sqrt(rightX * rightX + rightY * rightY);
        rightX /= magnitude;
        rightY /= magnitude;
      }
    }

    this.inputState.axes[2] = rightX;
    this.inputState.axes[3] = rightY;

    // TODO: have these properly mapped like done before in the MML repo implementation
    this.inputState.buttons[0] = this.activeInputs.get(" ") || 0; // Space = primary button
    this.inputState.buttons[1] = this.activeInputs.get("shift") || 0; // Shift = secondary button
    this.inputState.buttons[2] = this.activeInputs.get("control") || 0; // Ctrl = tertiary button
    this.inputState.buttons[3] = this.activeInputs.get("alt") || 0; // Alt = quaternary button
  }

  public getInputState(inputs?: string[]): UniversalInputState {
    // if inputs are provided
    if (inputs) {
      let buttonValue = 0;

      // process keyboard/mouse inputs
      inputs.forEach((input) => {        
        const newValue = this.activeInputs.get(input) || 0;
        if (newValue > buttonValue) {
          buttonValue = newValue;
        }
      });

      // process gamepad inputs
      inputs.forEach((input) => {
        const buttonIndex = GAMEPAD_MEANINGFUL_BUTTON_MAPPING[input as keyof typeof GAMEPAD_MEANINGFUL_BUTTON_MAPPING];
        if (buttonIndex !== undefined) {
          const newValue = this.inputState.buttons[buttonIndex] || 0;
          // only accept new inputs if they contribute more to the value
          if (newValue > buttonValue) {
            buttonValue = newValue;
          }
        }
      });
      this.inputState.axes = [];
      this.inputState.buttons = [buttonValue];
    }

    return { ...this.inputState };
  }

  // Virtual control creation methods removed - now handled by ControlManager

  public destroy(): void {
    this.gamepadEventListeners.forEach((listener, type) => {
      if (type === "axis") {
        window.removeEventListener("gamepad-axis", listener);
      } else if (type === "button") {
        window.removeEventListener("gamepad-button", listener);
      }
    });
    this.gamepadEventListeners.clear();


    this.keyboardEventListeners.forEach((listener, type) => {
      if (type === "keydown") {
        document.removeEventListener("keydown", listener);
      } else if (type === "keyup") {
        document.removeEventListener("keyup", listener);
      }
    });
    this.keyboardEventListeners.clear();
    // Virtual controls cleanup now handled by ControlManager
  }
}
export type MControlProps = {
  type: "axis" | "button" | "swipe";
  axis?: string; // comma separated axis indices ("0,1" for both X and Y)
  button?: string; // button index ("0" for primary button)
  hint?: string; // optional hint text for UI
  debug?: boolean;
  input?: string,
  "raycast-distance"?: string;
  "raycast-type"?: string;
};

export type InputEventDetail = {
  value: { x: number; y: number } | number | boolean;
  ray?: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; distance: number };
};

export class ControlGraphics {
  private static DebugGeometry = new THREE.SphereGeometry(1, 16, 16, 1);
  private static DebugMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
    transparent: true,
    opacity: 0.3,
  });

  private debug = false;
  private debugMesh: THREE.Mesh | null = null;

  constructor(private control: MControl<GameThreeJSAdapter>) {
    if (this.debug) {
      console.log("ControlGraphics created for:", control.id);
    }
  }

  setDebug(debug: boolean, _props: MControlProps) {
    void _props;
    this.updateDebugVisualisation();
  }

  setHint(hint: string, _props: MControlProps) {
    void _props;
    // TODO: implement hint functionality
  }

  setType(type: "axis" | "button", _props: MControlProps) {
    void _props;
    // TODO: implement type-specific behavior
  }

  setAxis(axis: string | undefined, _props: MControlProps) {
    void _props;
    // TODO: implement axis extra configs?
  }

  setButton(button: string | undefined, _props: MControlProps) {
    void _props;
    // TODO: implement button extra configs?
  }

  private clearDebugVisualisation() {
    if (this.debugMesh) {
      this.debugMesh.removeFromParent();
      this.debugMesh = null;
    }
  }

  private updateDebugVisualisation() {
    if (!this.control.props.debug) {
      this.clearDebugVisualisation();
    } else {
      if (this.control.isConnected && !this.debugMesh) {
        const mesh = new THREE.Mesh(ControlGraphics.DebugGeometry, ControlGraphics.DebugMaterial);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.debugMesh = mesh;
        this.control.getContainer().add(this.debugMesh);
      }

      if (this.debugMesh) {
        this.debugMesh.scale.set(1, 1, 1);
      }
    }
  }

  public computeRay({
    mode,
    clientX,
    clientY,
    distance,
  }: {
    mode: "camera" | "cursor",
    clientX?: number,
    clientY?: number,
    distance?: number,
  }): { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; distance: number } | null {
    const graphicsAdapter = this.control.scene.getGraphicsAdapter();
    const camera = graphicsAdapter.getCamera();

    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();

    if (mode === "cursor") {
      let x = 0;
      let y = 0;
      const raycaster = new THREE.Raycaster();
      const v2 = new THREE.Vector2();

      let width = window.innerWidth;
      let height = window.innerHeight;
      const canvas = graphicsAdapter.getCanvasElement();
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        width = rect.width || canvas.width;
        height = rect.height || canvas.height;
        const cx = clientX;
        const cy = clientY;
        x = ((cx - rect.left) / width) * 2 - 1;
        y = -(((cy - rect.top) / height) * 2 - 1);
      }
      v2.set(x, y);
      raycaster.setFromCamera(v2, camera);
      origin.copy(raycaster.ray.origin);
      dir.copy(raycaster.ray.direction).normalize();
    } else {
      origin.copy(camera.position);
      camera.getWorldDirection(dir);
      dir.normalize();
    }

    const maxDistance = distance ?? (Number(camera.far) || 1000);
    let rayDistance = maxDistance;
    const collisionsManager = graphicsAdapter.getCollisionsManager();
    const ray = new Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = collisionsManager.raycastFirst(ray, maxDistance);
    if (hit) {
      const hitDistance = hit[0];
      if (isFinite(hitDistance)) {
        rayDistance = Math.min(hitDistance, maxDistance);
      }
    }

    return {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: dir.x, y: dir.y, z: dir.z },
      distance: rayDistance,
    };
  }

  dispose() {
    this.clearDebugVisualisation();

    this.control.stopInputPolling();

    const graphicsAdapter = this.control.scene.getGraphicsAdapter();
    graphicsAdapter.unregisterControl(this.control);
  }
}

export class MControl<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-control";

  public controlGraphics: ControlGraphics | null = null;
  private inputMapper = UniversalInputMapper.getInstance();
  private animationFrameId: number | null = null;
  public scene: MMLScene<GameThreeJSAdapter>;
  public mouseManager: MouseManager | null = null;

  // Mouse input state
  private mouseAxisValues: { x: number; y: number } = { x: 0, y: 0 };
  private mouseListenerCleanup: (() => void) | null = null;

  public props: MControlProps = {
    type: "axis",
    axis: "0,1",
    button: "0",
    hint: "",
    debug: false,
    input: undefined,
    "raycast-distance": undefined,
    "raycast-type": undefined,
  };

  private static attributeHandler = new AttributeHandler<MControl<GameThreeJSAdapter>>({
    type: (instance, newValue) => {
      instance.props.type = (newValue as "axis" | "button") || "axis";
      instance.controlGraphics?.setType(instance.props.type, instance.props);
    },
    axis: (instance, newValue) => {
      instance.props.axis = newValue || undefined;
      instance.controlGraphics?.setAxis(instance.props.axis, instance.props);
    },
    button: (instance, newValue) => {
      instance.props.button = newValue || undefined;
      instance.controlGraphics?.setButton(instance.props.button, instance.props);
    },
    hint: (instance, newValue) => {
      instance.props.hint = newValue || "";
      instance.controlGraphics?.setHint(instance.props.hint, instance.props);
    },
    debug: (instance, newValue) => {
      instance.props.debug = newValue !== null ? newValue === "true" : false;
      instance.controlGraphics?.setDebug(instance.props.debug, instance.props);
    },
    input: (instance, newValue) => {
      instance.props.input = newValue || undefined;
    },
    "raycast-distance": (instance, newValue) => {
      instance.props["raycast-distance"] = newValue || undefined;
    },
    "raycast-type": (instance, newValue) => {
      instance.props["raycast-type"] = newValue || undefined;
    },
  });

  public readonly isControl = true;

  public static isControl(element: object): element is MControl<any> {
    return (element as MControl<any>).isControl;
  }

  protected enable() {
    // no-op for control elements
  }

  protected disable() {
    // no-op for control elements
  }

  static get observedAttributes(): Array<string> {
    return [...MControl.attributeHandler.getAttributes()];
  }

  constructor() {
    super();
  }

  public getContentBounds(): null {
    return null; // Control elements don't have content bounds
  }

  public parentTransformed(): void {
    // no-op for control elements
  }

  public isClickable(): boolean {
    return false; // Control elements are not clickable
  }

  private dispatchMouseEvent(key: string, value: number): void {
    // check if the key is listened to
    const inputs = this.getInputs();
    if (!inputs.includes(key)) {
      return;
    }

    this.dispatchInputEvent({
      value,
    });
  }


  public dispatchInputEvent(data: InputEventDetail) {
    console.log("dispatchInputEvent", data);
    if (this.shouldAddRayToEvent()) {
      data.ray = this.getRay();
    }

    const event = new CustomEvent("input", {
      detail: data,
    });
    this.dispatchEvent(event);
  }

  private shouldAddRayToEvent(): boolean {
    return this.props["raycast-type"] !== "none";
  }
  
  private getRay():
  | { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; distance: number }
  | null {
  if (this.props["raycast-type"] === "camera") {
    return this.controlGraphics?.computeRay({ mode: "camera", distance: Number(this.props["raycast-distance"]) });
  }
  if (this.props["raycast-type"] === "cursor") {
    return this.controlGraphics?.computeRay({ mode: "cursor", distance: Number(this.props["raycast-distance"]),clientX: this.mouseManager.lastMouseClientX, clientY: this.mouseManager.lastMouseClientY });
  }
  return null;
};

  /**
   * Setup or cleanup mouse input based on enableMouse prop
   */
  private updateMouseInput(): void {
    // Cleanup existing mouse listener if any
    if (this.mouseListenerCleanup) {
      this.mouseListenerCleanup();
      this.mouseListenerCleanup = null;
      this.mouseAxisValues = { x: 0, y: 0 };
    }

    // Only setup mouse input if enabled, on desktop, and for axis controls
    if (!this.props.enableMouse || isMobileDevice() || this.props.type !== "axis") {
      return;
    }

    // Only setup if we're already connected (have scene)
    if (this.scene && this.scene.hasGraphicsAdapter()) {
      this.setupMouseInput();
    }
  }

  /**
   * Setup mouse input tracking
   */
  private setupMouseInput(): void {
    if (!this.scene) return;

    const graphicsAdapter = this.scene.getGraphicsAdapter();
    if (!graphicsAdapter || !("getCanvasElement" in graphicsAdapter)) {
      return;
    }

    const canvas = (graphicsAdapter as any).getCanvasElement();
    if (!canvas) return;

    // Enable pointer events on canvas for mouse input
    canvas.style.pointerEvents = "auto";

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Get mouse position relative to canvas
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Convert to normalized coordinates (-1 to 1) relative to center
      this.mouseAxisValues.x = (mouseX - centerX) / centerX;
      this.mouseAxisValues.y = -(mouseY - centerY) / centerY; // Invert Y for intuitive up/down

      // Clamp to -1, 1 range
      this.mouseAxisValues.x = Math.max(-1, Math.min(1, this.mouseAxisValues.x));
      this.mouseAxisValues.y = Math.max(-1, Math.min(1, this.mouseAxisValues.y));
    };

    canvas.addEventListener("mousemove", handleMouseMove);

    // Store cleanup function
    this.mouseListenerCleanup = () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      // Reset pointer events when cleaning up
      canvas.style.pointerEvents = "none";
    };
  }

  /**
   * Start input polling for axis and button controls.
   * This is needed because virtual controls update inputState and expect polling.
   * Swipe controls call dispatchInputEvent directly.
   */
  public startInputPolling(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Only poll for axis and button controls, not swipe
    if (this.props.type === "swipe") {
      return;
    }

    const pollInput = () => {
      const inputState = this.inputMapper.getInputState(this.getInputs());
      this.processInput(inputState);
      this.animationFrameId = requestAnimationFrame(pollInput);
    };

    this.animationFrameId = requestAnimationFrame(pollInput);
  }

  // process the input string as a space separated list of keys
   getInputs(): string[] {
    return this.props.input?.split(" ") || [];
  }

  /**
   * Stop input polling
   */
  public stopInputPolling(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Cleanup mouse input
    if (this.mouseListenerCleanup) {
      this.mouseListenerCleanup();
      this.mouseListenerCleanup = null;
    }
  }

  private previousInputState: UniversalInputState | null = null;

  private hasInputChanged(inputState: UniversalInputState): boolean {
    // compare values of all axes and buttons. if the size has changed, return true. if the values have changed by more than 0.01, return true.
    if (inputState.axes.length !== this.previousInputState?.axes.length || inputState.buttons.length !== this.previousInputState?.buttons.length) {
      return true;
    }
    const axisThreshold = 0.01;
    for (let i = 0; i < inputState.axes.length; i++) {
      if (Math.abs(inputState.axes[i] - this.previousInputState?.axes[i] || 0) > axisThreshold) {
        return true;
      }
    }
    const buttonThreshold = 0.01;
    for (let i = 0; i < inputState.buttons.length; i++) {
      if (Math.abs(inputState.buttons[i] - this.previousInputState?.buttons[i] || 0) > buttonThreshold) {
        return true;
      }
    }
    return false;
  }

  /**
   * Process input from the inputState and dispatch events to game logic
   */
  private processInput(inputState: UniversalInputState): void {
    if (!this.hasInputChanged(inputState)) {
      return;
    }
    this.previousInputState = inputState;
    
    if (this.props.type === "axis" && this.props.axis) {
      const axisIndices = this.props.axis.split(",").map((s) => parseInt(s.trim()));

      if (axisIndices.length === 1) {
        // single axis (val)
        const value = inputState.axes[axisIndices[0]] || 0;
        this.dispatchInputEvent({ value });
      } else if (axisIndices.length >= 2) {
        // multi-axis (vector)
        const vector = {
          x: inputState.axes[axisIndices[0]] || 0,
          y: inputState.axes[axisIndices[1]] || 0,
        };
        this.dispatchInputEvent({ value: vector });
      }
    } else if (this.props.type === "button" && (this.props.button || this.props.input)) {
      let value = 0;
      if (this.props.button) {
      const buttonIndex = parseInt(this.props.button);
      value = inputState.buttons[buttonIndex] || 0;
      } else {
        // when input is provided, we use the first button to store the value
        value = inputState.buttons[0] || 0;
      }
      this.dispatchInputEvent({ value: value });
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
    if (!this.controlGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    MControl.attributeHandler.handle(this, name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();

    this.scene = this.getScene() as unknown as MMLScene<GameThreeJSAdapter>;

    if (!this.scene.hasGraphicsAdapter() || this.controlGraphics) {
      return;
    }

    this.controlGraphics = new ControlGraphics(this);
    this.mouseManager = new MouseManager(this.dispatchMouseEvent.bind(this));

    const graphicsAdapter = this.scene.getGraphicsAdapter();
    graphicsAdapter.registerControl(this);

    // Initialize attributes
    for (const name of MControl.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    // Setup mouse input if enabled (now that scene is available)
    this.updateMouseInput();

    // Start input polling AFTER attributes are initialized
    if (this.props.type === "axis" || this.props.type === "button") {
      this.startInputPolling();
    }
  }

  public disconnectedCallback(): void {
    this.stopInputPolling();
    this.controlGraphics?.dispose();
    this.controlGraphics = null;
    this.mouseManager?.destroy();
    this.mouseManager = null;
    super.disconnectedCallback();
  }
}