import Phaser from 'phaser';
import { MAGE_TEXTURE_KEY } from '../game/mageSprite';

/**
 * Movement/dash tuning, matched to reference/prototype.html's feel:
 *   - accel = 1000 px/s^2 toward input direction
 *   - velocity *= 0.86 per frame (~60fps) as friction/drag
 *   - base move speed cap ~230 (prototype clamps speed indirectly via the
 *     accel/friction balance settling near this magnitude)
 *   - dash: fixed-distance teleport-style dash (150px) with 0.28s i-frames,
 *     0.18s "dashing" window, and a 3.4s cooldown.
 */
const ACCEL = 1000;
const FRICTION = 0.86; // multiplicative drag applied per ~60fps frame
const MAX_SPEED = 230;
const DASH_DISTANCE = 150;
const DASH_IFRAMES = 0.28; // seconds of invulnerability
const DASH_ACTIVE = 0.18; // seconds the "dashing" flag stays true (for visuals/anim)
const DASH_COOLDOWN = 3.4; // seconds

interface PlayerState {
  vx: number;
  vy: number;
  facing: { x: number; y: number };
  invuln: number;
  dashing: number;
  dashCd: number;
}

export class GameScene extends Phaser.Scene {
  private mage!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private player: PlayerState = {
    vx: 0,
    vy: 0,
    facing: { x: 0, y: 1 },
    invuln: 0,
    dashing: 0,
    dashCd: 0,
  };

  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  create(): void {
    const { width, height } = this.scale;

    this.mage = this.add.sprite(width / 2, height / 2, MAGE_TEXTURE_KEY);
    this.mage.setScale(1.5);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.keySpace.on('down', () => this.tryDash());

    this.debugText = this.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d4f0ff',
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(1000);

    // Keep the mage centered on resize (viewport already resizes the canvas
    // itself via the Scale Manager RESIZE mode configured in main.ts).
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      // Clamp the mage's position into the new bounds so it never ends up
      // off-screen after a shrink.
      this.mage.x = Phaser.Math.Clamp(this.mage.x, 16, gameSize.width - 16);
      this.mage.y = Phaser.Math.Clamp(this.mage.y, 16, gameSize.height - 16);
    });
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.033, deltaMs / 1000);
    this.updatePlayer(dt);
    this.updateDebugText();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;

    let ax = 0;
    let ay = 0;
    if (this.cursors.left.isDown || this.keyA.isDown) ax -= 1;
    if (this.cursors.right.isDown || this.keyD.isDown) ax += 1;
    if (this.cursors.up.isDown || this.keyW.isDown) ay -= 1;
    if (this.cursors.down.isDown || this.keyS.isDown) ay += 1;

    const inputLen = Math.hypot(ax, ay) || 1;
    p.vx += (ax / inputLen) * ACCEL * dt;
    p.vy += (ay / inputLen) * ACCEL * dt;

    // Friction/drag — expressed as a per-second decay so it's frame-rate
    // independent while still matching the prototype's per-frame 0.86 feel
    // at ~60fps.
    const frictionThisFrame = Math.pow(FRICTION, dt * 60);
    p.vx *= frictionThisFrame;
    p.vy *= frictionThisFrame;

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      p.vx *= scale;
      p.vy *= scale;
    }

    const { width, height } = this.scale;
    this.mage.x = Phaser.Math.Clamp(this.mage.x + p.vx * dt, 14, width - 14);
    this.mage.y = Phaser.Math.Clamp(this.mage.y + p.vy * dt, 14, height - 14);

    if (Math.hypot(p.vx, p.vy) > 8) {
      const len = Math.hypot(p.vx, p.vy);
      p.facing = { x: p.vx / len, y: p.vy / len };
    }

    if (p.invuln > 0) p.invuln -= dt;
    if (p.dashing > 0) p.dashing -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;

    // Simple visual feedback while i-frames are active (flicker).
    this.mage.setAlpha(p.invuln > 0 ? (Math.floor(this.time.now / 60) % 2 === 0 ? 0.4 : 0.9) : 1);
  }

  private tryDash(): void {
    const p = this.player;
    if (p.dashCd > 0) return;

    let dx = p.vx;
    let dy = p.vy;
    if (Math.hypot(dx, dy) < 10) {
      dx = p.facing.x;
      dy = p.facing.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    const { width, height } = this.scale;
    this.mage.x = Phaser.Math.Clamp(this.mage.x + dx * DASH_DISTANCE, 14, width - 14);
    this.mage.y = Phaser.Math.Clamp(this.mage.y + dy * DASH_DISTANCE, 14, height - 14);

    p.invuln = DASH_IFRAMES;
    p.dashing = DASH_ACTIVE;
    p.dashCd = DASH_COOLDOWN;

    console.log(`[dash] triggered, cooldown ${DASH_COOLDOWN}s, i-frames ${DASH_IFRAMES}s`);
  }

  private updateDebugText(): void {
    const p = this.player;
    const dashLabel = p.dashCd > 0 ? `${p.dashCd.toFixed(1)}s` : 'ready';
    const iframeLabel = p.invuln > 0 ? 'INVULN' : '';
    this.debugText.setText(
      `dash: ${dashLabel}  ${iframeLabel}\nWASD move, Space dash`,
    );
  }
}
