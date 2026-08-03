/** Enemy type defs, spawn logic, AI/movement — ported from reference/full-reference.html, extended with a multi-boss roster. */
import type { BossState, EnemyState, EnemyType, World } from './types';
import { BOSS_DEFS } from './bosses';
import { availableEnemyTypes } from './stages';

interface ETypeDef {
  hp: number;
  dmg: number;
  spd: number;
  xp: number;
  r: number;
  color: string;
  minDay: number;
  minStage: number;
  wobble?: boolean;
  teleport?: boolean;
  freezeOnContact?: boolean;
}

export const ETYPES: Record<EnemyType, ETypeDef> = {
  slime: { hp: 18, dmg: 6, spd: 70, xp: 4, r: 9, color: '#7fae6e', minDay: 1, minStage: 1 },
  skel: { hp: 30, dmg: 10, spd: 95, xp: 6, r: 10, color: '#d8d3c4', minDay: 1, minStage: 1 },
  wisp: { hp: 10, dmg: 4, spd: 150, xp: 5, r: 7, color: '#8ec9e8', minDay: 1, minStage: 1, wobble: true },
  wraith: { hp: 70, dmg: 16, spd: 80, xp: 13, r: 12, color: '#8b6fae', minDay: 2, minStage: 1 },
  // Stage 2: Ghoul — fast zombie, medium HP
  ghoul: { hp: 45, dmg: 12, spd: 120, xp: 8, r: 10, color: '#7a8a5e', minDay: 1, minStage: 2 },
  // Stage 3: Ice Wolf — very fast, freezes on contact
  iceWolf: { hp: 35, dmg: 10, spd: 160, xp: 9, r: 9, color: '#b8d8f0', minDay: 1, minStage: 3, freezeOnContact: true },
  // Stage 4: Shadow Wraith — teleports periodically toward the player
  shadowWraith: { hp: 55, dmg: 18, spd: 60, xp: 14, r: 11, color: '#9a7ec4', minDay: 1, minStage: 4, teleport: true },
};

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function currentDay(world: World): number {
  return Math.floor(world.elapsed / 60) + 1;
}

export function spawnEnemy(world: World, forceType?: EnemyType): void {
  const day = currentDay(world);
  const stage = world.stage;
  // Filter the pool by both day and stage: only spawn types whose minDay and
  // minStage requirements are met at the current progression level.
  const pool = availableEnemyTypes(stage).filter((k) => day >= ETYPES[k].minDay && stage >= ETYPES[k].minStage);
  const type = forceType || pool[(Math.random() * pool.length) | 0] || 'slime';
  const base = ETYPES[type];
  // Enemy stats scale with both stage and day.
  const scale = 1 + (stage - 1) * 0.5 + (day - 1) * 0.15;
  const edge = (Math.random() * 4) | 0;
  let x: number, y: number;
  const { W, H } = world;
  if (edge === 0) {
    x = -30;
    y = rand(0, H);
  } else if (edge === 1) {
    x = W + 30;
    y = rand(0, H);
  } else if (edge === 2) {
    x = rand(0, W);
    y = -30;
  } else {
    x = rand(0, W);
    y = H + 30;
  }
  const e: EnemyState = {
    type,
    x,
    y,
    hp: base.hp * scale,
    maxHp: base.hp * scale,
    dmg: base.dmg * (1 + (stage - 1) * 0.2 + (day - 1) * 0.18),
    spd: base.spd,
    r: base.r,
    color: base.color,
    xpValue: base.xp,
    wobble: base.wobble,
    seed: Math.random() * 100,
    burning: 0,
    burnT: 0,
    frozenUntil: 0,
    slowUntil: 0,
    slowAmt: 0,
    marked: 0,
    teleport: base.teleport,
    teleportCd: base.teleport ? 2 + Math.random() * 2 : undefined,
    freezeOnContact: base.freezeOnContact,
  };
  world.enemies.push(e);
}

/**
 * Starts a boss-exclusive fight: clears every currently-alive regular enemy,
 * picks a random boss definition (scaled by day), and installs
 * `world.bossFight`. Regular spawning is paused for as long as
 * `world.bossFight` is non-null (see updateSpawns).
 */
export function spawnBoss(world: World): void {
  const day = currentDay(world);
  const stage = world.stage;
  world.enemies.length = 0;

  const def = BOSS_DEFS[(Math.random() * BOSS_DEFS.length) | 0];
  const stageScale = 1 + (stage - 1) * 0.3 + (day - 1) * 0.1;
  const boss: BossState = {
    defId: def.id,
    name: def.name,
    x: world.W / 2,
    y: -60,
    hp: (def.baseHp + day * def.hpPerDay) * stageScale,
    maxHp: (def.baseHp + day * def.hpPerDay) * stageScale,
    dmg: def.baseDmg * (1 + (stage - 1) * 0.2 + (day - 1) * 0.16),
    spd: def.spd,
    r: def.r,
    color: def.color,
    seed: Math.random() * 1000,
    xpValue: def.xpValue,
    burning: 0,
    burnT: 0,
    slowUntil: 0,
    slowAmt: 0,
    marked: 0,
    patternIndex: -1,
    activePattern: null,
    patternT: 1.5, // brief entrance rest before first attack
    patternData: {},
    projectiles: [],
    telegraphs: [],
  };
  world.bossFight = { boss };
  world.flash(def.flavor, def.flashColor);
}
