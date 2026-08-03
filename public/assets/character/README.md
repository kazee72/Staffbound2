# Character asset

Drop your character GIF in this folder and name it exactly:

    player.gif

That's it — the game will pick it up automatically on next load (`npm run dev`
or a fresh build) and use it as the player mage's sprite, animation included.

## Notes

- The GIF is decoded into a Phaser sprite sheet at boot time (see
  `src/game/gifSprite.ts`), so the full animation plays in-game — it's not
  just a static image.
- Any resolution works; it's scaled to fit the game's existing character
  footprint automatically.
- If `player.gif` isn't present, the game silently falls back to the
  original procedurally-drawn pixel-art mage — nothing breaks.
- This same texture is used for your own character and for other players'
  mage sprites in multiplayer (they're tinted per-player, same as before).
