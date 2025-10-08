Raycasts Demo

Demonstrates `m-control type="mouse"` that dispatches mouse actions and a ray (origin, direction, distance) computed from the active camera on the client.

- Left/Right clicks produce action values like `mouse-left-click`, `mouse-right-down`, etc.
- Each event includes `ray` with camera-based origin/direction and a configurable `ray-distance`.

Files:
- src/index.mml: scene, mouse control, overlay with live status
- src/index.ts: logs events to console

