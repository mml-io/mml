import { ExampleManager } from "./ExampleManager";
import { examples } from "./examples";
import { GameClient } from "./GameClient";
import { UIManager } from "./UIManager";

export class AppController {
  private exampleManager: ExampleManager;
  private uiManager: UIManager;
  private gameClient: GameClient;

  constructor() {
    this.exampleManager = new ExampleManager({
      // Handle example changes
      onExampleChange: (exampleKey: string) => {
        this.uiManager.renderExamplesList(exampleKey);
        this.loadExample(exampleKey);

        // Update harness visibility from URL
        const harnessState = this.exampleManager.getHarnessStateFromURL();
        this.uiManager.setHarnessVisibility(harnessState);
      },

      // Handle errors from example manager
      onError: (message: string) => {
        this.uiManager.showError(message);
      },
    });

    this.uiManager = new UIManager({
      isHarnessHidden: this.exampleManager.getHarnessStateFromURL(),
      onHarnessToggle: (hidden: boolean) => {
        this.exampleManager.updateURL(
          this.exampleManager.getCurrentExample(),
          hidden,
          this.gameClient.getClientCount(),
        );
      },
      onAddClient: () => {
        this.addClient();
      },
      onExampleSelect: (exampleKey: string) => {
        this.exampleManager.selectExample(
          exampleKey,
          this.uiManager.isHarnessCurrentlyHidden(),
          this.gameClient.getClientCount(),
        );
      },
      onRestartExample: () => {
        this.loadCurrentExample().catch((error) => {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Unknown error occurred while restarting the example";
          this.uiManager.showError(errorMessage);
        });
      },
    });

    this.gameClient = new GameClient(this.uiManager.getClientsAreaElement(), {
      onClientCountChange: () => {
        this.updateURLWithCurrentState();
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log("🎮 Initializing MML Game Engine...");

      // Hide loading indicator
      this.uiManager.hideLoading();

      const isHarnessHidden = this.exampleManager.getHarnessStateFromURL();
      this.uiManager.setHarnessVisibility(isHarnessHidden);
      const initialClientCount = this.exampleManager.getClientCountFromURL();
      const currentExample = this.exampleManager.getCurrentExample();
      this.uiManager.renderExamplesList(currentExample);

      // Create initial clients based on URL parameter
      for (let i = 0; i < initialClientCount; i++) {
        await this.addClient();
      }

      // Load the current example content to all clients
      await this.loadCurrentExample();

      console.log("🎉 Game ready!");
    } catch (error) {
      console.error("Failed to initialize MML Game Engine:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred while initializing the game engine";
      this.uiManager.showError(errorMessage);
    }
  }

  private async loadCurrentExample(): Promise<void> {
    const currentExample = this.exampleManager.getCurrentExample();
    await this.loadExample(currentExample);
  }

  private async loadExample(exampleKey: string): Promise<void> {
    const sharedGameDocument = this.gameClient.getSharedGameDocument();
    if (!sharedGameDocument) {
      console.warn("No shared game document available");
      return;
    }

    const example = examples[exampleKey];
    if (!example) {
      throw new Error(`Example not found: ${exampleKey}`);
    }

    // Load content once to the shared document - all clients will see the same content
    await this.exampleManager.loadExampleContent(example, sharedGameDocument);
  }

  private async addClient(): Promise<void> {
    await this.gameClient.addClient();
  }

  private updateURLWithCurrentState(): void {
    const clientCount = this.gameClient.getClientCount();
    console.log(`🔗 Updating URL with client count: ${clientCount}`);
    this.exampleManager.updateURL(
      this.exampleManager.getCurrentExample(),
      this.uiManager.isHarnessCurrentlyHidden(),
      clientCount,
    );
  }
}
