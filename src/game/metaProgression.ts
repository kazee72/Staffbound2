/**
 * Meta progression system — an element-focused skill tree that persists
 * across deaths via localStorage. Players earn "essence" (meta currency) from
 * kills during a run; essence is only "banked" (added to the persistent total)
 * when the player dies, giving death a purpose while keeping the session-only
 * ethos intact (closing the browser mid-run forfeits the run's unbanked essence).
 *
 * The meta tree mirrors the in-run Grimoire's design: 9 element branches
 * (Fire, Ice, Void, Shadow, Nature, Holy, Lightning, Wind, Water) each with
 * 4-6 element-specific upgrades, plus a small "General" branch with upgrades
 * that apply to all elements. Each upgrade has 5-10 ranks with progressive
 * cost scaling.
 *
 * Storage key: "staffbound2_meta" — a JSON blob:
 *   { essence: number, ranks: Record<metaId, number> }
 */
import type { World } from './types';

const STORAGE_KEY = 'staffbound2_meta';

// ---------------- Element definitions ----------------

export type ElementId = 'fire' | 'ice' | 'void' | 'shadow' | 'nature' | 'potency' | 'holy' | 'lightning' | 'wind' | 'water' | 'rock' | 'summons' | 'ki';

export interface ElementBranchDef {
  id: ElementId;
  name: string;
  color: string;
  /** Short label for the staff/icon */
  short: string;
}

export const ELEMENT_BRANCHES: ElementBranchDef[] = [
  { id: 'fire',      name: 'Fire',      color: '#e2793d', short: 'F' },
  { id: 'ice',       name: 'Ice',       color: '#8ec9e8', short: 'R' },
  { id: 'void',      name: 'Void',      color: '#9d8ce0', short: 'V' },
  { id: 'shadow',    name: 'Shadow',    color: '#c4728f', short: 'S' },
  { id: 'nature',    name: 'Nature',    color: '#8bc48a', short: 'N' },
  { id: 'potency',   name: 'Potency',   color: '#4fd6c0', short: 'P' },
  { id: 'lightning', name: 'Lightning', color: '#c4e842', short: 'T' },
  { id: 'wind',      name: 'Wind',      color: '#a8d4e8', short: 'W' },
  { id: 'water',     name: 'Water',    color: '#4a9eff', short: 'Wa' },
  { id: 'rock',      name: 'Rock',     color: '#9a8b7a', short: 'Rk' },
  { id: 'holy',      name: 'Holy',      color: '#c9a869', short: 'H' },
  { id: 'summons',   name: 'Summons',  color: '#e0a070', short: 'Sm' },
  { id: 'ki',        name: 'Ki',        color: '#ffd966', short: 'K' },
];

export const ELEMENT_BY_ID: Record<string, ElementBranchDef> = {};
ELEMENT_BRANCHES.forEach((e) => (ELEMENT_BY_ID[e.id] = e));

// ---------------- Meta upgrade definitions ----------------

export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: string;
  maxRank: number;
  /** Cost for rank k (1-indexed) — progressive. */
  costAt: (rank: number) => number;
  /** Per-rank bonus value (e.g. 0.05 = +5% per rank). */
  perRank: number;
  /** Which element this upgrade belongs to ('general' for all-element upgrades). */
  element: ElementId | 'general';
}

/** Helper: exponential cost scaling. base * rate^(rank-1), rounded. */
function expCost(base: number, rate: number): (rank: number) => number {
  return (r: number) => Math.round(base * Math.pow(rate, r - 1));
}

// ===== GENERAL UPGRADES (apply to all elements) =====

const GENERAL_UPGRADES: MetaUpgradeDef[] = [
  { id: 'gen_dmg',      name: 'Arcane Resonance',  desc: '+3.5% all damage per rank.',            maxRank: 12, costAt: expCost(10, 1.30), perRank: 0.035, element: 'general' },
  { id: 'gen_hp',       name: 'Vital Essence',     desc: '+3.5% max HP per rank.',                maxRank: 12, costAt: expCost(12, 1.30), perRank: 0.035, element: 'general' },
  { id: 'gen_move',     name: 'Wanderlust',        desc: '+3% movement speed per rank.',          maxRank: 10, costAt: expCost(10, 1.28), perRank: 0.03,  element: 'general' },
  { id: 'gen_essence',  name: 'Echoing Glory',     desc: '+5.5% essence gain per rank.',          maxRank: 10, costAt: expCost(18, 1.33), perRank: 0.055, element: 'general' },
  { id: 'gen_xp',       name: 'Soul Harvest',      desc: '+4% XP gain per rank.',                 maxRank: 10, costAt: expCost(15, 1.32), perRank: 0.04,  element: 'general' },
];

// ===== FIRE TREE =====

const FIRE_UPGRADES: MetaUpgradeDef[] = [
  { id: 'fire_dmg',    name: 'Inner Flame',        desc: '+4% fire damage per rank.',             maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'fire' },
  { id: 'fire_burn',   name: 'Everburn',          desc: '+0.5s burn duration per rank.',         maxRank: 8,  costAt: expCost(15, 1.28), perRank: 0.5,   element: 'fire' },
  { id: 'fire_burndmg',name: 'Searing Heat',       desc: '+10% burn damage per rank.',            maxRank: 8,  costAt: expCost(18, 1.30), perRank: 0.10,  element: 'fire' },
  { id: 'fire_aoe',    name: 'Spreading Blaze',   desc: '+8% fire AoE radius per rank.',          maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.08,  element: 'fire' },
  { id: 'fire_speed',  name: 'Quick Spark',        desc: '+4% fire attack speed per rank.',       maxRank: 8,  costAt: expCost(20, 1.32), perRank: 0.04,  element: 'fire' },
];

// ===== ICE TREE =====

const ICE_UPGRADES: MetaUpgradeDef[] = [
  { id: 'ice_dmg',     name: 'Deep Freeze',        desc: '+4% ice damage per rank.',              maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'ice' },
  { id: 'ice_slow',    name: 'Biting Chill',       desc: '+3% slow strength per rank.',           maxRank: 8,  costAt: expCost(14, 1.28), perRank: 0.03,  element: 'ice' },
  { id: 'ice_slowdur', name: 'Lingering Frost',    desc: '+0.4s slow duration per rank.',         maxRank: 8,  costAt: expCost(15, 1.28), perRank: 0.4,   element: 'ice' },
  { id: 'ice_freeze',  name: 'Shatter',            desc: '+8% damage to frozen enemies per rank.',maxRank: 8,  costAt: expCost(18, 1.30), perRank: 0.08,  element: 'ice' },
  { id: 'ice_projspeed',name: 'Frost Lance',      desc: '+6% ice projectile speed per rank.',    maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.06,  element: 'ice' },
  { id: 'ice_armor',   name: 'Glacial Plating',    desc: '+15% frost armor strength per rank.',   maxRank: 6,  costAt: expCost(22, 1.32), perRank: 0.15,  element: 'ice' },
];

// ===== VOID TREE =====

const VOID_UPGRADES: MetaUpgradeDef[] = [
  { id: 'void_dmg',    name: 'Abyssal Power',      desc: '+4% void damage per rank.',             maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'void' },
  { id: 'void_homing', name: 'Seeking Void',       desc: '+6% homing strength per rank.',          maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.06,  element: 'void' },
  { id: 'void_pierce', name: 'Phase Shift',        desc: '+0.25 pierce count per rank.',          maxRank: 4,  costAt: expCost(25, 1.35), perRank: 0.25,  element: 'void' },
  { id: 'void_twincast',name: 'Echo of Void',     desc: '+3% twin cast chance per rank.',        maxRank: 8,  costAt: expCost(20, 1.32), perRank: 0.03,  element: 'void' },
  { id: 'void_projspeed',name: 'Aether Slip',      desc: '+6% void projectile speed per rank.',   maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.06,  element: 'void' },
];

// ===== SHADOW TREE =====

const SHADOW_UPGRADES: MetaUpgradeDef[] = [
  { id: 'shadow_dmg',  name: 'Umbral Edge',        desc: '+4% shadow damage per rank.',           maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'shadow' },
  { id: 'shadow_mark', name: 'Lasting Mark',       desc: '+0.5s mark duration per rank.',         maxRank: 8,  costAt: expCost(15, 1.28), perRank: 0.5,   element: 'shadow' },
  { id: 'shadow_markdmg',name: 'Death Mark',       desc: '+10% marked bonus damage per rank.',    maxRank: 8,  costAt: expCost(18, 1.30), perRank: 0.10,  element: 'shadow' },
  { id: 'shadow_crit', name: 'Shadow Strike',      desc: '+2% crit chance per rank.',             maxRank: 10, costAt: expCost(24, 1.33), perRank: 0.02,  element: 'shadow' },
  { id: 'shadow_critdmg',name: 'Devastation',      desc: '+10% crit damage per rank.',            maxRank: 8,  costAt: expCost(22, 1.30), perRank: 0.10,  element: 'shadow' },
];

// ===== NATURE TREE =====

const NATURE_UPGRADES: MetaUpgradeDef[] = [
  { id: 'nature_dmg',  name: 'Wild Growth',        desc: '+4% nature damage per rank.',           maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'nature' },
  { id: 'nature_pierce',name: 'Thorn Pierce',      desc: '+0.25 pierce count per rank.',          maxRank: 4,  costAt: expCost(22, 1.35), perRank: 0.25,  element: 'nature' },
  { id: 'nature_thorn',name: 'Bramble Length',     desc: '+8% thorn length per rank.',            maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.08,  element: 'nature' },
  { id: 'nature_vines',name: 'Tangling Vines',     desc: '+0.5s vine duration per rank.',         maxRank: 8,  costAt: expCost(15, 1.28), perRank: 0.5,   element: 'nature' },
  { id: 'nature_aoe',  name: 'Overgrowth',         desc: '+8% nature AoE radius per rank.',       maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.08,  element: 'nature' },
];

// ===== HOLY TREE =====

const HOLY_UPGRADES: MetaUpgradeDef[] = [
  { id: 'holy_dmg',    name: 'Divine Wrath',       desc: '+4% holy damage per rank.',             maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'holy' },
  { id: 'holy_splash', name: 'Radiant Burst',      desc: '+8% holy splash radius per rank.',      maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.08,  element: 'holy' },
  { id: 'holy_heal',   name: 'Blessing of Light',  desc: 'Heal 0.5 HP per holy hit per rank.',    maxRank: 8,  costAt: expCost(18, 1.30), perRank: 0.5,   element: 'holy' },
  { id: 'holy_speed',  name: 'Swift Prayer',       desc: '+4% holy attack speed per rank.',       maxRank: 8,  costAt: expCost(20, 1.32), perRank: 0.04,  element: 'holy' },
  { id: 'holy_dr',     name: 'Sanctuary',          desc: '+2% damage reduction per rank.',       maxRank: 8,  costAt: expCost(25, 1.32), perRank: 0.02,  element: 'holy' },
];

// ===== LIGHTNING TREE =====

const LIGHTNING_UPGRADES: MetaUpgradeDef[] = [
  { id: 'light_dmg',   name: 'Storm Power',        desc: '+4% lightning damage per rank.',        maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'lightning' },
  { id: 'light_chain', name: 'Arc Mastery',        desc: '+0.5 chain count per rank.',            maxRank: 6,  costAt: expCost(22, 1.33), perRank: 0.5,   element: 'lightning' },
  { id: 'light_range', name: 'Far Strike',         desc: '+10% chain range per rank.',            maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.10,  element: 'lightning' },
  { id: 'light_falloff',name: 'Sustained Arc',     desc: '+5% less chain damage falloff per rank.',maxRank: 8, costAt: expCost(18, 1.30), perRank: 0.05, element: 'lightning' },
  { id: 'light_speed', name: 'Quick Current',      desc: '+4% lightning attack speed per rank.',  maxRank: 8,  costAt: expCost(20, 1.32), perRank: 0.04,  element: 'lightning' },
];

// ===== WIND TREE =====

const WIND_UPGRADES: MetaUpgradeDef[] = [
  { id: 'wind_dmg',    name: 'Gale Force',         desc: '+4% wind damage per rank.',             maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'wind' },
  { id: 'wind_knock',  name: 'Cyclone',            desc: '+8% knockback force per rank.',         maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.08,  element: 'wind' },
  { id: 'wind_trail',  name: 'Lingering Gust',     desc: '+0.5s wind trail duration per rank.',   maxRank: 8,  costAt: expCost(15, 1.28), perRank: 0.5,   element: 'wind' },
  { id: 'wind_move',   name: 'Tailwind',          desc: '+3% move speed per rank.',              maxRank: 10, costAt: expCost(14, 1.30), perRank: 0.03,  element: 'wind' },
  { id: 'wind_dash',   name: 'Zephyr Step',        desc: '+8% dash distance per rank.',           maxRank: 8,  costAt: expCost(20, 1.32), perRank: 0.08,  element: 'wind' },
];

// ===== WATER TREE =====

const WATER_UPGRADES: MetaUpgradeDef[] = [
  { id: 'water_heal',  name: 'Soothing Wave',      desc: '+0.5 HP healed per water hit per rank.',maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.5,   element: 'water' },
  { id: 'water_tide',  name: 'Healing Tide',       desc: '+15% healing tide amount per rank.',    maxRank: 8,  costAt: expCost(18, 1.30), perRank: 0.15,  element: 'water' },
  { id: 'water_pull',  name: 'Whirlpool Pull',     desc: '+10% whirlpool pull force per rank.',   maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.10,  element: 'water' },
  { id: 'water_dmg',   name: 'Crushing Depth',     desc: '+4% water damage per rank.',            maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'water' },
  { id: 'water_cleanse',name: 'Purifying Flow',    desc: '+10% cleanse frequency per rank.',      maxRank: 8,  costAt: expCost(18, 1.32), perRank: 0.10,  element: 'water' },

  // Potency
  { id: 'pot_dmg',      name: 'Pure Power',       desc: '+5% all damage per rank.',              maxRank: 10, costAt: expCost(14, 1.30), perRank: 0.05,  element: 'potency' },
  { id: 'pot_crit',     name: 'Lethal Focus',     desc: '+3% crit chance per rank.',            maxRank: 8,  costAt: expCost(18, 1.32), perRank: 0.03,  element: 'potency' },
  { id: 'pot_critdmg',  name: 'Brutal Strikes',   desc: '+12% crit damage per rank.',          maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.12,  element: 'potency' },
  { id: 'pot_cd',       name: 'Rapid Cast',       desc: '+4% cooldown reduction per rank.',    maxRank: 8,  costAt: expCost(15, 1.30), perRank: 0.04,  element: 'potency' },
  { id: 'pot_dr',       name: 'Iron Will',        desc: '+3% damage reduction per rank.',      maxRank: 6,  costAt: expCost(20, 1.33), perRank: 0.03,  element: 'potency' },

  // Rock
  { id: 'rock_dmg',     name: 'Tectonic Power',   desc: '+4% rock damage per rank.',            maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.04,  element: 'rock' },
  { id: 'rock_splash',  name: 'Shrapnel Storm',   desc: '+8% splash radius per rank.',         maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.08,  element: 'rock' },
  { id: 'rock_armor',   name: 'Stone Skin',      desc: '+3% damage reduction per rank.',      maxRank: 8,  costAt: expCost(18, 1.32), perRank: 0.03,  element: 'rock' },
  { id: 'rock_hp',      name: 'Mountain Heart',   desc: '+5% max HP per rank.',               maxRank: 8,  costAt: expCost(14, 1.28), perRank: 0.05,  element: 'rock' },
  { id: 'rock_boulder', name: 'Avalanche',        desc: '+10% boulder size per rank.',        maxRank: 6,  costAt: expCost(20, 1.33), perRank: 0.10,  element: 'rock' },

  // Summons
  { id: 'summon_dmg',   name: 'Soul Power',      desc: '+5% summon damage per rank.',          maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.05,  element: 'summons' },
  { id: 'summon_hp',    name: 'Soul Cache',      desc: '+10% summon HP per rank.',            maxRank: 8,  costAt: expCost(14, 1.28), perRank: 0.10,  element: 'summons' },
  { id: 'summon_duration',name: 'Eternal Bond',  desc: '+15% summon duration per rank.',       maxRank: 6,  costAt: expCost(16, 1.30), perRank: 0.15,  element: 'summons' },
  { id: 'summon_count', name: 'Pack Leader',     desc: '+0.5 max summons per rank.',           maxRank: 4,  costAt: expCost(25, 1.35), perRank: 0.5,   element: 'summons' },
  { id: 'summon_heal',  name: 'Spirit Link',     desc: '+0.5 HP/sec healed by summons per rank.',maxRank: 8, costAt: expCost(18, 1.30), perRank: 0.5,   element: 'summons' },

  // Ki
  { id: 'ki_dmg',       name: 'Inner Strength',  desc: '+5% ki damage per rank.',              maxRank: 10, costAt: expCost(12, 1.30), perRank: 0.05,  element: 'ki' },
  { id: 'ki_beam',      name: 'Beam Mastery',    desc: '+10% kamehameha damage per rank.',     maxRank: 8,  costAt: expCost(18, 1.32), perRank: 0.10,  element: 'ki' },
  { id: 'ki_beamdur',   name: 'Extended Charge', desc: '+0.3s kamehameha duration per rank.', maxRank: 6,  costAt: expCost(20, 1.33), perRank: 0.3,   element: 'ki' },
  { id: 'ki_kaioken',   name: 'Kaio-ken Mastery',desc: '+5% kaio-ken damage boost per rank.', maxRank: 8,  costAt: expCost(16, 1.30), perRank: 0.05,  element: 'ki' },
  { id: 'ki_speed',     name: 'Ki Speed',        desc: '+4% ki attack speed per rank.',       maxRank: 8,  costAt: expCost(15, 1.30), perRank: 0.04,  element: 'ki' },
];

// ===== All upgrades combined =====

export const META_UPGRADES: MetaUpgradeDef[] = [
  ...GENERAL_UPGRADES,
  ...FIRE_UPGRADES,
  ...ICE_UPGRADES,
  ...VOID_UPGRADES,
  ...SHADOW_UPGRADES,
  ...NATURE_UPGRADES,
  ...HOLY_UPGRADES,
  ...LIGHTNING_UPGRADES,
  ...WIND_UPGRADES,
  ...WATER_UPGRADES,
];

export const META_BY_ID: Record<string, MetaUpgradeDef> = {};
META_UPGRADES.forEach((m) => (META_BY_ID[m.id] = m));

/** Upgrades grouped by element — used by the UI to render element branches. */
export function metaUpgradesByElement(): Record<string, MetaUpgradeDef[]> {
  const groups: Record<string, MetaUpgradeDef[]> = { general: [], fire: [], ice: [], void: [], shadow: [], nature: [], potency: [], holy: [], lightning: [], wind: [], water: [], rock: [], summons: [], ki: [] };
  for (const m of META_UPGRADES) {
    (groups[m.element] ?? (groups[m.element] = [])).push(m);
  }
  return groups;
}

// ---------------- Meta state ----------------

export interface MetaState {
  essence: number;
  ranks: Record<string, number>;
}

/** Load meta state from localStorage, with a small head-start (1 rank of gen_dmg). */
export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MetaState;
      if (typeof parsed.essence === 'number' && parsed.ranks) {
        // Migrate old upgrade IDs: old flat IDs → new element-prefixed IDs.
        const migration: Record<string, string> = {
          dmg: 'gen_dmg', cd: 'gen_cd', move: 'gen_move', hp: 'gen_hp', xp: 'gen_xp',
          essence: 'gen_essence', crit: 'shadow_crit', critdmg: 'shadow_critdmg',
          regen: 'gen_regen', lifesteal: 'gen_lifesteal', dr: 'holy_dr',
          dash: 'gen_dash', startlevel: 'gen_startlevel', starthp: 'gen_starthp',
          bossearn: 'gen_bossearn', projspeed: 'gen_projspeed', dashdist: 'wind_dash',
          healmult: 'gen_healmult', aoe: 'gen_aoe',
        };
        for (const oldId of Object.keys(parsed.ranks)) {
          const newId = migration[oldId];
          if (newId && !parsed.ranks[newId]) {
            parsed.ranks[newId] = parsed.ranks[oldId];
            delete parsed.ranks[oldId];
          }
        }
        return parsed;
      }
    }
  } catch {
    // corrupt or unavailable — fall through to fresh state
  }
  // Fresh state: grant 1 free rank of Arcane Resonance as a head-start.
  return { essence: 0, ranks: { gen_dmg: 1 } };
}

/** Persist meta state to localStorage. */
export function saveMeta(state: MetaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (private mode etc.) — silently no-op.
  }
}

// ---------------- Essence earning ----------------

/** Essence earned per regular enemy kill, scaled by the enemy's xpValue and essence-gain meta. */
export function essenceForEnemyKill(world: World, xpValue: number): number {
  const meta = metaStateOf(world);
  const mult = 1 + (meta.ranks.gen_essence ? meta.ranks.gen_essence * META_BY_ID['gen_essence'].perRank : 0);
  // 1-3 essence based on xpValue tier.
  const base = Math.max(1, Math.round(xpValue / 3));
  return Math.max(1, Math.round(base * mult));
}

/** Essence earned per boss kill, scaled by essence-gain meta. */
export function essenceForBossKill(world: World, xpValue: number): number {
  const meta = metaStateOf(world);
  const mult = 1 + (meta.ranks.gen_essence ? meta.ranks.gen_essence * META_BY_ID['gen_essence'].perRank : 0);
  // 20-50 based on boss xpValue.
  const base = Math.max(20, Math.round(xpValue / 2));
  return Math.max(20, Math.round(base * mult));
}

// ---------------- World attachment ----------------

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

// ---------------- Rank accessors ----------------

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

// ---------------- General derived-stat accessors (used by player.ts) ----------------

export function metaDamageMult(world: World): number {
  return 1 + metaRank(world, 'gen_dmg') * META_BY_ID['gen_dmg'].perRank;
}
export function metaMoveMult(world: World): number {
  return 1 + metaRank(world, 'gen_move') * META_BY_ID['gen_move'].perRank;
}
export function metaHpMult(world: World): number {
  return 1 + metaRank(world, 'gen_hp') * META_BY_ID['gen_hp'].perRank;
}
export function metaXpMult(world: World): number {
  return 1 + metaRank(world, 'gen_xp') * META_BY_ID['gen_xp'].perRank;
}
export function metaCritChance(world: World): number {
  return metaRank(world, 'shadow_crit') * META_BY_ID['shadow_crit'].perRank;
}
export function metaCritDmgMult(world: World): number {
  return metaRank(world, 'shadow_critdmg') * META_BY_ID['shadow_critdmg'].perRank;
}
export function metaDamageReduction(world: World): number {
  return metaRank(world, 'holy_dr') * META_BY_ID['holy_dr'].perRank;
}

// Element-specific meta damage multipliers — applied to the bolt/spell of the matching element.

/** Damage multiplier for the player's currently selected element (from element-specific meta tree). */
export function metaElementDamageMult(world: World, element: string): number {
  const id = element + '_dmg';
  const def = META_BY_ID[id];
  if (!def) return 1;
  return 1 + metaRank(world, id) * def.perRank;
}

/** Damage multiplier for the player's selected element, combined with the general all-damage meta. */
export function metaSelectedElementDamageMult(world: World): number {
  const el = (world.selectedElement || 'void') as string;
  return metaDamageMult(world) * metaElementDamageMult(world, el);
}

// ---------------- Element-specific meta accessors (used by spells.ts) ----------------

/** Fire: extra burn duration in seconds (0 if unpurchased). */
export function metaFireBurnDur(world: World): number {
  return metaRank(world, 'fire_burn') * META_BY_ID['fire_burn'].perRank;
}

/** Fire: burn damage multiplier (1.0 if unpurchased). */
export function metaFireBurnDmgMult(world: World): number {
  return 1 + metaRank(world, 'fire_burndmg') * META_BY_ID['fire_burndmg'].perRank;
}

/** Fire: AoE radius multiplier (1.0 if unpurchased). */
export function metaFireAoEMult(world: World): number {
  return 1 + metaRank(world, 'fire_aoe') * META_BY_ID['fire_aoe'].perRank;
}

/** Fire: attack speed multiplier — reduces bolt cooldown (1.0 if unpurchased). */
export function metaFireAttackSpeedMult(world: World): number {
  return 1 + metaRank(world, 'fire_speed') * META_BY_ID['fire_speed'].perRank;
}

/** Ice: extra slow strength (additive to base 0.2, e.g. +0.03/rank). */
export function metaIceSlowBonus(world: World): number {
  return metaRank(world, 'ice_slow') * META_BY_ID['ice_slow'].perRank;
}

/** Ice: extra slow duration in seconds. */
export function metaIceSlowDurBonus(world: World): number {
  return metaRank(world, 'ice_slowdur') * META_BY_ID['ice_slowdur'].perRank;
}

/** Ice: bonus damage to frozen/slowed enemies (multiplier, 0 if unpurchased). */
export function metaIceFreezeDmgMult(world: World): number {
  return metaRank(world, 'ice_freeze') * META_BY_ID['ice_freeze'].perRank;
}

/** Ice: projectile speed multiplier (1.0 if unpurchased). */
export function metaIceProjSpeedMult(world: World): number {
  return 1 + metaRank(world, 'ice_projspeed') * META_BY_ID['ice_projspeed'].perRank;
}

/** Ice: frost armor strength multiplier (1.0 if unpurchased). */
export function metaIceArmorMult(world: World): number {
  return 1 + metaRank(world, 'ice_armor') * META_BY_ID['ice_armor'].perRank;
}

/** Void: homing strength multiplier (1.0 if unpurchased). */
export function metaVoidHomingMult(world: World): number {
  return 1 + metaRank(world, 'void_homing') * META_BY_ID['void_homing'].perRank;
}

/** Void: bonus pierce count (0 if unpurchased). Fractional ranks floor to 0). */
export function metaVoidPierceBonus(world: World): number {
  return Math.floor(metaRank(world, 'void_pierce') * META_BY_ID['void_pierce'].perRank);
}

/** Void: twin cast chance (0-1, 0 if unpurchased). */
export function metaVoidTwinCastChance(world: World): number {
  return metaRank(world, 'void_twincast') * META_BY_ID['void_twincast'].perRank;
}

/** Void: projectile speed multiplier (1.0 if unpurchased). */
export function metaVoidProjSpeedMult(world: World): number {
  return 1 + metaRank(world, 'void_projspeed') * META_BY_ID['void_projspeed'].perRank;
}

/** Shadow: extra mark duration in seconds. */
export function metaShadowMarkDurBonus(world: World): number {
  return metaRank(world, 'shadow_mark') * META_BY_ID['shadow_mark'].perRank;
}

/** Shadow: marked bonus damage multiplier (1.0 if unpurchased, adds to base). */
export function metaShadowMarkDmgMult(world: World): number {
  return 1 + metaRank(world, 'shadow_markdmg') * META_BY_ID['shadow_markdmg'].perRank;
}

/** Nature: bonus pierce count (floored). */
export function metaNaturePierceBonus(world: World): number {
  return Math.floor(metaRank(world, 'nature_pierce') * META_BY_ID['nature_pierce'].perRank);
}

/** Nature: thorn length multiplier (1.0 if unpurchased). */
export function metaNatureThornMult(world: World): number {
  return 1 + metaRank(world, 'nature_thorn') * META_BY_ID['nature_thorn'].perRank;
}

/** Nature: vine duration bonus in seconds. */
export function metaNatureVineDurBonus(world: World): number {
  return metaRank(world, 'nature_vines') * META_BY_ID['nature_vines'].perRank;
}

/** Nature: AoE radius multiplier (1.0 if unpurchased). */
export function metaNatureAoEMult(world: World): number {
  return 1 + metaRank(world, 'nature_aoe') * META_BY_ID['nature_aoe'].perRank;
}

/** Holy: splash radius multiplier (1.0 if unpurchased). */
export function metaHolySplashMult(world: World): number {
  return 1 + metaRank(world, 'holy_splash') * META_BY_ID['holy_splash'].perRank;
}

/** Holy: heal per holy hit (flat, 0 if unpurchased). */
export function metaHolyHealPerHit(world: World): number {
  return metaRank(world, 'holy_heal') * META_BY_ID['holy_heal'].perRank;
}

/** Holy: attack speed multiplier (reduces bolt cooldown, 1.0 if unpurchased). */
export function metaHolyAttackSpeedMult(world: World): number {
  return 1 + metaRank(world, 'holy_speed') * META_BY_ID['holy_speed'].perRank;
}

/** Lightning: bonus chain count (floored). */
export function metaLightningChainBonus(world: World): number {
  return Math.floor(metaRank(world, 'light_chain') * META_BY_ID['light_chain'].perRank);
}

/** Lightning: chain range multiplier (1.0 if unpurchased). */
export function metaLightningRangeMult(world: World): number {
  return 1 + metaRank(world, 'light_range') * META_BY_ID['light_range'].perRank;
}

/** Lightning: chain falloff reduction — less damage loss per jump (0 if unpurchased, means 0 less falloff).
 *  Positive value means falloff is improved by that fraction. E.g. perRank=0.05, rank 4 → 0.20 less falloff. */
export function metaLightningFalloffReduction(world: World): number {
  return metaRank(world, 'light_falloff') * META_BY_ID['light_falloff'].perRank;
}

/** Lightning: attack speed multiplier (reduces bolt cooldown, 1.0 if unpurchased). */
export function metaLightningAttackSpeedMult(world: World): number {
  return 1 + metaRank(world, 'light_speed') * META_BY_ID['light_speed'].perRank;
}

/** Wind: knockback force multiplier (1.0 if unpurchased). */
export function metaWindKnockbackMult(world: World): number {
  return 1 + metaRank(world, 'wind_knock') * META_BY_ID['wind_knock'].perRank;
}

/** Wind: trail duration bonus in seconds. */
export function metaWindTrailDurBonus(world: World): number {
  return metaRank(world, 'wind_trail') * META_BY_ID['wind_trail'].perRank;
}

/** Wind: extra move speed multiplier (1.0 if unpurchased). */
export function metaWindMoveMult(world: World): number {
  return 1 + metaRank(world, 'wind_move') * META_BY_ID['wind_move'].perRank;
}

/** Wind: dash distance multiplier (1.0 if unpurchased). */
export function metaWindDashDistMult(world: World): number {
  return 1 + metaRank(world, 'wind_dash') * META_BY_ID['wind_dash'].perRank;
}

/** Water: bonus heal per water bolt hit (flat, 0 if unpurchased). */
export function metaWaterHealBonus(world: World): number {
  return metaRank(world, 'water_heal') * META_BY_ID['water_heal'].perRank;
}

/** Water: healing tide amount multiplier (1.0 if unpurchased). */
export function metaWaterTideMult(world: World): number {
  return 1 + metaRank(world, 'water_tide') * META_BY_ID['water_tide'].perRank;
}

/** Water: whirlpool pull force multiplier (1.0 if unpurchased). */
export function metaWaterPullMult(world: World): number {
  return 1 + metaRank(world, 'water_pull') * META_BY_ID['water_pull'].perRank;
}

/** Water: cleanse frequency multiplier (1.0 if unpurchased). */
export function metaWaterCleanseMult(world: World): number {
  return 1 + metaRank(world, 'water_cleanse') * META_BY_ID['water_cleanse'].perRank;
}

// ---------------- Legacy compatibility accessors ----------------
// These were used by player.ts/simulation.ts before the redesign.
// They now map to general or element-appropriate upgrades so existing code keeps working.

/** Projectile-speed multiplier — maps to gen_projspeed if present (legacy), otherwise 1.0. */
export function metaProjSpeedMult(world: World): number {
  // Legacy gen_projspeed may exist in old saves; if not in the new tree, return 1.
  const def = META_BY_ID['gen_projspeed'];
  if (!def) return 1;
  return 1 + metaRank(world, 'gen_projspeed') * def.perRank;
}

/** Dash cooldown reduction multiplier — legacy, maps to 1.0 (no longer a general upgrade). */
export function metaCooldownMult(world: World): number {
  const def = META_BY_ID['gen_cd'];
  if (!def) return 1;
  return 1 - metaRank(world, 'gen_cd') * def.perRank;
}

/** Dash cooldown reduction multiplier — legacy. */
export function metaDashCdMult(world: World): number {
  const def = META_BY_ID['gen_dash'];
  if (!def) return 1;
  return 1 - metaRank(world, 'gen_dash') * def.perRank;
}

/** Flat starting-level bonus (legacy). */
export function metaStartLevel(world: World): number {
  const def = META_BY_ID['gen_startlevel'];
  if (!def) return 0;
  return metaRank(world, 'gen_startlevel') * def.perRank;
}

/** Flat starting-HP bonus (legacy). */
export function metaStartHP(world: World): number {
  const def = META_BY_ID['gen_starthp'];
  if (!def) return 0;
  return metaRank(world, 'gen_starthp') * def.perRank;
}

/** Dash-distance multiplier — now maps to wind_dash. */
export function metaDashDistMult(world: World): number {
  return metaWindDashDistMult(world);
}

/** Healing-power multiplier (legacy). */
export function metaHealingMult(world: World): number {
  const def = META_BY_ID['gen_healmult'];
  if (!def) return 1;
  return 1 + metaRank(world, 'gen_healmult') * def.perRank;
}

/** Spell-radius multiplier (legacy). */
export function metaSpellRadiusMult(world: World): number {
  const def = META_BY_ID['gen_aoe'];
  if (!def) return 1;
  return 1 + metaRank(world, 'gen_aoe') * def.perRank;
}

/** HP regen per second (legacy). */
export function metaRegenPerSec(world: World): number {
  const def = META_BY_ID['gen_regen'];
  if (!def) return 0;
  return metaRank(world, 'gen_regen') * def.perRank;
}

/** Lifesteal percent (legacy). */
export function metaLifestealPct(world: World): number {
  const def = META_BY_ID['gen_lifesteal'];
  if (!def) return 0;
  return metaRank(world, 'gen_lifesteal') * def.perRank;
}