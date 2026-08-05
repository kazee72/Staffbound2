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
  ghoul: 'enemyGhoul',
  iceWolf: 'enemyIceWolf',
  shadowWraith: 'enemyShadowWraith',
} as const;

export const BOSS_TEXTURE_KEYS: Record<string, string> = {
  elderWraith: 'bossElderWraith',
  emberColossus: 'bossEmberColossus',
  rimeSovereign: 'bossRimeSovereign',
  brambleHorror: 'bossBrambleHorror',
  shadowReaper: 'bossShadowReaper',
  lightPaladin: 'bossLightPaladin',
  stormTitan: 'bossStormTitan',
  tempestDragon: 'bossTempestDragon',
  tideLeviathan: 'bossTideLeviathan',
  goliath: 'bossGoliath',
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
  generateGhoul(scene);
  generateIceWolf(scene);
  generateShadowWraith(scene);
  generateElderWraithBoss(scene);
  generateEmberColossusBoss(scene);
  generateRimeSovereignBoss(scene);
  generateBrambleHorrorBoss(scene);
  generateShadowReaperBoss(scene);
  generateLightPaladinBoss(scene);
  generateStormTitanBoss(scene);
  generateTempestDragonBoss(scene);
  generateTideLeviathanBoss(scene);
  generateGoliathBoss(scene);
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

// ---------------- GHOUL (14x18) — fast zombie, greenish-brown hunched figure ----------------
function generateGhoul(scene: Phaser.Scene): void {
  const KEY = ENEMY_TEXTURE_KEYS.ghoul;
  if (scene.textures.exists(KEY)) return;
  const W = 14;
  const H = 18;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const skin = 0x6a7a4e;
  const skinDark = 0x4a5a36;
  const skinLight = 0x8a9a6e;
  const eye = 0xff6644;
  const outline = 0x1a2010;

  // Hunched body
  for (let y = 5; y < 14; y++) {
    const t = (y - 5) / 9;
    const halfW = 4 + Math.sin(t * Math.PI) * 1.5;
    const cx = 7;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? outline : (x + y) % 4 === 0 ? skinDark : skin);
    }
  }
  // Head (hunched forward, smaller)
  for (let y = 2; y < 6; y++) {
    for (let x = 5; x <= 9; x++) {
      const edge = x === 5 || x === 9 || y === 2;
      px(g, x, y, edge ? outline : y === 3 ? skinLight : skin);
    }
  }
  // Glowing red eyes
  px(g, 6, 4, eye);
  px(g, 8, 4, eye);
  px(g, 6, 4, 0xffffff, 0.3);
  // Jagged mouth
  px(g, 6, 5, skinDark);
  px(g, 8, 5, skinDark);
  // Arms (long, dangling)
  for (let y = 7; y < 13; y++) {
    px(g, 3, y, skin);
    px(g, 11, y, skin);
  }
  // Claws
  px(g, 3, 13, skinDark);
  px(g, 11, 13, skinDark);
  // Legs
  for (let y = 14; y < 18; y++) {
    px(g, 5, y, (y % 2 === 0) ? skinDark : skin);
    px(g, 8, y, (y % 2 === 0) ? skinDark : skin);
  }

  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(7, 17.5, 8, 2);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- ICE WOLF (16x14) — fast blue wolf, sleek predator ----------------
function generateIceWolf(scene: Phaser.Scene): void {
  const KEY = ENEMY_TEXTURE_KEYS.iceWolf;
  if (scene.textures.exists(KEY)) return;
  const W = 16;
  const H = 14;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const fur = 0xb8d8f0;
  const furDark = 0x6890b0;
  const furLight = 0xd8e8f8;
  const eye = 0x88e0ff;
  const outline = 0x203040;

  // Body (sleek, elongated)
  for (let y = 5; y < 11; y++) {
    const t = (y - 5) / 6;
    const halfW = 5 + Math.sin(t * Math.PI) * 2;
    const cx = 8;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      px(g, x, y, edge ? outline : y < 7 ? furLight : fur);
    }
  }
  // Head (pointed snout facing right)
  for (let y = 3; y < 8; y++) {
    for (let x = 10; x <= 15; x++) {
      const edge = x === 15 || y === 3 || (x === 10 && y < 6);
      px(g, x, y, edge ? outline : y === 3 ? furLight : fur);
    }
  }
  // Pointed ears
  px(g, 10, 2, furDark);
  px(g, 12, 2, furDark);
  // Ice-blue eye
  px(g, 12, 5, eye);
  px(g, 12, 5, 0xffffff, 0.5);
  // Legs
  for (let y = 11; y < 14; y++) {
    px(g, 4, y, furDark);
    px(g, 7, y, fur);
    px(g, 10, y, fur);
    px(g, 13, y, furDark);
  }
  // Tail (curving up)
  px(g, 0, 6, fur);
  px(g, 1, 5, fur);
  px(g, 0, 4, furDark, 0.7);
  // Ice crystal spikes on back
  px(g, 7, 4, 0xd4f0ff);
  px(g, 9, 4, 0xd4f0ff);

  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(8, 13.5, 10, 2);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- SHADOW WRAITH (16x22) — teleporting dark entity with glowing core ----------------
function generateShadowWraith(scene: Phaser.Scene): void {
  const KEY = ENEMY_TEXTURE_KEYS.shadowWraith;
  if (scene.textures.exists(KEY)) return;
  const W = 16;
  const H = 22;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const voidc = 0x2a1a40;
  const voidDark = 0x1a0e28;
  const glow = 0xc4a8ff;
  const core = 0xf0d8ff;
  const outline = 0x0a0612;

  // Wispy tattered body — semi-transparent flowing shape
  for (let y = 4; y < 20; y++) {
    const t = (y - 4) / 16;
    const halfW = 5 + Math.sin(t * Math.PI * 1.5) * 2.5;
    const cx = 8;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      const alpha = y > 16 ? 0.4 : 0.8;
      px(g, x, y, edge ? voidDark : voidc, alpha);
    }
  }
  // Glowing purple core in the center
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 2) {
        px(g, 8 + dx, 11 + dy, d < 0.5 ? core : glow, 1 - d * 0.3);
      }
    }
  }
  // Glowing eyes (twin pinpoints above the core)
  px(g, 6, 7, glow, 0.9);
  px(g, 10, 7, glow, 0.9);
  // Wispy tendrils at the bottom
  const tendrils = [3, 6, 8, 10, 13];
  tendrils.forEach((x, i) => {
    px(g, x, 20, voidDark, 0.3);
    px(g, x, 21, voidDark, 0.15);
    void i;
  });
  // Faint outline at top
  for (let x = 5; x <= 11; x++) {
    px(g, x, 3, outline, 0.5);
  }

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: ELDER WRAITH (64x80) — ghostly shadow wraith, purple/dark ----------------
// Clean pixel art: dark outline, limited purple palette, glowing eyes, tattered hooded robe.
function generateElderWraithBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.elderWraith;
  if (scene.textures.exists(KEY)) return;
  const W = 64;
  const H = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x0c0612;     // near-black purple outline
  const robe = 0x4a3268;          // mid purple robe
  const robeDark = 0x2e1d48;     // shadow fold
  const robeLight = 0x6b4f9a;    // highlight fold
  const robePale = 0x8e72c4;     // top highlight
  const voidc = 0x0a0614;        // face void
  const eye = 0xf0c8ff;          // glowing eye
  const eyeCore = 0xffffff;     // eye core
  const crown = 0xc9a869;        // gold crown
  const crownDark = 0x8a6a2a;   // gold shadow
  const ghost = 0x3a2858;       // wisp tendril

  const cx = 31;

  // ---- Hood (rounded dome, rows 4-22) ----
  for (let y = 4; y <= 22; y++) {
    const t = (y - 4) / 18;
    const halfW = 15 - Math.max(0, 8 - y + 4) * 0.35 + Math.sin(t * Math.PI) * 1.5;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, robeDark);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, robeDark);
      else if (y < 12 && x > cx - 4 && x < cx + 4) px(g, x, y, robePale);
      else if (y < 16) px(g, x, y, robeLight);
      else px(g, x, y, robe);
    }
  }
  // top dome cap
  for (let x = cx - 4; x <= cx + 4; x++) px(g, x, 3, robeLight);
  px(g, cx - 5, 4, outline); px(g, cx + 5, 4, outline);
  for (let x = cx - 3; x <= cx + 3; x++) px(g, x, 2, robePale);

  // ---- Jagged crown spikes (gold) ----
  const spikes = [cx - 14, cx - 7, cx, cx + 7, cx + 14];
  spikes.forEach((sx, i) => {
    const h = i === 2 ? 7 : 5;
    for (let y = 0; y < h; y++) {
      px(g, sx, y, y === 0 ? crown : y === h - 1 ? crownDark : crown);
      px(g, sx - 1, y + 1, crownDark, 0.7);
      px(g, sx + 1, y + 1, crown, 0.8);
    }
    px(g, sx, 0, 0xfff0c0); // tip glint
  });

  // ---- Face void (deep shadow inside hood) ----
  for (let y = 12; y <= 22; y++) for (let x = cx - 9; x <= cx + 9; x++) px(g, x, y, voidc, 0.95);

  // ---- Glowing eyes (twin pinpoints) ----
  // left eye
  for (let y = 16; y <= 18; y++) for (let x = cx - 8; x <= cx - 5; x++) px(g, x, y, eye, 0.85);
  px(g, cx - 7, 17, eyeCore); px(g, cx - 6, 17, eyeCore, 0.8);
  // right eye
  for (let y = 16; y <= 18; y++) for (let x = cx + 5; x <= cx + 8; x++) px(g, x, y, eye, 0.85);
  px(g, cx + 6, 17, eyeCore); px(g, cx + 7, 17, eyeCore, 0.8);
  // eye glow bleed
  px(g, cx - 9, 17, eye, 0.4); px(g, cx + 9, 17, eye, 0.4);
  px(g, cx - 4, 17, eye, 0.5); px(g, cx + 4, 17, eye, 0.5);

  // ---- Tattered robe body (rows 23-72) — widening skirt ----
  const bodyRows = 50;
  for (let i = 0; i < bodyRows; i++) {
    const y = 23 + i;
    const t = i / bodyRows;
    const halfW = 14 + t * 16;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W || y >= H) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      // ragged bottom fades
      const alpha = i > bodyRows - 8 ? Math.max(0.2, 1 - (i - (bodyRows - 8)) * 0.1) : 1;
      if (left || right) px(g, x, y, outline, alpha);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, robeDark, alpha);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, robeDark, alpha);
      else if (i % 5 === 0 && x < cx) px(g, x, y, robeDark, alpha);
      else if (i % 4 === 0 && x > cx) px(g, x, y, robeLight, alpha * 0.6);
      else if (i < 8 && Math.abs(x - cx) < 6) px(g, x, y, robeLight, alpha);
      else px(g, x, y, robe, alpha);
    }
  }

  // ---- Gold trim belt ----
  for (let x = cx - 12; x <= cx + 12; x++) {
    px(g, x, 34, crown);
    px(g, x, 35, crownDark);
  }
  // belt gem
  px(g, cx, 34, eye); px(g, cx, 35, eyeCore, 0.8);

  // ---- Fold lines / shading ----
  for (let y = 24; y < 34; y += 4) { px(g, cx - 6, y, robeDark); px(g, cx + 6, y, robeDark); }
  for (let y = 36; y < 70; y += 5) { px(g, cx - 4, y, robeDark, 0.6); px(g, cx + 4, y, robeDark, 0.6); }

  // ---- Skeletal arms emerging from sleeves ----
  // left arm
  for (let y = 30; y <= 44; y++) { px(g, cx - 16, y, robeDark); px(g, cx - 17, y, outline); }
  // bony hand
  px(g, cx - 16, 45, 0xd8d0e0); px(g, cx - 15, 46, 0xd8d0e0); px(g, cx - 17, 46, 0xb5ad91);
  px(g, cx - 16, 47, 0xb5ad91);
  // right arm
  for (let y = 30; y <= 44; y++) { px(g, cx + 16, y, robeDark); px(g, cx + 17, y, outline); }
  px(g, cx + 16, 45, 0xd8d0e0); px(g, cx + 17, 46, 0xd8d0e0); px(g, cx + 15, 46, 0xb5ad91);
  px(g, cx + 16, 47, 0xb5ad91);

  // ---- Ragged hem tendrils (ghostly trailing cloth) ----
  const hemTendrils = [cx - 22, cx - 14, cx - 6, cx, cx + 6, cx + 14, cx + 22];
  hemTendrils.forEach((x, i) => {
    const len = 4 + (i % 3);
    for (let y = H - len; y < H; y++) px(g, x, y, ghost, Math.max(0.15, 1 - (y - (H - len)) * 0.2));
  });

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, H - 1, 44, 4);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: EMBER COLOSSUS (72x80) — fire/magma golem, orange/red ----------------
// Clean pixel art: dark outline, charcoal rock + glowing magma cracks, hulking silhouette.
function generateEmberColossusBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.emberColossus;
  if (scene.textures.exists(KEY)) return;
  const W = 72;
  const H = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x140a06;     // near-black outline
  const rock = 0x3a241a;         // dark charcoal rock
  const rockMid = 0x54301e;     // mid rock
  const rockLight = 0x7a4830;   // light rock edge
  const magma = 0xe2521a;        // magma orange
  const magmaBright = 0xff9040; // bright magma
  const magmaCore = 0xffe0a0;   // white-hot core

  const cx = 35;

  // ---- Head (blocky, rows 2-18) ----
  for (let y = 2; y <= 18; y++) {
    const t = (y - 2) / 16;
    const halfW = 10 + Math.sin(t * Math.PI) * 2;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      const top = y === 2;
      if (left || right || top) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, rockLight);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, rockMid);
      else if (y < 6) px(g, x, y, rockMid);
      else px(g, x, y, rock);
    }
  }
  // brow ridge
  for (let x = cx - 7; x <= cx + 7; x++) px(g, x, 8, rockMid);
  // glowing eyes (magma sockets)
  for (let y = 10; y <= 12; y++) {
    for (let x = cx - 7; x <= cx - 4; x++) px(g, x, y, magma);
    for (let x = cx + 4; x <= cx + 7; x++) px(g, x, y, magma);
  }
  px(g, cx - 6, 11, magmaCore); px(g, cx + 6, 11, magmaCore);
  // eye glow bleed
  px(g, cx - 8, 11, magma, 0.5); px(g, cx + 8, 11, magma, 0.5);
  px(g, cx - 3, 11, magma, 0.6); px(g, cx + 3, 11, magma, 0.6);
  // jaw / mouth crack
  for (let x = cx - 5; x <= cx + 5; x++) px(g, x, 16, magmaBright, 0.8);
  px(g, cx - 4, 17, magma); px(g, cx, 17, magmaBright); px(g, cx + 4, 17, magma);
  // horn nubs on head
  px(g, cx - 10, 1, rockMid); px(g, cx - 10, 0, outline); px(g, cx - 9, 1, rockLight);
  px(g, cx + 10, 1, rockMid); px(g, cx + 10, 0, outline); px(g, cx + 9, 1, rockLight);

  // ---- Neck ----
  for (let y = 19; y <= 22; y++) for (let x = cx - 6; x <= cx + 6; x++) px(g, x, y, rock);

  // ---- Massive shoulders (rows 23-32) ----
  for (let y = 23; y <= 32; y++) {
    const t = (y - 23) / 9;
    const halfW = 22 - Math.abs(0.5 - t) * 4;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, rockLight);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, rockMid);
      else px(g, x, y, rock);
    }
  }
  // shoulder ember vents
  for (let y = 24; y <= 28; y++) {
    px(g, cx - 21, y, magma, 0.8); px(g, cx + 21, y, magma, 0.8);
  }
  px(g, cx - 22, 26, magmaBright); px(g, cx + 22, 26, magmaBright);

  // ---- Torso (rows 23-58) — tapering block ----
  for (let y = 23; y <= 58; y++) {
    const t = (y - 23) / 35;
    const halfW = 22 - t * 6;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, rockMid);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, rockMid);
      else if ((x + y) % 7 === 0) px(g, x, y, rockMid);
      else px(g, x, y, rock);
    }
  }

  // ---- Magma cracks across body (glowing veins) ----
  const crackPaths: Array<[number, number]> = [
    // chest vertical
    [cx - 1, 24], [cx, 25], [cx + 1, 26], [cx, 27], [cx - 1, 28], [cx, 29], [cx + 1, 30], [cx, 31],
    // left diagonal
    [cx - 10, 26], [cx - 11, 27], [cx - 12, 28], [cx - 13, 29], [cx - 14, 30],
    // right diagonal
    [cx + 10, 26], [cx + 11, 27], [cx + 12, 28], [cx + 13, 29], [cx + 14, 30],
    // lower body
    [cx - 6, 40], [cx - 5, 41], [cx - 4, 42], [cx - 3, 43],
    [cx + 6, 40], [cx + 5, 41], [cx + 4, 42], [cx + 3, 43],
    [cx - 2, 48], [cx - 1, 49], [cx, 50], [cx + 1, 51], [cx + 2, 52],
  ];
  crackPaths.forEach(([x, y]) => px(g, x, y, magma, 0.9));
  // brighter crack cores
  crackPaths.forEach(([x, y], i) => { if (i % 3 === 0) px(g, x, y, magmaBright); });

  // ---- Chest core (bright ember heart) ----
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 4) px(g, cx + dx, 36 + dy, d < 1.5 ? magmaCore : d < 2.8 ? magmaBright : magma);
    }
  }
  // core glow
  px(g, cx - 5, 36, magma, 0.5); px(g, cx + 5, 36, magma, 0.5);
  px(g, cx, 31, magma, 0.5); px(g, cx, 41, magma, 0.5);

  // ---- Arms (thick rocky, rows 24-56) ----
  // left arm
  for (let y = 24; y <= 54; y++) {
    px(g, cx - 24, y, outline); px(g, cx - 23, y, rockLight); px(g, cx - 22, y, rock);
    if (y > 40) { px(g, cx - 25, y, outline); }
  }
  // right arm
  for (let y = 24; y <= 54; y++) {
    px(g, cx + 24, y, outline); px(g, cx + 23, y, rockLight); px(g, cx + 22, y, rock);
    if (y > 40) { px(g, cx + 25, y, outline); }
  }
  // arm magma cracks
  for (let y = 30; y <= 40; y += 2) { px(g, cx - 23, y, magma, 0.7); px(g, cx + 23, y, magma, 0.7); }
  // fists
  for (let y = 55; y <= 60; y++) for (let x = cx - 27; x <= cx - 21; x++) {
    const edge = x === cx - 27 || x === cx - 21 || y === 60;
    px(g, x, y, edge ? outline : rockMid);
  }
  for (let y = 55; y <= 60; y++) for (let x = cx + 21; x <= cx + 27; x++) {
    const edge = x === cx + 21 || x === cx + 27 || y === 60;
    px(g, x, y, edge ? outline : rockMid);
  }
  px(g, cx - 24, 58, magma); px(g, cx + 24, 58, magma);

  // ---- Legs (rows 59-78) ----
  for (let y = 59; y <= 76; y++) {
    // left leg
    for (let x = cx - 14; x <= cx - 4; x++) {
      const left = x === cx - 14; const right = x === cx - 4;
      if (left || right) px(g, x, y, outline);
      else px(g, x, y, rock);
    }
    // right leg
    for (let x = cx + 4; x <= cx + 14; x++) {
      const left = x === cx + 4; const right = x === cx + 14;
      if (left || right) px(g, x, y, outline);
      else px(g, x, y, rock);
    }
  }
  // leg cracks
  px(g, cx - 10, 64, magma, 0.8); px(g, cx - 9, 65, magma); px(g, cx - 10, 66, magmaBright, 0.8);
  px(g, cx + 10, 64, magma, 0.8); px(g, cx + 9, 65, magma); px(g, cx + 10, 66, magmaBright, 0.8);
  // feet
  for (let x = cx - 16; x <= cx - 4; x++) px(g, x, 77, outline);
  for (let x = cx - 15; x <= cx - 5; x++) px(g, x, 76, rockMid);
  for (let x = cx + 4; x <= cx + 16; x++) px(g, x, 77, outline);
  for (let x = cx + 5; x <= cx + 15; x++) px(g, x, 76, rockMid);

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, 78, 52, 5);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: RIME SOVEREIGN (64x84) — ice queen/crystal entity, cyan/white ----------------
// Clean pixel art: dark outline, icy blue palette, crystalline crown + flowing robe, glowing eyes.
function generateRimeSovereignBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.rimeSovereign;
  if (scene.textures.exists(KEY)) return;
  const W = 64;
  const H = 84;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x0a1a2e;      // dark blue outline
  const ice = 0x3a6890;          // mid ice blue
  const iceMid = 0x5f9ec0;       // lighter ice
  const iceLight = 0x9cdcf0;     // pale ice highlight
  const iceBright = 0xe0f5ff;    // near-white frost
  const crystal = 0xb8e8ff;      // crystal crown
  const crystalDark = 0x6a9ec8;  // crystal shadow
  const eyeGlow = 0xb0e8ff;      // eye glow
  const eyeCore = 0xffffff;     // eye core
  const frost = 0xd0e8f8;        // frost trim

  const cx = 31;

  // ---- Crystal crown (jagged ice spikes, rows 0-8) ----
  const crownSpikes = [
    { x: cx - 16, h: 5 },
    { x: cx - 10, h: 8 },
    { x: cx - 4, h: 6 },
    { x: cx + 2, h: 9 },
    { x: cx + 8, h: 6 },
    { x: cx + 14, h: 5 },
  ];
  crownSpikes.forEach((s) => {
    for (let y = 0; y < s.h; y++) {
      const yt = s.h - y;
      px(g, s.x, y, y === 0 ? iceBright : yt > s.h - 2 ? crystalDark : crystal);
      px(g, s.x - 1, y + 1, crystalDark, 0.7);
      px(g, s.x + 1, y, crystal, 0.8);
    }
    px(g, s.x, 0, 0xffffff); // tip glint
  });
  // crown base band
  for (let x = cx - 17; x <= cx + 15; x++) px(g, x, 8, outline);
  for (let x = cx - 16; x <= cx + 14; x++) px(g, x, 9, crystal);
  for (let x = cx - 16; x <= cx + 14; x++) px(g, x, 10, crystalDark);

  // ---- Head (rows 10-22) — angular hood/cowl ----
  for (let y = 10; y <= 22; y++) {
    const t = (y - 10) / 12;
    const halfW = 12 - Math.max(0, 4 - y + 10) * 0.4 + Math.sin(t * Math.PI) * 1;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, ice);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, iceMid);
      else if (y < 14 && x > cx - 3 && x < cx + 3) px(g, x, y, iceLight);
      else if (y < 18) px(g, x, y, iceMid);
      else px(g, x, y, ice);
    }
  }

  // ---- Face (pale, frozen) ----
  for (let y = 14; y <= 20; y++) for (let x = cx - 7; x <= cx + 7; x++) px(g, x, y, 0xe8f5ff, 0.9);
  // face outline shading
  px(g, cx - 8, 15, ice, 0.6); px(g, cx + 8, 15, ice, 0.6);

  // ---- Glowing eyes (pale blue) ----
  for (let y = 16; y <= 18; y++) {
    px(g, cx - 5, y, eyeGlow); px(g, cx + 5, y, eyeGlow);
  }
  px(g, cx - 5, 17, eyeCore); px(g, cx + 5, 17, eyeCore);
  px(g, cx - 6, 17, eyeGlow, 0.5); px(g, cx + 6, 17, eyeGlow, 0.5);
  // icy eyelashes (crystal spikes)
  px(g, cx - 6, 15, iceBright, 0.8); px(g, cx + 6, 15, iceBright, 0.8);
  // mouth (thin cold line)
  for (let x = cx - 3; x <= cx + 3; x++) px(g, x, 21, ice, 0.8);

  // ---- Flowing crystalline robe (rows 23-76) — wide skirt ----
  const bodyRows = 54;
  for (let i = 0; i < bodyRows; i++) {
    const y = 23 + i;
    const t = i / bodyRows;
    const halfW = 13 + t * 17;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W || y >= H) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      const alpha = i > bodyRows - 6 ? Math.max(0.4, 1 - (i - (bodyRows - 6)) * 0.12) : 1;
      if (left || right) px(g, x, y, outline, alpha);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, ice, alpha);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, ice, alpha);
      else if (i % 6 === 0 && x < cx) px(g, x, y, iceMid, alpha * 0.7);
      else if (i % 5 === 0 && x > cx) px(g, x, y, iceLight, alpha * 0.6);
      else if (i < 6 && Math.abs(x - cx) < 7) px(g, x, y, iceLight, alpha);
      else if (Math.abs(x - cx) < 4 && i > 10 && i < 40) px(g, x, y, iceMid, alpha);
      else px(g, x, y, ice, alpha);
    }
  }

  // ---- Frost trim belt ----
  for (let x = cx - 12; x <= cx + 12; x++) px(g, x, 34, frost);
  for (let x = cx - 12; x <= cx + 12; x++) px(g, x, 35, iceBright);
  // belt crystal
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < 2) px(g, cx + dx, 34 + dy, d < 1 ? eyeCore : iceBright);
  }

  // ---- Crystalline fold lines ----
  for (let y = 24; y < 34; y += 3) { px(g, cx - 6, y, ice, 0.7); px(g, cx + 6, y, ice, 0.7); }
  for (let y = 36; y < 72; y += 4) {
    px(g, cx - 8, y, ice, 0.5); px(g, cx + 8, y, ice, 0.5);
    px(g, cx - 3, y, iceMid, 0.5); px(g, cx + 3, y, iceMid, 0.5);
  }

  // ---- Ice shard fringe at hem ----
  const shards = [cx - 24, cx - 18, cx - 12, cx - 6, cx, cx + 6, cx + 12, cx + 18, cx + 24];
  shards.forEach((x, i) => {
    const len = 3 + (i % 2) * 2;
    for (let y = H - len; y < H; y++) px(g, x, y, iceBright, Math.max(0.4, 1 - (y - (H - len)) * 0.15));
    px(g, x, H - len, outline, 0.6);
  });

  // ---- Arms (crystalline, flowing) ----
  for (let y = 28; y <= 48; y++) {
    px(g, cx - 17, y, outline); px(g, cx - 16, y, ice); px(g, cx - 15, y, iceMid);
    px(g, cx + 17, y, outline); px(g, cx + 16, y, ice); px(g, cx + 15, y, iceMid);
  }
  // icy hands
  for (let dy = 0; dy < 3; dy++) for (let dx = -2; dx <= 2; dx++) {
    px(g, cx - 16 + dx, 49 + dy, dx === -2 || dx === 2 || dy === 2 ? outline : iceLight);
    px(g, cx + 16 + dx, 49 + dy, dx === -2 || dx === 2 || dy === 2 ? outline : iceLight);
  }
  // finger spikes
  px(g, cx - 18, 52, iceBright, 0.8); px(g, cx - 14, 52, iceBright, 0.8);
  px(g, cx + 18, 52, iceBright, 0.8); px(g, cx + 14, 52, iceBright, 0.8);

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, H - 1, 46, 4);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: SHADOW REAPER (68x82) — dark hooded reaper with scythe, black/purple ----------------
// Clean pixel art: dark outline, shadow palette, glowing red eyes, skeletal hands, scythe.
function generateShadowReaperBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.shadowReaper;
  if (scene.textures.exists(KEY)) return;
  const W = 68;
  const H = 82;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x08040e;      // near-black purple outline
  const robe = 0x2a1a3a;         // dark shadow robe
  const robeDark = 0x1a0e28;     // shadow fold
  const robeLight = 0x4a3468;    // highlight fold
  const voidc = 0x06030c;        // face void
  const eye = 0xff4040;          // glowing red eye
  const eyeCore = 0xffe0e0;     // eye core
  const bone = 0xd0c8e0;        // bone/blade
  const boneDark = 0x8a82a0;    // bone shadow
  const scytheBlade = 0x6a5a8a;  // dark scythe blade
  const scytheEdge = 0xa898d8;   // scythe edge

  const cx = 33;

  // ---- Hood (rounded dome, rows 2-20) ----
  for (let y = 2; y <= 20; y++) {
    const t = (y - 2) / 18;
    const halfW = 13 - Math.max(0, 7 - y + 2) * 0.32 + Math.sin(t * Math.PI) * 1.2;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, robeDark);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, robeDark);
      else if (y < 10 && x > cx - 4 && x < cx + 4) px(g, x, y, robeLight);
      else if (y < 14) px(g, x, y, robeLight);
      else px(g, x, y, robe);
    }
  }
  // hood top cap
  for (let x = cx - 3; x <= cx + 3; x++) px(g, x, 1, robeLight);
  px(g, cx - 4, 2, outline); px(g, cx + 4, 2, outline);

  // ---- Face void (deep shadow inside hood) ----
  for (let y = 10; y <= 20; y++) for (let x = cx - 8; x <= cx + 8; x++) px(g, x, y, voidc, 0.95);

  // ---- Glowing red eyes (twin pinpoints) ----
  for (let y = 14; y <= 16; y++) {
    for (let x = cx - 7; x <= cx - 4; x++) px(g, x, y, eye, 0.85);
    for (let x = cx + 4; x <= cx + 7; x++) px(g, x, y, eye, 0.85);
  }
  px(g, cx - 6, 15, eyeCore); px(g, cx + 6, 15, eyeCore);
  // eye glow bleed
  px(g, cx - 8, 15, eye, 0.4); px(g, cx + 8, 15, eye, 0.4);
  px(g, cx - 3, 15, eye, 0.5); px(g, cx + 3, 15, eye, 0.5);

  // ---- Tattered robe body (rows 21-72) — widening skirt ----
  const bodyRows = 52;
  for (let i = 0; i < bodyRows; i++) {
    const y = 21 + i;
    const t = i / bodyRows;
    const halfW = 13 + t * 15;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W || y >= H) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      const alpha = i > bodyRows - 8 ? Math.max(0.2, 1 - (i - (bodyRows - 8)) * 0.1) : 1;
      if (left || right) px(g, x, y, outline, alpha);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, robeDark, alpha);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, robeDark, alpha);
      else if (i % 5 === 0 && x < cx) px(g, x, y, robeDark, alpha);
      else if (i % 4 === 0 && x > cx) px(g, x, y, robeLight, alpha * 0.5);
      else if (i < 8 && Math.abs(x - cx) < 6) px(g, x, y, robeLight, alpha);
      else px(g, x, y, robe, alpha);
    }
  }

  // ---- Fold lines / shading ----
  for (let y = 22; y < 32; y += 4) { px(g, cx - 6, y, robeDark); px(g, cx + 6, y, robeDark); }
  for (let y = 34; y < 70; y += 5) { px(g, cx - 4, y, robeDark, 0.6); px(g, cx + 4, y, robeDark, 0.6); }

  // ---- Skeletal arms emerging from sleeves ----
  // left arm
  for (let y = 28; y <= 42; y++) { px(g, cx - 15, y, robeDark); px(g, cx - 16, y, outline); }
  px(g, cx - 15, 43, bone); px(g, cx - 14, 44, bone); px(g, cx - 16, 44, boneDark);
  px(g, cx - 15, 45, boneDark);
  // bony fingers
  px(g, cx - 17, 45, bone, 0.7); px(g, cx - 13, 45, bone, 0.7);

  // ---- Scythe (right side, large curved blade) ----
  // Scythe handle (long pole, right side)
  for (let y = 24; y <= 74; y++) {
    px(g, cx + 22, y, outline);
    px(g, cx + 23, y, boneDark);
    px(g, cx + 24, y, bone);
  }
  // Scythe blade (curved arc at top of pole)
  const bladePath: Array<[number, number]> = [
    [cx + 24, 24], [cx + 26, 22], [cx + 29, 20], [cx + 32, 19], [cx + 35, 19],
    [cx + 38, 20], [cx + 40, 22], [cx + 41, 25], [cx + 41, 28], [cx + 40, 31],
    [cx + 38, 33], [cx + 35, 34], [cx + 32, 34],
  ];
  bladePath.forEach(([x, y]) => {
    px(g, x, y, outline);
    px(g, x - 1, y, scytheBlade);
    px(g, x, y, scytheEdge, 0.7);
  });
  // blade fill (inner curve)
  for (let i = 0; i < bladePath.length - 1; i++) {
    const [x0, y0] = bladePath[i];
    const [x1, y1] = bladePath[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      px(g, x - 1, y, scytheBlade);
    }
  }
  // blade inner shadow
  for (let i = 2; i < bladePath.length - 2; i++) {
    const [x, y] = bladePath[i];
    px(g, x - 2, y, robeDark, 0.6);
  }
  // scythe glint
  px(g, cx + 36, 21, 0xe0d8ff, 0.8); px(g, cx + 37, 22, 0xc0b8e0, 0.6);

  // ---- Ragged hem tendrils (shadow wisps) ----
  const hemTendrils = [cx - 20, cx - 12, cx - 4, cx + 4, cx + 12, cx + 20];
  hemTendrils.forEach((x, i) => {
    const len = 4 + (i % 3);
    for (let y = H - len; y < H; y++) px(g, x, y, robeDark, Math.max(0.15, 1 - (y - (H - len)) * 0.2));
  });

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, H - 1, 42, 4);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: LIGHT PALADIN (70x80) — golden armored paladin, holy/holy beams ----------------
// Clean pixel art: dark outline, gold + white palette, glowing halo, holy sword, holy shield.
function generateLightPaladinBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.lightPaladin;
  if (scene.textures.exists(KEY)) return;
  const W = 70;
  const H = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x2a1e08;      // dark gold outline
  const gold = 0xe8c44a;         // gold armor
  const goldDark = 0xa88830;     // gold shadow
  const goldLight = 0xfff0a0;    // gold highlight
  const goldPale = 0xfff8d0;     // pale gold
  const steel = 0xc0c8d8;        // steel/white
  const steelDark = 0x8a90a8;    // steel shadow
  const steelLight = 0xe8ecf4;   // steel highlight
  const holy = 0xfff8e0;         // holy glow
  const holyCore = 0xffffff;    // holy core
  const eyeGlow = 0xffe8a0;      // eye glow

  const cx = 34;

  // ---- Halo (ring of light above head, rows 0-8) ----
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 4 && d < 12) {
        const a = Math.max(0, 1 - Math.abs(d - 8) / 4) * 0.7;
        px(g, cx + dx, 5 + dy, holy, a);
      }
    }
  }
  // halo bright ring
  for (let a = 0; a < 28; a++) {
    const ang = (a / 28) * Math.PI * 2;
    const rx = Math.round(cx + Math.cos(ang) * 9);
    const ry = Math.round(5 + Math.sin(ang) * 4);
    px(g, rx, ry, holyCore, 0.8);
  }

  // ---- Helm (rows 6-18) — angular gold helm ----
  for (let y = 6; y <= 18; y++) {
    const t = (y - 6) / 12;
    const halfW = 11 - Math.max(0, 5 - y + 6) * 0.35 + Math.sin(t * Math.PI) * 1;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, goldDark);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, goldDark);
      else if (y < 10 && x > cx - 3 && x < cx + 3) px(g, x, y, goldLight);
      else if (y < 14) px(g, x, y, gold);
      else px(g, x, y, goldDark);
    }
  }
  // helm crest (vertical gold ridge)
  for (let y = 4; y <= 10; y++) px(g, cx, y, goldLight);
  px(g, cx, 3, goldPale);
  // helm brow
  for (let x = cx - 9; x <= cx + 9; x++) px(g, x, 10, goldDark);

  // ---- Face (visor slit with glowing eyes) ----
  for (let y = 12; y <= 16; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) px(g, x, y, steel, 0.9);
  }
  // visor slit
  for (let x = cx - 6; x <= cx + 6; x++) px(g, x, 14, outline);
  // glowing eyes through visor
  for (let x = cx - 5; x <= cx - 3; x++) px(g, x, 14, eyeGlow);
  for (let x = cx + 3; x <= cx + 5; x++) px(g, x, 14, eyeGlow);
  px(g, cx - 4, 14, holyCore); px(g, cx + 4, 14, holyCore);
  // visor glow bleed
  px(g, cx - 7, 14, eyeGlow, 0.4); px(g, cx + 7, 14, eyeGlow, 0.4);

  // ---- Pauldrons (shoulders, rows 19-26) — wide, ornate ----
  for (let y = 19; y <= 26; y++) {
    const t = (y - 19) / 7;
    const halfW = 20 - Math.abs(0.5 - t) * 4;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, goldLight);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, goldDark);
      else if (y < 22 && Math.abs(x - cx) < 6) px(g, x, y, goldLight);
      else px(g, x, y, gold);
    }
  }
  // pauldron spikes
  px(g, cx - 20, 19, outline); px(g, cx - 19, 20, goldDark); px(g, cx - 20, 21, gold);
  px(g, cx + 20, 19, outline); px(g, cx + 19, 20, goldDark); px(g, cx + 20, 21, gold);

  // ---- Chestplate (rows 27-56) — tapering block with holy symbol ----
  for (let y = 27; y <= 56; y++) {
    const t = (y - 27) / 29;
    const halfW = 18 - t * 4;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, goldDark);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, goldDark);
      else if ((x + y) % 7 === 0) px(g, x, y, goldDark);
      else px(g, x, y, gold);
    }
  }
  // holy symbol on chest (glowing cross)
  for (let y = 34; y <= 46; y++) px(g, cx, y, holyCore, 0.9);
  for (let x = cx - 4; x <= cx + 4; x++) px(g, x, 38, holyCore, 0.9);
  // cross glow
  px(g, cx, 38, holy); px(g, cx, 39, holy);
  px(g, cx - 1, 38, holy, 0.7); px(g, cx + 1, 38, holy, 0.7);

  // ---- Belt (gold with gem) ----
  for (let x = cx - 14; x <= cx + 14; x++) {
    px(g, x, 54, goldDark);
    px(g, x, 55, goldLight);
  }
  // belt gem (holy crystal)
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < 2) px(g, cx + dx, 54 + dy, d < 1 ? holyCore : holy);
  }

  // ---- Holy sword (right hand, large blade) ----
  for (let y = 26; y <= 64; y++) {
    px(g, cx + 24, y, outline);
    px(g, cx + 25, y, steelDark);
    px(g, cx + 26, y, steel);
    px(g, cx + 27, y, steelLight);
  }
  // sword crossguard
  for (let x = cx + 21; x <= cx + 29; x++) px(g, x, 62, gold);
  px(g, cx + 24, 62, goldDark); px(g, cx + 26, 62, goldDark);
  // sword pommel
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    px(g, cx + 25 + dx, 66 + dy, goldLight);
  // blade glow
  for (let y = 28; y <= 60; y += 4) px(g, cx + 26, y, holy, 0.5);
  px(g, cx + 27, 30, holyCore, 0.7); px(g, cx + 27, 40, holyCore, 0.5);

  // ---- Holy shield (left arm) ----
  for (let y = 30; y <= 52; y++) {
    for (let x = cx - 26; x <= cx - 18; x++) {
      const edge = x === cx - 26 || x === cx - 18 || y === 30 || y === 52;
      if (edge) px(g, x, y, outline);
      else if (x === cx - 25) px(g, x, y, goldDark);
      else if (x === cx - 19) px(g, x, y, goldLight);
      else px(g, x, y, gold);
    }
  }
  // shield holy emblem
  for (let y = 38; y <= 44; y++) px(g, cx - 22, y, holyCore, 0.8);
  for (let x = cx - 24; x <= cx - 20; x++) px(g, x, 41, holyCore, 0.8);

  // ---- Legs (rows 57-78) — armored greaves ----
  for (let y = 57; y <= 76; y++) {
    // left leg
    for (let x = cx - 12; x <= cx - 4; x++) {
      const left = x === cx - 12; const right = x === cx - 4;
      if (left || right) px(g, x, y, outline);
      else if (x === cx - 11) px(g, x, y, goldDark);
      else px(g, x, y, steel);
    }
    // right leg
    for (let x = cx + 4; x <= cx + 12; x++) {
      const left = x === cx + 4; const right = x === cx + 12;
      if (left || right) px(g, x, y, outline);
      else if (x === cx + 11) px(g, x, y, goldDark);
      else px(g, x, y, steel);
    }
  }
  // greave gold trim
  for (let y = 60; y < 76; y += 4) {
    px(g, cx - 10, y, gold); px(g, cx + 10, y, gold);
  }
  // feet
  for (let x = cx - 13; x <= cx - 4; x++) px(g, x, 77, outline);
  for (let x = cx + 4; x <= cx + 13; x++) px(g, x, 77, outline);
  for (let x = cx - 12; x <= cx - 5; x++) px(g, x, 76, goldDark);
  for (let x = cx + 5; x <= cx + 12; x++) px(g, x, 76, goldDark);

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, 78, 48, 5);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: STORM TITAN (72x84) — crackling lightning giant, blue/yellow ----------------
// Clean pixel art: dark outline, storm-blue + electric-yellow palette, crackling energy, glowing eyes.
function generateStormTitanBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.stormTitan;
  if (scene.textures.exists(KEY)) return;
  const W = 72;
  const H = 84;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x0a1428;      // dark storm outline
  const storm = 0x2a4a7a;       // storm blue
  const stormMid = 0x4a78b0;    // mid storm
  const stormLight = 0x6a98d8;  // light storm
  const electric = 0xffe040;    // electric yellow
  const electricBright = 0xffffa0; // bright electric
  const electricCore = 0xffffff; // white core
  const eyeGlow = 0xffff80;     // eye glow

  const cx = 35;

  // ---- Storm crown (crackling energy spikes, rows 0-8) ----
  const crownSpikes = [
    { x: cx - 16, h: 6 },
    { x: cx - 10, h: 9 },
    { x: cx - 4, h: 7 },
    { x: cx + 2, h: 10 },
    { x: cx + 8, h: 7 },
    { x: cx + 14, h: 6 },
  ];
  crownSpikes.forEach((s) => {
    for (let y = 0; y < s.h; y++) {
      const yt = s.h - y;
      px(g, s.x, y, y === 0 ? electricCore : yt > s.h - 2 ? storm : electricBright);
      px(g, s.x - 1, y + 1, storm, 0.7);
      px(g, s.x + 1, y, electric, 0.8);
    }
    px(g, s.x, 0, 0xffffff);
  });
  // crown base
  for (let x = cx - 17; x <= cx + 15; x++) px(g, x, 8, outline);
  for (let x = cx - 16; x <= cx + 14; x++) px(g, x, 9, stormMid);

  // ---- Head (rows 9-20) — angular storm face ----
  for (let y = 9; y <= 20; y++) {
    const t = (y - 9) / 11;
    const halfW = 11 - Math.max(0, 4 - y + 9) * 0.35 + Math.sin(t * Math.PI) * 1;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, storm);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, stormMid);
      else if (y < 13 && x > cx - 3 && x < cx + 3) px(g, x, y, stormLight);
      else if (y < 16) px(g, x, y, stormMid);
      else px(g, x, y, storm);
    }
  }
  // face energy cracks
  px(g, cx - 6, 14, electric, 0.7); px(g, cx + 6, 14, electric, 0.7);

  // ---- Glowing eyes (electric yellow) ----
  for (let y = 15; y <= 17; y++) {
    for (let x = cx - 7; x <= cx - 4; x++) px(g, x, y, eyeGlow);
    for (let x = cx + 4; x <= cx + 7; x++) px(g, x, y, eyeGlow);
  }
  px(g, cx - 6, 16, electricCore); px(g, cx + 6, 16, electricCore);
  px(g, cx - 8, 16, electric, 0.5); px(g, cx + 8, 16, electric, 0.5);
  // electric mouth
  for (let x = cx - 4; x <= cx + 4; x++) px(g, x, 19, electric, 0.8);
  px(g, cx - 2, 20, electricBright); px(g, cx + 2, 20, electricBright);

  // ---- Massive shoulders (rows 21-30) — crackling pauldrons ----
  for (let y = 21; y <= 30; y++) {
    const t = (y - 21) / 9;
    const halfW = 22 - Math.abs(0.5 - t) * 4;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, stormLight);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, stormMid);
      else px(g, x, y, storm);
    }
  }
  // shoulder electric vents
  for (let y = 22; y <= 26; y++) {
    px(g, cx - 21, y, electric, 0.8); px(g, cx + 21, y, electric, 0.8);
  }
  px(g, cx - 22, 24, electricBright); px(g, cx + 22, 24, electricBright);

  // ---- Torso (rows 21-58) — tapering block with energy core ----
  for (let y = 21; y <= 58; y++) {
    const t = (y - 21) / 37;
    const halfW = 22 - t * 6;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, storm);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, storm);
      else if ((x + y) % 8 === 0) px(g, x, y, stormMid);
      else px(g, x, y, storm);
    }
  }

  // ---- Lightning cracks across body (jagged energy veins) ----
  const crackPaths: Array<[number, number]> = [
    [cx - 1, 22], [cx, 23], [cx + 1, 24], [cx, 25], [cx - 1, 26], [cx, 27], [cx + 1, 28], [cx, 29],
    [cx - 10, 24], [cx - 11, 25], [cx - 12, 26], [cx - 13, 27], [cx - 14, 28],
    [cx + 10, 24], [cx + 11, 25], [cx + 12, 26], [cx + 13, 27], [cx + 14, 28],
    [cx - 6, 40], [cx - 5, 41], [cx - 4, 42], [cx - 3, 43],
    [cx + 6, 40], [cx + 5, 41], [cx + 4, 42], [cx + 3, 43],
    [cx - 2, 48], [cx - 1, 49], [cx, 50], [cx + 1, 51], [cx + 2, 52],
  ];
  crackPaths.forEach(([x, y]) => px(g, x, y, electric, 0.9));
  crackPaths.forEach(([x, y], i) => { if (i % 3 === 0) px(g, x, y, electricBright); });

  // ---- Energy core (lightning heart) ----
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 4) px(g, cx + dx, 36 + dy, d < 1.5 ? electricCore : d < 2.8 ? electricBright : electric);
    }
  }
  px(g, cx - 5, 36, electric, 0.5); px(g, cx + 5, 36, electric, 0.5);
  px(g, cx, 31, electric, 0.5); px(g, cx, 41, electric, 0.5);

  // ---- Arms (thick storm, rows 24-56) ----
  // left arm
  for (let y = 24; y <= 54; y++) {
    px(g, cx - 24, y, outline); px(g, cx - 23, y, stormLight); px(g, cx - 22, y, storm);
  }
  // right arm
  for (let y = 24; y <= 54; y++) {
    px(g, cx + 24, y, outline); px(g, cx + 23, y, stormLight); px(g, cx + 22, y, storm);
  }
  // arm electric cracks
  for (let y = 30; y <= 40; y += 2) { px(g, cx - 23, y, electric, 0.7); px(g, cx + 23, y, electric, 0.7); }
  // fists (crackling)
  for (let y = 55; y <= 60; y++) for (let x = cx - 27; x <= cx - 21; x++) {
    const edge = x === cx - 27 || x === cx - 21 || y === 60;
    px(g, x, y, edge ? outline : stormMid);
  }
  for (let y = 55; y <= 60; y++) for (let x = cx + 21; x <= cx + 27; x++) {
    const edge = x === cx + 21 || x === cx + 27 || y === 60;
    px(g, x, y, edge ? outline : stormMid);
  }
  px(g, cx - 24, 58, electric); px(g, cx + 24, 58, electric);
  // electric arcs from fists
  px(g, cx - 25, 57, electricBright, 0.7); px(g, cx + 25, 57, electricBright, 0.7);

  // ---- Legs (rows 59-80) ----
  for (let y = 59; y <= 78; y++) {
    for (let x = cx - 14; x <= cx - 4; x++) {
      const left = x === cx - 14; const right = x === cx - 4;
      if (left || right) px(g, x, y, outline);
      else px(g, x, y, storm);
    }
    for (let x = cx + 4; x <= cx + 14; x++) {
      const left = x === cx + 4; const right = x === cx + 14;
      if (left || right) px(g, x, y, outline);
      else px(g, x, y, storm);
    }
  }
  // leg cracks
  px(g, cx - 10, 64, electric, 0.8); px(g, cx - 9, 65, electric); px(g, cx - 10, 66, electricBright, 0.8);
  px(g, cx + 10, 64, electric, 0.8); px(g, cx + 9, 65, electric); px(g, cx + 10, 66, electricBright, 0.8);
  // feet
  for (let x = cx - 16; x <= cx - 4; x++) px(g, x, 79, outline);
  for (let x = cx - 15; x <= cx - 5; x++) px(g, x, 78, stormMid);
  for (let x = cx + 4; x <= cx + 16; x++) px(g, x, 79, outline);
  for (let x = cx + 5; x <= cx + 15; x++) px(g, x, 78, stormMid);

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, 80, 52, 5);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: TEMPEST DRAGON (76x72) — flying wind dragon, teal/green ----------------
// Clean pixel art: dark outline, wind-teal palette, wings, horns, glowing eyes, wind currents.
function generateTempestDragonBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.tempestDragon;
  if (scene.textures.exists(KEY)) return;
  const W = 76;
  const H = 72;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x0a1e1a;      // dark teal outline
  const scale = 0x2a7a68;       // dragon scale
  const scaleMid = 0x4aa898;    // mid scale
  const scaleLight = 0x7ad8c0;  // light scale
  const scalePale = 0xa8f0e0;   // pale scale highlight
  const wing = 0x3a8a78;        // wing membrane
  const wingDark = 0x1a5a4a;    // wing shadow
  const eye = 0xa0ffe0;         // glowing eye
  const eyeCore = 0xffffff;     // eye core
  const horn = 0xe0e8d0;        // horn
  const hornDark = 0x8a9878;    // horn shadow
  const wind = 0xc0f0e8;        // wind current

  const cx = 37;

  // ---- Wings (spread, rows 8-40) — large membrane wings on both sides ----
  // Left wing
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const wingY = 12 + Math.sin(t * Math.PI) * 8;
    const wingX = cx - 10 - t * 28;
    // wing membrane
    for (let w = 0; w < 6; w++) {
      const wy = wingY + w * 0.5 - 1.5;
      const wx = wingX + w * 0.3;
      if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
      const edge = w === 0 || w === 5;
      if (edge) px(g, Math.round(wx), Math.round(wy), outline, 0.8);
      else if (w === 1) px(g, Math.round(wx), Math.round(wy), wingDark, 0.8);
      else px(g, Math.round(wx), Math.round(wy), wing, 0.7);
    }
  }
  // Left wing finger struts (bony supports)
  for (let i = 0; i < 4; i++) {
    const ang = -0.3 - i * 0.4;
    for (let r = 6; r < 30; r++) {
      const x = Math.round(cx - 8 + Math.cos(ang) * r);
      const y = Math.round(14 + Math.sin(ang) * r);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      px(g, x, y, wingDark, 0.6);
    }
  }

  // Right wing
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const wingY = 12 + Math.sin(t * Math.PI) * 8;
    const wingX = cx + 10 + t * 28;
    for (let w = 0; w < 6; w++) {
      const wy = wingY + w * 0.5 - 1.5;
      const wx = wingX - w * 0.3;
      if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
      const edge = w === 0 || w === 5;
      if (edge) px(g, Math.round(wx), Math.round(wy), outline, 0.8);
      else if (w === 1) px(g, Math.round(wx), Math.round(wy), wingDark, 0.8);
      else px(g, Math.round(wx), Math.round(wy), wing, 0.7);
    }
  }
  // Right wing finger struts
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI + 0.3 + i * 0.4;
    for (let r = 6; r < 30; r++) {
      const x = Math.round(cx + 8 + Math.cos(ang) * r);
      const y = Math.round(14 + Math.sin(ang) * r);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      px(g, x, y, wingDark, 0.6);
    }
  }

  // ---- Head (rows 2-18) — angular dragon head ----
  for (let y = 2; y <= 18; y++) {
    const t = (y - 2) / 16;
    const halfW = 10 - Math.max(0, 6 - y + 2) * 0.3 + Math.sin(t * Math.PI) * 1.5;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, scale);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, scaleMid);
      else if (y < 8 && x > cx - 3 && x < cx + 3) px(g, x, y, scaleLight);
      else if (y < 12) px(g, x, y, scaleMid);
      else px(g, x, y, scale);
    }
  }
  // snout extension (front)
  for (let y = 12; y <= 16; y++) {
    for (let x = cx + 8; x <= cx + 16; x++) {
      const edge = x === cx + 16 || y === 12;
      if (edge) px(g, x, y, outline);
      else px(g, x, y, scale);
    }
  }
  // nostrils
  px(g, cx + 15, 14, outline); px(g, cx + 15, 15, outline);

  // ---- Horns (swept back from head) ----
  const hornPath = (x0: number, y0: number, dir: number) => {
    for (let i = 0; i < 8; i++) {
      const x = x0 + i * dir;
      const y = y0 - i * 0.3 + (i > 4 ? (i - 4) * 0.8 : 0);
      px(g, x, y, outline);
      px(g, x + dir, y, hornDark);
      px(g, x, y + 1, horn, 0.8);
    }
  };
  hornPath(cx - 8, 4, -1);
  hornPath(cx + 8, 4, 1);

  // ---- Glowing eyes ----
  for (let y = 8; y <= 10; y++) {
    px(g, cx - 6, y, eye); px(g, cx + 6, y, eye);
  }
  px(g, cx - 6, 9, eyeCore); px(g, cx + 6, 9, eyeCore);
  px(g, cx - 7, 9, eye, 0.5); px(g, cx + 7, 9, eye, 0.5);
  // brow ridge
  for (let x = cx - 8; x <= cx - 4; x++) px(g, x, 7, scaleLight);
  for (let x = cx + 4; x <= cx + 8; x++) px(g, x, 7, scaleLight);

  // ---- Neck (rows 18-24) ----
  for (let y = 18; y <= 24; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      const edge = x === cx - 7 || x === cx + 7;
      if (edge) px(g, x, y, outline);
      else px(g, x, y, scaleMid);
    }
  }

  // ---- Body (rows 24-58) — serpentine dragon torso ----
  for (let y = 24; y <= 58; y++) {
    const t = (y - 24) / 34;
    const halfW = 14 - t * 4 + Math.sin(t * Math.PI * 2) * 1.5;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, scale);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, scale);
      else if ((x + y) % 6 === 0) px(g, x, y, scaleLight, 0.6);
      else if (Math.abs(x - cx) < 4 && y > 30 && y < 50) px(g, x, y, scaleLight, 0.5);
      else px(g, x, y, scaleMid);
    }
  }
  // scale pattern lines
  for (let y = 28; y < 56; y += 3) {
    for (let x = cx - 10; x <= cx + 10; x += 4) {
      px(g, x, y, scaleLight, 0.4);
    }
  }
  // belly scales (lighter ventral)
  for (let y = 30; y <= 54; y += 2) {
    for (let x = cx - 3; x <= cx + 3; x++) px(g, x, y, scalePale, 0.3);
  }

  // ---- Spinal ridge (dorsal fins) ----
  for (let y = 22; y <= 56; y += 4) {
    px(g, cx, y, scaleLight);
    px(g, cx, y - 1, scalePale, 0.8);
    px(g, cx - 1, y, scaleMid, 0.7);
  }

  // ---- Tail (rows 58-68) — tapering ----
  for (let y = 58; y <= 68; y++) {
    const t = (y - 58) / 10;
    const halfW = (10 - t * 8) * 0.6;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      if (edge) px(g, x, y, outline);
      else px(g, x, y, scale);
    }
  }
  // tail fin
  px(g, cx - 2, 68, scaleLight, 0.7); px(g, cx + 2, 68, scaleLight, 0.7);
  px(g, cx - 3, 69, wingDark, 0.5); px(g, cx + 3, 69, wingDark, 0.5);

  // ---- Wind currents (swirling wisps around body) ----
  const windWisps: Array<[number, number]> = [
    [cx - 30, 20], [cx - 28, 24], [cx - 26, 22],
    [cx + 30, 20], [cx + 28, 24], [cx + 26, 22],
    [cx - 24, 48], [cx - 22, 52], [cx - 20, 50],
    [cx + 24, 48], [cx + 22, 52], [cx + 20, 50],
  ];
  windWisps.forEach(([x, y]) => px(g, x, y, wind, 0.4));

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx + 0.5, H - 1, 52, 4);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: TIDE LEVIATHAN (78x80) — massive sea serpent, blue/teal ----------------
// Clean pixel art: dark outline, ocean palette, scales, fins, glowing eyes, water droplets.
function generateTideLeviathanBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.tideLeviathan;
  if (scene.textures.exists(KEY)) return;
  const W = 78;
  const H = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x08182a;      // dark ocean outline
  const deep = 0x1a4a78;         // deep blue
  const scale = 0x2a8ad8;        // sea scale
  const scaleMid = 0x4aa8e8;     // mid scale
  const scaleLight = 0x7ac8f0;   // light scale
  const scalePale = 0xa8e0f8;    // pale scale
  const foam = 0xe0f4ff;         // sea foam white
  const eye = 0x40e0ff;          // glowing eye
  const eyeCore = 0xffffff;     // eye core
  const fin = 0x2a7ab0;          // fin membrane
  const finDark = 0x1a5a88;      // fin shadow

  const cx = 38;

  // ---- Head (rows 2-18) — serpentine sea dragon head ----
  for (let y = 2; y <= 18; y++) {
    const t = (y - 2) / 16;
    const halfW = 12 - Math.max(0, 6 - y + 2) * 0.35 + Math.sin(t * Math.PI) * 1.5;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, deep);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, scale);
      else if (y < 8 && x > cx - 3 && x < cx + 3) px(g, x, y, scaleLight);
      else if (y < 12) px(g, x, y, scaleMid);
      else px(g, x, y, scale);
    }
  }
  // elongated snout
  for (let y = 12; y <= 16; y++) {
    for (let x = cx + 10; x <= cx + 20; x++) {
      const edge = x === cx + 20 || y === 12;
      if (edge) px(g, x, y, outline);
      else px(g, x, y, scale);
    }
  }
  // nostrils
  px(g, cx + 19, 14, outline); px(g, cx + 19, 15, outline);
  // jaw teeth
  for (let x = cx + 10; x <= cx + 18; x += 2) px(g, x, 16, foam, 0.7);

  // ---- Head fins/crests ----
  // dorsal crest spikes
  for (let i = 0; i < 5; i++) {
    const x = cx - 8 + i * 4;
    for (let y = 0; y < 4; y++) {
      px(g, x, y, y === 0 ? foam : y === 3 ? deep : fin);
      px(g, x - 1, y + 1, finDark, 0.7);
    }
  }
  // side fins (head)
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    px(g, cx - 14 - i * 2, 10 + Math.sin(t * Math.PI) * 3, outline, 0.8);
    px(g, cx - 13 - i * 2, 10 + Math.sin(t * Math.PI) * 3, fin, 0.7);
    px(g, cx + 14 + i * 2, 10 + Math.sin(t * Math.PI) * 3, outline, 0.8);
    px(g, cx + 13 + i * 2, 10 + Math.sin(t * Math.PI) * 3, fin, 0.7);
  }

  // ---- Glowing eyes ----
  for (let y = 8; y <= 11; y++) {
    for (let x = cx - 8; x <= cx - 5; x++) px(g, x, y, eye);
    for (let x = cx + 5; x <= cx + 8; x++) px(g, x, y, eye);
  }
  px(g, cx - 7, 10, eyeCore); px(g, cx + 7, 10, eyeCore);
  px(g, cx - 9, 10, eye, 0.5); px(g, cx + 9, 10, eye, 0.5);
  // brow ridge
  for (let x = cx - 9; x <= cx - 5; x++) px(g, x, 7, scaleLight);
  for (let x = cx + 5; x <= cx + 9; x++) px(g, x, 7, scaleLight);

  // ---- Neck (rows 18-26) — thick serpentine ----
  for (let y = 18; y <= 26; y++) {
    const t = (y - 18) / 8;
    const halfW = 10 + Math.sin(t * Math.PI) * 2;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      if (edge) px(g, x, y, outline);
      else if ((x + y) % 6 === 0) px(g, x, y, scaleLight, 0.5);
      else px(g, x, y, scaleMid);
    }
  }

  // ---- Body (rows 26-66) — massive serpentine coil ----
  for (let y = 26; y <= 66; y++) {
    const t = (y - 26) / 40;
    const halfW = 16 - t * 6 + Math.sin(t * Math.PI * 2.5) * 3;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, deep);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, deep);
      else if ((x + y) % 7 === 0) px(g, x, y, scaleLight, 0.5);
      else if (Math.abs(x - cx) < 5 && y > 34 && y < 58) px(g, x, y, scaleLight, 0.4);
      else px(g, x, y, scale);
    }
  }
  // scale pattern
  for (let y = 30; y < 64; y += 3) {
    for (let x = cx - 12; x <= cx + 12; x += 4) {
      px(g, x, y, scaleLight, 0.4);
    }
  }
  // belly scales
  for (let y = 32; y <= 62; y += 2) {
    for (let x = cx - 4; x <= cx + 4; x++) px(g, x, y, scalePale, 0.3);
  }

  // ---- Spinal ridge (dorsal fin) ----
  for (let y = 22; y <= 64; y += 3) {
    px(g, cx, y, scaleLight);
    px(g, cx, y - 1, foam, 0.6);
    px(g, cx - 1, y, scaleMid, 0.6);
    px(g, cx + 1, y, scaleMid, 0.6);
  }

  // ---- Side fins (paddle-like) ----
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const fy = 36 + i;
    // left fin
    const flx = cx - 16 - Math.sin(t * Math.PI) * 8;
    px(g, Math.round(flx), fy, outline, 0.7);
    px(g, Math.round(flx + 1), fy, fin, 0.6);
    // right fin
    const frx = cx + 16 + Math.sin(t * Math.PI) * 8;
    px(g, Math.round(frx), fy, outline, 0.7);
    px(g, Math.round(frx - 1), fy, fin, 0.6);
  }

  // ---- Tail (rows 66-76) — tapering whip ----
  for (let y = 66; y <= 76; y++) {
    const t = (y - 66) / 10;
    const halfW = (10 - t * 9) * 0.7;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      if (edge) px(g, x, y, outline);
      else px(g, x, y, scale);
    }
  }
  // tail fluke
  px(g, cx - 4, 76, fin, 0.7); px(g, cx + 4, 76, fin, 0.7);
  px(g, cx - 5, 77, finDark, 0.5); px(g, cx + 5, 77, finDark, 0.5);

  // ---- Water droplets/foam ----
  const droplets: Array<[number, number]> = [
    [cx - 22, 28], [cx + 22, 30], [cx - 26, 40], [cx + 26, 42],
    [cx - 20, 50], [cx + 20, 52], [cx - 28, 58], [cx + 28, 60],
  ];
  droplets.forEach(([x, y]) => {
    px(g, x, y, foam, 0.6);
    px(g, x + 1, y, foam, 0.4);
  });

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx + 0.5, H - 1, 54, 4);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: GOLIATH (72x80) — muscular brute, brown/earth, pure physical ----------------
// Clean pixel art: dark outline, earth/brown palette, massive muscles, glowing fists, ground cracks.
function generateGoliathBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.goliath;
  if (scene.textures.exists(KEY)) return;
  const W = 72;
  const H = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x1a0e04;      // dark earth outline
  const skin = 0x8a6a3a;         // earth-tanned skin
  const skinDark = 0x5a4028;     // skin shadow
  const skinLight = 0xaa8a5a;    // skin highlight
  const skinPale = 0xc8a878;     // pale skin
  const muscle = 0x6a4a28;       // muscle definition
  const muscleDark = 0x4a3018;   // deep muscle
  const eye = 0xff8040;          // glowing orange eye
  const eyeCore = 0xffffa0;     // eye core
  const loincloth = 0x4a3a28;    // loincloth
  const loinclothDark = 0x2a1e10; // loincloth shadow
  const rock = 0x5a4a38;         // rock accents

  const cx = 35;

  // ---- Head (rows 4-18) — brutish, thick brow ----
  for (let y = 4; y <= 18; y++) {
    const t = (y - 4) / 14;
    const halfW = 10 - Math.max(0, 5 - y + 4) * 0.3 + Math.sin(t * Math.PI) * 1;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, skinDark);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, skinDark);
      else if (y < 8 && x > cx - 3 && x < cx + 3) px(g, x, y, skinLight);
      else if (y < 12) px(g, x, y, skinLight);
      else px(g, x, y, skin);
    }
  }
  // thick brow ridge
  for (let x = cx - 9; x <= cx + 9; x++) px(g, x, 10, skinDark);
  for (let x = cx - 8; x <= cx + 8; x++) px(g, x, 11, muscleDark, 0.8);

  // ---- Glowing eyes (fierce orange) ----
  px(g, cx - 6, 12, eye); px(g, cx + 6, 12, eye);
  px(g, cx - 5, 12, eyeCore, 0.8); px(g, cx + 5, 12, eyeCore, 0.8);
  px(g, cx - 7, 12, eye, 0.5); px(g, cx + 7, 12, eye, 0.5);
  // angry brow shadow
  px(g, cx - 7, 11, muscleDark); px(g, cx + 7, 11, muscleDark);
  // nose (broad)
  px(g, cx - 2, 14, skinDark); px(g, cx + 2, 14, skinDark);
  px(g, cx, 15, skinDark, 0.7);
  // mouth (grimace with tusks)
  for (let x = cx - 5; x <= cx + 5; x++) px(g, x, 17, outline, 0.8);
  // tusks (lower)
  px(g, cx - 4, 18, skinPale); px(g, cx - 4, 19, skinPale, 0.8);
  px(g, cx + 4, 18, skinPale); px(g, cx + 4, 19, skinPale, 0.8);

  // ---- Neck (thick) ----
  for (let y = 19; y <= 22; y++) for (let x = cx - 7; x <= cx + 7; x++) px(g, x, y, skinDark);

  // ---- Massive shoulders (rows 20-30) — hulking ----
  for (let y = 20; y <= 30; y++) {
    const t = (y - 20) / 10;
    const halfW = 24 - Math.abs(0.5 - t) * 6;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, skinLight);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, skinDark);
      else if (y < 24 && Math.abs(x - cx) < 6) px(g, x, y, skinLight);
      else px(g, x, y, skin);
    }
  }

  // ---- Torso (rows 22-58) — barrel chest, muscle definition ----
  for (let y = 22; y <= 58; y++) {
    const t = (y - 22) / 36;
    const halfW = 22 - t * 6;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, skinDark);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, skinDark);
      else px(g, x, y, skin);
    }
  }
  // pectoral muscles
  for (let y = 24; y <= 34; y++) {
    // left pec
    for (let x = cx - 16; x < cx - 2; x++) {
      if (y < 28) px(g, x, y, skinLight, 0.4);
      else px(g, x, y, skin, 0.8);
    }
    // right pec
    for (let x = cx + 2; x <= cx + 16; x++) {
      if (y < 28) px(g, x, y, skinLight, 0.4);
      else px(g, x, y, skin, 0.8);
    }
  }
  // pec separation line
  for (let y = 24; y <= 32; y++) px(g, cx, y, muscle, 0.6);
  // abdominal muscles
  for (let i = 0; i < 4; i++) {
    const y = 36 + i * 5;
    // left ab
    for (let dx = -5; dx < -1; dx++) px(g, cx + dx, y, muscle, 0.4);
    // right ab
    for (let dx = 1; dx <= 5; dx++) px(g, cx + dx, y, muscle, 0.4);
    // ab separation
    px(g, cx, y, muscleDark, 0.5);
  }
  // oblique lines
  for (let y = 36; y <= 54; y += 3) {
    px(g, cx - 10, y, muscle, 0.3);
    px(g, cx + 10, y, muscle, 0.3);
  }

  // ---- Loincloth (rows 50-60) ----
  for (let y = 50; y <= 60; y++) {
    const halfW = 14 - (y - 50) * 0.5;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const edge = x === Math.round(cx - halfW) || x === Math.round(cx + halfW);
      if (edge) px(g, x, y, loinclothDark);
      else px(g, x, y, loincloth);
    }
  }
  // loincloth rope belt
  for (let x = cx - 12; x <= cx + 12; x++) {
    px(g, x, 50, loinclothDark);
  }
  px(g, cx, 50, eye, 0.6); // belt gem

  // ---- Arms (massive, rows 24-56) ----
  // left arm
  for (let y = 24; y <= 54; y++) {
    px(g, cx - 26, y, outline); px(g, cx - 25, y, skinLight); px(g, cx - 24, y, skin);
    px(g, cx - 23, y, skin);
  }
  // left arm muscle definition
  for (let y = 30; y <= 44; y += 3) {
    px(g, cx - 25, y, muscle, 0.4);
    px(g, cx - 23, y, muscle, 0.3);
  }
  // bicep bulge
  for (let y = 28; y <= 36; y++) {
    px(g, cx - 24, y, skinLight, 0.3);
  }
  // right arm
  for (let y = 24; y <= 54; y++) {
    px(g, cx + 26, y, outline); px(g, cx + 25, y, skinLight); px(g, cx + 24, y, skin);
    px(g, cx + 23, y, skin);
  }
  for (let y = 30; y <= 44; y += 3) {
    px(g, cx + 25, y, muscle, 0.4);
    px(g, cx + 23, y, muscle, 0.3);
  }
  for (let y = 28; y <= 36; y++) {
    px(g, cx + 24, y, skinLight, 0.3);
  }

  // ---- Fists (massive, glowing) ----
  for (let y = 55; y <= 62; y++) for (let x = cx - 30; x <= cx - 23; x++) {
    const edge = x === cx - 30 || x === cx - 23 || y === 62;
    if (edge) px(g, x, y, outline);
    else if (x === cx - 29 || x === cx - 24) px(g, x, y, skinDark);
    else px(g, x, y, skin);
  }
  for (let y = 55; y <= 62; y++) for (let x = cx + 23; x <= cx + 30; x++) {
    const edge = x === cx + 23 || x === cx + 30 || y === 62;
    if (edge) px(g, x, y, outline);
    else if (x === cx + 24 || x === cx + 29) px(g, x, y, skinDark);
    else px(g, x, y, skin);
  }
  // glowing knuckles (impact-ready)
  px(g, cx - 28, 58, eye, 0.7); px(g, cx - 25, 58, eye, 0.7);
  px(g, cx + 25, 58, eye, 0.7); px(g, cx + 28, 58, eye, 0.7);
  // fist cracks (earth energy)
  px(g, cx - 27, 60, eye, 0.5); px(g, cx + 27, 60, eye, 0.5);

  // ---- Legs (rows 60-78) — thick stumpy ----
  for (let y = 60; y <= 76; y++) {
    // left leg
    for (let x = cx - 14; x <= cx - 4; x++) {
      const left = x === cx - 14; const right = x === cx - 4;
      if (left || right) px(g, x, y, outline);
      else if (x === cx - 13) px(g, x, y, skinDark);
      else px(g, x, y, skin);
    }
    // right leg
    for (let x = cx + 4; x <= cx + 14; x++) {
      const left = x === cx + 4; const right = x === cx + 14;
      if (left || right) px(g, x, y, outline);
      else if (x === cx + 13) px(g, x, y, skinDark);
      else px(g, x, y, skin);
    }
  }
  // leg muscle definition
  for (let y = 62; y < 76; y += 3) {
    px(g, cx - 9, y, muscle, 0.3);
    px(g, cx + 9, y, muscle, 0.3);
  }
  // feet
  for (let x = cx - 16; x <= cx - 4; x++) px(g, x, 77, outline);
  for (let x = cx - 15; x <= cx - 5; x++) px(g, x, 76, skinDark);
  for (let x = cx + 4; x <= cx + 16; x++) px(g, x, 77, outline);
  for (let x = cx + 5; x <= cx + 15; x++) px(g, x, 76, skinDark);

  // ---- Ground cracks (earth tremor) ----
  const crackLines: Array<[number, number]> = [
    [cx - 20, 78], [cx - 18, 79], [cx - 16, 78],
    [cx + 20, 78], [cx + 18, 79], [cx + 16, 78],
    [cx - 28, 79], [cx + 28, 79],
  ];
  crackLines.forEach(([x, y]) => px(g, x, y, rock, 0.5));

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, 78, 54, 5);

  g.generateTexture(KEY, W, H);
  g.destroy();
}

// ---------------- BOSS: BRAMBLE HORROR (72x80) — plant/nature horror, green/brown ----------------
// Clean pixel art: dark outline, bark + leaf palette, thorned root-monster, glowing eyes.
function generateBrambleHorrorBoss(scene: Phaser.Scene): void {
  const KEY = BOSS_TEXTURE_KEYS.brambleHorror;
  if (scene.textures.exists(KEY)) return;
  const W = 72;
  const H = 80;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const outline = 0x1a0e08;      // near-black brown outline
  const bark = 0x3a2a18;         // dark bark
  const barkMid = 0x5a4028;     // mid bark
  const barkLight = 0x7a5a38;   // light bark
  const leafMid = 0x4a8a3a;     // mid leaf
  const leafLight = 0x7ab858;   // light leaf
  const leafPale = 0xa8d878;    // pale leaf highlight
  const thorn = 0x2a1c10;       // thorn dark
  const thornLight = 0x4a3a20;  // thorn mid
  const eye = 0xd6ff8b;         // glowing eye
  const eyeCore = 0xffffff;     // eye core
  const root = 0x2a1e10;        // root tendril

  const cx = 35;

  // ---- Central gnarled trunk body (rows 8-68) — thick, tapering ----
  for (let y = 8; y < 68; y++) {
    const t = (y - 8) / 60;
    const halfW = 16 + Math.sin(t * Math.PI * 1.5) * 4 - t * 4;
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= W) continue;
      const left = x === Math.round(cx - halfW);
      const right = x === Math.round(cx + halfW);
      if (left || right) px(g, x, y, outline);
      else if (x === Math.round(cx - halfW) + 1) px(g, x, y, bark);
      else if (x === Math.round(cx + halfW) - 1) px(g, x, y, bark);
      else if (Math.abs(x - cx) < 3 && y < 30) px(g, x, y, barkLight);
      else if ((x + y) % 8 === 0) px(g, x, y, barkMid);
      else if ((x + y) % 5 === 0) px(g, x, y, bark);
      else px(g, x, y, barkMid);
    }
  }

  // ---- Bark texture lines ----
  for (let y = 10; y < 66; y += 3) {
    px(g, cx - 6, y, bark, 0.7); px(g, cx + 6, y, bark, 0.7);
    if (y % 6 === 0) { px(g, cx - 10, y, bark); px(g, cx + 10, y, bark); }
  }
  // bark knot
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < 2.5) px(g, cx + 8 + dx, 44 + dy, d < 1 ? barkLight : bark);
  }

  // ---- Glowing eyes (multiple, embedded in bark) ----
  // main pair
  for (let y = 24; y <= 27; y++) {
    for (let x = cx - 8; x <= cx - 5; x++) px(g, x, y, eye);
    for (let x = cx + 5; x <= cx + 8; x++) px(g, x, y, eye);
  }
  px(g, cx - 7, 26, eyeCore); px(g, cx + 7, 26, eyeCore);
  px(g, cx - 9, 26, eye, 0.5); px(g, cx + 9, 26, eye, 0.5);
  // third eye (lower)
  for (let y = 38; y <= 40; y++) for (let x = cx - 1; x <= cx + 1; x++) px(g, x, y, eye, 0.9);
  px(g, cx, 39, eyeCore, 0.8);
  // small eyes
  px(g, cx - 12, 32, eye, 0.7); px(g, cx + 12, 32, eye, 0.7);
  // jagged mouth (crack in bark)
  for (let x = cx - 6; x <= cx + 6; x++) px(g, x, 32, outline, 0.8);
  for (let x = cx - 4; x <= cx + 4; x += 2) px(g, x, 33, thorn, 0.8);

  // ---- Leaf canopy at top (rows 0-12) ----
  const leafClusters: Array<[number, number, number]> = [
    [cx - 18, 4, 5], [cx - 12, 1, 6], [cx - 6, 0, 5], [cx, 0, 7], [cx + 6, 1, 5], [cx + 12, 2, 6], [cx + 18, 4, 5],
  ];
  leafClusters.forEach(([lx, ly, sz]) => {
    for (let dy = 0; dy < sz; dy++) {
      for (let dx = -sz + dy; dx <= sz - dy; dx++) {
        const x = lx + dx; const y = ly + dy;
        if (x < 0 || x >= W || y < 0 || y >= 14) continue;
        const edge = dx === -sz + dy || dx === sz - dy || dy === 0;
        if (edge) px(g, x, y, outline);
        else if (dy < 2 && dx === 0) px(g, x, y, leafPale);
        else if (dy < sz / 2) px(g, x, y, leafLight);
        else px(g, x, y, leafMid);
      }
    }
  });
  // leaf vein highlights
  px(g, cx - 12, 3, leafPale); px(g, cx, 3, leafPale); px(g, cx + 12, 4, leafPale);

  // ---- Radiating thorn spikes around body ----
  const thornSpike = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      px(g, x, y, s < steps ? thorn : outline);
      if (s < steps - 1) px(g, x + 1, y, thornLight, 0.5);
    }
  };
  // shoulder thorns
  thornSpike(cx - 16, 14, cx - 24, 8);
  thornSpike(cx + 16, 14, cx + 24, 8);
  thornSpike(cx - 14, 22, cx - 26, 22);
  thornSpike(cx + 14, 22, cx + 26, 22);
  // side thorns
  thornSpike(cx - 16, 40, cx - 28, 42);
  thornSpike(cx + 16, 40, cx + 28, 42);
  thornSpike(cx - 14, 54, cx - 24, 58);
  thornSpike(cx + 14, 54, cx + 24, 58);

  // ---- Root tendrils at base (rows 68-78) ----
  const roots = [cx - 22, cx - 14, cx - 6, cx, cx + 6, cx + 14, cx + 22];
  roots.forEach((x, i) => {
    const len = 6 + (i % 3) * 2;
    for (let y = 68; y < 68 + len && y < H; y++) {
      const wave = Math.sin(y * 0.5 + i) * 2;
      const rx = Math.round(x + wave);
      if (rx < 0 || rx >= W) continue;
      const alpha = Math.max(0.3, 1 - (y - 68) * 0.1);
      px(g, rx, y, root, alpha);
      px(g, rx - 1, y, outline, alpha * 0.6);
    }
  });

  // ---- Ground shadow ----
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx + 0.5, 78, 50, 5);

  g.generateTexture(KEY, W, H);
  g.destroy();
}
