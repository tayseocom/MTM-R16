# Design Guidelines: MTM-R16 Web MIDI Sequencer

## Design Approach

**Selected Approach:** Hardware Skeuomorphic Design (Custom System)

This application replicates the Alesis MTT-8 hardware sequencer, requiring a faithful recreation of the physical device's interface. The design prioritizes immediate recognition for users familiar with hardware sequencers while maintaining web-native usability standards.

**Core Principles:**
- Hardware fidelity: Match the physical device's layout, proportions, and visual language
- Immediate feedback: Every interaction must provide instant visual confirmation
- Information density: Professional tools prioritize data over whitespace
- Tactile simulation: Buttons and controls should feel pressable and responsive

## Core Design Elements

### A. Color Palette

**Dark Mode Only** (matching hardware chassis):

Primary Panel Colors:
- Panel Background: 220 15% 12% (charcoal gray, powder-coated metal finish)
- Panel Border: 220 20% 8% (darker edge shadow)
- Section Dividers: 220 25% 18% (subtle separation lines)

LCD Display:
- LCD Background: 140 85% 8% (dark green-black LCD)
- LCD Text Active: 120 100% 65% (bright phosphor green)
- LCD Text Dim: 120 60% 35% (inactive segments)
- LCD Border: 140 30% 15% (LCD bezel)

Button States:
- Button Base: 220 18% 16% (rubberized button surface)
- Button Pressed: 220 20% 10% (depressed state)
- Button Label: 0 0% 75% (screen-printed white text)

LED Indicators:
- LED Off: 0 0% 15% (dark gray, unlit)
- LED Red: 0 85% 50% (recording, errors)
- LED Green: 120 85% 45% (active, playing)
- LED Amber: 30 90% 50% (count-in, warning)
- LED Orange: 25 85% 50% (armed for record)

Accent Colors:
- Track Select Highlight: 200 60% 45% (blue selection ring)
- Value Edit: 280 65% 55% (purple for editing mode)

### B. Typography

**LCD Display Font:**
- Family: 'Orbitron' or '7-segment' style monospace
- Primary Size: 1.5rem (24px) - main display
- Secondary Size: 1rem (16px) - status text
- Weight: 600 (semi-bold for visibility)
- Letter Spacing: 0.15em (LCD segment spacing)
- Line Height: 1.2

**Button Labels:**
- Family: 'Inter', sans-serif (technical, legible)
- Size: 0.625rem (10px) - small caps
- Weight: 700 (bold)
- Transform: uppercase
- Color: 0 0% 75% (light gray)

**Function Labels:**
- Family: 'Inter', sans-serif
- Size: 0.75rem (12px)
- Weight: 500 (medium)
- Color: 0 0% 65%

### C. Layout System

**Spacing Primitives:**
Use Tailwind units: 1, 2, 3, 4, 6, 8, 12, 16 for consistent hardware-grid alignment.

**Main Layout Grid:**
- Container: max-w-7xl centered with p-4 to p-8
- Panel Sections: gap-6 between major functional areas
- Button Grid: gap-2 for dense control surfaces
- Track Grid: gap-1 for 16-track row layout

**Component Spacing:**
- Between sections: space-y-6
- Within control groups: space-y-2 or gap-2
- Button padding: p-2 to p-3
- LCD padding: p-4

**Responsive Breakpoints:**
- Desktop (1024px+): Full hardware layout side-by-side
- Tablet (768px-1023px): Stacked sections with maintained proportions
- Mobile (< 768px): Simplified vertical layout, larger touch targets

### D. Component Library

**LCD Display Panel:**
- Background: dark green-black gradient
- Inner glow: subtle green phosphor effect (box-shadow: inset 0 0 8px rgba(120, 255, 120, 0.1))
- Text: monospace, high contrast green
- Refresh: immediate update on any state change
- Dimensions: Fixed aspect ratio 16:3 for authenticity

**Hardware Buttons:**
- Shape: Rounded rectangles (rounded-md)
- Size: 2.5rem × 2.5rem (40px square) minimum for touch
- Surface: Subtle gradient to simulate depth
- Active State: Inner shadow, 2px translate-y shift
- Hover: Slight brightness increase (filter: brightness(1.1))
- Label: Positioned below or on button face

**LED Indicators:**
- Size: 0.5rem (8px) circle
- Glow Effect: box-shadow with color matching LED state
- Off State: Dark gray with no glow
- On State: Bright color with outer glow (box-shadow: 0 0 8px currentColor)
- Pulse Animation: For recording state only (1s ease-in-out infinite)

**Track Selector Grid:**
- 16 buttons in 2 rows of 8 or 4 rows of 4
- Each button: Track number + LED indicator
- Selected track: Border highlight + brighter background
- Layout: grid grid-cols-8 gap-1 on desktop, grid-cols-4 on mobile

**Transport Controls:**
- Classic sequencer layout: STOP, PLAY, RECORD grouped together
- Icon + text labels for clarity
- Size: Larger than standard buttons (3rem height)
- Record button: Red LED when armed, flashing when recording

**Value Encoders/Sliders:**
- Tempo: Slider with numeric readout (40-250 BPM)
- Quantize: Select dropdown styled as hardware parameter
- Track Volume/Pan: Vertical faders if space allows, otherwise sliders
- Visual feedback in LCD display when adjusting

**MIDI Device Selector:**
- Dropdown styled as hardware menu
- Show device status (connected/disconnected)
- Input/Output separate selectors
- Status LEDs next to device names

**Function Buttons:**
- Copy, Paste, Quantize, Erase, etc.
- Grid layout: 3-4 columns
- Consistent size with primary buttons
- Labels clearly visible

**Save/Load Interface:**
- File upload/download styled as hardware controls
- "SAVE" and "LOAD" buttons matching hardware aesthetic
- File name display in LCD
- JSON format badge (subtle indicator)

### E. Interactions & Feedback

**Button Press:**
- Immediate visual press (transform: translateY(2px))
- LED state change within 16ms (single frame)
- Optional subtle click sound (Web Audio API)

**Recording Feedback:**
- REC LED pulses during recording
- Incoming MIDI events flash corresponding track LED
- LCD shows note count or last event

**Transport State:**
- STOP: All LEDs off except track selection
- PLAY: Green play LED solid, track playback LEDs pulse
- RECORD: Red LED pulses, armed tracks show orange

**Value Changes:**
- LCD updates immediately
- Parameter name flashes briefly
- Numeric values increment/decrement smoothly

**Error States:**
- No MIDI devices: Amber warning LED, LCD message
- Device disconnected: Pause transport, amber LED
- Buffer full: Flash REC LED, LCD warning

### F. Animations

**Use Very Sparingly:**
- LED pulse: Only for recording state (1s cycle)
- Track playback: Subtle LED brightness pulse following tempo
- Button press: Instant transform (no transition)
- LCD text: Instant update (no fades)
- Value changes: Snap to new value (no slides)

**Critical:** Avoid animations that could introduce timing perception issues. Hardware responds instantly; the web version must match.

## Layout Specifications

**Main Application Structure:**

1. **Header Bar** (h-16):
   - Logo/Title: "MTM-R16" in hardware stencil style
   - MIDI Device status indicators
   - Save/Load buttons (right-aligned)

2. **Main Panel** (flex-1):
   - LCD Display Section (20% height)
   - Transport Controls (10% height)
   - Track Grid (30% height)
   - Function Controls (20% height)
   - Value Controls (20% height)

3. **Footer** (h-12):
   - Connection status
   - Timing statistics (jitter, CPU load) for developers
   - Subtle branding

## Accessibility

- All buttons: Keyboard accessible (tab navigation)
- ARIA labels on all interactive elements
- LCD text: Sufficient contrast (green on dark green-black exceeds WCAG AAA)
- Visual indicators accompanied by ARIA live regions
- Keyboard shortcuts for transport (Space = play/pause, R = record, etc.)

## Performance Considerations

- LED animations use CSS transform and opacity only (GPU accelerated)
- LCD updates via React/Svelte state, not DOM manipulation
- Button states use CSS classes, not inline styles
- Minimize repaints by batching state updates
- Keep component tree shallow for 60fps rendering

## Images

No hero images or marketing photography. This is a utility application mimicking hardware equipment. The only imagery should be:
- Optional logo badge (MTM-R16 product logo) in header
- Device connection status icons (MIDI port symbols)
- All other visuals are functional UI components, not decorative images