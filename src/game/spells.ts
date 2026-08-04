/** All spell cast functions & their cooldown update loop, ported from reference/full-reference.html */
import type { EnemyState, Projectile, World, TornadoState } from './types';
import { cooldownMult, spellDamageMult, projectileSpeedMult, healPlayer, maxHP } from './player';
import { hasNode } from './skillTree';
import { damageEnemy, damageBoss } from './combat';
import { burst } from './visuals';
import { hasBossAbility, bossAbilityRank, metaSpellRadiusMult } from './metaProgression';

function dist2(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export function nearestEnemy(world: World, x: number, y: number): EnemyState | null {
  let best: EnemyState | null = null;
  let bd = Infinity;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/**
 * Lightning damage multiplier from the Lightning (T) branch.
 * Galvanize (T_C2): +15%, Conductor (T_E2): +25%, Tempest (T_F): x2.
 */
export function lightningDamageMult(world: World): number {
  const p = world.purchased;
  let mult = 1;
  if (hasNode(p, 'T_C2')) mult += 0.15;
  if (hasNode(p, 'T_E2')) mult += 0.25;
  if (hasNode(p, 'T_F')) mult *= 2; // Tempest doubles lightning damage
  return mult;
}

/**
 * Generate jagged lightning segments between two points.
 * Returns a flat array of [x, y, x, y, ...] waypoints.
 */
function generateLightningSegments(x1: number, y1: number, x2: number, y2: number): number[] {
  const segments: number[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const numPoints = Math.max(4, Math.floor(dist / 20));
  const perpX = -dy / dist;
  const perpY = dx / dist;
  segments.push(x1, y1);
  for (let i = 1; i < numPoints; i++) {
    const t = i / numPoints;
    const jitter = (Math.random() - 0.5) * 16;
    segments.push(x1 + dx * t + perpX * jitter, y1 + dy * t + perpY * jitter);
  }
  segments.push(x2, y2);
  return segments;
}

/**
 * Spawn a visible lightning arc effect between two points.
 */
function spawnLightningArc(world: World, x1: number, y1: number, x2: number, y2: number, color: string): void {
  world.effects.push({
    type: 'lightning',
    x1, y1, x2, y2,
    color,
    life: 0.25,
    t: 0,
    segments: generateLightningSegments(x1, y1, x2, y2),
  });
}

/**
 * Chain lightning from a source point through nearby enemies.
 * @param world
 * @param fromX/fromY  origin of the chain
 * @param initialTarget  the first enemy hit (or null to find nearest)
 * @param baseDmg  base damage for the first hit
 * @param chainCount  number of additional enemies to chain to
 * @param falloff  damage multiplier per chain (0.5 = 50% per jump)
 * @param color  color of the lightning arcs
 */
function chainLightning(
  world: World,
  fromX: number,
  fromY: number,
  initialTarget: EnemyState | null,
  baseDmg: number,
  chainCount: number,
  falloff: number,
  color: string,
): void {
  // Find the first target if not provided
  let target = initialTarget;
  if (!target) {
    target = nearestEnemy(world, fromX, fromY);
  }
  if (!target && world.bossFight) {
    // Fall back to boss
    const boss = world.bossFight.boss;
    spawnLightningArc(world, fromX, fromY, boss.x, boss.y, color);
    damageBoss(world, boss, baseDmg, { color });
    return;
  }
  if (!target) return;

  const hit = new Set<EnemyState>();
  let prevX = fromX, prevY = fromY;
  let curTarget: EnemyState | null = target;
  let dmg = baseDmg;

  for (let i = 0; i <= chainCount; i++) {
    if (!curTarget || curTarget.dead) break;
    hit.add(curTarget);
    spawnLightningArc(world, prevX, prevY, curTarget.x, curTarget.y, color);
    damageEnemy(world, curTarget, dmg, { color });
    world.effects.push({ type: 'ring', x: curTarget.x, y: curTarget.y, r: 0, maxR: 25, color, life: 0.2, t: 0 });
    prevX = curTarget.x;
    prevY = curTarget.y;
    dmg *= falloff;

    // Find next nearest enemy not already hit, within chain range
    let nextTarget: EnemyState | null = null;
    let nextDist = Infinity;
    const chainRange = 200;
    for (const e of world.enemies) {
      if (e.dead || hit.has(e)) continue;
      const d = dist2(prevX, prevY, e.x, e.y);
      if (d < chainRange * chainRange && d < nextDist) {
        nextDist = d;
        nextTarget = e;
      }
    }
    if (!nextTarget && world.bossFight && !hit.has(world.bossFight.boss as unknown as EnemyState)) {
      // Chain to boss if in range
      const boss = world.bossFight.boss;
      const d = dist2(prevX, prevY, boss.x, boss.y);
      if (d < chainRange * chainRange) {
        // Hit the boss and stop (can't chain from boss further in this simple impl)
        spawnLightningArc(world, prevX, prevY, boss.x, boss.y, color);
        damageBoss(world, boss, dmg, { color });
        break;
      }
    }
    curTarget = nextTarget;
  }
}

/**
 * Get the effective chain count for the Lightning branch.
 * T_A (Static Charge): 1 chain on 20% of bolts
 * T_B (Chain Lightning): +2 chains
 * T_D (Overload): +2 chains
 * T_F (Tempest): all attacks chain (minimum 1)
 * T_J (Arc Surge): +2 chains, falloff improved to 0.75
 */
function getLightningChainCount(world: World): number {
  let count = 0;
  if (hasNode(world.purchased, 'T_B')) count += 2;
  if (hasNode(world.purchased, 'T_D')) count += 2;
  if (hasNode(world.purchased, 'T_J')) count += 2;
  if (hasNode(world.purchased, 'T_F')) count = Math.max(count, 2); // Tempest: all attacks chain
  return count;
}

/** Falloff per chain jump — Arc Surge (T_J) improves it to 0.75. */
function getLightningFalloff(world: World): number {
  return hasNode(world.purchased, 'T_J') ? 0.75 : 0.5;
}

/**
 * AoE helper shared by Fire Nova / Thorned Vines / Arcane Burst-style spells
 * that hit "anything in range" rather than a single locked target — applies
 * to both regular enemies (world.enemies) and the active boss (world.bossFight)
 * so these spells still do something during a boss-exclusive fight.
 */
function forEachTargetInRange(world: World, x: number, y: number, radius: number, fn: (e: EnemyState) => void, bossFn: () => void): void {
  world.enemies.forEach((e) => {
    if (!e.dead && dist2(e.x, e.y, x, y) < radius * radius) fn(e);
  });
  if (world.bossFight) {
    const boss = world.bossFight.boss;
    if (dist2(boss.x, boss.y, x, y) < radius * radius) bossFn();
  }
}

interface ProjOpts {
  r?: number;
  homing?: boolean;
  life?: number;
  burn?: boolean;
  slow?: number;
  freeze?: number;
  mini?: boolean;
  markedBonus?: boolean;
}

export function fireProjectile(
  world: World,
  x: number,
  y: number,
  dx: number,
  dy: number,
  speed: number,
  dmg: number,
  color: string,
  pierce: number,
  opts: ProjOpts = {},
): void {
  const len = Math.hypot(dx, dy) || 1;
  const pr: Projectile = {
    x,
    y,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    dmg,
    color,
    pierce,
    r: opts.r || 5,
    homing: opts.homing,
    life: opts.life || 2,
    burn: opts.burn,
    slow: opts.slow,
    freeze: opts.freeze,
    mini: opts.mini,
    markedBonus: opts.markedBonus,
  };
  world.projectiles.push(pr);
}

export function castBolt(world: World): void {
  const p = world.player;
  const count = 1 + (hasNode(world.purchased, 'V_B') ? 1 : 0);
  world.cd.boltCastCount++;
  const empowered = hasNode(world.purchased, 'V_D') && world.cd.boltCastCount % 5 === 0;
  // Determine aim direction: auto-aim targets nearest enemy (classic behavior),
  // mouse-aim fires toward player.aimAngle. If auto-aim finds no target, fall
  // back to aimAngle so the player can still shoot during boss-only fights.
  let baseAng: number | null = null;
  if (world.autoAim) {
    const target = nearestEnemy(world, p.x, p.y);
    if (target) baseAng = Math.atan2(target.y - p.y, target.x - p.x);
    else if (world.bossFight) baseAng = Math.atan2(world.bossFight.boss.y - p.y, world.bossFight.boss.x - p.x);
  }
  if (baseAng === null) baseAng = p.aimAngle;
  const projSpeed = 480 * projectileSpeedMult(world);
  // Twin Casting (V_B): fire a second bolt on the exact same trajectory as
  // the first, just spawned a bit behind so it looks like a quick burst
  // (one bolt following the other), NOT a shotgun spread.
  for (let i = 0; i < count; i++) {
    const ang = baseAng; // same angle for all bolts — same trajectory
    // Offset spawn position backward along the fire direction so bolt 2
    // trails behind bolt 1 instead of overlapping it.
    const spawnOffset = i * 14; // 14px behind per bolt
    const sx = p.x - Math.cos(ang) * spawnOffset;
    const sy = p.y - Math.sin(ang) * spawnOffset;
    let dmg = 8 + world.level * 0.6;
    if (hasNode(world.purchased, 'F_A')) dmg *= 1.2;
    dmg *= spellDamageMult(world);
    if (empowered) dmg *= hasNode(world.purchased, 'V_J') ? 4 : 3; // Arcane Overflow (V_J): 4x instead of 3x
    fireProjectile(world, sx, sy, Math.cos(ang), Math.sin(ang), projSpeed, dmg, '#2f8fff', hasNode(world.purchased, 'V_C1') ? 1 : 0, {
      homing: hasNode(world.purchased, 'V_C2'),
      burn: hasNode(world.purchased, 'F_A'),
      slow: hasNode(world.purchased, 'R_A') ? 0.2 : 0,
    });
    if (empowered && hasNode(world.purchased, 'V_F')) {
      // Arcane Overflow (V_J): 6 homing bolts instead of 4
      const splashCount = hasNode(world.purchased, 'V_J') ? 6 : 4;
      for (let k = 0; k < splashCount; k++) {
        const a2 = Math.random() * Math.PI * 2;
        fireProjectile(world, sx, sy, Math.cos(a2), Math.sin(a2), 380, dmg * 0.4, '#8ecbff', 0, { homing: true, mini: true });
      }
    }
  }
  if (hasNode(world.purchased, 'V_G') && Math.random() < 0.1) world.cd.bolt = 0;

  // Lightning branch: chain from the player to nearby enemies on each bolt cast.
  // T_A (Static Charge): 20% chance to chain to 1 enemy for 60% damage.
  // T_B (Chain Lightning): +2 chains at 50% damage each.
  // T_D (Overload): +2 chains.
  // T_J (Arc Surge): +2 chains, falloff 0.75.
  // T_F (Tempest): all attacks chain (minimum 2 chains), lightning damage doubled.
  const chainCount = getLightningChainCount(world);
  if (chainCount > 0 || hasNode(world.purchased, 'T_A')) {
    const target = nearestEnemy(world, p.x, p.y);
    if (target || world.bossFight) {
      let effectiveChain = chainCount;
      // T_A alone: 20% chance for 1 chain
      if (chainCount === 0 && hasNode(world.purchased, 'T_A')) {
        if (Math.random() < 0.2) effectiveChain = 1;
        else return;
      }
      const boltDmg = (8 + world.level * 0.6) * 0.6 * lightningDamageMult(world);
      const falloff = getLightningFalloff(world);
      chainLightning(world, p.x, p.y, target, boltDmg, effectiveChain, falloff, '#c4e842');
    }
  }
}

export function castFireNova(world: World): void {
  const p = world.player;
  const radius = Math.round((110 + (hasNode(world.purchased, 'F_C1') ? 45 : 0)) * metaSpellRadiusMult(world));
  const burnMult = hasNode(world.purchased, 'F_J') ? 1.5 : 1; // Eternal Flame: +50% burn dmg
  const dmg = (22 + world.level * 0.5) * (hasNode(world.purchased, 'F_E1') ? 1.8 : 1) * spellDamageMult(world);
  world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, color: '#e2793d', life: 0.4, t: 0 });
  // Heat Wave (F_K): extra 30% slow on burning enemies
  const slowAmt = hasNode(world.purchased, 'F_K') ? 0.3 : 0;
  forEachTargetInRange(
    world,
    p.x,
    p.y,
    radius,
    (e) => damageEnemy(world, e, dmg, { burn: true, color: '#e2793d', slow: slowAmt, slowDur: 2 }),
    () => damageBoss(world, world.bossFight!.boss, dmg, { burn: true, color: '#e2793d', slow: slowAmt, slowDur: 2 }),
  );
  if (hasNode(world.purchased, 'F_E2')) {
    // Eternal Flame (F_J) doubles ground burn life; Scorched Earth (F_E2) creates the ground patch.
    const groundLife = hasNode(world.purchased, 'F_J') ? 8 : 4;
    world.effects.push({ type: 'ground', x: p.x, y: p.y, r: radius * 0.8, color: '#e2793d', life: groundLife, t: 0, dmg: 6 * burnMult });
  }
  if (hasNode(world.purchased, 'F_G')) world.player.adrenaline = Math.max(world.player.adrenaline, 1.5);
  burst(world, p.x, p.y, '#e2793d', 20, 180);
}

export function castIceLance(world: World): void {
  const p = world.player;
  const dmg = 16 + world.level * 0.4;
  const dmgMult = spellDamageMult(world);
  const freeze = 1.2 + (hasNode(world.purchased, 'R_C1') ? 1.2 : 0);
  const pierce = 2 + (hasNode(world.purchased, 'R_C2') ? 2 : 0);
  const projSpeed = 420 * projectileSpeedMult(world);
  let ang: number;
  if (world.autoAim) {
    const target = nearestEnemy(world, p.x, p.y);
    if (target) ang = Math.atan2(target.y - p.y, target.x - p.x);
    else if (world.bossFight) ang = Math.atan2(world.bossFight.boss.y - p.y, world.bossFight.boss.x - p.x);
    else ang = p.aimAngle;
  } else {
    ang = p.aimAngle;
  }
  fireProjectile(world, p.x, p.y, Math.cos(ang), Math.sin(ang), projSpeed, dmg * dmgMult, '#8ec9e8', pierce, { freeze, slow: 0.4, r: 6 });

  // Avalanche (R_J): drop ice shards on 3 random enemies near the impact.
  if (hasNode(world.purchased, 'R_J')) {
    const alive = world.enemies.filter((e) => !e.dead);
    for (let i = 0; i < 3 && alive.length > 0; i++) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      const shardDmg = (12 + world.level * 0.3) * dmgMult;
      // Spawn a projectile from above the target
      fireProjectile(world, target.x, target.y - 200, 0, 1, 600, shardDmg, '#8ec9e8', 0, { freeze: 1, slow: 0.4, r: 5 });
      world.effects.push({ type: 'ring', x: target.x, y: target.y, r: 0, maxR: 30, color: '#8ec9e8', life: 0.3, t: 0 });
    }
  }
}

export function castFrostArmor(world: World): void {
  const p = world.player;
  world.cd.frostArmorActive = 5;
  world.flash('FROST ARMOR', 'var(--frost)');
  burst(world, p.x, p.y, '#8ec9e8', 18, 120);
}

export function castArcaneBurst(world: World): void {
  const p = world.player;
  const dmg = (14 + world.level * 0.4) * spellDamageMult(world);
  const n = 10;
  const projSpeed = 340 * projectileSpeedMult(world);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    fireProjectile(world, p.x, p.y, Math.cos(a), Math.sin(a), projSpeed, dmg, '#c7bdf5', 1, {});
  }
  burst(world, p.x, p.y, '#9d8ce0', 16, 140);
}

export function castVines(world: World): void {
  const p = world.player;
  const radius = Math.round((130 + (hasNode(world.purchased, 'N_D') ? 60 : 0)) * metaSpellRadiusMult(world));
  world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, color: '#8bc48a', life: 0.5, t: 0 });
  forEachTargetInRange(
    world,
    p.x,
    p.y,
    radius,
    (e) => {
      e.slowUntil = world.elapsed + 2.5;
      e.slowAmt = Math.max(e.slowAmt, 0.9);
      if (hasNode(world.purchased, 'N_C1')) e.rootBleed = world.elapsed + 2.5;
    },
    () => {
      const boss = world.bossFight!.boss;
      boss.slowUntil = world.elapsed + 2.5;
      boss.slowAmt = Math.max(boss.slowAmt, 0.6); // bosses resist root-slow slightly so fights stay mobile
    },
  );
}

export function castShadowBolt(world: World): void {
  const p = world.player;
  const dmg = (18 + world.level * 0.5) * spellDamageMult(world);
  const projSpeed = 500 * projectileSpeedMult(world);
  let ang: number;
  if (world.autoAim) {
    const target = nearestEnemy(world, p.x, p.y);
    if (target) ang = Math.atan2(target.y - p.y, target.x - p.x);
    else if (world.bossFight) ang = Math.atan2(world.bossFight.boss.y - p.y, world.bossFight.boss.x - p.x);
    else ang = p.aimAngle;
  } else {
    ang = p.aimAngle;
  }
  fireProjectile(world, p.x, p.y, Math.cos(ang), Math.sin(ang), projSpeed, dmg, '#c4728f', 0, { markedBonus: true });
}

// ==================== Lightning branch spells ====================

/** Thunderclap (T_B/T_G): small AoE burst around player, slows enemies. */
export function castThunderclap(world: World): void {
  const p = world.player;
  const baseRadius = 90;
  const radius = Math.round((baseRadius + (hasNode(world.purchased, 'T_G') ? 36 : 0)) * metaSpellRadiusMult(world));
  const dmg = (14 + world.level * 0.4) * lightningDamageMult(world);
  const slowAmt = hasNode(world.purchased, 'T_G') ? 0.3 : 0;
  const slowDur = 1;
  world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, color: '#c4e842', life: 0.35, t: 0 });
  forEachTargetInRange(
    world,
    p.x,
    p.y,
    radius,
    (e) => {
      damageEnemy(world, e, dmg, { color: '#c4e842', slow: slowAmt, slowDur });
      spawnLightningArc(world, p.x, p.y, e.x, e.y, '#c4e842');
    },
    () => {
      damageBoss(world, world.bossFight!.boss, dmg, { color: '#c4e842' });
      spawnLightningArc(world, p.x, p.y, world.bossFight!.boss.x, world.bossFight!.boss.y, '#c4e842');
    },
  );
  burst(world, p.x, p.y, '#c4e842', 12, 100);
  // Ground Current (T_K): leave a charged field
  if (hasNode(world.purchased, 'T_K')) {
    world.effects.push({ type: 'ground', x: p.x, y: p.y, r: radius * 0.8, color: '#c4e842', life: 3, t: 0, dmg: 4 * lightningDamageMult(world) });
  }
}

/** Storm Call (T_C1): strike a random enemy with lightning, AoE around them. */
export function castStormCall(world: World): void {
  const alive = world.enemies.filter((e) => !e.dead);
  if (alive.length === 0 && !world.bossFight) return;
  let target: EnemyState;
  if (alive.length > 0) {
    target = alive[Math.floor(Math.random() * alive.length)];
  } else {
    target = world.bossFight!.boss as unknown as EnemyState;
  }
  const dmg = (16 + world.level * 0.5) * lightningDamageMult(world);
  const aoeRadius = 50;
  // Lightning from sky to target
  spawnLightningArc(world, target.x, target.y - 300, target.x, target.y, '#c4e842');
  world.effects.push({ type: 'ring', x: target.x, y: target.y, r: 0, maxR: aoeRadius, color: '#c4e842', life: 0.3, t: 0 });
  forEachTargetInRange(
    world,
    target.x,
    target.y,
    aoeRadius,
    (e) => damageEnemy(world, e, dmg, { color: '#c4e842' }),
    () => damageBoss(world, world.bossFight!.boss, dmg, { color: '#c4e842' }),
  );
  burst(world, target.x, target.y, '#c4e842', 10, 80);
}

/** Lightning Storm (T_E1): strike 3 random enemies with lightning. */
export function castLightningStorm(world: World): void {
  const alive = world.enemies.filter((e) => !e.dead);
  const count = Math.min(3, alive.length || 1);
  const dmg = (20 + world.level * 0.6) * lightningDamageMult(world);
  for (let i = 0; i < count; i++) {
    let target: EnemyState | null = null;
    if (alive.length > 0) {
      target = alive[Math.floor(Math.random() * alive.length)];
      // Remove from list to avoid hitting same enemy multiple times
      alive.splice(alive.indexOf(target), 1);
    } else if (world.bossFight) {
      target = world.bossFight.boss as unknown as EnemyState;
    }
    if (!target) break;
    const tx = (target as EnemyState).x;
    const ty = (target as EnemyState).y;
    spawnLightningArc(world, tx, ty - 300, tx, ty, '#c4e842');
    world.effects.push({ type: 'ring', x: tx, y: ty, r: 0, maxR: 60, color: '#c4e842', life: 0.3, t: 0 });
    forEachTargetInRange(
      world,
      tx,
      ty,
      60,
      (e) => damageEnemy(world, e, dmg, { color: '#c4e842' }),
      () => damageBoss(world, world.bossFight!.boss, dmg, { color: '#c4e842' }),
    );
    burst(world, tx, ty, '#c4e842', 12, 100);
  }
  world.flash('LIGHTNING STORM', '#c4e842');
}

/** Storm Lord (T_I): chain lightning through all enemies on screen. */
export function castStormLord(world: World): void {
  const p = world.player;
  const alive = world.enemies.filter((e) => !e.dead);
  if (alive.length === 0 && !world.bossFight) return;
  const dmg = (25 + world.level * 0.7) * lightningDamageMult(world);
  // Chain through ALL enemies on screen
  let prevX = p.x, prevY = p.y;
  const hit = new Set<EnemyState>();
  const allTargets = [...alive];
  for (const e of allTargets) {
    if (e.dead) continue;
    hit.add(e);
    spawnLightningArc(world, prevX, prevY, e.x, e.y, '#c4e842');
    damageEnemy(world, e, dmg, { color: '#c4e842' });
    world.effects.push({ type: 'ring', x: e.x, y: e.y, r: 0, maxR: 30, color: '#c4e842', life: 0.2, t: 0 });
    prevX = e.x;
    prevY = e.y;
  }
  // Also hit the boss
  if (world.bossFight) {
    const boss = world.bossFight.boss;
    spawnLightningArc(world, prevX, prevY, boss.x, boss.y, '#c4e842');
    damageBoss(world, boss, dmg, { color: '#c4e842' });
  }
  world.flash('STORM LORD', '#c4e842');
}

/** Thunder Strike (T_L): call down a massive lightning bolt on the nearest enemy. */
export function castThunderStrike(world: World): void {
  const p = world.player;
  const target = nearestEnemy(world, p.x, p.y) || (world.bossFight ? world.bossFight.boss as unknown as EnemyState : null);
  if (!target) return;
  const dmg = (30 + world.level * 0.8) * lightningDamageMult(world);
  const aoeRadius = 80;
  spawnLightningArc(world, target.x, target.y - 400, target.x, target.y, '#c4e842');
  world.effects.push({ type: 'ring', x: target.x, y: target.y, r: 0, maxR: aoeRadius, color: '#c4e842', life: 0.4, t: 0 });
  forEachTargetInRange(
    world,
    target.x,
    target.y,
    aoeRadius,
    (e) => damageEnemy(world, e, dmg, { color: '#c4e842' }),
    () => damageBoss(world, world.bossFight!.boss, dmg, { color: '#c4e842' }),
  );
  burst(world, target.x, target.y, '#c4e842', 20, 140);
}

export function updateWisps(world: World, dt: number): void {
  const want = hasNode(world.purchased, 'N_C2') ? 1 + (hasNode(world.purchased, 'N_E2') ? 1 : 0) : 0;
  while (world.wisps.length < want) world.wisps.push({ angle: Math.random() * Math.PI * 2, cd: 0 });
  while (world.wisps.length > want) world.wisps.pop();
  const p = world.player;
  // Nature's Wrath (N_J): wisps fire 50% faster and pierce 1.
  const wrathMult = hasNode(world.purchased, 'N_J') ? 0.5 : 1;
  const wispPierce = hasNode(world.purchased, 'N_J') ? 1 : 0;
  const wispProjSpeed = 400 * projectileSpeedMult(world);
  world.wisps.forEach((w, i) => {
    w.angle += dt * 1.2;
    w.x = p.x + Math.cos(w.angle + i * 2.4) * 46;
    w.y = p.y + Math.sin(w.angle + i * 2.4) * 46;
    w.cd -= dt;
    if (w.cd <= 0) {
      const interval = 2.2 * (hasNode(world.purchased, 'N_D') ? 0.7 : 1) * cooldownMult(world) * wrathMult;
      w.cd = interval;
      const target = nearestEnemy(world, w.x!, w.y!);
      const dmg = (10 + world.level * 0.3) * spellDamageMult(world);
      if (target) {
        const ang = Math.atan2(target.y - w.y!, target.x - w.x!);
        fireProjectile(world, w.x!, w.y!, Math.cos(ang), Math.sin(ang), wispProjSpeed, dmg, '#8bc48a', wispPierce, {});
      } else if (world.bossFight) {
        const boss = world.bossFight.boss;
        const ang = Math.atan2(boss.y - w.y!, boss.x - w.x!);
        fireProjectile(world, w.x!, w.y!, Math.cos(ang), Math.sin(ang), wispProjSpeed, dmg, '#8bc48a', wispPierce, {});
      }
    }
  });
}

/** Mirrors the reference's updateSpellTimers(dt) — ticks every spell's cooldown and casts when gated node is owned. */
export function updateSpellTimers(world: World, dt: number): void {
  const cm = cooldownMult(world);
  world.cd.bolt -= dt;
  if (world.cd.bolt <= 0) {
    world.cd.bolt = 0.55 * (1 - (hasNode(world.purchased, 'V_A') ? 0.2 : 0)) * cm;
    castBolt(world);
  }

  if (hasNode(world.purchased, 'F_B')) {
    world.cd.fireNova -= dt;
    if (world.cd.fireNova <= 0) {
      world.cd.fireNova = 6 * (1 - (hasNode(world.purchased, 'F_C2') ? 0.25 : 0)) * cm;
      castFireNova(world);
    }
  }
  if (hasNode(world.purchased, 'R_B')) {
    world.cd.iceLance -= dt;
    if (world.cd.iceLance <= 0) {
      world.cd.iceLance = 5 * cm;
      castIceLance(world);
    }
  }
  if (hasNode(world.purchased, 'R_E2')) {
    world.cd.frostArmor -= dt;
    if (world.cd.frostArmor <= 0) {
      world.cd.frostArmor = 14 * cm;
      castFrostArmor(world);
    }
  }
  if (hasNode(world.purchased, 'V_E1')) {
    world.cd.arcaneBurst -= dt;
    if (world.cd.arcaneBurst <= 0) {
      world.cd.arcaneBurst = 8 * cm;
      castArcaneBurst(world);
    }
  }
  if (hasNode(world.purchased, 'N_B')) {
    world.cd.vines -= dt;
    if (world.cd.vines <= 0) {
      world.cd.vines = 10 * cm;
      castVines(world);
    }
  }
  if (hasNode(world.purchased, 'S_B')) {
    world.cd.shadowBolt -= dt;
    if (world.cd.shadowBolt <= 0) {
      world.cd.shadowBolt = 4 * cm;
      castShadowBolt(world);
    }
  }

  // ---------------- Periodic ultimate effects (tier-6/I nodes) ----------------

  // Time Warp (V_I): every 20s, slow all enemies to 40% for 5s.
  if (hasNode(world.purchased, 'V_I')) {
    if (world.cd.timeWarp > 0) {
      world.cd.timeWarp -= dt;
    } else {
      world.cd.timeWarp = 20; // recharge
      world.flash('TIME WARP', '#9d8ce0');
      world.enemies.forEach((e) => {
        if (!e.dead) {
          e.slowUntil = world.elapsed + 5;
          e.slowAmt = Math.max(e.slowAmt, 0.6);
        }
      });
      if (world.bossFight) {
        const boss = world.bossFight.boss;
        boss.slowUntil = world.elapsed + 5;
        boss.slowAmt = Math.max(boss.slowAmt, 0.4);
      }
    }
  }

  // Overgrowth (N_I): every 12s, heal 20% max HP and damage nearby enemies.
  if (hasNode(world.purchased, 'N_I')) {
    if (world.cd.overgrowth > 0) {
      world.cd.overgrowth -= dt;
    } else {
      world.cd.overgrowth = 12;
      healPlayer(world, maxHP(world) * 0.2);
      world.flash('OVERGROWTH', '#8bc48a');
      const radius = 150;
      forEachTargetInRange(
        world,
        world.player.x,
        world.player.y,
        radius,
        (e) => damageEnemy(world, e, 30 + world.level * 0.5, { allowCrit: false }),
        () => damageBoss(world, world.bossFight!.boss, 30 + world.level * 0.5, { allowCrit: false }),
      );
      world.effects.push({ type: 'ring', x: world.player.x, y: world.player.y, r: 0, maxR: radius, color: '#8bc48a', life: 0.5, t: 0 });
    }
  }

  // Shadow Blink (S_I): every 15s, blink to nearest enemy & mark all around.
  if (hasNode(world.purchased, 'S_I')) {
    if (world.cd.shadowBlink > 0) {
      world.cd.shadowBlink -= dt;
    } else {
      world.cd.shadowBlink = 15;
      const target = nearestEnemy(world, world.player.x, world.player.y);
      if (target) {
        world.player.x = target.x + 30;
        world.player.y = target.y + 30;
        world.player.invuln = 0.5;
        world.flash('SHADOW BLINK', '#c4728f');
        world.enemies.forEach((e) => {
          if (!e.dead && dist2(e.x, e.y, target.x, target.y) < 100 * 100) {
            e.marked = world.elapsed + 4;
          }
        });
        burst(world, target.x, target.y, '#c4728f', 20, 180);
      }
    }
  }

  // Eternal Frost (R_I): every 25s, freeze all enemies for 4s.
  if (hasNode(world.purchased, 'R_I')) {
    if (world.cd.eternalFrost > 0) {
      world.cd.eternalFrost -= dt;
    } else {
      world.cd.eternalFrost = 25;
      world.flash('ETERNAL FROST', '#8ec9e8');
      world.enemies.forEach((e) => {
        if (!e.dead) e.frozenUntil = world.elapsed + 4;
      });
      if (world.bossFight) {
        const boss = world.bossFight.boss;
        boss.slowUntil = world.elapsed + 4;
        boss.slowAmt = Math.max(boss.slowAmt, 0.8);
      }
    }
  }

  // Apex Surge (P_I): every 15s, gain +50% dmg & +20% crit for 4s.
  // cd.apexSurge: positive = active (counts down to 0), negative = recharging (counts up to 0).
  // Initial value 0 = first trigger.
  if (hasNode(world.purchased, 'P_I')) {
    if (world.cd.apexSurge > 0) {
      world.cd.apexSurge -= dt;
      if (world.cd.apexSurge < 0) world.cd.apexSurge = -11; // start recharge (11s → total 15s cycle)
    } else if (world.cd.apexSurge === 0) {
      // First trigger or recharge complete — fire the surge.
      world.cd.apexSurge = 4;
      world.flash('APEX SURGE', '#4fd6c0');
    } else {
      // Recharging (negative)
      world.cd.apexSurge += dt;
      if (world.cd.apexSurge > 0) world.cd.apexSurge = 0;
    }
  }

  // Cull (S_J): every 8s, execute low-HP enemies.
  if (hasNode(world.purchased, 'S_J')) {
    if (world.cd.cull > 0) {
      world.cd.cull -= dt;
    } else {
      world.cd.cull = 8;
      world.enemies.forEach((e) => {
        if (e.dead) return;
        const threshold = e.marked > world.elapsed ? 0.3 : 0.2;
        if (e.hp < e.maxHp * threshold) {
          damageEnemy(world, e, e.maxHp, { allowCrit: false, color: '#c4728f' });
          burst(world, e.x, e.y, '#c4728f', 10, 100);
        }
      });
    }
  }

  // Magma Core (Ember Colossus boss ability): passive fire pulse every 8s.
  // Rank scales radius and damage. Rank 1: 120px/20dmg, 2: 140/30, 3: 160/40,
  // 4: 180/55, 5: 200/75. Always applies burn.
  if (hasBossAbility(world, 'emberColossus')) {
    if (world.cd.magmaCore > 0) {
      world.cd.magmaCore -= dt;
    } else {
      world.cd.magmaCore = 8;
      const rank = bossAbilityRank(world, 'emberColossus');
      const radius = [120, 140, 160, 180, 200][rank - 1];
      const baseDmg = [20, 30, 40, 55, 75][rank - 1];
      const dmg = (baseDmg + world.level * 0.8) * spellDamageMult(world);
      world.enemies.forEach((e) => {
        if (!e.dead && dist2(e.x, e.y, world.player.x, world.player.y) < radius * radius) {
          damageEnemy(world, e, dmg, { allowCrit: false, burn: true, color: '#e2793d' });
        }
      });
      if (world.bossFight) {
        const boss = world.bossFight.boss;
        if (dist2(boss.x, boss.y, world.player.x, world.player.y) < radius * radius) {
          damageBoss(world, boss, dmg, { burn: true, color: '#e2793d' });
        }
      }
      world.effects.push({ type: 'ring', x: world.player.x, y: world.player.y, r: 0, maxR: radius, color: '#e2793d', life: 0.4, t: 0 });
      burst(world, world.player.x, world.player.y, '#e2793d', 12, 120, 0.35);
    }
  }

  // ---------------- New AoE abilities (tier-5 L nodes) ----------------

  // Arcane Explosion (F_L): every 6s, a massive arcane burst around the player.
  if (hasNode(world.purchased, 'F_L')) {
    if (world.cd.arcaneExplosion > 0) {
      world.cd.arcaneExplosion -= dt;
    } else {
      world.cd.arcaneExplosion = 6;
      const radius = 160;
      const dmg = (28 + world.level * 0.7) * spellDamageMult(world);
      world.effects.push({ type: 'ring', x: world.player.x, y: world.player.y, r: 0, maxR: radius, color: '#c7bdf5', life: 0.5, t: 0 });
      forEachTargetInRange(
        world,
        world.player.x,
        world.player.y,
        radius,
        (e) => damageEnemy(world, e, dmg, { burn: true, color: '#c7bdf5' }),
        () => damageBoss(world, world.bossFight!.boss, dmg, { burn: true, color: '#c7bdf5' }),
      );
      burst(world, world.player.x, world.player.y, '#c7bdf5', 26, 200);
      world.flash('ARCANE EXPLOSION', '#c7bdf5');
    }
  }

  // Lightning Chain (V_L): every 5s, chain lightning to 3 nearby enemies.
  if (hasNode(world.purchased, 'V_L')) {
    if (world.cd.lightningChain > 0) {
      world.cd.lightningChain -= dt;
    } else {
      world.cd.lightningChain = 5;
      const p = world.player;
      const chainDmg = (12 + world.level * 0.4) * spellDamageMult(world) * 0.6;
      // Find up to 3 nearest enemies and chain lightning between them.
      const sorted = world.enemies
        .filter((e) => !e.dead)
        .map((e) => ({ e, d: dist2(p.x, p.y, e.x, e.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      let prevX = p.x, prevY = p.y;
      for (const { e } of sorted) {
        // Visual: ring effect at each chain target
        world.effects.push({ type: 'ring', x: e.x, y: e.y, r: 0, maxR: 30, color: '#9d8ce0', life: 0.3, t: 0 });
        burst(world, prevX, prevY, '#9d8ce0', 6, 80, 0.2);
        damageEnemy(world, e, chainDmg, { color: '#9d8ce0' });
        prevX = e.x;
        prevY = e.y;
      }
      if (sorted.length > 0) world.flash('LIGHTNING CHAIN', '#9d8ce0');
    }
  }

  // Blizzard (R_L): every 20s, slow ALL enemies on screen to 30% for 5s.
  if (hasNode(world.purchased, 'R_L')) {
    if (world.cd.blizzard > 0) {
      world.cd.blizzard -= dt;
    } else {
      world.cd.blizzard = 20;
      world.flash('BLIZZARD', '#b8d8f0');
      world.enemies.forEach((e) => {
        if (!e.dead) {
          e.slowUntil = world.elapsed + 5;
          e.slowAmt = Math.max(e.slowAmt, 0.7);
        }
      });
      if (world.bossFight) {
        const boss = world.bossFight.boss;
        boss.slowUntil = world.elapsed + 5;
        boss.slowAmt = Math.max(boss.slowAmt, 0.5);
      }
    }
  }

  // Earthquake (B_L): every 15s, stun all enemies in a large radius for 2s.
  if (hasNode(world.purchased, 'B_L')) {
    if (world.cd.earthquake > 0) {
      world.cd.earthquake -= dt;
    } else {
      world.cd.earthquake = 15;
      const radius = 200;
      world.flash('EARTHQUAKE', '#c9a869');
      world.effects.push({ type: 'ring', x: world.player.x, y: world.player.y, r: 0, maxR: radius, color: '#c9a869', life: 0.6, t: 0 });
      world.enemies.forEach((e) => {
        if (!e.dead && dist2(e.x, e.y, world.player.x, world.player.y) < radius * radius) {
          // Stun = freeze for 2 seconds
          e.frozenUntil = world.elapsed + 2;
          damageEnemy(world, e, 20 + world.level * 0.5, { allowCrit: false, color: '#c9a869' });
        }
      });
      if (world.bossFight) {
        const boss = world.bossFight.boss;
        if (dist2(boss.x, boss.y, world.player.x, world.player.y) < radius * radius) {
          boss.slowUntil = world.elapsed + 2;
          boss.slowAmt = Math.max(boss.slowAmt, 0.8);
          damageBoss(world, boss, 20 + world.level * 0.5, { color: '#c9a869' });
        }
      }
      burst(world, world.player.x, world.player.y, '#c9a869', 24, 220);
    }
  }

  // Spore Burst (N_L): every 8s, toxic spores erupt around the player.
  if (hasNode(world.purchased, 'N_L')) {
    if (world.cd.sporeBurst > 0) {
      world.cd.sporeBurst -= dt;
    } else {
      world.cd.sporeBurst = 8;
      const radius = 140;
      const dmg = (18 + world.level * 0.5) * spellDamageMult(world);
      world.effects.push({ type: 'ring', x: world.player.x, y: world.player.y, r: 0, maxR: radius, color: '#8bc48a', life: 0.5, t: 0 });
      forEachTargetInRange(
        world,
        world.player.x,
        world.player.y,
        radius,
        (e) => {
          damageEnemy(world, e, dmg, { burn: true, color: '#8bc48a' });
          e.slowUntil = world.elapsed + 3;
          e.slowAmt = Math.max(e.slowAmt, 0.3);
        },
        () => damageBoss(world, world.bossFight!.boss, dmg, { burn: true, color: '#8bc48a' }),
      );
      burst(world, world.player.x, world.player.y, '#8bc48a', 22, 180);
      world.flash('SPORE BURST', '#8bc48a');
    }
  }

  // Shadow Nova (S_L): every 10s, shadow energy marks and damages all in radius.
  if (hasNode(world.purchased, 'S_L')) {
    if (world.cd.shadowNova > 0) {
      world.cd.shadowNova -= dt;
    } else {
      world.cd.shadowNova = 10;
      const radius = 170;
      const dmg = (22 + world.level * 0.5) * spellDamageMult(world);
      world.effects.push({ type: 'ring', x: world.player.x, y: world.player.y, r: 0, maxR: radius, color: '#c4728f', life: 0.5, t: 0 });
      forEachTargetInRange(
        world,
        world.player.x,
        world.player.y,
        radius,
        (e) => {
          damageEnemy(world, e, dmg, { color: '#c4728f' });
          e.marked = world.elapsed + 4;
        },
        () => {
          damageBoss(world, world.bossFight!.boss, dmg, { color: '#c4728f' });
          world.bossFight!.boss.marked = world.elapsed + 4;
        },
      );
      burst(world, world.player.x, world.player.y, '#c4728f', 24, 200);
      world.flash('SHADOW NOVA', '#c4728f');
    }
  }

  // Whirlwind Strike (P_L): every 7s, cyclone strikes all nearby enemies.
  if (hasNode(world.purchased, 'P_L')) {
    if (world.cd.whirlwindStrike > 0) {
      world.cd.whirlwindStrike -= dt;
    } else {
      world.cd.whirlwindStrike = 7;
      const radius = 120;
      const dmg = (25 + world.level * 0.6) * spellDamageMult(world);
      world.effects.push({ type: 'ring', x: world.player.x, y: world.player.y, r: 0, maxR: radius, color: '#4fd6c0', life: 0.4, t: 0 });
      forEachTargetInRange(
        world,
        world.player.x,
        world.player.y,
        radius,
        (e) => damageEnemy(world, e, dmg, { color: '#4fd6c0' }),
        () => damageBoss(world, world.bossFight!.boss, dmg, { color: '#4fd6c0' }),
      );
      burst(world, world.player.x, world.player.y, '#4fd6c0', 20, 160);
      world.flash('WHIRLWIND', '#4fd6c0');
    }
  }

  // ==================== Lightning branch timers ====================

  // Thunderclap (T_B): small AoE burst around player every 3s.
  if (hasNode(world.purchased, 'T_B')) {
    if (world.cd.thunderclap > 0) {
      world.cd.thunderclap -= dt;
    } else {
      world.cd.thunderclap = 3 * cm;
      castThunderclap(world);
    }
  }

  // Storm Call (T_C1): every 4s (or 2s with Conductor T_E2), strike a random enemy.
  if (hasNode(world.purchased, 'T_C1')) {
    if (world.cd.stormCall > 0) {
      world.cd.stormCall -= dt;
    } else {
      world.cd.stormCall = (hasNode(world.purchased, 'T_E2') ? 2 : 4) * cm;
      castStormCall(world);
    }
  }

  // Lightning Storm (T_E1): every 8s, strike 3 random enemies.
  if (hasNode(world.purchased, 'T_E1')) {
    if (world.cd.lightningStorm > 0) {
      world.cd.lightningStorm -= dt;
    } else {
      world.cd.lightningStorm = 8 * cm;
      castLightningStorm(world);
    }
  }

  // Thunder Strike (T_L): every 5s, call down a massive bolt on the nearest enemy.
  if (hasNode(world.purchased, 'T_L')) {
    if (world.cd.thunderStrike > 0) {
      world.cd.thunderStrike -= dt;
    } else {
      world.cd.thunderStrike = 5 * cm;
      castThunderStrike(world);
    }
  }

  // Storm Lord (T_I): every 10s, chain lightning through all enemies on screen.
  if (hasNode(world.purchased, 'T_I')) {
    if (world.cd.stormLord > 0) {
      world.cd.stormLord -= dt;
    } else {
      world.cd.stormLord = 10;
      castStormLord(world);
    }
  }

  // ==================== Wind branch timers ====================

  // Wind Gust (W_B): periodic knockback AoE every 4s (or continuous aura with W_L).
  if (hasNode(world.purchased, 'W_B')) {
    if (hasNode(world.purchased, 'W_L')) {
      // Infinity Gust (W_L): continuous aura — apply every frame.
      castWindGustAura(world, dt);
    } else {
      const gustCd = 4 * (hasNode(world.purchased, 'W_E2') ? 0.7 : 1) * cm;
      if (world.cd.windGust > 0) {
        world.cd.windGust -= dt;
      } else {
        world.cd.windGust = gustCd;
        castWindGust(world);
      }
    }
  }

  // Vortex (W_D): every 6s, pull enemies toward player and damage them.
  if (hasNode(world.purchased, 'W_D')) {
    const vortexCd = 6 * (hasNode(world.purchased, 'W_E2') ? 0.7 : 1) * cm;
    if (world.cd.vortex > 0) {
      world.cd.vortex -= dt;
    } else {
      world.cd.vortex = vortexCd;
      castVortex(world);
    }
  }

  // Cataclysm (W_F): every 12s, summon a massive tornado.
  if (hasNode(world.purchased, 'W_F')) {
    if (world.cd.cataclysm > 0) {
      world.cd.cataclysm -= dt;
    } else {
      world.cd.cataclysm = 12;
      castCataclysm(world);
    }
  }

  // Update active tornadoes.
  updateTornadoes(world, dt);

  // Tailwind (W_A): wind trail damage behind the player.
  if (hasNode(world.purchased, 'W_A')) {
    updateWindTrail(world, dt);
  }

  updateWisps(world, dt);
}

// ==================== Wind branch spells ====================

/** Wind trail accumulator (W_A). */
let windTrailAccum = 0;

/** Tailwind (W_A): spawn damaging wind trail particles behind the player. */
function updateWindTrail(world: World, dt: number): void {
  const p = world.player;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed < 20) return;
  windTrailAccum += dt;
  if (windTrailAccum < 0.1) return;
  windTrailAccum = 0;
  // Spawn a brief ground effect behind the player.
  const ang = Math.atan2(p.vy, p.vx);
  const tx = p.x - Math.cos(ang) * 20;
  const ty = p.y - Math.sin(ang) * 20;
  world.effects.push({ type: 'ground', x: tx, y: ty, r: 18, color: '#a8d4e8', life: 0.5, t: 0, dmg: 5 + world.level * 0.2 });
}

/** Wind Gust (W_B): knockback AoE around the player with light damage. */
export function castWindGust(world: World): void {
  const p = world.player;
  let radius = 100;
  if (hasNode(world.purchased, 'W_C1')) radius *= 1.4; // Cyclone: +40% radius
  let dmg = 10 + world.level * 0.3;
  if (hasNode(world.purchased, 'W_C2')) dmg *= 1.8; // Gale Force: +80% damage
  const knockbackDist = hasNode(world.purchased, 'W_C2') ? 80 : 40; // Gale Force: doubled knockback
  const slowOnHit = hasNode(world.purchased, 'W_C1'); // Cyclone: slow on knockback
  world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, color: '#a8d4e8', life: 0.35, t: 0 });
  forEachTargetInRange(
    world,
    p.x,
    p.y,
    radius,
    (e) => {
      damageEnemy(world, e, dmg * spellDamageMult(world), { color: '#a8d4e8' });
      // Knockback
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      e.x = Math.max(5, Math.min(world.W - 5, e.x + Math.cos(ang) * knockbackDist));
      e.y = Math.max(5, Math.min(world.H - 5, e.y + Math.sin(ang) * knockbackDist));
      if (slowOnHit) {
        e.slowUntil = world.elapsed + 1.5;
        e.slowAmt = Math.max(e.slowAmt, 0.3);
      }
    },
    () => {
      damageBoss(world, world.bossFight!.boss, dmg * spellDamageMult(world), { color: '#a8d4e8' });
    },
  );
  burst(world, p.x, p.y, '#a8d4e8', 14, 120);
}

/** Infinity Gust (W_L): continuous pushback aura — enemies near the player are constantly pushed back and damaged. */
function castWindGustAura(world: World, _dt: number): void {
  const p = world.player;
  let radius = 100;
  if (hasNode(world.purchased, 'W_C1')) radius *= 1.4;
  let dmg = (10 + world.level * 0.3) * _dt * 2; // continuous damage per frame
  if (hasNode(world.purchased, 'W_C2')) dmg *= 1.8;
  const pushForce = hasNode(world.purchased, 'W_C2') ? 120 * _dt : 60 * _dt;
  const slowOnHit = hasNode(world.purchased, 'W_C1');
  world.enemies.forEach((e) => {
    if (e.dead) return;
    const d2 = dist2(p.x, p.y, e.x, e.y);
    if (d2 < radius * radius) {
      damageEnemy(world, e, dmg * spellDamageMult(world), { color: '#a8d4e8', allowCrit: false });
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      e.x = Math.max(5, Math.min(world.W - 5, e.x + Math.cos(ang) * pushForce));
      e.y = Math.max(5, Math.min(world.H - 5, e.y + Math.sin(ang) * pushForce));
      if (slowOnHit) {
        e.slowUntil = world.elapsed + 0.5;
        e.slowAmt = Math.max(e.slowAmt, 0.3);
      }
    }
  });
  if (world.bossFight) {
    const boss = world.bossFight.boss;
    if (dist2(p.x, p.y, boss.x, boss.y) < radius * radius) {
      damageBoss(world, boss, dmg * spellDamageMult(world), { color: '#a8d4e8', allowCrit: false });
    }
  }
}

/** Vortex (W_D): pull enemies toward the player and damage them. */
export function castVortex(world: World): void {
  const p = world.player;
  let radius = 160;
  if (hasNode(world.purchased, 'W_E1')) radius *= 1.5; // Zephyr: +50% radius
  const pullSpeed = hasNode(world.purchased, 'W_E1') ? 1.4 : 1; // Zephyr: 40% faster pull
  const dmg = (14 + world.level * 0.4) * spellDamageMult(world);
  world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, color: '#a8d4e8', life: 0.5, t: 0 });
  forEachTargetInRange(
    world,
    p.x,
    p.y,
    radius,
    (e) => {
      damageEnemy(world, e, dmg, { color: '#a8d4e8' });
      // Pull toward player
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      const pullDist = Math.sqrt(dist2(p.x, p.y, e.x, e.y)) * 0.4 * pullSpeed;
      e.x = Math.max(5, Math.min(world.W - 5, e.x + Math.cos(ang) * pullDist));
      e.y = Math.max(5, Math.min(world.H - 5, e.y + Math.sin(ang) * pullDist));
    },
    () => {
      damageBoss(world, world.bossFight!.boss, dmg, { color: '#a8d4e8' });
    },
  );
  burst(world, p.x, p.y, '#a8d4e8', 18, 160);
}

/** Cataclysm (W_F): summon a massive tornado that sweeps across the screen. */
export function castCataclysm(world: World): void {
  // Tornado sweeps horizontally across the screen at a random height.
  const startY = 80 + Math.random() * (world.H - 160);
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -80 : world.W + 80;
  const vx = fromLeft ? 120 : -120;
  let life = 6; // base duration: sweeps ~6 seconds
  if (hasNode(world.purchased, 'W_I')) life *= 1.5; // Hurricane: +50% duration
  const baseR = 50;
  const tornado: TornadoState = {
    x: startX,
    y: startY,
    vx,
    vy: 0,
    r: baseR,
    life,
    t: 0,
    maxLife: life,
  };
  world.tornadoes.push(tornado);
  world.flash('CATACLYSM', '#a8d4e8');
  burst(world, startX, startY, '#a8d4e8', 30, 200);
}

/** Update all active tornadoes — move them, damage/pull enemies, grow over time. */
export function updateTornadoes(world: World, dt: number): void {
  const hasEyeOfStorm = hasNode(world.purchased, 'W_J');
  const hasHurricane = hasNode(world.purchased, 'W_I');
  for (let i = world.tornadoes.length - 1; i >= 0; i--) {
    const tor = world.tornadoes[i];
    tor.t += dt;
    tor.x += tor.vx * dt;
    // Slight vertical drift for visual interest
    tor.y += Math.sin(tor.t * 2) * 20 * dt;
    // Hurricane (W_I): grow larger over time
    if (hasHurricane) {
      tor.r = 50 + (tor.t / tor.maxLife) * 40;
    }
    // Eye of the Storm (W_J): while tornado active, player gets +50% speed and invuln
    if (hasEyeOfStorm) {
      world.player.invuln = Math.max(world.player.invuln, 0.2);
    }
    // Damage and pull enemies in the tornado's radius
    const dmg = (20 + world.level * 0.5) * dt * 3; // continuous damage
    world.enemies.forEach((e) => {
      if (e.dead) return;
      const d2 = dist2(tor.x, tor.y, e.x, e.y);
      if (d2 < tor.r * tor.r) {
        damageEnemy(world, e, dmg * spellDamageMult(world), { color: '#a8d4e8', allowCrit: false });
        // Pull enemies toward the tornado center
        const ang = Math.atan2(tor.y - e.y, tor.x - e.x);
        const pullDist = 60 * dt;
        e.x += Math.cos(ang) * pullDist;
        e.y += Math.sin(ang) * pullDist;
      }
    });
    // Damage boss if in range
    if (world.bossFight) {
      const boss = world.bossFight.boss;
      if (dist2(tor.x, tor.y, boss.x, boss.y) < tor.r * tor.r) {
        damageBoss(world, boss, dmg * spellDamageMult(world), { color: '#a8d4e8', allowCrit: false });
      }
    }
    // Visual effect
    if (Math.floor(tor.t * 6) !== Math.floor((tor.t - dt) * 6)) {
      world.effects.push({ type: 'ring', x: tor.x, y: tor.y, r: 0, maxR: tor.r, color: '#a8d4e8', life: 0.3, t: 0 });
    }
    // Remove when expired or off-screen
    if (tor.t >= tor.life || tor.x < -120 || tor.x > world.W + 120) {
      world.tornadoes.splice(i, 1);
    }
  }
}

/** Check if any tornado is currently active (used by Eye of the Storm). */
export function hasActiveTornado(world: World): boolean {
  return world.tornadoes.length > 0;
}

/** Deflecting Winds (W_K): 20% chance to deflect enemy projectiles. Called from boss projectile collision. */
export function tryDeflectProjectile(world: World, px: number, py: number, _prvx: number, _prvy: number): boolean {
  if (!hasNode(world.purchased, 'W_K')) return false;
  if (Math.random() < 0.2) {
    // Spawn a visual deflection effect
    world.effects.push({ type: 'ring', x: px, y: py, r: 0, maxR: 20, color: '#a8d4e8', life: 0.2, t: 0 });
    return true;
  }
  return false;
}
