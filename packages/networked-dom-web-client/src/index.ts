import { NetworkedDOMWebsocket } from "@mml-io/networked-dom-web";

const thisScript = document.currentScript as HTMLScriptElement;
const scriptUrl = new URL(thisScript.src);

(function () {
  const url = scriptUrl.searchParams.get("url");
  if (!url) {
    console.error("url not set");
    return;
  }
  window.addEventListener("load", () => {
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
      url,
      NetworkedDOMWebsocket.createWebSocket,
      remoteDocumentHolder,
    );
    overriddenHandler = (element: HTMLElement, event: CustomEvent) => {
      websocket.handleEvent(element, event);
    };
  });
})();
