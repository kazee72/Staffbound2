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

export function updateSpawns(world: World, dt: number): void {
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
    world.bossTimer = 90;
    spawnBoss(world);
  }
}
