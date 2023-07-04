import {
  ObservableDOMInterface,
  observableDOMInterfaceToMessageSender,
  ObservableDOMMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

import {
  CREATE_MESSAGE_TYPE,
  DISPOSE_MESSAGE_TYPE,
  FromRemoteInstanceMessage,
  INSTANCE_MESSAGE_TYPE,
  ToRemoteServerMessage,
} from "./relay-messages";

type InstanceHandle = {
  instanceId: number;
  receiveMessage: (msg: ObservableDOMMessage) => void;
  dispose: () => void;
};

export class RemoteNetworkedDOMInstanceClient {
  private instanceIdCounter = 1;
  private instanceHandles = new Map<number, InstanceHandle>();
  private disposed = false;
  private sendMessage: (message: ToRemoteServerMessage) => void;

  constructor(sendMessage: (message: ToRemoteServerMessage) => void) {
    this.sendMessage = sendMessage;
  }

  public handleMessage(parsed: FromRemoteInstanceMessage) {
    switch (parsed.type) {
      case INSTANCE_MESSAGE_TYPE: {
        const { instanceId, message, type } = parsed;
        const instanceHandle = this.instanceHandles.get(instanceId);
        if (instanceHandle) {
          if (type === INSTANCE_MESSAGE_TYPE) {
            instanceHandle.receiveMessage(message.message);
          } else {
            console.error("Unknown message type", type);
          }
        } else {
          console.error("No instance handler for", instanceId);
        }
        break;
      }
      default:
        console.warn("unknown message type received", parsed);
    }
  }

  public dispose() {
    this.disposed = true;
    for (const [, instanceHandle] of this.instanceHandles) {
      instanceHandle.dispose();
    }
  }

  public create(
    params: ObservableDOMParameters,
    callback: (message: ObservableDOMMessage, observableDOM: ObservableDOMInterface) => void,
  ): ObservableDOMInterface {
    const instanceId = this.instanceIdCounter++;

    this.sendMessage({
      type: CREATE_MESSAGE_TYPE,
      instanceId,
      parameters: params,
    });

    const observableDOMHandle = observableDOMInterfaceToMessageSender(
      (message: ToObservableDOMInstanceMessage) => {
        this.sendMessage({
          type: INSTANCE_MESSAGE_TYPE,
          instanceId,
          message,
        });
      },
      () => {
        this.sendMessage({
          type: DISPOSE_MESSAGE_TYPE,
          instanceId,
        });
        this.instanceHandles.delete(instanceId);
      },
    );

    const instanceHandle: InstanceHandle = {
      instanceId,
      receiveMessage: (msg: ObservableDOMMessage) => {
        callback(msg, observableDOMHandle);
      },
      dispose: () => {
        observableDOMHandle.dispose();
      },
    };

    this.instanceHandles.set(instanceId, instanceHandle);

    return observableDOMHandle;
  }
}
