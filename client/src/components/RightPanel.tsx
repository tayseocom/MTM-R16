import HardwareButton from './HardwareButton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { MidiFilterSettings } from '@shared/schema';

interface RightPanelProps {
  loopEnabled?: boolean;
  midiEchoEnabled?: boolean;
  metroEnabled?: boolean;
  clockMode?: 'off' | 'send' | 'receive';
  midiFilter?: MidiFilterSettings;
  tempo?: number;
  onLoopClick?: () => void;
  onMidiEchoClick?: () => void;
  onMetroClick?: () => void;
  onClockClick?: () => void;
  onMidiFilterChange?: (filter: MidiFilterSettings) => void;
  onTempoClick?: () => void;
}

const FILTER_OPTIONS: Array<{ key: keyof MidiFilterSettings; label: string }> = [
  { key: 'note', label: 'Note' },
  { key: 'cc', label: 'CC' },
  { key: 'pitchBend', label: 'Pitch Bend' },
  { key: 'aftertouch', label: 'Aftertouch' },
  { key: 'programChange', label: 'Program Change' },
];

export default function RightPanel({
  loopEnabled,
  midiEchoEnabled,
  metroEnabled,
  clockMode = 'off',
  midiFilter,
  tempo = 120,
  onLoopClick,
  onMidiEchoClick,
  onMetroClick,
  onClockClick,
  onMidiFilterChange,
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

  const filter: MidiFilterSettings = midiFilter ?? {
    note: false,
    cc: false,
    pitchBend: false,
    aftertouch: false,
    programChange: false,
  };

  const filterActive = Object.values(filter).some(Boolean);

  const toggleFilter = (key: keyof MidiFilterSettings) => {
    if (!onMidiFilterChange) return;
    onMidiFilterChange({ ...filter, [key]: !filter[key] });
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
        tooltip="Route incoming MIDI directly to output"
      />
      <HardwareButton 
        label="METRO" 
        onClick={onMetroClick}
        active={metroEnabled}
        led={metroEnabled ? 'green' : 'off'}
        tooltip="Toggle metronome click during playback"
      />
      <HardwareButton 
        label={getClockLabel()} 
        onClick={onClockClick}
        active={clockMode !== 'off'}
        led={getClockLED() as 'red' | 'green' | 'amber' | 'orange' | 'off'}
        tooltip="Cycle MIDI clock sync: Off / Send / Receive"
      />
      <Popover>
        <PopoverTrigger asChild>
          <div>
            <HardwareButton
              label="MIDI FILTER"
              active={filterActive}
              led={filterActive ? 'amber' : 'off'}
              tooltip="Block selected MIDI message types from being recorded"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="end" data-testid="popover-midi-filter">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">MIDI Filter</p>
              <p className="text-xs text-muted-foreground">
                Skip these message types while recording.
              </p>
            </div>
            <div className="space-y-2">
              {FILTER_OPTIONS.map(({ key, label }) => {
                const id = `midi-filter-${key}`;
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
                      {label}
                    </Label>
                    <Switch
                      id={id}
                      checked={filter[key]}
                      onCheckedChange={() => toggleFilter(key)}
                      data-testid={`switch-midi-filter-${key}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <HardwareButton 
        label="TEMPO" 
        onClick={onTempoClick}
      />
    </div>
  );
}
