

export interface AudioState {
  isPlaying: boolean;
  isRecording: boolean;
  hasRecording: boolean;
  recordingDuration: number;
}

export type ScaleType = 'Chromatic' | 'Major' | 'Minor' | 'Bayati' | 'Hijaz' | 'Rast' | 'Kurd' | 'Saba' | 'Sika' | 'Ajam' | 'Nahawand';
export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export interface MixerSettings {
  // Input
  inputGain: number; // -12 to 12 (dB)
  highPass: boolean; // Low Cut Filter (100Hz)

  // Pitch & Tuning (Autotune)
  autotuneAmount: number; // 0 to 1 (Effect Wet/Dry)
  pitchShift: number; // -12 to 12 (Semitones)
  scale: ScaleType;
  musicalKey: MusicalKey;

  // EQ
  lowGain: number; // -15 to 15
  midGain: number; // -15 to 15
  highGain: number; // -15 to 15
  airMode: boolean; // High frequency sheen (12kHz boost)
  
  // Dynamics
  compressorThreshold: number; // -60 to 0
  compressorRatio: number; // 1 to 20
  
  // Spatial
  reverbMix: number; // 0 to 1
  delayMix: number; // 0 to 1 (Echo Volume)
  delayTime: number; // 0 to 1 (seconds)
  delayFeedback: number; // 0 to 0.9
  
  // Output
  outputGain: number; // 0 to 1.5
}

export const DEFAULT_MIXER_SETTINGS: MixerSettings = {
  inputGain: 0,
  highPass: false,
  autotuneAmount: 0,
  pitchShift: 0,
  scale: 'Chromatic',
  musicalKey: 'C',
  lowGain: 0,
  midGain: 0,
  highGain: 0,
  airMode: false,
  compressorThreshold: -24,
  compressorRatio: 4,
  reverbMix: 0.1,
  delayMix: 0.2,
  delayTime: 0.3,
  delayFeedback: 0.3,
  outputGain: 1.0,
};

export interface Preset {
  name: string;
  description: string;
  settings: MixerSettings;
}

export const MAQAMAT_INFO: Record<ScaleType, string> = {
  'Chromatic': 'Standard 12-tone',
  'Major': 'Happy, Bright',
  'Minor': 'Sad, Emotional',
  'Bayati': 'Folk, Deep, Classic Arabic',
  'Hijaz': 'Exotic, Mystical, Desert',
  'Rast': 'Pride, Power, Fundamental',
  'Kurd': 'Romantic, Soft, Modern',
  'Saba': 'Sadness, Pain, Longing',
  'Sika': 'Love, Quarter-tone depth',
  'Ajam': 'Major-like, Bold',
  'Nahawand': 'Emotional, Minor-like'
};

export const ARTIST_PRESETS: Preset[] = [
  {
    name: "Trap Star Auto",
    description: "Crisp highs, heavy compression, short delay. (Like Travis/Future)",
    settings: {
      ...DEFAULT_MIXER_SETTINGS,
      highPass: true,
      highGain: 8,
      lowGain: -2,
      airMode: true,
      autotuneAmount: 0.8,
      pitchShift: -2,
      compressorThreshold: -30,
      compressorRatio: 8,
      reverbMix: 0.15,
      delayMix: 0.3,
      delayTime: 0.25,
      delayFeedback: 0.4,
      outputGain: 1.1
    }
  },
  {
    name: "Pop Diva",
    description: "Clean, airy vocals with lush reverb. (Like Adele/Ariana)",
    settings: {
      ...DEFAULT_MIXER_SETTINGS,
      highPass: true,
      midGain: -2,
      highGain: 4,
      airMode: true,
      autotuneAmount: 0.1,
      compressorThreshold: -20,
      compressorRatio: 3,
      reverbMix: 0.4,
      delayMix: 0.05,
      outputGain: 1.0
    }
  },
  {
    name: "Vintage Radio",
    description: "Mid-range focus, distorted lo-fi effect.",
    settings: {
      ...DEFAULT_MIXER_SETTINGS,
      highPass: true,
      lowGain: -15,
      highGain: -10,
      midGain: 10,
      airMode: false,
      autotuneAmount: 0,
      compressorThreshold: -15,
      compressorRatio: 12,
      reverbMix: 0,
      delayMix: 0,
      outputGain: 1.2
    }
  },
  {
    name: "Warm Broadcast",
    description: "Deep, compressed, professional podcast sound.",
    settings: {
      ...DEFAULT_MIXER_SETTINGS,
      inputGain: 2,
      highPass: true,
      lowGain: 3,
      midGain: 1,
      highGain: 2,
      airMode: false,
      compressorThreshold: -28,
      compressorRatio: 6,
      reverbMix: 0.05,
      delayMix: 0,
      outputGain: 1.0
    }
  },
  {
    name: "Ethereal Hall",
    description: "Massive space, ambient texture.",
    settings: {
      ...DEFAULT_MIXER_SETTINGS,
      highPass: true,
      highGain: 2,
      airMode: true,
      compressorThreshold: -24,
      reverbMix: 0.8,
      delayMix: 0.4,
      delayTime: 0.5,
      delayFeedback: 0.6,
      outputGain: 0.9
    }
  },
   {
    name: "Tight Rap",
    description: "Dry, punchy, in-your-face vocals.",
    settings: {
      ...DEFAULT_MIXER_SETTINGS,
      highPass: true,
      lowGain: 2,
      highGain: 4,
      airMode: false,
      autotuneAmount: 0.4,
      compressorThreshold: -35,
      compressorRatio: 10,
      reverbMix: 0.02,
      delayMix: 0,
      outputGain: 1.1
    }
  },
  {
    name: "Cairo Nights",
    description: "Maqam Bayati vibes with warm echo.",
    settings: {
      ...DEFAULT_MIXER_SETTINGS,
      highPass: true,
      scale: 'Bayati',
      musicalKey: 'D',
      autotuneAmount: 0.5,
      reverbMix: 0.3,
      delayMix: 0.25,
      midGain: 2,
      outputGain: 1.0
    }
  }
];