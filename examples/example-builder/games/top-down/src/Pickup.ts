import { CONSTANTS } from "./constants.js";
import { distance2D, Position } from "./helpers.js";

export interface PickupConfig {
  id: string;
  position: Position;
  regenTimeMs: number;
  pickupRadius: number;
  modelSrc?: string;
  color?: string;
  scale?: number;
  rotationSpeed?: number;
  bobSpeed?: number;
  bobHeight?: number;
  glowColor?: string;
  onPickup: (connectionId: number) => void;
}

interface ActivePlayer {
  connectionId: number;
  getPosition: () => Position;
  isDead: boolean;
  pickupRadiusMultiplier: number;
}

export class Pickup {
  private config: PickupConfig;
  private sceneGroup: HTMLElement;
  private container: HTMLElement | null = null;
  private visualElement: HTMLElement | null = null;
  private glowElement: HTMLElement | null = null;
  private particleElements: HTMLElement[] = [];
  private isAvailable: boolean = true;
  private bobInterval: number | null = null;
  private rotationInterval: number | null = null;
  private glowInterval: number | null = null;
  private checkInterval: number | null = null;
  private particleInterval: number | null = null;
  private bobPhase: number = 0;
  private currentRotation: number = 0;
  private glowDirection: number = 1;
  private currentGlowOpacity: number = 0.2;
  private getActivePlayers: () => ActivePlayer[];

  constructor(
    sceneGroup: HTMLElement,
    config: PickupConfig,
    getActivePlayers: () => ActivePlayer[],
  ) {
    this.sceneGroup = sceneGroup;
    this.config = {
      pickupRadius: 1.5,
      color: "#00ffff",
      scale: 1,
      rotationSpeed: 25, // Slower rotation (degrees per second)
      bobSpeed: 0.7, // Slower bobbing
      bobHeight: 0.25,
      glowColor: "#00ffff",
      ...config,
    };
    this.getActivePlayers = getActivePlayers;
    this.create();
    this.startAnimations();
    this.startPickupCheck();
  }

  private addLerp(element: HTMLElement, duration: number, attrs: string): void {
    const lerp = document.createElement("m-attr-lerp");
    lerp.setAttribute("attr", attrs);
    lerp.setAttribute("duration", duration.toString());
    element.appendChild(lerp);
  }

  private create(): void {
    // Container for the pickup with lerp for smooth bobbing
    this.container = document.createElement("m-group");
    this.container.setAttribute("id", `pickup-${this.config.id}`);
    this.container.setAttribute("x", this.config.position.x.toString());
    this.container.setAttribute("y", this.config.position.y.toString());
    this.container.setAttribute("z", this.config.position.z.toString());
    this.addLerp(this.container, 150, "y"); // Short lerp for smooth sine wave sampling

    // Glow effect (larger transparent sphere behind)
    this.glowElement = document.createElement("m-sphere");
    this.glowElement.setAttribute("radius", ((this.config.scale ?? 1) * 0.8).toString());
    this.glowElement.setAttribute("color", this.config.glowColor ?? "#00ffff");
    this.glowElement.setAttribute("opacity", "0.2");
    this.glowElement.setAttribute("collide", "false");
    this.glowElement.setAttribute("cast-shadows", "false");
    this.addLerp(this.glowElement, 1000, "opacity"); // Smooth glow pulse
    this.container.appendChild(this.glowElement);

    // Main visual element
    if (this.config.modelSrc) {
      this.visualElement = document.createElement("m-model");
      this.visualElement.setAttribute("src", this.config.modelSrc);
      this.visualElement.setAttribute("sx", (this.config.scale ?? 1).toString());
      this.visualElement.setAttribute("sy", (this.config.scale ?? 1).toString());
      this.visualElement.setAttribute("sz", (this.config.scale ?? 1).toString());
    } else {
      // Default to a cool geometric shape
      this.visualElement = document.createElement("m-cube");
      this.visualElement.setAttribute("width", ((this.config.scale ?? 1) * 0.5).toString());
      this.visualElement.setAttribute("height", ((this.config.scale ?? 1) * 0.5).toString());
      this.visualElement.setAttribute("depth", ((this.config.scale ?? 1) * 0.5).toString());
      this.visualElement.setAttribute("color", this.config.color ?? "#00ffff");
      this.visualElement.setAttribute("rx", "45");
      this.visualElement.setAttribute("rz", "45");
    }
    this.visualElement.setAttribute("collide", "false");
    this.visualElement.setAttribute("cast-shadows", "false");
    this.addLerp(this.visualElement, 300, "ry"); // Smooth rotation
    this.container.appendChild(this.visualElement);

    // Create floating particles around the pickup
    this.createParticles();

    this.sceneGroup.appendChild(this.container);
  }

  private createParticles(): void {
    if (!this.container) return;

    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("m-sphere");
      particle.setAttribute("radius", "0.05");
      particle.setAttribute("color", this.config.glowColor ?? "#00ffff");
      particle.setAttribute("opacity", "0.8");
      particle.setAttribute("collide", "false");
      particle.setAttribute("cast-shadows", "false");
      // Set initial positions in orbit
      const angle = (i * Math.PI * 2) / particleCount;
      const radius = 0.6;
      particle.setAttribute("x", (Math.cos(angle) * radius).toString());
      particle.setAttribute("y", "0");
      particle.setAttribute("z", (Math.sin(angle) * radius).toString());
      this.addLerp(particle, 600, "x,y,z"); // Smooth orbital movement
      this.container.appendChild(particle);
      this.particleElements.push(particle);
    }
  }

  private startAnimations(): void {
    // Bob animation - use sine wave for smooth up/down motion with natural easing
    const bobUpdateMs = 100; // Update frequently for smooth sine sampling
    const bobSpeed = this.config.bobSpeed ?? 0.7; // Full cycles per second
    const phaseIncrement = (bobUpdateMs / 1000) * bobSpeed * Math.PI * 2;
    
    this.bobInterval = window.setInterval(() => {
      if (!this.isAvailable || !this.container) return;

      this.bobPhase += phaseIncrement;
      if (this.bobPhase > Math.PI * 2) this.bobPhase -= Math.PI * 2;
      
      // Sine wave creates natural easing at peaks
      const bobOffset = Math.sin(this.bobPhase) * (this.config.bobHeight ?? 0.25);
      const targetY = this.config.position.y + bobOffset;
      this.container.setAttribute("y", targetY.toString());
    }, bobUpdateMs);

    // Rotation animation - increment rotation target, lerp handles smooth spin
    const rotationIntervalMs = 250;
    const rotationPerInterval = (this.config.rotationSpeed ?? 25) * (rotationIntervalMs / 1000);
    this.rotationInterval = window.setInterval(() => {
      if (!this.isAvailable || !this.visualElement) return;

      this.currentRotation += rotationPerInterval;
      if (this.currentRotation >= 360) this.currentRotation -= 360;
      this.visualElement.setAttribute("ry", this.currentRotation.toString());
    }, rotationIntervalMs);

    // Glow pulse - oscillate opacity, lerp handles smooth transition
    this.glowInterval = window.setInterval(() => {
      if (!this.isAvailable || !this.glowElement) return;

      this.currentGlowOpacity += this.glowDirection * 0.05;
      if (this.currentGlowOpacity >= 0.35) {
        this.currentGlowOpacity = 0.35;
        this.glowDirection = -1;
      } else if (this.currentGlowOpacity <= 0.15) {
        this.currentGlowOpacity = 0.15;
        this.glowDirection = 1;
      }
      this.glowElement.setAttribute("opacity", this.currentGlowOpacity.toString());
    }, 800);

    // Particle orbit - update target positions, lerp handles smooth movement
    let particleAngleOffset = 0;
    this.particleInterval = window.setInterval(() => {
      if (!this.isAvailable) return;

      particleAngleOffset += 0.15; // radians per update (slower)
      this.particleElements.forEach((particle, index) => {
        const angle = particleAngleOffset + (index * Math.PI * 2) / this.particleElements.length;
        const radius = 0.6;
        const heightOffset = Math.sin(particleAngleOffset + index) * 0.15;
        particle.setAttribute("x", (Math.cos(angle) * radius).toString());
        particle.setAttribute("y", heightOffset.toString());
        particle.setAttribute("z", (Math.sin(angle) * radius).toString());
      });
    }, 400);
  }

  private startPickupCheck(): void {
    this.checkInterval = window.setInterval(() => {
      if (!this.isAvailable) return;

      const players = this.getActivePlayers();
      for (const player of players) {
        if (player.isDead) continue;

        const playerPos = player.getPosition();
        const distance = distance2D(playerPos, this.config.position);
        const pickupRadius = this.config.pickupRadius * player.pickupRadiusMultiplier;

        if (distance <= pickupRadius) {
          this.collect(player.connectionId);
          break;
        }
      }
    }, 50); // Check frequently for responsive pickup
  }

  private collect(connectionId: number): void {
    if (!this.isAvailable) return;

    this.isAvailable = false;
    console.log(`[Pickup] ${this.config.id} collected by player ${connectionId}`);

    // Play collection effect
    this.playCollectEffect();

    // Hide the pickup
    this.setVisibility(false);

    // Trigger the callback
    this.config.onPickup(connectionId);

    // Schedule respawn
    window.setTimeout(() => {
      this.respawn();
    }, this.config.regenTimeMs);
  }

  private playCollectEffect(): void {
    if (!this.container) return;

    // Create burst particles with lerp for smooth outward movement
    const burstCount = 12;
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const particle = document.createElement("m-sphere");
      particle.setAttribute("x", this.config.position.x.toString());
      particle.setAttribute("y", (this.config.position.y + 0.5).toString());
      particle.setAttribute("z", this.config.position.z.toString());
      particle.setAttribute("radius", "0.1");
      particle.setAttribute("color", this.config.glowColor ?? "#00ffff");
      particle.setAttribute("opacity", "1");
      particle.setAttribute("collide", "false");
      particle.setAttribute("cast-shadows", "false");
      this.addLerp(particle, 800, "x,y,z,opacity,radius");
      this.sceneGroup.appendChild(particle);

      // Animate particle outward using lerp - set final target position
      const distance = 2.0;
      const targetX = this.config.position.x + Math.cos(angle) * distance;
      const targetY = this.config.position.y + 1.2 + Math.random() * 0.3;
      const targetZ = this.config.position.z + Math.sin(angle) * distance;

      // Small delay then set target for lerp animation
      setTimeout(() => {
        particle.setAttribute("x", targetX.toString());
        particle.setAttribute("y", targetY.toString());
        particle.setAttribute("z", targetZ.toString());
        particle.setAttribute("opacity", "0");
        particle.setAttribute("radius", "0.02");
      }, 16);

      // Remove after animation completes
      setTimeout(() => {
        if (particle.parentNode) {
          particle.remove();
        }
      }, 900);
    }

    // Create expanding ring effect with lerp
    const ring = document.createElement("m-cylinder");
    ring.setAttribute("x", this.config.position.x.toString());
    ring.setAttribute("y", (this.config.position.y + 0.1).toString());
    ring.setAttribute("z", this.config.position.z.toString());
    ring.setAttribute("radius", "0.3");
    ring.setAttribute("height", "0.05");
    ring.setAttribute("color", this.config.glowColor ?? "#00ffff");
    ring.setAttribute("opacity", "0.9");
    ring.setAttribute("collide", "false");
    ring.setAttribute("cast-shadows", "false");
    this.addLerp(ring, 700, "radius,opacity");
    this.sceneGroup.appendChild(ring);

    // Expand ring using lerp
    setTimeout(() => {
      ring.setAttribute("radius", "3.0");
      ring.setAttribute("opacity", "0");
    }, 16);

    setTimeout(() => {
      if (ring.parentNode) {
        ring.remove();
      }
    }, 800);
  }

  private respawn(): void {
    console.log(`[Pickup] ${this.config.id} respawning`);
    this.isAvailable = true;
    this.playRespawnEffect();
    this.setVisibility(true);
  }

  private playRespawnEffect(): void {
    if (!this.container) return;

    // Create spiral particles converging inward with lerp
    const spiralCount = 8;
    for (let i = 0; i < spiralCount; i++) {
      const particle = document.createElement("m-sphere");
      const startAngle = (i / spiralCount) * Math.PI * 2;
      const startRadius = 3;
      particle.setAttribute("x", (this.config.position.x + Math.cos(startAngle) * startRadius).toString());
      particle.setAttribute("y", (this.config.position.y - 0.5).toString());
      particle.setAttribute("z", (this.config.position.z + Math.sin(startAngle) * startRadius).toString());
      particle.setAttribute("radius", "0.12");
      particle.setAttribute("color", this.config.glowColor ?? "#00ffff");
      particle.setAttribute("opacity", "0.9");
      particle.setAttribute("collide", "false");
      particle.setAttribute("cast-shadows", "false");
      this.addLerp(particle, 800, "x,y,z,opacity,radius");
      this.sceneGroup.appendChild(particle);

      // Stagger the convergence for spiral effect
      setTimeout(() => {
        particle.setAttribute("x", this.config.position.x.toString());
        particle.setAttribute("y", this.config.position.y.toString());
        particle.setAttribute("z", this.config.position.z.toString());
        particle.setAttribute("opacity", "0");
        particle.setAttribute("radius", "0.02");
      }, i * 80);

      // Remove after animation
      setTimeout(() => {
        if (particle.parentNode) {
          particle.remove();
        }
      }, 1000 + i * 80);
    }

    // Flash effect at center
    const flash = document.createElement("m-sphere");
    flash.setAttribute("x", this.config.position.x.toString());
    flash.setAttribute("y", this.config.position.y.toString());
    flash.setAttribute("z", this.config.position.z.toString());
    flash.setAttribute("radius", "0.1");
    flash.setAttribute("color", "#ffffff");
    flash.setAttribute("opacity", "0");
    flash.setAttribute("collide", "false");
    flash.setAttribute("cast-shadows", "false");
    this.addLerp(flash, 300, "radius,opacity");
    this.sceneGroup.appendChild(flash);

    // Flash in then out
    setTimeout(() => {
      flash.setAttribute("opacity", "1");
      flash.setAttribute("radius", "0.8");
    }, 500);

    setTimeout(() => {
      flash.setAttribute("opacity", "0");
      flash.setAttribute("radius", "1.2");
    }, 800);

    setTimeout(() => {
      if (flash.parentNode) {
        flash.remove();
      }
    }, 1200);
  }

  private setVisibility(visible: boolean): void {
    if (this.container) {
      this.container.setAttribute("visible", visible.toString());
    }
  }

  public dispose(): void {
    if (this.bobInterval !== null) {
      window.clearInterval(this.bobInterval);
    }
    if (this.rotationInterval !== null) {
      window.clearInterval(this.rotationInterval);
    }
    if (this.glowInterval !== null) {
      window.clearInterval(this.glowInterval);
    }
    if (this.checkInterval !== null) {
      window.clearInterval(this.checkInterval);
    }
    if (this.particleInterval !== null) {
      window.clearInterval(this.particleInterval);
    }
    if (this.container && this.container.parentNode) {
      this.container.remove();
    }
  }
}

// =============================================================================
// Rapid Fire Powerup - A specific pickup that grants 10x fire rate for 10s
// =============================================================================

export interface RapidFirePickupConfig {
  id: string;
  position: Position;
  regenTimeMs?: number;
  duration?: number;
  fireRateMultiplier?: number;
}

export class RapidFirePickup {
  private pickup: Pickup;
  private duration: number;
  private fireRateMultiplier: number;
  private onActivate: (connectionId: number, duration: number, multiplier: number) => void;

  constructor(
    sceneGroup: HTMLElement,
    config: RapidFirePickupConfig,
    getActivePlayers: () => ActivePlayer[],
    onActivate: (connectionId: number, duration: number, multiplier: number) => void,
  ) {
    this.duration = config.duration ?? 10000; // 10 seconds default
    this.fireRateMultiplier = config.fireRateMultiplier ?? 10;
    this.onActivate = onActivate;

    this.pickup = new Pickup(sceneGroup, {
      id: config.id,
      position: config.position,
      regenTimeMs: config.regenTimeMs ?? 30000, // 30 seconds default
      pickupRadius: 1.5,
      color: "#ff4400",
      glowColor: "#ff6622",
      scale: 0.8,
      rotationSpeed: 35, // Slower rotation
      bobSpeed: 1.0, // Slower bobbing
      bobHeight: 0.3,
      onPickup: (connectionId: number) => {
        this.activate(connectionId);
      },
    }, getActivePlayers);
  }

  private activate(connectionId: number): void {
    console.log(`[RapidFirePickup] Activating for player ${connectionId} - ${this.fireRateMultiplier}x fire rate for ${this.duration}ms`);
    this.onActivate(connectionId, this.duration, this.fireRateMultiplier);
  }

  public dispose(): void {
    this.pickup.dispose();
  }
}
