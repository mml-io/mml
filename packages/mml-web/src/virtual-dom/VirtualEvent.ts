export class VirtualEvent {
  public readonly type: string;
  public readonly bubbles: boolean;
  public target: VirtualEvent["currentTarget"] = null;
  public currentTarget: { dispatchEvent(event: VirtualEvent | Event): boolean } | null = null;
  private propagationStopped = false;
  private immediatePropagationStopped = false;
  private defaultPrevented = false;

  constructor(type: string, options?: { bubbles?: boolean }) {
    this.type = type;
    this.bubbles = options?.bubbles ?? false;
  }

  stopPropagation(): void {
    this.propagationStopped = true;
  }

  stopImmediatePropagation(): void {
    this.immediatePropagationStopped = true;
    this.propagationStopped = true;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  get isPropagationStopped(): boolean {
    return this.propagationStopped;
  }

  get isImmediatePropagationStopped(): boolean {
    return this.immediatePropagationStopped;
  }

  get isDefaultPrevented(): boolean {
    return this.defaultPrevented;
  }
}

export class VirtualCustomEvent<T = unknown> extends VirtualEvent {
  public readonly detail: T | undefined;

  constructor(type: string, options?: { bubbles?: boolean; detail?: T }) {
    super(type, options);
    this.detail = options?.detail;
  }
}
