import { BarrelSystem } from "./Barrel.js";
import { CONSTANTS } from "./constants.js";
import { calculateWorldPosition, clamp, distance2D, Position } from "./helpers.js";

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
  applyImpulse(element: Element, impulse: { x: number; y: number; z: number }): void;
}

interface GrenadeData {
  element: HTMLElement;
  startTime: number;
  startPos: Position;
  velocity: { x: number; y: number; z: number };
  grenadeId: number;
  connectionId?: number;
}

export class GrenadeSystem {
  private sceneGroup: HTMLElement;
  private grenades: Map<number, GrenadeData> = new Map();
  private grenadeIdCounter: number = 0;
  private updateInterval: number | null = null;
  private explosionSFXArray: HTMLElement[] = [];
  private explosionSFXIndex: number = 0;
  private barrelSystem: BarrelSystem | null = null;

  public setBarrelSystem(barrelSystem: BarrelSystem): void {
    this.barrelSystem = barrelSystem;
  }

  constructor(sceneGroup: HTMLElement) {
    this.sceneGroup = sceneGroup;
    this.createExplosionSFX();
    this.startGrenadeUpdateLoop();
  }

  private createExplosionSFX(): void {
    for (let i = 0; i < 4; i++) {
      const audio = document.createElement("m-audio");
      audio.setAttribute("id", `grenade-sfx-${i}`);
      audio.setAttribute("src", CONSTANTS.SFX_GRENADE);
      audio.setAttribute("volume", "0");
      audio.setAttribute("loop", "false");
      this.explosionSFXArray.push(audio);
      this.sceneGroup.appendChild(audio);
    }
  }

  private playExplosionSFX(position: Position): void {
    const now = document.timeline.currentTime as number;
    const audio = this.explosionSFXArray[this.explosionSFXIndex];
    this.explosionSFXIndex = (this.explosionSFXIndex + 1) % this.explosionSFXArray.length;
    audio.setAttribute("x", position.x.toString());
    audio.setAttribute("y", position.y.toString());
    audio.setAttribute("z", position.z.toString());
    audio.setAttribute("start-time", now.toString());
    audio.setAttribute("end-time", (now + 2000).toString());
    audio.setAttribute("volume", "10");
    setTimeout(() => {
      audio.setAttribute("volume", "0");
    }, 2000);
  }

  private startGrenadeUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateGrenades();
    }, 16);
  }

  public throwGrenade(
    targetWorldPos: Position | null,
    playerRotation: number,
    debugSphere: HTMLElement,
    connectionId?: number,
  ): void {
    if (!debugSphere) {
      return;
    }

    const muzzleTransform = calculateWorldPosition(debugSphere);
    const throwFrom = muzzleTransform.position;

    const targetPos =
      targetWorldPos ?? this.getFallbackTarget(throwFrom, playerRotation);
    const velocity = this.calculateArcVelocity(throwFrom, targetPos);

    const grenadeId = ++this.grenadeIdCounter;

    const grenade = document.createElement("m-model");
    grenade.setAttribute("id", `grenade-${grenadeId}`);
    grenade.setAttribute("src", CONSTANTS.GRENADE_MODEL);
    grenade.setAttribute("sx", CONSTANTS.GRENADE_MODEL_SCALE.toString());
    grenade.setAttribute("sy", CONSTANTS.GRENADE_MODEL_SCALE.toString());
    grenade.setAttribute("sz", CONSTANTS.GRENADE_MODEL_SCALE.toString());
    grenade.setAttribute("collide", "false");
    grenade.setAttribute("cast-shadows", "false");
    grenade.setAttribute("x", throwFrom.x.toString());
    grenade.setAttribute("y", throwFrom.y.toString());
    grenade.setAttribute("z", throwFrom.z.toString());
    grenade.setAttribute("rx", "0");
    grenade.setAttribute("ry", "0");
    grenade.setAttribute("rz", "0");

    const spinLerp = document.createElement("m-attr-lerp");
    spinLerp.setAttribute("attr", "rx,ry,rz");
    spinLerp.setAttribute("duration", "200");
    grenade.appendChild(spinLerp);

    this.sceneGroup.appendChild(grenade);

    this.grenades.set(grenadeId, {
      element: grenade,
      startTime: Date.now(),
      startPos: { ...throwFrom },
      velocity,
      grenadeId,
      connectionId,
    });
  }

  private getFallbackTarget(startPos: Position, playerRotation: number): Position {
    const rotRad = (playerRotation * Math.PI) / 180;
    const direction = {
      x: Math.sin(rotRad),
      y: 0,
      z: Math.cos(rotRad),
    };
    const distance = CONSTANTS.GRENADE_MAX_THROW_DISTANCE;
    return {
      x: startPos.x + direction.x * distance,
      y: CONSTANTS.GRENADE_GROUND_Y,
      z: startPos.z + direction.z * distance,
    };
  }

  private calculateArcVelocity(startPos: Position, targetPos: Position): {
    x: number;
    y: number;
    z: number;
  } {
    const dx = targetPos.x - startPos.x;
    const dz = targetPos.z - startPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const g = Math.abs(CONSTANTS.GRENADE_GRAVITY);

    const arcHeight = clamp(
      distance * CONSTANTS.GRENADE_ARC_HEIGHT_FACTOR,
      CONSTANTS.GRENADE_ARC_MIN_HEIGHT,
      CONSTANTS.GRENADE_ARC_MAX_HEIGHT,
    );
    const apexY = Math.max(startPos.y, targetPos.y) + arcHeight;

    const vy = Math.sqrt(2 * g * Math.max(0.01, apexY - startPos.y));
    const tUp = vy / g;
    const tDown = Math.sqrt(Math.max(0.01, (2 * (apexY - targetPos.y)) / g));
    const flightTime = Math.max(0.2, tUp + tDown);

    return {
      x: dx / flightTime,
      y: vy,
      z: dz / flightTime,
    };
  }

  private updateGrenades(): void {
    const now = Date.now();
    const grenadesToRemove: number[] = [];

    this.grenades.forEach((grenadeData, grenadeId) => {
      const elapsed = (now - grenadeData.startTime) / 1000;
      const prevX = parseFloat(
        grenadeData.element.getAttribute("x") || grenadeData.startPos.x.toString(),
      );
      const prevY = parseFloat(
        grenadeData.element.getAttribute("y") || grenadeData.startPos.y.toString(),
      );
      const prevZ = parseFloat(
        grenadeData.element.getAttribute("z") || grenadeData.startPos.z.toString(),
      );

      const newX = grenadeData.startPos.x + grenadeData.velocity.x * elapsed;
      const newY =
        grenadeData.startPos.y +
        grenadeData.velocity.y * elapsed +
        0.5 * CONSTANTS.GRENADE_GRAVITY * elapsed * elapsed;
      const newZ = grenadeData.startPos.z + grenadeData.velocity.z * elapsed;

      const physics = (window as { physics?: PhysicsSystem }).physics;
      const stepX = newX - prevX;
      const stepY = newY - prevY;
      const stepZ = newZ - prevZ;
      const stepDistance = Math.sqrt(stepX * stepX + stepY * stepY + stepZ * stepZ);
      if (physics && stepDistance > 0.0001) {
        const inv = 1 / stepDistance;
        const rayResult = physics.raycast(
          { x: prevX, y: prevY, z: prevZ },
          { x: stepX * inv, y: stepY * inv, z: stepZ * inv },
          stepDistance,
        );
        if (rayResult.hit && rayResult.point) {
          this.explodeGrenade(grenadeData, {
            x: rayResult.point.x,
            y: rayResult.point.y,
            z: rayResult.point.z,
          });
          grenadesToRemove.push(grenadeId);
          return;
        }
      }

      if (newY <= CONSTANTS.GRENADE_GROUND_Y) {
        this.explodeGrenade(grenadeData, { x: newX, y: CONSTANTS.GRENADE_GROUND_Y, z: newZ });
        grenadesToRemove.push(grenadeId);
        return;
      }

      grenadeData.element.setAttribute("x", newX.toString());
      grenadeData.element.setAttribute("y", newY.toString());
      grenadeData.element.setAttribute("z", newZ.toString());

      const spin = (elapsed * 720) % 360;
      grenadeData.element.setAttribute("rx", spin.toString());
      grenadeData.element.setAttribute("ry", spin.toString());
    });

    grenadesToRemove.forEach((grenadeId) => {
      this.removeGrenade(grenadeId);
    });
  }

  private explodeGrenade(grenadeData: GrenadeData, overridePosition?: Position): void {
    const explosionPos = overridePosition ?? {
      x: parseFloat(grenadeData.element.getAttribute("x") || "0"),
      y: parseFloat(grenadeData.element.getAttribute("y") || "0"),
      z: parseFloat(grenadeData.element.getAttribute("z") || "0"),
    };

    this.createExplosionEffect(explosionPos);
    this.playExplosionSFX(explosionPos);
    this.applyExplosionImpulse(explosionPos);
  }

  private applyExplosionImpulse(explosionPos: Position): void {
    const enemies = document.querySelectorAll('[id^="enemy-"]');
    const physics = (window as { physics?: PhysicsSystem }).physics;

    // Damage barrels in blast radius
    if (this.barrelSystem) {
      this.barrelSystem.damageBarrelsInRadius(
        explosionPos,
        CONSTANTS.GRENADE_BLAST_RADIUS,
        CONSTANTS.GRENADE_DAMAGE,
      );
    }

    enemies.forEach((enemyElement) => {
      const enemyX = parseFloat(enemyElement.getAttribute("x") || "0");
      const enemyY = parseFloat(enemyElement.getAttribute("y") || "0");
      const enemyZ = parseFloat(enemyElement.getAttribute("z") || "0");
      const enemyPos: Position = { x: enemyX, y: enemyY, z: enemyZ };
      const distance = distance2D(enemyPos, explosionPos);

      if (distance > CONSTANTS.GRENADE_BLAST_RADIUS) {
        return;
      }

      const normalizedDistance = clamp(
        distance / CONSTANTS.GRENADE_BLAST_RADIUS,
        0,
        1,
      );
      const falloff = Math.max(0, 1 - normalizedDistance);
      const dirX = enemyX - explosionPos.x;
      const dirZ = enemyZ - explosionPos.z;
      const length = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      const impulse = {
        x: (dirX / length) * CONSTANTS.GRENADE_IMPULSE_FORCE * falloff,
        y: CONSTANTS.GRENADE_IMPULSE_UPWARD * falloff,
        z: (dirZ / length) * CONSTANTS.GRENADE_IMPULSE_FORCE * falloff,
      };

      physics?.applyImpulse(enemyElement, impulse);

      const damageFalloff = Math.exp(-CONSTANTS.GRENADE_DAMAGE_FALLOFF * normalizedDistance);
      const minDamageFalloff = Math.exp(-CONSTANTS.GRENADE_DAMAGE_FALLOFF);
      const normalizedDamageFalloff =
        (damageFalloff - minDamageFalloff) / (1 - minDamageFalloff);
      const damage = Math.max(
        1,
        Math.floor(1 + (CONSTANTS.GRENADE_DAMAGE - 1) * normalizedDamageFalloff),
      );
      const damageEvent = new CustomEvent("enemy-damage", {
        detail: {
          damage,
          hitPosition: enemyPos,
          isCrit: false,
          source: "grenade",
        },
        bubbles: true,
      });
      enemyElement.dispatchEvent(damageEvent);
    });
  }

  private createExplosionEffect(position: Position): void {
    const explosion = document.createElement("m-group");
    explosion.setAttribute("x", position.x.toString());
    explosion.setAttribute("y", position.y.toString());
    explosion.setAttribute("z", position.z.toString());

    const flash = document.createElement("m-sphere");
    flash.setAttribute("radius", "0.35");
    flash.setAttribute("color", "#ffcc55");
    flash.setAttribute("emissive", "1");
    flash.setAttribute("opacity", "0.95");
    flash.setAttribute("collide", "false");
    flash.setAttribute("cast-shadows", "false");

    const flashLerp = document.createElement("m-attr-lerp");
    flashLerp.setAttribute("attr", "sx,sy,sz,emissive,opacity");
    flashLerp.setAttribute("duration", "300");
    flashLerp.setAttribute("easing", "easeOutExpo");
    flash.appendChild(flashLerp);
    explosion.appendChild(flash);

    const shockwave = document.createElement("m-cylinder");
    shockwave.setAttribute("y", "0.05");
    shockwave.setAttribute("radius", "0.4");
    shockwave.setAttribute("height", "0.05");
    shockwave.setAttribute("color", "#ff8844");
    shockwave.setAttribute("opacity", "0.8");
    shockwave.setAttribute("collide", "false");
    shockwave.setAttribute("cast-shadows", "false");

    const waveLerp = document.createElement("m-attr-lerp");
    waveLerp.setAttribute("attr", "radius,opacity");
    waveLerp.setAttribute("duration", "350");
    waveLerp.setAttribute("easing", "easeOutQuad");
    shockwave.appendChild(waveLerp);
    explosion.appendChild(shockwave);

    const sparkCount = 10;
    const sparks: HTMLElement[] = [];
    for (let i = 0; i < sparkCount; i++) {
      const spark = document.createElement("m-sphere");
      spark.setAttribute("radius", "0.06");
      spark.setAttribute("color", "#ffd966");
      spark.setAttribute("emissive", "0.8");
      spark.setAttribute("opacity", "0.9");
      spark.setAttribute("collide", "false");
      spark.setAttribute("cast-shadows", "false");

      const sparkLerp = document.createElement("m-attr-lerp");
      sparkLerp.setAttribute("attr", "x,y,z,opacity,sx,sy,sz");
      sparkLerp.setAttribute("duration", "450");
      sparkLerp.setAttribute("easing", "easeOutQuad");
      spark.appendChild(sparkLerp);

      explosion.appendChild(spark);
      sparks.push(spark);
    }

    this.sceneGroup.appendChild(explosion);

    setTimeout(() => {
      flash.setAttribute("sx", "6");
      flash.setAttribute("sy", "6");
      flash.setAttribute("sz", "6");
      flash.setAttribute("emissive", "0");
      flash.setAttribute("opacity", "0");

      shockwave.setAttribute("radius", "4.5");
      shockwave.setAttribute("opacity", "0");

      sparks.forEach((spark, i) => {
        const angle = (i / sparkCount) * Math.PI * 2;
        const distance = 2.2 + Math.random() * 1.2;
        const height = 0.4 + Math.random() * 0.6;
        spark.setAttribute("x", (Math.cos(angle) * distance).toString());
        spark.setAttribute("y", height.toString());
        spark.setAttribute("z", (Math.sin(angle) * distance).toString());
        spark.setAttribute("opacity", "0");
        spark.setAttribute("sx", "0.2");
        spark.setAttribute("sy", "0.2");
        spark.setAttribute("sz", "0.2");
      });
    }, 10);

    setTimeout(() => {
      if (explosion.parentNode) {
        explosion.parentNode.removeChild(explosion);
      }
    }, 600);
  }

  private removeGrenade(grenadeId: number): void {
    const grenadeData = this.grenades.get(grenadeId);
    if (grenadeData) {
      if (grenadeData.element.parentNode) {
        grenadeData.element.parentNode.removeChild(grenadeData.element);
      }
      this.grenades.delete(grenadeId);
    }
  }

  public dispose(): void {
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.grenades.forEach((grenadeData) => {
      if (grenadeData.element.parentNode) {
        grenadeData.element.parentNode.removeChild(grenadeData.element);
      }
    });
    this.grenades.clear();
  }
}
