import { CONSTANTS } from "./constants.js";
import { createDefaultStats, PlayerStats } from "./ExperienceSystem.js";
import { calculateWorldPosition, Position } from "./helpers.js";

// Physics system interface for raycast
interface PhysicsSystem {
  raycast(
    from: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance: number,
  ): {
    hit: boolean;
    distance?: number;
    point?: { x: number; y: number; z: number };
    normal?: { x: number; y: number; z: number };
    element?: Element;
  };
}

interface EnemyHitInfo {
  enemyId: string;
  hitDistance: number;
  hitPosition: Position;
}

interface PhysicsHitInfo {
  hitDistance: number;
  hitPosition: Position;
}

interface BulletData {
  element: HTMLElement;
  startTime: number;
  direction: { x: number; y: number; z: number };
  startPos: Position;
  bulletId: number;
  hitInfo?: EnemyHitInfo;
  physHitInfo?: PhysicsHitInfo;
  stats: PlayerStats;
  connectionId?: number;
  isCrit: boolean;
  hitCount: number; // For piercing
}

interface PowerupState {
  active: boolean;
  fireRateMultiplier: number;
  endTime: number;
}

interface BulletHitOptions {
  minDistance?: number;
  includePhysics?: boolean;
}

export class Weapon {
  private sceneGroup: HTMLElement;
  private bullets: Map<number, BulletData> = new Map();
  private bulletIdCounter: number = 0;
  private lastShotTime: Map<number, number> = new Map(); // Per-player shot timing
  private updateInterval: number | null = null;

  private shootSFXArray: HTMLElement[] = [];
  private shootSFXIndex: number = 0;

  // Powerup state per player (connectionId -> PowerupState)
  private playerPowerups: Map<number, PowerupState> = new Map();
  private rapidFireTimeouts: Map<number, number> = new Map();

  // Auto-fire state per player
  private autoFirePlayers: Map<number, boolean> = new Map();

  // Player stats from upgrade system
  private playerStats: Map<number, PlayerStats> = new Map();

  constructor(sceneGroup: HTMLElement) {
    this.sceneGroup = sceneGroup;
    this.createShootSFX();
    this.startBulletUpdateLoop();
  }

  private createShootSFX(): void {
    for (let i = 0; i < 6; i++) {
      const audio = document.createElement("m-audio");
      audio.setAttribute("id", `shoot-sfx-${i}`);
      audio.setAttribute("src", CONSTANTS.SFX_SHOOT);
      audio.setAttribute("volume", "0");
      audio.setAttribute("loop", "false");
      this.shootSFXArray.push(audio);
      this.sceneGroup.appendChild(audio);
    }
  }

  private playShootSFX(x: number, y: number, z: number): void {
    const now = document.timeline.currentTime as number;
    const audio = this.shootSFXArray[this.shootSFXIndex];
    this.shootSFXIndex = (this.shootSFXIndex + 1) % this.shootSFXArray.length;
    audio.setAttribute("x", x.toString());
    audio.setAttribute("y", (50).toString());
    audio.setAttribute("z", z.toString());
    audio.setAttribute("start-time", now.toString());
    audio.setAttribute("end-time", (now + 2000).toString());
    audio.setAttribute("volume", "8");
    setTimeout(() => {
      audio.setAttribute("volume", "0");
    }, 2000);
  }

  private startBulletUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateBullets();
    }, 16);
  }

  public canShoot(connectionId?: number): boolean {
    const now = Date.now();
    const fireRate = this.getEffectiveFireRate(connectionId);
    const lastShot = connectionId !== undefined ? (this.lastShotTime.get(connectionId) ?? 0) : 0;
    return now - lastShot >= fireRate;
  }

  private getEffectiveFireRate(connectionId?: number): number {
    if (connectionId === undefined) {
      return CONSTANTS.WEAPON_FIRE_RATE;
    }

    let baseRate = CONSTANTS.WEAPON_FIRE_RATE;

    // Apply upgrade stats
    const stats = this.playerStats.get(connectionId);
    if (stats && stats.fireRateMultiplier > 1) {
      baseRate = Math.floor(baseRate / stats.fireRateMultiplier);
    }

    // Apply powerup (stacks with upgrades)
    const powerup = this.playerPowerups.get(connectionId);
    if (powerup && powerup.active && Date.now() < powerup.endTime) {
      baseRate = Math.floor(baseRate / powerup.fireRateMultiplier);
    }

    return Math.max(baseRate, 20); // Minimum 20ms between shots
  }

  public setPlayerStats(connectionId: number, stats: PlayerStats): void {
    this.playerStats.set(connectionId, stats);
    console.log(`[Weapon] Updated stats for player ${connectionId}:`, stats);
  }

  private getPlayerStats(connectionId?: number): PlayerStats {
    if (connectionId === undefined) {
      return createDefaultStats();
    }
    return this.playerStats.get(connectionId) ?? createDefaultStats();
  }

  public activateRapidFire(connectionId: number, durationMs: number, multiplier: number): void {
    const endTime = Date.now() + durationMs;

    const existingTimeout = this.rapidFireTimeouts.get(connectionId);
    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout);
    }

    this.playerPowerups.set(connectionId, {
      active: true,
      fireRateMultiplier: multiplier,
      endTime,
    });

    this.autoFirePlayers.set(connectionId, true);

    console.log(
      `[Weapon] Rapid fire activated for player ${connectionId} - ${multiplier}x for ${durationMs}ms`,
    );

    // Dispatch powerup activated event
    window.dispatchEvent(
      new CustomEvent("powerup-activated", {
        detail: { connectionId, type: "rapid-fire", duration: durationMs, multiplier },
      }),
    );

    // Schedule deactivation
    const timeoutId = window.setTimeout(() => {
      this.deactivateRapidFire(connectionId);
    }, durationMs);
    this.rapidFireTimeouts.set(connectionId, timeoutId);
  }

  private deactivateRapidFire(connectionId: number): void {
    const powerup = this.playerPowerups.get(connectionId);
    if (powerup) {
      powerup.active = false;
    }
    const timeoutId = this.rapidFireTimeouts.get(connectionId);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.rapidFireTimeouts.delete(connectionId);
    }
    this.autoFirePlayers.set(connectionId, false);

    console.log(`[Weapon] Rapid fire deactivated for player ${connectionId}`);

    // Dispatch powerup deactivated event
    window.dispatchEvent(
      new CustomEvent("powerup-deactivated", {
        detail: { connectionId, type: "rapid-fire" },
      }),
    );
  }

  public isAutoFiring(connectionId: number): boolean {
    return this.autoFirePlayers.get(connectionId) ?? false;
  }

  public hasPowerup(connectionId: number): boolean {
    const powerup = this.playerPowerups.get(connectionId);
    return powerup?.active === true && Date.now() < powerup.endTime;
  }

  public shootAt(
    targetWorldPos: Position,
    _playerPos: Position,
    _playerRotation: number,
    debugSphere: HTMLElement,
    connectionId?: number,
  ): void {
    if (!this.canShoot(connectionId) || !debugSphere) {
      return;
    }

    if (connectionId !== undefined) {
      this.lastShotTime.set(connectionId, Date.now());
    }

    // get world position of muzzle position
    const muzzleTransform = calculateWorldPosition(debugSphere);
    const shootFrom = muzzleTransform.position;

    // calculate direction from muzzle to target
    const dx = targetWorldPos.x - shootFrom.x;
    const dz = targetWorldPos.z - shootFrom.z;
    const length = Math.sqrt(dx * dx + dz * dz);

    if (length < 0.1) {
      return; // too close so ignore
    }

    const direction = {
      x: dx / length,
      y: 0,
      z: dz / length,
    };

    const stats = this.getPlayerStats(connectionId);
    const { enemyHit, physicsHit } = this.checkBulletHit(shootFrom, direction, stats);
    this.createBullet(shootFrom, direction, enemyHit, physicsHit, stats, connectionId);
  }

  public shootForward(
    playerPos: Position,
    playerRotation: number,
    debugSphere: HTMLElement,
    connectionId?: number,
  ): void {
    if (!this.canShoot(connectionId) || !debugSphere) {
      return;
    }

    if (connectionId !== undefined) {
      this.lastShotTime.set(connectionId, Date.now());
    }

    const muzzleTransform = calculateWorldPosition(debugSphere);
    const shootFrom = muzzleTransform.position;

    const rotRad = (playerRotation * Math.PI) / 180;
    const direction = {
      x: Math.sin(rotRad),
      y: 0,
      z: Math.cos(rotRad),
    };

    const stats = this.getPlayerStats(connectionId);
    const { enemyHit, physicsHit } = this.checkBulletHit(shootFrom, direction, stats);
    this.createBullet(shootFrom, direction, enemyHit, physicsHit, stats, connectionId);
  }

  private createBullet(
    from: Position,
    direction: { x: number; y: number; z: number },
    hitInfo?: EnemyHitInfo,
    physHitInfo?: PhysicsHitInfo,
    stats?: PlayerStats,
    connectionId?: number,
  ): void {
    const bulletId = ++this.bulletIdCounter;
    const playerStats = stats ?? createDefaultStats();

    // Check for critical hit
    const isCrit = Math.random() < playerStats.critChance;

    const bullet = document.createElement("m-cylinder");
    bullet.setAttribute("id", `bullet-${bulletId}`);
    bullet.setAttribute("radius", isCrit ? "0.06" : "0.04");
    bullet.setAttribute("height", "0.4");
    bullet.setAttribute("color", isCrit ? "#ff4444" : "#ffee55"); // Red for crits
    bullet.setAttribute("collide", "false");
    bullet.setAttribute("x", from.x.toString());
    bullet.setAttribute("y", from.y.toString());
    bullet.setAttribute("z", from.z.toString());
    bullet.setAttribute("rz", "90");

    const angleRad = Math.atan2(direction.x, direction.z);
    const angleDeg = (angleRad * 180) / Math.PI + 90;
    bullet.setAttribute("ry", angleDeg.toString());

    this.sceneGroup.appendChild(bullet);

    this.playShootSFX(from.x, from.y, from.z);

    this.bullets.set(bulletId, {
      element: bullet,
      startTime: Date.now(),
      direction,
      startPos: { ...from },
      bulletId,
      hitInfo,
      physHitInfo,
      stats: playerStats,
      connectionId,
      isCrit,
      hitCount: 0,
    });
  }

  private updateBullets(): void {
    const now = Date.now();
    const bulletsToRemove: number[] = [];

    this.bullets.forEach((bulletData, bulletId) => {
      const elapsed = (now - bulletData.startTime) / 1000;
      const bulletSpeed = CONSTANTS.BULLET_SPEED * bulletData.stats.bulletSpeedMultiplier;
      const distance = bulletSpeed * elapsed;

      if (distance > CONSTANTS.BULLET_MAX_DISTANCE || elapsed > CONSTANTS.BULLET_LIFETIME) {
        bulletsToRemove.push(bulletId);
        return;
      }

      // Determine which hit comes first (enemy or physics)
      const enemyHitDist = bulletData.hitInfo?.hitDistance ?? Infinity;
      const physHitDist = bulletData.physHitInfo?.hitDistance ?? Infinity;

      // Check if bullet has reached physics collision (wall) first
      if (physHitDist < enemyHitDist && distance >= physHitDist) {
        this.createWallHitEffect(bulletData.physHitInfo!.hitPosition);
        bulletsToRemove.push(bulletId);
        return;
      }

      // Check if bullet has reached its enemy target
      if (bulletData.hitInfo && distance >= enemyHitDist) {
        const lastHitDistance = enemyHitDist;
        this.applyDamageWithStats(
          bulletData.hitInfo.enemyId,
          bulletData.hitInfo.hitPosition,
          bulletData.stats,
          bulletData.isCrit,
        );
        bulletData.hitCount++;

        // Check for piercing - bullet continues if it has pierced fewer enemies than piercing allows
        if (bulletData.hitCount > bulletData.stats.piercing) {
          bulletsToRemove.push(bulletId);
        } else {
          const nextHit = this.checkBulletHit(
            bulletData.startPos,
            bulletData.direction,
            bulletData.stats,
            { minDistance: lastHitDistance + 0.05, includePhysics: false },
          );
          bulletData.hitInfo = nextHit.enemyHit;
          console.log(
            `[Weapon] Bullet pierced! ${bulletData.hitCount}/${bulletData.stats.piercing + 1}`,
          );
        }
        return;
      }

      const newX = bulletData.startPos.x + bulletData.direction.x * distance;
      const newY = bulletData.startPos.y + bulletData.direction.y * distance;
      const newZ = bulletData.startPos.z + bulletData.direction.z * distance;

      bulletData.element.setAttribute("x", newX.toString());
      bulletData.element.setAttribute("y", newY.toString());
      bulletData.element.setAttribute("z", newZ.toString());
    });

    bulletsToRemove.forEach((bulletId) => {
      this.removeBullet(bulletId);
    });
  }

  private removeBullet(bulletId: number): void {
    const bulletData = this.bullets.get(bulletId);
    if (bulletData) {
      if (bulletData.element.parentNode) {
        bulletData.element.parentNode.removeChild(bulletData.element);
      }
      this.bullets.delete(bulletId);
    }
  }

  private checkBulletHit(
    from: Position,
    direction: { x: number; y: number; z: number },
    _stats?: PlayerStats,
    options: BulletHitOptions = {},
  ): { enemyHit?: EnemyHitInfo; physicsHit?: PhysicsHitInfo } {
    const result: { enemyHit?: EnemyHitInfo; physicsHit?: PhysicsHitInfo } = {};
    const minDistance = options.minDistance ?? 0;
    const includePhysics = options.includePhysics ?? true;

    // Check all enemies to see if bullet trajectory intersects them
    const enemies = document.querySelectorAll('[id^="enemy-"]');
    const hitRadius = 0.5; // Detection radius around zombie

    let closestEnemyHit: { element: Element; distance: number; hitPos: Position } | null = null;

    enemies.forEach((enemyElement) => {
      const enemyX = parseFloat(enemyElement.getAttribute("x") || "0");
      const enemyZ = parseFloat(enemyElement.getAttribute("z") || "0");

      // Calculate closest point on ray to enemy position
      const toEnemy = { x: enemyX - from.x, z: enemyZ - from.z };
      const rayLength = direction.x * toEnemy.x + direction.z * toEnemy.z;

      if (rayLength <= minDistance || rayLength > CONSTANTS.BULLET_MAX_DISTANCE) {
        return; // Enemy behind shooter or too far
      }

      const closestX = from.x + direction.x * rayLength;
      const closestZ = from.z + direction.z * rayLength;

      const distX = enemyX - closestX;
      const distZ = enemyZ - closestZ;
      const distanceToRay = Math.sqrt(distX * distX + distZ * distZ);

      if (distanceToRay <= hitRadius) {
        if (!closestEnemyHit || rayLength < closestEnemyHit.distance) {
          closestEnemyHit = {
            element: enemyElement,
            distance: rayLength,
            hitPos: { x: closestX, y: from.y, z: closestZ },
          };
        }
      }
    });

    if (closestEnemyHit) {
      console.log("[Weapon] Bullet will hit enemy:", closestEnemyHit.element.id);
      result.enemyHit = {
        enemyId: closestEnemyHit.element.id,
        hitDistance: closestEnemyHit.distance,
        hitPosition: closestEnemyHit.hitPos,
      };
    }

    // Check physics raycast for wall/obstacle collision
    if (includePhysics) {
      const physics = (window as { physics?: PhysicsSystem }).physics;
      if (physics && typeof physics.raycast === "function") {
        const rayResult = physics.raycast(from, direction, CONSTANTS.BULLET_MAX_DISTANCE);
        if (rayResult.hit && rayResult.distance !== undefined && rayResult.point) {
          result.physicsHit = {
            hitDistance: rayResult.distance,
            hitPosition: { x: rayResult.point.x, y: rayResult.point.y, z: rayResult.point.z },
          };
        }
      }
    }

    return result;
  }

  private applyDamage(enemyId: string, hitPosition: Position): void {
    this.applyDamageWithStats(enemyId, hitPosition, createDefaultStats(), false);
  }

  private applyDamageWithStats(
    enemyId: string,
    hitPosition: Position,
    stats: PlayerStats,
    isCrit: boolean,
  ): void {
    const enemyElement = document.getElementById(enemyId);
    if (!enemyElement) {
      return; // Enemy might have been removed already
    }

    // Calculate final damage with stats
    let damage = CONSTANTS.WEAPON_DAMAGE * stats.damageMultiplier;
    if (isCrit) {
      damage *= stats.critDamage;
    }
    damage = Math.ceil(damage);

    console.log(
      `[Weapon] Applying ${damage} damage to enemy: ${enemyId}${isCrit ? " (CRIT!)" : ""}`,
    );

    const damageEvent = new CustomEvent("enemy-damage", {
      detail: {
        damage,
        hitPosition,
        isCrit,
      },
      bubbles: true,
    });
    enemyElement.dispatchEvent(damageEvent);

    this.createHitEffect(hitPosition, isCrit);
  }

  private createHitEffect(position: Position, isCrit: boolean = false): void {
    const now = document.timeline.currentTime as number;
    const hitEffect = document.createElement("m-video");
    hitEffect.setAttribute("cast-shadows", "false");
    hitEffect.setAttribute("x", position.x.toString());
    hitEffect.setAttribute("y", position.y.toString());
    hitEffect.setAttribute("z", position.z.toString());
    hitEffect.setAttribute("width", isCrit ? "6" : "4"); // Bigger effect for crits
    hitEffect.setAttribute("height", isCrit ? "4.5" : "3");
    hitEffect.setAttribute("loop", "false");
    hitEffect.setAttribute("transparent", "true");
    hitEffect.setAttribute("collide", "false");
    hitEffect.setAttribute("src", CONSTANTS.BLOOD_SPRITE);
    hitEffect.setAttribute("start-time", now.toString());

    this.sceneGroup.appendChild(hitEffect);

    // Add crit text effect
    if (isCrit) {
      this.createCritTextEffect(position);
    }

    setTimeout(() => {
      if (hitEffect.parentNode) {
        hitEffect.parentNode.removeChild(hitEffect);
      }
    }, 1000);
  }

  private createCritTextEffect(position: Position): void {
    // Create floating "CRIT!" text at hit position
    const critText = document.createElement("m-label");
    critText.setAttribute("x", position.x.toString());
    critText.setAttribute("y", (position.y + 1).toString());
    critText.setAttribute("z", position.z.toString());
    critText.setAttribute("content", "CRIT!");
    critText.setAttribute("color", "#ff4444");
    critText.setAttribute("font-size", "48");
    critText.setAttribute("alignment", "center");
    critText.setAttribute("collide", "false");

    const lerp = document.createElement("m-attr-lerp");
    lerp.setAttribute("attr", "y,opacity");
    lerp.setAttribute("duration", "800");
    lerp.setAttribute("easing", "easeOutQuad");
    critText.appendChild(lerp);

    this.sceneGroup.appendChild(critText);

    // Animate upward and fade
    setTimeout(() => {
      critText.setAttribute("y", (position.y + 3).toString());
      critText.setAttribute("opacity", "0");
    }, 50);

    setTimeout(() => {
      if (critText.parentNode) {
        critText.remove();
      }
    }, 900);
  }

  private createWallHitEffect(position: Position): void {
    // Create a spark/impact effect for wall hits
    const sparkGroup = document.createElement("m-group");
    sparkGroup.setAttribute("x", position.x.toString());
    sparkGroup.setAttribute("y", position.y.toString());
    sparkGroup.setAttribute("z", position.z.toString());

    // Central flash - bright yellow sphere that fades quickly
    const flash = document.createElement("m-sphere");
    flash.setAttribute("radius", "0.15");
    flash.setAttribute("color", "#ffff88");
    flash.setAttribute("emissive", "1");
    flash.setAttribute("cast-shadows", "false");
    flash.setAttribute("collide", "false");
    sparkGroup.appendChild(flash);

    // Add lerp for smooth fade out
    const flashLerp = document.createElement("m-attr-lerp");
    flashLerp.setAttribute("attr", "sx,sy,sz,emissive");
    flashLerp.setAttribute("duration", "150");
    flashLerp.setAttribute("easing", "easeOutExpo");
    flash.appendChild(flashLerp);

    // Create spark particles flying outward
    const sparkCount = 6;
    const sparks: HTMLElement[] = [];
    for (let i = 0; i < sparkCount; i++) {
      const spark = document.createElement("m-sphere");
      spark.setAttribute("radius", "0.03");
      spark.setAttribute("color", "#ffcc00");
      spark.setAttribute("emissive", "0.8");
      spark.setAttribute("cast-shadows", "false");
      spark.setAttribute("collide", "false");

      const sparkLerp = document.createElement("m-attr-lerp");
      sparkLerp.setAttribute("attr", "x,y,z,sx,sy,sz");
      sparkLerp.setAttribute("duration", "200");
      sparkLerp.setAttribute("easing", "easeOutQuad");
      spark.appendChild(sparkLerp);

      sparkGroup.appendChild(spark);
      sparks.push(spark);
    }

    this.sceneGroup.appendChild(sparkGroup);

    // Animate the flash shrinking
    setTimeout(() => {
      flash.setAttribute("sx", "0.1");
      flash.setAttribute("sy", "0.1");
      flash.setAttribute("sz", "0.1");
      flash.setAttribute("emissive", "0");

      // Animate sparks flying outward
      sparks.forEach((spark, i) => {
        const angle = (i / sparkCount) * Math.PI * 2;
        const spreadX = Math.cos(angle) * (0.3 + Math.random() * 0.2);
        const spreadY = 0.1 + Math.random() * 0.2;
        const spreadZ = Math.sin(angle) * (0.3 + Math.random() * 0.2);
        spark.setAttribute("x", spreadX.toString());
        spark.setAttribute("y", spreadY.toString());
        spark.setAttribute("z", spreadZ.toString());
        spark.setAttribute("sx", "0.1");
        spark.setAttribute("sy", "0.1");
        spark.setAttribute("sz", "0.1");
      });
    }, 10);

    // Remove after animation
    setTimeout(() => {
      if (sparkGroup.parentNode) {
        sparkGroup.parentNode.removeChild(sparkGroup);
      }
    }, 300);
  }

  public dispose(): void {
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.bullets.forEach((bulletData) => {
      if (bulletData.element.parentNode) {
        bulletData.element.parentNode.removeChild(bulletData.element);
      }
    });
    this.bullets.clear();
  }
}
