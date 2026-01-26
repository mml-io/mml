function registerFont(
  family: string,
  src: string,
  options?: { filenameHint?: string; default?: boolean },
): void {
  // Check if font is already registered
  const existing = document.querySelector(`m-font[family="${family}"]`);
  if (existing) return;

  const fontEl = document.createElement("m-font");
  fontEl.setAttribute("family", family);
  fontEl.setAttribute("src", src);
  if (options?.filenameHint) fontEl.setAttribute("filename", options.filenameHint);
  if (options?.default) fontEl.setAttribute("default", "true");
  document.body.appendChild(fontEl);
}

export class PlayerHUD {
  private hudOverlay: HTMLElement;
  private damageOverlay: HTMLElement;
  private healthBarFill: HTMLElement;
  private healthText: HTMLElement;
  private scoreText: HTMLElement;
  private roundText: HTMLElement;
  private notificationArea: HTMLElement;
  private connectionId: number;
  private maxHealth: number;
  private currentHealth: number;
  private currentScore: number;

  constructor(connectionId: number, maxHealth: number) {
    this.connectionId = connectionId;
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
    this.currentScore = 0;
    this.hudOverlay = document.createElement("m-overlay");
    this.damageOverlay = document.createElement("m-overlay");
    this.create();
  }

  private create(): void {
    registerFont("Escom-Bold", "/assets/fonts/Escom-Bold Regular.ttf", {
      filenameHint: "Escom-Bold Regular.ttf",
      default: true,
    });

    // --- Damage Overlay (Full Screen) ---
    this.damageOverlay.setAttribute("id", `damage-overlay-${this.connectionId}`);
    this.damageOverlay.setAttribute("anchor", "center");
    this.damageOverlay.setAttribute("offset-x", "0");
    this.damageOverlay.setAttribute("offset-y", "0");
    this.damageOverlay.setAttribute("width", "100%");
    this.damageOverlay.setAttribute("height", "100%");
    this.damageOverlay.setAttribute("visible-to", this.connectionId.toString());

    const damageVignette = document.createElement("div");
    Object.assign(damageVignette.style, {
      width: "100%",
      height: "100%",
      background: "radial-gradient(circle, transparent 60%, rgba(138, 3, 3, 0.8) 100%)",
      opacity: "0",
      transition: "opacity 0.2s",
      pointerEvents: "none",
    });
    this.damageOverlay.appendChild(damageVignette);
    this.damageOverlay.dataset.vignette = "true";
    document.body.appendChild(this.damageOverlay);

    // --- Main HUD ---
    this.hudOverlay.setAttribute("id", `player-hud-${this.connectionId}`);
    this.hudOverlay.setAttribute("anchor", "bottom-left");
    this.hudOverlay.setAttribute("offset-x", "20");
    this.hudOverlay.setAttribute("offset-y", "-20");
    this.hudOverlay.setAttribute("visible-to", this.connectionId.toString());

    // Container with Zombies/L4D vibe - fixed % width
    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: "10px",
      width: "20vw",
      padding: "15px",
      background: "linear-gradient(to right, rgba(0,0,0,0.8), rgba(20,0,0,0.6))",
      borderLeft: "4px solid #8a0303",
      borderBottom: "1px solid rgba(138, 3, 3, 0.3)",
      fontFamily: "'Escom-Bold', sans-serif",
      color: "#e0e0e0",
      textShadow: "1px 1px 2px black",
      position: "relative",
      boxSizing: "border-box",
    });

    const bottomRow = document.createElement("div");
    Object.assign(bottomRow.style, {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "16px",
      width: "100%",
    });

    // Health Section
    const healthSection = document.createElement("div");
    Object.assign(healthSection.style, {
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      flex: "1",
      marginRight: "20px",
    });

    // Health Header (Label + Value)
    const healthHeader = document.createElement("div");
    Object.assign(healthHeader.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
    });

    const healthLabel = document.createElement("span");
    healthLabel.textContent = "VITALS";
    Object.assign(healthLabel.style, {
      fontSize: "14px",
      color: "#8a8a8a",
      letterSpacing: "1px",
    });
    healthHeader.appendChild(healthLabel);

    this.healthText = document.createElement("span");
    this.healthText.textContent = `${this.maxHealth}`;
    Object.assign(this.healthText.style, {
      fontSize: "20px",
      color: "#ffffff",
      fontWeight: "bold",
    });
    healthHeader.appendChild(this.healthText);
    healthSection.appendChild(healthHeader);

    // Health Bar Container
    const barContainer = document.createElement("div");
    Object.assign(barContainer.style, {
      height: "12px",
      background: "rgba(0,0,0,0.8)",
      border: "1px solid #444",
      position: "relative",
      transform: "skewX(-20deg)", // Tactical look
      overflow: "hidden",
      width: "100%",
      minWidth: "0",
      boxSizing: "border-box",
    });

    // Health Bar Fill - starts green at full health
    this.healthBarFill = document.createElement("div");
    Object.assign(this.healthBarFill.style, {
      height: "100%",
      width: "100%",
      backgroundColor: "#33cc33",
      backgroundImage: "linear-gradient(90deg, #006600, #33cc33)",
      transition: "width 0.3s ease-out, background 0.3s",
      boxShadow: "0 0 5px rgba(51, 204, 51, 0.5)",
      display: "block",
    });
    barContainer.appendChild(this.healthBarFill);
    healthSection.appendChild(barContainer);

    bottomRow.appendChild(healthSection);

    // Right Side: Self-destruct
    const rightSection = document.createElement("div");
    Object.assign(rightSection.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "10px",
    });

    const scoreRow = document.createElement("div");
    Object.assign(scoreRow.style, {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "16px",
      width: "100%",
    });

    // Round Counter
    const roundContainer = document.createElement("div");
    Object.assign(roundContainer.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
    });

    const roundLabel = document.createElement("div");
    roundLabel.textContent = "ROUND";
    Object.assign(roundLabel.style, {
      fontSize: "10px",
      color: "#ff6666", // Lighter label
      fontWeight: "bold",
    });
    roundContainer.appendChild(roundLabel);

    this.roundText = document.createElement("div");
    this.roundText.textContent = "1";
    Object.assign(this.roundText.style, {
      fontSize: "28px",
      color: "#ff3333", // Lighter red for visibility
      fontWeight: "bold",
      lineHeight: "1",
      textShadow: "0 0 5px rgba(255, 0, 0, 0.4)", // Subtle glow for readability
    });
    roundContainer.appendChild(this.roundText);
    scoreRow.appendChild(roundContainer);

    // Score Section
    const scoreContainer = document.createElement("div");
    Object.assign(scoreContainer.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
    });

    const scoreLabel = document.createElement("div");
    scoreLabel.textContent = "POINTS";
    Object.assign(scoreLabel.style, {
      fontSize: "10px",
      color: "#ffd700",
      fontWeight: "bold",
      textTransform: "uppercase",
      letterSpacing: "1px",
    });
    scoreContainer.appendChild(scoreLabel);

    this.scoreText = document.createElement("div");
    this.scoreText.textContent = "0";
    Object.assign(this.scoreText.style, {
      fontSize: "28px",
      color: "#ffd700", // Gold
      fontWeight: "bold",
      textShadow: "0 0 10px rgba(255, 215, 0, 0.3)",
      lineHeight: "1",
    });
    scoreContainer.appendChild(this.scoreText);
    scoreRow.appendChild(scoreContainer);

    container.appendChild(scoreRow);

    const selfDestructButton = document.createElement("button");
    selfDestructButton.textContent = "SELF-DESTRUCT";
    Object.assign(selfDestructButton.style, {
      marginTop: "6px",
      padding: "6px 10px",
      background: "rgba(138, 3, 3, 0.9)",
      border: "1px solid #ff3333",
      borderRadius: "2px",
      color: "#ffffff",
      fontSize: "12px",
      letterSpacing: "1px",
      fontFamily: "'Escom-Bold', sans-serif",
      cursor: "pointer",
      textTransform: "uppercase",
      boxShadow: "0 0 6px rgba(255, 0, 0, 0.4)",
    });
    selfDestructButton.addEventListener("click", (event: MouseEvent) => {
      event.stopPropagation();
      const damage = this.maxHealth + 1;
      window.dispatchEvent(
        new CustomEvent("player-damage", {
          detail: { connectionId: this.connectionId, damage },
        }),
      );
    });
    rightSection.appendChild(selfDestructButton);

    bottomRow.appendChild(rightSection);

    container.appendChild(bottomRow);

    // Notification Area (Top of HUD)
    this.notificationArea = document.createElement("div");
    Object.assign(this.notificationArea.style, {
      position: "absolute",
      bottom: "100%",
      left: "0",
      width: "100%",
      marginBottom: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      pointerEvents: "none",
    });
    container.appendChild(this.notificationArea);

    this.hudOverlay.appendChild(container);
    document.body.appendChild(this.hudOverlay);

    // Initialize bar state so it doesn't start black
    this.updateHealth(this.currentHealth);
  }

  public updateHealth(health: number): void {
    const prevHealth = this.currentHealth;
    this.currentHealth = Math.max(0, Math.floor(health));

    if (this.healthText) {
      this.healthText.textContent = `${this.currentHealth}`;
    }

    if (this.healthBarFill) {
      const healthPercent = this.currentHealth / this.maxHealth;
      this.healthBarFill.style.width = `${healthPercent * 100}%`;

      if (healthPercent > 0.6) {
        this.healthBarFill.style.backgroundColor = "#33cc33";
        this.healthBarFill.style.backgroundImage = "linear-gradient(90deg, #006600, #33cc33)";
        this.healthBarFill.style.boxShadow = "0 0 5px rgba(51, 204, 51, 0.5)";
      } else if (healthPercent > 0.3) {
        this.healthBarFill.style.backgroundColor = "#ffcc00";
        this.healthBarFill.style.backgroundImage = "linear-gradient(90deg, #996600, #ffcc00)";
        this.healthBarFill.style.boxShadow = "0 0 5px rgba(255, 204, 0, 0.5)";
      } else {
        this.healthBarFill.style.backgroundColor = "#ff0000";
        this.healthBarFill.style.backgroundImage = "linear-gradient(90deg, #660000, #ff0000)";
        this.healthBarFill.style.boxShadow = "0 0 10px rgba(255, 0, 0, 0.8)";
      }
    }

    // Trigger damage effect if health decreased
    if (this.currentHealth < prevHealth) {
      this.triggerDamageEffect();
    }
  }

  public setMaxHealth(newMaxHealth: number): void {
    this.maxHealth = newMaxHealth;
    // Re-render the health bar with new max
    this.updateHealth(this.currentHealth);
  }

  private triggerDamageEffect(): void {
    const vignette = this.damageOverlay.querySelector("div");
    if (vignette) {
      vignette.style.opacity = "1";
      setTimeout(() => {
        vignette.style.opacity = "0";
      }, 300);
    }
  }

  public updateScore(score: number): void {
    this.currentScore = score;
    if (this.scoreText) {
      this.scoreText.textContent = score.toString();
      this.scoreText.style.transform = "scale(1.2)";
      setTimeout(() => {
        this.scoreText.style.transform = "scale(1)";
      }, 100);
    }
  }

  public updateRound(round: number): void {
    if (this.roundText) {
      this.roundText.textContent = round.toString();
      this.showNotification(`ROUND ${round}`);
    }
  }

  public showNotification(text: string): void {
    const notif = document.createElement("div");
    notif.textContent = text;
    Object.assign(notif.style, {
      fontSize: "18px",
      color: "#ff3300",
      fontWeight: "bold",
      textShadow: "0 0 5px black",
      opacity: "0",
      transform: "translateY(20px)",
      transition: "all 0.5s ease-out",
    });

    this.notificationArea.appendChild(notif);

    // Animate in
    setTimeout(() => {
      notif.style.opacity = "1";
      notif.style.transform = "translateY(0)";
    }, 50);

    // Animate out
    setTimeout(() => {
      notif.style.opacity = "0";
      notif.style.transform = "translateY(-20px)";
      setTimeout(() => notif.remove(), 500);
    }, 3000);
  }

  public show(): void {
    this.hudOverlay.setAttribute("visible-to", this.connectionId.toString());
    this.damageOverlay.setAttribute("visible-to", this.connectionId.toString());
  }

  public hide(): void {
    this.hudOverlay.setAttribute("visible-to", "-1");
    this.damageOverlay.setAttribute("visible-to", "-1");
  }

  public dispose(): void {
    if (this.hudOverlay && this.hudOverlay.parentNode) {
      this.hudOverlay.remove();
    }
    if (this.damageOverlay && this.damageOverlay.parentNode) {
      this.damageOverlay.remove();
    }
  }
}

function ensureDeathStyles() {
  if (document.getElementById("death-screen-styles")) return;
  const style = document.createElement("style");
  style.id = "death-screen-styles";
  style.textContent = `
    @keyframes death-zoom-in {
      0% { transform: scale(3); opacity: 0; filter: blur(10px); }
      100% { transform: scale(1); opacity: 1; filter: blur(0); }
    }
    @keyframes death-bg-pulse {
      0% { box-shadow: 0 0 50px rgba(138, 3, 3, 0.5) inset; border-color: #8a0303; }
      50% { box-shadow: 0 0 80px rgba(255, 0, 0, 0.3) inset; border-color: #ff0000; }
      100% { box-shadow: 0 0 50px rgba(138, 3, 3, 0.5) inset; border-color: #8a0303; }
    }
    @keyframes text-glitch {
      0% { transform: translate(0); }
      20% { transform: translate(-2px, 2px); }
      40% { transform: translate(-2px, -2px); }
      60% { transform: translate(2px, 2px); }
      80% { transform: translate(2px, -2px); }
      100% { transform: translate(0); }
    }
  `;
  document.head.appendChild(style);
}

export class DeathScreen {
  private deathOverlay: HTMLElement;
  private container: HTMLElement;
  private title: HTMLElement;
  private statsRow: HTMLElement;
  private respawnTimerText: HTMLElement;
  private killCountText: HTMLElement;
  private connectionId: number;

  constructor(connectionId: number) {
    this.connectionId = connectionId;
    this.deathOverlay = document.createElement("m-overlay");
    ensureDeathStyles();
    this.create();
  }

  private create(): void {
    this.deathOverlay.setAttribute("id", "death-screen-" + this.connectionId);
    this.deathOverlay.setAttribute("anchor", "center");
    this.deathOverlay.setAttribute("offset-x", "0");
    this.deathOverlay.setAttribute("offset-y", "0");
    this.deathOverlay.setAttribute("visible-to", "-1");

    // Container
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "600px",
      padding: "60px 40px",
      background: "rgba(10, 0, 0, 0.95)",
      border: "2px solid #8a0303",
      boxShadow: "0 0 50px rgba(138, 3, 3, 0.5) inset, 0 0 100px rgba(0,0,0,0.8)",
      borderRadius: "8px",
      fontFamily: "'Escom-Bold', sans-serif",
      color: "#ffffff",
      opacity: "0",
      transform: "scale(0.92)",
      transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
    });

    // "YOU DIED" Title
    this.title = document.createElement("div");
    this.title.textContent = "YOU DIED";
    Object.assign(this.title.style, {
      fontSize: "82px",
      color: "#ff0000",
      marginBottom: "30px",
      textShadow: "0 0 30px rgba(255, 0, 0, 0.8)",
      letterSpacing: "8px",
      textAlign: "center",
      lineHeight: "1",
    });
    this.container.appendChild(this.title);

    // Separator
    const line = document.createElement("div");
    Object.assign(line.style, {
      width: "100%",
      height: "2px",
      background: "linear-gradient(90deg, transparent, #ff0000, transparent)",
      marginBottom: "40px",
      opacity: "0.5",
    });
    this.container.appendChild(line);

    // Stats Row
    this.statsRow = document.createElement("div");
    Object.assign(this.statsRow.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginBottom: "40px",
      opacity: "0",
      transform: "translateY(20px)",
      transition: "all 0.5s ease-out",
    });

    const killLabel = document.createElement("div");
    killLabel.textContent = "ZOMBIES ELIMINATED";
    Object.assign(killLabel.style, {
      fontSize: "16px",
      color: "#aaa",
      letterSpacing: "4px",
      marginBottom: "10px",
      textTransform: "uppercase",
    });
    this.statsRow.appendChild(killLabel);

    this.killCountText = document.createElement("div");
    this.killCountText.textContent = "0";
    Object.assign(this.killCountText.style, {
      fontSize: "64px",
      color: "#ffd700",
      textShadow: "0 0 20px rgba(255, 215, 0, 0.5)",
      fontWeight: "bold",
    });
    this.statsRow.appendChild(this.killCountText);

    this.container.appendChild(this.statsRow);

    // Respawn Timer
    this.respawnTimerText = document.createElement("div");
    this.respawnTimerText.textContent = "RESPAWNING IN 3...";
    Object.assign(this.respawnTimerText.style, {
      fontSize: "20px",
      color: "#8a0303",
      marginTop: "20px",
      fontWeight: "bold",
      letterSpacing: "2px",
      opacity: "0",
      transition: "opacity 1s",
    });
    this.container.appendChild(this.respawnTimerText);

    this.deathOverlay.appendChild(this.container);
    document.body.appendChild(this.deathOverlay);
  }

  public show(killCount: number): void {
    // Reset contents
    this.killCountText.textContent = "0";
    this.respawnTimerText.style.opacity = "0";
    this.statsRow.style.opacity = "0";
    this.statsRow.style.transform = "translateY(20px)";
    this.container.style.opacity = "0";
    this.container.style.transform = "scale(0.92)";

    // Trigger Animations
    this.title.style.animation = "none";
    this.container.style.animation = "none";

    // Force reflow
    void this.title.offsetWidth;

    this.title.style.animation = "death-zoom-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards";
    this.container.style.animation = "death-bg-pulse 3s infinite";

    // Show Overlay
    this.deathOverlay.setAttribute("visible-to", this.connectionId.toString());
    setTimeout(() => {
      this.container.style.opacity = "1";
      this.container.style.transform = "scale(1)";
    }, 0);

    // Animate Stats In
    setTimeout(() => {
      this.statsRow.style.opacity = "1";
      this.statsRow.style.transform = "translateY(0)";

      // Count up animation
      const duration = 1000;
      const start = 0;
      const end = killCount;
      const startTime = Date.now();
      const frameInterval = 16; // ~60fps

      const animateCount = () => {
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out

        const current = Math.floor(start + (end - start) * easeOut);
        this.killCountText.textContent = current.toString();

        if (progress < 1) {
          setTimeout(animateCount, frameInterval);
        }
      };

      setTimeout(animateCount, frameInterval);
    }, 400);

    // Show Respawn Timer
    setTimeout(() => {
      this.respawnTimerText.style.opacity = "1";
    }, 1000);
  }

  public updateTimer(secondsRemaining: number): void {
    if (this.respawnTimerText) {
      this.respawnTimerText.textContent = `RESPAWNING IN ${secondsRemaining}...`;
    }
  }

  public hide(): void {
    this.deathOverlay.setAttribute("visible-to", "-1");
  }

  public dispose(): void {
    if (this.deathOverlay && this.deathOverlay.parentNode) {
      this.deathOverlay.remove();
    }
  }
}
