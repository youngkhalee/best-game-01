# VOID BLOOM — Arena of the Last Light

An original neon arena defender for the browser, built for make.fun's
**best-game-01** bounty. Plain Canvas and ES modules — no engine, no build
step, no network requests. Everything (art, sound, names) is made in code.

## The game

The Hollow are coming for the **Last Light Core** at the centre of the arena —
and for you, its Bloomwarden. Survive **10 waves** of six enemy kinds:

- **Drifter** (pink triangle) hunts you, slow and steady
- **Rusher** (orange dart) pauses, then lunges
- **Spitter** (green hexagon) keeps its distance and spits orbs
- **Sapper** (red square) ignores you and burns the Core
- **Brute** (purple octagon) is slow, huge and hard to kill
- **The Warden** (wave 10) fires radial bursts, calls minions, and enrages

If either you **or the Core** falls, the run ends. Between waves the Bloom
offers a **draft of 3 upgrades** — damage, split shots, piercing, dash,
plating, regeneration and more — while every wave grows faster and tougher.
Pickups (hearts, Core cells, overcharge, stars), a combo multiplier, dash
i-frames, particles, screen shake and synthesised Web Audio sound round it out.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left click | Fire |
| Space / Shift | Dash |
| 1 / 2 / 3 or click | Choose an upgrade |
| P / Esc | Pause |
| M | Mute |
| Enter / click | Start / restart |

## Play it

```sh
node serve.ts        # then open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored `vendor/makefun-game.ts` library, unchanged
from the competition kit.

## Layout

- `game/index.html` — the page and its styles
- `game/src/config.js` — every tuning number and colour
- `game/src/world.js` — the fixed-step simulation (player, Core, waves, combat)
- `game/src/enemies.js` — the six Hollow kinds, wave recipes and the upgrade pool
- `game/src/render.js` — all drawing: field, HUD and every screen
- `game/src/input.js` — keyboard and pointer, in logical field coordinates
- `game/src/audio.js` — synthesised effects and the ambient pad (Web Audio)
- `game/src/particles.js` — pooled particles and floating score text
- `game/src/shots.js` — deterministic `?shot=` scenes for the screenshots
- `game/src/main.js` — boot, the loop and the screen flow

Screenshots in `screenshots/` are real renders of the running game, captured
headlessly from the `?shot=` scenes listed in `shots.json`.

SPDX-License-Identifier: MIT — see `LICENSE`.
