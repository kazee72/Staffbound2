/** Day/wave timer & spawn scaling, ported from reference/full-reference.html */
import type { World } from './types';
import { currentDay, spawnBoss, spawnEnemy } from './enemies';

export const PLACES = [
  'the fallen kingdom',
  'a quiet forest road',
  'the ruined chapel',
  'an old battlefield',
  'the frozen pass',
  'a forgotten library',
  'the sunken village',
  'the mountain shrine',
  'a wayside grave',
  'the last watchtower',
];

/**
 * Regular enemy spawning pauses entirely while a boss fight is active
 * (`world.bossFight !== null`) — see BossFightState in types.ts. The boss
 * timer itself still only fires spawnBoss() when not already mid-fight.
 */
export function updateSpawns(world: World, dt: number): void {
  if (world.bossFight) return;

  const day = currentDay(world);
  world.spawnTimer -= dt;
  const interval = Math.max(0.32, 1.5 - day * 0.09);
  if (world.spawnTimer <= 0) {
    world.spawnTimer = interval;
    spawnEnemy(world);
    if (day >= 3 && Math.random() < 0.25) spawnEnemy(world);
  }
  world.bossTimer -= dt;
  if (world.bossTimer <= 0) {
    // Boss fights are now full bullet-hell set-pieces (multiple attack
    // patterns instead of one telegraphed stomp), so the cadence was
    // stretched from the original 90s to 130s to give each fight room to
    // breathe without back-to-back bosses feeling relentless.
    world.bossTimer = 130;
    spawnBoss(world);
  }
}
