import Phaser from 'phaser';
import { generateMageTexture } from '../game/mageSprite';
import { generateEnemyTextures } from '../game/enemySprites';

/**
 * Boot scene: generates procedural textures (the pixel-art mage sprite,
 * enemy sprites, boss sprites) up front and hands off to the Lobby scene.
 * No external assets to preload.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateMageTexture(this);
    generateEnemyTextures(this);
    this.scene.start('Lobby');
  }
}
