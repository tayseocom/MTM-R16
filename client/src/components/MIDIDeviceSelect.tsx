import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LED from "./LED";

interface MIDIDeviceSelectProps {
  devices: { id: string; name: string }[];
  selectedDevice?: string;
  onDeviceChange?: (deviceId: string) => void;
  type: 'input' | 'output';
  connected?: boolean;
}

export default function MIDIDeviceSelect({ 
  devices, 
  selectedDevice, 
  onDeviceChange,
  type,
  connected = false
}: MIDIDeviceSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <LED color={connected ? 'green' : 'off'} />
      <Select value={selectedDevice} onValueChange={onDeviceChange}>
        <SelectTrigger className="w-full bg-card" data-testid={`midi-${type}-select`}>
          <SelectValue placeholder={`Select ${type} device`} />
        </SelectTrigger>
        <SelectContent>
          {devices.length === 0 ? (
            <SelectItem value="none" disabled>No devices available</SelectItem>
          ) : (
            devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
