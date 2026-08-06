/**
 * NetManager — a thin singleton wrapper around PeerJS that manages the two
 * multiplayer roles (HOST and GUEST) for STAFFBOUND2.
 *
 * The PeerServer (signaling) runs alongside Vite on port 9000 (see
 * vite.config.ts). All gameplay data flows peer-to-peer over WebRTC data
 * channels once the handshake is done.
 *
 * HOST:
 *   - Creates a Peer whose ID is the generated room code.
 *   - Listens for incoming `connection` events from guests.
 *   - Maintains a list of active DataConnections (one per guest).
 *   - Broadcasts HostMsg to all guests via broadcastToGuests().
 *
 * GUEST:
 *   - Creates a Peer with a random ID.
 *   - Connects to the host's peer ID (the room code).
 *   - Sends ClientMsg to the host via sendToHost().
 *
 * Message types are defined in messages.ts (ClientMsg / HostMsg).
 */
import { Peer, type DataConnection } from 'peerjs';
import type { ClientMsg, HostMsg, MetaPayload } from './messages';

/** Connection-state callback types. */
export type MessageHandler = (msg: HostMsg | ClientMsg, fromPeerId: string) => void;
export type PlayerConnectHandler = (peerId: string) => void;
export type PlayerDisconnectHandler = (peerId: string) => void;
export type HostDisconnectHandler = () => void;
export type OpenHandler = (peerId: string) => void;
export type ErrorHandler = (err: unknown) => void;

/** Default PeerServer endpoint — same origin, port 9000, path '/'. */
function peerServerConfig(): { host: string; port: number; path: string; key: string } {
  // Guests connecting from another machine use the host's LAN IP.
  // When running on the same machine (localhost), use window.location.hostname.
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  // If accessing via the dev server's port, the peer server is on 9000.
  // If hostname is empty (file://), default to localhost.
  return {
    host: host || 'localhost',
    port: 9000,
    path: '/',
    key: 'staffbound2',
  };
}

export class NetManager {
  /** The underlying PeerJS Peer instance. */
  private peer: Peer | null = null;
  /** Role: true = HOST, false = GUEST. */
  isHost = false;
  /** Active guest connections (HOST mode only). Keyed by guest peer ID. */
  private guestConns = new Map<string, DataConnection>();
  /** The host connection (GUEST mode only). */
  private hostConn: DataConnection | null = null;
  /** This peer's ID (= room code for host, random for guest). */
  private peerId = '';
  /** Whether the peer is connected to the signaling server. */
  private connected = false;

  // Callbacks — set by the consumer (lobby / game scene).
  onMessage: MessageHandler | null = null;
  onPlayerConnect: PlayerConnectHandler | null = null;
  onPlayerDisconnect: PlayerDisconnectHandler | null = null;
  onHostDisconnect: HostDisconnectHandler | null = null;
  onOpen: OpenHandler | null = null;
  onError: ErrorHandler | null = null;

  /**
   * HOST: create a Peer with the room code as its ID and listen for guests.
   * @param roomCode  The 4-letter room code to use as the peer ID.
   */
  hostGame(roomCode: string): Promise<string> {
    this.teardown();
    this.isHost = true;
    return new Promise<string>((resolve, reject) => {
      const cfg = peerServerConfig();
      this.peer = new Peer(roomCode, {
        host: cfg.host,
        port: cfg.port,
        path: cfg.path,
        key: cfg.key,
        debug: 1,
        config: {
          iceServers: [
            // LAN-only: STUN not strictly needed but harmless; no TURN.
            { urls: 'stun:stun.l.google.com:19302' },
          ],
        },
      });

      const openTimeout = setTimeout(() => {
        reject(new Error('PeerServer connection timed out (host)'));
      }, 10000);

      this.peer.on('open', (id: string) => {
        clearTimeout(openTimeout);
        this.peerId = id;
        this.connected = true;
        if (this.onOpen) this.onOpen(id);
        resolve(id);
      });

      this.peer.on('connection', (conn: DataConnection) => {
        // A guest is connecting — wire up data handlers once the data channel opens.
        conn.on('open', () => {
          this.guestConns.set(conn.peer, conn);
          if (this.onPlayerConnect) this.onPlayerConnect(conn.peer);
        });

        conn.on('data', (data: unknown) => {
          if (this.onMessage) this.onMessage(data as ClientMsg, conn.peer);
        });

        conn.on('close', () => {
          this.guestConns.delete(conn.peer);
          if (this.onPlayerDisconnect) this.onPlayerDisconnect(conn.peer);
        });

        conn.on('error', (err: unknown) => {
          console.warn('[NetManager] guest connection error:', err);
          this.guestConns.delete(conn.peer);
          if (this.onPlayerDisconnect) this.onPlayerDisconnect(conn.peer);
        });
      });

      this.peer.on('error', (err: unknown) => {
        clearTimeout(openTimeout);
        console.error('[NetManager] host peer error:', err);
        if (this.onError) this.onError(err);
        // Don't reject if already resolved (open succeeded then later error).
        if (!this.connected) reject(err);
      });

      this.peer.on('disconnected', () => {
        // Signaling connection lost — try to reconnect.
        const peer = this.peer;
        if (peer && !peer.destroyed) {
          try { peer.reconnect(); } catch { /* ignore */ }
        }
      });
    });
  }

  /**
   * GUEST: create a Peer with a random ID and connect to the host's room code.
   * @param roomCode  The host's peer ID (= room code).
   * @param hello     The initial hello message to send once connected.
   */
  joinGame(roomCode: string, hello: { name: string; meta: MetaPayload; purchased: string[] }): Promise<void> {
    this.teardown();
    this.isHost = false;
    return new Promise<void>((resolve, reject) => {
      const cfg = peerServerConfig();
      // Random guest ID — must be alphanumeric-safe.
      const guestId = 'g_' + Math.random().toString(36).slice(2, 10);
      this.peer = new Peer(guestId, {
        host: cfg.host,
        port: cfg.port,
        path: cfg.path,
        key: cfg.key,
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ],
        },
      });

      const openTimeout = setTimeout(() => {
        reject(new Error('PeerServer connection timed out (guest)'));
      }, 10000);

      this.peer.on('open', (id: string) => {
        clearTimeout(openTimeout);
        this.peerId = id;
        this.connected = true;
        if (this.onOpen) this.onOpen(id);

        // Now connect to the host.
        const conn = this.peer!.connect(roomCode, { reliable: true, serialization: 'default' });
        this.hostConn = conn;

        const connTimeout = setTimeout(() => {
          reject(new Error('Connection to host timed out'));
        }, 10000);

        conn.on('open', () => {
          clearTimeout(connTimeout);
          // Send the hello message immediately.
          const helloMsg: ClientMsg = { t: 'hello', name: hello.name, roomCode, meta: hello.meta, purchased: hello.purchased };
          conn.send(helloMsg);
          resolve();
        });

        conn.on('data', (data: unknown) => {
          if (this.onMessage) this.onMessage(data as HostMsg, roomCode);
        });

        conn.on('close', () => {
          // Host disconnected.
          this.hostConn = null;
          if (this.onHostDisconnect) this.onHostDisconnect();
        });

        conn.on('error', (err: unknown) => {
          clearTimeout(connTimeout);
          console.warn('[NetManager] host connection error:', err);
          this.hostConn = null;
          if (this.onHostDisconnect) this.onHostDisconnect();
        });
      });

      this.peer.on('error', (err: unknown) => {
        clearTimeout(openTimeout);
        console.error('[NetManager] guest peer error:', err);
        if (this.onError) this.onError(err);
        if (!this.connected) reject(err);
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
          try { this.peer.reconnect(); } catch { /* ignore */ }
        }
      });
    });
  }

  /** GUEST: send a message to the host. */
  sendToHost(msg: ClientMsg): void {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  /** HOST: broadcast a message to all connected guests. */
  broadcastToGuests(msg: HostMsg | ClientMsg): void {
    this.guestConns.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }

  /** HOST: send a message to a specific guest by peer ID. */
  sendToGuest(peerId: string, msg: HostMsg): void {
    const conn = this.guestConns.get(peerId);
    if (conn && conn.open) conn.send(msg);
  }

  /** Get this peer's ID. */
  getPeerId(): string {
    return this.peerId;
  }

  /** Whether the peer is connected to the signaling server. */
  isConnected(): boolean {
    return this.connected;
  }

  /** Get the list of connected guest peer IDs (HOST mode). */
  getGuestIds(): string[] {
    return Array.from(this.guestConns.keys());
  }

  /** Number of connected guests (HOST mode). */
  getGuestCount(): number {
    return this.guestConns.size;
  }

  /** Cleanly disconnect and tear down all connections. */
  disconnect(): void {
    this.teardown();
  }

  /** Internal teardown — close all connections and destroy the peer. */
  private teardown(): void {
    this.guestConns.forEach((conn) => {
      try { conn.close(); } catch { /* ignore */ }
    });
    this.guestConns.clear();
    if (this.hostConn) {
      try { this.hostConn.close(); } catch { /* ignore */ }
      this.hostConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* ignore */ }
      this.peer = null;
    }
    this.connected = false;
    this.peerId = '';
    this.isHost = false;
  }
}

/** Singleton instance. */
export const netManager = new NetManager();

/** Generate a 4-letter uppercase room code. */
export function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O (avoid confusion)
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}