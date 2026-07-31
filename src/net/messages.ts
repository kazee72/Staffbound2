/**
 * P2P message types for the HOLLOWMERE multiplayer protocol.
 *
 * Messages flow in two directions:
 * - Client → Host: input state (20Hz), skill-tree purchases, meta-state at connection, dashing
 * - Host → Clients: world-state snapshots (20Hz), lobby info, game-start, acks, disconnect
 *
 * All messages carry a `t` discriminator so the receiver can switch on it.
 * Messages are JSON-serializable (typed arrays in snapshots are plain arrays).
 *
 * Host-authoritative model:
 *   Clients send their input; the Host runs the full World simulation and
 *   broadcasts compact snapshots. Clients render snapshots with interpolation.
 *   Each player's skill tree (Grimoire) is per-player — clients send skill
 *   purchases to the host, host acknowledges. Meta progression stays client-side
 *   (localStorage); the client tells the host its meta multipliers at
 *   connection time so the host can factor them into derived stats.
 */

// ---------------- discriminant union ----------------

export type ClientMsg =
  | { t: 'hello'; name: string; roomCode: string; meta: MetaPayload; purchased: string[] }
  | { t: 'input'; mvx: number; mvy: number; dash: boolean; aim: number }
  | { t: 'buySkill'; nodeId: string }
  | { t: 'ping' };

export type HostMsg =
  | { t: 'welcome'; you: number; players: PlayerInfo[] }
  | { t: 'players'; players: PlayerInfo[] }
  | { t: 'start'; seed: number }
  | { t: 'snapshot'; snap: number[] }
  | { t: 'skillAck'; nodeId: string; ok: boolean; sp: number; spSpent: number }
  | { t: 'hostLeft' };

export type AnyMsg = ClientMsg | HostMsg;

// ---------------- shared payload types ----------------

/** Compact meta multiplier payload — sent once at connection so the host can compute derived stats. */
export interface MetaPayload {
  dmgMult: number;
  cdMult: number;
  moveMult: number;
  hpMult: number;
  xpMult: number;
  critChance: number;
  critDmgMult: number;
  regenPerSec: number;
  lifestealPct: number;
  damageReduction: number;
  dashCdMult: number;
  projSpeedMult: number;
  dashDistMult: number;
}

/** Player info shown in the lobby and player list. */
export interface PlayerInfo {
  id: number;
  name: string;
  isHost: boolean;
  peerId: string;
}

/** Input snapshot sent from client to host at 20Hz. */
export interface InputPayload {
  mvx: number;
  mvy: number;
  dash: boolean;
  aim: number;
}