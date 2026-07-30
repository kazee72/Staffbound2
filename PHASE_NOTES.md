# HOLLOWMERE — Phase Notes

## Phase 1

Scaffolded the project: Vite + TypeScript + Phaser 3, with smooth WASD
movement and a dash for a pixel-art mage. No combat, enemies, or networking
yet — per SPEC.md phase 1 scope.

### What was built
- `npm init` + `phaser`, `vite`, `typescript` installed as deps/devDeps.
- `vite.config.ts`, `tsconfig.json` (strict mode), `index.html`, `src/main.ts`.
- Phaser game config: `pixelArt: true`, `roundPixels: true`, Scale Manager in
  `RESIZE` mode so the canvas fills the full browser viewport and resizes
  live with the window (not a fixed square).
- `src/scenes/BootScene.ts` — generates the mage texture once, then starts
  the Game scene.
- `src/scenes/GameScene.ts` — WASD movement, dash, and a small on-screen
  debug text showing dash cooldown / i-frame state.
- `src/game/mageSprite.ts` — procedurally draws a 16x16 pixel-art mage onto a
  generated texture (pointed hat with highlight band + gold trim tip, small
  face with two eyes, robe with a gold belt band, staff to one side topped
  with a glowing orb), displayed at 1.5x scale. Position is rounded to whole
  pixels (`roundPixels: true`) and Phaser's `pixelArt: true` disables texture
  smoothing so the sprite stays crisp at any zoom/resize.
- Movement tuning matched to `reference/prototype.html`'s feel: acceleration
  1000 px/s² toward input direction, ~0.86-per-frame friction/drag (expressed
  frame-rate-independently), soft speed cap ~230 px/s.
- Dash (Space): fixed 150px dash in current movement/facing direction, 0.28s
  invulnerability window, 0.18s "dashing" flag, 3.4s cooldown — same values as
  the reference prototype. Cooldown/i-frame state is logged to console and
  shown in a simple on-screen debug text (no HUD polish yet).

### Verified
- `npm run build` (`tsc --noEmit && vite build`) completes with **zero
  TypeScript errors**.
- `npm run dev` boots the Vite dev server (`http://localhost:5173/`,
  confirmed HTTP 200 via curl), then was stopped — nothing left running.

### What a human should manually test in a browser
- Run `npm run dev`, open `http://localhost:5173/`.
- Confirm the canvas fills the entire browser window (not a fixed square),
  and resizing the browser window resizes the canvas live.
- Confirm the pixel-art mage (hat, face, robe with gold belt, staff + glowing
  orb) renders crisp and un-blurred, even after resizing the window.
- Confirm WASD (and arrow keys) move the mage smoothly — it should
  accelerate up to speed and coast/decelerate on release, not snap instantly
  to a fixed velocity or stop dead.
- Confirm Space triggers a dash: a quick burst of movement in the current
  direction (or facing direction if standing still), a brief flicker
  (i-frames) on the sprite, and the on-screen debug text showing a cooldown
  timer counting down before dash is "ready" again (~3.4s).
- Confirm dash can't be spammed faster than its cooldown.
- Confirm the mage stays within the viewport bounds (can't walk/dash off
  screen).
