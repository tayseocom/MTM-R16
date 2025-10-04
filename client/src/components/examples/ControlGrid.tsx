import ControlGrid from '../ControlGrid';
import { useState } from 'react';

export default function ControlGridExample() {
  const [mode, setMode] = useState('');

  return (
    <div className="p-8 bg-background">
      <ControlGrid 
        activeMode={mode}
        onQuantClick={() => setMode('quantize')}
        onLengthClick={() => setMode('length')}
        onPartClick={() => setMode('part')}
        onCopyClick={() => setMode('copy')}
        onNameClick={() => setMode('name')}
        onEditClick={() => setMode('edit')}
        onTransClick={() => setMode('transpose')}
        onMergeClick={() => setMode('merge')}
        onSongClick={() => setMode('song')}
        onEraseClick={() => setMode('erase')}
        onLoadSaveClick={() => setMode('load')}
        onMidiChanClick={() => setMode('midi_chan')}
      />
    </div>
  );
}
