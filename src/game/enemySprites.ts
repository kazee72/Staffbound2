/**
 * Procedural pixel-art enemy + boss sprites.
 *
 * Same technique as mageSprite.ts/forestBackground.ts: draw onto a small
 * native-resolution Graphics canvas pixel-by-pixel (`fillRect(x,y,1,1)`),
 * then `generateTexture()` once (idempotent — safe to call every boot).
 * Because the Phaser config sets `pixelArt: true` / `roundPixels: true`,
 * textures generated this way stay crisp with no smoothing at any scale.
 *
 * Regular enemies are drawn at a small native grid (14-20px) sized to
 * roughly match their collision radius (r: 7-12), then displayed at a
 * modest scale multiplier from GameScene. Bosses get bigger, more detailed
 * native grids (28-34px) so they read as real set-piece threats.
 */

export const ENEMY_TEXTURE_KEYS = {
  slime: 'enemySlime',
  skel: 'enemySkel',
  wisp: 'enemyWisp',
  wraith: 'enemyWraith',
} as const;

export const BOSS_TEXTURE_KEYS: Record<string, string> = {
  elderWraith: 'bossElderWraith',
  emberColossus: 'bossEmberColossus',
  rimeSovereign: 'bossRimeSovereign',
  brambleHorror: 'bossBrambleHorror',
};

function px(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, 1, 1);
}

export function generateEnemyTextures(scene: Phaser.Scene): void {
  generateSlime(scene);
  generateSkel(scene);
  generateWisp(scene);
  generateWraith(scene);
  generateElderWraithBoss(scene);
  generateEmberColossusBoss(scene);
  generateRimeSovereignBoss(scene);
  generateBrambleHorrorBoss(scene);
}

// ---------------- SLIME (16x14) ----------------
function generateSlime(scene: Phaser.Scene): void {
  const KEY = ENEMY_TEXTURE_KEYS.slime;
  if (scene.textures.exists(KEY)) return;
  const W = 16;
  const H = 14;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const base = 0x5f9450;
  const light = 0x8fc47c;
  const dark = 0x3d6a34;
  const outline = 0x18240f;

  // Squishy blob body via per-row half-width profile (wider mid/bottom, tapered top).
  const rows: number[] = [3, 5, 6.5, 7, 7, 6.6, 6, 5, 3.5];
  const cx = W / 2 - 0.5;
  rows.forEach((halfW, row) => {
    const y = row + 2;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x <= Math.round(cx - halfW) + 0.5 || x >= Math.round(cx + halfW) - 0.5;
      const topHalf = row < rows.length / 2;
      const shade = edge ? outline : topHalf ? light : row > rows.length - 3 ? dark : base;
      px(g, x, y, shade, edge ? 0.85 : 1);
    }
  });
  // top highlight streak
  px(g, cx - 2, 3, 0xd4f0c0, 0.7);
  px(g, cx - 1, 3, 0xd4f0c0, 0.7);
  px(g, cx - 2, 4, 0xd4f0c0, 0.4);
  // translucent inner bubble
  px(g, cx + 2, 7, 0xbfe6ad, 0.35);
  px(g, cx + 1, 8, 0xbfe6ad, 0.3);
  // beady eyes
  px(g, cx - 2, 6, 0x14200c);
  px(g, cx + 1, 6, 0x14200c);
  px(g, cx - 2, 5, 0xffffff, 0.7);
  px(g, cx + 1, 5, 0xffffff, 0.7);
  // ground shadow
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx + 0.5, 12.5, 10, 2.4);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- SKELETON (14x20) ----------------
function generateSkel(scene: Phaser.Scene): void {
  const KEY = ENEMY_TEXTURE_KEYS.skel;
  if (scene.textures.exists(KEY)) return;
  const W = 14;
  const H = 20;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const bone = 0xe3ddc9;
  const boneShade = 0xb5ad91;
  const eye = 0xff5252;
  const weapon = 0x8a6a3a;
  const outline = 0x2a271e;

  // Skull
  for (let y = 0; y < 5; y++) {
    for (let x = 4; x <= 9; x++) {
      const edge = x === 4 || x === 9 || y === 0;
      px(g, x, y, edge ? outline : bone);
    }
  }
  // eye sockets, glowing
  px(g, 5, 2, eye);
  px(g, 8, 2, eye);
  px(g, 5, 2, 0xffb0b0, 0.5);
  // jaw ticks
  px(g, 5, 4, boneShade);
  px(g, 7, 4, boneShade);

  // Spine/neck
  for (let y = 5; y <= 6; y++) px(g, 6, y, boneShade);

  // Ribcage
  const ribRows = [7, 8, 9, 10];
  ribRows.forEach((y, i) => {
    const w = 3 - (i % 2 === 0 ? 0 : 0.5);
    for (let x = Math.round(6 - w); x <= Math.round(6 + w); x++) {
      if (x < 0 || x >= W) continue;
      px(g, x, y, x === 6 ? boneShade : bone, x % 2 === 0 ? 1 : 0.85);
    }
  });

  // Pelvis
  for (let x = 4; x <= 8; x++) px(g, x, 11, boneShade);

  // Arms (bony, one holding a rusty weapon)
  for (let y = 6; y <= 10; y++) {
    px(g, 3, y, bone); // left arm
    px(g, 9, y, bone); // right arm
  }
  // rusty weapon (small dagger) held in right hand
  for (let y = 6; y <= 12; y++) px(g, 10, y, y === 6 ? 0xd8d8d8 : weapon);
  px(g, 10, 5, 0xd8d8d8);

  // Legs
  for (let y = 12; y <= 18; y++) {
    px(g, 5, y, y % 3 === 0 ? boneShade : bone);
    px(g, 7, y, y % 3 === 0 ? boneShade : bone);
  }
  // feet
  px(g, 4, 19, boneShade);
  px(g, 5, 19, bone);
  px(g, 7, 19, bone);
  px(g, 8, 19, boneShade);

  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(6, 19.5, 8, 2);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- WISP (14x14) ----------------
function generateWisp(scene: Phaser.Scene): void {
  const KEY = ENEMY_TEXTURE_KEYS.wisp;
  if (scene.textures.exists(KEY)) return;
  const W = 14;
  const H = 14;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outer = 0x6fb8e0;
  const mid = 0x9dd6f0;
  const core = 0xeaf9ff;

  const cx = 7;
  const cy = 6;
  // soft outer glow (flame-like teardrop, wider at bottom, tapered at top)
  for (let y = 1; y <= 11; y++) {
    const t = (y - 1) / 10;
    const halfW = 4.4 * Math.sin(Math.PI * (1 - t) * 0.9 + 0.15) + 0.6;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const d = Math.hypot(x - cx, y - cy) / 5;
      const alpha = Math.max(0, 1 - d) * 0.85;
      px(g, x, y, outer, alpha * 0.6);
    }
  }
  // mid glow ring
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2;
    const rx = Math.round(cx + Math.cos(ang) * 2.6);
    const ry = Math.round(cy + Math.sin(ang) * 2.6);
    px(g, rx, ry, mid, 0.55);
  }
  // glowing core
  px(g, cx, cy, core);
  px(g, cx - 1, cy, core, 0.8);
  px(g, cx + 1, cy, core, 0.8);
  px(g, cx, cy - 1, core, 0.8);
  px(g, cx, cy + 1, core, 0.8);
  // small trailing wisp tail below (complements the particle trail already in-sim)
  px(g, cx, 12, outer, 0.4);
  px(g, cx - 1, 13, outer, 0.25);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- WRAITH (16x22) ----------------
function generateWraith(scene: Phaser.Scene): void {
  const KEY = ENEMY_TEXTURE_KEYS.wraith;
  if (scene.textures.exists(KEY)) return;
  const W = 16;
  const H = 22;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const robe = 0x6a4e8f;
  const robeDark = 0x4a3468;
  const robeLight = 0x8b6fae;
  const eye = 0xd6c1ff;

  // Hood (rounded top)
  for (let y = 0; y <= 5; y++) {
    const halfW = 3.5 - Math.max(0, 3 - y) * 0.3;
    const cx = 8;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? robeDark : robe, edge ? 0.9 : 1);
    }
  }
  // face shadow void beneath hood with glowing eyes
  for (let y = 3; y <= 5; y++) {
    for (let x = 6; x <= 10; x++) px(g, x, y, 0x0c0812, 0.85);
  }
  px(g, 6, 4, eye);
  px(g, 9, 4, eye);
  px(g, 6, 4, 0xffffff, 0.4);
  px(g, 9, 4, 0xffffff, 0.4);

  // Tattered robe body — wider toward the hem, ragged bottom edge
  const bodyRows: Array<[number, number]> = [
    [4, 12], [3.5, 12.5], [3, 13], [2.5, 13.5], [2, 14], [1.5, 14.5], [1, 15], [1, 15], [0.5, 15.5],
  ];
  bodyRows.forEach(([x0, x1], i) => {
    const y = 6 + i;
    for (let x = Math.round(x0); x <= Math.round(x1); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x <= Math.round(x0) + 0.5 || x >= Math.round(x1) - 0.5;
      const shade = edge ? robeDark : i % 2 === 0 ? robe : robeLight;
      // ghostly edges: lower alpha near the ragged bottom hem
      const alpha = i > 6 ? 0.55 : edge ? 0.85 : 1;
      px(g, x, y, shade, alpha);
    }
  });
  // ragged hem tendrils (semi-transparent trailing wisps of cloth)
  const tendrilX = [2, 5, 8, 11, 14];
  tendrilX.forEach((x, i) => {
    px(g, x, 20 + (i % 2), robeDark, 0.4);
    px(g, x, 21, robeDark, 0.2);
  });
  // faint arms suggestion
  px(g, 2, 10, robeDark, 0.7);
  px(g, 13, 10, robeDark, 0.7);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: ELDER WRAITH (32x36) — bigger, more ornate wraith ----------------
function generateElderWraithBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.elderWraith;
  if (scene.textures.exists(KEY)) return;
  const W = 32;
  const H = 36;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const robe = 0x5b3f73;
  const robeDark = 0x3a2850;
  const robeLight = 0x7a5a9e;
  const eye = 0xf0c8ff;
  const crown = 0xc9a869;

  // Hood
  for (let y = 0; y <= 10; y++) {
    const halfW = 7 - Math.max(0, 6 - y) * 0.35;
    const cx = 16;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? robeDark : robe);
    }
  }
  // Jagged crown spikes atop the hood
  for (let i = 0; i < 5; i++) {
    const x = 10 + i * 3;
    px(g, x, 0, crown);
    px(g, x, 1, crown, 0.6);
  }
  // Face void + glowing eyes
  for (let y = 6; y <= 10; y++) for (let x = 12; x <= 20; x++) px(g, x, y, 0x0a0714, 0.9);
  for (let x = 13; x <= 15; x++) px(g, x, 8, eye);
  for (let x = 17; x <= 19; x++) px(g, x, 8, eye);
  px(g, 14, 8, 0xffffff, 0.5);
  px(g, 18, 8, 0xffffff, 0.5);

  // Massive robe body
  const rows = 22;
  for (let i = 0; i < rows; i++) {
    const y = 11 + i;
    const t = i / rows;
    const halfW = 8 + t * 6;
    const cx = 16;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W || y >= H) continue;
      const edge = x <= Math.round(cx - halfW) + 1 || x >= Math.round(cx + halfW) - 1;
      const alpha = i > rows - 6 ? 0.55 : 1;
      px(g, x, y, edge ? robeDark : i % 3 === 0 ? robeLight : robe, alpha);
    }
  }
  // gold trim belt
  for (let x = 8; x <= 24; x++) px(g, x, 18, crown, 0.85);
  // ragged hem
  for (let i = 0; i < 8; i++) {
    const x = 5 + i * 3;
    px(g, x, H - 1, robeDark, 0.35);
  }

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: EMBER COLOSSUS (34x34) — hulking fire golem ----------------
function generateEmberColossusBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.emberColossus;
  if (scene.textures.exists(KEY)) return;
  const W = 34;
  const H = 34;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const rock = 0x4a2e22;
  const rockLight = 0x6b4230;
  const ember = 0xe2793d;
  const emberBright = 0xffb066;
  const crack = 0x2a1a12;

  // Blocky torso silhouette
  for (let y = 6; y < 30; y++) {
    const t = (y - 6) / 24;
    const halfW = 10 + Math.sin(t * Math.PI) * 4;
    const cx = 17;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x <= Math.round(cx - halfW) + 1 || x >= Math.round(cx + halfW) - 1;
      px(g, x, y, edge ? crack : (x + y) % 5 === 0 ? rockLight : rock);
    }
  }
  // Molten cracks glowing across the body
  const cracks: Array<[number, number]> = [
    [12, 12], [13, 13], [14, 14], [20, 10], [21, 11], [22, 12], [16, 20], [17, 21], [18, 22], [10, 22], [11, 23],
  ];
  cracks.forEach(([x, y]) => px(g, x, y, ember, 0.9));
  // Head with glowing core eyes
  for (let y = 0; y <= 6; y++) {
    for (let x = 12; x <= 22; x++) {
      const edge = x === 12 || x === 22 || y === 0;
      px(g, x, y, edge ? crack : rock);
    }
  }
  px(g, 14, 3, emberBright);
  px(g, 19, 3, emberBright);
  // chest core — bright ember heart
  for (let x = 15; x <= 19; x++) {
    for (let y = 15; y <= 19; y++) {
      const d = Math.hypot(x - 17, y - 17);
      if (d < 2.6) px(g, x, y, d < 1.4 ? 0xfff0d8 : emberBright);
    }
  }
  // shoulder ember vents
  px(g, 6, 10, ember, 0.85);
  px(g, 28, 10, ember, 0.85);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: RIME SOVEREIGN (32x36) — crowned ice queen ----------------
function generateRimeSovereignBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.rimeSovereign;
  if (scene.textures.exists(KEY)) return;
  const W = 32;
  const H = 36;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const ice = 0x4f7fa8;
  const iceLight = 0x8ec9e8;
  const iceBright = 0xd4f0ff;
  const crown = 0xcfe9ff;

  // Ice crown
  for (let i = 0; i < 5; i++) {
    const x = 10 + i * 3;
    const h = i % 2 === 0 ? 4 : 6;
    for (let y = 0; y < h; y++) px(g, x, h - y - 1 + 2, crown, 1 - y * 0.15);
  }
  // Head/hood
  for (let y = 6; y <= 11; y++) {
    const halfW = 6.5;
    const cx = 16;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? ice : iceLight);
    }
  }
  // Glowing pale-blue eyes
  px(g, 13, 9, iceBright);
  px(g, 19, 9, iceBright);

  // Flowing crystalline robe, wide skirt with icy shard fringe
  const rows = 20;
  for (let i = 0; i < rows; i++) {
    const y = 12 + i;
    const t = i / rows;
    const halfW = 7 + t * 8;
    const cx = 16;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W || y >= H) continue;
      const edge = x <= Math.round(cx - halfW) + 1 || x >= Math.round(cx + halfW) - 1;
      px(g, x, y, edge ? ice : i % 4 === 0 ? iceBright : iceLight, edge ? 0.7 : 1);
    }
  }
  // icy shard fringe at hem
  for (let i = 0; i < 9; i++) {
    const x = 5 + i * 2.5;
    px(g, Math.round(x), H - 1, iceBright, 0.8);
  }

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: BRAMBLE HORROR (34x34) — writhing plant/root monstrosity ----------------
function generateBrambleHorrorBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.brambleHorror;
  if (scene.textures.exists(KEY)) return;
  const W = 34;
  const H = 34;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const bark = 0x3d2c1a;
  const leaf = 0x4d7a3d;
  const leafLight = 0x6fa858;
  const thornColor = 0x2a1c10;
  const eyeColor = 0xd6ff8b;

  // Gnarled trunk-like core body
  for (let y = 4; y < 30; y++) {
    const t = (y - 4) / 26;
    const halfW = 8 + Math.sin(t * Math.PI * 1.5) * 3;
    const cx = 17;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x <= Math.round(cx - halfW) + 1 || x >= Math.round(cx + halfW) - 1;
      px(g, x, y, edge ? bark : (x + y) % 6 === 0 ? leafLight : leaf);
    }
  }
  // radiating thorn spikes
  const spikes = 10;
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2;
    const cx = 17;
    const cy = 17;
    const r0 = 9;
    const r1 = 14;
    const x0 = Math.round(cx + Math.cos(ang) * r0);
    const y0 = Math.round(cy + Math.sin(ang) * r0);
    const x1 = Math.round(cx + Math.cos(ang) * r1);
    const y1 = Math.round(cy + Math.sin(ang) * r1);
    px(g, x0, y0, thornColor);
    px(g, x1, y1, thornColor, 0.7);
  }
  // glowing malevolent eyes embedded in the bark
  px(g, 13, 12, eyeColor);
  px(g, 21, 12, eyeColor);
  px(g, 17, 20, eyeColor, 0.85);

  g.generateTexture(KEY, W, H);
  g.destroy();
}
