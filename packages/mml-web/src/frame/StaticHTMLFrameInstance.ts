import { IDocumentFactory, VIRTUAL_DOCUMENT_BRAND } from "@mml-io/networked-dom-web";

import { MElement } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { LoadingProgressManager } from "../loading";
import { DocumentSource, fetchRemoteStaticMML, RemoteDocumentWrapper } from "../remote-document";
import { getGlobalWindow } from "../runtime-env";
import { IMMLScene } from "../scene";
import { createWrappedScene } from "./CreateWrappedScene";

export class StaticHTMLFrameInstance<G extends GraphicsAdapter = GraphicsAdapter> {
  public readonly src: string;
  private readonly remoteDocumentWrapper: RemoteDocumentWrapper<G>;
  private readonly targetForWrapper: MElement<G>;
  private readonly scene: IMMLScene<G>;
  private loadingProgressManager: LoadingProgressManager;

  constructor(targetElement: MElement<G>, src: string, scene: IMMLScene<G>) {
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene;

    const isVirtual = (targetElement.ownerDocument as any)?.[VIRTUAL_DOCUMENT_BRAND] === true;

    const windowTarget = isVirtual
      ? targetElement.ownerDocument
      : (targetElement.ownerDocument?.defaultView ?? getGlobalWindow() ?? null);

    this.loadingProgressManager = new LoadingProgressManager();
    this.loadingProgressManager.addProgressCallback(() => {
      scene.getLoadingProgressManager?.()?.updateDocumentProgress(this);
    });

    const address = this.targetForWrapper.contentSrcToContentAddress(this.src);

    scene
      .getLoadingProgressManager?.()
      ?.addLoadingDocument(this, address, this.loadingProgressManager);

    const wrappedScene: IMMLScene<G> = createWrappedScene(this.scene, this.loadingProgressManager);

    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      address,
      windowTarget as DocumentSource,
      wrappedScene,
      () => {
        // Events targeting static MML frames should not be sent
      },
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.remoteDocument);

    const documentFactory = isVirtual
      ? (targetElement.ownerDocument as IDocumentFactory | undefined)
      : undefined;

    // Promise is intentionally ignored here
    fetchRemoteStaticMML(address, documentFactory)
      .then((remoteDocumentBody) => {
        this.remoteDocumentWrapper.remoteDocument.append(remoteDocumentBody as any);
        this.loadingProgressManager.setInitialLoad(true);
      })
      .catch((err) => {
        this.loadingProgressManager.setInitialLoad(err);
      });
  }

  public dispose() {
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.remoteDocument);
    this.loadingProgressManager.removeLoadingDocument(this);
  }
}
