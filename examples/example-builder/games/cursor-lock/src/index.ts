// No additional runtime required for the demo beyond MML in the document.
// Provide a helpful hint for locked mode: clicking the canvas will request pointer lock via the element.
(() => {
  document.addEventListener("click", () => {
    // If the demo is in locked mode, ensure a click on the scene requests pointer lock
    const mouse = document.getElementById("mouse");
    if (!mouse) return;
    const mode = mouse.getAttribute("mode");
    if (mode === "locked") {
      // The element handles calling requestPointerLock on the scene canvas.
      // Just a gentle nudge by setting the attribute again to trigger logic if needed.
      mouse.setAttribute("mode", "locked");
    }
  });

  // Tools-style character spawn for local client (scoped to IIFE)
  const assignAnimationLerp = (element: Element, duration: number, attrs: string) => {
    const lerp = document.createElement("m-attr-lerp");
    lerp.setAttribute("attr", attrs);
    lerp.setAttribute("duration", String(duration));
    element.appendChild(lerp);
  };

  const setTransform = (element: Element, x: number, y: number, z: number, ry: number) => {
    element.setAttribute("x", String(x));
    element.setAttribute("y", String(y));
    element.setAttribute("z", String(z));
    element.setAttribute("ry", String(ry));
  };

  const createPlayer = (): Element => {
    // Lightweight character model used by tools examples
    const player = document.createElement("m-character");
    player.setAttribute(
      "src",
      "/assets/bot.glb",
    );
    player.setAttribute("state", "idle");
    assignAnimationLerp(player, 100, "x,y,z,ry");
    setTransform(player, Math.random() * 4 - 2, 0, Math.random() * 4 - 2, 0);
    document.body.appendChild(player);
    return player;
  };

  const assignPlayerAnimation = (
    player: Element,
    state: "idle" | "run" | "air",
  ): Element => {
    // Remote-hosted animations like in tools
    const animation = document.createElement("m-animation");
    animation.setAttribute("src", `/assets/anim_${state}.glb`);
    animation.setAttribute("state", state);
    animation.setAttribute("weight", state === "idle" ? "1.0" : "0.0");
    assignAnimationLerp(animation, 150, "weight");
    player.appendChild(animation);
    return animation;
  };

  const assignPlayerController = (player: Element, connectionId: number): Element => {
    const controller = document.createElement("m-character-controller");
    controller.setAttribute("visible-to", String(connectionId));
    player.appendChild(controller);
    return controller;
  };

  const getLocalConnectionId = (): number => {
    // In single-client dev, internal id usually starts at 1
    return 1;
  };

  // Expose a spawn function for overlay button
  (window as any).spawnLocalCharacter = () => {
    const connectionId = getLocalConnectionId();
    const player = createPlayer();
    const controller = assignPlayerController(player, connectionId);
    const idleAnimation = assignPlayerAnimation(player, "idle");
    const runAnimation = assignPlayerAnimation(player, "run");
    const airAnimation = assignPlayerAnimation(player, "air");

    controller.addEventListener("character-move", (event: any) => {
      const { position, rotation, state } = event.detail;
      setTransform(player, position.x, position.y, position.z, rotation.ry);
      idleAnimation.setAttribute("weight", state === "idle" ? "1.0" : "0.0");
      runAnimation.setAttribute("weight", state === "run" ? "1.0" : "0.0");
      airAnimation.setAttribute("weight", state === "air" ? "1.0" : "0.0");
    });
  };
})();

 