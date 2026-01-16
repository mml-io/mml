import { createMMLGameClient, MMLWebClient } from "mml-game-engine-client";

declare global {
  interface Window {
    mmlClient?: MMLWebClient & {
      setDebugCamera: (
        position?: { x: number; y: number; z: number },
        target?: { x: number; y: number; z: number }
      ) => void;
      getCameraPosition: () => { x: number; y: number; z: number } | null;
    };
  }
}

function wsUrlForThisHost(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/mml`;
}

function setStatus(message: string | null): void {
  const el = document.getElementById("mml-dev-status");
  if (el) {
    if (!message) {
      (el as HTMLElement).style.display = "none";
      el.textContent = "";
      return;
    }
    (el as HTMLElement).style.display = "block";
    el.textContent = message;
  }
}

async function boot(): Promise<void> {
  const client = await createMMLGameClient();

  // Extend client with debug helpers
  const extendedClient = client as typeof client & {
    setDebugCamera: (
      position?: { x: number; y: number; z: number },
      target?: { x: number; y: number; z: number }
    ) => void;
    getCameraPosition: () => { x: number; y: number; z: number } | null;
  };

  extendedClient.setDebugCamera = (
    position?: { x: number; y: number; z: number },
    target?: { x: number; y: number; z: number }
  ): void => {
    const camera = (client as any).camera;
    if (!camera) {
      console.warn("Camera not available");
      return;
    }

    if (position) {
      camera.position.set(position.x, position.y, position.z);
    }
    if (target) {
      camera.lookAt(target.x, target.y, target.z);
    }
  };

  extendedClient.getCameraPosition = (): { x: number; y: number; z: number } | null => {
    const camera = (client as any).camera;
    if (!camera) {
      return null;
    }
    return {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };
  };

  window.mmlClient = extendedClient;

  const root = document.getElementById("mml-dev-root");
  if (root) {
    root.appendChild(client.element);
  } else {
    document.body.appendChild(client.element);
  }

  const wsUrl = wsUrlForThisHost();
  client.connectToSocket(wsUrl);

  const fit = () => client.fitContainer();
  window.addEventListener("resize", fit);
  fit();
  setStatus(null);

  console.log("[mml-dev-runner] Debug helpers available on window.mmlClient");
}

boot().catch((e) => {
  console.error("[mml-dev-runner] failed to start:", e);
  setStatus("Runner failed to start. See console.");
});
