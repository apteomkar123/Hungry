import React, { useState, useEffect } from 'react';
import { X, Mic, ChevronRight, ChevronLeft } from 'lucide-react';

export default function CookingMode({ steps, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
      if (command.includes('next')) setCurrentStep(s => Math.min(steps.length - 1, s + 1));
      if (command.includes('back')) setCurrentStep(s => Math.max(0, s - 1));
    };

    if (isListening) recognition.start();
    return () => recognition.stop();
  }, [isListening, steps.length]);

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col p-8 items-center justify-center text-center">
      <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-800"><X size={32} /></button>
      <div className="max-w-2xl space-y-12">
        <div className="flex justify-center gap-4">
          <button onClick={() => setIsListening(!isListening)} className={`p-4 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-500 scale-110 shadow-lg' : 'bg-blue-50 text-sky-500'}`}>
            <Mic size={32} />
          </button>
        </div>
        <div className="space-y-4">
          <span className="text-sky-500 font-mono font-black text-xl">STEP {currentStep + 1} OF {steps.length}</span>
          <h2 className="text-4xl font-bold text-slate-800 leading-tight">{steps[currentStep]}</h2>
        </div>
        <div className="flex gap-4 justify-center pt-8">
          <button onClick={() => setCurrentStep(s => Math.max(0, s - 1))} className="p-6 bg-slate-100 rounded-3xl text-slate-600 active:scale-95 transition-all"><ChevronLeft size={32} /></button>
          <button onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))} className="p-6 bg-sky-500 rounded-3xl text-white active:scale-95 transition-all shadow-xl shadow-sky-200"><ChevronRight size={32} /></button>
        </div>
        <p className="text-slate-400 font-medium">Say "Next step" or "Back" to navigate hands-free</p>
      </div>
    </div>
  );
}