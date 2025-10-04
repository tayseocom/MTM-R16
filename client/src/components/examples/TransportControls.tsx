import TransportControls from '../TransportControls';
import { useState } from 'react';

export default function TransportControlsExample() {
  const [state, setState] = useState<'stopped' | 'playing' | 'recording' | 'countIn'>('stopped');

  return (
    <div className="p-8 bg-background">
      <TransportControls 
        transportState={state}
        onPlay={() => setState('playing')}
        onStop={() => setState('stopped')}
        onRecord={() => setState('recording')}
        onRewind={() => console.log('Rewind')}
        onForward={() => console.log('Forward')}
      />
    </div>
  );
}
