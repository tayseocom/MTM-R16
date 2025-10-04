import HardwareButton from './HardwareButton';

interface RightPanelProps {
  loopEnabled?: boolean;
  midiEchoEnabled?: boolean;
  metroEnabled?: boolean;
  clockEnabled?: boolean;
  midiFilterEnabled?: boolean;
  tempo?: number;
  onLoopClick?: () => void;
  onMidiEchoClick?: () => void;
  onMetroClick?: () => void;
  onClockClick?: () => void;
  onMidiFilterClick?: () => void;
  onTempoClick?: () => void;
}

export default function RightPanel({ 
  loopEnabled,
  midiEchoEnabled,
  metroEnabled,
  clockEnabled,
  midiFilterEnabled,
  tempo = 120,
  onLoopClick,
  onMidiEchoClick,
  onMetroClick,
  onClockClick,
  onMidiFilterClick,
  onTempoClick
}: RightPanelProps) {
  return (
    <div className="flex flex-col gap-2">
      <HardwareButton 
        label="LOOP" 
        onClick={onLoopClick}
        active={loopEnabled}
        led={loopEnabled ? 'green' : 'off'}
      />
      <HardwareButton 
        label="MIDI ECHO" 
        onClick={onMidiEchoClick}
        active={midiEchoEnabled}
        led={midiEchoEnabled ? 'green' : 'off'}
      />
      <HardwareButton 
        label="METRO" 
        onClick={onMetroClick}
        active={metroEnabled}
        led={metroEnabled ? 'green' : 'off'}
      />
      <HardwareButton 
        label="CLOCK" 
        onClick={onClockClick}
        active={clockEnabled}
        led={clockEnabled ? 'green' : 'off'}
      />
      <HardwareButton 
        label="MIDI FILTER" 
        onClick={onMidiFilterClick}
        active={midiFilterEnabled}
        led={midiFilterEnabled ? 'green' : 'off'}
      />
      <HardwareButton 
        label="TEMPO" 
        onClick={onTempoClick}
      />
    </div>
  );
}
