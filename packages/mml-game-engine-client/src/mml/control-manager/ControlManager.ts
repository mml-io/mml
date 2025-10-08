import { isMobileDevice, MControl } from "../elements/Control";
import { GameThreeJSAdapter } from "../GameThreeJSAdapter";
import { MMLWebClient } from "../MMLWebClient";
import {
  ControlInfo,
  ControlManagerConfig,
  ControlPosition,
  ControlSpaceRequirement,
} from "./ControlTypes";
import { VirtualButton } from "./VirtualButton";
import { VirtualJoystick } from "./VirtualJoystick";
import { VirtualSwipeArea } from "./VirtualSwipeArea";

export class ControlLayout {
  private controlPositions = new Map<string, ControlPosition>();

  addControl(controlId: string, position: ControlPosition): void {
    this.controlPositions.set(controlId, position);
  }

  getControlPosition(controlId: string): ControlPosition | undefined {
    return this.controlPositions.get(controlId);
  }

  updateControlPosition(controlId: string, position: ControlPosition): void {
    this.controlPositions.set(controlId, position);
  }

  getAllPositions(): Map<string, ControlPosition> {
    return new Map(this.controlPositions);
  }

  clear(): void {
    this.controlPositions.clear();
  }
}

export class ControlManager {
  private static instances = new Map<string, ControlManager>();

  private controlElements = new Map<string, ControlInfo>();
  private uiContainer: HTMLElement;
  private isInitialized = false;
  private config: ControlManagerConfig;
  private resizeObserver?: ResizeObserver;
  private windowResizeHandler?: () => void;

  // Size reference: iPhone 16 Pro (1206x2622)
  // Around 460 PPI. window.devicePixelRatio = 3
  private REFERENCE_WIDTH = 603; // 1206 / 2
  private REFERENCE_HEIGHT = 1311; // 2622 / 2

  // virtual joystick
  private BASE_JOYSTICK_SIZE = 95;
  private VIRTUAL_JOYSTICK_MIN_SIZE = 80;
  private VIRTUAL_JOYSTICK_MAX_SIZE = 150;
  private JOYSTICK_MARGIN = 25;

  // virtual button
  private BASE_BUTTON_SIZE = 70;
  private VIRTUAL_BUTTON_MIN_SIZE = 50;
  private VIRTUAL_BUTTON_MAX_SIZE = 100;
  private BUTTON_MARGIN = 15;

  // swipe area
  private SWIPE_HEIGHT_RATIO = 0.4; // 40% of canvas height

  // parent & size
  private DEFAULT_CONTROL_SIZE = 80;
  private DEFAULT_CONTROL_MARGIN = 20;

  private CONTAINER_MAX_HEIGHT = 200;
  private CONTAINER_HEIGHT_RATIO = 0.4; // 40% of canvas height

  private MIN_SCALE_FACTOR = 1;
  private HIGH_DENSITY_MULTIPLIER = 0.8; // high pixelratio needs some reduction

  private SAFE_AREA_PADDING = 70;

  // joystick & stack
  private JOYSTICK_MIN_MARGIN = 20;
  private JOYSTICK_WIDTH_RATIO = 0.04; // 4% of width
  private JOYSTICK_MIN_BOTTOM_MARGIN = 60;
  private JOYSTICK_HEIGHT_RATIO = 0.08; // 8% of height
  private JOYSTICK_MIN_STACK_SPACING = 30;
  private JOYSTICK_STACK_HEIGHT_RATIO = 0.03; // 3% of height

  // button arc
  private BUTTON_ARC_RADIUS_DIVISOR = 2.0;
  private BUTTON_MIN_GAP = 15;
  private BUTTON_GAP_WIDTH_RATIO = 0.025; // 2.5% of width
  private BUTTON_ARC_MAX_SIZE = 60;
  private BUTTON_ARC_MAX_WIDTH_RATIO = 0.17; // 17% of width

  private BUTTON_ARC_START_ANGLE = Math.PI; // 180°
  private BUTTON_ARC_END_ANGLE = (3 * Math.PI) / 2; // 270°
  private BUTTON_CENTER_OFFSET = 0.5;

  public static create(
    client: MMLWebClient,
    config?: Partial<ControlManagerConfig>,
  ): ControlManager {
    const id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let manager = ControlManager.instances.get(id);
    if (!manager) {
      manager = new ControlManager(client, id, config);
      ControlManager.instances.set(id, manager);
    }
    return manager;
  }

  public static getInstance(clientId: string): ControlManager | undefined {
    return ControlManager.instances.get(clientId);
  }

  private constructor(
    private client: MMLWebClient,
    private clientId: string,
    config?: Partial<ControlManagerConfig>,
  ) {
    this.config = {
      enabled: true,
      accessibility: true,
      debugMode: false,
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) {
      console.warn("ControlManager already initialized");
      return;
    }

    this.setupContainer();
    this.isInitialized = true;
  }

  private setupContainer(): void {
    this.uiContainer = document.createElement("div");
    this.uiContainer.id = "mml-control-manager-container";
    this.uiContainer.style.position = "absolute";
    this.uiContainer.style.pointerEvents = "none";
    this.uiContainer.style.zIndex = "50";

    this.positionContainerToCanvas();

    const graphicsElement = this.client.element;
    if (graphicsElement) {
      graphicsElement.appendChild(this.uiContainer);
    }

    this.setupResizeHandling();
  }

  private positionContainerToCanvas(): void {
    const scene = this.client.mScene;
    const graphicsAdapter = scene.getGraphicsAdapter();

    if (graphicsAdapter && "getCanvasElement" in graphicsAdapter) {
      const canvas = (graphicsAdapter as any).getCanvasElement();
      const canvasRect = canvas.getBoundingClientRect();
      const parentRect = this.client.element.getBoundingClientRect();

      const baseControlHeight = Math.min(
        this.CONTAINER_MAX_HEIGHT,
        canvasRect.height * this.CONTAINER_HEIGHT_RATIO,
      );

      const hasSwipeControls = Array.from(this.controlElements.values()).some(
        (control) => control.type === "swipe",
      );

      const controlHeight = hasSwipeControls
        ? Math.round(canvasRect.height * this.SWIPE_HEIGHT_RATIO)
        : baseControlHeight;

      this.uiContainer.style.position = "absolute";
      this.uiContainer.style.left = `${canvasRect.left - parentRect.left}px`;
      this.uiContainer.style.bottom = "0px";
      this.uiContainer.style.width = `${canvasRect.width}px`;
      this.uiContainer.style.height = `${controlHeight}px`;
    }
  }

  private setupResizeHandling(): void {
    const scene = this.client.mScene;
    const graphicsAdapter = scene.getGraphicsAdapter();

    if (graphicsAdapter && "getCanvasElement" in graphicsAdapter) {
      const canvas = (graphicsAdapter as any).getCanvasElement();

      const resizeObserver = new ResizeObserver(() => {
        this.repositionToCanvas();
      });

      resizeObserver.observe(canvas);

      const windowResizeHandler = () => {
        this.repositionToCanvas();
      };

      window.addEventListener("resize", windowResizeHandler);

      this.resizeObserver = resizeObserver;
      this.windowResizeHandler = windowResizeHandler;
    }
  }

  public addControl(element: MControl<GameThreeJSAdapter>): void {
    const controlInfo = this.createControlInfo(element);
    this.controlElements.set(controlInfo.id, controlInfo);

    if (isMobileDevice() || this.config.debugMode) {
      controlInfo.visualComponent = this.createVisualComponent(controlInfo);
    }

    // startInputPolling is now called by the control itself in connectedCallback
    // after attributes are initialized

    this.updateLayout();
  }

  public removeControl(element: MControl<GameThreeJSAdapter>): void {
    const controlInfo = this.findControlByElement(element);
    if (controlInfo) {
      // Always stop input polling for axis and button controls
      if (controlInfo.type === "axis" || controlInfo.type === "button") {
        element.stopInputPolling();
      }

      // Dispose visual components if they exist
      controlInfo.visualComponent?.dispose();
      this.controlElements.delete(controlInfo.id);
      this.updateLayout();
    }
  }

  private findControlByElement(element: MControl<GameThreeJSAdapter>): ControlInfo | undefined {
    for (const control of this.controlElements.values()) {
      if (control.element === element) {
        return control;
      }
    }
    return undefined;
  }

  private createControlInfo(element: MControl<GameThreeJSAdapter>): ControlInfo {
    const props = element.props;

    const controlInfo: ControlInfo = {
      element,
      id: `control-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: props.type as "axis" | "button" | "swipe",
      config: {
        type: props.type,
        axis: props.axis,
        button: props.button,
        input: (props as any).input,
        hint: props.hint,
        debug: props.debug,
        "raycast-distance": (props as any)["raycast-distance"],
        "raycast-type": (props as any)["raycast-type"],
      },
      visualComponent: null,
      priority: 0,
      requiredSpace: {
        width: 0,
        height: 0,
        preferredPosition: "left",
        minMargin: 0,
      }, // will be calculated by layout strategy
    };

    controlInfo.requiredSpace = this.getRequiredSpace(
      controlInfo,
      this.uiContainer?.getBoundingClientRect(),
    );

    return controlInfo;
  }

  private getRequiredSpace(
    control: ControlInfo,
    containerBounds?: DOMRect,
  ): ControlSpaceRequirement {
    const pixelRatio = window.devicePixelRatio || 1;
    const scaleFactor = Math.max(this.MIN_SCALE_FACTOR, pixelRatio * this.HIGH_DENSITY_MULTIPLIER);

    const bounds = containerBounds ||
      this.uiContainer?.getBoundingClientRect() || {
        width: this.REFERENCE_WIDTH,
        height: this.REFERENCE_HEIGHT,
      };

    const referenceWidth = this.REFERENCE_WIDTH;
    const widthScale = bounds.width / referenceWidth;

    switch (control.type) {
      case "axis": {
        const baseJoystickSize = this.BASE_JOYSTICK_SIZE;
        const responsiveJoystickSize = Math.round(baseJoystickSize * widthScale * scaleFactor);
        return {
          width: Math.max(
            this.VIRTUAL_JOYSTICK_MIN_SIZE,
            Math.min(this.VIRTUAL_JOYSTICK_MAX_SIZE, responsiveJoystickSize),
          ),
          height: Math.max(
            this.VIRTUAL_JOYSTICK_MIN_SIZE,
            Math.min(this.VIRTUAL_JOYSTICK_MAX_SIZE, responsiveJoystickSize),
          ),
          preferredPosition: "left",
          minMargin: Math.round(this.JOYSTICK_MARGIN * widthScale),
        };
      }
      case "button": {
        const baseButtonSize = this.BASE_BUTTON_SIZE;
        const responsiveButtonSize = Math.round(baseButtonSize * widthScale * scaleFactor);
        return {
          width: Math.max(
            this.VIRTUAL_BUTTON_MIN_SIZE,
            Math.min(this.VIRTUAL_BUTTON_MAX_SIZE, responsiveButtonSize),
          ),
          height: Math.max(
            this.VIRTUAL_BUTTON_MIN_SIZE,
            Math.min(this.VIRTUAL_BUTTON_MAX_SIZE, responsiveButtonSize),
          ),
          preferredPosition: "right",
          minMargin: Math.round(this.BUTTON_MARGIN * widthScale),
        };
      }
      case "swipe": {
        let canvasHeight = bounds.height;
        const scene = this.client.mScene;
        const graphicsAdapter = scene.getGraphicsAdapter();
        if (graphicsAdapter && "getCanvasElement" in graphicsAdapter) {
          const canvas = (graphicsAdapter as any).getCanvasElement();
          canvasHeight = canvas.getBoundingClientRect().height;
        }

        return {
          width: bounds.width,
          height: Math.round(canvasHeight * this.SWIPE_HEIGHT_RATIO), // 40% of canvas height
          preferredPosition: "bottom",
          minMargin: 0,
        };
      }
      default: {
        return {
          width: Math.round(this.DEFAULT_CONTROL_SIZE * widthScale * scaleFactor),
          height: Math.round(this.DEFAULT_CONTROL_SIZE * widthScale * scaleFactor),
          preferredPosition: "left",
          minMargin: Math.round(this.DEFAULT_CONTROL_MARGIN * widthScale),
        };
      }
    }
  }

  private createVisualComponent(controlInfo: ControlInfo) {
    try {
      let component = null;
      switch (controlInfo.type) {
        case "axis": {
          component = new VirtualJoystick(controlInfo, this.config.theme);
          break;
        }
        case "button": {
          component = new VirtualButton(controlInfo, this.config.theme);
          if (this.config.debugMode && "setDebugMode" in component) {
            component.setDebugMode(true);
          }
          break;
        }
        case "swipe": {
          component = new VirtualSwipeArea(controlInfo, this.config.theme);
          break;
        }
        default: {
          console.warn(`Unknown control type: ${controlInfo.type}`);
          return null;
        }
      }

      return component;
    } catch (error) {
      console.error("Failed to create virtual component:", error);
      return null;
    }
  }

  public registerControl(control: MControl<GameThreeJSAdapter>): void {
    this.addControl(control);
  }

  public unregisterControl(control: MControl<GameThreeJSAdapter>): void {
    this.removeControl(control);
  }

  private clearControls(): void {
    this.controlElements.forEach((control) => {
      control.visualComponent?.dispose();
    });
    this.controlElements.clear();

    if (this.uiContainer) {
      this.uiContainer.innerHTML = "";
    }
  }

  private updateLayout(): void {
    if (!this.uiContainer) {
      return;
    }

    this.positionContainerToCanvas();
    const containerBounds = this.uiContainer.getBoundingClientRect();
    const controls = Array.from(this.controlElements.values());

    const layout = new ControlLayout();
    const safeArea = this.calculateSafeArea(containerBounds);
    const sortedControls = this.sortControlsForMobile(controls);

    const joystickControls = sortedControls.filter((c) => c.type === "axis");
    const leftJoysticks = joystickControls.filter((c) => this.isLeftSideJoystick(c));
    const rightJoysticks = joystickControls.filter((c) => this.isRightSideJoystick(c));

    this.positionJoysticksOnSide(leftJoysticks, "left", containerBounds, layout);

    this.positionJoysticksOnSide(rightJoysticks, "right", containerBounds, layout);

    const buttonControls = sortedControls.filter((c) => c.type === "button");
    const buttonPositions = this.calculateButtonArcPositions(
      buttonControls.length,
      containerBounds,
      safeArea,
      rightJoysticks.length > 0, // hasRightJoysticks
    );

    let buttonIndex = 0;

    sortedControls.forEach((control) => {
      if (control.type === "axis") {
        // already positioned at this point
        return;
      } else if (control.type === "button") {
        const arcPosition = buttonPositions[buttonIndex];
        if (arcPosition) {
          const position: ControlPosition = {
            right: `${arcPosition.right}px`,
            bottom: `${arcPosition.bottom}px`,
            zIndex: 50,
          };
          layout.addControl(control.id, position);

          if (control.visualComponent && "setDebugInfo" in control.visualComponent) {
            const visualComponent = control.visualComponent as any;
            visualComponent.setDebugInfo(arcPosition.debugInfo);
          }
          if (control.visualComponent && "setRadius" in control.visualComponent) {
            const visualComponent = control.visualComponent as any;
            visualComponent.setRadius(arcPosition.radius);
          }
        }
        buttonIndex++;
      } else if (control.type === "swipe") {
        const position: ControlPosition = {
          left: "0px",
          bottom: "0px",
          zIndex: 49, // lower than buttons/joysticks
        };
        layout.addControl(control.id, position);
      }
    });

    controls.forEach((control) => {
      if (control.visualComponent) {
        const position = layout.getControlPosition(control.id);
        if (position) {
          if (!control.visualComponent.isVisible) {
            control.visualComponent.render(this.uiContainer);
          }
          control.visualComponent.updatePosition(position);
        }
      }
    });
  }

  private calculateSafeArea(containerBounds: DOMRect) {
    // account for device safe areas (iPhone bottom bar etc)
    const safeAreaInsets = {
      top: parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-top") || "0",
      ),
      bottom: parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-bottom") ||
          "0",
      ),
      left: parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-left") ||
          "0",
      ),
      right: parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-right") ||
          "0",
      ),
    };

    const safeArea = {
      top: safeAreaInsets.top + this.SAFE_AREA_PADDING,
      bottom: containerBounds.height - safeAreaInsets.bottom - this.SAFE_AREA_PADDING,
      left: safeAreaInsets.left + this.SAFE_AREA_PADDING,
      right: containerBounds.width - safeAreaInsets.right - this.SAFE_AREA_PADDING,
    };

    return safeArea;
  }

  private sortControlsForMobile(controls: ControlInfo[]): ControlInfo[] {
    // priority order: primary movement (axis), primary actions (buttons), secondary (swipe)
    return controls.sort((a, b) => {
      const typeOrder = { axis: 0, button: 1, swipe: 2 };
      const aOrder = typeOrder[a.type] ?? 3;
      const bOrder = typeOrder[b.type] ?? 3;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // sort by priority within same type
      return a.priority - b.priority;
    });
  }

  private isLeftSideJoystick(control: ControlInfo): boolean {
    // left side: axis 0 (horizontal) and/or axis 1 (vertical)
    const axisConfig = control.config.axis;
    if (!axisConfig) return false;

    const axes = axisConfig.split(",").map((a) => parseInt(a.trim()));
    return axes.some((axis) => axis === 0 || axis === 1);
  }

  private isRightSideJoystick(control: ControlInfo): boolean {
    // right side: axis 2 (horizontal) and/or axis 3 (vertical)
    const axisConfig = control.config.axis;
    if (!axisConfig) return false;

    const axes = axisConfig.split(",").map((a) => parseInt(a.trim()));
    return axes.some((axis) => axis === 2 || axis === 3);
  }

  private positionJoysticksOnSide(
    joysticks: ControlInfo[],
    side: "left" | "right",
    containerBounds: DOMRect,
    layout: ControlLayout,
  ): void {
    if (joysticks.length === 0) return;

    const baseMargin = Math.max(
      this.JOYSTICK_MIN_MARGIN,
      containerBounds.width * this.JOYSTICK_WIDTH_RATIO,
    );
    const baseBottomMargin = Math.max(
      this.JOYSTICK_MIN_BOTTOM_MARGIN,
      containerBounds.height * this.JOYSTICK_HEIGHT_RATIO,
    );
    const stackSpacing = Math.max(
      this.JOYSTICK_MIN_STACK_SPACING,
      containerBounds.height * this.JOYSTICK_STACK_HEIGHT_RATIO,
    );

    joysticks.forEach((control, index) => {
      const requiredSpace = this.getRequiredSpace(control, containerBounds);

      const bottomOffset =
        baseBottomMargin + this.SAFE_AREA_PADDING + index * (requiredSpace.height + stackSpacing);

      const position: ControlPosition =
        side === "left"
          ? {
              left: `${baseMargin}px`,
              bottom: `${bottomOffset}px`,
              zIndex: 50,
            }
          : {
              right: `${baseMargin}px`,
              bottom: `${bottomOffset}px`,
              zIndex: 50,
            };

      layout.addControl(control.id, position);
    });
  }

  private calculateButtonArcPositions(
    buttonCount: number,
    containerBounds: DOMRect,
    _safeArea: { top: number; bottom: number; left: number; right: number },
    hasRightJoysticks: boolean = false,
  ): Array<{
    right: number;
    bottom: number;
    radius: number;
    debugInfo?: any;
  }> {
    if (buttonCount === 0) return [];

    const FIXED_ARC_RADIUS = containerBounds.width / this.BUTTON_ARC_RADIUS_DIVISOR;
    const minGapBetweenButtons = Math.max(
      this.BUTTON_MIN_GAP,
      containerBounds.width * this.BUTTON_GAP_WIDTH_RATIO,
    );
    const maxButtonSize = Math.max(
      this.BUTTON_ARC_MAX_SIZE,
      containerBounds.width * this.BUTTON_ARC_MAX_WIDTH_RATIO,
    );

    // maybe we can have some config for that? not sure
    const circleCenterX = containerBounds.width;

    // adjust circle center Y position if right joysticks exist
    // shifts buttons up to avoid overlap
    let circleCenterY = containerBounds.height - this.SAFE_AREA_PADDING;
    if (hasRightJoysticks) {
      const joystickHeight = Math.max(
        this.VIRTUAL_JOYSTICK_MIN_SIZE,
        Math.min(
          this.VIRTUAL_JOYSTICK_MAX_SIZE,
          this.BASE_JOYSTICK_SIZE * (containerBounds.width / this.REFERENCE_WIDTH),
        ),
      );
      const baseBottomMargin = Math.max(
        this.JOYSTICK_MIN_BOTTOM_MARGIN,
        containerBounds.height * this.JOYSTICK_HEIGHT_RATIO,
      );
      const stackSpacing = Math.max(
        this.JOYSTICK_MIN_STACK_SPACING,
        containerBounds.height * this.JOYSTICK_STACK_HEIGHT_RATIO,
      );

      const joystickOccupiedHeight =
        baseBottomMargin + this.SAFE_AREA_PADDING + joystickHeight + stackSpacing;
      circleCenterY = containerBounds.height - joystickOccupiedHeight;
    }

    // upper-left quadrant: 180° to 270° (π to 3π/2 radians)
    const startAngle = this.BUTTON_ARC_START_ANGLE;
    const endAngle = this.BUTTON_ARC_END_ANGLE;
    const totalArcAngle = endAngle - startAngle;

    // calculate button size
    const result = this.calculateButtonLayoutWithFixedRadius(
      buttonCount,
      FIXED_ARC_RADIUS,
      totalArcAngle,
      minGapBetweenButtons,
      maxButtonSize,
    );

    const positions: Array<{
      right: number;
      bottom: number;
      radius: number;
      debugInfo?: any;
    }> = [];

    // pos for each button
    for (let i = 0; i < buttonCount; i++) {
      const angle = startAngle + (i + this.BUTTON_CENTER_OFFSET) * result.angleStep;

      // pos on circle
      const x = circleCenterX + Math.cos(angle) * result.arcRadius;
      const y = circleCenterY + Math.sin(angle) * result.arcRadius;

      // convert to CSS positioning (bottom right)
      const right = containerBounds.width - x - result.buttonSize / 2;
      const bottom = containerBounds.height - y - result.buttonSize / 2;

      positions.push({
        right: Math.max(0, right),
        bottom: Math.max(0, bottom),
        radius: result.buttonSize / 2,
        debugInfo: {
          circleCenter: { x: circleCenterX, y: circleCenterY },
          arcRadius: result.arcRadius,
          angle,
          buttonSize: result.buttonSize,
          position: { x, y },
        },
      });
    }

    return positions;
  }

  private calculateButtonLayoutWithFixedRadius(
    buttonCount: number,
    fixedRadius: number,
    totalArcAngle: number,
    minGap: number,
    maxButtonSize: number,
  ): { buttonSize: number; arcRadius: number; angleStep: number } {
    const availableArcLength = fixedRadius * totalArcAngle;

    const gapCount = buttonCount - 1; // Only gaps BETWEEN buttons
    const totalGapArcLength = gapCount * minGap;
    const availableButtonArcLengthWithGaps = availableArcLength - totalGapArcLength;
    const buttonSizeWithGaps = availableButtonArcLengthWithGaps / buttonCount;

    let finalButtonSize: number;

    const reasonableButtonThreshold = maxButtonSize * 0.5;

    if (buttonSizeWithGaps >= reasonableButtonThreshold) {
      finalButtonSize = Math.min(maxButtonSize, buttonSizeWithGaps);
    } else {
      // buttons would be too small with gaps so we remove the gaps
      const buttonSizeWithoutGaps = availableArcLength / buttonCount;
      finalButtonSize = Math.min(maxButtonSize, buttonSizeWithoutGaps);
    }

    const angleStep = totalArcAngle / buttonCount;

    return {
      buttonSize: finalButtonSize,
      arcRadius: fixedRadius,
      angleStep,
    };
  }

  public getControls(): ControlInfo[] {
    return Array.from(this.controlElements.values());
  }

  public updateConfig(newConfig: Partial<ControlManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.updateLayout();
  }

  public repositionToCanvas(): void {
    this.positionContainerToCanvas();

    const containerBounds = this.uiContainer?.getBoundingClientRect();
    this.controlElements.forEach((controlInfo) => {
      controlInfo.requiredSpace = this.getRequiredSpace(controlInfo, containerBounds);

      if (controlInfo.visualComponent && "updateSize" in controlInfo.visualComponent) {
        const visualComponent = controlInfo.visualComponent as any;
        visualComponent.updateSize(controlInfo.requiredSpace);
      }
    });

    this.updateLayout();
  }

  public dispose(): void {
    this.clearControls();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.windowResizeHandler) {
      window.removeEventListener("resize", this.windowResizeHandler);
      this.windowResizeHandler = undefined;
    }

    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
    }

    this.isInitialized = false;

    ControlManager.instances.delete(this.clientId);
  }
}
