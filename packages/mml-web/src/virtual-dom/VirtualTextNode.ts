import { VIRTUAL_TEXT_BRAND } from "./brands";
import { registerTextNodeFactory, VirtualNode } from "./VirtualNode";

export class VirtualTextNode extends VirtualNode {
  readonly [VIRTUAL_TEXT_BRAND] = true as const;

  private _text: string;

  constructor(text: string = "") {
    super("#text");
    this._text = text;
  }

  get textContent(): string {
    return this._text;
  }

  set textContent(value: string | null) {
    this._text = value ?? "";
  }
}

// Register the factory so VirtualNode.textContent setter can create text nodes
// without a circular import dependency.
registerTextNodeFactory((text: string) => new VirtualTextNode(text));
