/** All spell cast functions & their cooldown update loop, ported from reference/full-reference.html */
import type { EnemyState, Projectile, World } from './types';
import { cooldownMult, spellDamageMult, projectileSpeedMult, healPlayer, maxHP } from './player';
import { hasNode } from './skillTree';
import { damageEnemy, damageBoss } from './combat';
import { burst } from './visuals';
import { hasBossAbility } from './metaProgression';

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
}

export function castFireNova(world: World): void {
  const p = world.player;
  const radius = 110 + (hasNode(world.purchased, 'F_C1') ? 45 : 0);
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
  const radius = 130 + (hasNode(world.purchased, 'N_D') ? 60 : 0);
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
  if (hasBossAbility(world, 'emberColossus')) {
    if (world.cd.magmaCore > 0) {
      world.cd.magmaCore -= dt;
    } else {
      world.cd.magmaCore = 8;
      const radius = 100;
      const dmg = (20 + world.level * 0.8) * spellDamageMult(world);
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

  updateWisps(world, dt);
}
