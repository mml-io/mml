import { NetworkedDOMWebsocket } from "@mml-io/networked-dom-web/src";

export class HeadlessClient {
  public dom: HTMLDivElement;
  public socket: NetworkedDOMWebsocket;

  getInteractions(): Array<string> {
    return [...this.dom.querySelectorAll("m-interaction")].map((interaction) =>
      interaction.getAttribute("prompt"),
    );
  }

  performInteraction(interaction: string): void {
    const interactions = this.dom.querySelectorAll("m-interaction");
    const event = new CustomEvent("interact", { detail: {} });
    for (const i of interactions) {
      if (i.getAttribute("prompt") === interaction) {
        this.socket.handleEvent(i as HTMLElement, event);
        break;
      }
    }
  }

  constructor(url: string) {
    this.dom = window.document.createElement("div");
    this.socket = new NetworkedDOMWebsocket(url, NetworkedDOMWebsocket.createWebSocket, this.dom);
  }
}
