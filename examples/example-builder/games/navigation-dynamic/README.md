# Navigation Dynamic Obstacles

Demonstrates dynamic navmesh updates using TileCache temporary obstacles.

- An agent patrols between two waypoints on the X axis.
- A sliding door (`m-cube` with `nav-obstacle`) periodically blocks/unblocks the corridor.
- When the door moves, the navigation system updates the TileCache and the agent repaths. If the target is blocked, the agent will wait near the waypoint until it opens again, then continue.