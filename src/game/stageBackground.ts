/**
 * Stage-specific procedural pixel-art backgrounds.
 *
 * Generates a tileable ground texture + decor sprites for each stage's
 * visual theme, using the same fillRect+generateTexture pattern as
 * forestBackground.ts but driven by the STAGE_DEFS palette + decor kind.
 *
 * Texture keys are namespaced per stage so the Phaser texture manager
 * can hold all stage textures simultaneously without conflicts.
 */
import type { StageDef } from './stages';

const TILE = 32;

export const STAGE_TILE_KEY = 'stageTile';
export const STAGE_DECOR_KEY = 'stageDecor';

function px(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, 1, 1);
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

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };
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

  g.generateTexture(key, TILE, TILE);
  g.destroy();
  return key;
}

/**
 * Generate the decor sprite texture for a given stage definition.
 * Different decor types: forest (tree/bush), chapel (broken pillar),
 * frozen (ice crystal/dead tree), shadow (glowing crystal/tombstone).
 */
export function generateStageDecor(scene: Phaser.Scene, stage: StageDef): string {
  const key = STAGE_DECOR_KEY + '_' + stage.decor;
  if (scene.textures.exists(key)) return key;
  const pal = stage.palette;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  switch (stage.decor) {
    case 'forest':
      generateForestDecor(g, pal);
      break;
    case 'chapel':
      generateChapelDecor(g, pal);
      break;
    case 'frozen':
      generateFrozenDecor(g, pal);
      break;
    case 'shadow':
      generateShadowDecor(g, pal);
      break;
  }

  g.generateTexture(key, 24, 34);
  g.destroy();
  return key;
}

// --- Forest decor: pine tree (same as the original forestBackground tree) ---
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

// --- Chapel decor: broken pillar/column ---
function generateChapelDecor(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const W = 24;
  // Base block
  for (let x = 5; x <= 18; x++) {
    for (let y = 28; y <= 33; y++) {
      const edge = x === 5 || x === 18 || y === 28;
      px(g, x, y, edge ? pal.decorDark : pal.decorMain);
    }
  }
  // Column shaft (slightly broken/tapered)
  for (let y = 10; y < 28; y++) {
    const halfW = 5 - (y > 20 ? (y - 20) * 0.2 : 0); // taper/break near the top
    const cx = 12;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? pal.decorDark : (x + y) % 6 === 0 ? pal.decorLight : pal.decorMain);
    }
  }
  // Capital (top block, broken/jagged)
  for (let x = 6; x <= 18; x++) {
    const top = x % 3 === 0 ? 7 : 8;
    for (let y = top; y <= 10; y++) {
      px(g, x, y, x === 6 || x === 18 ? pal.decorDark : pal.decorMain);
    }
  }
  // Crack through the pillar
  for (let y = 12; y < 26; y++) {
    px(g, 11 + ((y % 4 < 2) ? 0 : 1), y, 0x000000, 0.4);
  }
  void W;
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(12, 32, 12, 4);
}

// --- Frozen decor: dead tree with ice crystals ---
function generateFrozenDecor(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const W = 24;
  const trunk = 0x2a2830;
  // Bare twisted trunk
  for (let y = 16; y < 32; y++) {
    const halfW = 2 + (y < 24 ? 0.5 : 0);
    const cx = 12;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      px(g, x, y, x === Math.round(cx - halfW) ? 0x1a1820 : trunk);
    }
  }
  // Bare branches
  const branches = [
    { x0: 11, y0: 20, x1: 6, y1: 12 },
    { x0: 13, y0: 18, x1: 18, y1: 10 },
    { x0: 12, y0: 16, x1: 14, y1: 6 },
    { x0: 11, y0: 22, x1: 7, y1: 16 },
  ];
  branches.forEach((b) => {
    const steps = Math.max(Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(b.x0 + (b.x1 - b.x0) * t);
      const y = Math.round(b.y0 + (b.y1 - b.y0) * t);
      px(g, x, y, trunk);
    }
  });
  // Ice crystals at branch tips
  const crystalPositions = [[6, 11], [18, 9], [14, 5]];
  crystalPositions.forEach(([cx, cy]) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          px(g, cx + dx, cy + dy, dy === 0 ? pal.decorLight : pal.decorMain, 0.8);
        }
      }
    }
  });
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(12, 32, 10, 3);
}

// --- Shadow decor: glowing crystal/tombstone ---
function generateShadowDecor(g: Phaser.GameObjects.Graphics, pal: StageDef['palette']): void {
  const W = 24;
  // Tombstone base
  for (let x = 6; x <= 17; x++) {
    for (let y = 22; y <= 30; y++) {
      const edge = x === 6 || x === 17 || y === 30;
      px(g, x, y, edge ? pal.decorDark : pal.decorMain);
    }
  }
  // Rounded top
  for (let x = 7; x <= 16; x++) {
    const topY = 18 + Math.round(Math.sin(((x - 7) / 9) * Math.PI) * 4);
    for (let y = topY; y < 22; y++) {
      px(g, x, y, y === topY ? pal.decorLight : x === 7 || x === 16 ? pal.decorDark : pal.decorMain);
    }
  }
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
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const gx = Math.round(crystalCx + Math.cos(ang) * 4);
    const gy = Math.round(crystalCy + Math.sin(ang) * 4);
    px(g, gx, gy, pal.decorLight, 0.5);
  }
  void W;
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(12, 32, 12, 3);
}

/** Generate all stage textures (tile + decor) for a given stage def into the scene's texture manager. */
export function generateStageTextures(scene: Phaser.Scene, stage: StageDef): { tileKey: string; decorKey: string } {
  const tileKey = generateStageTile(scene, stage);
  const decorKey = generateStageDecor(scene, stage);
  return { tileKey, decorKey };
}