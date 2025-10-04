import HardwareButton from './HardwareButton';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PageButtonsProps {
  onPageDown?: () => void;
  onPageUp?: () => void;
}

export default function PageButtons({ onPageDown, onPageUp }: PageButtonsProps) {
  return (
    <div className="flex gap-2">
      <HardwareButton 
        label="PAGE DOWN" 
        icon={<ChevronDown className="w-4 h-4" />}
        onClick={onPageDown}
        dataTestId="button-page-down"
      />
      <HardwareButton 
        label="PAGE Up" 
        icon={<ChevronUp className="w-4 h-4" />}
        onClick={onPageUp}
        dataTestId="button-page-up"
      />
    </div>
  );
}
