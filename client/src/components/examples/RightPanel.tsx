import RightPanel from '../RightPanel';
import { useState } from 'react';

export default function RightPanelExample() {
  const [loop, setLoop] = useState(false);
  const [metro, setMetro] = useState(true);

  return (
    <div className="p-8 bg-background">
      <RightPanel 
        loopEnabled={loop}
        metroEnabled={metro}
        tempo={120}
        onLoopClick={() => setLoop(!loop)}
        onMetroClick={() => setMetro(!metro)}
      />
    </div>
  );
}
