import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import {
  DOM_MESSAGE_TYPE,
  LogMessage,
  ObservableDOMInterface,
  observableDOMInterfaceToMessageSender,
  ObservableDOMMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

import {
  FromBroadcastInstanceMessage,
  INSTANCE_MESSAGE_TYPE,
  ToBroadcastInstanceMessage,
} from "./broadcast-messages";

export class NetworkedDOMBroadcastReceiver {
  public readonly editableNetworkedDOM: EditableNetworkedDOM;
  private currentRevisionState: null | {
    revisionId: number;
    documentTime: number;
    snapshot: any;
    loadedState: null | {
      remoteObservableDOM: ObservableDOMInterface;
      networkedDOMCallback: (
        message: ObservableDOMMessage,
        observableDOM: ObservableDOMInterface,
      ) => void;
    };
    toInstanceCallback: (message: ToObservableDOMInstanceMessage) => void;
  } = null;
  private sendMessage: (message: ToBroadcastInstanceMessage) => void;

  constructor(
    sendMessage: (message: ToBroadcastInstanceMessage) => void,
    ignoreTextNodes = true,
    logCallback?: (logMessage: LogMessage) => void,
  ) {
    this.sendMessage = sendMessage;
    this.editableNetworkedDOM = new EditableNetworkedDOM(
      "file://test.html",
      (
        observableDOMParameters: ObservableDOMParameters,
        callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void,
      ) => {
        const currentState = this.currentRevisionState;
        if (currentState !== null) {
          const remoteObservableDOM: ObservableDOMInterface = observableDOMInterfaceToMessageSender(
            (message: ToObservableDOMInstanceMessage) => {
              currentState.toInstanceCallback(message);
            },
            () => {
              // no-op dispose - the remote side will dispose
            },
          );
          currentState.loadedState = {
            networkedDOMCallback: callback,
            remoteObservableDOM,
          };
          callback(
            {
              snapshot: currentState.snapshot,
              documentTime: currentState.documentTime,
            },
            remoteObservableDOM,
          );

          return remoteObservableDOM;
        } else {
          // No state yet - provide an empty implementation that drops messages until a revision is loaded
          const remoteObservableDOM: ObservableDOMInterface = observableDOMInterfaceToMessageSender(
            () => {
              // Drop messages
            },
            () => {
              // no-op dispose
            },
          );
          return remoteObservableDOM;
        }
      },
      ignoreTextNodes,
      logCallback,
    );
  }

  public handleMessage(parsed: FromBroadcastInstanceMessage) {
    if (parsed.type === INSTANCE_MESSAGE_TYPE) {
      const domMessage = parsed.message;
      if (domMessage.type === DOM_MESSAGE_TYPE) {
        const instanceMessage = domMessage.message;
        const revisionId = parsed.revisionId;
        if (
          this.currentRevisionState === null ||
          this.currentRevisionState.revisionId !== revisionId
        ) {
          // The first message for a new revision should be a "snapshot" message
          if (instanceMessage.snapshot) {
            this.currentRevisionState = {
              revisionId,
              loadedState: null,
              documentTime: instanceMessage.documentTime,
              snapshot: instanceMessage.snapshot,
              toInstanceCallback: (message: ToObservableDOMInstanceMessage) => {
                this.sendMessage({ type: INSTANCE_MESSAGE_TYPE, revisionId, message });
              },
            };
            // Cause the editableNetworkedDOM to reload and pick up this latest revision
            this.editableNetworkedDOM.load("", {});
          } else {
            console.error("Expected snapshot message");
            return;
          }
        } else {
          if (this.currentRevisionState.loadedState === null) {
            console.error("Expected loadedState to be set");
            return;
          }
          this.currentRevisionState.loadedState.networkedDOMCallback(
            instanceMessage,
            this.currentRevisionState.loadedState.remoteObservableDOM,
          );
        }
      } else {
        console.error("Unknown message type", domMessage);
      }
    }
  }
}
