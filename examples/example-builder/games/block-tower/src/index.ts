import "./characters";

function createTower() {
  console.log("Tower creating");
  const towerGroup = document.getElementById('tower');

  const colors = ['#D2B48C', '#C3A67B', '#B4986A'];
  const numLevels = 50;
  const blocksPerLevel = 3;
  const totalBlocks = numLevels * blocksPerLevel;
  const blockHeight = 0.5;
  const blockWidth = 3;
  const blockDepth = 1;

  for (let i = 0; i < totalBlocks; i++) {
    const block = document.createElement('m-cube');
    block.setAttribute('id', `block${i + 1}`);
    block.setAttribute('class', 'block');
    block.setAttribute('color', colors[i % colors.length]);
    block.setAttribute('width', `${blockWidth}`);
    block.setAttribute('height', `${blockHeight}`);
    block.setAttribute('depth', `${blockDepth}`);
    block.setAttribute('rigidbody', 'true');
    block.setAttribute('onclick', 'this.remove()');

    const level = Math.floor(i / blocksPerLevel);
    const blockInLevel = i % blocksPerLevel;

    const positionOffset = (blockInLevel - (blocksPerLevel - 1) / 2);

    block.setAttribute('y', `${(blockHeight / 2 + level * blockHeight) + (blockHeight)}`);

    if (level % 2 === 0) {
      block.setAttribute('ry', '0');
      block.setAttribute('x', '0');
      block.setAttribute('z', `${positionOffset * blockDepth * 1.05}`);
    } else {
      block.setAttribute('ry', '90');
      block.setAttribute('x', `${positionOffset * blockDepth * 1.05}`);
      block.setAttribute('z', '0');
    }

    towerGroup.appendChild(block);
  }
}

function resetTower() {
  console.log("Resetting tower");
  const towerGroup = document.getElementById('tower');
  
  // Remove all existing blocks
  while (towerGroup.firstChild) {
    towerGroup.removeChild(towerGroup.firstChild);
  }
  
  // Rebuild the tower
  createTower(); 
}

function generateRandomColor() {
  // Generate bright, vibrant colors
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
    '#EE5A24', '#009432', '#0652DD', '#9980FA', '#833471',
    '#F79F1F', '#A3CB38', '#1289A7', '#D63031', '#74B9FF'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function setupCollisionListener() {
  console.log("Setting up collision listener!");
  (window as any).physics.onCollision((event) => {
    // Only change colors on collision start to avoid rapid color changes
    if (event.type === 'collision_start') {
      const elementA = event.elementA;
      const elementB = event.elementB;
      
      // Check if elementA is a block and change its color
      if (elementA && elementA.classList && elementA.classList.contains('block')) {
        elementA.setAttribute('color', generateRandomColor());
      }
      
      // Check if elementA is a sphere and change its color
      if (elementA && elementA.id && elementA.id.startsWith('sphere-')) {
        elementA.setAttribute('color', generateRandomColor());
      }
      
      // Check if elementB is a block and change its color
      if (elementB && elementB.classList && elementB.classList.contains('block')) {
        elementB.setAttribute('color', generateRandomColor());
      }
      
      // Check if elementB is a sphere and change its color
      if (elementB && elementB.id && elementB.id.startsWith('sphere-')) {
        elementB.setAttribute('color', generateRandomColor());
      }
    }
  });
}

createTower();

setupCollisionListener();

const launchSphere = function() {
  const sphere = document.createElement('m-sphere');
  const sphereId = `sphere-${Date.now()}`;
  sphere.setAttribute('id', sphereId);
  sphere.setAttribute('color', 'blue');
  sphere.setAttribute('radius', '0.5');
  sphere.setAttribute('rigidbody', 'true');
  sphere.setAttribute('mass', '10');

  const angle = Math.random() * 2 * Math.PI;
  const distance = 10;
  const startX = Math.cos(angle) * distance;
  const startZ = Math.sin(angle) * distance;
  const startY = 2;

  sphere.setAttribute('x', `${startX}`);
  sphere.setAttribute('y', `${startY}`);
  sphere.setAttribute('z', `${startZ}`);

  document.body.appendChild(sphere);

  const targetY = 10;
  const directionX = -startX;
  const directionY = targetY - startY;
  const directionZ = -startZ;

  const length = Math.sqrt(directionX ** 2 + directionY ** 2 + directionZ ** 2);
  const normX = directionX / length;
  const normY = directionY / length;
  const normZ = directionZ / length;

  const impulseStrength = 100 + Math.random() * 500;
  const impulse = {
    x: normX * impulseStrength,
    y: normY * impulseStrength,
    z: normZ * impulseStrength,
  };

  // TODO - avoid this timeout by allowing impulses to be applied immediately
  setTimeout(() => {
    (window as any).physics.applyImpulse(sphere, impulse);
  }, 50);

  setTimeout(() => {
    const sphereToRemove = document.getElementById(sphereId);
    if (sphereToRemove) {
      sphereToRemove.remove();
    }
  }, 5000);
};

let autofireEnabled = false;
let autofireInterval = null;

function toggleAutofire() {
  autofireEnabled = !autofireEnabled;
  const autofireButton = document.getElementById('autofire-button');
  
  if (autofireEnabled) {
    autofireButton.setAttribute('color', 'yellow');
    startAutofire();
  } else {
    autofireButton.setAttribute('color', 'orange');
    stopAutofire();
  }
}

function startAutofire() {
  if (autofireInterval) {
    clearInterval(autofireInterval);
  }
  autofireInterval = setInterval(() => {
    launchSphere();
  }, 100);
}

function stopAutofire() {
  if (autofireInterval) {
    clearInterval(autofireInterval);
    autofireInterval = null;
  }
}

(window as any).launchSphere = launchSphere;
(window as any).toggleAutofire = toggleAutofire;
(window as any).resetTower = resetTower;