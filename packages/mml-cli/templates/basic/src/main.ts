const cratesParent = document.getElementById("crate-zone");
const spawnPad = document.getElementById("spawn-crate");
const nudgePad = document.getElementById("push-crate");
const localPlayer = document.getElementById("player");

function attachCharacterController(element: Element | null, connectionId: string | number = "local") {
  if (!element) return;
  const controller = element.querySelector("m-character-controller");
  if (!controller) return;

  if (connectionId !== "local") {
    controller.setAttribute("visible-to", connectionId.toString());
  }

  controller.addEventListener("character-move", (event: any) => {
    const { position, rotation, state } = event.detail;
    element.setAttribute("x", position.x.toString());
    element.setAttribute("y", position.y.toString());
    element.setAttribute("z", position.z.toString());
    element.setAttribute("ry", rotation.ry.toString());
    element.setAttribute("state", state);
  });
}

function createRemotePlayer(connectionId: number) {
  const capsule = document.createElement("m-capsule");
  capsule.setAttribute("height", "1.8");
  capsule.setAttribute("radius", "0.35");
  capsule.setAttribute("color", "#9b59b6");
  capsule.setAttribute("y", "1.2");
  capsule.setAttribute("x", (Math.random() * 4 - 2).toFixed(2));
  capsule.setAttribute("z", (Math.random() * 4 - 2).toFixed(2));
  capsule.setAttribute("data-connection-id", connectionId.toString());

  const controller = document.createElement("m-character-controller");
  controller.setAttribute("visible-to", connectionId.toString());
  capsule.appendChild(controller);

  attachCharacterController(capsule, connectionId);
  document.body.appendChild(capsule);
}

function spawnCrate() {
  if (!cratesParent) return;
  const cube = document.createElement("m-cube");
  cube.setAttribute("width", "0.8");
  cube.setAttribute("height", "0.8");
  cube.setAttribute("depth", "0.8");
  cube.setAttribute("color", "#f5b041");
  cube.setAttribute("rigidbody", "true");
  cube.setAttribute("mass", "2.5");
  cube.setAttribute("x", (Math.random() * 6 - 3).toFixed(2));
  cube.setAttribute("y", (Math.random() * 4 + 4).toFixed(2));
  cube.setAttribute("z", (Math.random() * 6 - 3).toFixed(2));

  cratesParent.appendChild(cube);
}

function nudgeCrates() {
  const cubes = Array.from(cratesParent?.children || []);
  cubes.forEach((cube, index) => {
    const impulse = {
      x: 40 + index * 5,
      y: 0,
      z: 0,
    };
    (window as any).physics?.applyImpulse(cube, impulse);
  });
}

function setupButtons() {
  spawnPad?.addEventListener("click", spawnCrate);
  nudgePad?.addEventListener("click", nudgeCrates);
}

function bootstrapLocalPlayer() {
  attachCharacterController(localPlayer);
}

function setupConnections() {
  window.addEventListener("connected", (event: any) => {
    const connectionId = event.detail?.connectionId;
    if (connectionId === undefined || connectionId === null) return;
    createRemotePlayer(connectionId);
  });

  window.addEventListener("disconnected", (event: any) => {
    const connectionId = event.detail?.connectionId;
    if (connectionId === undefined || connectionId === null) return;
    const toRemove = document.querySelector(
      `m-capsule[data-connection-id="${connectionId}"]`,
    );
    if (toRemove && toRemove.parentElement) {
      toRemove.parentElement.removeChild(toRemove);
    }
  });
}

bootstrapLocalPlayer();
setupButtons();
setupConnections();
spawnCrate();
setInterval(spawnCrate, 5000);

(window as any).spawnCrate = spawnCrate;
(window as any).nudgeCrates = nudgeCrates;
