import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';

export default function CookingMode({ steps, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const isListeningRef = useRef(false); // ref to avoid stale closure in recognition.onend
  const isMounted = useRef(true);
  const currentStepRef = useRef(0); // ref so voice callbacks always read current step

  // Keep refs in sync with state
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { currentStepRef.current = currentStepIndex; }, [currentStepIndex]);

  const readStep = useCallback((index) => {
    if (!utteranceRef.current || !steps[index]) return;
    window.speechSynthesis.cancel();
    utteranceRef.current.text = `Step ${index + 1}: ${steps[index]}`;
    window.speechSynthesis.speak(utteranceRef.current);
  }, [steps]);

  const goToStep = useCallback((index) => {
    const next = Math.max(0, Math.min(index, steps.length - 1));
    setCurrentStepIndex(next);
    readStep(next);
  }, [steps, readStep]);

  useEffect(() => {
    isMounted.current = true;
    utteranceRef.current = new SpeechSynthesisUtterance();
    utteranceRef.current.lang = 'en-US';

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        if (transcript.includes('next')) {
          goToStep(currentStepRef.current + 1);
        } else if (transcript.includes('back') || transcript.includes('previous')) {
          goToStep(currentStepRef.current - 1);
        } else if (transcript.includes('repeat') || transcript.includes('read')) {
          readStep(currentStepRef.current);
        } else if (transcript.includes('stop') || transcript.includes('exit')) {
          onClose();
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        // Don't stop listening on transient errors (no-speech, etc.)
        if (event.error === 'aborted') return;
        if (!isMounted.current) return;
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        // Restart automatically if mic is still supposed to be on
        if (isListeningRef.current && isMounted.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      isMounted.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      window.speechSynthesis.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // goToStep/readStep intentionally omitted — they are stable via useCallback
  // and we only want to initialize recognition once

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      try { recognitionRef.current.stop(); } catch (e) {}
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      try { recognitionRef.current.start(); } catch (e) {
        isListeningRef.current = false;
        setIsListening(false);
      }
    }
  };

  const handleClose = () => {
    isListeningRef.current = false;
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch (e) {}
    window.speechSynthesis.cancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 z-50 text-white">
      <div className="w-full max-w-3xl bg-white/10 rounded-[2.5rem] border border-white/20 shadow-2xl p-6 flex flex-col h-full max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white">Cooking Mode</h2>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors p-2">
            <X size={28} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 overflow-y-auto custom-scrollbar">
          <p className="text-sm font-bold text-white/60 uppercase tracking-widest">Step {currentStepIndex + 1} of {steps.length}</p>
          <p className="text-3xl font-bold leading-relaxed">{steps[currentStepIndex]}</p>
        </div>
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => goToStep(currentStepIndex - 1)}
            disabled={currentStepIndex === 0}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={toggleListening}
            className={`p-4 rounded-full ${isListening ? 'bg-red-500' : 'bg-[#6BAEE0]'} text-white shadow-lg transition-all`}
          >
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          <button onClick={() => readStep(currentStepIndex)} className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-all">
            <Volume2 size={24} />
          </button>
          <button
            onClick={() => goToStep(currentStepIndex + 1)}
            disabled={currentStepIndex === steps.length - 1}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 transition-all"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        <p className="text-xs text-white/50 text-center mt-4">Say "Next", "Back", "Repeat", or "Stop"</p>
      </div>
    </div>
  );
}
