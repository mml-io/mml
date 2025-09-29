import { exampleKeys, examples } from "./examples";
import styles from "./styles.module.css";

export type UIManagerProps = {
  isHarnessHidden: boolean;
  onHarnessToggle: (hidden: boolean) => void;
  onAddClient: () => void;
  onExampleSelect: (exampleKey: string) => void;
  onRestartExample: () => void;
};

export class UIManager {
  private appContainer: HTMLDivElement;
  private harnessElement: HTMLDivElement;
  private gameContainerElement: HTMLDivElement;
  private clientsAreaElement: HTMLDivElement;
  private examplesListElement: HTMLDivElement;
  private hideHarnessBtn: HTMLButtonElement;
  private restartExampleBtn: HTMLButtonElement;
  private loadingElement: HTMLDivElement;
  private errorElement: HTMLDivElement;
  private errorMessageElement: HTMLParagraphElement;

  private isHarnessHidden: boolean;
  private onExampleSelectCallback: (exampleKey: string) => void;
  private onHarnessToggleCallback: (hidden: boolean) => void;
  private onAddClientCallback: () => void;
  private onRestartExampleCallback: () => void;

  constructor(props: UIManagerProps) {
    this.isHarnessHidden = props.isHarnessHidden;
    this.onExampleSelectCallback = props.onExampleSelect;
    this.onHarnessToggleCallback = props.onHarnessToggle;
    this.onAddClientCallback = props.onAddClient;
    this.onRestartExampleCallback = props.onRestartExample;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const appElement = document.getElementById("app")!;

    // Create app container
    this.appContainer = document.createElement("div");
    this.appContainer.className = styles.appContainer;

    // Create harness (sidebar)
    this.harnessElement = document.createElement("div");
    this.harnessElement.className = this.isHarnessHidden
      ? `${styles.harness} ${styles.harnessHidden}`
      : styles.harness;

    // Create header
    const header = document.createElement("div");
    header.className = styles.header;
    const headerTitle = document.createElement("h1");
    headerTitle.className = styles.headerTitle;
    headerTitle.textContent = "🎮 MML Examples";
    const headerSubtitle = document.createElement("p");
    headerSubtitle.className = styles.headerSubtitle;
    headerSubtitle.textContent = "Interactive 3D scenes using MML";
    header.appendChild(headerTitle);
    header.appendChild(headerSubtitle);

    // Create examples list
    this.examplesListElement = document.createElement("div");
    this.examplesListElement.className = styles.examplesList;

    // Create restart example button
    this.restartExampleBtn = document.createElement("button");
    this.restartExampleBtn.className = styles.restartBtn;
    this.restartExampleBtn.textContent = "Restart Example";
    this.restartExampleBtn.addEventListener("click", () => {
      this.onRestartExampleCallback();
    });

    // Create hide harness button
    this.hideHarnessBtn = document.createElement("button");
    this.hideHarnessBtn.className = styles.hideHarnessBtn;
    this.hideHarnessBtn.textContent = "Hide Harness";
    this.hideHarnessBtn.addEventListener("click", () => this.toggleHarness());

    // Assemble harness
    this.harnessElement.appendChild(header);
    this.harnessElement.appendChild(this.examplesListElement);
    this.harnessElement.appendChild(this.restartExampleBtn);
    this.harnessElement.appendChild(this.hideHarnessBtn);

    // Create game container
    this.gameContainerElement = document.createElement("div");
    this.gameContainerElement.className = this.isHarnessHidden
      ? `${styles.gameContainer} ${styles.gameContainerFullscreen}`
      : styles.gameContainer;

    // Create loading element
    this.loadingElement = document.createElement("div");
    this.loadingElement.className = styles.loading;
    this.loadingElement.textContent = "Loading MML Game Engine...";

    // Create error elements
    this.errorElement = document.createElement("div");
    this.errorElement.className = styles.error;
    this.errorElement.style.display = "none";
    const errorTitle = document.createElement("h3");
    errorTitle.className = styles.errorTitle;
    errorTitle.textContent = "⚠️ Error Loading Game";
    this.errorMessageElement = document.createElement("p");
    this.errorElement.appendChild(errorTitle);
    this.errorElement.appendChild(this.errorMessageElement);

    // Create clients area with controls
    this.clientsAreaElement = document.createElement("div");
    this.clientsAreaElement.className = styles.clientsArea;

    // Create add client button (top right)
    const addClientBtn = document.createElement("button");
    addClientBtn.className = styles.addClientBtn;
    addClientBtn.textContent = "+";
    addClientBtn.title = "Add Client";

    addClientBtn.addEventListener("click", () => {
      this.onAddClientCallback();
    });

    this.clientsAreaElement.appendChild(addClientBtn);

    // Assemble game container
    this.gameContainerElement.appendChild(this.loadingElement);
    this.gameContainerElement.appendChild(this.errorElement);
    this.gameContainerElement.appendChild(this.clientsAreaElement);

    // Assemble app
    this.appContainer.appendChild(this.harnessElement);
    this.appContainer.appendChild(this.gameContainerElement);
    appElement.appendChild(this.appContainer);
  }

  getClientsAreaElement(): HTMLDivElement {
    return this.clientsAreaElement;
  }

  renderExamplesList(currentExample: string): void {
    this.examplesListElement.innerHTML = "";

    exampleKeys.forEach((exampleKey) => {
      const example = examples[exampleKey];
      const item = document.createElement("div");
      item.className =
        exampleKey === currentExample
          ? `${styles.exampleItem} ${styles.exampleItemActive}`
          : styles.exampleItem;

      const nameElement = document.createElement("div");
      nameElement.className = styles.exampleName;
      nameElement.textContent = example.name;

      const descriptionElement = document.createElement("div");
      descriptionElement.className = styles.exampleDescription;
      descriptionElement.textContent = example.description;

      item.appendChild(nameElement);
      item.appendChild(descriptionElement);

      item.addEventListener("click", () => {
        this.onExampleSelectCallback(exampleKey);
      });

      this.examplesListElement.appendChild(item);
    });
  }

  setHarnessVisibility(hidden: boolean): void {
    this.isHarnessHidden = hidden;

    if (this.isHarnessHidden) {
      this.harnessElement.className = `${styles.harness} ${styles.harnessHidden}`;
      this.gameContainerElement.className = `${styles.gameContainer} ${styles.gameContainerFullscreen}`;
    } else {
      this.harnessElement.className = styles.harness;
      this.gameContainerElement.className = styles.gameContainer;
    }
  }

  private toggleHarness(): void {
    const newHiddenState = !this.isHarnessHidden;
    this.setHarnessVisibility(newHiddenState);
    this.onHarnessToggleCallback(newHiddenState);
  }

  showError(message: string): void {
    console.error("MML Game Engine Error:", message);
    this.loadingElement.style.display = "none";
    this.errorMessageElement.textContent = message;
    this.errorElement.style.display = "block";
  }

  hideLoading(): void {
    this.loadingElement.style.display = "none";
  }

  isHarnessCurrentlyHidden(): boolean {
    return this.isHarnessHidden;
  }
}
