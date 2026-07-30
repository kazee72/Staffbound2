import Phaser from 'phaser';
import { generateMageTexture } from '../game/mageSprite';
import { GameScene } from './GameScene';

/**
 * Boot scene: generates procedural textures (the pixel-art mage sprite)
 * up front and hands off to the Game scene. No external assets to preload
 * in Phase 1.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateMageTexture(this);
    this.scene.start('Game');
  }
}

// Re-export so main.ts only needs to import from one place if desired.
export { GameScene };
