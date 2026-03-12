
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AppState, Message, LANGUAGES } from '../types';
import { GeminiLiveService } from '../services/geminiLiveService';
import { TranslationColumn } from '../components/TranslationColumn';
import { LanguageSelector } from '../components/LanguageSelector';

export default function Home() {
  const [appState, setAppState] = useState<AppState>(AppState.LOGIN);
  const [loginCode, setLoginCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [staffLang, setStaffLang] = useState('nl-NL'); 
  const [visitorLang, setVisitorLang] = useState('auto');

  // Added speaker control states to fix missing property errors in TranslationColumn
  const [staffSpeaker, setStaffSpeaker] = useState(true);
  const [visitorSpeaker, setVisitorSpeaker] = useState(true);

  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');

  const liveService = useRef<GeminiLiveService | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = loginCode.trim().toUpperCase();
    const siRegex = /^SI[A-Z]{2}\d{6}$/;
    const arRegex = /^AR\d{6}$/;

    if (siRegex.test(cleanCode) || arRegex.test(cleanCode) || cleanCode === 'EBURON2025') {
      setAppState(AppState.TRANSLATOR);
      setError(null);
    } else {
      setError('Invalid Access Code. Use EBURON2025 for tests.');
    }
  };

  const toggleMic = async () => {
    if (isListening) {
      liveService.current?.disconnect();
      setIsListening(false);
    } else {
      if (!liveService.current) liveService.current = new GeminiLiveService();
      const sLang = LANGUAGES.find(l => l.code === staffLang)?.name || 'Flemish';
      const vLang = LANGUAGES.find(l => l.code === visitorLang)?.name || 'English';

      try {
        await liveService.current.connect({
          staffLanguage: sLang,
          visitorLanguage: vLang,
          onTranscription: (text, isInput) => {
            if (isInput) setCurrentInput(prev => prev + text);
            else setCurrentOutput(prev => prev + text);
          },
          onTurnComplete: () => { },
          onError: () => {
            setError('Connection error. Retrying...');
            setIsListening(false);
          }
        });
        setIsListening(true);
      } catch (err) {
        setError('Microphone permission denied.');
      }
    }
  };

  useEffect(() => {
    if ((currentInput || currentOutput) && isListening) {
      const timeout = setTimeout(() => {
        const newMessage: Message = {
          id: Math.random().toString(36).substr(2, 9),
          sender: currentInput ? 'staff' : 'visitor',
          originalText: currentInput || '...',
          translatedText: currentOutput || '...',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, newMessage]);
        setCurrentInput('');
        setCurrentOutput('');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [currentInput, currentOutput, isListening]);

  if (appState === AppState.LOGIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-neutral-100">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <h1 className="text-4xl font-[900] tracking-tighter text-neutral-900 mb-2">Eburon Dual</h1>
            <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs">Professional Translator Login</p>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-xl border border-black/5">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-3 ml-2">Access Code</label>
                <input
                  type="text"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="EBURON2025"
                  className="w-full px-6 py-5 rounded-3xl bg-neutral-100 border-none focus:ring-4 focus:ring-blue-500/10 outline-none text-center font-black text-2xl tracking-tighter placeholder:text-neutral-300 uppercase"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-500 text-[11px] font-black text-center uppercase">{error}</p>}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black py-5 rounded-3xl transition-all shadow-xl shadow-blue-500/20 text-lg"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-100">
      {/* Optimized Tablet Header */}
      <header className="glass border-b border-black/[0.05] px-6 sm:px-10 py-5 flex flex-col md:flex-row items-center justify-between gap-6 z-30 no-print">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-[900] tracking-tighter leading-none">Eburon Dual</h1>
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1 block">Active: {loginCode}</span>
          </div>
        </div>

        {/* Fixed Center Selectors */}
        <div className="flex gap-4 sm:gap-10 items-center bg-white/50 p-3 rounded-[2rem] border border-black/[0.03] w-full md:w-auto overflow-x-auto no-scrollbar">
          <LanguageSelector label="Ours (Pro)" value={staffLang} onChange={setStaffLang} color="blue" />
          <div className="h-10 w-[1px] bg-black/10 flex-shrink-0" />
          <LanguageSelector label="Theirs (Visitor)" value={visitorLang} onChange={setVisitorLang} color="green" />
        </div>

        <div className="flex gap-4">
          <button onClick={() => window.print()} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white hover:bg-neutral-50 border border-black/5 shadow-sm transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Dual View - Responsive Columns */}
      <main className="flex-1 flex flex-col md:flex-row gap-6 sm:gap-10 p-4 sm:p-10 overflow-hidden relative">
        <div className="flex-1 h-[45%] md:h-full">
          {/* Added missing props: language, setLanguage, speakerOn, setSpeakerOn */}
          <TranslationColumn
            title="Ours"
            subtitle="Staff Control"
            messages={messages}
            type="staff"
            language={staffLang}
            setLanguage={setStaffLang}
            speakerOn={staffSpeaker}
            setSpeakerOn={setStaffSpeaker}
          />
        </div>
        <div className="flex-1 h-[45%] md:h-full">
          {/* Added missing props: language, setLanguage, speakerOn, setSpeakerOn */}
          <TranslationColumn
            title="Theirs"
            subtitle="Visitor Dialogue"
            messages={messages}
            type="visitor"
            language={visitorLang}
            setLanguage={setVisitorLang}
            speakerOn={visitorSpeaker}
            setSpeakerOn={setVisitorSpeaker}
          />
        </div>

        {/* Floating Dynamic Island for Real-time Transcription */}
        {(currentInput || currentOutput) && isListening && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-12 md:translate-y-0 z-50 w-full max-w-lg px-6 no-print message-enter">
            <div className="bg-[#1D1D1F] text-white p-6 rounded-[2.5rem] shadow-2xl border border-white/10 ring-4 ring-black/10">
              {currentInput && (
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-[10px] font-black text-blue-500 uppercase bg-blue-500/10 px-2 py-1 rounded-lg">Ours</span>
                  <p className="text-lg font-bold text-neutral-200">{currentInput}</p>
                </div>
              )}
              {currentOutput && (
                <div className={`${currentInput ? 'mt-4 pt-4 border-t border-white/10' : ''} flex items-start gap-4`}>
                  <span className="text-[10px] font-black text-green-500 uppercase bg-green-500/10 px-2 py-1 rounded-lg">Theirs</span>
                  <p className="text-lg font-bold text-green-400 italic">"{currentOutput}"</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mic Footer */}
      <footer className="px-10 py-10 sm:py-16 flex items-center justify-center relative no-print">
        <button
          onClick={toggleMic}
          className={`group relative flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36 rounded-full transition-all duration-500 transform active:scale-90 ${isListening ? 'bg-[#FF3B30] mic-active' : 'bg-blue-600 shadow-2xl shadow-blue-500/30'
            }`}
        >
          {isListening ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
          <span className={`absolute -bottom-10 whitespace-nowrap text-xs font-black uppercase tracking-[0.3em] ${isListening ? 'text-red-500' : 'text-neutral-400'}`}>
            {isListening ? 'End Session' : 'Begin Dialogue'}
          </span>
        </button>

        <div className="absolute right-10 bottom-10 text-right opacity-30 select-none hidden lg:block">
          <p className="text-[14px] font-[900] tracking-tighter uppercase">Eburon Live 2025</p>
          <p className="text-[10px] text-neutral-600 tracking-widest font-bold uppercase">Tablet Mode Active</p>
        </div>
      </footer>
    </div>
  );
}
