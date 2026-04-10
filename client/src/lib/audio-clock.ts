export class AudioClock {
  private audioContext: AudioContext | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private onTick: ((tick: number, timestamp: number) => void) | null = null;
  private onBeat: ((beat: number, bar: number, timestamp: number) => void) | null = null;
  private onBar: ((bar: number, timestamp: number) => void) | null = null;
  private onMetronome: ((accent: boolean) => void) | null = null;
  private fallbackInterval: number | null = null;
  private fallbackStartTime = 0;
  private fallbackTempo = 120;
  private fallbackTickCounter = 0;
  private useFallback = false;

  async initialize() {
    try {
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      
      await this.audioContext.audioWorklet.addModule('/audio-clock-processor.js');
      
      this.audioWorklet = new AudioWorkletNode(
        this.audioContext,
        'audio-clock-processor'
      );

      this.audioWorklet.port.onmessage = (e) => {
        const { type, ...data } = e.data;
        
        switch (type) {
          case 'tick':
            this.onTick?.(data.tick, data.timestamp);
            break;
          case 'beat':
            this.onBeat?.(data.beat, data.bar, data.timestamp);
            break;
          case 'bar':
            this.onBar?.(data.bar, data.timestamp);
            break;
          case 'metronome':
            this.onMetronome?.(data.accent);
            break;
        }
      };

      this.audioWorklet.connect(this.audioContext.destination);
      this.useFallback = false;
      
      return true;
    } catch (error) {
      console.warn('AudioClock initialization failed - using fallback timing');
      this.useFallback = true;
      return true; // Return true to allow operation with fallback
    }
  }

  setTempo(tempo: number) {
    this.fallbackTempo = tempo;
    this.audioWorklet?.port.postMessage({
      type: 'setTempo',
      data: tempo
    });
  }

  start() {
    if (this.useFallback) {
      this.startFallbackTimer();
    } else {
      this.audioContext?.resume();
      this.audioWorklet?.port.postMessage({ type: 'start' });
    }
  }

  stop() {
    if (this.useFallback) {
      this.stopFallbackTimer();
    } else {
      this.audioWorklet?.port.postMessage({ type: 'stop' });
    }
  }

  private startFallbackTimer() {
    this.fallbackStartTime = performance.now();
    this.fallbackTickCounter = 0;
    
    // 24 ticks per beat, so tick interval = (60000ms / tempo) / 24
    const tickInterval = (60000 / this.fallbackTempo) / 24;
    
    this.fallbackInterval = window.setInterval(() => {
      const timestamp = (performance.now() - this.fallbackStartTime) / 1000;
      this.fallbackTickCounter++;
      
      this.onTick?.(this.fallbackTickCounter, timestamp);
      
      // Every 24 ticks = 1 beat
      if (this.fallbackTickCounter % 24 === 0) {
        const beat = Math.floor(this.fallbackTickCounter / 24);
        const bar = Math.floor(beat / 4);
        this.onBeat?.(beat, bar, timestamp);
        
        // Every 4 beats = 1 bar
        if (beat % 4 === 0) {
          this.onBar?.(bar, timestamp);
        }
      }
    }, tickInterval);
  }

  private stopFallbackTimer() {
    if (this.fallbackInterval !== null) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  setMetronome(enabled: boolean) {
    this.audioWorklet?.port.postMessage({
      type: 'setMetronome',
      data: enabled
    });
  }

  setCountIn(beats: number) {
    this.audioWorklet?.port.postMessage({
      type: 'setCountIn',
      data: beats
    });
  }

  setTickListener(callback: (tick: number, timestamp: number) => void) {
    this.onTick = callback;
  }

  setBeatListener(callback: (beat: number, bar: number, timestamp: number) => void) {
    this.onBeat = callback;
  }

  setBarListener(callback: (bar: number, timestamp: number) => void) {
    this.onBar = callback;
  }

  setMetronomeListener(callback: (accent: boolean) => void) {
    this.onMetronome = callback;
  }

  resetTick(tick: number = 0) {
    this.fallbackTickCounter = tick;
    this.fallbackStartTime = performance.now();
    this.audioWorklet?.port.postMessage({ type: 'resetTick', data: tick });
  }

  getCurrentTime(): number {
    if (this.useFallback && this.fallbackInterval !== null) {
      return (performance.now() - this.fallbackStartTime) / 1000;
    }
    return this.audioContext?.currentTime || 0;
  }

  destroy() {
    this.stopFallbackTimer();
    this.audioWorklet?.disconnect();
    this.audioContext?.close();
  }
}

export const audioClock = new AudioClock();
