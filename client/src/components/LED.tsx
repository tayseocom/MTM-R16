import { cn } from "@/lib/utils";

interface LEDProps {
  color: 'red' | 'green' | 'amber' | 'orange' | 'off';
  pulse?: boolean;
  className?: string;
}

const colorClasses = {
  red: 'bg-destructive shadow-[0_0_8px_currentColor]',
  green: 'bg-primary shadow-[0_0_8px_currentColor]',
  amber: 'bg-[hsl(30,90%,50%)] shadow-[0_0_8px_currentColor]',
  orange: 'bg-[hsl(25,85%,50%)] shadow-[0_0_8px_currentColor]',
  off: 'bg-[#262626]',
};

export default function LED({ color, pulse, className }: LEDProps) {
  return (
    <div 
      className={cn(
        "w-2 h-2 rounded-full transition-all",
        colorClasses[color],
        pulse && color !== 'off' && "animate-pulse",
        className
      )}
      data-testid={`led-${color}`}
    />
  );
}
