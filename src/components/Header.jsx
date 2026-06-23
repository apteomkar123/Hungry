import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, ShoppingBag, Loader2, Bell } from 'lucide-react';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';
import NotificationPanel from './NotificationPanel';

export default function Header({ scrollToTop, onOpenNav, fridge, quantities, onRemoveItem, onAdjustQuantity, onUpdateItem, onAddShoppingItem }) {
  const { user, userName, avatarUrl, pantryAvatarUrl, households, household: activeHousehold, handleSetActiveHousehold } = useUser();
  const { setIsAiPickerOpen, triggerStoreTripPlanner, aiGenerating } = useRecipes();
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const displayName = userName || user?.email?.split('@')[0] || 'Chef';
  const photo = pantryAvatarUrl || avatarUrl;

  const notifCount = useMemo(() => {
    if (!fridge) return 0;
    return fridge.filter(item => {
      if (!item.expiry_date) return false;
      const days = (new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;
  }, [fridge]);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [notifOpen]);

  return (
    <header
      className="bg-white border border-blue-100 rounded-[2.5rem] sticky top-4 mx-4 z-40 px-6 py-4 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-6xl shadow-lg shadow-slate-200 backdrop-blur-xl"
    >
      <div className="flex justify-between items-center">
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
          <button className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <h1 className="logo-text" style={{ fontSize: '1.4rem', lineHeight: '1', paddingBottom: '9px' }}>Pantry</h1>
              {activeHousehold?.avatar_url && (
                <img src={activeHousehold.avatar_url} alt="" className="w-5 h-5 rounded-lg object-cover border border-sky-100 mb-1.5" title={activeHousehold.name} />
              )}
            </div>
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
          <div className="relative" ref={notifRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setNotifOpen(o => !o); }}
              title="Notifications"
              className="relative bg-sky-50 text-[#6BAEE0] p-2.5 rounded-2xl hover:bg-sky-100 transition-colors"
            >
              <Bell size={20} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-400 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationPanel
                fridge={fridge}
                quantities={quantities}
                onRemoveItem={onRemoveItem}
                onAdjustQuantity={onAdjustQuantity}
                onUpdateItem={onUpdateItem}
                onAddShoppingItem={onAddShoppingItem}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Household switcher — only shown when user has multiple households */}
      {households?.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {households.map(h => (
            <button
              key={h.id}
              onClick={(e) => { e.stopPropagation(); handleSetActiveHousehold(h.id); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${activeHousehold?.id === h.id ? 'bg-[#6BAEE0] text-white shadow-sm' : 'bg-blue-50 text-slate-500 hover:bg-sky-100'}`}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}