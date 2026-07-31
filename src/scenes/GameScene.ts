import Phaser from 'phaser';
import { MAGE_TEXTURE_KEY } from '../game/mageSprite';
import { FOREST_GRASS_KEY, FOREST_TREE_KEY, FOREST_BUSH_KEY, generateForestTextures } from '../game/forestBackground';
import { ENEMY_TEXTURE_KEYS, BOSS_TEXTURE_KEYS } from '../game/enemySprites';
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
  updateBossFight,
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
  private keyQ!: Phaser.Input.Keyboard.Key;
  // UHJK alternative movement keys (vi-style)
  private keyU!: Phaser.Input.Keyboard.Key;
  private keyH!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;

  private world!: World;
  private ui!: UIManager;

  private fxGraphics!: Phaser.GameObjects.Graphics;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private grassLayer!: Phaser.GameObjects.TileSprite;
  private decorLayer!: Phaser.GameObjects.Layer;

  private fireflies: Firefly[] = [];

  // Pool of damage-popup text objects.
  private popupTexts: Phaser.GameObjects.Text[] = [];

  // Pixel-art enemy sprite pool, keyed by EnemyState object identity (enemies
  // array entries are spliced/pushed freely each frame, so identity keying
  // is simplest — unused sprites are hidden+recycled, not destroyed, to
  // avoid texture-manager churn during heavy spawn bursts).
  private enemySpritePool: Phaser.GameObjects.Sprite[] = [];
  private enemySpriteByRef = new Map<World['enemies'][number], Phaser.GameObjects.Sprite>();

  private bossSprite: Phaser.GameObjects.Sprite | null = null;
  private currentBossDefId: string | null = null;

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
    this.keyQ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyU = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.U);
    this.keyH = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.keyJ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);

    this.keySpace.on('down', () => {
      if (this.world.running && !this.world.grimoireOpen) tryDash(this.world);
    });
    this.keyG.on('down', () => this.toggleGrimoire());
    this.keyEsc.on('down', () => {
      if (this.world.grimoireOpen) this.toggleGrimoire();
    });
    // Q toggles auto-aim on/off at any time during a run.
    this.keyQ.on('down', () => {
      if (!this.world.running) return;
      this.world.autoAim = !this.world.autoAim;
      this.world.flash(this.world.autoAim ? 'AUTO-AIM ON' : 'AUTO-AIM OFF', this.world.autoAim ? 'var(--frost)' : 'var(--gold)');
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
      autoAim: true,
      player: {
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        hp: 100,
        invuln: 1,
        facing: { x: 0, y: -1 },
        aimAngle: -Math.PI / 2,
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
      bossTimer: 130,
      bossFight: null,
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
        left: this.cursors.left.isDown || this.keyA.isDown || this.keyH.isDown,
        right: this.cursors.right.isDown || this.keyD.isDown || this.keyK.isDown,
        up: this.cursors.up.isDown || this.keyW.isDown || this.keyU.isDown,
        down: this.cursors.down.isDown || this.keyS.isDown || this.keyJ.isDown,
      };
      this.world.elapsed += dt;
      updatePlayer(this.world, input, dt);
      // Mouse-aim: bolt/ice lance/shadow bolt fire toward the cursor instead
      // of auto-targeting the nearest foe. Updated every frame so aim stays
      // responsive even between casts.
      const pointer = this.input.activePointer;
      const p = this.world.player;
      const dx = pointer.worldX - p.x;
      const dy = pointer.worldY - p.y;
      if (Math.hypot(dx, dy) > 2) p.aimAngle = Math.atan2(dy, dx);
      updateSpellTimers(this.world, dt);
      updateProjectiles(this.world, dt);
      updateDecoys(this.world, dt);
      updateEnemies(this.world, dt);
      updateEffects(this.world, dt);
      updateParticles(this.world, dt);
      updateSpawns(this.world, dt);
      updateBossFight(this.world, dt);
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
    this.renderEnemies();

    // boss fight (sprite, telegraphs, bullet-hell projectiles, healthbar)
    this.renderBossFight(g);

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

  /**
   * Renders regular enemies as pooled pixel-art Sprites (procedurally
   * generated in enemySprites.ts) instead of raw Graphics primitives.
   * Frozen/slowed/marked visual states are applied via sprite tint + a
   * Graphics outline ring (kept on fxGraphics) rather than fillStyle swaps.
   */
  private renderEnemies(): void {
    const world = this.world;
    const g = this.fxGraphics;
    const seen = new Set<World['enemies'][number]>();

    world.enemies.forEach((e) => {
      seen.add(e);
      let spr = this.enemySpriteByRef.get(e);
      if (!spr) {
        spr = this.enemySpritePool.find((s) => !s.visible);
        if (!spr) {
          spr = this.add.sprite(0, 0, ENEMY_TEXTURE_KEYS[e.type]).setDepth(4.5);
          this.enemySpritePool.push(spr);
        }
        spr.setTexture(ENEMY_TEXTURE_KEYS[e.type]);
        this.enemySpriteByRef.set(e, spr);
      }
      // Native art is sized to roughly match each type's collision radius;
      // scale so the sprite's visual footprint tracks e.r (base r values in
      // ETYPES were the tuning reference for each native texture's size).
      const scale = e.type === 'slime' ? e.r / 7 : e.type === 'skel' ? e.r / 9 : e.type === 'wisp' ? e.r / 6.5 : e.r / 10;
      spr.setScale(scale * 1.35);
      spr.setPosition(Math.round(e.x), Math.round(e.y));
      spr.setVisible(true);
      spr.setDepth(4.5 + e.y * 0.0001);

      const frozen = e.frozenUntil > world.elapsed;
      const slowed = !frozen && e.slowUntil > world.elapsed;
      if (frozen) spr.setTint(0xa9d8ef);
      else if (slowed) spr.setTint(0xc9d8e8);
      else spr.clearTint();

      if (e.marked > world.elapsed) {
        g.lineStyle(2, 0xc4728f, 1);
        g.strokeCircle(e.x, e.y, e.r + 4);
      }
      if (e.hp < e.maxHp) {
        const w = 28;
        g.fillStyle(0x1a1c2c, 1);
        g.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
        g.fillStyle(0xc15b5b, 1);
        g.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.maxHp), 5);
      }
    });

    // Recycle sprites for enemies no longer present (dead/removed this frame).
    this.enemySpriteByRef.forEach((spr, ref) => {
      if (!seen.has(ref)) {
        spr.setVisible(false);
        this.enemySpriteByRef.delete(ref);
      }
    });
  }

  /**
   * Renders the active boss (bigger pixel-art sprite), its telegraphed
   * warnings (rings/lines), its bullet-hell projectiles, and a large
   * boss healthbar. No-op when no boss fight is active — also tears down
   * the boss sprite the frame a fight ends so it doesn't linger.
   */
  private renderBossFight(g: Phaser.GameObjects.Graphics): void {
    const world = this.world;
    const fight = world.bossFight;
    if (!fight) {
      if (this.bossSprite) {
        this.bossSprite.destroy();
        this.bossSprite = null;
        this.currentBossDefId = null;
      }
      return;
    }
    const boss = fight.boss;

    if (!this.bossSprite || this.currentBossDefId !== boss.defId) {
      this.bossSprite?.destroy();
      this.bossSprite = this.add.sprite(boss.x, boss.y, BOSS_TEXTURE_KEYS[boss.defId]).setDepth(4.8);
      this.currentBossDefId = boss.defId;
    }
    this.bossSprite.setPosition(Math.round(boss.x), Math.round(boss.y));
    this.bossSprite.setScale(1.5);
    const frozenLike = boss.slowUntil > world.elapsed;
    if (frozenLike) this.bossSprite.setTint(0xc9d8e8);
    else this.bossSprite.clearTint();

    // Telegraphs (warning shapes before an attack lands/fires).
    boss.telegraphs.forEach((tg) => {
      const alpha = 0.75 * (tg.t / tg.dur);
      const color = Phaser.Display.Color.HexStringToColor(tg.color).color;
      if (tg.kind === 'ring') {
        g.lineStyle(3, color, alpha);
        g.strokeCircle(tg.x, tg.y, tg.radius ?? 40);
      } else if (tg.kind === 'line') {
        const len = tg.length ?? 1000;
        const w = tg.width ?? 24;
        const ang = tg.angle ?? 0;
        g.save();
        g.translateCanvas(tg.x, tg.y);
        g.rotateCanvas(ang);
        g.fillStyle(color, alpha * 0.35);
        g.fillRect(0, -w / 2, len, w);
        g.restore();
      }
    });

    // Bullet-hell projectiles.
    boss.projectiles.forEach((pr) => {
      const color = Phaser.Display.Color.HexStringToColor(pr.color).color;
      g.fillStyle(color, 1);
      g.fillCircle(pr.x, pr.y, pr.r);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(pr.x, pr.y, pr.r * 0.4);
    });

    // Large boss healthbar above the sprite.
    const w = 130;
    g.fillStyle(0x0d0e16, 0.9);
    g.fillRect(boss.x - w / 2, boss.y - boss.r - 24, w, 9);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(boss.color).color, 1);
    g.fillRect(boss.x - w / 2, boss.y - boss.r - 24, w * Math.max(0, boss.hp / boss.maxHp), 9);
  }

  private drawPlayer(): void {
    const p = this.world.player;
    this.mage.setPosition(Math.round(p.x), Math.round(p.y));
    const blink = p.invuln > 0 && Math.floor(this.world.elapsed * 16) % 2 === 0;
    this.mage.setAlpha(blink ? 0.4 : 1);
    // Flip the sprite horizontally to face the mouse-aim direction (staff
    // visually points toward wherever bolts/ice lance/shadow bolt will fire).
    this.mage.setFlipX(Math.cos(p.aimAngle) < 0);

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
