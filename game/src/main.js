// Boot and the one loop for VOID BLOOM: input is read every frame, the world
// advances in fixed 1/60 s steps while playing, and the renderer paints what is
// there. The game moves between six screens: title, play, paused, the upgrade
// draft, game over and victory.
//
// ?seed=N fixes a run's randomness. ?shot=play|title|upgrade|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK1, ACTION_PICK2, ACTION_PICK3,
  createInput,
} from './input.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY,
  cardRect, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const world = createWorld(createRandom(seed));
  const screen = stageShot(name, world);
  const ui = { pointer: { x: 0, y: 0, inside: false }, best: 4200, muted: false };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, world, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let world = createWorld(createRandom(seed));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    // A fresh world per run: the build (upgrades) resets with everything else.
    world = createWorld(createRandom(Math.floor(Math.random() * 4294967296)));
    world.reset();
    world.startWave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Wave 1. Defend the Last Light Core.');
  }

  function finishRun() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = world.state.result === 'victory' ? SCREEN_VICTORY : SCREEN_OVER;
    announce(world.state.result === 'victory'
      ? `Victory. Score ${world.state.score}.`
      : `Game over. ${world.state.endReason} Score ${world.state.score}.`);
  }

  function pickUpgrade(index) {
    const draft = world.state.draft;
    if (index < 0 || index >= draft.length) return;
    world.applyUpgrade(draft[index]);
    world.startWave();
    screen = SCREEN_PLAY;
    announce(`Wave ${world.state.wave}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK1) pickUpgrade(0);
      else if (actions & ACTION_PICK2) pickUpgrade(1);
      else if (actions & ACTION_PICK3) pickUpgrade(2);
      else if (actions & ACTION_CONFIRM) {
        const p = input.pointer;
        for (let i = 0; i < world.state.draft.length; i += 1) {
          const rect = cardRect(i);
          if (p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height) {
            pickUpgrade(i);
            break;
          }
        }
      }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      startRun();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function drainSounds() {
    for (const name of world.sounds) audio.play(name);
    world.sounds.length = 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameSeconds = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      accumulator += frameSeconds;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        world.step(STEP, input);
        accumulator -= STEP;
        if (world.flags.justEnded) {
          world.flags.justEnded = false;
          finishRun();
        } else if (world.flags.justClearedWave) {
          world.flags.justClearedWave = false;
          screen = SCREEN_UPGRADE;
          announce(`Wave ${world.state.wave} held. Choose a gift.`);
        }
      }
    } else {
      accumulator = 0;
      // Keep the void alive behind the panels: time flows, motes drift.
      world.state.time += frameSeconds;
      world.particles.update(frameSeconds);
    }
    drainSounds();
    audio.updateMusic(frameSeconds, screen === SCREEN_PLAY);
    renderer.draw(world.state, screen, world, { pointer: input.pointer, best, muted: audio.muted });
  }

  // Leaving the tab pauses a running game rather than letting the Hollow feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Void Bloom. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
