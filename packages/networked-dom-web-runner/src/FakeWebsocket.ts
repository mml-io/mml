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
      listener.bind(this)(new Event("open"));
      return;
    }
    super.addEventListener(type, listener, options);
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    this.sendCallback(data);
  }
}

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
