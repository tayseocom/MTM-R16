import { Play, Square, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import HardwareButton from './HardwareButton';

interface TransportControlsProps {
  transportState: 'stopped' | 'playing' | 'recording' | 'countIn';
  onPlay?: () => void;
  onStop?: () => void;
  onRecord?: () => void;
  onRewind?: () => void;
  onForward?: () => void;
}

export default function TransportControls({ 
  transportState, 
  onPlay, 
  onStop, 
  onRecord,
  onRewind,
  onForward
}: TransportControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <HardwareButton 
        label="<<<" 
        icon={<ChevronLeft className="w-5 h-5" />} 
        onClick={onRewind}
        dataTestId="button-rewind"
      />
      <HardwareButton 
        label=">>>" 
        icon={<ChevronRight className="w-5 h-5" />} 
        onClick={onForward}
        dataTestId="button-forward"
      />
      <HardwareButton 
        label="PLAY" 
        variant="play"
        icon={<Play className="w-6 h-6" />} 
        led={transportState === 'playing' || transportState === 'recording' ? 'green' : 'off'}
        onClick={onPlay}
        className="min-w-[5rem]"
        dataTestId="button-play"
      />
      <HardwareButton 
        label="STOP/ CONTINUE" 
        variant="stop"
        icon={<Square className="w-6 h-6" />} 
        onClick={onStop}
        className="min-w-[5rem]"
        dataTestId="button-stop"
      />
      <HardwareButton 
        label="REC" 
        variant="record"
        icon={<Circle className="w-6 h-6" />} 
        led={transportState === 'recording' ? 'red' : (transportState === 'countIn' ? 'amber' : 'off')}
        ledPulse={transportState === 'recording'}
        onClick={onRecord}
        className="min-w-[5rem]"
        dataTestId="button-record"
      />
    </div>
  );
}
