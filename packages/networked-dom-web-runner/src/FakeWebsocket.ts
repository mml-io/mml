/**
 * WebsocketEnd is one end of a FakeWebsocket connection. It is used to simulate a websocket connection for testing or
 * matching the interface of a real websocket connection without doing any actual networking.
 */
class WebsocketEnd extends EventTarget {
  private readonly sendCallback: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  public readonly protocol: string;

  constructor(
    protocol: string,
    sendCallback: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void,
  ) {
    super();
    this.protocol = protocol;
    this.sendCallback = sendCallback;
  }

  public close() {
    this.dispatchEvent(new CloseEvent("close"));
  }

  public addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type === "open") {
      setTimeout(() => {
        listener.bind(this)(new Event("open"));
      }, 1);
      return;
    }
    super.addEventListener(type, listener, options);
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.sendCallback(data);
  }
}

/**
 * FakeWebsocket is a pair of WebsocketEnds that are connected to each other. It is used to simulate a websocket
 * connection for testing or matching the interface of a real websocket connection without doing any actual networking.
 */
export class FakeWebsocket {
  public clientSideWebsocket: WebsocketEnd;
  public serverSideWebsocket: WebsocketEnd;

  constructor(protocol: string) {
    this.clientSideWebsocket = new WebsocketEnd(protocol, (data) => {
      this.serverSideWebsocket.dispatchEvent(
        new MessageEvent("message", {
          data,
        }),
      );
    });

    this.serverSideWebsocket = new WebsocketEnd(protocol, (data) => {
      this.clientSideWebsocket.dispatchEvent(
        new MessageEvent("message", {
          data,
        }),
      );
    });
  }
}
