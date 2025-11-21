

import { GoogleGenAI, Type } from '@google/genai';
import { MixerSettings } from '../types';

export const generateMixerPreset = async (description: string, analysisData?: string): Promise<MixerSettings> => {
  const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-2.5-flash";
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      inputGain: { type: Type.NUMBER, description: "Pre-amp input gain in dB, range -12 to 12" },
      highPass: { type: Type.BOOLEAN, description: "Enable 100Hz Low Cut filter" },
      
      autotuneAmount: { type: Type.NUMBER, description: "Autotune/Pitch Correction amount, range 0.0 to 1.0" },
      pitchShift: { type: Type.NUMBER, description: "Pitch shift in semitones, range -12 to 12" },
      scale: { type: Type.STRING, description: "Musical Scale/Maqam (Bayati, Hijaz, Rast, Kurd, Saba, Major, Minor)" },
      musicalKey: { type: Type.STRING, description: "Musical Key (C, D, F#, etc)" },

      lowGain: { type: Type.NUMBER, description: "Low frequency EQ gain in dB, range -15 to 15" },
      midGain: { type: Type.NUMBER, description: "Mid frequency EQ gain in dB, range -15 to 15" },
      highGain: { type: Type.NUMBER, description: "High frequency EQ gain in dB, range -15 to 15" },
      airMode: { type: Type.BOOLEAN, description: "Enable 'Air' effect (12kHz High Shelf boost) for breathy vocals" },
      
      compressorThreshold: { type: Type.NUMBER, description: "Compressor threshold in dB, range -60 to 0" },
      compressorRatio: { type: Type.NUMBER, description: "Compressor ratio, range 1 to 20" },
      reverbMix: { type: Type.NUMBER, description: "Reverb wet/dry mix, range 0.0 to 1.0" },
      delayMix: { type: Type.NUMBER, description: "Delay/Echo wet/dry mix, range 0.0 to 1.0" },
      delayTime: { type: Type.NUMBER, description: "Delay time in seconds, range 0.0 to 1.0" },
      delayFeedback: { type: Type.NUMBER, description: "Delay feedback amount, range 0.0 to 0.9" },
      spatial3D: { type: Type.BOOLEAN, description: "Enable 3D Spatial widening effect (Dimension Expander)" },
      outputGain: { type: Type.NUMBER, description: "Master output gain multiplier, usually 0.8 to 1.2" }
    },
    required: ["inputGain", "highPass", "autotuneAmount", "pitchShift", "scale", "musicalKey", "lowGain", "midGain", "highGain", "airMode", "compressorThreshold", "compressorRatio", "reverbMix", "delayMix", "delayTime", "delayFeedback", "spatial3D", "outputGain"]
  };

  const makeRequest = async (retryCount = 0): Promise<MixerSettings> => {
    try {
      let promptText = `Generate a vocal mixing preset for: "${description}". If the description implies an Arabic style, suggest an appropriate Maqam (Bayati, Rast, Saba, etc) and Key. For 'Robot' or 'Auto-tune' requests, set autotuneAmount high.`;
      
      if (analysisData) {
        promptText += `\n\nAUDIO ANALYSIS DATA (Average levels 0-255): ${analysisData}. 
        Use this data to compensate:
        - If 'RMS' is low (<50), increase inputGain.
        - If 'High' is low, boost highGain and enable airMode.
        - If 'Low' is very high, enable highPass and cut lowGain.`;
      }

      const response = await genAI.models.generateContent({
        model: model,
        contents: {
          parts: [{ text: promptText }]
        },
        config: {
          systemInstruction: "You are a professional audio mixing engineer familiar with both Western and Middle Eastern (Maqam) music scales. You analyze audio statistics and apply corrective EQ and compression.",
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as MixerSettings;
      }
      throw new Error("No data returned from Gemini");

    } catch (error: any) {
      const isTransient = error.message?.includes('500') || error.message?.includes('xhr') || error.message?.includes('fetch');
      if (retryCount < 2 && isTransient) {
        console.warn(`Gemini API request failed. Retrying (${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return makeRequest(retryCount + 1);
      }
      console.error("Gemini API Error:", error);
      throw error;
    }
  };

  return makeRequest();
};