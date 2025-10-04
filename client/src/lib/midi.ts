export class MIDIManager {
  private midiAccess: MIDIAccess | null = null;
  private inputs: MIDIInput[] = [];
  private outputs: MIDIOutput[] = [];
  private onMessage: ((event: MIDIMessageEvent) => void) | null = null;

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
      input.onmidimessage = callback;
    });
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
