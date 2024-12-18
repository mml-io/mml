import { Interaction } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { MMLGraphicsInterface } from "../scene";
import { tagAdapterDefaultTheme, TagAdapterThemeColors } from "./TagAdapterThemeColors";
import { TagDebugAdapterGraphicsInterface } from "./TagDebugAdapterGraphicsInterface";
import { TagDebugMElement } from "./TagDebugMElement";

export type TagDebugGraphicsAdapter = GraphicsAdapter<TagDebugMElement, null, HTMLElement> & {
  theme: TagAdapterThemeColors;
};

export class StandaloneTagDebugAdapter implements TagDebugGraphicsAdapter {
  collisionType: null;
  containerType: TagDebugMElement;

  private constructor(private element: HTMLElement) {
    this.element.style.background = this.theme.background;

    element.addEventListener("copy", function (e) {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection) {
        const range = selection.getRangeAt(0);
        const div = document.createElement("div");
        div.appendChild(range.cloneContents());
        const noCopyElements = div.querySelectorAll(".no-copy");
        noCopyElements.forEach((element) => element.remove());
        const asText = div.textContent;
        if (asText) {
          e.clipboardData?.setData("text/plain", asText);
        }
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interactionShouldShowDistance(interaction: Interaction<GraphicsAdapter>): number | null {
    return null;
  }

  public getGraphicsAdapterFactory(): MMLGraphicsInterface<this> {
    return TagDebugAdapterGraphicsInterface as MMLGraphicsInterface<this>;
  }

  public theme: TagAdapterThemeColors = tagAdapterDefaultTheme;

  public static async create(element: HTMLElement): Promise<StandaloneTagDebugAdapter> {
    element.style.overflow = "auto";
    const adapter = new StandaloneTagDebugAdapter(element);
    await adapter.init();
    return adapter;
  }

  async init(): Promise<void> {
    // No setup needed
    return Promise.resolve();
  }

  start() {
    // no-op
  }

  getUserPositionAndRotation() {
    return {
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resize(width: number, height: number) {
    // no-op
  }

  dispose() {
    // no-op
  }

  getRootContainer(): HTMLElement {
    return this.element;
  }
}
