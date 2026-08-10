import Phaser from 'phaser';
import { generateMageTexture } from '../game/mageSprite';
import { generateEnemyTextures } from '../game/enemySprites';
import { buildCharacterGifTexture, loadCharacterGif } from '../game/gifSprite';
import { buildEnemySpriteAssets, loadEnemySpriteAssets } from '../game/enemySpriteAssets';

/**
 * Boot scene: generates procedural textures (the pixel-art mage sprite,
 * enemy sprites, boss sprites) up front and hands off to the Lobby scene.
 *
 * Also attempts to load user-supplied art:
 * - a character GIF from public/assets/character/player.gif, replacing the
 *   procedural mage sprite with an animated version built from its frames;
 * - slime/skeleton sprite sheets from public/assets/, replacing those two
 *   enemy types' procedural textures with real animated sprites.
 * Each is independently optional — generateMageTexture()/generateEnemyTextures()
 * no-op per-key when a real texture already exists, so anything not found
 * (or that fails to decode) just falls back to the original pixel-art.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadCharacterGif(this);
    loadEnemySpriteAssets(this);
    // Bullet sprite sheets: 576x208, 16x16 cells = 36 cols x 13 rows
    this.load.spritesheet('bullets_red', 'assets/bullets_red.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('bullets_blue', 'assets/bullets_blue.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('bullets_green', 'assets/bullets_green.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('bullets_purple', 'assets/bullets_purple.png', { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    if (!buildCharacterGifTexture(this)) {
      generateMageTexture(this);
    }
    buildEnemySpriteAssets(this);
    generateEnemyTextures(this);
    // Create bullet animations for each element — each uses a DIFFERENT row from a DIFFERENT color sheet
    // Sheet layout: 36 cols x 13 rows of 16x16 cells. Use first 3 cols of each row as animation frames.
    // Rows 0-10 have distinct bullet shapes. Rows 11-12 are empty in first 3 cols.
    const elementMap: Record<string, { sheet: string; row: number; tint?: number }> = {
      fire:      { sheet: 'bullets_red',    row: 0 },  // small fireball
      ice:       { sheet: 'bullets_blue',   row: 1 },  // ice shard
      void:      { sheet: 'bullets_purple', row: 0 },  // void orb
      shadow:    { sheet: 'bullets_purple', row: 4 },  // shadow dart
      nature:    { sheet: 'bullets_green',  row: 2 },  // thorn spike
      holy:      { sheet: 'bullets_red',    row: 5, tint: 0xffe8a0 },  // holy bolt (gold tint)
      lightning: { sheet: 'bullets_green',  row: 7, tint: 0xffff00 },  // lightning bolt (yellow tint)
      wind:      { sheet: 'bullets_blue',   row: 3 },  // wind blade
      water:     { sheet: 'bullets_blue',   row: 6 },  // water droplet
      rock:      { sheet: 'bullets_red',    row: 1 },  // rock chunk
      ki:        { sheet: 'bullets_red',    row: 8, tint: 0xffd966 },  // ki blast (gold tint)
    };
    for (const [el, def] of Object.entries(elementMap)) {
      const start = def.row * 36; // 36 cols per row
      const frames: number[] = [start, start + 1, start + 2];
      const animKey = `bullet_${el}`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: frames.map((f) => ({ key: def.sheet, frame: f })),
          frameRate: 12,
          repeat: -1,
        });
      }
    }
    this.scene.start('Lobby');
  }
}
