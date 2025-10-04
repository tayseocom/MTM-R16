import { useState, useEffect } from 'react';
import LCDDisplay from '@/components/LCDDisplay';
import TransportControls from '@/components/TransportControls';
import TrackButton from '@/components/TrackButton';
import ControlGrid from '@/components/ControlGrid';
import RightPanel from '@/components/RightPanel';
import NumPad from '@/components/NumPad';
import PageButtons from '@/components/PageButtons';
import MIDIDeviceSelect from '@/components/MIDIDeviceSelect';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { midiManager } from '@/lib/midi';
import type { TransportState, EditMode, Project } from '@shared/schema';

export default function Home() {
  const [transportState, setTransportState] = useState<TransportState>('stopped');
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [selectedTracks, setSelectedTracks] = useState<number[]>([1]);
  const [armedTracks, setArmedTracks] = useState<number[]>([]);
  const [playingTracks, setPlayingTracks] = useState<number[]>([]);
  const [mutedTracks, setMutedTracks] = useState<number[]>([]);
  const [tempo, setTempo] = useState(120);
  const [currentPart, setCurrentPart] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [metroEnabled, setMetroEnabled] = useState(true);
  const [midiDevices, setMidiDevices] = useState<{ inputs: any[], outputs: any[] }>({ inputs: [], outputs: [] });
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');

  useEffect(() => {
    midiManager.initialize().then(() => {
      updateDevices();
    });
  }, []);

  const updateDevices = () => {
    const inputs = midiManager.getInputs().map(d => ({ id: d.id || '', name: d.name || 'Unknown' }));
    const outputs = midiManager.getOutputs().map(d => ({ id: d.id || '', name: d.name || 'Unknown' }));
    setMidiDevices({ inputs, outputs });
  };

  const handlePlay = () => {
    console.log('Play triggered');
    setTransportState(transportState === 'playing' ? 'stopped' : 'playing');
    if (transportState !== 'playing') {
      setPlayingTracks([...selectedTracks]);
    } else {
      setPlayingTracks([]);
    }
  };

  const handleStop = () => {
    console.log('Stop triggered');
    setTransportState('stopped');
    setPlayingTracks([]);
    midiManager.allNotesOff();
  };

  const handleRecord = () => {
    console.log('Record triggered');
    if (transportState === 'recording') {
      setTransportState('stopped');
      setArmedTracks([]);
    } else {
      setTransportState('countIn');
      setArmedTracks([...selectedTracks]);
      setTimeout(() => {
        setTransportState('recording');
      }, 2000);
    }
  };

  const handleTrackClick = (trackNum: number) => {
    setSelectedTracks([trackNum]);
  };

  const handleModeClick = (mode: EditMode) => {
    setEditMode(editMode === mode ? 'none' : mode);
  };

  const getLCDText = () => {
    if (editMode === 'quantize') return 'QUANTIZE: SELECT VALUE';
    if (editMode === 'length') return 'LENGTH: ENTER BARS';
    if (editMode === 'part') return 'PART: SELECT NUMBER';
    if (editMode === 'copy') return 'COPY: SELECT DESTINATION';
    if (editMode === 'merge') return 'MERGE: SELECT TRACKS';
    if (editMode === 'erase') return 'ERASE: CONFIRM?';
    if (editMode === 'transpose') return 'TRANSPOSE: SEMITONES';
    if (editMode === 'song') return 'SONG MODE: BUILD CHAIN';
    if (editMode === 'load') return 'LOAD: SELECT FILE';
    if (editMode === 'save') return 'SAVE: ENTER NAME';
    if (editMode === 'midi_chan') return 'MIDI CHAN: SELECT TRACK';
    return `PART ${currentPart.toString().padStart(2, '0')}  ${tempo} BPM`;
  };

  const getLCDSubText = () => {
    if (transportState === 'recording') return 'RECORDING...';
    if (transportState === 'countIn') return 'COUNT IN: 1...2...3...4...';
    if (transportState === 'playing') return 'PLAYING';
    if (editMode !== 'none') return 'USE NUMPAD OR TRACKS';
    return `TRACKS ${selectedTracks.join(', ')} SELECTED`;
  };

  const handleSaveProject = () => {
    const project: Project = {
      name: 'Untitled',
      tempo,
      parts: [],
      songs: [],
      currentPart,
      currentSong: null,
    };
    
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtm-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const project = JSON.parse(e.target?.result as string);
            setTempo(project.tempo || 120);
            setCurrentPart(project.currentPart || 1);
            console.log('Project loaded:', project);
          } catch (err) {
            console.error('Failed to load project:', err);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary font-mono tracking-wider" data-testid="title">
              Multi Track MIDI Recorder
            </h1>
            <h2 className="text-4xl font-bold text-primary font-mono" data-testid="model">MTM-R16</h2>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleLoadProject}
              data-testid="button-load"
            >
              <Upload className="w-4 h-4 mr-2" />
              Load
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSaveProject}
              data-testid="button-save"
            >
              <Download className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* Main Panel */}
        <div className="bg-card border-2 border-border rounded-lg p-6 space-y-6">
          {/* LCD Display and Controls Row */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4 items-start">
            <LCDDisplay 
              mainText={getLCDText()}
              subText={getLCDSubText()}
            />
            <NumPad 
              onNumberClick={(num) => console.log('Number clicked:', num)}
              onMinusClick={() => console.log('Minus clicked')}
            />
            <RightPanel 
              loopEnabled={loopEnabled}
              metroEnabled={metroEnabled}
              tempo={tempo}
              onLoopClick={() => setLoopEnabled(!loopEnabled)}
              onMetroClick={() => setMetroEnabled(!metroEnabled)}
              onTempoClick={() => handleModeClick('length')}
            />
          </div>

          {/* Transport Controls */}
          <div className="flex justify-center">
            <TransportControls 
              transportState={transportState}
              onPlay={handlePlay}
              onStop={handleStop}
              onRecord={handleRecord}
              onRewind={() => console.log('Rewind')}
              onForward={() => console.log('Forward')}
            />
          </div>

          {/* Track Grid */}
          <div>
            <div className="grid grid-cols-8 gap-1 mb-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <TrackButton 
                  key={num}
                  trackNumber={num}
                  selected={selectedTracks.includes(num)}
                  armed={armedTracks.includes(num)}
                  playing={playingTracks.includes(num)}
                  muted={mutedTracks.includes(num)}
                  onClick={() => handleTrackClick(num)}
                />
              ))}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {[9, 10, 11, 12, 13, 14, 15, 16].map((num) => (
                <TrackButton 
                  key={num}
                  trackNumber={num}
                  selected={selectedTracks.includes(num)}
                  armed={armedTracks.includes(num)}
                  playing={playingTracks.includes(num)}
                  muted={mutedTracks.includes(num)}
                  onClick={() => handleTrackClick(num)}
                />
              ))}
            </div>
          </div>

          {/* Control Grid and Page Buttons */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
            <ControlGrid 
              activeMode={editMode}
              onQuantClick={() => handleModeClick('quantize')}
              onLengthClick={() => handleModeClick('length')}
              onPartClick={() => handleModeClick('part')}
              onCopyClick={() => handleModeClick('copy')}
              onNameClick={() => handleModeClick('name')}
              onEditClick={() => handleModeClick('edit')}
              onTransClick={() => handleModeClick('transpose')}
              onMergeClick={() => handleModeClick('merge')}
              onSongClick={() => handleModeClick('song')}
              onEraseClick={() => handleModeClick('erase')}
              onLoadSaveClick={() => handleModeClick('load')}
              onMidiChanClick={() => handleModeClick('midi_chan')}
            />
            <PageButtons 
              onPageDown={() => console.log('Page Down')}
              onPageUp={() => console.log('Page Up')}
            />
          </div>
        </div>

        {/* MIDI Device Selection */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">MIDI DEVICES</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">INPUT</label>
              <MIDIDeviceSelect 
                devices={midiDevices.inputs}
                selectedDevice={selectedInput}
                onDeviceChange={setSelectedInput}
                type="input"
                connected={!!selectedInput}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">OUTPUT</label>
              <MIDIDeviceSelect 
                devices={midiDevices.outputs}
                selectedDevice={selectedOutput}
                onDeviceChange={setSelectedOutput}
                type="output"
                connected={!!selectedOutput}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
