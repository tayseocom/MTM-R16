import { cn } from "@/lib/utils";

interface LCDDisplayProps {
  mainText: string;
  subText?: string;
  className?: string;
}

export default function LCDDisplay({ mainText, subText, className }: LCDDisplayProps) {
  return (
    <div className={cn(
      "relative rounded-md overflow-hidden border-2",
      "bg-[#0a1a0a] border-[#1a3a1a]",
      className
    )} data-testid="lcd-display">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
      <div className="relative p-4 space-y-1">
        <div className="font-mono text-2xl font-semibold text-primary tracking-[0.15em] leading-tight" data-testid="lcd-main-text">
          {mainText}
        </div>
        {subText && (
          <div className="font-mono text-sm text-primary/60 tracking-wider" data-testid="lcd-sub-text">
            {subText}
          </div>
        )}
      </div>
      <div className="absolute inset-0 shadow-[inset_0_0_12px_rgba(120,255,120,0.1)] pointer-events-none" />
    </div>
  );
}
