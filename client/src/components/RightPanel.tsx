import HardwareButton from './HardwareButton';

interface RightPanelProps {
  loopEnabled?: boolean;
  midiEchoEnabled?: boolean;
  metroEnabled?: boolean;
  clockMode?: 'off' | 'send' | 'receive';
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
  clockMode = 'off',
  midiFilterEnabled,
  tempo = 120,
  onLoopClick,
  onMidiEchoClick,
  onMetroClick,
  onClockClick,
  onMidiFilterClick,
  onTempoClick
}: RightPanelProps) {
  const getClockLabel = () => {
    switch (clockMode) {
      case 'send': return 'CLOCK SEND';
      case 'receive': return 'CLOCK RCV';
      default: return 'CLOCK';
    }
  };

  const getClockLED = () => {
    switch (clockMode) {
      case 'send': return 'green';
      case 'receive': return 'amber';
      default: return 'off';
    }
  };
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
        label={getClockLabel()} 
        onClick={onClockClick}
        active={clockMode !== 'off'}
        led={getClockLED() as 'red' | 'green' | 'amber' | 'orange' | 'off'}
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
