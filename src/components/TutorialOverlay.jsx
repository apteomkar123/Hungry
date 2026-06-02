import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, PartyPopper, Play, Mic, ChefHat } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

// Each step: tab, CSS selector for the element to highlight, label and content
const STEPS = [
  {
    title: 'Your Smart Pantry',
    tab: 'pantry',
    emoji: '🥦',
    selector: null, // highlight the whole pantry area
    scrollTop: true,
    lines: [
      'Snap a grocery receipt or scan a barcode — AI parses quantities and auto-fills expiry dates.',
      'Items are grouped by category. Tap any category bubble to see all items inside.',
      'Each item shows expiry date, nutrition, and price. Tap to edit any detail.',
    ],
  },
  {
    title: 'Recipe Explorer',
    tab: 'recipes',
    emoji: '👨‍🍳',
    selector: null,
    scrollTop: true,
    lines: [
      'Pick a mood — Tired, Post-Workout, Adventurous — to instantly boost matching recipes.',
      'Your pantry match % is shown on each card. Green = you have it.',
      'Tap ✨ AI to pick pantry items and get a custom recipe invented just for you.',
    ],
  },
  {
    title: 'Inside a Recipe',
    tab: 'recipes',
    emoji: '📋',
    selector: null,
    scrollTop: false,
    lines: [
      'Tap any recipe card to open it.',
      'One tap: Make Vegetarian, Make Vegan, Proteinize. The AI adapts the whole recipe.',
      'Add All Missing fills your shopping list. Start Cooking launches the Virtual Sous Chef.',
    ],
  },
  {
    title: 'Virtual Sous Chef',
    tab: 'recipes',
    emoji: '🎙️',
    selector: null,
    scrollTop: false,
    cookingPreview: true,
    lines: [
      'Say Next, Back, Repeat, or Ingredients — completely hands-free.',
      'Say "I don\'t have cumin" and the AI suggests a real-time pantry substitution.',
      'Tap Cooked! to auto-subtract ingredients and log the meal to your history.',
    ],
  },
  {
    title: 'Shopping List',
    tab: 'shopping',
    emoji: '🛒',
    selector: null,
    scrollTop: true,
    lines: [
      'Items are auto-grouped by aisle — Produce, Dairy, Meat, Bakery, and more.',
      'Double-tap any item to rename it. Tap 👥 to move it to a household list.',
      'Tap ✨ next to any item to get a smarter alternative based on your nutrition goal.',
    ],
  },
  {
    title: 'Personal Shopper',
    tab: 'shopping',
    emoji: '🏪',
    selector: null,
    scrollTop: true,
    lines: [
      'Tap Go Shopping at the top right to launch Personal Shopper mode.',
      'Pick your store — aisle locations update instantly for 13+ stores.',
      'Can\'t find an item? Tap "Can\'t find it?" for an AI substitution suggestion.',
    ],
  },
  {
    title: 'Household & Settle Up',
    tab: 'household',
    emoji: '🏠',
    selector: null,
    scrollTop: true,
    lines: [
      'Create or join a household with an invite code — share pantry, list, and recipes.',
      'Settle Up calculates each member\'s share and opens Venmo or Splitwise pre-filled.',
      'The At the Store banner appears when a roommate is grocery shopping.',
    ],
  },
  {
    title: 'Events & Potluck',
    tab: 'potluck',
    emoji: '🎉',
    selector: null,
    scrollTop: true,
    lines: [
      'Create a named event with a date, time, and venue. Share the invite code with friends.',
      'Anyone can claim items — Buns ✓, Ice ✓. The readiness bar fills in real-time.',
      'Tap ✨ Smart Suggestions — AI reads the event name and dietary restrictions.',
    ],
  },
  {
    title: 'Community Recipes',
    tab: 'community',
    emoji: '🌍',
    selector: null,
    scrollTop: true,
    lines: [
      'Browse 14+ category rows: Trending, Indian, Italian, High Protein, Quick & Easy…',
      'Tap the arrow at the end of a row — or View All — to see the full grid.',
      'Search any dish to pull up full ingredients and steps from a global database.',
    ],
  },
  {
    title: 'Friends & Profiles',
    tab: 'friends',
    emoji: '👥',
    selector: null,
    scrollTop: true,
    lines: [
      'Add friends by sharing your 8-character Friend Code or searching by name.',
      'Tap any friend to see their public Chef History feed and saved recipe favorites.',
      'Household members get an Add Friend button so you\'re always connected.',
    ],
  },
  {
    title: 'Analytics & Taste Profile',
    tab: 'analytics',
    emoji: '📊',
    selector: null,
    scrollTop: true,
    lines: [
      'The Taste Profile heat map shows every world cuisine you\'ve cooked — with mastery badges.',
      'Set a macro goal in the AI Nutrition Coach for custom ingredient and recipe suggestions.',
      'Chef History logs every dish you\'ve cooked. Tap Remix Leftovers to invent a new recipe.',
    ],
  },
  {
    title: 'Your Profile',
    tab: 'profile',
    emoji: '👤',
    selector: null,
    scrollTop: true,
    lines: [
      'Tap Profile in the menu to set what others can see on your public profile.',
      'Toggle sections like Chef History, Saved Recipes, and Analytics between Public and Private.',
      'Expand Individual Recipe Visibility to control public/private per saved recipe.',
    ],
  },
  {
    title: 'AppWare Ecosystem',
    tab: 'household',
    emoji: '🌐',
    selector: null,
    scrollTop: true,
    lines: [
      'Hungry, Roomies, and Jukebox are connected — sharing households, grocery lists, and musical moments.',
      'In Household Settings, choose Shared with Roomies (default) or set a Hungry-specific household to keep them separate.',
      'Open the AppWare tab to see a live cross-app dashboard: chores, bills, cooking activity, and now-playing.',
    ],
  },
  {
    title: 'Shared Grocery List',
    tab: 'shopping',
    emoji: '🛒',
    selector: null,
    scrollTop: true,
    lines: [
      'Items added to the household list in Hungry appear in Roomies automatically — and vice versa.',
      'Roomies items show a ROOMIES badge. You can check them off or delete from either app.',
      'In Household → Settle Up, tap Split in Roomies to push the grocery total to Roomies Finance for an equal split.',
    ],
  },
  {
    title: 'Kitchen Concert & Mood Food',
    tab: 'recipes',
    emoji: '🎵',
    selector: null,
    scrollTop: true,
    lines: [
      'When you Start Cooking, Hungry signals Jukebox to queue a genre-matched playlist based on the recipe\'s cuisine.',
      'When you mark a recipe Cooked, the currently-playing Jukebox track is saved in your Chef History as a music memory.',
      'Jukebox sends your current mood back to Hungry — the Recipe Explorer pre-selects the matching filter for you.',
    ],
  },
];

// Static preview of cooking mode shown during the Virtual Sous Chef step
function CookingModePreview() {
  const steps = ['Heat oil in a large pan over medium-high heat.', 'Add the onion and garlic, sauté until fragrant — about 2 minutes.', 'Add your protein and cook through, stirring occasionally.'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % steps.length), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-3 bg-[#0a1628] rounded-2xl p-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <ChefHat size={14} className="text-[#6BAEE0]" />
        <span className="text-[10px] font-black text-[#6BAEE0] uppercase tracking-widest">Cooking Mode Preview</span>
        <div className="flex-1" />
        <div className="flex gap-0.5">
          {steps.map((_, i) => <div key={i} className={`h-1 rounded-full transition-all ${i === idx ? 'w-4 bg-[#6BAEE0]' : 'w-1 bg-white/20'}`} />)}
        </div>
      </div>
      <p className="text-white text-sm font-semibold leading-relaxed min-h-12 transition-all">{steps[idx]}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button className="bg-white/10 text-white text-[10px] font-black px-3 py-1.5 rounded-xl">← Back</button>
          <button className="bg-[#6BAEE0] text-white text-[10px] font-black px-3 py-1.5 rounded-xl">Next →</button>
        </div>
        <button className="flex items-center gap-1.5 bg-white/10 text-white text-[10px] font-black px-3 py-1.5 rounded-xl">
          <Mic size={11} /> Sous Chef
        </button>
      </div>
    </div>
  );
}

export default function TutorialOverlay({ onComplete, onSkip, onSwitchTab, scrollContainerRef }) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [highlightBox, setHighlightBox] = useState(null);
  const prevTab = useRef(null);
  const highlightTimer = useRef(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Find the target element and set highlight box
  const updateHighlight = useCallback(() => {
    if (!current.selector) { setHighlightBox(null); return; }
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      const el = document.querySelector(current.selector);
      if (!el) { setHighlightBox(null); return; }
      const rect = el.getBoundingClientRect();
      setHighlightBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  }, [current.selector]);

  // Auto-navigate to relevant tab and scroll
  useEffect(() => {
    if (onSwitchTab && current.tab !== prevTab.current) {
      onSwitchTab(current.tab);
      prevTab.current = current.tab;
    }
    if (current.scrollTop && scrollContainerRef?.current) {
      setTimeout(() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 350);
    }
    updateHighlight();
    return () => clearTimeout(highlightTimer.current);
  }, [step, current.tab, current.scrollTop, onSwitchTab, updateHighlight, scrollContainerRef]);

  const handleComplete = async () => {
    setFinishing(true);
    try {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 180, spread: 100, origin: { y: 0.5 }, colors: ['#6BAEE0', '#1F6FB8', '#ffffff', '#a78bfa'] });
      }).catch(() => {});
      if (user) {
        await Promise.all([
          supabase.from('profiles').update({ hungry_tutorial_done: true }).eq('id', user.id),
          supabase.auth.updateUser({ data: { hungry_tutorial_done: true } }),
        ]);
      }
    } catch {}
    onComplete();
  };

  const handleSkip = async () => {
    try {
      if (user) {
        await Promise.all([
          supabase.from('profiles').update({ hungry_tutorial_done: true }).eq('id', user.id),
          supabase.auth.updateUser({ data: { hungry_tutorial_done: true } }),
        ]);
      }
    } catch {}
    onSkip();
  };

  const goNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">

      {/* Semi-transparent backdrop (only bottom-card area is pointer-events-auto) */}
      <div className="absolute inset-0 bg-blue-950/30 backdrop-blur-[1px]" />

      {/* Highlight ring around target element */}
      {highlightBox && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: highlightBox.top - 6,
            left: highlightBox.left - 6,
            width: highlightBox.width + 12,
            height: highlightBox.height + 12,
          }}
        >
          <div className="w-full h-full rounded-2xl border-2 border-[#6BAEE0] animate-ping opacity-60" />
          <div className="absolute inset-0 rounded-2xl border-2 border-[#6BAEE0] shadow-lg shadow-sky-400/40" />
        </div>
      )}

      {/* Tutorial card — pointer-events-auto so it's tappable */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pointer-events-auto">
        <div
          className="w-full max-w-md mx-auto bg-white/96 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden"
          style={{ animation: 'slideInUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards' }}
        >
          {/* Progress bar */}
          <div className="h-1 bg-blue-50">
            <div
              className="h-full bg-linear-to-r from-[#6BAEE0] to-[#4d96d1] transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-sky-100 to-blue-100 flex items-center justify-center text-2xl shadow-sm shrink-0">
                  {current.emoji}
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{step + 1} of {STEPS.length}</p>
                  <h2 className="logo-text text-xl text-[#1F6FB8] leading-tight">{current.title}</h2>
                </div>
              </div>
              <button onClick={handleSkip} className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {step === 0 && (
              <p className="text-xs font-black text-[#6BAEE0] italic mb-3">
                Everyone skips tutorials, but you won't want to skip this one.
              </p>
            )}

            {/* Bullet lines */}
            <ul className="space-y-2 mb-4">
              {current.lines.map((line, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-[#6BAEE0]/15 text-[#6BAEE0] flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black">{i + 1}</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{line}</p>
                </li>
              ))}
            </ul>

            {/* Cooking mode preview */}
            {current.cookingPreview && <CookingModePreview />}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3 mt-4">
              <button
                onClick={goBack}
                disabled={step === 0}
                className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={14} /> Back
              </button>

              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-[#6BAEE0]' : 'w-1.5 bg-slate-200'}`} />
                ))}
              </div>

              {isLast ? (
                <button
                  onClick={handleComplete}
                  disabled={finishing}
                  className="flex items-center gap-2 bg-linear-to-r from-[#6BAEE0] to-[#4d96d1] text-white font-black px-5 py-2.5 rounded-2xl text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-60"
                >
                  <PartyPopper size={15} /> {finishing ? 'Done!' : "Let's Cook!"}
                </button>
              ) : (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 bg-linear-to-r from-[#6BAEE0] to-[#4d96d1] text-white font-black px-5 py-2.5 rounded-2xl text-sm shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  Next <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
