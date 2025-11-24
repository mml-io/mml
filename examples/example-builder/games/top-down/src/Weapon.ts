import { CONSTANTS } from "./constants.js";
import { calculateWorldPosition, Position } from "./helpers.js";

interface BulletData {
  element: HTMLElement;
  startTime: number;
  direction: { x: number; y: number; z: number };
  startPos: Position;
  bulletId: number;
}

export class Weapon {
  private sceneGroup: HTMLElement;
  private bullets: Map<number, BulletData> = new Map();
  private bulletIdCounter: number = 0;
  private lastShotTime: number = 0;
  private updateInterval: number | null = null;

  constructor(sceneGroup: HTMLElement) {
    this.sceneGroup = sceneGroup;
    this.startBulletUpdateLoop();
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

    this.createBullet(shootFrom, direction);
    this.checkBulletHit(shootFrom, direction);
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

    this.createBullet(shootFrom, direction);
    this.checkBulletHit(shootFrom, direction);
  }

  private createBullet(from: Position, direction: { x: number; y: number; z: number }): void {
    const bulletId = ++this.bulletIdCounter;

    const bullet = document.createElement("m-cylinder");
    bullet.setAttribute("id", `bullet-${bulletId}`);
    bullet.setAttribute("radius", "0.05");
    bullet.setAttribute("height", "0.5");
    bullet.setAttribute("color", "#ffff00");
    bullet.setAttribute("collide", "false");
    bullet.setAttribute("x", from.x.toString());
    bullet.setAttribute("y", from.y.toString());
    bullet.setAttribute("z", from.z.toString());
    bullet.setAttribute("rz", "90");

    const angleRad = Math.atan2(direction.x, direction.z);
    const angleDeg = (angleRad * 180) / Math.PI + 90;
    bullet.setAttribute("ry", angleDeg.toString());

    this.sceneGroup.appendChild(bullet);

    this.bullets.set(bulletId, {
      element: bullet,
      startTime: Date.now(),
      direction,
      startPos: { ...from },
      bulletId,
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

  private checkBulletHit(from: Position, direction: { x: number; y: number; z: number }): void {
    if (!(window as any).physics) {
      return;
    }

    const result = (window as any).physics.raycast(from, direction, CONSTANTS.BULLET_MAX_DISTANCE);

    if (result.hit) {
      if (result.element && result.element.id && result.element.id.startsWith("enemy-")) {
        console.log("[Weapon] Hit enemy:", result.element.id);

        const damageEvent = new CustomEvent("enemy-damage", {
          detail: {
            damage: CONSTANTS.WEAPON_DAMAGE,
            hitPosition: result.point,
          },
          bubbles: true,
        });
        result.element.dispatchEvent(damageEvent);

        this.createHitEffect(result.point);
      }
    }
  }

  private createHitEffect(position: Position): void {
    const hitEffect = document.createElement("m-sphere");
    hitEffect.setAttribute("radius", "0.2");
    hitEffect.setAttribute("color", "#ff0000");
    hitEffect.setAttribute("x", position.x.toString());
    hitEffect.setAttribute("y", position.y.toString());
    hitEffect.setAttribute("z", position.z.toString());
    hitEffect.setAttribute("collide", "false");

    this.sceneGroup.appendChild(hitEffect);

    setTimeout(() => {
      if (hitEffect.parentNode) {
        hitEffect.parentNode.removeChild(hitEffect);
      }
    }, 200);
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
