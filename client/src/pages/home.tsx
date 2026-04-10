import { useState, useEffect, useCallback } from 'react';
import LCDDisplay from '@/components/LCDDisplay';
import TransportControls from '@/components/TransportControls';
import TrackButton from '@/components/TrackButton';
import ControlGrid from '@/components/ControlGrid';
import RightPanel from '@/components/RightPanel';
import NumPad from '@/components/NumPad';
import MIDIDeviceSelect from '@/components/MIDIDeviceSelect';
import { FAQDialog } from '@/components/FAQDialog';
import PianoRollDialog from '@/components/PianoRollDialog';
import SongModeDialog from '@/components/SongModeDialog';
import { Download, Upload, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { midiManager } from '@/lib/midi';
import { sequencerEngine } from '@/lib/sequencer-engine';
import { songPlayer } from '@/lib/song-player';
import { undoManager, cloneEvents } from '@/lib/undo-manager';
import type { TransportState, EditMode, Project, MIDIEvent } from '@shared/schema';

export default function Home() {
  const [transportState, setTransportState] = useState<TransportState>('stopped');
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [selectedTracks, setSelectedTracks] = useState<number[]>([1]);
  const [primaryTrack, setPrimaryTrack] = useState<number>(1); // Last clicked track for recording
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
  const [pianoRollOpen, setPianoRollOpen] = useState(false);
  const [songModeOpen, setSongModeOpen] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [liveNotes, setLiveNotes] = useState<Map<number, { velocity: number; timestamp: number }>>(new Map());
  const [currentSong, setCurrentSong] = useState<string | null>(null);
  const [project, setProject] = useState<Project>(sequencerEngine.getProject());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [lcdOverride, setLcdOverride] = useState<string | null>(null);

  const showLcdMessage = useCallback((msg: string) => {
    setLcdOverride(msg);
    setTimeout(() => setLcdOverride(null), 1500);
  }, []);

  const handleUndo = useCallback(() => {
    const label = undoManager.undo();
    if (label) {
      setProject(structuredClone(sequencerEngine.getProject()));
      saveToLocalStorage();
      showLcdMessage(`UNDO: ${label}`);
    }
  }, [showLcdMessage]);

  const handleRedo = useCallback(() => {
    const label = undoManager.redo();
    if (label) {
      setProject(structuredClone(sequencerEngine.getProject()));
      saveToLocalStorage();
      showLcdMessage(`REDO: ${label}`);
    }
  }, [showLcdMessage]);

  useEffect(() => {
    sequencerEngine.initialize().then((ready) => {
      setMidiReady(ready);
      updateDevices();
      setTempo(sequencerEngine.getProject().tempo);
      sequencerEngine.setMetronome(metroEnabled);
    });

    // Set up MIDI input listener for live notes visualization
    const unsubscribeMidi = sequencerEngine.onMIDIInput((event) => {
      if (!event.data) return;
      const status = event.data[0];
      const note = event.data[1];
      const velocity = event.data[2];
      const command = status & 0xF0;

      if (command === 0x90 && velocity > 0) {
        // Note On
        setLiveNotes(prev => {
          const next = new Map(prev);
          next.set(note, { velocity, timestamp: Date.now() });
          return next;
        });
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        // Note Off
        setLiveNotes(prev => {
          const next = new Map(prev);
          next.delete(note);
          return next;
        });
      }
    });

    // Load from localStorage on mount
    const savedProject = localStorage.getItem('mtm-project');
    if (savedProject) {
      try {
        const loadedProject = JSON.parse(savedProject);
        sequencerEngine.loadProject(loadedProject);
        setProject(loadedProject);
        setTempo(loadedProject.tempo);
        setCurrentPart(loadedProject.currentPart + 1);
        setCurrentSong(loadedProject.currentSong || null);
        undoManager.clear();
      } catch (err) {
        console.error('Failed to load saved project:', err);
      }
    }

    // Register part boundary listener for song mode
    const unsubscribe = sequencerEngine.onPartBoundary(() => {
      songPlayer.onPartBoundary();
    });

    // Poll for current position during playback
    const positionInterval = setInterval(() => {
      setCurrentPosition(sequencerEngine.getCurrentTick());
    }, 50);

    const unsubscribeUndo = undoManager.onChange(() => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    });

    return () => {
      clearInterval(positionInterval);
      unsubscribe();
      unsubscribeMidi();
      unsubscribeUndo();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

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

  // Poll for playback progress only when playing/recording
  useEffect(() => {
    if (transportState === 'playing' || transportState === 'recording') {
      const progressInterval = setInterval(() => {
        setPlaybackProgress(sequencerEngine.getPlaybackProgress());
      }, 50);
      return () => clearInterval(progressInterval);
    } else {
      setPlaybackProgress(0); // Reset when stopped
    }
  }, [transportState]);

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
      if (currentSong) {
        songPlayer.stop();
      }
      sequencerEngine.stop();
      setTransportState('stopped');
      setPlayingTracks([]);
    } else {
      if (currentSong) {
        // Song mode: play the current song
        songPlayer.play(currentSong);
        setTransportState('playing');
        // In song mode, all tracks from the active part are potentially playing
        const project = sequencerEngine.getProject();
        const currentPartIndex = project.currentPart;
        if (currentPartIndex >= 0 && currentPartIndex < project.parts.length) {
          const allTracks = Array.from({ length: 16 }, (_, i) => i + 1);
          setPlayingTracks(allTracks);
        }
      } else {
        // Part mode: play selected tracks
        sequencerEngine.startPlayback(selectedTracks);
        setTransportState('playing');
        setPlayingTracks([...selectedTracks]);
      }
    }
  };

  const handleStop = () => {
    if (currentSong) {
      songPlayer.stop();
    }
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
      const part = sequencerEngine.getCurrentPart();
      const partId = part.id;
      const recordingTrackIds = armedTracks.length > 0 ? armedTracks : [primaryTrack];
      const snapshots = recordingTrackIds.map(tid => {
        const track = part.tracks.find(t => t.id === tid);
        return { trackId: tid, eventsBefore: track ? cloneEvents(track.events) : [] };
      });

      sequencerEngine.stopRecording();

      const snapshotsAfter = recordingTrackIds.map(tid => {
        const track = part.tracks.find(t => t.id === tid);
        return { trackId: tid, eventsAfter: track ? cloneEvents(track.events) : [] };
      });

      const trackLabel = recordingTrackIds.length === 1 ? `TRK ${recordingTrackIds[0]}` : `${recordingTrackIds.length} TRKS`;
      undoManager.executeCommand({
        label: `RECORD ${trackLabel}`,
        execute: () => {
          const p = sequencerEngine.getPartById(partId);
          if (!p) return;
          snapshotsAfter.forEach(({ trackId, eventsAfter }) => {
            const t = p.tracks.find(tr => tr.id === trackId);
            if (t) t.events = cloneEvents(eventsAfter);
          });
        },
        undo: () => {
          const p = sequencerEngine.getPartById(partId);
          if (!p) return;
          snapshots.forEach(({ trackId, eventsBefore }) => {
            const t = p.tracks.find(tr => tr.id === trackId);
            if (t) t.events = cloneEvents(eventsBefore);
          });
        },
      });

      setTransportState('playing');
      setArmedTracks([]);
      saveToLocalStorage();
    } else if (transportState === 'playing') {
      // Punch-in: record to primary track only, all selected tracks continue playing
      sequencerEngine.startRecording([primaryTrack], true);
      setTransportState('recording');
      setArmedTracks([primaryTrack]);
    } else {
      // Fresh recording: count-in then record to primary track, all selected tracks play
      setTransportState('countIn');
      setArmedTracks([primaryTrack]);
      setTimeout(() => {
        sequencerEngine.startRecording([primaryTrack], false);
        setTransportState('recording');
      }, 2000);
    }
  };

  const handleTrackClick = (trackNum: number, shiftKey: boolean = false) => {
    if (editMode === 'merge' || editMode === 'copy') {
      handleTrackClickInEditMode(trackNum);
    } else {
      if (shiftKey) {
        // Multi-select: toggle track in selection
        setSelectedTracks(prev => {
          if (prev.includes(trackNum)) {
            // Removing track: prevent removing the last track
            if (prev.length === 1) {
              return prev; // Keep at least one track selected
            }
            const newSelection = prev.filter(t => t !== trackNum);
            // Update primary track if we're removing it
            if (primaryTrack === trackNum) {
              setPrimaryTrack(newSelection[0]); // Set to first remaining track
            }
            
            // If playing, update playing tracks too
            if (transportState === 'playing' || transportState === 'recording') {
              setPlayingTracks(newSelection);
              sequencerEngine.updatePlayingTracks(newSelection);
            }
            
            return newSelection;
          } else {
            // Adding track: set as new primary
            setPrimaryTrack(trackNum);
            const newSelection = [...prev, trackNum].sort((a, b) => a - b);
            
            // If playing, update playing tracks too
            if (transportState === 'playing' || transportState === 'recording') {
              setPlayingTracks(newSelection);
              sequencerEngine.updatePlayingTracks(newSelection);
            }
            
            return newSelection;
          }
        });
      } else {
        // Single select: replace selection and set as primary
        setPrimaryTrack(trackNum);
        setSelectedTracks([trackNum]);
        
        // If playing, update playing tracks too
        if (transportState === 'playing' || transportState === 'recording') {
          setPlayingTracks([trackNum]);
          sequencerEngine.updatePlayingTracks([trackNum]);
        }
      }
    }
  };

  const handleModeClick = (mode: EditMode) => {
    if (mode === 'edit') {
      setPianoRollOpen(true);
      return;
    }
    
    if (mode === 'song') {
      setSongModeOpen(true);
      return;
    }

    if (mode === 'length') {
      const part = sequencerEngine.getCurrentPart();
      const newLength = prompt(`Enter part length (1-64 bars):`, part.length.toString());
      if (newLength) {
        const lengthBars = parseInt(newLength);
        if (!isNaN(lengthBars) && lengthBars >= 1 && lengthBars <= 64) {
          const oldLength = part.length;
          undoManager.executeCommand({
            label: `LENGTH P${part.id} ${oldLength}->${lengthBars}`,
            execute: () => {
              sequencerEngine.setPartLength(part.id, lengthBars);
            },
            undo: () => {
              sequencerEngine.setPartLength(part.id, oldLength);
            },
          });
          setProject(structuredClone(sequencerEngine.getProject()));
          saveToLocalStorage();
        } else {
          alert('Invalid length. Please enter a number between 1 and 64.');
        }
      }
      return;
    }

    const newMode = editMode === mode ? 'none' : mode;
    setEditMode(newMode);
    
    if (newMode === 'erase') {
      const eraseAll = selectedTracks.length === 0 || selectedTracks.length === 16;
      const eraseMsg = eraseAll
        ? 'Erase ALL tracks in this part?'
        : `Erase events from selected track${selectedTracks.length > 1 ? 's' : ''}?`;
      if (confirm(eraseMsg)) {
        const part = sequencerEngine.getCurrentPart();
        const partId = part.id;
        if (eraseAll) {
          const allSnapshots = part.tracks.map(t => ({
            trackId: t.id,
            eventsBefore: cloneEvents(t.events),
          }));
          undoManager.executeCommand({
            label: `ERASE PART ${partId}`,
            execute: () => {
              const p = sequencerEngine.getPartById(partId);
              if (!p) return;
              p.tracks.forEach(t => { t.events = []; });
            },
            undo: () => {
              const p = sequencerEngine.getPartById(partId);
              if (!p) return;
              allSnapshots.forEach(({ trackId, eventsBefore }) => {
                const t = p.tracks.find(tr => tr.id === trackId);
                if (t) t.events = cloneEvents(eventsBefore);
              });
            },
          });
        } else {
          const snapshots = selectedTracks.map(trackId => {
            const track = part.tracks.find(t => t.id === trackId);
            return { trackId, eventsBefore: track ? cloneEvents(track.events) : [] };
          });
          const trackLabel = selectedTracks.length === 1 ? `TRK ${selectedTracks[0]}` : `${selectedTracks.length} TRKS`;
          undoManager.executeCommand({
            label: `ERASE ${trackLabel}`,
            execute: () => {
              const p = sequencerEngine.getPartById(partId);
              if (!p) return;
              snapshots.forEach(({ trackId }) => {
                const t = p.tracks.find(tr => tr.id === trackId);
                if (t) t.events = [];
              });
            },
            undo: () => {
              const p = sequencerEngine.getPartById(partId);
              if (!p) return;
              snapshots.forEach(({ trackId, eventsBefore }) => {
                const t = p.tracks.find(tr => tr.id === trackId);
                if (t) t.events = cloneEvents(eventsBefore);
              });
            },
          });
        }
        setProject(structuredClone(sequencerEngine.getProject()));
        saveToLocalStorage();
        setEditMode('none');
      }
    }
  };

  const handleNumPadClick = (num: number) => {
    switch (editMode) {
      case 'quantize': {
        const quantizeMap: Record<number, number> = { 0: 0, 1: 1/4, 2: 1/8, 3: 1/16, 4: 1/32 };
        const qVal = quantizeMap[num] || 0;
        sequencerEngine.setQuantize(qVal);
        if (qVal > 0 && selectedTracks.length > 0) {
          const part = sequencerEngine.getCurrentPart();
          const partId = part.id;
          const tracksWithEvents = selectedTracks.filter(tid => {
            const t = part.tracks.find(tr => tr.id === tid);
            return t && t.events.length > 0;
          });
          if (tracksWithEvents.length > 0) {
            const qSnapshots = tracksWithEvents.map(tid => {
              const t = part.tracks.find(tr => tr.id === tid)!;
              return { trackId: tid, eventsBefore: cloneEvents(t.events) };
            });
            tracksWithEvents.forEach(tid => sequencerEngine.quantizeTrackEvents(tid, qVal));
            const qSnapshotsAfter = tracksWithEvents.map(tid => {
              const t = part.tracks.find(tr => tr.id === tid)!;
              return { trackId: tid, eventsAfter: cloneEvents(t.events) };
            });
            const qNames: Record<number, string> = { 0.25: '1/4', 0.125: '1/8', 0.0625: '1/16', 0.03125: '1/32' };
            const qLabel = tracksWithEvents.length === 1 ? `TRK ${tracksWithEvents[0]}` : `${tracksWithEvents.length} TRKS`;
            undoManager.executeCommand({
              label: `QUANTIZE ${qNames[qVal] || qVal} ${qLabel}`,
              execute: () => {
                const p = sequencerEngine.getPartById(partId);
                if (!p) return;
                qSnapshotsAfter.forEach(({ trackId, eventsAfter }) => {
                  const t = p.tracks.find(tr => tr.id === trackId);
                  if (t) t.events = cloneEvents(eventsAfter);
                });
              },
              undo: () => {
                const p = sequencerEngine.getPartById(partId);
                if (!p) return;
                qSnapshots.forEach(({ trackId, eventsBefore }) => {
                  const t = p.tracks.find(tr => tr.id === trackId);
                  if (t) t.events = cloneEvents(eventsBefore);
                });
              },
            });
            setProject(structuredClone(sequencerEngine.getProject()));
            saveToLocalStorage();
          }
        }
        setEditMode('none');
        break;
      }
      case 'part':
        if (num >= 1 && num <= 9) {
          // Ensure the part exists in the sequencer engine
          sequencerEngine.ensurePartExists(num - 1);
          // Update current part in the engine
          sequencerEngine.getProject().currentPart = num - 1;
          // Sync React state with engine's canonical project
          setProject(structuredClone(sequencerEngine.getProject()));
          setCurrentPart(num);
          saveToLocalStorage();
          setEditMode('none');
        }
        break;
      case 'transpose': {
        const semitones = num - 5;
        const part = sequencerEngine.getCurrentPart();
        const partId = part.id;
        const transSnapshots = selectedTracks.map(trackId => {
          const track = part.tracks.find(t => t.id === trackId);
          return { trackId, eventsBefore: track ? cloneEvents(track.events) : [] };
        });
        selectedTracks.forEach(trackId => {
          sequencerEngine.transposeTrack(trackId, semitones);
        });
        const transSnapshotsAfter = selectedTracks.map(trackId => {
          const track = part.tracks.find(t => t.id === trackId);
          return { trackId, eventsAfter: track ? cloneEvents(track.events) : [] };
        });
        const sign = semitones >= 0 ? '+' : '';
        const transLabel = selectedTracks.length === 1 ? `TRK ${selectedTracks[0]}` : `${selectedTracks.length} TRKS`;
        undoManager.executeCommand({
          label: `TRANSPOSE ${sign}${semitones} ${transLabel}`,
          execute: () => {
            const p = sequencerEngine.getPartById(partId);
            if (!p) return;
            transSnapshotsAfter.forEach(({ trackId, eventsAfter }) => {
              const t = p.tracks.find(tr => tr.id === trackId);
              if (t) t.events = cloneEvents(eventsAfter);
            });
          },
          undo: () => {
            const p = sequencerEngine.getPartById(partId);
            if (!p) return;
            transSnapshots.forEach(({ trackId, eventsBefore }) => {
              const t = p.tracks.find(tr => tr.id === trackId);
              if (t) t.events = cloneEvents(eventsBefore);
            });
          },
        });
        setProject(structuredClone(sequencerEngine.getProject()));
        saveToLocalStorage();
        setEditMode('none');
        break;
      }
      case 'copy': {
        if (num > 0 && num <= 9) {
          const proj = sequencerEngine.getProject();
          const destExisted = num - 1 < proj.parts.length;
          const destBefore = destExisted ? JSON.parse(JSON.stringify(proj.parts[num - 1])) : null;
          const partsCountBefore = proj.parts.length;
          const srcPart = proj.parts.find(p => p.id === currentPart);
          const srcClone = srcPart ? JSON.parse(JSON.stringify(srcPart)) : null;
          
          undoManager.executeCommand({
            label: `COPY P${currentPart}->P${num}`,
            execute: () => {
              const p = sequencerEngine.getProject();
              sequencerEngine.ensurePartExists(num - 1);
              if (srcClone) {
                const copy = JSON.parse(JSON.stringify(srcClone));
                copy.id = num;
                copy.name = `Part ${num}`;
                p.parts[num - 1] = copy;
              }
            },
            undo: () => {
              const p = sequencerEngine.getProject();
              if (destExisted && destBefore) {
                p.parts[num - 1] = JSON.parse(JSON.stringify(destBefore));
              } else {
                p.parts.length = partsCountBefore;
              }
            },
          });
          setProject(structuredClone(sequencerEngine.getProject()));
          saveToLocalStorage();
          setEditMode('none');
        }
        break;
      }
      default:
        console.log('Number clicked:', num);
    }
  };

  const handleTrackClickInEditMode = (trackNum: number) => {
    if (editMode === 'merge' && selectedTracks.length > 0) {
      const part = sequencerEngine.getCurrentPart();
      const partId = part.id;
      const destTrack = part.tracks.find(t => t.id === trackNum);
      const destBefore = destTrack ? cloneEvents(destTrack.events) : [];
      const sourceId = selectedTracks[0];

      sequencerEngine.mergeTracks(sourceId, trackNum);
      const destAfter = destTrack ? cloneEvents(destTrack.events) : [];

      undoManager.executeCommand({
        label: `MERGE TRK ${sourceId}->TRK ${trackNum}`,
        execute: () => {
          const p = sequencerEngine.getPartById(partId);
          if (!p) return;
          const t = p.tracks.find(tr => tr.id === trackNum);
          if (t) t.events = cloneEvents(destAfter);
        },
        undo: () => {
          const p = sequencerEngine.getPartById(partId);
          if (!p) return;
          const t = p.tracks.find(tr => tr.id === trackNum);
          if (t) t.events = cloneEvents(destBefore);
        },
      });
      setProject(structuredClone(sequencerEngine.getProject()));
      saveToLocalStorage();
      setEditMode('none');
    } else {
      handleTrackClick(trackNum);
    }
  };

  const getLCDText = () => {
    // Check editMode first (before MIDI status) so modes work even in demo mode
    if (editMode === 'quantize') return 'QUANTIZE: 0=OFF 1-4=VAL';
    if (editMode === 'part') return 'PART: SELECT 1-9';
    if (editMode === 'copy') return 'COPY: SELECT DEST 1-9';
    if (editMode === 'transpose') return 'TRANSPOSE: 5=0 1-9';
    if (editMode === 'merge') return 'MERGE: SELECT TRACKS';
    if (editMode === 'erase') return 'ERASE: CONFIRM?';
    if (editMode === 'song') return 'SONG MODE: BUILD CHAIN';
    if (editMode === 'load') return 'LOAD: SELECT FILE';
    if (editMode === 'save') return 'SAVE: ENTER NAME';
    if (editMode === 'midi_chan') return 'MIDI CHAN: SELECT TRACK';
    
    if (!midiReady) return 'NO MIDI - DEMO MODE';
    
    const part = sequencerEngine.getCurrentPart();
    const partInfo = `PART ${currentPart.toString().padStart(2, '0')} (${part.length} BARS)`;
    
    if (currentSong && transportState === 'playing') {
      const song = project.songs.find(s => s.id === currentSong);
      return song ? `SONG: ${song.name}  ${tempo} BPM` : `${partInfo}  ${tempo} BPM`;
    }
    
    return `${partInfo}  ${tempo} BPM`;
  };

  const getLCDSubText = () => {
    if (lcdOverride) return lcdOverride;
    if (transportState === 'recording') {
      const trackList = armedTracks.length > 0 ? armedTracks.join(',') : selectedTracks.join(',');
      return `RECORDING TRK ${trackList}`;
    }
    if (transportState === 'countIn') return 'COUNT IN: 1...2...3...4...';
    
    if (transportState === 'playing' && currentSong) {
      const activeSong = songPlayer.getSong();
      if (activeSong) {
        const stepNum = songPlayer.getCurrentStepIndex() + 1;
        const totalSteps = activeSong.steps.length;
        return `SONG STEP ${stepNum}/${totalSteps}`;
      }
    }
    
    if (transportState === 'playing') return 'PLAYING';
    
    if (editMode === 'quantize' || editMode === 'part' || editMode === 'transpose' || editMode === 'copy') {
      return 'USE NUMPAD OR PROMPT';
    }
    if (editMode !== 'none') return 'PRESS BUTTON OR TRACK';
    
    if (!midiReady) return 'OPEN IN CHROME/EDGE FOR MIDI';
    
    const part = sequencerEngine.getCurrentPart();
    const recordedTracks = part.tracks.filter(t => t.events.length > 0).length;
    if (recordedTracks === 0) return 'NO TRACKS RECORDED';
    return `${recordedTracks} TRACK${recordedTracks === 1 ? '' : 'S'} RECORDED`;
  };

  const saveToLocalStorage = () => {
    const project = sequencerEngine.getProject();
    localStorage.setItem('mtm-project', JSON.stringify(project));
  };

  const handlePianoRollEventsChange = (events: MIDIEvent[]) => {
    if (selectedTracks.length > 0) {
      const part = sequencerEngine.getCurrentPart();
      const partId = part.id;
      const track = part.tracks.find(t => t.id === selectedTracks[0]);
      if (track) {
        const eventsBefore = cloneEvents(track.events);
        const eventsAfter = cloneEvents(events);
        const trackId = selectedTracks[0];
        undoManager.executeCommand({
          label: `EDIT TRK ${trackId}`,
          execute: () => {
            const p = sequencerEngine.getPartById(partId);
            if (!p) return;
            const t = p.tracks.find(tr => tr.id === trackId);
            if (t) t.events = cloneEvents(eventsAfter);
          },
          undo: () => {
            const p = sequencerEngine.getPartById(partId);
            if (!p) return;
            const t = p.tracks.find(tr => tr.id === trackId);
            if (t) t.events = cloneEvents(eventsBefore);
          },
        });
        saveToLocalStorage();
      }
    }
  };

  const getCurrentTrackEvents = (): MIDIEvent[] => {
    if (selectedTracks.length > 0) {
      const part = sequencerEngine.getCurrentPart();
      const track = part.tracks.find(t => t.id === selectedTracks[0]);
      return track?.events || [];
    }
    return [];
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
            const loadedProject = JSON.parse(e.target?.result as string);
            sequencerEngine.loadProject(loadedProject);
            setProject(loadedProject);
            setTempo(loadedProject.tempo || 120);
            setCurrentPart((loadedProject.currentPart || 0) + 1);
            setCurrentSong(loadedProject.currentSong || null);
            undoManager.clear();
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

  const handleProjectChange = (updatedProject: Project) => {
    sequencerEngine.loadProject(updatedProject);
    setProject(updatedProject);
    setTempo(updatedProject.tempo);
    setCurrentPart((updatedProject.currentPart || 0) + 1);
    setCurrentSong(updatedProject.currentSong || null);
    saveToLocalStorage();
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
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleUndo}
              disabled={!canUndo}
              data-testid="button-undo"
              aria-label="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleRedo}
              disabled={!canRedo}
              data-testid="button-redo"
              aria-label="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
            <FAQDialog />
            <Button 
              variant="default" 
              onClick={handleLoadProject}
              data-testid="button-load"
            >
              <Upload className="w-4 h-4 mr-2" />
              Load
            </Button>
            <Button 
              variant="default" 
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
                  progress={playbackProgress}
                  onClick={(e) => handleTrackClick(num, e.shiftKey)}
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
                  progress={playbackProgress}
                  onClick={(e) => handleTrackClick(num, e.shiftKey)}
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

      <PianoRollDialog
        open={pianoRollOpen}
        onOpenChange={setPianoRollOpen}
        trackNumber={selectedTracks[0] || 1}
        events={getCurrentTrackEvents()}
        onEventsChange={handlePianoRollEventsChange}
        currentPosition={currentPosition}
        liveNotes={liveNotes}
      />

      <SongModeDialog
        open={songModeOpen}
        onOpenChange={setSongModeOpen}
        project={project}
        onProjectChange={handleProjectChange}
      />
    </div>
  );
}
