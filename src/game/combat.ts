/** Damage/death resolution — damageEnemy, killEnemy, ported from reference/full-reference.html */
import type { BossState, EnemyState, World } from './types';
import { critChance, critDmgMult, gainXP, healPlayer, lifestealPct, resetAllCooldowns } from './player';
import { hasNode } from './skillTree';
import { burst, spawnPopup } from './visuals';

function dist2(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export interface DamageOpts {
  allowCrit?: boolean;
  color?: string;
  burn?: boolean;
  slow?: number;
  slowDur?: number;
  freeze?: number;
  markedBonus?: boolean;
}

export function damageEnemy(world: World, e: EnemyState, amount: number, opts: DamageOpts = {}): void {
  let dmg = amount;
  let crit = false;
  if (opts.allowCrit !== false && Math.random() < critChance(world)) {
    crit = true;
    dmg *= critDmgMult(world);
  }
  if (opts.markedBonus && e.marked > world.elapsed) dmg *= 2;
  if (e.frozenUntil > world.elapsed && hasNode(world.purchased, 'R_D')) dmg *= 1.5;
  if (hasNode(world.purchased, 'R_G') && (e.frozenUntil > world.elapsed || e.slowUntil > world.elapsed)) dmg *= 1.15;
  e.hp -= dmg;
  if (crit) e.marked = world.elapsed + 4;
  if (lifestealPct(world) > 0) healPlayer(world, dmg * lifestealPct(world));
  spawnPopup(world, e.x, e.y - 10, (crit ? 'CRIT ' : '') + Math.round(dmg), crit ? '#eeda9e' : opts.color || '#e9e4d8', crit);
  if (opts.burn) {
    e.burning = world.elapsed + 3;
    e.burnT = e.burnT || 0;
  }
  if (opts.slow) {
    const amt = opts.slow * (hasNode(world.purchased, 'R_E1') ? 1.5 : 1);
    e.slowUntil = world.elapsed + (opts.slowDur || 2);
    e.slowAmt = Math.max(e.slowAmt, Math.min(0.85, amt));
  }
  if (opts.freeze) {
    e.frozenUntil = world.elapsed + opts.freeze;
  }
  if (e.hp <= 0) killEnemy(world, e);
}

export function killEnemy(world: World, e: EnemyState): void {
  e.dead = true;
  gainXP(world, e.xpValue);
  world.slain++;
  burst(world, e.x, e.y, e.color, 14, 150);
  if (hasNode(world.purchased, 'N_A')) healPlayer(world, 3);
  if (hasNode(world.purchased, 'N_F')) {
    healPlayer(world, 6);
    world.enemies.forEach((o) => {
      if (!o.dead && dist2(o.x, o.y, e.x, e.y) < 100 * 100) damageEnemy(world, o, 14, { allowCrit: false });
    });
  }
  if (e.marked > world.elapsed && hasNode(world.purchased, 'S_F')) resetAllCooldowns(world);
  if (e.burning > world.elapsed && (hasNode(world.purchased, 'F_D') || hasNode(world.purchased, 'F_F'))) {
    world.enemies.forEach((o) => {
      if (!o.dead && o !== e && dist2(o.x, o.y, e.x, e.y) < 140 * 140) {
        damageEnemy(world, o, 10, { allowCrit: false, burn: true });
      }
    });
  }
  if (e.frozenUntil > world.elapsed && hasNode(world.purchased, 'R_F')) {
    world.enemies.forEach((o) => {
      if (!o.dead && o !== e && dist2(o.x, o.y, e.x, e.y) < 100 * 100) {
        damageEnemy(world, o, 20, { allowCrit: false });
        o.frozenUntil = world.elapsed + 1.5;
      }
    });
  }
}

/**
 * Boss-fight equivalent of damageEnemy — bosses live outside world.enemies
 * (see BossState doc comment in types.ts) so they need their own damage
 * path, but it mirrors the same crit/lifesteal/burn/slow/mark rules so
 * player spells feel identical whether they're hitting regular foes or a
 * boss. Does not call killEnemy (bosses have no on-kill chain effects like
 * Wildfire Spread) — boss-death XP/flash/cleanup is handled centrally in
 * updateBossFight (simulation.ts) once hp drops <= 0.
 */
export function damageBoss(world: World, boss: BossState, amount: number, opts: DamageOpts = {}): void {
  let dmg = amount;
  let crit = false;
  if (opts.allowCrit !== false && Math.random() < critChance(world)) {
    crit = true;
    dmg *= critDmgMult(world);
  }
  if (opts.markedBonus && boss.marked > world.elapsed) dmg *= 2;
  boss.hp -= dmg;
  if (crit) boss.marked = world.elapsed + 4;
  if (lifestealPct(world) > 0) healPlayer(world, dmg * lifestealPct(world));
  spawnPopup(world, boss.x, boss.y - boss.r - 10, (crit ? 'CRIT ' : '') + Math.round(dmg), crit ? '#eeda9e' : opts.color || '#e9e4d8', crit);
  if (opts.burn) boss.burning = world.elapsed + 3;
  if (opts.slow) {
    const amt = opts.slow * (hasNode(world.purchased, 'R_E1') ? 1.5 : 1);
    boss.slowUntil = world.elapsed + (opts.slowDur || 2);
    boss.slowAmt = Math.max(boss.slowAmt, Math.min(0.85, amt));
  }
}
