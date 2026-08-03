/**
 * Loads a user-supplied character GIF (dropped in public/assets/character/)
 * and turns it into a Phaser sprite sheet + looping animation, so the mage
 * sprite can be an animated GIF instead of the procedurally-drawn pixel art.
 *
 * If no GIF is present at CHARACTER_GIF_URL, buildCharacterGifTexture()
 * returns false and the caller (BootScene) falls back to the original
 * generateMageTexture() pixel-art sprite.
 */
import { decodeGif, packFrameGrid } from './gifDecode';

/** Where the user drops their GIF — served from Vite's public/ dir. */
export const CHARACTER_GIF_URL = 'assets/character/player.gif';
/** Loader cache key for the raw GIF bytes. */
const GIF_BINARY_KEY = 'char-gif-raw';

/** Shared with mageSprite.ts so both code paths produce the same texture key. */
export const MAGE_TEXTURE_KEY = 'mage';
/** Animation key played when the GIF texture is in use (absent for the static fallback). */
export const MAGE_ANIM_KEY = 'mage-idle';

/** On-screen pixel footprint the mage should occupy (original pixel-art mage was 16px * 1.5 = 24). */
const TARGET_DISPLAY_SIZE = 40;

/** The scale factor to apply to mage sprites — accounts for the GIF's native resolution. */
let mageScale = 1.5;

/** Queue this in a scene's preload() to fetch the raw GIF bytes ahead of create(). */
export function loadCharacterGif(scene: Phaser.Scene): void {
  scene.load.binary(GIF_BINARY_KEY, CHARACTER_GIF_URL);
}

/** The scale to apply to a mage sprite so it renders at the game's expected size. */
export function getMageScale(): number {
  return mageScale;
}

/**
 * Call from create(), after the preload() from loadCharacterGif() has run.
 * Decodes the GIF and registers MAGE_TEXTURE_KEY + MAGE_ANIM_KEY.
 * Returns false (no-op) if no GIF was found or it failed to decode.
 */
export function buildCharacterGifTexture(scene: Phaser.Scene): boolean {
  const buf = scene.cache.binary.get(GIF_BINARY_KEY) as ArrayBuffer | undefined;
  if (!buf) return false;

  try {
    const decoded = decodeGif(buf);
    if (!decoded) return false;
    const { width: w, height: h, frames, delaysMs } = decoded;

    const { sheet, cols } = packFrameGrid(frames, w, h);

    if (scene.textures.exists(MAGE_TEXTURE_KEY)) scene.textures.remove(MAGE_TEXTURE_KEY);
    const texture = scene.textures.addCanvas(MAGE_TEXTURE_KEY, sheet);
    if (!texture) return false;
    frames.forEach((_fc, i) => texture.add(i, 0, (i % cols) * w, Math.floor(i / cols) * h, w, h));

    const avgDelayMs = delaysMs.reduce((sum, d) => sum + d, 0) / delaysMs.length;
    scene.anims.create({
      key: MAGE_ANIM_KEY,
      frames: scene.anims.generateFrameNumbers(MAGE_TEXTURE_KEY, { start: 0, end: frames.length - 1 }),
      frameRate: 1000 / avgDelayMs,
      repeat: -1,
    });

    mageScale = TARGET_DISPLAY_SIZE / Math.max(w, h);
    return true;
  } catch (err) {
    console.warn('[gifSprite] failed to decode character GIF, falling back to default sprite:', err);
    return false;
  }
}
