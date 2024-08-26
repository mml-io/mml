import { parseBoolAttribute } from "./attribute-handling";
import { MElement } from "../elements";
import { DebugHelperGraphics } from "../MMLGraphicsInterface";

const debugAttributeName = "debug";

export class DebugHelper {
  static observedAttributes = [debugAttributeName];
  private element: MElement;

  private debugGraphics: DebugHelperGraphics | null = null;

  constructor(element: MElement) {
    this.element = element;
  }

  public getContainer() {
    return this.element.getContainer();
  }

  public handle(name: string, newValue: string) {
    if (name === debugAttributeName) {
      if (parseBoolAttribute(newValue, false)) {
        if (!this.debugGraphics) {
          this.debugGraphics = new (this.element
            .getScene()
            .getGraphicsAdapterFactory().MMLDebugHelperGraphicsInterface)(this);
        }
      } else {
        if (this.debugGraphics) {
          this.debugGraphics.dispose();
          this.debugGraphics = null;
        }
      }
    }
  }
}
