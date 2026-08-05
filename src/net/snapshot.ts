/**
 * Compact world-state serialization for 20Hz host→client snapshots.
 *
 * Only serializes what clients need to RENDER the game: player positions/HP/level,
 * enemy positions/types/HP, boss state, projectiles, effects, particles,
 * day/timer, cooldowns. No strings — type IDs instead of type names, colors
 * as packed numbers.
 *
 * Format: a single number[] (flat array) so it's cheap to JSON-serialize
 * and fast to read/write. A tagged-length layout keeps it forward-compatible
 * without per-field string keys.
 *
 * Snapshot layout (sequence of typed blocks):
 *   [0]          tick (monotonic counter, for interpolation timing)
 *   [1]          elapsed
 *   [2]          day (precomputed)
 *   [3]          bossActive (0/1)
 *   player count P, then P × PLAYER_FIELDS entries:
 *     id, x, y, hp, maxHp, level, invuln(0/1), dashing(0/1), aimAngle, dashCd, downed(0/1), sp, spSpent
 *   enemy count E, then E × ENEMY_FIELDS entries:
 *     type(0-3), x, y, hp, maxHp, r, frozen(0/1), slowed(0/1), marked(0/1), burning(0/1)
 *   boss block (if bossActive=1): defId(0..N), x, y, hp, maxHp, r, slowUntilRelative(0/1), telegraphCount, telegraphs...[kind(0/1),x,y,r/length,width/radius,colorPacked,t,dur]
 *   projectile count PR, then PR × PROJ_FIELDS: x, y, r, colorPacked, mini(0/1)
 *   boss-proj count BPR, then BPR × BPROJ_FIELDS: x, y, r, colorPacked
 *   effects count EF, then EF × (type(0/1), x, y, r/maxR, colorPacked, life, t, [dmg if ground])
 *   particles count PT, then PT × PT_FIELDS: x, y, size, life, maxLife, colorPacked, vx, vy
 *
 * The snapshot intentionally excludes internal AI/cooldown bookkeeping —
 * clients are pure renderers; the host owns all simulation state.
 */

import type { BossState, Effect, EnemyType, Particle, Projectile, World } from '../game/types';
import type { NetPlayerState } from '../game/types';
import { currentDay } from '../game/enemies';
import { maxHP } from '../game/player';

// Enemy type ID map (string ↔ number for compact serialization)
const ENEMY_TYPE_IDS: Record<EnemyType, number> = { slime: 0, skel: 1, wisp: 2, wraith: 3, ghoul: 4, iceWolf: 5, shadowWraith: 6 };
const ENEMY_TYPE_NAMES: string[] = ['slime', 'skel', 'wisp', 'wraith', 'ghoul', 'iceWolf', 'shadowWraith'];

// Boss def IDs (compact)
const BOSS_DEF_IDS: Record<string, number> = {
  elderWraith: 0,
  emberColossus: 1,
  rimeSovereign: 2,
  brambleHorror: 3,
};
const BOSS_DEF_NAMES = ['elderWraith', 'emberColossus', 'rimeSovereign', 'brambleHorror'];

/** Pack a hex color string (#rrggbb) into a single integer. */
function packColor(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return Number.isNaN(n) ? 0xffffff : n;
}

/** Unpack an integer color back into #rrggbb. */
function unpackColor(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

/**
 * Serialize the host's authoritative World into a compact number[] snapshot.
 * Includes both the local player and all network players.
 */
export function serializeSnapshot(world: World, tick: number): number[] {
  const out: number[] = [];
  out.push(tick);
  out.push(world.elapsed);
  out.push(currentDay(world));

  const bossActive = world.bossFight ? 1 : 0;
  out.push(bossActive);

  // Players: local player + net players (host is index 0)
  const players: NetPlayerState[] = [];
  players.push(toNetPlayer(world.player, world, 0, world.level, maxHP(world), world.sp, world.spSpent));
  if (world.netPlayers) {
    for (const np of world.netPlayers) {
      players.push(toNetPlayer(np.state, world, np.id, np.state.level, np.state.maxHp, np.state.sp, np.state.spSpent));
    }
  }
  out.push(players.length);
  for (const p of players) {
    out.push(
      p.id, p.x, p.y, p.hp, p.maxHp, p.level,
      p.invuln > 0 ? 1 : 0, p.dashing > 0 ? 1 : 0, p.aimAngle, p.dashCd, p.downed ? 1 : 0,
      p.sp, p.spSpent,
    );
  }

  // Enemies
  out.push(world.enemies.length);
  for (const e of world.enemies) {
    out.push(
      ENEMY_TYPE_IDS[e.type], e.x, e.y, e.hp, e.maxHp, e.r,
      e.frozenUntil > world.elapsed ? 1 : 0,
      e.slowUntil > world.elapsed ? 1 : 0,
      e.marked > world.elapsed ? 1 : 0,
      e.burning > world.elapsed ? 1 : 0,
    );
  }

  // Boss
  if (world.bossFight) {
    const b = world.bossFight.boss;
    out.push(BOSS_DEF_IDS[b.defId] ?? 0, b.x, b.y, b.hp, b.maxHp, b.r, b.slowUntil > world.elapsed ? 1 : 0);
    out.push(b.telegraphs.length);
    for (const tg of b.telegraphs) {
      out.push(tg.kind === 'ring' ? 0 : 1, tg.x, tg.y, tg.kind === 'ring' ? (tg.radius ?? 0) : (tg.length ?? 0), tg.width ?? 0, packColor(tg.color), tg.t, tg.dur);
    }
    out.push(b.projectiles.length);
    for (const bp of b.projectiles) {
      out.push(bp.x, bp.y, bp.r, packColor(bp.color));
    }
  }

  // Player projectiles
  out.push(world.projectiles.length);
  for (const pr of world.projectiles) {
    out.push(pr.x, pr.y, pr.r, packColor(pr.color), pr.mini ? 1 : 0);
  }

  // Effects
  out.push(world.effects.length);
  for (const fx of world.effects) {
    if (fx.type === 'ring') {
      out.push(0, fx.x, fx.y, fx.maxR, 0, packColor(fx.color), fx.life, fx.t);
    } else if (fx.type === 'ground') {
      out.push(1, fx.x, fx.y, fx.r, (fx as any).dmg || 0, packColor(fx.color), fx.life, fx.t);
    } else {
      // Lightning effect — serialize as type 2 with start/end points
      out.push(2, fx.x1, fx.y1, fx.x2, fx.y2, packColor(fx.color), fx.life, fx.t);
    }
  }

  // Particles (limit count for bandwidth — newest first)
  const particles: Particle[] = world.particles.slice(-120);
  out.push(particles.length);
  for (const pt of particles) {
    out.push(pt.x, pt.y, pt.size, pt.life, pt.maxLife, packColor(pt.color), pt.vx, pt.vy);
  }

  return out;
}

/** Build a NetPlayerState view of a player for snapshot serialization. */
function toNetPlayer(
  p: { x: number; y: number; hp: number; invuln: number; dashing: number; aimAngle: number; dashCd: number },
  _world: World,
  id: number,
  level: number,
  maxHp: number,
  sp: number,
  spSpent: number,
): NetPlayerState {
  return {
    id,
    x: p.x,
    y: p.y,
    hp: p.hp,
    maxHp,
    level,
    invuln: p.invuln,
    dashing: p.dashing,
    aimAngle: p.aimAngle,
    dashCd: p.dashCd,
    downed: p.hp <= 0,
    vx: 0, vy: 0, facing: { x: 0, y: -1 }, r: 9, dashCdMax: 3.4,
    phoenixCd: 0, undyingCd: 0, stillTime: 0,
    purchased: new Set<string>(), sp, spSpent,
    xp: 0, xpNext: 24,
    cd: { bolt: 0, boltCastCount: 0, fireNova: 0, iceLance: 0, frostArmor: 0, frostArmorActive: 0, arcaneBurst: 0, vines: 0, shadowBolt: 0, timeWarp: 0, overgrowth: 0, shadowBlink: 0, eternalFrost: 0, apexSurge: 0, cull: 0, magmaCore: 0, arcaneExplosion: 0, lightningChain: 0, blizzard: 0, earthquake: 0, sporeBurst: 0, shadowNova: 0, whirlwindStrike: 0, stormCall: 0, thunderclap: 0, lightningStorm: 0, stormLord: 0, thunderStrike: 0, windGust: 0, vortex: 0, cataclysm: 0, tidalWave: 0, healingTide: 0, whirlpool: 0, tsunami: 0, flood: 0, boulder: 0, earthWall: 0, earthquakeRk: 0, meteor: 0, blessing: 0, divineShield: 0, judgement: 0, summonBone: 0, summonHound: 0, conjureArmy: 0, summonDeathKnight: 0, apocalypse: 0 },
    wisps: [], decoys: [],
  };
}

// ---------------- Deserialization ----------------

/** Deserialized snapshot — a lightweight render-only world state. */
export interface SnapshotView {
  tick: number;
  elapsed: number;
  day: number;
  bossActive: boolean;
  players: SnapPlayer[];
  enemies: SnapEnemy[];
  boss: SnapBoss | null;
  bossProjectiles: SnapBossProj[];
  projectiles: SnapProj[];
  effects: SnapEffect[];
  particles: SnapParticle[];
}

export interface SnapPlayer {
  id: number; x: number; y: number; hp: number; maxHp: number; level: number;
  invuln: boolean; dashing: boolean; aimAngle: number; dashCd: number; downed: boolean;
  sp: number; spSpent: number;
}

export interface SnapEnemy {
  type: number; x: number; y: number; hp: number; maxHp: number; r: number;
  frozen: boolean; slowed: boolean; marked: boolean; burning: boolean;
}

export interface SnapBoss {
  defId: number; x: number; y: number; hp: number; maxHp: number; r: number; slowed: boolean;
  telegraphs: SnapTelegraph[];
}

export interface SnapTelegraph {
  kind: number; x: number; y: number; rOrLen: number; width: number; color: string; t: number; dur: number;
}

export interface SnapBossProj { x: number; y: number; r: number; color: string; }

export interface SnapProj { x: number; y: number; r: number; color: string; mini: boolean; }

export interface SnapEffect {
  type: number; x: number; y: number; r: number; dmg: number; color: string; life: number; t: number;
}

export interface SnapParticle {
  x: number; y: number; size: number; life: number; maxLife: number; color: string; vx: number; vy: number;
}

let readIdx = 0;

function readNum(data: number[]): number {
  return data[readIdx++] ?? 0;
}

/** Deserialize a compact snapshot into a SnapshotView for client-side rendering. */
export function deserializeSnapshot(data: number[]): SnapshotView {
  readIdx = 0;
  const tick = readNum(data);
  const elapsed = readNum(data);
  const day = readNum(data);
  const bossActive = readNum(data) === 1;

  // Players
  const pCount = readNum(data);
  const players: SnapPlayer[] = [];
  for (let i = 0; i < pCount; i++) {
    players.push({
      id: readNum(data), x: readNum(data), y: readNum(data),
      hp: readNum(data), maxHp: readNum(data), level: readNum(data),
      invuln: readNum(data) === 1, dashing: readNum(data) === 1,
      aimAngle: readNum(data), dashCd: readNum(data), downed: readNum(data) === 1,
      sp: readNum(data), spSpent: readNum(data),
    });
  }

  // Enemies
  const eCount = readNum(data);
  const enemies: SnapEnemy[] = [];
  for (let i = 0; i < eCount; i++) {
    enemies.push({
      type: readNum(data), x: readNum(data), y: readNum(data),
      hp: readNum(data), maxHp: readNum(data), r: readNum(data),
      frozen: readNum(data) === 1, slowed: readNum(data) === 1,
      marked: readNum(data) === 1, burning: readNum(data) === 1,
    });
  }

  // Boss
  let boss: SnapBoss | null = null;
  const bossProjectiles: SnapBossProj[] = [];
  if (bossActive) {
    const defId = readNum(data);
    const bx = readNum(data), by = readNum(data), bhp = readNum(data), bmaxHp = readNum(data), br = readNum(data);
    const slowed = readNum(data) === 1;
    const tgCount = readNum(data);
    const telegraphs: SnapTelegraph[] = [];
    for (let i = 0; i < tgCount; i++) {
      telegraphs.push({
        kind: readNum(data), x: readNum(data), y: readNum(data),
        rOrLen: readNum(data), width: readNum(data), color: unpackColor(readNum(data)),
        t: readNum(data), dur: readNum(data),
      });
    }
    const bpCount = readNum(data);
    for (let i = 0; i < bpCount; i++) {
      bossProjectiles.push({ x: readNum(data), y: readNum(data), r: readNum(data), color: unpackColor(readNum(data)) });
    }
    boss = { defId, x: bx, y: by, hp: bhp, maxHp: bmaxHp, r: br, slowed, telegraphs };
  }

  // Player projectiles
  const prCount = readNum(data);
  const projectiles: SnapProj[] = [];
  for (let i = 0; i < prCount; i++) {
    projectiles.push({ x: readNum(data), y: readNum(data), r: readNum(data), color: unpackColor(readNum(data)), mini: readNum(data) === 1 });
  }

  // Effects
  const efCount = readNum(data);
  const effects: SnapEffect[] = [];
  for (let i = 0; i < efCount; i++) {
    const type = readNum(data);
    effects.push({
      type, x: readNum(data), y: readNum(data), r: readNum(data),
      dmg: readNum(data), color: unpackColor(readNum(data)),
      life: readNum(data), t: readNum(data),
    });
  }

  // Particles
  const ptCount = readNum(data);
  const particles: SnapParticle[] = [];
  for (let i = 0; i < ptCount; i++) {
    particles.push({
      x: readNum(data), y: readNum(data), size: readNum(data),
      life: readNum(data), maxLife: readNum(data),
      color: unpackColor(readNum(data)), vx: readNum(data), vy: readNum(data),
    });
  }

  return { tick, elapsed, day, bossActive, players, enemies, boss, bossProjectiles, projectiles, effects, particles };
}

/** Convert a snapshot enemy type ID back to the EnemyType string used for textures. */
export function enemyTypeName(id: number): string {
  return ENEMY_TYPE_NAMES[id] || 'slime';
}

/** Convert a snapshot boss def ID back to the boss defId string used for textures. */
export function bossDefName(id: number): string {
  return BOSS_DEF_NAMES[id] || 'elderWraith';
}

// Re-export for snapshot build helpers
export type _Effect = Effect;
export type _Projectile = Projectile;
export type _BossState = BossState;