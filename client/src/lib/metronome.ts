export class Metronome {
  private audioContext: AudioContext | null = null;
  private enabled = true;

  async initialize() {
    try {
      this.audioContext = new AudioContext();
      return true;
    } catch (error) {
      console.warn('Metronome audio initialization failed');
      return false;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  playClick(accent: boolean = false) {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Accent (beat 1) is higher pitched and louder
    if (accent) {
      oscillator.frequency.value = 1200; // High pitch for beat 1
      gainNode.gain.setValueAtTime(0.3, now);
    } else {
      oscillator.frequency.value = 800; // Lower pitch for other beats
      gainNode.gain.setValueAtTime(0.15, now);
    }

    // Short click envelope
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }

  destroy() {
    this.audioContext?.close();
  }
}

export const metronome = new Metronome();
