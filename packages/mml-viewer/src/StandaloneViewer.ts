import { parseBoolAttribute } from "@mml-io/mml-web";

import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSourceDefinition } from "./MMLSourceDefinition";
import { PlayCanvasMode } from "./PlayCanvasMode";
import { PlayCanvasModeOptions } from "./PlayCanvasModeInternal";
import { QueryParamState } from "./QueryParamState";
import { TagsMode } from "./TagsMode";
import { ThreeJSMode } from "./ThreeJSMode";
import { ThreeJSModeOptions } from "./ThreeJSModeInternal";
import { hideUntilLoadedField, loadingStyleField, rendererField, urlField } from "./ui/fields";
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
    window.addEventListener("message", (event) => {
      this.handlePostMessage(event);
    });
    this.handleParams();
  }

  private handlePostMessage(event: MessageEvent) {
    const isParamUpdate =
      event?.data?.type === "params" &&
      typeof event.data.params === "object" &&
      event.data.params !== null;
    if (isParamUpdate) {
      this.updateUrlParams(event.data.params);
    }
  }

  private updateUrlParams(params: Record<string, string>) {
    const url = new URL(window.location.href);

    // Update URL search parameters with provided params
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });

    // Update the URL without causing a page reload
    window.history.pushState({}, "", url.toString());

    // Trigger parameter handling to apply the changes
    this.handleParams();
  }

  private handleParams() {
    const queryParamState = new QueryParamState(window.location.search);
    const formIteration = new FormIteration(queryParamState, this.viewerUI, this.formIteration);
    this.formIteration = formIteration;

    const url = formIteration.getFieldValue(urlField);
    const renderer = formIteration.getFieldValue(rendererField);
    const loadingStyle = formIteration.getFieldValue(loadingStyleField);
    const noUI = parseBoolAttribute(queryParamState.read("noUI"), false);
    if (noUI) {
      this.viewerUI.hide();
    } else {
      this.viewerUI.show();
    }

    if (this.graphicsMode && this.graphicsMode.type !== renderer) {
      this.graphicsMode.dispose();
      this.graphicsMode = null;
    }

    let source: MMLSourceDefinition;
    if (url) {
      source = { url };
      if (this.source && this.source.url !== url) {
        if (this.graphicsMode) {
          // We know this is the correct graphics mode because we just checked the type above
          // We can reuse it with a new source
          this.graphicsMode.updateSource(source);
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

    const hideUntilLoaded = parseBoolAttribute(
      formIteration.getFieldValue(hideUntilLoadedField),
      false,
    );

    const options: ThreeJSModeOptions | PlayCanvasModeOptions = {
      loadingStyle: loadingStyle as "bar" | "spinner",
      hideUntilLoaded,
      showDebugLoading: !noUI,
    };

    if (!this.graphicsMode) {
      if (renderer === "playcanvas") {
        this.graphicsMode = new PlayCanvasMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration,
          options,
        );
      } else if (renderer === "threejs") {
        this.graphicsMode = new ThreeJSMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration,
          options,
        );
      } else if (renderer === "tags") {
        this.graphicsMode = new TagsMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration,
          !noUI,
        );
      }
    } else {
      this.graphicsMode.update(formIteration);
    }
  }
}
