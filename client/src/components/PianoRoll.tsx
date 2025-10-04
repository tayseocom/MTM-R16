import { useEffect, useRef, useState } from 'react';
import type { MIDIEvent } from '@shared/schema';
import { sequencerEngine } from '@/lib/sequencer-engine';

const PPQ = 96;
const BEATS_PER_BAR = 4;
const TICKS_PER_BAR = PPQ * BEATS_PER_BAR;
const PIANO_WIDTH = 72;

interface PianoNote {
  id: string;
  t: number;
  dur: number;
  nn: number;
  vel: number;
  ch: number;
}

interface PianoRollProps {
  trackId: number;
  events: MIDIEvent[];
  onEventsChange: (events: MIDIEvent[]) => void;
  currentPosition?: number;
  liveNotes?: Map<number, { velocity: number; timestamp: number }>;
}

type Tool = 'select' | 'draw' | 'erase';

interface DragState {
  mode: 'move' | 'resize' | 'draw';
  note: PianoNote;
  startX: number;
  startY: number;
  startT?: number;
  startDur?: number;
  startSelSnapshot?: Record<string, { t: number; nn: number }>;
}

export default function PianoRoll({ trackId, events, onEventsChange, currentPosition = 0, liveNotes }: PianoRollProps) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const pianoRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(1);

  const [tool, setTool] = useState<Tool>('select');
  const [snapDiv, setSnapDiv] = useState(6); // 1/16
  const [barsVisible, setBarsVisible] = useState(16);
  const [keysVisible, setKeysVisible] = useState(24);
  const [scrollTicks, setScrollTicks] = useState(0);
  const [scrollKey, setScrollKey] = useState(48);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<PianoNote[]>([]);
  const [hover, setHover] = useState<{ note: PianoNote; edge: boolean } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const dpr = window.devicePixelRatio || 1;

  // Convert MIDI events to notes
  useEffect(() => {
    const noteStacks = new Map<number, MIDIEvent[]>();
    const result: PianoNote[] = [];

    const sortedEvents = [...events].sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      const aIsNoteOff = a.type === 'noteOff' || (a.type === 'noteOn' && a.velocity === 0);
      const bIsNoteOff = b.type === 'noteOff' || (b.type === 'noteOn' && b.velocity === 0);
      if (aIsNoteOff && !bIsNoteOff) return -1;
      if (!aIsNoteOff && bIsNoteOff) return 1;
      return 0;
    });

    sortedEvents.forEach(e => {
      if (e.type === 'noteOn' && e.note !== undefined && e.velocity && e.velocity > 0) {
        if (!noteStacks.has(e.note)) {
          noteStacks.set(e.note, []);
        }
        noteStacks.get(e.note)!.push(e);
      } else if ((e.type === 'noteOff' || (e.type === 'noteOn' && e.velocity === 0)) && e.note !== undefined) {
        const stack = noteStacks.get(e.note);
        if (stack && stack.length > 0) {
          const noteOn = stack.shift()!;
          const t = Math.round(noteOn.timestamp);
          const dur = Math.round(e.timestamp - noteOn.timestamp);
          result.push({
            id: 'n' + (nextIdRef.current++),
            t,
            dur: Math.max(2, dur),
            nn: noteOn.note!,
            vel: noteOn.velocity || 100,
            ch: noteOn.channel
          });
        }
      }
    });

    noteStacks.forEach((stack, nn) => {
      stack.forEach(noteOn => {
        result.push({
          id: 'n' + (nextIdRef.current++),
          t: Math.round(noteOn.timestamp),
          dur: PPQ / 4,
          nn,
          vel: noteOn.velocity || 100,
          ch: noteOn.channel
        });
      });
    });

    setNotes(result.sort((a, b) => a.t - b.t));
  }, [events]);

  // Subscribe to live recording updates
  useEffect(() => {
    const unsubscribeBuffer = sequencerEngine.onRecordBufferUpdate((updateTrackId, data) => {
      // Only update if this is for our track
      if (updateTrackId !== trackId) return;
      
      // Check if changed range intersects visible window
      const visibleT0 = scrollTicks;
      const visibleT1 = scrollTicks + barsVisible * TICKS_PER_BAR;
      
      if (data.changedRange.t1 < visibleT0 || data.changedRange.t0 > visibleT1) {
        return; // Out of visible range, skip update
      }
      
      // For now, trigger a full refresh by reading current events from engine
      // This ensures we see the latest recording buffer
      const currentPart = sequencerEngine.getCurrentPart();
      const track = currentPart.tracks.find(t => t.id === trackId);
      if (track) {
        // Trigger events prop update to refresh notes
        onEventsChange(track.events);
      }
    });

    const unsubscribeCommit = sequencerEngine.onTakeCommitted((updateTrackId, data) => {
      // Only update if this is for our track
      if (updateTrackId !== trackId) return;
      
      // Committed - refresh the display
      const currentPart = sequencerEngine.getCurrentPart();
      const track = currentPart.tracks.find(t => t.id === trackId);
      if (track) {
        onEventsChange(track.events);
      }
    });

    return () => {
      unsubscribeBuffer();
      unsubscribeCommit();
    };
  }, [trackId, scrollTicks, barsVisible, onEventsChange]);

  // Convert notes to MIDI events
  const notesToEvents = (nts: PianoNote[]): MIDIEvent[] => {
    const evs: MIDIEvent[] = [];
    nts.forEach(n => {
      evs.push({
        timestamp: n.t,
        type: 'noteOn',
        channel: n.ch,
        note: n.nn,
        velocity: n.vel
      });
      evs.push({
        timestamp: n.t + n.dur,
        type: 'noteOff',
        channel: n.ch,
        note: n.nn,
        velocity: 0
      });
    });
    return evs.sort((a, b) => a.timestamp - b.timestamp);
  };

  // Coordinate conversion
  const barsToPx = () => {
    if (!gridRef.current) return 0;
    return (gridRef.current.width - PIANO_WIDTH * dpr) / barsVisible;
  };

  const ticksToX = (t: number) => {
    const pxPerBar = barsToPx();
    const rel = (t - scrollTicks) / TICKS_PER_BAR;
    return Math.round(PIANO_WIDTH * dpr + rel * pxPerBar);
  };

  const xToTicks = (x: number) => {
    const pxPerBar = barsToPx();
    const rel = (x - PIANO_WIDTH * dpr) / pxPerBar;
    return Math.round(scrollTicks + rel * TICKS_PER_BAR);
  };

  const keyHeight = () => {
    if (!gridRef.current) return 0;
    return gridRef.current.height / keysVisible;
  };

  const nnToY = (nn: number) => {
    if (!gridRef.current) return 0;
    const rel = nn - scrollKey;
    return Math.round(gridRef.current.height - (rel + 1) * keyHeight());
  };

  const yToNN = (y: number) => {
    if (!gridRef.current) return 60;
    const rel = Math.floor((gridRef.current.height - y) / keyHeight());
    return scrollKey + rel;
  };

  const snapTicks = (t: number) => {
    if (snapDiv === 0) return t;
    return Math.round(t / snapDiv) * snapDiv;
  };

  const isBlack = (nn: number) => {
    return [1, 3, 6, 8, 10].includes(nn % 12);
  };

  const noteAt = (x: number, y: number) => {
    const t = xToTicks(x);
    const nn = yToNN(y);
    const pad = Math.max(4, keyHeight() * 0.15);
    
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (Math.abs(n.nn - nn) <= 0.5) {
        if (t >= n.t && t <= n.t + n.dur) {
          const edgeX = ticksToX(n.t + n.dur);
          if (Math.abs(edgeX - x) < pad) return { note: n, edge: true };
          return { note: n, edge: false };
        }
      }
    }
    return null;
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Drawing functions
  const drawGrid = () => {
    if (!gridRef.current) return;
    const ctx = gridRef.current.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, gridRef.current.width, gridRef.current.height);

    ctx.fillStyle = '#2a2d31';
    ctx.fillRect(0, 0, gridRef.current.width, gridRef.current.height);

    const pxPerBar = barsToPx();
    const startBar = Math.floor(scrollTicks / TICKS_PER_BAR);
    const endBar = startBar + barsVisible + 1;

    for (let bar = startBar; bar <= endBar; bar++) {
      const x = Math.round(PIANO_WIDTH * dpr + (bar - startBar) * pxPerBar);
      
      ctx.strokeStyle = '#3a3e44';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, gridRef.current.height);
      ctx.stroke();

      for (let beat = 1; beat < BEATS_PER_BAR; beat++) {
        const xb = Math.round(x + beat * (pxPerBar / BEATS_PER_BAR));
        ctx.strokeStyle = '#2e3237';
        ctx.beginPath();
        ctx.moveTo(xb, 0);
        ctx.lineTo(xb, gridRef.current.height);
        ctx.stroke();
      }

      ctx.fillStyle = '#9aa1aa';
      ctx.font = `${12 * dpr}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(bar + 1), x + 4 * dpr, 4 * dpr);
    }

    const kh = keyHeight();
    for (let i = 0; i < keysVisible; i++) {
      const nn = scrollKey + i;
      const y = Math.round(gridRef.current.height - (i + 1) * kh);
      ctx.fillStyle = isBlack(nn) ? '#272a2f' : '#2f3339';
      ctx.fillRect(PIANO_WIDTH * dpr, y, gridRef.current.width - PIANO_WIDTH * dpr, kh);
    }

    ctx.restore();
  };

  const drawPiano = () => {
    if (!pianoRef.current) return;
    const ctx = pianoRef.current.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, pianoRef.current.width, pianoRef.current.height);
    
    const kh = keyHeight();
    ctx.fillStyle = '#222429';
    ctx.fillRect(0, 0, PIANO_WIDTH * dpr, pianoRef.current.height);

    for (let i = 0; i < keysVisible; i++) {
      const nn = scrollKey + i;
      const y = Math.round(pianoRef.current.height - (i + 1) * kh);
      
      ctx.fillStyle = isBlack(nn) ? '#13151a' : '#1e2126';
      ctx.fillRect(0, y, PIANO_WIDTH * dpr, kh);

      if (nn % 12 === 0) {
        ctx.fillStyle = '#9aa1aa';
        ctx.font = `${11 * dpr}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const octave = Math.floor(nn / 12) - 1;
        ctx.fillText('C' + octave, 6 * dpr, y + kh / 2);
      }

      ctx.strokeStyle = '#000';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PIANO_WIDTH * dpr, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawNotes = () => {
    if (!overlayRef.current) return;
    const ctx = overlayRef.current.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

    const kh = keyHeight();
    const r = Math.max(4, Math.min(10, Math.floor(kh / 3)));

    for (const n of notes) {
      const x = ticksToX(n.t);
      const w = Math.max(4, ticksToX(n.t + n.dur) - x);
      const y = nnToY(n.nn);
      const sel = selection.has(n.id);
      
      ctx.fillStyle = sel ? '#ffcc66' : '#76d275';
      roundRect(ctx, x, y + 3, w, Math.max(6, kh - 6), r);
      ctx.fill();
      
      ctx.fillStyle = '#0e0f11';
      ctx.fillRect(x + w - 3 * dpr, y + 3, 3 * dpr, Math.max(6, kh - 6));
    }

    if (hover && hover.note) {
      const n = hover.note;
      const x = ticksToX(n.t);
      const w = Math.max(4, ticksToX(n.t + n.dur) - x);
      const y = nnToY(n.nn);
      ctx.strokeStyle = '#ffffffaa';
      ctx.lineWidth = 2 * dpr;
      roundRect(ctx, x - 1, y + 2, w + 2, Math.max(6, kh - 4), r);
      ctx.stroke();
    }

    // Draw live MIDI input notes
    if (liveNotes && liveNotes.size > 0) {
      const kh = keyHeight();
      liveNotes.forEach((noteData, nn) => {
        const y = nnToY(nn);
        const x = currentPosition > 0 ? ticksToX(currentPosition) : PIANO_WIDTH * dpr + 10;
        const w = 40 * dpr;
        
        // Draw live note with pulsing effect
        const alpha = 0.3 + (Math.sin(Date.now() / 200) + 1) / 4;
        ctx.fillStyle = `rgba(155, 242, 107, ${alpha})`;
        ctx.fillRect(x - w/2, y + 3, w, Math.max(6, kh - 6));
        
        // Draw border
        ctx.strokeStyle = '#9bf26b';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(x - w/2, y + 3, w, Math.max(6, kh - 6));
      });
    }

    if (currentPosition > 0) {
      const x = ticksToX(currentPosition);
      ctx.strokeStyle = '#9bf26b';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, overlayRef.current.height);
      ctx.stroke();
    }

    ctx.restore();
  };

  const draw = () => {
    drawGrid();
    drawPiano();
    drawNotes();
  };

  // Resize handler
  useEffect(() => {
    const resize = () => {
      if (!wrapRef.current || !gridRef.current || !pianoRef.current || !overlayRef.current) return;
      
      const { clientWidth: w, clientHeight: h } = wrapRef.current;
      [gridRef.current, pianoRef.current, overlayRef.current].forEach(c => {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
        c.style.width = w + 'px';
        c.style.height = h + 'px';
      });
      draw();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [barsVisible, keysVisible, scrollTicks, scrollKey, notes, selection, hover, currentPosition, liveNotes]);

  // Animate live notes
  useEffect(() => {
    if (!liveNotes || liveNotes.size === 0) return;
    
    const animInterval = setInterval(() => {
      drawNotes();
    }, 50);
    
    return () => clearInterval(animInterval);
  }, [liveNotes]);

  // Mouse handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;
    
    setHover(noteAt(x, y));

    if (isMouseDown && dragging) {
      const { mode, note, startX, startY, startT, startSelSnapshot } = dragging;
      
      if (mode === 'move') {
        const dtTicks = Math.round((x - startX) / (barsToPx() / TICKS_PER_BAR));
        const dnn = Math.round((startY - y) / keyHeight());
        
        setNotes(prev => {
          const updated = [...prev];
          for (const id of Array.from(selection)) {
            const n = updated.find(n => n.id === id);
            if (!n || !startSelSnapshot) continue;
            let newT = startSelSnapshot[id].t + dtTicks;
            if (!e.altKey) newT = snapTicks(newT);
            n.t = Math.max(0, newT);
            n.nn = startSelSnapshot[id].nn + dnn;
          }
          return updated;
        });
      } else if (mode === 'resize') {
        let t2 = xToTicks(x);
        if (!e.altKey) t2 = snapTicks(t2);
        setNotes(prev => {
          const updated = [...prev];
          const n = updated.find(n => n.id === note.id);
          if (n && startT !== undefined) {
            n.dur = Math.max(2, t2 - startT);
          }
          return updated;
        });
      } else if (mode === 'draw') {
        let t2 = xToTicks(x);
        if (!e.altKey) t2 = snapTicks(t2);
        setNotes(prev => {
          const updated = [...prev];
          const n = updated.find(n => n.id === note.id);
          if (n && startT !== undefined) {
            n.dur = Math.max(2, t2 - startT);
          }
          return updated;
        });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;
    
    setIsMouseDown(true);
    const hit = noteAt(x, y);

    if (tool === 'erase') {
      if (hit && hit.note) {
        setNotes(prev => prev.filter(n => n !== hit.note));
        setSelection(prev => {
          const next = new Set(prev);
          next.delete(hit.note.id);
          return next;
        });
      }
      return;
    }

    if (tool === 'draw') {
      let t0 = xToTicks(x);
      if (!e.altKey) t0 = snapTicks(t0);
      const nn = yToNN(y);
      const newNote: PianoNote = {
        id: 'n' + (nextIdRef.current++),
        t: Math.max(0, t0),
        dur: Math.max(12, PPQ / 4),
        nn,
        vel: 96,
        ch: 1
      };
      setNotes(prev => [...prev, newNote]);
      setSelection(new Set([newNote.id]));
      setDragging({ mode: 'draw', note: newNote, startX: x, startY: y, startT: t0 });
      return;
    }

    if (hit && hit.note) {
      const n = hit.note;
      if (!e.shiftKey && !selection.has(n.id)) {
        setSelection(new Set([n.id]));
      } else if (e.shiftKey && selection.has(n.id)) {
        setSelection(prev => {
          const next = new Set(prev);
          next.delete(n.id);
          return next;
        });
      } else if (e.shiftKey) {
        setSelection(prev => new Set([...Array.from(prev), n.id]));
      }
      
      if (hit.edge) {
        setDragging({ mode: 'resize', note: n, startX: x, startY: y, startT: n.t, startDur: n.dur });
      } else {
        const snap: Record<string, { t: number; nn: number }> = {};
        for (const id of Array.from(selection)) {
          const note = notes.find(n => n.id === id);
          if (note) snap[id] = { t: note.t, nn: note.nn };
        }
        setDragging({ mode: 'move', note: n, startX: x, startY: y, startSelSnapshot: snap });
      }
    } else {
      if (!e.shiftKey) setSelection(new Set());
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setDragging(null);
    
    // Emit changes
    onEventsChange(notesToEvents(notes));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.shiftKey) {
      setBarsVisible(prev => Math.min(64, Math.max(1, prev + Math.sign(e.deltaY))));
      return;
    }
    if (e.altKey) {
      setScrollTicks(prev => Math.max(0, prev + Math.sign(e.deltaY) * TICKS_PER_BAR));
      return;
    }
    setScrollKey(prev => Math.max(0, prev + Math.sign(e.deltaY) * 2));
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'b' || e.key === 'B') setTool('draw');
      if (e.key === 'e' || e.key === 'E') setTool('erase');
      
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setNotes(prev => prev.filter(n => !selection.has(n.id)));
        setSelection(new Set());
        onEventsChange(notesToEvents(notes.filter(n => !selection.has(n.id))));
      }
      
      if (e.key === 'q' || e.key === 'Q') {
        setNotes(prev => {
          const updated = [...prev];
          for (const id of Array.from(selection)) {
            const n = updated.find(m => m.id === id);
            if (n) {
              n.t = snapTicks(n.t);
              const end = snapTicks(n.t + n.dur);
              n.dur = Math.max(2, end - n.t);
            }
          }
          return updated;
        });
        onEventsChange(notesToEvents(notes));
      }
      
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const semi = e.shiftKey ? (e.key === 'ArrowUp' ? 12 : -12) : (e.key === 'ArrowUp' ? 1 : -1);
        setNotes(prev => {
          const updated = [...prev];
          for (const id of Array.from(selection)) {
            const n = updated.find(m => m.id === id);
            if (n) n.nn = Math.max(0, Math.min(127, n.nn + semi));
          }
          return updated;
        });
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        const div = snapDiv || 1;
        setNotes(prev => {
          const updated = [...prev];
          for (const id of Array.from(selection)) {
            const n = updated.find(m => m.id === id);
            if (n) n.t = Math.max(0, n.t + dir * div);
          }
          return updated;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, snapDiv, notes]);

  const handleQuantize = () => {
    setNotes(prev => {
      const updated = [...prev];
      for (const id of Array.from(selection)) {
        const n = updated.find(m => m.id === id);
        if (n) {
          n.t = snapTicks(n.t);
          const end = snapTicks(n.t + n.dur);
          n.dur = Math.max(2, end - n.t);
        }
      }
      return updated;
    });
    onEventsChange(notesToEvents(notes));
  };

  const handleDelete = () => {
    setNotes(prev => prev.filter(n => !selection.has(n.id)));
    setSelection(new Set());
    onEventsChange(notesToEvents(notes.filter(n => !selection.has(n.id))));
  };

  return (
    <div className="flex flex-col h-full bg-[#1b1c1f]">
      <div className="flex gap-3 items-center px-3 py-2 bg-[#2a2d31] border-b border-black/50 sticky top-0 z-10">
        <div className="flex gap-2 items-center">
          <label className="text-sm text-[#dfe3e8]">
            Tool
            <select
              data-testid="select-tool"
              value={tool}
              onChange={(e) => setTool(e.target.value as Tool)}
              className="ml-2 bg-[#3a3e44] text-[#dfe3e8] border border-black rounded-md px-2 py-1 text-sm"
            >
              <option value="select">Select (V)</option>
              <option value="draw">Draw (B)</option>
              <option value="erase">Erase (E)</option>
            </select>
          </label>
          <label className="text-sm text-[#dfe3e8]">
            Snap
            <select
              data-testid="select-snap"
              value={snapDiv}
              onChange={(e) => setSnapDiv(Number(e.target.value))}
              className="ml-2 bg-[#3a3e44] text-[#dfe3e8] border border-black rounded-md px-2 py-1 text-sm"
            >
              <option value="0">Off</option>
              <option value="48">1/2</option>
              <option value="24">1/4</option>
              <option value="16">1/6</option>
              <option value="12">1/8</option>
              <option value="8">1/12</option>
              <option value="6">1/16</option>
              <option value="4">1/24</option>
              <option value="3">1/32</option>
              <option value="2">1/48</option>
            </select>
          </label>
          <label className="text-sm text-[#dfe3e8]">
            Zoom X
            <input
              data-testid="input-zoomx"
              type="number"
              min="1"
              max="64"
              step="1"
              value={barsVisible}
              onChange={(e) => setBarsVisible(Number(e.target.value) || 16)}
              className="ml-2 bg-[#3a3e44] text-[#dfe3e8] border border-black rounded-md px-2 py-1 w-16 text-sm"
            />
          </label>
          <label className="text-sm text-[#dfe3e8]">
            Zoom Y
            <input
              data-testid="input-zoomy"
              type="number"
              min="8"
              max="64"
              step="1"
              value={keysVisible}
              onChange={(e) => setKeysVisible(Number(e.target.value) || 24)}
              className="ml-2 bg-[#3a3e44] text-[#dfe3e8] border border-black rounded-md px-2 py-1 w-16 text-sm"
            />
          </label>
          <button
            data-testid="button-quantize"
            onClick={handleQuantize}
            className="bg-[#3a3e44] text-[#dfe3e8] border border-black rounded-md px-3 py-1 text-sm hover-elevate active-elevate-2"
          >
            Quantize (Q)
          </button>
          <button
            data-testid="button-delete"
            onClick={handleDelete}
            className="bg-[#ff6b6b] text-white border border-black rounded-md px-3 py-1 text-sm hover-elevate active-elevate-2"
          >
            Delete
          </button>
        </div>
        <div className="ml-auto text-xs text-[#9aa1aa]">
          Drag to move • Edge-drag to trim • Alt = no snap • Alt+Wheel = horizontal scroll • Shift+Wheel = zoom X
        </div>
      </div>

      <div ref={wrapRef} className="relative flex-1">
        <canvas ref={gridRef} className="absolute left-0 top-0" data-testid="canvas-grid" />
        <canvas ref={pianoRef} className="absolute left-0 top-0" data-testid="canvas-piano" />
        <canvas
          ref={overlayRef}
          className="absolute left-0 top-0 cursor-crosshair"
          data-testid="canvas-overlay"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
}
