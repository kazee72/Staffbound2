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

## Phase 2

Ported `reference/full-reference.html` (the complete vanilla-JS/Canvas
single-player prototype) into the Vite+TypeScript+Phaser 3 project as
faithfully as practical, replacing the Phase 1 placeholder scene with a full
playable single-player loop. Kept the Phase 1 pixel-art mage sprite and
movement/dash foundation, and layered combat/enemies/spells/leveling/skill
tree on top.

### What was built
- `src/game/types.ts` — shared `World` state shape (player, enemies,
  projectiles, effects, particles, popups, wisps, decoys, cooldowns, skill
  points) + `createWorld()`, mirroring the reference's single `state` object.
- `src/game/skillTree.ts` — the full 61-node Grimoire, ported verbatim:
  `BRANCHES` (6 branches, angles -90/-30/30/90/150/210), `LOCAL` (10-node
  per-branch layout with tiers/offsets/prereqs), `VOID_EXTRA` (Void's 11th
  node), `CONTENT` (every node's real name/description), the radial
  constellation coordinate math (`RADII`, `CX`/`CY`), `NODE_BY_ID`,
  `hasNode`/`availableSP`/`buySkill` purchase logic.
- `src/game/player.ts` — every derived-stat getter from the reference
  (`cooldownMult`, `critChance`, `critDmgMult`, `maxHP`, `moveSpeed`,
  `regenPerSec`, `healingMult`, `lifestealPct`, `damageReduction`,
  `dashCooldownMax`, `xpMult`), `healPlayer`, `resetAllCooldowns`,
  `xpForLevel`/`gainXP` (level-up flash + 1 skill point per level).
- `src/game/enemies.ts` — `ETYPES` (slime/skel/wisp/wraith exact base
  stats), day-scaling formulas, edge spawning, Elder Wraith boss spawn
  (HP/day scaling, 90s interval).
- `src/game/combat.ts` — `damageEnemy` (crit rolls, burn/slow/freeze
  application) and `killEnemy` (XP grant, slain counter, Wildfire Spread /
  Verdant Bloom pulse / Reaper's Mark cooldown reset / Absolute Zero shatter
  on-kill chain effects).
- `src/game/spells.ts` — `castBolt` (auto-target nearest enemy) plus every
  node-gated spell: Fire Nova, Ice Lance, Frost Armor, Arcane Burst, Thorned
  Vines, Shadow Bolt, Spirit Wisp companions — each behind the same
  `hasNode()` gate as the reference, `updateSpellTimers` ticking all
  cooldowns each frame.
- `src/game/simulation.ts` — per-frame player movement (accel 1000,
  friction 0.86/frame), `tryDash` (150px dash, 0.28s i-frames, 0.18s dash
  window, dashCooldownMax from Warden nodes, Umbral Step decoy spawn),
  `damagePlayer` (Undying capstone), projectile/decoy/enemy/effect/particle
  update loops, boss telegraphed stomp AoE.
- `src/game/waves.ts` — day timer (`elapsed/60`), `PLACES` flavor list,
  spawn interval formula `max(0.32, 1.5 - day*0.09)` + day>=3 extra-spawn
  chance, boss timer.
- `src/game/visuals.ts` — particle `burst()` and `spawnPopup()` helpers.
- `src/ui/UIManager.ts` + `src/ui/hud.css` — full DOM overlay layered above
  the Phaser canvas: HUD (HP/XP bars, day line, GRIMOIRE button + SP badge,
  dash indicator), start overlay, game-over overlay (days/slain/level +
  random flavor line), and the full radial Grimoire overlay with SVG
  connector lines (lit when prerequisite owned), tooltips, and
  locked/available/affordable/bought node styling — CSS variables and class
  names mirror the reference 1:1.
- `index.html` — added the Cinzel/EB Garamond/JetBrains Mono Google Fonts
  `<link>` tags matching the reference.
- `src/scenes/GameScene.ts` — rewritten to wire movement/dash into the new
  `World` sim, run the full update loop each frame (spell timers,
  projectiles, decoys, enemies, effects, particles, spawns), render enemies/
  projectiles/effects/particles/damage-popups via a Phaser `Graphics` +
  pooled `Text` objects, keep the Phase 1 mage sprite rendering, and toggle
  the Grimoire (G key / button) **without pausing the underlying sim loop**
  — noted in code that this is intentional groundwork for Phase 4
  multiplayer, where the Grimoire must stay non-pausing.
- Ambient firefly background particles ported from the reference's
  `bgCanvas` layer into a dedicated low-depth `Graphics` object.

### Verified
- `npm run build` (`tsc --noEmit && vite build`) completes with **zero
  TypeScript errors**.
- `npm run dev` booted (`http://localhost:5173` and friends, confirmed
  HTTP 200 via curl), exercised via the browser tool (start screen → BEGIN
  THE JOURNEY → live combat with HUD updating and enemies visible → G opens
  the Grimoire showing the radial tree with connector lines and tooltips →
  Escape closes it) with **zero console/runtime errors**, then the dev
  server(s) were killed — nothing left running.
- Node-count check: extracted all node ids programmatically from both the
  reference and the ported `SKILL_NODES` array — **both total exactly 61**,
  and the sorted id lists are identical.

### What a human should manually test in a browser
- Run `npm run dev`, open the printed local URL.
- Confirm movement/dash still feels the same as Phase 1 (accel/friction
  glide, 150px dash burst, ~3.4s cooldown, i-frame flicker).
- Confirm the bolt spell auto-fires at the nearest enemy as soon as one
  spawns, with no input required.
- Confirm the day counter in the HUD advances (`Day 1 — the fallen
  kingdom`, etc.) and enemies visibly get tougher/tankier as days pass.
- Confirm the Elder Wraith boss spawns around the ~90s mark with a visible
  telegraphed stomp warning ring about 1s before it lands.
- Confirm pressing `G` (or the GRIMOIRE button) opens the radial skill tree
  overlay with all 6 branches laid out around the "YOUR PATH" core.
- Confirm clicking an affordable/available node purchases it, updates its
  connector lines to "lit", and immediately reflects its gameplay effect
  (e.g. buying `F_B` Ember Rounds should start Fire Nova casting).
- Confirm the game-over overlay appears on death, shows days survived / foes
  slain / level reached, and `WALK AGAIN` cleanly restarts a fresh run.

## Phase 2.1 — visual polish (skill tree spacing + forest background)

Two follow-up visual tweaks requested after playtesting Phase 2:

### What was built
- **Expanded Grimoire layout**: tier radii increased from
  `[90,165,240,315,390,465]` to `[145,265,385,505,625,745]` (the Warden
  capstone's manual `radius:330` override bumped to `530` to match), the
  hub moved from `(500,500)` to `(800,800)`, and `#treeinner` grown from
  1000x1000 to 1600x1600 in `hud.css` to match. Node/capstone/core circle
  sizes and font sizes were scaled up proportionally (`.node` 52px→76px,
  `.node.capstone` 66px→96px, `.core` 64px→88px) and the branch-label
  placement radius in `UIManager.ts` increased from 55 to 85 so labels don't
  crowd the now-larger hub. Net effect: the full 61-node constellation has
  real breathing room between nodes and connector lines instead of
  overlapping/cramped circles.
- **Pixel-art forest background**: new `src/game/forestBackground.ts`
  procedurally generates three low-res pixel-art textures at boot (idempotent,
  cached in Phaser's texture manager) — a tileable 32x32 grass tile with
  subtle two-tone dithering + scattered "blade" pixels, a ~24x34 layered pine
  tree (trunk + three tapering canopy tiers with light/dark shading), and a
  ~14x10 rounded bush. `GameScene.ts` replaced the old faint grid-line
  background with a `TileSprite` of the grass texture sized to the viewport
  (resizes/re-tiles on window resize) plus a `Layer` of tree/bush `Image`
  objects scattered with a seeded deterministic PRNG (stable across resizes
  at the same viewport size, keeps a clear radius around the player's spawn
  point so decor doesn't spawn on top of the mage).

### Verified
- `npm run build` (`tsc --noEmit && vite build`) completes with **zero
  TypeScript errors**.
- Exercised live via the browser tool: confirmed the play field now shows a
  dark pixel-art forest (grass texture + scattered pine trees/bushes) instead
  of a flat background, and confirmed the Grimoire overlay's nodes are
  clearly separated with visible gaps and non-overlapping connector lines
  (checked via a screenshot of the open panel). `#treewrap` scrollable area
  measured 1640x1640 in the live DOM, consistent with the new 1600x1600
  `#treeinner` + padding.

### What a human should manually test in a browser
- Confirm the forest background reads clearly at both small and large
  window sizes (resize the browser and check trees/bushes don't clip weirdly
  or leave gaps at the tiled grass seams).
- Confirm the forest decor doesn't visually interfere with reading enemies/
  projectiles/HUD during actual combat (it's intentionally dim/desaturated
  behind the action, but sanity-check at a glance).
- Open the Grimoire (`G`) and confirm all 6 branches are comfortably spread
  out with no overlapping nodes, and that scrolling to the outer capstone
  nodes still works smoothly.

## Phase 2.3 — Meta progression + skill tree grid redesign + QoL fixes

### What was built

**Boss damage fix:**
- Root cause: `castBolt`/`castIceLance`/`castShadowBolt` used `nearestEnemy()` which only searched `world.enemies` — empty during boss-exclusive fights. Spells silently fired nothing at bosses.
- Fix: Added `damageBoss()` in combat.ts (mirrors `damageEnemy`'s crit/lifesteal/burn/slow/mark logic). Wired boss collision into `updateProjectiles` via `damageBoss`. Added `forEachTargetInRange` helper so AoE spells (Fire Nova, Vines) also hit the boss. Wisp companions now target the boss when no regular enemies exist.

**Auto-aim toggle (Q key):**
- `world.autoAim` boolean (defaults true). Press Q during a run to toggle.
- When on: bolt/ice lance/shadow bolt auto-target nearest enemy (classic behavior), with fallback to boss during boss fights.
- When off: spells fire toward `player.aimAngle` (mouse cursor direction).
- HUD shows current mode ("auto" in frost-blue, "mouse" in gold).

**UHJK movement keys:**
- U=up, H=left, J=down, K=right — alongside WASD and arrow keys.

**Skill cooldown bar:**
- Bottom-center of screen. Shows each unlocked spell as a compact icon + progress bar + countdown timer.
- Only shows skills you've actually unlocked (bolt and dash always visible; others appear when their Grimoire node is purchased).

**Classic blue mage sprite restored:**
- Reverted the Frieren reskin to a classic blue-robed, blue pointy-hat mage with gold trim and staff+orb.

**Meta progression system (src/game/metaProgression.ts — new):**
- 12 meta upgrades with multiple ranks each: damage, cooldown reduction, move speed, max HP, XP gain, essence gain, crit chance, crit damage, regen, lifesteal, damage reduction, dash cooldown.
- Essence (meta currency) earned from kills: 1-3 per regular enemy, 20-50 per boss, scaled by essence-gain meta ranks.
- Essence accumulates during a run but only "banks" (persists) on death — closing the browser mid-run loses unbanked essence.
- Stored in localStorage (key `hollowmere_meta`). Survives page close/reload.
- Meta stat multipliers stack multiplicatively with in-run Grimoire derived stats in player.ts.
- Fresh state grants 1 free rank of "Arcane Resonance" (damage) as a head-start.
- "META GRIMOIRE" button on game-over screen opens a gold/amber-themed upgrade panel.
- Each upgrade row shows name, description, current rank dots, and cost for next rank with a buy button.

**Skill tree grid redesign:**
- Replaced radial constellation layout with a vertical-column grid: 7 columns (one per branch), nodes stacked vertically.
- Smaller nodes: 48px (was 76px), capstones 64px (was 96px).
- Straight right-angle SVG connector paths (no diagonals).
- Side nodes (C1/C2/G/H/X variants) offset horizontally within their column.
- 1310x864px scrollable grid area, 71 total nodes, 85 connector paths.

### Verified
- `npm run build` (tsc --noEmit && vite build) — zero TypeScript errors.
- Browser verification: game runs with no console/JS errors. Grimoire grid renders with 71 nodes, 85 right-angle paths, 7 branch labels, core element. Game-over screen shows "YOUR JOURNEY ENDS HERE" with banked essence display, WALK AGAIN + META GRIMOIRE buttons. Meta Grimoire opens with 12 upgrade buttons showing essence costs. Cooldown bar shows BOLT and DASH at minimum, more skills appear when unlocked.

### What to test manually
- Play a run, kill enemies, die. Check game-over screen shows banked essence. Open META GRIMOIRE, buy an upgrade, restart, confirm you're stronger.
- Press Q to toggle auto-aim on/off. Confirm spells follow mouse when off, auto-target when on.
- Try UHJK movement keys alongside WASD.
- Open the Grimoire (G) and confirm the grid layout with smaller nodes, straight lines, 7 columns.
- During a boss fight, confirm your bolts/ice lance/shadow bolt actually damage the boss.
