export class PlayerHUD {
  private hudOverlay: HTMLElement;
  private healthBarFill: SVGRectElement;
  private healthText: SVGTextElement;
  private scoreText: SVGTextElement;
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
    this.create();
  }

  private create(): void {
    this.hudOverlay.setAttribute("id", `player-hud-${this.connectionId}`);
    this.hudOverlay.setAttribute("anchor", "bottom-left");
    this.hudOverlay.setAttribute("offset-x", "20");
    this.hudOverlay.setAttribute("offset-y", "-20");
    this.hudOverlay.setAttribute("visible-to", this.connectionId.toString());

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "280");
    svg.setAttribute("height", "100");

    // Background panel
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", "280");
    background.setAttribute("height", "100");
    background.setAttribute("fill", "rgba(0, 0, 0, 0.7)");
    background.setAttribute("rx", "8");
    svg.appendChild(background);

    // Health label
    const healthLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    healthLabel.setAttribute("x", "15");
    healthLabel.setAttribute("y", "30");
    healthLabel.setAttribute("fill", "#ffffff");
    healthLabel.setAttribute("font-family", "monospace");
    healthLabel.setAttribute("font-size", "14");
    healthLabel.setAttribute("font-weight", "bold");
    healthLabel.textContent = "HEALTH";
    svg.appendChild(healthLabel);

    // Health bar background
    const healthBarBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    healthBarBg.setAttribute("x", "15");
    healthBarBg.setAttribute("y", "38");
    healthBarBg.setAttribute("width", "200");
    healthBarBg.setAttribute("height", "16");
    healthBarBg.setAttribute("fill", "#333333");
    healthBarBg.setAttribute("stroke", "#555555");
    healthBarBg.setAttribute("stroke-width", "1");
    healthBarBg.setAttribute("rx", "3");
    svg.appendChild(healthBarBg);

    // Health bar fill
    this.healthBarFill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    this.healthBarFill.setAttribute("x", "15");
    this.healthBarFill.setAttribute("y", "38");
    this.healthBarFill.setAttribute("width", "200");
    this.healthBarFill.setAttribute("height", "16");
    this.healthBarFill.setAttribute("fill", "#00ff00");
    this.healthBarFill.setAttribute("rx", "3");
    svg.appendChild(this.healthBarFill);

    // Health text (numeric value)
    this.healthText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    this.healthText.setAttribute("x", "225");
    this.healthText.setAttribute("y", "51");
    this.healthText.setAttribute("fill", "#ffffff");
    this.healthText.setAttribute("font-family", "monospace");
    this.healthText.setAttribute("font-size", "14");
    this.healthText.setAttribute("font-weight", "bold");
    this.healthText.textContent = `${this.maxHealth}`;
    svg.appendChild(this.healthText);

    // Score label and value
    const scoreLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    scoreLabel.setAttribute("x", "15");
    scoreLabel.setAttribute("y", "80");
    scoreLabel.setAttribute("fill", "#ffffff");
    scoreLabel.setAttribute("font-family", "monospace");
    scoreLabel.setAttribute("font-size", "14");
    scoreLabel.setAttribute("font-weight", "bold");
    scoreLabel.textContent = "KILLS:";
    svg.appendChild(scoreLabel);

    // Score value
    this.scoreText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    this.scoreText.setAttribute("x", "75");
    this.scoreText.setAttribute("y", "80");
    this.scoreText.setAttribute("fill", "#ffcc00");
    this.scoreText.setAttribute("font-family", "monospace");
    this.scoreText.setAttribute("font-size", "18");
    this.scoreText.setAttribute("font-weight", "bold");
    this.scoreText.textContent = "0";
    svg.appendChild(this.scoreText);

    this.hudOverlay.appendChild(svg);
    document.body.appendChild(this.hudOverlay);
  }

  public updateHealth(health: number): void {
    this.currentHealth = Math.max(0, health);

    if (this.healthText) {
      this.healthText.textContent = `${this.currentHealth}`;
    }

    if (this.healthBarFill) {
      const healthPercent = this.currentHealth / this.maxHealth;
      const barWidth = 200 * healthPercent;
      this.healthBarFill.setAttribute("width", barWidth.toString());

      // Change color based on health percentage
      if (healthPercent > 0.6) {
        this.healthBarFill.setAttribute("fill", "#00ff00"); // Green
      } else if (healthPercent > 0.3) {
        this.healthBarFill.setAttribute("fill", "#ffcc00"); // Yellow
      } else {
        this.healthBarFill.setAttribute("fill", "#ff3300"); // Red
      }
    }
  }

  public updateScore(score: number): void {
    this.currentScore = score;
    if (this.scoreText) {
      this.scoreText.textContent = score.toString();
    }
  }

  public show(): void {
    this.hudOverlay.setAttribute("visible-to", this.connectionId.toString());
  }

  public hide(): void {
    this.hudOverlay.setAttribute("visible-to", "-1");
  }

  public dispose(): void {
    if (this.hudOverlay && this.hudOverlay.parentNode) {
      this.hudOverlay.remove();
    }
  }
}

export class DeathScreen {
  private deathOverlay: HTMLElement;
  private respawnTimerText: SVGTextElement;
  private killCountText: SVGTextElement;
  private connectionId: number;

  constructor(connectionId: number) {
    this.connectionId = connectionId;
    this.deathOverlay = document.createElement("m-overlay");
    this.create();
  }

  private create(): void {
    this.deathOverlay.setAttribute("id", `death-screen-${this.connectionId}`);
    this.deathOverlay.setAttribute("anchor", "center");
    this.deathOverlay.setAttribute("offset-x", "0");
    this.deathOverlay.setAttribute("offset-y", "0");
    this.deathOverlay.setAttribute("visible-to", "-1");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "400");
    svg.setAttribute("height", "200");

    // Semi-transparent background
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", "400");
    background.setAttribute("height", "200");
    background.setAttribute("fill", "rgba(0, 0, 0, 0.8)");
    background.setAttribute("rx", "10");
    svg.appendChild(background);

    // "YOU DIED" title
    const deathTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    deathTitle.setAttribute("x", "200");
    deathTitle.setAttribute("y", "60");
    deathTitle.setAttribute("text-anchor", "middle");
    deathTitle.setAttribute("fill", "#ff0000");
    deathTitle.setAttribute("font-family", "monospace");
    deathTitle.setAttribute("font-size", "36");
    deathTitle.setAttribute("font-weight", "bold");
    deathTitle.textContent = "YOU DIED";
    svg.appendChild(deathTitle);

    // Kill count
    this.killCountText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    this.killCountText.setAttribute("x", "200");
    this.killCountText.setAttribute("y", "100");
    this.killCountText.setAttribute("text-anchor", "middle");
    this.killCountText.setAttribute("fill", "#ffffff");
    this.killCountText.setAttribute("font-family", "monospace");
    this.killCountText.setAttribute("font-size", "18");
    this.killCountText.textContent = "Zombies killed: 0";
    svg.appendChild(this.killCountText);

    // Respawn timer
    this.respawnTimerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    this.respawnTimerText.setAttribute("x", "200");
    this.respawnTimerText.setAttribute("y", "150");
    this.respawnTimerText.setAttribute("text-anchor", "middle");
    this.respawnTimerText.setAttribute("fill", "#aaaaaa");
    this.respawnTimerText.setAttribute("font-family", "monospace");
    this.respawnTimerText.setAttribute("font-size", "16");
    this.respawnTimerText.textContent = "Respawning in 3...";
    svg.appendChild(this.respawnTimerText);

    this.deathOverlay.appendChild(svg);
    document.body.appendChild(this.deathOverlay);
  }

  public show(killCount: number): void {
    if (this.killCountText) {
      this.killCountText.textContent = `Zombies killed: ${killCount}`;
    }
    this.deathOverlay.setAttribute("visible-to", this.connectionId.toString());
  }

  public updateTimer(secondsRemaining: number): void {
    if (this.respawnTimerText) {
      this.respawnTimerText.textContent = `Respawning in ${secondsRemaining}...`;
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
