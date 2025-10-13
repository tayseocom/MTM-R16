import { cn } from "@/lib/utils";
import LED from "./LED";

interface TrackButtonProps {
  trackNumber: number;
  selected?: boolean;
  armed?: boolean;
  playing?: boolean;
  muted?: boolean;
  progress?: number; // 0-1 value representing playback progress
  onClick?: (e: React.MouseEvent) => void;
}

export default function TrackButton({ 
  trackNumber, 
  selected, 
  armed, 
  playing, 
  muted,
  progress = 0,
  onClick 
}: TrackButtonProps) {
  const getLedColor = () => {
    if (muted) return 'off' as const;
    if (armed) return 'orange' as const;
    if (playing) return 'green' as const;
    return 'off' as const;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 p-2 rounded-md border bg-card hover-elevate active-elevate-2 transition-all min-h-[2.5rem] overflow-hidden",
        selected && "ring-2 ring-accent bg-accent/20"
      )}
      data-testid={`track-button-${trackNumber}`}
    >
      {/* Progress indicator - only show when playing */}
      {playing && (
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-green-500/60 transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      )}
      
      <LED color={getLedColor()} pulse={playing} className="absolute top-1 right-1" />
      <span className="text-xs font-bold text-foreground">
        TRACK {trackNumber}
      </span>
    </button>
  );
}
