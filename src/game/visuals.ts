/** Visual helper functions (particle bursts, damage popups), ported from reference/full-reference.html */
import type { World } from './types';

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function burst(world: World, x: number, y: number, color: string, n = 14, spd = 140, life = 0.55): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spd * (0.3 + Math.random() * 0.9);
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      color,
      size: rand(2, 4),
    });
  }
}

export function spawnPopup(world: World, x: number, y: number, text: string, color: string, big?: boolean): void {
  world.popups.push({ x, y, text, color, life: 0.8, vy: -40, big });
}
