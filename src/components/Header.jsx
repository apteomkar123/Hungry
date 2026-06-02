import React, { useState } from 'react';
import { Sparkles, ShoppingBag, Loader2 } from 'lucide-react';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';

export default function Header({ scrollToTop, onOpenNav }) {
  const { user, userName, avatarUrl, hungryAvatarUrl } = useUser();
  const { setIsAiPickerOpen, triggerStoreTripPlanner, aiGenerating } = useRecipes();
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  });
  const displayName = userName || user?.email?.split('@')[0] || 'Chef';
  const photo = hungryAvatarUrl || avatarUrl;

  return (
    <header
      className="bg-white border border-blue-100 rounded-[2.5rem] sticky top-4 mx-4 z-40 px-6 py-4 flex justify-between items-center w-[calc(100%-2rem)] max-w-6xl shadow-lg shadow-slate-200 backdrop-blur-xl cursor-pointer"
      onClick={() => scrollToTop?.()}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenNav?.(); }}
          className="active:opacity-70 transition-opacity shrink-0"
        >
          {photo
            ? <img src={photo} alt="" className="w-10 h-10 rounded-2xl object-cover border border-blue-100" />
            : <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-sm font-black text-[#6BAEE0]">{displayName.slice(0,1).toUpperCase()}</div>
          }
        </button>
        <button
          onClick={() => scrollToTop?.()}
          className="flex flex-col text-left active:opacity-70 transition-opacity"
        >
          <h1 className="logo-text" style={{ fontSize: '1.4rem', lineHeight: '1', paddingBottom: '9px' }}>Hungry</h1>
          <p className="text-slate-500 text-[11px] font-bold leading-none">{greeting}, <span className="text-[#1F6FB8]">{displayName}</span>!</p>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); setIsAiPickerOpen(true); }}
          disabled={aiGenerating}
          title="Generate AI Recipe"
          className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-2xl hover:bg-sky-100 transition-colors disabled:opacity-60"
        >
          {aiGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); triggerStoreTripPlanner(); }} title="Shopping Suggestions" className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-2xl hover:bg-sky-100 transition-colors">
          <ShoppingBag size={20} />
        </button>
      </div>
    </header>
  );
}