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
 * Spawn interval shrinks with both day and stage for escalating pressure.
 */
export function updateSpawns(world: World, dt: number): void {
  if (world.bossFight) return;

  const day = currentDay(world);
  const stage = world.stage;
  world.spawnTimer -= dt;
  const interval = Math.max(0.28, 1.5 - day * 0.09 - (stage - 1) * 0.06);
  if (world.spawnTimer <= 0) {
    world.spawnTimer = interval;
    spawnEnemy(world);
    // Higher stages have a chance of double-spawning.
    if ((day >= 3 || stage >= 2) && Math.random() < 0.25 + (stage - 1) * 0.05) spawnEnemy(world);
    if (stage >= 3 && Math.random() < 0.15) spawnEnemy(world);
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
