import MIDIDeviceSelect from '../MIDIDeviceSelect';

export default function MIDIDeviceSelectExample() {
  const devices = [
    { id: '1', name: 'USB MIDI Device' },
    { id: '2', name: 'Virtual MIDI Bus' },
  ];

  return (
    <div className="p-8 bg-background space-y-4 max-w-md">
      <MIDIDeviceSelect 
        devices={devices}
        type="input"
        connected
      />
      <MIDIDeviceSelect 
        devices={devices}
        type="output"
      />
    </div>
  );
}
