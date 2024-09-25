import { MElement } from "../elements";
import { DebugHelperGraphics } from "../graphics/DebugHelperGraphics";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { parseBoolAttribute } from "../utils/attribute-handling";

const debugAttributeName = "debug";

export class DebugHelper<G extends GraphicsAdapter = GraphicsAdapter> {
  static observedAttributes = [debugAttributeName];

  private debugGraphics: DebugHelperGraphics<G> | null = null;

  constructor(public element: MElement<G>) {}

  public getContainer(): G["containerType"] {
    return this.element.getContainer();
  }

  public handle(name: string, newValue: string) {
    if (name === debugAttributeName) {
      if (parseBoolAttribute(newValue, false)) {
        if (!this.debugGraphics) {
          this.debugGraphics = this.element
            .getScene()
            .getGraphicsAdapter()
            .getGraphicsAdapterFactory()
            .MMLDebugHelperGraphicsInterface(this);
        }
      } else {
        this.debugGraphics?.dispose();
        this.debugGraphics = null;
      }
    }
  }
}
