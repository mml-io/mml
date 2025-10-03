import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { IframeObservableDOMFactory } from "@mml-io/networked-dom-web-runner";
import { ez, EZElement } from "ez-elements";
import { createMMLGameClient, MMLWebClient } from "mml-game-engine-client";

import styles from "./App.module.css";

console.log("🚀 MML Game Runner initialized");

interface GameRunnerState {
  mmlClient?: MMLWebClient;
  gameDocument?: EditableNetworkedDOM;
  currentGameUrl?: string;
  isGameLoaded: boolean;
}

class GameRunner {
  private state: GameRunnerState = { isGameLoaded: false };

  private addressBar: EZElement<"div">;
  private urlInput: EZElement<"input">;
  private loadUrlBtn: EZElement<"button">;
  private stopBtn: EZElement<"button">;
  private gameLoader: EZElement<"div">;
  private clientContainer: EZElement<"div">;
  private loading: EZElement<"div">;
  private statusMessage: EZElement<"div">;
  private fileDropZone: EZElement<"div">;
  private fileInput: EZElement<"input">;

  constructor() {
    // Create main container
    const container = ez("div", styles.container).append(
      // Persistent address bar at the top
      (this.addressBar = ez("div", styles.addressBar).append(
        ez("h1", styles.title).setTextContent("🎮 MML Game Runner"),
        ez("div", styles.urlInputGroup).append(
          (this.urlInput = ez("input", styles.urlInput)
            .setAttribute("type", "url")
            .setAttribute(
              "placeholder",
              "Enter game URL (http://...) or websocket URL (ws://...)",
            )),
          (this.loadUrlBtn = ez("button", styles.loadBtn).setTextContent("Load Game")),
          (this.stopBtn = ez("button", [styles.stopBtn, styles.hidden]).setTextContent("Stop")),
        ),
      )),
      // Game loader section (shown when no game is loaded)
      (this.gameLoader = ez("div", [styles.gameLoader]).append(
        ez("div", styles.loaderSection).append(
          ez("h3").setTextContent("Or Drop Game File"),
          (this.fileDropZone = ez("div", [styles.fileDropZone]).append(
            ez("p").setTextContent("📁 Drop an HTML game file here or click to browse"),
            (this.fileInput = ez("input")
              .setAttribute("type", "file")
              .setAttribute("accept", ".html,.htm")),
          )),
        ),
        ez("div", styles.gameInfo).append(
          ez("strong").setTextContent("Supported formats:"),
          ez("div").setTextContent("• HTTP/HTTPS URLs: Load static game files"),
          ez("div").setTextContent(
            "• WebSocket URLs (ws:// or wss://): Connect to networked game servers",
          ),
        ),
        // Status message container
        (this.statusMessage = ez("div")),
      )),
      // Game client container
      (this.clientContainer = ez("div", [styles.mmlClient, styles.hidden]).append(
        (this.loading = ez("div", styles.loading).append(
          ez("div", styles.loadingSpinner),
          ez("p").setTextContent("Loading game..."),
        )),
      )),
    );

    // Append to body
    container.appendTo(document.body);

    this.setupEventListeners();
    this.checkUrlParams();
    console.log("✅ MML Game Runner ready");
  }

  private showStatus(message: string, type: "success" | "error" | "info" = "info") {
    const className =
      type === "success"
        ? styles.successMessage
        : type === "error"
          ? styles.errorMessage
          : styles.gameInfo;
    this.statusMessage.append(ez("div", className).setTextContent(message));
  }

  private clearStatus() {
    this.statusMessage.getChildren().forEach((child) => child.remove());
  }

  private updateAddressBarState(isLoading: boolean, isLoaded: boolean) {
    if (isLoading) {
      this.urlInput.getNativeElement().disabled = true;
      this.loadUrlBtn.classList.add(styles.hidden);
      this.stopBtn.classList.remove(styles.hidden);
    } else if (isLoaded) {
      this.urlInput.getNativeElement().disabled = true;
      this.loadUrlBtn.classList.add(styles.hidden);
      this.stopBtn.classList.remove(styles.hidden);
    } else {
      this.urlInput.getNativeElement().disabled = false;
      this.loadUrlBtn.classList.remove(styles.hidden);
      this.stopBtn.classList.add(styles.hidden);
    }
  }

  private isWebsocketUrl(url: string): boolean {
    return url.startsWith("ws://") || url.startsWith("wss://");
  }

  private async fetchGameContent(url: string): Promise<string> {
    console.log(`📥 Fetching game content from: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("text/html")) {
        console.warn(`⚠️ Content type is ${contentType}, expected text/html`);
      }

      const content = await response.text();
      if (!content.trim()) {
        throw new Error("Game content is empty");
      }

      console.log(`✅ Successfully fetched ${content.length} characters`);
      return content;
    } catch (error) {
      console.error(`❌ Failed to fetch game content:`, error);
      throw new Error(
        `Failed to load game from URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`📖 Reading file: ${file.name} (${file.size} bytes)`);

      if (
        !file.type.includes("text/html") &&
        !file.name.endsWith(".html") &&
        !file.name.endsWith(".htm")
      ) {
        reject(new Error("Please select an HTML file (.html or .htm)"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content?.trim()) {
          reject(new Error("File is empty or could not be read"));
          return;
        }
        console.log(`✅ Successfully read ${content.length} characters from file`);
        resolve(content);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      reader.readAsText(file);
    });
  }

  private async loadGameFromWebsocket(url: string, source: string) {
    try {
      console.log(`🌐 Connecting to websocket game at ${source}...`);
      this.showStatus(`Connecting to websocket game at ${source}...`, "info");

      // Show loading state
      this.gameLoader.classList.add(styles.hidden);
      this.clientContainer.classList.remove(styles.hidden);
      this.loading.style.display = "block";
      this.updateAddressBarState(true, true);

      // Clean up existing game if any
      if (this.state.mmlClient) {
        console.log("🧹 Cleaning up existing game...");
        this.state.mmlClient.disconnect();
        if (this.clientContainer.contains(this.state.mmlClient.element)) {
          this.state.mmlClient.element.remove();
        }
      }

      // Create the MML client
      console.log("🎮 Creating MML Game Client...");
      this.state.mmlClient = await createMMLGameClient();

      // Style the client element to fit the container
      this.state.mmlClient.element.style.position = "absolute";
      this.state.mmlClient.element.style.top = "0";
      this.state.mmlClient.element.style.left = "0";
      this.state.mmlClient.element.style.width = "100%";
      this.state.mmlClient.element.style.height = "100%";
      this.state.mmlClient.element.style.overflow = "hidden";

      // Connect to websocket
      console.log("🔗 Connecting to websocket...");
      this.state.mmlClient.connectToSocket(url);

      // Add the MML client element to the container
      this.clientContainer.append(this.state.mmlClient.element);

      // Fit the container
      this.state.mmlClient.fitContainer();

      // Hide loading and show success message
      this.loading.style.display = "none";
      this.state.isGameLoaded = true;
      this.updateAddressBarState(false, true);
      console.log("✅ Websocket game connection initiated");
      this.showStatus("Connected to websocket game server!", "success");
      setTimeout(() => this.clearStatus(), 3000);
    } catch (error) {
      console.error("❌ Failed to connect to websocket game:", error);
      this.showStatus(
        `Failed to connect to websocket game: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );

      // Show the loader again on error
      this.gameLoader.classList.remove(styles.hidden);
      this.clientContainer.classList.add(styles.hidden);
      this.updateAddressBarState(false, false);
    }
  }

  private async loadGameFromContent(content: string, source: string) {
    try {
      console.log(`🎮 Loading game from ${source}...`);
      this.showStatus(`Loading game from ${source}...`, "info");

      // Show loading state
      this.gameLoader.classList.add(styles.hidden);
      this.clientContainer.classList.remove(styles.hidden);
      this.loading.style.display = "block";
      this.updateAddressBarState(true, true);

      // Clean up existing game if any
      if (this.state.mmlClient) {
        console.log("🧹 Cleaning up existing game...");
        if (this.state.gameDocument) {
          this.state.mmlClient.disconnect();
        }
        if (this.clientContainer.contains(this.state.mmlClient.element)) {
          this.state.mmlClient.element.remove();
        }
      }

      // Create the MML client
      console.log("🎮 Creating MML Game Client...");
      this.state.mmlClient = await createMMLGameClient();

      // Style the client element to fit the container
      this.state.mmlClient.element.style.position = "absolute";
      this.state.mmlClient.element.style.top = "0";
      this.state.mmlClient.element.style.left = "0";
      this.state.mmlClient.element.style.width = "100%";
      this.state.mmlClient.element.style.height = "100%";
      this.state.mmlClient.element.style.overflow = "hidden";

      // Create shared networked document
      console.log("📄 Creating EditableNetworkedDOM...");
      this.state.gameDocument = new EditableNetworkedDOM(
        "game.html",
        IframeObservableDOMFactory,
        false,
        (message) => {
          console.log("Game log:", message.level, message.content);
        },
      );

      // Connect the client to the document
      console.log("🔗 Connecting client to document...", source);
      this.state.mmlClient.connectToDocument(this.state.gameDocument, source);

      // Load the game content
      console.log("📦 Loading game content...");
      this.state.gameDocument.load(content);

      // Add the MML client element to the container
      this.clientContainer.append(this.state.mmlClient.element);

      // Fit the container
      this.state.mmlClient.fitContainer();

      // Hide loading
      this.loading.style.display = "none";
      this.state.isGameLoaded = true;
      this.updateAddressBarState(false, true);

      console.log("✅ Game loaded successfully");
      this.clearStatus();
    } catch (error) {
      console.error("❌ Failed to load game:", error);
      this.showStatus(
        `Failed to load game: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );

      // Show the loader again on error
      this.gameLoader.classList.remove(styles.hidden);
      this.clientContainer.classList.add(styles.hidden);
      this.updateAddressBarState(false, false);
    }
  }

  private async loadGameFromUrl(url: string, updateUrl: boolean = true) {
    try {
      this.state.currentGameUrl = url;

      // Update URL params to reflect the loaded game
      if (updateUrl) {
        this.updateUrlParams(url);
      }

      if (this.isWebsocketUrl(url)) {
        // Connect to websocket server
        await this.loadGameFromWebsocket(url, `websocket: ${url}`);
      } else {
        // Fetch content from HTTP URL
        const content = await this.fetchGameContent(url);
        await this.loadGameFromContent(content, url);
      }
    } catch (error) {
      this.showStatus(`${error instanceof Error ? error.message : String(error)}`, "error");

      // If this was from URL params, show the loader interface on error
      if (!updateUrl) {
        this.gameLoader.classList.remove(styles.hidden);
        this.clientContainer.classList.add(styles.hidden);
      }
    }
  }

  private async loadGameFromFile(file: File) {
    try {
      const content = await this.readFileContent(file);
      this.state.currentGameUrl = undefined;

      // Clear URL params when loading from file
      this.updateUrlParams(null);

      await this.loadGameFromContent(content, `${location.protocol}//${location.host}`);
    } catch (error) {
      this.showStatus(`${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  private closeGame() {
    console.log("🚪 Closing game...");

    // Clean up MML client
    if (this.state.mmlClient) {
      if (this.state.gameDocument) {
        this.state.mmlClient.disconnect();
      }
      if (this.clientContainer.contains(this.state.mmlClient.element)) {
        this.state.mmlClient.element.remove();
      }
    }

    // Reset state
    this.state.mmlClient = undefined;
    this.state.gameDocument = undefined;
    this.state.isGameLoaded = false;

    // Update URL to show loaded=false but keep the game URL
    this.updateUrlParams(this.state.currentGameUrl || null, false);

    // Show loader
    this.gameLoader.classList.remove(styles.hidden);
    this.clientContainer.classList.add(styles.hidden);
    this.updateAddressBarState(false, false);

    this.clearStatus();
  }

  private setupEventListeners() {
    // URL loading
    this.loadUrlBtn.addEventListener("click", () => {
      const url = this.urlInput.getNativeElement().value.trim();
      if (!url) {
        this.showStatus("Please enter a game URL", "error");
        return;
      }
      this.loadGameFromUrl(url);
    });

    // Enter key in URL input
    this.urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.loadUrlBtn.getNativeElement().click();
      }
    });

    // File input
    this.fileInput.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.loadGameFromFile(file);
      }
    });

    // File drop zone click
    this.fileDropZone.addEventListener("click", () => {
      this.fileInput.getNativeElement().click();
    });

    // Drag and drop
    this.fileDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.fileDropZone.classList.add(styles.dragOver);
    });

    this.fileDropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      this.fileDropZone.classList.remove(styles.dragOver);
    });

    this.fileDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.fileDropZone.classList.remove(styles.dragOver);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.loadGameFromFile(files[0]);
      }
    });

    // Stop button
    this.stopBtn.addEventListener("click", () => this.closeGame());

    // Escape key to close game
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.clientContainer.classList.contains(styles.hidden)) {
        this.closeGame();
      }
    });

    // Handle browser back/forward buttons
    window.addEventListener("popstate", () => {
      console.log("🔄 Browser navigation detected");
      this.handleBrowserNavigation();
    });
  }

  /**
   * Updates URL parameters in the address bar
   */
  private updateUrlParams(gameUrl: string | null, isLoaded: boolean = true) {
    const url = new URL(window.location.href);

    if (gameUrl) {
      url.searchParams.set("url", gameUrl);
      url.searchParams.set("loaded", isLoaded.toString());
    } else {
      url.searchParams.delete("url");
      url.searchParams.delete("loaded");
    }

    // Update the URL without reloading the page
    window.history.replaceState({}, "", url.toString());
  }

  /**
   * Handles browser navigation (back/forward buttons)
   */
  private handleBrowserNavigation() {
    const params = new URLSearchParams(window.location.search);
    const gameUrl = params.get("url");
    const loadedParam = params.get("loaded");
    const isLoaded = loadedParam !== "false"; // Default to true if not present

    if (gameUrl) {
      // URL has a game parameter - populate input and load if loaded=true
      this.urlInput.getNativeElement().value = gameUrl;
      this.state.currentGameUrl = gameUrl;

      if (isLoaded && gameUrl !== this.state.currentGameUrl) {
        console.log(`🔗 Loading game from navigation: ${gameUrl}`);
        this.loadGameFromUrl(gameUrl, false);
      } else if (!isLoaded) {
        console.log(`🔗 Game URL found but loaded=false - not loading`);
        this.updateAddressBarState(false, false);
      }
    } else {
      // No URL parameter - close current game if any
      if (this.state.currentGameUrl) {
        console.log("🔗 No game URL in navigation - closing current game");
        this.closeGameWithoutUrlUpdate();
      }
    }
  }

  /**
   * Closes the game without updating the URL (used for browser navigation)
   */
  private closeGameWithoutUrlUpdate() {
    console.log("🚪 Closing game (navigation)...");

    // Clean up MML client
    if (this.state.mmlClient) {
      if (this.state.gameDocument) {
        this.state.mmlClient.disconnect();
      }
      if (this.clientContainer.contains(this.state.mmlClient.element)) {
        this.state.mmlClient.element.remove();
      }
    }

    // Reset state
    this.state.mmlClient = undefined;
    this.state.gameDocument = undefined;
    this.state.currentGameUrl = undefined;

    // Show loader
    this.gameLoader.classList.remove(styles.hidden);
    this.clientContainer.classList.add(styles.hidden);

    // Clear URL input
    this.urlInput.getNativeElement().value = "";
    this.clearStatus();
  }

  /**
   * Checks URL parameters and loads game if present
   */
  private checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const gameUrl = params.get("url");
    const loadedParam = params.get("loaded");
    const isLoaded = loadedParam !== "false"; // Default to true if not present

    if (gameUrl) {
      console.log(`🔗 Found game URL in parameters: ${gameUrl}`);

      // Set the URL in the input field
      this.urlInput.getNativeElement().value = gameUrl;
      this.state.currentGameUrl = gameUrl;

      if (isLoaded) {
        // Show loading state immediately
        this.gameLoader.classList.add(styles.hidden);
        this.clientContainer.classList.remove(styles.hidden);
        this.loading.style.display = "block";
        this.showStatus("Loading game from URL parameter...", "info");

        // Load the game without updating URL (since it's already in URL)
        this.loadGameFromUrl(gameUrl, false);
      } else {
        // URL present but loaded=false - just populate input, don't load
        console.log(`🔗 Game URL found but loaded=false - populating input only`);
        this.updateAddressBarState(false, false);
      }
    }
  }
}

// Initialize the runner when the page loads
function initialize() {
  new GameRunner();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
