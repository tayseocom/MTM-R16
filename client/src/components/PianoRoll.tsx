import { useEffect, useRef, useState, useCallback } from 'react';
import { MIDIEvent } from '@shared/schema';

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
  events: MIDIEvent[];
  onEventsChange: (events: MIDIEvent[]) => void;
  currentPosition?: number;
}

type Tool = 'select' | 'draw' | 'erase';

interface DragState {
  mode: 'move' | 'resize' | 'draw' | 'draw-move';
  note: PianoNote;
  startX: number;
  startY: number;
  startT: number;
  startDur: number;
  startNN: number;
  startSelSnapshot: Record<string, { t: number; nn: number }>;
}

export default function PianoRoll({ events, onEventsChange, currentPosition = 0 }: PianoRollProps) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const pianoRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('select');
  const [snapDiv, setSnapDiv] = useState(6);
  const [barsVisible, setBarsVisible] = useState(16);
  const [keysVisible, setKeysVisible] = useState(24);
  const [scrollTicks, setScrollTicks] = useState(0);
  const [scrollKey, setScrollKey] = useState(48);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<PianoNote[]>([]);
  const [hover, setHover] = useState<{ note: PianoNote; edge: boolean } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const nextIdRef = useRef(1);

  const dpr = window.devicePixelRatio || 1;

  useEffect(() => {
    const convertedNotes = eventsToNotes(events);
    setNotes(convertedNotes);
  }, [events]);

  function eventsToNotes(evs: MIDIEvent[]): PianoNote[] {
    const noteStacks = new Map<number, MIDIEvent[]>();
    const result: PianoNote[] = [];
    
    const sortedEvents = [...evs].sort((a, b) => {
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
        const t = Math.round(noteOn.timestamp);
        result.push({
          id: 'n' + (nextIdRef.current++),
          t,
          dur: PPQ / 4,
          nn,
          vel: noteOn.velocity || 100,
          ch: noteOn.channel
        });
      });
    });

    return result.sort((a, b) => a.t - b.t);
  }

  function notesToEvents(nts: PianoNote[]): MIDIEvent[] {
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
  }

  const resize = useCallback(() => {
    if (!wrapRef.current || !gridRef.current || !pianoRef.current || !overlayRef.current) return;
    
    const { clientWidth: w, clientHeight: h } = wrapRef.current;
    
    [gridRef.current, pianoRef.current, overlayRef.current].forEach(canvas => {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    });
    
    draw();
  }, [dpr, barsVisible, keysVisible, scrollTicks, scrollKey, notes, selection, hover, currentPosition]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  function barsToPx() {
    if (!gridRef.current) return 0;
    return (gridRef.current.width - PIANO_WIDTH * dpr) / barsVisible;
  }

  function ticksToX(t: number) {
    const pxPerBar = barsToPx();
    const rel = (t - scrollTicks) / TICKS_PER_BAR;
    return Math.round(PIANO_WIDTH * dpr + rel * pxPerBar);
  }

  function xToTicks(x: number) {
    const pxPerBar = barsToPx();
    const rel = (x - PIANO_WIDTH * dpr) / pxPerBar;
    return Math.round(scrollTicks + rel * TICKS_PER_BAR);
  }

  function keyHeight() {
    if (!gridRef.current) return 0;
    return gridRef.current.height / keysVisible;
  }

  function nnToY(nn: number) {
    if (!gridRef.current) return 0;
    const rel = nn - scrollKey;
    return Math.round(gridRef.current.height - (rel + 1) * keyHeight());
  }

  function yToNN(y: number) {
    if (!gridRef.current) return 60;
    const rel = Math.floor((gridRef.current.height - y) / keyHeight());
    return scrollKey + rel;
  }

  function snapTicks(t: number, bypass = false) {
    if (bypass || snapDiv === 0) return t;
    return Math.round(t / snapDiv) * snapDiv;
  }

  function isBlack(nn: number) {
    return [1, 3, 6, 8, 10].includes(nn % 12);
  }

  function noteAt(x: number, y: number) {
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
  }

  function drawGrid() {
    if (!gridRef.current) return;
    const ctx = gridRef.current.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, gridRef.current.width, gridRef.current.height);

    ctx.fillStyle = 'hsl(220, 6%, 18%)';
    ctx.fillRect(0, 0, gridRef.current.width, gridRef.current.height);

    const pxPerBar = barsToPx();
    const startBar = Math.floor(scrollTicks / TICKS_PER_BAR);
    const endBar = startBar + barsVisible + 1;

    for (let bar = startBar; bar <= endBar; bar++) {
      const x = Math.round(PIANO_WIDTH * dpr + (bar - startBar) * pxPerBar);
      
      ctx.strokeStyle = 'rgba(155, 242, 107, 0.3)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, gridRef.current.height);
      ctx.stroke();

      for (let beat = 1; beat < BEATS_PER_BAR; beat++) {
        const xb = Math.round(x + beat * (pxPerBar / BEATS_PER_BAR));
        ctx.strokeStyle = 'rgba(155, 242, 107, 0.15)';
        ctx.beginPath();
        ctx.moveTo(xb, 0);
        ctx.lineTo(xb, gridRef.current.height);
        ctx.stroke();
      }

      ctx.fillStyle = 'hsl(220, 15%, 60%)';
      ctx.font = `${12 * dpr}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(bar + 1), x + 4 * dpr, 4 * dpr);
    }

    const kh = keyHeight();
    for (let i = 0; i < keysVisible; i++) {
      const nn = scrollKey + i;
      const y = Math.round(gridRef.current.height - (i + 1) * kh);
      ctx.fillStyle = isBlack(nn) ? 'hsl(220, 10%, 12%)' : 'hsl(220, 6%, 18%)';
      ctx.fillRect(PIANO_WIDTH * dpr, y, gridRef.current.width - PIANO_WIDTH * dpr, kh);
    }

    ctx.restore();
  }

  function drawPiano() {
    if (!pianoRef.current) return;
    const ctx = pianoRef.current.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, pianoRef.current.width, pianoRef.current.height);
    
    const kh = keyHeight();
    ctx.fillStyle = 'hsl(220, 10%, 12%)';
    ctx.fillRect(0, 0, PIANO_WIDTH * dpr, pianoRef.current.height);

    for (let i = 0; i < keysVisible; i++) {
      const nn = scrollKey + i;
      const y = Math.round(pianoRef.current.height - (i + 1) * kh);
      
      ctx.fillStyle = isBlack(nn) ? 'hsl(220, 10%, 8%)' : 'hsl(220, 6%, 15%)';
      ctx.fillRect(0, y, PIANO_WIDTH * dpr, kh);

      if (nn % 12 === 0) {
        ctx.fillStyle = 'hsl(220, 15%, 80%)';
        ctx.font = `${11 * dpr}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const octave = Math.floor(nn / 12) - 1;
        ctx.fillText('C' + octave, 6 * dpr, y + kh / 2);
      }

      ctx.strokeStyle = 'hsl(220, 10%, 5%)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(PIANO_WIDTH * dpr, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawNotes() {
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
      
      ctx.fillStyle = sel ? 'hsl(30, 90%, 50%)' : 'hsl(var(--primary))';
      roundRect(ctx, x, y + 3, w, Math.max(6, kh - 6), r);
      ctx.fill();
      
      ctx.fillStyle = 'hsl(220, 15%, 15%)';
      ctx.fillRect(x + w - 3 * dpr, y + 3, 3 * dpr, Math.max(6, kh - 6));
    }

    if (hover && hover.note) {
      const n = hover.note;
      const x = ticksToX(n.t);
      const w = Math.max(4, ticksToX(n.t + n.dur) - x);
      const y = nnToY(n.nn);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2 * dpr;
      roundRect(ctx, x - 1, y + 2, w + 2, Math.max(6, kh - 4), r);
      ctx.stroke();
    }

    if (currentPosition > 0) {
      const x = ticksToX(currentPosition);
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, overlayRef.current.height);
      ctx.stroke();
    }

    ctx.restore();
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    drawGrid();
    drawPiano();
    drawNotes();
  }

  useEffect(() => {
    draw();
  }, [notes, selection, hover, barsVisible, keysVisible, scrollTicks, scrollKey, currentPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;
    
    setHover(noteAt(x, y));

    if (isMouseDown && dragging) {
      const { mode, note, startX, startY, startT, startSelSnapshot } = dragging;
      
      if (mode === 'move' || mode === 'draw-move') {
        const dtTicks = Math.round((x - startX) / (barsToPx() / TICKS_PER_BAR));
        const dnn = Math.round((startY - y) / keyHeight());
        
        setNotes(prev => prev.map(n => {
          if (selection.has(n.id) && startSelSnapshot[n.id]) {
            let newT = startSelSnapshot[n.id].t + dtTicks;
            if (!e.altKey) newT = snapTicks(newT);
            return { ...n, t: Math.max(0, newT), nn: startSelSnapshot[n.id].nn + dnn };
          }
          return n;
        }));
      } else if (mode === 'resize') {
        let t2 = xToTicks(x);
        if (!e.altKey) t2 = snapTicks(t2);
        const newDur = Math.max(2, t2 - startT);
        setNotes(prev => prev.map(n => n === note ? { ...n, dur: newDur } : n));
      } else if (mode === 'draw') {
        let t2 = xToTicks(x);
        if (!e.altKey) t2 = snapTicks(t2);
        const newDur = Math.max(2, t2 - startT);
        setNotes(prev => prev.map(n => n === note ? { ...n, dur: newDur } : n));
      }
    }
  }, [isMouseDown, dragging, dpr, selection, snapDiv]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
      if (!hit) {
        let t = xToTicks(x);
        const nn = yToNN(y);
        if (!e.altKey) t = snapTicks(t);
        const newNote: PianoNote = {
          id: 'n' + (nextIdRef.current++),
          t: Math.max(0, t),
          dur: snapDiv || 12,
          nn,
          vel: 96,
          ch: 0
        };
        setNotes(prev => [...prev, newNote]);
        setSelection(new Set([newNote.id]));
        setDragging({
          mode: 'draw',
          note: newNote,
          startX: x,
          startY: y,
          startT: newNote.t,
          startDur: newNote.dur,
          startNN: newNote.nn,
          startSelSnapshot: { [newNote.id]: { t: newNote.t, nn: newNote.nn } }
        });
      }
      return;
    }

    if (tool === 'select') {
      if (hit) {
        if (hit.edge) {
          setDragging({
            mode: 'resize',
            note: hit.note,
            startX: x,
            startY: y,
            startT: hit.note.t,
            startDur: hit.note.dur,
            startNN: hit.note.nn,
            startSelSnapshot: {}
          });
        } else {
          if (!selection.has(hit.note.id) && !e.shiftKey) {
            setSelection(new Set([hit.note.id]));
          } else if (e.shiftKey) {
            setSelection(prev => {
              const next = new Set(prev);
              if (next.has(hit.note.id)) {
                next.delete(hit.note.id);
              } else {
                next.add(hit.note.id);
              }
              return next;
            });
          }
          
          const snapshot: Record<string, { t: number; nn: number }> = {};
          notes.forEach(n => {
            if (selection.has(n.id) || n === hit.note) {
              snapshot[n.id] = { t: n.t, nn: n.nn };
            }
          });
          
          setDragging({
            mode: 'move',
            note: hit.note,
            startX: x,
            startY: y,
            startT: hit.note.t,
            startDur: hit.note.dur,
            startNN: hit.note.nn,
            startSelSnapshot: snapshot
          });
        }
      } else {
        setSelection(new Set());
      }
    }
  }, [tool, dpr, selection, notes, snapDiv]);

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
    setDragging(null);
    onEventsChange(notesToEvents(notes));
  }, [notes, onEventsChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (e.shiftKey) {
      setBarsVisible(prev => Math.max(4, Math.min(64, prev + (e.deltaY > 0 ? 1 : -1))));
    } else if (e.altKey) {
      setScrollTicks(prev => Math.max(0, prev + (e.deltaY > 0 ? TICKS_PER_BAR : -TICKS_PER_BAR)));
    } else {
      setScrollKey(prev => Math.max(0, Math.min(108, prev + (e.deltaY > 0 ? -1 : 1))));
    }
  }, []);

  const handleQuantize = () => {
    setNotes(prev => prev.map(n => {
      if (selection.has(n.id)) {
        return { ...n, t: snapTicks(n.t) };
      }
      return n;
    }));
    onEventsChange(notesToEvents(notes));
  };

  const handleDelete = () => {
    setNotes(prev => prev.filter(n => !selection.has(n.id)));
    setSelection(new Set());
    onEventsChange(notesToEvents(notes.filter(n => !selection.has(n.id))));
  };

  return (
    <div className="flex flex-col h-full bg-hardware-bg">
      <div className="flex items-center gap-3 px-3 py-2 bg-hardware-panel border-b border-hardware-accent/30 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <label className="text-xs text-hardware-text flex items-center gap-1">
            Tool
            <select 
              value={tool} 
              onChange={(e) => setTool(e.target.value as Tool)}
              className="bg-hardware-bg text-hardware-text border border-hardware-accent/30 rounded px-2 py-1 text-xs"
              data-testid="select-tool"
            >
              <option value="select">Select (V)</option>
              <option value="draw">Draw (B)</option>
              <option value="erase">Erase (E)</option>
            </select>
          </label>
          
          <label className="text-xs text-hardware-text flex items-center gap-1">
            Snap
            <select 
              value={snapDiv} 
              onChange={(e) => setSnapDiv(Number(e.target.value))}
              className="bg-hardware-bg text-hardware-text border border-hardware-accent/30 rounded px-2 py-1 text-xs"
              data-testid="select-snap"
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
            </select>
          </label>

          <label className="text-xs text-hardware-text flex items-center gap-1">
            Zoom X
            <input 
              type="number" 
              min="4" 
              max="64" 
              value={barsVisible}
              onChange={(e) => setBarsVisible(Number(e.target.value))}
              className="bg-hardware-bg text-hardware-text border border-hardware-accent/30 rounded px-2 py-1 text-xs w-16"
              data-testid="input-zoom-x"
            />
          </label>

          <label className="text-xs text-hardware-text flex items-center gap-1">
            Zoom Y
            <input 
              type="number" 
              min="8" 
              max="64" 
              value={keysVisible}
              onChange={(e) => setKeysVisible(Number(e.target.value))}
              className="bg-hardware-bg text-hardware-text border border-hardware-accent/30 rounded px-2 py-1 text-xs w-16"
              data-testid="input-zoom-y"
            />
          </label>

          <button 
            onClick={handleQuantize}
            disabled={selection.size === 0}
            className="bg-hardware-panel text-hardware-text border border-hardware-accent/30 rounded px-3 py-1 text-xs hover-elevate active-elevate-2 disabled:opacity-50"
            data-testid="button-quantize"
          >
            Quantize (Q)
          </button>

          <button 
            onClick={handleDelete}
            disabled={selection.size === 0}
            className="bg-hardware-panel text-hardware-led-red border border-hardware-accent/30 rounded px-3 py-1 text-xs hover-elevate active-elevate-2 disabled:opacity-50"
            data-testid="button-delete"
          >
            Delete
          </button>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          Drag to move • Edge-drag to trim • Alt = no snap • Alt+Wheel = scroll time • Shift+Wheel = zoom X
        </div>
      </div>

      <div ref={wrapRef} className="relative flex-1">
        <canvas 
          ref={gridRef} 
          className="absolute left-0 top-0" 
          data-testid="canvas-grid"
        />
        <canvas 
          ref={pianoRef} 
          className="absolute left-0 top-0" 
          data-testid="canvas-piano"
        />
        <canvas 
          ref={overlayRef} 
          className="absolute left-0 top-0 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          data-testid="canvas-overlay"
        />
      </div>
    </div>
  );
}
