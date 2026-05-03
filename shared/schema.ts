import { z } from "zod";

export interface MIDIEvent {
  timestamp: number;
  type: 'noteOn' | 'noteOff' | 'cc' | 'programChange';
  channel: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
}

export interface Track {
  id: number;
  name: string;
  channel: number;
  muted: boolean;
  events: MIDIEvent[];
}

export interface Part {
  id: number;
  name: string;
  length: number;
  tracks: Track[];
}

// Bit 0..15 map to Track 1..16 (1 = audible, 0 = muted for that step)
export type TrackMask = number; // 0..65535 for 16 tracks

export interface SongStep {
  id: string;                 // sst_<ulid>
  partId: number;             // reference to Part.id
  repeats?: number;           // default 1 (play this step N times before advancing)
  trackMask?: TrackMask;      // overrides Part mutes for this step; undefined = use Part's mutes
  transpose?: number;         // semitone offset just for this step (optional)
}

export interface Song {
  id: string;                 // sng_<ulid>
  name: string;
  tempoBpm: number;           // song tempo; applied on select
  steps: SongStep[];          // ordered chain
  loopEnabled: boolean;       // if true, loop between loopStart..loopEnd (inclusive)
  loopStart: number;          // step index (0-based)
  loopEnd: number;            // step index (inclusive)
  createdAt: number;
  updatedAt: number;
}

export interface StepRuntime {
  idx: number;                // current step index
  pass: number;               // which repeat pass we're on for this step (1..repeats)
}

export interface Project {
  name: string;
  tempo: number;
  parts: Part[];
  songs: Song[];
  currentPart: number;
  currentSong: string | null;  // Song.id
  midiFilter?: MidiFilterSettings;
}

export const projectSchema = z.object({
  name: z.string(),
  tempo: z.number().min(40).max(250),
  parts: z.array(z.any()),
  songs: z.array(z.any()),
  currentPart: z.number(),
  currentSong: z.number().nullable(),
});

export interface MidiFilterSettings {
  note: boolean;
  cc: boolean;
  pitchBend: boolean;
  aftertouch: boolean;
  programChange: boolean;
}

export type TransportState = 'stopped' | 'playing' | 'recording' | 'countIn';
export type EditMode = 'none' | 'quantize' | 'copy' | 'merge' | 'erase' | 'transpose' | 'name' | 'edit' | 'part' | 'length' | 'song' | 'load' | 'save' | 'midi_chan';
