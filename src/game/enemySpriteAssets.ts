/**
 * Loads the user-supplied slime + skeleton art (dropped in public/assets/)
 * and turns them into real animated Phaser sprites, replacing the
 * procedurally-drawn pixel-art enemy textures for those two types.
 *
 * Skeleton ships as per-action GIFs (public/assets/Skeleton/GIFS/) — decoded
 * with the same gifDecode.ts pipeline used for the player mage. Slime ships
 * as per-action sprite-sheet PNGs (public/assets/Slimes/) laid out as a grid
 * of 7 palette-swapped colors (rows) x N animation frames (columns) at a
 * fixed 80x72 cell size; a single color row (green, matching the original
 * procedural slime's palette) is picked out and used.
 *
 * Both are optional: if the source files aren't present, build*() is a
 * no-op and the caller (BootScene) falls back to the original procedural
 * generateEnemyTextures() art for that type.
 */
import { decodeGif, packFrameGrid, type DecodedGif } from './gifDecode';
import { ENEMY_TEXTURE_KEYS } from './enemySprites';
import type { EnemyType } from './types';

// ---------------- Skeleton (GIFs) ----------------

const SKEL_ACTIONS = ['idle', 'walk', 'hit'] as const;
type SkelAction = (typeof SKEL_ACTIONS)[number];

const SKEL_GIF_URLS: Record<SkelAction, string> = {
  idle: 'assets/Skeleton/GIFS/Skeleton Idle.gif',
  walk: 'assets/Skeleton/GIFS/Skeleton Walk.gif',
  hit: 'assets/Skeleton/GIFS/Skeleton Hit.gif',
};

const skelBinaryKey = (a: SkelAction) => `skel-gif-${a}`;

export const SKEL_ANIM: Record<SkelAction, string> = {
  idle: 'skel-idle',
  walk: 'skel-walk',
  hit: 'skel-hit',
};

// ---------------- Slime (sprite-sheet PNGs) ----------------

const SLIME_ACTIONS = ['idle', 'move', 'hit'] as const;
type SlimeAction = (typeof SLIME_ACTIONS)[number];

const SLIME_PNG_URLS: Record<SlimeAction, string> = {
  idle: 'assets/Slimes/slime_idle1.png',
  move: 'assets/Slimes/slime_move.png',
  hit: 'assets/Slimes/slime_hit.png',
};

const slimeImageKey = (a: SlimeAction) => `slime-png-${a}`;

export const SLIME_ANIM: Record<SlimeAction, string> = {
  idle: 'slime-idle',
  move: 'slime-move',
  hit: 'slime-hit',
};

/** The sheet's fixed grid: 7 palette rows x N animation-frame columns, 80x72 per cell. */
const SLIME_ROWS = 7;
const SLIME_CELL_W = 80;
/** Row 4 (0-indexed) is the green slime — matches the original procedural sprite's palette. */
const SLIME_COLOR_ROW = 4;

// Target on-screen sizes. Skeleton matches the footprint the original
// procedural sprite rendered at (see the scale formula this replaces in
// GameScene.ts). Slime is bumped noticeably above that original footprint
// (was 26, barely visible) since the real art reads much smaller on-screen
// than the old procedural blob did at the same nominal height.
const SKEL_TARGET_HEIGHT = 30;
const SLIME_TARGET_HEIGHT = 92;

const spriteScale: Partial<Record<'slime' | 'skel', number>> = {};

/**
 * Procedural-art reference radii the original enemySprites.ts textures were
 * designed against (see the scale formula this replaces in GameScene.ts).
 */
const PROCEDURAL_REF_R: Record<EnemyType, number> = {
  slime: 7,
  skel: 9,
  wisp: 6.5,
  wraith: 10,
  ghoul: 10,
  iceWolf: 10,
  shadowWraith: 10,
};

/**
 * The r value each type spawns at normally (ETYPES[type].r) — the reference
 * point the real-asset target scale below was calibrated against, so a
 * smaller/larger r (e.g. a split-slime child) scales proportionally instead
 * of always rendering at the fixed target size.
 */
const REAL_ASSET_BASE_R: Record<'slime' | 'skel', number> = { slime: 9, skel: 10 };

/**
 * The scale to apply to an enemy sprite of this type + collision radius.
 * Uses the real-asset target scale for slime/skel if that art was built
 * (scaled proportionally to r around REAL_ASSET_BASE_R); otherwise falls
 * back to the original procedural-art formula.
 */
export function enemyVisualScale(type: EnemyType, r: number): number {
  const override = type === 'slime' || type === 'skel' ? spriteScale[type] : undefined;
  if (override !== undefined) return override * (r / REAL_ASSET_BASE_R[type as 'slime' | 'skel']);
  return (r / PROCEDURAL_REF_R[type]) * 1.35;
}

/** Queue in a scene's preload() to fetch the raw asset bytes ahead of create(). */
export function loadEnemySpriteAssets(scene: Phaser.Scene): void {
  for (const a of SKEL_ACTIONS) scene.load.binary(skelBinaryKey(a), SKEL_GIF_URLS[a]);
  for (const a of SLIME_ACTIONS) scene.load.image(slimeImageKey(a), SLIME_PNG_URLS[a]);
}

/** Call from create(), after the preload() from loadEnemySpriteAssets() has run. */
export function buildEnemySpriteAssets(scene: Phaser.Scene): void {
  buildSkeleton(scene);
  buildSlime(scene);
}

function buildSkeleton(scene: Phaser.Scene): void {
  try {
    const decoded: Partial<Record<SkelAction, DecodedGif>> = {};
    for (const a of SKEL_ACTIONS) {
      const buf = scene.cache.binary.get(skelBinaryKey(a)) as ArrayBuffer | undefined;
      if (!buf) return; // any missing action — keep the procedural fallback for consistency
      const d = decodeGif(buf);
      if (!d) return;
      decoded[a] = d;
    }

    const all = SKEL_ACTIONS.map((a) => decoded[a]!);
    const cellW = Math.max(...all.map((d) => d.width));
    const cellH = Math.max(...all.map((d) => d.height));

    // Pad every frame from every action to a shared cell size (bottom-anchored
    // so feet stay grounded across actions with different native heights),
    // then grid-pack everything into one atlas.
    const paddedFrames: HTMLCanvasElement[] = [];
    const ranges: Record<SkelAction, { start: number; count: number; delayMs: number }> = {} as Record<
      SkelAction,
      { start: number; count: number; delayMs: number }
    >;
    for (const a of SKEL_ACTIONS) {
      const d = decoded[a]!;
      const start = paddedFrames.length;
      d.frames.forEach((f) => paddedFrames.push(padFrame(f, cellW, cellH)));
      const avgDelay = d.delaysMs.reduce((s, x) => s + x, 0) / d.delaysMs.length;
      ranges[a] = { start, count: d.frames.length, delayMs: avgDelay };
    }

    const KEY = ENEMY_TEXTURE_KEYS.skel;
    if (scene.textures.exists(KEY)) scene.textures.remove(KEY);
    const { sheet, cols } = packFrameGrid(paddedFrames, cellW, cellH);
    const texture = scene.textures.addCanvas(KEY, sheet);
    if (!texture) return;
    paddedFrames.forEach((_f, i) => texture.add(i, 0, (i % cols) * cellW, Math.floor(i / cols) * cellH, cellW, cellH));

    for (const a of SKEL_ACTIONS) {
      const r = ranges[a];
      scene.anims.create({
        key: SKEL_ANIM[a],
        frames: scene.anims.generateFrameNumbers(KEY, { start: r.start, end: r.start + r.count - 1 }),
        frameRate: 1000 / r.delayMs,
        repeat: a === 'hit' ? 0 : -1,
      });
    }

    spriteScale.skel = SKEL_TARGET_HEIGHT / cellH;
  } catch (err) {
    console.warn('[enemySpriteAssets] failed to build skeleton sprite, falling back to procedural art:', err);
  }
}

function buildSlime(scene: Phaser.Scene): void {
  try {
    for (const a of SLIME_ACTIONS) {
      if (!scene.textures.exists(slimeImageKey(a))) return; // missing action — keep procedural fallback
    }

    const cellH = (scene.textures.get(slimeImageKey(SLIME_ACTIONS[0])).getSourceImage() as HTMLImageElement).height / SLIME_ROWS;

    const ranges: Record<SlimeAction, { start: number; count: number }> = {} as Record<
      SlimeAction,
      { start: number; count: number }
    >;
    const frameCanvases: HTMLCanvasElement[] = [];
    for (const a of SLIME_ACTIONS) {
      const src = scene.textures.get(slimeImageKey(a)).getSourceImage() as HTMLImageElement;
      const cols = Math.round(src.width / SLIME_CELL_W);
      const start = frameCanvases.length;
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('canvas');
        cell.width = SLIME_CELL_W;
        cell.height = cellH;
        cell
          .getContext('2d')!
          .drawImage(src, c * SLIME_CELL_W, SLIME_COLOR_ROW * cellH, SLIME_CELL_W, cellH, 0, 0, SLIME_CELL_W, cellH);
        frameCanvases.push(cell);
      }
      ranges[a] = { start, count: cols };
    }

    const KEY = ENEMY_TEXTURE_KEYS.slime;
    if (scene.textures.exists(KEY)) scene.textures.remove(KEY);
    const { sheet, cols: atlasCols } = packFrameGrid(frameCanvases, SLIME_CELL_W, cellH);
    const texture = scene.textures.addCanvas(KEY, sheet);
    if (!texture) return;
    frameCanvases.forEach((_f, i) =>
      texture.add(i, 0, (i % atlasCols) * SLIME_CELL_W, Math.floor(i / atlasCols) * cellH, SLIME_CELL_W, cellH),
    );

    for (const a of SLIME_ACTIONS) {
      const r = ranges[a];
      scene.anims.create({
        key: SLIME_ANIM[a],
        frames: scene.anims.generateFrameNumbers(KEY, { start: r.start, end: r.start + r.count - 1 }),
        frameRate: a === 'move' ? 10 : 8,
        repeat: a === 'hit' ? 0 : -1,
      });
    }

    spriteScale.slime = SLIME_TARGET_HEIGHT / cellH;
  } catch (err) {
    console.warn('[enemySpriteAssets] failed to build slime sprite, falling back to procedural art:', err);
  }
}

function padFrame(src: HTMLCanvasElement, cellW: number, cellH: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = cellW;
  c.height = cellH;
  c.getContext('2d')!.drawImage(src, Math.floor((cellW - src.width) / 2), cellH - src.height);
  return c;
}
