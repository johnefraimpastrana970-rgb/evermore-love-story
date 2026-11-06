import type { AmbienceKind, MusicMood, TimeOfDay } from '../content/types';
import { MUSIC_FILES } from '../content/config';

/*
 * Procedural audio: gentle generative music per mood, layered ambience and UI sfx.
 * Drop real tracks into public/assets/audio and map them in content/config.ts → MUSIC_FILES
 * to replace the generated music for any mood.
 */

type Chord = number[];
const I = [0, 4, 7], ii = [2, 5, 9], iii = [4, 7, 11], IV = [5, 9, 12], V = [7, 11, 14], vi = [9, 12, 16];
const mi = [0, 3, 7], mVI = [8, 12, 15], mIII = [3, 7, 10], mVII = [10, 14, 17], miv = [5, 8, 12];

interface MoodDef {
  root: number; // midi
  bpm: number;
  prog: Chord[];
  voice: 'pluck' | 'bell' | 'musicbox';
  density: number; // 0..1 arp note probability
  swing?: number;
  bass?: boolean;
  scale: number[];
}

const MOODS: Record<MusicMood, MoodDef> = {
  title:   { root: 53, bpm: 64, prog: [I, iii, vi, IV], voice: 'bell', density: 0.55, scale: [0, 2, 4, 7, 9], bass: true },
  cozy:    { root: 55, bpm: 74, prog: [I, vi, IV, V], voice: 'pluck', density: 0.6, scale: [0, 2, 4, 7, 9], bass: true },
  kitchen: { root: 60, bpm: 100, prog: [I, IV, V, I], voice: 'pluck', density: 0.75, swing: 0.18, scale: [0, 2, 4, 7, 9], bass: true },
  school:  { root: 57, bpm: 88, prog: [I, V, vi, IV], voice: 'musicbox', density: 0.65, scale: [0, 2, 4, 7, 9] },
  outdoor: { root: 50, bpm: 82, prog: [I, IV, vi, V], voice: 'pluck', density: 0.55, scale: [0, 2, 4, 7, 9], bass: true },
  night:   { root: 57, bpm: 58, prog: [mi, mVI, mIII, mVII], voice: 'bell', density: 0.35, scale: [0, 3, 5, 7, 10] },
  festive: { root: 62, bpm: 112, prog: [I, vi, ii, V], voice: 'bell', density: 0.8, swing: 0.12, scale: [0, 2, 4, 7, 9], bass: true },
};
void miv;

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class MusicLayer {
  gain: GainNode;
  filter: BiquadFilterNode;
  private step = 0;
  private nextTime = 0;
  private timer: number | undefined;
  private seed = Math.random() * 1000;
  private el?: HTMLAudioElement;

  constructor(private ctx: AudioContext, dest: AudioNode, private mood: MusicMood) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2600;
    this.filter.connect(this.gain);
    this.gain.connect(dest);
  }

  start(fadeIn = 2) {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(1, t + fadeIn);
    const file = MUSIC_FILES[this.mood];
    if (file) {
      this.el = new Audio(file);
      this.el.loop = true;
      this.el.crossOrigin = 'anonymous';
      try {
        this.ctx.createMediaElementSource(this.el).connect(this.gain);
        void this.el.play().catch(() => this.startGenerated());
        return;
      } catch {
        this.el = undefined;
      }
    }
    this.startGenerated();
  }

  private startGenerated() {
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stop(fadeOut = 2) {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + fadeOut);
    window.setTimeout(() => {
      if (this.timer) clearInterval(this.timer);
      this.el?.pause();
      this.gain.disconnect();
    }, fadeOut * 1000 + 100);
  }

  private rand() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  private schedule() {
    const m = MOODS[this.mood];
    const eighth = 60 / m.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8);
      const pos = this.step % 8;
      const chord = m.prog[bar % m.prog.length];
      const swingOff = m.swing && pos % 2 === 1 ? eighth * m.swing : 0;
      const t = this.nextTime + swingOff;

      if (pos === 0) {
        // Pad: soft sustained chord.
        for (const n of chord) this.pad(midiHz(m.root + n), t, eighth * 8);
        if (m.bass) this.note(midiHz(m.root - 12 + chord[0]), t, eighth * 3.5, 'sine', 0.16, 0.02);
      }
      if (m.bass && pos === 4) this.note(midiHz(m.root - 12 + chord[0] + (this.rand() < 0.5 ? 7 : 0)), t, eighth * 3, 'sine', 0.12, 0.02);

      // Arpeggio / melody.
      if (this.rand() < m.density * (pos % 2 === 0 ? 1 : 0.6)) {
        const useMelody = this.rand() < 0.35;
        const n = useMelody
          ? m.scale[Math.floor(this.rand() * m.scale.length)] + 12
          : chord[Math.floor(this.rand() * chord.length)] + 12 * (this.rand() < 0.3 ? 1 : 0);
        this.voice(m.voice, midiHz(m.root + 12 + n), t, eighth);
      }
      this.nextTime += eighth;
      this.step++;
    }
  }

  private pad(freq: number, t: number, dur: number) {
    for (const det of [-6, 6]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = det;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.028, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
      o.connect(g).connect(this.filter);
      o.start(t);
      o.stop(t + dur * 1.1);
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, attack: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private voice(kind: MoodDef['voice'], freq: number, t: number, eighth: number) {
    if (kind === 'pluck') {
      this.note(freq, t, eighth * 2.5, 'triangle', 0.09, 0.005);
    } else if (kind === 'bell') {
      this.note(freq, t, eighth * 5, 'sine', 0.08, 0.005);
      this.note(freq * 2.01, t, eighth * 2, 'sine', 0.025, 0.005);
    } else {
      this.note(freq * 2, t, eighth * 3, 'sine', 0.06, 0.002);
      this.note(freq * 4.02, t, eighth * 1.2, 'sine', 0.015, 0.002);
    }
  }
}

class AmbienceLayer {
  gain: GainNode;
  private nodes: AudioScheduledSourceNode[] = [];
  private timers: number[] = [];

  constructor(private ctx: AudioContext, dest: AudioNode, private noise: AudioBuffer) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(dest);
  }

  private noiseBed(type: BiquadFilterType, freq: number, vol: number, q = 0.7, lfo = 0) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.gain);
    if (lfo > 0) {
      const l = this.ctx.createOscillator();
      l.frequency.value = lfo;
      const lg = this.ctx.createGain();
      lg.gain.value = vol * 0.6;
      l.connect(lg).connect(g.gain);
      l.start();
      this.nodes.push(l);
    }
    src.start();
    this.nodes.push(src);
  }

  private every(minMs: number, maxMs: number, fn: () => void) {
    const tick = () => {
      fn();
      this.timers.push(window.setTimeout(tick, minMs + Math.random() * (maxMs - minMs)));
    };
    this.timers.push(window.setTimeout(tick, Math.random() * maxMs));
  }

  private blip(freq: number, endFreq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  build(kind: AmbienceKind, time: TimeOfDay, rain: boolean) {
    if (kind === 'none') return;
    const night = time === 'night';
    if (kind === 'room' || kind === 'kitchen' || kind === 'school') {
      this.noiseBed('lowpass', 300, 0.05);
    }
    if (kind === 'kitchen') {
      const hum = this.ctx.createOscillator();
      hum.frequency.value = 58;
      const hg = this.ctx.createGain();
      hg.gain.value = 0.012;
      hum.connect(hg).connect(this.gain);
      hum.start();
      this.nodes.push(hum);
      this.every(5000, 12000, () => this.blip(2400 + Math.random() * 1200, 2300, 0.25, 0.025));
    }
    if (kind === 'school') {
      this.every(1000, 1000, () => this.blip(1800, 1200, 0.03, 0.02, 'square'));
    }
    if (kind === 'outdoor') {
      this.noiseBed('bandpass', 500, 0.08, 0.5, 0.08);
      if (!night) {
        this.every(1800, 6000, () => {
          const base = 2600 + Math.random() * 1500;
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            window.setTimeout(() => this.blip(base, base * 1.25, 0.09, 0.03), i * 120);
          }
        });
      } else {
        this.every(250, 700, () => this.blip(4400, 4300, 0.05, 0.012));
      }
    }
    if (rain) this.noiseBed('highpass', 1200, 0.12);
  }

  start(fade = 1.5) {
    const t = this.ctx.currentTime;
    this.gain.gain.setValueAtTime(0, t);
    this.gain.gain.linearRampToValueAtTime(1, t + fade);
  }

  stop(fade = 1.5) {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + fade);
    this.timers.forEach(clearTimeout);
    window.setTimeout(() => {
      this.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
      this.gain.disconnect();
    }, fade * 1000 + 100);
  }
}

export type SfxName =
  | 'collect' | 'click' | 'open' | 'close' | 'levelup' | 'achievement' | 'quest' | 'error'
  | 'door' | 'type' | 'secret' | 'success' | 'fail' | 'hit' | 'heart'
  // pizza shop
  | 'bell' | 'squish' | 'sizzle' | 'ding' | 'register' | 'chime' | 'chop' | 'plop' | 'stretch';

class AudioEngine {
  ctx?: AudioContext;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private sfxBus!: GainNode;
  private music?: MusicLayer;
  private amb?: AmbienceLayer;
  private musicMood?: MusicMood;
  private ambKey = '';
  private noise?: AudioBuffer;
  private vols = { master: 0.8, music: 0.6, ambience: 0.5, sfx: 0.8 };
  private pendingMood?: MusicMood;
  private pendingAmb?: [AmbienceKind, TimeOfDay, boolean];

  /** Must be called from a user gesture (click/tap/key). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.ambBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      [this.musicBus, this.ambBus, this.sfxBus].forEach((b) => b.connect(this.master));
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // Slightly pink-ish noise.
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = w * 0.6 + last * 3;
      }
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.pendingMood) { const m = this.pendingMood; this.pendingMood = undefined; this.playMusic(m); }
    if (this.pendingAmb) { const a = this.pendingAmb; this.pendingAmb = undefined; this.setAmbience(...a); }
  }

  setVolumes(v: { master: number; music: number; ambience: number; sfx: number }) {
    this.vols = { ...v };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vols.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.9, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vols.ambience, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx * 0.7, t, 0.05);
  }

  playMusic(mood: MusicMood) {
    if (!this.ctx || this.ctx.state !== 'running') {
      this.pendingMood = mood;
      return;
    }
    if (this.musicMood === mood && this.music) return;
    this.music?.stop(2.5);
    this.musicMood = mood;
    this.music = new MusicLayer(this.ctx, this.musicBus, mood);
    this.music.start(2.5);
  }

  setAmbience(kind: AmbienceKind, time: TimeOfDay, rain: boolean) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.noise) {
      this.pendingAmb = [kind, time, rain];
      return;
    }
    const key = `${kind}:${time}:${rain}`;
    if (key === this.ambKey) return;
    this.ambKey = key;
    this.amb?.stop();
    this.amb = new AmbienceLayer(this.ctx, this.ambBus, this.noise);
    this.amb.build(kind, time, rain);
    this.amb.start();
  }

  /** Temporarily lower music (e.g. during letters). */
  duck(on: boolean) {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? this.vols.music * 0.35 : this.vols.music * 0.9, this.ctx.currentTime, 0.3);
  }

  sfx(name: SfxName) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const tone = (f: number, start: number, dur: number, vol = 0.2, type: OscillatorType = 'sine', f2?: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t + start);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(vol, t + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(this.sfxBus);
      o.start(t + start);
      o.stop(t + start + dur + 0.05);
    };
    const noiseHit = (freq: number, dur: number, vol: number, type: BiquadFilterType = 'lowpass', start = 0, q = 1, attack = 0) => {
      if (!this.noise) return;
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      const t0 = t + start;
      if (attack) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); }
      else g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f).connect(g).connect(this.sfxBus);
      s.start(t0, Math.random() * 1.5);
      s.stop(t0 + dur + 0.05);
    };
    switch (name) {
      case 'collect': tone(1046, 0, 0.12, 0.16); tone(1568, 0.07, 0.22, 0.14); break;
      case 'heart': tone(784, 0, 0.12, 0.15); tone(1175, 0.08, 0.25, 0.13); break;
      case 'click': tone(1400, 0, 0.04, 0.08, 'triangle'); break;
      case 'type': tone(900 + Math.random() * 200, 0, 0.025, 0.025, 'triangle'); break;
      case 'open': noiseHit(1800, 0.18, 0.08, 'bandpass'); tone(660, 0.02, 0.18, 0.08); break;
      case 'close': noiseHit(900, 0.14, 0.06, 'bandpass'); tone(440, 0, 0.14, 0.06); break;
      case 'door': noiseHit(220, 0.35, 0.3); tone(110, 0, 0.3, 0.12, 'sine', 70); break;
      case 'quest': tone(659, 0, 0.18, 0.14); tone(988, 0.12, 0.35, 0.14); break;
      case 'success': [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.4, 0.13)); break;
      case 'fail': tone(330, 0, 0.25, 0.1, 'triangle', 220); break;
      case 'error': tone(180, 0, 0.18, 0.1, 'square'); break;
      case 'hit': tone(1318, 0, 0.1, 0.13); break;
      case 'secret': [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, i * 0.06, 0.5, 0.09)); break;
      case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.09, 0.7, 0.14)); tone(2093, 0.5, 0.9, 0.06); break;
      case 'achievement': [659, 831, 988, 1318].forEach((f) => tone(f, 0, 1.2, 0.07)); tone(1976, 0.15, 0.8, 0.05); break;
      // --- pizza shop
      case 'bell': // shop door bell: two bright, slightly detuned strikes
        for (const [st, f] of [[0, 1760], [0.16, 1480]] as const) { tone(f, st, 0.9, 0.09); tone(f * 2.76, st, 0.35, 0.03); }
        break;
      case 'squish': noiseHit(500 + Math.random() * 250, 0.12, 0.08, 'bandpass', 0, 2.5); tone(170 + Math.random() * 40, 0, 0.08, 0.03, 'sine', 120); break;
      case 'stretch': tone(220, 0, 0.35, 0.05, 'triangle', 330); break;
      case 'sizzle': noiseHit(5200, 1.4, 0.06, 'highpass', 0, 0.7, 0.15); noiseHit(2600, 1.1, 0.03, 'bandpass', 0.2, 3, 0.2); break;
      case 'ding': tone(1568, 0, 1.4, 0.13); tone(1568 * 2.4, 0, 0.5, 0.03); tone(2093, 0.02, 1.0, 0.04); break;
      case 'register': // cash drawer: click-clack, then a bright "cha-ching"
        noiseHit(3000, 0.05, 0.12, 'highpass'); noiseHit(1400, 0.08, 0.1, 'bandpass', 0.07, 2);
        tone(2637, 0.14, 0.5, 0.08); tone(3136, 0.2, 0.6, 0.07);
        break;
      case 'chime': [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tone(f, i * 0.07, 0.9, 0.08)); break;
      case 'chop': noiseHit(2400, 0.07, 0.14, 'bandpass', 0, 1.5); tone(240, 0, 0.06, 0.06, 'triangle', 140); break;
      case 'plop': tone(520 + Math.random() * 120, 0, 0.09, 0.07, 'sine', 300); break;
    }
  }
}

export const audio = new AudioEngine();
