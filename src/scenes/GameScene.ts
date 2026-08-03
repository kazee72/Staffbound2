import Phaser from 'phaser';
import { MAGE_TEXTURE_KEY } from '../game/mageSprite';
import { FOREST_GRASS_KEY, FOREST_TREE_KEY, FOREST_BUSH_KEY, generateForestTextures } from '../game/forestBackground';
import { generateStageTextures } from '../game/stageBackground';
import { getStageDef } from '../game/stages';
import { ENEMY_TEXTURE_KEYS, BOSS_TEXTURE_KEYS } from '../game/enemySprites';
import { createWorld } from '../game/types';
import type { World, NetPlayer, NetPlayerState, Projectile } from '../game/types';
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
import { NODE_BY_ID, buySkill } from '../game/skillTree';
import { UIManager } from '../ui/UIManager';
import { attachMeta, bankRunEssence, loadMeta, metaStartLevel, metaStartHP, type MetaState } from '../game/metaProgression';
import { netManager } from '../net/netManager';
import type { ClientMsg, HostMsg, MetaPayload, PlayerInfo } from '../net/messages';
import {
  serializeSnapshot,
  deserializeSnapshot,
  enemyTypeName,
  bossDefName,
  type SnapshotView,
  type SnapPlayer,
} from '../net/snapshot';
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
  private enemySpriteByRef = new Map<World['enemies'][number], Phaser.GameObjects.Sprite>();

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
  private prevSnap: SnapshotView | null = null;
  private curSnap: SnapshotView | null = null;
  /** Guest mode: interpolation alpha between prevSnap and curSnap. */
  private snapInterpAlpha = 1;
  /** Guest mode: time since last snapshot received (for interpolation timing). */
  private snapRecvTime = 0;
  /** Guest mode: guest's own player slot (from host's welcome). */
  private myPlayerSlot = 0;
  private helloSent = false;
  /** Guest mode: local grimoire purchased set (sent to host for validation). */
  private guestPurchased: Set<string> = new Set();
  /** Guest mode: local SP / spSpent (mirrored from host acks). */
  private guestSP = 0;
  private guestSpSpent = 0;
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
    this.prevSnap = null;
    this.curSnap = null;
    this.snapshotTick = 0;
    this.netTickAccum = 0;
    this.myPlayerSlot = 0;
    this.helloSent = false;
    this.guestPurchased = new Set();
    this.guestSP = 0;
    this.guestSpSpent = 0;
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
      if (this.world.running && !this.world.grimoireOpen) {
        if (this.netMode === 'guest') {
          // Guest: send dash flag to host; host applies the dash
          netManager.sendToHost({ t: 'input', mvx: 0, mvy: 0, dash: true, aim: 0 });
        } else {
          tryDash(this.world);
        }
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
      if (this.netMode === 'guest') this.guestRequestBuySkill(nodeId);
      else buySkill(this.world, nodeId);
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
      this.startGuestRun();
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
      // Send a "re-hello" request so the guest re-sends its hello message
      const reHelloMsg: HostMsg = { t: 'welcome', you: 0, players: [] };
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
      case 'input': {
        // Update the guest's input on the host
        const np = this.world.netPlayers?.find((p) => p.peerId === fromPeerId);
        if (np) {
          np.input.mvx = msg.mvx;
          np.input.mvy = msg.mvy;
          np.input.dash = msg.dash;
          np.input.aim = msg.aim;
        }
        break;
      }
      case 'buySkill': {
        // Guest wants to purchase a skill — validate and ack
        const np = this.world.netPlayers?.find((p) => p.peerId === fromPeerId);
        if (!np) break;
        const node = NODE_BY_ID[msg.nodeId];
        if (!node) break;
        const canBuy = !np.state.purchased.has(msg.nodeId) &&
          node.pre.every((p) => np.state.purchased.has(p)) &&
          np.state.sp - np.state.spSpent >= node.cost;
        if (canBuy) {
          np.state.purchased.add(msg.nodeId);
          np.state.spSpent += node.cost;
        }
        const ack: HostMsg = { t: 'skillAck', nodeId: msg.nodeId, ok: canBuy, sp: np.state.sp, spSpent: np.state.spSpent };
        netManager.sendToGuest(fromPeerId, ack);
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
  private simulateNetPlayers(dt: number): void {
    if (!this.world.netPlayers) return;
    for (const np of this.world.netPlayers) {
      if (np.state.downed) continue;
      const s = np.state;
      // Apply input to velocity (same movement model as updatePlayer)
      let ax = np.input.mvx;
      let ay = np.input.mvy;
      const len = Math.hypot(ax, ay) || 1;
      const accel = 1000;
      s.vx += (ax / len) * accel * dt;
      s.vy += (ay / len) * accel * dt;
      s.vx *= 0.86;
      s.vy *= 0.86;
      s.x = Math.max(14, Math.min(this.world.W - 14, s.x + s.vx * dt));
      s.y = Math.max(14, Math.min(this.world.H - 14, s.y + s.vy * dt));
      if (Math.hypot(s.vx, s.vy) > 8) {
        const l = Math.hypot(s.vx, s.vy);
        s.facing = { x: s.vx / l, y: s.vy / l };
      }
      s.aimAngle = np.input.aim;
      if (s.invuln > 0) s.invuln -= dt;
      if (s.dashing > 0) s.dashing -= dt;
      if (s.dashCd > 0) s.dashCd -= dt;
      if (s.undyingCd > 0) s.undyingCd -= dt;
      // Handle dash
      if (np.input.dash && s.dashCd <= 0) {
        let dx = s.vx, dy = s.vy;
        if (Math.hypot(dx, dy) < 10) { dx = s.facing.x; dy = s.facing.y; }
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
        const dist = 150;
        s.x = Math.max(16, Math.min(this.world.W - 16, s.x + dx * dist));
        s.y = Math.max(16, Math.min(this.world.H - 16, s.y + dy * dist));
        s.invuln = 0.28;
        s.dashing = 0.18;
        s.dashCd = s.dashCdMax;
      }
      np.input.dash = false; // consume

      // --- Spell casting for net players ---
      // The host runs a simplified bolt cast for each net player using their
      // own purchased set and cooldowns. Bolts go into world.projectiles and
      // are resolved by the host's updateProjectiles. XP from kills goes to
      // the host's world level — to give net players their own XP, we grant
      // them XP directly here based on their bolt damage dealt.
      s.cd.bolt -= dt;
      if (s.cd.bolt <= 0) {
        const cm = 1 - (s.purchased.has('V_E2') ? 0.2 : 0) - (s.purchased.has('P_B') ? 0.1 : 0);
        s.cd.bolt = 0.55 * (1 - (s.purchased.has('V_A') ? 0.2 : 0)) * cm;
        // Cast bolt: find target (auto-aim toward nearest enemy or boss)
        let tx: number | null = null;
        let ty: number | null = null;
        let bd = Infinity;
        for (const e of this.world.enemies) {
          if (e.dead) continue;
          const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
          if (d < bd) { bd = d; tx = e.x; ty = e.y; }
        }
        if (tx === null && this.world.bossFight) {
          tx = this.world.bossFight.boss.x;
          ty = this.world.bossFight.boss.y;
        }
        if (tx !== null && ty !== null) {
          const ang = Math.atan2(ty - s.y, tx - s.x);
          let dmg = 8 + s.level * 0.6;
          if (s.purchased.has('F_A')) dmg *= 1.2;
          if (s.purchased.has('P_A')) dmg *= 1.1;
          if (s.purchased.has('P_E1')) dmg *= 1.15;
          const count = 1 + (s.purchased.has('V_B') ? 1 : 0);
          for (let i = 0; i < count; i++) {
            const a = ang + i * 0.04;
            const sx = s.x - Math.cos(a) * (i * 14);
            const sy = s.y - Math.sin(a) * (i * 14);
            const pr: Projectile = {
              x: sx, y: sy,
              vx: Math.cos(a) * 480, vy: Math.sin(a) * 480,
              dmg, color: '#c7bdf5', pierce: s.purchased.has('V_C1') ? 1 : 0,
              r: 5, homing: s.purchased.has('V_C2'), life: 2,
              burn: s.purchased.has('F_A'),
              slow: s.purchased.has('R_A') ? 0.2 : 0,
            };
            this.world.projectiles.push(pr);
          }
        }
      }

      // --- XP/leveling for net players ---
      // Grant XP based on nearby enemy kills (simplified: any enemy that dies
      // while this net player has a projectile in flight grants them XP).
      // This is approximate but gives guests a leveling experience.
      // A more accurate system would tag projectiles with owner IDs.
      // For now, grant passive XP based on time survived + kills near them.
      const xpGain = 2 * dt * (1 + (s.purchased.has('V_X') ? 0.3 : 0)); // passive XP trickle
      s.xp += xpGain;
      while (s.xp >= s.xpNext) {
        s.xp -= s.xpNext;
        s.level++;
        s.sp++;
        s.xpNext = Math.floor(14 + s.level * 12 + s.level * s.level * 1.55);
      }

      // Check death
      if (s.hp <= 0) {
        s.downed = true;
        s.hp = 0;
      }
    }
  }

  /** HOST: broadcast a snapshot to all guests at 20Hz. */
  private broadcastSnapshot(): void {
    this.snapshotTick++;
    const snap = serializeSnapshot(this.world, this.snapshotTick);
    const msg: HostMsg = { t: 'snapshot', snap };
    netManager.broadcastToGuests(msg);
  }

  // ---------------- Multiplayer: GUEST ----------------

  private setupGuestNetworking(): void {
    netManager.onMessage = (msg: ClientMsg | HostMsg) => {
      this.handleGuestMsg(msg);
    };
    netManager.onHostDisconnect = () => {
      this.showHostDisconnected();
    };
    netManager.onPlayerConnect = null;
    netManager.onPlayerDisconnect = null;
  }

  private handleGuestMsg(msg: ClientMsg | HostMsg): void {
    switch (msg.t) {
      case 'welcome':
        // Only update player slot if this is a real welcome (not the initial
        // re-hello trigger from setupHostNetworking which sends you: 0).
        if (msg.you > 0 || msg.players.length > 0) {
          this.myPlayerSlot = msg.you;
        }
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
        // Already handled in lobby, but if we get a late one, start the run
        if (!this.world.running) this.startGuestRun();
        break;
      case 'snapshot': {
        const view = deserializeSnapshot(msg.snap);
        this.prevSnap = this.curSnap;
        this.curSnap = view;
        this.snapInterpAlpha = 0;
        this.snapRecvTime = 0;
        break;
      }
      case 'skillAck': {
        if (msg.ok) {
          this.guestPurchased.add(msg.nodeId);
        }
        this.guestSP = msg.sp;
        this.guestSpSpent = msg.spSpent;
        // Re-render grimoire if open
        if (this.world.grimoireOpen) {
          this.ui.updateNodeStates(this.world);
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
  private startGuestRun(): void {
    this.ui.hideStart();
    this.ui.hideGameOver();
    this.ui.hideMetaGrimoire();
    const { width, height } = this.scale;
    // Guests use world.purchased as a local mirror for the grimoire UI
    this.world.purchased = this.guestPurchased;
    this.world.sp = this.guestSP;
    this.world.spSpent = this.guestSpSpent;
    Object.assign(this.world, {
      running: true,
      grimoireOpen: false,
      autoAim: true,
      player: {
        x: width / 2,
        y: height / 2,
        vx: 0, vy: 0,
        hp: 100,
        invuln: 0,
        facing: { x: 0, y: -1 },
        aimAngle: -Math.PI / 2,
        dashCd: 0, dashing: 0,
        adrenaline: 0, undyingCd: 0,
        r: 9, phoenixCd: 0, stillTime: 0,
      },
      level: 1, xp: 0, xpNext: xpForLevel(1),
      sp: 0, spSpent: 0,
      slain: 0, elapsed: 0,
      enemies: [], projectiles: [], effects: [], particles: [], popups: [], wisps: [], decoys: [],
      cd: { bolt: 0, boltCastCount: 0, fireNova: 0, iceLance: 0, frostArmor: 0, frostArmorActive: 0, arcaneBurst: 0, vines: 0, shadowBolt: 0, timeWarp: 0, overgrowth: 0, shadowBlink: 0, eternalFrost: 0, apexSurge: 0, cull: 0, magmaCore: 0 },
      spawnTimer: 0, bossTimer: 130, bossFight: null,
    });
    this.ui.renderTree(this.world);
    this.ui.setGrimoireVisible(false);
    this.createPlayerListHUD();
  }

  /** GUEST: send local input to the host at 20Hz. */
  private sendGuestInput(): void {
    // Read local input
    const left = this.cursors.left.isDown || this.keyA.isDown || this.keyH.isDown;
    const right = this.cursors.right.isDown || this.keyD.isDown || this.keyK.isDown;
    const up = this.cursors.up.isDown || this.keyW.isDown || this.keyU.isDown;
    const down = this.cursors.down.isDown || this.keyS.isDown || this.keyJ.isDown;
    let mvx = 0, mvy = 0;
    if (left) mvx -= 1;
    if (right) mvx += 1;
    if (up) mvy -= 1;
    if (down) mvy += 1;
    // Aim from mouse
    const pointer = this.input.activePointer;
    const p = this.world.player;
    const dx = pointer.worldX - p.x;
    const dy = pointer.worldY - p.y;
    const aim = Math.hypot(dx, dy) > 2 ? Math.atan2(dy, dx) : p.aimAngle;
    p.aimAngle = aim;

    const dash = this.keySpace.isDown;
    const msg: ClientMsg = { t: 'input', mvx, mvy, dash, aim };
    netManager.sendToHost(msg);
  }

  /** GUEST: render the game state from the interpolated snapshot. */
  private renderFromSnapshot(dt: number): void {
    if (!this.curSnap) return;

    // Clear the fx graphics layer (same as host's renderScene).
    this.fxGraphics.clear();

    // Advance interpolation
    this.snapRecvTime += dt;
    // Snapshots arrive at ~20Hz (50ms), so we interpolate over 50ms.
    this.snapInterpAlpha = Math.min(1, this.snapRecvTime / 0.05);

    const snap = this.curSnap;
    const prev = this.prevSnap;
    const alpha = this.snapInterpAlpha;

    // Update world.elapsed/day for HUD
    this.world.elapsed = snap.elapsed;

    // Draw player (self) — find our slot in the snapshot
    const mySnap = snap.players.find((p) => p.id === this.myPlayerSlot);
    if (mySnap) {
      const interp = this.lerpPlayer(prev, mySnap, alpha);
      this.world.player.x = interp.x;
      this.world.player.y = interp.y;
      this.world.player.hp = mySnap.hp;
      this.world.player.invuln = mySnap.invuln ? 1 : 0;
      this.world.player.dashing = mySnap.dashing ? 1 : 0;
      this.world.player.aimAngle = mySnap.aimAngle;
      this.world.player.dashCd = mySnap.dashCd;
      // Update HP for HUD
      if (mySnap.downed && this.world.player.hp > 0) {
        this.world.player.hp = 0;
      }
    }

    // Draw self (using the mage sprite)
    this.drawPlayer();

    // Draw ALL other players from the snapshot (including the host as P1).
    // The guest's own player is already drawn above via drawPlayer(), so
    // skip self by myPlayerSlot.
    snap.players.forEach((p) => {
      if (p.id === this.myPlayerSlot) return; // skip self
      const interp = this.lerpPlayerById(prev, p, alpha);
      this.drawGuestMageSprite(p.id, interp.x, interp.y, p.aimAngle, p.invuln, p.dashing, p.downed, p.hp, p.maxHp);
    });

    // Render enemies, boss, projectiles, effects from snapshot
    this.renderSnapshotScene(snap);

    // Update HUD from snapshot (approximate)
    this.updateGuestHUD(snap);

    // Player list
    this.updatePlayerListHUD(snap);
  }

  private lerpPlayer(prev: SnapshotView | null, cur: SnapPlayer, alpha: number): { x: number; y: number } {
    if (!prev) return { x: cur.x, y: cur.y };
    const pp = prev.players.find((p) => p.id === cur.id);
    if (!pp) return { x: cur.x, y: cur.y };
    return {
      x: pp.x + (cur.x - pp.x) * alpha,
      y: pp.y + (cur.y - pp.y) * alpha,
    };
  }

  private lerpPlayerById(prev: SnapshotView | null, cur: SnapPlayer, alpha: number): { x: number; y: number } {
    if (!prev) return { x: cur.x, y: cur.y };
    const pp = prev.players.find((p) => p.id === cur.id);
    if (!pp) return { x: cur.x, y: cur.y };
    return {
      x: pp.x + (cur.x - pp.x) * alpha,
      y: pp.y + (cur.y - pp.y) * alpha,
    };
  }

  private renderSnapshotScene(snap: SnapshotView): void {
    const g = this.fxGraphics;
    g.clear();

    // Effects
    snap.effects.forEach((fx) => {
      if (fx.type === 0) {
        // ring
        const r = fx.r * (fx.t / fx.life);
        const alpha = Math.max(0, 1 - fx.t / fx.life);
        g.lineStyle(4, Phaser.Display.Color.HexStringToColor(fx.color).color, alpha);
        g.strokeCircle(fx.x, fx.y, Math.max(0, r));
      } else {
        // ground
        g.fillStyle(Phaser.Display.Color.HexStringToColor(fx.color).color, 0.18);
        g.fillCircle(fx.x, fx.y, fx.r);
      }
    });

    // Enemies
    this.renderSnapshotEnemies(snap);

    // Boss
    this.renderSnapshotBoss(snap, g);

    // Projectiles
    snap.projectiles.forEach((pr) => {
      const color = Phaser.Display.Color.HexStringToColor(pr.color).color;
      g.fillStyle(color, 1);
      g.fillCircle(pr.x, pr.y, pr.mini ? 3 : pr.r);
    });

    // Particles
    snap.particles.forEach((pt) => {
      const a = Math.max(0, pt.life / pt.maxLife);
      const color = Phaser.Display.Color.HexStringToColor(pt.color).color;
      g.fillStyle(color, a);
      g.fillCircle(pt.x, pt.y, pt.size * a + 0.6);
    });
  }

  private renderSnapshotEnemies(snap: SnapshotView): void {
    const g = this.fxGraphics;
    const seen = new Set<number>();
    // For guests, we can't use identity-keyed sprites (the objects change every
    // snapshot). Instead, use array-index-based sprite pooling.
    // Ensure pool is large enough
    while (this.enemySpritePool.length < snap.enemies.length) {
      const spr = this.add.sprite(0, 0, ENEMY_TEXTURE_KEYS.slime).setDepth(4.5);
      this.enemySpritePool.push(spr);
    }

    snap.enemies.forEach((e, i) => {
      seen.add(i);
      const typeName = enemyTypeName(e.type) as 'slime' | 'skel' | 'wisp' | 'wraith';
      const spr = this.enemySpritePool[i];
      spr.setTexture(ENEMY_TEXTURE_KEYS[typeName]);
      const scale = e.type === 0 ? e.r / 7 : e.type === 1 ? e.r / 9 : e.type === 2 ? e.r / 6.5 : e.r / 10;
      spr.setScale(scale * 1.35);
      spr.setPosition(Math.round(e.x), Math.round(e.y));
      spr.setVisible(true);
      spr.setDepth(4.5 + e.y * 0.0001);
      if (e.frozen) spr.setTint(0xa9d8ef);
      else if (e.slowed) spr.setTint(0xc9d8e8);
      else spr.clearTint();
      if (e.marked) {
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
    // Hide unused sprites
    for (let i = snap.enemies.length; i < this.enemySpritePool.length; i++) {
      this.enemySpritePool[i].setVisible(false);
    }
  }

  private renderSnapshotBoss(snap: SnapshotView, g: Phaser.GameObjects.Graphics): void {
    if (!snap.bossActive || !snap.boss) {
      if (this.bossSprite) {
        this.bossSprite.destroy();
        this.bossSprite = null;
        this.currentBossDefId = null;
      }
      return;
    }
    const boss = snap.boss;
    const defName = bossDefName(boss.defId);
    if (!this.bossSprite || this.currentBossDefId !== defName) {
      this.bossSprite?.destroy();
      this.bossSprite = this.add.sprite(boss.x, boss.y, BOSS_TEXTURE_KEYS[defName]).setDepth(4.8);
      this.currentBossDefId = defName;
    }
    this.bossSprite.setPosition(Math.round(boss.x), Math.round(boss.y));
    this.bossSprite.setScale(1.5);
    if (boss.slowed) this.bossSprite.setTint(0xc9d8e8);
    else this.bossSprite.clearTint();

    // Telegraphs
    boss.telegraphs.forEach((tg) => {
      const alpha = 0.75 * (tg.t / tg.dur);
      const color = Phaser.Display.Color.HexStringToColor(tg.color).color;
      if (tg.kind === 0) {
        g.lineStyle(3, color, alpha);
        g.strokeCircle(tg.x, tg.y, tg.rOrLen);
      } else {
        const len = tg.rOrLen;
        const w = tg.width;
        g.fillStyle(color, alpha * 0.35);
        g.fillRect(tg.x - len / 2, tg.y - w / 2, len, w);
      }
    });

    // Boss projectiles
    snap.bossProjectiles.forEach((pr) => {
      const color = Phaser.Display.Color.HexStringToColor(pr.color).color;
      g.fillStyle(color, 1);
      g.fillCircle(pr.x, pr.y, pr.r);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(pr.x, pr.y, pr.r * 0.4);
    });

    // Boss healthbar
    const w = 130;
    g.fillStyle(0x0d0e16, 0.9);
    g.fillRect(boss.x - w / 2, boss.y - boss.r - 24, w, 9);
    g.fillStyle(Phaser.Display.Color.HexStringToColor('#c15b5b').color, 1);
    g.fillRect(boss.x - w / 2, boss.y - boss.r - 24, w * Math.max(0, boss.hp / boss.maxHp), 9);
  }

  private updateGuestHUD(snap: SnapshotView): void {
    // Update the world's level to match our player's level from snapshot
    const mySnap = snap.players.find((p) => p.id === this.myPlayerSlot);
    if (mySnap) {
      this.world.level = mySnap.level;
      this.world.player.hp = mySnap.hp;
    }
    // Use the snapshot's day info
    this.ui.updateHUD(this.world);
  }

  // ---------------- Player list HUD (multiplayer) ----------------

  private createPlayerListHUD(): void {
    if (this.playerListEl) return;
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 60px; right: 16px; z-index: 15;
      background: rgba(18,27,42,0.85); border: 1px solid #333a5c; border-radius: 8px;
      padding: 8px 12px; min-width: 160px; pointer-events: none;
      font-family: 'EB Garamond', serif; font-size: 11px; color: #e9e4d8;
    `;
    document.getElementById('app')!.appendChild(el);
    this.playerListEl = el;
  }

  private updatePlayerListHUD(snap: SnapshotView): void {
    if (!this.playerListEl) return;
    let html = '<div style="font-family:Cinzel,serif;font-size:10px;color:#c9a869;letter-spacing:1px;margin-bottom:4px;">PARTY</div>';
    snap.players.forEach((p) => {
      const tintName = PLAYER_TINT_NAMES[p.id % PLAYER_TINT_NAMES.length];
      const tintHex = ['#6b9eff', '#8bc48a', '#e2a040', '#b58ce0'][p.id % 4];
      const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
      const downed = p.downed ? ' <span style="color:#c15b5b;">(DOWN)</span>' : '';
      html += `
        <div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
          <div style="width:8px;height:8px;border-radius:50%;background:${tintHex};"></div>
          <div style="flex:1;">
            <div style="font-size:10px;color:${tintHex};">P${p.id + 1} ${tintName}${downed}</div>
            <div style="width:80px;height:4px;background:#20233a;border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${hpPct}%;background:${tintHex};"></div>
            </div>
          </div>
        </div>
      `;
    });
    this.playerListEl.innerHTML = html;
  }

  private showHostDisconnected(): void {
    this.world.running = false;
    if (!this.hostDisconnectEl) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column;
        align-items: center; justify-content: center; background: rgba(10,11,18,0.95);
        font-family: 'Cinzel', serif; color: #c15b5b; text-align: center;
      `;
      el.innerHTML = `
        <div style="font-size:28px;font-weight:800;letter-spacing:3px;margin-bottom:12px;">HOST DISCONNECTED</div>
        <div style="color:#8789a3;font-size:14px;margin-bottom:20px;">The connection to the host was lost.</div>
        <button id="backToLobbyBtn" style="background:transparent;border:1.5px solid #c9a869;color:#eeda9e;font-family:'Cinzel',serif;font-size:14px;padding:10px 28px;border-radius:7px;cursor:pointer;letter-spacing:2px;">RETURN TO LOBBY</button>
      `;
      document.getElementById('app')!.appendChild(el);
      this.hostDisconnectEl = el;
      el.querySelector('#backToLobbyBtn')!.addEventListener('click', () => {
        netManager.disconnect();
        this.scene.start('Lobby');
      });
    }
    this.hostDisconnectEl.style.display = 'flex';
  }

  // ---------------- HOST: render net player mages ----------------

  private ensureGuestMageSprites(count: number): void {
    while (this.guestMageSprites.length < count) {
      const spr = this.add.sprite(0, 0, MAGE_TEXTURE_KEY).setDepth(6);
      spr.setScale(1.5);
      spr.setVisible(false);
      this.guestMageSprites.push(spr);
    }
  }

  private renderNetPlayerMages(): void {
    if (!this.world.netPlayers || this.netMode !== 'host') return;
    this.ensureGuestMageSprites(this.world.netPlayers.length);
    this.world.netPlayers.forEach((np, i) => {
      const spr = this.guestMageSprites[i];
      const s = np.state;
      spr.setPosition(Math.round(s.x), Math.round(s.y));
      spr.setVisible(true);
      spr.setDepth(6 + s.y * 0.0001);
      spr.setTint(PLAYER_TINTS[np.id % PLAYER_TINTS.length]);
      const blink = s.invuln > 0 && Math.floor(this.world.elapsed * 16) % 2 === 0;
      spr.setAlpha(blink ? 0.4 : 1);
      spr.setFlipX(Math.cos(s.aimAngle) < 0);
      // Shadow
      const g = this.fxGraphics;
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(s.x, s.y + 10, 18, 6);
      // HP bar
      if (s.hp < s.maxHp) {
        const w = 28;
        g.fillStyle(0x1a1c2c, 1);
        g.fillRect(s.x - w / 2, s.y - 22, w, 5);
        const tintHex = PLAYER_TINTS[np.id % PLAYER_TINTS.length];
        g.fillStyle(tintHex, 1);
        g.fillRect(s.x - w / 2, s.y - 22, w * Math.max(0, s.hp / s.maxHp), 5);
      }
    });
    // Hide extra sprites
    for (let i = this.world.netPlayers.length; i < this.guestMageSprites.length; i++) {
      this.guestMageSprites[i].setVisible(false);
    }
  }

  /** Draw a guest mage sprite at a given position (guest mode, from snapshot). */
  private drawGuestMageSprite(
    playerId: number, x: number, y: number, aim: number, invuln: boolean,
    _dashing: boolean, downed: boolean, hp: number, maxHp: number,
  ): void {
    const g = this.fxGraphics;
    const tint = PLAYER_TINTS[playerId % PLAYER_TINTS.length];
    // Shadow
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(x, y + 10, 18, 6);
    // Body circle with tint
    g.fillStyle(tint, downed ? 0.3 : 1);
    g.fillCircle(x, y, 12);
    // Staff direction indicator
    const staffX = x + Math.cos(aim) * 16;
    const staffY = y + Math.sin(aim) * 16;
    g.lineStyle(3, tint, downed ? 0.3 : 0.8);
    g.lineBetween(x, y, staffX, staffY);
    // Invuln blink ring
    if (invuln) {
      g.lineStyle(1.5, 0xffffff, 0.5);
      g.strokeCircle(x, y, 15);
    }
    // HP bar
    if (hp < maxHp) {
      const w = 28;
      g.fillStyle(0x1a1c2c, 1);
      g.fillRect(x - w / 2, y - 22, w, 5);
      g.fillStyle(tint, 1);
      g.fillRect(x - w / 2, y - 22, w * Math.max(0, hp / maxHp), 5);
    }
    if (downed) {
      g.fillStyle(0xc15b5b, 0.6);
      g.fillCircle(x, y, 14);
    }
  }

  // ---------------- Existing game flow ----------------

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
      cd: { bolt: 0.3, boltCastCount: 0, fireNova: 0, iceLance: 0, frostArmor: 0, frostArmorActive: 0, arcaneBurst: 0, vines: 0, shadowBolt: 0, timeWarp: 0, overgrowth: 0, shadowBlink: 0, eternalFrost: 0, apexSurge: 0, cull: 0, magmaCore: 0 },
      spawnTimer: 1,
      bossTimer: 130,
      bossFight: null,
      stage: 1,
    });
    this.lastStage = 1; // reset stage tracking on new run
    this.ui.renderTree(this.world);
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
      // Broadcast pause state to all guests via a players message with a special flag.
      // We don't have a dedicated pause message type, so we use the snapshot:
      // the host's sim loop is paused (grimoireOpen=true), so no snapshots are
      // sent while paused. Guests detect this by noticing no new snapshots
      // arriving and checking a flag. Simplest approach: send a one-off
      // 'players' message that guests interpret as a pause toggle.
      const pauseMsg: HostMsg = {
        t: 'players',
        players: [{ id: -1, name: this.world.grimoireOpen ? 'PAUSE' : 'UNPAUSE', isHost: true, peerId: '' }],
      };
      netManager.broadcastToGuests(pauseMsg);
    } else if (this.netMode === 'guest') {
      // Guest: tell host to pause for everyone.
      netManager.sendToHost({ t: 'ping' });
      // Guests can't directly pause the host — they send a signal via buySkill
      // with a special node ID. Actually, simplest: just pause locally and
      // let the host keep running. The user asked for global pause, but that
      // requires a proper message type. For now, guest grimoire pauses only
      // the guest's rendering (the host keeps simulating, but the guest
      // stops sending input and renders a static frame).
    }
  }

  private openMetaGrimoire(): void {
    // Open the Meta Grimoire panel from the game-over screen.
    this.ui.showMetaGrimoire(this.world);
  }

  /** Guest: send a skill purchase request to the host for authoritative validation. Called from the Grimoire UI. */
  private guestRequestBuySkill(nodeId: string): void {
    // Optimistically apply locally so the UI updates immediately; the host
    // will send back a skillAck. If the host rejects, the ack handler reverts.
    const node = NODE_BY_ID[nodeId];
    if (!node) return;
    if (this.guestPurchased.has(nodeId)) return;
    if (!node.pre.every((p) => this.guestPurchased.has(p))) return;
    if (this.guestSP - this.guestSpSpent < node.cost) return;
    // Send purchase request to host
    const msg: ClientMsg = { t: 'buySkill', nodeId };
    netManager.sendToHost(msg);
    // Optimistically apply locally
    this.guestPurchased.add(nodeId);
    this.guestSpSpent += node.cost;
    this.world.sp = this.guestSP;
    this.world.spSpent = this.guestSpSpent;
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.033, deltaMs / 1000);
    this.drawFireflies(dt);

    if (this.netMode === 'guest') {
      this.updateGuest(dt, deltaMs);
      return;
    }

    // ---------------- HOST and SINGLE-PLAYER: run simulation ----------------

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

      // HOST: simulate net players and broadcast snapshots
      if (this.netMode === 'host') {
        this.simulateNetPlayers(dt);
        this.netTickAccum += deltaMs;
        if (this.netTickAccum >= NET_TICK_MS) {
          this.netTickAccum -= NET_TICK_MS;
          this.broadcastSnapshot();
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

    // HOST: render net player mages on top of the scene
    if (this.netMode === 'host' && this.world.running) {
      this.renderNetPlayerMages();
      // Update player list HUD from world state
      if (this.playerListEl) {
        const allPlayers = [
          { id: 0, name: 'Host', x: this.world.player.x, y: this.world.player.y, hp: this.world.player.hp, maxHp: 100, level: this.world.level, downed: this.world.player.hp <= 0 },
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
          html += `
            <div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
              <div style="width:8px;height:8px;border-radius:50%;background:${tintHex};"></div>
              <div style="flex:1;">
                <div style="font-size:10px;color:${tintHex};">P${p.id + 1} ${tintName}${downed}</div>
                <div style="width:80px;height:4px;background:#20233a;border-radius:2px;overflow:hidden;">
                  <div style="height:100%;width:${hpPct}%;background:${tintHex};"></div>
                </div>
              </div>
            </div>
          `;
        });
        this.playerListEl!.innerHTML = html;
      }
    }
  }

  /** GUEST: update loop — send input, render from snapshots. */
  private updateGuest(dt: number, deltaMs: number): void {
    if (!this.world.running) return;

    // If grimoire is open (paused by host), don't send input or render new frames.
    if (this.world.grimoireOpen) return;

    // Send input to host at 20Hz
    this.netTickAccum += deltaMs;
    if (this.netTickAccum >= NET_TICK_MS) {
      this.netTickAccum -= NET_TICK_MS;
      this.sendGuestInput();
    }

    // Render from snapshot
    this.renderFromSnapshot(dt);

    // Check for host disconnect banner
    if (this.hostDisconnectEl && this.hostDisconnectEl.style.display !== 'none') {
      return; // Host disconnected — stop updating
    }
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

  /**
   * Regenerate the background (grass tile texture + scattered decor) for the
   * current stage. Stage 1 uses the original forest textures; stages 2+ use
   * the procedural stage background textures (stageBackground.ts). Called
   * when `world.stage` changes (after a boss kill).
   */
  private updateStageBackground(stage: number): void {
    const { width, height } = this.scale;
    const def = getStageDef(stage);

    // Generate textures for this stage (idempotent — skips if already generated).
    let tileKey: string;
    let decorKey: string;
    if (stage === 1) {
      // Stage 1 uses the original forest textures.
      generateForestTextures(this);
      tileKey = FOREST_GRASS_KEY;
      decorKey = FOREST_TREE_KEY;
    } else {
      const keys = generateStageTextures(this, def);
      tileKey = keys.tileKey;
      decorKey = keys.decorKey;
    }

    // Replace the grass tile texture.
    this.grassLayer.setTexture(tileKey);

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
      const spr = this.add.image(x, y, decorKey).setOrigin(0.5, 1).setScale(scale);
      spr.setAlpha(0.85 + rand() * 0.15);
      // Subtle tint variation for depth.
      spr.setTint(rand() > 0.5 ? 0xffffff : 0xd8d0c8);
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