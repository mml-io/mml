import { NetworkedDOMWebsocket } from "@mml-io/networked-dom-web";

const thisScript = document.currentScript as HTMLScriptElement;
const scriptUrl = new URL(thisScript.src);

(function () {
  const websocketUrl = scriptUrl.searchParams.get("websocketUrl");
  if (!websocketUrl) {
    console.error("websocketUrl not set");
    return;
  }
  window.addEventListener("load", () => {
    const documentWebsocketUrls = websocketUrl.split(",");

    for (const documentWebsocketUrl of documentWebsocketUrls) {
      let overriddenHandler: ((element: HTMLElement, event: CustomEvent) => void) | null = null;
      const eventHandler = (element: HTMLElement, event: CustomEvent) => {
        if (!overriddenHandler) {
          throw new Error("overriddenHandler not set");
        }
        overriddenHandler(element, event);
      };
      const remoteDocumentHolder = document.createElement("div");
      document.body.append(remoteDocumentHolder);

      remoteDocumentHolder.addEventListener("click", (event: Event) => {
        eventHandler(event.target as HTMLElement, event as CustomEvent);
        return false;
      });

      const websocket = new NetworkedDOMWebsocket(
        documentWebsocketUrl,
        NetworkedDOMWebsocket.createWebSocket,
        remoteDocumentHolder,
      );
      overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
        websocket.handleEvent(element, event);
      };
    }
  });
})();
