/**
 * Compact enemy/boss state serialization for host→client broadcasts.
 * Used in shared-authority mode: the host owns enemies and broadcasts
 * their state at 20Hz. Clients deserialize and render from this.
 */
import type { World } from '../game/types';
import { currentDay } from '../game/enemies';

export function serializeEnemyState(world: World, tick: number): number[] {
  const out: number[] = [];
  out.push(tick);
  out.push(world.elapsed);
  out.push(currentDay(world));
  out.push(world.stage);
  out.push(world.bossFight ? 1 : 0);

  // Enemies
  out.push(world.enemies.length);
  for (const e of world.enemies) {
    const typeMap: Record<string, number> = { slime: 0, skel: 1, wisp: 2, wraith: 3, ghoul: 4, iceWolf: 5, shadowWraith: 6 };
    out.push(
      typeMap[e.type] ?? 0,
      e.x, e.y, e.hp, e.maxHp, e.r,
      e.frozenUntil > world.elapsed ? 1 : 0,
      e.slowUntil > world.elapsed ? 1 : 0,
      e.marked > world.elapsed ? 1 : 0,
      e.burning > 0 ? 1 : 0,
    );
  }

  // Boss
  if (world.bossFight) {
    const b = world.bossFight.boss;
    const bossDefMap: Record<string, number> = { elderWraith: 0, emberColossus: 1, rimeSovereign: 2, brambleHorror: 3 };
    out.push(bossDefMap[b.defId] ?? 0, b.x, b.y, b.hp, b.maxHp, b.r, b.phase ?? 1);
    out.push(b.telegraphs.length);
    for (const t of b.telegraphs) {
      out.push(t.kind === 'ring' ? 0 : 1, t.x, t.y, t.radius ?? 0, t.length ?? 0, t.width ?? 0, t.t, t.dur);
    }
  }

  return out;
}

export interface EnemyView {
  tick: number;
  elapsed: number;
  day: number;
  stage: number;
  enemies: { type: number; x: number; y: number; hp: number; maxHp: number; r: number; frozen: boolean; slowed: boolean; marked: boolean; burning: boolean }[];
  bossActive: boolean;
  boss: { defId: number; x: number; y: number; hp: number; maxHp: number; r: number; phase: number; telegraphs: { kind: number; x: number; y: number; r: number; length: number; width: number; t: number; dur: number }[] } | null;
}

export function deserializeEnemyState(data: number[]): EnemyView {
  let idx = 0;
  const read = () => data[idx++];

  const tick = read();
  const elapsed = read();
  const day = read();
  const stage = read();
  const bossActive = read() === 1;

  const eCount = read();
  const enemies: EnemyView['enemies'] = [];
  for (let i = 0; i < eCount; i++) {
    enemies.push({
      type: read(), x: read(), y: read(), hp: read(), maxHp: read(), r: read(),
      frozen: read() === 1, slowed: read() === 1, marked: read() === 1, burning: read() === 1,
    });
  }

  let boss: EnemyView['boss'] = null;
  if (bossActive) {
    const defId = read();
    const bx = read(), by = read(), bhp = read(), bmaxHp = read(), br = read();
    const bphase = read();
    const teleCount = read();
    const telegraphs: NonNullable<EnemyView['boss']>['telegraphs'] = [];
    for (let i = 0; i < teleCount; i++) {
      telegraphs.push({ kind: read(), x: read(), y: read(), r: read(), length: read(), width: read(), t: read(), dur: read() });
    }
    boss = { defId, x: bx, y: by, hp: bhp, maxHp: bmaxHp, r: br, phase: bphase, telegraphs };
  }

  return { tick, elapsed, day, stage, enemies, bossActive, boss };
}

export const ENEMY_TYPE_NAMES = ['slime', 'skel', 'wisp', 'wraith', 'ghoul', 'iceWolf', 'shadowWraith'];
export const BOSS_DEF_NAMES = ['elderWraith', 'emberColossus', 'rimeSovereign', 'brambleHorror'];