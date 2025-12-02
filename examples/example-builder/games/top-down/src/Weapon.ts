import { CONSTANTS } from "./constants.js";
import { calculateWorldPosition, Position } from "./helpers.js";

interface BulletData {
  element: HTMLElement;
  startTime: number;
  direction: { x: number; y: number; z: number };
  startPos: Position;
  bulletId: number;
  hitInfo?: {
    enemyId: string;
    hitDistance: number;
    hitPosition: Position;
  };
}

export class Weapon {
  private sceneGroup: HTMLElement;
  private bullets: Map<number, BulletData> = new Map();
  private bulletIdCounter: number = 0;
  private lastShotTime: number = 0;
  private updateInterval: number | null = null;

  private shootSFXArray: HTMLElement[] = [];
  private shootSFXIndex: number = 0;

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

  public canShoot(): boolean {
    const now = Date.now();
    return now - this.lastShotTime >= CONSTANTS.WEAPON_FIRE_RATE;
  }

  public shootAt(
    targetWorldPos: Position,
    _playerPos: Position,
    _playerRotation: number,
    debugSphere: HTMLElement,
  ): void {
    if (!this.canShoot() || !debugSphere) {
      return;
    }

    this.lastShotTime = Date.now();

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

    const hitInfo = this.checkBulletHit(shootFrom, direction);
    this.createBullet(shootFrom, direction, hitInfo);
  }

  public shootForward(playerPos: Position, playerRotation: number, debugSphere: HTMLElement): void {
    if (!this.canShoot() || !debugSphere) {
      return;
    }

    this.lastShotTime = Date.now();
    const muzzleTransform = calculateWorldPosition(debugSphere);
    const shootFrom = muzzleTransform.position;

    const rotRad = (playerRotation * Math.PI) / 180;
    const direction = {
      x: Math.sin(rotRad),
      y: 0,
      z: Math.cos(rotRad),
    };

    const hitInfo = this.checkBulletHit(shootFrom, direction);
    this.createBullet(shootFrom, direction, hitInfo);
  }

  private createBullet(
    from: Position,
    direction: { x: number; y: number; z: number },
    hitInfo?: { enemyId: string; hitDistance: number; hitPosition: Position },
  ): void {
    const bulletId = ++this.bulletIdCounter;

    const bullet = document.createElement("m-cylinder");
    bullet.setAttribute("id", `bullet-${bulletId}`);
    bullet.setAttribute("radius", "0.04");
    bullet.setAttribute("height", "0.4");
    bullet.setAttribute("color", "#ffee55");
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
    });
  }

  private updateBullets(): void {
    const now = Date.now();
    const bulletsToRemove: number[] = [];

    this.bullets.forEach((bulletData, bulletId) => {
      const elapsed = (now - bulletData.startTime) / 1000;
      const distance = CONSTANTS.BULLET_SPEED * elapsed;

      if (distance > CONSTANTS.BULLET_MAX_DISTANCE || elapsed > CONSTANTS.BULLET_LIFETIME) {
        bulletsToRemove.push(bulletId);
        return;
      }

      // Check if bullet has reached its target
      if (bulletData.hitInfo && distance >= bulletData.hitInfo.hitDistance) {
        this.applyDamage(bulletData.hitInfo.enemyId, bulletData.hitInfo.hitPosition);
        bulletsToRemove.push(bulletId);
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
  ): { enemyId: string; hitDistance: number; hitPosition: Position } | undefined {
    // Check all enemies to see if bullet trajectory intersects them
    const enemies = document.querySelectorAll('[id^="enemy-"]');
    const hitRadius = 0.5; // Detection radius around zombie

    let closestHit: { element: Element; distance: number; hitPos: Position } | null = null;

    enemies.forEach((enemyElement) => {
      const enemyX = parseFloat(enemyElement.getAttribute("x") || "0");
      const enemyZ = parseFloat(enemyElement.getAttribute("z") || "0");

      // Calculate closest point on ray to enemy position
      const toEnemy = { x: enemyX - from.x, z: enemyZ - from.z };
      const rayLength = direction.x * toEnemy.x + direction.z * toEnemy.z;

      if (rayLength < 0 || rayLength > CONSTANTS.BULLET_MAX_DISTANCE) {
        return; // Enemy behind shooter or too far
      }

      const closestX = from.x + direction.x * rayLength;
      const closestZ = from.z + direction.z * rayLength;

      const distX = enemyX - closestX;
      const distZ = enemyZ - closestZ;
      const distanceToRay = Math.sqrt(distX * distX + distZ * distZ);

      if (distanceToRay <= hitRadius) {
        if (!closestHit || rayLength < closestHit.distance) {
          closestHit = {
            element: enemyElement,
            distance: rayLength,
            hitPos: { x: closestX, y: from.y, z: closestZ },
          };
        }
      }
    });

    // Return hit info if we found a target
    if (closestHit) {
      console.log("[Weapon] Bullet will hit enemy:", closestHit.element.id);
      return {
        enemyId: closestHit.element.id,
        hitDistance: closestHit.distance,
        hitPosition: closestHit.hitPos,
      };
    }

    return undefined;
  }

  private applyDamage(enemyId: string, hitPosition: Position): void {
    const enemyElement = document.getElementById(enemyId);
    if (!enemyElement) {
      return; // Enemy might have been removed already
    }

    console.log("[Weapon] Applying damage to enemy:", enemyId);

    const damageEvent = new CustomEvent("enemy-damage", {
      detail: {
        damage: CONSTANTS.WEAPON_DAMAGE,
        hitPosition,
      },
      bubbles: true,
    });
    enemyElement.dispatchEvent(damageEvent);

    this.createHitEffect(hitPosition);
  }

  private createHitEffect(position: Position): void {
    const now = document.timeline.currentTime as number;
    const hitEffect = document.createElement("m-video");
    hitEffect.setAttribute("cast-shadows", "false");
    hitEffect.setAttribute("x", position.x.toString());
    hitEffect.setAttribute("y", position.y.toString());
    hitEffect.setAttribute("z", position.z.toString());
    hitEffect.setAttribute("width", "4");
    hitEffect.setAttribute("height", "3");
    hitEffect.setAttribute("loop", "false");
    hitEffect.setAttribute("transparent", "true");
    hitEffect.setAttribute("collide", "false");
    hitEffect.setAttribute("src", CONSTANTS.BLOOD_SPRITE);
    hitEffect.setAttribute("start-time", now.toString());

    this.sceneGroup.appendChild(hitEffect);

    setTimeout(() => {
      if (hitEffect.parentNode) {
        hitEffect.parentNode.removeChild(hitEffect);
      }
    }, 1000);
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
