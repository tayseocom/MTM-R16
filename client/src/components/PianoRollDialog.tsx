import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PianoRoll from './PianoRoll';
import { MIDIEvent } from '@shared/schema';

interface PianoRollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackNumber: number;
  trackName: string;
  events: MIDIEvent[];
  onEventsChange: (events: MIDIEvent[]) => void;
  currentPosition?: number;
  liveNotes?: Map<number, { velocity: number; timestamp: number }>;
  partLength: number;
}

export default function PianoRollDialog({
  open,
  onOpenChange,
  trackNumber,
  trackName,
  events,
  onEventsChange,
  currentPosition,
  liveNotes,
  partLength
}: PianoRollDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 gap-0 bg-hardware-bg border-hardware-accent">
        <DialogHeader className="px-4 py-3 bg-hardware-panel border-b border-hardware-accent/30">
          <DialogTitle className="text-hardware-text font-mono uppercase">
            Track {trackNumber.toString().padStart(2, '0')} - Piano Roll Editor
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <PianoRoll 
            trackId={trackNumber}
            trackName={trackName}
            events={events}
            onEventsChange={onEventsChange}
            currentPosition={currentPosition}
            liveNotes={liveNotes}
            partLength={partLength}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
