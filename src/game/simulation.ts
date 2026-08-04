/** Core per-frame simulation update functions, ported from reference/full-reference.html */
import type { World, EnemyState } from './types';
import { damageReduction, dashCooldownMax, gainXP, healPlayer, maxHP, moveSpeed, regenPerSec } from './player';
import { hasNode } from './skillTree';
import { damageEnemy, damageBoss } from './combat';
import { nearestEnemy } from './spells';
import { burst } from './visuals';
import { updateBoss } from './bosses';
import { addRunEssence, essenceForBossKill, metaDashDistMult, hasBossAbility, bossAbilityRank } from './metaProgression';
import { getStageDef, BOSS_ABILITY_BY_BOSS } from './stages';

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
  // Scale accel by the moveSpeed() stat's ratio versus its 230 baseline, so
  // move-speed nodes (Warden's Traveler's Legs/Momentum, Potency's Fleet
  // Step/Windswept/Apex) produce a real, visible speed change while
  // preserving the exact original accel/friction feel when no such node is
  // owned (ratio === 1 with zero nodes purchased).
  const accel = 1000 * (moveSpeed(world) / 230);
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
  // Fortress (B_I): track time spent stationary for damage reduction.
  if (Math.hypot(p.vx, p.vy) < 8) p.stillTime += dt;
  else p.stillTime = 0;
  // Second Skin (B_K): the brief invuln is granted in damagePlayer; it
  // naturally decays here via the invuln countdown above.
  healPlayer(world, regenPerSec(world) * dt);
  if (world.cd.frostArmorActive > 0) world.cd.frostArmorActive -= dt;
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
  const dist = 150 * metaDashDistMult(world);
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
  // Spectral Step (Elder Wraith boss ability): dash leaves a fire trail
  // along the dash path that damages and burns enemies it passes through.
  // Rank scales: 1=15dmg, 2=25, 3=35, 4=45, 5=60.
  if (hasBossAbility(world, 'elderWraith')) {
    const rank = bossAbilityRank(world, 'elderWraith');
    const trailDmg = [15, 25, 35, 45, 60][rank - 1] + world.level * 0.5;
    const trailRadius = rank >= 4 ? 28 : 20;
    const steps = 6;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const tx = startX + (p.x - startX) * t;
      const ty = startY + (p.y - startY) * t;
      burst(world, tx, ty, '#e2793d', 3, 60, 0.3);
      // Visual: leave a brief ground fire effect.
      world.effects.push({ type: 'ground', x: tx, y: ty, r: trailRadius, color: '#e2793d', life: 0.5, t: 0, dmg: trailDmg });
      world.enemies.forEach((e) => {
        if (!e.dead && dist2(tx, ty, e.x, e.y) < trailRadius * trailRadius) {
          damageEnemy(world, e, trailDmg, { allowCrit: false, burn: true, color: '#e2793d' });
        }
      });
    }
  }
}

export function damagePlayer(world: World, amount: number, attacker?: EnemyState): void {
  const p = world.player;
  p.hp -= amount;

  // Thorn Armor (Bramble Horror boss ability): reflect damage back to the
  // attacker, scaled by rank. Ranks 2+ also knock the attacker back.
  // Rank scales: 1=20dmg, 2=30, 3=45, 4=65, 5=90.
  if (hasBossAbility(world, 'brambleHorror') && amount > 0) {
    const rank = bossAbilityRank(world, 'brambleHorror');
    const reflectDmg = [20, 30, 45, 65, 90][rank - 1];
    const knockback = rank >= 2;
    if (attacker && !attacker.dead) {
      damageEnemy(world, attacker, reflectDmg, { allowCrit: false, color: '#4d7a3d' });
      if (knockback) {
        const ka = Math.atan2(attacker.y - p.y, attacker.x - p.x);
        const kDist = rank >= 4 ? 60 : 40;
        attacker.x = clamp(attacker.x + Math.cos(ka) * kDist, 5, world.W - 5);
        attacker.y = clamp(attacker.y + Math.sin(ka) * kDist, 5, world.H - 5);
      }
    } else if (world.bossFight) {
      // Boss projectile hit — reflect to the boss.
      damageBoss(world, world.bossFight.boss, reflectDmg, { allowCrit: false, color: '#4d7a3d' });
    }
  }

  // Thornskin (N_K): reflect damage to nearby enemies.
  if (hasNode(world.purchased, 'N_K') && amount > 0) {
    world.enemies.forEach((e) => {
      if (!e.dead && dist2(e.x, e.y, p.x, p.y) < 60 * 60) {
        damageEnemy(world, e, 15, { allowCrit: false });
      }
    });
  }

  if (p.hp <= 0) {
    // Phoenix (F_I): once per run, revive with 50% HP and blast all enemies.
    if (hasNode(world.purchased, 'F_I') && p.phoenixCd <= 0) {
      p.phoenixCd = 1; // consumed for the rest of the run
      p.hp = Math.round(maxHP(world) * 0.5);
      p.invuln = 2;
      world.flash('PHOENIX', '#e2793d');
      // Massive fire blast
      const blastRadius = 250;
      const blastDmg = 60 + world.level * 1.5;
      world.enemies.forEach((e) => {
        if (!e.dead && dist2(e.x, e.y, p.x, p.y) < blastRadius * blastRadius) {
          damageEnemy(world, e, blastDmg, { allowCrit: false, burn: true, color: '#e2793d' });
        }
      });
      if (world.bossFight) {
        damageBoss(world, world.bossFight.boss, blastDmg, { burn: true, color: '#e2793d' });
      }
      world.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0, maxR: blastRadius, color: '#e2793d', life: 0.6, t: 0 });
      burst(world, p.x, p.y, '#e2793d', 40, 280);
    } else if (hasNode(world.purchased, 'B_F') && p.undyingCd <= 0) {
      p.hp = 1;
      p.undyingCd = 60;
      p.invuln = 1.5;
      world.flash('UNDYING', 'var(--gold-bright)');
    } else {
      p.hp = 0;
      world.running = false;
    }
  } else if (hasNode(world.purchased, 'B_K') && amount > 0 && p.invuln <= 0) {
    // Second Skin (B_K): brief invuln after taking a hit.
    p.invuln = 1;
  }
}

export function updateProjectiles(world: World, dt: number): void {
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const pr = world.projectiles[i];
    if (pr.homing) {
      const t = nearestEnemy(world, pr.x, pr.y);
      let targetX: number | null = null;
      let targetY: number | null = null;
      if (t) {
        targetX = t.x;
        targetY = t.y;
      } else if (world.bossFight) {
        targetX = world.bossFight.boss.x;
        targetY = world.bossFight.boss.y;
      }
      if (targetX !== null && targetY !== null) {
        const ang = Math.atan2(targetY - pr.y, targetX - pr.x);
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
        damageEnemy(world, e, pr.dmg, { burn: pr.burn, slow: pr.slow, freeze: pr.freeze, color: pr.color, markedBonus: pr.markedBonus });
        hit = true;
        if (pr.pierce > 0) {
          pr.pierce--;
        } else {
          world.projectiles.splice(i, 1);
        }
        break;
      }
    }
    // Boss-fight hit test: player projectiles can also damage the active boss.
    if (!hit && world.bossFight) {
      const boss = world.bossFight.boss;
      if (dist2(pr.x, pr.y, boss.x, boss.y) < (pr.r + boss.r) * (pr.r + boss.r)) {
        damageBoss(world, boss, pr.dmg, { burn: pr.burn, slow: pr.slow, color: pr.color, markedBonus: pr.markedBonus });
        hit = true;
        if (pr.pierce > 0) {
          pr.pierce--;
        } else {
          world.projectiles.splice(i, 1);
        }
      }
    }
    if (!hit && (pr.x < -50 || pr.x > world.W + 50 || pr.y < -50 || pr.y > world.H + 50)) {
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
  // Frostbite Aura (R_K): passively chill enemies near the player.
  if (hasNode(world.purchased, 'R_K')) {
    world.enemies.forEach((e) => {
      if (!e.dead && dist2(e.x, e.y, p.x, p.y) < 120 * 120) {
        e.slowUntil = world.elapsed + 0.5; // refreshed every frame while in range
        e.slowAmt = Math.max(e.slowAmt, 0.15);
      }
    });
  }
  // Frost Aura (Rime Sovereign boss ability): passively slow enemies near the
  // player. Rank scales radius and slow strength.
  // Rank 1: 80px/20%, 2: 100px/25%, 3: 120px/30%, 4: 140px/35%, 5: 160px/40%.
  if (hasBossAbility(world, 'rimeSovereign')) {
    const rank = bossAbilityRank(world, 'rimeSovereign');
    const radius = [80, 100, 120, 140, 160][rank - 1];
    const slowAmt = [0.2, 0.25, 0.3, 0.35, 0.4][rank - 1];
    world.enemies.forEach((e) => {
      if (!e.dead && dist2(e.x, e.y, p.x, p.y) < radius * radius) {
        e.slowUntil = world.elapsed + 0.5;
        e.slowAmt = Math.max(e.slowAmt, slowAmt);
      }
    });
  }
  // Static Field (T_H): enemies near the player take periodic lightning damage.
  if (hasNode(world.purchased, 'T_H')) {
    const sfRadius = 120;
    const sfDmg = (5 + world.level * 0.2) * dt * 2; // per-frame damage tick
    world.enemies.forEach((e) => {
      if (!e.dead && dist2(e.x, e.y, p.x, p.y) < sfRadius * sfRadius) {
        damageEnemy(world, e, sfDmg, { allowCrit: false, color: '#c4e842' });
      }
    });
    if (world.bossFight) {
      const boss = world.bossFight.boss;
      if (dist2(boss.x, boss.y, p.x, p.y) < sfRadius * sfRadius) {
        damageBoss(world, boss, sfDmg, { allowCrit: false, color: '#c4e842' });
      }
    }
  }
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.dead) {
      world.enemies.splice(i, 1);
      continue;
    }
    let spd = e.spd;
    if (e.slowUntil > world.elapsed) spd *= 1 - e.slowAmt;
    if (e.frozenUntil > world.elapsed) spd = 0;
    // Time-based speed scaling: enemies get +1% speed per 10 seconds of
    // elapsed run time, capped at +50% (reaches max at 500s / ~8.3min).
    // Keeps pressure high in long runs so players can't just kite forever.
    const timeScale = 1 + Math.min(0.5, world.elapsed * 0.001);
    spd *= timeScale;
    if (e.rootBleed && e.rootBleed > world.elapsed) damageEnemy(world, e, 4 * dt, { allowCrit: false });
    if (e.burning > world.elapsed) damageEnemy(world, e, 3 * dt, { allowCrit: false });

    // Shadow Wraith teleport: periodically blink toward the nearest player.
    if (e.teleport) {
      if (e.teleportCd === undefined) e.teleportCd = 2 + Math.random() * 2;
      e.teleportCd -= dt;
      if (e.teleportCd <= 0) {
        e.teleportCd = 3 + Math.random() * 2;
        const ang = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 40;
        // Find nearest player for teleport target
        let tx = p.x, ty = p.y;
        let td = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
        if (world.netPlayers) {
          for (const np of world.netPlayers) {
            if (np.state.downed) continue;
            const d = (np.state.x - e.x) ** 2 + (np.state.y - e.y) ** 2;
            if (d < td) { td = d; tx = np.state.x; ty = np.state.y; }
          }
        }
        e.x = tx + Math.cos(ang) * dist;
        e.y = ty + Math.sin(ang) * dist;
        e.x = clamp(e.x, 10, world.W - 10);
        e.y = clamp(e.y, 10, world.H - 10);
        burst(world, e.x, e.y, '#9a7ec4', 8, 80, 0.3);
      }
    }

    // Target the nearest player (host's local player + all net players).
    let targetX = p.x;
    let targetY = p.y;
    let nearestD = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
    if (world.netPlayers) {
      for (const np of world.netPlayers) {
        if (np.state.downed) continue;
        const d = (np.state.x - e.x) ** 2 + (np.state.y - e.y) ** 2;
        if (d < nearestD) {
          nearestD = d;
          targetX = np.state.x;
          targetY = np.state.y;
        }
      }
    }

    const dx = targetX - e.x;
    const dy = targetY - e.y;
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
      // Ice Wolf: freeze on contact.
      if (e.freezeOnContact) {
        p.invuln = Math.max(p.invuln, 0.5);
      }
      damagePlayer(world, e.dmg * dt * (1 - damageReduction(world)), e);
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

/**
 * Ticks the active boss fight (movement, bullet-hell pattern rotation,
 * projectile collision) via bosses.ts, then resolves death: grants XP,
 * flashes a victory banner, banks boss ability unlocks, advances to the
 * next stage with a transition banner, and clears `world.bossFight` so
 * `updateSpawns` resumes normal enemy spawning next frame. No-op when no
 * fight is active.
 */
export function updateBossFight(world: World, dt: number): void {
  const fight = world.bossFight;
  if (!fight) return;
  updateBoss(world, dt);
  const boss = fight.boss;
  if (boss.hp <= 0) {
    gainXP(world, boss.xpValue);
    addRunEssence(world, essenceForBossKill(world, boss.xpValue));
    world.slain++;
    burst(world, boss.x, boss.y, boss.color, 46, 280);
    world.flash(boss.name.toUpperCase() + ' FALLS', 'var(--gold-bright)');

    // Boss ability unlock: if this boss's ability isn't already unlocked,
    // add it to the pending list (banked to localStorage on death).
    if (!hasBossAbility(world, boss.defId)) {
      if (!world.pendingBossAbilityUnlocks.includes(boss.defId)) {
        world.pendingBossAbilityUnlocks.push(boss.defId);
        const abilityDef = BOSS_ABILITY_BY_BOSS[boss.defId];
        if (abilityDef) {
          // Queue a persistent ability-unlock overlay (UI shows it, game
          // pauses until the player dismisses it by clicking).
          setTimeout(() => {
            if (world.running) {
              world.pendingAbilityDisplay = {
                abilityName: abilityDef.abilityName,
                bossName: abilityDef.bossName,
                desc: abilityDef.desc,
              };
            }
          }, 1200);
        }
      }
    }

    // Stage progression: advance to the next stage.
    world.stage++;
    const stageDef = getStageDef(world.stage);
    // Brief breather before the next boss + stage transition banner.
    world.bossTimer = 30; // ~30s breather to let the player explore the new stage
    world.spawnTimer = 4; // 4s pause before enemies start spawning in the new stage

    // Flash the stage transition banner (slightly delayed so it follows the boss death flash).
    setTimeout(() => {
      if (world.running) {
        world.flash('STAGE ' + world.stage + ' — ' + stageDef.banner, 'var(--gold-bright)');
      }
    }, 600);

    world.bossFight = null;
  }
}
