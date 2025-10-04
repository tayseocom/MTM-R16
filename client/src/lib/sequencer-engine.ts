import type { MIDIEvent, Track, Part, Project } from '@shared/schema';
import { audioClock } from './audio-clock';
import { midiManager } from './midi';
import { metronome } from './metronome';

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
    });

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
      this.recordingEvents.forEach((events, trackId) => {
        const track = this.getCurrentPart().tracks.find(t => t.id === trackId);
        if (track && track.channel === channel) {
          events.push(midiEvent!);
        }
      });
    }
  }

  stopRecording() {
    this.isRecording = false;
    
    // Commit recorded events to tracks (append, don't replace)
    this.recordingEvents.forEach((events, trackId) => {
      const track = this.getCurrentPart().tracks.find(t => t.id === trackId);
      if (track) {
        const newEvents = this.quantizeValue > 0 
          ? this.quantizeEvents(events, this.quantizeValue)
          : events;
        
        // Append new events to existing ones and sort
        track.events = [...track.events, ...newEvents].sort((a, b) => a.timestamp - b.timestamp);
      }
    });
    
    this.recordingEvents.clear();
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

    const tracksToPlay = trackIds 
      ? part.tracks.filter(t => trackIds.includes(t.id) && !t.muted)
      : part.tracks.filter(t => !t.muted);

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
    const events = this.playbackEvents.get(loopTick);
    
    if (events && this.selectedOutput) {
      events.forEach(event => {
        this.sendMIDIEvent(event, timestamp);
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
}

export const sequencerEngine = new SequencerEngine();
