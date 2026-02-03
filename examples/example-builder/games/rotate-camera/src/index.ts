const connectedPlayers = new Map();

function assignAnimationLerp(element: Element, duration: number, attrs: string) {
	const lerp = document.createElement('m-attr-lerp');
	lerp.setAttribute('attr', attrs);
	lerp.setAttribute('duration', String(duration));
	element.appendChild(lerp);
}

function setTransform(element: Element, x: number, y: number, z: number, ry: number) {
	["x", "y", "z"].forEach(attr => element.setAttribute(attr, String(attr === "x" ? x : attr === "y" ? y : z)));
	element.setAttribute("ry", String(ry));
}

function createPlayer() {
	const player = document.createElement('m-character');
	player.setAttribute('src', '/assets/bot.glb');
	player.setAttribute('state', 'idle');
	assignAnimationLerp(player, 100, 'x,y,z,ry');
	setTransform(player, Math.random() * 4 - 2, 0, Math.random() * 4 - 2, 0);
	document.body.appendChild(player);
	return player;
}

function assignPlayerAnimation(player: Element, state: 'idle' | 'run' | 'air') {
	const animation = document.createElement('m-animation');
	animation.setAttribute('src', `/assets/anim_${state}.glb`);
	animation.setAttribute('state', state);
	animation.setAttribute('weight', state === 'idle' ? '1.0' : '0.0');
	assignAnimationLerp(animation, 150, 'weight');
	player.appendChild(animation);
	return animation;
}

function assignPlayerController(player: Element, connectionId: number) {
	const controller = document.createElement('m-character-controller');
	controller.setAttribute('visible-to', String(connectionId));
	// default: rotate-with-camera off
	player.appendChild(controller);
	return controller;
}

function updateOverlayUI(enabled: boolean) {
	const toggle = document.getElementById('rotate-toggle');
	const text = document.getElementById('rotate-text');
	if (toggle) toggle.setAttribute('fill', enabled ? '#2e7d32' : '#444');
	if (text) text.textContent = enabled ? 'On' : 'Off';
}

function wireOverlay(controller: Element) {
	let enabled = false;
	updateOverlayUI(enabled);
	const toggle = document.getElementById('rotate-toggle');
	if (toggle) {
		toggle.addEventListener('click', () => {
			enabled = !enabled;
			if (enabled) controller.setAttribute('rotate-with-camera', 'true');
			else controller.removeAttribute('rotate-with-camera');
			updateOverlayUI(enabled);
		});
	}
}

function spawnPlayer(connectionId: number) {
	if (connectedPlayers.has(connectionId)) return;
	const player = createPlayer();
	const controller = assignPlayerController(player, connectionId);
	const idleAnimation = assignPlayerAnimation(player, 'idle');
	const runAnimation = assignPlayerAnimation(player, 'run');
	const airAnimation = assignPlayerAnimation(player, 'air');

	connectedPlayers.set(connectionId, {
		character: { model: player, idleAnim: idleAnimation, runAnim: runAnimation, airAnim: airAnimation }
	});

	controller.addEventListener('character-move', (event: any) => {
		const { position, rotation, state } = (event as CustomEvent<any>).detail;
		const character = connectedPlayers.get(connectionId).character;
		setTransform(character.model, position.x, position.y, position.z, rotation.ry);
		character.idleAnim.setAttribute('weight', state === 'idle' ? '1.0' : '0.0');
		character.runAnim.setAttribute('weight', state === 'run' ? '1.0' : '0.0');
		character.airAnim.setAttribute('weight', state === 'air' ? '1.0' : '0.0');
	});

	wireOverlay(controller);
}

function removePlayer(connectionId: number) {
	if (!connectedPlayers.has(connectionId)) return;
	const user = connectedPlayers.get(connectionId);
	try { document.body.removeChild(user.character.model); } catch {}
	connectedPlayers.delete(connectionId);
}

// Auto-spawn local player using the tools pattern
window.addEventListener('connected', (event) => spawnPlayer((event as CustomEvent<any>).detail.connectionId));
window.addEventListener('disconnected', (event) => removePlayer((event as CustomEvent<any>).detail.connectionId));
