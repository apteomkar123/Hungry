import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

const CUISINE_GENRE_MAP = {
  italian: 'classical', french: 'jazz', indian: 'world-music', japanese: 'ambient',
  mexican: 'latin', thai: 'world-music', chinese: 'world-music', greek: 'classical',
  american: 'country', korean: 'k-pop', spanish: 'flamenco', mediterranean: 'jazz',
};
function cuisineToGenre(cuisine) {
  if (!cuisine) return 'lo-fi';
  return CUISINE_GENRE_MAP[cuisine.toLowerCase()] || 'lo-fi';
}

export default function CookingMode({ steps, ingredients, recipeName, cuisine, onClose }) {
  const { user } = useUser();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [substituteMsg, setSubstituteMsg] = useState(null);
  const [fetchingSub, setFetchingSub] = useState(false);

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const wakeLockRef = useRef(null);
  const isListeningRef = useRef(false);
  const isMounted = useRef(true);
  const currentStepRef = useRef(0);

  useEffect(() => { currentStepRef.current = currentStepIndex; }, [currentStepIndex]);

  const speak = useCallback((text) => {
    if (!utteranceRef.current) return;
    window.speechSynthesis.cancel();
    utteranceRef.current.text = text;
    window.speechSynthesis.speak(utteranceRef.current);
  }, []);

  const goToStep = useCallback((index) => {
    const next = Math.max(0, Math.min(index, steps.length - 1));
    setCurrentStepIndex(next);
  }, [steps]);

  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(lock => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    }
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('cross_app_activity').insert({
      user_id: user.id,
      app: 'pantry',
      activity_type: 'cooking_started',
      is_public: false,
      payload: {
        recipe_name: recipeName || '',
        cuisine: cuisine || '',
        genre_seed: cuisineToGenre(cuisine),
      },
    }).then(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubstitute = useCallback(async (ingredientMentioned) => {
    setFetchingSub(true);
    setSubstituteMsg(null);
    try {
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPrompt: `The user is cooking and says they don't have "${ingredientMentioned}". Suggest a quick, practical substitution from common pantry items. Keep your answer under 20 words.`,
          directMode: true,
        }),
      });
      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      let msg = cleaned;
      try { msg = JSON.parse(cleaned)?.answer || cleaned; } catch {}
      setSubstituteMsg(msg);
      speak(`Substitution for ${ingredientMentioned}: ${msg}`);
    } catch {
      setSubstituteMsg('Could not find a substitution. Try using a similar ingredient.');
    } finally {
      setFetchingSub(false);
    }
  }, [speak]);

  useEffect(() => {
    isMounted.current = true;
    utteranceRef.current = new SpeechSynthesisUtterance();
    utteranceRef.current.lang = 'en-US';
    utteranceRef.current.rate = 0.92;
    utteranceRef.current.pitch = 1.05;
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = [
        'Google US English', 'Microsoft Aria Online (Natural)', 'Microsoft Jenny Online (Natural)',
        'Samantha', 'Alex', 'Karen', 'Moira',
      ];
      for (const name of preferred) {
        const v = voices.find(v => v.name === name || v.name.startsWith(name));
        if (v) { utteranceRef.current.voice = v; break; }
      }
    };
    setVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = setVoice;
    }

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
        } else if (transcript.includes('stop') || transcript.includes('exit') || transcript.includes('close')) {
          onClose();
        } else if (transcript.includes('ingredients') || transcript.includes('what do i need')) {
          setShowIngredients(true);
          speak('Showing your ingredient list.');
        } else if (transcript.includes("don't have") || transcript.includes("do not have") || transcript.includes("out of") || transcript.includes("no ")) {
          const patterns = [/(?:don't have|do not have|out of|no )\s+(?:any\s+)?(.+)/];
          for (const p of patterns) {
            const m = transcript.match(p);
            if (m && m[1]) {
              fetchSubstitute(m[1].trim());
              break;
            }
          }
        } else if (transcript.includes('substitute') || transcript.includes('replace') || transcript.includes('swap')) {
          const m = transcript.match(/(?:substitute|replace|swap)(?:\s+(?:for|the))?\s+(.+)/);
          if (m?.[1]) fetchSubstitute(m[1].trim());
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'aborted') return;
        if (!isMounted.current) return;
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        if (isListeningRef.current && isMounted.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      isMounted.current = false;
      try { recognitionRef.current?.stop(); } catch (e) {}
      window.speechSynthesis.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-100 text-white overflow-hidden" onClick={handleClose}>
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-linear-to-br from-[#0a1628] via-[#1a3a5c] to-[#0d1f3a]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#6BAEE0]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Content — stopPropagation so tapping content doesn't close */}
      <div className="relative flex flex-col h-full max-h-dvh" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex justify-between items-start px-6 pt-10 pb-3 shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-0.5 truncate max-w-45">{recipeName}</p>
            <h2 className="text-lg font-black text-white">Cooking Mode</h2>
          </div>
          <div className="flex items-center gap-2">
            {ingredients?.length > 0 && (
              <button
                onClick={() => setShowIngredients(v => !v)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${showIngredients ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/15'}`}
              >
                {showIngredients ? 'Hide' : 'Ingredients'}
              </button>
            )}
            <button onClick={handleClose} className="p-2 bg-white/10 rounded-xl border border-white/15 text-white/60 hover:text-white transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6BAEE0] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-white/40 shrink-0 tabular-nums">
              {currentStepIndex + 1}/{steps.length}
            </span>
          </div>
        </div>

        {/* Ingredient panel */}
        {showIngredients && ingredients?.length > 0 && (
          <div className="mx-6 mb-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4 max-h-36 overflow-y-auto shrink-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2">Ingredients</p>
            <div className="space-y-1">
              {ingredients.map((ing, i) => (
                <p key={i} className="text-xs text-white/70 font-medium">{ing}</p>
              ))}
            </div>
          </div>
        )}

        {/* Substitute suggestion */}
        {(fetchingSub || substituteMsg) && (
          <div className="mx-6 mb-3 bg-amber-400/15 border border-amber-300/20 rounded-2xl px-4 py-3 flex items-start gap-2 shrink-0">
            {fetchingSub
              ? <Loader2 size={14} className="animate-spin text-amber-300 mt-0.5 shrink-0" />
              : <RefreshCw size={14} className="text-amber-300 mt-0.5 shrink-0" />}
            <p className="text-xs text-amber-100 leading-relaxed">{fetchingSub ? 'Finding a substitution…' : substituteMsg}</p>
            {substituteMsg && !fetchingSub && (
              <button onClick={() => setSubstituteMsg(null)} className="ml-auto text-white/30 hover:text-white/70 shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Main step card */}
        <div className="flex-1 flex items-center justify-center px-6 py-2 min-h-0">
          <div className="w-full max-w-lg">
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-4xl p-8 shadow-2xl shadow-black/40">
              {/* Step number badge */}
              <div className="flex items-center justify-center mb-6">
                <div className="w-12 h-12 bg-[#6BAEE0]/20 border border-[#6BAEE0]/30 rounded-2xl flex items-center justify-center shadow-lg shadow-[#6BAEE0]/10">
                  <span className="text-lg font-black text-[#6BAEE0]">{currentStepIndex + 1}</span>
                </div>
              </div>
              {/* Step text */}
              <p className="text-xl font-bold leading-relaxed text-center text-white">
                {steps[currentStepIndex]}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-8 shrink-0">
          <div className="flex items-center justify-center gap-5 mb-4">
            {/* Prev */}
            <button
              onClick={() => goToStep(currentStepIndex - 1)}
              disabled={currentStepIndex === 0}
              className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/10 border border-white/15 hover:bg-white/20 disabled:opacity-25 transition-all active:scale-90"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Sous Chef mic */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleListening}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl
                  ${isListening
                    ? 'bg-red-500 shadow-red-500/40 scale-105'
                    : 'bg-[#6BAEE0] shadow-[#6BAEE0]/30 hover:scale-105'
                  }`}
              >
                {isListening && (
                  <span className="absolute inset-0 rounded-full bg-red-400/50 animate-ping" />
                )}
                {isListening
                  ? <MicOff size={30} className="relative z-10" />
                  : <Mic size={30} className="relative z-10" />
                }
              </button>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                {isListening ? '● Listening' : 'Sous Chef'}
              </span>
            </div>

            {/* Next */}
            <button
              onClick={() => goToStep(currentStepIndex + 1)}
              disabled={currentStepIndex === steps.length - 1}
              className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/10 border border-white/15 hover:bg-white/20 disabled:opacity-25 transition-all active:scale-90"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <p className="text-[9px] text-white/25 text-center">
            Say "Next", "Back", "Ingredients", or "I don't have [ingredient]"
          </p>
        </div>

      </div>
    </div>
  );
}
