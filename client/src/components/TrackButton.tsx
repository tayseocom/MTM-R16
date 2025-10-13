import { cn } from "@/lib/utils";
import LED from "./LED";

interface TrackButtonProps {
  trackNumber: number;
  selected?: boolean;
  armed?: boolean;
  playing?: boolean;
  muted?: boolean;
  onClick?: () => void;
}

export default function TrackButton({ 
  trackNumber, 
  selected, 
  armed, 
  playing, 
  muted,
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
        "relative flex flex-col items-center justify-center gap-1 p-2 rounded-md border bg-card hover-elevate active-elevate-2 transition-all min-h-[2.5rem]",
        selected && "ring-2 ring-accent bg-accent/20"
      )}
      data-testid={`track-button-${trackNumber}`}
    >
      <LED color={getLedColor()} pulse={playing} className="absolute top-1 right-1" />
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-bold text-foreground">
          TRACK {trackNumber}
        </span>
        <span 
          className="text-xs text-muted-foreground" 
          data-testid={`text-track-channel-${trackNumber}`}
        >
          CH {trackNumber}
        </span>
      </div>
    </button>
  );
}
