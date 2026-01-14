import { createMMLGameClient } from "mml-game-engine-client";

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
}

boot().catch((e) => {
  console.error("[mml-dev-runner] failed to start:", e);
  setStatus("Runner failed to start. See console.");
});

