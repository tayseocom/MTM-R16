# MTM-R16 Web MIDI Sequencer

## Overview
MTM-R16 is a web-based MIDI sequencer that emulates the Alesis MMT-8 multi-track MIDI recorder. It offers 16-track recording, part-based sequencing, and precise timing using AudioWorklet. The application runs entirely in the browser, leveraging the Web MIDI API and Web Audio API, with offline-first data persistence via localStorage. The project's ambition is to provide a comprehensive, hardware-inspired MIDI sequencing experience within a web environment, targeting musicians and producers seeking a robust, browser-native tool.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript via Vite.
- **UI/UX**: Hardware skeuomorphic design replicating the MMT-8. Features include:
    - `shadcn/ui` components (Radix UI + Tailwind CSS) for consistency and accessibility.
    - Faithful recreation of physical layout, LCD display (phosphor green), and LED indicators.
    - Emphasis on immediate feedback and high information density.
- **State Management**: React hooks for UI; sequencer engine maintains its own state.
- **Routing**: Wouter for client-side routing.

### Backend
- **Server**: Minimal Express.js server (currently with placeholder routes).
- **Development**: Vite integration for HMR.
- **Storage Layer**: Abstract `IStorage` with in-memory implementation. Drizzle ORM schema defined for PostgreSQL, but `localStorage` is used for client-side persistence.
- **API**: RESTful endpoints under `/api` (to be implemented).

### Core Sequencer Engine
- **Audio Timing**: `AudioClock` class uses AudioWorklet for sub-2ms jitter precision; falls back to JavaScript intervals.
- **MIDI Management**: `MIDIManager` handles Web MIDI API interactions, including device enumeration, input routing, and output scheduling.
- **Sequencer Engine**: `SequencerEngine` coordinates multi-part/multi-track recording and playback, real-time quantization, track control (arming, mute, solo), transport control, and event scheduling.
- **Data Model**:
    - **Project**: Tempo, parts, songs.
    - **Part**: Named section (1-64 bars) with 16 tracks.
    - **Track**: Individual MIDI channel with events, name, mute state. Fixed MIDI channel per track (e.g., Track 1 -> CH 1).
    - **MIDI Events**: Timestamped note on/off, CC, program change.
    - **Song**: Ordered sequence of parts with loop points.
- **Multi-Select Track Workflow**: Supports selecting multiple tracks for playback and overdub recording. The "primary track" (last clicked) is used for recording.
- **Part Length**: Adjustable from 1 to 64 bars.

### State Persistence
- **Client-Side**: `localStorage` for project saving/loading (JSON).
- **Database**: Drizzle ORM schema is prepared for a PostgreSQL backend.

### Timing Architecture
- **AudioWorklet Processor**: `audio-clock-processor.js` runs on an audio thread for precise timing, emitting tick/beat/bar events and handling metronome clicks.
- **Fallback Timing**: `setInterval` if AudioWorklet is unavailable.

### Component Architecture
Custom hardware-themed React components: `HardwareButton`, `LCDDisplay`, `LED`, `TrackButton`, `TransportControls`, `ControlGrid`, `NumPad`, `MIDIDeviceSelect`, `PianoRoll`, `PianoRollDialog`.

### Threading Model
- **Main Thread**: UI, user interaction, project state.
- **Audio Thread**: AudioWorklet for timing.
- **Message Passing**: `PostMessage` between threads.

### Performance
- AudioWorklet for timing precision.
- Minimal React re-renders.
- Efficient MIDI event scheduling and lookup.

### Browser Compatibility
Targets Chromium, Edge, Safari; requires Web MIDI API, Web Audio API, and `localStorage`.

### Piano Roll Editor
- **Features**: Canvas-based rendering with a three-layer canvas architecture (Grid, Piano, Overlay).
- **Functionality**: Tools (Select, Draw, Erase), configurable snap grid, zoom, note editing (draw, move, resize), multi-selection, quantize, delete, keyboard navigation.
- **Live MIDI Visualization**: Real-time display of incoming MIDI notes and active playback notes.
- **Recording Integration**: Throttled updates during recording, combining committed track events with live buffer for seamless display.
- **Playback Integration**: Visual playhead syncs with sequencer playback.

### Song Mode
- **Purpose**: Step-based sequencing, controlling part order, repeats, and per-step overrides.
- **Data Model**:
    - **Song**: Container with tempo, ordered `SongStep` array, loop settings.
    - **SongStep**: References `partId`, `repeats`, optional `trackMask` (mute overrides), optional `transpose`.
- **`SongPlayer` Class**: Manages song playback, step progression, and applies step-scoped overrides to the `SequencerEngine`.
- **UI Components**: `SongModeDialog`, `SongEditor` (step list, chain overview).
- **Playback**: All 16 tracks play, filtered by step masks; step-scoped overrides apply per step; loop functionality.

## External Dependencies

### UI & Styling
- **Tailwind CSS**: Utility-first CSS.
- **Radix UI**: Accessible UI primitives.
- **shadcn/ui**: Component system using Radix + Tailwind.
- **Lucide React**: Icon library.
- **Google Fonts**: Inter, Orbitron.

### React Ecosystem
- **React 18**: UI framework.
- **Wouter**: Lightweight routing.
- **TanStack React Query**: Data fetching (minimal).
- **React Hook Form**: Form management.

### Build Tools
- **Vite**: Development and build tool.
- **TypeScript**: Type safety.
- **esbuild**: Fast JavaScript bundler.
- **PostCSS**: CSS processing.

### Database (Infrastructure Ready)
- **Drizzle ORM**: TypeScript ORM.
- **Drizzle Kit**: Schema management.
- **@neondatabase/serverless**: PostgreSQL driver.

### Validation & Type Safety
- **Zod**: Schema validation.
- **drizzle-zod**: Drizzle to Zod validation.

### Utilities
- **date-fns**: Date manipulation.
- **clsx & tailwind-merge**: Conditional class utilities.
- **nanoid**: Unique ID generation.

### Web APIs (Browser Native)
- **Web MIDI API**: MIDI device access.
- **Web Audio API**: Audio context, AudioWorklet.
- **localStorage**: Client-side persistence.