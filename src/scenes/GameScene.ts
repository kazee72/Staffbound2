import Phaser from 'phaser';
import { MAGE_TEXTURE_KEY } from '../game/mageSprite';
import { FOREST_GRASS_KEY, FOREST_TREE_KEY, FOREST_BUSH_KEY, generateForestTextures } from '../game/forestBackground';
import { createWorld } from '../game/types';
import type { World } from '../game/types';
import { xpForLevel } from '../game/player';
import { updateSpellTimers } from '../game/spells';
import { updateSpawns } from '../game/waves';
import {
  updatePlayer,
  updateProjectiles,
  updateDecoys,
  updateEnemies,
  updateEffects,
  updateParticles,
  tryDash,
  type InputState,
} from '../game/simulation';
import { UIManager } from '../ui/UIManager';

interface Firefly {
  x: number;
  y: number;
  vy: number;
  sway: number;
  r: number;
  hue: number;
}

export class GameScene extends Phaser.Scene {
  private mage!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyG!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  private world!: World;
  private ui!: UIManager;

  private fxGraphics!: Phaser.GameObjects.Graphics;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private grassLayer!: Phaser.GameObjects.TileSprite;
  private decorLayer!: Phaser.GameObjects.Layer;

  private fireflies: Firefly[] = [];

  // Pool of damage-popup text objects.
  private popupTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    const { width, height } = this.scale;

    this.world = createWorld(width, height, (text, color) => this.ui.flash(text, color));

    generateForestTextures(this);
    this.grassLayer = this.add
      .tileSprite(0, 0, width, height, FOREST_GRASS_KEY)
      .setOrigin(0, 0)
      .setDepth(0);
    this.decorLayer = this.add.layer().setDepth(0.5);
    this.scatterForestDecor(width, height);

    this.bgGraphics = this.add.graphics().setDepth(1);
    this.initFireflies();

    this.fxGraphics = this.add.graphics().setDepth(5);

    this.mage = this.add.sprite(width / 2, height / 2, MAGE_TEXTURE_KEY).setDepth(6);
    this.mage.setScale(1.5);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyG = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.keySpace.on('down', () => {
      if (this.world.running && !this.world.grimoireOpen) tryDash(this.world);
    });
    this.keyG.on('down', () => this.toggleGrimoire());
    this.keyEsc.on('down', () => {
      if (this.world.grimoireOpen) this.toggleGrimoire();
    });

    // DOM UI overlay, layered above the canvas.
    const parentEl = document.getElementById('app')!;
    this.ui = new UIManager(parentEl);
    this.ui.onStart = () => this.startRun();
    this.ui.onRetry = () => this.startRun();
    this.ui.onToggleGrimoire = () => this.toggleGrimoire();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.world.W = gameSize.width;
      this.world.H = gameSize.height;
      this.grassLayer.setSize(gameSize.width, gameSize.height);
      this.scatterForestDecor(gameSize.width, gameSize.height);
      this.initFireflies();
    });
  }

  private startRun(): void {
    this.ui.hideStart();
    this.ui.hideGameOver();
    const { width, height } = this.scale;
    this.world.purchased.clear();
    Object.assign(this.world, {
      running: true,
      grimoireOpen: false,
      player: {
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        hp: 100,
        invuln: 1,
        facing: { x: 0, y: -1 },
        dashCd: 0,
        dashing: 0,
        adrenaline: 0,
        undyingCd: 0,
        r: 9,
      },
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      sp: 0,
      spSpent: 0,
      slain: 0,
      elapsed: 0,
      enemies: [],
      projectiles: [],
      effects: [],
      particles: [],
      popups: [],
      wisps: [],
      decoys: [],
      cd: { bolt: 0.3, boltCastCount: 0, fireNova: 0, iceLance: 0, frostArmor: 0, frostArmorActive: 0, arcaneBurst: 0, vines: 0, shadowBolt: 0 },
      spawnTimer: 1,
      bossTimer: 90,
    });
    this.ui.renderTree(this.world);
    this.ui.setGrimoireVisible(false);
  }

  private toggleGrimoire(): void {
    if (!this.world.running) return;
    this.world.grimoireOpen = !this.world.grimoireOpen;
    this.ui.setGrimoireVisible(this.world.grimoireOpen);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.033, deltaMs / 1000);
    this.drawFireflies(dt);

    if (this.world.running && !this.world.grimoireOpen) {
      const input: InputState = {
        left: this.cursors.left.isDown || this.keyA.isDown,
        right: this.cursors.right.isDown || this.keyD.isDown,
        up: this.cursors.up.isDown || this.keyW.isDown,
        down: this.cursors.down.isDown || this.keyS.isDown,
      };
      this.world.elapsed += dt;
      updatePlayer(this.world, input, dt);
      updateSpellTimers(this.world, dt);
      updateProjectiles(this.world, dt);
      updateDecoys(this.world, dt);
      updateEnemies(this.world, dt);
      updateEffects(this.world, dt);
      updateParticles(this.world, dt);
      updateSpawns(this.world, dt);
      this.ui.updateHUD(this.world);
      if (this.world.grimoireOpen) this.ui.updateNodeStates(this.world);
      else this.ui.updateNodeStates(this.world);

      if (!this.world.running) {
        // damagePlayer flipped running=false this frame -> game over.
        this.ui.showGameOver(this.world);
      }
    }

    if (this.world.running) this.renderScene();
  }

  // ---------------- rendering ----------------

  /**
   * Scatters pixel-art trees/bushes around the play field's edges (kept clear
   * of the center where the player starts) to sell the "forest" backdrop.
   * Deterministic per viewport size so it doesn't look like it's dancing
   * around on resize.
   */
  private scatterForestDecor(width: number, height: number): void {
    this.decorLayer.removeAll(true);
    let seed = 4242;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 10000) / 10000;
    };
    const cx = width / 2;
    const cy = height / 2;
    const clearRadius = 160; // keep the immediate spawn area clear of trees
    const count = Math.max(18, Math.round((width * height) / 55000));
    for (let i = 0; i < count; i++) {
      const x = rand() * width;
      const y = rand() * height;
      if (Math.hypot(x - cx, y - cy) < clearRadius) continue;
      const isTree = rand() > 0.35;
      const key = isTree ? FOREST_TREE_KEY : FOREST_BUSH_KEY;
      const scale = isTree ? 1.4 + rand() * 0.8 : 1.3 + rand() * 0.7;
      const spr = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale);
      spr.setAlpha(0.85 + rand() * 0.15);
      spr.setTint(rand() > 0.5 ? 0xffffff : 0xd8e4d0);
      this.decorLayer.add(spr);
    }
  }

  private initFireflies(): void {
    const { W, H } = this.world ?? { W: this.scale.width, H: this.scale.height };
    const count = Math.round((W * H) / 22000);
    this.fireflies = new Array(Math.max(24, count)).fill(0).map(() => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: -(6 + Math.random() * 10),
      sway: Math.random() * Math.PI * 2,
      r: 1 + Math.random() * 1.8,
      hue: Math.random() < 0.5 ? 0xc9a869 : 0x8ec9e8,
    }));
  }

  private drawFireflies(dt: number): void {
    const { H } = this.world;
    this.bgGraphics.clear();
    const t = this.time.now;
    this.fireflies.forEach((f) => {
      f.y += f.vy * dt;
      f.sway += 0.02;
      const x = f.x + Math.sin(f.sway) * 14;
      const alpha = 0.35 + 0.25 * Math.sin(t / 500 + f.sway);
      this.bgGraphics.fillStyle(f.hue, Math.max(0, alpha));
      this.bgGraphics.fillCircle(x, f.y, f.r);
      if (f.y < -10) {
        f.y = H + 10;
        f.x = Math.random() * this.world.W;
      }
    });
  }

  private renderScene(): void {
    const g = this.fxGraphics;
    g.clear();
    const world = this.world;

    // effects (rings/ground)
    world.effects.forEach((fx) => {
      if (fx.type === 'ring') {
        const r = fx.maxR * (fx.t / fx.life);
        const alpha = Math.max(0, 1 - fx.t / fx.life);
        g.lineStyle(4, Phaser.Display.Color.HexStringToColor(fx.color).color, alpha);
        g.strokeCircle(fx.x, fx.y, Math.max(0, r));
      } else if (fx.type === 'ground') {
        g.fillStyle(Phaser.Display.Color.HexStringToColor(fx.color).color, 0.18);
        g.fillCircle(fx.x, fx.y, fx.r);
      }
    });

    // decoys
    world.decoys.forEach((d) => {
      g.fillStyle(0xc4728f, 0.6);
      g.fillCircle(d.x, d.y, 10);
    });

    // wisps
    world.wisps.forEach((w) => {
      if (w.x === undefined || w.y === undefined) return;
      g.fillStyle(0x8bc48a, 1);
      g.fillCircle(w.x, w.y, 6);
    });

    // enemies
    world.enemies.forEach((e) => this.drawEnemy(g, e));

    // projectiles
    world.projectiles.forEach((pr) => {
      const color = Phaser.Display.Color.HexStringToColor(pr.color).color;
      g.fillStyle(color, 1);
      g.fillCircle(pr.x, pr.y, pr.mini ? 3 : pr.r);
    });

    // player sprite
    this.drawPlayer();

    // particles
    world.particles.forEach((pt) => {
      const a = Math.max(0, pt.life / pt.maxLife);
      const color = Phaser.Display.Color.HexStringToColor(pt.color).color;
      g.fillStyle(color, a);
      g.fillCircle(pt.x, pt.y, pt.size * a + 0.6);
    });

    this.drawPopups();
  }

  private drawEnemy(g: Phaser.GameObjects.Graphics, e: World['enemies'][number]): void {
    const world = this.world;
    const frozen = e.frozenUntil > world.elapsed;
    const color = frozen ? 0xa9d8ef : Phaser.Display.Color.HexStringToColor(e.color).color;
    g.fillStyle(color, 1);
    if (e.type === 'slime') {
      g.fillEllipse(e.x, e.y, e.r * 2, e.r * 1.6);
    } else if (e.type === 'skel') {
      g.fillRect(e.x - e.r * 0.6, e.y - e.r, e.r * 1.2, e.r * 2);
      g.fillCircle(e.x, e.y - e.r * 1.1, e.r * 0.55);
    } else if (e.type === 'wisp') {
      const points: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        points.push(new Phaser.Math.Vector2(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r));
        points.push(new Phaser.Math.Vector2(e.x + Math.cos(a + 0.3) * e.r * 0.4, e.y + Math.sin(a + 0.3) * e.r * 0.4));
      }
      g.fillPoints(points, true);
    } else {
      g.fillCircle(e.x, e.y, e.r);
      g.fillStyle(0xeeda9e, 1);
      g.fillCircle(e.x - e.r * 0.3, e.y - e.r * 0.2, 2.4);
      g.fillCircle(e.x + e.r * 0.3, e.y - e.r * 0.2, 2.4);
    }
    if (e.marked > world.elapsed) {
      g.lineStyle(2, 0xc4728f, 1);
      g.strokeCircle(e.x, e.y, e.r + 4);
    }
    if (e.isBoss || e.hp < e.maxHp) {
      const w = e.isBoss ? 60 : 28;
      g.fillStyle(0x1a1c2c, 1);
      g.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
      g.fillStyle(e.isBoss ? 0xc4728f : 0xc15b5b, 1);
      g.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
    if (e.telegraph && e.telegraph > 0) {
      g.lineStyle(3, 0xc4728f, 0.35 * (1 - e.telegraph));
      g.strokeCircle(e.x, e.y, 150 * (1 - e.telegraph));
    }
  }

  private drawPlayer(): void {
    const p = this.world.player;
    this.mage.setPosition(Math.round(p.x), Math.round(p.y));
    const blink = p.invuln > 0 && Math.floor(this.world.elapsed * 16) % 2 === 0;
    this.mage.setAlpha(blink ? 0.4 : 1);

    // frost armor ring + ambient glow via the fx graphics, drawn behind the sprite depth-wise is
    // acceptable given the sprite renders on its own GameObject above fxGraphics depth.
    const g = this.fxGraphics;
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(p.x, p.y + 10, 18, 6);
    if (this.world.cd.frostArmorActive > 0) {
      g.lineStyle(1.5, 0x8ec9e8, 1);
      g.strokeCircle(p.x, p.y, 13);
    }
  }

  private drawPopups(): void {
    const world = this.world;
    // Recycle/allocate pooled Text objects to match world.popups length.
    while (this.popupTexts.length < world.popups.length) {
      const t = this.add.text(0, 0, '', { fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }).setDepth(7);
      t.setOrigin(0.5, 0.5);
      this.popupTexts.push(t);
    }
    world.popups.forEach((u, i) => {
      const t = this.popupTexts[i];
      t.setText(u.text);
      t.setColor(u.color);
      t.setFontSize(u.big ? 15 : 12);
      t.setPosition(u.x, u.y);
      t.setAlpha(Math.max(0, u.life / 0.8));
      t.setVisible(true);
    });
    for (let i = world.popups.length; i < this.popupTexts.length; i++) {
      this.popupTexts[i].setVisible(false);
    }
  }
}
