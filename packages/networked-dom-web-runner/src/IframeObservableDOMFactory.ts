import { ObservableDomFactory } from "@mml-io/networked-dom-document";
import {
  ObservableDomInterface,
  ObservableDomMessage,
  ObservableDOMParameters,
  RemoteEvent,
} from "@mml-io/observable-dom-common";


import { RunnerIframe } from "./RunnerIframe";

export const IframeObservableDOMFactory: ObservableDomFactory = (
  observableDOMParameters: ObservableDOMParameters,
  callback: (message: ObservableDomMessage) => void,
) => {
  const runnerIframe = new RunnerIframe(
    observableDOMParameters,
    (msg: FromInstanceMessageTypes) => {
      if (msg.type === "dom") {
        callback(msg.message);
      }
    },
  );

  const remoteObservableDOM: ObservableDomInterface = {
    addConnectedUserId(connectionId: number): void {
      runnerIframe.sendMessageToRunner({
        type: "addConnectedUserId",
        connectionId,
      });
    },
    addIPCWebsocket(): void {
      throw new Error("Not implemented");
    },
    dispatchRemoteEventFromConnectionId(connectionId: number, remoteEvent: RemoteEvent): void {
      runnerIframe.sendMessageToRunner({
        type: "dispatchRemoteEventFromConnectionId",
        connectionId,
        event: remoteEvent,
      });
    },
    dispose(): void {
      runnerIframe.dispose();
    },
    removeConnectedUserId(connectionId: number): void {
      runnerIframe.sendMessageToRunner({
        type: "removeConnectedUserId",
        connectionId,
      });
    },
  };
  return remoteObservableDOM;
};
