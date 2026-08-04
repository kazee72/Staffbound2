import Phaser from 'phaser';
import { MAGE_TEXTURE_KEY } from '../game/mageSprite';
import { MAGE_ANIM_KEY, getMageScale } from '../game/gifSprite';
import { FOREST_GRASS_KEY, FOREST_TREE_KEY, generateForestTextures } from '../game/forestBackground';
import { generateStageTextures } from '../game/stageBackground';
import { getStageDef } from '../game/stages';
import { ENEMY_TEXTURE_KEYS, BOSS_TEXTURE_KEYS } from '../game/enemySprites';
import { enemyVisualScale, SKEL_ANIM, SLIME_ANIM } from '../game/enemySpriteAssets';
import { createWorld } from '../game/types';
import type { World, NetPlayer, NetPlayerState, EnemyType } from '../game/types';
import { xpForLevel, gainXP, maxHP } from '../game/player';
import { updateSpellTimers } from '../game/spells';
import { updateSpawns } from '../game/waves';
import { damageEnemy, damageBoss, killEnemy } from '../game/combat';
import { serializeEnemyState, deserializeEnemyState, BOSS_DEF_NAMES, ENEMY_TYPE_NAMES } from '../net/enemyState';
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
import { buySkill } from '../game/skillTree';
import { UIManager } from '../ui/UIManager';
import { attachMeta, bankRunEssence, loadMeta, metaStartLevel, metaStartHP, type MetaState } from '../game/metaProgression';
import { netManager } from '../net/netManager';
import type { ClientMsg, HostMsg, MetaPayload, PlayerInfo } from '../net/messages';
import type { LobbySceneInitData } from './LobbyScene';

interface Firefly {
  x: number;
  y: number;
  vy: number;
  sway: number;
  r: number;
  hue: number;
}

/** Per-player slot tint colors for multiplayer rendering. */
const PLAYER_TINTS = [0x6b9eff, 0x8bc48a, 0xe2a040, 0xb58ce0];
const PLAYER_TINT_NAMES = ['blue', 'green', 'orange', 'purple'];

/** 20Hz tick rate in ms (for snapshot broadcast / input send). */
const NET_TICK_MS = 50;

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
  /**
   * Per-enemy render state (host only — guests render from index-pooled
   * snapshot sprites with no stable per-enemy identity, see
   * renderSnapshotEnemies). Tracks previous position/HP purely for the
   * render layer, to drive idle/walk/hit animation switching without any
   * changes to simulation or network protocol.
   */
  private enemySpriteByRef = new Map<
    World['enemies'][number],
    { spr: Phaser.GameObjects.Sprite; prevX: number; prevY: number; prevHp: number; hitUntil: number }
  >();

  private bossSprite: Phaser.GameObjects.Sprite | null = null;
  private currentBossDefId: string | null = null;

  /** Tracks the last stage we applied background textures for (1 on init). */
  private lastStage = 1;

  private metaState!: MetaState;

  // ---------------- Multiplayer state ----------------

  /** Network mode: single-player, host, or guest. */
  private netMode: 'single' | 'host' | 'guest' = 'single';
  /** Guest mode: the latest two snapshots for interpolation. */
  private guestMageSprites: Phaser.GameObjects.Sprite[] = [];
  /** Net tick accumulator for 20Hz send/broadcast. */
  private netTickAccum = 0;
  /** Snapshot tick counter. */
  private snapshotTick = 0;
  /** Guest mode: the latest two snapshots for interpolation. */
  /** Guest mode: guest's own player slot (from host's welcome). */
  private myPlayerSlot = -1; // -1 = not yet assigned by host
  private helloSent = false;
  /** Guest mode: local grimoire purchased set (sent to host for validation). */
  private guestPurchased: Set<string> = new Set();
  /** Guest mode: local SP / spSpent (mirrored from host acks). */
  /** Guest mode: player list HUD element. */
  private playerListEl: HTMLDivElement | null = null;
  /** Guest mode: host disconnected banner. */
  private hostDisconnectEl: HTMLDivElement | null = null;

  constructor() {
    super('Game');
  }

  /**
   * Phaser init — receives scene data from LobbyScene.
   */
  init(data: LobbySceneInitData): void {
    this.netMode = data.netMode ?? 'single';
    this.snapshotTick = 0;
    this.netTickAccum = 0;
    this.myPlayerSlot = -1;
    this.helloSent = false;
    this.guestPurchased = new Set();
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
    this.mage.setScale(getMageScale());
    if (this.anims.exists(MAGE_ANIM_KEY)) this.mage.play(MAGE_ANIM_KEY);

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
      if (this.world.running && !this.world.grimoireOpen) {
        // Dash is local in shared authority — no need to send to host
        tryDash(this.world);
      }
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
    this.ui.onBuySkill = (nodeId: string) => {
      // Shared authority: all skill purchases are local
      buySkill(this.world, nodeId);
    };
    this.ui.onOpenMetaGrimoire = () => this.openMetaGrimoire();

    // Load persistent meta state once at scene creation.
    this.metaState = loadMeta();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.world.W = gameSize.width;
      this.world.H = gameSize.height;
      this.grassLayer.setSize(gameSize.width, gameSize.height);
      // Re-scatter decor for the current stage on resize.
      this.updateStageBackground(this.world.stage);
      this.initFireflies();
    });

    // ---------------- Multiplayer setup ----------------

    if (this.netMode === 'host') {
      this.setupHostNetworking();
      this.startRun(); // host starts the run immediately
    } else if (this.netMode === 'guest') {
      this.setupGuestNetworking();
      this.world.isGuest = true;
      this.startRun(); // shared authority: guests run full local sim
    } else {
      // Single-player: show start overlay as before.
      this.ui.showStart();
    }
  }

  // ---------------- Multiplayer: HOST ----------------

  private setupHostNetworking(): void {
    // Initialize netPlayers array on the world
    this.world.netPlayers = [];

    // Set up message handler for guest inputs
    netManager.onMessage = (msg: ClientMsg | HostMsg, fromPeerId: string) => {
      this.handleHostMessage(msg, fromPeerId);
    };
    netManager.onPlayerConnect = (_peerId: string) => {
      // Handled when we receive their hello message
    };
    netManager.onPlayerDisconnect = (peerId: string) => {
      this.handleGuestDisconnect(peerId);
    };
    netManager.onHostDisconnect = null;

    // Re-send welcome to any guests that were already connected from the lobby.
    // Their hello was handled by the LobbyScene, but the GameScene needs to
    // create their NetPlayer. We do this by asking each connected guest to
    // re-send their hello to the new scene's message handler.
    const connectedPeerIds = netManager.getGuestIds();
    for (const peerId of connectedPeerIds) {
      // Send a placeholder welcome to trigger the guest to re-send its hello
      // to the new GameScene's message handler. you: -1 means "not yet assigned".
      const reHelloMsg: HostMsg = { t: 'welcome', you: -1, players: [] };
      netManager.sendToGuest(peerId, reHelloMsg);
    }
  }

  private handleHostMessage(msg: ClientMsg | HostMsg, fromPeerId: string): void {
    switch (msg.t) {
      case 'hello': {
        // Check if we already have a NetPlayer for this peer (prevents
        // duplicate creation from the re-hello handshake flow).
        const existing = this.world.netPlayers?.find((p) => p.peerId === fromPeerId);
        if (existing) {
          // Already registered — just re-send their welcome with their real ID.
          const players: PlayerInfo[] = [
            { id: 0, name: 'Host', isHost: true, peerId: netManager.getPeerId() },
            ...this.world.netPlayers!.map((p) => ({ id: p.id, name: p.name, isHost: false, peerId: p.peerId })),
          ];
          const welcome: HostMsg = { t: 'welcome', you: existing.id, players };
          netManager.sendToGuest(fromPeerId, welcome);
          break;
        }
        // Guest connected — create their NetPlayer entry
        const newId = (this.world.netPlayers?.length ?? 0) + 1; // host is 0
        const state = this.createNetPlayerState(newId, msg.meta);
        const np: NetPlayer = {
          id: newId,
          peerId: fromPeerId,
          name: msg.name || 'Guest ' + newId,
          input: { mvx: 0, mvy: 0, dash: false, aim: -Math.PI / 2 },
          state,
          meta: msg.meta,
        };
        // Apply any purchased skills the guest already has
        for (const nodeId of msg.purchased) {
          np.state.purchased.add(nodeId);
        }
        this.world.netPlayers?.push(np);
        // Send welcome with the guest's real player ID
        const players: PlayerInfo[] = [
          { id: 0, name: 'Host', isHost: true, peerId: netManager.getPeerId() },
          ...this.world.netPlayers!.map((p) => ({ id: p.id, name: p.name, isHost: false, peerId: p.peerId })),
        ];
        const welcome: HostMsg = { t: 'welcome', you: newId, players };
        netManager.sendToGuest(fromPeerId, welcome);
        break;
      }
      case 'playerState': {
        // Guest broadcast their player state — update our NetPlayer + relay
        const np = this.world.netPlayers?.find((p) => p.peerId === fromPeerId);
        if (np) {
          const s = np.state;
          s.x = msg.x; s.y = msg.y;
          s.vx = msg.vx; s.vy = msg.vy;
          s.hp = msg.hp; s.maxHp = msg.maxHp;
          s.level = msg.level;
          s.aimAngle = msg.aim;
          s.dashing = msg.dashing ? 1 : 0;
          s.invuln = msg.invuln ? 1 : 0;
          s.dashCd = msg.dashCd;
          s.downed = msg.downed;
          s.sp = msg.sp; s.spSpent = msg.spSpent;
          s.remoteProjectiles = msg.projectiles;
        }
        netManager.broadcastToGuests(msg); // relay to other guests
        break;
      }
      case 'enemyHit': {
        const e = this.world.enemies[msg.enemyIdx];
        if (e && !e.dead) {
          damageEnemy(this.world, e, msg.dmg, {
            burn: msg.burn, slow: msg.slow, freeze: msg.freeze,
            allowCrit: msg.crit, markedBonus: !!msg.markedBonus,
          });
          if (e.dead) {
            const killerNp = this.world.netPlayers?.find((p) => p.peerId === fromPeerId);
            const killerId = killerNp ? killerNp.id : 0;
            killEnemy(this.world, e);
            netManager.broadcastToGuests({ t: 'enemyKilled', enemyIdx: msg.enemyIdx, killerPlayerId: killerId });
          }
        }
        break;
      }
      case 'bossHit': {
        if (this.world.bossFight) {
          damageBoss(this.world, this.world.bossFight.boss, msg.dmg, {
            burn: msg.burn, slow: msg.slow,
            allowCrit: msg.crit, markedBonus: !!msg.markedBonus,
          });
        }
        break;
      }
      case 'grimoireToggle': {
        // Guest opened/closed their grimoire — pause/unpause the host's sim
        this.world.grimoireOpen = msg.open;
        // Broadcast pause/unpause to ALL guests (including the one who asked)
        const pauseMsg: HostMsg = {
          t: 'players',
          players: [{ id: -1, name: msg.open ? 'PAUSE' : 'UNPAUSE', isHost: true, peerId: '' }],
        };
        netManager.broadcastToGuests(pauseMsg);
        break;
      }
      case 'ping':
        break;
      default:
        break;
    }
  }

  private createNetPlayerState(id: number, _meta: MetaPayload): NetPlayerState {
    return {
      id,
      x: this.world.W / 2 + (id * 30),
      y: this.world.H / 2,
      hp: 100,
      maxHp: 100,
      level: 1,
      invuln: 0,
      dashing: 0,
      aimAngle: -Math.PI / 2,
      dashCd: 0,
      downed: false,
      vx: 0,
      vy: 0,
      facing: { x: 0, y: -1 },
      r: 9,
      dashCdMax: 3.4,
      phoenixCd: 0,
      undyingCd: 0,
      stillTime: 0,
      purchased: new Set<string>(),
      sp: 0,
      spSpent: 0,
      xp: 0,
      xpNext: 24,
      cd: {
        bolt: 0.3, boltCastCount: 0, fireNova: 0, iceLance: 0, frostArmor: 0,
        frostArmorActive: 0, arcaneBurst: 0, vines: 0, shadowBolt: 0,
        timeWarp: 0, overgrowth: 0, shadowBlink: 0, eternalFrost: 0, apexSurge: 0, cull: 0, magmaCore: 0,
        arcaneExplosion: 0, lightningChain: 0, blizzard: 0, earthquake: 0, sporeBurst: 0, shadowNova: 0, whirlwindStrike: 0,
      },
      wisps: [],
      decoys: [],
    };
  }

  private handleGuestDisconnect(peerId: string): void {
    if (this.world.netPlayers) {
      this.world.netPlayers = this.world.netPlayers.filter((p) => p.peerId !== peerId);
    }
    // Broadcast updated player list
    const players: PlayerInfo[] = [
      { id: 0, name: 'Host', isHost: true, peerId: netManager.getPeerId() },
      ...(this.world.netPlayers ?? []).map((p) => ({ id: p.id, name: p.name, isHost: false, peerId: p.peerId })),
    ];
    const msg: HostMsg = { t: 'players', players };
    netManager.broadcastToGuests(msg);
  }

  /** HOST: simulate net players' positions from their input (called each frame). */

  // ---------------- Multiplayer: GUEST ----------------

  private setupGuestNetworking(): void {
    netManager.onMessage = (msg: ClientMsg | HostMsg, fromPeerId: string) => {
      this.handleGuestMsg(msg, fromPeerId);
    };
    netManager.onHostDisconnect = () => {
      this.showHostDisconnected();
    };
    netManager.onPlayerConnect = null;
    netManager.onPlayerDisconnect = null;
  }

  /** Broadcast local player state to all other clients at 20Hz. */
  private broadcastPlayerState(): void {
    const p = this.world.player;
    const myId = this.netMode === 'host' ? 0 : this.myPlayerSlot;
    // Pack projectiles compactly: [x, y, r, colorAsInt, ...] (5 values per proj)
    const projData: number[] = [];
    for (const pr of this.world.projectiles) {
      const c = Phaser.Display.Color.HexStringToColor(pr.color).color;
      projData.push(Math.round(pr.x), Math.round(pr.y), pr.r, c, pr.mini ? 1 : 0);
    }
    const msg: ClientMsg = {
      t: 'playerState', id: myId,
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      hp: p.hp, maxHp: maxHP(this.world), level: this.world.level,
      aim: p.aimAngle, dashing: p.dashing > 0, invuln: p.invuln > 0,
      dashCd: p.dashCd, downed: p.hp <= 0,
      sp: this.world.sp, spSpent: this.world.spSpent,
      projectiles: projData,
    };
    if (this.netMode === 'host') {
      netManager.broadcastToGuests(msg);
    } else {
      netManager.sendToHost(msg);
    }
  }

  /** HOST: broadcast enemy/boss state to all guests at 20Hz. */
  private broadcastEnemyState(): void {
    this.snapshotTick++;
    const data = serializeEnemyState(this.world, this.snapshotTick);
    // Include player HPs so guests can update their own HP from host's authoritative damage
    const playerHps: number[] = [];
    playerHps.push(this.world.player.hp); // host is index 0
    if (this.world.netPlayers) {
      for (const np of this.world.netPlayers) {
        playerHps.push(np.state.hp);
      }
    }
    const msg: HostMsg = { t: 'enemyState', enemies: data, bossActive: 0, boss: [], playerHps };
    netManager.broadcastToGuests(msg);
  }

  /** GUEST: update local enemy render data from host's broadcast (in-place to avoid sprite pool churn). */
  private updateGuestEnemies(view: { enemies: { type: number; x: number; y: number; hp: number; maxHp: number; r: number; frozen: boolean; slowed: boolean; marked: boolean; burning: boolean }[] }): void {
    // Update existing enemy objects in-place where possible, only adding/removing as needed.
    // This preserves object identity so the sprite pool (enemySpriteByRef Map) doesn't recycle everything every frame.
    const incoming = view.enemies;
    // Update or add enemies
    for (let i = 0; i < incoming.length; i++) {
      const e = incoming[i];
      const typeName = ENEMY_TYPE_NAMES[e.type] as EnemyType;
      if (i < this.world.enemies.length) {
        // Update existing enemy in-place
        const existing = this.world.enemies[i];
        existing.type = typeName;
        existing.x = e.x; existing.y = e.y;
        existing.hp = e.hp; existing.maxHp = e.maxHp; existing.r = e.r;
        existing.frozenUntil = e.frozen ? this.world.elapsed + 2 : 0;
        existing.slowUntil = e.slowed ? this.world.elapsed + 2 : 0;
        existing.slowAmt = e.slowed ? 0.2 : 0;
        existing.marked = e.marked ? this.world.elapsed + 2 : 0;
        existing.burning = e.burning ? 1 : 0;
      } else {
        // Add new enemy
        this.world.enemies.push({
          type: typeName, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, r: e.r,
          dmg: 0, spd: 0, color: '#888', xpValue: 0, wobble: false, seed: 0,
          burning: e.burning ? 1 : 0, burnT: 0,
          frozenUntil: e.frozen ? this.world.elapsed + 2 : 0,
          slowUntil: e.slowed ? this.world.elapsed + 2 : 0,
          slowAmt: e.slowed ? 0.2 : 0,
          marked: e.marked ? this.world.elapsed + 2 : 0,
          splitChild: false,
        });
      }
    }
    // Remove excess enemies (host has fewer than we do)
    if (this.world.enemies.length > incoming.length) {
      this.world.enemies.length = incoming.length;
    }
  }

  private handleGuestMsg(msg: ClientMsg | HostMsg, _fromPeerId: string): void {
    switch (msg.t) {
      case 'welcome':
        // Always update player slot from the host's welcome message.
        this.myPlayerSlot = msg.you;
        // Re-send hello ONCE so the host's GameScene creates our NetPlayer.
        // Guard with a flag to prevent infinite welcome->hello loops.
        if (!this.helloSent) {
          this.helloSent = true;
          const meta: MetaPayload = {
            dmgMult: 1, cdMult: 1, moveMult: 1, hpMult: 1, xpMult: 1,
            critChance: 0, critDmgMult: 1, regenPerSec: 0, lifestealPct: 0,
            damageReduction: 0, dashCdMult: 1, projSpeedMult: 1, dashDistMult: 1,
          };
          const helloMsg: ClientMsg = { t: 'hello', name: 'Guest', roomCode: '', meta, purchased: Array.from(this.guestPurchased) };
          netManager.sendToHost(helloMsg);
        }
        break;
      case 'players':
        // Check for pause/unpause signal from host (special player entry with id: -1).
        if (msg.players.length === 1 && msg.players[0].id === -1) {
          const isPause = msg.players[0].name === 'PAUSE';
          this.world.grimoireOpen = isPause;
          if (isPause) {
            this.ui.setGrimoireVisible(true);
          } else {
            this.ui.setGrimoireVisible(false);
          }
        }
        break;
      case 'start':
        break;
      case 'playerState': {
        if (!this.world.netPlayers) this.world.netPlayers = [];
        let np = this.world.netPlayers.find((p) => p.id === msg.id);
        if (!np) {
          np = {
            id: msg.id, peerId: '',
            name: msg.id === 0 ? 'Host' : 'Player ' + msg.id,
            input: { mvx: 0, mvy: 0, dash: false, aim: 0 },
            state: this.createNetPlayerState(msg.id, {} as MetaPayload),
            meta: {} as MetaPayload,
          };
          this.world.netPlayers.push(np);
        }
        const s = np.state;
        s.x = msg.x; s.y = msg.y; s.vx = msg.vx; s.vy = msg.vy;
        s.hp = msg.hp; s.maxHp = msg.maxHp; s.level = msg.level;
        s.aimAngle = msg.aim; s.dashing = msg.dashing ? 1 : 0;
        s.invuln = msg.invuln ? 1 : 0; s.dashCd = msg.dashCd;
        s.downed = msg.downed; s.sp = msg.sp; s.spSpent = msg.spSpent;
        s.remoteProjectiles = msg.projectiles;
        break;
      }
      case 'enemyState': {
        const view = deserializeEnemyState(msg.enemies);
        this.world.elapsed = view.elapsed;
        this.world.stage = view.stage;
        this.updateGuestEnemies(view);
        if (view.bossActive && view.boss) {
          if (!this.world.bossFight) {
            this.world.bossFight = { boss: { defId: BOSS_DEF_NAMES[view.boss.defId] ?? 'elderWraith', name: BOSS_DEF_NAMES[view.boss.defId] ?? 'Elder Wraith', x: view.boss.x, y: view.boss.y, hp: view.boss.hp, maxHp: view.boss.maxHp, r: view.boss.r, dmg: 0, spd: 0, color: '#c15b5b', seed: 0, xpValue: 0, burning: 0, burnT: 0, slowUntil: 0, slowAmt: 0, marked: 0, phase: view.boss.phase, patternIndex: -1, activePattern: null, patternT: 0, patternData: {}, projectiles: [], telegraphs: [] } };
          }
          const b = this.world.bossFight.boss;
          b.x = view.boss.x; b.y = view.boss.y; b.hp = view.boss.hp; b.maxHp = view.boss.maxHp; b.phase = view.boss.phase;
          // Update boss projectiles for rendering
          b.projectiles = view.boss.projectiles.map((bp) => ({
            x: bp.x, y: bp.y, vx: 0, vy: 0, r: bp.r, dmg: 0, color: '#' + bp.color.toString(16).padStart(6, '0'), life: 1,
          }));
        } else {
          this.world.bossFight = null;
        }
        // Update our own HP from the host's authoritative player HPs array
        if (this.myPlayerSlot >= 0 && msg.playerHps.length > this.myPlayerSlot) {
          const hostHp = msg.playerHps[this.myPlayerSlot];
          // Only update if host says we took damage (host HP <= local HP)
          if (hostHp < this.world.player.hp) {
            this.world.player.hp = hostHp;
          }
          if (hostHp <= 0) {
            this.world.player.hp = 0;
          }
        }
        break;
      }
      case 'enemyKilled': {
        if (msg.killerPlayerId === this.myPlayerSlot) {
          gainXP(this.world, 10 + this.world.level * 2);
        }
        break;
      }
      case 'bossKilled': {
        if (msg.killerPlayerId === this.myPlayerSlot) {
          gainXP(this.world, 200 + this.world.level * 10);
        }
        break;
      }
      case 'hostLeft':
        this.showHostDisconnected();
        break;
      default:
        break;
    }
  }

  /** GUEST: start the run — set up world in a minimal render-only state. */

  private startRun(): void {
    this.ui.hideStart();
    this.ui.hideGameOver();
    this.ui.hideMetaGrimoire();
    const { width, height } = this.scale;
    this.world.purchased.clear();
    // Attach persistent meta state + reset run-only essence accumulation.
    attachMeta(this.world, this.metaState);
    (this.world as unknown as { runEssence?: number }).runEssence = 0;
    // Apply meta starting level + starting HP bonuses.
    const metaLevelBonus = metaStartLevel(this.world);
    const metaHpBonus = metaStartHP(this.world);
    const startLvl = 1 + metaLevelBonus;
    const startHp = 100 + metaHpBonus;
    // Grant skill points for meta starting levels (1 SP per level above 1).
    const startSP = metaLevelBonus;
    Object.assign(this.world, {
      running: true,
      grimoireOpen: false,
      autoAim: true,
      player: {
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        hp: startHp,
        invuln: 1,
        facing: { x: 0, y: -1 },
        aimAngle: -Math.PI / 2,
        dashCd: 0,
        dashing: 0,
        adrenaline: 0,
        undyingCd: 0,
        r: 9,
        phoenixCd: 0,
        stillTime: 0,
      },
      level: startLvl,
      xp: 0,
      xpNext: xpForLevel(startLvl),
      sp: startSP,
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
      cd: { bolt: 0.3, boltCastCount: 0, fireNova: 0, iceLance: 0, frostArmor: 0, frostArmorActive: 0, arcaneBurst: 0, vines: 0, shadowBolt: 0, timeWarp: 0, overgrowth: 0, shadowBlink: 0, eternalFrost: 0, apexSurge: 0, cull: 0, magmaCore: 0, arcaneExplosion: 0, lightningChain: 0, blizzard: 0, earthquake: 0, sporeBurst: 0, shadowNova: 0, whirlwindStrike: 0 },
      spawnTimer: 1,
      bossTimer: 130,
      bossFight: null,
      stage: 1,
      // Reset transient per-run fields so a restart starts fully clean.
      pendingBossAbilityUnlocks: [],
      pendingAbilityDisplay: null,
    });
    this.lastStage = 1; // reset stage tracking on new run
    // Clear any leftover boss sprite from a previous run so a stale boss
    // isn't rendered on top of the fresh stage-1 scene.
    if (this.bossSprite) {
      this.bossSprite.destroy();
      this.bossSprite = null;
      this.currentBossDefId = null;
    }
    this.ui.setGrimoireVisible(false);

    // In host mode, create the player list HUD
    if (this.netMode === 'host') {
      this.createPlayerListHUD();
    }
  }

  private toggleGrimoire(): void {
    if (!this.world.running) return;
    this.world.grimoireOpen = !this.world.grimoireOpen;
    this.ui.setGrimoireVisible(this.world.grimoireOpen);
    // In multiplayer, pause the game for ALL players when anyone opens the grimoire.
    if (this.netMode === 'host') {
      // Host's grimoireOpen already pauses the host's sim loop.
      // Broadcast pause/unpause to all guests.
      const pauseMsg: HostMsg = {
        t: 'players',
        players: [{ id: -1, name: this.world.grimoireOpen ? 'PAUSE' : 'UNPAUSE', isHost: true, peerId: '' }],
      };
      netManager.broadcastToGuests(pauseMsg);
    } else if (this.netMode === 'guest') {
      // Guest: tell host to pause/unpause for everyone
      netManager.sendToHost({ t: 'grimoireToggle', open: this.world.grimoireOpen });
    }
  }

  private openMetaGrimoire(): void {
    // Open the Meta Grimoire panel from the game-over screen.
    this.ui.showMetaGrimoire(this.world);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.033, deltaMs / 1000);
    this.drawFireflies(dt);

    // ---------------- ALL MODES: run local player simulation ----------------

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
      // Track enemy HP before projectiles hit, so guests can send enemyHit to host
      const hpBefore: number[] = this.netMode === 'guest' ? this.world.enemies.map((e) => e.hp) : [];
      updateProjectiles(this.world, dt);
      // GUEST: send enemyHit messages to host for each enemy damaged this frame
      if (this.netMode === 'guest') {
        for (let i = 0; i < this.world.enemies.length && i < hpBefore.length; i++) {
          if (this.world.enemies[i].hp < hpBefore[i]) {
            const dmg = hpBefore[i] - this.world.enemies[i].hp;
            netManager.sendToHost({ t: 'enemyHit', enemyIdx: i, dmg, burn: false, slow: 0, freeze: 0, crit: false, markedBonus: 0 });
          }
        }
      }
      updateDecoys(this.world, dt);
      updateEffects(this.world, dt);
      updateParticles(this.world, dt);

      // HOST and SINGLE-PLAYER: run enemy simulation
      // GUESTS: do NOT run enemies/spawns/boss — they receive enemy state from host
      if (this.netMode === 'host' || this.netMode === 'single') {
        updateEnemies(this.world, dt);
        updateSpawns(this.world, dt);
        updateBossFight(this.world, dt);

        // HOST: check enemy contact damage against net players (guests)
        if (this.netMode === 'host' && this.world.netPlayers) {
          for (const np of this.world.netPlayers) {
            if (np.state.downed || np.state.invuln > 0) continue;
            const s = np.state;
            for (const e of this.world.enemies) {
              if (e.dead) continue;
              const pr2 = (s.r + e.r) ** 2;
              if ((s.x - e.x) ** 2 + (s.y - e.y) ** 2 < pr2) {
                s.hp -= e.dmg * dt * 0.8; // slightly reduced for fairness over network
                if (s.hp <= 0) { s.hp = 0; s.downed = true; }
                break;
              }
            }
            // Boss projectile damage to guests
            if (this.world.bossFight) {
              const boss = this.world.bossFight.boss;
              for (const bp of boss.projectiles) {
                const pr2 = (s.r + bp.r) ** 2;
                if ((s.x - bp.x) ** 2 + (s.y - bp.y) ** 2 < pr2) {
                  s.hp -= bp.dmg * dt;
                  if (s.hp <= 0) { s.hp = 0; s.downed = true; }
                  break;
                }
              }
            }
          }
        }

        // Detect stage change (after a boss kill) and regenerate the background.
        if (this.world.stage !== this.lastStage) {
          this.lastStage = this.world.stage;
          this.updateStageBackground(this.world.stage);
        }

        // Show persistent ability-unlock overlay (pauses the game until dismissed).
        if (this.world.pendingAbilityDisplay) {
          this.world.grimoireOpen = true; // pause flag
          this.ui.showAbilityUnlock(this.world);
          this.world.pendingAbilityDisplay = null;
        }
      }

      // MULTIPLAYER: broadcast player state + (host) enemy state at 20Hz
      if (this.netMode !== 'single') {
        this.netTickAccum += deltaMs;
        if (this.netTickAccum >= NET_TICK_MS) {
          this.netTickAccum -= NET_TICK_MS;
          this.broadcastPlayerState();
          if (this.netMode === 'host') {
            this.broadcastEnemyState();
          }
        }
      }

      this.ui.updateHUD(this.world);
      if (this.world.grimoireOpen) this.ui.updateNodeStates(this.world);
      else this.ui.updateNodeStates(this.world);

      if (!this.world.running) {
        // damagePlayer flipped running=false this frame -> game over.
        // Bank the run's earned essence into the persistent total (death is
        // the only moment essence is persisted — closing mid-run forfeits it).
        bankRunEssence(this.world);
        this.ui.showGameOver(this.world);
      }
    }

    if (this.world.running) this.renderScene();

    // MULTIPLAYER: render other players' mages + player list HUD
    if (this.netMode !== 'single' && this.world.running) {
      this.renderNetPlayerMages();
      if (this.playerListEl) {
        const allPlayers = [
          { id: this.netMode === 'host' ? 0 : this.myPlayerSlot, name: this.netMode === 'host' ? 'Host' : 'You', x: this.world.player.x, y: this.world.player.y, hp: this.world.player.hp, maxHp: 100, level: this.world.level, downed: this.world.player.hp <= 0 },
          ...(this.world.netPlayers ?? []).map((np) => ({
            id: np.id, name: np.name, x: np.state.x, y: np.state.y, hp: np.state.hp, maxHp: np.state.maxHp, level: np.state.level, downed: np.state.downed,
          })),
        ];
        let html = '<div style="font-family:Cinzel,serif;font-size:10px;color:#c9a869;letter-spacing:1px;margin-bottom:4px;">PARTY</div>';
        allPlayers.forEach((p) => {
          const idx = p.id % PLAYER_TINT_NAMES.length;
          const tintName = PLAYER_TINT_NAMES[idx];
          const tintHex = ['#6b9eff', '#8bc48a', '#e2a040', '#b58ce0'][idx];
          const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
          const downed = p.downed ? ' <span style="color:#c15b5b;">(DOWN)</span>' : '';
          html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;"><div style="width:8px;height:8px;border-radius:50%;background:${tintHex};"></div><div style="flex:1;"><div style="font-size:10px;color:${tintHex};">P${p.id + 1} ${tintName}${downed}</div><div style="width:80px;height:4px;background:#20233a;border-radius:2px;overflow:hidden;"><div style="height:100%;width:${hpPct}%;background:${tintHex};"></div></div></div></div>`;
        });
        this.playerListEl!.innerHTML = html;
      }
    }
  }

  private showHostDisconnected(): void {
    if (!this.hostDisconnectEl) {
      this.hostDisconnectEl = document.createElement('div');
      this.hostDisconnectEl.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        z-index: 50; background: rgba(18,27,42,0.95); border: 1px solid #c15b5b;
        border-radius: 12px; padding: 32px 48px; text-align: center;
        font-family: 'Cinzel', serif; color: #c15b5b; font-size: 18px;
        letter-spacing: 2px; pointer-events: auto;
      `;
      this.hostDisconnectEl.innerHTML = `<div style="margin-bottom:16px;">HOST DISCONNECTED</div><button style="background:none;border:1px solid #c9a869;color:#c9a869;border-radius:6px;padding:8px 20px;cursor:pointer;font-family:Cinzel,serif;font-size:12px;">RETURN TO LOBBY</button>`;
      this.hostDisconnectEl.querySelector('button')!.addEventListener('click', () => {
        netManager.disconnect();
        this.scene.start('Lobby');
      });
      document.body.appendChild(this.hostDisconnectEl);
    }
    this.hostDisconnectEl.style.display = 'flex';
  }

  private createPlayerListHUD(): void {
    if (this.playerListEl) return;
    const el = document.createElement('div');
    el.style.cssText = `position: fixed; top: 60px; right: 16px; z-index: 15; background: rgba(18,27,42,0.85); border: 1px solid #333a5c; border-radius: 8px; padding: 8px 12px; min-width: 160px; pointer-events: none; font-family: 'EB Garamond', serif; font-size: 11px; color: #e9e4d8;`;
    document.body.appendChild(el);
    this.playerListEl = el;
  }

  private ensureGuestMageSprites(count: number): void {
    while (this.guestMageSprites.length < count) {
      const spr = this.add.sprite(0, 0, MAGE_TEXTURE_KEY).setDepth(6);
      spr.setScale(getMageScale());
      if (this.anims.exists(MAGE_ANIM_KEY)) spr.play(MAGE_ANIM_KEY);
      spr.setVisible(false);
      this.guestMageSprites.push(spr);
    }
  }

  private renderNetPlayerMages(): void {
    if (!this.world.netPlayers) return;
    this.ensureGuestMageSprites(this.world.netPlayers.length);
    const g = this.fxGraphics;
    const dt = 0.016; // approx frame dt for interpolation
    let spriteIdx = 0;
    this.world.netPlayers.forEach((np) => {
      // Skip self — the local player is drawn by drawPlayer(), not here.
      if (np.id === this.myPlayerSlot && this.netMode !== 'host') return;
      // On host, skip id 0 (that's the host itself).
      if (this.netMode === 'host' && np.id === 0) return;
      const spr = this.guestMageSprites[spriteIdx];
      spriteIdx++;
      const s = np.state;
      if (s.downed) { spr.setVisible(false); return; }
      // Interpolate sprite position toward target for smooth movement
      const curX = spr.x;
      const curY = spr.y;
      const lerp = Math.min(1, dt * 12); // smooth interpolation factor
      spr.setPosition(
        Math.round(curX + (s.x - curX) * lerp),
        Math.round(curY + (s.y - curY) * lerp),
      );
      spr.setVisible(true);
      spr.setDepth(6 + s.y * 0.0001);
      const tints = [0x6b9eff, 0x8bc48a, 0xe2a040, 0xb58ce0];
      spr.setTint(tints[np.id % tints.length]);
      const blink = s.invuln > 0 && Math.floor(this.world.elapsed * 16) % 2 === 0;
      spr.setAlpha(blink ? 0.4 : 1);
      spr.setFlipX(Math.cos(s.aimAngle) < 0);
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(s.x, s.y + 10, 18, 6);
      if (s.hp < s.maxHp) {
        const w = 28;
        const tintHex = ['#6b9eff', '#8bc48a', '#e2a040', '#b58ce0'][np.id % 4];
        g.fillStyle(0x1a1c2c, 1);
        g.fillRect(s.x - w / 2, s.y - 22, w, 5);
        g.fillStyle(Phaser.Display.Color.HexStringToColor(tintHex).color, 1);
        g.fillRect(s.x - w / 2, s.y - 22, w * Math.max(0, s.hp / s.maxHp), 5);
      }
      // Draw remote player's projectiles
      if (s.remoteProjectiles && s.remoteProjectiles.length > 0) {
        for (let j = 0; j < s.remoteProjectiles.length; j += 5) {
          const px = s.remoteProjectiles[j];
          const py = s.remoteProjectiles[j + 1];
          const pr = s.remoteProjectiles[j + 2];
          const pc = s.remoteProjectiles[j + 3];
          const mini = s.remoteProjectiles[j + 4] === 1;
          const colorHex = '#' + pc.toString(16).padStart(6, '0');
          this.drawProjectileGlow(g, px, py, mini ? 3 : pr, colorHex);
        }
      }
    });
    for (let i = spriteIdx; i < this.guestMageSprites.length; i++) {
      this.guestMageSprites[i].setVisible(false);
    }
  }

  // ---------------- rendering ----------------

  /**
   * Scatters trees around the play field's edges (kept clear of the center
   * where the player starts) to sell the "forest" backdrop. Deterministic
   * per viewport size so it doesn't look like it's dancing around on
   * resize. Original procedural pixel-art silhouette, densely scattered
   * with a wide size range for a layered forest-depth look.
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

    const treeCount = Math.max(24, Math.round((width * height) / 28000));
    for (let i = 0; i < treeCount; i++) {
      const x = rand() * width;
      const y = rand() * height;
      if (Math.hypot(x - cx, y - cy) < clearRadius) continue;
      const scale = 1.0 + Math.pow(rand(), 1.4) * 2.2;
      const spr = this.add.image(x, y, FOREST_TREE_KEY).setOrigin(0.5, 1).setScale(scale);
      spr.setAlpha(0.85 + rand() * 0.15);
      spr.setTint(rand() > 0.5 ? 0xffffff : 0xd8e4d0);
      // Depth-sort by y so enemies that are below (higher y) render in front,
      // and enemies above (lower y) render behind trees — same formula as enemies.
      spr.setDepth(4 + y * 0.0001);
      this.decorLayer.add(spr);
    }
  }

  /**
   * Regenerate the background (grass tile texture + scattered decor) for the
   * current stage. Stage 1 uses the original forest textures; stages 2+ use
   * the procedural stage background textures (stageBackground.ts). Called
   * when `world.stage` changes (after a boss kill).
   */
  private updateStageBackground(stage: number): void {
    const { width, height } = this.scale;

    if (stage === 1) {
      // Stage 1 uses the original forest textures + the full decor mix
      // (procedural trees + real bush/grass/flower assets — see
      // scatterForestDecor) rather than duplicating that scatter logic here.
      generateForestTextures(this);
      this.grassLayer.setTexture(FOREST_GRASS_KEY);
      this.scatterForestDecor(width, height);
      return;
    }

    const def = getStageDef(stage);
    const keys = generateStageTextures(this, def);
    this.grassLayer.setTexture(keys.tileKey);

    // Clear and re-scatter decor using the new stage's decor texture.
    this.decorLayer.removeAll(true);
    let seed = 4242 + stage * 7919;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 10000) / 10000;
    };
    const cx = width / 2;
    const cy = height / 2;
    const clearRadius = 160;
    const count = Math.max(18, Math.round((width * height) / 55000));
    for (let i = 0; i < count; i++) {
      const x = rand() * width;
      const y = rand() * height;
      if (Math.hypot(x - cx, y - cy) < clearRadius) continue;
      const scale = 1.3 + rand() * 0.9;
      const spr = this.add.image(x, y, keys.decorKey).setOrigin(0.5, 1).setScale(scale);
      spr.setAlpha(0.85 + rand() * 0.15);
      // Subtle tint variation for depth.
      spr.setTint(rand() > 0.5 ? 0xffffff : 0xd8d0c8);
      // Depth-sort by y so enemies behind/below trees render correctly.
      spr.setDepth(4 + y * 0.0001);
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
      this.drawProjectileGlow(g, pr.x, pr.y, pr.mini ? 3 : pr.r, pr.color);
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

  /** Maps enemy type + render state to a real-asset animation key, where one exists. */
  private enemyAnimFor(type: EnemyType, state: 'idle' | 'move' | 'hit'): string | null {
    if (type === 'slime') return state === 'hit' ? SLIME_ANIM.hit : state === 'move' ? SLIME_ANIM.move : SLIME_ANIM.idle;
    if (type === 'skel') return state === 'hit' ? SKEL_ANIM.hit : state === 'move' ? SKEL_ANIM.walk : SKEL_ANIM.idle;
    return null; // no real-asset animations for this type — procedural texture stays static
  }

  /** Plays the given render-state's animation on an enemy sprite, if a real-asset animation exists for its type. */
  private playEnemyAnim(spr: Phaser.GameObjects.Sprite, type: EnemyType, state: 'idle' | 'move' | 'hit'): void {
    const key = this.enemyAnimFor(type, state);
    if (key && this.anims.exists(key)) spr.play(key, true);
  }

  /**
   * Flips the sprite to face the (local) player horizontally — skeleton art
   * faces right by default, so it's flipped when the player is to its left.
   * Only applies to types whose real-asset art has a "facing" concept
   * (currently just skeleton — slimes are symmetric blobs).
   */
  private applyEnemyFacing(spr: Phaser.GameObjects.Sprite, type: EnemyType, enemyX: number): void {
    if (type !== 'skel') return;
    spr.setFlipX(this.world.player.x < enemyX);
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
      let info = this.enemySpriteByRef.get(e);
      if (!info) {
        let spr = this.enemySpritePool.find((s) => !s.visible);
        if (!spr) {
          spr = this.add.sprite(0, 0, ENEMY_TEXTURE_KEYS[e.type]).setDepth(4.5);
          this.enemySpritePool.push(spr);
        }
        spr.setTexture(ENEMY_TEXTURE_KEYS[e.type]);
        info = { spr, prevX: e.x, prevY: e.y, prevHp: e.hp, hitUntil: 0 };
        this.enemySpriteByRef.set(e, info);
      }
      const spr = info.spr;
      // Native art is sized to roughly match each type's collision radius;
      // scale so the sprite's visual footprint tracks e.r (base r values in
      // ETYPES were the tuning reference for each native texture's size).
      spr.setScale(enemyVisualScale(e.type, e.r));
      spr.setPosition(Math.round(e.x), Math.round(e.y));
      spr.setVisible(true);
      spr.setDepth(4.5 + e.y * 0.0001);

      // Idle/walk/hit animation switching (real-asset types only — see
      // playEnemyAnim). Purely render-layer: infers movement/damage from
      // frame-to-frame deltas, no simulation or network protocol changes.
      if (e.hp < info.prevHp) info.hitUntil = world.elapsed + 0.3;
      const moved = Math.hypot(e.x - info.prevX, e.y - info.prevY) > 0.4;
      this.playEnemyAnim(spr, e.type, info.hitUntil > world.elapsed ? 'hit' : moved ? 'move' : 'idle');
      info.prevX = e.x;
      info.prevY = e.y;
      info.prevHp = e.hp;

      // Skeletons always face the player (real-asset art only — see
      // enemyFacesFlipX). Other real-asset/procedural types are unaffected.
      this.applyEnemyFacing(spr, e.type, e.x);

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
    this.enemySpriteByRef.forEach((info, ref) => {
      if (!seen.has(ref)) {
        info.spr.setVisible(false);
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

  /**
   * Draws a projectile with a soft glow: an oversized low-alpha halo, a
   * mid-alpha ring, the solid-color core, and a bright near-white highlight
   * on top — same layered-circle technique already used for boss
   * projectiles (see renderBossFight), just with an extra outer halo layer
   * for a more pronounced "light" look. Shared by both the host's
   * renderScene() and the guest's renderSnapshotScene() so projectiles look
   * identical either way.
   */
  private drawProjectileGlow(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, colorHex: string): void {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    g.fillStyle(color, 0.18);
    g.fillCircle(x, y, r * 2.6);
    g.fillStyle(color, 0.35);
    g.fillCircle(x, y, r * 1.6);
    g.fillStyle(color, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(x, y, r * 0.4);
  }

  private drawPlayer(): void {
    const p = this.world.player;
    this.mage.setPosition(Math.round(p.x), Math.round(p.y));
    const blink = p.invuln > 0 && Math.floor(this.world.elapsed * 16) % 2 === 0;
    this.mage.setAlpha(blink ? 0.4 : 1);
    // Flip the sprite horizontally to face the mouse-aim direction (staff
    // visually points toward wherever bolts/ice lance/shadow bolt will fire).
    this.mage.setFlipX(Math.cos(p.aimAngle) < 0);

    // Tint the player mage based on slot in multiplayer
    if (this.netMode !== 'single') {
      this.mage.setTint(PLAYER_TINTS[this.myPlayerSlot % PLAYER_TINTS.length]);
    } else {
      this.mage.clearTint();
    }

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

  shutdown(): void {
    // Clean up DOM elements created for multiplayer
    if (this.playerListEl) {
      this.playerListEl.remove();
      this.playerListEl = null;
    }
    if (this.hostDisconnectEl) {
      this.hostDisconnectEl.remove();
      this.hostDisconnectEl = null;
    }
    // Disconnect networking if we're leaving the game scene
    if (this.netMode !== 'single') {
      netManager.disconnect();
    }
  }
}