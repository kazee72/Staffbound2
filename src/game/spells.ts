/** All spell cast functions & their cooldown update loop, ported from reference/full-reference.html */
import type { EnemyState, Projectile, World } from './types';
import { cooldownMult } from './player';
import { hasNode } from './skillTree';
import { damageEnemy } from './combat';
import { burst } from './visuals';

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

interface ProjOpts {
  r?: number;
  homing?: boolean;
  life?: number;
  burn?: boolean;
  slow?: number;
  freeze?: number;
  mini?: boolean;
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
  };
  world.projectiles.push(pr);
}

export function castBolt(world: World): void {
  const p = world.player;
  const count = 1 + (hasNode(world.purchased, 'V_B') ? 1 : 0);
  world.cd.boltCastCount++;
  const empowered = hasNode(world.purchased, 'V_D') && world.cd.boltCastCount % 5 === 0;
  for (let i = 0; i < count; i++) {
    const target = nearestEnemy(world, p.x, p.y);
    if (!target) break;
    const ang = Math.atan2(target.y - p.y, target.x - p.x) + (i - (count - 1) / 2) * 0.18;
    let dmg = 8 + world.level * 0.6;
    if (hasNode(world.purchased, 'F_A')) dmg *= 1.2;
    if (empowered) dmg *= 3;
    fireProjectile(world, p.x, p.y, Math.cos(ang), Math.sin(ang), 480, dmg, '#9d8ce0', hasNode(world.purchased, 'V_C1') ? 1 : 0, {
      homing: hasNode(world.purchased, 'V_C2'),
      burn: hasNode(world.purchased, 'F_A'),
      slow: hasNode(world.purchased, 'R_A') ? 0.2 : 0,
    });
    if (empowered && hasNode(world.purchased, 'V_F')) {
      for (let k = 0; k < 4; k++) {
        const a2 = Math.random() * Math.PI * 2;
        fireProjectile(world, p.x, p.y, Math.cos(a2), Math.sin(a2), 380, dmg * 0.4, '#c7bdf5', 0, { homing: true, mini: true });
      }
    }
  }
  if (hasNode(world.purchased, 'V_G') && Math.random() < 0.1) world.cd.bolt = 0;
}

export function castFireNova(world: World): void {
  const p = world.player;
  const radius = 110 + (hasNode(world.purchased, 'F_C1') ? 45 : 0);
  const dmg = (22 + world.level * 0.5) * (hasNode(world.purchased, 'F_E1') ? 1.8 : 1);
  world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, color: '#e2793d', life: 0.4, t: 0 });
  world.enemies.forEach((e) => {
    if (!e.dead && dist2(e.x, e.y, p.x, p.y) < radius * radius) damageEnemy(world, e, dmg, { burn: true, color: '#e2793d' });
  });
  if (hasNode(world.purchased, 'F_E2')) {
    world.effects.push({ type: 'ground', x: p.x, y: p.y, r: radius * 0.8, color: '#e2793d', life: 4, t: 0, dmg: 6 });
  }
  if (hasNode(world.purchased, 'F_G')) world.player.adrenaline = Math.max(world.player.adrenaline, 1.5);
  burst(world, p.x, p.y, '#e2793d', 20, 180);
}

export function castIceLance(world: World): void {
  const p = world.player;
  const target = nearestEnemy(world, p.x, p.y);
  if (!target) return;
  const dmg = 16 + world.level * 0.4;
  const freeze = 1.2 + (hasNode(world.purchased, 'R_C1') ? 1.2 : 0);
  const pierce = 2 + (hasNode(world.purchased, 'R_C2') ? 2 : 0);
  const ang = Math.atan2(target.y - p.y, target.x - p.x);
  fireProjectile(world, p.x, p.y, Math.cos(ang), Math.sin(ang), 420, dmg, '#8ec9e8', pierce, { freeze, slow: 0.4, r: 6 });
}

export function castFrostArmor(world: World): void {
  const p = world.player;
  world.cd.frostArmorActive = 5;
  world.flash('FROST ARMOR', 'var(--frost)');
  burst(world, p.x, p.y, '#8ec9e8', 18, 120);
}

export function castArcaneBurst(world: World): void {
  const p = world.player;
  const dmg = 14 + world.level * 0.4;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    fireProjectile(world, p.x, p.y, Math.cos(a), Math.sin(a), 340, dmg, '#c7bdf5', 1, {});
  }
  burst(world, p.x, p.y, '#9d8ce0', 16, 140);
}

export function castVines(world: World): void {
  const p = world.player;
  const radius = 130 + (hasNode(world.purchased, 'N_D') ? 60 : 0);
  world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: radius, color: '#8bc48a', life: 0.5, t: 0 });
  world.enemies.forEach((e) => {
    if (!e.dead && dist2(e.x, e.y, p.x, p.y) < radius * radius) {
      e.slowUntil = world.elapsed + 2.5;
      e.slowAmt = Math.max(e.slowAmt, 0.9);
      if (hasNode(world.purchased, 'N_C1')) e.rootBleed = world.elapsed + 2.5;
    }
  });
}

export function castShadowBolt(world: World): void {
  const p = world.player;
  const target = nearestEnemy(world, p.x, p.y);
  if (!target) return;
  let dmg = 18 + world.level * 0.5;
  if (target.marked > world.elapsed) dmg *= 2;
  const ang = Math.atan2(target.y - p.y, target.x - p.x);
  fireProjectile(world, p.x, p.y, Math.cos(ang), Math.sin(ang), 500, dmg, '#c4728f', 0, {});
}

export function updateWisps(world: World, dt: number): void {
  const want = hasNode(world.purchased, 'N_C2') ? 1 + (hasNode(world.purchased, 'N_E2') ? 1 : 0) : 0;
  while (world.wisps.length < want) world.wisps.push({ angle: Math.random() * Math.PI * 2, cd: 0 });
  while (world.wisps.length > want) world.wisps.pop();
  const p = world.player;
  world.wisps.forEach((w, i) => {
    w.angle += dt * 1.2;
    w.x = p.x + Math.cos(w.angle + i * 2.4) * 46;
    w.y = p.y + Math.sin(w.angle + i * 2.4) * 46;
    w.cd -= dt;
    if (w.cd <= 0) {
      const interval = 2.2 * (hasNode(world.purchased, 'N_D') ? 0.7 : 1) * cooldownMult(world);
      w.cd = interval;
      const target = nearestEnemy(world, w.x!, w.y!);
      if (target) {
        const ang = Math.atan2(target.y - w.y!, target.x - w.x!);
        fireProjectile(world, w.x!, w.y!, Math.cos(ang), Math.sin(ang), 400, 10 + world.level * 0.3, '#8bc48a', 0, {});
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
  updateWisps(world, dt);
}
