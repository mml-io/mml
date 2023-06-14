import * as THREE from "three";

import { Interaction } from "../elements/Interaction";
import { InteractionListener } from "../MMLScene";
import { EventHandlerCollection } from "../utils/events/EventHandlerCollection";

type InteractionState = {
  interaction: Interaction;
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

  private container: HTMLElement;
  private camera: THREE.Camera;

  private eventCollection = new EventHandlerCollection();

  private interactionListElement: HTMLDivElement;
  private interactionHolderElement: HTMLDivElement;
  private prevButton: HTMLButtonElement;
  private statusHolder: HTMLDivElement;
  private nextButton: HTMLButtonElement;
  private interactionPromptElement: HTMLDivElement;

  private possibleActions = new Map<Interaction, InteractionState>();
  private visibleActions = new Set<InteractionState>();
  private tickInterval: NodeJS.Timer | null = null;
  private threeJSScene: THREE.Scene;
  private sortedActions: InteractionState[] = [];

  private static createButtonText(interaction: Interaction) {
    return `${interaction.props.prompt ?? "Interact"}`;
  }

  private static worldPos = new THREE.Vector3();

  private static matrix = new THREE.Matrix4();
  private static frustum = new THREE.Frustum();

  private static raycaster = new THREE.Raycaster();
  private static intersections = new Array<THREE.Intersection<THREE.Object3D>>();
  private static direction = new THREE.Vector3();

  private static shouldShowInteraction(
    interaction: Interaction,
    camera: THREE.Camera,
    scene: THREE.Scene,
  ): number | null {
    const worldPos = interaction.getContainer().getWorldPosition(InteractionManager.worldPos);

    const cameraPos = camera.position;
    const distance = cameraPos.distanceTo(worldPos);
    if (distance > interaction.props.range) {
      return null;
    }

    if (interaction.props.inFocus) {
      InteractionManager.matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      InteractionManager.frustum.setFromProjectionMatrix(InteractionManager.matrix);
      if (!InteractionManager.frustum.containsPoint(worldPos)) {
        return null;
      }
    }

    if (interaction.props.lineOfSight) {
      const raycastResults = InteractionManager.getRaycastResults(
        cameraPos,
        worldPos,
        distance,
        scene,
      );
      if (raycastResults.length > 0) {
        for (const result of raycastResults) {
          if (!InteractionManager.hasAncestor(result.object, interaction.getContainer())) {
            return null;
          }
        }
      }
    }

    return distance;
  }

  private static hasAncestor(object: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let parent = object.parent;
    while (parent !== null) {
      if (parent === ancestor) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private constructor(container: HTMLElement, camera: THREE.Camera, threeJSScene: THREE.Scene) {
    this.container = container;
    this.threeJSScene = threeJSScene;
    this.camera = camera;
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

  private getInteractionListener(): InteractionListener {
    return {
      addInteraction: (interaction: Interaction) => {
        this.possibleActions.set(interaction, {
          interaction,
        });
      },
      removeInteraction: (interaction: Interaction) => {
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
      updateInteraction: (interaction: Interaction) => {
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

  private static getRaycastResults(
    a: THREE.Vector3,
    b: THREE.Vector3,
    distance: number,
    scene: THREE.Scene,
  ) {
    InteractionManager.direction.copy(b);
    InteractionManager.direction.sub(a);
    InteractionManager.direction.normalize();

    InteractionManager.raycaster.set(a, InteractionManager.direction);
    InteractionManager.raycaster.near = 0;
    InteractionManager.raycaster.far = distance;

    InteractionManager.intersections.length = 0;
    InteractionManager.raycaster.intersectObject(scene, true, InteractionManager.intersections);
    return InteractionManager.intersections;
  }

  static init(
    container: HTMLElement,
    camera: THREE.Camera,
    threeJSScene: THREE.Scene,
  ): {
    interactionManager: InteractionManager;
    interactionListener: InteractionListener;
  } {
    const interactionManager = new InteractionManager(container, camera, threeJSScene);
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
        const showDistance = InteractionManager.shouldShowInteraction(
          interaction,
          this.camera,
          this.threeJSScene,
        );
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
