// VOID BLOOM — hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/ (game/index.html plus its ES
// modules; no library, no build step, no network request). This program hands
// it in: it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json with buildDossier from the vendored make.fun
// library, exactly as the best-game-01 gate rebuilds it.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps (reference/gate.json): text_max_bytes shapes the dossier
// text; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 entries in game/, 48 MiB of
// game files in all, or a path under game/ over 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`VOID BLOOM handed in: dossier.json ${dossier.length} bytes -> ${out}`);
