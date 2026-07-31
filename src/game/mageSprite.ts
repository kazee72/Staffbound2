/**
 * Mage sprite generation — classic fantasy mage: long pointy blue hat with
 * gold trim, blue robe with a gold belt band, small face with two eyes,
 * and a staff to one side topped with a glowing orb.
 *
 * Drawn onto a 16x16 texture (via Phaser's texture manager / a Canvas).
 * The texture is generated at native 16x16 resolution; the sprite is then
 * displayed scaled up (~1.5x) in-game. Because the game uses `pixelArt: true`
 * and `roundPixels: true` (see main.ts), and because texture filtering is
 * nearest-neighbor, this stays crisp with no blurring.
 */

const GRID = 16;

export const MAGE_TEXTURE_KEY = 'mage';

// Palette — classic blue mage
const COLOR = {
  hat: 0x2a3a7a, // deep blue hat
  hatHighlight: 0x3a5290,
  hatTrim: 0xd4a938, // gold trim at tip
  hatBrim: 0x223068,
  skin: 0xe8c39e,
  eye: 0x1a1a22,
  robe: 0x2a3a7a, // blue robe matching hat
  robeShade: 0x1e2c5e,
  belt: 0xd4a938, // gold belt band
  staff: 0x6b4a2f,
  orb: 0x8ec9e8,
  orbGlow: 0xd4f0ff,
  outline: 0x14121e,
};

/**
 * Generates the mage texture into the given scene's texture manager.
 * Safe to call once during Boot; subsequent calls are no-ops if the key
 * already exists.
 */
export function generateMageTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(MAGE_TEXTURE_KEY)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  const px = (x: number, y: number, color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillRect(x, y, 1, 1);
  };

  // Staff (to the mage's right side), drawn first so the robe/arm sits over its base.
  // Staff shaft: column x=12, rows 3..12
  for (let y = 3; y <= 12; y++) {
    px(12, y, COLOR.staff);
  }
  // Orb on top of staff
  px(11, 1, COLOR.orbGlow, 0.5);
  px(12, 1, COLOR.orb);
  px(13, 1, COLOR.orbGlow, 0.5);
  px(12, 2, COLOR.orb);
  px(11, 2, COLOR.orbGlow, 0.35);
  px(13, 2, COLOR.orbGlow, 0.35);

  // Long pointy blue hat (rows 0-5), tapering tall triangle centered around x=7/8
  const hatRows: Array<[number, number]> = [
    [8, 8], // row 0: tip
    [7, 8],
    [7, 9],
    [6, 9],
    [6, 10],
    [5, 10],
  ];
  hatRows.forEach(([x0, x1], row) => {
    for (let x = x0; x <= x1; x++) {
      px(x, row, row % 2 === 0 ? COLOR.hat : COLOR.hatHighlight);
    }
  });
  // Gold trim tip
  px(8, 0, COLOR.hatTrim);
  // Highlight band partway down
  for (let x = 6; x <= 8; x++) {
    px(x, 3, COLOR.hatHighlight);
  }
  // Hat brim (wider than the hat body)
  for (let x = 4; x <= 11; x++) {
    px(x, 5, COLOR.hatBrim);
  }

  // Face (row 6-7), small, beneath the brim
  for (let x = 5; x <= 10; x++) {
    px(x, 6, COLOR.skin);
    px(x, 7, COLOR.skin);
  }
  // Two eyes
  px(6, 7, COLOR.eye);
  px(9, 7, COLOR.eye);

  // Robe body (rows 8-14), blue with taper for shoulders -> hem
  const robeRows: Array<[number, number]> = [
    [4, 11], // row 8 shoulders
    [4, 11],
    [3, 12],
    [3, 12],
    [3, 12], // row 12 - belt row overwritten below
    [2, 13],
    [2, 13],
  ];
  robeRows.forEach(([x0, x1], i) => {
    const row = 8 + i;
    for (let x = x0; x <= x1; x++) {
      px(x, row, x === x0 || x === x1 ? COLOR.robeShade : COLOR.robe);
    }
  });

  // Gold belt band across the robe
  for (let x = 3; x <= 12; x++) {
    px(x, 12, COLOR.belt);
  }

  // Feet/hem shadow
  for (let x = 2; x <= 13; x++) {
    px(x, 15, COLOR.outline, 0.5);
  }

  g.generateTexture(MAGE_TEXTURE_KEY, GRID, GRID);
  g.destroy();
}