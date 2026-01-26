/**
 * ExperienceSystem - Vampire Survivors-style leveling and upgrade system
 *
 * Features:
 * - XP from killing zombies
 * - Leveling with exponential XP requirements
 * - Stacking level-up rewards
 * - Upgrade selection system
 */

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  currentLevel: number;
  rarity: "common" | "uncommon" | "rare" | "legendary";
  category: "offense" | "defense" | "utility";
  apply: (level: number, stats: PlayerStats) => void;
}

export interface PlayerStats {
  // Offensive stats
  damageMultiplier: number;
  fireRateMultiplier: number;
  bulletSpeedMultiplier: number;
  critChance: number;
  critDamage: number;
  piercing: number; // Number of enemies bullet can pass through

  // Defensive stats
  maxHealthBonus: number;
  damageReduction: number;
  regenPerSecond: number;

  // Utility stats
  moveSpeedMultiplier: number;
  xpMultiplier: number;
  pickupRadiusMultiplier: number;
}

export function createDefaultStats(): PlayerStats {
  return {
    damageMultiplier: 1.0,
    fireRateMultiplier: 1.0,
    bulletSpeedMultiplier: 1.0,
    critChance: 0,
    critDamage: 1.5,
    piercing: 0,
    maxHealthBonus: 0,
    damageReduction: 0,
    regenPerSecond: 0,
    moveSpeedMultiplier: 1.0,
    xpMultiplier: 1.0,
    pickupRadiusMultiplier: 1.0,
  };
}

// All available upgrades in the game
const UPGRADE_DEFINITIONS: Omit<Upgrade, "currentLevel">[] = [
  // OFFENSIVE UPGRADES
  {
    id: "damage_up",
    name: "LEAD STORM",
    description: "+15% damage per level",
    icon: "💥",
    maxLevel: 5,
    rarity: "common",
    category: "offense",
    apply: (level, stats) => {
      stats.damageMultiplier += 0.15 * level;
    },
  },
  {
    id: "fire_rate",
    name: "TRIGGER HAPPY",
    description: "+20% fire rate per level",
    icon: "🔥",
    maxLevel: 5,
    rarity: "common",
    category: "offense",
    apply: (level, stats) => {
      stats.fireRateMultiplier += 0.2 * level;
    },
  },
  {
    id: "crit_chance",
    name: "HEADHUNTER",
    description: "+10% critical hit chance",
    icon: "🎯",
    maxLevel: 5,
    rarity: "uncommon",
    category: "offense",
    apply: (level, stats) => {
      stats.critChance += 0.1 * level;
    },
  },
  {
    id: "crit_damage",
    name: "EXECUTION",
    description: "+50% critical damage",
    icon: "💀",
    maxLevel: 3,
    rarity: "rare",
    category: "offense",
    apply: (level, stats) => {
      stats.critDamage += 0.5 * level;
    },
  },
  {
    id: "piercing",
    name: "ARMOR PIERCING",
    description: "Bullets pierce +1 enemy",
    icon: "🗡️",
    maxLevel: 3,
    rarity: "rare",
    category: "offense",
    apply: (level, stats) => {
      stats.piercing += level;
    },
  },
  {
    id: "bullet_speed",
    name: "VELOCITY",
    description: "+25% bullet speed",
    icon: "⚡",
    maxLevel: 3,
    rarity: "uncommon",
    category: "offense",
    apply: (level, stats) => {
      stats.bulletSpeedMultiplier += 0.25 * level;
    },
  },

  // DEFENSIVE UPGRADES
  {
    id: "max_health",
    name: "FORTITUDE",
    description: "+2 max health per level",
    icon: "❤️",
    maxLevel: 5,
    rarity: "common",
    category: "defense",
    apply: (level, stats) => {
      stats.maxHealthBonus += 2 * level;
    },
  },
  {
    id: "armor",
    name: "THICK SKIN",
    description: "+10% damage reduction",
    icon: "🛡️",
    maxLevel: 4,
    rarity: "uncommon",
    category: "defense",
    apply: (level, stats) => {
      stats.damageReduction += 0.1 * level;
    },
  },
  {
    id: "regen",
    name: "REGENERATION",
    description: "+0.5 health per second",
    icon: "💚",
    maxLevel: 4,
    rarity: "rare",
    category: "defense",
    apply: (level, stats) => {
      stats.regenPerSecond += 0.5 * level;
    },
  },

  // UTILITY UPGRADES
  {
    id: "speed",
    name: "ADRENALINE",
    description: "+10% movement speed",
    icon: "👟",
    maxLevel: 5,
    rarity: "common",
    category: "utility",
    apply: (level, stats) => {
      stats.moveSpeedMultiplier += 0.1 * level;
    },
  },
  {
    id: "xp_boost",
    name: "QUICK LEARNER",
    description: "+20% XP gain",
    icon: "📚",
    maxLevel: 3,
    rarity: "uncommon",
    category: "utility",
    apply: (level, stats) => {
      stats.xpMultiplier += 0.2 * level;
    },
  },
  {
    id: "pickup_radius",
    name: "MAGNETISM",
    description: "+30% pickup radius",
    icon: "🧲",
    maxLevel: 3,
    rarity: "uncommon",
    category: "utility",
    apply: (level, stats) => {
      stats.pickupRadiusMultiplier += 0.3 * level;
    },
  },

  // LEGENDARY UPGRADES
  {
    id: "glass_cannon",
    name: "GLASS CANNON",
    description: "+100% damage, -30% max health",
    icon: "🔮",
    maxLevel: 1,
    rarity: "legendary",
    category: "offense",
    apply: (level, stats) => {
      stats.damageMultiplier += 1.0 * level;
      stats.maxHealthBonus -= 3 * level; // -3 HP
    },
  },
  {
    id: "berserker",
    name: "BERSERKER",
    description: "+50% fire rate & damage, -20% health",
    icon: "🪓",
    maxLevel: 1,
    rarity: "legendary",
    category: "offense",
    apply: (level, stats) => {
      stats.fireRateMultiplier += 0.5 * level;
      stats.damageMultiplier += 0.5 * level;
      stats.maxHealthBonus -= 2 * level;
    },
  },
  {
    id: "tank",
    name: "JUGGERNAUT",
    description: "+5 max health, +25% damage reduction, -20% speed",
    icon: "🦏",
    maxLevel: 1,
    rarity: "legendary",
    category: "defense",
    apply: (level, stats) => {
      stats.maxHealthBonus += 5 * level;
      stats.damageReduction += 0.25 * level;
      stats.moveSpeedMultiplier -= 0.2 * level;
    },
  },
];

export class ExperienceSystem {
  private connectionId: number;
  private currentXP: number = 0;
  private currentLevel: number = 1;
  private pendingLevelUps: number = 0;
  private acquiredUpgrades: Map<string, Upgrade> = new Map();
  private stats: PlayerStats;

  // Callbacks
  private onLevelUp: ((level: number, pendingCount: number) => void) | null = null;
  private onXPGain: ((currentXP: number, requiredXP: number, percent: number) => void) | null =
    null;
  private onStatsChanged: ((stats: PlayerStats) => void) | null = null;

  constructor(connectionId: number) {
    this.connectionId = connectionId;
    this.stats = createDefaultStats();
  }

  private getAvailableUpgradeCount(): number {
    let count = 0;
    for (const def of UPGRADE_DEFINITIONS) {
      const current = this.acquiredUpgrades.get(def.id);
      const currentLevel = current?.currentLevel ?? 0;
      if (currentLevel < def.maxLevel) {
        count++;
      }
    }
    return count;
  }

  // XP required for a given level (exponential curve)
  public getXPForLevel(level: number): number {
    // Base: 10 XP for level 2, scaling up
    // Level 2: 10, Level 3: 25, Level 4: 45, Level 5: 70...
    return Math.floor(10 * Math.pow(level - 1, 1.5) + 5 * (level - 1));
  }

  public getXPProgress(): { current: number; required: number; percent: number } {
    const required = this.getXPForLevel(this.currentLevel + 1);
    const percent = Math.min(100, (this.currentXP / required) * 100);
    return { current: this.currentXP, required, percent };
  }

  public addXP(baseXP: number): void {
    const actualXP = Math.floor(baseXP * this.stats.xpMultiplier);
    this.currentXP += actualXP;

    console.log(
      `[XP] Player ${this.connectionId} gained ${actualXP} XP (${baseXP} base × ${this.stats.xpMultiplier.toFixed(2)} multiplier)`,
    );

    // Check for level ups
    let requiredXP = this.getXPForLevel(this.currentLevel + 1);
    const availableUpgrades = this.getAvailableUpgradeCount();
    while (this.currentXP >= requiredXP) {
      this.currentXP -= requiredXP;
      this.currentLevel++;
      if (this.pendingLevelUps < availableUpgrades) {
        this.pendingLevelUps++;
      }
      console.log(
        `[XP] Player ${this.connectionId} LEVEL UP! Now level ${this.currentLevel}, ${this.pendingLevelUps} upgrades pending`,
      );

      if (this.onLevelUp) {
        this.onLevelUp(this.currentLevel, this.pendingLevelUps);
      }

      requiredXP = this.getXPForLevel(this.currentLevel + 1);
    }

    // Notify XP change
    if (this.onXPGain) {
      const progress = this.getXPProgress();
      this.onXPGain(progress.current, progress.required, progress.percent);
    }
  }

  public forceLevelUps(count: number = 1): void {
    const levelsToAdd = Number.isFinite(count) ? Math.floor(count) : 0;
    if (levelsToAdd <= 0) return;

    const availableUpgrades = this.getAvailableUpgradeCount();
    for (let i = 0; i < levelsToAdd; i++) {
      this.currentLevel++;
      if (this.pendingLevelUps < availableUpgrades) {
        this.pendingLevelUps++;
      }

      if (this.onLevelUp) {
        this.onLevelUp(this.currentLevel, this.pendingLevelUps);
      }
    }

    if (this.onXPGain) {
      const progress = this.getXPProgress();
      this.onXPGain(progress.current, progress.required, progress.percent);
    }
  }

  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  public getPendingLevelUps(): number {
    return this.pendingLevelUps;
  }

  public hasPendingLevelUp(): boolean {
    return this.pendingLevelUps > 0;
  }

  // Get random upgrade options (3 choices, weighted by rarity)
  public getUpgradeChoices(count: number = 3): Upgrade[] {
    const availableUpgrades: Upgrade[] = [];

    // Build list of available upgrades (not maxed out)
    for (const def of UPGRADE_DEFINITIONS) {
      const current = this.acquiredUpgrades.get(def.id);
      const currentLevel = current?.currentLevel ?? 0;

      if (currentLevel < def.maxLevel) {
        availableUpgrades.push({
          ...def,
          currentLevel,
        });
      }
    }

    // Weight by rarity (common more likely, legendary less)
    const rarityWeights: Record<string, number> = {
      common: 10,
      uncommon: 6,
      rare: 3,
      legendary: 1,
    };

    // Weighted random selection
    const selected: Upgrade[] = [];
    const pool = [...availableUpgrades];

    for (let i = 0; i < count && pool.length > 0; i++) {
      const totalWeight = pool.reduce((sum, u) => sum + rarityWeights[u.rarity], 0);
      let roll = Math.random() * totalWeight;

      for (let j = 0; j < pool.length; j++) {
        roll -= rarityWeights[pool[j].rarity];
        if (roll <= 0) {
          selected.push(pool[j]);
          pool.splice(j, 1);
          break;
        }
      }
    }

    return selected;
  }

  // Apply an upgrade choice
  public selectUpgrade(upgradeId: string): boolean {
    if (this.pendingLevelUps <= 0) {
      console.warn("[XP] No pending level ups!");
      return false;
    }

    const definition = UPGRADE_DEFINITIONS.find((u) => u.id === upgradeId);
    if (!definition) {
      console.warn(`[XP] Unknown upgrade: ${upgradeId}`);
      return false;
    }

    // Get or create the upgrade entry
    let upgrade = this.acquiredUpgrades.get(upgradeId);
    if (!upgrade) {
      upgrade = { ...definition, currentLevel: 0 };
      this.acquiredUpgrades.set(upgradeId, upgrade);
    }

    if (upgrade.currentLevel >= upgrade.maxLevel) {
      console.warn(`[XP] Upgrade ${upgradeId} already at max level!`);
      return false;
    }

    // Level up the upgrade
    upgrade.currentLevel++;
    this.pendingLevelUps--;

    console.log(
      `[XP] Player ${this.connectionId} selected upgrade: ${upgrade.name} (now level ${upgrade.currentLevel}/${upgrade.maxLevel})`,
    );

    // Recalculate all stats
    this.recalculateStats();

    return true;
  }

  private recalculateStats(): void {
    // Reset to base stats
    this.stats = createDefaultStats();

    // Apply all upgrades
    for (const upgrade of this.acquiredUpgrades.values()) {
      if (upgrade.currentLevel > 0) {
        upgrade.apply(upgrade.currentLevel, this.stats);
      }
    }

    console.log(`[XP] Player ${this.connectionId} stats updated:`, this.stats);

    if (this.onStatsChanged) {
      this.onStatsChanged(this.stats);
    }
  }

  public getStats(): PlayerStats {
    return { ...this.stats };
  }

  public getAcquiredUpgrades(): Map<string, Upgrade> {
    return new Map(this.acquiredUpgrades);
  }

  // Event handlers
  public setOnLevelUp(callback: (level: number, pendingCount: number) => void): void {
    this.onLevelUp = callback;
  }

  public setOnXPGain(
    callback: (currentXP: number, requiredXP: number, percent: number) => void,
  ): void {
    this.onXPGain = callback;
  }

  public setOnStatsChanged(callback: (stats: PlayerStats) => void): void {
    this.onStatsChanged = callback;
  }

  // Reset on death (optional - keep upgrades but reset XP progress)
  public resetXPProgress(): void {
    this.currentXP = 0;
    if (this.onXPGain) {
      const progress = this.getXPProgress();
      this.onXPGain(progress.current, progress.required, progress.percent);
    }
  }

  // Full reset (new game)
  public fullReset(): void {
    this.currentXP = 0;
    this.currentLevel = 1;
    this.pendingLevelUps = 0;
    this.acquiredUpgrades.clear();
    this.stats = createDefaultStats();

    if (this.onXPGain) {
      const progress = this.getXPProgress();
      this.onXPGain(progress.current, progress.required, progress.percent);
    }
    if (this.onStatsChanged) {
      this.onStatsChanged(this.stats);
    }
  }
}
