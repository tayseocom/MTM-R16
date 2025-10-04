import { cn } from "@/lib/utils";

interface NumPadProps {
  onNumberClick?: (num: number) => void;
  onMinusClick?: () => void;
  className?: string;
}

export default function NumPad({ onNumberClick, onMinusClick, className }: NumPadProps) {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  return (
    <div className={cn("grid grid-cols-5 gap-1", className)}>
      {numbers.map((num) => (
        <button
          key={num}
          onClick={() => onNumberClick?.(num)}
          className="flex items-center justify-center p-2 rounded-md bg-card border hover-elevate active-elevate-2 transition-all min-h-[2.5rem]"
          data-testid={`numpad-${num}`}
        >
          <span className="text-sm font-bold text-foreground">{num}</span>
        </button>
      ))}
      <button
        onClick={onMinusClick}
        className="flex items-center justify-center p-2 rounded-md bg-card border hover-elevate active-elevate-2 transition-all min-h-[2.5rem]"
        data-testid="numpad-minus"
      >
        <span className="text-sm font-bold text-foreground">-</span>
      </button>
    </div>
  );
}
