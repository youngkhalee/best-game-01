// Procedural sound with the Web Audio API: every effect is synthesised, no audio
// files, nothing loads over the network. The context is created lazily on the
// first user gesture (browsers refuse one before that). A soft two-note pad
// loops underneath play; M mutes everything.

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = 0;
  let padStep = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    return true;
  }

  /** One short synthesised blip: an oscillator gliding from f0 to f1. */
  function tone(f0, f1, seconds, type, volume, when = 0) {
    if (!ensure()) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  /** A burst of filtered noise, for explosions and hits. */
  function noise(seconds, volume, cutoff) {
    if (!ensure()) return;
    const t = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  /** The named game effects. Unknown names are ignored. */
  function play(name) {
    if (muted) return;
    switch (name) {
      case 'shoot': tone(880, 320, 0.07, 'square', 0.05); break;
      case 'dash': tone(240, 720, 0.14, 'sawtooth', 0.06); break;
      case 'hit': tone(300, 140, 0.06, 'triangle', 0.08); break;
      case 'explode': noise(0.28, 0.22, 900); tone(160, 40, 0.25, 'sine', 0.2); break;
      case 'bigExplode': noise(0.55, 0.3, 600); tone(120, 30, 0.5, 'sine', 0.28); break;
      case 'hurt': tone(220, 70, 0.22, 'sawtooth', 0.16); noise(0.15, 0.1, 1200); break;
      case 'coreHurt': tone(140, 60, 0.3, 'square', 0.18); break;
      case 'pickup': tone(660, 990, 0.09, 'sine', 0.12); tone(990, 1320, 0.1, 'sine', 0.1, 0.07); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.12, i * 0.07)); break;
      case 'wave': tone(392, 392, 0.12, 'triangle', 0.12); tone(587, 587, 0.16, 'triangle', 0.12, 0.11); break;
      case 'boss': tone(98, 98, 0.4, 'sawtooth', 0.2); tone(147, 147, 0.4, 'sawtooth', 0.14, 0.18); break;
      case 'over': [440, 349, 262, 196].forEach((f, i) => tone(f, f * 0.94, 0.24, 'triangle', 0.14, i * 0.18)); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.2, 'triangle', 0.13, i * 0.11)); break;
      default: break;
    }
  }

  /** A slow ambient pad: two detuned triangles cycling a minor progression. */
  function updateMusic(dt, playing) {
    if (!context || muted) return;
    musicTimer -= dt;
    if (musicTimer > 0) return;
    musicTimer = 2.4;
    if (!playing) return;
    const roots = [110, 87.3, 130.8, 98];
    const root = roots[padStep % roots.length];
    padStep += 1;
    const t = context.currentTime;
    for (const mult of [1, 1.5, 2]) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = root * mult;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.05 / mult, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t);
      osc.stop(t + 2.4);
    }
  }

  return {
    unlock() { ensure(); },
    play,
    updateMusic,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
