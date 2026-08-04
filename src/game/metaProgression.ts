/**
 * Meta progression system — a SEPARATE, permanent upgrade tree that persists
 * across deaths via localStorage. Players earn "essence" (meta currency) from
 * kills during a run; essence is only "banked" (added to the persistent total)
 * when the player dies, giving death a purpose while keeping the session-only
 * ethos intact (closing the browser mid-run forfeits the run's unbanked essence).
 *
 * Meta upgrades are simple flat stat multipliers (damage, attack speed, move
 * speed, max HP, XP gain, essence gain) that stack multiplicatively with the
 * in-run Grimoire's derived stats. They form a persistent "power floor" — each
 * run you're a bit stronger than the last, but the in-run Grimoire still
 * provides the bulk of build variety.
 *
 * Storage key: "hollowmere_meta" — a JSON blob:
 *   { essence: number, ranks: Record<metaId, number> }
 */
import type { World } from './types';

const STORAGE_KEY = 'hollowmere_meta';

export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: string;
  maxRank: number;
  /** Cost for rank k (1-indexed) — progressive. */
  costAt: (rank: number) => number;
  /** Per-rank bonus value (e.g. 0.05 = +5% per rank). */
  perRank: number;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  // Meta progression expanded: max ranks raised to 10-15 per upgrade with
  // exponential cost scaling (base * rate^(rank-1)) so later ranks are far
  // more expensive than early ones. Per-rank bonuses are unchanged — the
  // longer grind and steeper cost curve provide the pacing. Two new upgrades
  // (Restorative Spirit, Arcane Reach) add healing-power and spell-radius
  // scaling for broader build variety.
  { id: 'dmg',       name: 'Arcane Resonance',  desc: '+3.5% damage per rank.',                   maxRank: 12, costAt: (r) => Math.round(10 * Math.pow(1.30, r - 1)),  perRank: 0.035 },
  { id: 'cd',        name: 'Swift Spirit',      desc: '+3% cooldown reduction per rank.',         maxRank: 12, costAt: (r) => Math.round(12 * Math.pow(1.30, r - 1)),  perRank: 0.03 },
  { id: 'move',      name: 'Wanderlust',        desc: '+3% movement speed per rank.',             maxRank: 12, costAt: (r) => Math.round(10 * Math.pow(1.28, r - 1)),  perRank: 0.03 },
  { id: 'hp',        name: 'Vital Essence',     desc: '+3.5% max HP per rank.',                   maxRank: 12, costAt: (r) => Math.round(12 * Math.pow(1.30, r - 1)),  perRank: 0.035 },
  { id: 'xp',        name: 'Soul Harvest',      desc: '+4% XP gain per rank.',                    maxRank: 10, costAt: (r) => Math.round(15 * Math.pow(1.32, r - 1)),  perRank: 0.04 },
  { id: 'essence',   name: 'Echoing Glory',     desc: '+5.5% essence gain per rank.',             maxRank: 10, costAt: (r) => Math.round(18 * Math.pow(1.33, r - 1)),  perRank: 0.055 },
  { id: 'crit',      name: 'Keening Edge',      desc: '+2% critical chance per rank.',            maxRank: 10, costAt: (r) => Math.round(24 * Math.pow(1.33, r - 1)),  perRank: 0.02 },
  { id: 'critdmg',   name: 'Devastation',       desc: '+10% critical damage per rank.',           maxRank: 10, costAt: (r) => Math.round(22 * Math.pow(1.30, r - 1)),  perRank: 0.10 },
  { id: 'regen',     name: 'Lingering Vigor',   desc: '+0.3 HP/sec regeneration per rank.',       maxRank: 12, costAt: (r) => Math.round(18 * Math.pow(1.28, r - 1)),  perRank: 0.3 },
  { id: 'lifesteal', name: 'Sanguine Pact',     desc: '+1.5% lifesteal per rank.',                maxRank: 10, costAt: (r) => Math.round(28 * Math.pow(1.33, r - 1)),  perRank: 0.015 },
  { id: 'dr',        name: 'Iron Resolve',      desc: '+2% damage reduction per rank.',          maxRank: 10, costAt: (r) => Math.round(30 * Math.pow(1.33, r - 1)),  perRank: 0.02 },
  { id: 'dash',      name: 'Flowing Step',      desc: '+4% dash cooldown reduction per rank.',   maxRank: 10, costAt: (r) => Math.round(20 * Math.pow(1.30, r - 1)),  perRank: 0.04 },
  // Flat numeric boosts for broader build variety.
  { id: 'startlevel',name: 'Veteran Soul',      desc: 'Start each run 1 level higher per rank (more starting SP).', maxRank: 6,  costAt: (r) => Math.round(40 * Math.pow(1.40, r - 1)), perRank: 1 },
  { id: 'starthp',   name: 'Inner Fortitude',    desc: '+20 starting HP per rank.',               maxRank: 8,  costAt: (r) => Math.round(30 * Math.pow(1.35, r - 1)),  perRank: 20 },
  { id: 'bossearn',  name: 'Trophy Hunter',      desc: '+18% essence from boss kills per rank.',  maxRank: 8,  costAt: (r) => Math.round(35 * Math.pow(1.35, r - 1)),  perRank: 0.18 },
  { id: 'projspeed', name: 'Aether Velocity',   desc: '+6% projectile speed per rank.',          maxRank: 10, costAt: (r) => Math.round(22 * Math.pow(1.30, r - 1)),  perRank: 0.06 },
  { id: 'dashdist',  name: 'Long Stride',       desc: '+7% dash distance per rank.',             maxRank: 8,  costAt: (r) => Math.round(28 * Math.pow(1.32, r - 1)),  perRank: 0.07 },
  // New meta upgrades — healing power and spell radius scaling.
  { id: 'healmult',  name: 'Restorative Spirit', desc: '+5% healing from all sources per rank.',  maxRank: 10, costAt: (r) => Math.round(18 * Math.pow(1.30, r - 1)),  perRank: 0.05 },
  { id: 'aoe',       name: 'Arcane Reach',      desc: '+5% spell radius per rank.',              maxRank: 10, costAt: (r) => Math.round(20 * Math.pow(1.32, r - 1)),  perRank: 0.05 },
];

export interface MetaState {
  essence: number;
  ranks: Record<string, number>;
  /** Boss ability unlock state — keyed by boss defId (e.g. 'elderWraith').
   *  Legacy boolean form (bossAbilities) is migrated to bossAbilityRanks on load. */
  bossAbilities: Record<string, boolean>;
  /** Boss ability upgrade ranks (1-indexed; rank 0 = not yet earned).
   *  Rank 1 is granted for free when the boss is first defeated; ranks 2+
   *  are purchased with essence in the Meta Grimoire. */
  bossAbilityRanks: Record<string, number>;
}

export const META_BY_ID: Record<string, MetaUpgradeDef> = {};
META_UPGRADES.forEach((m) => (META_BY_ID[m.id] = m));

/** Load meta state from localStorage, with a small head-start (1 rank of dmg). */
export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MetaState;
      if (typeof parsed.essence === 'number' && parsed.ranks) {
        // Ensure bossAbilities field exists (backward compat with old saves).
        if (!parsed.bossAbilities) parsed.bossAbilities = {};
        // Ensure bossAbilityRanks field exists; migrate legacy boolean
        // unlocks into rank 1 so previously-earned abilities stay active.
        if (!parsed.bossAbilityRanks) parsed.bossAbilityRanks = {};
        for (const k of Object.keys(parsed.bossAbilities)) {
          if (parsed.bossAbilities[k] && !parsed.bossAbilityRanks[k]) {
            parsed.bossAbilityRanks[k] = 1;
          }
        }
        return parsed;
      }
    }
  } catch {
    // corrupt or unavailable — fall through to fresh state
  }
  // Fresh state: grant 1 free rank of Arcane Resonance as a head-start.
  return { essence: 0, ranks: { dmg: 1 }, bossAbilities: {}, bossAbilityRanks: {} };
}

/** Persist meta state to localStorage. */
export function saveMeta(state: MetaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (private mode etc.) — silently no-op.
  }
}

/** Essence earned per regular enemy kill, scaled by the enemy's xpValue and essence-gain meta. */
export function essenceForEnemyKill(world: World, xpValue: number): number {
  const meta = metaStateOf(world);
  const mult = 1 + (meta.ranks.essence ? meta.ranks.essence * META_BY_ID['essence'].perRank : 0);
  // 1-3 essence based on xpValue tier.
  const base = Math.max(1, Math.round(xpValue / 3));
  return Math.max(1, Math.round(base * mult));
}

/** Essence earned per boss kill, scaled by essence-gain meta and boss-essence meta. */
export function essenceForBossKill(world: World, xpValue: number): number {
  const meta = metaStateOf(world);
  const mult = 1 + (meta.ranks.essence ? meta.ranks.essence * META_BY_ID['essence'].perRank : 0);
  const bossMult = 1 + (meta.ranks.bossearn ? meta.ranks.bossearn * META_BY_ID['bossearn'].perRank : 0);
  // 20-50 based on boss xpValue.
  const base = Math.max(20, Math.round(xpValue / 2));
  return Math.max(20, Math.round(base * mult * bossMult));
}

/**
 * Attach a live MetaState reference to the world for the duration of a run.
 * The run accumulates *unbanked* essence in `world.runEssence`; on death that
 * is added to the persistent `state.essence` and saved.
 */
export function attachMeta(world: World, state: MetaState): void {
  (world as unknown as { metaState: MetaState }).metaState = state;
}

/** Read the meta state attached to the world (or load a fresh one if missing). */
export function metaStateOf(world: World): MetaState {
  const w = world as unknown as { metaState?: MetaState };
  if (w.metaState) return w.metaState;
  const fresh = loadMeta();
  w.metaState = fresh;
  return fresh;
}

/** Add unbanked essence earned during the current run. */
export function addRunEssence(world: World, amount: number): void {
  const w = world as unknown as { runEssence?: number };
  w.runEssence = (w.runEssence || 0) + amount;
}

/** Read unbanked essence earned during the current run (for game-over display). */
export function getRunEssence(world: World): number {
  return (world as unknown as { runEssence?: number }).runEssence || 0;
}

/**
 * Bank the run's accumulated essence into the persistent total on death.
 * Returns the amount banked (0 if nothing to bank).
 */
export function bankRunEssence(world: World): number {
  const earned = getRunEssence(world);
  if (earned <= 0) return 0;
  const meta = metaStateOf(world);
  meta.essence += earned;
  saveMeta(meta);
  // Clear run essence so it can't be double-banked.
  (world as unknown as { runEssence?: number }).runEssence = 0;
  return earned;
}

/** Current rank of a meta upgrade (0 if unpurchased). */
export function metaRank(world: World, id: string): number {
  return metaStateOf(world).ranks[id] || 0;
}

/** Cost to buy the NEXT rank of a meta upgrade (or 0 if maxed). */
export function metaNextCost(world: World, id: string): number {
  const def = META_BY_ID[id];
  const rank = metaRank(world, id);
  if (rank >= def.maxRank) return 0;
  return def.costAt(rank + 1);
}

/** Purchase the next rank of a meta upgrade. Returns true on success. */
export function buyMetaRank(world: World, id: string): boolean {
  const def = META_BY_ID[id];
  if (!def) return false;
  const meta = metaStateOf(world);
  const rank = meta.ranks[id] || 0;
  if (rank >= def.maxRank) return false;
  const cost = def.costAt(rank + 1);
  if (meta.essence < cost) return false;
  meta.essence -= cost;
  meta.ranks[id] = rank + 1;
  saveMeta(meta);
  return true;
}

// ---------------- derived-stat accessors (used by player.ts) ----------------

export function metaDamageMult(world: World): number {
  return 1 + metaRank(world, 'dmg') * META_BY_ID['dmg'].perRank;
}
export function metaCooldownMult(world: World): number {
  return 1 - metaRank(world, 'cd') * META_BY_ID['cd'].perRank;
}
export function metaMoveMult(world: World): number {
  return 1 + metaRank(world, 'move') * META_BY_ID['move'].perRank;
}
export function metaHpMult(world: World): number {
  return 1 + metaRank(world, 'hp') * META_BY_ID['hp'].perRank;
}
export function metaXpMult(world: World): number {
  return 1 + metaRank(world, 'xp') * META_BY_ID['xp'].perRank;
}
export function metaCritChance(world: World): number {
  return metaRank(world, 'crit') * META_BY_ID['crit'].perRank;
}
export function metaCritDmgMult(world: World): number {
  return metaRank(world, 'critdmg') * META_BY_ID['critdmg'].perRank;
}
export function metaRegenPerSec(world: World): number {
  return metaRank(world, 'regen') * META_BY_ID['regen'].perRank;
}
export function metaLifestealPct(world: World): number {
  return metaRank(world, 'lifesteal') * META_BY_ID['lifesteal'].perRank;
}
export function metaDamageReduction(world: World): number {
  return metaRank(world, 'dr') * META_BY_ID['dr'].perRank;
}
export function metaDashCdMult(world: World): number {
  return 1 - metaRank(world, 'dash') * META_BY_ID['dash'].perRank;
}

// New meta accessors for the additional upgrade types.

/** Flat starting-level bonus from Veteran Soul meta (0 if unpurchased). */
export function metaStartLevel(world: World): number {
  return metaRank(world, 'startlevel') * META_BY_ID['startlevel'].perRank;
}

/** Flat starting-HP bonus from Inner Fortitude meta (0 if unpurchased). */
export function metaStartHP(world: World): number {
  return metaRank(world, 'starthp') * META_BY_ID['starthp'].perRank;
}

/** Projectile-speed multiplier from Aether Velocity meta (1.0 if unpurchased). */
export function metaProjSpeedMult(world: World): number {
  return 1 + metaRank(world, 'projspeed') * META_BY_ID['projspeed'].perRank;
}

/** Dash-distance multiplier from Long Stride meta (1.0 if unpurchased). */
export function metaDashDistMult(world: World): number {
  return 1 + metaRank(world, 'dashdist') * META_BY_ID['dashdist'].perRank;
}

/** Healing-power multiplier from Restorative Spirit meta (1.0 if unpurchased). */
export function metaHealingMult(world: World): number {
  return 1 + metaRank(world, 'healmult') * META_BY_ID['healmult'].perRank;
}

/** Spell-radius multiplier from Arcane Reach meta (1.0 if unpurchased). */
export function metaSpellRadiusMult(world: World): number {
  return 1 + metaRank(world, 'aoe') * META_BY_ID['aoe'].perRank;
}

// ---------------- Boss ability accessors ----------------

/** Check if a boss ability (by boss defId) is earned (rank >= 1). */
export function hasBossAbility(world: World, bossId: string): boolean {
  const meta = metaStateOf(world);
  return (meta.bossAbilityRanks[bossId] || 0) >= 1;
}

/** Get the current upgrade rank of a boss ability (0 = not earned). */
export function bossAbilityRank(world: World, bossId: string): number {
  const meta = metaStateOf(world);
  return meta.bossAbilityRanks[bossId] || 0;
}

/** Get all earned boss ability IDs (rank >= 1). */
export function unlockedBossAbilities(world: World): string[] {
  const meta = metaStateOf(world);
  return Object.keys(meta.bossAbilityRanks).filter((k) => (meta.bossAbilityRanks[k] || 0) >= 1);
}

/**
 * Bank pending boss ability unlocks (collected during the run) into the
 * persistent meta state on death. Defeating a boss for the first time grants
 * rank 1 for free. Returns the list of newly-unlocked ability boss IDs
 * (for the game-over display).
 */
export function bankBossAbilities(world: World): string[] {
  const pending = world.pendingBossAbilityUnlocks;
  if (!pending || pending.length === 0) return [];
  const meta = metaStateOf(world);
  const newlyUnlocked: string[] = [];
  for (const bossId of pending) {
    if ((meta.bossAbilityRanks[bossId] || 0) < 1) {
      meta.bossAbilityRanks[bossId] = 1;
      // Keep legacy boolean in sync for any code that still reads it.
      meta.bossAbilities[bossId] = true;
      newlyUnlocked.push(bossId);
    }
  }
  if (newlyUnlocked.length > 0) saveMeta(meta);
  // Clear pending unlocks so they can't be double-banked.
  world.pendingBossAbilityUnlocks = [];
  return newlyUnlocked;
}

/**
 * Purchase the next upgrade rank of a boss ability with essence. Rank 1
 * must be earned by defeating the boss; ranks 2+ are purchased here.
 * Returns true on success.
 */
export function buyBossAbilityRank(world: World, bossId: string): boolean {
  const meta = metaStateOf(world);
  const rank = meta.bossAbilityRanks[bossId] || 0;
  if (rank < 1) return false; // must defeat the boss first
  const maxRank = BOSS_ABILITY_MAX_RANK;
  if (rank >= maxRank) return false;
  const cost = bossAbilityCostAt(rank + 1);
  if (meta.essence < cost) return false;
  meta.essence -= cost;
  meta.bossAbilityRanks[bossId] = rank + 1;
  saveMeta(meta);
  return true;
}

/** Essence cost to buy rank `r` (2-indexed; rank 1 is free from the boss kill). */
export function bossAbilityCostAt(rank: number): number {
  // Rank 2: 40, Rank 3: 70, Rank 4: 110, Rank 5: 160
  return 25 + (rank - 1) * 25 + (rank - 2) * 15;
}

/** Maximum upgrade rank for boss abilities. */
export const BOSS_ABILITY_MAX_RANK = 5;

/** Cost to buy the NEXT rank of a boss ability (0 if maxed or not yet earned). */
export function bossAbilityNextCost(world: World, bossId: string): number {
  const rank = bossAbilityRank(world, bossId);
  if (rank < 1 || rank >= BOSS_ABILITY_MAX_RANK) return 0;
  return bossAbilityCostAt(rank + 1);
}