/**
 * The full 61-node skill tree ("the Grimoire"), ported verbatim from
 * reference/full-reference.html — BRANCHES / LOCAL / VOID_EXTRA / CONTENT /
 * derived layout math, plus prerequisite + purchase logic.
 */
import type { SkillNode, World } from './types';

export interface Branch {
  code: string;
  name: string;
  color: string;
  angle: number;
}

export const BRANCHES: Branch[] = [
  { code: 'F', name: 'Ember', color: '#e2793d', angle: -90 },
  { code: 'R', name: 'Rime', color: '#8ec9e8', angle: -30 },
  { code: 'V', name: 'Void', color: '#9d8ce0', angle: 30 },
  { code: 'S', name: 'Umbral', color: '#c4728f', angle: 90 },
  { code: 'N', name: 'Verdant', color: '#8bc48a', angle: 150 },
  { code: 'B', name: 'Warden', color: '#c9a869', angle: 210 },
];

interface LocalNode {
  id: string;
  tier: number;
  off: number;
  pre: string[];
  radius?: number;
  cost?: number;
}

export const LOCAL: LocalNode[] = [
  { id: 'A', tier: 0, off: 0, pre: [] },
  { id: 'B', tier: 1, off: 0, pre: ['A'] },
  { id: 'C1', tier: 2, off: -20, pre: ['B'] },
  { id: 'G', tier: 2, off: 0, pre: ['B'] },
  { id: 'C2', tier: 2, off: 20, pre: ['B'] },
  { id: 'D', tier: 3, off: 0, pre: ['C1', 'C2'] },
  { id: 'H', tier: 3, off: 30, pre: ['D'], radius: 530 },
  { id: 'E1', tier: 4, off: -13, pre: ['D'] },
  { id: 'E2', tier: 4, off: 13, pre: ['D'] },
  { id: 'F', tier: 5, off: 0, pre: ['E1', 'E2'] },
];

export const VOID_EXTRA: LocalNode[] = [{ id: 'X', tier: 1, off: 40, pre: ['A'] }];

// Expanded ("bigger") layout: tiers spaced out further from the hub than the
// original reference so the full 61-node constellation has breathing room
// instead of feeling cramped. See CX/CY/treeinner sizing in hud.css, which
// scales in step with these radii.
export const RADII = [145, 265, 385, 505, 625, 745];
export const COST_BY_TIER = [1, 1, 2, 3, 3, 5];

interface ContentEntry {
  name: string;
  desc: string;
}

export const CONTENT: Record<string, Record<string, ContentEntry>> = {
  F: {
    A: { name: 'Kindled Spark', desc: 'Your bolts smolder: +20% damage, and apply a burn dealing 3 dmg/s for 3s.' },
    B: { name: 'Ember Rounds', desc: 'Burn damage is doubled. Unlocks Fire Nova, a blast of flame that erupts around you every few seconds.' },
    C1: { name: 'Combustion', desc: 'Fire Nova radius increased by 40%.' },
    G: { name: 'Flash Fire', desc: 'Fire Nova sears the air itself, granting a burst of speed the instant it erupts.' },
    C2: { name: 'Molten Core', desc: 'Fire Nova erupts 25% more often.' },
    D: { name: 'Wildfire Spread', desc: 'Enemies that die while burning ignite those nearby.' },
    H: { name: 'Cinderheart', desc: 'Fire magic toughens your resolve. +15% max health.' },
    E1: { name: 'Inferno', desc: 'Fire Nova damage increased by 80%.' },
    E2: { name: 'Scorched Earth', desc: 'Fire Nova leaves the ground burning, harming anything that lingers.' },
    F: { name: 'Wildfire', desc: 'Capstone. Fire kills always ignite nearby foes \u2014 the blaze never truly stops spreading.' },
  },
  R: {
    A: { name: 'Chill Touch', desc: 'Your bolts chill enemies, slowing them by 20% for 2s.' },
    B: { name: 'Frostbite', desc: 'Chill is far stronger. Unlocks Ice Lance, a piercing shard that freezes enemies solid.' },
    C1: { name: 'Deep Freeze', desc: 'Freeze duration is doubled.' },
    G: { name: 'Frostbitten Focus', desc: 'Deal 15% more damage to enemies you\u2019ve chilled or frozen.' },
    C2: { name: 'Glacial Path', desc: 'Ice Lance pierces two additional enemies.' },
    D: { name: 'Brittle', desc: 'Frozen enemies take 50% more damage from everything.' },
    H: { name: 'Glacial Resolve', desc: 'The cold sharpens you. +15% max health.' },
    E1: { name: 'Permafrost', desc: 'All slowing effects are 50% stronger.' },
    E2: { name: 'Winter\u2019s Veil', desc: 'Unlocks Frost Armor, a periodic shield that absorbs damage and chills attackers.' },
    F: { name: 'Absolute Zero', desc: 'Capstone. Frozen enemies shatter on death, dealing heavy damage in a burst and refreezing survivors.' },
  },
  V: {
    A: { name: 'Focused Mind', desc: 'Cast your bolt 20% more often.' },
    B: { name: 'Twin Casting', desc: 'Fire an additional bolt with every cast.' },
    X: { name: 'Quick Study', desc: 'You learn from every battle. +30% experience gained from slain foes.' },
    C1: { name: 'Piercing Sigil', desc: 'Bolts pierce through one additional enemy.' },
    G: { name: 'Arcane Reservoir', desc: 'Each bolt has a 10% chance to cost no cooldown at all.' },
    C2: { name: 'Homing Rune', desc: 'Bolts gently curve toward the nearest foe.' },
    D: { name: 'Overcharge', desc: 'Every fifth cast is empowered, dealing triple damage.' },
    H: { name: 'Mind Over Matter', desc: 'A disciplined mind, a durable body. +15% max health.' },
    E1: { name: 'Mirror Image', desc: 'Unlocks Arcane Burst, a ring of bolts fired in every direction.' },
    E2: { name: 'Ley Line Tap', desc: 'All spell cooldowns reduced by 20%.' },
    F: { name: 'Overload', desc: 'Capstone. Empowered casts also release a spray of homing bolts.' },
  },
  N: {
    A: { name: 'Verdant Touch', desc: 'Slaying a foe restores a little of your health.' },
    B: { name: 'Life Bloom', desc: 'Health regeneration doubled. Unlocks Thorned Vines, roots that snare nearby foes.' },
    C1: { name: 'Bramble Ward', desc: 'Rooted enemies bleed steadily from thorns.' },
    G: { name: 'Photosynthesis', desc: 'The wilds sustain you. Passive health regeneration further increased.' },
    C2: { name: 'Wildkeeper\u2019s Bond', desc: 'Summon a Spirit Wisp that fights at your side.' },
    D: { name: 'Deep Roots', desc: 'Thorned Vines cover more ground, and your Wisp acts faster.' },
    H: { name: 'Hearty Growth', desc: 'Roots run deep. +15% max health.' },
    E1: { name: 'Second Wind', desc: 'All healing you receive is increased by 50%.' },
    E2: { name: 'Wild Growth', desc: 'Summon a second Spirit Wisp.' },
    F: { name: 'Verdant Bloom', desc: 'Capstone. Every kill releases a healing pulse that mends you and your wisps, and harms nearby foes.' },
  },
  S: {
    A: { name: 'Cold Reading', desc: 'Gain an 8% chance for any hit to land as a critical strike.' },
    B: { name: 'Marked for Death', desc: 'Critical strikes mark their target. Unlocks Shadow Bolt, dealing heavy bonus damage to marked foes.' },
    C1: { name: 'Executioner', desc: 'Critical strikes deal 50% more damage.' },
    G: { name: 'Opportunist', desc: 'An eye for weakness. +5% additional critical strike chance.' },
    C2: { name: 'Umbral Step', desc: 'Your dash leaves a shadow behind that detonates a moment later.' },
    D: { name: 'Death\u2019s Embrace', desc: 'Slaying a marked foe refunds part of your dash cooldown.' },
    H: { name: 'Grim Vigor', desc: 'The dark sustains you. +15% max health.' },
    E1: { name: 'Vampiric Sigil', desc: 'A portion of all damage you deal returns to you as health.' },
    E2: { name: 'Twilight Veil', desc: 'Your dash\u2019s detonation deals significantly more damage.' },
    F: { name: 'Reaper\u2019s Mark', desc: 'Capstone. Slaying a marked foe resets every spell\u2019s cooldown.' },
  },
  B: {
    A: { name: 'Traveler\u2019s Legs', desc: 'Move 15% faster.' },
    B: { name: 'Iron Skin', desc: 'Increase max health by 25% and reduce your dash\u2019s cooldown.' },
    C1: { name: 'Sure Footing', desc: 'Reduce your dash\u2019s cooldown further.' },
    G: { name: 'Momentum', desc: 'Always in motion. +10% additional move speed.' },
    C2: { name: 'Thick Hide', desc: 'Reduce all incoming damage by 15%.' },
    D: { name: 'Adrenaline', desc: 'Gain a burst of speed for 3s after dashing.' },
    H: { name: 'Bulwark', desc: 'Stand firm. Reduce all incoming damage by another 10%.' },
    E1: { name: 'Vitality', desc: 'Increase max health by another 50%.' },
    E2: { name: 'Battle Focus', desc: 'Health regeneration greatly increased.' },
    F: { name: 'Undying', desc: 'Capstone. Once per minute, a killing blow instead leaves you at 1 health.' },
  },
};

export const CX = 800;
export const CY = 800;

export const SKILL_NODES: SkillNode[] = [];
BRANCHES.forEach((br) => {
  const rad = (br.angle * Math.PI) / 180;
  const locals = br.code === 'V' ? LOCAL.concat(VOID_EXTRA) : LOCAL;
  locals.forEach((loc) => {
    const a = rad + (loc.off * Math.PI) / 180;
    const r = loc.radius !== undefined ? loc.radius : RADII[loc.tier];
    const x = CX + r * Math.cos(a);
    const y = CY + r * Math.sin(a);
    const content = CONTENT[br.code][loc.id];
    SKILL_NODES.push({
      id: br.code + '_' + loc.id,
      branch: br.code,
      color: br.color,
      tier: loc.tier,
      x,
      y,
      cost: loc.cost !== undefined ? loc.cost : COST_BY_TIER[loc.tier],
      pre: loc.pre.map((p) => br.code + '_' + p),
      capstone: loc.id === 'F',
      name: content.name,
      desc: content.desc,
    });
  });
});

export const NODE_BY_ID: Record<string, SkillNode> = {};
SKILL_NODES.forEach((n) => (NODE_BY_ID[n.id] = n));

export function hasNode(purchased: Set<string>, id: string): boolean {
  return purchased.has(id);
}

export function availableSP(world: World): number {
  return world.sp - world.spSpent;
}

/** Mirrors the reference's buySkill(id) — mutates world.purchased/spSpent and fires the flash banner. */
export function buySkill(world: World, id: string): void {
  const n = NODE_BY_ID[id];
  if (!n || hasNode(world.purchased, id)) return;
  if (!n.pre.every((p) => hasNode(world.purchased, p))) return;
  if (availableSP(world) < n.cost) return;
  world.purchased.add(id);
  world.spSpent += n.cost;
  world.flash(n.name.toUpperCase(), n.color);
}
