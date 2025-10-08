Raycasts Demo

Demonstrates `m-control` with a generic `input` prop that dispatches keyboard/mouse actions and a ray (origin, direction, distance) computed from the active camera on the client.

- Left/Right clicks produce action values like `Mouse_LeftClick`, `Mouse_RightDown`, etc. Keyboard like `Keyboard_F` are also supported.
- Each event includes `ray` with camera-based origin/direction and a configurable `raycast-distance`.

Files:
- src/index.mml: scene, mouse control, overlay with live status
- src/index.ts: logs events to console

