# The Ascent

Foundry VTT (v14, dnd5e) runtime for The Ascent campaign: skill slots, ranks, ticks, techniques, combos and the game-world menus.

The installed module is only `scripts/bootstrap.js`. Every client fetches `scripts/` and `styles/` from `main` at load, so pushing to `main` updates the table. Run `game.ascent.reload()` in a client console to refetch without reloading the page.

## What is where

- `scripts/catalog.js`: the rules data. Skills, Techniques, combos, Talents, the five prefabs, tick costs, slots and rank caps by level.
- `scripts/ascent.js`: the runtime. The Skills tab on the dnd5e sheet, the skill picker, Talent actions (Called It, Hot Swap), and the character select screen.
- `styles/ascent.css`: all styling, one section per screen.

## Character select

`ASCENT.openSelect()` opens it. Each prefab can have its own stage (`STAGES` in `ascent.js`): Andrei's lab diagnostics, Cara's pixel battle screen, Evan's status window and Aiden's ink and brush page. A character without a stage uses the default layout (Kevin, for now).

Per-actor flags under `the-ascent`:

- `theme`: theme song URL. `themeStart`: where it starts and loops, in seconds. The GM sets both from the select screen.
- `cutout`: optional portrait with no background. The default layout stands it in the frame.

Players lock in a character through the active GM (`CONFIG.queries["the-ascent.select"]`), so a GM must be online.

## Credits

Evan's class sprite: fan-made pixel art supplied by the GM, used privately at this table.
