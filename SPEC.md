# HOLLOWMERE — Full Project Spec

## What this is
HOLLOWMERE is a top-down medieval-fantasy survival action game: a wandering mage
auto-casts spells at nearby monsters while the player focuses purely on movement
and dodging. Progression comes from a very large skill tree ("the Grimoire") with
60 nodes across 6 elemental branches. There is an existing single-file
HTML/Canvas/vanilla-JS prototype at `reference/prototype.html` that plays well —
read it for feel/values reference, but this is a full rewrite as a proper project,
with 2-4 player local multiplayer over WebRTC, LAN only, no cloud services.

Build in phases, committing working code at each phase, rather than attempting
everything in one pass.

## Tech stack
- Vite + TypeScript for the project/dev server/bundling.
- Phaser 3 for rendering, game loop, input, sprite/particle management.
- PeerJS (`peerjs` npm package) for WebRTC data channels, plus a self-hosted
  PeerServer (`peer` npm package) run locally alongside the Vite dev server for
  signaling. Do NOT use PeerJS's public cloud broker — everything must work with
  no internet connection, LAN only.
- Plain TypeScript classes/state for game logic; no Redux/Zustand needed.

## The signaling nuance
Two browsers cannot establish a WebRTC connection with zero coordination — they
need to exchange connection offers/answers once, up front. This is unavoidable
even on a LAN.

- One player is the Host. Running the app locally also spins up a small local
  PeerServer (bundled, e.g. on port 9000) purely for this initial handshake.
- Other players (Guests) open a browser to the Host's LAN IP and port (e.g.
  http://192.168.1.42:5173), see a "Join Game" screen, enter the Host's peer ID
  or a short room code the Host displays, and connect.
- Once connected, all real-time gameplay data flows directly peer-to-peer over
  the WebRTC data channel — the signaling server is only involved in the initial
  handshake, not ongoing play. No game data touches any server; nothing requires
  internet access.
- There is no automatic LAN discovery (no mDNS/Bonjour). The Host must share
  their local IP and room code manually (displayed prominently on the Host's
  screen, e.g. "Others on your network: join at 192.168.1.42:5173, room code
  BLUE-FOX").

## Authority model
Host-authoritative model layered over the P2P transport:
- The Host's browser is the source of truth for: enemy spawning, enemy AI/movement,
  the day/wave timer, boss spawns, and final damage/death resolution.
- Each client (including the Host's own player) sends its local input state
  (movement vector, dash press) to the Host at a fixed tick rate (e.g. 20Hz).
- The Host simulates the full world (all players' positions based on their
  reported input, all enemies, all projectiles/spell effects, collisions) and
  broadcasts a compact world-state snapshot back to every peer at the same tick
  rate.
- Clients render using the Host's snapshots (with simple interpolation/
  extrapolation between snapshots so movement looks smooth rather than stepping
  at 20Hz).
- This avoids keeping N independent simulations in sync, at the cost of the Host
  having simulation authority. Do not build anti-cheat or server reconciliation.
- If the Host disconnects, the session ends (no host migration needed for v1).

## Core movement & combat feel (must preserve — this is what makes it fun)
- Smooth acceleration/friction-based WASD movement (not instant velocity).
- A dash (Space bar) with a cooldown and brief invulnerability frames.
- All combat is auto-cast: the player's base spell and any spells unlocked from
  the tree fire automatically at nearby enemies on their own cooldowns. The
  player's only combat input is positioning (kiting, dodging) and dashing.
- Full-viewport canvas, not a fixed square — the game fills the browser window.

## Player character
Small pixel-art mage sprite (roughly a 16x16 grid scaled up ~1.5x): pointed hat
with a highlight band and gold trim tip, a small face with two eyes, a robe with
a gold belt band, and a staff to one side topped with a glowing orb. Keep the
sprite small and crisp — round the draw position to whole pixels and disable
image smoothing so it doesn't blur.

In multiplayer, each player should be visually distinguishable (e.g. a different
robe/orb tint per player slot, or a small colored nameplate/ring beneath each
mage).

## Enemies
Four regular types, spawning from screen edges, scaling in HP/damage with
elapsed "Day" (a day = 60 seconds; display "Day N — <flavor location>" cycling
through a list of medieval/journey flavor names):

| Type     | Base HP | Base DMG | Speed | Notes                              |
|----------|---------|----------|-------|-------------------------------------|
| Slime    | 18      | 6        | 70    | slow, common                        |
| Skeleton | 30      | 10       | 95    | standard                            |
| Wisp     | 10      | 4        | 150   | fast, erratic wobble movement       |
| Wraith   | 70      | 16       | 80    | tougher, unlocks Day 2+             |

Plus a boss ("Elder Wraith") every 90 seconds: big HP pool scaling with day, slow
mover, a telegraphed AoE "stomp" attack (visible warning ring ~1s before it
lands) that players should be able to see and dodge together.

In multiplayer, enemy stat scaling and spawn rate should scale up with player
count so a 4-player lobby isn't trivial.

## Leveling & the skill tree ("the Grimoire")
- Each player has their own independent XP, level, and skill tree — not shared/
  pooled progression.
- Killing any enemy grants XP only to the player who landed the killing blow
  (chosen for simplicity — v1 uses killing-blow attribution, not damage-share).
- Leveling grants 1 skill point. XP curve:
  `xpForLevel(lvl) = floor(14 + lvl*12 + lvl*lvl*1.55)`
- The tree is opened with a dedicated key/button. It does NOT pause the shared
  game in multiplayer — other players keep playing while one player has their
  Grimoire open. The shared simulation never pauses.
- Layout: a radial "constellation" — 6 branches radiating from a central hub at
  60° intervals, each branch's nodes placed at increasing radius (tiers), with
  prerequisite lines connecting nodes.

### Branches (implement every node's actual effect, not just UI)

**Ember (fire) — color #e2793d**
1. Kindled Spark — bolts +20% damage, apply a burn (3 dmg/s, 3s)
2. Ember Rounds — burn damage doubled; unlocks Fire Nova (periodic AoE burst)
3. Combustion — Fire Nova radius +40%
4. (side) Flash Fire — Fire Nova grants a brief speed burst when it erupts
5. Molten Core — Fire Nova erupts 25% more often
6. Wildfire Spread — burning enemies that die ignite nearby enemies
7. (side) Cinderheart — +15% max HP
8. Inferno — Fire Nova damage +80%
9. Scorched Earth — Fire Nova leaves burning ground (damage over time)
10. Capstone: Wildfire — fire kills always chain-ignite nearby foes

**Rime (frost) — color #8ec9e8**
1. Chill Touch — bolts slow enemies 20% for 2s
2. Frostbite — stronger chill; unlocks Ice Lance (piercing shot that freezes)
3. Deep Freeze — freeze duration doubled
4. (side) Frostbitten Focus — +15% damage to chilled/frozen enemies
5. Glacial Path — Ice Lance pierces 2 more enemies
6. Brittle — frozen enemies take +50% damage from everything
7. (side) Glacial Resolve — +15% max HP
8. Permafrost — all slow effects 50% stronger
9. Winter's Veil — unlocks Frost Armor (periodic shield + slows attackers)
10. Capstone: Absolute Zero — frozen enemies shatter on death, AoE + refreeze

**Void (arcane) — color #9d8ce0** (11 nodes — carries the extra leveling node)
1. Focused Mind — base bolt casts 20% more often
2. Twin Casting — fire an extra bolt per cast
3. (side, tier1) Quick Study — +30% XP gained from slain foes
4. Piercing Sigil — bolts pierce 1 more enemy
5. (side) Arcane Reservoir — 10% chance a bolt cast costs no cooldown
6. Homing Rune — bolts curve toward the nearest foe
7. Overcharge — every 5th cast deals 3x damage
8. (side) Mind Over Matter — +15% max HP
9. Mirror Image — unlocks Arcane Burst (ring of bolts in all directions)
10. Ley Line Tap — all spell cooldowns -20%
11. Capstone: Overload — empowered (Overcharge) casts also spray homing bolts

**Umbral (shadow) — color #c4728f**
1. Cold Reading — 8% crit chance on any hit
2. Marked for Death — crits mark the target; unlocks Shadow Bolt (bonus damage
   to marked)
3. Executioner — crit damage +50%
4. (side) Opportunist — +5% more crit chance
5. Umbral Step — dash leaves a shadow that detonates shortly after
6. Death's Embrace — killing a marked foe refunds part of dash cooldown
7. (side) Grim Vigor — +15% max HP
8. Vampiric Sigil — a % of all damage dealt heals you
9. Twilight Veil — dash's detonation deals much more damage
10. Capstone: Reaper's Mark — killing a marked foe resets all spell cooldowns

**Verdant (nature) — color #8bc48a**
1. Verdant Touch — killing a foe restores a little HP
2. Life Bloom — HP regen doubled; unlocks Thorned Vines (roots/snares nearby
   foes)
3. Bramble Ward — rooted enemies bleed from thorns
4. (side) Photosynthesis — passive HP regen further increased
5. Wildkeeper's Bond — summon a Spirit Wisp companion that auto-attacks
6. Deep Roots — Thorned Vines area up, Wisp attacks faster
7. (side) Hearty Growth — +15% max HP
8. Second Wind — healing received +50%
9. Wild Growth — summon a second Spirit Wisp
10. Capstone: Verdant Bloom — every kill releases a heal-self/damage-enemies pulse

**Warden (body/defense) — color #c9a869**
1. Traveler's Legs — move speed +15%
2. Iron Skin — +25% max HP, reduces dash cooldown
3. Sure Footing — dash cooldown further reduced
4. (side) Momentum — +10% more move speed
5. Thick Hide — all damage taken -15%
6. Adrenaline — speed burst for 3s after dashing
7. (side) Bulwark — damage taken further -10%
8. Vitality — +50% more max HP
9. Battle Focus — HP regen greatly increased
10. Capstone: Undying — once per minute, a killing blow instead leaves you at 1 HP

Total: 6 branches x 10 nodes + 1 extra Void node = 61 nodes.

## Multiplayer-specific additions (not in the original prototype)
- Lobby / host / join flow described above.
- A simple player list HUD (name or slot color, HP bar, level) for all connected
  players, not just yourself.
- Enemies can be damaged by any player's spells; the Host resolves all damage
  and broadcasts results.
- Player-death behavior: a downed player becomes a spectator of their own view
  but the run continues for others; the run ends only when all players are down.
  State this choice clearly in a code comment.
- Network resilience: if a Guest disconnects, remove their mage cleanly without
  crashing the Host's simulation for everyone else.

## Explicit non-goals (don't build these)
- No internet matchmaking, lobbies list, or account system.
- No anti-cheat, input validation against malicious clients, or server
  reconciliation beyond basic host authority — trusted local-network party game.
- No save/persistence between sessions — fine for progress to reset when
  everyone leaves.
- No mobile/touch controls unless trivial to add — keyboard-first is fine.

## Suggested project structure
```
hollowmere/
  server/              # tiny PeerServer signaling bootstrap (self-hosted, LAN only)
  src/
    main.ts
    scenes/            # Phaser scenes: Boot, Lobby, Game, GrimoireOverlay
    net/               # PeerJS wrapper, host-authority sim loop, snapshot (de)serialization
    game/
      player.ts
      enemies.ts
      spells.ts
      skillTree.ts     # node data + effect application, mirrors the spec above
      waves.ts         # day/boss timers, spawn scaling
    ui/                # HUD, lobby screen, grimoire UI
  index.html
  vite.config.ts
  package.json
```

## Build phases (work through in order, verify each with a real build/run)
1. Scaffold Vite + TS + Phaser; full-viewport canvas, pixel-art mage moving
   smoothly via WASD + dash, no combat yet.
2. Single-player parity: port enemies, auto-cast base bolt, waves/day timer,
   boss, and a minimal skill tree UI (even a placeholder list) — a complete
   playable single-player loop in the new framework before adding networking.
3. Networking skeleton: self-hosted PeerServer running alongside Vite,
   Host/Join lobby screens, two browser tabs/devices showing each other's mage
   moving around (position sync only, no combat/enemies yet). Must genuinely
   work across two different devices on the same LAN, not just two tabs on one
   machine.
4. Host-authoritative simulation: move enemy spawning/AI and damage resolution
   to the Host, clients send input and render snapshots.
5. Full skill tree: implement all 61 nodes and their real effects, per-player.
6. Polish pass: player list HUD, disconnect handling, visual distinction
   between players, telegraphed boss attack, general feel/juice (particles,
   screen flash on level-up, etc.).

At the end of each phase, summarize what was built and what to test before
moving to the next phase.
