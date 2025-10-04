export class MIDIManager {
  private midiAccess: MIDIAccess | null = null;
  private inputs: MIDIInput[] = [];
  private outputs: MIDIOutput[] = [];
  private onMessage: ((event: MIDIMessageEvent) => void) | null = null;
  private onClockReceived: ((tempo: number) => void) | null = null;
  private clockInterval: number | null = null;
  private lastClockTime = 0;
  private clockCount = 0;

  async initialize() {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this environment');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updatePorts();
      this.midiAccess.onstatechange = () => this.updatePorts();
      return true;
    } catch (error) {
      console.error('MIDI initialization failed:', error);
      return false;
    }
  }

  private updatePorts() {
    if (!this.midiAccess) return;

    this.inputs = Array.from(this.midiAccess.inputs.values());
    this.outputs = Array.from(this.midiAccess.outputs.values());
  }

  getInputs(): MIDIInput[] {
    return this.inputs;
  }

  getOutputs(): MIDIOutput[] {
    return this.outputs;
  }

  setInputListener(callback: (event: MIDIMessageEvent) => void) {
    this.onMessage = callback;
    this.inputs.forEach(input => {
      input.onmidimessage = (event) => {
        if (!event.data) return;
        
        // Handle MIDI clock messages
        if (event.data[0] === 0xF8) { // MIDI Clock
          this.handleClockMessage();
        } else if (event.data[0] === 0xFA) { // Start
          this.clockCount = 0;
        } else if (event.data[0] === 0xFC) { // Stop
          this.clockCount = 0;
        }
        
        callback(event);
      };
    });
  }

  private handleClockMessage() {
    const now = performance.now();
    this.clockCount++;
    
    // Calculate tempo every 24 clocks (1 quarter note)
    if (this.clockCount === 24) {
      if (this.lastClockTime > 0) {
        const interval = now - this.lastClockTime;
        const tempo = Math.round(60000 / interval);
        this.onClockReceived?.(tempo);
      }
      this.lastClockTime = now;
      this.clockCount = 0;
    }
  }

  setClockListener(callback: (tempo: number) => void) {
    this.onClockReceived = callback;
  }

  startClockSend(tempo: number, outputs: MIDIOutput[]) {
    this.stopClockSend();
    
    // MIDI Clock runs at 24 ppqn (pulses per quarter note)
    const interval = (60000 / tempo) / 24;
    
    // Send Start message
    outputs.forEach(output => output.send([0xFA]));
    
    this.clockInterval = window.setInterval(() => {
      outputs.forEach(output => output.send([0xF8])); // Clock pulse
    }, interval);
  }

  stopClockSend() {
    if (this.clockInterval !== null) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    
    // Send Stop message to all outputs
    this.outputs.forEach(output => output.send([0xFC]));
  }

  updateClockTempo(tempo: number) {
    // Restart with new tempo if currently sending
    if (this.clockInterval !== null) {
      const outputs = this.outputs;
      this.stopClockSend();
      this.startClockSend(tempo, outputs);
    }
  }

  sendMessage(output: MIDIOutput | null, data: Uint8Array, timestamp?: number) {
    if (!output) return;
    output.send(data, timestamp);
  }

  allNotesOff() {
    this.outputs.forEach(output => {
      for (let ch = 0; ch < 16; ch++) {
        output.send([0xB0 + ch, 123, 0]);
        output.send([0xB0 + ch, 64, 0]);
      }
    });
  }
}

export const midiManager = new MIDIManager();
