import type { Song, SongStep, StepRuntime, TrackMask } from '@shared/schema';
import { sequencerEngine } from './sequencer-engine';

export class SongPlayer {
  private song: Song | null = null;
  private rt: StepRuntime = { idx: 0, pass: 1 };
  private listeners: Array<() => void> = [];

  loadSong(song: Song) {
    this.song = song;
    this.rt = { idx: 0, pass: 1 };
    sequencerEngine.setTempo(song.tempoBpm);
    this.applyStepState(this.currentStep());
    this.notifyListeners();
  }

  currentStep(): SongStep | null {
    if (!this.song || this.rt.idx >= this.song.steps.length) return null;
    return this.song.steps[this.rt.idx];
  }

  getCurrentStepIndex(): number {
    return this.rt.idx;
  }

  getCurrentPass(): number {
    return this.rt.pass;
  }

  getSong(): Song | null {
    return this.song;
  }

  selectStep(index: number) {
    if (!this.song || index < 0 || index >= this.song.steps.length) return;
    this.rt.idx = index;
    this.rt.pass = 1;
    this.applyStepState(this.currentStep());
    this.notifyListeners();
  }

  setLoop(enabled: boolean, start: number, end: number) {
    if (!this.song) return;
    this.song.loopEnabled = enabled;
    this.song.loopStart = start;
    this.song.loopEnd = end;
    this.notifyListeners();
  }

  /**
   * Called by transport at end of Part (loop wrap boundary)
   */
  onPartBoundary() {
    if (!this.song) return;

    const s = this.currentStep();
    if (!s) return;

    const reps = s.repeats ?? 1;
    if (this.rt.pass < reps) {
      this.rt.pass++;
      this.applyStepState(s);
      this.notifyListeners();
      return;
    }

    // advance to next step or loop
    this.rt.pass = 1;
    let nextIdx = this.rt.idx + 1;

    // Check if we've reached the end
    if (!this.song.steps[nextIdx]) {
      if (this.song.loopEnabled) {
        nextIdx = this.song.loopStart;
      } else {
        // End of song - stop transport
        sequencerEngine.stop();
        return;
      }
    }

    // obey loop window
    if (this.song.loopEnabled && nextIdx > this.song.loopEnd) {
      nextIdx = this.song.loopStart;
    }

    this.rt.idx = nextIdx;
    this.applyStepState(this.currentStep());
    this.notifyListeners();
  }

  private applyStepState(step: SongStep | null) {
    if (!step) return;

    // 1) switch Part to step.partId; schedule change for the *next downbeat*
    sequencerEngine.queueNextPart(step.partId);

    // 2) apply per-step mutes (mask overrides Part mutes during this step only)
    const mask: TrackMask | undefined = step.trackMask;
    if (mask != null) {
      sequencerEngine.setStepTrackMask(mask);
    } else {
      sequencerEngine.setStepTrackMask(null);
    }

    // 3) transpose step (optional)
    if (typeof step.transpose === 'number') {
      sequencerEngine.setStepTranspose(step.transpose);
    } else {
      sequencerEngine.setStepTranspose(0);
    }
  }

  reset() {
    this.song = null;
    this.rt = { idx: 0, pass: 1 };
    sequencerEngine.queueNextPart(null);
    sequencerEngine.setStepTrackMask(null);
    sequencerEngine.setStepTranspose(0);
    this.notifyListeners();
  }

  /**
   * Add a listener that will be called when song state changes
   */
  addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: () => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }
}

export const songPlayer = new SongPlayer();
