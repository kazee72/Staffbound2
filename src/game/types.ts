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
  dashCd: number;
  dashing: number;
  adrenaline: number;
  undyingCd: number;
  r: number;
}

export type EnemyType = 'slime' | 'skel' | 'wisp' | 'wraith' | 'boss';

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
  isBoss?: boolean;
  stompT?: number;
  telegraph?: number;
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

  purchased: Set<string>;

  /** UI hook: shows the big center-screen flash banner text. */
  flash: (text: string, color: string) => void;
}

export function createWorld(W: number, H: number, flash: (text: string, color: string) => void): World {
  return {
    W,
    H,
    running: false,
    grimoireOpen: false,
    player: {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      hp: 100,
      invuln: 0,
      facing: { x: 0, y: -1 },
      dashCd: 0,
      dashing: 0,
      adrenaline: 0,
      undyingCd: 0,
      r: 9,
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
    },
    spawnTimer: 0,
    bossTimer: 20,
    purchased: new Set<string>(),
    flash,
  };
}
