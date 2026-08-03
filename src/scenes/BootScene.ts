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
  }

  create(): void {
    if (!buildCharacterGifTexture(this)) {
      generateMageTexture(this);
    }
    buildEnemySpriteAssets(this);
    generateEnemyTextures(this);
    this.scene.start('Lobby');
  }
}
