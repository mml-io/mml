import { IStyleLike } from "@mml-io/networked-dom-web";

import { VIRTUAL_ELEMENT_BRAND } from "./brands";
import { VirtualEvent } from "./VirtualEvent";
import { VirtualElementConstructor, VirtualLifecycleCallbacks, VirtualNode } from "./VirtualNode";
import { VirtualTextNode } from "./VirtualTextNode";

type VirtualEventHandler = (event: VirtualEvent | Event) => void;

class VirtualStyle implements IStyleLike {
  [key: string]: string | undefined | ((...args: unknown[]) => unknown);

  setProperty(name: string, value: string | null): void {
    if (value === null || value === "") {
      delete this[name];
    } else {
      this[name] = value;
    }
  }

  getPropertyValue(name: string): string {
    return (this[name] as string) ?? "";
  }

  removeProperty(name: string): string {
    const old = (this[name] as string) ?? "";
    delete this[name];
    return old;
  }

  constructor() {
    return new Proxy(this, {
      get(target, prop, receiver) {
        // For symbols and non-string props (e.g. Symbol.toPrimitive, Symbol.iterator),
        // delegate to the real object to preserve built-in behavior
        if (typeof prop !== "string") {
          return Reflect.get(target, prop, receiver);
        }
        return target[prop] ?? "";
      },
      set(target, prop, value) {
        if (typeof prop === "string") {
          if (value === "" || value === undefined || value === null) {
            delete target[prop];
          } else {
            target[prop] = String(value);
          }
        }
        return true;
      },
    });
  }
}

export class VirtualHTMLElement extends VirtualNode implements VirtualLifecycleCallbacks {
  readonly [VIRTUAL_ELEMENT_BRAND] = true as const;

  private _attributes: Map<string, string> = new Map();
  private _eventListeners: Map<string, VirtualEventHandler[]> = new Map();
  public readonly style: IStyleLike;

  constructor() {
    const ctor = new.target as VirtualElementConstructor;
    super(ctor.tagName ? ctor.tagName.toUpperCase() : "");
    this.style = new VirtualStyle();
  }

  get tagName(): string {
    return this.nodeName;
  }

  get id(): string {
    return this.getAttribute("id") ?? "";
  }

  set id(value: string) {
    this.setAttribute("id", value);
  }

  get children(): VirtualHTMLElement[] {
    return this.childNodes.filter(
      (child) => child instanceof VirtualHTMLElement,
    ) as VirtualHTMLElement[];
  }

  getAttribute(name: string): string | null {
    return this._attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    const oldValue = this._attributes.get(name) ?? null;
    if (oldValue === value) return;
    this._attributes.set(name, value);

    const ctor = this.constructor as VirtualElementConstructor;
    const observed = ctor.observedAttributes;
    if (observed && observed.includes(name)) {
      this.attributeChangedCallback(name, oldValue, value);
    }
  }

  removeAttribute(name: string): void {
    const oldValue = this._attributes.get(name) ?? null;
    if (oldValue === null) return;
    this._attributes.delete(name);

    const ctor = this.constructor as VirtualElementConstructor;
    const observed = ctor.observedAttributes;
    if (observed && observed.includes(name)) {
      this.attributeChangedCallback(name, oldValue, null);
    }
  }

  getAttributeNames(): string[] {
    return Array.from(this._attributes.keys());
  }

  hasAttribute(name: string): boolean {
    return this._attributes.has(name);
  }

  get attributes(): { name: string; value: string }[] {
    const result: { name: string; value: string }[] = [];
    for (const [name, value] of this._attributes) {
      result.push({ name, value });
    }
    return result;
  }

  addEventListener(type: string, listener: VirtualEventHandler): void {
    let listeners = this._eventListeners.get(type);
    if (!listeners) {
      listeners = [];
      this._eventListeners.set(type, listeners);
    }
    listeners.push(listener);
  }

  removeEventListener(type: string, listener: VirtualEventHandler): void {
    const listeners = this._eventListeners.get(type);
    if (!listeners) return;
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  dispatchEvent(event: VirtualEvent | Event): boolean {
    const type: string = event.type;
    const isVirtual = event instanceof VirtualEvent;

    if (isVirtual && (event as VirtualEvent).target === null) {
      (event as VirtualEvent).target = this;
    }

    const listeners = this._eventListeners.get(type);
    let immediateStopped = false;
    let propagationStopped = false;
    if (listeners) {
      for (const listener of [...listeners]) {
        if (isVirtual) {
          (event as VirtualEvent).currentTarget = this;
        }
        listener(event);
        if (isVirtual) {
          immediateStopped = (event as VirtualEvent).isImmediatePropagationStopped;
          propagationStopped = (event as VirtualEvent).isPropagationStopped;
        } else if (event instanceof Event) {
          // Native Event: cancelBubble reflects stopPropagation() calls.
          // There is no standard API to detect stopImmediatePropagation() on
          // native Events, so we only track propagation here.
          propagationStopped = event.cancelBubble;
        }
        if (immediateStopped) {
          break;
        }
      }
    }
    if (isVirtual) {
      (event as VirtualEvent).currentTarget = null;
      propagationStopped = (event as VirtualEvent).isPropagationStopped;
    } else if (event instanceof Event) {
      propagationStopped = event.cancelBubble;
    }
    // Bubble
    const bubbles = event.bubbles;
    if (bubbles && !propagationStopped && this.parentNode) {
      const parent = this.parentNode;
      if (parent instanceof VirtualHTMLElement) {
        parent.dispatchEvent(event);
      }
    }
    if (isVirtual) {
      return !(event as VirtualEvent).isDefaultPrevented;
    }
    if (typeof (event as Event).defaultPrevented === "boolean") {
      return !(event as Event).defaultPrevented;
    }
    return true;
  }

  querySelector(selector: string): VirtualHTMLElement | null {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  querySelectorAll(selector: string): VirtualHTMLElement[] {
    const parts = VirtualHTMLElement._splitSelectorParts(selector.trim());
    if (parts.length === 1) {
      const parsed = VirtualHTMLElement._parseSelector(parts[0]);
      const results: VirtualHTMLElement[] = [];
      this._querySelectorAllParsed(parsed, results);
      return results;
    }

    // Multi-part selector: descendant combinator (e.g. "#parent child")
    let currentRoots: VirtualHTMLElement[] = [this];
    for (const part of parts) {
      const parsed = VirtualHTMLElement._parseSelector(part);
      const nextMatches: VirtualHTMLElement[] = [];
      for (const root of currentRoots) {
        root._querySelectorAllParsed(parsed, nextMatches);
      }
      currentRoots = nextMatches;
    }

    // Deduplicate while preserving order
    const seen = new Set<VirtualHTMLElement>();
    return currentRoots.filter((el) => {
      if (seen.has(el)) return false;
      seen.add(el);
      return true;
    });
  }

  /**
   * Splits a selector string on whitespace, but preserves quoted attribute
   * values (e.g. `[content='Cube Clicks: 0, Label Clicks: 1']`).
   */
  private static _splitSelectorParts(selector: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inBracket = false;
    let quoteChar: string | null = null;
    for (let i = 0; i < selector.length; i++) {
      const ch = selector[i];
      if (quoteChar) {
        current += ch;
        if (ch === quoteChar) {
          quoteChar = null;
        }
      } else if (ch === "[") {
        inBracket = true;
        current += ch;
      } else if (ch === "]") {
        inBracket = false;
        current += ch;
      } else if (inBracket && (ch === "'" || ch === '"')) {
        quoteChar = ch;
        current += ch;
      } else if (!inBracket && /\s/.test(ch)) {
        if (current) {
          parts.push(current);
          current = "";
        }
      } else {
        current += ch;
      }
    }
    if (current) {
      parts.push(current);
    }
    return parts;
  }

  private static _warnUnsupportedSelector(selector: string): void {
    // Detect common selector features that are not supported
    if (selector.includes(".") && /\.[a-zA-Z]/.test(selector)) {
      console.warn(
        `VirtualHTMLElement.querySelector: class selectors (.class) are not supported. Selector: "${selector}"`,
      );
    }
    // Warn about child (>), adjacent sibling (+), and general sibling (~) combinators,
    // but NOT descendant combinators (whitespace) which are supported.
    // Check if any combinator character appears outside of attribute selectors ([...]).
    if (/[>+~]/.test(selector)) {
      let hasCombinatorOutsideBrackets = false;
      let inBrackets = false;
      for (let i = 0; i < selector.length; i++) {
        const ch = selector[i];
        if (ch === "[") inBrackets = true;
        else if (ch === "]") inBrackets = false;
        else if (!inBrackets && (ch === ">" || ch === "+" || ch === "~")) {
          hasCombinatorOutsideBrackets = true;
          break;
        }
      }
      if (hasCombinatorOutsideBrackets) {
        console.warn(
          `VirtualHTMLElement.querySelector: combinators (>, +, ~) are not supported. Selector: "${selector}"`,
        );
      }
    }
    if (selector.includes(",")) {
      console.warn(
        `VirtualHTMLElement.querySelector: comma-separated selectors are not supported. Selector: "${selector}"`,
      );
    }
    if (/:(?!not\()/.test(selector)) {
      console.warn(
        `VirtualHTMLElement.querySelector: pseudo-selectors other than :not() are not supported. Selector: "${selector}"`,
      );
    }
  }

  private static _parseSelector(selector: string): ParsedSelector {
    let tag: string | null = null;
    const attrs: ParsedAttrCondition[] = [];
    let negated: ParsedAttrCondition[] | null = null;

    let remaining = selector.trim();

    VirtualHTMLElement._warnUnsupportedSelector(remaining);

    if (remaining.includes(",")) {
      return { tag: null, attrs: [], negated: null };
    }

    // :not(...) at the end
    const notIdx = remaining.lastIndexOf(":not(");
    if (notIdx !== -1 && remaining.endsWith(")")) {
      const inner = remaining.slice(notIdx + 5, -1).trim();
      remaining = remaining.slice(0, notIdx).trim();
      negated = [];
      // Parse inner as attribute conditions
      const innerParsed = VirtualHTMLElement._parseSelector(inner);
      if (innerParsed.tag) {
        negated.push({ name: "__tag__", op: "eq", value: innerParsed.tag });
      }
      negated.push(...innerParsed.attrs);
    }

    // Extract [attr] / [attr="value"] conditions first
    const attrRegex = /\[([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?\]/g;
    let attrMatch;
    let cleanedSelector = remaining;
    while ((attrMatch = attrRegex.exec(remaining)) !== null) {
      if (attrMatch[2] !== undefined) {
        attrs.push({ name: attrMatch[1], op: "eq", value: attrMatch[2] });
      } else {
        attrs.push({ name: attrMatch[1], op: "exists" });
      }
    }
    cleanedSelector = cleanedSelector.replace(attrRegex, "").trim();

    // #id shorthand (may be combined with tag and/or [attr] selectors)
    const idMatch = cleanedSelector.match(/^([a-zA-Z0-9-]*)#([a-zA-Z0-9_-]+)$/);
    if (idMatch) {
      if (idMatch[1]) {
        tag = idMatch[1].toUpperCase();
      }
      attrs.push({ name: "id", op: "eq", value: idMatch[2] });
      return { tag, attrs, negated };
    }

    if (cleanedSelector) {
      tag = cleanedSelector.toUpperCase();
    }

    return { tag, attrs, negated };
  }

  private static _matchesParsed(element: VirtualHTMLElement, parsed: ParsedSelector): boolean {
    if (parsed.tag && element.nodeName !== parsed.tag) {
      return false;
    }
    for (const cond of parsed.attrs) {
      if (cond.op === "exists") {
        if (!element.hasAttribute(cond.name)) return false;
      } else {
        if (element.getAttribute(cond.name) !== cond.value) return false;
      }
    }
    if (parsed.negated) {
      // All negated conditions must NOT match
      for (const cond of parsed.negated) {
        if (cond.name === "__tag__" && cond.op === "eq") {
          if (element.nodeName === cond.value) return false;
        } else if (cond.op === "exists") {
          if (element.hasAttribute(cond.name)) return false;
        } else {
          if (element.getAttribute(cond.name) === cond.value) return false;
        }
      }
    }
    return true;
  }

  private _querySelectorAllParsed(parsed: ParsedSelector, results: VirtualHTMLElement[]): void {
    for (const child of this.childNodes) {
      if (child instanceof VirtualHTMLElement) {
        if (VirtualHTMLElement._matchesParsed(child, parsed)) {
          results.push(child);
        }
        child._querySelectorAllParsed(parsed, results);
      }
    }
  }

  get innerHTML(): string {
    return this._serializeChildren();
  }

  private _serializeChildren(): string {
    let html = "";
    for (const child of this.childNodes) {
      if (child instanceof VirtualTextNode) {
        html += VirtualHTMLElement._escapeText(child.textContent ?? "");
      } else if (child instanceof VirtualHTMLElement) {
        html += child.outerHTML;
      }
    }
    return html;
  }

  private static _escapeAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private static _escapeText(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  set innerHTML(value: string) {
    // Remove all children, triggering disconnectedCallback
    while (this.childNodes.length > 0) {
      this.removeChild(this.childNodes[this.childNodes.length - 1]);
    }
    if (value !== "") {
      throw new Error(
        "VirtualHTMLElement does not support setting innerHTML to non-empty strings. Use DOM manipulation methods instead.",
      );
    }
  }

  // Compatibility: used by DOMSanitizer
  get outerHTML(): string {
    const tag = this.nodeName.toLowerCase();
    let attrs = "";
    for (const [name, value] of this._attributes) {
      attrs += ` ${name}="${VirtualHTMLElement._escapeAttr(value)}"`;
    }
    const inner = this._serializeChildren();
    return `<${tag}${attrs}>${inner}</${tag}>`;
  }

  connectedCallback(): void {
    // no-op, overridden by subclasses
  }

  disconnectedCallback(): void {
    // no-op, overridden by subclasses
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    // no-op, overridden by subclasses
  }
}

interface ParsedAttrCondition {
  name: string;
  op: "exists" | "eq";
  value?: string;
}

interface ParsedSelector {
  tag: string | null;
  attrs: ParsedAttrCondition[];
  negated: ParsedAttrCondition[] | null;
}
