/**
 * Stage definitions — each stage has a distinct name, flavor text, background
 * palette, decor type, and the set of enemy types unlocked at that stage.
 *
 * Stages cycle for 5+ (stage 5 uses stage 1's palette with a darker tint,
 * stage 6 uses stage 2's, etc.), so the game can run indefinitely while
 * still giving a visual sense of progression.
 */
import type { EnemyType } from './types';

export type DecorKind = 'forest' | 'chapel' | 'frozen' | 'shadow';

export interface StageDef {
  /** Short display name for the HUD / banner. */
  name: string;
  /** Longer flavor shown on the stage transition banner. */
  banner: string;
  /** Decor style for scattered background props. */
  decor: DecorKind;
  /** Enemy types that are unlocked starting at this stage (indexed by minStage). */
  unlocksEnemies: EnemyType[];
  /** Palette for the procedural background tile + decor textures. */
  palette: {
    tileBase: number;
    tileBase2: number;
    tileAccent: number;
    dirt: number;
    decorMain: number;
    decorDark: number;
    decorLight: number;
  };
}

export const STAGE_DEFS: StageDef[] = [
  {
    name: 'The Fallen Forest',
    banner: 'THE FALLEN FOREST',
    decor: 'forest',
    unlocksEnemies: [],
    palette: {
      tileBase: 0x1a2418,
      tileBase2: 0x1c2819,
      tileAccent: 0x25341f,
      dirt: 0x241d16,
      decorMain: 0x28401f,
      decorDark: 0x1e2f1e,
      decorLight: 0x335229,
    },
  },
  {
    name: 'The Ruined Chapel',
    banner: 'THE RUINED CHAPEL',
    decor: 'chapel',
    unlocksEnemies: ['ghoul'],
    palette: {
      tileBase: 0x2a2820,
      tileBase2: 0x2e2c24,
      tileAccent: 0x383530,
      dirt: 0x1e1c18,
      decorMain: 0x4a4640,
      decorDark: 0x353230,
      decorLight: 0x6b6660,
    },
  },
  {
    name: 'The Frozen Pass',
    banner: 'THE FROZEN PASS',
    decor: 'frozen',
    unlocksEnemies: ['iceWolf'],
    palette: {
      tileBase: 0x1e2630,
      tileBase2: 0x222a35,
      tileAccent: 0x2e3a48,
      dirt: 0x1a2230,
      decorMain: 0x8ec9e8,
      decorDark: 0x4f7fa8,
      decorLight: 0xd4f0ff,
    },
  },
  {
    name: 'The Shadow Realm',
    banner: 'THE SHADOW REALM',
    decor: 'shadow',
    unlocksEnemies: ['shadowWraith'],
    palette: {
      tileBase: 0x1a1428,
      tileBase2: 0x1e1830,
      tileAccent: 0x2a2040,
      dirt: 0x140e20,
      decorMain: 0x8b6fae,
      decorDark: 0x4a3468,
      decorLight: 0xc4a8ff,
    },
  },
];

/**
 * Get the StageDef for a given stage number. Stages cycle through STAGE_DEFS
 * with progressively darker palettes for cycles beyond the first (stage 5+
 * reuses stage 1's def but the caller can apply a darkening tint).
 */
export function getStageDef(stage: number): StageDef {
  const idx = (stage - 1) % STAGE_DEFS.length;
  return STAGE_DEFS[idx];
}

/**
 * Get enemy types available at the given stage. Each stage has its own
 * set of enemies — base types (slime/skel/wisp/wraith) are always
 * available, plus whatever this specific stage unlocks. Previous stages'
 * special enemies are NOT carried forward (each stage feels distinct).
 */
export function availableEnemyTypes(stage: number): EnemyType[] {
  // Each stage has its own set of enemies. Stage 1 = slimes only, stage 2 = skeletons,
  // stage 3 = wisps, stage 4 = wraiths, plus the stage's special enemies.
  const stageTypes: Record<number, EnemyType[]> = {
    1: ['slime'],
    2: ['skel'],
    3: ['wisp'],
    4: ['wraith'],
  };
  const base = stageTypes[stage] || ['slime', 'skel', 'wisp', 'wraith'];
  const def = getStageDef(stage);
  const types = [...base];
  for (const t of def.unlocksEnemies) {
    if (!types.includes(t)) types.push(t);
  }
  return types;
}

/** Boss ability defs — one per boss, keyed by boss defId. */
export interface BossAbilityDef {
  bossId: string;
  bossName: string;
  abilityName: string;
  desc: string;
  /** Per-rank description for the Meta Grimoire upgrade panel (index 0 = rank 1). */
  rankDescs: string[];
}

export const BOSS_ABILITIES: BossAbilityDef[] = [
  {
    bossId: 'elderWraith',
    bossName: 'Elder Wraith',
    abilityName: 'Spectral Step',
    desc: 'Your dash leaves a fire trail along its path that burns enemies.',
    rankDescs: [
      'Leave a fire trail on dash path (15 trail dmg + burn).',
      'Trail dmg 25 + longer burn.',
      'Trail dmg 35 + even longer burn.',
      'Trail dmg 45 + wider trail.',
      'Trail dmg 60 + max burn duration.',
    ],
  },
  {
    bossId: 'emberColossus',
    bossName: 'Ember Colossus',
    abilityName: 'Magma Core',
    desc: 'Passively emit a fire pulse every 8s that damages and burns nearby enemies.',
    rankDescs: [
      'Pulse radius 120, 20 dmg + burn.',
      'Pulse radius 140, 30 dmg + burn.',
      'Pulse radius 160, 40 dmg + burn.',
      'Pulse radius 180, 55 dmg + burn.',
      'Pulse radius 200, 75 dmg + burn.',
    ],
  },
  {
    bossId: 'rimeSovereign',
    bossName: 'Rime Sovereign',
    abilityName: 'Frost Aura',
    desc: 'Enemies near you are passively slowed.',
    rankDescs: [
      'Slow 20% within 80px.',
      'Slow 25% within 100px.',
      'Slow 30% within 120px.',
      'Slow 35% within 140px.',
      'Slow 40% within 160px.',
    ],
  },
  {
    bossId: 'brambleHorror',
    bossName: 'Bramble Horror',
    abilityName: 'Thorn Armor',
    desc: 'When hit, reflect damage back to the attacker and knock them back.',
    rankDescs: [
      'Reflect 20 dmg to attacker.',
      'Reflect 30 dmg + knockback.',
      'Reflect 45 dmg + knockback.',
      'Reflect 65 dmg + strong knockback.',
      'Reflect 90 dmg + strong knockback.',
    ],
  },
];

export const BOSS_ABILITY_BY_BOSS: Record<string, BossAbilityDef> = {};
BOSS_ABILITIES.forEach((a) => (BOSS_ABILITY_BY_BOSS[a.bossId] = a));