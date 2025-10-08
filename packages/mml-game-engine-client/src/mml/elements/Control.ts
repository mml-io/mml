import { AttributeHandler, MElement, MMLScene, Ray } from "@mml-io/mml-web";
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
  input?: string; // comma-separated input tokens e.g. "Keyboard_F, Key_G, Gamepad_DPad_Up, Mouse_LeftClick"
  hint?: string; // optional hint text for UI
  debug?: boolean;
  "raycast-distance"?: string; // how far to raycast from the source
  "raycast-type"?: string; // what type of raycast to use
};

export type InputEventDetail = {
  connectionId: number;
  value: { x: number; y: number } | number | boolean;
  action?: string;
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
  private mouseHandlersAttached = false;
  private boundMouseDown?: (e: MouseEvent) => void;
  private boundMouseUp?: (e: MouseEvent) => void;
  private boundClick?: (e: MouseEvent) => void;
  private boundContextMenu?: (e: MouseEvent) => void;
  private rayDistance: number | null = null;
  private raycastType: "camera" | "cursor" | "none" = "none";
  private keyboardHandlersAttached = false;
  private boundKeyDown?: (e: KeyboardEvent) => void;
  private boundMouseMove?: (e: MouseEvent) => void;
  private lastMouseClientX = 0;
  private lastMouseClientY = 0;
  private gamepadHandlersAttached = false;
  private boundGamepadButton?: (e: Event) => void;

  // Parsed input tokens
  private allowedKeyboardActions = new Set<string>(); // e.g. "Keyboard_F", "Keyboard_ArrowUp"
  private allowedMouseActions = new Set<string>(); // e.g. "Mouse_LeftClick"
  private allowedGamepadActions = new Set<string>(); // e.g. "Gamepad_A", "Gamepad_DPad_Up"

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

  setType(type: "axis" | "button" | "swipe", _props: MControlProps) {
    void type;
    // Type no longer controls mouse/keyboard listeners. See setInput.
  }

  setAxis(axis: string | undefined, _props: MControlProps) {
    void _props;
    // TODO: implement axis extra configs?
  }

  setButton(button: string | undefined, _props: MControlProps) {
    void _props;
    // TODO: implement button extra configs?
  }

  // Configure generic input tokens
  setInput(input: string | undefined, _props: MControlProps) {
    void _props;
    this.parseInputTokens(input);
    this.updateKeyboardHandlers();
    this.updateMouseHandlers();
    this.updateGamepadHandlers();
  }

  setRaycastDistance(distanceStr: string | undefined) {
    const d = distanceStr != null ? Number(distanceStr) : NaN;
    this.rayDistance = Number.isFinite(d) && d > 0 ? d : null;
  }

  setRaycastType(raycastType: string | undefined) {
    const t = (raycastType || "none").toLowerCase();
    this.raycastType = t === "camera" || t === "cursor" ? (t as any) : "none";
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

  private updateMouseHandlers() {
    const wantsMouse = Array.from(this.allowedMouseActions).length > 0;
    if (wantsMouse && !this.mouseHandlersAttached) {
      this.attachMouseHandlers();
    } else if (!wantsMouse && this.mouseHandlersAttached) {
      this.detachMouseHandlers();
    }
  }

  private updateKeyboardHandlers() {
    const wantsKeyboard = Array.from(this.allowedKeyboardActions).length > 0;
    if (wantsKeyboard && !this.keyboardHandlersAttached) {
      this.attachKeyboardHandlers();
    } else if (!wantsKeyboard && this.keyboardHandlersAttached) {
      this.detachKeyboardHandlers();
    }
  }

  private attachKeyboardHandlers() {
    if (this.keyboardHandlersAttached) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const action = this.keyboardEventToAction(e);
      if (!action) return;
      if (!this.allowedKeyboardActions.has(action)) return;

      const ray = this.getRayForCurrentType();
      e.preventDefault();
      const detail: any = { value: true, action };
      if (ray) detail.ray = ray;
      this.control.dispatchInputEvent(1, detail);
    };

    const onMouseMove = (e: MouseEvent) => {
      this.lastMouseClientX = e.clientX;
      this.lastMouseClientY = e.clientY;
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);

    this.boundKeyDown = onKeyDown;
    this.boundMouseMove = onMouseMove;
    this.keyboardHandlersAttached = true;
  }

  private detachKeyboardHandlers() {
    if (!this.keyboardHandlersAttached) return;
    if (this.boundKeyDown) document.removeEventListener("keydown", this.boundKeyDown);
    if (this.boundMouseMove) document.removeEventListener("mousemove", this.boundMouseMove);
    this.boundKeyDown = undefined;
    this.boundMouseMove = undefined;
    this.keyboardHandlersAttached = false;
  }

  private updateGamepadHandlers() {
    const wantsGamepad = Array.from(this.allowedGamepadActions).length > 0;
    if (wantsGamepad && !this.gamepadHandlersAttached) {
      this.attachGamepadHandlers();
    } else if (!wantsGamepad && this.gamepadHandlersAttached) {
      this.detachGamepadHandlers();
    }
  }

  private attachGamepadHandlers() {
    if (this.gamepadHandlersAttached) return;
    // Ensure gamepad manager is running
    GamepadManager.getInstance();

    const onGamepadButton = (e: Event) => {
      const evt = e as CustomEvent;
      const detail = (evt.detail || {}) as { gamepadId: number; buttonIndex: number; pressed: boolean };
      if (!detail || !detail.pressed) return;

      const token = this.gamepadButtonIndexToToken(detail.buttonIndex);
      if (!token) return;
      if (!this.allowedGamepadActions.has(token)) return;

      const ray = this.getRayForCurrentType();
      const data: any = { value: true, action: token };
      if (ray) data.ray = ray;
      this.control.dispatchInputEvent(1, data);
    };

    window.addEventListener("gamepad-button", onGamepadButton as EventListener);
    this.boundGamepadButton = onGamepadButton as any;
    this.gamepadHandlersAttached = true;
  }

  private detachGamepadHandlers() {
    if (!this.gamepadHandlersAttached) return;
    if (this.boundGamepadButton) {
      window.removeEventListener("gamepad-button", this.boundGamepadButton as EventListener);
    }
    this.boundGamepadButton = undefined;
    this.gamepadHandlersAttached = false;
  }

  private attachMouseHandlers() {
    if (this.mouseHandlersAttached) return;

    const onDown = (e: MouseEvent) => {
      const action = this.getActionFromMouseEvent(e, "down");
      if (action && this.allowedMouseActions.has(action)) {
        this.dispatchMouseAction(action, e);
      }
    };
    const onUp = (e: MouseEvent) => {
      const action = this.getActionFromMouseEvent(e, "up");
      if (action && this.allowedMouseActions.has(action)) {
        this.dispatchMouseAction(action, e);
      }
    };
    const onClick = (e: MouseEvent) => {
      const action = this.getActionFromMouseEvent(e, "click");
      if (action && this.allowedMouseActions.has(action)) {
        this.dispatchMouseAction(action, e);
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      // Treat as right click
      e.preventDefault();
      if (this.allowedMouseActions.has("Mouse_RightClick")) {
        this.dispatchMouseAction("Mouse_RightClick", e);
      }
    };

    // Attach to document to ensure we capture regardless of pointer-events on canvas
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("click", onClick);
    document.addEventListener("contextmenu", onContextMenu);

    this.boundMouseDown = onDown;
    this.boundMouseUp = onUp;
    this.boundClick = onClick;
    this.boundContextMenu = onContextMenu;
    this.mouseHandlersAttached = true;
  }

  private detachMouseHandlers() {
    if (!this.mouseHandlersAttached) return;  
    if (this.boundMouseDown) document.removeEventListener("mousedown", this.boundMouseDown);
    if (this.boundMouseUp) document.removeEventListener("mouseup", this.boundMouseUp);
    if (this.boundClick) document.removeEventListener("click", this.boundClick);
    if (this.boundContextMenu)
      document.removeEventListener("contextmenu", this.boundContextMenu);
    this.boundMouseDown = undefined;
    this.boundMouseUp = undefined;
    this.boundClick = undefined;
    this.boundContextMenu = undefined;
    this.mouseHandlersAttached = false;
  }

  private getActionFromMouseEvent(e: MouseEvent, phase: "down" | "up" | "click"): string | null {
    if (e.button === 0)
      return `Mouse_Left${phase === "click" ? "Click" : phase === "down" ? "Down" : "Up"}`;
    if (e.button === 2)
      return `Mouse_Right${phase === "click" ? "Click" : phase === "down" ? "Down" : "Up"}`;
    if (e.button === 1)
      return `Mouse_Middle${phase === "click" ? "Click" : "Down"}`; // MiddleUp not always reliable
    if (phase === "click" && e.button === 0) return "Mouse_LeftClick";
    return null;
  }

  private dispatchMouseAction(action: string, e: MouseEvent) {
    const graphicsAdapter = this.control.scene.getGraphicsAdapter();
    if (!graphicsAdapter || !("getCamera" in graphicsAdapter)) {
      return;
    }
    const detail: any = {
      value: /Down$/.test(action) || /Click$/.test(action),
      action,
    };
    if (this.raycastType !== "none") {
      const mode = this.raycastType === "cursor" ? "cursor" : "camera";
      const ray = this.computeRay(mode, e.clientX, e.clientY);
      if (ray) {
        detail.ray = ray;
      }
    }
    this.control.dispatchInputEvent(1, detail);
  }

  private computeRay(
    mode: "camera" | "cursor",
    clientX?: number,
    clientY?: number,
  ): { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; distance: number } | null {
    const graphicsAdapter = this.control.scene.getGraphicsAdapter();
    if (!graphicsAdapter || !("getCamera" in graphicsAdapter)) {
      return null;
    }
    const camera = (graphicsAdapter as any).getCamera() as THREE.PerspectiveCamera;

    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();

    if (mode === "cursor") {
      let x = 0;
      let y = 0;
      const raycaster = new THREE.Raycaster();
      const v2 = new THREE.Vector2();

      let width = window.innerWidth;
      let height = window.innerHeight;
      if ("getCanvasElement" in graphicsAdapter) {
        const canvas = (graphicsAdapter as any).getCanvasElement() as HTMLCanvasElement | undefined;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          width = rect.width || canvas.width;
          height = rect.height || canvas.height;
          const cx = clientX != null ? clientX : this.lastMouseClientX;
          const cy = clientY != null ? clientY : this.lastMouseClientY;
          x = ((cx - rect.left) / width) * 2 - 1;
          y = -(((cy - rect.top) / height) * 2 - 1);
        }
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

    const maxDistance = this.rayDistance ?? (Number((camera as any).far) || 1000);
    let distance = maxDistance;
    if ("getCollisionsManager" in graphicsAdapter) {
      const collisionsManager = (graphicsAdapter as any).getCollisionsManager();
      if (collisionsManager && typeof collisionsManager.raycastFirst === "function") {
        const ray = new Ray(
          { x: origin.x, y: origin.y, z: origin.z },
          { x: dir.x, y: dir.y, z: dir.z },
        );
        const hit = collisionsManager.raycastFirst(ray, maxDistance);
        if (hit) {
          const hitDistance = hit[0];
          if (typeof hitDistance === "number" && isFinite(hitDistance)) {
            distance = Math.min(hitDistance, maxDistance);
          }
        }
      }
    }

    return {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: dir.x, y: dir.y, z: dir.z },
      distance,
    };
  }

  public getRayForCurrentType():
    | { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; distance: number }
    | null {
    if (this.raycastType === "camera") {
      return this.computeRay("camera");
    }
    if (this.raycastType === "cursor") {
      return this.computeRay("cursor", this.lastMouseClientX, this.lastMouseClientY);
    }
    return null;
  }

  dispose() {
    this.clearDebugVisualisation();

    this.control.stopInputPolling();

    this.detachMouseHandlers();
    this.detachKeyboardHandlers();
    this.detachGamepadHandlers();

    const graphicsAdapter = this.control.scene.getGraphicsAdapter();
    if (graphicsAdapter && "unregisterControl" in graphicsAdapter) {
      (graphicsAdapter as any).unregisterControl(this.control);
    }
  }

  // Helpers: input parsing and normalization
  private parseInputTokens(input: string | undefined): void {
    this.allowedKeyboardActions.clear();
    this.allowedMouseActions.clear();
    this.allowedGamepadActions.clear();

    if (!input || !input.trim()) {
      return;
    }

    const tokens = input
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    for (const token of tokens) {
      if (/^Keyboard_/i.test(token)) {
        const normalized = this.normalizeKeyboardToken(token);
        if (normalized) this.allowedKeyboardActions.add(normalized);
      } else if (/^Key_/i.test(token)) {
        const normalized = this.normalizeKeyPrefixToken(token);
        if (normalized) this.allowedKeyboardActions.add(normalized);
      } else if (/^Mouse_/i.test(token)) {
        const normalized = this.normalizeMouseToken(token);
        if (normalized) this.allowedMouseActions.add(normalized);
      } else if (/^Gamepad_/i.test(token)) {
        const normalized = this.normalizeGamepadToken(token);
        if (normalized) this.allowedGamepadActions.add(normalized);
      }
    }

    this.applyDefaultGamepadMappingsIfMissing();
  }

  private normalizeKeyboardToken(token: string): string | null {
    const rest = token.substring("Keyboard_".length);
    if (!rest) return null;
    if (/^Key[A-Z]$/.test(rest)) {
      return `Keyboard_${rest.substring(3)}`;
    }
    return `Keyboard_${rest}`;
  }

  private normalizeKeyPrefixToken(token: string): string | null {
    const rest = token.substring("Key_".length);
    if (!rest) return null;
    return `Keyboard_${rest.toUpperCase()}`;
  }

  private normalizeMouseToken(token: string): string | null {
    const canonical = token
      .replace(/mouse_/i, "Mouse_")
      .replace(/left/i, "Left")
      .replace(/right/i, "Right")
      .replace(/middle/i, "Middle")
      .replace(/(click|down|up)$/i, (m) => m[0].toUpperCase() + m.slice(1).toLowerCase());
    return canonical;
  }

  private normalizeGamepadToken(token: string): string | null {
    let canonical = token.replace(/gamepad_/i, "Gamepad_");
    canonical = canonical.replace(/dpad_/i, "DPad_");
    // Ensure second part capitalization, e.g., Gamepad_DPad_Up
    canonical = canonical
      .split("_")
      .map((part, idx) => (idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join("_");
    return canonical;
  }

  private keyboardEventToAction(e: KeyboardEvent): string | null {
    const code = e.code || "";
    if (!code) return null;
    const m = code.match(/^Key([A-Z])$/);
    if (m) {
      return `Keyboard_${m[1]}`;
    }
    return `Keyboard_${code}`;
  }

  private gamepadButtonIndexToToken(index: number): string | null {
    const entries = Object.entries(XBOX_GAMEPAD_MAPPING.buttons);
    for (const [name, idx] of entries) {
      if (idx === index) {
        // Map names like DPadUp -> DPad_Up
        const mapped = name.startsWith("DPad")
          ? `Gamepad_DPad_${name.substring(4)}`
          : `Gamepad_${name}`;
        return mapped;
      }
    }
    return null;
  }

  private applyDefaultGamepadMappingsIfMissing(): void {
    if (this.allowedGamepadActions.size > 0) return;

    // Map common mouse/keyboard to gamepad defaults
    if (this.allowedMouseActions.has("Mouse_LeftClick") || this.allowedKeyboardActions.has("Keyboard_Space")) {
      this.allowedGamepadActions.add("Gamepad_A");
    }
    if (this.allowedMouseActions.has("Mouse_RightClick")) {
      this.allowedGamepadActions.add("Gamepad_B");
    }
    if (this.allowedKeyboardActions.has("Keyboard_ArrowUp")) {
      this.allowedGamepadActions.add("Gamepad_DPad_Up");
    }
    if (this.allowedKeyboardActions.has("Keyboard_ArrowDown")) {
      this.allowedGamepadActions.add("Gamepad_DPad_Down");
    }
    if (this.allowedKeyboardActions.has("Keyboard_ArrowLeft")) {
      this.allowedGamepadActions.add("Gamepad_DPad_Left");
    }
    if (this.allowedKeyboardActions.has("Keyboard_ArrowRight")) {
      this.allowedGamepadActions.add("Gamepad_DPad_Right");
    }
  }
}

export class MControl<G extends GameThreeJSAdapter> extends MElement<G> {
  static tagName = "m-control";

  public controlGraphics: ControlGraphics | null = null;
  private inputMapper = UniversalInputMapper.getInstance();
  private animationFrameId: number | null = null;
  public scene: MMLScene<GameThreeJSAdapter>;

  // Mouse input state
  private mouseAxisValues: { x: number; y: number } = { x: 0, y: 0 };
  private mouseListenerCleanup: (() => void) | null = null;

  public props: MControlProps = {
    type: "axis",
    axis: "0,1",
    button: "0",
    input: undefined,
    hint: "",
    debug: false,
    "raycast-distance": undefined,
    "raycast-type": undefined,
  };

  private static attributeHandler = new AttributeHandler<MControl<GameThreeJSAdapter>>({
    type: (instance, newValue) => {
      instance.props.type = (newValue as "axis" | "button" | "swipe") || "axis";
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
    input: (instance, newValue) => {
      instance.props.input = newValue || undefined;
      instance.controlGraphics?.setInput(instance.props.input, instance.props);
    },
    hint: (instance, newValue) => {
      instance.props.hint = newValue || "";
      instance.controlGraphics?.setHint(instance.props.hint, instance.props);
    },
    debug: (instance, newValue) => {
      instance.props.debug = newValue !== null ? newValue === "true" : false;
      instance.controlGraphics?.setDebug(instance.props.debug, instance.props);
    },
    "raycast-distance": (instance, newValue) => {
      instance.props["raycast-distance"] = newValue || undefined;
      instance.controlGraphics?.setRaycastDistance(instance.props["raycast-distance"]);
    },
    "raycast-type": (instance, newValue) => {
      instance.props["raycast-type"] = newValue || undefined;
      instance.controlGraphics?.setRaycastType(instance.props["raycast-type"]);
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

    // Only poll for axis and button controls when not using event-driven input tokens
    if (this.props.type === "swipe" || (this.props.input && this.props.input.length > 0)) {
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
    // Cleanup mouse input
    if (this.mouseListenerCleanup) {
      this.mouseListenerCleanup();
      this.mouseListenerCleanup = null;
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
        const detail: any = { value };
        const ray = this.controlGraphics?.getRayForCurrentType();
        if (ray) detail.ray = ray;
        this.dispatchInputEvent(inputState.connectionId, detail);
      } else if (axisIndices.length >= 2) {
        // multi-axis (vector)
        const vector = {
          x: inputState.axes[axisIndices[0]] || 0,
          y: inputState.axes[axisIndices[1]] || 0,
        };
        const detail: any = { value: vector };
        const ray = this.controlGraphics?.getRayForCurrentType();
        if (ray) detail.ray = ray;
        this.dispatchInputEvent(inputState.connectionId, detail);
      }
    } else if (this.props.type === "button" && this.props.button) {
      const buttonIndex = parseInt(this.props.button);
      const pressed = inputState.buttons[buttonIndex] || false;
      const detail: any = { value: pressed };
      const ray = this.controlGraphics?.getRayForCurrentType();
      if (ray) detail.ray = ray;
      this.dispatchInputEvent(inputState.connectionId, detail);
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
    super.disconnectedCallback();
  }
}
