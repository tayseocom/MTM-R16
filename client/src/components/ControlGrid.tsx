import HardwareButton from './HardwareButton';

interface ControlGridProps {
  onQuantClick?: () => void;
  onLengthClick?: () => void;
  onPartClick?: () => void;
  onCopyClick?: () => void;
  onNameClick?: () => void;
  onEditClick?: () => void;
  onTransClick?: () => void;
  onMergeClick?: () => void;
  onSongClick?: () => void;
  onEraseClick?: () => void;
  onLoadSaveClick?: () => void;
  onMidiChanClick?: () => void;
  activeMode?: string;
}

export default function ControlGrid({ 
  onQuantClick,
  onLengthClick,
  onPartClick,
  onCopyClick,
  onNameClick,
  onEditClick,
  onTransClick,
  onMergeClick,
  onSongClick,
  onEraseClick,
  onLoadSaveClick,
  onMidiChanClick,
  activeMode
}: ControlGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <HardwareButton 
        label="QUANT" 
        onClick={onQuantClick}
        active={activeMode === 'quantize'}
      />
      <HardwareButton 
        label="LENGTH" 
        onClick={onLengthClick}
        active={activeMode === 'length'}
      />
      <HardwareButton 
        label="PART" 
        onClick={onPartClick}
        active={activeMode === 'part'}
      />
      <HardwareButton 
        label="COPY" 
        onClick={onCopyClick}
        active={activeMode === 'copy'}
      />
      <HardwareButton 
        label="NAME" 
        onClick={onNameClick}
        active={activeMode === 'name'}
      />
      <HardwareButton 
        label="EDIT" 
        onClick={onEditClick}
        active={activeMode === 'edit'}
      />
      <HardwareButton 
        label="TRANS" 
        onClick={onTransClick}
        active={activeMode === 'transpose'}
      />
      <HardwareButton 
        label="MERGE" 
        onClick={onMergeClick}
        active={activeMode === 'merge'}
      />
      <HardwareButton 
        label="SONG" 
        onClick={onSongClick}
        active={activeMode === 'song'}
      />
      <HardwareButton 
        label="ERASE" 
        onClick={onEraseClick}
        active={activeMode === 'erase'}
      />
      <HardwareButton 
        label="LOAD/ SAVE" 
        onClick={onLoadSaveClick}
        active={activeMode === 'load' || activeMode === 'save'}
      />
      <HardwareButton 
        label="MIDI CHAN" 
        onClick={onMidiChanClick}
        active={activeMode === 'midi_chan'}
      />
    </div>
  );
}
