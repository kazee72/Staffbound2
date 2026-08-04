/**
 * Boss roster + bullet-hell attack pattern engine.
 *
 * Each boss owns its own projectile/telegraph arrays (see BossState in
 * types.ts) — they never touch `world.enemies` or `world.projectiles`, so
 * clearing a fight (boss dies / run ends) is just dropping `world.bossFight`.
 *
 * Attack patterns are small dt-driven state machines keyed off
 * `boss.activePattern` + `boss.patternT` (seconds elapsed within the
 * current pattern) + `boss.patternData` (free-form per-pattern scratch
 * counters). When a pattern finishes, the boss rests for a short cooldown,
 * then rotates to the next pattern in its `patterns` list.
 */
import type { BossAttackId, BossState, BossTelegraph, World } from './types';
import { damagePlayer } from './simulation';
import { damageReduction } from './player';
import { burst } from './visuals';

export interface BossDef {
  id: string;
  name: string;
  color: string;
  r: number;
  baseHp: number;
  hpPerDay: number;
  baseDmg: number;
  spd: number;
  xpValue: number;
  flavor: string;
  flashColor: string;
  /** Attack patterns available per phase (index 0 = phase 1, etc). */
  phasePatterns: BossAttackId[][];
  /** Legacy flat pattern list (phase 1 patterns). */
  patterns: BossAttackId[];
}

export const BOSS_DEFS: BossDef[] = [
  {
    id: 'elderWraith',
    name: 'Elder Wraith',
    color: '#5b3f73',
    r: 22,
    baseHp: 1650,
    hpPerDay: 495,
    baseDmg: 22,
    spd: 69,
    xpValue: 80,
    flavor: 'AN ELDER WRAITH STIRS',
    flashColor: 'var(--umbral)',
    phasePatterns: [
      ['stomp', 'radialBurst', 'aimedVolley'],
      ['stomp', 'radialBurst', 'aimedVolley', 'spiral'],
      ['stomp', 'radialBurst', 'aimedVolley', 'spiral', 'expandRing'],
    ],
    patterns: ['stomp', 'radialBurst', 'aimedVolley'],
  },
  {
    id: 'emberColossus',
    name: 'Ember Colossus',
    color: '#b6491f',
    r: 25,
    baseHp: 1860,
    hpPerDay: 555,
    baseDmg: 20,
    spd: 63,
    xpValue: 95,
    flavor: 'THE EMBER COLOSSUS AWAKENS',
    flashColor: 'var(--ember)',
    phasePatterns: [
      ['radialBurst', 'lineBeam', 'expandRing'],
      ['radialBurst', 'lineBeam', 'expandRing', 'aimedVolley'],
      ['radialBurst', 'lineBeam', 'expandRing', 'aimedVolley', 'spiral'],
    ],
    patterns: ['radialBurst', 'lineBeam', 'expandRing'],
  },
  {
    id: 'rimeSovereign',
    name: 'Rime Sovereign',
    color: '#4f7fa8',
    r: 23,
    baseHp: 1740,
    hpPerDay: 510,
    baseDmg: 19,
    spd: 66,
    xpValue: 90,
    flavor: 'THE RIME SOVEREIGN DESCENDS',
    flashColor: 'var(--frost)',
    phasePatterns: [
      ['spiral', 'expandRing', 'aimedVolley'],
      ['spiral', 'expandRing', 'aimedVolley', 'radialBurst'],
      ['spiral', 'expandRing', 'aimedVolley', 'radialBurst', 'lineBeam'],
    ],
    patterns: ['spiral', 'expandRing', 'aimedVolley'],
  },
  {
    id: 'brambleHorror',
    name: 'Bramble Horror',
    color: '#4d7a3d',
    r: 24,
    baseHp: 1950,
    hpPerDay: 585,
    baseDmg: 21,
    spd: 60,
    xpValue: 100,
    flavor: 'A BRAMBLE HORROR TEARS FREE OF THE EARTH',
    flashColor: 'var(--verdant)',
    phasePatterns: [
      ['stomp', 'spiral', 'radialBurst'],
      ['stomp', 'spiral', 'radialBurst', 'expandRing'],
      ['stomp', 'spiral', 'radialBurst', 'expandRing', 'lineBeam'],
    ],
    patterns: ['stomp', 'spiral', 'radialBurst'],
  },
];

export const BOSS_DEF_BY_ID: Record<string, BossDef> = {};
BOSS_DEFS.forEach((d) => (BOSS_DEF_BY_ID[d.id] = d));

/** Find the nearest player position (host + all net players) to a point. */
function nearestPlayer(world: World, x: number, y: number): { x: number; y: number } {
  let tx = world.player.x;
  let ty = world.player.y;
  let td = (tx - x) ** 2 + (ty - y) ** 2;
  if (world.netPlayers) {
    for (const np of world.netPlayers) {
      if (np.state.downed) continue;
      const d = (np.state.x - x) ** 2 + (np.state.y - y) ** 2;
      if (d < td) { td = d; tx = np.state.x; ty = np.state.y; }
    }
  }
  return { x: tx, y: ty };
}

const REST_DURATION = 0.4;

/** Phase thresholds (fraction of maxHp). Phase 1: 100-66%, Phase 2: 66-33%, Phase 3: 33-0%. */
const PHASE_THRESHOLDS = [0.66, 0.33];

/** Returns the phase (1-3) for a boss based on its current HP fraction. */
function phaseFor(boss: BossState): number {
  const frac = boss.hp / boss.maxHp;
  if (frac <= PHASE_THRESHOLDS[1]) return 3;
  if (frac <= PHASE_THRESHOLDS[0]) return 2;
  return 1;
}

/** Per-phase attack-speed multiplier (patterns tick faster, projectiles fly faster). */
function phaseSpeedMult(phase: number): number {
  return phase === 3 ? 1.45 : phase === 2 ? 1.2 : 1;
}

/** Per-phase projectile-speed multiplier. */
function phaseProjSpeedMult(phase: number): number {
  return phase === 3 ? 1.35 : phase === 2 ? 1.15 : 1;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

function addProjectile(boss: BossState, x: number, y: number, angle: number, speed: number, dmg: number, r = 6): void {
  const psm = phaseProjSpeedMult(boss.phase);
  boss.projectiles.push({
    x,
    y,
    vx: Math.cos(angle) * speed * psm,
    vy: Math.sin(angle) * speed * psm,
    r,
    dmg,
    color: boss.color,
    life: 6,
  });
}

function addTelegraph(boss: BossState, t: BossTelegraph): void {
  boss.telegraphs.push(t);
}

// ---------------- individual pattern tickers ----------------
// Each returns true once the pattern has fully finished.

function tickStomp(world: World, boss: BossState, _dt: number): boolean {
  const d = boss.patternData;
  const RADIUS = 175;
  if (!d.started) {
    d.started = 1;
    addTelegraph(boss, { kind: 'ring', x: boss.x, y: boss.y, radius: RADIUS, color: boss.color, t: 0, dur: 0.9 });
  }
  if (!d.resolved && boss.patternT >= 0.9) {
    d.resolved = 1;
    const target = nearestPlayer(world, boss.x, boss.y); const p = { x: target.x, y: target.y, invuln: 0, dashing: 0, r: 13 };
    if (dist(p.x, p.y, boss.x, boss.y) < RADIUS && p.invuln <= 0 && p.dashing <= 0) {
      damagePlayer(world, boss.dmg * 1.3 * (1 - damageReduction(world)));
    }
    world.effects.push({ type: 'ring', x: boss.x, y: boss.y, r: 0, maxR: RADIUS, color: boss.color, life: 0.3, t: 0 });
    burst(world, boss.x, boss.y, boss.color, 26, 220);
  }
  return boss.patternT >= 1.05;
}

function tickRadialBurst(world: World, boss: BossState, _dt: number): boolean {
  const d = boss.patternData;
  const N = 22;
  const SPEED = 135;
  const waveTimes = [0.15, 1.0, 1.85];
  for (let i = 0; i < waveTimes.length; i++) {
    const key = `w${i}`;
    if (!d[key] && boss.patternT >= waveTimes[i]) {
      d[key] = 1;
      addTelegraph(boss, { kind: 'ring', x: boss.x, y: boss.y, radius: 40, color: boss.color, t: 0, dur: 0.22 });
    }
    const fireKey = `f${i}`;
    if (!d[fireKey] && boss.patternT >= waveTimes[i] + 0.22) {
      d[fireKey] = 1;
      const gapStart = (Math.random() * N) | 0;
      const gapSize = 3;
      const rotOffset = i * 0.35;
      for (let k = 0; k < N; k++) {
        if (k >= gapStart && k < gapStart + gapSize) continue; // dodge lane
        const a = rotOffset + (k / N) * Math.PI * 2;
        addProjectile(boss, boss.x, boss.y, a, SPEED, boss.dmg * 0.45, 5);
      }
    }
  }
  void world;
  return boss.patternT >= 2.5;
}

function tickSpiral(world: World, boss: BossState, dt: number): boolean {
  const d = boss.patternData;
  d.ang = (d.ang || 0) + dt * 5.4;
  d.cd = (d.cd || 0) - dt;
  const SPEED = 150;
  if (d.cd <= 0) {
    d.cd = 0.07;
    addProjectile(boss, boss.x, boss.y, d.ang, SPEED, boss.dmg * 0.32, 4.5);
    addProjectile(boss, boss.x, boss.y, d.ang + Math.PI, SPEED, boss.dmg * 0.32, 4.5);
  }
  void world;
  return boss.patternT >= 3.1;
}

function tickAimedVolley(world: World, boss: BossState, _dt: number): boolean {
  const d = boss.patternData;
  const volleyTimes = [0.1, 0.95, 1.8];
  const target = nearestPlayer(world, boss.x, boss.y); const p = { x: target.x, y: target.y, invuln: 0, dashing: 0, r: 13 };
  for (let i = 0; i < volleyTimes.length; i++) {
    const key = `t${i}`;
    if (!d[key] && boss.patternT >= volleyTimes[i]) {
      d[key] = 1;
      addTelegraph(boss, { kind: 'ring', x: boss.x, y: boss.y, radius: 26, color: boss.color, t: 0, dur: 0.28 });
    }
    const fireKey = `f${i}`;
    if (!d[fireKey] && boss.patternT >= volleyTimes[i] + 0.28) {
      d[fireKey] = 1;
      const baseAng = Math.atan2(p.y - boss.y, p.x - boss.x);
      const shots = 5;
      const spread = 0.42;
      for (let k = 0; k < shots; k++) {
        const a = baseAng + (k - (shots - 1) / 2) * (spread / (shots - 1));
        addProjectile(boss, boss.x, boss.y, a, 210, boss.dmg * 0.4, 5);
      }
    }
  }
  return boss.patternT >= 2.35;
}

function tickExpandRing(world: World, boss: BossState, _dt: number): boolean {
  const d = boss.patternData;
  const N = 32;
  const SPEED = 105;
  const waveTimes = [0, 0.9, 1.8];
  for (let i = 0; i < waveTimes.length; i++) {
    const key = `w${i}`;
    if (!d[key] && boss.patternT >= waveTimes[i]) {
      d[key] = 1;
      addTelegraph(boss, { kind: 'ring', x: boss.x, y: boss.y, radius: 55, color: boss.color, t: 0, dur: 0.35 });
    }
    const fireKey = `f${i}`;
    if (!d[fireKey] && boss.patternT >= waveTimes[i] + 0.35) {
      d[fireKey] = 1;
      const gapStart = (Math.random() * N) | 0;
      const gapSize = 4;
      for (let k = 0; k < N; k++) {
        if (k >= gapStart && k < gapStart + gapSize) continue;
        const a = (k / N) * Math.PI * 2 + (i % 2 === 0 ? 0 : Math.PI / N);
        addProjectile(boss, boss.x, boss.y, a, SPEED, boss.dmg * 0.38, 5);
      }
    }
  }
  void world;
  return boss.patternT >= 2.6;
}

function tickLineBeam(world: World, boss: BossState, _dt: number): boolean {
  const d = boss.patternData;
  const target = nearestPlayer(world, boss.x, boss.y); const p = { x: target.x, y: target.y, invuln: 0, dashing: 0, r: 13 };
  if (!d.started) {
    d.started = 1;
    d.angle = Math.atan2(p.y - boss.y, p.x - boss.x);
    addTelegraph(boss, {
      kind: 'line',
      x: boss.x,
      y: boss.y,
      angle: d.angle,
      length: 1400,
      width: 30,
      color: boss.color,
      t: 0,
      dur: 1.0,
    });
  }
  if (!d.resolved && boss.patternT >= 1.0) {
    d.resolved = 1;
    const angle = d.angle as number;
    const dx = p.x - boss.x;
    const dy = p.y - boss.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const perp = -dx * Math.sin(angle) + dy * Math.cos(angle);
    if (along > 0 && along < 1400 && Math.abs(perp) < 20 && p.invuln <= 0 && p.dashing <= 0) {
      damagePlayer(world, boss.dmg * 1.5 * (1 - damageReduction(world)));
    }
    burst(world, boss.x + Math.cos(angle) * 120, boss.y + Math.sin(angle) * 120, boss.color, 18, 200);
  }
  return boss.patternT >= 1.25;
}

function tickPattern(world: World, boss: BossState, id: BossAttackId, dt: number): boolean {
  switch (id) {
    case 'stomp':
      return tickStomp(world, boss, dt);
    case 'radialBurst':
      return tickRadialBurst(world, boss, dt);
    case 'spiral':
      return tickSpiral(world, boss, dt);
    case 'aimedVolley':
      return tickAimedVolley(world, boss, dt);
    case 'expandRing':
      return tickExpandRing(world, boss, dt);
    case 'lineBeam':
      return tickLineBeam(world, boss, dt);
  }
}

export function updateBoss(world: World, dt: number): void {
  const fight = world.bossFight;
  if (!fight) return;
  const boss = fight.boss;
  const def = BOSS_DEF_BY_ID[boss.defId];

  // Find nearest player (host + all net players) for targeting.
  let tx = world.player.x;
  let ty = world.player.y;
  let td = (tx - boss.x) ** 2 + (ty - boss.y) ** 2;
  if (world.netPlayers) {
    for (const np of world.netPlayers) {
      if (np.state.downed) continue;
      const d = (np.state.x - boss.x) ** 2 + (np.state.y - boss.y) ** 2;
      if (d < td) { td = d; tx = np.state.x; ty = np.state.y; }
    }
  }

  // Gentle keep-away movement: close distance slowly, but hold near-ish
  // range once close so bullet-hell patterns stay readable.
  const d = Math.sqrt(td);
  const minRange = 210;
  if (d > minRange) {
    const ang = Math.atan2(ty - boss.y, tx - boss.x);
    boss.x += Math.cos(ang) * boss.spd * dt;
    boss.y += Math.sin(ang) * boss.spd * dt;
  }
  boss.x = Math.max(boss.r, Math.min(world.W - boss.r, boss.x));
  boss.y = Math.max(boss.r, Math.min(world.H - boss.r, boss.y));

  // Body contact damage — check ALL players (host + net players).
  const pr = world.player;
  const pr2 = (pr.r || 13) + boss.r;
  if (d < pr2 && pr.invuln <= 0 && pr.dashing <= 0) {
    damagePlayer(world, boss.dmg * 0.6 * dt * (1 - damageReduction(world)));
  }
  if (world.netPlayers) {
    for (const np of world.netPlayers) {
      if (np.state.downed || np.state.invuln > 0) continue;
      const nd = Math.sqrt((np.state.x - boss.x) ** 2 + (np.state.y - boss.y) ** 2);
      const nr = (np.state.r || 13) + boss.r;
      if (nd < nr) {
        np.state.hp -= boss.dmg * 0.6 * dt * (1 - damageReduction(world));
        if (np.state.hp <= 0) { np.state.hp = 0; np.state.downed = true; }
      }
    }
  }

  // Phase transitions: detect HP threshold crossings and flash a banner.
  const newPhase = phaseFor(boss);
  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    // Reset pattern rotation so the new phase's pattern pool starts fresh.
    boss.patternIndex = -1;
    boss.activePattern = null;
    boss.patternT = 0.6;
    boss.patternData = {};
    world.flash('PHASE ' + newPhase, def.flashColor);
    burst(world, boss.x, boss.y, boss.color, 30, 200);
  }

  // Pattern rotation.
  const phasePatterns = def.phasePatterns[boss.phase - 1] || def.patterns;
  const psm = phaseSpeedMult(boss.phase);
  if (boss.activePattern) {
    boss.patternT += dt * psm;
    const finished = tickPattern(world, boss, boss.activePattern, dt * psm);
    if (finished) {
      boss.activePattern = null;
      boss.patternT = REST_DURATION;
      boss.patternData = {};
    }
  } else {
    boss.patternT -= dt;
    if (boss.patternT <= 0) {
      boss.patternIndex = (boss.patternIndex + 1) % phasePatterns.length;
      boss.activePattern = phasePatterns[boss.patternIndex];
      boss.patternT = 0;
      boss.patternData = {};
    }
  }

  // Status ticks (bosses can be burned/slowed by the player's spells too).
  if (boss.burning > world.elapsed) boss.hp -= 3 * dt;
  if (boss.hp <= 0 && !boss.dead) {
    boss.dead = true;
  }

  // Advance + cull boss projectiles, checking collision against ALL players.
  for (let i = boss.projectiles.length - 1; i >= 0; i--) {
    const pr = boss.projectiles[i];
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    let hit = false;
    // Host player
    const p = world.player;
    const hitR = (p.r || 13) + pr.r;
    if (dist(p.x, p.y, pr.x, pr.y) < hitR && p.invuln <= 0 && p.dashing <= 0) {
      damagePlayer(world, pr.dmg * (1 - damageReduction(world)));
      hit = true;
    }
    // Net players (guests)
    if (!hit && world.netPlayers) {
      for (const np of world.netPlayers) {
        if (np.state.downed || np.state.invuln > 0) continue;
        const nhR = (np.state.r || 13) + pr.r;
        if (dist(np.state.x, np.state.y, pr.x, pr.y) < nhR) {
          np.state.hp -= pr.dmg * (1 - damageReduction(world));
          if (np.state.hp <= 0) { np.state.hp = 0; np.state.downed = true; }
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      boss.projectiles.splice(i, 1);
      continue;
    }
    if (pr.life <= 0 || pr.x < -60 || pr.x > world.W + 60 || pr.y < -60 || pr.y > world.H + 60) {
      boss.projectiles.splice(i, 1);
    }
  }

  // Advance + cull telegraphs.
  for (let i = boss.telegraphs.length - 1; i >= 0; i--) {
    const tg = boss.telegraphs[i];
    tg.t += dt;
    if (tg.t >= tg.dur) boss.telegraphs.splice(i, 1);
  }
}
