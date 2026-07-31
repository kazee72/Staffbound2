/** Enemy type defs, spawn logic, AI/movement — ported from reference/full-reference.html, extended with a multi-boss roster. */
import type { BossState, EnemyState, EnemyType, World } from './types';
import { BOSS_DEFS } from './bosses';

interface ETypeDef {
  hp: number;
  dmg: number;
  spd: number;
  xp: number;
  r: number;
  color: string;
  minDay: number;
  wobble?: boolean;
}

export const ETYPES: Record<EnemyType, ETypeDef> = {
  slime: { hp: 18, dmg: 6, spd: 70, xp: 4, r: 9, color: '#7fae6e', minDay: 1 },
  skel: { hp: 30, dmg: 10, spd: 95, xp: 6, r: 10, color: '#d8d3c4', minDay: 1 },
  wisp: { hp: 10, dmg: 4, spd: 150, xp: 5, r: 7, color: '#8ec9e8', minDay: 1, wobble: true },
  wraith: { hp: 70, dmg: 16, spd: 80, xp: 13, r: 12, color: '#8b6fae', minDay: 2 },
};

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function currentDay(world: World): number {
  return Math.floor(world.elapsed / 60) + 1;
}

export function spawnEnemy(world: World, forceType?: EnemyType): void {
  const day = currentDay(world);
  const pool = (Object.keys(ETYPES) as EnemyType[]).filter((k) => day >= ETYPES[k].minDay);
  const type = forceType || pool[(Math.random() * pool.length) | 0];
  const base = ETYPES[type];
  const scale = 1 + (day - 1) * 0.32;
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
    dmg: base.dmg * (1 + (day - 1) * 0.18),
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
  world.enemies.length = 0;

  const def = BOSS_DEFS[(Math.random() * BOSS_DEFS.length) | 0];
  const scale = 1 + (day - 1) * 0.3;
  const boss: BossState = {
    defId: def.id,
    name: def.name,
    x: world.W / 2,
    y: -60,
    hp: def.baseHp + day * def.hpPerDay,
    maxHp: def.baseHp + day * def.hpPerDay,
    dmg: def.baseDmg * (1 + (day - 1) * 0.16),
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
  void scale;
  world.bossFight = { boss };
  world.flash(def.flavor, def.flashColor);
}
