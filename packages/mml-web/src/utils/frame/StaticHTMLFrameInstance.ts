import { DOMSanitizer } from "@mml-io/networked-dom-web";
import * as THREE from "three";

import { createWrappedScene } from "./CreateWrappedScene";
import { MElement } from "../../elements/MElement";
import { IMMLScene } from "../../MMLScene";
import { RemoteDocumentWrapper } from "../../websocket/RemoteDocumentWrapper";

export class StaticHTMLFrameInstance {
  public readonly src: string;
  public readonly container: THREE.Group;
  private readonly remoteDocumentWrapper: RemoteDocumentWrapper;
  private readonly targetForWrapper: MElement;
  private readonly scene: IMMLScene;

  static parser = new DOMParser();

  constructor(targetElement: MElement, src: string, scene: IMMLScene) {
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene;
    this.container = new THREE.Group();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const windowTarget = targetElement.ownerDocument.defaultView!;

    const wrappedScene: IMMLScene = createWrappedScene(this.scene, this.container);

    const address = this.targetForWrapper.contentSrcToContentAddress(this.src);

    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      address,
      windowTarget,
      wrappedScene,
      () => {
        // Events targeting static MML frames should not be sent
      },
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.remoteDocument);
    // Promise is intentionally ignored here
    this.fetch(address);
  }

  private async fetch(address: string) {
    let response;
    try {
      response = await fetch(address);
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
    this.remoteDocumentWrapper.remoteDocument.append(remoteDocumentAsHTMLNode.body);
  }

  public dispose() {
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.remoteDocument);
  }
}
