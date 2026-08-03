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
 * Get all enemy types available at the given stage — all types from stage 1
 * up to the current stage's unlocks, accumulated.
 */
export function availableEnemyTypes(stage: number): EnemyType[] {
  const types: EnemyType[] = ['slime', 'skel', 'wisp', 'wraith'];
  for (let s = 1; s <= stage; s++) {
    const def = getStageDef(s);
    for (const t of def.unlocksEnemies) {
      if (!types.includes(t)) types.push(t);
    }
  }
  return types;
}

/** Boss ability defs — one per boss, keyed by boss defId. */
export interface BossAbilityDef {
  bossId: string;
  bossName: string;
  abilityName: string;
  desc: string;
}

export const BOSS_ABILITIES: BossAbilityDef[] = [
  {
    bossId: 'elderWraith',
    bossName: 'Elder Wraith',
    abilityName: 'Spectral Step',
    desc: 'Your dash leaves a brief damaging trail along its path.',
  },
  {
    bossId: 'emberColossus',
    bossName: 'Ember Colossus',
    abilityName: 'Magma Core',
    desc: 'Passively emit a fire pulse every 8s that damages and burns nearby enemies.',
  },
  {
    bossId: 'rimeSovereign',
    bossName: 'Rime Sovereign',
    abilityName: 'Frost Aura',
    desc: 'Enemies within 60px of you are passively slowed by 20%.',
  },
  {
    bossId: 'brambleHorror',
    bossName: 'Bramble Horror',
    abilityName: 'Thorn Armor',
    desc: 'When hit, reflect 20 damage back to the attacker.',
  },
];

export const BOSS_ABILITY_BY_BOSS: Record<string, BossAbilityDef> = {};
BOSS_ABILITIES.forEach((a) => (BOSS_ABILITY_BY_BOSS[a.bossId] = a));