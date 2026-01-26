/**
 * ExperienceUI - Vampire Survivors-style XP bar, level-up button, and upgrade menu
 * Styled to match the gritty Zombies/L4D aesthetic of the main UI.
 */

import { Upgrade } from "./ExperienceSystem.js";

function ensureExperienceStyles() {
  if (document.getElementById("experience-styles")) return;
  const style = document.createElement("style");
  style.id = "experience-styles";
  style.textContent = `
    @keyframes xp-bar-pulse {
      0% { box-shadow: 0 0 5px rgba(0, 170, 255, 0.3); border-color: #005588; }
      50% { box-shadow: 0 0 15px rgba(0, 170, 255, 0.5); border-color: #0088cc; }
      100% { box-shadow: 0 0 5px rgba(0, 170, 255, 0.3); border-color: #005588; }
    }
    @keyframes level-up-btn-pulse {
      0% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.3); transform: scale(1); }
      50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.6); transform: scale(1.05); }
      100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.3); transform: scale(1); }
    }
    @keyframes card-entrance {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes xp-gain-float {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-30px) scale(1.2); }
    }
    @keyframes level-pop {
      0% { transform: scale(1); color: #fff; }
      50% { transform: scale(1.5); color: #ffd700; }
      100% { transform: scale(1); color: #fff; }
    }
  `;
  document.head.appendChild(style);
}

const RARITY_STYLES: Record<string, { bg: string; border: string; glow: string; text: string }> = {
  common: {
    bg: "rgba(20, 20, 20, 0.95)",
    border: "#666666",
    glow: "rgba(100, 100, 100, 0.2)",
    text: "#aaaaaa",
  },
  uncommon: {
    bg: "rgba(10, 30, 10, 0.95)",
    border: "#44cc44",
    glow: "rgba(68, 204, 68, 0.3)",
    text: "#88ff88",
  },
  rare: {
    bg: "rgba(10, 20, 40, 0.95)",
    border: "#4488ff",
    glow: "rgba(68, 136, 255, 0.4)",
    text: "#88ccff",
  },
  legendary: {
    bg: "rgba(40, 20, 5, 0.95)",
    border: "#ffaa00",
    glow: "rgba(255, 170, 0, 0.5)",
    text: "#ffcc00",
  },
};

export class ExperienceUI {
  private connectionId: number;

  // XP Bar elements
  private xpBarOverlay: HTMLElement;
  private xpBarFill: HTMLElement;
  private xpText: HTMLElement;
  private levelText: HTMLElement;

  // Level-up button
  private levelUpButtonOverlay: HTMLElement;
  private levelUpButton: HTMLElement;
  private stackedCounter: HTMLElement;

  // Upgrade menu
  private upgradeMenuOverlay: HTMLElement | null = null;
  private upgradeCardsContainer: HTMLElement | null = null;

  // Debug controls
  private debugControlsOverlay: HTMLElement;
  private debugLevelButton: HTMLElement;

  // State
  private currentLevel: number = 1;
  private pendingLevelUps: number = 0;
  private isMenuOpen: boolean = false;

  // Callbacks
  private onUpgradeSelected: ((upgradeId: string) => void) | null = null;
  private onRequestUpgradeChoices: (() => Upgrade[]) | null = null;
  private onDebugForceLevelUp: ((count: number) => void) | null = null;

  constructor(connectionId: number) {
    this.connectionId = connectionId;
    ensureExperienceStyles();
    this.createXPBar();
    this.createLevelUpButton();
    this.createUpgradeMenu();
    this.createDebugControls();
  }

  private createXPBar(): void {
    // Create overlay anchored to top-center
    this.xpBarOverlay = document.createElement("m-overlay");
    this.xpBarOverlay.setAttribute("id", `xp-bar-overlay-${this.connectionId}`);
    this.xpBarOverlay.setAttribute("anchor", "top-center");
    this.xpBarOverlay.setAttribute("offset-x", "0");
    this.xpBarOverlay.setAttribute("offset-y", "15");
    this.xpBarOverlay.setAttribute("visible-to", this.connectionId.toString());

    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px",
      fontFamily: "'Escom-Bold', sans-serif",
      pointerEvents: "none", // Let clicks pass through
    });

    // Level indicator
    const levelRow = document.createElement("div");
    Object.assign(levelRow.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "2px",
    });

    const levelLabel = document.createElement("span");
    levelLabel.textContent = "LEVEL";
    Object.assign(levelLabel.style, {
      fontSize: "12px",
      color: "#888",
      letterSpacing: "2px",
      fontWeight: "bold",
    });
    levelRow.appendChild(levelLabel);

    this.levelText = document.createElement("span");
    this.levelText.textContent = "1";
    Object.assign(this.levelText.style, {
      fontSize: "24px",
      color: "#ffffff",
      fontWeight: "bold",
      textShadow: "0 0 10px rgba(0, 0, 0, 0.8)",
      transition: "transform 0.2s",
    });
    levelRow.appendChild(this.levelText);

    container.appendChild(levelRow);

    // XP Bar container
    const barContainer = document.createElement("div");
    Object.assign(barContainer.style, {
      width: "40vw",
      maxWidth: "600px",
      minWidth: "300px",
      height: "12px",
      background: "rgba(0, 0, 0, 0.8)",
      border: "1px solid #444",
      transform: "skewX(-20deg)", // Match HUD style
      overflow: "hidden",
      position: "relative",
      boxShadow: "0 0 10px rgba(0,0,0,0.5)",
      animation: "xp-bar-pulse 2s ease-in-out infinite",
    });

    // XP Bar fill - Blue/Cyan plasma look
    this.xpBarFill = document.createElement("div");
    Object.assign(this.xpBarFill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "0%",
      height: "100%",
      backgroundColor: "#0088cc",
      backgroundImage: "linear-gradient(90deg, #004466, #00aaff)",
      transition: "width 0.3s ease-out",
      boxShadow: "0 0 8px rgba(0, 170, 255, 0.4)",
      display: "block",
      zIndex: "1",
    });
    barContainer.appendChild(this.xpBarFill);

    // XP text overlay (unskewed)
    this.xpText = document.createElement("div");
    this.xpText.textContent = "0 / 10";
    Object.assign(this.xpText.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) skewX(20deg)", // Counter-skew
      fontSize: "10px",
      color: "#ffffff",
      textShadow: "1px 1px 2px black",
      letterSpacing: "1px",
      whiteSpace: "nowrap",
      opacity: "0.8",
      zIndex: "2",
    });
    barContainer.appendChild(this.xpText);

    container.appendChild(barContainer);

    this.xpBarOverlay.appendChild(container);
    document.body.appendChild(this.xpBarOverlay);
  }

  private createLevelUpButton(): void {
    this.levelUpButtonOverlay = document.createElement("m-overlay");
    this.levelUpButtonOverlay.setAttribute("id", `level-up-btn-overlay-${this.connectionId}`);
    this.levelUpButtonOverlay.setAttribute("anchor", "top-center");
    this.levelUpButtonOverlay.setAttribute("offset-x", "0");
    this.levelUpButtonOverlay.setAttribute("offset-y", "80");
    this.levelUpButtonOverlay.setAttribute("visible-to", "-1");

    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
    });

    // Tactical Level Up Button
    this.levelUpButton = document.createElement("button");
    this.levelUpButton.textContent = "UPGRADE AVAILABLE";
    Object.assign(this.levelUpButton.style, {
      padding: "10px 24px",
      fontSize: "16px",
      fontFamily: "'Escom-Bold', sans-serif",
      fontWeight: "bold",
      color: "#000",
      background: "#ffd700",
      border: "2px solid #fff",
      borderRadius: "2px",
      cursor: "pointer",
      letterSpacing: "2px",
      textTransform: "uppercase",
      boxShadow: "0 0 15px rgba(255, 215, 0, 0.4)",
      animation: "level-up-btn-pulse 1.5s infinite",
      pointerEvents: "auto",
    });

    this.levelUpButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openUpgradeMenu();
    });

    this.levelUpButton.addEventListener("mouseenter", () => {
      this.levelUpButton.style.backgroundColor = "#ffe033";
      this.levelUpButton.style.transform = "scale(1.05)";
    });
    this.levelUpButton.addEventListener("mouseleave", () => {
      this.levelUpButton.style.backgroundColor = "#ffd700";
      this.levelUpButton.style.transform = "scale(1)";
    });

    container.appendChild(this.levelUpButton);

    // Stacked counter
    this.stackedCounter = document.createElement("div");
    this.stackedCounter.textContent = "1 PENDING";
    Object.assign(this.stackedCounter.style, {
      fontSize: "12px",
      color: "#ffd700",
      fontWeight: "bold",
      textShadow: "0 0 5px rgba(0,0,0,0.8)",
      letterSpacing: "1px",
      opacity: "0",
      transition: "opacity 0.3s",
    });
    container.appendChild(this.stackedCounter);

    this.levelUpButtonOverlay.appendChild(container);
    document.body.appendChild(this.levelUpButtonOverlay);
  }

  private createUpgradeMenu(): void {
    this.upgradeMenuOverlay = document.createElement("m-overlay");
    this.upgradeMenuOverlay.setAttribute("id", `upgrade-menu-${this.connectionId}`);
    this.upgradeMenuOverlay.setAttribute("anchor", "center");
    this.upgradeMenuOverlay.setAttribute("offset-x", "0");
    this.upgradeMenuOverlay.setAttribute("offset-y", "0");
    this.upgradeMenuOverlay.setAttribute("width", "100%");
    this.upgradeMenuOverlay.setAttribute("height", "100%");
    this.upgradeMenuOverlay.setAttribute("visible-to", "-1");

    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.9)",
      fontFamily: "'Escom-Bold', sans-serif",
      pointerEvents: "auto", // Ensure clicks are caught
    });

    // Title
    const title = document.createElement("div");
    title.textContent = "FIELD UPGRADE";
    Object.assign(title.style, {
      fontSize: "42px",
      color: "#ffffff",
      fontWeight: "bold",
      marginBottom: "10px",
      letterSpacing: "6px",
      textShadow: "0 0 20px rgba(255, 255, 255, 0.2)",
      borderBottom: "2px solid #8a0303",
      paddingBottom: "10px",
      width: "80%",
      textAlign: "center",
    });
    backdrop.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.textContent = "SELECT ONE ENHANCEMENT";
    Object.assign(subtitle.style, {
      fontSize: "14px",
      color: "#888",
      marginBottom: "40px",
      letterSpacing: "4px",
    });
    backdrop.appendChild(subtitle);

    // Cards container
    this.upgradeCardsContainer = document.createElement("div");
    Object.assign(this.upgradeCardsContainer.style, {
      display: "flex",
      gap: "20px",
      justifyContent: "center",
      alignItems: "stretch",
      flexWrap: "wrap",
      maxWidth: "1000px",
      width: "100%",
      padding: "20px",
    });
    backdrop.appendChild(this.upgradeCardsContainer);

    this.upgradeMenuOverlay.appendChild(backdrop);
    document.body.appendChild(this.upgradeMenuOverlay);
  }

  private createDebugControls(): void {
    this.debugControlsOverlay = document.createElement("m-overlay");
    this.debugControlsOverlay.setAttribute("id", `debug-controls-${this.connectionId}`);
    this.debugControlsOverlay.setAttribute("anchor", "top-right");
    this.debugControlsOverlay.setAttribute("offset-x", "-15");
    this.debugControlsOverlay.setAttribute("offset-y", "15");
    this.debugControlsOverlay.setAttribute("visible-to", this.connectionId.toString());

    const container = document.createElement("div");
    Object.assign(container.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "6px",
      fontFamily: "'Escom-Bold', sans-serif",
      pointerEvents: "auto",
    });

    this.debugLevelButton = document.createElement("button");
    this.debugLevelButton.textContent = "DEBUG: +LEVEL";
    Object.assign(this.debugLevelButton.style, {
      padding: "6px 10px",
      fontSize: "11px",
      fontFamily: "'Escom-Bold', sans-serif",
      fontWeight: "bold",
      color: "#ffcc00",
      background: "rgba(0, 0, 0, 0.7)",
      border: "1px solid #ffcc00",
      borderRadius: "2px",
      cursor: "pointer",
      letterSpacing: "1px",
      textTransform: "uppercase",
      boxShadow: "0 0 10px rgba(255, 204, 0, 0.3)",
    });

    this.debugLevelButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this.onDebugForceLevelUp) {
        this.onDebugForceLevelUp(1);
      }
    });

    this.debugLevelButton.addEventListener("mouseenter", () => {
      this.debugLevelButton.style.backgroundColor = "rgba(255, 204, 0, 0.2)";
    });

    this.debugLevelButton.addEventListener("mouseleave", () => {
      this.debugLevelButton.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    });

    container.appendChild(this.debugLevelButton);
    this.debugControlsOverlay.appendChild(container);
    document.body.appendChild(this.debugControlsOverlay);
  }

  private createUpgradeCard(upgrade: Upgrade, index: number): HTMLElement {
    const style = RARITY_STYLES[upgrade.rarity];

    const card = document.createElement("button");
    Object.assign(card.style, {
      width: "240px",
      minHeight: "320px",
      padding: "25px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "15px",
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderTop: `4px solid ${style.border}`, // Tactical top bar
      borderRadius: "4px",
      cursor: "pointer",
      fontFamily: "'Escom-Bold', sans-serif",
      color: "#ffffff",
      boxShadow: `0 0 20px rgba(0,0,0,0.5)`,
      position: "relative",
      overflow: "hidden",
      // Remove initial opacity: 0 to ensure visibility if animation fails
      animation: `card-entrance 0.4s ease-out ${index * 0.1}s backwards`,
      transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
    });

    // Hover effects
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-5px)";
      card.style.boxShadow = `0 0 30px ${style.glow}`;
      card.style.borderColor = "#ffffff";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = `0 0 20px rgba(0,0,0,0.5)`;
      card.style.borderColor = style.border;
    });

    card.addEventListener("click", (e) => {
      e.stopPropagation();
      this.selectUpgrade(upgrade.id);
    });

    // Rarity Badge
    const rarityBadge = document.createElement("div");
    rarityBadge.textContent = upgrade.rarity.toUpperCase();
    Object.assign(rarityBadge.style, {
      fontSize: "10px",
      color: "#000",
      background: style.border,
      padding: "2px 8px",
      borderRadius: "2px",
      letterSpacing: "1px",
      fontWeight: "bold",
      alignSelf: "flex-start",
      marginBottom: "5px",
    });
    card.appendChild(rarityBadge);

    // Icon
    const icon = document.createElement("div");
    icon.textContent = upgrade.icon;
    Object.assign(icon.style, {
      fontSize: "56px",
      marginBottom: "10px",
      textShadow: `0 0 20px ${style.glow}`,
    });
    card.appendChild(icon);

    // Name
    const name = document.createElement("div");
    name.textContent = upgrade.name;
    Object.assign(name.style, {
      fontSize: "20px",
      fontWeight: "bold",
      textAlign: "center",
      color: style.text,
      textShadow: "0 0 10px rgba(0,0,0,0.5)",
      letterSpacing: "1px",
    });
    card.appendChild(name);

    // Description
    const desc = document.createElement("div");
    desc.textContent = upgrade.description;
    Object.assign(desc.style, {
      fontSize: "14px",
      color: "#cccccc",
      textAlign: "center",
      lineHeight: "1.5",
      flex: "1", // Push bottom elements down
      display: "flex",
      alignItems: "center",
    });
    card.appendChild(desc);

    // Level Progress
    const progressContainer = document.createElement("div");
    Object.assign(progressContainer.style, {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      marginTop: "15px",
    });

    const levelLabel = document.createElement("div");
    levelLabel.textContent = `LEVEL ${upgrade.currentLevel + 1} / ${upgrade.maxLevel}`;
    Object.assign(levelLabel.style, {
      fontSize: "10px",
      color: "#666",
      textAlign: "center",
    });
    progressContainer.appendChild(levelLabel);

    const dotsContainer = document.createElement("div");
    Object.assign(dotsContainer.style, {
      display: "flex",
      justifyContent: "center",
      gap: "4px",
    });

    for (let i = 0; i < upgrade.maxLevel; i++) {
      const dot = document.createElement("div");
      const isFilled = i < upgrade.currentLevel + 1;
      Object.assign(dot.style, {
        width: "100%",
        height: "4px",
        background: isFilled ? style.border : "rgba(255, 255, 255, 0.1)",
        borderRadius: "2px",
      });
      dotsContainer.appendChild(dot);
    }
    progressContainer.appendChild(dotsContainer);
    card.appendChild(progressContainer);

    return card;
  }

  // Public methods

  public updateXP(current: number, required: number, percent: number): void {
    const safePercent = Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : required > 0
        ? Math.max(0, Math.min(100, (current / required) * 100))
        : 0;

    if (this.xpBarFill) {
      this.xpBarFill.style.width = `${safePercent}%`;
    }
    if (this.xpText) {
      this.xpText.textContent = `${current} / ${required}`;
    }
  }

  public updateLevel(level: number): void {
    this.currentLevel = level;
    if (this.levelText) {
      this.levelText.textContent = level.toString();
      this.levelText.style.animation = "none";
      void this.levelText.offsetWidth; // Trigger reflow
      this.levelText.style.animation = "level-pop 0.5s ease-out";
    }
  }

  public showLevelUpButton(pendingCount: number): void {
    this.pendingLevelUps = pendingCount;

    if (pendingCount > 0) {
      this.levelUpButtonOverlay.setAttribute("visible-to", this.connectionId.toString());

      if (pendingCount > 1) {
        this.stackedCounter.textContent = `${pendingCount} UPGRADES PENDING`;
        this.stackedCounter.style.opacity = "1";
      } else {
        this.stackedCounter.style.opacity = "0";
      }
    } else {
      this.hideLevelUpButton();
    }
  }

  public hideLevelUpButton(): void {
    this.levelUpButtonOverlay.setAttribute("visible-to", "-1");
    this.stackedCounter.style.opacity = "0";
  }

  private openUpgradeMenu(): void {
    if (this.isMenuOpen) return;
    this.isMenuOpen = true;

    const choices = this.onRequestUpgradeChoices ? this.onRequestUpgradeChoices() : [];
    const visibleChoices = choices
      .filter((upgrade) => upgrade.currentLevel < upgrade.maxLevel)
      .slice(0, 4);

    if (visibleChoices.length === 0) {
      this.isMenuOpen = false;
      return;
    }

    // for (const child of this.upgradeCardsContainer.children) {
    // child.setAttribute("visible-to", "-1");
    // child.remove();
    // }

    if (
      !this.upgradeMenuOverlay ||
      !this.upgradeMenuOverlay.isConnected ||
      !this.upgradeCardsContainer
    ) {
      this.createUpgradeMenu();
    }

    if (!this.upgradeMenuOverlay || !this.upgradeCardsContainer) {
      this.isMenuOpen = false;
      return;
    }

    // this.upgradeCardsContainer.innerHTML = "";
    this.upgradeCardsContainer.replaceChildren();

    visibleChoices.forEach((upgrade, index) => {
      const card = this.createUpgradeCard(upgrade, index);
      this.upgradeCardsContainer.appendChild(card);
    });

    this.upgradeMenuOverlay.setAttribute("visible-to", this.connectionId.toString());
  }

  private selectUpgrade(upgradeId: string): void {
    if (!this.isMenuOpen) return;

    if (this.onUpgradeSelected) {
      this.onUpgradeSelected(upgradeId);
    }

    this.closeUpgradeMenu();

    this.pendingLevelUps--;
    if (this.pendingLevelUps > 0) {
      this.showLevelUpButton(this.pendingLevelUps);
    } else {
      this.hideLevelUpButton();
    }
  }

  private closeUpgradeMenu(): void {
    this.isMenuOpen = false;
    if (this.upgradeMenuOverlay) {
      this.upgradeMenuOverlay.remove();
      this.upgradeMenuOverlay = null;
    }
    this.upgradeCardsContainer = null;
  }

  public showXPGainEffect(amount: number): void {
    const floater = document.createElement("div");
    floater.textContent = `+${amount} XP`;
    Object.assign(floater.style, {
      position: "fixed",
      top: "15%",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "16px",
      fontFamily: "'Escom-Bold', sans-serif",
      color: "#00aaff",
      fontWeight: "bold",
      textShadow: "0 0 5px rgba(0, 170, 255, 0.8)",
      animation: "xp-gain-float 1s ease-out forwards",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(floater);

    setTimeout(() => {
      floater.remove();
    }, 1000);
  }

  public setOnUpgradeSelected(callback: (upgradeId: string) => void): void {
    this.onUpgradeSelected = callback;
  }

  public setOnRequestUpgradeChoices(callback: () => Upgrade[]): void {
    this.onRequestUpgradeChoices = callback;
  }

  public setOnDebugForceLevelUp(callback: (count: number) => void): void {
    this.onDebugForceLevelUp = callback;
  }

  public hide(): void {
    this.xpBarOverlay.setAttribute("visible-to", "-1");
    this.hideLevelUpButton();
    this.closeUpgradeMenu();
    if (this.debugControlsOverlay) {
      this.debugControlsOverlay.setAttribute("visible-to", "-1");
    }
  }

  public show(): void {
    this.xpBarOverlay.setAttribute("visible-to", this.connectionId.toString());
    if (this.pendingLevelUps > 0) {
      this.showLevelUpButton(this.pendingLevelUps);
    }
    if (this.debugControlsOverlay) {
      this.debugControlsOverlay.setAttribute("visible-to", this.connectionId.toString());
    }
  }

  public isUpgradeMenuOpen(): boolean {
    return this.isMenuOpen;
  }

  public dispose(): void {
    if (this.xpBarOverlay && this.xpBarOverlay.parentNode) {
      this.xpBarOverlay.remove();
    }
    if (this.levelUpButtonOverlay && this.levelUpButtonOverlay.parentNode) {
      this.levelUpButtonOverlay.remove();
    }
    if (this.upgradeMenuOverlay && this.upgradeMenuOverlay.parentNode) {
      this.upgradeMenuOverlay.remove();
    }
    if (this.debugControlsOverlay && this.debugControlsOverlay.parentNode) {
      this.debugControlsOverlay.remove();
    }
  }
}
