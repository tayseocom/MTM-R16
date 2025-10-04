import type { MIDIEvent, Track, Part, Project, TrackMask } from '@shared/schema';
import { audioClock } from './audio-clock';
import { midiManager } from './midi';
import { metronome } from './metronome';

type RecordBufferUpdateListener = (trackId: number, data: { added: MIDIEvent[], changedRange: { t0: number, t1: number } }) => void;
type TakeCommittedListener = (trackId: number, data: { ranges: Array<{ t0: number, t1: number }> }) => void;
type PartBoundaryListener = () => void;

export class SequencerEngine {
  private project: Project;
  private isRecording = false;
  private isPlaying = false;
  private recordingEvents: Map<number, MIDIEvent[]> = new Map();
  private recordStartTime = 0;
  private currentTick = 0;
  private playbackEvents: Map<number, MIDIEvent[]> = new Map();
  private selectedOutput: MIDIOutput | null = null;
  private quantizeValue = 0; // 0 = off, 1/4, 1/8, 1/16, etc.
  private midiThruEnabled = false;
  private clockMode: 'off' | 'send' | 'receive' = 'off';
  
  private recordBufferUpdateListeners: RecordBufferUpdateListener[] = [];
  private takeCommittedListeners: TakeCommittedListener[] = [];
  private partBoundaryListeners: PartBoundaryListener[] = [];
  private lastEmitTime = 0;
  private emitThrottleMs = 50; // 50ms = ~20 updates per second
  private pendingEventsByTrack: Map<number, MIDIEvent[]> = new Map();
  private activeNotesByTrack: Map<number, Map<number, MIDIEvent[]>> = new Map(); // trackId -> (noteNumber -> FIFO queue of noteOnEvents)

  // Song mode step-scoped overrides
  private queuedPartId: number | null = null;
  private stepTrackMask: TrackMask | null = null;
  private stepTranspose: number = 0;

  constructor() {
    this.project = this.createEmptyProject();
    this.setupAudioClock();
  }

  private createEmptyProject(): Project {
    const tracks: Track[] = Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      name: `Track ${i + 1}`,
      channel: i,
      muted: false,
      events: []
    }));

    return {
      name: 'Untitled',
      tempo: 120,
      parts: [{
        id: 1,
        name: 'Part 1',
        length: 4, // bars
        tracks
      }],
      songs: [],
      currentPart: 0,
      currentSong: null
    };
  }

  private setupAudioClock() {
    audioClock.setTickListener((tick, timestamp) => {
      this.currentTick = tick;
      if (this.isPlaying) {
        this.playScheduledEvents(tick, timestamp);
      }
    });

    audioClock.setBeatListener((beat, bar, timestamp) => {
      // Beat callback for UI updates
    });

    audioClock.setMetronomeListener((accent) => {
      metronome.playClick(accent);
    });
  }

  async initialize() {
    const clockReady = await audioClock.initialize();
    const midiReady = await midiManager.initialize();
    await metronome.initialize();
    return clockReady && midiReady;
  }

  onRecordBufferUpdate(listener: RecordBufferUpdateListener) {
    this.recordBufferUpdateListeners.push(listener);
    return () => {
      this.recordBufferUpdateListeners = this.recordBufferUpdateListeners.filter(l => l !== listener);
    };
  }

  onTakeCommitted(listener: TakeCommittedListener) {
    this.takeCommittedListeners.push(listener);
    return () => {
      this.takeCommittedListeners = this.takeCommittedListeners.filter(l => l !== listener);
    };
  }

  getRecordingBuffer(trackId: number): MIDIEvent[] {
    return this.recordingEvents.get(trackId) || [];
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  setMetronome(enabled: boolean) {
    metronome.setEnabled(enabled);
    audioClock.setMetronome(enabled);
  }

  setMidiThru(enabled: boolean) {
    this.midiThruEnabled = enabled;
  }

  setClockMode(mode: 'off' | 'send' | 'receive') {
    this.clockMode = mode;
    
    if (mode === 'send' && this.isPlaying) {
      midiManager.startClockSend(this.project.tempo, midiManager.getOutputs());
    } else if (mode === 'receive') {
      midiManager.setClockListener((tempo) => {
        this.setTempo(tempo);
      });
    } else {
      midiManager.stopClockSend();
    }
  }

  getClockMode() {
    return this.clockMode;
  }

  setTempo(tempo: number) {
    this.project.tempo = tempo;
    audioClock.setTempo(tempo);
    
    // Update MIDI clock tempo if sending
    if (this.clockMode === 'send') {
      midiManager.updateClockTempo(tempo);
    }
  }

  startRecording(trackIds: number[]) {
    this.isRecording = true;
    this.isPlaying = true;
    this.recordStartTime = audioClock.getCurrentTime();
    this.currentTick = 0;
    
    trackIds.forEach(id => {
      this.recordingEvents.set(id, []);
      this.activeNotesByTrack.set(id, new Map());
    });
    
    // Clear pending events from previous recording session
    this.pendingEventsByTrack.clear();
    this.lastEmitTime = 0;

    midiManager.setInputListener((event) => {
      this.handleMIDIInput(event);
    });

    audioClock.setMetronome(true);
    audioClock.start();
  }

  private handleMIDIInput(event: MIDIMessageEvent) {
    const data = Array.from(event.data || []);
    const [status, data1, data2] = data;
    const command = status & 0xF0;
    const channel = status & 0x0F;
    
    // MIDI Thru: Forward incoming MIDI directly to output
    if (this.midiThruEnabled && this.selectedOutput && data.length > 0) {
      this.selectedOutput.send(new Uint8Array(data));
    }
    
    const timestamp = audioClock.getCurrentTime() - this.recordStartTime;
    let midiEvent: MIDIEvent | null = null;

    switch (command) {
      case 0x90: // Note On
        if (data2 > 0) {
          midiEvent = {
            timestamp,
            type: 'noteOn',
            channel,
            note: data1,
            velocity: data2
          };
        } else {
          midiEvent = {
            timestamp,
            type: 'noteOff',
            channel,
            note: data1,
            velocity: 0
          };
        }
        break;
      case 0x80: // Note Off
        midiEvent = {
          timestamp,
          type: 'noteOff',
          channel,
          note: data1,
          velocity: data2
        };
        break;
      case 0xB0: // CC
        midiEvent = {
          timestamp,
          type: 'cc',
          channel,
          controller: data1,
          value: data2
        };
        break;
      case 0xC0: // Program Change
        midiEvent = {
          timestamp,
          type: 'programChange',
          channel,
          program: data1
        };
        break;
    }

    // Only record the event if we're actually recording
    if (this.isRecording && midiEvent) {
      const now = Date.now();
      const shouldEmit = now - this.lastEmitTime >= this.emitThrottleMs;
      
      this.recordingEvents.forEach((events, trackId) => {
        const track = this.getCurrentPart().tracks.find(t => t.id === trackId);
        if (track && track.channel === channel) {
          events.push(midiEvent!);
          
          // Track active notes using FIFO queue for overlapping notes
          const activeNotes = this.activeNotesByTrack.get(trackId);
          if (activeNotes) {
            if (midiEvent!.type === 'noteOn' && midiEvent!.velocity && midiEvent!.velocity > 0 && midiEvent!.note !== undefined) {
              // Push note-on to FIFO queue
              if (!activeNotes.has(midiEvent!.note)) {
                activeNotes.set(midiEvent!.note, []);
              }
              activeNotes.get(midiEvent!.note)!.push(midiEvent!);
            } else if ((midiEvent!.type === 'noteOff' || (midiEvent!.type === 'noteOn' && midiEvent!.velocity === 0)) && midiEvent!.note !== undefined) {
              // Note-off: pop from FIFO queue (shift = remove first)
              const queue = activeNotes.get(midiEvent!.note);
              if (queue && queue.length > 0) {
                queue.shift();
                if (queue.length === 0) {
                  activeNotes.delete(midiEvent!.note);
                }
              }
            }
          }
          
          // Track pending events for this track
          if (!this.pendingEventsByTrack.has(trackId)) {
            this.pendingEventsByTrack.set(trackId, []);
          }
          this.pendingEventsByTrack.get(trackId)!.push(midiEvent!);
        }
      });
      
      // Emit throttled update if enough time has passed
      if (shouldEmit && this.recordBufferUpdateListeners.length > 0) {
        this.pendingEventsByTrack.forEach((pendingEvents, trackId) => {
          if (pendingEvents.length > 0) {
            // Calculate range covering ALL pending events AND their corresponding note-ons
            const timestamps: number[] = [];
            
            // Build a map of note-offs to their paired note-ons using FIFO matching
            const recordingBuffer = this.recordingEvents.get(trackId) || [];
            const noteOnStacks = new Map<number, MIDIEvent[]>();
            const noteOffToPairedNoteOn = new Map<MIDIEvent, MIDIEvent>();
            
            // Scan through recording buffer to capture pairings
            recordingBuffer.forEach(e => {
              if (e.type === 'noteOn' && e.velocity && e.velocity > 0 && e.note !== undefined) {
                if (!noteOnStacks.has(e.note)) {
                  noteOnStacks.set(e.note, []);
                }
                noteOnStacks.get(e.note)!.push(e);
              } else if ((e.type === 'noteOff' || (e.type === 'noteOn' && e.velocity === 0)) && e.note !== undefined) {
                const stack = noteOnStacks.get(e.note);
                if (stack && stack.length > 0) {
                  const pairedNoteOn = stack.shift()!; // Remove and capture the paired note-on
                  noteOffToPairedNoteOn.set(e, pairedNoteOn);
                }
              }
            });
            
            pendingEvents.forEach(e => {
              timestamps.push(e.timestamp);
              
              // For note-off events, include the corresponding note-on timestamp
              if ((e.type === 'noteOff' || (e.type === 'noteOn' && e.velocity === 0)) && e.note !== undefined) {
                const pairedNoteOn = noteOffToPairedNoteOn.get(e);
                if (pairedNoteOn) {
                  timestamps.push(pairedNoteOn.timestamp);
                }
              }
            });
            
            const t0 = Math.min(...timestamps);
            const t1 = Math.max(...timestamps);
            
            this.recordBufferUpdateListeners.forEach(listener => {
              listener(trackId, {
                added: pendingEvents,
                changedRange: { t0, t1 }
              });
            });
          }
        });
        
        // Clear pending events after emit
        this.pendingEventsByTrack.clear();
        this.lastEmitTime = now;
      }
    }
  }

  stopRecording() {
    this.isRecording = false;
    
    // Commit recorded events to tracks (append, don't replace)
    this.recordingEvents.forEach((events, trackId) => {
      const track = this.getCurrentPart().tracks.find(t => t.id === trackId);
      if (track && events.length > 0) {
        const newEvents = this.quantizeValue > 0 
          ? this.quantizeEvents(events, this.quantizeValue)
          : events;
        
        // Calculate time ranges for the committed events
        const timestamps = newEvents.map(e => e.timestamp);
        const t0 = Math.min(...timestamps);
        const t1 = Math.max(...timestamps);
        
        // Append new events to existing ones and sort
        track.events = [...track.events, ...newEvents].sort((a, b) => a.timestamp - b.timestamp);
        
        // Emit takeCommitted event
        if (this.takeCommittedListeners.length > 0) {
          this.takeCommittedListeners.forEach(listener => {
            listener(trackId, { ranges: [{ t0, t1 }] });
          });
        }
      }
    });
    
    this.recordingEvents.clear();
    this.activeNotesByTrack.clear();
    this.pendingEventsByTrack.clear();
  }

  startPlayback(trackIds?: number[]) {
    this.isPlaying = true;
    this.currentTick = 0;
    this.schedulePlaybackEvents(trackIds);
    audioClock.start();
    
    // Start MIDI clock if in send mode
    if (this.clockMode === 'send') {
      midiManager.startClockSend(this.project.tempo, midiManager.getOutputs());
    }
  }

  private schedulePlaybackEvents(trackIds?: number[]) {
    const part = this.getCurrentPart();
    const ticksPerBeat = 24;
    const beatsPerBar = 4;
    const totalTicks = part.length * beatsPerBar * ticksPerBeat;

    this.playbackEvents.clear();

    let tracksToPlay = trackIds 
      ? part.tracks.filter(t => trackIds.includes(t.id) && !t.muted)
      : part.tracks.filter(t => !t.muted);

    // Apply step track mask if set (overrides Part mutes)
    if (this.stepTrackMask !== null) {
      tracksToPlay = part.tracks.filter(track => {
        const trackBit = track.id - 1; // Track 1 = bit 0, Track 2 = bit 1, etc.
        const isAudible = (this.stepTrackMask! & (1 << trackBit)) !== 0;
        return isAudible;
      });
    }

    tracksToPlay.forEach(track => {
      track.events.forEach(event => {
        const eventTick = Math.floor((event.timestamp / 60) * this.project.tempo * ticksPerBeat);
        const loopTick = eventTick % totalTicks;
        
        if (!this.playbackEvents.has(loopTick)) {
          this.playbackEvents.set(loopTick, []);
        }
        this.playbackEvents.get(loopTick)!.push(event);
      });
    });
  }

  private playScheduledEvents(tick: number, timestamp: number) {
    const part = this.getCurrentPart();
    const ticksPerBeat = 24;
    const beatsPerBar = 4;
    const totalTicks = part.length * beatsPerBar * ticksPerBeat;
    
    // Wrap tick to loop within part length
    const loopTick = tick % totalTicks;
    
    // Detect part boundary (wrap from end back to 0)
    if (loopTick === 0 && tick > 0) {
      // Notify part boundary listeners (e.g., song player)
      this.partBoundaryListeners.forEach(listener => listener());
      
      // Apply queued part switch if any
      if (this.queuedPartId !== null) {
        const partIndex = this.project.parts.findIndex(p => p.id === this.queuedPartId);
        if (partIndex !== -1) {
          this.project.currentPart = partIndex;
          this.schedulePlaybackEvents(); // Re-schedule events for new part
        }
        this.queuedPartId = null;
      }
    }
    
    const events = this.playbackEvents.get(loopTick);
    
    if (events && this.selectedOutput) {
      events.forEach(event => {
        // Apply step transpose if set
        let modifiedEvent = event;
        if (this.stepTranspose !== 0 && (event.type === 'noteOn' || event.type === 'noteOff') && event.note !== undefined) {
          const newNote = event.note + this.stepTranspose;
          if (newNote >= 0 && newNote <= 127) {
            modifiedEvent = { ...event, note: newNote };
          }
        }
        
        this.sendMIDIEvent(modifiedEvent, timestamp);
      });
    }
  }

  private sendMIDIEvent(event: MIDIEvent, timestamp: number) {
    if (!this.selectedOutput) return;

    let data: number[] = [];

    switch (event.type) {
      case 'noteOn':
        data = [0x90 + event.channel, event.note!, event.velocity!];
        break;
      case 'noteOff':
        data = [0x80 + event.channel, event.note!, event.velocity || 0];
        break;
      case 'cc':
        data = [0xB0 + event.channel, event.controller!, event.value!];
        break;
      case 'programChange':
        data = [0xC0 + event.channel, event.program!];
        break;
    }

    if (data.length > 0) {
      midiManager.sendMessage(this.selectedOutput, new Uint8Array(data), timestamp);
    }
  }

  stop() {
    this.isPlaying = false;
    this.isRecording = false;
    audioClock.stop();
    midiManager.allNotesOff();
    
    // Stop MIDI clock if sending
    if (this.clockMode === 'send') {
      midiManager.stopClockSend();
    }
  }

  setOutput(output: MIDIOutput | null) {
    this.selectedOutput = output;
  }

  setQuantize(value: number) {
    this.quantizeValue = value;
  }

  private quantizeEvents(events: MIDIEvent[], quantize: number): MIDIEvent[] {
    const ticksPerBeat = 24;
    const quantizeTicks = ticksPerBeat * quantize; // Fix: multiply instead of divide

    return events.map(event => {
      const eventTick = (event.timestamp / 60) * this.project.tempo * ticksPerBeat;
      const quantizedTick = Math.round(eventTick / quantizeTicks) * quantizeTicks;
      const quantizedTime = (quantizedTick / ticksPerBeat) * (60 / this.project.tempo);
      
      return {
        ...event,
        timestamp: quantizedTime
      };
    });
  }

  getCurrentPart(): Part {
    return this.project.parts[this.project.currentPart];
  }

  getProject(): Project {
    return this.project;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  loadProject(project: Project) {
    this.project = project;
    this.setTempo(project.tempo);
  }

  copyPart(sourceId: number, destId: number) {
    const source = this.project.parts.find(p => p.id === sourceId);
    if (source) {
      // Deep clone to avoid mutation
      const copy: Part = JSON.parse(JSON.stringify(source));
      copy.id = destId;
      copy.name = `Part ${destId}`;
      
      // Ensure we have enough parts array entries
      while (this.project.parts.length < destId) {
        this.project.parts.push(this.createEmptyPart(this.project.parts.length + 1));
      }
      this.project.parts[destId - 1] = copy;
    }
  }

  private createEmptyPart(id: number): Part {
    const tracks: Track[] = Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      name: `Track ${i + 1}`,
      channel: i,
      muted: false,
      events: []
    }));

    return {
      id,
      name: `Part ${id}`,
      length: 4,
      tracks
    };
  }

  erasePart(partId: number) {
    const part = this.project.parts.find(p => p.id === partId);
    if (part) {
      part.tracks.forEach(track => {
        track.events = [];
      });
    }
  }

  mergeTracks(sourceTrackId: number, destTrackId: number) {
    const part = this.getCurrentPart();
    const source = part.tracks.find(t => t.id === sourceTrackId);
    const dest = part.tracks.find(t => t.id === destTrackId);
    
    if (source && dest) {
      // Clone events to avoid reference issues
      const sourceEvents = JSON.parse(JSON.stringify(source.events));
      dest.events = [...dest.events, ...sourceEvents].sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  transposeTrack(trackId: number, semitones: number) {
    const part = this.getCurrentPart();
    const track = part.tracks.find(t => t.id === trackId);
    
    if (track) {
      track.events = track.events.map(event => {
        if ((event.type === 'noteOn' || event.type === 'noteOff') && event.note !== undefined) {
          const newNote = event.note + semitones;
          // Keep within MIDI range
          if (newNote >= 0 && newNote <= 127) {
            return {
              ...event,
              note: newNote
            };
          }
        }
        return event;
      });
    }
  }

  // Song mode step-scoped override methods

  /**
   * Queue a part to switch to at the next part boundary
   */
  queueNextPart(partId: number | null) {
    this.queuedPartId = partId;
  }

  /**
   * Set step-level track mask (overrides Part mutes for current step)
   */
  setStepTrackMask(mask: TrackMask | null) {
    this.stepTrackMask = mask;
  }

  /**
   * Set step-level transpose (semitone offset for current step)
   */
  setStepTranspose(semitones: number) {
    this.stepTranspose = semitones;
  }

  /**
   * Register a listener for part boundary events
   */
  onPartBoundary(listener: PartBoundaryListener) {
    this.partBoundaryListeners.push(listener);
    return () => {
      this.partBoundaryListeners = this.partBoundaryListeners.filter(l => l !== listener);
    };
  }
}

export const sequencerEngine = new SequencerEngine();
