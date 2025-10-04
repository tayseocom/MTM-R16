import { useState } from 'react';
import type { Song, SongStep, Part, TrackMask } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Copy, GripVertical, Play } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { generateStepId } from '@shared/id-utils';

interface SongEditorProps {
  song: Song;
  parts: Part[];
  currentStepIndex: number;
  currentPass: number;
  onSongChange: (song: Song) => void;
  onStepSelect: (index: number) => void;
  onAuditionPart: (partId: number) => void;
}

export default function SongEditor({
  song,
  parts,
  currentStepIndex,
  currentPass,
  onSongChange,
  onStepSelect,
  onAuditionPart
}: SongEditorProps) {
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);

  const updateSong = (updates: Partial<Song>) => {
    onSongChange({ ...song, ...updates, updatedAt: Date.now() });
  };

  const addStep = (partId: number) => {
    const newStep: SongStep = {
      id: generateStepId(),
      partId,
      repeats: 1
    };
    updateSong({ steps: [...song.steps, newStep] });
  };

  const duplicateStep = (index: number) => {
    const step = song.steps[index];
    const newStep: SongStep = {
      ...step,
      id: generateStepId()
    };
    const newSteps = [...song.steps];
    newSteps.splice(index + 1, 0, newStep);
    updateSong({ steps: newSteps });
  };

  const deleteStep = (index: number) => {
    const newSteps = song.steps.filter((_, i) => i !== index);
    updateSong({ steps: newSteps });
  };

  const updateStep = (index: number, updates: Partial<SongStep>) => {
    const newSteps = [...song.steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    updateSong({ steps: newSteps });
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    const newSteps = [...song.steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    updateSong({ steps: newSteps });
  };

  const handleDragStart = (index: number) => {
    setDraggedStepIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedStepIndex !== null && draggedStepIndex !== index) {
      moveStep(draggedStepIndex, index);
      setDraggedStepIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedStepIndex(null);
  };

  const toggleTrackInMask = (stepIndex: number, trackId: number) => {
    const step = song.steps[stepIndex];
    const currentMask = step.trackMask ?? 0xFFFF; // Default: all tracks on
    const trackBit = trackId - 1;
    const newMask = currentMask ^ (1 << trackBit); // Toggle bit
    updateStep(stepIndex, { trackMask: newMask });
  };

  const isTrackAudibleInMask = (mask: TrackMask | undefined, trackId: number): boolean => {
    if (mask === undefined) return true; // No mask = use part mutes
    const trackBit = trackId - 1;
    return (mask & (1 << trackBit)) !== 0;
  };

  const getPartName = (partId: number): string => {
    const part = parts.find(p => p.id === partId);
    return part?.name || `Part ${partId}`;
  };

  return (
    <div className="space-y-4" data-testid="song-editor">
      {/* Song Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Input
            value={song.name}
            onChange={(e) => updateSong({ name: e.target.value })}
            className="w-48 font-mono"
            data-testid="input-song-name"
          />
          <div className="flex items-center gap-2">
            <Label>Tempo:</Label>
            <Input
              type="number"
              value={song.tempoBpm}
              onChange={(e) => updateSong({ tempoBpm: parseInt(e.target.value) || 120 })}
              className="w-20"
              min="40"
              max="250"
              data-testid="input-song-tempo"
            />
            <span className="text-sm text-muted-foreground">BPM</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={song.loopEnabled}
            onCheckedChange={(checked) => updateSong({ loopEnabled: checked })}
            data-testid="switch-song-loop"
          />
          <Label>Loop</Label>
        </div>
      </div>

      {/* Main Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Step List Editor (Left Pane) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Steps</h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" data-testid="button-add-step">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Select Part</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {parts.map(part => (
                      <Button
                        key={part.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addStep(part.id)}
                        data-testid={`button-add-step-part-${part.id}`}
                      >
                        {part.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Steps Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="w-8"></th>
                  <th className="px-2 py-2 text-left text-xs">#</th>
                  <th className="px-2 py-2 text-left text-xs">Part</th>
                  <th className="px-2 py-2 text-left text-xs">Repeats</th>
                  <th className="px-2 py-2 text-left text-xs">Mask</th>
                  <th className="px-2 py-2 text-left text-xs">Transpose</th>
                  <th className="w-20 px-2 py-2 text-left text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {song.steps.map((step, index) => (
                  <tr
                    key={step.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`border-t hover-elevate cursor-pointer ${
                      index === currentStepIndex ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => onStepSelect(index)}
                    data-testid={`row-step-${index}`}
                  >
                    <td className="px-2 py-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {index + 1}
                      {index === currentStepIndex && (
                        <span className="ml-1 text-xs text-primary">({currentPass}/{step.repeats || 1})</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAuditionPart(step.partId);
                        }}
                        data-testid={`button-audition-part-${index}`}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {getPartName(step.partId)}
                      </Button>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStep(index, { repeats: Math.max(1, (step.repeats || 1) - 1) });
                          }}
                          data-testid={`button-decrease-repeats-${index}`}
                        >
                          -
                        </Button>
                        <span className="text-sm w-8 text-center">×{step.repeats || 1}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStep(index, { repeats: (step.repeats || 1) + 1 });
                          }}
                          data-testid={`button-increase-repeats-${index}`}
                        >
                          +
                        </Button>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-edit-mask-${index}`}
                          >
                            {step.trackMask !== undefined ? 'Custom' : 'Part'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Track Mask</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {Array.from({ length: 16 }, (_, i) => i + 1).map(trackId => {
                                const isAudible = isTrackAudibleInMask(step.trackMask, trackId);
                                return (
                                  <button
                                    key={trackId}
                                    onClick={() => toggleTrackInMask(index, trackId)}
                                    className={`h-8 rounded text-xs font-mono transition-colors ${
                                      isAudible
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                    data-testid={`button-mask-track-${index}-${trackId}`}
                                  >
                                    T{trackId}
                                  </button>
                                );
                              })}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => updateStep(index, { trackMask: undefined })}
                              data-testid={`button-clear-mask-${index}`}
                            >
                              Use Part Mutes
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={step.transpose || 0}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateStep(index, { transpose: parseInt(e.target.value) || 0 });
                        }}
                        className="h-6 w-16 text-xs"
                        min="-12"
                        max="12"
                        data-testid={`input-transpose-${index}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateStep(index);
                          }}
                          data-testid={`button-duplicate-step-${index}`}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStep(index);
                          }}
                          data-testid={`button-delete-step-${index}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chain Overview (Right Pane) */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Chain Overview</h3>
          <div className="border rounded-lg p-4 space-y-4">
            {/* Loop Range Controls */}
            {song.loopEnabled && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Loop Start:</Label>
                  <Input
                    type="number"
                    value={song.loopStart}
                    onChange={(e) => updateSong({ loopStart: parseInt(e.target.value) || 0 })}
                    className="h-6 w-16 text-xs"
                    min="0"
                    max={song.steps.length - 1}
                    data-testid="input-loop-start"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Loop End:</Label>
                  <Input
                    type="number"
                    value={song.loopEnd}
                    onChange={(e) => updateSong({ loopEnd: parseInt(e.target.value) || 0 })}
                    className="h-6 w-16 text-xs"
                    min="0"
                    max={song.steps.length - 1}
                    data-testid="input-loop-end"
                  />
                </div>
              </div>
            )}

            {/* Timeline Pills */}
            <div className="space-y-2">
              {song.steps.map((step, index) => {
                const isInLoop = song.loopEnabled && index >= song.loopStart && index <= song.loopEnd;
                const isCurrent = index === currentStepIndex;
                const width = (step.repeats || 1) * 40; // Width based on repeats
                
                return (
                  <div
                    key={step.id}
                    onClick={() => onStepSelect(index)}
                    className={`
                      relative h-10 rounded-md cursor-pointer transition-colors px-3 flex items-center
                      ${isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
                      ${isInLoop ? 'ring-2 ring-primary/50' : ''}
                    `}
                    style={{ width: `${width}px` }}
                    data-testid={`pill-step-${index}`}
                  >
                    <span className="text-xs font-mono">
                      {index + 1}. {getPartName(step.partId)}
                    </span>
                    {(step.repeats || 1) > 1 && (
                      <span className="ml-auto text-xs font-bold">×{step.repeats}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
