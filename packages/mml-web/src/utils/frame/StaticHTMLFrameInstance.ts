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

    const address = this.srcToAddress(this.src);

    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      address,
      windowTarget,
      wrappedScene,
      () => {
        // Events targeting static MML frames should not be sent
      },
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.element);
    // Promise is intentionally ignored here
    this.fetch(address);
  }

  private srcToAddress(src: string): string {
    // Convert the potentially relative src to an absolute address using the document host
    const documentLocation = this.getDocumentHost();
    // First check if the src is a host-relative path
    try {
      // Check if the src is a valid URL - if so then it's already absolute
      const url = new URL(src);
      return url.toString();
    } catch (err) {
      // Do nothing
    }
    let protocol = documentLocation.protocol;
    console.log("protocol", protocol);
    if (protocol === "ws:") {
      protocol = "http:";
    } else if (protocol === "wss:") {
      protocol = "https:";
    }
    if (src.startsWith("/")) {
      // If the src is host-relative then we can just use the document host
      return `${protocol}//${documentLocation.host}${src}`;
    } else {
      // Otherwise we need to use the document host as a base
      const path = documentLocation.pathname;
      const lastSlashIndex = path.lastIndexOf("/");
      if (lastSlashIndex === -1) {
        return `${protocol}//${documentLocation.host}/${src}`;
      }
      const pathWithoutFilename = path.substring(0, lastSlashIndex + 1);
      return `${protocol}//${documentLocation.host}${pathWithoutFilename}${src}`;
    }
  }

  private getDocumentHost(): URL | Location {
    const remoteDocument = this.targetForWrapper.getRemoteDocument();
    if (remoteDocument) {
      const remoteDocumentAddress = remoteDocument.getDocumentAddress();
      if (remoteDocumentAddress) {
        const url = new URL(remoteDocumentAddress);
        return url;
      }
    }
    return window.location;
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
    this.remoteDocumentWrapper.element.append(remoteDocumentAsHTMLNode.body);
  }

  public dispose() {
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.element);
  }
}
