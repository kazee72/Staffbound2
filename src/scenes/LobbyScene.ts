/**
 * LobbyScene — the multiplayer lobby / mode-selection screen.
 *
 * A Phaser scene with a DOM overlay (matching the dark medieval fantasy
 * visual style of UIManager) that offers three choices:
 *
 *   PLAY SOLO   → skips networking, goes straight to GameScene (single-player)
 *   HOST GAME   → creates a Peer with a generated room code, shows the code
 *                 + LAN IP hint, a connected players list, and a START button
 *   JOIN GAME   → text input for room code, CONNECT button, waits for host start
 *
 * On START (host) or "start" message (guest), transitions to GameScene with the
 * multiplayer role + player count passed as scene data.
 */
import Phaser from 'phaser';
import { netManager, generateRoomCode } from '../net/netManager';
import type { ClientMsg, HostMsg, MetaPayload, PlayerInfo } from '../net/messages';
import { loadMeta } from '../game/metaProgression';

export interface LobbySceneInitData {
  netMode: 'single' | 'host' | 'guest';
  playerCount: number;
  seed?: number;
}

export class LobbyScene extends Phaser.Scene {
  private root!: HTMLDivElement;

  // Menu elements
  private menuOverlay!: HTMLDivElement;

  // Host elements
  private hostOverlay!: HTMLDivElement;
  private roomCodeEl!: HTMLDivElement;
  private lanHintEl!: HTMLDivElement;
  private hostPlayersList!: HTMLDivElement;
  private startGameBtn!: HTMLButtonElement;

  // Join elements
  private joinOverlay!: HTMLDivElement;
  private roomCodeInput!: HTMLInputElement;
  private connectBtn!: HTMLButtonElement;
  private joinStatusEl!: HTMLDivElement;

  private roomCode = '';
  private connectedPlayers: PlayerInfo[] = [];
  private gameSeed = 0;

  constructor() {
    super('Lobby');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#14121e');

    // Starfield / firefly backdrop using Phaser graphics
    this.drawBackdrop(width, height);

    // Create DOM overlay root
    const parentEl = document.getElementById('app')!;
    this.root = document.createElement('div');
    this.root.id = 'lobby-root';
    this.root.style.cssText = `
      position: fixed; inset: 0; z-index: 50;
      font-family: 'EB Garamond', serif; color: #e9e4d8;
      pointer-events: none; overflow: hidden;
    `;
    parentEl.appendChild(this.root);

    this.buildMenu();
    this.buildHostView();
    this.buildJoinView();

    // Show menu initially
    this.showMenu();

    // Cleanup on shutdown
    this.events.on('shutdown', () => this.destroyDom());
    this.events.on('destroy', () => this.destroyDom());
  }

  private drawBackdrop(width: number, height: number): void {
    const g = this.add.graphics().setDepth(0);
    // Subtle dark gradient — already set by background color; add some particles
    const fireflies: { x: number; y: number; vy: number; sway: number; r: number }[] = [];
    for (let i = 0; i < 40; i++) {
      fireflies.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: -(6 + Math.random() * 10),
        sway: Math.random() * Math.PI * 2,
        r: 1 + Math.random() * 1.8,
      });
    }
    this.time.addEvent({
      delay: 33,
      loop: true,
      callback: () => {
        const dt = 0.033;
        g.clear();
        fireflies.forEach((f) => {
          f.y += f.vy * dt;
          f.sway += 0.02;
          const x = f.x + Math.sin(f.sway) * 14;
          const alpha = 0.25 + 0.2 * Math.sin(this.time.now / 500 + f.sway);
          g.fillStyle(Math.random() < 0.5 ? 0xc9a869 : 0x8ec9e8, Math.max(0, alpha));
          g.fillCircle(x, f.y, f.r);
          if (f.y < -10) {
            f.y = height + 10;
            f.x = Math.random() * width;
          }
        });
      },
    });
  }

  // ---------------- DOM construction ----------------

  private buildMenu(): void {
    this.menuOverlay = this.makeOverlay();
    this.menuOverlay.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:clamp(28px,5vw,52px);font-weight:800;letter-spacing:4px;color:#eeda9e;text-shadow:0 0 24px rgba(238,218,158,0.4);margin:0 0 6px;">STAFFBOUND2</div>
      <div style="color:#8789a3;font-size:15px;font-style:italic;margin-bottom:30px;">a long road, an old grimoire, and whatever still lurks in the dark</div>
      <div style="display:flex;flex-direction:column;gap:14px;align-items:center;">
        <button class="lobby-btn" id="btnSolo" style="pointer-events:auto;">
          <span class="lobby-icon">⚔</span> PLAY SOLO
        </button>
        <button class="lobby-btn" id="btnHost" style="pointer-events:auto;">
          <span class="lobby-icon">🏰</span> HOST GAME
        </button>
        <button class="lobby-btn" id="btnJoin" style="pointer-events:auto;">
          <span class="lobby-icon">🤝</span> JOIN GAME
        </button>
      </div>
    `;
    this.injectLobbyButtonStyle();
    this.root.appendChild(this.menuOverlay);

    this.menuOverlay.querySelector('#btnSolo')!.addEventListener('click', () => this.startSolo());
    this.menuOverlay.querySelector('#btnHost')!.addEventListener('click', () => this.showHost());
    this.menuOverlay.querySelector('#btnJoin')!.addEventListener('click', () => this.showJoin());
  }

  private buildHostView(): void {
    this.hostOverlay = this.makeOverlay();
    this.hostOverlay.style.display = 'none';
    this.hostOverlay.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:22px;font-weight:700;letter-spacing:3px;color:#c9a869;margin:0 0 16px;">HOSTING GAME</div>
      <div style="color:#8789a3;font-size:12px;margin-bottom:8px;">Room Code — share with your party</div>
      <div id="roomCodeEl" style="font-family:'Cinzel',serif;font-size:48px;font-weight:800;letter-spacing:12px;color:#eeda9e;text-shadow:0 0 20px rgba(238,218,158,0.5);background:#181b2a;border:2px solid #c9a869;border-radius:12px;padding:16px 40px;margin-bottom:12px;">----</div>
      <div id="lanHintEl" style="color:#8789a3;font-size:11px;margin-bottom:20px;max-width:400px;text-align:center;line-height:1.5;"></div>
      <div style="color:#8789a3;font-size:12px;margin-bottom:6px;">Connected Players</div>
      <div id="hostPlayersList" style="background:#12141f;border:1px solid #333a5c;border-radius:8px;padding:10px 16px;min-width:200px;max-width:300px;margin-bottom:24px;">
        <div style="color:#c9a869;font-size:12px;">Host (you) — waiting...</div>
      </div>
      <button class="lobby-btn" id="startGameBtn" style="pointer-events:auto;">
        <span class="lobby-icon">▶</span> START GAME
      </button>
      <button class="lobby-btn-text" id="hostCancelBtn" style="pointer-events:auto;margin-top:12px;">← Back to menu</button>
    `;
    this.root.appendChild(this.hostOverlay);

    this.roomCodeEl = this.hostOverlay.querySelector('#roomCodeEl')!;
    this.lanHintEl = this.hostOverlay.querySelector('#lanHintEl')!;
    this.hostPlayersList = this.hostOverlay.querySelector('#hostPlayersList')!;
    this.startGameBtn = this.hostOverlay.querySelector('#startGameBtn')!;
    this.startGameBtn.addEventListener('click', () => this.startMultiplayerGame('host'));
    this.hostOverlay.querySelector('#hostCancelBtn')!.addEventListener('click', () => {
      netManager.disconnect();
      this.showMenu();
    });
  }

  private buildJoinView(): void {
    this.joinOverlay = this.makeOverlay();
    this.joinOverlay.style.display = 'none';
    this.joinOverlay.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:22px;font-weight:700;letter-spacing:3px;color:#c9a869;margin:0 0 16px;">JOIN GAME</div>
      <div style="color:#8789a3;font-size:12px;margin-bottom:8px;">Enter the room code from your host</div>
      <input id="roomCodeInput" type="text" maxlength="20" placeholder="ABCD"
        style="pointer-events:auto;font-family:'Cinzel',serif;font-size:28px;font-weight:700;letter-spacing:6px;text-align:center;text-transform:uppercase;
        background:#12141f;border:2px solid #333a5c;border-radius:8px;color:#eeda9e;padding:10px 20px;width:220px;margin-bottom:16px;outline:none;" />
      <div style="display:flex;gap:10px;">
        <button class="lobby-btn" id="connectBtn" style="pointer-events:auto;">
          <span class="lobby-icon">🔗</span> CONNECT
        </button>
        <button class="lobby-btn-text" id="joinCancelBtn" style="pointer-events:auto;">← Back</button>
      </div>
      <div id="joinStatusEl" style="color:#8789a3;font-size:13px;margin-top:16px;min-height:20px;"></div>
    `;
    this.root.appendChild(this.joinOverlay);

    this.roomCodeInput = this.joinOverlay.querySelector('#roomCodeInput')!;
    this.connectBtn = this.joinOverlay.querySelector('#connectBtn')!;
    this.joinStatusEl = this.joinOverlay.querySelector('#joinStatusEl')!;
    this.connectBtn.addEventListener('click', () => this.attemptJoin());
    this.roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.attemptJoin();
    });
    this.joinOverlay.querySelector('#joinCancelBtn')!.addEventListener('click', () => {
      netManager.disconnect();
      this.showMenu();
    });
  }

  // ---------------- view switching ----------------

  private showMenu(): void {
    
    this.menuOverlay.style.display = 'flex';
    this.hostOverlay.style.display = 'none';
    this.joinOverlay.style.display = 'none';
  }

  private showHost(): void {
    
    this.menuOverlay.style.display = 'none';
    this.hostOverlay.style.display = 'flex';
    this.joinOverlay.style.display = 'none';

    this.roomCode = generateRoomCode();
    this.roomCodeEl.textContent = this.roomCode;
    this.lanHintEl.innerHTML = this.getLanHint();
    this.startGameBtn.disabled = true;
    this.startGameBtn.style.opacity = '0.5';
    this.connectedPlayers = [{ id: 0, name: 'Host (you)', isHost: true, peerId: this.roomCode }];
    this.updateHostPlayersList();

    // Set up NetManager callbacks for host
    netManager.onMessage = (msg, fromPeerId) => this.handleHostMessage(msg as ClientMsg, fromPeerId);
    netManager.onPlayerConnect = (peerId) => this.handleGuestConnect(peerId);
    netManager.onPlayerDisconnect = (peerId) => this.handleGuestDisconnect(peerId);
    netManager.onHostDisconnect = null; // host doesn't need this
    netManager.onError = (err) => {
      console.error('[Lobby] host error:', err);
      this.roomCodeEl.textContent = 'ERROR';
      this.lanHintEl.textContent = 'Failed to start hosting. Check that the PeerServer is running on port 9000.';
    };

    // Start hosting
    netManager.hostGame(this.roomCode).then((id) => {
      console.log('[Lobby] hosting as', id);
      // Host can always start solo too (enabled immediately)
      this.startGameBtn.disabled = false;
      this.startGameBtn.style.opacity = '1';
    }).catch((err) => {
      console.error('[Lobby] hostGame failed:', err);
      this.roomCodeEl.textContent = 'FAIL';
      this.lanHintEl.textContent = 'Could not connect to signaling server. Make sure the dev server is running (npm run dev).';
    });
  }

  private showJoin(): void {
    
    this.menuOverlay.style.display = 'none';
    this.hostOverlay.style.display = 'none';
    this.joinOverlay.style.display = 'flex';
    this.roomCodeInput.value = '';
    this.joinStatusEl.textContent = '';
    this.roomCodeInput.focus();
  }

  // ---------------- host logic ----------------

  private handleHostMessage(msg: ClientMsg, fromPeerId: string): void {
    switch (msg.t) {
      case 'hello': {
        // A guest has connected and sent their hello with name + meta + purchased.
        // Assign them a player ID.
        const newId = this.connectedPlayers.length;
        const playerInfo: PlayerInfo = {
          id: newId,
          name: msg.name || 'Guest ' + newId,
          isHost: false,
          peerId: fromPeerId,
        };
        this.connectedPlayers.push(playerInfo);
        this.updateHostPlayersList();

        // Send welcome message back to this guest
        const welcome: HostMsg = { t: 'welcome', you: newId, players: this.connectedPlayers };
        netManager.sendToGuest(fromPeerId, welcome);

        // Broadcast updated player list to all guests
        const playerListMsg: HostMsg = { t: 'players', players: this.connectedPlayers };
        netManager.broadcastToGuests(playerListMsg);
        break;
      }
      case 'ping':
        // ignore
        break;
      default:
        // Other messages (input, buySkill) are handled by GameScene, not the lobby.
        break;
    }
  }

  private handleGuestConnect(peerId: string): void {
    // Player list update happens when we receive their hello.
    console.log('[Lobby] guest connected:', peerId);
  }

  private handleGuestDisconnect(peerId: string): void {
    console.log('[Lobby] guest disconnected:', peerId);
    this.connectedPlayers = this.connectedPlayers.filter((p) => p.peerId !== peerId);
    this.updateHostPlayersList();
    // Reassign IDs and broadcast
    const playerListMsg: HostMsg = { t: 'players', players: this.connectedPlayers };
    netManager.broadcastToGuests(playerListMsg);
  }

  private updateHostPlayersList(): void {
    const items = this.connectedPlayers.map((p) => {
      const color = p.isHost ? '#c9a869' : '#8ec9e8';
      const icon = p.isHost ? '🏰' : '🤝';
      return `<div style="color:${color};font-size:12px;padding:3px 0;">${icon} ${p.name}</div>`;
    }).join('');
    this.hostPlayersList.innerHTML = items;
  }

  // ---------------- join logic ----------------

  private attemptJoin(): void {
    const code = this.roomCodeInput.value.trim().toUpperCase();
    if (!code) {
      this.joinStatusEl.textContent = 'Enter a room code.';
      this.joinStatusEl.style.color = '#c15b5b';
      return;
    }
    this.connectBtn.disabled = true;
    this.joinStatusEl.textContent = 'Connecting...';
    this.joinStatusEl.style.color = '#8789a3';

    // Gather meta + purchased to send in hello
    const meta = this.buildMetaPayload();
    const purchased: string[] = []; // start with no purchases

    netManager.onMessage = (msg) => this.handleGuestMessage(msg as HostMsg);
    netManager.onHostDisconnect = () => {
      this.joinStatusEl.textContent = 'Host disconnected.';
      this.joinStatusEl.style.color = '#c15b5b';
      this.connectBtn.disabled = false;
    };
    netManager.onError = (err) => {
      console.error('[Lobby] join error:', err);
      this.joinStatusEl.textContent = 'Connection failed. Check the room code and that the host is running.';
      this.joinStatusEl.style.color = '#c15b5b';
      this.connectBtn.disabled = false;
    };

    netManager.joinGame(code, { name: 'Guest', meta, purchased }).then(() => {
      this.joinStatusEl.textContent = 'Connected! Waiting for host to start...';
      this.joinStatusEl.style.color = '#8ec9e8';
    }).catch((err) => {
      console.error('[Lobby] joinGame failed:', err);
      this.joinStatusEl.textContent = 'Could not connect. Check the room code.';
      this.joinStatusEl.style.color = '#c15b5b';
      this.connectBtn.disabled = false;
    });
  }

  private handleGuestMessage(msg: HostMsg): void {
    switch (msg.t) {
      case 'welcome':
        
        this.connectedPlayers = msg.players;
        this.joinStatusEl.textContent = `Connected as Player ${msg.you}. Waiting for host to start...`;
        break;
      case 'players':
        this.connectedPlayers = msg.players;
        break;
      case 'start':
        this.gameSeed = msg.seed;
        this.startMultiplayerGame('guest');
        break;
      case 'hostLeft':
        this.joinStatusEl.textContent = 'Host left the game.';
        this.joinStatusEl.style.color = '#c15b5b';
        break;
      default:
        // Other messages (snapshot, skillAck) handled by GameScene.
        break;
    }
  }

  // ---------------- start game ----------------

  private startSolo(): void {
    const data: LobbySceneInitData = { netMode: 'single', playerCount: 1 };
    this.scene.start('Game', data);
  }

  private startMultiplayerGame(mode: 'host' | 'guest'): void {
    if (mode === 'host') {
      // Generate a seed and broadcast start to all guests
      this.gameSeed = Math.floor(Math.random() * 2147483647);
      const startMsg: HostMsg = { t: 'start', seed: this.gameSeed };
      netManager.broadcastToGuests(startMsg);

      const data: LobbySceneInitData = {
        netMode: 'host',
        playerCount: this.connectedPlayers.length,
        seed: this.gameSeed,
      };
      this.scene.start('Game', data);
    } else {
      const data: LobbySceneInitData = {
        netMode: 'guest',
        playerCount: this.connectedPlayers.length || 1,
        seed: this.gameSeed,
      };
      this.scene.start('Game', data);
    }
  }

  // ---------------- helpers ----------------

  private makeOverlay(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'overlay';
    div.style.cssText = `
      position: absolute; inset: 0; z-index: 20;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(10,11,18,0.92); text-align: center; padding: 26px;
      pointer-events: none;
    `;
    return div;
  }

  private injectLobbyButtonStyle(): void {
    if (document.getElementById('lobby-btn-style')) return;
    const style = document.createElement('style');
    style.id = 'lobby-btn-style';
    style.textContent = `
      .lobby-btn {
        pointer-events: auto;
        background: transparent;
        border: 1.5px solid #c9a869;
        color: #eeda9e;
        font-family: 'Cinzel', serif;
        font-size: 16px; font-weight: 700;
        padding: 12px 36px; border-radius: 8px; cursor: pointer;
        letter-spacing: 2px; display: inline-flex; align-items: center; gap: 8px;
        transition: all 0.15s;
      }
      .lobby-btn:hover:not(:disabled) {
        background: #c9a869; color: #1a1508;
        box-shadow: 0 0 26px rgba(201,168,105,0.55);
      }
      .lobby-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .lobby-icon { font-size: 20px; }
      .lobby-btn-text {
        pointer-events: auto;
        background: none; border: none; color: #8789a3;
        font-family: 'Cinzel', serif; font-size: 13px; cursor: pointer;
        padding: 6px 12px; letter-spacing: 1px;
      }
      .lobby-btn-text:hover { color: #e9e4d8; }
      #lobby-root h1, #lobby-root h2, #lobby-root h3 { font-family: 'Cinzel', serif; }
    `;
    document.head.appendChild(style);
  }

  private getLanHint(): string {
    // Try to detect LAN IP from window.location
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `Guests on the same network can join at <b style="color:#c9a869;">${hostname}:5173</b> with room code above.`;
    }
    return `Hosting on localhost. For LAN guests, check your machine's IP address (e.g. <b style="color:#c9a869;">192.168.x.x:5173</b>) and share it with room code above.`;
  }

  private buildMetaPayload(): MetaPayload {
    const meta = loadMeta();
    const ranks = meta.ranks;
    const dmgMult = 1 + (ranks.dmg || 0) * 0.05;
    const cdMult = 1 - (ranks.cd || 0) * 0.04;
    const moveMult = 1 + (ranks.move || 0) * 0.04;
    const hpMult = 1 + (ranks.hp || 0) * 0.05;
    const xpMult = 1 + (ranks.xp || 0) * 0.06;
    const critChance = (ranks.crit || 0) * 0.03;
    const critDmgMult = 1.5 + (ranks.critdmg || 0) * 0.15;
    const regenPerSec = (ranks.regen || 0) * 0.4;
    const lifestealPct = (ranks.lifesteal || 0) * 0.02;
    const damageReduction = (ranks.dr || 0) * 0.03;
    const dashCdMult = 1 - (ranks.dash || 0) * 0.06;
    const projSpeedMult = 1 + (ranks.projspeed || 0) * 0.08;
    const dashDistMult = 1 + (ranks.dashdist || 0) * 0.10;
    return {
      dmgMult, cdMult, moveMult, hpMult, xpMult, critChance, critDmgMult,
      regenPerSec, lifestealPct, damageReduction, dashCdMult, projSpeedMult, dashDistMult,
    };
  }

  private destroyDom(): void {
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
  }
}