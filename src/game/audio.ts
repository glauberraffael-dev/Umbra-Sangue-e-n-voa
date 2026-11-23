export class GothicAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windHighFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private whisperGain: GainNode | null = null;
  private whisperFormantA: BiquadFilterNode | null = null;
  private whisperFormantB: BiquadFilterNode | null = null;
  private ambientStarted = false;
  private ambientDetailTimer = 7.5;
  private muted = false;
  private lastStepTime = 0;
  private lastHeartbeatTime = 0;
  private lastWhisperBurstTime = 0;
  private lastSuspicionCueTime = 0;
  private lastSiphonTickTime = 0;

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.ambientStarted = false;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.65;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.ambientStarted) return;
    this.ambientStarted = true;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.165;
    this.ambientGain.connect(this.masterGain);

    // Deep cathedral sub-drone (D1 + A1 + minor third shimmer)
    const freqs = [36.71, 55.0, 110.0];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      filter.type = 'lowpass';
      filter.frequency.value = idx === 2 ? 210 : 135;
      g.gain.value = idx === 0 ? 0.34 : idx === 1 ? 0.14 : 0.08;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.ambientGain!);
      osc.start();
    });

    // Dual-band Victorian nocturnal wind noise (alley draft + rooftop eaves whistle)
    const bufSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let pink = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      pink = 0.96 * pink + white * 0.22;
      data[i] = white * 0.42 + pink * 0.58;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 310;
    windFilter.Q.value = 2.6;

    const windHighFilter = ctx.createBiquadFilter();
    windHighFilter.type = 'bandpass';
    windHighFilter.frequency.value = 980;
    windHighFilter.Q.value = 4.2;

    const windLfo = ctx.createOscillator();
    const windLfoGain = ctx.createGain();
    windLfo.frequency.value = 0.09;
    windLfoGain.gain.value = 125;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windGain = ctx.createGain();
    windGain.gain.value = 0.18;
    const windHighGain = ctx.createGain();
    windHighGain.gain.value = 0.055;

    this.windFilter = windFilter;
    this.windHighFilter = windHighFilter;
    this.windGain = windGain;
    noise.connect(windFilter);
    noise.connect(windHighFilter);
    windFilter.connect(windGain);
    windHighFilter.connect(windHighGain);
    windGain.connect(this.ambientGain);
    windHighGain.connect(windGain);
    noise.start();

    // Soft nocturnal rain patter noise layer (modulated by dynamic weather)
    const rainBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const rainData = rainBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < rainData.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.03;
      b1 = 0.98 * b1 + white * 0.12;
      rainData[i] = (white * 0.35 + b0 + b1) * 0.45;
    }
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1450;
    rainFilter.Q.value = 0.7;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0001;
    this.rainFilter = rainFilter;
    this.rainGain = rainGain;
    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.ambientGain);
    rainSrc.start();

    // Spectral Nocturnal Whispers Bed (dual vocal-formant filtered breath noise + irregular LFO cadence)
    const wBufSize = ctx.sampleRate * 3;
    const wBuf = ctx.createBuffer(1, wBufSize, ctx.sampleRate);
    const wData = wBuf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < wBufSize; i++) {
      const white = Math.random() * 2 - 1;
      // Emphasize airy sibilance & breathy consonant texture
      const hp = white - prev * 0.62;
      prev = white;
      const cadence = 0.5 + 0.5 * Math.sin((i / ctx.sampleRate) * 2.1) * Math.cos((i / ctx.sampleRate) * 0.85);
      wData[i] = hp * (0.28 + cadence * 0.72);
    }
    const whisperSrc = ctx.createBufferSource();
    whisperSrc.buffer = wBuf;
    whisperSrc.loop = true;

    const whisperFormantA = ctx.createBiquadFilter();
    whisperFormantA.type = 'bandpass';
    whisperFormantA.frequency.value = 920;
    whisperFormantA.Q.value = 5.2;

    const whisperFormantB = ctx.createBiquadFilter();
    whisperFormantB.type = 'bandpass';
    whisperFormantB.frequency.value = 2150;
    whisperFormantB.Q.value = 6.0;

    const whisperLfoA = ctx.createOscillator();
    const whisperLfoGainA = ctx.createGain();
    whisperLfoA.frequency.value = 0.23;
    whisperLfoGainA.gain.value = 260;
    whisperLfoA.connect(whisperLfoGainA);
    whisperLfoGainA.connect(whisperFormantA.frequency);
    whisperLfoA.start();

    const whisperLfoB = ctx.createOscillator();
    const whisperLfoGainB = ctx.createGain();
    whisperLfoB.frequency.value = 0.37;
    whisperLfoGainB.gain.value = 480;
    whisperLfoB.connect(whisperLfoGainB);
    whisperLfoGainB.connect(whisperFormantB.frequency);
    whisperLfoB.start();

    const whisperGain = ctx.createGain();
    whisperGain.gain.value = 0.0001;
    this.whisperFormantA = whisperFormantA;
    this.whisperFormantB = whisperFormantB;
    this.whisperGain = whisperGain;

    whisperSrc.connect(whisperFormantA);
    whisperSrc.connect(whisperFormantB);
    whisperFormantA.connect(whisperGain);
    whisperFormantB.connect(whisperGain);
    whisperGain.connect(this.masterGain);
    whisperSrc.start();
  }

  public setAmbientFocus(active: boolean): void {
    if (!this.ctx || !this.ambientGain || this.muted) return;
    this.ambientGain.gain.setTargetAtTime(active ? 0.165 : 0.085, this.ctx.currentTime, 0.35);
  }

  public updateWindAmbience(strength: number): void {
    if (!this.ctx || !this.windGain || !this.windFilter || this.muted) return;
    const clamped = Math.max(0.2, Math.min(1.3, strength));
    this.windGain.gain.setTargetAtTime(0.11 + clamped * 0.14, this.ctx.currentTime, 0.25);
    this.windFilter.frequency.setTargetAtTime(220 + clamped * 240, this.ctx.currentTime, 0.25);
    if (this.windHighFilter) {
      this.windHighFilter.frequency.setTargetAtTime(820 + clamped * 440, this.ctx.currentTime, 0.25);
    }
  }

  public tickAmbientAtmosphere(dt: number, inCrypt: boolean, windStrength: number): void {
    if (!this.ctx || !this.masterGain || !this.ambientStarted || this.muted) return;
    this.ambientDetailTimer -= dt;
    if (this.ambientDetailTimer > 0) return;
    this.ambientDetailTimer = 10.5 + Math.random() * 8.5;

    const t = this.ctx.currentTime;
    const roll = Math.random();
    if (!inCrypt && roll < 0.45) {
      // Soft nocturnal wind gust sweeping between Victorian eaves
      const dur = 1.6;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        const env = Math.sin((i / bufSize) * Math.PI);
        d[i] = (Math.random() * 2 - 1) * env;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(340 + windStrength * 160, t);
      f.frequency.exponentialRampToValueAtTime(640 + windStrength * 220, t + dur * 0.55);
      f.frequency.exponentialRampToValueAtTime(260, t + dur);
      f.Q.value = 3.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0005, t);
      g.gain.linearRampToValueAtTime(0.032 * Math.min(1.25, windStrength), t + dur * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      src.start(t);
    } else if (roll < 0.78) {
      // Very distant muted clock-tower / iron-gate metallic resonance
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(inCrypt ? 146.83 : 196.0, t);
      filter.type = 'lowpass';
      filter.frequency.value = 360;
      g.gain.setValueAtTime(0.0005, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 2.4);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 2.5);
    } else {
      // Subtle timber/iron shutter creak in the night breeze
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(295, t + 0.42);
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 5.5;
      g.gain.setValueAtTime(0.0005, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 0.48);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.5);
    }
  }

  public updateWeatherAmbience(rainIntensity: number, fogIntensity: number): void {
    if (!this.ctx || this.muted) return;
    if (this.rainGain && this.rainFilter) {
      const clampedRain = Math.max(0, Math.min(1, rainIntensity));
      this.rainGain.gain.setTargetAtTime(0.0001 + clampedRain * 0.34, this.ctx.currentTime, 0.4);
      this.rainFilter.frequency.setTargetAtTime(1150 + clampedRain * 550, this.ctx.currentTime, 0.4);
    }
    if (this.windFilter && fogIntensity > 0.1) {
      this.windFilter.Q.setTargetAtTime(3.2 + fogIntensity * 1.4, this.ctx.currentTime, 0.4);
    }
  }

  public updateWhisperAmbience(suspicionTension: number, npcProximityTension: number): void {
    if (!this.ctx || !this.whisperGain || this.muted) return;
    const combined = Math.max(0, Math.min(1, suspicionTension * 0.72 + npcProximityTension * 0.85));
    const targetGain = combined > 0.06 ? 0.015 + Math.pow(combined, 1.35) * 0.15 : 0.0001;
    this.whisperGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.28);

    if (this.whisperFormantA && this.whisperFormantB) {
      this.whisperFormantA.frequency.setTargetAtTime(840 + combined * 280, this.ctx.currentTime, 0.3);
      this.whisperFormantB.frequency.setTargetAtTime(1950 + npcProximityTension * 650, this.ctx.currentTime, 0.3);
    }

    if (combined >= 0.28) {
      const now = performance.now();
      const cooldownMs = Math.max(1550, 4200 - combined * 2400);
      if (now - this.lastWhisperBurstTime >= cooldownMs) {
        this.lastWhisperBurstTime = now;
        this.playWhisperBurst(combined, npcProximityTension > suspicionTension ? 1 : 0);
      }
    }
  }

  public playWhisperBurst(intensity: number, kind: 0 | 1 = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const syllables = kind === 1 ? 3 : 2;
    const panVal = (Math.random() - 0.5) * 1.3;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(panVal, t);
      panner.connect(this.masterGain);
    }
    const dest: AudioNode = panner ?? this.masterGain;

    for (let s = 0; s < syllables; s++) {
      const start = t + s * (0.24 + Math.random() * 0.12);
      const dur = 0.22 + Math.random() * 0.16;
      const bufLen = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < bufLen; i++) {
        const w = Math.random() * 2 - 1;
        const env = Math.sin((i / bufLen) * Math.PI);
        ch[i] = (w - prev * 0.55) * env;
        prev = w;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      const baseFreq = kind === 1 ? 1350 + s * 220 : 980 + s * 180;
      f1.frequency.setValueAtTime(baseFreq, start);
      f1.frequency.exponentialRampToValueAtTime(baseFreq * 1.32, start + dur);
      f1.Q.value = 6.8;

      const gain = ctx.createGain();
      const peak = (0.045 + intensity * 0.08) * (s === 0 ? 1 : 0.78);
      gain.gain.setValueAtTime(0.0005, start);
      gain.gain.linearRampToValueAtTime(peak, start + dur * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + dur);

      src.connect(f1);
      f1.connect(gain);
      gain.connect(dest);
      src.start(start);
    }
  }

  public playFootstep(stealth: boolean): void {
    const now = performance.now();
    const minGap = stealth ? 430 : 280;
    if (now - this.lastStepTime < minGap) return;
    this.lastStepTime = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(stealth ? 95 : 135 + Math.random() * 25, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.07);

    filter.type = 'lowpass';
    filter.frequency.value = stealth ? 260 : 520;

    gain.gain.setValueAtTime(stealth ? 0.04 : 0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playHeartbeat(intensity = 0.6): void {
    const now = performance.now();
    if (now - this.lastHeartbeatTime < 680) return;
    this.lastHeartbeatTime = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const pulse = (offset: number, amp: number) => {
      const t = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(64, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.16);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.28 * intensity * amp, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.2);
    };
    pulse(0, 1.0);
    pulse(0.18, 0.65);
  }

  public playShadowDash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + 0.32);
    filter.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);

    // Sub whoosh
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    oGain.gain.setValueAtTime(0.2, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playFeedDrain(isStealth: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Bite snap + visceral crimson resonance
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isStealth ? 210 : 280, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.38);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  public playFeedComplete(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const notes = [146.83, 220.0, 293.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.05);
      gain.gain.setValueAtTime(0.001, t + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.14, t + i * 0.05 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.48);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.5);
    });
  }

  public playFeedSiphonTick(progress: number): void {
    const now = performance.now();
    if (now - this.lastSiphonTickTime < 210) return;
    this.lastSiphonTickTime = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const clampedProg = Math.max(0, Math.min(1, progress));

    // Soft rhythmic crimson siphon pulse + warm low draw
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'triangle';
    const baseFreq = 68 + clampedProg * 42;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, t + 0.14);

    filter.type = 'lowpass';
    filter.frequency.value = 260 + clampedProg * 220;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.09 + clampedProg * 0.05, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playSuspicionCue(stage: 'curious' | 'suspicious' | 'alert'): void {
    const now = performance.now();
    const minGap = stage === 'alert' ? 450 : 1200;
    if (now - this.lastSuspicionCueTime < minGap) return;
    this.lastSuspicionCueTime = now;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    if (stage === 'curious') {
      // Subtle low-mid woodwind/breath curiosity interval
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(293.66, t);
      osc.frequency.exponentialRampToValueAtTime(329.63, t + 0.18);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.065, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.26);
      return;
    }

    if (stage === 'suspicious') {
      // Tense minor-second bowed shimmer
      [349.23, 369.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.05);
        gain.gain.setValueAtTime(0.001, t + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.08, t + idx * 0.05 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + idx * 0.05 + 0.34);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t + idx * 0.05);
        osc.stop(t + idx * 0.05 + 0.36);
      });
      return;
    }

    // Crisp alert stinger
    this.playGuardAlert();
  }

  public playSnuffLamp(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // 1. Crisp brass gas-valve snap
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1950, t);
    click.frequency.exponentialRampToValueAtTime(680, t + 0.045);
    clickGain.gain.setValueAtTime(0.12, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    click.connect(clickGain);
    clickGain.connect(this.masterGain);
    click.start(t);
    click.stop(t + 0.06);

    // 2. Pressurized gas-flame hiss extinguished
    const bufSize = Math.floor(ctx.sampleRate * 0.34);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.3);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650, t + 0.02);
    filter.frequency.exponentialRampToValueAtTime(260, t + 0.32);
    filter.Q.value = 1.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.33);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t + 0.02);

    // 3. Subtle shadow vacuum sub-pulse
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(128, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.24);
    oGain.gain.setValueAtTime(0.14, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.27);
  }

  public playBatSwarm(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    for (let i = 0; i < 6; i++) {
      const start = t + i * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800 + Math.random() * 900, start);
      osc.frequency.exponentialRampToValueAtTime(950 + Math.random() * 400, start + 0.14);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 2.5;

      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.16);
    }
  }

  public playCrimsonSense(active: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(active ? 110 : 220, t);
    osc.frequency.exponentialRampToValueAtTime(active ? 260 : 90, t + 0.24);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playGuardAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.setValueAtTime(740, t + 0.09);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playPlayerHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  public playEvolutionUnlock(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Gothic minor chord chime (D3, F3, A3, D4)
    const freqs = [146.83, 174.61, 220.0, 293.66];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + idx * 0.06);
      gain.gain.setValueAtTime(0.001, t + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.16, t + idx * 0.06 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.85);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.9);
    });
  }

  public playCathedralBell(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const partials = [110, 220, 261.63, 330, 440];
    partials.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.14 / (i + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 2.2 - i * 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 2.3);
    });
  }

  public playClawSlash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + 0.13);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playClawHit(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(68, t + 0.15);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);

    // Metallic armor ring
    const ring = ctx.createOscillator();
    const rGain = ctx.createGain();
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(980, t);
    ring.frequency.exponentialRampToValueAtTime(620, t + 0.14);
    rGain.gain.setValueAtTime(0.11, t);
    rGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    ring.connect(rGain);
    rGain.connect(this.masterGain);
    ring.start(t);
    ring.stop(t + 0.16);
  }

  public playAlarmBell(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Urgent double bronze toll with crisp metallic clapper strike
    [0, 0.34].forEach((offset) => {
      const strike = ctx.createOscillator();
      const sGain = ctx.createGain();
      strike.type = 'triangle';
      strike.frequency.setValueAtTime(1650, t + offset);
      strike.frequency.exponentialRampToValueAtTime(780, t + offset + 0.08);
      sGain.gain.setValueAtTime(0.16, t + offset);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.09);
      strike.connect(sGain);
      sGain.connect(this.masterGain!);
      strike.start(t + offset);
      strike.stop(t + offset + 0.1);

      const partials = [392.0, 587.33, 783.99, 1174.66];
      partials.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, t + offset);
        gain.gain.setValueAtTime(0.18 / (i + 1), t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 1.15);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t + offset);
        osc.stop(t + offset + 1.2);
      });
    });
  }

  public playBellSabotage(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Rope/iron latch snap + muffled damped bronze thump
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'sawtooth';
    snap.frequency.setValueAtTime(1250, t);
    snap.frequency.exponentialRampToValueAtTime(340, t + 0.07);
    snapGain.gain.setValueAtTime(0.13, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    snap.connect(snapGain);
    snapGain.connect(this.masterGain);
    snap.start(t);
    snap.stop(t + 0.09);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, t + 0.03);
    osc.frequency.exponentialRampToValueAtTime(86, t + 0.24);
    gain.gain.setValueAtTime(0.2, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t + 0.03);
    osc.stop(t + 0.28);
  }

  public playPropBreak(kind: 'barrel' | 'urn'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Noise burst for splintering wood / shattering ceramic
    const dur = kind === 'urn' ? 0.26 : 0.36;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.45);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(kind === 'urn' ? 2550 : 680, t);
    filter.Q.value = kind === 'urn' ? 2.4 : 1.05;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.34, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);

    // Secondary clatter shard pings / iron barrel hoop clatter
    const shardFreqs = kind === 'urn' ? [1680, 2320, 3050] : [220, 142, 640];
    shardFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = kind === 'urn' || idx === 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, t + idx * 0.038);
      osc.frequency.exponentialRampToValueAtTime(f * 0.62, t + idx * 0.038 + 0.12);
      oGain.gain.setValueAtTime(idx === 2 ? 0.09 : 0.15, t + idx * 0.038);
      oGain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.038 + 0.13);
      osc.connect(oGain);
      oGain.connect(this.masterGain!);
      osc.start(t + idx * 0.038);
      osc.stop(t + idx * 0.038 + 0.14);
    });
  }

  public playHeavyLanding(intensity: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    gain.gain.setValueAtTime(0.24 * Math.min(1, intensity), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playMemoryCollect(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Spectral gothic harp arpeggio (D4 -> F4 -> A4 -> E5)
    const freqs = [293.66, 349.23, 440.0, 659.25];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.065);
      gain.gain.setValueAtTime(0.001, t + idx * 0.065);
      gain.gain.linearRampToValueAtTime(0.14, t + idx * 0.065 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + idx * 0.065 + 0.72);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.065);
      osc.stop(t + idx * 0.065 + 0.76);
    });
  }

  public playObfuscate(active: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.42);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(active ? 1600 : 620, t);
    filter.frequency.exponentialRampToValueAtTime(active ? 420 : 1200, t + 0.38);
    filter.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.41);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playDominate(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Resonant hypnotic command chord + deep mind-snap
    [130.81, 196.0, 246.94].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, t + 0.55);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.24 : 0.11, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.58);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.62);
    });
  }

  public playCelerity(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.26);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + 0.26);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  public playShadowSnare(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    // Shadowy tendril lash + low abyssal lock
    const bufSize = Math.floor(ctx.sampleRate * 0.28);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.setValueAtTime(1100, t);
    bf.frequency.exponentialRampToValueAtTime(210, t + 0.26);
    bf.Q.value = 2.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.2, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
    src.connect(bf);
    bf.connect(ng);
    ng.connect(this.masterGain);
    src.start(t);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.35);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  public playAbyssalShroud(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    // Hollow darkness wave + low abyssal triad
    const bufSize = Math.floor(ctx.sampleRate * 0.65);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.setValueAtTime(780, t);
    bf.frequency.exponentialRampToValueAtTime(180, t + 0.62);
    bf.Q.value = 2.0;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.64);
    src.connect(bf);
    bf.connect(ng);
    ng.connect(this.masterGain);
    src.start(t);

    [55, 82.41, 110].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.7);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.19 / (idx + 1), t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.78);
    });
  }

  public playFalseVisage(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    [293.66, 369.99, 440].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.05);
      gain.gain.setValueAtTime(0.001, t + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.11, t + i * 0.05 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.45);
    });
  }

  public playAstralScout(active: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(active ? 220 : 520, t);
    osc.frequency.exponentialRampToValueAtTime(active ? 540 : 190, t + 0.36);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  public playMemoryWipe(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    [440, 392, 261.63].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.07);
      gain.gain.setValueAtTime(0.14, t + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.48);
    });
  }

  public playPossess(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    [98, 146.83, 233.08].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.12, t + 0.5);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 680;
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  public playMistForm(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * 0.55);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(480, t);
    filter.frequency.exponentialRampToValueAtTime(1450, t + 0.5);
    filter.Q.value = 2.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.54);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playShadowLeap(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.24);
    gain.gain.setValueAtTime(0.26, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playShadowThrow(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(780, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 1.6;
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playDawnWarning(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Deep ominous cathedral warning partials (D2, F2, G#2 tritone + shimmering high chime)
    [73.42, 87.31, 103.83, 440.0].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(idx === 3 ? 0.08 : 0.14, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 1.45);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  }

  public playCoffinRest(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Heavy stone coffin lid thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(98, t);
    thud.frequency.exponentialRampToValueAtTime(32, t + 0.34);
    thudGain.gain.setValueAtTime(0.32, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.4);

    // Restorative nocturnal minor chord
    [146.83, 174.61, 220.0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + 0.14 + i * 0.06);
      gain.gain.setValueAtTime(0.001, t + 0.14 + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.2 + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 1.25);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + 0.14 + i * 0.06);
      osc.stop(t + 1.3);
    });
  }

  public playShadowDecoy(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Spectral double shimmer (hollow D3 -> A3 whisper chime)
    [146.83, 220.0, 277.18].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.045);
      osc.frequency.exponentialRampToValueAtTime(f * 0.94, t + 0.55);
      gain.gain.setValueAtTime(0.001, t + idx * 0.045);
      gain.gain.linearRampToValueAtTime(0.11 / (idx + 1), t + idx * 0.045 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.62);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.045);
      osc.stop(t + 0.65);
    });
  }

  public playDarknessPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Deep abyssal shockwave drop + dark wind sweep
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(34, t + 0.48);
    subGain.gain.setValueAtTime(0.32, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.54);

    const bufSize = Math.floor(ctx.sampleRate * 0.55);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.35);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.setValueAtTime(1150, t);
    bf.frequency.exponentialRampToValueAtTime(160, t + 0.52);
    bf.Q.value = 1.6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.28, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.54);
    src.connect(bf);
    bf.connect(ng);
    ng.connect(this.masterGain);
    src.start(t);
  }

  public playDawnBurnTick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    const dur = 0.22;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(950, t + dur);
    f.Q.value = 2.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(t);
  }
}
