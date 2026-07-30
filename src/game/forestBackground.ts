/**
 * Procedural pixel-art forest background.
 *
 * Generates a small set of tileable forest textures (grass with subtle blade
 * detail, and a couple of tree/bush "decoration" tiles) at native low-res
 * pixel scale, then tiles them across the play field via a Phaser
 * TileSprite for the grass (scrolls/tiles seamlessly at any viewport size)
 * plus scattered decoration sprites for trees/bushes so the world doesn't
 * look like a flat empty void. Kept deliberately low-saturation/dark so it
 * doesn't fight with the HUD or the ember/frost/arcane spell colors.
 */

const TILE = 32; // native pixel size of one grass tile, displayed at 1x (chunky pixel-art look)

export const FOREST_GRASS_KEY = 'forestGrass';
export const FOREST_TREE_KEY = 'forestTree';
export const FOREST_BUSH_KEY = 'forestBush';

const PALETTE = {
  grassBase: 0x1a2418,
  grassBase2: 0x1c2819,
  bladeLight: 0x25341f,
  bladeDark: 0x162015,
  dirt: 0x241d16,
  trunk: 0x2e2116,
  trunkShade: 0x1c1610,
  leafDark: 0x1e2f1e,
  leaf: 0x28401f,
  leafLight: 0x335229,
  bushDark: 0x1e2f1e,
  bush: 0x2a4321,
};

function px(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, 1, 1);
}

/** Generates all forest textures into the given scene's texture manager. Idempotent. */
export function generateForestTextures(scene: Phaser.Scene): void {
  generateGrassTile(scene);
  generateTree(scene);
  generateBush(scene);
}

function generateGrassTile(scene: Phaser.Scene): void {
  if (scene.textures.exists(FOREST_GRASS_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Base fill with a very subtle two-tone checker so tiling doesn't look dead flat.
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const base = (x + y) % 7 === 0 ? PALETTE.grassBase2 : PALETTE.grassBase;
      px(g, x, y, base);
    }
  }

  // Deterministic pseudo-random blades of grass, seeded by tile position so it's stable.
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };
  const bladeCount = 22;
  for (let i = 0; i < bladeCount; i++) {
    const bx = Math.floor(rand() * TILE);
    const by = Math.floor(rand() * TILE);
    const dark = rand() > 0.5;
    px(g, bx, by, dark ? PALETTE.bladeDark : PALETTE.bladeLight, 0.8);
    if (rand() > 0.4) px(g, bx, Math.max(0, by - 1), dark ? PALETTE.bladeDark : PALETTE.bladeLight, 0.45);
  }
  // A couple of dirt/patch specks for texture variety.
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(rand() * TILE);
    const by = Math.floor(rand() * TILE);
    px(g, bx, by, PALETTE.dirt, 0.5);
  }

  g.generateTexture(FOREST_GRASS_KEY, TILE, TILE);
  g.destroy();
}

// A small pixel-art pine/round tree, ~24x32, drawn with a trunk + layered canopy.
function generateTree(scene: Phaser.Scene): void {
  if (scene.textures.exists(FOREST_TREE_KEY)) return;
  const W = 24;
  const H = 34;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Trunk
  for (let y = 24; y < 32; y++) {
    for (let x = 10; x <= 13; x++) {
      px(g, x, y, x === 10 ? PALETTE.trunkShade : PALETTE.trunk);
    }
  }
  // Root shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(12, 32, 14, 4);

  // Canopy: three stacked triangle-ish tiers (pine silhouette), widest at bottom.
  const tiers: Array<{ y0: number; y1: number; wStart: number; wEnd: number }> = [
    { y0: 18, y1: 26, wStart: 3, wEnd: 11 },
    { y0: 10, y1: 20, wStart: 2, wEnd: 9 },
    { y0: 2, y1: 12, wStart: 1, wEnd: 6 },
  ];
  tiers.forEach((tier, ti) => {
    const rows = tier.y1 - tier.y0;
    for (let r = 0; r < rows; r++) {
      const t = r / rows;
      const halfW = tier.wStart + (tier.wEnd - tier.wStart) * t;
      const y = tier.y0 + r;
      const cx = 12;
      for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
        if (x < 0 || x >= W) continue;
        const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
        const shade = edge ? PALETTE.leafDark : x < cx ? PALETTE.leaf : PALETTE.leafLight;
        px(g, x, y, shade);
      }
    }
    void ti;
  });

  g.generateTexture(FOREST_TREE_KEY, W, H);
  g.destroy();
}

// A small rounded pixel-art bush, ~14x10.
function generateBush(scene: Phaser.Scene): void {
  if (scene.textures.exists(FOREST_BUSH_KEY)) return;
  const W = 14;
  const H = 10;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(7, 9, 10, 3);

  for (let y = 0; y < H - 1; y++) {
    const t = y / (H - 1);
    const halfW = 3 + Math.sin(t * Math.PI) * 4;
    const cx = 7;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? PALETTE.bushDark : PALETTE.bush);
    }
  }

  g.generateTexture(FOREST_BUSH_KEY, W, H);
  g.destroy();
}
