/** Shared runtime types for the Hollowmere game world, ported from reference/full-reference.html */

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  invuln: number;
  facing: Vec2;
  /** Mouse-aim direction in radians (world space), used by directional casts (bolt/ice lance/shadow bolt) instead of auto-targeting the nearest foe. */
  aimAngle: number;
  dashCd: number;
  dashing: number;
  adrenaline: number;
  undyingCd: number;
  r: number;
  /** Phoenix (F_I) — set to 1 when consumed; revives the player once per run. */
  phoenixCd: number;
  /** Fortress (B_J) — seconds spent stationary, for standing-still damage reduction. */
  stillTime: number;
}

export type EnemyType = 'slime' | 'skel' | 'wisp' | 'wraith' | 'ghoul' | 'iceWolf' | 'shadowWraith';

/** Enemy behavior special flags beyond the base type stats. */
export interface EnemyBehavior {
  /** Teleports toward the player periodically (shadow wraith). */
  teleport?: boolean;
  /** Applies a freeze on contact (ice wolf). */
  freezeOnContact?: boolean;
  /** Extra fast melee (ghoul — already encoded via high spd). */
}

export interface EnemyState {
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  spd: number;
  r: number;
  color: string;
  xpValue: number;
  wobble?: boolean;
  seed: number;
  burning: number;
  burnT: number;
  frozenUntil: number;
  slowUntil: number;
  slowAmt: number;
  marked: number;
  rootBleed?: number;
  dead?: boolean;
  /** Special behavior flags (teleport, freezeOnContact). */
  teleport?: boolean;
  /** Teleport cooldown timer for shadow wraiths. */
  teleportCd?: number;
  /** Applies freeze on contact (ice wolf). */
  freezeOnContact?: boolean;
}

/**
 * Boss-owned bullet-hell projectiles. Deliberately NOT part of the regular
 * `Projectile`/`world.enemies` systems — bosses own their attacks end to
 * end, which keeps them trivial to clear in bulk when a fight ends and
 * keeps the regular enemy collision loop untouched.
 */
export interface BossProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  color: string;
  life: number;
}

/** A telegraphed warning shape (ring or line) shown before a boss attack lands/fires. */
export interface BossTelegraph {
  kind: 'ring' | 'line';
  x: number;
  y: number;
  angle?: number;
  length?: number;
  width?: number;
  radius?: number;
  color: string;
  t: number;
  dur: number;
}

export type BossAttackId = 'stomp' | 'radialBurst' | 'spiral' | 'aimedVolley' | 'expandRing' | 'lineBeam';

export interface BossState {
  defId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  spd: number;
  r: number;
  color: string;
  seed: number;
  xpValue: number;

  burning: number;
  burnT: number;
  slowUntil: number;
  slowAmt: number;
  /** Mirrors EnemyState.marked — set when a crit lands on the boss, consumed by mark-bonus damage (Shadow Bolt etc). */
  marked: number;

  /** Rotation index into this boss's attack-pattern list. */
  patternIndex: number;
  /** Currently-executing pattern id, or null while resting between attacks. */
  activePattern: BossAttackId | null;
  /** Seconds elapsed within the active pattern (or rest countdown when idle). */
  patternT: number;
  /** Free-form scratch state for a pattern's internal bookkeeping (shot counts, spin angle, etc). */
  patternData: Record<string, number>;

  projectiles: BossProjectile[];
  telegraphs: BossTelegraph[];
  dead?: boolean;
}

/**
 * Explicit boss-fight mode. When non-null, regular enemy spawning is paused
 * and all regular enemies were cleared on fight start — only the boss and
 * its own attacks are live. Kept as an explicit World field (rather than
 * inferred from enemies array contents) specifically so it's easy to reason
 * about now and easy to sync as a single discrete piece of state later in
 * Phase 4 multiplayer (NOTE for Phase 4: replicate `bossFight` verbatim to
 * clients rather than trying to infer boss-fight-active from enemy lists).
 */
export interface BossFightState {
  boss: BossState;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  color: string;
  pierce: number;
  r: number;
  homing?: boolean;
  life: number;
  burn?: boolean;
  slow?: number;
  freeze?: number;
  mini?: boolean;
  /** Deals double damage if it hits a target that's currently marked (Shadow Bolt). Resolved generically in damageEnemy/damageBoss since the target isn't known until the projectile actually connects (mouse-aim casts, no pre-lock). */
  markedBonus?: boolean;
}

export interface RingEffect {
  type: 'ring';
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  life: number;
  t: number;
}

export interface GroundEffect {
  type: 'ground';
  x: number;
  y: number;
  r: number;
  color: string;
  life: number;
  t: number;
  dmg: number;
}

export type Effect = RingEffect | GroundEffect;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
  big?: boolean;
}

export interface Decoy {
  x: number;
  y: number;
  t: number;
  boosted: boolean;
}

export interface Wisp {
  angle: number;
  cd: number;
  x?: number;
  y?: number;
}

export interface Cooldowns {
  bolt: number;
  boltCastCount: number;
  fireNova: number;
  iceLance: number;
  frostArmor: number;
  frostArmorActive: number;
  arcaneBurst: number;
  vines: number;
  shadowBolt: number;
  /** Time Warp (V_I) — global enemy-slow timer; while > 0 all enemies move at 40% speed. */
  timeWarp: number;
  /** Overgrowth (N_I) — periodic life-bloom timer. */
  overgrowth: number;
  /** Shadow Blink (S_I) — periodic auto-dash to nearest enemy & mark. */
  shadowBlink: number;
  /** Eternal Frost (R_I) — while > 0 all enemies are frozen. */
  eternalFrost: number;
  /** Apex Surge (P_I) — periodic damage/power boost timer. */
  apexSurge: number;
  /** Cull (S_J) — periodic execute on low-HP enemies. */
  cull: number;
  /** Magma Core boss ability — passive periodic fire pulse. */
  magmaCore: number;
}

export interface SkillNode {
  id: string;
  branch: string;
  color: string;
  tier: number;
  x: number;
  y: number;
  cost: number;
  pre: string[];
  capstone: boolean;
  name: string;
  desc: string;
}

/**
 * Central mutable world state, analogous to the reference's `state` closure
 * variable. Passed by reference into the game/* module functions so they can
 * operate the same way the reference's free functions did against a shared
 * `state` object, without relying on module-level singletons (keeps things
 * testable and avoids hidden global state).
 */
export interface World {
  W: number;
  H: number;
  running: boolean;
  grimoireOpen: boolean;
  /** Toggles auto-aim vs mouse-aim. When true, bolt/ice lance/shadow bolt auto-target nearest enemy (classic behavior). When false, they fire toward player.aimAngle (mouse cursor). */
  autoAim: boolean;

  player: PlayerState;
  level: number;
  xp: number;
  xpNext: number;
  sp: number;
  spSpent: number;
  slain: number;
  elapsed: number;

  enemies: EnemyState[];
  projectiles: Projectile[];
  effects: Effect[];
  particles: Particle[];
  popups: Popup[];
  wisps: Wisp[];
  decoys: Decoy[];

  cd: Cooldowns;
  spawnTimer: number;
  bossTimer: number;
  /** Explicit boss-fight state — see BossFightState doc comment. Null = normal spawning. */
  bossFight: BossFightState | null;

  /** Current stage (starts at 1, increments on each boss kill). */
  stage: number;
  /** Boss ability unlocks pending banking to localStorage on death. Keyed by boss defId. */
  pendingBossAbilityUnlocks: string[];

  /** When non-null, the UI should show a persistent ability-unlock overlay (pauses the game). */
  pendingAbilityDisplay: { abilityName: string; bossName: string; desc: string } | null;

  purchased: Set<string>;

  /** Network players tracked by the host (host is index 0, not in this array). */
  netPlayers?: NetPlayer[];

  /** UI hook: shows the big center-screen flash banner text. */
  flash: (text: string, color: string) => void;
}

// ---------------- Multiplayer (Phases 3+4) ----------------

/**
 * Lightweight per-player state for network players tracked by the host.
 * The host owns the authoritative World; in multiplayer it also maintains
 * an array of these NetPlayer entries — one per connected guest — so it
 * can simulate each player's position from their reported input and factor
 * their derived stats (from their per-player Grimoire + meta multipliers)
 * into their spell casts.
 *
 * `world.player` remains the *local* player's state for both host and guest
 * (backward compat with single-player). The host's own player is NOT in
 * `netPlayers` (index 0 in the snapshot is always the host).
 */
export interface NetPlayerState {
  /** Render + protocol fields. */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  invuln: number;
  dashing: number;
  aimAngle: number;
  dashCd: number;
  downed: boolean;
  /** Internal player state for simulation (mirrors PlayerState fields the host needs). */
  vx: number;
  vy: number;
  facing: Vec2;
  r: number;
  dashCdMax: number;
  phoenixCd: number;
  undyingCd: number;
  stillTime: number;
  /** Per-player skill-tree (Grimoire) purchases (host-authoritative copy). */
  purchased: Set<string>;
  sp: number;
  spSpent: number;
  /** Per-player XP/level. */
  xp: number;
  xpNext: number;
  /** Per-player cooldowns. */
  cd: Cooldowns;
  /** Per-player wisps/decoys. */
  wisps: Wisp[];
  decoys: Decoy[];
  /** ID used in snapshots and lobby player list. */
  id: number;
}

export interface NetPlayer {
  /** Unique numeric ID (host assigns sequentially; host is 0). */
  id: number;
  /** PeerJS peer ID of this client. */
  peerId: string;
  /** Display name. */
  name: string;
  /** Latest input reported by this client (20Hz). */
  input: { mvx: number; mvy: number; dash: boolean; aim: number };
  /** Simulation-side per-player state (host-authoritative). */
  state: NetPlayerState;
  /** Meta multipliers reported by this client at connection time. */
  meta: import('../net/messages').MetaPayload;
}

export function createWorld(W: number, H: number, flash: (text: string, color: string) => void): World {
  return {
    W,
    H,
    running: false,
    grimoireOpen: false,
    autoAim: true,
    player: {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      hp: 100,
      invuln: 0,
      facing: { x: 0, y: -1 },
      aimAngle: -Math.PI / 2,
      dashCd: 0,
      dashing: 0,
      adrenaline: 0,
      undyingCd: 0,
      r: 9,
      phoenixCd: 0,
      stillTime: 0,
    },
    level: 1,
    xp: 0,
    xpNext: 24,
    sp: 0,
    spSpent: 0,
    slain: 0,
    elapsed: 0,
    enemies: [],
    projectiles: [],
    effects: [],
    particles: [],
    popups: [],
    wisps: [],
    decoys: [],
    cd: {
      bolt: 0,
      boltCastCount: 0,
      fireNova: 0,
      iceLance: 0,
      frostArmor: 0,
      frostArmorActive: 0,
      arcaneBurst: 0,
      vines: 0,
      shadowBolt: 0,
      timeWarp: 0,
      overgrowth: 0,
      shadowBlink: 0,
      eternalFrost: 0,
      apexSurge: 0,
      cull: 0,
      magmaCore: 0,
    },
    spawnTimer: 0,
    bossTimer: 20,
    bossFight: null,
    stage: 1,
    pendingBossAbilityUnlocks: [],
    pendingAbilityDisplay: null,
    purchased: new Set<string>(),
    flash,
  };
}
