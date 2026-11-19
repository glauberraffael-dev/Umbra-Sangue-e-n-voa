export class GothicAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private whisperGain: GainNode | null = null;
  private whisperFormantA: BiquadFilterNode | null = null;
  private whisperFormantB: BiquadFilterNode | null = null;
  private ambientStarted = false;
  private muted = false;
  private lastStepTime = 0;
  private lastHeartbeatTime = 0;
  private lastWhisperBurstTime = 0;
  private lastSuspicionCueTime = 0;
  private lastSiphonTickTime = 0;

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
    this.ambientGain.gain.value = 0.105;
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
      filter.frequency.value = idx === 2 ? 220 : 140;
      g.gain.value = idx === 0 ? 0.45 : 0.18;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.ambientGain!);
      osc.start();
    });

    // Filtered wind noise
    const bufSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 3.2;

    const windLfo = ctx.createOscillator();
    const windLfoGain = ctx.createGain();
    windLfo.frequency.value = 0.08;
    windLfoGain.gain.value = 130;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windGain = ctx.createGain();
    windGain.gain.value = 0.12;
    this.windFilter = windFilter;
    this.windGain = windGain;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientGain);
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

  public updateWindAmbience(strength: number): void {
    if (!this.ctx || !this.windGain || !this.windFilter || this.muted) return;
    const clamped = Math.max(0.2, Math.min(1.3, strength));
    this.windGain.gain.setTargetAtTime(0.07 + clamped * 0.11, this.ctx.currentTime, 0.25);
    this.windFilter.frequency.setTargetAtTime(240 + clamped * 230, this.ctx.currentTime, 0.25);
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

    const bufSize = Math.floor(ctx.sampleRate * 0.32);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.35);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, t);
    filter.frequency.exponentialRampToValueAtTime(280, t + 0.28);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);

    // Subtle shadow implosion sub-pulse
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.22);
    oGain.gain.setValueAtTime(0.11, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
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

    // Urgent double bronze toll
    [0, 0.34].forEach((offset) => {
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

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.18);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  public playPropBreak(kind: 'barrel' | 'urn'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const t = ctx.currentTime;

    // Noise burst for splintering wood / shattering ceramic
    const dur = kind === 'urn' ? 0.26 : 0.34;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(kind === 'urn' ? 2400 : 720, t);
    filter.Q.value = kind === 'urn' ? 2.2 : 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);

    // Secondary clatter shard pings
    const shardFreqs = kind === 'urn' ? [1650, 2240, 2900] : [210, 145];
    shardFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = kind === 'urn' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, t + idx * 0.035);
      osc.frequency.exponentialRampToValueAtTime(f * 0.65, t + idx * 0.035 + 0.11);
      oGain.gain.setValueAtTime(0.14, t + idx * 0.035);
      oGain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.035 + 0.12);
      osc.connect(oGain);
      oGain.connect(this.masterGain!);
      osc.start(t + idx * 0.035);
      osc.stop(t + idx * 0.035 + 0.13);
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.35);
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
    [55, 82.41, 110].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.7);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18 / (idx + 1), t + 0.08);
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
}
