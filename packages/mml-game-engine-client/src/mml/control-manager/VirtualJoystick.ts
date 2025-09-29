import {
  ControlInfo,
  ControlPosition,
  ControlSpaceRequirement,
  ControlTheme,
  VirtualControlComponent,
} from "./ControlTypes";

export class VirtualJoystick implements VirtualControlComponent {
  id: string;
  type = "joystick";
  element: HTMLElement;
  position: ControlPosition = { zIndex: 1000 };
  size: { width: number; height: number };
  isVisible = false;

  private knobElement: HTMLElement;
  private trackElement: HTMLElement;
  private isDragging = false;
  private controlInfo: ControlInfo;
  private theme: ControlTheme;

  private boundHandleStart: (event: TouchEvent | MouseEvent) => void;
  private boundHandleMove: (event: TouchEvent | MouseEvent) => void;
  private boundHandleEnd: (event: TouchEvent | MouseEvent) => void;

  constructor(controlInfo: ControlInfo, theme?: ControlTheme) {
    this.controlInfo = controlInfo;
    this.id = controlInfo.id;
    this.size = {
      width: controlInfo.requiredSpace.width,
      height: controlInfo.requiredSpace.height,
    };

    this.theme = theme || {
      primaryColor: "rgba(255, 255, 255, 0.5)",
      secondaryColor: "rgba(255, 255, 255, 0.1)",
      accentColor: "#FF3B30",
      borderRadius: "50%",
      shadowStyle: "0 4px 12px rgba(0, 0, 0, 0.15)",
    };

    this.boundHandleStart = this.handleStart.bind(this);
    this.boundHandleMove = this.handleMove.bind(this);
    this.boundHandleEnd = this.handleEnd.bind(this);

    this.createElement();
    this.setupEventListeners();
  }

  private createElement(): void {
    this.element = document.createElement("div");
    this.element.id = "virtual-joystick-wrapper";
    this.element.style.position = "absolute";
    this.element.style.zIndex = "1000";
    this.element.style.pointerEvents = "none";
    this.element.style.width = `${this.size.width}px`;
    this.element.style.height = `${this.size.height}px`;

    this.trackElement = document.createElement("div");
    this.trackElement.style.width = "100%";
    this.trackElement.style.height = "100%";
    this.trackElement.style.borderRadius = "50%";
    this.trackElement.style.position = "relative";
    this.trackElement.style.pointerEvents = "auto";
    this.trackElement.style.opacity = "0.8";
    this.trackElement.style.background = this.theme.secondaryColor;
    this.trackElement.style.border = `2px solid ${this.theme.primaryColor}`;
    this.trackElement.style.boxShadow = this.theme.shadowStyle;

    this.knobElement = document.createElement("div");
    const knobSize = Math.round(this.size.width * 0.33);
    this.knobElement.style.borderRadius = "50%";
    this.knobElement.style.position = "absolute";
    this.knobElement.style.pointerEvents = "none";
    this.knobElement.style.width = `${knobSize}px`;
    this.knobElement.style.height = `${knobSize}px`;
    this.knobElement.style.top = "50%";
    this.knobElement.style.left = "50%";
    this.knobElement.style.transform = "translate(-50%, -50%)";
    this.knobElement.style.background = this.theme.primaryColor;

    if (this.controlInfo.config.hint) {
      const hintElement = document.createElement("div");
      hintElement.style.position = "absolute";
      hintElement.style.fontSize = "12px";
      hintElement.style.textAlign = "center";
      hintElement.style.whiteSpace = "nowrap";
      hintElement.style.pointerEvents = "none";
      hintElement.style.bottom = "-24px";
      hintElement.style.left = "50%";
      hintElement.style.transform = "translateX(-50%)";
      hintElement.style.color = this.theme.primaryColor;
      hintElement.style.fontWeight = "bold";
      hintElement.style.fontSize = "1em";
      hintElement.textContent = this.controlInfo.config.hint;
      this.element.appendChild(hintElement);
    }

    this.trackElement.appendChild(this.knobElement);
    this.element.appendChild(this.trackElement);
  }

  private setupEventListeners(): void {
    this.trackElement.addEventListener("touchstart", this.boundHandleStart, {
      passive: false,
    });
    document.addEventListener("touchmove", this.boundHandleMove, {
      passive: false,
    });
    document.addEventListener("touchend", this.boundHandleEnd, {
      passive: false,
    });

    this.trackElement.addEventListener("mousedown", this.boundHandleStart, {
      passive: false,
    });
    document.addEventListener("mousemove", this.boundHandleMove, {
      passive: false,
    });
    document.addEventListener("mouseup", this.boundHandleEnd, {
      passive: false,
    });
  }

  private handleStart(event: TouchEvent | MouseEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.updateStickPosition(event);

    this.trackElement.style.opacity = "1";

    this.tryVibrate(10);
  }

  private handleMove(event: TouchEvent | MouseEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    this.updateStickPosition(event);
  }

  private handleEnd(_event: TouchEvent | MouseEvent): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.resetStick();

    this.tryVibrate(5);
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

  private updateStickPosition(event: TouchEvent | MouseEvent): void {
    const rect = this.trackElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX: number, clientY: number;
    if ("touches" in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const maxDistance = 50;

    let x = deltaX / maxDistance;
    let y = deltaY / maxDistance;

    if (distance > maxDistance) {
      x = deltaX / distance;
      y = deltaY / distance;
    }

    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    this.knobElement.style.transform = `translate(calc(-50% + ${x * maxDistance}px), calc(-50% + ${y * maxDistance}px))`;
    this.sendInputToControl(x, -y);
  }

  private resetStick(): void {
    this.knobElement.style.transform = "translate(-50%, -50%)";
    this.trackElement.style.opacity = "0.8";
    this.sendInputToControl(0, 0);
  }

  private sendInputToControl(x: number, y: number): void {
    const axisIndices =
      this.controlInfo.config.axis?.split(",").map((s) => parseInt(s.trim())) || [];

    const inputMapper = (this.controlInfo.element as any).inputMapper;
    if (inputMapper && inputMapper.inputState) {
      if (axisIndices.length >= 1) {
        inputMapper.inputState.axes[axisIndices[0]] = x;
      }
      if (axisIndices.length >= 2) {
        inputMapper.inputState.axes[axisIndices[1]] = y;
      }
    }
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
  }

  public updateSize(requiredSpace: ControlSpaceRequirement): void {
    this.size = {
      width: requiredSpace.width,
      height: requiredSpace.height,
    };

    this.element.style.width = `${this.size.width}px`;
    this.element.style.height = `${this.size.height}px`;
    this.trackElement.style.width = `${this.size.width}px`;
    this.trackElement.style.height = `${this.size.height}px`;
    const knobSize = Math.round(this.size.width * 0.33);
    this.knobElement.style.width = `${knobSize}px`;
    this.knobElement.style.height = `${knobSize}px`;
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (visible) {
      this.element.classList.remove("hidden");
    } else {
      this.element.classList.add("hidden");
    }
  }

  dispose(): void {
    this.trackElement.removeEventListener("touchstart", this.boundHandleStart);
    document.removeEventListener("touchmove", this.boundHandleMove);
    document.removeEventListener("touchend", this.boundHandleEnd);
    this.trackElement.removeEventListener("mousedown", this.boundHandleStart);
    document.removeEventListener("mousemove", this.boundHandleMove);
    document.removeEventListener("mouseup", this.boundHandleEnd);

    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.isVisible = false;
  }
}
