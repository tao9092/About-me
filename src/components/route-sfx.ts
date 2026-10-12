// Sound for the page shutters (route-transition.tsx). Each scene has its own
// score, synthesised live with Web Audio and timed to its picture: the needle
// dropping into the groove of a crackling record, the board powering up, the
// rifle shot over a windy range, the sun breaking out from behind Saturn, an
// old steam train thundering past, the drift through a dreamlike black hole.
// Nothing is downloaded. A score starts with the cover, holds its loops while
// the next page loads, and plays out its ending with the reveal. Visitors can
// switch it off in the nav (setSoundEnabled).
import type { FxName } from "@/components/route-fx";

type Room = "hall" | "space";
type Rig = {
  ctx: AudioContext;
  out: GainNode;
  rooms: Record<Room, GainNode>; // sends into each reverb
  reverbs: Record<Room, ConvolverNode>;
  noise: AudioBuffer; // white
  pink: AudioBuffer;
  crackle: AudioBuffer | null; // a record's surface noise, two turns long
  // The range's open air: the wind runs through one low-pass (which bullet time
  // closes), and the hills carry a shot's rolling tail.
  range: { world: BiquadFilterNode; hills: ConvolverNode } | null;
};
// The sounds that last while the page loads: they play into their own bus, which
// fades out when the reveal starts.
type Hold = { bus: GainNode; sources: AudioScheduledSourceNode[]; timers: number[] };
type Voice = {
  at: number;
  length: number;
  gain: number;
  attack?: number; // seconds to reach the peak
  hold?: number; // seconds to stay there before dying away
  pan?: number;
  reverb?: number; // send to a room
  room?: Room;
  into?: Hold;
  to?: AudioNode; // instead of the hold's bus or the main out
};
export type Score = { reveal: () => void; end: () => void };

const KEY = "sfx";
const LEVEL = 0.6;
const listeners = new Set<() => void>();
/** Whether shutters play sound; on unless the visitor turned it off. */
export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  if (!on) playing?.end();
  if (rig) rig.out.gain.setTargetAtTime(on ? LEVEL : 0, rig.ctx.currentTime, 0.05);
  listeners.forEach((listener) => listener());
}
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// ── The rig: one audio context with its buffers, made once ───────────────────
let rig: Rig | null = null;
let playing: Score | null = null;

/** Makes the audio rig ahead of the first shutter (on the visitor's first tap),
 * then builds its rooms and the record's crackle one at a time while the page is
 * idle, so none of it holds up the click that starts a shutter. */
export function primeSound() {
  if (!soundEnabled() || !getRig()) return;
  const steps = [() => room("hall"), () => openAir(), () => room("space"), () => crackle()];
  const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 60));
  const next = () => {
    steps.shift()?.();
    if (steps.length) idle(next);
  };
  idle(next);
}
// Each room's impulse response and the crackle loop are made on first need.
const ROOM_SHAPES: Record<Room, [seconds: number, decay: number, options: Parameters<typeof impulse>[3]]> = {
  hall: [2.4, 3, { predelay: 0.015, dark: 0.7 }],
  space: [5.5, 2.2, { predelay: 0.045, dark: 0.85 }],
};
function room(name: Room) {
  if (!rig) return null;
  const reverb = rig.reverbs[name];
  // Setting a convolver's buffer prepares it at once (costly for long tails), so
  // each room is set up on its own.
  if (!reverb.buffer) reverb.buffer = impulse(rig.ctx, ...ROOM_SHAPES[name]);
  return reverb.buffer;
}
/** Open air on a range: a dense, rolling tail that dulls as it goes (air soaks up
 * the highs over distance), swelling where the hills answer, as on recordings
 * of rifles fired outdoors. */
function openAirImpulse(ctx: BaseAudioContext) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 2.6);
  const buffer = ctx.createBuffer(2, length, rate);
  const swells: [number, number, number][] = [[0.3, 0.05, 0.5], [0.62, 0.08, 1], [1.05, 0.12, 0.35]];
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let block = Math.floor(0.018 * rate); block < length; block += 128) {
      const t = block / rate;
      const a = Math.max(0.1, 0.55 * Math.exp(-t / 0.75));
      let amount = Math.exp(-t / 0.36) * 0.42;
      for (const [centre, spread, height] of swells) amount += height * 0.35 * Math.exp(-(((t - centre) / spread) ** 2)) * Math.exp(-t / 0.9);
      const scale = Math.sqrt((2 - a) / a) * amount;
      for (let index = block; index < Math.min(length, block + 128); index += 1) {
        low += a * (Math.random() * 2 - 1 - low);
        data[index] = low * scale;
      }
    }
  }
  return buffer;
}
function crackle() {
  if (!rig) return null;
  rig.crackle ??= crackleLoop(rig.ctx);
  return rig.crackle;
}
function openAir() {
  if (!rig) return null;
  if (!rig.range) {
    const world = rig.ctx.createBiquadFilter();
    world.type = "lowpass";
    world.frequency.value = 18000;
    world.connect(rig.out);
    const hills = rig.ctx.createConvolver();
    hills.buffer = openAirImpulse(rig.ctx);
    hills.connect(rig.out);
    rig.range = { world, hills };
  }
  return rig.range;
}
function getRig(): Rig | null {
  if (rig) return rig;
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  // 48 kHz whatever the sound card runs at (it may be 96 kHz, doubling the work;
  // the browser resamples), with a roomier buffer than the low-latency default:
  // long reverbs at 96 kHz in small buffers leave the card starved, heard as
  // stutter. Older browsers that refuse the options get the defaults.
  let ctx: AudioContext;
  try {
    ctx = new Context({ sampleRate: 48000, latencyHint: "playback" });
  } catch {
    ctx = new Context();
  }
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.3;
  limiter.connect(ctx.destination);
  const out = ctx.createGain();
  out.gain.value = soundEnabled() ? LEVEL : 0;
  out.connect(limiter);
  const rooms = {} as Record<Room, GainNode>;
  const reverbs = {} as Record<Room, ConvolverNode>;
  for (const name of ["hall", "space"] as const) {
    reverbs[name] = ctx.createConvolver();
    rooms[name] = ctx.createGain();
    rooms[name].connect(reverbs[name]).connect(out);
  }
  rig = { ctx, out, rooms, reverbs, noise: whiteNoise(ctx), pink: pinkNoise(ctx), crackle: null, range: null };
  return rig;
}

function whiteNoise(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}
/** Pink noise (equal energy per octave), after Paul Kellet's filter: softer and
 * more natural than white for wind, steam and air. */
function pinkNoise(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}
/** A reverb's impulse response: decaying stereo noise that darkens as it fades
 * (a one-pole low-pass closing over the tail), after a short pre-delay, plus any
 * discrete echoes ([seconds, level]). */
function impulse(ctx: BaseAudioContext, seconds: number, decay: number, options: { predelay: number; dark: number; level?: number; echoes?: [number, number][] }) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  const start = Math.floor(options.predelay * rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    // The envelope and filter change slowly, so they're worked out per block.
    for (let block = start; block < length; block += 128) {
      const t = (block - start) / (length - start);
      const a = Math.max(0.02, 0.9 - options.dark * 0.88 * t);
      const scale = Math.sqrt((2 - a) / a) * (1 - t) ** decay * (options.level ?? 1);
      for (let index = block; index < Math.min(length, block + 128); index += 1) {
        low += a * (Math.random() * 2 - 1 - low);
        data[index] = low * scale;
      }
    }
    for (const [at, level] of options.echoes ?? []) {
      // Each echo: a short burst, duller the later it comes back.
      const from = Math.floor(at * rate);
      const burst = Math.floor(0.09 * rate);
      const a = Math.max(0.04, 0.5 - at * 0.2);
      let echo = 0;
      for (let k = 0; k < burst && from + k < length; k += 1) {
        echo += a * (Math.random() * 2 - 1 - echo);
        data[from + k] += echo * Math.sqrt((2 - a) / a) * level * Math.exp(-k / (0.025 * rate)) * (channel ? 0.85 : 1);
      }
    }
  }
  return buffer;
}
/** A record's surface noise, two turns of the platter long so it loops cleanly,
 * after a common layered model of vinyl: a soft hiss and low rumble, a fizz of
 * fine dust, crisp ticks, sparse resonant pops of every pitch, and one scratch
 * that comes round with every turn. */
function crackleLoop(ctx: BaseAudioContext) {
  const rate = ctx.sampleRate;
  const turn = 1.8; // 33⅓ rpm
  const length = Math.floor(rate * turn * 2);
  const buffer = ctx.createBuffer(2, length, rate);
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  channels.forEach((data) => {
    let hiss = 0;
    let rumble = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      hiss += 0.3 * (white - hiss);
      rumble = (rumble + 0.03 * white) * 0.996;
      data[index] = hiss * 0.012 + rumble * 0.05;
    }
    // Dust: a fizz of tiny, soft impulses.
    for (let index = 0; index < length; index += Math.ceil(rate / rand(150, 420))) {
      const level = rand(0.004, 0.03) * (Math.random() < 0.5 ? -1 : 1);
      data[index] += level;
      if (index + 1 < length) data[index + 1] += level * 0.5;
    }
    // Ticks: crisp, bright clicks.
    for (let index = 0; index < length - 2; index += Math.ceil(rate * -Math.log(1 - Math.random()) / 7)) {
      const level = rand(0.03, 0.16);
      data[index] += level;
      data[index + 1] -= level * 0.9;
    }
  });
  // Pops: a struck resonance at a random pitch and length, somewhere in the stereo field.
  const pop = (at: number, freq: number, decay: number, level: number, pan: number) => {
    const w = (2 * Math.PI * freq) / rate;
    const r = Math.exp(-1 / (decay * rate));
    let [y1, y2] = [0, 0];
    for (let k = 0; k < decay * rate * 6; k += 1) {
      const y = 2 * r * Math.cos(w) * y1 - r * r * y2 + (k === 0 ? level : 0);
      [y2, y1] = [y1, y];
      const index = (at + k) % length;
      channels[0][index] += y * (1 - pan) * 0.5;
      channels[1][index] += y * (1 + pan) * 0.5;
    }
  };
  for (let at = 0; at < length; at += Math.ceil(rate * -Math.log(1 - Math.random()) * 0.42)) {
    pop(at, Math.exp(rand(Math.log(120), Math.log(5000))), rand(0.0015, 0.03), Math.exp(rand(Math.log(0.04), Math.log(0.5))) * 0.15, rand(-0.7, 0.7));
  }
  const scratch = Math.floor(rate * 0.37);
  for (const at of [scratch, scratch + Math.floor(rate * turn)]) pop(at, 900, 0.012, 0.09, -0.2);
  return buffer;
}

// ── Voices ───────────────────────────────────────────────────────────────────
/** A gain that rises over attack, holds, then dies away by the end of the voice;
 * routed (panned) to its destination, with a send to a room. */
function envelope(r: Rig, voice: Voice) {
  const gain = r.ctx.createGain();
  const attack = voice.attack ?? 0.004;
  gain.gain.setValueAtTime(0.0001, voice.at);
  gain.gain.exponentialRampToValueAtTime(voice.gain, voice.at + attack);
  if (voice.hold) gain.gain.setValueAtTime(voice.gain, voice.at + attack + voice.hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, voice.at + Math.max(voice.length, attack + (voice.hold ?? 0) + 0.01));
  let tail: AudioNode = gain;
  if (voice.pan) {
    const panner = r.ctx.createStereoPanner();
    panner.pan.value = voice.pan;
    gain.connect(panner);
    tail = panner;
  }
  tail.connect(voice.to ?? voice.into?.bus ?? r.out);
  if (voice.reverb) {
    const send = r.ctx.createGain();
    send.gain.value = voice.reverb;
    tail.connect(send);
    send.connect(r.rooms[voice.room ?? "hall"]);
  }
  return gain;
}
function track<T extends AudioScheduledSourceNode>(voice: Voice, source: T, offset = 0) {
  if (source instanceof AudioBufferSourceNode) source.start(voice.at, offset);
  else source.start(voice.at);
  source.stop(voice.at + voice.length + 0.05);
  voice.into?.sources.push(source);
  return source;
}
/** Filtered noise: wind, hiss, steam, the crack of a shot. */
function noise(r: Rig, voice: Voice & { filter: BiquadFilterType; freq: number; sweep?: number; q?: number; pink?: boolean }) {
  const source = r.ctx.createBufferSource();
  source.buffer = voice.pink ? r.pink : r.noise;
  source.loop = true;
  const filter = r.ctx.createBiquadFilter();
  filter.type = voice.filter;
  filter.Q.value = voice.q ?? 0.9;
  filter.frequency.setValueAtTime(voice.freq, voice.at);
  if (voice.sweep) filter.frequency.exponentialRampToValueAtTime(voice.sweep, voice.at + voice.length);
  const shape = envelope(r, voice);
  source.connect(filter).connect(shape);
  return { source: track(voice, source, Math.random() * 1.5), filter, shape };
}
/** An oscillator, optionally gliding to another pitch and softened by a low-pass. */
function tone(r: Rig, voice: Voice & { freq: number; glide?: number; wave?: OscillatorType; detune?: number; lowpass?: number }) {
  const oscillator = r.ctx.createOscillator();
  oscillator.type = voice.wave ?? "sine";
  oscillator.frequency.setValueAtTime(voice.freq, voice.at);
  if (voice.glide) oscillator.frequency.exponentialRampToValueAtTime(voice.glide, voice.at + voice.length);
  if (voice.detune) oscillator.detune.value = voice.detune;
  let head: AudioNode = oscillator;
  if (voice.lowpass) {
    const filter = r.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = voice.lowpass;
    oscillator.connect(filter);
    head = filter;
  }
  head.connect(envelope(r, voice));
  return track(voice, oscillator);
}
/** Sweeps a parameter up and down (a filter, a pitch) while the voice lasts. */
function wobble(r: Rig, param: AudioParam, rate: number, depth: number, voice: Voice) {
  const lfo = r.ctx.createOscillator();
  lfo.frequency.value = rate;
  const amount = r.ctx.createGain();
  amount.gain.value = depth;
  lfo.connect(amount).connect(param);
  track(voice, lfo);
}
const tick = (r: Rig, at: number, gain: number, into?: Hold, freq = rand(1800, 5200)) =>
  noise(r, { at, length: 0.014, gain, attack: 0.001, filter: "bandpass", freq, q: 0.8, pan: rand(-0.5, 0.5), into });
const thump = (r: Rig, at: number, gain: number, into?: Hold) =>
  tone(r, { at, length: 0.22, gain, attack: 0.003, freq: 115, glide: 42, into });

function hold(r: Rig, to: AudioNode = r.out): Hold {
  const bus = r.ctx.createGain();
  bus.connect(to);
  return { bus, sources: [], timers: [] };
}
/** Plays a pattern for as long as the hold lasts: next plays one event at its
 * time and returns when the following one falls. Events are scheduled seconds
 * ahead, since the main thread is busy mounting the next page while a shutter
 * holds and a late timer would leave gaps; the hold's release silences any
 * that are left over. */
function repeat(r: Rig, into: Hold, from: number, next: (at: number) => number) {
  let at = from;
  const fill = () => {
    while (at < r.ctx.currentTime + 3) at = next(at);
  };
  fill();
  into.timers.push(window.setInterval(fill, 150));
}
function release(r: Rig, into: Hold, at: number, fade: number) {
  into.timers.forEach((id) => window.clearInterval(id));
  into.timers.length = 0;
  const when = Math.max(at, r.ctx.currentTime);
  into.bus.gain.setTargetAtTime(0, when, fade / 4);
  for (const source of into.sources) {
    try {
      source.stop(when + fade);
    } catch {
      // Already stopped.
    }
  }
}

// ── Instruments ──────────────────────────────────────────────────────────────
/** An electric piano note after the Fender Rhodes, built as FM pairs like the
 * classic DX7 and STK models: a modulator at the note's own frequency gives the
 * warm body as its depth dies away, and one at fourteen times it, gone in a
 * fraction of a second, gives the bell-like strike of the tine. */
function rhodes(r: Rig, at: number, midi: number, velocity: number, length: number, into: Hold, to: AudioNode, carriers: OscillatorNode[]) {
  const f = note(midi);
  const pair = (ratio: number, index: number, settle: number, level: number, decay: number) => {
    const carrier = r.ctx.createOscillator();
    carrier.frequency.value = f;
    carrier.detune.value = rand(-3, 3);
    const modulator = r.ctx.createOscillator();
    modulator.frequency.value = f * ratio;
    const depth = r.ctx.createGain();
    depth.gain.setValueAtTime(index * f * ratio * velocity, at);
    depth.gain.setTargetAtTime(index * f * ratio * velocity * 0.12, at, settle);
    modulator.connect(depth).connect(carrier.frequency);
    const gain = r.ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level * velocity, at + 0.003);
    gain.gain.setTargetAtTime(0, at + 0.003, decay);
    gain.gain.setTargetAtTime(0, at + length, 0.08);
    carrier.connect(gain).connect(to);
    const voice = { at, length: length + 0.5, gain: 0, into };
    track(voice, carrier);
    track(voice, modulator);
    carriers.push(carrier, modulator);
  };
  pair(1, 1.1, 0.45, 0.32, 1.3); // the body
  pair(14, 0.55, 0.06, 0.14, 0.7); // the tine
}
/** A soft, low kick, a brushed snare and a hat: a lo-fi kit. */
const kit = {
  kick: (r: Rig, at: number, gain: number, into: Hold, to: AudioNode) => {
    tone(r, { at, length: 0.32, gain, attack: 0.002, freq: 150, glide: 52, into, to });
    noise(r, { at, length: 0.02, gain: gain * 0.25, attack: 0.001, filter: "lowpass", freq: 2500, into, to });
  },
  snare: (r: Rig, at: number, gain: number, into: Hold, to: AudioNode) => {
    noise(r, { at, length: 0.2, gain, attack: 0.002, filter: "bandpass", freq: 1900, q: 0.6, into, to, reverb: 0.25 });
    tone(r, { at, length: 0.09, gain: gain * 0.5, attack: 0.002, freq: 190, glide: 160, into, to });
  },
  hat: (r: Rig, at: number, gain: number, into: Hold, to: AudioNode) => {
    noise(r, { at, length: 0.04, gain, attack: 0.001, filter: "highpass", freq: 7500, into, to });
  },
};
/** A rifle shot from the shooter's place, shaped after recordings of real rifles:
 * an instant, broadband bang whose energy sits in the mids (about 300 Hz to
 * 4 kHz) and whose top dies first, a short saturated low punch under it, the
 * round's supersonic snap on top, and (through echo, an outdoor reverb) the long
 * rolling tail off the hills that carries most of a rifle's sound. */
function rifle(r: Rig, at: number, echo: AudioNode) {
  const ctx = r.ctx;
  const drive = ctx.createWaveShaper();
  drive.curve = saturation(1.8);
  const level = ctx.createGain();
  level.gain.value = 0.8;
  drive.connect(level).connect(r.out);
  const send = ctx.createGain();
  send.gain.value = 1;
  const clean = ctx.createBiquadFilter(); // the hills return the bang, not its rumble
  clean.type = "highpass";
  clean.frequency.value = 170;
  level.connect(clean).connect(send).connect(echo);
  // The blast: a pressure pulse, sharp up and slower down (Friedlander), with the
  // snap of the round's shock wave.
  const rate = ctx.sampleRate;
  const blast = ctx.createBuffer(1, Math.floor(rate * 0.02), rate);
  const pulse = blast.getChannelData(0);
  const width = 0.0012 * rate;
  for (let index = 0; index < pulse.length; index += 1) {
    const t = index / width;
    pulse[index] = (1 - t) * Math.exp(-2 * t) * 0.9;
  }
  pulse[0] = 1;
  pulse[1] = -0.95;
  const blastSource = ctx.createBufferSource();
  blastSource.buffer = blast;
  blastSource.connect(drive);
  blastSource.start(at);
  // The bang: noise through the mids, its top closing as it dies.
  const bang = ctx.createBufferSource();
  bang.buffer = r.noise;
  const low = ctx.createBiquadFilter();
  low.type = "highpass";
  low.frequency.value = 140;
  const chest = ctx.createBiquadFilter();
  chest.type = "peaking";
  chest.frequency.value = 400;
  chest.Q.value = 1;
  chest.gain.value = 5;
  const body = ctx.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 950;
  body.Q.value = 0.7;
  body.gain.value = 8;
  const top = ctx.createBiquadFilter();
  top.type = "lowpass";
  top.frequency.setValueAtTime(6500, at);
  top.frequency.setTargetAtTime(1400, at + 0.004, 0.08);
  const bangLevel = ctx.createGain();
  bangLevel.gain.setValueAtTime(0, at);
  bangLevel.gain.linearRampToValueAtTime(0.75, at + 0.0008);
  bangLevel.gain.setTargetAtTime(0, at + 0.0008, 0.07);
  bang.connect(low).connect(chest).connect(body).connect(top).connect(bangLevel).connect(drive);
  bang.start(at, Math.random() * 1.5);
  bang.stop(at + 0.7);
  // The punch: the weight of the report, low and short, driven for harmonics a
  // small speaker can play.
  tone(r, { at, length: 0.26, gain: 0.4, attack: 0.001, freq: 105, glide: 48, to: drive });
  noise(r, { at, length: 0.2, gain: 0.25, attack: 0.001, filter: "lowpass", freq: 220, to: drive });
}

/** The round hitting the king: a hard crack and the thwack of the blow, the turned
 * wood knocked into ringing (noise struck through its resonances, at about
 * 1 : 2.6 : 4.5 like a wood block), a dull thud, then splinters and chunks
 * scattering. */
function strike(r: Rig, at: number) {
  const ctx = r.ctx;
  const drive = ctx.createWaveShaper();
  drive.curve = saturation(1.5);
  const level = ctx.createGain();
  level.gain.value = 1.25;
  drive.connect(level).connect(r.out);
  const room = ctx.createGain();
  room.gain.value = 0.25;
  level.connect(room).connect(r.rooms.hall);
  noise(r, { at, length: 0.08, gain: 1, attack: 0.0005, filter: "bandpass", freq: 2500, q: 0.6, to: drive }); // the crack
  noise(r, { at, length: 0.22, gain: 0.8, attack: 0.001, filter: "bandpass", freq: 1300, q: 0.9, to: drive }); // the thwack
  noise(r, { at, length: 0.14, gain: 0.5, attack: 0.001, filter: "bandpass", freq: 700, q: 1.2, to: drive }); // the wood's body
  for (const [freq, length, gain] of [[430, 0.35, 0.5], [1120, 0.22, 0.35], [1930, 0.14, 0.25]]) {
    noise(r, { at, length, gain, attack: 0.0005, filter: "bandpass", freq, q: 14, to: drive }); // the wood ringing
  }
  noise(r, { at, length: 0.16, gain: 0.15, attack: 0.001, filter: "lowpass", freq: 260, to: drive }); // the thud
  tone(r, { at, length: 0.16, gain: 0.15, attack: 0.001, freq: 120, glide: 58, to: drive });
  for (let k = 0; k < 26; k += 1) {
    const when = at + 0.015 + Math.random() ** 1.7 * 0.7;
    const chunk = Math.random() < 0.25;
    noise(r, {
      at: when,
      length: chunk ? rand(0.03, 0.06) : rand(0.006, 0.02),
      gain: chunk ? rand(0.08, 0.16) : rand(0.04, 0.12),
      attack: 0.0005,
      filter: "bandpass",
      freq: chunk ? rand(500, 1100) : rand(2200, 7000),
      q: chunk ? 3 : 1.2,
      pan: rand(-0.8, 0.8),
      to: drive,
    });
  }
}

function saturation(drive: number) {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}
/** A steam whistle: three chimes, each a breathy pipe tone that scoops up to
 * pitch as the valve opens. shift bends it (the Doppler of a passing train). */
function whistle(r: Rig, at: number, length: number, gain: number, to: AudioNode, reverb: number) {
  const chimes = [66, 69, 73]; // F#4, A4, C#5: the old minor chime
  return chimes.map((midi) => {
    const f = note(midi);
    const pipe = tone(r, { at, length, gain: gain * 0.6, attack: 0.09, hold: length - 0.2, wave: "triangle", freq: f * 0.975, lowpass: 2600, to, reverb, room: "hall" });
    pipe.frequency.setTargetAtTime(f, at, 0.05);
    wobble(r, pipe.detune, 5.2, 4, { at, length, gain: 0 });
    const breath = noise(r, { at, length, gain: gain * 0.35, attack: 0.07, hold: length - 0.2, filter: "bandpass", freq: f, q: 9, pink: true, to, reverb, room: "hall" });
    return { pipe, breath: breath.filter, f };
  });
}
/** The exhaust beat of a steam engine: a burst of steam through the stack, its
 * resonance giving each chuff its body; four to a turn of the wheels, the
 * strongest first. */
function chuff(r: Rig, at: number, gain: number, length: number, to: AudioNode, into?: Hold) {
  noise(r, { at, length, gain, attack: 0.006, filter: "bandpass", freq: rand(520, 680), q: 1.3, pink: true, to, into });
  noise(r, { at, length: length * 0.8, gain: gain * 0.7, attack: 0.004, filter: "lowpass", freq: 260, pink: true, to, into });
}
const CHUFF_ACCENT = [1, 0.62, 0.85, 0.55];
/** A wheel over a rail joint: a sharp metallic tick with a short ring. */
function clack(r: Rig, at: number, gain: number, to: AudioNode, into?: Hold) {
  noise(r, { at, length: 0.03, gain, attack: 0.001, filter: "bandpass", freq: 2600, q: 2.5, to, into });
  tone(r, { at, length: 0.06, gain: gain * 0.35, attack: 0.001, freq: 410, glide: 380, to, into });
}

// ── The scores ───────────────────────────────────────────────────────────────
type Composer = (r: Rig, start: number, cover: number, reveal: number) => { reveal: (at: number) => void; held: Hold[] };

const scores: Record<FxName, Composer> = {
  // Home: a record. The cue lever lowers the arm and the needle drops with a soft
  // thump into the crackle of the lead-in; then a lo-fi groove at the picture's
  // pulse (93 bpm, a beat on every pulse): warm electric piano chords, a soft
  // kick, a brushed snare and hats, with a little wow and flutter. On the way out
  // the turntable is switched off and the record slows to a stop as the camera
  // cranes away, then dives through the spindle hole.
  vinyl: (r, start, cover, reveal) => {
    const drop = start + cover * 0.82; // route-fx-vinyl: the arm is down once the lift ends
    const beat = 1 / 1.55; // the scene pulses at 1.55 Hz from the drop
    const first = drop + beat / 4; // its first pulse peaks a quarter cycle in
    tick(r, start + 0.05, 0.06, undefined, 1500); // the cue lever
    noise(r, { at: start + 0.05, length: cover * 0.75, gain: 0.03, attack: 0.2, filter: "bandpass", freq: 300, q: 1.5 }); // the arm lowering
    noise(r, { at: start, length: cover + 0.4, gain: 0.025, attack: 0.15, hold: cover - 0.2, filter: "lowpass", freq: 520, pink: true }); // the platter turning
    thump(r, drop, 0.3);
    noise(r, { at: drop, length: 0.07, gain: 0.08, attack: 0.002, filter: "bandpass", freq: 1500, q: 1.2 }); // the stylus finding the groove
    const record = hold(r);
    // The surface: the crackle loop, a touch louder through the lead-in groove.
    const surface = r.ctx.createBufferSource();
    surface.buffer = crackle();
    surface.loop = true;
    const surfaceLevel = r.ctx.createGain();
    surfaceLevel.gain.setValueAtTime(0, drop);
    surfaceLevel.gain.linearRampToValueAtTime(1.6, drop + 0.02);
    surfaceLevel.gain.setTargetAtTime(1, drop + 0.05, 0.25);
    surface.connect(surfaceLevel).connect(record.bus);
    track({ at: drop, length: 12, gain: 0, into: record }, surface);
    // The music, through a warm, slightly saturated lo-fi chain.
    const music = r.ctx.createGain();
    music.gain.value = 0.1;
    const warmth = r.ctx.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = 3600;
    warmth.Q.value = 0.4;
    const tape = r.ctx.createWaveShaper();
    tape.curve = saturation(1.4);
    music.connect(warmth).connect(tape).connect(record.bus);
    const room = r.ctx.createGain();
    room.gain.value = 0.18;
    tape.connect(room).connect(r.rooms.hall);
    const wow = r.ctx.createGain();
    wow.gain.value = 7;
    const flutter = r.ctx.createGain();
    flutter.gain.value = 2;
    const voices: OscillatorNode[] = [];
    for (const [rate, depth] of [[0.55, wow], [5.6, flutter]] as const) {
      const lfo = r.ctx.createOscillator();
      lfo.frequency.value = rate;
      lfo.connect(depth);
      track({ at: drop, length: 12, gain: 0, into: record }, lfo);
    }
    const chords = [
      [53, 57, 60, 64, 67], // Fmaj9
      [52, 55, 59, 62], // Em7
      [50, 53, 57, 60, 64], // Dm9
      [48, 52, 55, 59, 62], // Cmaj9
    ];
    let count = 0;
    repeat(r, record, first, (at) => {
      if (count % 2 === 0) {
        const chord = chords[(count / 2) % chords.length];
        chord.forEach((midi, index) => {
          const before = voices.length;
          rhodes(r, at + index * 0.012, midi, rand(0.75, 0.95), beat * 2, record, music, voices);
          for (const voice of voices.slice(before)) {
            wow.connect(voice.detune);
            flutter.connect(voice.detune);
          }
        });
        kit.kick(r, at, 0.75, record, music);
      } else {
        kit.snare(r, at + 0.012, 0.32, record, music);
      }
      kit.hat(r, at, 0.09, record, music);
      kit.hat(r, at + beat * 0.56, 0.06, record, music); // swung
      count += 1;
      return at + beat;
    });
    return {
      held: [record],
      reveal: (at) => {
        // Power off: everything on the platter slows to a stop.
        for (const voice of voices) {
          voice.detune.cancelScheduledValues(at);
          voice.detune.setValueAtTime(voice.detune.value, at);
          voice.detune.setTargetAtTime(-3600, at, 0.2);
        }
        surface.playbackRate.setValueAtTime(1, at);
        surface.playbackRate.setTargetAtTime(0.05, at, 0.2);
        warmth.frequency.setTargetAtTime(400, at, 0.18);
        release(r, record, at + 0.4, 0.6);
        // The dive: air rushing past and through the hole, rising out of the stop.
        noise(r, { at: at + 0.12, length: reveal, gain: 0.08, attack: 0.3, hold: reveal * 0.45, filter: "bandpass", freq: 260, sweep: 2600, q: 0.8, pink: true, reverb: 0.4 });
      },
    };
  },

  // Projects: a circuit board powering up. A relay clunks and the flare zaps,
  // mains hum swells and data chirps over it while the code drifts up; the dive
  // into the die rises and rises until the core opens with a burst of glitches
  // and a clean chime.
  code: (r, start, cover, reveal) => {
    const on = start + cover * 0.25; // route-fx-circuit: power reaches the chip, with a flare
    thump(r, on - 0.015, 0.2);
    noise(r, { at: on, length: 0.14, gain: 0.2, attack: 0.002, filter: "highpass", freq: 3200, sweep: 8000, reverb: 0.3 });
    tone(r, { at: on, length: 0.3, gain: 0.06, attack: 0.003, freq: 900, glide: 2800, reverb: 0.3 });
    const powered = hold(r);
    tone(r, { at: on, length: 12, gain: 0.05, attack: 0.3, hold: 11.4, wave: "sawtooth", freq: 55, lowpass: 260, into: powered });
    tone(r, { at: on, length: 12, gain: 0.012, attack: 0.5, hold: 11, wave: "square", freq: 110, lowpass: 700, into: powered });
    const scale = [84, 86, 88, 91, 93, 96];
    repeat(r, powered, on + 0.08, (at) => {
      tone(r, { at, length: 0.05, gain: rand(0.018, 0.04), attack: 0.002, wave: "square", freq: note(pick(scale)), lowpass: 4200, pan: rand(-0.6, 0.6), into: powered });
      return at + rand(0.045, 0.12);
    });
    return {
      held: [powered],
      reveal: (at) => {
        release(r, powered, at + 0.55, 0.35);
        const open = at + reveal * 0.78; // the core opens onto the page
        noise(r, { at, length: open - at + 0.05, gain: 0.13, attack: open - at, filter: "bandpass", freq: 300, sweep: 6000, q: 1.2 });
        tone(r, { at: at + 0.08, length: open - at, gain: 0.05, attack: open - at - 0.1, wave: "sawtooth", freq: 110, glide: 880, lowpass: 2600 });
        for (let k = 0; k < 12; k += 1) {
          tone(r, { at: open + k * 0.011, length: 0.03, gain: 0.04, attack: 0.001, wave: "square", freq: rand(700, 3400), pan: rand(-0.8, 0.8) });
        }
        for (const [midi, gain] of [[84, 0.09], [91, 0.06], [96, 0.04]]) {
          tone(r, { at: open + 0.03, length: 1.3, gain, attack: 0.004, freq: note(midi), reverb: 0.5 });
        }
      },
    };
  },

  // Competitions: wind over a range at dusk, a rifle shot and the hit. Gusts come
  // and go, a thin whistle riding them and the grass rustling high up; the scope
  // locks with a click. The shot cracks out, and in bullet time the world falls
  // muffled while the round whirs on, until it smashes into the king; as the lens
  // shatters time snaps back, the wind with it and the shot's echo still rolling
  // round the hills.
  scope: (r, start, cover, reveal) => {
    // The wind runs through one low-pass that bullet time closes; the hills carry the shot.
    const { world, hills } = openAir()!;
    world.frequency.cancelScheduledValues(start);
    world.frequency.setValueAtTime(18000, start);
    const air = hold(r, world);
    const gust = { at: start, length: 14, gain: 1, attack: 0.35, hold: 13, into: air };
    const rush = noise(r, { ...gust, gain: 0.16, filter: "lowpass", freq: 500, q: 0.7, pink: true });
    const whistling = noise(r, { ...gust, gain: 0.05, filter: "bandpass", freq: 950, q: 16 });
    const grass = noise(r, { ...gust, gain: 0.012, filter: "highpass", freq: 4200 });
    const howl = noise(r, { ...gust, gain: 0.04, filter: "bandpass", freq: 1200, q: 0.7, pink: true }); // what a phone's speaker carries
    repeat(r, air, start + 0.4, (at) => {
      const strength = rand(0.15, 1);
      howl.filter.frequency.setTargetAtTime(lerp(900, 1900, strength), at, 0.5);
      howl.shape.gain.setTargetAtTime(lerp(0.015, 0.06, strength), at, 0.5);
      rush.filter.frequency.setTargetAtTime(lerp(320, 1100, strength), at, 0.45);
      rush.shape.gain.setTargetAtTime(lerp(0.07, 0.2, strength), at, 0.5);
      whistling.filter.frequency.setTargetAtTime(lerp(720, 1350, strength) + rand(-40, 40), at, 0.6);
      whistling.shape.gain.setTargetAtTime(lerp(0.004, 0.05, strength ** 2), at, 0.5);
      grass.shape.gain.setTargetAtTime(lerp(0.004, 0.02, strength), at, 0.4);
      return at + rand(0.7, 1.6);
    });
    tick(r, start + cover * 0.9, 0.12, undefined, 2400); // the scope locks
    return {
      held: [air],
      reveal: (at) => {
        // route-fx-range: FIRE 0.06, the cut to bullet time 0.1, IMPACT 0.64, BREAK 0.74.
        const fire = at + reveal * 0.06;
        const slow = at + reveal * 0.1;
        const impact = at + reveal * 0.64;
        const resume = at + reveal * 0.74;
        rifle(r, fire, hills);
        // Bullet time: the wind falls muffled while the round whirs on in slow
        // motion, then strikes the king.
        world.frequency.setValueAtTime(18000, slow);
        world.frequency.setTargetAtTime(500, slow, 0.08);
        world.frequency.setTargetAtTime(18000, resume, 0.06);
        noise(r, { at: slow, length: impact - slow + 0.05, gain: 0.11, attack: 0.3, hold: impact - slow - 0.4, filter: "bandpass", freq: 520, sweep: 1300, q: 1.1, pink: true, reverb: 0.3 });
        tone(r, { at: slow, length: impact - slow, gain: 0.035, attack: 0.3, hold: impact - slow - 0.45, wave: "triangle", freq: 196, glide: 233, lowpass: 900 });
        strike(r, impact);
        // Time snaps back with a gust, the shot still rolling round the hills.
        rush.shape.gain.setTargetAtTime(0.22, resume, 0.08);
        release(r, air, at + reveal, 0.9);
      },
    };
  },

  // Certificates: Saturn eclipsing the sun. Deep space: a low drone and a slow
  // choir of detuned voices swelling as the planet nears, ice in the rings
  // glinting. Then the sun breaks from behind the limb as a soft, shining glint,
  // the choir warms and gives way to a bright chord that blooms and fades into
  // the vastness.
  saturn: (r, start, cover, reveal) => {
    const space = hold(r);
    tone(r, { at: start, length: 12, gain: 0.07, attack: cover, hold: 11, freq: 41, into: space });
    const choir = hold(r);
    const air = r.ctx.createBiquadFilter();
    air.type = "lowpass";
    air.frequency.value = 700;
    choir.bus.disconnect();
    choir.bus.connect(air).connect(r.out);
    for (const midi of [45, 52, 57, 61, 64]) {
      for (const detune of [-7, 6]) {
        tone(r, { at: start, length: 12, gain: 0.014, attack: cover * 1.1, hold: 10.5, wave: "sawtooth", freq: note(midi), detune, into: choir });
      }
    }
    const wind = { at: start, length: 12, gain: 0.028, attack: 0.6, hold: 11, into: space };
    wobble(r, noise(r, { ...wind, filter: "bandpass", freq: 500, q: 0.7 }).filter.frequency, 0.18, 300, wind);
    repeat(r, space, start + cover * 0.6, (at) => {
      tone(r, { at, length: 0.45, gain: rand(0.006, 0.018), attack: 0.003, freq: rand(3000, 6600), pan: rand(-0.8, 0.8), reverb: 0.7, into: space });
      return at + rand(0.08, 0.22);
    });
    return {
      held: [space, choir],
      reveal: (at) => {
        // route-fx-cassini: the sun clears the limb at about 0.06; the light floods until 0.62.
        const flash = at + reveal * 0.06;
        for (const [midi, gain] of [[93, 0.022], [100, 0.014]]) {
          tone(r, { at: flash, length: 2.2, gain, attack: 0.025, freq: note(midi), reverb: 0.9, room: "space" });
        }
        air.frequency.setTargetAtTime(1300, at, 0.3);
        // The light: a bright A major, soft as it blooms and slow to fade.
        for (const midi of [69, 73, 76, 81, 85]) {
          tone(r, { at: flash + 0.05, length: 2.6, gain: 0.022, attack: 0.45, hold: 0.4, freq: note(midi), detune: rand(-4, 4), pan: rand(-0.4, 0.4), reverb: 0.8, room: "space" });
        }
        noise(r, { at: at + reveal * 0.3, length: reveal * 0.7, gain: 0.02, attack: reveal * 0.32, filter: "bandpass", freq: 1400, q: 0.5, pink: true, reverb: 0.7, room: "space" });
        release(r, space, at + reveal * 0.45, 0.8);
        release(r, choir, at + reveal * 0.35, 0.7);
      },
    };
  },

  // Experience: an old steam train. Its whistle cries out as the headlight bursts
  // from the dark, over the growing roll of the wheels and the engine's beat, and
  // drops as the engine thunders past in a rush of steam; then the carriages roll
  // by, the wheels clicking over the rail joints above the roar of the track,
  // steam hissing and the engine beating away up ahead. On the way out it gathers
  // speed and draws off into the night, with one last call of the whistle far away.
  train: (r, start, cover, reveal) => {
    const pass = start + cover * 0.6; // route-fx-rail: the engine passes the camera
    const near = r.ctx.createBiquadFilter(); // distance: duller far away
    near.type = "lowpass";
    near.frequency.setValueAtTime(900, start);
    near.frequency.exponentialRampToValueAtTime(9000, pass);
    const approach = r.ctx.createGain();
    approach.gain.setValueAtTime(0.25, start);
    approach.gain.exponentialRampToValueAtTime(1, pass);
    approach.gain.setTargetAtTime(0.45, pass + 0.05, 0.25);
    approach.connect(near).connect(r.out);
    const call = whistle(r, start, pass - start + 0.55, 0.14, approach, 0.35);
    for (const { pipe, breath, f } of call) {
      pipe.frequency.setTargetAtTime(f * 1.03, start + 0.12, 0.08); // rising a little as it comes on
      pipe.frequency.setTargetAtTime(f * 0.93, pass - 0.03, 0.06); // and the Doppler drop as it passes
      breath.frequency.setTargetAtTime(f * 1.03, start + 0.12, 0.08);
      breath.frequency.setTargetAtTime(f * 0.93, pass - 0.03, 0.06);
    }
    noise(r, { at: start, length: pass - start + 0.35, gain: 0.13, attack: pass - start, filter: "bandpass", freq: 420, q: 0.5, pink: true, to: approach }); // the wheels rolling nearer
    for (let at = start + 0.02, k = 0; at < pass + 0.1; at += 0.15, k += 1) chuff(r, at, 0.45 * CHUFF_ACCENT[k % 4], 0.2, approach);
    noise(r, { at: pass - 0.15, length: 0.7, gain: 0.2, attack: 0.15, filter: "bandpass", freq: 700, sweep: 2200, q: 0.7, pink: true }); // the rush of it passing
    noise(r, { at: pass - 0.05, length: 0.9, gain: 0.07, attack: 0.05, filter: "highpass", freq: 3000, pink: true, reverb: 0.3 }); // steam blowing past
    const carriages = hold(r);
    // The carriages rolling by: the roar of the track (low, and through the mids
    // that small speakers carry) and steam hissing, unbroken under the beats.
    const rolling = { at: pass - 0.1, length: 14, gain: 0.1, attack: 0.2, hold: 13, into: carriages };
    noise(r, { ...rolling, filter: "lowpass", freq: 160, pink: true });
    const roar = noise(r, { ...rolling, gain: 0.085, filter: "bandpass", freq: 480, q: 0.5, pink: true });
    wobble(r, roar.filter.frequency, 1 / 0.42, 90, rolling); // swelling with each bogie
    noise(r, { ...rolling, gain: 0.022, filter: "highpass", freq: 2800, pink: true });
    const ahead = r.ctx.createBiquadFilter();
    ahead.type = "lowpass";
    ahead.frequency.value = 1100;
    ahead.connect(carriages.bus);
    let k = 0;
    repeat(r, carriages, pass + 0.18, (at) => {
      clack(r, at, 0.18, carriages.bus, carriages);
      clack(r, at + 0.085, 0.13, carriages.bus, carriages);
      chuff(r, at + 0.1, 0.18 * CHUFF_ACCENT[k++ % 4], 0.22, ahead, carriages);
      chuff(r, at + 0.31, 0.18 * CHUFF_ACCENT[k++ % 4], 0.22, ahead, carriages);
      return at + 0.42;
    });
    return {
      held: [carriages],
      reveal: (at) => {
        release(r, carriages, at + 0.3, 0.45);
        // Pulling away: the roll and the beat quicken and fade into the distance.
        const away = r.ctx.createBiquadFilter();
        away.type = "lowpass";
        away.frequency.setValueAtTime(5000, at);
        away.frequency.exponentialRampToValueAtTime(500, at + reveal);
        away.connect(r.out);
        noise(r, { at, length: reveal + 0.4, gain: 0.09, attack: 0.15, filter: "bandpass", freq: 480, q: 0.5, pink: true, to: away });
        let when = at;
        for (let n = 0; n < 12; n += 1) {
          const fade = 1 - n / 12;
          clack(r, when, 0.15 * fade, away);
          chuff(r, when + 0.03, 0.21 * fade * CHUFF_ACCENT[n % 4], 0.16, away);
          when += lerp(0.17, 0.07, n / 11);
        }
        whistle(r, at + 0.25, 0.5, 0.04, away, 0.8);
      },
    };
  },

  // Index: a black hole, as a dream. A slow Lydian chord drifts in from the dark
  // on soft, detuned voices, starlight chimes far apart around it and nebula air
  // breathes behind; falling in, the chord rises and swells, and on the far side
  // it blooms open, high and bright, with a cascade of starlight fading into the
  // vastness.
  blackhole: (r, start, cover, reveal) => {
    const dream = hold(r);
    const chord = [50, 57, 64, 66, 68, 73]; // D Lydian: D A E F# G# C#
    const pads = chord.flatMap((midi, index) =>
      [-5, 5].map((detune) =>
        tone(r, { at: start + index * 0.06, length: 14, gain: 0.032, attack: cover + 0.4, hold: 12, wave: "triangle", freq: note(midi), detune, lowpass: 2200, pan: detune / 12, reverb: 0.7, room: "space", into: dream }),
      ),
    );
    const nebula = { at: start, length: 14, gain: 0.04, attack: 1, hold: 12, into: dream };
    const breath = noise(r, { ...nebula, filter: "bandpass", freq: 700, q: 1.2, pink: true, reverb: 0.6, room: "space" });
    wobble(r, breath.filter.frequency, 0.12, 380, nebula);
    const stars = [81, 85, 88, 90, 92, 97];
    repeat(r, dream, start + cover * 0.5, (at) => {
      tone(r, { at, length: 1.6, gain: rand(0.022, 0.05), attack: 0.006, freq: note(pick(stars)), pan: rand(-0.85, 0.85), reverb: 0.85, room: "space", into: dream });
      return at + rand(0.22, 0.42);
    });
    return {
      held: [dream],
      reveal: (at) => {
        // route-fx-gargantua: the fall ends at 0.75 and the page opens from 0.68.
        const open = at + reveal * 0.68;
        for (const pad of pads) pad.detune.setTargetAtTime(pad.detune.value + 1200, at, (open - at) / 2.5); // rising as it falls
        noise(r, { at, length: open - at + 0.05, gain: 0.08, attack: open - at, filter: "bandpass", freq: 300, sweep: 2400, q: 0.7, pink: true, reverb: 0.6, room: "space" });
        release(r, dream, open, 0.4);
        // The far side: a high, bright bloom and starlight falling.
        for (const midi of [74, 78, 81, 85, 88]) {
          tone(r, { at: open, length: 3.2, gain: 0.036, attack: 0.08, freq: note(midi), detune: rand(-5, 5), pan: rand(-0.5, 0.5), reverb: 0.9, room: "space" });
        }
        [97, 93, 90, 88, 85, 81].forEach((midi, index) => {
          tone(r, { at: open + 0.05 + index * 0.075, length: 1.8, gain: 0.045 - index * 0.004, attack: 0.004, freq: note(midi), pan: rand(-0.7, 0.7), reverb: 0.9, room: "space" });
        });
      },
    };
  },
};

const SCORE_ROOMS: Record<FxName, Room[]> = {
  vinyl: ["hall"],
  code: ["hall"],
  scope: ["hall"],
  saturn: ["hall", "space"],
  train: ["hall"],
  blackhole: ["space"],
};

/** Starts the score for a shutter. Call from the click that starts it; reveal()
 * when the page opens, end() when the shutter is gone. Null when sound is off. */
export function playShutterSound(variant: FxName, times: { cover: number; reveal: number }): Score | null {
  playing?.end();
  playing = null;
  if (!soundEnabled()) return null;
  const r = getRig();
  if (!r) return null;
  void r.ctx.resume();
  for (const name of SCORE_ROOMS[variant]) room(name);
  const start = r.ctx.currentTime + 0.02;
  const score = scores[variant](r, start, times.cover / 1000, times.reveal / 1000);
  let revealed = false;
  const self: Score = {
    reveal: () => {
      if (revealed) return;
      revealed = true;
      score.reveal(r.ctx.currentTime + 0.01);
    },
    end: () => {
      for (const into of score.held) release(r, into, r.ctx.currentTime, 0.4);
      if (playing === self) playing = null;
    },
  };
  playing = self;
  return self;
}
