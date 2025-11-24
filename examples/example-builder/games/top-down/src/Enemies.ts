import { CONSTANTS } from "./constants.js";
import { Position } from "./helpers.js";

interface EnemyData {
  element: HTMLElement;
  walkAnim: HTMLElement;
  attackAnim: HTMLElement;
  isAttacking: boolean;
  connectionId?: number;
  health: number;
  clickHandler: (event: any) => void;
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

      if (nearestPlayer) {
        try {
          if (minDistance <= CONSTANTS.ENEMY_ATTACK_RANGE) {
            if (!enemyData.isAttacking) {
              enemyData.isAttacking = true;
              this.setAnimationState(enemyData, "attack");

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

  private setAnimationState(enemyData: EnemyData, state: "walk" | "attack"): void {
    if (state === "walk") {
      enemyData.walkAnim.setAttribute("weight", "1");
      enemyData.attackAnim.setAttribute("weight", "0");
    } else {
      enemyData.walkAnim.setAttribute("weight", "0");
      enemyData.attackAnim.setAttribute("weight", "1");
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

    // Store enemy data
    const enemyData: EnemyData = {
      element: enemyGroup,
      walkAnim,
      attackAnim,
      isAttacking: false,
      connectionId,
      health: 100,
      clickHandler,
    };

    this.enemies.set(enemyId, enemyData);
    // previous position for rotation tracking
    this.previousPositions.set(enemyGroup, { x, z });
    console.log(`Spawned ${isMan ? "zombie man" : "zombie girl"} ${enemyId} at (${x}, ${z})`);
  }

  public removeEnemy(enemyId: number): void {
    const enemyData = this.enemies.get(enemyId);
    if (enemyData) {
      this.previousPositions.delete(enemyData.element);
      enemyData.element.removeEventListener("click", enemyData.clickHandler);
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
