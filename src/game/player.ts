/** Player derived-stat getters, ported from reference/full-reference.html */
import type { World } from './types';
import { hasNode } from './skillTree';
import {
  metaCooldownMult,
  metaCritChance,
  metaCritDmgMult,
  metaDamageMult,
  metaDamageReduction,
  metaDashCdMult,
  metaHealingMult,
  metaHpMult,
  metaLifestealPct,
  metaMoveMult,
  metaProjSpeedMult,
  metaRegenPerSec,
  metaXpMult,
} from './metaProgression';

export function cooldownMult(world: World): number {
  const grim =
    1 -
    (hasNode(world.purchased, 'V_E2') ? 0.2 : 0) -
    (hasNode(world.purchased, 'P_B') ? 0.1 : 0) -
    (hasNode(world.purchased, 'P_D') ? 0.12 : 0) -
    (hasNode(world.purchased, 'P_F') ? 0.1 : 0) -
    (hasNode(world.purchased, 'P_J') ? 0.1 : 0);  // Perfection: +10% all stats (CDR portion)
  return grim * metaCooldownMult(world);
}

export function critChance(world: World): number {
  return (
    (hasNode(world.purchased, 'S_A') ? 0.08 : 0) +
    (hasNode(world.purchased, 'S_G') ? 0.05 : 0) +
    (hasNode(world.purchased, 'P_C1') ? 0.06 : 0) +
    (hasNode(world.purchased, 'P_F') ? 0.1 : 0) +
    // Twin Critical (V_H): +5% crit chance for all bolts
    (hasNode(world.purchased, 'V_H') ? 0.05 : 0) +
    // Apex Surge (P_I): +20% crit while surge is active
    (hasNode(world.purchased, 'P_I') && world.cd.apexSurge > 0.5 ? 0.2 : 0) +
    // Perfection (P_J): +10% crit chance (part of "all stats +10%")
    (hasNode(world.purchased, 'P_J') ? 0.1 : 0) +
    // Ki Sense (K_C1): +15% crit chance
    (hasNode(world.purchased, 'K_C1') ? 0.15 : 0) +
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
    (hasNode(p, 'N_H') ? 0.15 : 0) +
    (hasNode(p, 'S_H') ? 0.15 : 0) +
    (hasNode(p, 'P_H') ? 0.15 : 0) +
    (hasNode(p, 'T_H') ? 0.15 : 0) +   // Static Field (T_H): +15% max HP
    (hasNode(p, 'B_J') ? 0.4 : 0) +   // Titan Heart (B_J): +40% max HP
    (hasNode(p, 'W_H') ? 0.15 : 0) +   // Windwalker (W_H): +15% max HP
    (hasNode(p, 'Wa_G') ? 0.1 : 0) +   // Purifying Water (Wa_G): +10% max HP
    (hasNode(p, 'Rk_G') ? 0.2 : 0) +   // Stone Skin (Rk_G): +20% max HP
    (hasNode(p, 'Rk_H') ? 0.15 : 0) +  // Mountain Heart (Rk_H): +15% max HP
    (hasNode(p, 'H_G') ? 0.1 : 0) +    // Divine Shield (H_G): +10% max HP
    (hasNode(p, 'H_H') ? 0.2 : 0) +    // Blessed Vitality (H_H): +20% max HP
    (hasNode(p, 'Sm_G') ? 0.1 : 0) +   // Spirit Link (Sm_G): +10% max HP
    (hasNode(p, 'Sm_H') ? 0.15 : 0) +  // Soul Harvest (Sm_H): +15% max HP
    (hasNode(p, 'K_G') ? 0.25 : 0) +   // Saiyan Spirit (K_G): +25% max HP
    (hasNode(p, 'K_H') ? 0.20 : 0) +   // Endurance (K_H): +20% max HP
    (hasNode(p, 'P_J') ? 0.1 : 0);     // Perfection (P_J): +10% all stats (HP portion)
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
    (hasNode(p, 'P_F') ? 0.1 : 0) +
    (hasNode(p, 'W_A') ? 0.15 : 0) +
    (hasNode(p, 'W_H') ? 0.1 : 0) +
    (hasNode(p, 'P_J') ? 0.1 : 0);     // Perfection: +10% all stats
  // Fluid Motion (Wa_K): +20% move speed while moving.
  const moving = Math.hypot(world.player.vx, world.player.vy) > 20;
  const fluidMult = hasNode(p, 'Wa_K') && moving ? 1.2 : 1;
  return 230 * grim * metaMoveMult(world) * (world.player.adrenaline > 0 ? 1.25 : 1) * fluidMult;
}

export function regenPerSec(world: World): number {
  const base = 0.4 + (hasNode(world.purchased, 'B_E2') ? 1.6 : 0) + (hasNode(world.purchased, 'N_G') ? 0.6 : 0) + metaRegenPerSec(world);
  // Titan Heart (B_J): +50% regen
  let mult = hasNode(world.purchased, 'B_J') ? 1.5 : 1;
  // Mountain Heart (Rk_H): +50% regen
  if (hasNode(world.purchased, 'Rk_H')) mult *= 1.5;
  // Blessed Vitality (H_H): +50% regen
  if (hasNode(world.purchased, 'H_H')) mult *= 1.5;
  return base * mult;
}

export function healingMult(world: World): number {
  return (1 + (hasNode(world.purchased, 'N_E1') ? 0.5 : 0)) * metaHealingMult(world);
}

export function lifestealPct(world: World): number {
  return (hasNode(world.purchased, 'S_E1') ? 0.08 : 0) + metaLifestealPct(world);
}

export function damageReduction(world: World): number {
  let dr = (hasNode(world.purchased, 'B_C2') ? 0.15 : 0) + (hasNode(world.purchased, 'B_H') ? 0.1 : 0) + metaDamageReduction(world);
  // Mana Shield (V_K): 20% DR when above 80% HP
  if (hasNode(world.purchased, 'V_K') && world.player.hp > maxHP(world) * 0.8) dr += 0.2;
  // Fortress (B_I): 25% DR after standing still 2+ seconds
  if (hasNode(world.purchased, 'B_I') && world.player.stillTime >= 2) dr += 0.25;
  // Aqua Shield (Wa_H): 10% DR while above 50% HP
  if (hasNode(world.purchased, 'Wa_H') && world.player.hp > maxHP(world) * 0.5) dr += 0.1;
  // Stone Skin (Rk_G): 10% DR
  if (hasNode(world.purchased, 'Rk_G')) dr += 0.1;
  // Bedrock (Rk_J): +15% additional DR
  if (hasNode(world.purchased, 'Rk_J')) dr += 0.15;
  // Saint's Resilience (H_J): 50% DR below 25% HP
  if (hasNode(world.purchased, 'H_J') && world.player.hp < maxHP(world) * 0.25) dr += 0.5;
  // Perfection (P_J): flat 10% DR (part of "all stats +10%")
  if (hasNode(world.purchased, 'P_J')) dr += 0.1;
  return Math.min(0.85, dr);
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
  let mult = (1 + (hasNode(p, 'P_A') ? 0.1 : 0) + (hasNode(p, 'P_E1') ? 0.15 : 0)) * (hasNode(p, 'P_F') ? 1.2 : 1);
  // Apex Surge (P_I): +50% damage while surge is active (cd.apexSurge > 0.5 means in active phase)
  if (hasNode(p, 'P_I') && world.cd.apexSurge > 0.5) mult *= 1.5;
  // Perfection (P_J): +10% damage (part of "all stats +10%")
  if (hasNode(p, 'P_J')) mult *= 1.1;
  return mult * metaDamageMult(world);
}

/** Holy-specific damage multiplier — includes H_F capstone (doubles holy effects). */
export function holySpellDamageMult(world: World): number {
  return spellDamageMult(world) * holyDamageMult(world);
}

/** Projectile speed multiplier — includes Velocity (P_K) skill and Aether Velocity meta. */
export function projectileSpeedMult(world: World): number {
  return (hasNode(world.purchased, 'P_K') ? 1.4 : 1) * metaProjSpeedMult(world);
}

/** Holy damage multiplier from the Holy (H) branch.
 *  Ascension (H_F): all holy effects doubled. */
export function holyDamageMult(world: World): number {
  return hasNode(world.purchased, 'H_F') ? 2 : 1;
}

/** Summon damage multiplier from the Summons (Sm) branch.
 *  Pack Hunter (Sm_C1): +30% damage.
 *  Lord of the Dead (Sm_F): 2x damage. */
export function summonDamageMult(world: World): number {
  let mult = 1;
  if (hasNode(world.purchased, 'Sm_C1')) mult += 0.3;
  if (hasNode(world.purchased, 'Sm_F')) mult *= 2;
  return mult;
}

/** Max number of summons allowed. Base 3, doubled by Lord of the Dead (Sm_F). */
export function maxSummons(world: World): number {
  return hasNode(world.purchased, 'Sm_F') ? 6 : 3;
}

/** Player-count-based enemy HP multiplier: 1 + (playerCount-1) * 0.5. */
export function playerHpScaleMult(world: World): number {
  return 1 + (world.playerCount - 1) * 0.5;
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
