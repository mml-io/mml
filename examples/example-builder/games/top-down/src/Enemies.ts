import { CONSTANTS } from "./constants.js";
import { Position } from "./helpers.js";

interface EnemyData {
  element: HTMLElement;
  walkAnim: HTMLElement;
  attackAnim: HTMLElement;
  deathAnim: HTMLElement;
  isAttacking: boolean;
  isDying: boolean;
  attackDamageTimeout: number | null;
  connectionId?: number;
  health: number;
  maxHealth: number;
  healthBarGreen: HTMLElement;
  healthBarRed: HTMLElement;
  clickHandler: (event: any) => void;
  damageHandler: (event: any) => void;
}

export class Enemies {
  private enemies: Map<number, EnemyData> = new Map();
  private enemyIdCounter: number = 0;
  private chaseInterval: number | null = null;
  private sceneGroup: HTMLElement;
  private previousPositions: Map<HTMLElement, { x: number; z: number }> = new Map();
  private onEnemyClick: (
    clickPos: { x: number; y: number; z: number },
    connectionId: number,
  ) => void;

  constructor(
    sceneGroup: HTMLElement,
    onEnemyClick: (clickPos: { x: number; y: number; z: number }, connectionId: number) => void,
  ) {
    this.sceneGroup = sceneGroup;
    this.onEnemyClick = onEnemyClick;
    this.initializeChaseLoop();
  }

  private initializeChaseLoop() {
    // start chase loop - update enemy targets periodically
    this.chaseInterval = window.setInterval(() => {
      this.updateEnemyTargets();
    }, CONSTANTS.ENEMY_CHASE_INTERVAL);
  }

  private updateEnemyTargets(): void {
    const playerPositions: Position[] = [];
    const players = document.querySelectorAll("[data-connection-id]");

    players.forEach((player) => {
      const x = parseFloat(player.getAttribute("x") || "0");
      const y = parseFloat(player.getAttribute("y") || "0");
      const z = parseFloat(player.getAttribute("z") || "0");
      playerPositions.push({ x, y, z });
    });

    if (playerPositions.length === 0) {
      return;
    }

    this.enemies.forEach((enemyData) => {
      const enemy = enemyData.element;
      const enemyX = parseFloat(enemy.getAttribute("x") || "0");
      const enemyZ = parseFloat(enemy.getAttribute("z") || "0");

      let nearestPlayer: Position | null = null;
      let minDistance = Infinity;

      playerPositions.forEach((playerPos) => {
        const dx = playerPos.x - enemyX;
        const dz = playerPos.z - enemyZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < minDistance) {
          minDistance = distance;
          nearestPlayer = playerPos;
        }
      });

      if (nearestPlayer && !enemyData.isDying) {
        try {
          if (minDistance <= CONSTANTS.ENEMY_ATTACK_RANGE) {
            if (!enemyData.isAttacking) {
              enemyData.isAttacking = true;
              this.setAnimationState(enemyData, "attack");
              this.scheduleAttackDamage(enemyData, nearestPlayer);

              (window as any).navigation.stop(enemy);
            }

            const dx = nearestPlayer.x - enemyX;
            const dz = nearestPlayer.z - enemyZ;
            const angleRad = Math.atan2(dx, dz);
            const angleDeg = (angleRad * 180) / Math.PI;
            enemy.setAttribute("ry", angleDeg.toString());
          } else {
            // Switch to chase mode
            if (enemyData.isAttacking) {
              enemyData.isAttacking = false;
              this.cancelAttackDamage(enemyData);
              this.setAnimationState(enemyData, "walk");
            }

            // Navigate to player position (at ground level)
            (window as any).navigation.goTo(enemy, {
              x: nearestPlayer.x,
              y: 0,
              z: nearestPlayer.z,
            });

            // Update rotation to face movement direction
            this.updateEnemyRotation(enemy);
          }
        } catch (error) {
          console.error("Failed to navigate enemy:", error);
        }
      }
    });
  }

  private setAnimationState(enemyData: EnemyData, state: "walk" | "attack" | "death"): void {
    if (state === "walk") {
      enemyData.walkAnim.setAttribute("weight", "1");
      enemyData.attackAnim.setAttribute("weight", "0");
      enemyData.deathAnim.setAttribute("weight", "0");
    } else if (state === "attack") {
      // Sync attack animation to current time so damage timing is predictable
      const currentTime = document.timeline.currentTime;
      enemyData.attackAnim.setAttribute("start-time", currentTime.toString());
      enemyData.walkAnim.setAttribute("weight", "0");
      enemyData.attackAnim.setAttribute("weight", "1");
      enemyData.deathAnim.setAttribute("weight", "0");
    } else {
      // Death state - sync animation to current time
      const currentTime = document.timeline.currentTime;
      enemyData.deathAnim.setAttribute("start-time", currentTime.toString());
      enemyData.walkAnim.setAttribute("weight", "0");
      enemyData.attackAnim.setAttribute("weight", "0");
      enemyData.deathAnim.setAttribute("weight", "1");
    }
  }

  private scheduleAttackDamage(enemyData: EnemyData, _targetPos: Position): void {
    // Cancel any existing damage timeout
    this.cancelAttackDamage(enemyData);

    // Schedule damage check after the attack animation timing
    enemyData.attackDamageTimeout = window.setTimeout(() => {
      this.checkAttackDamage(enemyData);
    }, CONSTANTS.ZOMBIE_ATTACK_DAMAGE_TIME);
  }

  private cancelAttackDamage(enemyData: EnemyData): void {
    if (enemyData.attackDamageTimeout !== null) {
      window.clearTimeout(enemyData.attackDamageTimeout);
      enemyData.attackDamageTimeout = null;
    }
  }

  private checkAttackDamage(enemyData: EnemyData): void {
    enemyData.attackDamageTimeout = null;

    // Only deal damage if zombie is still attacking
    if (!enemyData.isAttacking) {
      return;
    }

    const enemy = enemyData.element;
    const enemyX = parseFloat(enemy.getAttribute("x") || "0");
    const enemyZ = parseFloat(enemy.getAttribute("z") || "0");

    // Find all players and check if any are in attack range
    const players = document.querySelectorAll("[data-connection-id]");
    players.forEach((player) => {
      const playerX = parseFloat(player.getAttribute("x") || "0");
      const playerZ = parseFloat(player.getAttribute("z") || "0");
      const connectionId = parseInt((player as HTMLElement).dataset.connectionId || "0", 10);

      const dx = playerX - enemyX;
      const dz = playerZ - enemyZ;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance <= CONSTANTS.ENEMY_ATTACK_RANGE) {
        // Player is still in range - deal damage!
        console.log(
          `[Enemies] Zombie attack hit player ${connectionId}! Distance: ${distance.toFixed(2)}`,
        );

        // Dispatch player-damage event
        const playerDamageEvent = new CustomEvent("player-damage", {
          detail: {
            connectionId,
            damage: CONSTANTS.ZOMBIE_ATTACK_DAMAGE,
          },
          bubbles: true,
        });
        window.dispatchEvent(playerDamageEvent);
      } else {
        console.log(
          `[Enemies] Zombie attack missed player ${connectionId}! Distance: ${distance.toFixed(2)} (needed <= ${CONSTANTS.ENEMY_ATTACK_RANGE})`,
        );
      }
    });

    // Schedule next attack damage if still attacking
    if (enemyData.isAttacking) {
      // Animation loops automatically, so the next apex occurs after one full animation cycle
      const animDurationMs =
        (CONSTANTS.ZOMBIE_ATTACK_TOTAL_FRAMES / CONSTANTS.ZOMBIE_ATTACK_ANIM_FPS) * 1000;

      enemyData.attackDamageTimeout = window.setTimeout(() => {
        this.checkAttackDamage(enemyData);
      }, animDurationMs);
    }
  }

  private updateEnemyRotation(enemy: HTMLElement): void {
    const curX = parseFloat(enemy.getAttribute("x") || "0");
    const curZ = parseFloat(enemy.getAttribute("z") || "0");
    const prev = this.previousPositions.get(enemy);

    if (prev) {
      const dx = curX - prev.x;
      const dz = curZ - prev.z;
      const speedSq = dx * dx + dz * dz;

      // Only rotate if enemy is moving
      if (speedSq > 0.000001) {
        const angleRad = Math.atan2(dx, dz);
        const angleDeg = (angleRad * 180) / Math.PI;
        enemy.setAttribute("ry", angleDeg.toString());
      }
    }

    this.previousPositions.set(enemy, { x: curX, z: curZ });
  }

  private addLerp(element: HTMLElement, duration: number, attr: string): void {
    const lerp = document.createElement("m-attr-lerp");
    lerp.setAttribute("attr", attr);
    lerp.setAttribute("duration", duration.toString());
    element.appendChild(lerp);
  }

  private createAnimation(
    parent: HTMLElement,
    src: string,
    state: string,
    initialWeight: string,
  ): HTMLElement {
    const animation = document.createElement("m-animation");
    animation.setAttribute("src", src);
    animation.setAttribute("state", state);
    animation.setAttribute("weight", initialWeight);
    this.addLerp(animation, 150, "weight");
    parent.appendChild(animation);
    return animation;
  }

  private createHealthBar(parent: HTMLElement): { green: HTMLElement; red: HTMLElement } {
    // Create health bar container
    const healthBarContainer = document.createElement("m-group");
    healthBarContainer.setAttribute("y", CONSTANTS.HEALTH_BAR_Y_OFFSET.toString());
    healthBarContainer.setAttribute("collide", "false");
    parent.appendChild(healthBarContainer);

    // Green foreground (starts at full width, shrinks as health decreases)
    // Created first so it's the outer layer
    const healthBarGreen = document.createElement("m-cube");
    healthBarGreen.setAttribute("width", CONSTANTS.HEALTH_BAR_WIDTH.toString());
    healthBarGreen.setAttribute("height", CONSTANTS.HEALTH_BAR_HEIGHT.toString());
    healthBarGreen.setAttribute("depth", CONSTANTS.HEALTH_BAR_DEPTH.toString());
    healthBarGreen.setAttribute("color", "#00ff00");
    healthBarGreen.setAttribute("collide", "false");
    healthBarContainer.appendChild(healthBarGreen);

    // Red background (full width) - inside the green bar
    const healthBarRed = document.createElement("m-cube");
    healthBarRed.setAttribute("width", CONSTANTS.HEALTH_BAR_WIDTH.toString());
    healthBarRed.setAttribute("height", (CONSTANTS.HEALTH_BAR_HEIGHT * 0.8).toString());
    healthBarRed.setAttribute("depth", (CONSTANTS.HEALTH_BAR_DEPTH * 0.8).toString());
    healthBarRed.setAttribute("color", "#ff0000");
    healthBarRed.setAttribute("collide", "false");
    healthBarContainer.appendChild(healthBarRed);

    return { green: healthBarGreen, red: healthBarRed };
  }

  private updateHealthBar(enemyData: EnemyData): void {
    const healthPercent = enemyData.health / enemyData.maxHealth;
    const newWidth = CONSTANTS.HEALTH_BAR_WIDTH * healthPercent;
    enemyData.healthBarGreen.setAttribute("width", newWidth.toString());

    // Offset the green bar to align left edge
    const offset = (CONSTANTS.HEALTH_BAR_WIDTH - newWidth) / 2;
    enemyData.healthBarGreen.setAttribute("x", (-offset).toString());
  }

  public spawnEnemy(x: number, z: number, connectionId?: number): void {
    const enemyId = ++this.enemyIdCounter;

    // Randomly select zombie model (man or girl)
    const isMan = Math.random() < 0.5;
    const modelSrc = isMan ? CONSTANTS.ZOMBIE_MAN_MODEL : CONSTANTS.ZOMBIE_GIRL_MODEL;

    // Create enemy group (this will be the nav-agent)
    const enemyGroup = document.createElement("m-group");
    enemyGroup.setAttribute("id", `enemy-${enemyId}`);
    enemyGroup.setAttribute("x", x.toString());
    enemyGroup.setAttribute("y", "0");
    enemyGroup.setAttribute("z", z.toString());

    // Navigation attributes on the group
    enemyGroup.setAttribute("nav-agent", "true");
    enemyGroup.setAttribute("rigidbody", "true");
    enemyGroup.setAttribute("kinematic", "true");
    enemyGroup.setAttribute("nav-speed", CONSTANTS.ENEMY_SPEED.toString());
    enemyGroup.setAttribute("nav-acceleration", CONSTANTS.ENEMY_ACCELERATION.toString());
    enemyGroup.setAttribute("clickable", "true");

    // Add position lerp for smooth movement
    this.addLerp(enemyGroup, 100, "x,y,z,ry");

    this.sceneGroup.appendChild(enemyGroup);

    // Create enemy model as child of group with Y offset
    const enemy = document.createElement("m-model");
    enemy.setAttribute("collide", "false");
    enemy.setAttribute("src", modelSrc);
    enemy.setAttribute("y", "1");

    enemyGroup.appendChild(enemy);

    // Add click handler for this specific enemy
    const clickHandler = (event: any) => {
      const connectionId = event.detail.connectionId;
      // Get enemy group's actual world position instead of click position
      const enemyX = parseFloat(enemyGroup.getAttribute("x") || "0");
      const enemyY = parseFloat(enemyGroup.getAttribute("y") || "0");
      const enemyZ = parseFloat(enemyGroup.getAttribute("z") || "0");
      const enemyWorldPos = { x: enemyX, y: enemyY, z: enemyZ };
      console.log(`[Enemies] ${enemyId} clicked by conn ${connectionId} at`, enemyWorldPos);
      this.onEnemyClick(enemyWorldPos, connectionId);
    };
    enemyGroup.addEventListener("click", clickHandler);

    // Random animation start time offset (0 to 2 seconds) to desynchronize zombies
    const animationStartTime = Math.random() * 2;

    // Create walk animation (starts active)
    const walkAnim = this.createAnimation(enemy, CONSTANTS.ZOMBIE_WALK_ANIM, "walk", "1");
    walkAnim.setAttribute("start-time", animationStartTime.toString());

    // Create attack animation (starts inactive)
    const attackAnim = this.createAnimation(enemy, CONSTANTS.ZOMBIE_ATTACK_ANIM, "attack", "0");
    attackAnim.setAttribute("start-time", animationStartTime.toString());

    // Create death animation (starts inactive, no loop)
    const deathAnim = this.createAnimation(enemy, CONSTANTS.ZOMBIE_DEATH_ANIM, "death", "0");
    deathAnim.setAttribute("loop", "false");

    // Create health bar
    const healthBar = this.createHealthBar(enemyGroup);

    // Add damage event listener
    const damageHandler = (event: any) => {
      console.log(`[Enemies] Enemy ${enemyId} received damage event:`, event.detail);
      const damage = event.detail?.damage || 0;
      const enemyData = this.enemies.get(enemyId);
      if (enemyData) {
        enemyData.health -= damage;
        console.log(
          `[Enemies] Enemy ${enemyId} took ${damage} damage. Health: ${enemyData.health}/${enemyData.maxHealth}`,
        );

        if (enemyData.health <= 0) {
          console.log(`[Enemies] Enemy ${enemyId} defeated!`);

          // Dispatch zombie-killed event for game state management
          if (enemyData.connectionId !== undefined) {
            const zombieKilledEvent = new CustomEvent("zombie-killed", {
              detail: { connectionId: enemyData.connectionId },
              bubbles: true,
            });
            window.dispatchEvent(zombieKilledEvent);
          }

          this.killEnemy(enemyId);
        } else {
          this.updateHealthBar(enemyData);
        }
      }
    };
    enemyGroup.addEventListener("enemy-damage", damageHandler);

    // Store enemy data
    const enemyData: EnemyData = {
      element: enemyGroup,
      walkAnim,
      attackAnim,
      deathAnim,
      isAttacking: false,
      isDying: false,
      attackDamageTimeout: null,
      connectionId,
      health: CONSTANTS.ZOMBIE_MAX_HEALTH,
      maxHealth: CONSTANTS.ZOMBIE_MAX_HEALTH,
      healthBarGreen: healthBar.green,
      healthBarRed: healthBar.red,
      clickHandler,
      damageHandler,
    };

    this.enemies.set(enemyId, enemyData);
    // previous position for rotation tracking
    this.previousPositions.set(enemyGroup, { x, z });
    console.log(`Spawned ${isMan ? "zombie man" : "zombie girl"} ${enemyId} at (${x}, ${z})`);
  }

  public killEnemy(enemyId: number): void {
    const enemyData = this.enemies.get(enemyId);
    if (enemyData && !enemyData.isDying) {
      enemyData.isDying = true;
      enemyData.isAttacking = false;
      this.cancelAttackDamage(enemyData);

      // Stop navigation
      (window as any).navigation.stop(enemyData.element);

      // Change ID so bullets pass through (Weapon.ts queries '[id^="enemy-"]')
      enemyData.element.setAttribute("id", `dying-${enemyId}`);

      // Remove from enemies map immediately so getEnemyCount() doesn't count it
      this.enemies.delete(enemyId);
      this.previousPositions.delete(enemyData.element);

      // Hide health bar
      enemyData.healthBarGreen.setAttribute("visible", "false");
      enemyData.healthBarRed.setAttribute("visible", "false");

      // Play death animation
      this.setAnimationState(enemyData, "death");

      // Remove from DOM after death animation completes
      window.setTimeout(() => {
        enemyData.element.removeEventListener("click", enemyData.clickHandler);
        enemyData.element.removeEventListener("enemy-damage", enemyData.damageHandler);
        if (enemyData.element.parentNode) {
          enemyData.element.parentNode.removeChild(enemyData.element);
        }
      }, CONSTANTS.ZOMBIE_DEATH_ANIM_TIME);
    }
  }

  public removeEnemy(enemyId: number): void {
    const enemyData = this.enemies.get(enemyId);
    if (enemyData) {
      this.cancelAttackDamage(enemyData);
      this.previousPositions.delete(enemyData.element);
      enemyData.element.removeEventListener("click", enemyData.clickHandler);
      enemyData.element.removeEventListener("enemy-damage", enemyData.damageHandler);
      if (enemyData.element.parentNode) {
        enemyData.element.parentNode.removeChild(enemyData.element);
      }
      this.enemies.delete(enemyId);
      console.log(`Removed enemy ${enemyId}`);
    }
  }

  private getPositionsInCircleAroundPoint(
    centerX: number,
    centerZ: number,
    radius: number,
    count: number,
  ): { x: number; z: number }[] {
    const positions: { x: number; z: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const z = centerZ + radius * Math.sin(angle);
      positions.push({ x, z });
    }
    return positions;
  }

  public spawnEnemiesInCircle(
    playerPosition: Position,
    radius: number,
    count: number,
    connectionId?: number,
  ): void {
    const positions = this.getPositionsInCircleAroundPoint(
      playerPosition.x,
      playerPosition.z,
      radius,
      count,
    );
    positions.forEach((pos) => {
      this.spawnEnemy(pos.x, pos.z, connectionId);
    });
  }

  public spawnEnemies(count: number, connectionId?: number): void {
    // potential spawn location? { x: 18.934, y: -1.4, z: -21.673 }
    for (let i = 0; i < count; i++) {
      // Spawn enemies in random positions around the map
      const x = 18;
      const z = -21;
      this.spawnEnemy(x, z, connectionId);
    }
  }

  public clearAllEnemies(): void {
    this.enemies.forEach((enemyData, enemyId) => {
      this.removeEnemy(enemyId);
    });
  }

  public clearEnemiesForConnection(connectionId: number): void {
    const enemyIdsToRemove: number[] = [];
    this.enemies.forEach((enemyData, enemyId) => {
      if (enemyData.connectionId === connectionId) {
        enemyIdsToRemove.push(enemyId);
      }
    });
    enemyIdsToRemove.forEach((enemyId) => {
      this.removeEnemy(enemyId);
    });
    console.log(`Cleared ${enemyIdsToRemove.length} enemies for connection ${connectionId}`);
  }

  public getEnemyCount(): number {
    return this.enemies.size;
  }

  public dispose(): void {
    if (this.chaseInterval !== null) {
      window.clearInterval(this.chaseInterval);
      this.chaseInterval = null;
    }
    this.clearAllEnemies();
  }
}
