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
  // Slower spawn interval shrinkage for longer stages.
  const interval = Math.max(0.18, 1.1 - day * 0.05 - (stage - 1) * 0.04);
  if (world.spawnTimer <= 0) {
    world.spawnTimer = interval;
    spawnEnemy(world);
    // Higher stages have a chance of double/triple-spawning (slightly boosted
    // for longer stages with more enemies on screen).
    if ((day >= 2 || stage >= 2) && Math.random() < 0.45 + (stage - 1) * 0.08) spawnEnemy(world);
    if (stage >= 2 && Math.random() < 0.35) spawnEnemy(world);
    if (stage >= 3 && Math.random() < 0.3) spawnEnemy(world);
    if (stage >= 4 && Math.random() < 0.25) spawnEnemy(world);
  }
  world.bossTimer -= dt;
  if (world.bossTimer <= 0) {
    // Stages are longer with 2 bosses. The first boss spawns after 180s,
    // the second after the first is defeated (8s breather set in updateBossFight).
    world.bossTimer = 180;
    spawnBoss(world);
  }
}
