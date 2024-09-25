import { MElement } from "../../elements/MElement";
import { GraphicsAdapter } from "../../GraphicsAdapter";
import { LoadingProgressManager } from "../../loading/LoadingProgressManager";
import { IMMLScene } from "../../MMLScene";
import { RemoteDocumentWrapper } from "../../websocket/RemoteDocumentWrapper";
import { fetchRemoteStaticMML } from "../fetchRemoteStaticMML";
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const windowTarget = targetElement.ownerDocument.defaultView!;

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
      windowTarget,
      wrappedScene,
      () => {
        // Events targeting static MML frames should not be sent
      },
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.remoteDocument);
    // Promise is intentionally ignored here
    fetchRemoteStaticMML(address)
      .then((remoteDocumentBody) => {
        this.remoteDocumentWrapper.remoteDocument.append(remoteDocumentBody);
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
