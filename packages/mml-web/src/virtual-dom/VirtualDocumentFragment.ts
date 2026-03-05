import { VIRTUAL_FRAGMENT_BRAND } from "./brands";
import { VirtualNode } from "./VirtualNode";

export class VirtualDocumentFragment extends VirtualNode {
  readonly [VIRTUAL_FRAGMENT_BRAND] = true as const;

  constructor() {
    super("#document-fragment");
  }
}
