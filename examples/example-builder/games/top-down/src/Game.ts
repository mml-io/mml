import { Camera } from "./Camera";
import { CONSTANTS } from "./constants";
import { Enemies } from "./Enemies";
import { Player } from "./Player";
import { Weapon } from "./Weapon";

export class Game {
  private sceneGroup: HTMLElement;
  private players: Map<number, Player> = new Map();
  private cameras: Map<number, Camera> = new Map();
  private enemies: Enemies;
  private weapon: Weapon;
  private gameTick: number | null = null;
  private arena01: HTMLElement;
  private fireControls: Map<number, HTMLElement> = new Map();

  constructor() {
    this.init = this.init.bind(this);
    this.init();
    this.createNavMesh(6.5, -0.9, 3, 6.6, 32.7); // big container
    this.createNavMesh(-0.8, 2, 2.4, 2.4, 0); // center crates
    this.createNavMesh(-4.5, -2.5, 2, 1.5, 0); // smaller crates
    this.createNavMesh(-13, 0, 10, 18, 0); // left warehouse
    this.createNavMesh(-5.9, 7.3, 4.7, 0.25, 0); // bottom wall 1
    this.createNavMesh(-5.9, -7.3, 4.7, 0.25, 0); // top wall 1
    this.createNavMesh(-3, -6.5, 1.5, 1.5, 0); // top wall small crate
    this.createNavMesh(2.85, -19.3, 11.6, 9.6, 0); // center warehouse
    this.createNavMesh(-3.5, -13.8, 1.4, 1.3, 0); // center warehouse box 1
    this.createNavMesh(-4.65, -14.1, 1.2, 1, 0); // center warehouse box 1
    this.createNavMesh(-14.5, -22.7, 5, 3.8, 0); // small room left
    this.createNavMesh(-13.4, -24.5, 6.5, 0.25, 0); // small room left wall
    this.createNavMesh(-4.1, -23.8, 3, 0.3, 0); // small room left center
    this.createNavMesh(16.5, 0, 11.6, 37.5, 0); // right warehouse
    this.createNavMesh(10, 6.5, 1.5, 2.6, 0); // right warehouse crates 1
    this.createNavMesh(6.8, 8.2, 1.8, 1.8, 0); // right warehouse crates 1
  }

  private createNavMesh(x: number, z: number, width: number, depth: number, ry: number): void {
    const navMesh = document.createElement("m-cube");
    navMesh.setAttribute("x", x.toString());
    navMesh.setAttribute("y", "0");
    navMesh.setAttribute("z", z.toString());
    navMesh.setAttribute("ry", ry.toString());
    navMesh.setAttribute("width", width.toString());
    navMesh.setAttribute("height", "6");
    navMesh.setAttribute("depth", depth.toString());
    navMesh.setAttribute("nav-mesh", "true");
    navMesh.setAttribute("color", "#ff0000");
    navMesh.setAttribute("opacity", "0.5");
    navMesh.setAttribute("collide", "false");
    navMesh.setAttribute("visible", "true");
    navMesh.setAttribute("clickable", "false");
    this.sceneGroup.appendChild(navMesh);
  }

  private init() {
    this.sceneGroup = document.getElementById("scene-group") as HTMLElement;

    this.enemies = new Enemies(this.sceneGroup, (clickPos, connectionId) => {
      const player = this.players.get(connectionId);
      if (player) {
        const playerPos = player.getPosition();
        const angle = Math.atan2(clickPos.x - playerPos.x, clickPos.z - playerPos.z);
        this.weapon.shootAt(clickPos, playerPos, angle, player.debugSphere);
      }
    });
    this.weapon = new Weapon(this.sceneGroup);

    this.arena01 = document.getElementById("arena") as HTMLElement;
    if (this.arena01) {
      this.arena01.addEventListener("click", (event: any) => {
        const clickPos = event.detail.position;
        const connectionId = event.detail.connectionId;
        const player = this.players.get(connectionId);
        if (player) {
          const playerPos = player.getPosition();
          const angle = Math.atan2(clickPos.x - playerPos.x, clickPos.z - playerPos.z);
          this.weapon.shootAt(clickPos, playerPos, angle, player.debugSphere);
        } else {
          console.log("[Game] No player found for connection:", connectionId);
        }
      });
    }

    window.addEventListener("connected", (event: any) => {
      const connectionId = event.detail.connectionId;
      console.log(`Spawning Player ID: ${connectionId}`);
      if (!this.players.has(connectionId) && !this.cameras.has(connectionId)) {
        const camera = new Camera(connectionId, this.sceneGroup, CONSTANTS.TICK_RATE);
        this.cameras.set(connectionId, camera);
        const player = new Player(connectionId, this.sceneGroup);
        this.players.set(connectionId, player);

        this.createFireControl(connectionId);

        setTimeout(() => {
          // this.enemies.spawnEnemiesInCircle(
          //   this.players.get(connectionId).getPosition(),
          //   3,
          //   3,
          //   connectionId,
          // );
          this.enemies.spawnEnemies(3, connectionId);
        }, 3000);
      }
    });

    window.addEventListener("disconnected", (event: any) => {
      const connectionId = event.detail.connectionId;
      console.log(`Removing Player ID: ${connectionId}`);
      const player = this.players.get(connectionId);
      if (player) {
        player.dispose();
        this.players.delete(connectionId);
      }
      const camera = this.cameras.get(connectionId);
      if (camera) {
        camera.dispose();
        this.cameras.delete(connectionId);
      }

      const fireControl = this.fireControls.get(connectionId);
      if (fireControl && fireControl.parentNode) {
        fireControl.remove();
        this.fireControls.delete(connectionId);
      }
      // clean up enemies spawned by this player?
      this.enemies.clearEnemiesForConnection(connectionId);
    });

    this.tick();
  }

  private createFireControl(connectionId: number): void {
    const fireControl = document.createElement("m-control");
    fireControl.setAttribute("type", "button");
    fireControl.setAttribute("button", "5"); // right shoulder button on Xbox controller
    fireControl.setAttribute("visible-to", connectionId.toString());
    fireControl.addEventListener("input", (event: any) => {
      const pressed = event.detail.value === true;
      if (pressed) {
        const player = this.players.get(connectionId);
        if (player) {
          const playerPos = player.getPosition();
          const playerRotationDegrees = player.getCurrentRotationDegrees();

          this.weapon.shootForward(playerPos, playerRotationDegrees, player.debugSphere);
        }
      }
    });
    this.sceneGroup.appendChild(fireControl);
    this.fireControls.set(connectionId, fireControl);
  }

  private tick() {
    if (this.gameTick === null) {
      this.gameTick = window.setInterval(() => {
        this.players.forEach((player, connectionId) => {
          const camera = this.cameras.get(connectionId);
          if (camera) {
            const pos = player.getPosition();
            camera.setPosition(pos.x, pos.y, pos.z);
          }

          player.updateDebugSphere();
        });
      }, CONSTANTS.TICK_RATE);
    }
  }
}
