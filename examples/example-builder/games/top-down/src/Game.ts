import { Camera } from "./Camera";
import { CONSTANTS } from "./constants";
import { Enemies } from "./Enemies";
import { Player } from "./Player";
import { DeathScreen, PlayerHUD } from "./UI";
import { Weapon } from "./Weapon";

interface PlayerGameState {
  connectionId: number;
  zombiesKilled: number;
  maxSimultaneousZombies: number;
  currentZombieCount: number;
  currentRound: number;
}

export class Game {
  private sceneGroup: HTMLElement;
  private players: Map<number, Player> = new Map();
  private cameras: Map<number, Camera> = new Map();
  private playerGameStates: Map<number, PlayerGameState> = new Map();
  private playerHUDs: Map<number, PlayerHUD> = new Map();
  private deathScreens: Map<number, DeathScreen> = new Map();
  private enemies: Enemies;
  private weapon: Weapon;
  private gameTick: number | null = null;
  private arena01: HTMLElement;
  private fireControls: Map<number, HTMLElement> = new Map();

  constructor() {
    this.init = this.init.bind(this);
    this.init();
    // this.createNavMesh(6.5, -0.9, 3, 6.6, 32.7); // big container
    // this.createNavMesh(-0.8, 2, 2.4, 2.4, 0); // center crates
    // this.createNavMesh(-4.5, -2.5, 2, 1.5, 0); // smaller crates
    // this.createNavMesh(-13, 0, 10, 18, 0); // left warehouse
    // this.createNavMesh(-5.9, 7.3, 4.7, 0.25, 0); // bottom wall 1
    // this.createNavMesh(-5.9, -7.3, 4.7, 0.25, 0); // top wall 1
    // this.createNavMesh(-3, -6.5, 1.5, 1.5, 0); // top wall small crate
    // this.createNavMesh(2.85, -19.3, 11.6, 9.6, 0); // center warehouse
    // this.createNavMesh(-3.5, -13.8, 1.4, 1.3, 0); // center warehouse box 1
    // this.createNavMesh(-4.65, -14.1, 1.2, 1, 0); // center warehouse box 1
    // this.createNavMesh(-14.5, -22.7, 5, 3.8, 0); // small room left
    // this.createNavMesh(-13.4, -24.5, 6.5, 0.25, 0); // small room left wall
    // this.createNavMesh(-4.1, -23.8, 3, 0.3, 0); // small room left center
    // this.createNavMesh(16.5, 0, 11.6, 37.5, 0); // right warehouse
    // this.createNavMesh(10, 6.5, 1.5, 2.6, 0); // right warehouse crates 1
    // this.createNavMesh(6.8, 8.2, 1.8, 1.8, 0); // right warehouse crates 1
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
    navMesh.setAttribute("visible", "false");
    navMesh.setAttribute("clickable", "false");
    this.sceneGroup.appendChild(navMesh);
  }

  private init() {
    this.sceneGroup = document.getElementById("scene-group") as HTMLElement;

    this.enemies = new Enemies(this.sceneGroup, (clickPos, connectionId) => {
      const player = this.players.get(connectionId);
      if (player && !player.isDead) {
        const playerPos = player.getPosition();
        const playerRotationDegrees = player.getCurrentRotationDegrees();
        this.weapon.shootForward(playerPos, playerRotationDegrees, player.debugSphere);
      }
    });
    this.weapon = new Weapon(this.sceneGroup);

    // Listen for zombie deaths to handle difficulty scaling
    window.addEventListener("zombie-killed", (event: any) => {
      const connectionId = event.detail?.connectionId;
      if (connectionId !== undefined) {
        this.handleZombieKilled(connectionId);
      }
    });

    // Listen for player damage events from zombie attacks
    window.addEventListener("player-damage", (event: any) => {
      const connectionId = event.detail?.connectionId;
      const damage = event.detail?.damage || 0;
      if (connectionId !== undefined) {
        this.handlePlayerDamage(connectionId, damage);
      }
    });

    // Listen for player death events
    window.addEventListener("player-died", (event: any) => {
      const connectionId = event.detail?.connectionId;
      if (connectionId !== undefined) {
        this.handlePlayerDeath(connectionId);
      }
    });

    this.arena01 = document.getElementById("arena") as HTMLElement;
    if (this.arena01) {
      this.arena01.addEventListener("click", (event: any) => {
        const connectionId = event.detail.connectionId;
        const player = this.players.get(connectionId);
        if (player && !player.isDead) {
          const playerPos = player.getPosition();
          const playerRotationDegrees = player.getCurrentRotationDegrees();
          this.weapon.shootForward(playerPos, playerRotationDegrees, player.debugSphere);
        } else if (player?.isDead) {
          console.log("[Game] Cannot shoot - player is dead");
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

        // Initialize player game state
        this.playerGameStates.set(connectionId, {
          connectionId,
          zombiesKilled: 0,
          maxSimultaneousZombies: CONSTANTS.INITIAL_ZOMBIE_COUNT,
          currentZombieCount: 0,
          currentRound: 1,
        });

        // Create UI elements for this player
        const hud = new PlayerHUD(connectionId, CONSTANTS.PLAYER_MAX_HEALTH);
        this.playerHUDs.set(connectionId, hud);
        hud.updateRound(1);
        hud.showNotification("SURVIVE THE HORDE");

        const deathScreen = new DeathScreen(connectionId);
        this.deathScreens.set(connectionId, deathScreen);

        this.createFireControl(connectionId);

        setTimeout(() => {
          this.spawnZombiesForPlayer(connectionId);
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

      // Clean up player game state
      this.playerGameStates.delete(connectionId);

      // Clean up UI elements
      const hud = this.playerHUDs.get(connectionId);
      if (hud) {
        hud.dispose();
        this.playerHUDs.delete(connectionId);
      }
      const deathScreen = this.deathScreens.get(connectionId);
      if (deathScreen) {
        deathScreen.dispose();
        this.deathScreens.delete(connectionId);
      }

      // Clean up enemies spawned by this player
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
        if (player && !player.isDead) {
          const playerPos = player.getPosition();
          const playerRotationDegrees = player.getCurrentRotationDegrees();

          this.weapon.shootForward(playerPos, playerRotationDegrees, player.debugSphere);
        }
      }
    });
    this.sceneGroup.appendChild(fireControl);
    this.fireControls.set(connectionId, fireControl);
  }

  private spawnZombiesForPlayer(connectionId: number): void {
    const gameState = this.playerGameStates.get(connectionId);
    if (!gameState) {
      return;
    }

    // Calculate current total zombies across all players
    let totalZombies = 0;
    this.playerGameStates.forEach((state) => {
      totalZombies += state.currentZombieCount;
    });

    // Calculate how many zombies this player wants
    const desiredZombies = gameState.maxSimultaneousZombies - gameState.currentZombieCount;

    // Calculate how many we can actually spawn without exceeding global limit
    const availableSlots = CONSTANTS.MAXIMUM_ZOMBIE_COUNT - totalZombies;
    const zombiesToSpawn = Math.min(desiredZombies, availableSlots);

    if (zombiesToSpawn > 0) {
      console.log(
        `[Game] Spawning ${zombiesToSpawn} zombies for player ${connectionId} (${gameState.currentZombieCount}/${gameState.maxSimultaneousZombies}, global: ${totalZombies}/${CONSTANTS.MAXIMUM_ZOMBIE_COUNT})`,
      );
      this.enemies.spawnEnemies(zombiesToSpawn, connectionId);
      gameState.currentZombieCount += zombiesToSpawn;
    } else if (desiredZombies > 0) {
      console.log(
        `[Game] Cannot spawn zombies for player ${connectionId} - global limit reached (${totalZombies}/${CONSTANTS.MAXIMUM_ZOMBIE_COUNT})`,
      );
    }
  }

  private handleZombieKilled(connectionId: number): void {
    const gameState = this.playerGameStates.get(connectionId);
    if (!gameState) {
      return;
    }

    // Increment kill count and difficulty
    gameState.zombiesKilled++;
    gameState.maxSimultaneousZombies++;
    gameState.currentZombieCount--;

    // Update Round logic: Every 10 kills is a new round
    const calculatedRound = Math.floor(gameState.zombiesKilled / 10) + 1;
    if (calculatedRound > gameState.currentRound) {
      gameState.currentRound = calculatedRound;
      const hud = this.playerHUDs.get(connectionId);
      if (hud) {
        hud.updateRound(calculatedRound);
      }
    }

    // Update HUD score
    const hud = this.playerHUDs.get(connectionId);
    if (hud) {
      hud.updateScore(gameState.zombiesKilled);
    }

    console.log(
      `[Game] Player ${connectionId} killed zombie #${gameState.zombiesKilled}. Difficulty increased to ${gameState.maxSimultaneousZombies} zombies.`,
    );

    // Spawn replacement zombie to maintain difficulty
    setTimeout(() => {
      this.spawnZombiesForPlayer(connectionId);
    }, 500);
  }

  private handlePlayerDamage(connectionId: number, damage: number): void {
    const player = this.players.get(connectionId);
    if (!player) {
      return;
    }

    player.takeDamage(damage);

    // Update HUD health
    const hud = this.playerHUDs.get(connectionId);
    if (hud) {
      hud.updateHealth(player.health);
    }
  }

  private handlePlayerDeath(connectionId: number): void {
    const player = this.players.get(connectionId);
    if (!player) {
      return;
    }

    const gameState = this.playerGameStates.get(connectionId);
    const killCount = gameState?.zombiesKilled || 0;

    console.log(
      `[Game] Player ${connectionId} died! Respawning in ${CONSTANTS.PLAYER_RESPAWN_TIME}ms...`,
    );

    // Hide HUD and show death screen
    const hud = this.playerHUDs.get(connectionId);
    if (hud) {
      hud.hide();
    }

    const deathScreen = this.deathScreens.get(connectionId);
    if (deathScreen) {
      deathScreen.show(killCount);

      // Update countdown timer
      const respawnSeconds = Math.ceil(CONSTANTS.PLAYER_RESPAWN_TIME / 1000);
      let remainingSeconds = respawnSeconds;
      deathScreen.updateTimer(remainingSeconds);

      const countdownInterval = window.setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds > 0) {
          deathScreen.updateTimer(remainingSeconds);
        } else {
          window.clearInterval(countdownInterval);
        }
      }, 1000);
    }

    // Schedule respawn
    setTimeout(() => {
      player.respawnPlayer();

      // Hide death screen and show HUD
      if (deathScreen) {
        deathScreen.hide();
      }
      if (hud) {
        hud.updateHealth(player.health);
        hud.show();
      }

      console.log(`[Game] Player ${connectionId} respawned!`);
    }, CONSTANTS.PLAYER_RESPAWN_TIME);
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
