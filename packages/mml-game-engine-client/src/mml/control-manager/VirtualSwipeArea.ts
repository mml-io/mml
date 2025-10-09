import {
  ControlInfo,
  ControlPosition,
  ControlTheme,
  VirtualControlComponent,
} from "./ControlTypes";

export class VirtualSwipeArea implements VirtualControlComponent {
  id: string;
  type = "swipe-area";
  element: HTMLElement;
  position: ControlPosition = { zIndex: 40 };
  size: { width: number; height: number };
  isVisible = false;

  private controlInfo: ControlInfo;
  private theme: ControlTheme;
  private rippleElement: HTMLElement;
  private isActive = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private startTime = 0;
  private minSwipeDistance = 50;
  private minSwipeVelocity = 0.02;
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
      primaryColor: "#FFFFFF",
      secondaryColor: "#F2F2F7",
      accentColor: "#FF3B30",
      borderRadius: "0px",
      shadowStyle: "0 2px 8px rgba(0, 0, 0, 0.1)",
    };

    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.boundHandleWindowBlur = this.handleWindowBlur.bind(this);

    this.createElement();
    this.setupEventListeners();
  }

  private createElement(): void {
    this.element = document.createElement("div");
    this.element.style.position = "absolute";
    this.element.style.display = "flex";
    this.element.style.alignItems = "center";
    this.element.style.justifyContent = "center";
    this.element.style.fontSize = "14px";
    this.element.style.fontWeight = "500";
    this.element.style.opacity = "0.7";
    this.element.style.pointerEvents = "auto";
    this.element.style.userSelect = "none";
    this.element.style.touchAction = "none";
    this.element.style.width = `${this.size.width}px`;
    this.element.style.height = `${this.size.height}px`;
    this.element.style.borderRadius = this.theme.borderRadius;
    this.element.style.border = `2px dashed ${this.theme.primaryColor}60`;
    this.element.style.color = this.theme.primaryColor;

    const swipeText = this.controlInfo.config.hint || "👆 Swipe";
    const contentDiv = document.createElement("div");
    contentDiv.style.textAlign = "center";
    contentDiv.style.pointerEvents = "none";

    const textDiv = document.createElement("div");
    textDiv.textContent = swipeText;

    contentDiv.appendChild(textDiv);
    this.element.appendChild(contentDiv);

    this.rippleElement = document.createElement("div");
    this.rippleElement.style.position = "absolute";
    this.rippleElement.style.borderRadius = "50%";
    this.rippleElement.style.pointerEvents = "none";
    this.rippleElement.style.background = `${this.theme.primaryColor}40`;
    this.rippleElement.style.transform = "scale(0)";
    this.element.appendChild(this.rippleElement);
  }

  private setupEventListeners(): void {
    this.element.addEventListener("touchstart", this.handleTouchStart.bind(this), {
      passive: false,
    });
    this.element.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener("touchend", this.handleTouchEnd.bind(this), {
      passive: false,
    });

    // mouse events for desktop testing
    this.element.addEventListener("mousedown", this.handleTouchStart.bind(this), {
      passive: false,
    });
    document.addEventListener("mousemove", this.handleTouchMove.bind(this), {
      passive: false,
    });
    document.addEventListener("mouseup", this.handleTouchEnd.bind(this), {
      passive: false,
    });

    document.addEventListener("visibilitychange", this.boundHandleVisibilityChange);
    window.addEventListener("blur", this.boundHandleWindowBlur);
  }

  private handleTouchStart(event: TouchEvent | MouseEvent): void {
    event.preventDefault();
    this.isActive = true;
    this.startTime = Date.now();

    let clientX: number, clientY: number;
    if ("touches" in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    this.startX = clientX;
    this.startY = clientY;
    this.currentX = clientX;
    this.currentY = clientY;

    this.element.style.opacity = "1";

    const rect = this.element.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    this.rippleElement.style.left = `${x - 10}px`;
    this.rippleElement.style.top = `${y - 10}px`;
    this.rippleElement.style.width = "20px";
    this.rippleElement.style.height = "20px";
    this.rippleElement.style.transform = "scale(1)";
    this.rippleElement.style.opacity = "0.8";
  }

  private handleTouchMove(event: TouchEvent | MouseEvent): void {
    if (!this.isActive) return;
    event.preventDefault();

    let clientX: number, clientY: number;
    if ("touches" in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    this.currentX = clientX;
    this.currentY = clientY;
  }

  private handleTouchEnd(): void {
    if (!this.isActive) return;

    this.isActive = false;

    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - this.startTime;
    const velocity = (distance / Math.max(duration, 1)) * 0.1;

    this.element.style.opacity = "0.7";
    this.rippleElement.style.transform = "scale(0)";

    if (distance >= this.minSwipeDistance && velocity >= this.minSwipeVelocity) {
      const axisIndices =
        this.controlInfo.config.axis?.split(",").map((s: string) => parseInt(s.trim())) || [];

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (axisIndices.includes(0)) {
          const axisVelocity = deltaX > 0 ? velocity : -velocity;
          this.sendSwipeEvent(0, axisVelocity, Math.abs(deltaX));
        }
      } else {
        if (axisIndices.includes(1)) {
          const axisVelocity = deltaY > 0 ? velocity : -velocity;
          this.sendSwipeEvent(1, axisVelocity, Math.abs(deltaY));
        }
      }
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.isActive) {
        this.isActive = false;
        this.element.style.opacity = "0.7";
        this.rippleElement.style.transform = "scale(0)";
      }
    }
  }

  private handleWindowBlur(): void {
    if (this.isActive) {
      this.isActive = false;
      this.element.style.opacity = "0.7";
      this.rippleElement.style.transform = "scale(0)";
    }
  }

  private sendSwipeEvent(axis: number, velocity: number, distance: number): void {
    const mControl = this.controlInfo.element as any;
    if (mControl && mControl.dispatchInputEvent) {
      const eventData = {
        value: { x: 0, y: 0 },
        swipe: {
          axis,
          velocity,
          distance,
          active: true,
        },
      };
      mControl.dispatchInputEvent(1, eventData);

      setTimeout(() => {
        const resetEventData = {
          value: { x: 0, y: 0 },
          swipe: {
            axis,
            velocity: 0,
            distance: 0,
            active: false,
          },
        };
        mControl.dispatchInputEvent(1, resetEventData);
      }, 100);
    }
  }

  render(container: HTMLElement): void {
    container.appendChild(this.element);
    this.isVisible = true;
  }

  updatePosition(position: ControlPosition): void {
    this.position = position;

    const isBottomFullWidth = position.bottom === "0px" && position.left === "0px";

    Object.assign(this.element.style, {
      left: position.left || "",
      right: position.right || "",
      top: position.top || "",
      bottom: position.bottom || "",
      transform: position.transform || "",
      zIndex: position.zIndex.toString(),
    });

    if (isBottomFullWidth) {
      this.element.style.width = "100%";
      this.element.style.left = "0px";
      this.element.style.right = "0px";
    } else {
      this.element.style.width = `${this.size.width}px`;
    }
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
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.isVisible = false;
  }
}
