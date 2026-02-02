import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { IframeObservableDOMFactory } from "@mml-io/networked-dom-web-runner";
import { createMMLGameClient, MMLWebClient } from "mml-game-engine-client";

import styles from "./styles.module.css";

type ClientInstance = {
  id: string;
  mmlClient: MMLWebClient;
  container: HTMLElement;
  wrapper: HTMLElement;
};

export type GameClientProps = {
  onClientCountChange: (count: number) => void;
};

export class GameClient {
  private clients: Map<string, ClientInstance> = new Map();
  private sharedGameDocument: EditableNetworkedDOM;
  private nextClientId = 0;
  private clientsAreaElement: HTMLElement;
  private onClientCountChangeCallback: (count: number) => void;

  private resizeHandler = () => {
    this.fitAllContainers();
  };

  constructor(clientsAreaElement: HTMLElement, props: GameClientProps) {
    this.clientsAreaElement = clientsAreaElement;
    this.onClientCountChangeCallback = props.onClientCountChange;
    console.log("🎮 Initializing MML Game Engine...");

    // Create shared networked document that all clients will connect to
    this.sharedGameDocument = new EditableNetworkedDOM(
      "index.html",
      IframeObservableDOMFactory,
      false,
      (message) => {
        console.log("Game log:", message.level, message.content);
      },
    );

    // Handle window resize with debouncing
    window.addEventListener("resize", this.resizeHandler);

    console.log("✅ MML Game Engine initialized successfully");
  }

  async addClient(): Promise<string> {
    const clientId = `client-${this.nextClientId++}`;

    console.log(`🎮 Creating client: ${clientId}`);

    // Create UI wrapper and container
    const clientWrapper = document.createElement("div");
    clientWrapper.className = styles.clientWrapper;

    // Create close button (top left)
    const closeBtn = document.createElement("button");
    closeBtn.className = styles.closeClientBtn;
    closeBtn.textContent = "×";
    closeBtn.title = "Close Client";

    closeBtn.addEventListener("click", () => {
      console.log(`🗑️ Close button clicked for client: ${clientId}`);
      this.removeClient(clientId);
    });

    // Create the actual client container
    const clientContainer = document.createElement("div");
    clientContainer.className = styles.mmlClient;

    clientWrapper.appendChild(closeBtn);
    clientWrapper.appendChild(clientContainer);

    // Create the MML client using the proper factory function
    const mmlClient = await createMMLGameClient();

    // Style the client element to prevent runaway sizing
    mmlClient.element.style.position = "absolute";
    mmlClient.element.style.top = "0";
    mmlClient.element.style.left = "0";
    mmlClient.element.style.width = "100%";
    mmlClient.element.style.height = "100%";
    mmlClient.element.style.overflow = "hidden";

    // Connect the client to the shared document
    // Cast to any to work around monorepo type resolution where EditableNetworkedDOM
    // comes from different node_modules paths but is structurally identical
    mmlClient.connectToDocument(
      this.sharedGameDocument as any,
      `${location.protocol}//${location.host}`,
    );

    // Create client instance
    const clientInstance: ClientInstance = {
      id: clientId,
      mmlClient,
      container: clientContainer,
      wrapper: clientWrapper,
    };

    this.clients.set(clientId, clientInstance);

    // Add the MML client element to the container
    clientContainer.appendChild(mmlClient.element);

    // Add wrapper to the clients area
    this.clientsAreaElement.appendChild(clientWrapper);

    // Fit the container initially
    mmlClient.fitContainer();

    console.log(`✅ Client ${clientId} created and attached to shared document`);

    // Notify about client count change
    this.onClientCountChangeCallback(this.clients.size);

    return clientId;
  }

  removeClient(clientId: string): void {
    console.log(`🗑️ GameClient removing client: ${clientId}`);
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`❌ Client ${clientId} not found in GameClient`);
      console.log(`📊 Available client IDs:`, Array.from(this.clients.keys()));
      return;
    }

    client.mmlClient.disconnect();
    client.mmlClient.dispose();

    // Remove the wrapper from the clients area
    this.clientsAreaElement.removeChild(client.wrapper);

    // Clean up the client
    this.clients.delete(clientId);
    console.log(`✅ Client ${clientId} removed. Remaining clients:`, this.clients.size);

    // Notify about client count change
    this.onClientCountChangeCallback(this.clients.size);
  }

  fitAllContainers(): void {
    this.clients.forEach((client) => {
      if (client.mmlClient) {
        client.mmlClient.fitContainer();
      }
    });
  }

  getSharedGameDocument(): EditableNetworkedDOM | null {
    return this.sharedGameDocument;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
