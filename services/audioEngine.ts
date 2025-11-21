

import { MixerSettings } from '../types';

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  
  // The active input source (Mic or File)
  private currentSourceNode: AudioNode | null = null;

  // Core Chain Nodes (Static Graph)
  private inputGainNode: GainNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  
  // Pitch / Autotune Simulation Nodes
  private pitchInputNode: GainNode | null = null;
  private pitchOutputNode: GainNode | null = null;
  private pitchDryGain: GainNode | null = null;
  private pitchWetGain: GainNode | null = null;
  private delay1: DelayNode | null = null;
  private delay2: DelayNode | null = null;
  private fade1: GainNode | null = null;
  private fade2: GainNode | null = null;
  private mod1: OscillatorNode | null = null;
  private mod2: OscillatorNode | null = null;
  private modGain1: GainNode | null = null;
  private modGain2: GainNode | null = null;
  
  private lowEQ: BiquadFilterNode | null = null;
  private midEQ: BiquadFilterNode | null = null;
  private highEQ: BiquadFilterNode | null = null;
  private airFilter: BiquadFilterNode | null = null; // Air Effect
  
  private compressor: DynamicsCompressorNode | null = null;
  
  // 3D / Width Nodes
  private widthInputGain: GainNode | null = null;
  private widthFilter: BiquadFilterNode | null = null;
  private widthSplitter: ChannelSplitterNode | null = null;
  private widthDelayL: DelayNode | null = null;
  private widthDelayR: DelayNode | null = null;
  private widthMerger: ChannelMergerNode | null = null;
  
  private masterGain: GainNode | null = null;
  private monitorGain: GainNode | null = null;
  private monitorDelayNode: DelayNode | null = null; 
  private analyser: AnalyserNode | null = null;
  
  // FX Sends
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackNode: GainNode | null = null;
  private delayGain: GainNode | null = null;

  // Recording & Destinations
  private recorderDestination: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordedBlob: Blob | null = null;
  private recordedAudioUrl: string | null = null;

  // Backing Track
  private backingBuffer: AudioBuffer | null = null;
  private backingSource: AudioBufferSourceNode | null = null;
  private backingGain: GainNode | null = null; 

  // Vocal Track (File Input)
  private vocalBuffer: AudioBuffer | null = null;
  private vocalFileSource: AudioBufferSourceNode | null = null;

  // State
  public isInitialized = false;
  private currentPitchShift: number = 0;
  private lastSettings: MixerSettings | null = null;
  public currentLatencyMode: 'interactive' | 'balanced' = 'interactive';

  constructor() {}

  async init(latencyHint: 'interactive' | 'balanced' = 'interactive') {
    if (this.isInitialized && this.currentLatencyMode === latencyHint && this.audioContext?.state !== 'closed') return;
    
    // Close existing context if re-initializing
    if (this.audioContext) {
        try {
            await this.audioContext.close();
        } catch(e) { console.warn("Error closing context", e); }
    }

    this.currentLatencyMode = latencyHint;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({
        latencyHint: latencyHint,
        sampleRate: 48000 
    });
    
    // --- 1. Create All Nodes ---
    this.inputGainNode = this.audioContext.createGain();
    
    // High Pass
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 10;
    this.highPassFilter.Q.value = 0.7;

    // Pitch Shifter Group
    this.pitchInputNode = this.audioContext.createGain();
    this.pitchOutputNode = this.audioContext.createGain();
    this.setupPitchShifterNodes(); 

    // EQ
    this.lowEQ = this.audioContext.createBiquadFilter();
    this.lowEQ.type = 'lowshelf';
    this.lowEQ.frequency.value = 320;

    this.midEQ = this.audioContext.createBiquadFilter();
    this.midEQ.type = 'peaking';
    this.midEQ.frequency.value = 1000;
    this.midEQ.Q.value = 1;

    this.highEQ = this.audioContext.createBiquadFilter();
    this.highEQ.type = 'highshelf';
    this.highEQ.frequency.value = 3200;

    // AIR EFFECT Node (High Shelf at 12kHz)
    this.airFilter = this.audioContext.createBiquadFilter();
    this.airFilter.type = 'highshelf';
    this.airFilter.frequency.value = 12000; // 12kHz
    this.airFilter.gain.value = 0; // Default off

    // Dynamics
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    
    // 3D EFFECT (Haas Widener)
    this.widthInputGain = this.audioContext.createGain();
    this.widthInputGain.gain.value = 0; // Default off
    
    this.widthFilter = this.audioContext.createBiquadFilter();
    this.widthFilter.type = 'highpass';
    this.widthFilter.frequency.value = 300; // Only widen mids/highs
    
    this.widthSplitter = this.audioContext.createChannelSplitter(2);
    this.widthDelayL = this.audioContext.createDelay();
    this.widthDelayR = this.audioContext.createDelay();
    this.widthDelayL.delayTime.value = 0.010; // 10ms left
    this.widthDelayR.delayTime.value = 0.020; // 20ms right
    this.widthMerger = this.audioContext.createChannelMerger(2);

    // Spatial
    this.reverbNode = this.audioContext.createConvolver();
    this.reverbGain = this.audioContext.createGain();
    await this.createReverbImpulse();

    this.delayNode = this.audioContext.createDelay(2.0);
    this.delayFeedbackNode = this.audioContext.createGain();
    this.delayGain = this.audioContext.createGain();

    // Master, Monitor, Backing
    this.masterGain = this.audioContext.createGain();
    
    this.monitorGain = this.audioContext.createGain();
    this.monitorGain.gain.value = 0; 
    
    this.monitorDelayNode = this.audioContext.createDelay(1.0); 
    this.monitorDelayNode.delayTime.value = 0;

    this.backingGain = this.audioContext.createGain();

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Recorder
    this.recorderDestination = this.audioContext.createMediaStreamDestination();
    this.mediaRecorder = new MediaRecorder(this.recorderDestination.stream);
    this.audioChunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };
    this.mediaRecorder.onstop = () => {
      this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.recordedAudioUrl = URL.createObjectURL(this.recordedBlob);
    };

    // --- 2. Build Static Graph (Permanent Connections) ---
    // Chain: InputGain -> HighPass -> PitchGroup -> LowEQ -> MidEQ -> HighEQ -> AirFilter -> Compressor -> Master
    
    this.inputGainNode.connect(this.highPassFilter);
    this.highPassFilter.connect(this.pitchInputNode);
    
    this.pitchOutputNode.connect(this.lowEQ);
    
    this.lowEQ.connect(this.midEQ);
    this.midEQ.connect(this.highEQ);
    this.highEQ.connect(this.airFilter); // Connect HighEQ to Air
    this.airFilter.connect(this.compressor); // Connect Air to Compressor
    
    // FX Sends (Parallel Processing)
    // 1. Reverb Send (from Compressor output)
    this.compressor.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // 2. Delay Send (from Compressor output)
    this.compressor.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedbackNode);
    this.delayFeedbackNode.connect(this.delayNode); // Feedback Loop
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.masterGain);
    
    // 3. 3D / Width Send (Parallel)
    this.compressor.connect(this.widthInputGain);
    this.widthInputGain.connect(this.widthFilter);
    this.widthFilter.connect(this.widthSplitter);
    
    // Splitter L -> Delay L -> Merger L
    this.widthSplitter.connect(this.widthDelayL, 0);
    this.widthDelayL.connect(this.widthMerger, 0, 0);
    
    // Splitter R -> Delay R -> Merger R
    this.widthSplitter.connect(this.widthDelayR, 1);
    this.widthDelayR.connect(this.widthMerger, 0, 1);
    
    this.widthMerger.connect(this.masterGain);

    // Dry Signal (Compressor -> Master)
    this.compressor.connect(this.masterGain);

    // --- 3. Outputs ---
    
    // Master -> Analyser (Visualizer)
    this.masterGain.connect(this.analyser);
    
    // Master -> Recorder (Always record the mix)
    this.masterGain.connect(this.recorderDestination);

    // Master -> Monitor Delay -> Monitor Gain -> Speakers
    this.masterGain.connect(this.monitorDelayNode);
    this.monitorDelayNode.connect(this.monitorGain);
    this.monitorGain.connect(this.audioContext.destination);

    // Backing Track Routing (Bypass FX)
    this.backingGain.connect(this.audioContext.destination);
    this.backingGain.connect(this.recorderDestination);
    this.backingGain.connect(this.analyser);

    this.isInitialized = true;
    
    // Restore previous settings if they exist
    if (this.lastSettings) {
        this.updateSettings(this.lastSettings);
    }
  }

  async setLatencyMode(mode: 'interactive' | 'balanced') {
      if (this.currentLatencyMode === mode && this.audioContext?.state === 'running') return;
      
      const wasMonitoring = this.monitorGain && this.monitorGain.gain.value > 0;
      const wasMicActive = !!this.currentSourceNode && !this.vocalFileSource; 
      
      // Re-initialize with new mode
      await this.init(mode);
      
      // Restart Mic if it was active to apply new context
      if (wasMicActive) {
         await this.startInput(wasMonitoring);
      }
  }

  setMonitorDelay(seconds: number) {
      if (this.audioContext && this.monitorDelayNode) {
          const now = this.audioContext.currentTime;
          this.monitorDelayNode.delayTime.setTargetAtTime(seconds, now, 0.1);
      }
  }

  private setupPitchShifterNodes() {
    if (!this.audioContext) return;

    this.pitchDryGain = this.audioContext.createGain();
    this.pitchWetGain = this.audioContext.createGain();
    
    // Default to Dry
    this.pitchDryGain.gain.value = 1;
    this.pitchWetGain.gain.value = 0;

    // Dry Path
    this.pitchInputNode!.connect(this.pitchDryGain!);
    this.pitchDryGain!.connect(this.pitchOutputNode!);

    // Wet Path Nodes
    const bufferTime = 0.1;
    this.delay1 = this.audioContext.createDelay(1);
    this.delay2 = this.audioContext.createDelay(1);
    this.fade1 = this.audioContext.createGain();
    this.fade2 = this.audioContext.createGain();
    
    this.mod1 = this.audioContext.createOscillator();
    this.mod2 = this.audioContext.createOscillator();
    this.modGain1 = this.audioContext.createGain();
    this.modGain2 = this.audioContext.createGain();

    this.mod1.type = 'sawtooth';
    this.mod2.type = 'sawtooth';
    this.mod1.frequency.value = 1 / bufferTime;
    this.mod2.frequency.value = 1 / bufferTime;

    // Start Oscillators immediately so they are ready
    this.mod1.start();
    this.mod2.start();

    // Connections
    this.pitchInputNode!.connect(this.pitchWetGain!);
    this.pitchWetGain!.connect(this.delay1);
    this.pitchWetGain!.connect(this.delay2);

    this.delay1.connect(this.fade1);
    this.delay2.connect(this.fade2);
    this.fade1.connect(this.pitchOutputNode!);
    this.fade2.connect(this.pitchOutputNode!);

    this.mod1.connect(this.modGain1);
    this.mod2.connect(this.modGain2);
    this.modGain1.connect(this.delay1.delayTime);
    this.modGain2.connect(this.delay2.delayTime);
    
    // Ensure fades are open
    this.fade1.gain.value = 0;
    this.fade2.gain.value = 0; 
  }

  private updatePitchShifterState(semitones: number) {
      if (!this.audioContext || !this.modGain1 || !this.modGain2) return;

      if (semitones === 0) {
          this.modGain1.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
          this.modGain2.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.1);
          if (this.fade1) this.fade1.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
          if (this.fade2) this.fade2.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
          return;
      }
      
      // Pitch Shifting Logic (Grain Delay)
      const bufferTime = 0.1; 
      const frequency = 1 / bufferTime;
      const ratio = Math.pow(2, semitones / 12);
      const newRate = (1 - ratio) * frequency;

      if(this.mod1) this.mod1.frequency.setTargetAtTime(newRate, this.audioContext.currentTime, 0.1);
      if(this.mod2) this.mod2.frequency.setTargetAtTime(newRate, this.audioContext.currentTime, 0.1);
  }

  async startInput(monitor: boolean = false) {
    await this.ensureContext();

    // 1. Cleanup previous source
    if (this.currentSourceNode) {
        this.currentSourceNode.disconnect();
        this.currentSourceNode = null;
    }
    
    // 2. Stop any file playback behaving as input
    this.stopVocal();

    // 3. Get Mic Stream
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false, 
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0
        } as any
      });
      
      // 4. Create Source and Connect to Static Graph
      const micSource = this.audioContext!.createMediaStreamSource(this.stream);
      micSource.connect(this.inputGainNode!);
      this.currentSourceNode = micSource;
      
      // 5. Set Monitor State
      this.setMonitor(monitor);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err;
    }
  }

  setMonitor(enabled: boolean) {
    if (!this.audioContext || !this.monitorGain) return;
    
    // Safe resume
    if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
    }
    
    const now = this.audioContext.currentTime;
    this.monitorGain.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.1);
  }

  async loadBackingTrack(file: File) {
    await this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    this.backingBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
  }

  async loadVocalTrack(file: File) {
    await this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    this.vocalBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
  }

  playBacking(loop: boolean = false) {
    if (!this.audioContext || !this.backingBuffer || !this.backingGain) return;
    this.stopBacking();
    
    this.backingSource = this.audioContext.createBufferSource();
    this.backingSource.buffer = this.backingBuffer;
    this.backingSource.loop = loop;
    
    this.backingSource.connect(this.backingGain);
    this.backingSource.start();
  }

  stopBacking() {
    if (this.backingSource) {
      try {
        this.backingSource.stop();
        this.backingSource.disconnect();
      } catch (e) {}
      this.backingSource = null;
    }
  }

  playVocal(monitor: boolean = true) {
    if (!this.audioContext || !this.vocalBuffer) return;
    
    if (this.currentSourceNode) {
        this.currentSourceNode.disconnect();
        this.currentSourceNode = null;
    }
    this.stopVocal();

    this.vocalFileSource = this.audioContext.createBufferSource();
    this.vocalFileSource.buffer = this.vocalBuffer;
    
    if (this.currentPitchShift !== 0) {
        this.vocalFileSource.detune.value = this.currentPitchShift * 100;
    }

    this.vocalFileSource.connect(this.inputGainNode!);
    this.currentSourceNode = this.vocalFileSource;
    
    this.vocalFileSource.start();
    this.setMonitor(monitor);
    
    this.vocalFileSource.onended = () => {
        this.currentSourceNode = null;
    };
  }

  stopVocal() {
    if (this.vocalFileSource) {
      try {
        this.vocalFileSource.stop();
        this.vocalFileSource.disconnect();
      } catch (e) {}
      this.vocalFileSource = null;
    }
  }

  updateSettings(settings: MixerSettings) {
    this.lastSettings = settings; // Save for restore

    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    this.currentPitchShift = settings.pitchShift;

    if (this.inputGainNode) {
      const linearGain = Math.pow(10, settings.inputGain / 20);
      this.inputGainNode.gain.setTargetAtTime(linearGain, now, 0.1);
    }

    if (this.highPassFilter) {
      const freq = settings.highPass ? 100 : 10;
      this.highPassFilter.frequency.setTargetAtTime(freq, now, 0.1);
    }

    if (this.pitchDryGain && this.pitchWetGain) {
        const wet = settings.autotuneAmount;
        this.pitchWetGain.gain.setTargetAtTime(wet, now, 0.1);
        this.pitchDryGain.gain.setTargetAtTime(1 - wet, now, 0.1);
        this.updatePitchShifterState(settings.pitchShift);
    }
    
    if (this.vocalFileSource) {
        this.vocalFileSource.detune.setTargetAtTime(settings.pitchShift * 100, now, 0.1);
    }

    if (this.lowEQ) this.lowEQ.gain.setTargetAtTime(settings.lowGain, now, 0.1);
    if (this.midEQ) this.midEQ.gain.setTargetAtTime(settings.midGain, now, 0.1);
    if (this.highEQ) this.highEQ.gain.setTargetAtTime(settings.highGain, now, 0.1);
    
    // AIR EFFECT Control
    if (this.airFilter) {
        // 5dB boost at 12kHz creates a nice "Air"
        const airGain = settings.airMode ? 5 : 0;
        this.airFilter.gain.setTargetAtTime(airGain, now, 0.1);
    }
    
    // 3D SPATIAL Control
    if (this.widthInputGain) {
        // 0.5 gain mixed in creates a nice widening effect without overpowering center
        const widthVal = settings.spatial3D ? 0.5 : 0;
        this.widthInputGain.gain.setTargetAtTime(widthVal, now, 0.1);
    }
    
    if (this.compressor) {
      this.compressor.threshold.setTargetAtTime(settings.compressorThreshold, now, 0.1);
      this.compressor.ratio.setTargetAtTime(settings.compressorRatio, now, 0.1);
    }

    if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(settings.reverbMix, now, 0.1);
    
    if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(settings.delayTime, now, 0.1);
    if (this.delayFeedbackNode) this.delayFeedbackNode.gain.setTargetAtTime(settings.delayFeedback, now, 0.1);
    if (this.delayGain) this.delayGain.gain.setTargetAtTime(settings.delayMix, now, 0.1);

    if (this.masterGain) this.masterGain.gain.setTargetAtTime(settings.outputGain, now, 0.1);
  }

  startRecording() {
    this.ensureContext();
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      this.audioChunks = [];
      this.mediaRecorder.start();
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  getAnalyser() {
    return this.analyser;
  }

  getRecordedUrl() {
    return this.recordedAudioUrl;
  }
  
  resume() {
      if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume();
      }
  }

  // New: Analyze Audio Spectrum for AI
  async analyzeAudioProfile(durationMs: number = 3000): Promise<{ low: number, mid: number, high: number, rms: number }> {
      if (!this.analyser) return { low: 0, mid: 0, high: 0, rms: 0 };

      const sampleCount = Math.floor(durationMs / 100);
      let lows = 0, mids = 0, highs = 0, rmsSum = 0;
      
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      return new Promise((resolve) => {
          let currentSample = 0;
          const interval = setInterval(() => {
              if (!this.analyser) { clearInterval(interval); resolve({low:0, mid:0, high:0, rms:0}); return; }
              
              this.analyser.getByteFrequencyData(dataArray);
              
              // Frequency ranges (approx based on 2048 fft size & 48k rate)
              // Bin width approx 23Hz
              const lowEnd = Math.floor(300 / 23);
              const midEnd = Math.floor(2000 / 23);
              
              let l=0, m=0, h=0, total=0;

              for(let i=0; i<bufferLength; i++) {
                  const val = dataArray[i];
                  total += val;
                  if (i < lowEnd) l += val;
                  else if (i < midEnd) m += val;
                  else h += val;
              }

              lows += l / lowEnd;
              mids += m / (midEnd - lowEnd);
              highs += h / (bufferLength - midEnd);
              rmsSum += (total / bufferLength);

              currentSample++;
              if (currentSample >= sampleCount) {
                  clearInterval(interval);
                  resolve({
                      low: lows / sampleCount,
                      mid: mids / sampleCount,
                      high: highs / sampleCount,
                      rms: rmsSum / sampleCount
                  });
              }
          }, 100);
      });
  }

  private async ensureContext() {
      if (!this.isInitialized || !this.audioContext) {
          await this.init(this.currentLatencyMode);
      }
      if (this.audioContext?.state === 'suspended') {
          await this.audioContext.resume();
      }
  }

  private async createReverbImpulse() {
    if (!this.audioContext || !this.reverbNode) return;
    const duration = 2.0;
    const decay = 2.0;
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i;
      const e = Math.pow(1 - n / length, decay);
      left[i] = (Math.random() * 2 - 1) * e;
      right[i] = (Math.random() * 2 - 1) * e;
    }
    this.reverbNode.buffer = impulse;
  }
}

export const audioEngine = new AudioEngine();