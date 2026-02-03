export const CONSTANTS = {
  TICK_RATE: 64,
  RIFLE: "/assets/models/rifle.glb",
  CHARACTER_BODY: "/assets/models/rifle_guy.glb",
  ANIM_IDLE: "/assets/models/rifle_idle.glb",
  ANIM_RUN: "/assets/models/rifle_run.glb",
  ANIM_AIR: "/assets/models/rifle_air.glb",
  ANIM_STRAFE_LEFT: "/assets/models/rifle_run_strafe_left.glb",
  ANIM_STRAFE_RIGHT: "/assets/models/rifle_run_strafe_right.glb",
  ANIM_RUN_BACKWARD: "/assets/models/rifle_run_backward.glb",

  BLOOD_SPRITE: "/assets/images/blood_splat.webm",

  SFX_SHOOT: "/assets/audio/sfx_shoot.mp3",
  SFX_GRENADE: "/assets/audio/sfx_grenade_explosion.mp3",
  MUSIC_BACKGROUND: "/assets/audio/music_chrome_and_concrete.mp3",

  AVAILABLE_SPAWN_POINTS: [
    { x: -0.358, y: 0.901, z: -3.151 },
    { x: -4.979, y: 0.901, z: 3.897 },
    { x: 3.688, y: 0.901, z: 4.897 },
    { x: 0.688, y: 0.901, z: 9.563 },
    { x: -8.437, y: 0.901, z: 26.98 },
    { x: 7.023, y: 0.901, z: 10.896 },
  ],

  // Enemy constants
  ENEMY_COLOR: "#e74c3c",
  ENEMY_SIZE: 0.8,
  ENEMY_SPEED: 1.5,
  ENEMY_ACCELERATION: 20,
  ENEMY_CHASE_INTERVAL: 250,
  ENEMY_ATTACK_RANGE: 2.0,
  ENEMY_Y_POS: 0.05,

  ZOMBIE_MAN_MODEL: "/assets/models/zombie_man_compressed.glb",
  ZOMBIE_GIRL_MODEL: "/assets/models/zombie_girl_compressed.glb",
  ZOMBIE_WALK_ANIM: "/assets/models/zombie_walk.glb",
  ZOMBIE_ATTACK_ANIM: "/assets/models/zombie_attack.glb",
  ZOMBIE_DEATH_ANIM: "/assets/models/zombie_death.glb",

  ZOMBIE_DEATH_ANIM_TIME: 3000, // ms to wait before removing dead zombie

  WEAPON_FIRE_RATE: 200,
  WEAPON_DAMAGE: 1,
  BULLET_SPEED: 50,
  BULLET_MAX_DISTANCE: 100,
  BULLET_LIFETIME: 2,
  GUN_MUZZLE_OFFSET: { x: -0.1, y: 0.5, z: 1.5 }, // offset from player center to gun muzzle

  // Grenade constants
  GRENADE_MODEL: "/assets/impact_grenade.glb",
  GRENADE_MODEL_SCALE: 3,
  GRENADE_THROW_SPEED: 12,
  GRENADE_GRAVITY: -18,
  GRENADE_MAX_LIFETIME: 3,
  GRENADE_GROUND_Y: 0.1,
  GRENADE_MAX_THROW_DISTANCE: 12,
  GRENADE_ARC_MIN_HEIGHT: 1.2,
  GRENADE_ARC_MAX_HEIGHT: 3.2,
  GRENADE_ARC_HEIGHT_FACTOR: 0.12,
  GRENADE_BLAST_RADIUS: 4.5,
  GRENADE_DAMAGE: 10,
  GRENADE_DAMAGE_FALLOFF: 4,
  GRENADE_IMPULSE_FORCE: 18,
  GRENADE_IMPULSE_UPWARD: 4,
  GRENADE_KNOCKBACK_DISTANCE: 1.2,
  GRENADE_CAPACITY: 4,
  GRENADE_STARTING_COUNT: 2,
  GRENADE_PICKUP_AMOUNT: 1,
  GRENADE_PICKUP_REGEN_TIME: 25000,
  GRENADE_INFINITE_TESTING: false,

  // Health constants
  ZOMBIE_MAX_HEALTH: 5,
  HEALTH_BAR_WIDTH: 1.0,
  HEALTH_BAR_HEIGHT: 0.1,
  HEALTH_BAR_DEPTH: 0.05,
  HEALTH_BAR_Y_OFFSET: 3,

  // Player health constants
  PLAYER_MAX_HEALTH: 10,
  PLAYER_HEALTH_BAR_Y_OFFSET: 2.5,

  // Zombie attack constants
  ZOMBIE_ATTACK_DAMAGE: 1,
  // Attack animation: 79 frames total, apex at frame 30
  // At 30 FPS: frame 30 = 30/30 = 1000ms (1 second)
  // At 24 FPS: frame 30 = 30/24 = 1250ms (1.25 seconds)
  ZOMBIE_ATTACK_ANIM_FPS: 30, // Animation framerate
  ZOMBIE_ATTACK_APEX_FRAME: 30, // Frame where attack hits
  ZOMBIE_ATTACK_TOTAL_FRAMES: 79, // Total frames in attack animation
  ZOMBIE_ATTACK_DAMAGE_TIME: 1000, // ms into attack animation when damage occurs (frame 30 at 30fps)

  // Respawn constants
  PLAYER_RESPAWN_TIME: 3000, // ms before player respawns

  // Game difficulty
  INITIAL_ZOMBIE_COUNT: 3,
  MAXIMUM_ZOMBIE_COUNT: 10,
  DISABLE_ZOMBIE_SPAWNING: true,

  // Pickup constants
  RAPID_FIRE_PICKUP_REGEN_TIME: 30000, // 30 seconds to respawn
  RAPID_FIRE_DURATION: 10000, // 10 seconds of rapid fire
  RAPID_FIRE_MULTIPLIER: 10, // 10x fire rate

  // Pickup spawn positions (near spawn points for easy testing)
  PICKUP_SPAWN_POSITIONS: [
    { x: 2, y: 1.2, z: 0 },
    { x: -6, y: 1.2, z: -5 },
    { x: 5, y: 1.2, z: 8 },
  ],

  GRENADE_PICKUP_SPAWN_POSITIONS: [
    { x: -2, y: 1.2, z: 2 },
    { x: 7, y: 1.2, z: -4 },
    { x: -9, y: 1.2, z: 6 },
  ],

  // Experience system
  XP_PER_ZOMBIE_KILL: 5, // Base XP per zombie kill
  XP_BONUS_PER_ROUND: 1, // Extra XP per round
  REGEN_TICK_INTERVAL: 1000, // Health regen tick every 1 second

  // Barrel constants
  EXPLOSIVE_BARREL_MODEL: "/assets/models/explosive_barrel.glb",
  FLAMMABLE_BARREL_MODEL: "/assets/models/flammable_barrel.glb",
  BARREL_MODEL_SCALE: 1.2,
  BARREL_MAX_HEALTH: 5,
  BARREL_FLAME_THRESHOLD: 0.5, // Start flaming when health is below 50%
  BARREL_HIT_RADIUS: 0.6, // Radius for bullet hit detection

  // Explosive barrel
  EXPLOSIVE_BARREL_BLAST_RADIUS: 5,
  EXPLOSIVE_BARREL_DAMAGE: 20,
  EXPLOSIVE_BARREL_DAMAGE_FALLOFF: 3.5,
  EXPLOSIVE_BARREL_IMPULSE_FORCE: 20,
  EXPLOSIVE_BARREL_IMPULSE_UPWARD: 5,

  // Flammable liquid barrel
  LIQUID_POOL_RADIUS: 2.5,
  LIQUID_POOL_DURATION: 8000, // 8 seconds
  LIQUID_DOT_DAMAGE: 1, // Damage per tick
  LIQUID_DOT_TICK_RATE: 500, // ms between damage ticks
  LIQUID_BURN_DURATION: 3000, // Burning status effect lasts 3 seconds after leaving pool

  // Barrel spawn positions
  BARREL_SPAWN_POSITIONS: [
    { x: 4, y: 0.05, z: -2, type: "explosive" as const },
    { x: -3, y: 0.05, z: 5, type: "flammable" as const },
    { x: 8, y: 0.05, z: 3, type: "explosive" as const },
    { x: -7, y: 0.05, z: -3, type: "flammable" as const },
  ],
};
