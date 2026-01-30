import { CONSTANTS } from "./constants.js";
import { clamp, distance2D, Position, spawnDamageNumber } from "./helpers.js";

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

type BarrelType = "explosive" | "flammable";

interface BarrelData {
  element: HTMLElement;
  modelElement: HTMLElement;
  type: BarrelType;
  health: number;
  maxHealth: number;
  healthBarGreen: HTMLElement;
  healthBarRed: HTMLElement;
  flameEffect: HTMLElement | null;
  isFlaming: boolean;
  isDestroyed: boolean;
  position: Position;
  damageHandler: (event: Event) => void;
}

interface BurningEntity {
  element: HTMLElement;
  endTime: number;
  lastTickTime: number;
  fireEffect: HTMLElement | null;
}

interface LiquidPool {
  element: HTMLElement;
  position: Position;
  radius: number;
  endTime: number;
  tickInterval: number;
}

export class BarrelSystem {
  private sceneGroup: HTMLElement;
  private barrels: Map<number, BarrelData> = new Map();
  private barrelIdCounter: number = 0;
  private liquidPools: Map<number, LiquidPool> = new Map();
  private poolIdCounter: number = 0;
  private burningEntities: Map<string, BurningEntity> = new Map();
  private updateInterval: number | null = null;
  private explosionSFXArray: HTMLElement[] = [];
  private explosionSFXIndex: number = 0;

  constructor(sceneGroup: HTMLElement) {
    this.sceneGroup = sceneGroup;
    this.createExplosionSFX();
    this.startUpdateLoop();
  }

  private createExplosionSFX(): void {
    for (let i = 0; i < 4; i++) {
      const audio = document.createElement("m-audio");
      audio.setAttribute("id", `barrel-explosion-sfx-${i}`);
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

  private startUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateLiquidPools();
      this.updateBurningEntities();
    }, 100);
  }

  public spawnBarrel(x: number, z: number, type: BarrelType): void {
    const barrelId = ++this.barrelIdCounter;
    const y = 0.05;

    const barrelGroup = document.createElement("m-group");
    barrelGroup.setAttribute("id", `barrel-${barrelId}`);
    barrelGroup.setAttribute("x", x.toString());
    barrelGroup.setAttribute("y", y.toString());
    barrelGroup.setAttribute("z", z.toString());
    barrelGroup.setAttribute("clickable", "true");

    const model = document.createElement("m-model");
    model.setAttribute(
      "src",
      type === "explosive" ? CONSTANTS.EXPLOSIVE_BARREL_MODEL : CONSTANTS.FLAMMABLE_BARREL_MODEL,
    );
    model.setAttribute("sx", CONSTANTS.BARREL_MODEL_SCALE.toString());
    model.setAttribute("sy", CONSTANTS.BARREL_MODEL_SCALE.toString());
    model.setAttribute("sz", CONSTANTS.BARREL_MODEL_SCALE.toString());
    model.setAttribute("rigidbody", "true");
    barrelGroup.appendChild(model);

    const healthBar = this.createHealthBar(barrelGroup);

    this.sceneGroup.appendChild(barrelGroup);

    const damageHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const damage = customEvent.detail?.damage || 0;
      const barrelData = this.barrels.get(barrelId);
      if (barrelData && !barrelData.isDestroyed) {
        barrelData.health -= damage;
        spawnDamageNumber(barrelGroup, damage);

        if (barrelData.health <= 0) {
          this.destroyBarrel(barrelId);
        } else {
          this.updateHealthBar(barrelData);
          const healthPercent = barrelData.health / barrelData.maxHealth;
          if (healthPercent <= CONSTANTS.BARREL_FLAME_THRESHOLD && !barrelData.isFlaming) {
            this.startFlaming(barrelData);
          }
        }
      }
    };
    barrelGroup.addEventListener("barrel-damage", damageHandler);

    const barrelData: BarrelData = {
      element: barrelGroup,
      modelElement: model,
      type,
      health: CONSTANTS.BARREL_MAX_HEALTH,
      maxHealth: CONSTANTS.BARREL_MAX_HEALTH,
      healthBarGreen: healthBar.green,
      healthBarRed: healthBar.red,
      flameEffect: null,
      isFlaming: false,
      isDestroyed: false,
      position: { x, y, z },
      damageHandler,
    };

    this.barrels.set(barrelId, barrelData);
    console.log(`[Barrel] Spawned ${type} barrel ${barrelId} at (${x}, ${z})`);
  }

  private createHealthBar(parent: HTMLElement): { green: HTMLElement; red: HTMLElement } {
    const healthBarContainer = document.createElement("m-group");
    healthBarContainer.setAttribute("y", "1.2");
    healthBarContainer.setAttribute("collide", "false");
    parent.appendChild(healthBarContainer);

    const healthBarGreen = document.createElement("m-cube");
    healthBarGreen.setAttribute("width", CONSTANTS.HEALTH_BAR_WIDTH.toString());
    healthBarGreen.setAttribute("height", CONSTANTS.HEALTH_BAR_HEIGHT.toString());
    healthBarGreen.setAttribute("depth", CONSTANTS.HEALTH_BAR_DEPTH.toString());
    healthBarGreen.setAttribute("color", "#00ff00");
    healthBarGreen.setAttribute("collide", "false");
    healthBarContainer.appendChild(healthBarGreen);

    const healthBarRed = document.createElement("m-cube");
    healthBarRed.setAttribute("width", CONSTANTS.HEALTH_BAR_WIDTH.toString());
    healthBarRed.setAttribute("height", (CONSTANTS.HEALTH_BAR_HEIGHT * 0.8).toString());
    healthBarRed.setAttribute("depth", (CONSTANTS.HEALTH_BAR_DEPTH * 0.8).toString());
    healthBarRed.setAttribute("color", "#ff0000");
    healthBarRed.setAttribute("collide", "false");
    healthBarContainer.appendChild(healthBarRed);

    return { green: healthBarGreen, red: healthBarRed };
  }

  private updateHealthBar(barrelData: BarrelData): void {
    const healthPercent = barrelData.health / barrelData.maxHealth;
    const newWidth = CONSTANTS.HEALTH_BAR_WIDTH * healthPercent;
    barrelData.healthBarGreen.setAttribute("width", newWidth.toString());
    const offset = (CONSTANTS.HEALTH_BAR_WIDTH - newWidth) / 2;
    barrelData.healthBarGreen.setAttribute("x", (-offset).toString());
  }

  private startFlaming(barrelData: BarrelData): void {
    if (barrelData.isFlaming || barrelData.isDestroyed) return;
    barrelData.isFlaming = true;

    const flameGroup = document.createElement("m-group");
    flameGroup.setAttribute("y", "0.8");

    for (let i = 0; i < 5; i++) {
      const flame = document.createElement("m-sphere");
      const angle = (i / 5) * Math.PI * 2;
      const radius = 0.15;
      flame.setAttribute("x", (Math.cos(angle) * radius).toString());
      flame.setAttribute("z", (Math.sin(angle) * radius).toString());
      flame.setAttribute("y", (Math.random() * 0.3).toString());
      flame.setAttribute("radius", (0.08 + Math.random() * 0.06).toString());
      flame.setAttribute("color", i % 2 === 0 ? "#ff6600" : "#ffcc00");
      flame.setAttribute("emissive", "0.9");
      flame.setAttribute("opacity", "0.85");
      flame.setAttribute("collide", "false");
      flame.setAttribute("cast-shadows", "false");

      const flameLerp = document.createElement("m-attr-lerp");
      flameLerp.setAttribute("attr", "y,sx,sy,sz,opacity");
      flameLerp.setAttribute("duration", "300");
      flameLerp.setAttribute("easing", "easeInOutSine");
      flame.appendChild(flameLerp);

      flameGroup.appendChild(flame);

      this.animateFlame(flame, 0.08 + Math.random() * 0.06);
    }

    barrelData.element.appendChild(flameGroup);
    barrelData.flameEffect = flameGroup;
  }

  private animateFlame(flame: HTMLElement, baseRadius: number): void {
    const animate = () => {
      if (!flame.parentNode) return;

      const scaleVariation = 0.7 + Math.random() * 0.6;
      const yOffset = 0.1 + Math.random() * 0.4;
      const opacityVariation = 0.6 + Math.random() * 0.4;

      flame.setAttribute("y", yOffset.toString());
      flame.setAttribute("sx", scaleVariation.toString());
      flame.setAttribute("sy", (scaleVariation * 1.2).toString());
      flame.setAttribute("sz", scaleVariation.toString());
      flame.setAttribute("opacity", opacityVariation.toString());

      setTimeout(animate, 200 + Math.random() * 200);
    };
    setTimeout(animate, Math.random() * 200);
  }

  private createBurningEffect(target: HTMLElement): HTMLElement {
    const fireGroup = document.createElement("m-group");
    const isPlayerCapsule = target.tagName === "M-CAPSULE";
    const baseY = isPlayerCapsule ? "-0.3" : "0.5";
    const ringRadius = isPlayerCapsule ? 0.28 : 0.2;

    fireGroup.setAttribute("y", baseY);
    fireGroup.setAttribute("collide", "false");
    fireGroup.setAttribute("cast-shadows", "false");

    const flameCount = 6;
    for (let i = 0; i < flameCount; i++) {
      const flame = document.createElement("m-sphere");
      const angle = (i / flameCount) * Math.PI * 2;
      const radius = ringRadius * (0.7 + Math.random() * 0.6);
      flame.setAttribute("x", (Math.cos(angle) * radius).toString());
      flame.setAttribute("z", (Math.sin(angle) * radius).toString());
      flame.setAttribute("y", (0.1 + Math.random() * 0.3).toString());
      flame.setAttribute("radius", (0.06 + Math.random() * 0.05).toString());
      flame.setAttribute("color", i % 2 === 0 ? "#ff6600" : "#ffcc00");
      flame.setAttribute("emissive", "0.9");
      flame.setAttribute("opacity", "0.85");
      flame.setAttribute("collide", "false");
      flame.setAttribute("cast-shadows", "false");

      const flameLerp = document.createElement("m-attr-lerp");
      flameLerp.setAttribute("attr", "y,sx,sy,sz,opacity");
      flameLerp.setAttribute("duration", "250");
      flameLerp.setAttribute("easing", "easeInOutSine");
      flame.appendChild(flameLerp);

      fireGroup.appendChild(flame);
      this.animateFlame(flame, 0.06);
    }

    target.appendChild(fireGroup);
    return fireGroup;
  }

  private upsertBurningEntity(entityId: string, element: HTMLElement, now: number): void {
    const endTime = now + CONSTANTS.LIQUID_BURN_DURATION;
    const existing = this.burningEntities.get(entityId);
    if (existing) {
      existing.endTime = endTime;
      existing.lastTickTime = now;
      if (!existing.fireEffect || !existing.fireEffect.parentNode) {
        existing.fireEffect = this.createBurningEffect(element);
      }
      return;
    }

    this.burningEntities.set(entityId, {
      element,
      endTime,
      lastTickTime: now,
      fireEffect: this.createBurningEffect(element),
    });
  }

  private removeBurningEffect(burningData: BurningEntity): void {
    if (burningData.fireEffect?.parentNode) {
      burningData.fireEffect.parentNode.removeChild(burningData.fireEffect);
    }
    burningData.fireEffect = null;
  }

  private destroyBarrel(barrelId: number): void {
    const barrelData = this.barrels.get(barrelId);
    if (!barrelData || barrelData.isDestroyed) return;

    barrelData.isDestroyed = true;
    const position = barrelData.position;

    barrelData.healthBarGreen.setAttribute("visible", "false");
    barrelData.healthBarRed.setAttribute("visible", "false");
    barrelData.element.setAttribute("id", `destroyed-barrel-${barrelId}`);

    if (barrelData.type === "explosive") {
      this.createExplosion(position);
      this.playExplosionSFX(position);
      this.applyExplosionDamage(position, barrelId);
    } else {
      this.createLiquidPool(position);
      this.createLiquidSpillEffect(position);
    }

    barrelData.element.setAttribute("visible", "false");

    setTimeout(() => {
      barrelData.element.removeEventListener("barrel-damage", barrelData.damageHandler);
      if (barrelData.element.parentNode) {
        barrelData.element.parentNode.removeChild(barrelData.element);
      }
      this.barrels.delete(barrelId);
    }, 500);
  }

  private createExplosion(position: Position): void {
    const explosion = document.createElement("m-group");
    explosion.setAttribute("x", position.x.toString());
    explosion.setAttribute("y", position.y.toString());
    explosion.setAttribute("z", position.z.toString());

    const flash = document.createElement("m-sphere");
    flash.setAttribute("radius", "0.5");
    flash.setAttribute("color", "#ff8800");
    flash.setAttribute("emissive", "1");
    flash.setAttribute("opacity", "0.95");
    flash.setAttribute("collide", "false");
    flash.setAttribute("cast-shadows", "false");

    const flashLerp = document.createElement("m-attr-lerp");
    flashLerp.setAttribute("attr", "sx,sy,sz,emissive,opacity");
    flashLerp.setAttribute("duration", "350");
    flashLerp.setAttribute("easing", "easeOutExpo");
    flash.appendChild(flashLerp);
    explosion.appendChild(flash);

    const shockwave = document.createElement("m-cylinder");
    shockwave.setAttribute("y", "0.05");
    shockwave.setAttribute("radius", "0.5");
    shockwave.setAttribute("height", "0.08");
    shockwave.setAttribute("color", "#ff6600");
    shockwave.setAttribute("opacity", "0.8");
    shockwave.setAttribute("collide", "false");
    shockwave.setAttribute("cast-shadows", "false");

    const waveLerp = document.createElement("m-attr-lerp");
    waveLerp.setAttribute("attr", "radius,opacity");
    waveLerp.setAttribute("duration", "400");
    waveLerp.setAttribute("easing", "easeOutQuad");
    shockwave.appendChild(waveLerp);
    explosion.appendChild(shockwave);

    const sparkCount = 12;
    const sparks: HTMLElement[] = [];
    for (let i = 0; i < sparkCount; i++) {
      const spark = document.createElement("m-sphere");
      spark.setAttribute("radius", "0.08");
      spark.setAttribute("color", i % 3 === 0 ? "#ff4400" : "#ffaa00");
      spark.setAttribute("emissive", "0.9");
      spark.setAttribute("opacity", "0.9");
      spark.setAttribute("collide", "false");
      spark.setAttribute("cast-shadows", "false");

      const sparkLerp = document.createElement("m-attr-lerp");
      sparkLerp.setAttribute("attr", "x,y,z,opacity,sx,sy,sz");
      sparkLerp.setAttribute("duration", "500");
      sparkLerp.setAttribute("easing", "easeOutQuad");
      spark.appendChild(sparkLerp);

      explosion.appendChild(spark);
      sparks.push(spark);
    }

    const debrisCount = 8;
    const debris: HTMLElement[] = [];
    for (let i = 0; i < debrisCount; i++) {
      const piece = document.createElement("m-cube");
      piece.setAttribute("width", (0.1 + Math.random() * 0.15).toString());
      piece.setAttribute("height", (0.1 + Math.random() * 0.15).toString());
      piece.setAttribute("depth", (0.1 + Math.random() * 0.15).toString());
      piece.setAttribute("color", "#444444");
      piece.setAttribute("collide", "false");
      piece.setAttribute("cast-shadows", "false");

      const debrisLerp = document.createElement("m-attr-lerp");
      debrisLerp.setAttribute("attr", "x,y,z,rx,ry,rz,opacity");
      debrisLerp.setAttribute("duration", "600");
      debrisLerp.setAttribute("easing", "easeOutQuad");
      piece.appendChild(debrisLerp);

      explosion.appendChild(piece);
      debris.push(piece);
    }

    this.sceneGroup.appendChild(explosion);

    setTimeout(() => {
      flash.setAttribute("sx", "7");
      flash.setAttribute("sy", "7");
      flash.setAttribute("sz", "7");
      flash.setAttribute("emissive", "0");
      flash.setAttribute("opacity", "0");

      shockwave.setAttribute("radius", "5.5");
      shockwave.setAttribute("opacity", "0");

      sparks.forEach((spark, i) => {
        const angle = (i / sparkCount) * Math.PI * 2;
        const distance = 2.5 + Math.random() * 1.5;
        const height = 0.5 + Math.random() * 1.0;
        spark.setAttribute("x", (Math.cos(angle) * distance).toString());
        spark.setAttribute("y", height.toString());
        spark.setAttribute("z", (Math.sin(angle) * distance).toString());
        spark.setAttribute("opacity", "0");
        spark.setAttribute("sx", "0.2");
        spark.setAttribute("sy", "0.2");
        spark.setAttribute("sz", "0.2");
      });

      debris.forEach((piece, i) => {
        const angle = (i / debrisCount) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 1.5 + Math.random() * 2;
        const height = 1 + Math.random() * 2;
        piece.setAttribute("x", (Math.cos(angle) * distance).toString());
        piece.setAttribute("y", height.toString());
        piece.setAttribute("z", (Math.sin(angle) * distance).toString());
        piece.setAttribute("rx", (Math.random() * 360).toString());
        piece.setAttribute("ry", (Math.random() * 360).toString());
        piece.setAttribute("rz", (Math.random() * 360).toString());
        piece.setAttribute("opacity", "0");
      });
    }, 10);

    setTimeout(() => {
      if (explosion.parentNode) {
        explosion.parentNode.removeChild(explosion);
      }
    }, 700);
  }

  private applyExplosionDamage(explosionPos: Position, sourceBarrelId: number): void {
    const physics = (window as { physics?: PhysicsSystem }).physics;

    // Damage enemies
    const enemies = document.querySelectorAll('[id^="enemy-"]');
    enemies.forEach((enemyElement) => {
      const enemyX = parseFloat(enemyElement.getAttribute("x") || "0");
      const enemyY = parseFloat(enemyElement.getAttribute("y") || "0");
      const enemyZ = parseFloat(enemyElement.getAttribute("z") || "0");
      const enemyPos: Position = { x: enemyX, y: enemyY, z: enemyZ };
      const distance = distance2D(enemyPos, explosionPos);

      if (distance > CONSTANTS.EXPLOSIVE_BARREL_BLAST_RADIUS) return;

      const normalizedDistance = clamp(distance / CONSTANTS.EXPLOSIVE_BARREL_BLAST_RADIUS, 0, 1);
      const falloff = Math.max(0, 1 - normalizedDistance);

      const dirX = enemyX - explosionPos.x;
      const dirZ = enemyZ - explosionPos.z;
      const length = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
      const impulse = {
        x: (dirX / length) * CONSTANTS.EXPLOSIVE_BARREL_IMPULSE_FORCE * falloff,
        y: CONSTANTS.EXPLOSIVE_BARREL_IMPULSE_UPWARD * falloff,
        z: (dirZ / length) * CONSTANTS.EXPLOSIVE_BARREL_IMPULSE_FORCE * falloff,
      };

      physics?.applyImpulse(enemyElement, impulse);

      const damageFalloff = Math.exp(
        -CONSTANTS.EXPLOSIVE_BARREL_DAMAGE_FALLOFF * normalizedDistance,
      );
      const minDamageFalloff = Math.exp(-CONSTANTS.EXPLOSIVE_BARREL_DAMAGE_FALLOFF);
      const normalizedDamageFalloff = (damageFalloff - minDamageFalloff) / (1 - minDamageFalloff);
      const damage = Math.max(
        1,
        Math.floor(1 + (CONSTANTS.EXPLOSIVE_BARREL_DAMAGE - 1) * normalizedDamageFalloff),
      );

      const damageEvent = new CustomEvent("enemy-damage", {
        detail: { damage, hitPosition: enemyPos, isCrit: false, source: "barrel-explosion" },
        bubbles: true,
      });
      enemyElement.dispatchEvent(damageEvent);
    });

    // Damage players
    const players = document.querySelectorAll("[data-connection-id]");
    players.forEach((playerElement) => {
      const playerX = parseFloat(playerElement.getAttribute("x") || "0");
      const playerY = parseFloat(playerElement.getAttribute("y") || "0");
      const playerZ = parseFloat(playerElement.getAttribute("z") || "0");
      const playerPos: Position = { x: playerX, y: playerY, z: playerZ };
      const distance = distance2D(playerPos, explosionPos);

      if (distance > CONSTANTS.EXPLOSIVE_BARREL_BLAST_RADIUS) return;

      const normalizedDistance = clamp(distance / CONSTANTS.EXPLOSIVE_BARREL_BLAST_RADIUS, 0, 1);
      const damageFalloff = Math.exp(
        -CONSTANTS.EXPLOSIVE_BARREL_DAMAGE_FALLOFF * normalizedDistance,
      );
      const minDamageFalloff = Math.exp(-CONSTANTS.EXPLOSIVE_BARREL_DAMAGE_FALLOFF);
      const normalizedDamageFalloff = (damageFalloff - minDamageFalloff) / (1 - minDamageFalloff);
      const damage = Math.max(
        1,
        Math.floor(1 + (CONSTANTS.EXPLOSIVE_BARREL_DAMAGE - 1) * normalizedDamageFalloff),
      );

      const connectionId = parseInt(
        (playerElement as HTMLElement).dataset.connectionId || "0",
        10,
      );
      const playerDamageEvent = new CustomEvent("player-damage", {
        detail: { connectionId, damage },
        bubbles: true,
      });
      window.dispatchEvent(playerDamageEvent);
    });

    // Chain reaction: damage other barrels
    this.barrels.forEach((barrelData, barrelId) => {
      if (barrelId === sourceBarrelId || barrelData.isDestroyed) return;

      const distance = distance2D(barrelData.position, explosionPos);
      if (distance > CONSTANTS.EXPLOSIVE_BARREL_BLAST_RADIUS) return;

      const normalizedDistance = clamp(distance / CONSTANTS.EXPLOSIVE_BARREL_BLAST_RADIUS, 0, 1);
      const damageFalloff = Math.exp(
        -CONSTANTS.EXPLOSIVE_BARREL_DAMAGE_FALLOFF * normalizedDistance,
      );
      const minDamageFalloff = Math.exp(-CONSTANTS.EXPLOSIVE_BARREL_DAMAGE_FALLOFF);
      const normalizedDamageFalloff = (damageFalloff - minDamageFalloff) / (1 - minDamageFalloff);
      const damage = Math.max(
        1,
        Math.floor(1 + (CONSTANTS.EXPLOSIVE_BARREL_DAMAGE - 1) * normalizedDamageFalloff),
      );

      const damageEvent = new CustomEvent("barrel-damage", {
        detail: { damage, source: "chain-reaction" },
        bubbles: true,
      });
      barrelData.element.dispatchEvent(damageEvent);
    });
  }

  private createLiquidPool(position: Position): void {
    const poolId = ++this.poolIdCounter;

    const poolGroup = document.createElement("m-group");
    poolGroup.setAttribute("id", `liquid-pool-${poolId}`);
    poolGroup.setAttribute("x", position.x.toString());
    poolGroup.setAttribute("y", "0");
    poolGroup.setAttribute("z", position.z.toString());

    const pool = document.createElement("m-cylinder");
    pool.setAttribute("y", "0.02");
    pool.setAttribute("radius", "0.1");
    pool.setAttribute("height", "0.04");
    pool.setAttribute("color", "#ff6600");
    pool.setAttribute("emissive", "0.4");
    pool.setAttribute("opacity", "0.75");
    pool.setAttribute("collide", "false");
    pool.setAttribute("cast-shadows", "false");

    const poolLerp = document.createElement("m-attr-lerp");
    poolLerp.setAttribute("attr", "radius,opacity");
    poolLerp.setAttribute("duration", "800");
    poolLerp.setAttribute("easing", "easeOutQuad");
    pool.appendChild(poolLerp);

    poolGroup.appendChild(pool);

    // Create dancing flames across the pool
    const flameCount = 8;
    const flames: HTMLElement[] = [];
    for (let i = 0; i < flameCount; i++) {
      const flame = document.createElement("m-sphere");
      const angle = (i / flameCount) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 1.5;
      flame.setAttribute("x", (Math.cos(angle) * radius).toString());
      flame.setAttribute("z", (Math.sin(angle) * radius).toString());
      flame.setAttribute("y", (0.1 + Math.random() * 0.2).toString());
      flame.setAttribute("radius", (0.1 + Math.random() * 0.1).toString());
      flame.setAttribute("color", i % 2 === 0 ? "#ff4400" : "#ffaa00");
      flame.setAttribute("emissive", "0.9");
      flame.setAttribute("opacity", "0.8");
      flame.setAttribute("collide", "false");
      flame.setAttribute("cast-shadows", "false");

      const flameLerp = document.createElement("m-attr-lerp");
      flameLerp.setAttribute("attr", "x,y,z,sx,sy,sz,opacity");
      flameLerp.setAttribute("duration", "250");
      flameLerp.setAttribute("easing", "easeInOutSine");
      flame.appendChild(flameLerp);

      poolGroup.appendChild(flame);
      flames.push(flame);

      // Start animating this flame
      this.animatePoolFlame(flame, position, CONSTANTS.LIQUID_POOL_RADIUS);
    }

    this.sceneGroup.appendChild(poolGroup);

    setTimeout(() => {
      pool.setAttribute("radius", CONSTANTS.LIQUID_POOL_RADIUS.toString());
    }, 10);

    const poolData: LiquidPool = {
      element: poolGroup,
      position: { x: position.x, y: 0.02, z: position.z },
      radius: CONSTANTS.LIQUID_POOL_RADIUS,
      endTime: Date.now() + CONSTANTS.LIQUID_POOL_DURATION,
      tickInterval: 0,
    };

    poolData.tickInterval = window.setInterval(() => {
      this.applyPoolDamage(poolData);
    }, CONSTANTS.LIQUID_DOT_TICK_RATE);

    this.liquidPools.set(poolId, poolData);
  }

  private animatePoolFlame(flame: HTMLElement, poolCenter: Position, poolRadius: number): void {
    const animate = () => {
      if (!flame.parentNode) return;

      // Random position within pool radius
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * poolRadius * 0.9;
      const newX = Math.cos(angle) * radius;
      const newZ = Math.sin(angle) * radius;
      const newY = 0.1 + Math.random() * 0.3;

      const scaleVariation = 0.6 + Math.random() * 0.8;
      const opacityVariation = 0.5 + Math.random() * 0.5;

      flame.setAttribute("x", newX.toString());
      flame.setAttribute("z", newZ.toString());
      flame.setAttribute("y", newY.toString());
      flame.setAttribute("sx", scaleVariation.toString());
      flame.setAttribute("sy", (scaleVariation * 1.5).toString());
      flame.setAttribute("sz", scaleVariation.toString());
      flame.setAttribute("opacity", opacityVariation.toString());

      // Randomize color between orange and yellow
      if (Math.random() > 0.5) {
        flame.setAttribute("color", Math.random() > 0.5 ? "#ff4400" : "#ffaa00");
      }

      setTimeout(animate, 200 + Math.random() * 300);
    };
    setTimeout(animate, Math.random() * 300);
  }

  private createLiquidSpillEffect(position: Position): void {
    const spillGroup = document.createElement("m-group");
    spillGroup.setAttribute("x", position.x.toString());
    spillGroup.setAttribute("y", position.y.toString());
    spillGroup.setAttribute("z", position.z.toString());

    const dropletCount = 8;
    for (let i = 0; i < dropletCount; i++) {
      const droplet = document.createElement("m-sphere");
      droplet.setAttribute("radius", "0.1");
      droplet.setAttribute("color", i % 2 === 0 ? "#ff6600" : "#ff4400");
      droplet.setAttribute("emissive", "0.6");
      droplet.setAttribute("opacity", "0.8");
      droplet.setAttribute("collide", "false");
      droplet.setAttribute("cast-shadows", "false");

      const dropletLerp = document.createElement("m-attr-lerp");
      dropletLerp.setAttribute("attr", "x,y,z,opacity,sx,sy,sz");
      dropletLerp.setAttribute("duration", "600");
      dropletLerp.setAttribute("easing", "easeOutQuad");
      droplet.appendChild(dropletLerp);

      spillGroup.appendChild(droplet);

      setTimeout(() => {
        const angle = (i / dropletCount) * Math.PI * 2;
        const distance = 1 + Math.random() * 1.5;
        droplet.setAttribute("x", (Math.cos(angle) * distance).toString());
        droplet.setAttribute("y", (-0.3).toString());
        droplet.setAttribute("z", (Math.sin(angle) * distance).toString());
        droplet.setAttribute("opacity", "0");
        droplet.setAttribute("sx", "0.3");
        droplet.setAttribute("sy", "0.1");
        droplet.setAttribute("sz", "0.3");
      }, 10);
    }

    this.sceneGroup.appendChild(spillGroup);

    setTimeout(() => {
      if (spillGroup.parentNode) {
        spillGroup.parentNode.removeChild(spillGroup);
      }
    }, 700);
  }

  private applyPoolDamage(poolData: LiquidPool): void {
    const now = Date.now();

    // Damage enemies in pool
    const enemies = document.querySelectorAll('[id^="enemy-"]');
    enemies.forEach((enemyElement) => {
      const enemyX = parseFloat(enemyElement.getAttribute("x") || "0");
      const enemyZ = parseFloat(enemyElement.getAttribute("z") || "0");
      const enemyPos: Position = { x: enemyX, y: 0, z: enemyZ };
      const distance = distance2D(enemyPos, poolData.position);

      if (distance <= poolData.radius) {
        const damageEvent = new CustomEvent("enemy-damage", {
          detail: {
            damage: CONSTANTS.LIQUID_DOT_DAMAGE,
            hitPosition: enemyPos,
            isCrit: false,
            source: "liquid-burn",
          },
          bubbles: true,
        });
        enemyElement.dispatchEvent(damageEvent);

        // Apply burning status effect
        const enemyId = enemyElement.id;
        this.upsertBurningEntity(enemyId, enemyElement as HTMLElement, now);
      }
    });

    // Damage players in pool
    const players = document.querySelectorAll("[data-connection-id]");
    players.forEach((playerElement) => {
      const playerX = parseFloat(playerElement.getAttribute("x") || "0");
      const playerZ = parseFloat(playerElement.getAttribute("z") || "0");
      const playerPos: Position = { x: playerX, y: 0, z: playerZ };
      const distance = distance2D(playerPos, poolData.position);

      if (distance <= poolData.radius) {
        const connectionId = parseInt(
          (playerElement as HTMLElement).dataset.connectionId || "0",
          10,
        );
        const playerDamageEvent = new CustomEvent("player-damage", {
          detail: { connectionId, damage: CONSTANTS.LIQUID_DOT_DAMAGE },
          bubbles: true,
        });
        window.dispatchEvent(playerDamageEvent);

        // Apply burning status effect to player
        const playerId = `player-${connectionId}`;
        this.upsertBurningEntity(playerId, playerElement as HTMLElement, now);
      }
    });
  }

  private updateLiquidPools(): void {
    const now = Date.now();
    const poolsToRemove: number[] = [];

    this.liquidPools.forEach((poolData, poolId) => {
      if (now >= poolData.endTime) {
        poolsToRemove.push(poolId);
      }
    });

    poolsToRemove.forEach((poolId) => {
      const poolData = this.liquidPools.get(poolId);
      if (poolData) {
        window.clearInterval(poolData.tickInterval);

        // Fade out all children (pool cylinder and flames)
        const children = poolData.element.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement;
          child.setAttribute("opacity", "0");
          if (child.tagName === "M-CYLINDER") {
            child.setAttribute("radius", "0.1");
          } else {
            child.setAttribute("sx", "0.1");
            child.setAttribute("sy", "0.1");
            child.setAttribute("sz", "0.1");
          }
        }

        setTimeout(() => {
          if (poolData.element.parentNode) {
            poolData.element.parentNode.removeChild(poolData.element);
          }
        }, 800);

        this.liquidPools.delete(poolId);
      }
    });
  }

  private updateBurningEntities(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.burningEntities.forEach((burningData, entityId) => {
      if (!burningData.element.parentNode) {
        toRemove.push(entityId);
        return;
      }

      if (now >= burningData.endTime) {
        toRemove.push(entityId);
        return;
      }

      // Apply burn damage every tick
      if (now - burningData.lastTickTime >= CONSTANTS.LIQUID_DOT_TICK_RATE) {
        burningData.lastTickTime = now;

        if (entityId.startsWith("player-")) {
          const connectionId = parseInt(entityId.replace("player-", ""), 10);
          const playerDamageEvent = new CustomEvent("player-damage", {
            detail: { connectionId, damage: CONSTANTS.LIQUID_DOT_DAMAGE },
            bubbles: true,
          });
          window.dispatchEvent(playerDamageEvent);
        } else if (burningData.element.parentNode) {
          const damageEvent = new CustomEvent("enemy-damage", {
            detail: {
              damage: CONSTANTS.LIQUID_DOT_DAMAGE,
              hitPosition: {
                x: parseFloat(burningData.element.getAttribute("x") || "0"),
                y: parseFloat(burningData.element.getAttribute("y") || "0"),
                z: parseFloat(burningData.element.getAttribute("z") || "0"),
              },
              isCrit: false,
              source: "burning",
            },
            bubbles: true,
          });
          burningData.element.dispatchEvent(damageEvent);
        }
      }
    });

    toRemove.forEach((entityId) => {
      const burningData = this.burningEntities.get(entityId);
      if (burningData) {
        this.removeBurningEffect(burningData);
      }
      this.burningEntities.delete(entityId);
    });
  }

  // Called by Grenade.ts when an explosion occurs
  public damageBarrelsInRadius(explosionPos: Position, radius: number, baseDamage: number): void {
    this.barrels.forEach((barrelData) => {
      if (barrelData.isDestroyed) return;

      const distance = distance2D(barrelData.position, explosionPos);
      if (distance > radius) return;

      const normalizedDistance = clamp(distance / radius, 0, 1);
      const falloff = Math.exp(-CONSTANTS.GRENADE_DAMAGE_FALLOFF * normalizedDistance);
      const minFalloff = Math.exp(-CONSTANTS.GRENADE_DAMAGE_FALLOFF);
      const normalizedFalloff = (falloff - minFalloff) / (1 - minFalloff);
      const damage = Math.max(1, Math.floor(1 + (baseDamage - 1) * normalizedFalloff));

      const damageEvent = new CustomEvent("barrel-damage", {
        detail: { damage, source: "grenade" },
        bubbles: true,
      });
      barrelData.element.dispatchEvent(damageEvent);
    });
  }

  // Called by Weapon.ts to check for barrel hits
  public checkBulletHit(
    from: Position,
    direction: { x: number; y: number; z: number },
    maxDistance: number,
    minDistance: number = 0,
  ): { barrelElement: HTMLElement; hitDistance: number; hitPosition: Position } | null {
    let closestHit: {
      barrelElement: HTMLElement;
      hitDistance: number;
      hitPosition: Position;
    } | null = null;

    this.barrels.forEach((barrelData) => {
      if (barrelData.isDestroyed) return;

      const barrelX = barrelData.position.x;
      const barrelZ = barrelData.position.z;

      const toBarrel = { x: barrelX - from.x, z: barrelZ - from.z };
      const rayLength = direction.x * toBarrel.x + direction.z * toBarrel.z;

      if (rayLength <= minDistance || rayLength > maxDistance) return;

      const closestX = from.x + direction.x * rayLength;
      const closestZ = from.z + direction.z * rayLength;

      const distX = barrelX - closestX;
      const distZ = barrelZ - closestZ;
      const distanceToRay = Math.sqrt(distX * distX + distZ * distZ);

      if (distanceToRay <= CONSTANTS.BARREL_HIT_RADIUS) {
        if (!closestHit || rayLength < closestHit.hitDistance) {
          closestHit = {
            barrelElement: barrelData.element,
            hitDistance: rayLength,
            hitPosition: { x: closestX, y: from.y, z: closestZ },
          };
        }
      }
    });

    return closestHit as { barrelElement: HTMLElement; hitDistance: number; hitPosition: Position } | null;
  }

  public spawnBarrelsFromConstants(): void {
    CONSTANTS.BARREL_SPAWN_POSITIONS.forEach((spawn) => {
      this.spawnBarrel(spawn.x, spawn.z, spawn.type);
    });
  }

  public getBarrelCount(): number {
    return this.barrels.size;
  }

  public dispose(): void {
    if (this.updateInterval !== null) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.liquidPools.forEach((poolData) => {
      window.clearInterval(poolData.tickInterval);
      if (poolData.element.parentNode) {
        poolData.element.parentNode.removeChild(poolData.element);
      }
    });
    this.liquidPools.clear();

    this.barrels.forEach((barrelData) => {
      barrelData.element.removeEventListener("barrel-damage", barrelData.damageHandler);
      if (barrelData.element.parentNode) {
        barrelData.element.parentNode.removeChild(barrelData.element);
      }
    });
    this.barrels.clear();

    this.burningEntities.forEach((burningData) => {
      this.removeBurningEffect(burningData);
    });
    this.burningEntities.clear();
  }
}
