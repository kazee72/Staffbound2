/**
 * Stage-specific procedural pixel-art backgrounds.
 *
 * Generates a tileable ground texture + a SET of decor sprite variants for
 * each stage's visual theme, using the same fillRect+generateTexture pattern
 * as forestBackground.ts but driven by the STAGE_DEFS palette + decor kind.
 *
 * Each stage produces multiple decor variants (tall/short/broken/etc.) so the
 * scattered decor looks varied instead of repetitive, matching the layered
 * depth feel of stage 1's forest. Variant keys are namespaced per stage so the
 * Phaser texture manager can hold all stage textures simultaneously.
 *
 * Texture keys are namespaced per stage so the Phaser texture manager
 * can hold all stage textures simultaneously without conflicts.
 */
import type { StageDef } from './stages';

const TILE = 32;
const DW = 24; // decor texture width
const DH = 34; // decor texture height

export const STAGE_TILE_KEY = 'stageTile';
export const STAGE_DECOR_KEY = 'stageDecor';

function px(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, 1, 1);
}

/** Deterministic RNG so textures are stable across regenerations. */
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 10000) / 10000;
  };
}

/**
 * Generate the ground tile texture for a given stage definition.
 * Key is namespaced by stage decor kind so it can coexist with other stages.
 */
export function generateStageTile(scene: Phaser.Scene, stage: StageDef): string {
  const key = STAGE_TILE_KEY + '_' + stage.decor;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const pal = stage.palette;

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const base = (x + y) % 7 === 0 ? pal.tileBase2 : pal.tileBase;
      px(g, x, y, base);
    }
  }

  const rand = makeRng(1337);
  for (let i = 0; i < 22; i++) {
    const bx = Math.floor(rand() * TILE);
    const by = Math.floor(rand() * TILE);
    px(g, bx, by, pal.tileAccent, 0.8);
    if (rand() > 0.4) px(g, bx, Math.max(0, by - 1), pal.tileAccent, 0.45);
  }
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(rand() * TILE);
    const by = Math.floor(rand() * TILE);
    px(g, bx, by, pal.dirt, 0.5);
  }

  // Stage 2 (chapel): a few cracked floor tile lines for a stony feel.
  if (stage.decor === 'chapel') {
    for (let i = 0; i < 3; i++) {
      const ly = Math.floor(rand() * TILE);
      for (let x = 0; x < TILE; x++) px(g, x, ly, pal.decorDark, 0.35);
    }
  }
  // Stage 3 (frozen): frost speckles.
  if (stage.decor === 'frozen') {
    for (let i = 0; i < 10; i++) {
      const bx = Math.floor(rand() * TILE);
      const by = Math.floor(rand() * TILE);
      px(g, bx, by, pal.decorLight, 0.4);
    }
  }
  // Stage 4 (shadow): faint purple glow specks.
  if (stage.decor === 'shadow') {
    for (let i = 0; i < 6; i++) {
      const bx = Math.floor(rand() * TILE);
      const by = Math.floor(rand() * TILE);
      px(g, bx, by, pal.decorLight, 0.25);
    }
  }

  g.generateTexture(key, TILE, TILE);
  g.destroy();
  return key;
}

/**
 * Generate the decor sprite texture for a given stage definition.
 * Returns the FIRST variant key (for backward compatibility / simple uses).
 * For the full set of variants use generateStageDecorVariants().
 */
export function generateStageDecor(scene: Phaser.Scene, stage: StageDef): string {
  const keys = generateStageDecorVariants(scene, stage);
  return keys[0];
}

/**
 * Generate ALL decor sprite variant textures for a given stage definition.
 * Each stage produces 4 distinct variant shapes so the scattered decor looks
 * varied (small/medium/large + different object types), matching the layered
 * depth feel of stage 1's forest.
 *
 * Variant texture keys: stageDecor_<decor>_<index>
 */
export function generateStageDecorVariants(scene: Phaser.Scene, stage: StageDef): string[] {
  const baseKey = STAGE_DECOR_KEY + '_' + stage.decor;
  const variantCount = stage.decor === 'forest' ? 1 : 4;
  const keys: string[] = [];
  for (let i = 0; i < variantCount; i++) {
    const key = baseKey + '_' + i;
    keys.push(key);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const pal = stage.palette;
    switch (stage.decor) {
      case 'forest':
        generateForestDecor(g, pal);
        break;
      case 'chapel':
        generateChapelVariant(g, pal, i);
        break;
      case 'frozen':
        generateFrozenVariant(g, pal, i);
        break;
      case 'shadow':
        generateShadowVariant(g, pal, i);
        break;
    }
    g.generateTexture(key, DW, DH);
    g.destroy();
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Stage 1 — Forest: pine tree (kept identical to the original forestBackground tree).
// ---------------------------------------------------------------------------
function generateForestDecor(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const W = 24;
  const trunk = 0x2e2116;
  const trunkShade = 0x1c1610;
  for (let y = 24; y < 32; y++) {
    for (let x = 10; x <= 13; x++) {
      px(g, x, y, x === 10 ? trunkShade : trunk);
    }
  }
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(12, 32, 14, 4);
  const tiers = [
    { y0: 18, y1: 26, wStart: 3, wEnd: 11 },
    { y0: 10, y1: 20, wStart: 2, wEnd: 9 },
    { y0: 2, y1: 12, wStart: 1, wEnd: 6 },
  ];
  tiers.forEach((tier) => {
    const rows = tier.y1 - tier.y0;
    for (let r = 0; r < rows; r++) {
      const t = r / rows;
      const halfW = tier.wStart + (tier.wEnd - tier.wStart) * t;
      const y = tier.y0 + r;
      const cx = 12;
      for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
        if (x < 0 || x >= W) continue;
        const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
        const shade = edge ? pal.decorDark : x < cx ? pal.decorMain : pal.decorLight;
        px(g, x, y, shade);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Stage 2 — Ruined Chapel: stone pillars of different sizes + rubble.
// Variant 0: tall intact pillar  | 1: broken pillar  | 2: rubble pile  | 3: short stump
// ---------------------------------------------------------------------------
function generateChapelVariant(g: Phaser.GameObjects.Graphics, pal: StageDef['palette'], v: number): void {
  switch (v) {
    case 0: chapelTallPillar(g, pal); break;
    case 1: chapelBrokenPillar(g, pal); break;
    case 2: chapelRubble(g, pal); break;
    case 3: chapelShortStump(g, pal); break;
  }
}

function chapelTallPillar(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const cx = 12;
  // Base block (wide plinth)
  for (let x = 4; x <= 20; x++) {
    for (let y = 29; y <= 33; y++) {
      const edge = x === 4 || x === 20 || y === 33;
      px(g, x, y, edge ? pal.decorDark : (x + y) % 5 === 0 ? pal.decorLight : pal.decorMain);
    }
  }
  // Column shaft (fluted, full height, slight taper)
  for (let y = 7; y < 29; y++) {
    const halfW = 5 - Math.floor((29 - y) / 11) * 0.5;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= DW) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      const flute = (x + Math.floor(y / 3)) % 4 === 0;
      px(g, x, y, edge ? pal.decorDark : flute ? pal.decorLight : pal.decorMain);
    }
  }
  // Capital (top block)
  for (let x = 5; x <= 19; x++) {
    for (let y = 4; y <= 7; y++) {
      const edge = x === 5 || x === 19 || y === 4;
      px(g, x, y, edge ? pal.decorDark : (x + y) % 6 === 0 ? pal.decorLight : pal.decorMain);
    }
  }
  // Top abacus (thin cap stone)
  for (let x = 4; x <= 20; x++) px(g, x, 3, x === 4 || x === 20 ? pal.decorDark : pal.decorLight);
  // Vertical crack
  for (let y = 9; y < 27; y += 2) px(g, 10, y, 0x000000, 0.35);
  // Moss specks near base
  px(g, 6, 31, 0x3a4a28, 0.6);
  px(g, 17, 32, 0x3a4a28, 0.5);
  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, 33, 16, 4);
}

function chapelBrokenPillar(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const cx = 12;
  // Base block
  for (let x = 5; x <= 19; x++) {
    for (let y = 29; y <= 33; y++) {
      const edge = x === 5 || x === 19 || y === 33;
      px(g, x, y, edge ? pal.decorDark : pal.decorMain);
    }
  }
  // Column shaft — broken/jagged top around y=18
  for (let y = 14; y < 29; y++) {
    const halfW = 5 - (y > 20 ? (y - 20) * 0.15 : 0);
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= DW) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? pal.decorDark : (x + y) % 6 === 0 ? pal.decorLight : pal.decorMain);
    }
  }
  // Jagged broken top — uneven heights per column
  const breakHeights = [16, 18, 14, 17, 19, 15, 18, 16, 17, 14, 19];
  for (let i = 0; i < 11; i++) {
    const x = 7 + i;
    const topY = breakHeights[i];
    for (let y = topY; y < 14; y++) {
      px(g, x, y, y === topY ? 0x000000 : (x === 7 || x === 17 ? pal.decorDark : pal.decorMain), 0.7);
    }
    // A couple of fallen chunks resting on the break
    if (i === 2 || i === 7) {
      px(g, x, topY - 1, pal.decorDark, 0.8);
      px(g, x + 1, topY - 1, pal.decorMain, 0.7);
    }
  }
  // Diagonal crack
  for (let y = 15; y < 28; y++) {
    const offset = Math.floor((y - 15) / 3);
    px(g, 10 + offset, y, 0x000000, 0.4);
  }
  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, 33, 14, 4);
}

function chapelRubble(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  // Low wide mound of broken stones.
  const rand = makeRng(99);
  const stones = [
    { x: 3, y: 27, w: 6, h: 5 },
    { x: 10, y: 25, w: 7, h: 7 },
    { x: 17, y: 28, w: 5, h: 4 },
    { x: 7, y: 30, w: 5, h: 3 },
    { x: 14, y: 30, w: 6, h: 3 },
  ];
  for (const s of stones) {
    for (let y = s.y; y < s.y + s.h; y++) {
      for (let x = s.x; x < s.x + s.w; x++) {
        if (x < 0 || x >= DW || y >= DH) continue;
        const edge = x === s.x || x === s.x + s.w - 1 || y === s.y;
        const lit = (x + y) % 5 === 0;
        px(g, x, y, edge ? pal.decorDark : lit ? pal.decorLight : pal.decorMain, 0.95);
      }
    }
    // top highlight line
    for (let x = s.x; x < s.x + s.w; x++) px(g, x, s.y, pal.decorLight, 0.5);
  }
  // Scattered small pebbles
  for (let i = 0; i < 10; i++) {
    const bx = Math.floor(rand() * DW);
    const by = 29 + Math.floor(rand() * 4);
    px(g, bx, by, pal.decorDark, 0.6);
  }
  // Shadow (wide, soft)
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(12, 33, 20, 4);
}

function chapelShortStump(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const cx = 12;
  // Base block (small)
  for (let x = 6; x <= 18; x++) {
    for (let y = 28; y <= 33; y++) {
      const edge = x === 6 || x === 18 || y === 33;
      px(g, x, y, edge ? pal.decorDark : pal.decorMain);
    }
  }
  // Short shaft (stump) — broken around y=22
  for (let y = 22; y < 28; y++) {
    const halfW = 4;
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      const edge = x === cx - halfW || x === cx + halfW;
      px(g, x, y, edge ? pal.decorDark : (x + y) % 5 === 0 ? pal.decorLight : pal.decorMain);
    }
  }
  // Jagged top
  const tops = [21, 23, 20, 22, 23, 21, 22, 20, 23];
  for (let i = 0; i < 9; i++) {
    const x = 8 + i;
    px(g, x, tops[i], 0x000000, 0.5);
    px(g, x, tops[i] - 1, pal.decorDark, 0.7);
  }
  // Small crack
  px(g, 11, 25, 0x000000, 0.4);
  px(g, 12, 26, 0x000000, 0.4);
  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, 33, 12, 4);
}

// ---------------------------------------------------------------------------
// Stage 3 — Frozen Pass: snowy pine trees + ice crystals + snow mounds.
// Variant 0: snowy pine tree | 1: frost dead tree | 2: ice crystal cluster | 3: snow mound rock
// ---------------------------------------------------------------------------
function generateFrozenVariant(g: Phaser.GameObjects.Graphics, pal: StageDef['palette'], v: number): void {
  switch (v) {
    case 0: frozenSnowyPine(g, pal); break;
    case 1: frozenDeadTree(g, pal); break;
    case 2: frozenIceCluster(g, pal); break;
    case 3: frozenSnowMound(g, pal); break;
  }
}

function frozenSnowyPine(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const W = 24;
  const cx = 12;
  const trunk = 0x2a2830;
  const trunkShade = 0x1a1820;
  // Trunk
  for (let y = 25; y < 32; y++) {
    for (let x = 10; x <= 13; x++) {
      px(g, x, y, x === 10 ? trunkShade : trunk);
    }
  }
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx, 32, 14, 4);
  // Snowy pine canopy: tiers like the forest tree but white-tinted (use frozen palette).
  const tiers = [
    { y0: 18, y1: 27, wStart: 3, wEnd: 11 },
    { y0: 10, y1: 20, wStart: 2, wEnd: 9 },
    { y0: 3, y1: 12, wStart: 1, wEnd: 6 },
  ];
  tiers.forEach((tier) => {
    const rows = tier.y1 - tier.y0;
    for (let r = 0; r < rows; r++) {
      const t = r / rows;
      const halfW = tier.wStart + (tier.wEnd - tier.wStart) * t;
      const y = tier.y0 + r;
      for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
        if (x < 0 || x >= W) continue;
        const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
        // Snow sits on top of branches (lighter on the upper-left), dark gaps at edges.
        const isSnow = (x + y) % 3 === 0 || edge;
        const shade = isSnow ? pal.decorLight : x < cx ? pal.decorMain : pal.decorDark;
        px(g, x, y, shade);
        // Snow cap highlights on the very top row of each tier
        if (r === 0 && x > cx - halfW + 1 && x < cx + halfW - 1) px(g, x, y, 0xffffff, 0.7);
      }
    }
  });
}

function frozenDeadTree(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const W = 24;
  const trunk = 0x2a2830;
  const trunkShade = 0x1a1820;
  // Bare twisted trunk
  for (let y = 16; y < 32; y++) {
    const halfW = 2 + (y < 24 ? 0.5 : 0);
    const cx = 12 + (y > 24 ? Math.sin(y * 0.5) * 0.5 : 0);
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      px(g, x, y, x === Math.round(cx - halfW) ? trunkShade : trunk);
    }
  }
  // Bare twisted branches
  const branches = [
    { x0: 11, y0: 20, x1: 5, y1: 11 },
    { x0: 13, y0: 18, x1: 19, y1: 9 },
    { x0: 12, y0: 15, x1: 15, y1: 5 },
    { x0: 11, y0: 22, x1: 7, y1: 15 },
    { x0: 13, y0: 24, x1: 17, y1: 18 },
  ];
  branches.forEach((b) => {
    const steps = Math.max(Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(b.x0 + (b.x1 - b.x0) * t);
      const y = Math.round(b.y0 + (b.y1 - b.y0) * t);
      px(g, x, y, trunk);
      // Frost coating on branch tops
      if (i % 2 === 0) px(g, x, y - 1, pal.decorLight, 0.6);
    }
  });
  // Ice crystal clusters at branch tips
  const crystalPositions = [[5, 10], [19, 8], [15, 4]];
  crystalPositions.forEach(([ccx, ccy]) => {
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d <= 1) px(g, ccx + dx, ccy + dy, dy <= 0 ? pal.decorLight : pal.decorMain, 0.85);
      }
    }
    // Sharp crystal tip
    px(g, ccx, ccy - 2, pal.decorLight, 0.9);
  });
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(12, 32, 10, 3);
}

function frozenIceCluster(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const cx = 12;
  // Several jagged ice crystals jutting up from the ground.
  const crystals = [
    { x: cx - 7, h: 14, w: 3 },
    { x: cx - 2, h: 20, w: 4 },
    { x: cx + 3, h: 17, w: 3 },
    { x: cx + 7, h: 11, w: 2 },
  ];
  for (const c of crystals) {
    // Crystal body — tapered spike
    for (let y = 0; y < c.h; y++) {
      const t = y / c.h;
      const halfW = Math.max(0.5, c.w * 0.5 * (1 - t * 0.7));
      for (let x = Math.round(c.x - halfW); x <= Math.round(c.x + halfW); x++) {
        if (x < 0 || x >= DW) continue;
        const baseY = 33 - y;
        const edge = x === Math.round(c.x - halfW) || x === Math.round(c.x + halfW);
        const shade = edge ? pal.decorDark : x < c.x ? pal.decorMain : pal.decorLight;
        px(g, x, baseY, shade, 0.92);
      }
    }
    // Sharp highlight tip
    px(g, c.x, 33 - c.h, 0xffffff, 0.9);
    px(g, c.x, 33 - c.h - 1, pal.decorLight, 0.6);
  }
  // Snow drift around base
  for (let x = 2; x < 22; x++) {
    const h = 3 + Math.round(Math.sin((x / 20) * Math.PI) * 2);
    for (let y = 33 - h; y < 33; y++) {
      px(g, x, y, x % 3 === 0 ? pal.decorLight : 0xffffff, 0.8);
    }
  }
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx, 33, 18, 4);
}

function frozenSnowMound(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const cx = 12;
  // Frost-covered rock buried in a snow mound.
  for (let x = 3; x < 21; x++) {
    const h = 5 + Math.round(Math.sin(((x - 3) / 18) * Math.PI) * 3);
    for (let y = 33 - h; y < 33; y++) {
      const isTop = y === 33 - h;
      px(g, x, y, isTop ? 0xffffff : x % 3 === 0 ? pal.decorLight : pal.decorMain, 0.85);
    }
  }
  // Rock poking out of the snow (left side)
  for (let x = 6; x < 13; x++) {
    for (let y = 24; y < 30; y++) {
      const edge = x === 6 || x === 12 || y === 24;
      px(g, x, y, edge ? pal.decorDark : (x + y) % 4 === 0 ? pal.decorLight : 0x6a7080, 0.95);
    }
  }
  // Frost glints on rock
  px(g, 7, 25, pal.decorLight, 0.7);
  px(g, 10, 26, pal.decorLight, 0.6);
  // Shadow
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, 33, 20, 4);
}

// ---------------------------------------------------------------------------
// Stage 4 — Shadow Realm: void trees + floating dark crystals + dark rocks.
// Variant 0: void tree | 1: floating dark crystal | 2: shadow tombstone | 3: dark rock w/ tendril
// ---------------------------------------------------------------------------
function generateShadowVariant(g: Phaser.GameObjects.Graphics, pal: StageDef['palette'], v: number): void {
  switch (v) {
    case 0: shadowVoidTree(g, pal); break;
    case 1: shadowFloatingCrystal(g, pal); break;
    case 2: shadowTombstone(g, pal); break;
    case 3: shadowDarkRock(g, pal); break;
  }
}

function shadowVoidTree(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const W = 24;
  const cx = 12;
  const trunk = 0x1c1428;
  const trunkShade = 0x0e0818;
  // Twisted dark trunk
  for (let y = 16; y < 32; y++) {
    const wobble = Math.sin(y * 0.6) * 1.5;
    const halfW = 2;
    const tx = cx + Math.round(wobble);
    for (let x = tx - halfW; x <= tx + halfW; x++) {
      if (x < 0 || x >= W) continue;
      px(g, x, y, x === tx - halfW ? trunkShade : trunk);
    }
  }
  // Twisted bare branches reaching up/out
  const branches = [
    { x0: 11, y0: 18, x1: 4, y1: 8 },
    { x0: 13, y0: 17, x1: 20, y1: 6 },
    { x0: 12, y0: 14, x1: 16, y1: 3 },
    { x0: 11, y0: 20, x1: 6, y1: 14 },
    { x0: 13, y0: 22, x1: 18, y1: 16 },
  ];
  branches.forEach((b) => {
    const steps = Math.max(Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(b.x0 + (b.x1 - b.x0) * t);
      const y = Math.round(b.y0 + (b.y1 - b.y0) * t);
      px(g, x, y, trunk);
      // Purple glow nubs along branches
      if (i % 3 === 0) px(g, x, y - 1, pal.decorLight, 0.5);
    }
  });
  // Wispy purple-tinted canopy puffs at the top (sparse, glowy)
  const puffs = [[5, 7], [20, 5], [16, 2], [12, 5]];
  puffs.forEach(([pxc, pyc]) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          px(g, pxc + dx, pyc + dy, dy < 0 ? pal.decorLight : pal.decorMain, 0.6);
        }
      }
    }
  });
  // Glowing tendril wisps from the trunk
  for (let i = 0; i < 4; i++) {
    const wy = 22 + i * 2;
    px(g, 9 - i, wy, pal.decorLight, 0.35);
  }
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, 32, 12, 4);
}

function shadowFloatingCrystal(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const cx = 12;
  // Dark rock base on the ground
  for (let x = 5; x <= 19; x++) {
    for (let y = 28; y <= 33; y++) {
      const edge = x === 5 || x === 19 || y === 33;
      px(g, x, y, edge ? pal.decorDark : (x + y) % 5 === 0 ? pal.decorMain : 0x241838, 0.95);
    }
  }
  // Floating dark crystal (hovering above the rock)
  const crystalCx = 12;
  const crystalCy = 16;
  for (let dy = -5; dy <= 4; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dy * 1.3);
      if (d < 3.5) {
        const inner = d < 1.2;
        const edge = d > 2.8;
        px(g, crystalCx + dx, crystalCy + dy, inner ? pal.decorLight : edge ? pal.decorDark : pal.decorMain, 0.9);
      }
    }
  }
  // Facet lines on the crystal
  for (let i = -3; i <= 3; i++) px(g, crystalCx + i, crystalCy, 0x000000, 0.3);
  px(g, crystalCx, crystalCy - 5, pal.decorLight, 0.8); // tip
  // Glow halo around the floating crystal
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const gx = Math.round(crystalCx + Math.cos(ang) * 5);
    const gy = Math.round(crystalCy + Math.sin(ang) * 5);
    px(g, gx, gy, pal.decorLight, 0.4);
  }
  // Tendrils connecting crystal to base (shadowy)
  for (let y = crystalCy + 4; y < 28; y++) {
    const t = (y - (crystalCy + 4)) / (28 - (crystalCy + 4));
    const x = crystalCx + Math.round(Math.sin(y * 0.8) * 1.5);
    px(g, x, y, pal.decorMain, 0.3 + t * 0.3);
  }
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, 33, 14, 4);
}

function shadowTombstone(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  // Tombstone base
  for (let x = 6; x <= 17; x++) {
    for (let y = 22; y <= 30; y++) {
      const edge = x === 6 || x === 17 || y === 30;
      px(g, x, y, edge ? pal.decorDark : (x + y) % 5 === 0 ? pal.decorMain : 0x241838, 0.95);
    }
  }
  // Rounded arched top
  for (let x = 7; x <= 16; x++) {
    const topY = 18 + Math.round(Math.sin(((x - 7) / 9) * Math.PI) * 4);
    for (let y = topY; y < 22; y++) {
      px(g, x, y, y === topY ? pal.decorLight : x === 7 || x === 16 ? pal.decorDark : pal.decorMain);
    }
  }
  // Cracks
  for (let y = 22; y < 30; y += 2) px(g, 11, y, 0x000000, 0.45);
  // Glowing crystal shard embedded in the tombstone
  const crystalCx = 12;
  const crystalCy = 25;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 2.5) {
        px(g, crystalCx + dx, crystalCy + dy, d < 1 ? pal.decorLight : pal.decorMain, 0.9);
      }
    }
  }
  // Glow particles around the crystal
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const gx = Math.round(crystalCx + Math.cos(ang) * 4);
    const gy = Math.round(crystalCy + Math.sin(ang) * 4);
    px(g, gx, gy, pal.decorLight, 0.5);
  }
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(12, 32, 12, 3);
}

function shadowDarkRock(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const cx = 12;
  // Dark rock mound with glowing purple tendrils.
  for (let x = 4; x < 20; x++) {
    const h = 6 + Math.round(Math.sin(((x - 4) / 16) * Math.PI) * 4);
    for (let y = 33 - h; y < 33; y++) {
      const edge = x === 4 || x === 19 || y === 33 - h;
      px(g, x, y, edge ? pal.decorDark : (x + y) % 4 === 0 ? pal.decorMain : 0x241838, 0.95);
    }
    // Top highlight
    px(g, x, 33 - h, x % 3 === 0 ? pal.decorLight : pal.decorMain, 0.6);
  }
  // Glowing purple tendrils snaking up from the rock
  const tendrils = [
    { x0: 9, y0: 26, x1: 7, y1: 14 },
    { x0: 14, y0: 27, x1: 17, y1: 12 },
    { x0: 12, y0: 24, x1: 13, y1: 8 },
  ];
  tendrils.forEach((t) => {
    const steps = Math.max(Math.abs(t.x1 - t.x0), Math.abs(t.y1 - t.y0));
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps;
      const x = Math.round(t.x0 + (t.x1 - t.x0) * tt + Math.sin(i * 0.5) * 0.8);
      const y = Math.round(t.y0 + (t.y1 - t.y0) * tt);
      px(g, x, y, pal.decorLight, 0.5);
      px(g, x, y - 1, pal.decorMain, 0.35);
    }
    // Tendril tip glow
    px(g, t.x1, t.y1, pal.decorLight, 0.8);
    px(g, t.x1, t.y1 - 1, 0xffffff, 0.4);
  });
  // Soft purple glow at the base
  for (let i = 0; i < 5; i++) {
    px(g, 6 + i * 3, 31, pal.decorLight, 0.3);
  }
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, 33, 18, 4);
}

/** Generate all stage textures (tile + decor variants) for a given stage def. */
export function generateStageTextures(scene: Phaser.Scene, stage: StageDef): { tileKey: string; decorKeys: string[] } {
  const tileKey = generateStageTile(scene, stage);
  const decorKeys = generateStageDecorVariants(scene, stage);
  return { tileKey, decorKeys };
}