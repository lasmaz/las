import React from 'react';
import Knob from './Knob';
import { MixerSettings, ScaleType, MusicalKey, MAQAMAT_INFO } from '../types';

interface EffectRackProps {
  settings: MixerSettings;
  updateSetting: (key: keyof MixerSettings, value: any) => void;
}

const EffectRack: React.FC<EffectRackProps> = ({ settings, updateSetting }) => {
  const scales: ScaleType[] = ['Chromatic', 'Major', 'Minor', 'Bayati', 'Hijaz', 'Rast', 'Kurd', 'Saba', 'Sika', 'Ajam', 'Nahawand'];
  const keys: MusicalKey[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const PanelHeader = ({ color, title, icon }: { color: string, title: string, icon: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-3">
       <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-zinc-300 font-bold uppercase tracking-[0.15em] text-[11px]">{title}</h3>
       </div>
       <div className={`w-1.5 h-1.5 rounded-full ${color} shadow-[0_0_8px_currentColor]`}></div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-6xl mx-auto">
      
      {/* Input / Dynamics */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col">
         <PanelHeader 
            color="bg-rose-500" 
            title="Pre-Amp & Dyn" 
            icon={<svg className="w-3 h-3 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
         />
        
        <div className="flex justify-between gap-1 mb-6">
          <Knob label="Gain" value={settings.inputGain} min={-12} max={12} onChange={(v) => updateSetting('inputGain', v)} color="rose"/>
          <Knob label="Thresh" value={settings.compressorThreshold} min={-60} max={0} onChange={(v) => updateSetting('compressorThreshold', v)} color="rose"/>
          <Knob label="Ratio" value={settings.compressorRatio} min={1} max={20} onChange={(v) => updateSetting('compressorRatio', v)} color="rose"/>
        </div>
        
        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between bg-zinc-900/30 p-3 rounded-xl">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Low Cut</span>
            <button 
                onClick={() => updateSetting('highPass', !settings.highPass)}
                className={`w-9 h-5 rounded-full transition-all duration-300 relative ${settings.highPass ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-zinc-800'}`}
            >
                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.highPass ? 'translate-x-4' : ''}`} />
            </button>
        </div>
      </div>

      {/* Pitch / Tuning */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col">
        <PanelHeader 
            color="bg-indigo-500" 
            title="Autotune" 
            icon={<svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>}
        />

        <div className="space-y-3 mb-5">
             <div className="flex gap-2">
                 <select 
                      value={settings.musicalKey}
                      onChange={(e) => updateSetting('musicalKey', e.target.value)}
                      className="w-1/3 bg-zinc-900 text-indigo-300 text-[11px] font-bold rounded-lg px-3 py-2 border border-white/5 outline-none focus:border-indigo-500 transition-colors"
                 >
                      {keys.map(k => <option key={k} value={k}>{k}</option>)}
                 </select>
                 <select 
                      value={settings.scale}
                      onChange={(e) => updateSetting('scale', e.target.value)}
                      className="w-2/3 bg-zinc-900 text-indigo-300 text-[11px] font-bold rounded-lg px-3 py-2 border border-white/5 outline-none focus:border-indigo-500 transition-colors"
                    >
                      {scales.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
             </div>
             <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2 text-center">
                <p className="text-[10px] text-indigo-200 font-medium">{MAQAMAT_INFO[settings.scale]}</p>
             </div>
        </div>

        <div className="flex justify-around mt-auto">
           <Knob label="Amount" value={settings.autotuneAmount} min={0} max={1} onChange={(v) => updateSetting('autotuneAmount', v)} color="indigo"/>
           <Knob label="Transp" value={settings.pitchShift} min={-12} max={12} onChange={(v) => updateSetting('pitchShift', v)} color="indigo"/>
        </div>
      </div>

      {/* Equalizer */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col">
        <PanelHeader 
            color="bg-emerald-500" 
            title="Equalizer" 
            icon={<svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <div className="flex justify-between items-center mb-6 px-2">
           <Knob label="Low" value={settings.lowGain} min={-15} max={15} onChange={(v) => updateSetting('lowGain', v)} color="green"/>
           <Knob label="Mid" value={settings.midGain} min={-15} max={15} onChange={(v) => updateSetting('midGain', v)} color="green"/>
           <Knob label="High" value={settings.highGain} min={-15} max={15} onChange={(v) => updateSetting('highGain', v)} color="green"/>
        </div>

        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between bg-zinc-900/30 p-3 rounded-xl">
            <div className="flex flex-col">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">AIR EFFECT</span>
                <span className="text-[9px] text-zinc-500 font-medium">12kHz Presence</span>
            </div>
            <button 
                onClick={() => updateSetting('airMode', !settings.airMode)}
                className={`w-9 h-5 rounded-full transition-all duration-300 relative ${settings.airMode ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-zinc-800'}`}
            >
                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.airMode ? 'translate-x-4' : ''}`} />
            </button>
        </div>
      </div>

      {/* Space / FX */}
      <div className="glass-panel p-5 rounded-2xl">
         <PanelHeader 
            color="bg-cyan-500" 
            title="Spatial FX" 
            icon={<svg className="w-3 h-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
         />
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 place-items-center">
          <Knob label="Reverb" value={settings.reverbMix} min={0} max={1} onChange={(v) => updateSetting('reverbMix', v)} color="cyan"/>
          <Knob label="Echo" value={settings.delayMix} min={0} max={1} onChange={(v) => updateSetting('delayMix', v)} color="cyan"/>
          <Knob label="Time" value={settings.delayTime} min={0} max={1} onChange={(v) => updateSetting('delayTime', v)} color="cyan"/>
          <Knob label="F-Back" value={settings.delayFeedback} min={0} max={0.9} onChange={(v) => updateSetting('delayFeedback', v)} color="cyan"/>
        </div>
      </div>

    </div>
  );
};

export default EffectRack;