import { ObservableDOMFactory } from "@mml-io/networked-dom-document";
import {
  DOM_MESSAGE_TYPE,
  ObservableDOMInterface,
  ObservableDOMMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

import {
  FromBroadcastInstanceMessage,
  INSTANCE_MESSAGE_TYPE,
  ToBroadcastInstanceMessage,
} from "./broadcast-messages";

export class NetworkedDOMBroadcastRunner {
  private sendMessage: (message: FromBroadcastInstanceMessage) => void;
  private domFactory: ObservableDOMFactory;
  private currentDOM: ObservableDOMInterface | null = null;
  private currentRevisionId = 0;

  constructor(
    sendMessage: (message: FromBroadcastInstanceMessage) => void,
    domFactory: ObservableDOMFactory,
  ) {
    this.sendMessage = sendMessage;
    this.domFactory = domFactory;
  }

  public handleMessage(message: ToBroadcastInstanceMessage) {
    if (this.currentDOM === null) {
      console.error("Received message for null instance", message);
      return;
    }
    const revisionId = message.revisionId;
    if (revisionId !== this.currentRevisionId) {
      if (message.message.type === "removeConnectedUserId") {
        /*
         Ignore and don't warn - this is a common case where the revision being stopped attempts to send removal events
         for connections, but they aren't necessary
        */
        return;
      }
      console.warn("Ignoring message for non-current revision", revisionId);
      return;
    }
    const toDOMMessage: ToObservableDOMInstanceMessage = message.message;
    if (toDOMMessage.type === "addConnectedUserId") {
      this.currentDOM.addConnectedUserId(toDOMMessage.connectionId);
    } else if (toDOMMessage.type === "removeConnectedUserId") {
      this.currentDOM.removeConnectedUserId(toDOMMessage.connectionId);
    } else if (toDOMMessage.type === "dispatchRemoteEventFromConnectionId") {
      this.currentDOM.dispatchRemoteEventFromConnectionId(
        toDOMMessage.connectionId,
        toDOMMessage.event,
      );
    } else {
      console.error("Unknown message type", toDOMMessage);
    }
  }

  public load(observableDOMParameters: ObservableDOMParameters) {
    const revisionId = ++this.currentRevisionId;

    if (this.currentDOM !== null) {
      this.currentDOM.dispose();
      this.currentDOM = null;
    }

    this.currentDOM = this.domFactory(observableDOMParameters, (message: ObservableDOMMessage) => {
      if (revisionId !== this.currentRevisionId) {
        console.warn("Ignoring message for non-current revision", revisionId);
        return;
      }

      this.sendMessage({
        type: INSTANCE_MESSAGE_TYPE,
        revisionId: this.currentRevisionId,
        message: {
          type: DOM_MESSAGE_TYPE,
          message,
        },
      });
    });
  }
}
