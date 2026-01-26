import { Camera } from "./Camera.js";
import { CONSTANTS } from "./constants.js";
import { Enemies } from "./Enemies.js";
import { ExperienceSystem, PlayerStats } from "./ExperienceSystem.js";
import { ExperienceUI } from "./ExperienceUI.js";
import { spawnDamageNumber } from "./helpers.js";
import { RapidFirePickup } from "./Pickup.js";
import { Player } from "./Player.js";
import { DeathScreen, PlayerHUD } from "./UI.js";
import { Weapon } from "./Weapon.js";

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
  private experienceSystems: Map<number, ExperienceSystem> = new Map();
  private experienceUIs: Map<number, ExperienceUI> = new Map();
  private playerStats: Map<number, PlayerStats> = new Map();
  private regenIntervals: Map<number, number> = new Map();
  private enemies: Enemies;
  private weapon: Weapon;
  private gameTick: number | null = null;
  private arena01: HTMLElement;
  private fireControls: Map<number, HTMLElement> = new Map();
  private fireButtonHeld: Map<number, boolean> = new Map();
  private pickups: RapidFirePickup[] = [];

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
        this.weapon.shootForward(
          playerPos,
          playerRotationDegrees,
          player.debugSphere,
          connectionId,
        );
      }
    });
    this.weapon = new Weapon(this.sceneGroup);

    // Create rapid fire pickups at spawn positions
    this.createPickups();

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
          this.weapon.shootForward(
            playerPos,
            playerRotationDegrees,
            player.debugSphere,
            connectionId,
          );
        } else if (player?.isDead) {
          console.log("[Game] Cannot shoot - player is dead");
        } else {
          console.log("[Game] No player found for connection:", connectionId);
        }
      });
    }

    // Listen for powerup events to show notifications
    window.addEventListener("powerup-activated", (event: any) => {
      const { connectionId } = event.detail;
      const hud = this.playerHUDs.get(connectionId);
      if (hud) {
        hud.showNotification("⚡ RAPID FIRE ACTIVE ⚡");
      }
    });

    window.addEventListener("powerup-deactivated", (event: any) => {
      const { connectionId } = event.detail;
      const hud = this.playerHUDs.get(connectionId);
      if (hud) {
        hud.showNotification("Rapid fire ended");
      }
    });

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

        // Create experience system and UI for this player
        this.setupExperienceSystem(connectionId);

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
      this.fireButtonHeld.delete(connectionId);

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

      // Clean up experience system
      const expUI = this.experienceUIs.get(connectionId);
      if (expUI) {
        expUI.dispose();
        this.experienceUIs.delete(connectionId);
      }
      this.experienceSystems.delete(connectionId);
      this.playerStats.delete(connectionId);

      // Clean up regen interval
      const regenInterval = this.regenIntervals.get(connectionId);
      if (regenInterval) {
        window.clearInterval(regenInterval);
        this.regenIntervals.delete(connectionId);
      }

      // Clean up enemies spawned by this player
      this.enemies.clearEnemiesForConnection(connectionId);
    });

    this.tick();
  }

  private createFireControl(connectionId: number): void {
    const fireControl = document.createElement("m-control");
    fireControl.setAttribute("type", "button");
    fireControl.setAttribute("input", "mouseleft gamepad-rb");
    fireControl.setAttribute("visible-to", connectionId.toString());
    fireControl.addEventListener("input", (event: any) => {
      const pressed = Number(event.detail.value) > 0;
      this.fireButtonHeld.set(connectionId, pressed);
      if (pressed) {
        const player = this.players.get(connectionId);
        if (player && !player.isDead) {
          const playerPos = player.getPosition();
          const playerRotationDegrees = player.getCurrentRotationDegrees();

          this.weapon.shootForward(
            playerPos,
            playerRotationDegrees,
            player.debugSphere,
            connectionId,
          );
        }
      }
    });
    this.sceneGroup.appendChild(fireControl);
    this.fireControls.set(connectionId, fireControl);
  }

  private setupExperienceSystem(connectionId: number): void {
    // Create experience system
    const expSystem = new ExperienceSystem(connectionId);
    this.experienceSystems.set(connectionId, expSystem);

    // Create experience UI
    const expUI = new ExperienceUI(connectionId);
    this.experienceUIs.set(connectionId, expUI);

    // Wire up the UI callbacks
    expUI.setOnUpgradeSelected((upgradeId) => {
      expSystem.selectUpgrade(upgradeId);
    });

    expUI.setOnRequestUpgradeChoices(() => {
      const minChoices = 2;
      const maxChoices = 4;
      const choiceCount = minChoices + Math.floor(Math.random() * (maxChoices - minChoices + 1));
      return expSystem.getUpgradeChoices(choiceCount);
    });

    expUI.setOnDebugForceLevelUp((count) => {
      expSystem.forceLevelUps(count);
    });

    // Wire up experience system callbacks
    expSystem.setOnXPGain((current, required, percent) => {
      expUI.updateXP(current, required, percent);
    });

    expSystem.setOnLevelUp((level, pendingCount) => {
      expUI.updateLevel(level);
      expUI.showLevelUpButton(pendingCount);

      // Show level up notification
      const hud = this.playerHUDs.get(connectionId);
      if (hud) {
        hud.showNotification(`🎉 LEVEL ${level}! 🎉`);
      }
    });

    expSystem.setOnStatsChanged((stats) => {
      this.playerStats.set(connectionId, stats);
      this.applyPlayerStats(connectionId, stats);
    });

    // Initialize the XP bar
    const progress = expSystem.getXPProgress();
    expUI.updateXP(progress.current, progress.required, progress.percent);
    expUI.updateLevel(1);

    // Start health regen interval
    this.startHealthRegen(connectionId);
  }

  private applyPlayerStats(connectionId: number, stats: PlayerStats): void {
    // Apply stats to weapon system
    this.weapon.setPlayerStats(connectionId, stats);

    // Apply max health bonus to player
    const player = this.players.get(connectionId);
    if (player) {
      const newMaxHealth = CONSTANTS.PLAYER_MAX_HEALTH + stats.maxHealthBonus;
      player.setMaxHealth(newMaxHealth);
      player.setMoveSpeedMultiplier(stats.moveSpeedMultiplier);

      // Update HUD with new max health
      const hud = this.playerHUDs.get(connectionId);
      if (hud) {
        hud.setMaxHealth(newMaxHealth);
        hud.updateHealth(player.health);
      }
    }

    console.log(`[Game] Applied stats for player ${connectionId}:`, stats);
  }

  private startHealthRegen(connectionId: number): void {
    const interval = window.setInterval(() => {
      const player = this.players.get(connectionId);
      const stats = this.playerStats.get(connectionId);

      if (player && stats && stats.regenPerSecond > 0 && !player.isDead) {
        const healAmount = stats.regenPerSecond;
        if (player.health < player.maxHealth) {
          player.heal(healAmount);
          const hud = this.playerHUDs.get(connectionId);
          if (hud) {
            hud.updateHealth(player.health);
          }
        }
      }
    }, CONSTANTS.REGEN_TICK_INTERVAL);

    this.regenIntervals.set(connectionId, interval);
  }

  private createPickups(): void {
    // Create rapid fire pickups at each pickup spawn position
    CONSTANTS.PICKUP_SPAWN_POSITIONS.forEach((position, index) => {
      const pickup = new RapidFirePickup(
        this.sceneGroup,
        {
          id: `rapid-fire-${index}`,
          position,
          regenTimeMs: CONSTANTS.RAPID_FIRE_PICKUP_REGEN_TIME,
          duration: CONSTANTS.RAPID_FIRE_DURATION,
          fireRateMultiplier: CONSTANTS.RAPID_FIRE_MULTIPLIER,
        },
        () => this.getActivePlayersForPickup(),
        (connectionId, duration, multiplier) => {
          this.weapon.activateRapidFire(connectionId, duration, multiplier);
        },
      );
      this.pickups.push(pickup);
    });

    console.log(`[Game] Created ${this.pickups.length} rapid fire pickups`);
  }

  private getActivePlayersForPickup(): Array<{
    connectionId: number;
    getPosition: () => { x: number; y: number; z: number };
    isDead: boolean;
    pickupRadiusMultiplier: number;
  }> {
    const activePlayers: Array<{
      connectionId: number;
      getPosition: () => { x: number; y: number; z: number };
      isDead: boolean;
      pickupRadiusMultiplier: number;
    }> = [];
    this.players.forEach((player, connectionId) => {
      const stats = this.playerStats.get(connectionId);
      activePlayers.push({
        connectionId,
        getPosition: () => player.getPosition(),
        isDead: player.isDead,
        pickupRadiusMultiplier: stats?.pickupRadiusMultiplier ?? 1,
      });
    });
    return activePlayers;
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

    // Award XP for the kill
    const expSystem = this.experienceSystems.get(connectionId);
    if (expSystem) {
      const baseXP =
        CONSTANTS.XP_PER_ZOMBIE_KILL + (gameState.currentRound - 1) * CONSTANTS.XP_BONUS_PER_ROUND;
      expSystem.addXP(baseXP);

      // Show XP gain effect
      const expUI = this.experienceUIs.get(connectionId);
      if (expUI) {
        expUI.showXPGainEffect(baseXP);
      }
    }

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

    const stats = this.playerStats.get(connectionId);
    const reduction = Math.max(0, Math.min(1, stats?.damageReduction ?? 0));
    const finalDamage = Math.max(0, damage * (1 - reduction));

    if (finalDamage <= 0) {
      return;
    }

    player.takeDamage(finalDamage);

    if (player.physicsBody) {
      spawnDamageNumber(player.physicsBody, finalDamage);
    }

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

    // Hide HUD and experience UI, show death screen
    const hud = this.playerHUDs.get(connectionId);
    if (hud) {
      hud.hide();
    }

    const expUI = this.experienceUIs.get(connectionId);
    if (expUI) {
      expUI.hide();
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

      // Hide death screen and show HUD + experience UI
      if (deathScreen) {
        deathScreen.hide();
      }
      if (hud) {
        hud.updateHealth(player.health);
        hud.show();
      }
      if (expUI) {
        expUI.show();
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

          // Handle auto-fire when powerup or fire button is held
          const isHoldingFire = this.fireButtonHeld.get(connectionId) ?? false;
          if ((this.weapon.isAutoFiring(connectionId) || isHoldingFire) && !player.isDead) {
            const playerPos = player.getPosition();
            const playerRotationDegrees = player.getCurrentRotationDegrees();
            this.weapon.shootForward(
              playerPos,
              playerRotationDegrees,
              player.debugSphere,
              connectionId,
            );
          }
        });
      }, CONSTANTS.TICK_RATE);
    }
  }
}
