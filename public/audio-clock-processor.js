class AudioClockProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tempo = 120;
    this.isPlaying = false;
    this.ticksPerBeat = 24; // MIDI clock standard
    this.sampleRate = 44100;
    this.samplesPerTick = this.calculateSamplesPerTick();
    this.sampleCounter = 0;
    this.tickCounter = 0;
    this.barCounter = 0;
    this.beatCounter = 0;
    this.metronomeEnabled = false;
    this.countIn = 0;
    
    this.port.onmessage = (e) => {
      const { type, data } = e.data;
      
      switch (type) {
        case 'setTempo':
          this.tempo = data;
          this.samplesPerTick = this.calculateSamplesPerTick();
          break;
        case 'start':
          this.isPlaying = true;
          this.sampleCounter = 0;
          this.tickCounter = 0;
          this.beatCounter = 0;
          this.barCounter = 0;
          break;
        case 'stop':
          this.isPlaying = false;
          break;
        case 'setMetronome':
          this.metronomeEnabled = data;
          break;
        case 'setCountIn':
          this.countIn = data;
          break;
      }
    };
  }
  
  calculateSamplesPerTick() {
    // samples per tick = (sample_rate * 60) / (tempo * ticks_per_beat)
    return (this.sampleRate * 60) / (this.tempo * this.ticksPerBeat);
  }
  
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];
    
    if (!this.isPlaying) {
      return true;
    }
    
    for (let i = 0; i < channel.length; i++) {
      this.sampleCounter++;
      
      if (this.sampleCounter >= this.samplesPerTick) {
        this.sampleCounter -= this.samplesPerTick;
        this.tickCounter++;
        
        // Every 24 ticks = 1 beat
        if (this.tickCounter % this.ticksPerBeat === 0) {
          this.beatCounter++;
          
          // Send beat event
          this.port.postMessage({
            type: 'beat',
            beat: this.beatCounter,
            bar: this.barCounter,
            timestamp: currentTime
          });
          
          // Metronome click on beat
          if (this.metronomeEnabled) {
            this.port.postMessage({
              type: 'metronome',
              accent: (this.beatCounter % 4) === 1
            });
          }
          
          // Every 4 beats = 1 bar
          if (this.beatCounter % 4 === 0) {
            this.barCounter++;
            this.port.postMessage({
              type: 'bar',
              bar: this.barCounter,
              timestamp: currentTime
            });
          }
        }
        
        // Send tick event for MIDI scheduling
        this.port.postMessage({
          type: 'tick',
          tick: this.tickCounter,
          timestamp: currentTime
        });
      }
      
      // Simple metronome tone generation (optional)
      if (this.metronomeEnabled) {
        channel[i] = 0; // Audio output not used in this implementation
      }
    }
    
    return true;
  }
}

registerProcessor('audio-clock-processor', AudioClockProcessor);
