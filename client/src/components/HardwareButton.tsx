import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import LED from "./LED";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HardwareButtonProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  led?: 'red' | 'green' | 'amber' | 'orange' | 'off';
  ledPulse?: boolean;
  variant?: 'default' | 'play' | 'stop' | 'record';
  icon?: ReactNode;
  className?: string;
  dataTestId?: string;
  tooltip?: string;
  disabled?: boolean;
}

export default function HardwareButton({ 
  label, 
  onClick, 
  active, 
  led,
  ledPulse,
  variant = 'default',
  icon,
  className,
  dataTestId,
  tooltip,
  disabled,
}: HardwareButtonProps) {
  const variantClasses = {
    default: 'bg-card hover-elevate active-elevate-2',
    play: 'bg-primary/20 border-primary/30 hover-elevate active-elevate-2',
    stop: 'bg-muted hover-elevate active-elevate-2',
    record: 'bg-destructive/20 border-destructive/30 hover-elevate active-elevate-2',
  };

  const button = (
    <button
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 p-2 rounded-md border transition-all min-h-[2.5rem]",
        active && "ring-2 ring-accent",
        variantClasses[variant],
        disabled && "opacity-40 cursor-not-allowed pointer-events-auto",
        className
      )}
      data-testid={dataTestId || `button-${label.toLowerCase().replace(/\s+/g, '-')}`}
      aria-label={tooltip ? `${label} — ${tooltip}` : label}
      aria-pressed={active || undefined}
    >
      {led && (
        <LED color={led} pulse={ledPulse} className="absolute top-1 right-1" />
      )}
      {icon && <div className="text-foreground">{icon}</div>}
      <span className="text-[10px] font-bold uppercase text-foreground tracking-tight leading-tight text-center">
        {label}
      </span>
    </button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
