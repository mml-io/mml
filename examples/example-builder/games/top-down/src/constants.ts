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
};
