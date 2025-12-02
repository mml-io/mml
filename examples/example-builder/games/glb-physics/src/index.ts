let duckCounter = 0;
const duckSceneGroup = document.getElementById("scene-group");
const camera = document.createElement("m-camera");
camera.setAttribute("z", "5");
camera.setAttribute("y", "5");
camera.setAttribute("rx", "-10");
duckSceneGroup.appendChild(camera);

function spawnDuck() {
  duckCounter++;
  const duckId = `duck-${duckCounter}`;  

  const funnel = document.getElementById("funnel");
  if (!funnel) {
    console.error("Funnel not found!");
    return;
  }
  
  const funnelX = parseFloat(funnel.getAttribute("x") || "0");
  const funnelY = parseFloat(funnel.getAttribute("y") || "0");
  const funnelZ = parseFloat(funnel.getAttribute("z") || "0");
  
  const randomX = funnelX + (Math.random() - 0.5) * 2;
  const randomZ = funnelZ + (Math.random() - 0.5) * 2;
  const spawnY = funnelY + 5 + Math.random() * 2;
  
  const duck = document.createElement("m-model");
  duck.setAttribute("id", duckId);
  duck.setAttribute("src", "/assets/models/duck.glb");
  duck.setAttribute("x", randomX.toFixed(2));
  duck.setAttribute("y", spawnY.toFixed(2));
  duck.setAttribute("z", randomZ.toFixed(2));
  
  duck.setAttribute("rigidbody", "true");
  duck.setAttribute("mass", "150");
  duck.setAttribute("collide", "true");
  
  if (duckSceneGroup) {
    duckSceneGroup.appendChild(duck);
    console.log(`Spawned duck ${duckId} at (${randomX.toFixed(2)}, ${spawnY.toFixed(2)}, ${randomZ.toFixed(2)})`);
    
    // Check if duck was added to physics after a delay (to allow GLB to load)
    setTimeout(() => {
      const physics = (window as any).physics;
      if (!physics) {
        console.error(`[Duck ${duckId}] Physics system not available`);
        return;
      }
      
      const isInPhysics = physics.elementToBody?.has(duck);
      console.log(`[Duck ${duckId}] In physics system: ${isInPhysics}`);
      
      if (!isInPhysics) {
        console.warn(`[Duck ${duckId}] Not in physics system, manually adding...`);
        // Manually trigger processElement by setting the attribute again
        duck.setAttribute("rigidbody", "true");
      } else {
        const physicsState = physics.elementToBody?.get(duck);
        if (physicsState && physicsState.rigidbody) {
          const translation = physicsState.rigidbody.translation();
          console.log(`[Duck ${duckId}] Rigidbody position: (${translation.x.toFixed(2)}, ${translation.y.toFixed(2)}, ${translation.z.toFixed(2)})`);
          const isKinematic = (physicsState.rigidbody as any).isKinematic?.() || false;
          console.log(`[Duck ${duckId}] Is kinematic: ${isKinematic}`);
        }
      }
    }, 1000);
  }

  setTimeout(() => {
    const duckToRemove = document.getElementById(duckId);
    if (duckToRemove && duckToRemove.parentNode) {
      duckToRemove.parentNode.removeChild(duckToRemove);
      console.log(`Removed duck ${duckId}`);
    }
  }, 10000);
}

function init() {
  console.log("GLB Physics Demo initialized");
  
  // Wait for physics system to be ready
  const checkPhysics = setInterval(() => {
    if ((window as any).physics) {
      clearInterval(checkPhysics);
      console.log("Physics system ready!");
      
      // Set up click handler on funnel
      const funnel = document.getElementById("funnel");
      if (funnel) {
        funnel.addEventListener("click", (event: any) => {
          console.log("Funnel clicked! Spawning duck...");
          spawnDuck();
        });
        console.log("Funnel click handler attached");
      } else {
        console.error("Funnel element not found!");
      }
    }
  }, 100);
}

init();

