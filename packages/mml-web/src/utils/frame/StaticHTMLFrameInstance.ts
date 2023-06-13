import { DOMSanitizer } from "@mml-io/networked-dom-web";
import * as THREE from "three";

import { createWrappedScene } from "./CreateWrappedScene";
import { IMMLScene } from "../../MMLScene";
import { RemoteDocumentWrapper } from "../../websocket/RemoteDocumentWrapper";

export class StaticHTMLFrameInstance {
  public readonly src: string;
  public readonly container: THREE.Group;
  private readonly remoteDocumentWrapper: RemoteDocumentWrapper;
  private readonly targetForWrapper: HTMLElement;
  private readonly scene: IMMLScene;

  static parser = new DOMParser();

  constructor(targetElement: HTMLElement, src: string, scene: IMMLScene) {
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene;
    this.container = new THREE.Group();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const windowTarget = targetElement.ownerDocument.defaultView!;

    const wrappedScene: IMMLScene = createWrappedScene(this.scene, this.container);

    this.remoteDocumentWrapper = new RemoteDocumentWrapper(windowTarget, wrappedScene, () => {
      // Events targeting static MML frames should not be sent
    });
    this.targetForWrapper.append(this.remoteDocumentWrapper.element);
    // Promise is intentionally ignored here
    this.fetch();
  }

  private async fetch() {
    let response;
    try {
      response = await fetch(this.src);
    } catch (err) {
      console.error("Failed to fetch static MML page", err);
      return;
    }
    const text = await response.text();
    const remoteDocumentAsHTMLNode = StaticHTMLFrameInstance.parser.parseFromString(
      text,
      "text/html",
    );
    DOMSanitizer.sanitise(remoteDocumentAsHTMLNode.body);
    this.remoteDocumentWrapper.element.append(remoteDocumentAsHTMLNode.body);
  }

  public dispose() {
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.element);
  }
}
