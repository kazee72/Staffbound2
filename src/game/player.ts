/** Player derived-stat getters, ported verbatim from reference/full-reference.html */
import type { World } from './types';
import { hasNode } from './skillTree';
import {
  metaCooldownMult,
  metaCritChance,
  metaCritDmgMult,
  metaDamageMult,
  metaDamageReduction,
  metaDashCdMult,
  metaHpMult,
  metaLifestealPct,
  metaMoveMult,
  metaRegenPerSec,
  metaXpMult,
} from './metaProgression';

export function cooldownMult(world: World): number {
  const grim =
    1 -
    (hasNode(world.purchased, 'V_E2') ? 0.2 : 0) -
    (hasNode(world.purchased, 'P_B') ? 0.1 : 0) -
    (hasNode(world.purchased, 'P_D') ? 0.12 : 0) -
    (hasNode(world.purchased, 'P_F') ? 0.1 : 0);
  return grim * metaCooldownMult(world);
}

export function critChance(world: World): number {
  return (
    (hasNode(world.purchased, 'S_A') ? 0.08 : 0) +
    (hasNode(world.purchased, 'S_G') ? 0.05 : 0) +
    (hasNode(world.purchased, 'P_C1') ? 0.06 : 0) +
    (hasNode(world.purchased, 'P_F') ? 0.1 : 0) +
    metaCritChance(world)
  );
}

export function critDmgMult(world: World): number {
  return (
    1.5 +
    (hasNode(world.purchased, 'S_C1') ? 0.5 : 0) +
    (hasNode(world.purchased, 'P_C2') ? 0.15 : 0) +
    metaCritDmgMult(world)
  );
}

export function maxHP(world: World): number {
  const p = world.purchased;
  const grim =
    1 +
    (hasNode(p, 'B_B') ? 0.25 : 0) +
    (hasNode(p, 'B_E1') ? 0.5 : 0) +
    (hasNode(p, 'F_H') ? 0.15 : 0) +
    (hasNode(p, 'R_H') ? 0.15 : 0) +
    (hasNode(p, 'V_H') ? 0.15 : 0) +
    (hasNode(p, 'N_H') ? 0.15 : 0) +
    (hasNode(p, 'S_H') ? 0.15 : 0) +
    (hasNode(p, 'P_H') ? 0.15 : 0);
  return 100 * grim * metaHpMult(world);
}

export function moveSpeed(world: World): number {
  const p = world.purchased;
  const grim =
    1 +
    (hasNode(p, 'B_A') ? 0.15 : 0) +
    (hasNode(p, 'B_G') ? 0.1 : 0) +
    (hasNode(p, 'P_G') ? 0.1 : 0) +
    (hasNode(p, 'P_E2') ? 0.15 : 0) +
    (hasNode(p, 'P_F') ? 0.1 : 0);
  return 230 * grim * metaMoveMult(world) * (world.player.adrenaline > 0 ? 1.25 : 1);
}

export function regenPerSec(world: World): number {
  return 0.4 + (hasNode(world.purchased, 'B_E2') ? 1.6 : 0) + (hasNode(world.purchased, 'N_G') ? 0.6 : 0) + metaRegenPerSec(world);
}

export function healingMult(world: World): number {
  return 1 + (hasNode(world.purchased, 'N_E1') ? 0.5 : 0);
}

export function lifestealPct(world: World): number {
  return (hasNode(world.purchased, 'S_E1') ? 0.08 : 0) + metaLifestealPct(world);
}

export function damageReduction(world: World): number {
  return (hasNode(world.purchased, 'B_C2') ? 0.15 : 0) + (hasNode(world.purchased, 'B_H') ? 0.1 : 0) + metaDamageReduction(world);
}

export function dashCooldownMax(world: World): number {
  return 3.4 * (1 - ((hasNode(world.purchased, 'B_B') ? 0.15 : 0) + (hasNode(world.purchased, 'B_C1') ? 0.25 : 0))) * metaDashCdMult(world);
}

export function xpMult(world: World): number {
  return (1 + (hasNode(world.purchased, 'V_X') ? 0.3 : 0)) * metaXpMult(world);
}

/** Broad "spell power" multiplier from the Potency branch — applied to non-bolt damage spells (Fire Nova/Ice Lance/Arcane Burst/Shadow Bolt/Wisp bolts). Bolt itself is scaled inline in castBolt alongside its other multipliers. */
export function spellDamageMult(world: World): number {
  const p = world.purchased;
  return (1 + (hasNode(p, 'P_A') ? 0.1 : 0) + (hasNode(p, 'P_E1') ? 0.15 : 0)) * (hasNode(p, 'P_F') ? 1.2 : 1) * metaDamageMult(world);
}

export function healPlayer(world: World, amount: number): void {
  world.player.hp = Math.min(maxHP(world), world.player.hp + amount * healingMult(world));
}

export function resetAllCooldowns(world: World): void {
  world.cd.fireNova = 0;
  world.cd.iceLance = 0;
  world.cd.frostArmor = 0;
  world.cd.arcaneBurst = 0;
  world.cd.vines = 0;
  world.cd.shadowBolt = 0;
  world.player.dashCd = 0;
}

export function xpForLevel(lvl: number): number {
  return Math.floor(14 + lvl * 12 + lvl * lvl * 1.55);
}

export function gainXP(world: World, amount: number): void {
  world.xp += amount * xpMult(world);
  while (world.xp >= world.xpNext) {
    world.xp -= world.xpNext;
    world.level++;
    world.sp++;
    world.xpNext = xpForLevel(world.level);
    world.flash('LEVEL ' + world.level, 'var(--gold-bright)');
  }
}
