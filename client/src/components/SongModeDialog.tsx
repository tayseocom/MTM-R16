import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SongEditor from '@/components/SongEditor';
import type { Song, Part } from '@shared/schema';
import { generateSongId } from '@shared/id-utils';
import { songPlayer } from '@/lib/song-player';
import { sequencerEngine } from '@/lib/sequencer-engine';
import { Plus, Play, Square } from 'lucide-react';

interface SongModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { parts: Part[]; songs: Song[]; currentSong: string | null };
  onProjectChange: (project: any) => void;
}

export default function SongModeDialog({ 
  open, 
  onOpenChange, 
  project,
  onProjectChange
}: SongModeDialogProps) {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(project.currentSong);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentPass, setCurrentPass] = useState(1);

  useEffect(() => {
    // Subscribe to song player updates
    const listener = () => {
      setCurrentStepIndex(songPlayer.getCurrentStepIndex());
      setCurrentPass(songPlayer.getCurrentPass());
    };
    songPlayer.addListener(listener);
    return () => songPlayer.removeListener(listener);
  }, []);

  useEffect(() => {
    // Sync with song player when selected song changes
    if (selectedSongId) {
      const song = project.songs.find(s => s.id === selectedSongId);
      if (song && songPlayer.getSong()?.id !== song.id) {
        songPlayer.loadSong(song);
      }
    }
  }, [selectedSongId, project.songs]);

  const createNewSong = () => {
    const newSong: Song = {
      id: generateSongId(),
      name: `Song ${project.songs.length + 1}`,
      tempoBpm: 120,
      steps: [],
      loopEnabled: false,
      loopStart: 0,
      loopEnd: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updatedProject = {
      ...project,
      songs: [...project.songs, newSong],
      currentSong: newSong.id
    };
    
    onProjectChange(updatedProject);
    setSelectedSongId(newSong.id);
  };

  const updateSong = (updatedSong: Song) => {
    const updatedProject = {
      ...project,
      songs: project.songs.map(s => s.id === updatedSong.id ? updatedSong : s)
    };
    onProjectChange(updatedProject);
  };

  const deleteSong = (songId: string) => {
    const updatedProject = {
      ...project,
      songs: project.songs.filter(s => s.id !== songId),
      currentSong: null
    };
    onProjectChange(updatedProject);
    setSelectedSongId(null);
    songPlayer.reset();
  };

  const handleStepSelect = (index: number) => {
    songPlayer.selectStep(index);
  };

  const handleAuditionPart = (partId: number) => {
    // Switch to part mode temporarily
    const partIndex = project.parts.findIndex(p => p.id === partId);
    if (partIndex !== -1) {
      sequencerEngine.getProject().currentPart = partIndex;
      // Don't close dialog, just switch the part
    }
  };

  const selectedSong = selectedSongId ? project.songs.find(s => s.id === selectedSongId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl">Song Mode</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Song Selection / Creation */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-wrap">
              {project.songs.map(song => (
                <Button
                  key={song.id}
                  variant={selectedSongId === song.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSongId(song.id)}
                  data-testid={`button-select-song-${song.id}`}
                >
                  {song.name}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={createNewSong}
              data-testid="button-create-song"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Song
            </Button>
            {selectedSongId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteSong(selectedSongId)}
                data-testid="button-delete-song"
              >
                Delete Song
              </Button>
            )}
          </div>

          {/* Song Editor */}
          {selectedSong ? (
            <SongEditor
              song={selectedSong}
              parts={project.parts}
              currentStepIndex={currentStepIndex}
              currentPass={currentPass}
              onSongChange={updateSong}
              onStepSelect={handleStepSelect}
              onAuditionPart={handleAuditionPart}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No song selected. Create a new song to get started.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
