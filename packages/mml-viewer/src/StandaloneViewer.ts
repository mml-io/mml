import { parseBoolAttribute } from "@mml-io/mml-web";

import { applySrcUrl } from "./character";
import { FormIteration } from "./FormIteration";
import { GraphicsMode } from "./GraphicsMode";
import { MMLSourceDefinition } from "./MMLSourceDefinition";
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

    // Listen for postMessage events to update avatar URL
    window.addEventListener("message", (event) => {
      this.handlePostMessage(event);
    });

    this.handleParams();
  }

  private handlePostMessage(event: MessageEvent) {
    const isAvatarUpdate =
      event?.data?.type === "updateAvatarUrl" && typeof event.data.avatarUrl === "string";
    if (isAvatarUpdate) {
      this.updateAvatarUrl(event.data.avatarUrl);
    }
  }

  private async updateAvatarUrl(avatarUrl: string) {
    if (!avatarUrl.endsWith(".mml")) {
      console.error("Received avatar URL does not end with .mml");
      return;
    }

    const mmlRoot = this.getMMLRoot();
    if (!mmlRoot) {
      console.error("Failed to find MML root");
      return;
    }

    const mmlContent = await fetch(avatarUrl);
    if (!mmlContent.ok) {
      console.error("Failed to fetch MML content");
      return;
    }

    const mmlText = await mmlContent.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(mmlText, "text/xml");

    const characterElement = doc.querySelector("m-character");
    if (!characterElement) {
      console.error("No m-character element found in MML content");
      return;
    }

    const srcUrl = characterElement.getAttribute("src");
    if (!srcUrl) {
      console.error("No src attribute found on m-character element");
      return;
    }

    applySrcUrl(mmlRoot, srcUrl);
  }

  private getMMLRoot(): Element | null {
    if (!this.graphicsMode) {
      console.error("No graphics mode");
      return null;
    }

    const internalMode = (this.graphicsMode as any).internalMode;
    if (!internalMode?.loadedState) {
      console.error("No internal mode or loadedState");
      return null;
    }

    const loadedState = internalMode.loadedState;
    if (!loadedState?.mmlNetworkSource?.remoteDocumentWrapper?.remoteDocument) {
      console.error("No remoteDocument found");
      return null;
    }

    const mmlRoot =
      loadedState.mmlNetworkSource.remoteDocumentWrapper.remoteDocument.children[0]?.children[0];
    if (!mmlRoot) {
      console.error("No mmlRoot found in remoteDocument");
      return null;
    }

    return mmlRoot;
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
          !noUI,
        );
      } else if (renderer === "threejs") {
        this.graphicsMode = new ThreeJSMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration,
          !noUI,
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
