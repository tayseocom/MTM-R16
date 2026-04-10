import type { MIDIEvent } from '@shared/schema';

export interface UndoableCommand {
  label: string;
  execute: () => void;
  undo: () => void;
}

export class UndoManager {
  private undoStack: UndoableCommand[] = [];
  private redoStack: UndoableCommand[] = [];
  private maxHistory = 50;
  private changeListeners: Array<() => void> = [];

  executeCommand(command: UndoableCommand) {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notifyListeners();
  }

  undo(): string | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    command.undo();
    this.redoStack.push(command);
    this.notifyListeners();
    return command.label;
  }

  redo(): string | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    command.execute();
    this.undoStack.push(command);
    this.notifyListeners();
    return command.label;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  onChange(listener: () => void) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.changeListeners.forEach(l => l());
  }
}

export function cloneEvents(events: MIDIEvent[]): MIDIEvent[] {
  return JSON.parse(JSON.stringify(events));
}

export const undoManager = new UndoManager();
