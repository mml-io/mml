const connectedPlayers = new Map();
let latestPlayerPos = null;

// Manage multiple chaser agents
const chasers = [];
let playersEnabled = false;
const previousPositions = new Map(); // Element -> { x, z }
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}
function getRandomChaserModelSrc() {
  const options = [
    'http://files.dreamcache.xyz/models/01K6DEJHJVGMPCYXJ52AM4W2TV.glb',
    'http://files.dreamcache.xyz/models/01K5YWERGDPJVH3MPKKBXYGBPF.glb',
    'http://files.dreamcache.xyz/models/01K6GP4WF007CARPZR579DX663.glb',
    'http://files.dreamcache.xyz/models/01K6J5FSEWJJZ1GBVP0JHR28BV.glb',
    'http://files.dreamcache.xyz/models/01K6GNSYEF1NSN85MJCJMPFR8V.glb',
    'http://files.dreamcache.xyz/models/01K6GP4RHAJ17R6YAJZPCKHW7F.glb',
    'http://files.dreamcache.xyz/models/01K6GP4EHTS1XPEY22QZJHJ8A7.glb',
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function assignChaserAnimation(modelEl, state) {
  const animation = document.createElement('m-animation');
  animation.setAttribute('src', `/assets/models/anim_${state}.glb`);
  animation.setAttribute('state', state);
  animation.setAttribute('weight', state === 'run' ? '1.0' : '0.0');
  assignAnimationLerp(animation, 150, 'weight');
  modelEl.appendChild(animation);
  return animation;
}

function createModelChaser(idSuffix) {
  const model = document.createElement('m-model');
  model.setAttribute('id', `chaser-${idSuffix}`);
  model.setAttribute('src', getRandomChaserModelSrc());
  model.setAttribute('y', '1');
  model.setAttribute('x', String(randomInRange(-140, 140)));
  model.setAttribute('z', String(randomInRange(-140, 140)));
  model.setAttribute('nav-agent', 'true');
  model.setAttribute('rigidbody', 'true');
  model.setAttribute('kinematic', 'true');
  model.setAttribute('nav-speed', '25');
  model.setAttribute('nav-acceleration', '40');
  // Attach animations (default to running when chasing)
  assignChaserAnimation(model, 'idle');
  assignChaserAnimation(model, 'run');
  assignChaserAnimation(model, 'air');
  document.body.appendChild(model);
  // Seed previous position for rotation tracking
  previousPositions.set(model, { x: parseFloat(model.getAttribute('x') || '0'), z: parseFloat(model.getAttribute('z') || '0') });
  return model;
}

function createCubeChaser(idSuffix) {
  const cube = document.createElement('m-cube');
  cube.setAttribute('id', `chaser-${idSuffix}`);
  cube.setAttribute('color', '#e74c3c');
  cube.setAttribute('width', '1.2');
  cube.setAttribute('depth', '1.2');
  cube.setAttribute('height', '2');
  cube.setAttribute('y', '1');
  cube.setAttribute('x', String(randomInRange(-140, 140)));
  cube.setAttribute('z', String(randomInRange(-140, 140)));
  cube.setAttribute('nav-agent', 'true');
  cube.setAttribute('rigidbody', 'true');
  cube.setAttribute('kinematic', 'true');
  cube.setAttribute('nav-speed', '25');
  cube.setAttribute('nav-acceleration', '40');
  document.body.appendChild(cube);
  // Seed previous position for rotation tracking
  previousPositions.set(cube, { x: parseFloat(cube.getAttribute('x') || '0'), z: parseFloat(cube.getAttribute('z') || '0') });
  return cube;
}

function spawnChaser(idSuffix) {
  return playersEnabled ? createModelChaser(idSuffix) : createCubeChaser(idSuffix);
}
function updateAgentCountUI() {
  const label = document.getElementById('agent-count-label');
  if (label) {
    label.textContent = String(chasers.length);
  }
}
function setAgentCount(newCount) {
  const clamped = Math.max(1, Math.min(500, Math.floor(newCount)));
  while (chasers.length < clamped) {
    const idx = chasers.length + 1; // 1-based for readability
    chasers.push(spawnChaser(idx));
  }
  while (chasers.length > clamped) {
    const agent = chasers.pop();
    if (agent && agent.parentNode) {
      agent.parentNode.removeChild(agent);
    }
  }
  updateAgentCountUI();
}

function rebuildChasers() {
  const count = chasers.length;
  while (chasers.length > 0) {
    const agent = chasers.pop();
    if (agent && agent.parentNode) {
      agent.parentNode.removeChild(agent);
    }
    previousPositions.delete(agent);
  }
  for (let i = 1; i <= count; i++) {
    chasers.push(spawnChaser(i));
  }
  updateAgentCountUI();
}

function updateAgentRotation(agent) {
  const curX = parseFloat(agent.getAttribute('x') || '0');
  const curZ = parseFloat(agent.getAttribute('z') || '0');
  const prev = previousPositions.get(agent);
  if (prev) {
    const dx = curX - prev.x;
    const dz = curZ - prev.z;
    const speedSq = dx * dx + dz * dz;
    if (speedSq > 1e-6) {
      const angleRad = Math.atan2(dx, dz);
      const angleDeg = angleRad * (180 / Math.PI);
      agent.setAttribute('ry', String(angleDeg));
    }
  }
  previousPositions.set(agent, { x: curX, z: curZ });
}

function setTransform(element, x, y, z, ry) {
  ["x", "y", "z"].forEach(attr => element.setAttribute(attr, attr === "x" ? x : attr === "y" ? y : z));
  element.setAttribute("ry", ry);
}

function assignAnimationLerp(element, duration, attrs) {
  const lerp = document.createElement('m-attr-lerp');
  lerp.setAttribute('attr', attrs);
  lerp.setAttribute('duration', String(duration));
  element.appendChild(lerp);
}

function createPlayer() {
  const player = document.createElement('m-character');
  // Lightweight bot model and animations hosted remotely (same sources used by tools)
  player.setAttribute('src', 'https://files.dreamcache.xyz/models/01K6GPT4NSJPYYJZNSQF1GQ4CJ.glb');
  player.setAttribute('state', 'idle');
  assignAnimationLerp(player, 100, 'x,y,z,ry');
  setTransform(player, Math.random() * 4 - 2, 0, Math.random() * 4 - 2, 0);
  document.body.appendChild(player);
  return player;
}

function assignPlayerAnimation(player, state) {
  const animation = document.createElement('m-animation');
  animation.setAttribute('src', `/assets/models/anim_${state}.glb`);
  animation.setAttribute('state', state);
  animation.setAttribute('weight', state === 'idle' ? '1.0' : '0.0');
  assignAnimationLerp(animation, 150, 'weight');
  player.appendChild(animation);
  return animation;
}

function assignPlayerController(player, connectionId) {
  const controller = document.createElement('m-character-controller');
  controller.setAttribute('visible-to', String(connectionId));
  player.appendChild(controller);
  return controller;
}

function spawnPlayer(connectionId) {
  if (connectedPlayers.has(connectionId)) return;

  const player = createPlayer();
  const controller = assignPlayerController(player, connectionId);
  const idleAnimation = assignPlayerAnimation(player, 'idle');
  const runAnimation = assignPlayerAnimation(player, 'run');
  const airAnimation = assignPlayerAnimation(player, 'air');

  connectedPlayers.set(connectionId, {
    character: { model: player, idleAnim: idleAnimation, runAnim: runAnimation, airAnim: airAnimation }
  });

  controller.addEventListener('character-move', (event) => {
    const { position, rotation, state } = (event as CustomEvent<any>).detail;
    const character = connectedPlayers.get(connectionId).character;
    setTransform(character.model, position.x, position.y, position.z, rotation.ry);
    character.idleAnim.setAttribute('weight', state === 'idle' ? '1.0' : '0.0');
    character.runAnim.setAttribute('weight', state === 'run' ? '1.0' : '0.0');
    character.airAnim.setAttribute('weight', state === 'air' ? '1.0' : '0.0');
    latestPlayerPos = position;
  });
}

function removePlayer(connectionId) {
  if (!connectedPlayers.has(connectionId)) return;
  const user = connectedPlayers.get(connectionId);
  try { document.body.removeChild(user.character.model); } catch {}
  connectedPlayers.delete(connectionId);
  latestPlayerPos = null;
}

// Auto-spawn local player using the tools pattern
window.addEventListener('connected', (event) => spawnPlayer((event as CustomEvent<any>).detail.connectionId));
window.addEventListener('disconnected', (event) => removePlayer((event as CustomEvent<any>).detail.connectionId));

// Simple chase loop: periodically repath chasers to the latest player position
const CHASE_INTERVAL_MS = 250;

// Initialize UI controls
const minusBtn = document.getElementById('agent-minus');
const plusBtn = document.getElementById('agent-plus');
const minBtn = document.getElementById('agent-min');
const maxBtn = document.getElementById('agent-max');
const playersToggle = document.getElementById('agent-players-toggle');
const playersToggleText = document.getElementById('agent-players-text');
if (minusBtn && plusBtn) {
  minusBtn.addEventListener('click', () => setAgentCount(chasers.length - 10));
  plusBtn.addEventListener('click', () => setAgentCount(chasers.length + 10));
}
if (minBtn && maxBtn) {
  minBtn.addEventListener('click', () => setAgentCount(1));
  maxBtn.addEventListener('click', () => setAgentCount(500));
}
function updatePlayersToggleUI() {
  if (playersToggle && playersToggleText) {
    playersToggle.setAttribute('fill', playersEnabled ? '#2e7d32' : '#444');
    playersToggleText.textContent = playersEnabled ? 'Players: On' : 'Players: Off';
  }
}
if (playersToggle) {
  playersToggle.addEventListener('click', () => {
    playersEnabled = !playersEnabled;
    updatePlayersToggleUI();
    rebuildChasers();
  });
}
updateAgentCountUI();
updatePlayersToggleUI();
setAgentCount(1);

const startChase = async () => {
  // Wait for navigation system to be ready
  while (!(((window as any).navigation && (window as any).navigation.crowd))) {
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  setInterval(() => {
    if (!latestPlayerPos) return;
    // Slightly bias toward ground plane y=1 to keep targets on navmesh
    const target = { x: latestPlayerPos.x, y: 1, z: latestPlayerPos.z };
    for (const agent of chasers) {
      try {
        (window as any).navigation.goTo(agent, target);
      } catch {}
      // Rotate agent to face movement direction
      updateAgentRotation(agent);
    }
  }, CHASE_INTERVAL_MS);
};
startChase();