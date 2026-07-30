/** Core per-frame simulation update functions, ported from reference/full-reference.html */
import type { World } from './types';
import { damageReduction, dashCooldownMax, healPlayer, maxHP, moveSpeed, regenPerSec } from './player';
import { hasNode } from './skillTree';
import { damageEnemy } from './combat';
import { nearestEnemy } from './spells';
import { burst } from './visuals';

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
function dist2(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/**
 * Player movement + regen + timers.
 * NOTE: the reference used a flat 1000 accel / 0.86-per-frame friction with
 * no explicit speed cap (the cap emerges naturally from the accel/friction
 * balance near ~230px/s, which is why moveSpeed() exists as a *stat*, used
 * only by Warden speed nodes/adrenaline elsewhere — kept as in reference,
 * the raw accel/friction sim itself is left unclamped exactly like the
 * source to preserve identical movement feel).
 */
export function updatePlayer(world: World, input: InputState, dt: number): void {
  const p = world.player;
  let ax = 0;
  let ay = 0;
  if (input.left) ax -= 1;
  if (input.right) ax += 1;
  if (input.up) ay -= 1;
  if (input.down) ay += 1;
  const len = Math.hypot(ax, ay) || 1;
  const accel = 1000;
  p.vx += (ax / len) * accel * dt;
  p.vy += (ay / len) * accel * dt;
  p.vx *= 0.86;
  p.vy *= 0.86;
  p.x = clamp(p.x + p.vx * dt, 14, world.W - 14);
  p.y = clamp(p.y + p.vy * dt, 14, world.H - 14);
  if (Math.hypot(p.vx, p.vy) > 8) {
    const l = Math.hypot(p.vx, p.vy);
    p.facing = { x: p.vx / l, y: p.vy / l };
  }
  if (p.invuln > 0) p.invuln -= dt;
  if (p.dashing > 0) p.dashing -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.adrenaline > 0) p.adrenaline -= dt;
  if (p.undyingCd > 0) p.undyingCd -= dt;
  healPlayer(world, regenPerSec(world) * dt);
  if (world.cd.frostArmorActive > 0) world.cd.frostArmorActive -= dt;
  // moveSpeed() is referenced by Warden-branch nodes conceptually; the raw
  // accel/friction values above already match the reference's feel 1:1, so
  // moveSpeed() itself is surfaced to callers/UI (dash indicator etc.) but
  // not re-applied here to avoid double-scaling versus the source.
  void moveSpeed;
}

export function tryDash(world: World): void {
  const p = world.player;
  if (p.dashCd > 0) return;
  let dx = p.vx;
  let dy = p.vy;
  if (Math.hypot(dx, dy) < 10) {
    dx = p.facing.x;
    dy = p.facing.y;
  }
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const dist = 150;
  const startX = p.x;
  const startY = p.y;
  p.x = clamp(p.x + dx * dist, 16, world.W - 16);
  p.y = clamp(p.y + dy * dist, 16, world.H - 16);
  p.invuln = 0.28;
  p.dashing = 0.18;
  p.dashCd = dashCooldownMax(world);
  if (hasNode(world.purchased, 'B_D')) p.adrenaline = 3;
  burst(world, startX, startY, '#c9a869', 10, 80);
  if (hasNode(world.purchased, 'S_C2')) {
    world.decoys.push({ x: startX, y: startY, t: 0.6, boosted: hasNode(world.purchased, 'S_E2') });
  }
}

export function damagePlayer(world: World, amount: number): void {
  const p = world.player;
  p.hp -= amount;
  if (p.hp <= 0) {
    if (hasNode(world.purchased, 'B_F') && p.undyingCd <= 0) {
      p.hp = 1;
      p.undyingCd = 60;
      p.invuln = 1.5;
      world.flash('UNDYING', 'var(--gold-bright)');
    } else {
      p.hp = 0;
      world.running = false;
    }
  }
}

export function updateProjectiles(world: World, dt: number): void {
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const pr = world.projectiles[i];
    if (pr.homing) {
      const t = nearestEnemy(world, pr.x, pr.y);
      if (t) {
        const ang = Math.atan2(t.y - pr.y, t.x - pr.x);
        const curAng = Math.atan2(pr.vy, pr.vx);
        let diff = ang - curAng;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const turn = clamp(diff, -3 * dt, 3 * dt);
        const na = curAng + turn;
        const spd = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(na) * spd;
        pr.vy = Math.sin(na) * spd;
      }
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    let hit = false;
    for (const e of world.enemies) {
      if (e.dead) continue;
      if (dist2(pr.x, pr.y, e.x, e.y) < (pr.r + e.r) * (pr.r + e.r)) {
        damageEnemy(world, e, pr.dmg, { burn: pr.burn, slow: pr.slow, freeze: pr.freeze, color: pr.color });
        hit = true;
        if (pr.pierce > 0) {
          pr.pierce--;
        } else {
          world.projectiles.splice(i, 1);
        }
        break;
      }
    }
    if (!hit && (pr.life <= 0 || pr.x < -50 || pr.x > world.W + 50 || pr.y < -50 || pr.y > world.H + 50)) {
      world.projectiles.splice(i, 1);
    }
  }
}

export function updateDecoys(world: World, dt: number): void {
  for (let i = world.decoys.length - 1; i >= 0; i--) {
    const d = world.decoys[i];
    d.t -= dt;
    if (d.t <= 0) {
      const dmg = 25 * (1 + world.level * 0.03) * (d.boosted ? 1.6 : 1);
      world.enemies.forEach((e) => {
        if (!e.dead && dist2(e.x, e.y, d.x, d.y) < 95 * 95) damageEnemy(world, e, dmg, { allowCrit: false });
      });
      burst(world, d.x, d.y, '#c4728f', 20, 180);
      world.decoys.splice(i, 1);
    }
  }
}

export function updateEnemies(world: World, dt: number): void {
  const p = world.player;
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.dead) {
      world.enemies.splice(i, 1);
      continue;
    }
    let spd = e.spd;
    if (e.slowUntil > world.elapsed) spd *= 1 - e.slowAmt;
    if (e.frozenUntil > world.elapsed) spd = 0;
    if (e.rootBleed && e.rootBleed > world.elapsed) damageEnemy(world, e, 4 * dt, { allowCrit: false });
    if (e.burning > world.elapsed) damageEnemy(world, e, 3 * dt, { allowCrit: false });

    if (e.isBoss) {
      e.stompT = (e.stompT ?? 4) - dt;
      if (e.stompT <= 1 && (e.telegraph ?? 0) <= 0) e.telegraph = 1;
      if ((e.telegraph ?? 0) > 0) {
        e.telegraph = (e.telegraph ?? 0) - dt;
        if (e.telegraph <= 0) {
          if (dist2(p.x, p.y, e.x, e.y) < 150 * 150 && p.invuln <= 0) damagePlayer(world, e.dmg * 1.3);
          world.effects.push({ type: 'ring', x: e.x, y: e.y, r: 0, maxR: 150, color: '#c4728f', life: 0.3, t: 0 });
          e.stompT = 4;
        }
      }
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dl = Math.hypot(dx, dy) || 1;
    let mx = dx / dl;
    let my = dy / dl;
    if (e.wobble) {
      const wob = Math.sin(world.elapsed * 6 + e.seed) * 0.6;
      mx += -my * wob;
      my += mx * wob;
    }
    e.x += mx * spd * dt;
    e.y += my * spd * dt;

    const pr2 = (p.r || 13) + e.r;
    if (dist2(p.x, p.y, e.x, e.y) < pr2 * pr2 && p.invuln <= 0 && p.dashing <= 0) {
      damagePlayer(world, e.dmg * dt * (1 - damageReduction(world)));
    }
  }
}

export function updateEffects(world: World, dt: number): void {
  for (let i = world.effects.length - 1; i >= 0; i--) {
    const fx = world.effects[i];
    fx.t += dt;
    if (fx.type === 'ground') {
      if (Math.floor(fx.t * 4) !== Math.floor((fx.t - dt) * 4)) {
        world.enemies.forEach((e) => {
          if (!e.dead && dist2(e.x, e.y, fx.x, fx.y) < fx.r * fx.r) {
            damageEnemy(world, e, fx.dmg * 0.25, { allowCrit: false, burn: true });
          }
        });
      }
    }
    if (fx.t >= fx.life) world.effects.splice(i, 1);
  }
}

export function updateParticles(world: World, dt: number): void {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.popups.length - 1; i >= 0; i--) {
    const u = world.popups[i];
    u.y += u.vy * dt * 0.02 * 60;
    u.life -= dt;
    if (u.life <= 0) world.popups.splice(i, 1);
  }
}

export function maxHPStat(world: World): number {
  return maxHP(world);
}
