import { EditableNetworkedDOM } from "@mml-io/networked-dom-document";
import { ProjectBundler } from "mml-game-project-bundler";

import { defaultExample, ExampleDefinition, examples } from "./examples";

export type ExampleManagerProps = {
  onExampleChange: (exampleKey: string) => void;
  onError: (message: string) => void;
};

export class ExampleManager {
  private currentExample: string = defaultExample;
  private onExampleChangeCallback: (exampleKey: string) => void;
  private onErrorCallback: (message: string) => void;

  constructor(props: ExampleManagerProps) {
    this.onExampleChangeCallback = props.onExampleChange;
    this.onErrorCallback = props.onError;
    this.handleBrowserNavigation();
    this.currentExample = this.getExampleFromURL();
  }

  getCurrentExample(): string {
    return this.currentExample;
  }

  getExampleFromURL(): string {
    const params = new URLSearchParams(window.location.search);
    const exampleParam = params.get("example");
    return exampleParam && examples[exampleParam] ? exampleParam : defaultExample;
  }

  getHarnessStateFromURL(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.get("hideHarness") === "true";
  }

  getClientCountFromURL(): number {
    const params = new URLSearchParams(window.location.search);
    const clientCount = params.get("clients");
    const parsedCount = clientCount ? parseInt(clientCount, 10) : 1;
    return parsedCount > 0 ? parsedCount : 1;
  }

  updateURL(exampleKey: string, hideHarness?: boolean, clientCount?: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set("example", exampleKey);

    if (hideHarness === true) {
      url.searchParams.set("hideHarness", "true");
    } else if (hideHarness === false) {
      url.searchParams.delete("hideHarness");
    }

    if (clientCount !== undefined) {
      if (clientCount > 1) {
        url.searchParams.set("clients", clientCount.toString());
      } else {
        url.searchParams.delete("clients");
      }
    }

    window.history.pushState({ example: exampleKey, hideHarness, clientCount }, "", url.toString());
  }

  selectExample(exampleKey: string, hideHarness?: boolean, clientCount?: number): void {
    if (exampleKey === this.currentExample) return;

    this.currentExample = exampleKey;
    this.updateURL(exampleKey, hideHarness, clientCount);

    this.onExampleChangeCallback(exampleKey);
  }

  async loadExampleContent(
    example: ExampleDefinition,
    gameDocument: EditableNetworkedDOM,
  ): Promise<void> {
    console.log(`🎯 Loading example: ${example.name}`);

    const systems = example.systems
      ? new Map(example.systems.map((system) => [system.name, system.config]))
      : new Map();

    try {
      const bundled = await ProjectBundler.bundleProject(example.content, systems);
      gameDocument.load(bundled.combined);
      console.log("✅ Example loaded successfully");
    } catch (error) {
      console.error("Failed to load example:", error);
      const errorMessage = `Failed to load example: ${example.name}`;
      this.onErrorCallback(errorMessage);
      throw error;
    }
  }

  private handleBrowserNavigation(): void {
    window.addEventListener("popstate", () => {
      const exampleKey = this.getExampleFromURL();
      this.currentExample = exampleKey;

      this.onExampleChangeCallback(exampleKey);
    });
  }
}
