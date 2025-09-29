import { AttributeHandler, MElement, MMLScene } from "@mml-io/mml-web";
import * as THREE from "three";

import {
  GamepadState,
  UniversalInputState,
  XBOX_GAMEPAD_MAPPING,
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
      const newButtons = gamepad.buttons.map((button) => button.pressed);

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

  private hasInputChanged(state: GamepadState, newAxes: number[], newButtons: boolean[]): boolean {
    // Check if any axis changed significantly
    for (let i = 0; i < Math.min(state.axes.length, newAxes.length); i++) {
      if (Math.abs(state.axes[i] - newAxes[i]) > 0.01) {
        return true;
      }
    }

    for (let i = 0; i < Math.min(state.buttons.length, newButtons.length); i++) {
      if (state.buttons[i] !== newButtons[i]) {
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
      const isPressed = state.buttons[buttonIndex] || false;
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

  private dispatchButtonEvent(gamepadId: number, buttonIndex: number, pressed: boolean): void {
    const event = new CustomEvent("gamepad-button", {
      detail: {
        gamepadId,
        buttonIndex,
        pressed,
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

// Universal mapping system
export class UniversalInputMapper {
  private static instance: UniversalInputMapper | null = null;
  private pressedKeys = new Set<string>();
  // Virtual controls are now handled by ControlManager
  private inputState: UniversalInputState = {
    axes: new Array(4).fill(0),
    buttons: new Array(16).fill(false),
    connectionId: 1,
  };
  private gamepadManager = GamepadManager.getInstance();
  private gamepadEventListeners = new Map<string, () => void>();

  private debug = false;

  private constructor() {
    this.setupKeyboardHandlers();
    this.setupGamepadHandlers();
    if (isMobileDevice()) {
      this.setupMobileHandlers();
    }
  }

  public static getInstance(): UniversalInputMapper {
    if (!UniversalInputMapper.instance) {
      UniversalInputMapper.instance = new UniversalInputMapper();
    }
    return UniversalInputMapper.instance;
  }

  private setupKeyboardHandlers(): void {
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      this.pressedKeys.add(key);
      this.updateKeyboardState();
    });

    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      this.pressedKeys.delete(key);
      this.updateKeyboardState();
    });
  }

  private setupGamepadHandlers(): void {
    const axisListener = (event: CustomEvent) => {
      const { axisIndex, value } = event.detail;
      if (axisIndex >= 0 && axisIndex < this.inputState.axes.length) {
        this.inputState.axes[axisIndex] = value;
      }
    };

    const buttonListener = (event: CustomEvent) => {
      const { buttonIndex, pressed } = event.detail;
      if (buttonIndex >= 0 && buttonIndex < this.inputState.buttons.length) {
        this.inputState.buttons[buttonIndex] = pressed;
      }
    };

    window.addEventListener("gamepad-axis", axisListener as EventListener);
    window.addEventListener("gamepad-button", buttonListener as EventListener);

    this.gamepadEventListeners.set("axis", axisListener as any);
    this.gamepadEventListeners.set("button", buttonListener as any);
  }

  private setupMobileHandlers(): void {
    if (this.debug) {
      console.log(
        "Mobile device detected - virtual joysticks and buttons will be created as needed",
      );
    }
  }

  private updateKeyboardState(normalized?: boolean): void {
    let leftX = 0,
      leftY = 0;
    if (this.pressedKeys.has("a")) leftX -= 1;
    if (this.pressedKeys.has("d")) leftX += 1;
    if (this.pressedKeys.has("w")) leftY += 1;
    if (this.pressedKeys.has("s")) leftY -= 1;

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
    if (this.pressedKeys.has("arrowleft")) rightX -= 1;
    if (this.pressedKeys.has("arrowright")) rightX += 1;
    if (this.pressedKeys.has("arrowup")) rightY += 1;
    if (this.pressedKeys.has("arrowdown")) rightY -= 1;

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
    this.inputState.buttons[0] = this.pressedKeys.has(" "); // Space = primary button
    this.inputState.buttons[1] = this.pressedKeys.has("shift"); // Shift = secondary button
    this.inputState.buttons[2] = this.pressedKeys.has("control"); // Ctrl = tertiary button
    this.inputState.buttons[3] = this.pressedKeys.has("alt"); // Alt = quaternary button
  }

  public getInputState(): UniversalInputState {
    return { ...this.inputState };
  }

  // Virtual control creation methods removed - now handled by ControlManager

  public destroy(): void {
    this.gamepadEventListeners.forEach((listener, type) => {
      if (type === "axis") {
        window.removeEventListener("gamepad-axis", listener as EventListener);
      } else if (type === "button") {
        window.removeEventListener("gamepad-button", listener as EventListener);
      }
    });
    this.gamepadEventListeners.clear();

    // Virtual controls cleanup now handled by ControlManager
  }
}
export type MControlProps = {
  type: "axis" | "button" | "swipe";
  axis?: string; // comma separated axis indices ("0,1" for both X and Y)
  button?: string; // button index ("0" for primary button)
  hint?: string; // optional hint text for UI
  debug?: boolean;
};

export type InputEventDetail = {
  connectionId: number;
  value: { x: number; y: number } | number | boolean;
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

  dispose() {
    console.log("m-control dispose");
    this.clearDebugVisualisation();

    this.control.stopInputPolling();

    const graphicsAdapter = this.control.scene.getGraphicsAdapter();
    if (graphicsAdapter && "unregisterControl" in graphicsAdapter) {
      (graphicsAdapter as any).unregisterControl(this.control);
    }
  }
}

export class MControl<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-control";

  public controlGraphics: ControlGraphics | null = null;
  private inputMapper = UniversalInputMapper.getInstance();
  private animationFrameId: number | null = null;
  public scene: MMLScene<GameThreeJSAdapter>;

  public props: MControlProps = {
    type: "axis",
    axis: "0,1",
    button: "0",
    hint: "",
    debug: false,
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

  public dispatchInputEvent(connectionId: number, data: any) {
    const event = new CustomEvent("input", {
      detail: { connectionId, ...data },
    });
    this.dispatchEvent(event);
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
      const inputState = this.inputMapper.getInputState();
      this.processInput(inputState);
      this.animationFrameId = requestAnimationFrame(pollInput);
    };

    this.animationFrameId = requestAnimationFrame(pollInput);
  }

  /**
   * Stop input polling
   */
  public stopInputPolling(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Process input from the inputState and dispatch events to game logic
   */
  private processInput(inputState: UniversalInputState): void {
    if (this.props.type === "axis" && this.props.axis) {
      const axisIndices = this.props.axis.split(",").map((s) => parseInt(s.trim()));

      if (axisIndices.length === 1) {
        // single axis (val)
        const value = inputState.axes[axisIndices[0]] || 0;
        this.dispatchInputEvent(inputState.connectionId, { value });
      } else if (axisIndices.length >= 2) {
        // multi-axis (vector)
        const vector = {
          x: inputState.axes[axisIndices[0]] || 0,
          y: inputState.axes[axisIndices[1]] || 0,
        };
        this.dispatchInputEvent(inputState.connectionId, { value: vector });
      }
    } else if (this.props.type === "button" && this.props.button) {
      const buttonIndex = parseInt(this.props.button);
      const pressed = inputState.buttons[buttonIndex] || false;
      this.dispatchInputEvent(inputState.connectionId, { value: pressed });
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string) {
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

    const graphicsAdapter = this.scene.getGraphicsAdapter();
    if (graphicsAdapter && "registerControl" in graphicsAdapter) {
      (graphicsAdapter as any).registerControl(this);
    }

    // Initialize attributes
    for (const name of MControl.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }

  public disconnectedCallback(): void {
    this.stopInputPolling();
    this.controlGraphics?.dispose();
    this.controlGraphics = null;
    super.disconnectedCallback();
  }
}
