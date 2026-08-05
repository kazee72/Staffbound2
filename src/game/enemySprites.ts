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
