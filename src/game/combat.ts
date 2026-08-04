/** Damage/death resolution — damageEnemy, killEnemy, ported from reference/full-reference.html */
import type { BossState, EnemyState, World } from './types';
import { critChance, critDmgMult, gainXP, healPlayer, lifestealPct, resetAllCooldowns } from './player';
import { hasNode } from './skillTree';
import { addRunEssence, essenceForEnemyKill } from './metaProgression';
import { burst, spawnPopup } from './visuals';
import { spawnSlimeSplit } from './enemies';

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
  // Nightmare (S_K): marked enemies take 25% more damage from all sources.
  if (hasNode(world.purchased, 'S_K') && e.marked > world.elapsed) dmg *= 1.25;
  // Stage 3+ enemy armor: enemies in later stages reduce incoming damage by
  // 20%, making them meaningfully tankier and forcing players to invest in
  // build power (crit/multipliers) to keep up.
  if (world.stage >= 3) dmg *= 0.8;
  e.hp -= dmg;
  if (crit) e.marked = world.elapsed + 4;
  // Executioner (S_C1): critical strikes splash shadow to nearby enemies.
  if (crit && hasNode(world.purchased, 'S_C1')) {
    world.enemies.forEach((o) => {
      if (o !== e && !o.dead && dist2(o.x, o.y, e.x, e.y) < 80 * 80) {
        damageEnemy(world, o, dmg * 0.4, { allowCrit: false, color: '#c4728f' });
      }
    });
  }
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
  if (e.hp <= 0 && !world.isGuest) killEnemy(world, e);
}

export function killEnemy(world: World, e: EnemyState): void {
  e.dead = true;
  gainXP(world, e.xpValue);
  addRunEssence(world, essenceForEnemyKill(world, e.xpValue));
  world.slain++;
  burst(world, e.x, e.y, e.color, 14, 150);
  if (e.type === 'slime' && !e.splitChild) spawnSlimeSplit(world, e);
  if (hasNode(world.purchased, 'N_A')) healPlayer(world, 3);
  if (hasNode(world.purchased, 'N_F')) {
    healPlayer(world, 6);
    world.enemies.forEach((o) => {
      if (!o.dead && dist2(o.x, o.y, e.x, e.y) < 100 * 100) damageEnemy(world, o, 14, { allowCrit: false });
    });
  }
  if (e.marked > world.elapsed && hasNode(world.purchased, 'S_F')) resetAllCooldowns(world);
  // Death's Embrace (S_D): slaying a marked foe refunds part of dash cooldown.
  if (e.marked > world.elapsed && hasNode(world.purchased, 'S_D')) {
    world.player.dashCd = Math.max(0, world.player.dashCd - 1.5);
  }
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
  // Deep Freeze (R_C1): frozen enemies shatter in a small burst, damaging nearby foes.
  if (e.frozenUntil > world.elapsed && hasNode(world.purchased, 'R_C1')) {
    world.enemies.forEach((o) => {
      if (!o.dead && o !== e && dist2(o.x, o.y, e.x, e.y) < 60 * 60) {
        damageEnemy(world, o, 12 + world.level * 0.3, { allowCrit: false, color: '#8ec9e8' });
      }
    });
    burst(world, e.x, e.y, '#8ec9e8', 10, 80);
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
