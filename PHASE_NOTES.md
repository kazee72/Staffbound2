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

## Multiplayer fixes: guest can't see other players, guest never gets skill points

### Fixed
- **Guest sees no other players (host or fellow guests):** `renderFromSnapshot()` cleared `fxGraphics`
  once at the top, drew self + all other-player mage sprites onto it, then called
  `renderSnapshotScene()` — which *also* called `g.clear()` first thing, wiping out every player
  sprite just drawn before the frame ever rendered. Removed the redundant clear from
  `renderSnapshotScene()` (src/scenes/GameScene.ts).
- **Guest never earns/spends skill points:** the guest's local `guestSP`/`guestSpSpent` were only
  ever updated by a `skillAck` reply from the host — but `guestRequestBuySkill()` refuses to even
  send a `buySkill` message unless `guestSP - guestSpSpent >= cost` locally first, so a guest
  starting at 0 SP could never make the first purchase request, and passive SP earned via
  `simulateNetPlayers()` leveling on the host was never communicated to the guest at all. Added
  `sp`/`spSpent` to the per-player block in the snapshot protocol (src/net/snapshot.ts,
  `serializeSnapshot`/`deserializeSnapshot`/`SnapPlayer`/`toNetPlayer`) and now sync
  `guestSP`/`guestSpSpent`/`world.sp`/`world.spSpent` from the guest's own snapshot entry every
  frame in `renderFromSnapshot()` (src/scenes/GameScene.ts), refreshing the grimoire UI if open.

### Verified
- `npm run build` (tsc --noEmit && vite build) — zero TypeScript errors.

### What to test manually
- Host a game, join as a guest (second browser/tab), start the run: confirm the guest can see the
  host's mage and any other guests moving around, not just enemies/effects.
- As a guest, survive long enough to level up (or kill a few enemies near you) and open the
  Grimoire (G): confirm skill points appear and a node can actually be purchased.

## Character GIF support

### Added
- **public/assets/character/** (new folder, tracked via README.md) — drop a file named
  `player.gif` here and the game uses it as the player mage's sprite, animation included.
  No file present → silently falls back to the original procedural pixel-art mage.
- **src/game/gifSprite.ts** (new) — decodes the GIF via `gifuct-js` at boot, correctly
  compositing each frame against disposal method (GIF frames are often small dirty-rect
  patches, not full frames), lays the composited frames into one canvas sprite sheet, and
  registers a Phaser texture (`mage`) + looping animation (`mage-idle`) from it. Also exposes
  `getMageScale()` so mage sprites display at the game's expected ~24px footprint regardless
  of the source GIF's native resolution.
- **src/scenes/BootScene.ts** — preloads the raw GIF bytes (`this.load.binary`), then tries
  `buildCharacterGifTexture()` before falling back to `generateMageTexture()`.
- **src/scenes/GameScene.ts** — the local player sprite (`this.mage`) and the host's net-player
  mage sprites (`guestMageSprites`) both play `mage-idle` when present. Also replaced the
  guest's other-player rendering (previously hand-drawn vector circles via
  `drawGuestMageSprite`) with the same pooled-sprite approach (`renderOtherPlayerSprites`), so
  a guest sees the host and other guests as the same animated mage sprite too, not circles.
- Added dependency: `gifuct-js` (pure-JS GIF decoder, no native deps).

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright): booted with no `player.gif` present — no console errors, procedural
  mage renders and plays normally.
- Browser (Playwright): dropped a synthetic 4-frame test GIF at
  `public/assets/character/player.gif` — decoded and rendered in-game as the player sprite
  with no console errors, confirming the fetch → decode → composite → texture → animation
  pipeline works end-to-end. Removed the test file afterward; the folder now only has the
  README for the user to drop their real GIF into.

### What to test manually
- Drop a real character GIF at `public/assets/character/player.gif`, reload, and confirm it
  appears (animated) in place of the pixel-art mage in solo play.
- In multiplayer, confirm the host sees guests as the animated GIF sprite, and guests see the
  host + other guests the same way (each still tinted per-player-slot as before).

## Real slime + skeleton sprites (replacing procedural art)

### Added
- **src/game/gifDecode.ts** (new) — extracted the GIF decoding core (disposal-aware frame
  compositing, grid-based sprite-sheet packing) out of gifSprite.ts into a shared module, so
  both the player mage and enemy sprites can decode GIFs the same way.
- **src/game/enemySpriteAssets.ts** (new) — builds real animated sprites for slime and
  skeleton from the assets dropped in `public/assets/`:
  - **Skeleton** (`public/assets/Skeleton/GIFS/*.gif`) — decoded via gifDecode.ts. Idle (11
    frames), Walk (13 frames), and Hit (8 frames) are wired up; Attack/Dead/React are present
    in the asset pack but not loaded (no matching gameplay trigger exists yet — see below).
  - **Slime** (`public/assets/Slimes/*.png`) — these ship as a fixed grid: 7 palette-swapped
    color rows x N animation-frame columns, 80x72 per cell. Row 4 (green) is picked out to
    match the original procedural slime's color. Idle (2 frames), Move (7 frames), and Hit (2
    frames) are wired up; Jump/Die/Swallow exist in the pack but aren't loaded (same reason).
  - Both are graceful no-ops if their asset files are missing/incomplete or fail to decode —
    `generateEnemyTextures()` (enemySprites.ts) already no-ops per-key when a texture exists,
    so anything not built falls back to the original procedural pixel art automatically.
  - Exports `enemyVisualScale(type, r)`, replacing two copies of a hardcoded scale formula
    that lived in GameScene.ts (host `renderEnemies()` and guest `renderSnapshotEnemies()`) —
    now both call the same function, which uses a real-asset target size when built, or the
    original procedural-art formula otherwise.
- **src/scenes/BootScene.ts** — preloads + builds the enemy assets alongside the character GIF.
- **src/scenes/GameScene.ts** — idle/walk/hit animation switching, host-side only:
  `enemySpriteByRef` now stores `{ spr, prevX, prevY, prevHp, hitUntil }` per enemy and infers
  movement (position delta) and damage (HP drop → 0.3s hit-flash) purely at the render layer —
  no simulation or network-protocol changes. Guests can't do this (pooled by snapshot array
  index, not stable per-enemy identity — see the comment on `enemySpriteByRef`), so guests
  always show the idle animation for these two types; still real animated art, just without
  the walk/hit reactivity.

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright), solo play, ~20s of active combat: slime and skeleton render as the
  real animated art (screenshots confirm walk-cycle frame differences between captures), sized
  correctly relative to trees/player, no console warnings/errors (in particular no "missing
  animation" warnings, confirming the anim keys resolve).
- Browser (Playwright), real 2-peer multiplayer session (host + guest, actual WebRTC via the
  local PeerServer): both the host's identity-tracked rendering and the guest's snapshot-pooled
  rendering show the same real slime/skeleton art with no console errors on either side.

### What to test manually
- Get hit by / hit a skeleton and a slime in solo play and confirm the brief hit-flash
  animation plays before reverting to walk/idle.
- If you want Attack/Dead/React (skeleton) or Jump/Die/Swallow (slime) wired up too, that needs
  a gameplay trigger to hang them on (e.g., a real death-animation grace period before an enemy
  is removed) — flag it and it can be scoped as a follow-up.

## Slime sizing/splitting + skeleton facing

### Investigated
- "Some slimes are really small" — instrumented the actual runtime scale/frame values
  Phaser reports for rendered slime sprites; they were already uniform (~29x26px on screen,
  consistent across every sample, matching the intended target). No reproducible size-variance
  bug found. What *was* missing: `enemyVisualScale()` (enemySpriteAssets.ts) ignored `r`
  entirely for real-asset types, always returning one fixed scale — harmless for plain slimes
  (constant r=9) but would've made the new split-child slimes (see below) render at full size
  instead of smaller. Fixed: it now scales proportionally around each type's normal spawn `r`
  (`REAL_ASSET_BASE_R`), so a smaller/larger r now visibly changes rendered size.

### Added
- **Slime split-on-death** (src/game/enemies.ts `spawnSlimeSplit`, wired into `killEnemy` in
  combat.ts): killing a non-split slime spawns 2 weaker copies at its death spot — 40% of its
  max HP, 55% of its damage, 60% of its radius (so they render visibly smaller via the
  proportional scale fix above), 15% faster. Children are flagged `splitChild: true`
  (types.ts) so killing *them* doesn't chain into another split ("once", as asked). No
  network-protocol changes needed — children are just regular `EnemyState` entries, already
  covered by the existing enemy snapshot fields (including `r`, so guests render the smaller
  size correctly too).
- **Skeletons face the player** (`GameScene.applyEnemyFacing`, called from both the host's
  `renderEnemies()` and the guest's `renderSnapshotEnemies()`): flips the sprite horizontally
  based on the local player's position relative to the skeleton (skeleton art faces right by
  default). Slimes are left untouched (symmetric blob, no facing concept).

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright + temporary debug logging, removed after): confirmed `spawnSlimeSplit`
  fires exactly once per non-split slime kill (never for a split child killing itself), and the
  resulting children render visibly smaller than a normal slime.
- Browser (Playwright): skeletons approaching from both left and right of the player render
  with the correct weapon-arm orientation (facing toward the player) on both sides.
- Real 2-peer multiplayer session (host + guest): no console errors; split slimes and skeleton
  facing both render correctly in the guest's snapshot-based view too.

### What to test manually
- Kill a slime and confirm 2 smaller slimes appear and scatter from the death spot; kill one of
  those and confirm it does *not* split again.
- Watch a skeleton approach from either side and confirm it visibly turns to face you.

## Real forest background (trees/bushes/grass/flowers)

### Added
- **src/game/forestAssets.ts** (new) — loads the "Lost Pixel Art - Forest" pack dropped in
  `public/assets/Lost Pixel Art - Forest/` (2 tree species x4 variants, 2 bushes, 4 grass
  tufts, 4 flower species x4 variants — 30 images total) and scatters them as the stage-1
  background, replacing the small procedural tree/bush silhouettes.
  - Each source image is a single object on a large, inconsistently-trimmed transparent
    canvas (e.g. a 430x430 canvas where the tree itself is only ~350px tall) — scaling
    against the raw canvas size would've made most of them render tiny. Each image's actual
    visible content height is measured once at boot via a canvas alpha-channel bounding-box
    scan, and that's what scatter scale is calculated against.
  - Per-category target on-screen sizes (`DECOR_TARGET_HEIGHT`): trees 72-104px, bushes
    30-46px, grass tufts 14-22px, flowers 18-28px — grass/flowers are weighted most common,
    trees least, for a layered "lush" look rather than a wall of same-size objects.
  - Optional and per-image graceful: any file that isn't present is just skipped (not
    all-or-nothing) since this is decorative variety, not a required set. If the whole pack
    is missing, `GameScene.scatterForestDecor()` falls back to the original procedural
    tree/bush scatter unchanged.
- **src/scenes/BootScene.ts** — preloads + builds the forest asset pool alongside the other
  optional art.
- **src/scenes/GameScene.ts** (`scatterForestDecor`) — branches on whether the real-asset pool
  is populated; only affects the stage-1 background (stages 2+ use their own biome-specific
  procedural textures in stageBackground.ts, untouched).

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright): both the start-screen backdrop and the in-run background show a mixed
  scatter of real trees, a bush, flowers, and grass tufts with correct scale and no visible
  transparent-canvas artifacts at the edges (checked via cropped/upscaled screenshots of each
  category). No console errors over an extended solo session.

### What to test manually
- Resize the browser window and confirm the background re-scatters cleanly (no stretching/
  leftover sprites).
- Progress to stage 2+ (after a boss kill) and confirm the background switches to that stage's
  own biome art, not the forest pack (by design — the forest pack is stage-1 only).

## Forest background: bushes removed, flowers darkened

### Changed
- **Bushes removed entirely** — both the real "Lost Pixel Art - Forest" bush images and the
  procedural bush fallback. Removed `generateBush()`/`FOREST_BUSH_KEY` from
  forestBackground.ts and the `'bush'` category from forestAssets.ts (`ForestDecorCategory` is
  now just `'grass' | 'flower'`). The pack's bush PNGs are still on disk
  (public/assets/Lost Pixel Art - Forest/Bushes/) but nothing loads them.
- **Flowers gamma-darkened** — same technique as the earlier tree darkening but milder
  (gamma 1.3, brightness ×0.72 vs trees' 1.7/0.62), keeping them a readable colorful accent
  rather than blending fully into the backdrop. Grass tufts are left at full color.
  `forestAssets.ts`'s darken step is now table-driven (`DARKEN: Partial<Record<category,
  {gamma, brightness}>>`) instead of a boolean, so different categories can have different
  darken strength.

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright): confirmed no bushes render; pixel-sampled a rendered flower against
  its source PNG to confirm the darken formula is actually being applied (not just eyeballed).
  No console errors over an extended solo session.

## Forest background: grass removed, flowers cleaned up

### Changed
- **Grass tufts removed** — `'grass'` dropped from `ForestDecorCategory` (now just `'flower'`)
  and its asset entries/loading removed from forestAssets.ts. Only trees (procedural) and
  flowers (real asset pack) remain in the stage-1 background.
- **Flowers now pre-shrunk with high-quality smoothing, not just cropped** — the flower source
  images are ~400-500px native, displayed at only 18-28px. Just cropping to content and letting
  Phaser's pixelArt/nearest-neighbor filtering handle a ~20x runtime downscale produced a noisy/
  aliased look (nearest-neighbor picks one pixel per sample rather than averaging, so fine
  linework gets lost/speckled at extreme ratios). `buildForestAssets()` now crops each flower to
  its content bounding box and does a *one-time* smooth downscale (canvas
  `imageSmoothingQuality: 'high'`) to ~2x the max display size (`PRESHRINK_TARGET_H`) before
  gamma-darkening, baking in clean anti-aliased edges once at boot so the small remaining
  runtime scale-down stays mild.

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright): confirmed no grass tufts render; cropped/upscaled screenshots of two
  different flower instances show clean crisp edges (no speckling/noise). No console errors
  over an extended solo session.

## Forest background: flowers removed, real-asset integration fully retired

### Changed
- **Flowers removed** — the last remaining category from the "Lost Pixel Art - Forest" pack
  (after bushes and grass were dropped in prior passes). With nothing left using it, deleted
  `src/game/forestAssets.ts` entirely rather than leave dead infrastructure behind, and removed
  its load/build calls from BootScene.ts and its imports from GameScene.ts.
- Stage-1 background is back to just the procedural pine trees (dense scatter, wide size
  variation) — no real-asset decoration at all. The pack's PNG files are still on disk
  (public/assets/Lost Pixel Art - Forest/) in case they get used for something else later;
  nothing loads them now.

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright): confirmed no flowers/bushes/grass render, only procedural trees. No
  console errors over an extended solo session.

## Bright blue projectiles with a light/glow effect

### Changed
- **src/game/spells.ts** — bolt spell's main projectile color changed from lavender `#9d8ce0` to
  bright blue `#2f8fff` (line ~119); the Arcane Overflow (V_J) empowered-cast mini-bolt splash
  changed from `#c7bdf5` to a lighter bright blue `#8ecbff` (line ~129). Other spells (fire
  nova, ice lance, shadow bolt, wisp attacks, Arcane Burst) keep their own colors — untouched.
- **src/scenes/GameScene.ts** — the host-simulated net-player bolt cast (`simulateNetPlayers`)
  updated to match the same `#2f8fff` so multiplayer guests' bolts look identical to the local
  player's.
- **Glow effect**: added `drawProjectileGlow()` — a shared private helper (layered `fillCircle`
  calls: oversized low-alpha halo → mid-alpha ring → solid core → bright near-white highlight),
  matching the existing boss-projectile glow technique already used elsewhere in the codebase
  (no blend-mode/shader work, consistent with how every other glow in this game is done). Both
  `renderScene()` (host) and `renderSnapshotScene()` (guest) now call it instead of a flat
  `fillCircle`, so every projectile type gets the glow (not just bolts) — only the bolt-specific
  colors changed above.
- No multiplayer protocol changes needed — `packColor`/`unpackColor` (net/snapshot.ts) already
  round-trip any hex color generically, and the glow is derived client-side from the existing
  `color`/`r` fields already sent per-projectile.

### Verified
- `npm run build` — zero TypeScript errors.
- Browser (Playwright): zoomed screenshot confirms a clean bright-blue orb with a soft layered
  glow halo and bright core in solo play.
- Real 2-peer multiplayer session (host + guest): glow renders identically on both sides, no
  console errors.
