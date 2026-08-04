/**
 * P2P message types for the HOLLOWMERE multiplayer protocol.
 *
 * Shared-authority model:
 *   Each client owns and simulates their OWN player locally (movement, spells,
 *   leveling, skill tree). Clients broadcast their player state at 20Hz.
 *   The HOST additionally owns enemies (spawning, AI, boss fights, damage
 *   resolution). Clients send enemyHit/bossHit messages to the host when their
 *   projectiles connect; the host applies damage and broadcasts enemy state.
 *   When an enemy dies, the host notifies the killer so they can grant XP.
 */

// ---------------- Client → Host (or broadcast to all) ----------------

export type ClientMsg =
  | { t: 'hello'; name: string; roomCode: string; meta: MetaPayload; purchased: string[] }
  | { t: 'playerState'; id: number; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; level: number; aim: number; dashing: boolean; invuln: boolean; dashCd: number; downed: boolean; sp: number; spSpent: number; projectiles: number[] }
  | { t: 'enemyHit'; enemyIdx: number; dmg: number; burn: boolean; slow: number; freeze: number; crit: boolean; markedBonus: number }
  | { t: 'bossHit'; dmg: number; burn: boolean; slow: number; crit: boolean; markedBonus: number }
  | { t: 'ping' };

// ---------------- Host → Clients ----------------

export type HostMsg =
  | { t: 'welcome'; you: number; players: PlayerInfo[] }
  | { t: 'players'; players: PlayerInfo[] }
  | { t: 'start'; seed: number }
  | { t: 'enemyState'; enemies: number[]; bossActive: number; boss: number[] }
  | { t: 'enemyKilled'; enemyIdx: number; killerPlayerId: number }
  | { t: 'bossKilled'; killerPlayerId: number }
  | { t: 'hostLeft' };

export type AnyMsg = ClientMsg | HostMsg;

// ---------------- shared payload types ----------------

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

export interface PlayerInfo {
  id: number;
  name: string;
  isHost: boolean;
  peerId: string;
}