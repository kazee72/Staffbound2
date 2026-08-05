/**
 * The expanded skill tree ("the Grimoire") — radial constellation layout.
 * 10 branches radiate from a central hub at 360/10 = 36° angular spacing.
 * Each branch has 12-13 nodes (tier 0–6), totaling ~130 nodes.
 *
 * Layout is airy/breathable: tier radii are very generous so the outermost
 * capstone+ nodes sit far from center. Node positions are computed radially:
 *   x = CX + cos(angle) * radius
 *   y = CY + sin(angle) * radius
 * Side nodes (C1/C2/G/H/E1/E2/I/J) use an angular offset from the branch's
 * base angle so they fan out slightly instead of stacking on the same spoke.
 */
import type { SkillNode, World } from './types';

export interface Branch {
  code: string;
  name: string;
  color: string;
  angle: number;
  /** Unicode icon used for this branch's nodes (before purchase). */
  icon: string;
}

export const BRANCHES: Branch[] = [
  { code: 'F', name: 'Fire',      color: '#e2793d', angle: -90,                          icon: '🔥' },
  { code: 'R', name: 'Ice',       color: '#8ec9e8', angle: -90 + 36,                     icon: '❄' },
  { code: 'V', name: 'Void',      color: '#9d8ce0', angle: -90 + 2 * 36,                 icon: '✦' },
  { code: 'S', name: 'Shadow',    color: '#c4728f', angle: -90 + 3 * 36,                icon: '☾' },
  { code: 'N', name: 'Nature',    color: '#8bc48a', angle: -90 + 4 * 36,                icon: '☘' },
  { code: 'P', name: 'Potency',   color: '#4fd6c0', angle: -90 + 5 * 36,                icon: '⚔' },
  { code: 'T', name: 'Lightning', color: '#c4e842', angle: -90 + 6 * 36,                icon: '⚡' },
  { code: 'W', name: 'Wind',      color: '#a8d4e8', angle: -90 + 7 * 36,               icon: '🌪' },
  { code: 'Wa',name: 'Water',     color: '#4a9eff', angle: -90 + 8 * 36,                icon: '💧' },
  { code: 'Rk',name: 'Rock',      color: '#9a8b7a', angle: -90 + 9 * 36,                icon: '🪨' },
];

interface LocalNode {
  id: string;
  tier: number;
  off: number;       // angular offset (degrees) from the branch's base angle
  pre: string[];
  radius?: number;   // override radius for this specific node
}

// Per-branch node template. 13 nodes per branch (tier 0–6), with side
// branches at tiers 2, 3, and 4. Tier 5 = capstone, tier 6 = post-capstone.
// Void gets an extra side node X (14 total for Void).
// Angular offsets are kept SMALL relative to the 36° branch spacing so
// side nodes never collide with neighbouring branches' nodes — even at the
// outermost tiers where radii are largest. Max offset is 18° (well within
// the 18° half-gap between branches), and side-node radii for tier 6 are
// pulled in slightly to avoid edge proximity.
export const LOCAL: LocalNode[] = [
  { id: 'A',  tier: 0, off: 0,   pre: [] },
  { id: 'B',  tier: 1, off: 0,   pre: ['A'] },
  { id: 'C1', tier: 2, off: -14, pre: ['B'] },
  { id: 'G',  tier: 2, off: 0,   pre: ['B'] },
  { id: 'C2', tier: 2, off: 14,  pre: ['B'] },
  { id: 'D',  tier: 3, off: 0,   pre: ['C1', 'C2'] },
  { id: 'H',  tier: 3, off: 16,  pre: ['D'] },
  { id: 'E1', tier: 4, off: -9,  pre: ['D'] },
  { id: 'E2', tier: 4, off: 9,   pre: ['D'] },
  { id: 'F',  tier: 5, off: 0,   pre: ['E1', 'E2'] },          // capstone
  { id: 'I',  tier: 6, off: 0,   pre: ['F'] },                 // post-capstone
  { id: 'J',  tier: 6, off: 16,  pre: ['F'], radius: 1000 },   // post-capstone side (pulled in slightly from tier 6 max)
  { id: 'K',  tier: 4, off: -17, pre: ['E1'] },               // extra side node
  { id: 'L',  tier: 5, off: 17,  pre: ['E2'], radius: 920 },    // AoE side node (post-capstone-adjacent)
];

export const VOID_EXTRA: LocalNode[] = [{ id: 'X', tier: 1, off: 16, pre: ['A'] }];

// Breathable, airy radii — each tier is generously spaced so nodes never
// overlap even with angular offsets at the outermost tiers. The gap between
// tiers increases with radius to keep angular separation comfortable.
export const RADII = [140, 270, 410, 560, 720, 900, 1050];
export const COST_BY_TIER = [1, 1, 2, 3, 3, 5, 6];

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
    F: { name: 'Wildfire', desc: 'Capstone. Fire kills always ignite nearby foes — the blaze never truly stops spreading.' },
    I: { name: 'Phoenix', desc: 'Once per run, when you would die, you erupt in a massive fire blast that damages all enemies and restores 50% HP.' },
    J: { name: 'Eternal Flame', desc: 'Your burn effects last twice as long and deal 50% more damage per second.' },
    K: { name: 'Heat Wave', desc: 'Burning enemies are slowed by an additional 30%.' },
    L: { name: 'Arcane Explosion', desc: 'Every 6 seconds, a massive arcane burst erupts around you, dealing heavy damage to all nearby enemies.' },
  },
  R: {
    A: { name: 'Chill Touch', desc: 'Your bolts chill enemies, slowing them by 20% for 2s.' },
    B: { name: 'Frostbite', desc: 'Chill is far stronger. Unlocks Ice Lance, a piercing shard that freezes enemies solid.' },
    C1: { name: 'Deep Freeze', desc: 'Frozen enemies shatter in a small burst, damaging nearby foes. Freeze duration is doubled.' },
    G: { name: 'Frostbitten Focus', desc: 'Deal 15% more damage to enemies you\u2019ve chilled or frozen.' },
    C2: { name: 'Glacial Path', desc: 'Ice Lance pierces two additional enemies and leaves a trail of frost that damages foes it passes through.' },
    D: { name: 'Brittle', desc: 'Frozen enemies take 50% more damage from everything.' },
    H: { name: 'Glacial Resolve', desc: 'The cold sharpens you. +15% max health.' },
    E1: { name: 'Permafrost', desc: 'All slowing effects are 50% stronger.' },
    E2: { name: 'Winter\u2019s Veil', desc: 'Unlocks Frost Armor, a periodic shield that absorbs damage and chills attackers.' },
    F: { name: 'Absolute Zero', desc: 'Capstone. Frozen enemies shatter on death, dealing heavy damage in a burst and refreezing survivors.' },
    I: { name: 'Eternal Frost', desc: 'Every 25 seconds, all enemies on screen freeze solid for 4 seconds.' },
    J: { name: 'Avalanche', desc: 'Ice Lance now also drops ice shards on 3 random enemies near the impact point.' },
    K: { name: 'Frostbite Aura', desc: 'Enemies near you are passively chilled, slowing them by 15%.' },
    L: { name: 'Blizzard', desc: 'Every 20 seconds, a howling blizzard slows ALL enemies on screen to 30% speed for 5 seconds.' },
  },
  V: {
    A: { name: 'Focused Mind', desc: 'Cast your bolt 20% more often.' },
    B: { name: 'Twin Casting', desc: 'Fire an additional bolt with every cast.' },
    X: { name: 'Quick Study', desc: 'You learn from every battle. +30% experience gained from slain foes.' },
    C1: { name: 'Piercing Sigil', desc: 'Bolts pierce through one additional enemy, hitting all foes in a line.' },
    G: { name: 'Arcane Reservoir', desc: 'Each bolt has a 10% chance to cost no cooldown at all.' },
    C2: { name: 'Homing Rune', desc: 'Bolts gently curve toward the nearest foe.' },
    D: { name: 'Overcharge', desc: 'Every fifth cast is empowered, dealing triple damage.' },
    H: { name: 'Twin Critical', desc: 'Your Twin Casting second bolt can also land critical strikes, and crit chance is +5% for both bolts.' },
    E1: { name: 'Mirror Image', desc: 'Unlocks Arcane Burst, a ring of bolts fired in every direction.' },
    E2: { name: 'Ley Line Tap', desc: 'All spell cooldowns reduced by 20%.' },
    F: { name: 'Overload', desc: 'Capstone. Empowered casts also release a spray of homing bolts.' },
    I: { name: 'Time Warp', desc: 'Every 20 seconds, all enemies slow to 40% speed for 5 seconds.' },
    J: { name: 'Arcane Overflow', desc: 'Empowered casts now deal 4x damage instead of 3x, and fire 6 homing bolts.' },
    K: { name: 'Mana Shield', desc: 'When above 80% HP, take 20% less damage. A protective ward of raw mana.' },
    L: { name: 'Lightning Chain', desc: 'Every 5 seconds, your bolts chain lightning to 3 nearby enemies, dealing 60% damage to each.' },
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
    I: { name: 'Overgrowth', desc: 'Every 12 seconds, a surge of life heals you for 20% max HP and damages all nearby enemies.' },
    J: { name: 'Nature\u2019s Wrath', desc: 'Your wisps fire 50% faster and their bolts pierce 1 enemy.' },
    K: { name: 'Thornskin', desc: 'When hit, reflect 15 damage back to the attacker as thorns.' },
    L: { name: 'Spore Burst', desc: 'Every 8 seconds, toxic spores erupt around you, poisoning all nearby enemies for heavy damage over time.' },
  },
  S: {
    A: { name: 'Cold Reading', desc: 'Gain an 8% chance for any hit to land as a critical strike.' },
    B: { name: 'Marked for Death', desc: 'Critical strikes mark their target. Unlocks Shadow Bolt, dealing heavy bonus damage to marked foes.' },
    C1: { name: 'Executioner', desc: 'Critical strikes deal 50% more damage and splash shadow to nearby enemies.' },
    G: { name: 'Opportunist', desc: 'An eye for weakness. +5% additional critical strike chance.' },
    C2: { name: 'Umbral Step', desc: 'Your dash leaves a shadow behind that detonates a moment later, damaging all nearby foes.' },
    D: { name: 'Death\u2019s Embrace', desc: 'Slaying a marked foe refunds part of your dash cooldown.' },
    H: { name: 'Grim Vigor', desc: 'The dark sustains you. +15% max health.' },
    E1: { name: 'Vampiric Sigil', desc: 'A portion of all damage you deal returns to you as health.' },
    E2: { name: 'Twilight Veil', desc: 'Your dash\u2019s detonation deals significantly more damage.' },
    F: { name: 'Reaper\u2019s Mark', desc: 'Capstone. Slaying a marked foe resets every spell\u2019s cooldown.' },
    I: { name: 'Shadow Blink', desc: 'Every 15 seconds, you blink to the nearest enemy and mark all foes around them.' },
    J: { name: 'Cull', desc: 'Every 8 seconds, any enemy below 20% HP is instantly executed (marked foes at 30%).' },
    K: { name: 'Nightmare', desc: 'Marked enemies take 25% more damage from all sources.' },
    L: { name: 'Shadow Nova', desc: 'Every 10 seconds, a wave of shadow energy erupts from you, marking and damaging all enemies in a large radius.' },
  },
  P: {
    A: { name: 'Honed Edge', desc: 'Your bolts and spells deal 10% more damage.' },
    B: { name: 'Swift Casting', desc: 'All spell cooldowns reduced by 10%.' },
    C1: { name: 'Keen Eye', desc: '+6% additional critical strike chance.' },
    G: { name: 'Fleet Step', desc: 'Move 10% faster.' },
    C2: { name: 'Vicious Strikes', desc: 'Critical strikes deal 15% more damage.' },
    D: { name: 'Overdrive', desc: 'All spell cooldowns reduced by a further 12%.' },
    H: { name: 'Resilient Core', desc: 'Raw power hardens you too. +15% max health.' },
    E1: { name: 'Arcane Might', desc: 'Your bolts and spells deal a further 15% more damage.' },
    E2: { name: 'Windswept', desc: 'Move a further 15% faster.' },
    F: { name: 'Apex', desc: 'Capstone. A surge of raw power: +20% damage, +10% critical chance, +10% move speed, and +10% cooldown reduction, all at once.' },
    I: { name: 'Apex Surge', desc: 'Every 15 seconds, gain +50% damage and +20% crit chance for 4 seconds.' },
    J: { name: 'Perfection', desc: 'All your stats are increased by an additional 10%.' },
    K: { name: 'Velocity', desc: 'All your projectiles travel 40% faster, increasing effective range and DPS.' },
    L: { name: 'Whirlwind Strike', desc: 'Every 7 seconds, you spin in a cyclone, striking all nearby enemies for heavy weapon damage.' },
  },
  T: {
    A: { name: 'Static Charge', desc: 'Your bolts have a 20% chance to chain to 1 nearby enemy for 60% damage.' },
    B: { name: 'Chain Lightning', desc: 'Bolts chain to 2 more enemies, each for 50% damage. Unlocks Thunderclap, a small AoE burst around you every 3 seconds.' },
    C1: { name: 'Storm Call', desc: 'Every 4 seconds, a lightning bolt strikes a random enemy, dealing AoE damage to those nearby.' },
    G: { name: 'Thunderclap', desc: 'Thunderclap radius increased by 40% and it slows enemies by 30% for 1s.' },
    C2: { name: 'Galvanize', desc: 'All lightning damage increased by 15%.' },
    D: { name: 'Overload', desc: 'Chain lightning hits 2 more enemies, and chain damage falloff is reduced.' },
    H: { name: 'Static Field', desc: 'Enemies near you take periodic lightning damage. +15% max health.' },
    E1: { name: 'Lightning Storm', desc: 'Every 8 seconds, 3 lightning bolts strike random enemies across the screen for heavy AoE damage.' },
    E2: { name: 'Conductor', desc: 'All lightning damage increased by 25%. Storm Call triggers twice as often.' },
    F: { name: 'Tempest', desc: 'Capstone. ALL your attacks chain to nearby enemies. Lightning damage doubled.' },
    I: { name: 'Storm Lord', desc: 'Every 10 seconds, chain lightning arcs through every enemy on screen for massive damage.' },
    J: { name: 'Arc Surge', desc: 'Chain lightning deals 75% damage per jump instead of 50%, and chains to 2 additional enemies.' },
    K: { name: 'Ground Current', desc: 'Thunderclap leaves a charged field that damages enemies who linger.' },
    L: { name: 'Thunder Strike', desc: 'Every 5 seconds, call down a massive lightning bolt on the nearest enemy, dealing heavy AoE damage in a wide radius.' },
  },
  W: {
    A: { name: 'Tailwind', desc: '+15% movement speed. Wind trails behind you, lightly damaging enemies you pass.' },
    B: { name: 'Gust', desc: 'Unlocks Wind Gust — a periodic push that knocks back nearby enemies and deals light damage every 4s.' },
    C1: { name: 'Cyclone', desc: 'Wind Gust radius +40%. Enemies knocked back are slowed for 1.5s.' },
    G: { name: 'Updraft', desc: 'Dash distance +30%. Dash leaves a wind trail that damages enemies for 2s.' },
    C2: { name: 'Gale Force', desc: 'Wind Gust damage +80% and knockback distance doubled.' },
    D: { name: 'Vortex', desc: 'Unlocks Vortex — every 6s, pull nearby enemies toward you and damage them.' },
    H: { name: 'Windwalker', desc: '+15% max health. Move speed +10%.' },
    E1: { name: 'Zephyr', desc: 'Vortex radius +50% and pulls enemies 40% faster.' },
    E2: { name: 'Tempest Winds', desc: 'Wind Gust and Vortex cooldowns reduced by 30%.' },
    F: { name: 'Cataclysm', desc: 'Capstone. Every 12s, summon a massive tornado that sweeps across the screen, damaging and pulling all enemies in its path.' },
    I: { name: 'Hurricane', desc: 'Tornado lasts 50% longer and grows larger over time, hitting a wider area.' },
    J: { name: 'Eye of the Storm', desc: 'While a tornado is active, you gain +50% move speed and invulnerability.' },
    K: { name: 'Deflecting Winds', desc: '20% chance to deflect enemy projectiles back at them.' },
    L: { name: 'Infinity Gust', desc: 'Wind Gust becomes a continuous aura — enemies near you are constantly pushed back and damaged.' },
  },
  Wa: {
    A: { name: 'Water Bolt', desc: 'Your auto-attack becomes a water bolt that heals you for 2 HP per hit.' },
    B: { name: 'Tidal Wave', desc: 'Unlocks Tidal Wave — a wave pushes enemies back in a line every 5s.' },
    C1: { name: 'Healing Tide', desc: 'Passively heal 5 HP every 8s.' },
    G: { name: 'Purifying Water', desc: 'Removes negative effects. +10% max HP.' },
    C2: { name: 'Deep Bolt', desc: 'Water Bolt heals 4 HP per hit instead of 2.' },
    D: { name: 'Whirlpool', desc: 'Unlocks Whirlpool — every 6s, pull enemies toward a point and damage them.' },
    H: { name: 'Aqua Shield', desc: '10% damage reduction while above 50% HP.' },
    E1: { name: 'Tsunami', desc: 'Every 15s, a massive wave sweeps across the screen, damaging and pushing all enemies.' },
    E2: { name: 'Cleansing Rain', desc: 'Heal 1 HP/sec while standing still.' },
    F: { name: 'Deluge', desc: 'Capstone. All water effects doubled. Water Bolt heals 8 HP per hit.' },
    I: { name: 'Maelstrom', desc: 'Whirlpool pulls 50% faster and damages enemies it pulls.' },
    J: { name: 'Deep Current', desc: 'Water Bolt hits 2 enemies (pierces 1).' },
    K: { name: 'Fluid Motion', desc: '+20% move speed while moving.' },
    L: { name: 'Flood', desc: 'Every 10s, slow all enemies on screen for 3s.' },
  },
  Rk: {
    A: { name: 'Stone Bolt', desc: 'Rock auto-attack with splash damage around where it hits.' },
    B: { name: 'Boulder Toss', desc: 'Unlocks Boulder — a large rock that rolls through enemies every 5s, damaging all in its path.' },
    C1: { name: 'Shrapnel', desc: 'Splash radius +50%. Splash damage increased to 60% of bolt damage.' },
    G: { name: 'Stone Skin', desc: '+20% max HP and 10% damage reduction.' },
    C2: { name: 'Crater', desc: 'Bolt impact creates a ground crack that damages enemies who walk over it for 3s.' },
    D: { name: 'Earth Wall', desc: 'Unlocks Earth Wall — raise a barrier every 8s that blocks enemy movement for 4s.' },
    H: { name: 'Mountain Heart', desc: '+15% max HP. Regen +50%.' },
    E1: { name: 'Aftershock', desc: 'Boulder hits cause a secondary explosion dealing 40% damage in a radius.' },
    E2: { name: 'Tectonic Shift', desc: 'Boulder and Earth Wall cooldowns reduced by 30%.' },
    F: { name: 'Cataclysm', desc: 'Capstone. Every 15s, a massive earthquake hits all enemies on screen for heavy damage + stun.' },
    I: { name: 'Continental Drift', desc: 'Earthquake hits twice, second wave dealing 60% damage with a wider radius.' },
    J: { name: 'Bedrock', desc: 'Stone Skin gives an additional 15% damage reduction. Immune to knockback.' },
    K: { name: 'Fault Line', desc: 'Bolt impacts create a line of cracks toward the nearest enemy, damaging all along it.' },
    L: { name: 'Meteor', desc: 'Every 8s, a meteor falls on the strongest enemy, dealing massive AoE damage.' },
  },
};

// ---------------- Radial layout ----------------
// Canvas big enough to fit max radius (1050) with generous padding.
export const TREE_W = 2200;
export const TREE_H = 2200;
export const CX = TREE_W / 2; // 1100
export const CY = TREE_H / 2; // 1100

/**
 * Compute a node's (x, y) position on the radial constellation.
 * @param baseAngle  branch's base angle in degrees
 * @param off        angular offset from base (degrees)
 * @param tier       tier index 0–6
 * @param radiusOverride  optional explicit radius
 */
function radialPos(baseAngle: number, off: number, tier: number, radiusOverride?: number): { x: number; y: number } {
  const angle = ((baseAngle + off) * Math.PI) / 180;
  const r = radiusOverride ?? RADII[tier];
  return {
    x: CX + Math.cos(angle) * r,
    y: CY + Math.sin(angle) * r,
  };
}

export const SKILL_NODES: SkillNode[] = [];
BRANCHES.forEach((br) => {
  const locals = br.code === 'V' ? LOCAL.concat(VOID_EXTRA) : LOCAL;
  locals.forEach((loc) => {
    const { x, y } = radialPos(br.angle, loc.off, loc.tier, loc.radius);
    const content = CONTENT[br.code][loc.id];
    SKILL_NODES.push({
      id: br.code + '_' + loc.id,
      branch: br.code,
      color: br.color,
      tier: loc.tier,
      x,
      y,
      cost: loc.id === 'I' || loc.id === 'J' ? 6 : loc.id === 'K' ? 4 : loc.id === 'L' ? 5 : COST_BY_TIER[loc.tier],
      pre: loc.pre.map((p) => br.code + '_' + p),
      capstone: loc.id === 'F',
      name: content.name,
      desc: content.desc,
    });
  });
});

export const NODE_BY_ID: Record<string, SkillNode> = {};
SKILL_NODES.forEach((n) => (NODE_BY_ID[n.id] = n));

/**
 * Straight-line SVG path between two nodes for the radial layout.
 * Since nodes radiate outward, connectors are diagonal spokes — that's
 * the intended constellation look.
 */
export function radialPath(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

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

/** Get the icon character for a node (shown before purchase). Returns the branch icon. */
export function nodeIcon(node: SkillNode): string {
  const br = BRANCHES.find((b) => b.code === node.branch);
  return br ? br.icon : '◆';
}