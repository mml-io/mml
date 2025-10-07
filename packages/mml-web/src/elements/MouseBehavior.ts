import { AttributeHandler, parseEnumAttribute } from "../attributes";
import { GraphicsAdapter } from "../graphics";
import { MElement } from "./MElement";

export enum MouseBehaviorMode {
  unlocked = "unlocked",
  locked = "locked",
}

type MouseBehaviorProps = {
  mode: MouseBehaviorMode;
};

export class MouseBehavior<G extends GraphicsAdapter = GraphicsAdapter> extends MElement<G> {
  static tagName = "m-mouse-behavior";

  public props: MouseBehaviorProps = {
    mode: MouseBehaviorMode.unlocked,
  };

  private static attributeHandler = new AttributeHandler<MouseBehavior<GraphicsAdapter>>({
    mode: (instance, newValue) => {
      const parsed = parseEnumAttribute(newValue, MouseBehaviorMode, MouseBehaviorMode.unlocked);
      instance.props.mode = parsed;
      instance.applyMode();
    },
  });

  static get observedAttributes(): Array<string> {
    return [...MouseBehavior.attributeHandler.getAttributes()];
  }

  private containerPointerDownHandler: ((ev: Event) => void) | null = null;
  private pointerLockRequestPending: boolean = false;
  private onPointerLockChange: (() => void) | null = null;
  private onPointerLockError: ((ev: Event) => void) | null = null;
  private lastUnlockAtMs: number | null = null;
  private retryTimeoutId: number | null = null;

  public isClickable(): boolean {
    return false;
  }

  public parentTransformed(): void {
  }

  public connectedCallback(): void {
    super.connectedCallback();

    // Initialize with any pre-set attributes
    for (const name of MouseBehavior.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }

    this.applyMode();

    // Ensure we have a direct user-gesture path to request pointer lock
    const container = this.getContainerElement();
    if (!this.containerPointerDownHandler) {
      this.containerPointerDownHandler = (ev: Event) => {
        if (!(ev instanceof PointerEvent) || !ev.isTrusted || ev.button !== 0) {
          return;
        }
        // For locked mode only, engage pointer lock on scene press (not on overlay)
        const target = ev.target as HTMLElement | null;
        if (this.props.mode === MouseBehaviorMode.locked) {
          if (target && this.isWithinOverlay(target)) {
            return;
          }
          if (!document.pointerLockElement) {
            // Consume the gesture so other handlers don't compete for the same activation
            ev.preventDefault();
            ev.stopImmediatePropagation();

            // Respect 1s cooldown after unlock
            const delay = this.getCooldownDelayMs();
            if (delay > 0) {
              this.scheduleRetryIn(delay);
              return;
            }

            if (!this.pointerLockRequestPending) {
              this.doRequestPointerLock();
            }
            // Ensure retry loop continues until acquired
            this.scheduleRetryIn(100);
          }
        }
      };
      // Use capture to see the event before overlay handlers stop propagation
      container.addEventListener("pointerdown", this.containerPointerDownHandler, true);
    }

    if (!this.onPointerLockChange) {
      this.onPointerLockChange = () => {
        this.pointerLockRequestPending = false;
        if (document.pointerLockElement) {
          // Success: cancel any outstanding retries
          this.clearRetryTimer();
        } else {
          // Record unlock time for cooldown
          this.lastUnlockAtMs = performance.now();
        }
      };
      document.addEventListener("pointerlockchange", this.onPointerLockChange);
    }
    if (!this.onPointerLockError) {
      this.onPointerLockError = () => {
        this.pointerLockRequestPending = false;
        // Retry is handled by the retry loop
      };
      document.addEventListener("pointerlockerror", this.onPointerLockError);
    }
  }

  public disconnectedCallback(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    const container = this.getContainerElement();
    if (this.containerPointerDownHandler) {
      container.removeEventListener("pointerdown", this.containerPointerDownHandler, true);
      this.containerPointerDownHandler = null;
    }

    if (this.onPointerLockChange) {
      document.removeEventListener("pointerlockchange", this.onPointerLockChange);
      this.onPointerLockChange = null;
    }
    if (this.onPointerLockError) {
      document.removeEventListener("pointerlockerror", this.onPointerLockError);
      this.onPointerLockError = null;
    }

    this.clearRetryTimer();

    super.disconnectedCallback();
  }

  public attributeChangedCallback(name: string, oldValue: string | null, newValue: string): void {
    MouseBehavior.attributeHandler.handle(this, name, newValue);
  }

  private applyMode(): void {
    switch (this.props.mode) {
      case MouseBehaviorMode.unlocked:
        if (document.pointerLockElement) document.exitPointerLock();
        this.clearRetryTimer();
        break;
      case MouseBehaviorMode.locked:
        // Engage on pointerdown
        break;
      default:
        break;
    }
  }

  private getContainerElement(): HTMLElement {
    const overlayRoot = this.getScene().getOverlayElement?.();
    return overlayRoot ?? document.body;
  }


  private doRequestPointerLock(): void {
    // Prefer locking the scene root element for reliability across browsers
    const lockTarget = this.getContainerElement();
    this.pointerLockRequestPending = true;
    const possiblePromise: any = (lockTarget as any).requestPointerLock?.();
    if (possiblePromise && typeof possiblePromise.finally === "function") {
      possiblePromise
        .catch(() => {
          // Expected when the user exits the lock (e.g., ESC) before completion
          // ignore
        })
        .finally(() => {
          this.pointerLockRequestPending = false;
        });
    } else {
      // Older or non-promise implementations return void; avoid sticky pending state
      this.pointerLockRequestPending = false;
    }
  }

  private getCooldownDelayMs(): number {
    if (this.lastUnlockAtMs == null) return 0;
    const now = performance.now();
    const availableAt = this.lastUnlockAtMs + 1000;
    return Math.max(0, availableAt - now);
  }

  private clearRetryTimer(): void {
    if (this.retryTimeoutId != null) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private scheduleRetryIn(delayMs: number): void {
    this.clearRetryTimer();
    this.retryTimeoutId = setTimeout(() => {
      this.retryTimeoutId = null;
      this.attemptPointerLock();
    }, Math.max(0, delayMs)) as unknown as number;
  }

  private attemptPointerLock(): void {
    if (document.pointerLockElement) {
      this.clearRetryTimer();
      return;
    }
    if (this.props.mode !== MouseBehaviorMode.locked) {
      this.clearRetryTimer();
      return;
    }
    const cooldownDelay = this.getCooldownDelayMs();
    if (cooldownDelay > 0) {
      this.scheduleRetryIn(cooldownDelay);
      return;
    }
    if (!this.pointerLockRequestPending) {
      this.doRequestPointerLock();
    }
    // Continue retrying until pointer lock is acquired
    this.scheduleRetryIn(100);
  }

  private isWithinOverlay(node: HTMLElement): boolean {
    let current: HTMLElement | null = node;
    while (current) {
      if (current.getAttribute && current.getAttribute("data-mml-overlay") === "true") {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }
}



