/** Enemy type defs, spawn logic, AI/movement, and Elder Wraith boss logic — ported from reference/full-reference.html */
import type { EnemyState, EnemyType, World } from './types';

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

export const ETYPES: Record<Exclude<EnemyType, 'boss'>, ETypeDef> = {
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

export function spawnEnemy(world: World, forceType?: Exclude<EnemyType, 'boss'>): void {
  const day = currentDay(world);
  const pool = (Object.keys(ETYPES) as Array<Exclude<EnemyType, 'boss'>>).filter((k) => day >= ETYPES[k].minDay);
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

export function spawnBoss(world: World): void {
  const day = currentDay(world);
  const e: EnemyState = {
    type: 'boss',
    x: world.W / 2,
    y: -50,
    hp: 550 + day * 160,
    maxHp: 550 + day * 160,
    dmg: 22,
    spd: 52,
    r: 22,
    color: '#5b3f73',
    xpValue: 80,
    seed: 0,
    burning: 0,
    burnT: 0,
    frozenUntil: 0,
    slowUntil: 0,
    slowAmt: 0,
    marked: 0,
    stompT: 4,
    telegraph: 0,
    isBoss: true,
  };
  world.enemies.push(e);
  world.flash('AN ELDER WRAITH STIRS', 'var(--umbral)');
}
