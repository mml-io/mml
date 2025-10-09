import {
  ControlInfo,
  ControlPosition,
  ControlTheme,
  VirtualControlComponent,
} from "./ControlTypes";

export class VirtualButton implements VirtualControlComponent {
  id: string;
  type = "button";
  element: HTMLElement;
  position: ControlPosition = { zIndex: 1000 };
  size: { width: number; height: number };
  isVisible = false;

  private isPressed = false;
  private controlInfo: ControlInfo;
  private theme: ControlTheme;
  private debugMode = false;
  private debugInfo: any = null;
  private currentRadius = 25;
  private debugCircle: HTMLElement | null = null;
  private boundHandleVisibilityChange: () => void;
  private boundHandleWindowBlur: () => void;

  constructor(controlInfo: ControlInfo, theme?: ControlTheme) {
    this.controlInfo = controlInfo;
    this.id = controlInfo.id;
    this.size = {
      width: controlInfo.requiredSpace.width,
      height: controlInfo.requiredSpace.height,
    };

    this.theme = theme || {
      primaryColor: "#007AFF",
      secondaryColor: "#F2F2F7",
      accentColor: "#FF3B30",
      borderRadius: "50%",
      shadowStyle: "0 4px 12px rgba(0, 0, 0, 0.15)",
    };

    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.boundHandleWindowBlur = this.handleWindowBlur.bind(this);

    this.createElement();
    this.setupEventListeners();
  }

  private createElement(): void {
    this.element = document.createElement("div");
    this.element.style.position = "absolute";
    this.element.style.pointerEvents = "auto";
    this.element.style.userSelect = "none";
    this.element.style.touchAction = "none";
    this.element.style.display = "flex";
    this.element.style.alignItems = "center";
    this.element.style.justifyContent = "center";
    this.element.style.fontFamily =
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    this.element.style.fontWeight = "600";
    this.element.style.color = "white";
    this.element.style.fontSize = "14px";
    this.element.style.transition = "all 0.1s ease";
    this.element.style.opacity = "0.9";
    this.element.className = "enhanced-virtual-button";
    this.updateElementSize();
  }

  private updateElementSize(): void {
    const buttonSize = this.currentRadius * 2;
    this.element.style.width = `${buttonSize}px`;
    this.element.style.height = `${buttonSize}px`;
    this.element.style.borderRadius = this.theme.borderRadius;
    this.element.style.background = this.theme.primaryColor;
    this.element.style.boxShadow = this.theme.shadowStyle;
    this.element.style.zIndex = "1000";
    this.element.innerHTML = "";

    const buttonText = this.controlInfo.config.hint || this.controlInfo.config.button || "⚡";
    this.element.textContent = buttonText;

    if (this.controlInfo.config.hint && this.controlInfo.config.hint !== buttonText) {
      const hintElement = document.createElement("div");
      hintElement.style.position = "absolute";
      hintElement.style.bottom = "-24px";
      hintElement.style.left = "50%";
      hintElement.style.transform = "translateX(-50%)";
      hintElement.style.fontSize = "12px";
      hintElement.style.fontWeight = "500";
      hintElement.style.textAlign = "center";
      hintElement.style.whiteSpace = "nowrap";
      hintElement.style.pointerEvents = "none";
      hintElement.style.color = this.theme.primaryColor;
      hintElement.textContent = this.controlInfo.config.hint;
      this.element.appendChild(hintElement);
    }
  }

  private setupEventListeners(): void {
    this.element.addEventListener("touchstart", this.handlePress.bind(this), {
      passive: false,
    });
    this.element.addEventListener("touchend", this.handleRelease.bind(this), {
      passive: false,
    });
    this.element.addEventListener("touchcancel", this.handleRelease.bind(this), { passive: false });

    // mouse events for desktop testing
    this.element.addEventListener("mousedown", this.handlePress.bind(this), {
      passive: false,
    });
    this.element.addEventListener("mouseup", this.handleRelease.bind(this), {
      passive: false,
    });
    this.element.addEventListener("mouseleave", this.handleRelease.bind(this), {
      passive: false,
    });

    document.addEventListener("visibilitychange", this.boundHandleVisibilityChange);
    window.addEventListener("blur", this.boundHandleWindowBlur);
  }

  private handlePress(event: TouchEvent | MouseEvent): void {
    event.preventDefault();

    if (this.isPressed) return;
    this.isPressed = true;

    this.element.style.transform = "scale(0.95)";
    this.element.style.opacity = "1";
    this.element.style.background = this.theme.accentColor;

    this.tryVibrate(15);

    this.sendInputToControl(true);
  }

  private handleRelease(_event: TouchEvent | MouseEvent): void {
    if (!this.isPressed) return;
    this.isPressed = false;

    this.element.style.transform = "scale(1)";
    this.element.style.opacity = "0.9";
    this.element.style.background = this.theme.primaryColor;

    this.sendInputToControl(false);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.isPressed) {
        this.isPressed = false;
        this.element.style.transform = "scale(1)";
        this.element.style.opacity = "0.9";
        this.element.style.background = this.theme.primaryColor;
        this.sendInputToControl(false);
      }
    }
  }

  private handleWindowBlur(): void {
    if (this.isPressed) {
      this.isPressed = false;
      this.element.style.transform = "scale(1)";
      this.element.style.opacity = "0.9";
      this.element.style.background = this.theme.primaryColor;
      this.sendInputToControl(false);
    }
  }

  private tryVibrate(duration: number): void {
    if ("vibrate" in navigator && navigator.userActivation?.hasBeenActive) {
      try {
        navigator.vibrate(duration);
      } catch (error) {
        console.debug("Vibration blocked or failed:", error);
      }
    }
  }

  private sendInputToControl(pressed: boolean): void {
    const buttonIndex = parseInt(this.controlInfo.config.button || "0");

    const control = this.controlInfo.element;
    control.inputMapper.updateInputButton(buttonIndex, pressed ? 1.0 : 0.0);
  }

  render(container: HTMLElement): void {
    container.appendChild(this.element);
    this.isVisible = true;
  }

  updatePosition(position: ControlPosition): void {
    this.position = position;
    Object.assign(this.element.style, {
      left: position.left || "",
      right: position.right || "",
      top: position.top || "",
      bottom: position.bottom || "",
      transform: position.transform || "",
      zIndex: position.zIndex.toString(),
    });

    this.updateDebugCircle();
  }

  public setRadius(radius: number): void {
    this.currentRadius = radius;
    if (this.element) {
      this.updateElementSize();
    }
  }

  public setDebugInfo(debugInfo: any): void {
    this.debugInfo = debugInfo;
    this.updateDebugCircle();
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.updateDebugCircle();
  }

  private updateDebugCircle(): void {
    if (this.debugCircle) {
      this.debugCircle.remove();
      this.debugCircle = null;
    }

    if (this.debugMode && this.debugInfo && this.isVisible) {
      this.createDebugCircle();
    }
  }

  private createDebugCircle(): void {
    if (!this.debugInfo) return;

    this.debugCircle = document.createElement("div");
    this.debugCircle.style.position = "absolute";
    this.debugCircle.style.pointerEvents = "none";

    const { circleCenter, arcRadius } = this.debugInfo;
    const diameter = arcRadius * 2;

    this.debugCircle.style.cssText = `
      width: ${diameter}px;
      height: ${diameter}px;
      border: 2px dashed rgba(255, 0, 0, 0.5);
      border-radius: 50%;
      left: ${circleCenter.x - arcRadius}px;
      top: ${circleCenter.y - arcRadius}px;
      z-index: 999;
    `;

    if (this.element.parentElement) {
      this.element.parentElement.appendChild(this.debugCircle);
    }
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? "block" : "none";
  }

  dispose(): void {
    if (this.debugCircle) {
      this.debugCircle.remove();
      this.debugCircle = null;
    }

    document.removeEventListener("visibilitychange", this.boundHandleVisibilityChange);
    window.removeEventListener("blur", this.boundHandleWindowBlur);

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.isVisible = false;
  }
}
