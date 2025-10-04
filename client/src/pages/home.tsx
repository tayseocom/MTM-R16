import { useState, useEffect } from 'react';
import LCDDisplay from '@/components/LCDDisplay';
import TransportControls from '@/components/TransportControls';
import TrackButton from '@/components/TrackButton';
import ControlGrid from '@/components/ControlGrid';
import RightPanel from '@/components/RightPanel';
import NumPad from '@/components/NumPad';
import PageButtons from '@/components/PageButtons';
import MIDIDeviceSelect from '@/components/MIDIDeviceSelect';
import { FAQDialog } from '@/components/FAQDialog';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { midiManager } from '@/lib/midi';
import { sequencerEngine } from '@/lib/sequencer-engine';
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
  const [midiReady, setMidiReady] = useState(false);
  const [midiEchoEnabled, setMidiEchoEnabled] = useState(false);
  const [clockMode, setClockMode] = useState<'off' | 'send' | 'receive'>('off');

  useEffect(() => {
    sequencerEngine.initialize().then((ready) => {
      setMidiReady(ready);
      updateDevices();
      setTempo(sequencerEngine.getProject().tempo);
      sequencerEngine.setMetronome(metroEnabled);
    });

    // Load from localStorage on mount
    const savedProject = localStorage.getItem('mtm-project');
    if (savedProject) {
      try {
        const project = JSON.parse(savedProject);
        sequencerEngine.loadProject(project);
        setTempo(project.tempo);
        setCurrentPart(project.currentPart + 1);
      } catch (err) {
        console.error('Failed to load saved project:', err);
      }
    }
  }, []);

  const updateDevices = () => {
    const inputs = midiManager.getInputs().map(d => ({ id: d.id || '', name: d.name || 'Unknown' }));
    const outputs = midiManager.getOutputs().map(d => ({ id: d.id || '', name: d.name || 'Unknown' }));
    setMidiDevices({ inputs, outputs });
  };

  const handleOutputChange = (deviceId: string) => {
    setSelectedOutput(deviceId);
    const output = midiManager.getOutputs().find(d => d.id === deviceId);
    sequencerEngine.setOutput(output || null);
  };

  // Auto-select first available output
  useEffect(() => {
    if (midiDevices.outputs.length > 0 && !selectedOutput) {
      const firstOutput = midiDevices.outputs[0];
      handleOutputChange(firstOutput.id);
    }
  }, [midiDevices.outputs]);

  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo);
    sequencerEngine.setTempo(newTempo);
    saveToLocalStorage();
  };

  const handlePlay = () => {
    if (!midiReady) {
      alert('Web MIDI not available. Please open in Chrome/Edge with MIDI devices connected.');
      return;
    }
    if (transportState === 'playing') {
      sequencerEngine.stop();
      setTransportState('stopped');
      setPlayingTracks([]);
    } else {
      sequencerEngine.startPlayback(selectedTracks);
      setTransportState('playing');
      setPlayingTracks([...selectedTracks]);
    }
  };

  const handleStop = () => {
    sequencerEngine.stop();
    setTransportState('stopped');
    setPlayingTracks([]);
    setArmedTracks([]);
  };

  const handleRecord = () => {
    if (!midiReady) {
      alert('Web MIDI not available. Please open in Chrome/Edge with MIDI devices connected.');
      return;
    }
    if (transportState === 'recording') {
      sequencerEngine.stopRecording();
      sequencerEngine.stop();
      setTransportState('stopped');
      setArmedTracks([]);
      // Save to localStorage after recording
      saveToLocalStorage();
    } else {
      setTransportState('countIn');
      setArmedTracks([...selectedTracks]);
      setTimeout(() => {
        sequencerEngine.startRecording(selectedTracks);
        setTransportState('recording');
      }, 2000);
    }
  };

  const handleTrackClick = (trackNum: number) => {
    if (editMode === 'merge' || editMode === 'copy') {
      handleTrackClickInEditMode(trackNum);
    } else {
      setSelectedTracks([trackNum]);
    }
  };

  const handleModeClick = (mode: EditMode) => {
    const newMode = editMode === mode ? 'none' : mode;
    setEditMode(newMode);
    
    // Execute mode-specific actions
    if (newMode === 'erase') {
      if (confirm('Erase all events from selected tracks?')) {
        selectedTracks.forEach(trackId => {
          const part = sequencerEngine.getCurrentPart();
          const track = part.tracks.find(t => t.id === trackId);
          if (track) track.events = [];
        });
        saveToLocalStorage();
        setEditMode('none');
      }
    }
  };

  const handleNumPadClick = (num: number) => {
    switch (editMode) {
      case 'quantize':
        // Quantize values: 1=1/4, 2=1/8, 3=1/16, 4=1/32
        const quantizeMap: Record<number, number> = { 0: 0, 1: 1/4, 2: 1/8, 3: 1/16, 4: 1/32 };
        sequencerEngine.setQuantize(quantizeMap[num] || 0);
        setEditMode('none');
        break;
      case 'part':
        setCurrentPart(num);
        sequencerEngine.getProject().currentPart = num - 1;
        saveToLocalStorage();
        setEditMode('none');
        break;
      case 'transpose':
        const semitones = num - 5; // -5 to +5 semitones
        selectedTracks.forEach(trackId => {
          sequencerEngine.transposeTrack(trackId, semitones);
        });
        saveToLocalStorage();
        setEditMode('none');
        break;
      case 'copy':
        if (num > 0 && num <= 9) {
          sequencerEngine.copyPart(currentPart, num);
          saveToLocalStorage();
          setEditMode('none');
        }
        break;
      default:
        console.log('Number clicked:', num);
    }
  };

  const handleTrackClickInEditMode = (trackNum: number) => {
    if (editMode === 'merge' && selectedTracks.length > 0) {
      sequencerEngine.mergeTracks(selectedTracks[0], trackNum);
      saveToLocalStorage();
      setEditMode('none');
    } else {
      handleTrackClick(trackNum);
    }
  };

  const getLCDText = () => {
    if (!midiReady) return 'NO MIDI - DEMO MODE';
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
    if (!midiReady) return 'OPEN IN CHROME/EDGE FOR MIDI';
    if (transportState === 'recording') return 'RECORDING...';
    if (transportState === 'countIn') return 'COUNT IN: 1...2...3...4...';
    if (transportState === 'playing') return 'PLAYING';
    if (editMode !== 'none') return 'USE NUMPAD OR TRACKS';
    return `TRACKS ${selectedTracks.join(', ')} SELECTED`;
  };

  const saveToLocalStorage = () => {
    const project = sequencerEngine.getProject();
    localStorage.setItem('mtm-project', JSON.stringify(project));
  };

  const handleSaveProject = () => {
    const project = sequencerEngine.getProject();
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
            sequencerEngine.loadProject(project);
            setTempo(project.tempo || 120);
            setCurrentPart((project.currentPart || 0) + 1);
            saveToLocalStorage();
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
          <div className="flex gap-2 items-center">
            <FAQDialog />
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
              onNumberClick={handleNumPadClick}
              onMinusClick={() => handleNumPadClick(0)}
            />
            <RightPanel 
              loopEnabled={loopEnabled}
              metroEnabled={metroEnabled}
              midiEchoEnabled={midiEchoEnabled}
              clockMode={clockMode}
              tempo={tempo}
              onLoopClick={() => setLoopEnabled(!loopEnabled)}
              onMetroClick={() => {
                const newMetroState = !metroEnabled;
                setMetroEnabled(newMetroState);
                sequencerEngine.setMetronome(newMetroState);
              }}
              onTempoClick={() => {
                const newTempo = prompt('Enter tempo (40-250 BPM):', tempo.toString());
                if (newTempo) {
                  const t = parseInt(newTempo);
                  if (t >= 40 && t <= 250) {
                    handleTempoChange(t);
                  }
                }
              }}
              onMidiEchoClick={() => {
                const newEchoState = !midiEchoEnabled;
                setMidiEchoEnabled(newEchoState);
                sequencerEngine.setMidiThru(newEchoState);
              }}
              onClockClick={() => {
                const modes: ('off' | 'send' | 'receive')[] = ['off', 'send', 'receive'];
                const currentIndex = modes.indexOf(clockMode);
                const nextMode = modes[(currentIndex + 1) % modes.length];
                setClockMode(nextMode);
                sequencerEngine.setClockMode(nextMode);
              }}
              onMidiFilterClick={() => console.log('MIDI Filter toggled')}
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
                onDeviceChange={handleOutputChange}
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
