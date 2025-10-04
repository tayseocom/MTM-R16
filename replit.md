# MTM-R16 Web MIDI Sequencer

## Overview

MTM-R16 is a web-based MIDI sequencer that replicates the hardware interface of the Alesis MTT-8 multi-track MIDI recorder. The application provides 16-track recording, part-based sequencing, and precision timing through AudioWorklet processing. It operates entirely in the browser using the Web MIDI API and Web Audio API, with offline-first data persistence via localStorage (with database capabilities available via Drizzle ORM).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript running on Vite for development and production builds.

**UI Component System**: The application uses shadcn/ui components built on top of Radix UI primitives with Tailwind CSS for styling. This provides a consistent, accessible component library with dark mode support.

**Design Philosophy**: Hardware skeuomorphic design that faithfully recreates the physical MTT-8 device interface. The UI emphasizes:
- Hardware fidelity: Matching physical device layout and visual language
- Immediate feedback: Every interaction provides instant visual confirmation
- Information density: Professional tool aesthetic prioritizing data over whitespace
- LCD display simulation with phosphor green text on dark background
- LED indicators for track states (red/green/amber/orange)
- Button states mimicking rubberized hardware buttons

**State Management**: React hooks and component state for UI interactions. The sequencer engine maintains its own state separate from React components.

**Routing**: Wouter for lightweight client-side routing (single page application with home route).

### Backend Architecture

**Server Framework**: Express.js serving as a minimal HTTP server. Currently configured with placeholder routes and in-memory storage.

**Development Setup**: Vite middleware integration for hot module replacement during development, with production builds serving static assets.

**Storage Layer**: Abstract storage interface (`IStorage`) with in-memory implementation (`MemStorage`). Database schema defined using Drizzle ORM with PostgreSQL dialect, though currently using localStorage for client-side persistence.

**API Design**: RESTful endpoints prefixed with `/api` (routes to be implemented as needed).

### Core Sequencer Engine

**Audio Timing**: Custom `AudioClock` class utilizing AudioWorklet processor for sub-2ms jitter timing precision. Falls back to JavaScript intervals if AudioWorklet is unavailable.

**MIDI Management**: `MIDIManager` class wrapping the Web MIDI API to handle:
- Device enumeration and connection
- Input message routing
- Output message scheduling
- Real-time MIDI event transmission

**Sequencer Engine**: `SequencerEngine` class coordinating:
- Multi-part, multi-track recording and playback
- Real-time quantization
- Track arming, muting, and solo
- Transport control (play, stop, record)
- Event scheduling synchronized to audio clock
- Project state management

**Data Model**:
- **Project**: Contains tempo, parts, songs, and current state
- **Part**: Named section with length (in bars) containing 16 tracks
- **Track**: Individual MIDI channel with events, name, mute state
- **MIDI Events**: Timestamped note on/off, CC, program change messages
- **Song**: Ordered sequence of parts with loop points

### State Persistence

**Client-Side Storage**: localStorage for saving/loading projects as JSON. Provides offline-first functionality with no server dependency.

**Database Schema**: Drizzle ORM schema defined for potential PostgreSQL backend (currently unused, but infrastructure in place).

### Timing Architecture

**AudioWorklet Processor** (`audio-clock-processor.js`):
- Runs on audio thread for deterministic timing
- Calculates samples per tick based on tempo and sample rate
- Emits tick, beat, and bar events to main thread
- Handles metronome click generation
- Provides count-in functionality

**Fallback Timing**: JavaScript setInterval-based timing when AudioWorklet unavailable (browsers without support).

### Component Architecture

Custom hardware-themed components:
- `HardwareButton`: Simulated physical buttons with LED indicators
- `LCDDisplay`: Green phosphor LCD with main/sub text
- `LED`: Status indicators (red/green/amber/orange)
- `TrackButton`: 16 track selection buttons with state indicators
- `TransportControls`: Play, stop, record, rewind, forward
- `ControlGrid`: Function buttons (quantize, length, part, etc.)
- `NumPad`: Numeric input buttons
- `MIDIDeviceSelect`: MIDI device selection dropdowns

### Threading Model

1. **Main Thread**: UI rendering, user interactions, project state management
2. **Audio Thread**: AudioWorklet processor for precise timing
3. **Message Passing**: PostMessage between main and audio threads

### Performance Considerations

- AudioWorklet prioritized for timing precision (sub-2ms jitter target)
- Minimal React re-renders through careful state management
- MIDI events scheduled with precise timestamps
- Efficient event lookup using Map data structures

### Browser Compatibility

Target browsers: Chromium, Edge, Safari
Required APIs:
- Web MIDI API
- Web Audio API (AudioContext, AudioWorklet)
- localStorage
- ES6+ JavaScript features

## External Dependencies

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Radix UI**: Unstyled, accessible UI primitives (@radix-ui/react-*)
- **shadcn/ui**: Pre-built component system using Radix + Tailwind
- **Lucide React**: Icon library for UI elements
- **class-variance-authority**: Component variant management
- **Google Fonts**: Inter and Orbitron fonts for LCD display

### React Ecosystem
- **React 18**: UI framework
- **React DOM**: Browser rendering
- **Wouter**: Lightweight routing library
- **TanStack React Query**: Data fetching and caching (minimal usage)
- **React Hook Form**: Form state management (@hookform/resolvers)

### Build Tools
- **Vite**: Development server and build tool
- **TypeScript**: Type safety and developer experience
- **esbuild**: Fast JavaScript bundler
- **PostCSS**: CSS processing with Autoprefixer

### Database (Infrastructure Ready)
- **Drizzle ORM**: TypeScript ORM for SQL databases
- **Drizzle Kit**: Schema migrations and management
- **@neondatabase/serverless**: PostgreSQL driver for serverless environments
- **connect-pg-simple**: PostgreSQL session store (if sessions needed)

### Validation & Type Safety
- **Zod**: Schema validation library
- **drizzle-zod**: Drizzle schema to Zod validation

### Utilities
- **date-fns**: Date manipulation utilities
- **clsx & tailwind-merge**: Conditional className utilities
- **nanoid**: Unique ID generation

### Development
- **@replit/vite-plugin-***: Replit-specific development tooling
- **tsx**: TypeScript execution for Node.js scripts

### Web APIs (Browser Native)
- **Web MIDI API**: MIDI device access and communication
- **Web Audio API**: Audio context and AudioWorklet for timing
- **localStorage**: Client-side persistence
- **IndexedDB**: Potential future use for larger datasets