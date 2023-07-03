import {
  FromObservableDOMInstanceMessage,
  ObservableDOMParameters,
  ToObservableDOMInstanceMessage,
} from "@mml-io/observable-dom-common";

import {
  CREATE_MESSAGE_TYPE,
  DISPOSE_MESSAGE_TYPE,
  FromRemoteServerMessage,
  INSTANCE_MESSAGE_TYPE,
  ToRemoteServerMessage,
} from "./relay-messages";

export type RemoteObservableDOMInstance = {
  handleMessage(message: ToObservableDOMInstanceMessage): void;
  dispose(): void;
};

export class RemoteNetworkedDOMInstanceServer {
  private currentInstances = 0;
  private instances = new Map<number, RemoteObservableDOMInstance>();
  private instanceCreateFn: (
    params: ObservableDOMParameters,
    send: (fromInstance: FromObservableDOMInstanceMessage) => void,
  ) => RemoteObservableDOMInstance;
  private sendMessage: (message: FromRemoteServerMessage) => void;

  constructor(
    sendMessage: (message: FromRemoteServerMessage) => void,
    createInstance: (
      params: ObservableDOMParameters,
      send: (fromInstance: FromObservableDOMInstanceMessage) => void,
    ) => RemoteObservableDOMInstance,
  ) {
    this.sendMessage = sendMessage;
    this.instanceCreateFn = createInstance;
  }

  public handleMessage(message: ToRemoteServerMessage) {
    if (message.type === CREATE_MESSAGE_TYPE) {
      const params = message.parameters;

      const instanceId = message.instanceId;

      this.currentInstances++;
      const instance = this.instanceCreateFn(
        params,
        (message: FromObservableDOMInstanceMessage) => {
          this.sendMessage({
            type: INSTANCE_MESSAGE_TYPE,
            instanceId,
            message,
          });
        },
      );
      this.instances.set(instanceId, instance);
    } else if (message.type === DISPOSE_MESSAGE_TYPE) {
      const { instanceId } = message;
      const instance = this.instances.get(instanceId);
      if (!instance) {
        console.error("instance.dispose", instanceId, "not found");
        return;
      }
      this.currentInstances--;
      instance.dispose();
      this.instances.delete(instanceId);
    } else if (message.type === INSTANCE_MESSAGE_TYPE) {
      const { instanceId } = message;
      const instance = this.instances.get(instanceId);
      if (!instance) {
        console.error("instance.message", instanceId, "not found");
        return;
      }
      instance.handleMessage(message.message);
    }
  }

  dispose() {
    for (const [, observableDOM] of this.instances) {
      this.currentInstances--;
      observableDOM.dispose();
    }
  }
}
