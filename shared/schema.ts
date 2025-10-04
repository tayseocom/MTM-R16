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

export interface Song {
  id: number;
  name: string;
  parts: number[];
  loop: boolean;
  loopStart: number;
  loopEnd: number;
}

export interface Project {
  name: string;
  tempo: number;
  parts: Part[];
  songs: Song[];
  currentPart: number;
  currentSong: number | null;
}

export const projectSchema = z.object({
  name: z.string(),
  tempo: z.number().min(40).max(250),
  parts: z.array(z.any()),
  songs: z.array(z.any()),
  currentPart: z.number(),
  currentSong: z.number().nullable(),
});

export type TransportState = 'stopped' | 'playing' | 'recording' | 'countIn';
export type EditMode = 'none' | 'quantize' | 'copy' | 'merge' | 'erase' | 'transpose' | 'name' | 'edit' | 'part' | 'length' | 'song' | 'load' | 'save' | 'midi_chan';
