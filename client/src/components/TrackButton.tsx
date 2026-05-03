import { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";
import LED from "./LED";

interface TrackButtonProps {
  trackNumber: number;
  trackName?: string;
  hasEvents?: boolean;
  selected?: boolean;
  armed?: boolean;
  playing?: boolean;
  muted?: boolean;
  progress?: number;
  onClick?: (e: React.MouseEvent) => void;
  onRename?: (newName: string) => void;
}

export default function TrackButton({ 
  trackNumber, 
  trackName,
  hasEvents,
  selected, 
  armed, 
  playing, 
  muted,
  progress = 0,
  onClick,
  onRename
}: TrackButtonProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const getLedColor = () => {
    if (muted) return 'off' as const;
    if (armed) return 'orange' as const;
    if (playing) return 'green' as const;
    return 'off' as const;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRename) {
      setEditValue(trackName || `Track ${trackNumber}`);
      setEditing(true);
    }
  };

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && onRename) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const displayName = trackName && trackName !== `Track ${trackNumber}` ? trackName : null;

  return (
    <button
      onClick={editing ? undefined : onClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 p-2 rounded-md border bg-card hover-elevate active-elevate-2 transition-all min-h-[2.5rem] overflow-hidden",
        selected && "ring-2 ring-accent bg-accent/20"
      )}
      data-testid={`track-button-${trackNumber}`}
      aria-label={`Track ${trackNumber}${trackName && trackName !== `Track ${trackNumber}` ? ` (${trackName})` : ''}${selected ? ', selected' : ''}${armed ? ', armed' : ''}${muted ? ', muted' : ''}${playing ? ', playing' : ''}`}
      aria-pressed={selected}
    >
      {playing && (
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-green-500/60 transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      )}
      
      {hasEvents && !playing && (
        <div 
          className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500/50"
          data-testid={`track-indicator-${trackNumber}`}
        />
      )}
      
      <LED color={getLedColor()} pulse={playing} className="absolute top-1 right-1" />
      
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-full text-xs text-center bg-transparent border-b border-accent outline-none text-foreground"
          maxLength={12}
          data-testid={`input-track-name-${trackNumber}`}
        />
      ) : (
        <>
          <span className="text-xs font-bold text-foreground">
            {trackNumber}
          </span>
          {displayName && (
            <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">
              {displayName}
            </span>
          )}
        </>
      )}
    </button>
  );
}
