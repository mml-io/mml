import { parseBoolAttribute } from "mml-web";

import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSourceDefinition } from "./MMLSource";
import { PlayCanvasMode } from "./PlayCanvasMode";
import { QueryParamState } from "./QueryParamState";
import { TagsMode } from "./TagsMode";
import { ThreeJSMode } from "./ThreeJSMode";
import { rendererField, urlField } from "./ui/fields";
import { ViewerUI } from "./ui/ViewerUI";

export class StandaloneViewer {
  private viewerUI = new ViewerUI();
  private graphicsMode: GraphicsMode | null = null;
  private formIteration: FormIteration | null = null;
  private source: MMLSourceDefinition | null = null;

  constructor(
    private windowTarget: Window,
    private targetForWrappers: HTMLElement,
  ) {
    window.addEventListener("popstate", () => {
      this.handleParams();
    });
    this.handleParams();
  }

  private handleParams() {
    const queryParamState = new QueryParamState(window.location.search);
    const formIteration = new FormIteration(queryParamState, this.viewerUI, this.formIteration);
    this.formIteration = formIteration;

    const url = formIteration.getFieldValue(urlField);
    const renderer = formIteration.getFieldValue(rendererField);
    const noUI = parseBoolAttribute(queryParamState.read("noUI"), false);
    if (noUI) {
      this.viewerUI.hide();
    } else {
      this.viewerUI.show();
    }

    let source: MMLSourceDefinition;
    if (url) {
      source = { url };
      if (this.source && this.source.url !== url) {
        if (this.graphicsMode) {
          this.graphicsMode.dispose();
          this.graphicsMode = null;
        }
      }
      this.source = source;
    } else {
      if (this.graphicsMode) {
        this.graphicsMode.dispose();
        this.graphicsMode = null;
      }
      this.viewerUI.showAddressMenu();
      this.formIteration.completed();
      return;
    }
    this.viewerUI.hideAddressMenu();

    if (this.graphicsMode && this.graphicsMode.type !== renderer) {
      this.graphicsMode.dispose();
      this.graphicsMode = null;
    }
    if (!this.graphicsMode) {
      if (renderer === "playcanvas") {
        this.graphicsMode = new PlayCanvasMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration,
        );
      } else if (renderer === "threejs") {
        this.graphicsMode = new ThreeJSMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration,
        );
      } else if (renderer === "tags") {
        this.graphicsMode = new TagsMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration,
        );
      }
    } else {
      this.graphicsMode.update(formIteration);
    }
  }
}
