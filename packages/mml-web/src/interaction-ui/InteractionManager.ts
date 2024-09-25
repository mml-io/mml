import { Interaction } from "../elements/Interaction";
import { GraphicsAdapter } from "../GraphicsAdapter";
import { InteractionListener } from "../MMLScene";
import { EventHandlerCollection } from "../utils/events/EventHandlerCollection";

type InteractionState = {
  interaction: Interaction<GraphicsAdapter>;
  distance?: number;
  button?: HTMLButtonElement;
};

function createInteractionsHolder(
  onPrev: () => void,
  onNext: () => void,
  onClose: () => void,
): {
  holderElement: HTMLDivElement;
  listElement: HTMLDivElement;
  prevButton: HTMLButtonElement;
  statusHolder: HTMLDivElement;
  nextButton: HTMLButtonElement;
} {
  const holderElement = document.createElement("div");
  holderElement.setAttribute("data-test-id", "interactions-holder");
  holderElement.style.zIndex = "100";
  holderElement.style.position = "absolute";
  holderElement.style.backgroundColor = "white";
  holderElement.style.padding = "10px";
  holderElement.style.display = "none";
  holderElement.style.border = "1px solid #AAA";
  holderElement.style.fontFamily = "sans-serif";
  holderElement.style.top = "50%";
  holderElement.style.left = "50%";
  holderElement.style.transform = "translate(-50%, -50%)";

  const closeButtonHolder = document.createElement("div");
  closeButtonHolder.style.display = "flex";
  closeButtonHolder.style.justifyContent = "flex-end";
  holderElement.appendChild(closeButtonHolder);

  const title = document.createElement("h3");
  title.style.textAlign = "center";
  title.textContent = "Interactions";
  holderElement.appendChild(title);

  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.cursor = "pointer";
  closeButton.addEventListener("click", () => {
    onClose();
  });
  closeButtonHolder.appendChild(closeButton);

  const listElement = document.createElement("div");
  listElement.setAttribute("data-test-id", "interactions-list");
  holderElement.appendChild(listElement);

  const buttonHolder = document.createElement("div");
  buttonHolder.style.display = "flex";
  buttonHolder.style.justifyContent = "space-between";
  holderElement.appendChild(buttonHolder);

  const prevButton = document.createElement("button");
  prevButton.textContent = "Prev";
  prevButton.style.cursor = "pointer";
  prevButton.addEventListener("click", onPrev);
  buttonHolder.appendChild(prevButton);

  const statusHolder = document.createElement("div");
  statusHolder.style.display = "flex";
  statusHolder.style.justifyContent = "center";
  statusHolder.style.padding = "5px";
  buttonHolder.appendChild(statusHolder);

  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.style.cursor = "pointer";
  nextButton.addEventListener("click", onNext);
  buttonHolder.appendChild(nextButton);

  return { holderElement, listElement, prevButton, statusHolder, nextButton };
}

function createInteractionPrompt() {
  const interactionPrompt = document.createElement("div");
  interactionPrompt.setAttribute("data-test-id", "interactions-prompt");
  interactionPrompt.style.zIndex = "101";
  interactionPrompt.style.position = "absolute";
  interactionPrompt.style.top = "10px";
  interactionPrompt.style.left = "10px";
  interactionPrompt.style.display = "none";
  interactionPrompt.style.padding = "12px 10px";
  interactionPrompt.style.fontFamily = "Helvetica";
  interactionPrompt.style.color = "white";
  interactionPrompt.style.backgroundColor = "#222222b2";
  interactionPrompt.innerHTML = "Press E to interact";
  return interactionPrompt;
}

export class InteractionManager {
  private static pageLimit = 3;
  private pageOffset = 0;

  private eventCollection = new EventHandlerCollection();

  private interactionListElement: HTMLDivElement;
  private interactionHolderElement: HTMLDivElement;
  private prevButton: HTMLButtonElement;
  private statusHolder: HTMLDivElement;
  private nextButton: HTMLButtonElement;
  private interactionPromptElement: HTMLDivElement;

  private possibleActions = new Map<Interaction<GraphicsAdapter>, InteractionState>();
  private visibleActions = new Set<InteractionState>();
  private tickInterval: NodeJS.Timeout | null = null;
  private sortedActions: InteractionState[] = [];

  private static createButtonText(interaction: Interaction<GraphicsAdapter>) {
    return `${interaction.props.prompt ?? "Interact"}`;
  }

  private constructor(
    private container: HTMLElement,
    private interactionShouldShowDistance: (
      interaction: Interaction<GraphicsAdapter>,
    ) => number | null,
  ) {
    this.container = container;
    const { holderElement, listElement, prevButton, statusHolder, nextButton } =
      createInteractionsHolder(
        () => {
          this.pageOffset--;
          this.displayInteractions();
        },
        () => {
          this.pageOffset++;
          this.displayInteractions();
        },
        () => {
          this.hideHolder();
        },
      );
    this.prevButton = prevButton;
    this.statusHolder = statusHolder;
    this.nextButton = nextButton;
    this.interactionListElement = listElement;
    this.interactionHolderElement = holderElement;
    this.container.appendChild(this.interactionHolderElement);

    this.interactionPromptElement = createInteractionPrompt();
    this.container.appendChild(this.interactionPromptElement);

    this.eventCollection.add(document, "keydown", (e: KeyboardEvent) => {
      // if the e key is pressed, show the UI
      if (e.code === "KeyE") {
        if (this.interactionHolderElement.style.display === "block") {
          this.hideHolder();
          return;
        }
        if (this.visibleActions.size > 0) {
          this.showHolder();
        }
      } else if (e.code === "Escape") {
        this.hideHolder();
      }
    });
  }

  private getInteractionListener(): InteractionListener<GraphicsAdapter> {
    return {
      addInteraction: (interaction: Interaction<GraphicsAdapter>) => {
        this.possibleActions.set(interaction, {
          interaction,
        });
      },
      removeInteraction: (interaction: Interaction<GraphicsAdapter>) => {
        const interactionState = this.possibleActions.get(interaction);
        if (!interactionState) {
          console.warn("Interaction not found", interaction);
          return;
        }

        if (interactionState.button) {
          interactionState.button.remove();
        }
        this.possibleActions.delete(interaction);
        if (this.visibleActions.has(interactionState)) {
          this.visibleActions.delete(interactionState);
          if (this.visibleActions.size === 0) {
            this.hidePrompt();
          }
        }
      },
      updateInteraction: (interaction: Interaction<GraphicsAdapter>) => {
        const interactionState = this.possibleActions.get(interaction);
        if (!interactionState) {
          console.warn("Interaction not found", interaction);
          return;
        }
        if (interactionState.button) {
          interactionState.button.textContent = InteractionManager.createButtonText(interaction);
        }
      },
    };
  }

  static init(
    container: HTMLElement,
    interactionShouldShowDistance: (interaction: Interaction<GraphicsAdapter>) => number | null,
  ): {
    interactionManager: InteractionManager;
    interactionListener: InteractionListener<GraphicsAdapter>;
  } {
    const interactionManager = new InteractionManager(container, interactionShouldShowDistance);
    interactionManager.startTick();
    return { interactionManager, interactionListener: interactionManager.getInteractionListener() };
  }

  public dispose() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    this.eventCollection.clear();
    this.interactionListElement.remove();
    this.interactionHolderElement.remove();
    this.interactionPromptElement.remove();
  }

  private startTick() {
    this.tickInterval = setInterval(() => {
      this.possibleActions.forEach((interactionState, interaction) => {
        const showDistance = this.interactionShouldShowDistance(interaction);
        if (showDistance !== null) {
          interactionState.distance = showDistance;
          this.visibleActions.add(interactionState);
        } else {
          this.visibleActions.delete(interactionState);
        }
      });

      if (this.visibleActions.size === 0) {
        this.hidePrompt();
        this.hideHolder();
        return;
      } else {
        this.showPrompt();
      }

      this.sortedActions = Array.from(this.visibleActions).sort(
        (a: InteractionState, b: InteractionState) => {
          // sort by priority first
          const priorityDiff = a.interaction.props.priority - b.interaction.props.priority;
          if (priorityDiff !== 0) {
            return priorityDiff;
          }

          // Otherwise sort by distance if available
          if (a.distance && b.distance) {
            const distanceDiff = a.distance - b.distance;
            if (Math.abs(distanceDiff) > 0.1) {
              return distanceDiff;
            }
          }
          return 0;
        },
      );

      this.displayInteractions();
    }, 1000);
  }

  private displayInteractions() {
    this.interactionListElement.innerHTML = "";
    const maximumPageOffset = Math.floor(
      (this.sortedActions.length - 1) / InteractionManager.pageLimit,
    );
    if (this.pageOffset > maximumPageOffset) {
      this.pageOffset = maximumPageOffset;
    }
    if (this.pageOffset < 0) {
      this.pageOffset = 0;
    }
    const startIndex = this.pageOffset * InteractionManager.pageLimit;

    const pagedItems = this.sortedActions.slice(
      startIndex,
      startIndex + InteractionManager.pageLimit,
    );

    if (this.pageOffset > 0) {
      this.prevButton.removeAttribute("disabled");
    } else {
      this.prevButton.setAttribute("disabled", "true");
    }

    if (this.pageOffset < maximumPageOffset) {
      this.nextButton.removeAttribute("disabled");
    } else {
      this.nextButton.setAttribute("disabled", "true");
    }

    this.statusHolder.textContent = `Page ${this.pageOffset + 1} of ${maximumPageOffset + 1}`;

    pagedItems.forEach((interactionState) => {
      if (!interactionState.button) {
        const interactionText = InteractionManager.createButtonText(interactionState.interaction);
        const button = document.createElement("button");
        button.style.display = "block";
        button.style.marginBottom = "5px";
        button.style.cursor = "pointer";
        button.style.textOverflow = "ellipsis";
        button.style.overflow = "hidden";
        button.style.whiteSpace = "nowrap";
        button.style.maxWidth = "200px";
        button.setAttribute("data-test-id", `interaction-${interactionText}`);
        button.textContent = interactionText;
        button.addEventListener("click", () => {
          interactionState.interaction.trigger();
          this.hideHolder();
        });
        interactionState.button = button;
      }
      this.interactionListElement.appendChild(interactionState.button);
    });
  }

  private hideHolder() {
    this.interactionHolderElement.style.display = "none";
  }

  private showHolder() {
    this.interactionHolderElement.style.display = "block";
  }

  private hidePrompt() {
    this.interactionPromptElement.style.display = "none";
  }

  private showPrompt() {
    this.interactionPromptElement.style.display = "block";
  }
}
