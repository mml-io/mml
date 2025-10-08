import { MControl } from "../elements/Control";
import { GameThreeJSAdapter } from "../GameThreeJSAdapter";

export type UniversalInputState = {
  axes: number[];
  buttons: boolean[];
  connectionId: number;
};

export type GamepadState = {
  id: number;
  connected: boolean;
  axes: number[];
  buttons: boolean[];
  timestamp: number;
  mapping: string;
  processedAxes?: number[];
};

export type GamepadMapping = {
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  axisInversion: {
    leftStickX: boolean;
    leftStickY: boolean;
    rightStickX: boolean;
    rightStickY: boolean;
  };
  buttons: {
    A: number;
    B: number;
    X: number;
    Y: number;
    LB: number;
    RB: number;
    LT: number;
    RT: number;
    Back: number;
    Start: number;
    LS: number;
    RS: number;
    DPadUp: number;
    DPadDown: number;
    DPadLeft: number;
    DPadRight: number;
  };
};

// Xbox Standard Gamepad Mapping
export const XBOX_GAMEPAD_MAPPING: GamepadMapping = {
  leftStick: { x: 0, y: 1 },
  rightStick: { x: 2, y: 3 },
  axisInversion: {
    leftStickX: false,
    leftStickY: false,
    rightStickX: false,
    rightStickY: false,
  },
  buttons: {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    Back: 8,
    Start: 9,
    LS: 10,
    RS: 11,
    DPadUp: 12,
    DPadDown: 13,
    DPadLeft: 14,
    DPadRight: 15,
  },
};

export type ControlInfo = {
  element: MControl<GameThreeJSAdapter>;
  id: string;
  type: "axis" | "button" | "swipe" | "mouse";
  config: {
    type: string;
    axis?: string;
    button?: string;
    mouse?: string;
    hint?: string;
    debug?: boolean;
    "ray-distance"?: string;
  };
  visualComponent: VirtualControlComponent | null;
  priority: number;
  requiredSpace: ControlSpaceRequirement;
};

export type ControlSpaceRequirement = {
  width: number;
  height: number;
  preferredPosition: "left" | "right" | "center" | "bottom";
  minMargin: number;
};

export type ControlPosition = {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  transform?: string;
  zIndex: number;
};

export type VirtualControlComponent = {
  id: string;
  type: string;
  element: HTMLElement;
  position: ControlPosition;
  size: { width: number; height: number };
  isVisible: boolean;

  render(container: HTMLElement): void;
  updatePosition(position: ControlPosition): void;
  setVisible(visible: boolean): void;
  dispose(): void;
};

export type ControlManagerConfig = {
  enabled: boolean;
  theme?: ControlTheme;
  accessibility?: boolean;
  debugMode?: boolean;
};

export type ControlTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderRadius: string;
  shadowStyle: string;
};
