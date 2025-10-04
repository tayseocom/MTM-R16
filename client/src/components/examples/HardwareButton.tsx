import HardwareButton from '../HardwareButton';
import { Play, Square, Circle } from 'lucide-react';

export default function HardwareButtonExample() {
  return (
    <div className="p-8 bg-background flex gap-2">
      <HardwareButton label="QUANT" led="off" />
      <HardwareButton label="LENGTH" active led="green" />
      <HardwareButton label="PLAY" variant="play" icon={<Play className="w-4 h-4" />} led="green" />
      <HardwareButton label="STOP" variant="stop" icon={<Square className="w-4 h-4" />} />
      <HardwareButton label="REC" variant="record" icon={<Circle className="w-4 h-4" />} led="red" ledPulse />
    </div>
  );
}
