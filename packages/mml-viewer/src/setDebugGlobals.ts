import {
  GraphicsAdapter,
  MMLScene,
  RemoteDocumentWrapper,
  StandaloneGraphicsAdapter,
} from "@mml-io/mml-web";

declare global {
  interface Window {
    "mml-web-client": {
      mmlScene: MMLScene<StandaloneGraphicsAdapter>;
      remoteDocumentWrapper: RemoteDocumentWrapper<GraphicsAdapter>;
    };
  }
}

export function setDebugGlobals({
  mmlScene,
  remoteDocumentWrapper,
}: {
  mmlScene: MMLScene<StandaloneGraphicsAdapter>;
  remoteDocumentWrapper: RemoteDocumentWrapper;
}) {
  window["mml-web-client"] = {
    mmlScene,
    remoteDocumentWrapper,
  };
}
