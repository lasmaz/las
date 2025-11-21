
import React, { useState, useEffect, useRef } from 'react';
import Visualizer from './components/Visualizer';
import MiniVisualizer from './components/MiniVisualizer';
import EffectRack from './components/EffectRack';
import { audioEngine } from './services/audioEngine';
import { generateMixerPreset } from './services/geminiService';
import { DEFAULT_MIXER_SETTINGS, MixerSettings, Preset, ARTIST_PRESETS } from './types';

function App() {
  const [settings, setSettings] = useState<MixerSettings>(DEFAULT_MIXER_SETTINGS);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [monitor, setMonitor] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'artist'>('artist');
  const [latencyMode, setLatencyMode] = useState<'interactive' | 'balanced'>('interactive');
  const [monitorDelay, setMonitorDelay] = useState(0); // ms
  const [showSettings, setShowSettings] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("Sing into the microphone");

  // Backing Track State
  const [backingTrackName, setBackingTrackName] = useState<string | null>(null);
  const [isBackingPlaying, setIsBackingPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vocal Track State
  const [vocalTrackName, setVocalTrackName] = useState<string | null>(null);
  const [isVocalPlaying, setIsVocalPlaying] = useState(false);
  const vocalInputRef = useRef<HTMLInputElement>(null);

  // Preset State
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    if (isEngineReady) {
      audioEngine.updateSettings(settings);
    }
  }, [settings, isEngineReady]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vocalStudioPresets');
      if (saved) setPresets(JSON.parse(saved));
    } catch (e) { console.error("Failed to parse saved presets", e); }
  }, []);

  const handleStart = async () => {
    try {
      await audioEngine.startInput(monitor);
      setIsEngineReady(true);
      setError(null);
    } catch (e) {
      setError("Please allow microphone access to use the studio.");
    }
  };

  const handleRecordToggle = async () => {
    if (!isEngineReady) await handleStart();
    
    if (isRecording) {
      audioEngine.stopRecording();
      setIsRecording(false);
      if (isBackingPlaying) { audioEngine.stopBacking(); setIsBackingPlaying(false); }
      if (isVocalPlaying) { audioEngine.stopVocal(); setIsVocalPlaying(false); }
      setTimeout(() => setAudioUrl(audioEngine.getRecordedUrl()), 200);
    } else {
      audioEngine.startRecording();
      setIsRecording(true);
      setAudioUrl(null);
      if (backingTrackName) { audioEngine.playBacking(); setIsBackingPlaying(true); }
      if (vocalTrackName) { audioEngine.playVocal(true); setIsVocalPlaying(true); }
    }
  };

  const handleBackingImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        if (!audioEngine.isInitialized) await audioEngine.init();
        await audioEngine.loadBackingTrack(file);
        setBackingTrackName(file.name);
        setIsEngineReady(true);
        setError(null);
    } catch (err) { setError("Failed to load audio file."); }
  };

  const handleVocalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        if (!audioEngine.isInitialized) await audioEngine.init();
        await audioEngine.loadVocalTrack(file);
        setVocalTrackName(file.name);
        setIsEngineReady(true);
        setError(null);
        setMonitor(true);
    } catch (err) { setError("Failed to load vocal file."); }
  };

  const updateSetting = (key: keyof MixerSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const toggleLatencyMode = async () => {
      const newMode = latencyMode === 'interactive' ? 'balanced' : 'interactive';
      setLatencyMode(newMode);
      try { await audioEngine.setLatencyMode(newMode); } 
      catch (err) { setError("Failed to switch latency mode."); }
  };

  const handleMonitorDelayChange = (val: number) => {
      setMonitorDelay(val);
      audioEngine.setMonitorDelay(val / 1000);
  };

  const handleGeneratePreset = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const newSettings = await generateMixerPreset(prompt);
      setSettings(prev => ({ ...DEFAULT_MIXER_SETTINGS, ...prev, ...newSettings }));
    } catch (e) { setError("Failed to generate preset."); } 
    finally { setIsGenerating(false); }
  };

  const handleAISmartMix = async () => {
      if (!isEngineReady) await handleStart();
      
      setAnalysisMessage("Sing into the microphone");
      setAnalyzing(true);
      setError(null);
      
      try {
          // 1. Analyze for 3 seconds
          const stats = await audioEngine.analyzeAudioProfile(3000);
          
          // 2. Format data
          const analysisStr = `Lows: ${stats.low.toFixed(0)}, Mids: ${stats.mid.toFixed(0)}, Highs: ${stats.high.toFixed(0)}, RMS: ${stats.rms.toFixed(0)}`;
          
          // 3. Call Gemini with data
          const newSettings = await generateMixerPreset(prompt || "Clean professional vocal mix", analysisStr);
          
          // 4. Apply
          setSettings(prev => ({ ...DEFAULT_MIXER_SETTINGS, ...prev, ...newSettings }));
          
      } catch (e) {
          setError("AI Analysis failed. Try checking microphone.");
      } finally {
          setAnalyzing(false);
      }
  };

  const handleVocalCleanup = async () => {
      if (!isEngineReady) await handleStart();
      
      setAnalysisMessage("Analyzing background noise...");
      setAnalyzing(true);
      setError(null);
      
      try {
          const stats = await audioEngine.analyzeAudioProfile(3000);
          const analysisStr = `Lows: ${stats.low.toFixed(0)}, Mids: ${stats.mid.toFixed(0)}, Highs: ${stats.high.toFixed(0)}, RMS: ${stats.rms.toFixed(0)}`;
          
          const cleanupPrompt = "Professional Vocal Clean-up: aggressively remove background noise (Enable High Pass), remove mud (Cut Low Gain), and De-ess sibilance (Reduce High Gain/Air). Normalize volume with compression. Keep Reverb low.";
          
          const newSettings = await generateMixerPreset(cleanupPrompt, analysisStr);
          
          setSettings(prev => ({ ...DEFAULT_MIXER_SETTINGS, ...prev, ...newSettings }));
      } catch (e) {
          setError("Cleanup failed. Try checking microphone.");
      } finally {
          setAnalyzing(false);
      }
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: Preset = { name: newPresetName.trim(), description: "User saved", settings: { ...settings } };
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem('vocalStudioPresets', JSON.stringify(updatedPresets));
    setNewPresetName("");
    setShowSaveDialog(false);
  };

  const deletePreset = (index: number) => {
    const updatedPresets = presets.filter((_, i) => i !== index);
    setPresets(updatedPresets);
    localStorage.setItem('vocalStudioPresets', JSON.stringify(updatedPresets));
  };

  const loadPreset = (preset: Preset) => setSettings({ ...DEFAULT_MIXER_SETTINGS, ...preset.settings });

  return (
    <div className="min-h-screen text-neutral-300 p-4 md:p-8 flex flex-col items-center font-sans selection:bg-cyan-500/30">
      <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleBackingImport} className="hidden" />
      <input type="file" accept="audio/*" ref={vocalInputRef} onChange={handleVocalImport} className="hidden" />

      {/* Glow Orbs */}
      <div className="fixed top-[-10%] left-[20%] w-[40rem] h-[40rem] bg-indigo-600/10 blur-[150px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[10%] w-[40rem] h-[40rem] bg-cyan-600/10 blur-[150px] rounded-full -z-10 pointer-events-none"></div>

      {/* AI Analyzing Overlay */}
      {analyzing && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-500/30 animate-ping"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping delay-150"></div>
                  <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-full shadow-[0_0_50px_rgba(34,211,238,0.6)] flex items-center justify-center">
                      <svg className="w-10 h-10 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  </div>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-widest mb-2">LISTENING...</h2>
              <p className="text-cyan-400 font-mono">{analysisMessage}</p>
          </div>
      )}

      {/* Header */}
      <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-8 relative z-50 gap-4">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center shadow-lg">
                <div className="w-4 h-4 bg-gradient-to-br from-cyan-400 to-indigo-500 rounded-full"></div>
            </div>
            <div className="flex flex-col">
                 <h1 className="text-lg font-bold tracking-tight text-white leading-none">VOCAL<span className="text-cyan-400">STUDIO</span></h1>
                 <span className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-bold">Pro AI Mixer</span>
            </div>
         </div>

         {/* CENTER: Mini Visualizer */}
         <div className="flex-1 flex justify-center">
             <MiniVisualizer />
         </div>
         
         <div className="flex items-center gap-4">
             {/* Vocal Clean-up Button */}
             <button 
                onClick={handleVocalCleanup}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[10px] tracking-widest shadow-lg transition-all hover:scale-105"
             >
                 <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                 <span>CLEAN UP</span>
             </button>

             {/* AI Auto Mix Button */}
             <button 
                onClick={handleAISmartMix}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-[10px] tracking-widest shadow-lg transition-all hover:scale-105"
             >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 <span>AI SMART MIX</span>
             </button>

             {/* Settings Button */}
             <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all shadow-lg ${showSettings ? 'bg-white text-black border-white' : 'glass-panel text-zinc-400 hover:text-white border-white/10 hover:border-white/30'}`}
             >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                 <span className="text-[10px] font-bold uppercase tracking-widest">Config</span>
             </button>
         </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
              <div className="glass-panel p-8 rounded-3xl w-full max-w-md shadow-2xl border border-white/10 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-8">
                      <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          SETTINGS
                      </h2>
                      <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 transition-colors">✕</button>
                  </div>

                  {/* Latency Mode */}
                  <div className="mb-8 p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between mb-4">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Latency Mode</label>
                          <span className={`text-[10px] px-2 py-1 rounded bg-zinc-800 border border-white/5 ${latencyMode === 'interactive' ? 'text-cyan-400' : 'text-emerald-400'}`}>{latencyMode === 'interactive' ? 'Ultra Low' : 'Stable'}</span>
                      </div>
                      <div className="flex gap-3">
                          <button 
                              onClick={() => latencyMode !== 'interactive' && toggleLatencyMode()}
                              className={`flex-1 py-4 rounded-xl border text-xs font-bold transition-all relative overflow-hidden ${latencyMode === 'interactive' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                          >
                              INTERACTIVE
                              <div className="text-[9px] font-normal opacity-70 mt-1">Best for singing</div>
                          </button>
                          <button 
                              onClick={() => latencyMode !== 'balanced' && toggleLatencyMode()}
                              className={`flex-1 py-4 rounded-xl border text-xs font-bold transition-all ${latencyMode === 'balanced' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                          >
                              BALANCED
                              <div className="text-[9px] font-normal opacity-70 mt-1">Prevents pops</div>
                          </button>
                      </div>
                  </div>

                  {/* Monitor Delay */}
                  <div className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Monitor Sync Offset</label>
                          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900">{monitorDelay} ms</span>
                      </div>
                      <input 
                          type="range" 
                          min="0" 
                          max="200" 
                          value={monitorDelay} 
                          onChange={(e) => handleMonitorDelayChange(Number(e.target.value))}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
                      />
                  </div>

                   {/* Output Gain */}
                   <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Master Volume</label>
                          <span className="text-xs font-mono text-rose-400 bg-rose-950/30 px-2 py-1 rounded border border-rose-900">{(settings.outputGain * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                          type="range" 
                          min="0" 
                          max="1.5" 
                          step="0.01"
                          value={settings.outputGain} 
                          onChange={(e) => updateSetting('outputGain', Number(e.target.value))}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400"
                      />
                  </div>

              </div>
          </div>
      )}

      {/* Main Layout */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Visualizer & AI (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            <Visualizer />
            
            {/* AI Prompt Bar */}
            <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-3 relative overflow-hidden group focus-within:border-cyan-500/30 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all">
                <div className="pl-4">
                    <svg className="w-5 h-5 text-cyan-400 animate-pulse-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <input 
                  type="text"
                  dir="auto"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe sound... (e.g., 'Cairo Radio', 'Trap Vocal')"
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-zinc-600 h-12 font-medium"
                  onKeyDown={(e) => e.key === 'Enter' && handleGeneratePreset()}
                />
                <button 
                  onClick={handleGeneratePreset}
                  disabled={isGenerating || !prompt}
                  className="bg-zinc-800 hover:bg-white hover:text-black disabled:bg-transparent disabled:text-zinc-700 text-xs font-bold py-3 px-6 rounded-xl transition-all"
                >
                  {isGenerating ? 'GENERATING...' : 'CREATE PRESET'}
                </button>
            </div>
            {error && <div className="text-rose-400 text-xs text-center bg-rose-950/20 py-3 rounded-xl border border-rose-900/30">{error}</div>}

             {/* Track Control Strips */}
             <div className="flex flex-col gap-3">
                
                {/* Backing Track */}
                {backingTrackName ? (
                    <div className="glass-panel rounded-xl p-4 flex items-center justify-between border-l-4 border-l-cyan-500">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => {
                                    if (isBackingPlaying) {
                                        audioEngine.stopBacking();
                                        setIsBackingPlaying(false);
                                    } else {
                                        audioEngine.playBacking();
                                        setIsBackingPlaying(true);
                                    }
                                }} 
                                className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                             >
                                {isBackingPlaying ? '⏸' : '▶'}
                             </button>
                            <div>
                                <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider mb-0.5">Backing Track</div>
                                <div className="text-sm text-zinc-200 font-medium">{backingTrackName}</div>
                            </div>
                        </div>
                        <button onClick={() => { audioEngine.stopBacking(); setBackingTrackName(null); setIsBackingPlaying(false); }} className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white flex items-center justify-center transition-colors">✕</button>
                    </div>
                ) : null}

                {/* Vocal Track */}
                {vocalTrackName ? (
                     <div className="glass-panel rounded-xl p-4 flex items-center justify-between border-l-4 border-l-indigo-500">
                        <div className="flex items-center gap-4">
                             <button 
                                onClick={() => {
                                    if (isVocalPlaying) {
                                        audioEngine.stopVocal();
                                        setIsVocalPlaying(false);
                                    } else {
                                        audioEngine.playVocal(true);
                                        setIsVocalPlaying(true);
                                    }
                                }}
                                className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center transition-all shadow-[0_0_15px_rgba(129,140,248,0.4)]"
                             >
                                {isVocalPlaying ? '⏸' : '▶'}
                             </button>
                            <div>
                                <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Vocal Source</div>
                                <div className="text-sm text-zinc-200 font-medium">{vocalTrackName}</div>
                            </div>
                        </div>
                        <button onClick={() => { audioEngine.stopVocal(); setVocalTrackName(null); setIsVocalPlaying(false); }} className="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white flex items-center justify-center transition-colors">✕</button>
                    </div>
                ) : null}

                {audioUrl && !isRecording && (
                     <div className="glass-panel rounded-xl p-3 flex items-center gap-4 border border-white/5">
                        <div className="w-8 h-8 rounded bg-rose-500/20 flex items-center justify-center text-rose-500">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                        </div>
                        <div className="flex-1">
                             <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">New Recording</span>
                             <audio src={audioUrl} controls className="h-8 w-full opacity-80 hover:opacity-100 transition-opacity mt-1" />
                        </div>
                     </div>
                )}
             </div>
        </div>

        {/* Right: Control Center (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="glass-panel rounded-3xl p-6 h-full relative flex flex-col items-center justify-center text-center">
                
                {/* Monitor Toggle */}
                <button 
                    onClick={() => { setMonitor(!monitor); audioEngine.setMonitor(!monitor); }}
                    className={`absolute top-6 right-6 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${monitor ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/30'}`}
                >
                    MONITOR {monitor ? 'ON' : 'OFF'}
                </button>

                <div className="mb-8 mt-4">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.4em] mb-1">Master Control</h3>
                </div>

                {/* REC BUTTON - HERO */}
                <button 
                    onClick={handleRecordToggle}
                    className={`group relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 mb-8 ${
                        isRecording 
                        ? 'shadow-[0_0_60px_rgba(225,29,72,0.6)] scale-105' 
                        : 'shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(225,29,72,0.2)]'
                    }`}
                >
                    {/* Outer Ring */}
                    <div className={`absolute inset-0 rounded-full border-2 border-rose-900/50 ${isRecording ? 'animate-ping opacity-20' : ''}`}></div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-zinc-800 to-black border border-white/10"></div>
                    
                    {/* Inner Active Button */}
                    <div className={`relative w-24 h-24 rounded-full flex items-center justify-center border-4 border-zinc-900 transition-all duration-300 ${isRecording ? 'bg-rose-600' : 'bg-zinc-800 group-hover:bg-rose-900/40'}`}>
                        <div className={`rounded transition-all duration-300 ${isRecording ? 'w-8 h-8 bg-white rounded-md animate-pulse' : 'w-12 h-12 bg-rose-500 rounded-full shadow-[inset_0_2px_5px_rgba(255,255,255,0.3)]'}`} />
                    </div>
                </button>

                {/* Source Buttons */}
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button onClick={() => fileInputRef.current?.click()} className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 transition-all group relative overflow-hidden">
                        <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10">
                            <div className="text-[10px] font-bold text-cyan-500 mb-1 tracking-wider">BACKING</div>
                            <div className="text-xs text-zinc-300">+ Import File</div>
                        </div>
                    </button>
                    <button onClick={() => vocalInputRef.current?.click()} className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="relative z-10">
                            <div className="text-[10px] font-bold text-indigo-500 mb-1 tracking-wider">VOCAL</div>
                            <div className="text-xs text-zinc-300">+ Import File</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>

        {/* Effects Rack */}
        <div className="col-span-full">
             <EffectRack settings={settings} updateSetting={updateSetting} />
        </div>

        {/* Preset Library */}
        <div className="col-span-full glass-panel rounded-3xl p-8">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white tracking-wide">PRESET LIBRARY</h3>
                <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                    <button onClick={() => setActiveTab('artist')} className={`px-6 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all ${activeTab === 'artist' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>PRO ARTIST</button>
                    <button onClick={() => setActiveTab('user')} className={`px-6 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all ${activeTab === 'user' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>MY PRESETS</button>
                </div>
            </div>

            {showSaveDialog && (
                <div className="flex gap-3 mb-8 max-w-lg p-4 bg-zinc-900/50 rounded-xl border border-white/10">
                    <input value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="flex-1 bg-black rounded-lg px-4 text-sm outline-none border border-zinc-800 focus:border-cyan-500" placeholder="Name your preset..." autoFocus onKeyDown={(e) => e.key === 'Enter' && savePreset()} />
                    <button onClick={savePreset} className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 rounded-lg text-xs font-bold transition-colors">SAVE</button>
                    <button onClick={() => setShowSaveDialog(false)} className="text-zinc-500 hover:text-white px-4 text-xs">Cancel</button>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                 {(activeTab === 'artist' ? ARTIST_PRESETS : presets).map((p, i) => (
                     <button key={i} onClick={() => activeTab === 'artist' ? loadPreset(p) : loadPreset(p as Preset)} className="group relative bg-white/5 border border-white/5 hover:border-cyan-500/50 hover:bg-white/10 p-5 rounded-2xl text-left transition-all hover:-translate-y-1 duration-300">
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-zinc-800 group-hover:bg-cyan-400 transition-colors"></div>
                        <div className="text-xs font-bold text-zinc-200 group-hover:text-white mb-2">{p.name}</div>
                        <div className="text-[10px] text-zinc-500 group-hover:text-zinc-400 leading-tight line-clamp-2 font-medium">{p.description}</div>
                        {activeTab === 'user' && <div onClick={(e) => { e.stopPropagation(); deletePreset(i); }} className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-rose-500/20 hover:text-rose-500 text-zinc-600 text-[10px] transition-colors">✕</div>}
                     </button>
                 ))}
                 {activeTab === 'user' && (
                    <button onClick={() => setShowSaveDialog(true)} className="group border border-dashed border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/5 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all">
                         <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-cyan-500 text-zinc-500 group-hover:text-black flex items-center justify-center transition-colors">+</div>
                         <span className="text-[10px] font-bold text-zinc-500 group-hover:text-cyan-400">CREATE NEW</span>
                    </button>
                 )}
            </div>
        </div>

      </main>
    </div>
  );
}

export default App;
