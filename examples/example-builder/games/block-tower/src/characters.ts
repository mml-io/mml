const connectedPlayers = new Map();

function assignAnimationLerp(element, duration, attrs) {
  const lerp = document.createElement("m-attr-lerp");
  lerp.setAttribute("attr", attrs);
  lerp.setAttribute("duration", duration);
  element.appendChild(lerp);
}

function assignPlayerAnimation(player, state) {
  const animation = document.createElement("m-animation");
  animation.setAttribute("src", `/assets/models/anim_${state}.glb`);
  animation.setAttribute("state", state);
  assignAnimationLerp(animation, 150, "weight");
  player.appendChild(animation);
  return animation;
}

window.addEventListener("connected", (event) => {
  const connectionId = event.detail.connectionId;
  if (connectedPlayers.has(connectionId)) return;
  const player = document.createElement("m-model");
  player.setAttribute("src", "/assets/models/dummy.glb");
  assignAnimationLerp(player, 100, "x,y,z,ry");
  player.setAttribute("x", (Math.random() * 4 - 2).toString());
  player.setAttribute("z", (Math.random() * 4 - 2).toString());
  player.setAttribute("ry", "0");
  const controller = document.createElement("m-character-controller");
  controller.setAttribute("visible-to", connectionId.toString());
  player.appendChild(controller);
  const idleAnimation = assignPlayerAnimation(player, "idle");
  const runAnimation = assignPlayerAnimation(player, "run");
  const airAnimation = assignPlayerAnimation(player, "air");
  document.body.appendChild(player);

  connectedPlayers.set(connectionId, {
    character: { model: player, idleAnim: idleAnimation, runAnim: runAnimation, airAnim: airAnimation }
  });

  controller.addEventListener("character-move", (event) => {
    const { position, rotation, state, connectionId } = event.detail;
    const character = connectedPlayers.get(connectionId).character;
    character.model.setAttribute("x", position.x.toString());
    character.model.setAttribute("y", position.y.toString());
    character.model.setAttribute("z", position.z.toString());
    character.model.setAttribute("ry", rotation.ry.toString());
    character.model.setAttribute("state", state);
  });
});

window.addEventListener("disconnected", (event) => {
  const connectionId = event.detail.connectionId;
  if (!connectedPlayers.has(connectionId)) return;
  const user = connectedPlayers.get(connectionId);
  document.body.removeChild(user.character.model);
  connectedPlayers.delete(connectionId);
});
