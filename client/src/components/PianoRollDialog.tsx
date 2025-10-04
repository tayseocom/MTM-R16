import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PianoRoll from './PianoRoll';
import { MIDIEvent } from '@shared/schema';

interface PianoRollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackNumber: number;
  events: MIDIEvent[];
  onEventsChange: (events: MIDIEvent[]) => void;
  currentPosition?: number;
}

export default function PianoRollDialog({
  open,
  onOpenChange,
  trackNumber,
  events,
  onEventsChange,
  currentPosition
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
            events={events}
            onEventsChange={onEventsChange}
            currentPosition={currentPosition}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
