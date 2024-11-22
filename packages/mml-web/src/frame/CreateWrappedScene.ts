import { ChatProbe, Interaction, MElement } from "../elements";
import { GraphicsAdapter } from "../graphics";
import { LoadingProgressManager } from "../loading";
import { IMMLScene, LinkProps, PromptProps } from "../scene";

export function createWrappedScene<G extends GraphicsAdapter = GraphicsAdapter>(
  scene: IMMLScene<G>,
  loadingProgressManager: LoadingProgressManager | null,
): IMMLScene<G> {
  return {
    addCollider(collider: unknown, element: MElement<G>): void {
      if (scene.addCollider) {
        scene.addCollider(collider, element);
      }
    },
    updateCollider(collider: unknown, element: MElement<G>): void {
      if (scene.updateCollider) {
        scene.updateCollider(collider, element);
      }
    },
    removeCollider(collider: unknown, element: MElement<G>): void {
      if (scene.removeCollider) {
        scene.removeCollider(collider, element);
      }
    },
    addInteraction(interaction: Interaction<G>): void {
      if (scene.addInteraction) {
        scene.addInteraction(interaction);
      }
    },
    updateInteraction(interaction: Interaction<G>): void {
      if (scene.updateInteraction) {
        scene.updateInteraction(interaction);
      }
    },
    removeInteraction(interaction: Interaction<G>): void {
      if (scene.removeInteraction) {
        scene.removeInteraction(interaction);
      }
    },
    addChatProbe(chatProbe: ChatProbe<G>): void {
      if (scene.addChatProbe) {
        scene.addChatProbe(chatProbe);
      }
    },
    updateChatProbe(chatProbe: ChatProbe<G>): void {
      if (scene.updateChatProbe) {
        scene.updateChatProbe(chatProbe);
      }
    },
    removeChatProbe(chatProbe: ChatProbe<G>): void {
      if (scene.removeChatProbe) {
        scene.removeChatProbe(chatProbe);
      }
    },
    hasGraphicsAdapter() {
      return scene.hasGraphicsAdapter();
    },
    getGraphicsAdapter() {
      return scene.getGraphicsAdapter();
    },
    prompt(
      promptProps: PromptProps,
      abortSignal: AbortSignal,
      callback: (result: string | null) => void,
    ) {
      scene.prompt(promptProps, abortSignal, callback);
    },
    link(
      linkProps: LinkProps,
      abortSignal: AbortSignal,
      windowCallback: (openedWindow: Window | null) => void,
    ) {
      scene.link(linkProps, abortSignal, windowCallback);
    },
    getRootContainer: () => {
      throw new Error("Wrapped scenes do not have a root container");
    },
    getUserPositionAndRotation: () => {
      return scene.getUserPositionAndRotation();
    },
    getLoadingProgressManager: () => {
      return loadingProgressManager;
    },
  };
}
