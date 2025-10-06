// M-Character Controller Test Game

const sceneGroup = document.getElementById("scene-group");
const connectedPlayers = new Map();

function setTransform(element, x, y, z, ry) {
  ["x", "y", "z"].forEach(attr => element.setAttribute(attr, attr === "x" ? x : attr === "y" ? y : z));
  element.setAttribute("ry", ry);
}

function assignAnimationLerp(element, duration, attrs) {
  const lerp = document.createElement("m-attr-lerp");
  lerp.setAttribute("attr", attrs);
  lerp.setAttribute("duration", duration);
  element.appendChild(lerp);
}

function createPlayer() {
  const player = document.createElement("m-model");
  player.setAttribute("src", "/assets/models/bot.glb");
  assignAnimationLerp(player, 100, "x,y,z,ry");
  setTransform(player, Math.random() * 4 - 2, 0, Math.random() * 4 - 2, 0);
  sceneGroup.appendChild(player);
  return player;
}

function assignPlayerAnimation(player, state) {
  const animation = document.createElement("m-animation");
  animation.setAttribute("src", `/assets/models/anim_${state}.glb`);
  animation.setAttribute("state", state);
  assignAnimationLerp(animation, 150, "weight");
  player.appendChild(animation);
  return animation;
}

function assignPlayerController(player, id) {
  const controller = document.createElement("m-character-controller");
  controller.setAttribute("visible-to", id.toString());
  player.appendChild(controller);
  return controller;
}

function spawnPlayer(connectionId) {
  if (connectedPlayers.has(connectionId)) return;
  const player = createPlayer();
  const controller = assignPlayerController(player, connectionId);

  const idleAnimation = assignPlayerAnimation(player, "idle");
  const runAnimation = assignPlayerAnimation(player, "run");
  const airAnimation = assignPlayerAnimation(player, "air");

  connectedPlayers.set(connectionId, {
    character: { model: player, idleAnim: idleAnimation, runAnim: runAnimation, airAnim: airAnimation }
  });

  controller.addEventListener("character-move", (event) => {
    const { position, rotation, state, connectionId } = event.detail;
    const character = connectedPlayers.get(connectionId).character;
    setTransform(character.model, position.x, position.y, position.z, rotation.ry);
    character.model.setAttribute("state", state);
  });
}

function removePlayer(connectionId) {
  if (!connectedPlayers.has(connectionId)) return;
  const user = connectedPlayers.get(connectionId);
  sceneGroup.removeChild(user.character.model);
  connectedPlayers.delete(connectionId);
}

// Camera management functions
function enableCamera(cameraId) {
  const camera = document.getElementById(cameraId);
  if (camera) {
    camera.removeAttribute("visible-to");
  }
}

function disableCamera(cameraId) {
  const camera = document.getElementById(cameraId);
  if (camera) {
    camera.setAttribute("visible-to", "-1");
  }
}

function isCameraEnabled(cameraId) {
  const camera = document.getElementById(cameraId);
  return camera && !camera.hasAttribute("visible-to");
}

function setCubeVisual(cubeId, activated) {
  const cube = document.getElementById(cubeId);
  if (!cube) return;
  
  if (cubeId === "blue-cube") {
    cube.setAttribute("color", activated ? "rgb(0, 0, 255)" : "rgb(0, 0, 25)");
  } else if (cubeId === "red-cube") {
    cube.setAttribute("color", activated ? "rgb(255, 0, 0)" : "rgb(25, 0, 0)");
  }
}

function toggleCamera(cameraId, cubeId) {
  const enabled = isCameraEnabled(cameraId);
  if (enabled) {
    disableCamera(cameraId);
    setCubeVisual(cubeId, false);
  } else {
    enableCamera(cameraId);
    setCubeVisual(cubeId, true);
  }
}

// Set up cube click handlers
const blueCube = document.getElementById("blue-cube");
const redCube = document.getElementById("red-cube");

blueCube.addEventListener("click", () => {
  toggleCamera("top-down-camera", "blue-cube");
});

redCube.addEventListener("click", () => {
  toggleCamera("angle-camera", "red-cube");
});

// Initialize cube visuals
setCubeVisual("blue-cube", isCameraEnabled("top-down-camera"));
setCubeVisual("red-cube", isCameraEnabled("angle-camera"));

window.addEventListener("connected", (event) => spawnPlayer(event.detail.connectionId));
window.addEventListener("disconnected", (event) => removePlayer(event.detail.connectionId));

console.log("M-Character Controller Test loaded!");
