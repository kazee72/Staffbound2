/** Enemy type defs, spawn logic, AI/movement — ported from reference/full-reference.html, extended with a multi-boss roster. */
import type { BossState, EnemyState, EnemyType, World } from './types';
import { BOSS_DEFS } from './bosses';
import { availableEnemyTypes } from './stages';
import { playerHpScaleMult } from './player';

interface ETypeDef {
  hp: number;
  dmg: number;
  spd: number;
  xp: number;
  r: number;
  color: string;
  minDay: number;
  minStage: number;
  wobble?: boolean;
  teleport?: boolean;
  freezeOnContact?: boolean;
}

export const ETYPES: Record<EnemyType, ETypeDef> = {
  slime: { hp: 18, dmg: 6, spd: 70, xp: 4, r: 9, color: '#7fae6e', minDay: 1, minStage: 1 },
  skel: { hp: 30, dmg: 10, spd: 95, xp: 6, r: 10, color: '#d8d3c4', minDay: 1, minStage: 1 },
  wisp: { hp: 10, dmg: 4, spd: 150, xp: 5, r: 7, color: '#8ec9e8', minDay: 1, minStage: 1, wobble: true },
  wraith: { hp: 70, dmg: 16, spd: 80, xp: 13, r: 12, color: '#8b6fae', minDay: 2, minStage: 1 },
  // Stage 2: Ghoul — fast zombie, medium HP
  ghoul: { hp: 45, dmg: 12, spd: 120, xp: 8, r: 10, color: '#7a8a5e', minDay: 1, minStage: 2 },
  // Stage 3: Ice Wolf — very fast, freezes on contact
  iceWolf: { hp: 35, dmg: 10, spd: 160, xp: 9, r: 9, color: '#b8d8f0', minDay: 1, minStage: 3, freezeOnContact: true },
  // Stage 4: Shadow Wraith — teleports periodically toward the player
  shadowWraith: { hp: 55, dmg: 18, spd: 60, xp: 14, r: 11, color: '#9a7ec4', minDay: 1, minStage: 4, teleport: true },
};

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function currentDay(world: World): number {
  return Math.floor(world.elapsed / 60) + 1;
}

export function spawnEnemy(world: World, forceType?: EnemyType, spawnX?: number, spawnY?: number): void {
  const day = currentDay(world);
  const stage = world.stage;
  // Filter the pool by both day and stage: only spawn types whose minDay and
  // minStage requirements are met at the current progression level.
  const pool = availableEnemyTypes(stage).filter((k) => day >= ETYPES[k].minDay && stage >= ETYPES[k].minStage);
  const type = forceType || pool[(Math.random() * pool.length) | 0] || 'slime';
  const base = ETYPES[type];
  // Enemy stats scale with both stage and day. Stage HP scaling is steeper
  // (0.8/stage) so later stages feel meaningfully tankier; day scaling stays
  // gentle. Damage scales 0.5/stage (up from 0.35) so tankier foes also hit
  // harder — later stages require real build investment to survive.
  const scale = 1 + (stage - 1) * 0.8 + (day - 1) * 0.15;
  const hpScale = scale * playerHpScaleMult(world);
  let x: number, y: number;
  if (spawnX !== undefined && spawnY !== undefined) {
    x = spawnX;
    y = spawnY;
  } else {
    const { W, H } = world;
    const edge = (Math.random() * 4) | 0;
    if (edge === 0) { x = -30; y = rand(0, H); }
    else if (edge === 1) { x = W + 30; y = rand(0, H); }
    else if (edge === 2) { x = rand(0, W); y = -30; }
    else { x = rand(0, W); y = H + 30; }
  }
  const e: EnemyState = {
    type,
    x,
    y,
    hp: base.hp * hpScale,
    maxHp: base.hp * hpScale,
    dmg: base.dmg * (1 + (stage - 1) * 0.5 + (day - 1) * 0.18),
    spd: base.spd,
    r: base.r,
    color: base.color,
    xpValue: base.xp,
    wobble: base.wobble,
    seed: Math.random() * 100,
    burning: 0,
    burnT: 0,
    frozenUntil: 0,
    slowUntil: 0,
    slowAmt: 0,
    marked: 0,
    teleport: base.teleport,
    teleportCd: base.teleport ? 2 + Math.random() * 2 : undefined,
    freezeOnContact: base.freezeOnContact,
  };
  world.enemies.push(e);
}

/**
 * Splits a defeated slime into 2 smaller, weaker copies at its death spot.
 * Split children are marked so they don't split again when killed.
 */
export function spawnSlimeSplit(world: World, parent: EnemyState): void {
  const base = ETYPES.slime;
  for (let i = 0; i < 2; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 10;
    const hp = Math.max(1, parent.maxHp * 0.4);
    const e: EnemyState = {
      type: 'slime',
      x: parent.x + Math.cos(ang) * dist,
      y: parent.y + Math.sin(ang) * dist,
      hp,
      maxHp: hp,
      dmg: parent.dmg * 0.55,
      spd: base.spd * 1.15,
      r: base.r * 0.6,
      color: base.color,
      xpValue: Math.max(1, Math.round(parent.xpValue * 0.4)),
      wobble: base.wobble,
      seed: Math.random() * 100,
      burning: 0,
      burnT: 0,
      frozenUntil: 0,
      slowUntil: 0,
      slowAmt: 0,
      marked: 0,
      splitChild: true,
    };
    world.enemies.push(e);
  }
}

/**
 * Spawns the boss appropriate for the current stage.
 * Stage 1 → Elder Wraith, Stage 2 → Ember Colossus, Stage 3 → Rime Sovereign,
 * Stage 4 → Bramble Horror, Stage 5+ → cycles with tougher stats.
 *
 * Two bosses per stage: the second boss (currentBossIndex=1) is stronger,
 * bigger, and tougher. Enemy HP also scales with player count.
 */
export function spawnBoss(world: World): void {
  const day = currentDay(world);
  world.enemies.length = 0;

  // Pick boss by stage (cycling for stage 5+).
  const bossIndex = (world.stage - 1) % BOSS_DEFS.length;
  const def = BOSS_DEFS[bossIndex];
  const stageBonus = 1 + (world.stage - 1) * 0.35;
  const dayBonus = 1 + (day - 1) * 0.12;
  // Second boss this stage is significantly stronger.
  const bossNumMult = world.currentBossIndex === 0 ? 1 : 1.5;   // HP
  const bossDmgMult = world.currentBossIndex === 0 ? 1 : 1.2;   // damage
  const bossSizeMult = world.currentBossIndex === 0 ? 1 : 1.15; // visual size
  const hpScale = playerHpScaleMult(world);
  const boss: BossState = {
    defId: def.id,
    name: def.name + (world.currentBossIndex > 0 ? ' II' : ''),
    x: world.W / 2,
    y: -60 * bossSizeMult,
    hp: (def.baseHp + day * def.hpPerDay) * stageBonus * dayBonus * bossNumMult * hpScale,
    maxHp: (def.baseHp + day * def.hpPerDay) * stageBonus * dayBonus * bossNumMult * hpScale,
    dmg: def.baseDmg * (1 + (day - 1) * 0.16) * stageBonus * bossDmgMult,
    spd: def.spd * (1 + (world.stage - 1) * 0.08),
    r: def.r * bossSizeMult,
    color: def.color,
    seed: Math.random() * 1000,
    xpValue: def.xpValue * Math.floor(stageBonus) * (world.currentBossIndex > 0 ? 2 : 1),
    burning: 0,
    burnT: 0,
    slowUntil: 0,
    slowAmt: 0,
    marked: 0,
    phase: 1,
    patternIndex: -1,
    activePattern: null,
    patternT: 1.5,
    patternData: {},
    projectiles: [],
    telegraphs: [],
  };
  world.bossFight = { boss };
  const suffix = world.currentBossIndex > 0 ? ' RETURNS ENRAGED' : '';
  world.flash(def.flavor + suffix, def.flashColor);
}
