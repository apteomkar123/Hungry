import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Plus, Check, Trash2, ShoppingCart, Pencil, Sparkles, Loader2, Users, User, MessageSquare } from 'lucide-react';
import { useUser } from './UserContext';
import { supabase } from '../supabaseClient';

const AISLES = [
  { key: 'Frozen', emoji: '🧊', pattern: /\b(frozen|ice cream|gelato|popsicle|sorbet|frost)\b/i },
  { key: 'Alcohol', emoji: '🍷', pattern: /\b(beer|wine|champagne|prosecco|spirit|whiskey|bourbon|vodka|rum|gin|tequila|brandy|liqueur|sake|mead|hard cider|hard seltzer|ale|lager|stout)\b/i },
  { key: 'Snacks', emoji: '🍿', pattern: /\b(chip|crisp|cracker|cookie|candy|chocolate|popcorn|pretzel|almond|cashew|walnut|peanut|pistachio|granola|protein bar|rice cake|snack|nut)\b/i },
  { key: 'Bakery', emoji: '🥐', pattern: /\b(bread|roll|bun|muffin|croissant|bagel|tortilla|wrap|pita|naan|loaf|biscuit|wafer|cereal|oat)\b/i },
  { key: 'Dairy & Eggs', emoji: '🥛', pattern: /\b(milk|cheese|butter|yogurt|cream|eggs?|paneer|ghee|curd|whey|kefir|mozzarella|cheddar|parmesan|brie|ricotta|cottage|sour cream|dairy|half and half)\b/i },
  { key: 'Meat & Fish', emoji: '🫘', pattern: /\b(chicken|beef|pork|lamb|turkey|fish|salmon|tuna|shrimp|crab|lobster|bacon|sausage|ham|mutton|duck|seafood|steak|mince|pepperoni|anchovy|venison|veal|salami|prawn|tilapia|cod|sardine)\b/i },
  { key: 'Beverages', emoji: '☕', pattern: /\b(water|juice|soda|tea|coffee|drink|beverage|smoothie|shake|cola|lemonade|kombucha|sparkling|almond milk|oat milk)\b/i },
  { key: 'Produce', emoji: '🥦', pattern: /\b(apple|banana|orange|mango|grape|strawberry|blueberry|raspberry|lemon|lime|pear|peach|cherry|watermelon|pineapple|kiwi|avocado|fig|coconut|carrot|potato|tomato|onion|garlic|spinach|broccoli|cauliflower|lettuce|cabbage|cucumber|pepper|celery|kale|zucchini|eggplant|mushroom|corn|pea|bean|lentil|asparagus|beetroot|radish|leek|squash|ginger|chili|herb|cilantro|parsley|basil|mint|thyme|rosemary|scallion|shallot|arugula|chard)\b/i },
  { key: 'Pantry', emoji: '📦', pattern: null },
];

const getAisle = (itemName) => {
  const n = (itemName || '').toLowerCase();
  for (const aisle of AISLES) {
    if (aisle.pattern && aisle.pattern.test(n)) return aisle.key;
  }
  return 'Pantry';
};

export default function ShoppingListManager({ list = [], onAdd, onToggle, onClear, onRename, onClearAll, onMarkAllDone, onAddToPantry, onRemoveFromPantry, onMoveItem, onUpdateNote, households = [], activeHousehold }) {
  const { userSettings } = useUser();
  const [shoppingInput, setShoppingInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [noteEditingId, setNoteEditingId] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [swapLoadingId, setSwapLoadingId] = useState(null);
  const [swapResults, setSwapResults] = useState({});
  const [hhPickerId, setHhPickerId] = useState(null);
  const [hidden, setHidden] = useState(new Set());
  const [quantitySuggestion, setQuantitySuggestion] = useState('');
  const [quantityLoading, setQuantityLoading] = useState(false);
  // undoQueue: array of { id, item_name, clearTimerId }
  const [undoQueue, setUndoQueue] = useState([]);
  const hideTimersRef = useRef({});
  const editRef = useRef(null);
  const noteRef = useRef(null);
  const nutritionGoal = userSettings?.nutrition_goal || null;

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => { Object.values(hideTimersRef.current).forEach(clearTimeout); };
  }, []);

  // Close household picker when clicking outside
  useEffect(() => {
    if (!hhPickerId) return;
    const close = () => setHhPickerId(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [hhPickerId]);

  const fetchSwap = useCallback(async (item) => {
    if (swapLoadingId || swapResults[item.id]) return;
    setSwapLoadingId(item.id);
    try {
      const dietaryRestrictions = userSettings?.dietary_restrictions || [];
      const dietContext = dietaryRestrictions.length > 0 ? ` Dietary restrictions: ${dietaryRestrictions.join(', ')}.` : '';
      const prompt = `You are a nutrition coach. The user's goal is: "${nutritionGoal || 'Balanced diet'}".${dietContext} They have "${item.item_name}" on their shopping list. Suggest ONE better alternative ingredient that helps reach their goal and respects their dietary restrictions. Make sure the substitute is a food item, not a cooking method or recipe name. Reply in exactly this format (no extra text): "Instead of [item], try [alternative] — [one short reason]."`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true }),
      });
      const text = await res.text();
      setSwapResults(prev => ({ ...prev, [item.id]: text.trim().replace(/^"|"$/g, '') }));
    } catch {
      setSwapResults(prev => ({ ...prev, [item.id]: 'Could not fetch suggestion right now.' }));
    }
    setSwapLoadingId(null);
  }, [swapLoadingId, swapResults, nutritionGoal, userSettings]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!shoppingInput.trim()) return;
    onAdd(shoppingInput);
    setShoppingInput('');
    setQuantitySuggestion('');
  };

  const fetchQuantitySuggestion = useCallback(async () => {
    if (!shoppingInput.trim() || quantityLoading) return;
    setQuantityLoading(true);
    try {
      const prompt = `A shopper is buying "${shoppingInput.trim()}". Suggest the ideal quantity to buy for a typical household of 2-4 people (e.g. "2 lbs", "1 dozen", "1 bunch", "2 cans"). Reply with ONLY the quantity, nothing else.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true }),
      });
      const text = (await res.text()).trim().replace(/^"|"$/g, '');
      setQuantitySuggestion(text);
    } catch {
      setQuantitySuggestion('');
    }
    setQuantityLoading(false);
  }, [shoppingInput, quantityLoading]);

  const handleToggleItem = (item) => {
    if (!item.is_completed) {
      // Mark done: immediately hide from UI and add to pantry
      onToggle(item.id, false);
      setHidden(prev => new Set([...prev, String(item.id)]));
      if (onAddToPantry) onAddToPantry(item.item_name);

      // Schedule DB deletion after 5s undo window
      const clearTimerId = setTimeout(() => {
        if (onClear) onClear(item.id);
        setUndoQueue(prev => prev.filter(u => u.id !== item.id));
      }, 5000);

      setUndoQueue(prev => [...prev.filter(u => u.id !== item.id), { id: item.id, item_name: item.item_name, clearTimerId }]);
    } else {
      // Uncheck: restore item
      onToggle(item.id, true);
      setHidden(prev => { const next = new Set(prev); next.delete(String(item.id)); return next; });
      if (onRemoveFromPantry) onRemoveFromPantry(item.item_name);
    }
  };

  const handleUndo = (undoEntry) => {
    clearTimeout(undoEntry.clearTimerId);
    setUndoQueue(prev => prev.filter(u => u.id !== undoEntry.id));
    setHidden(prev => { const next = new Set(prev); next.delete(String(undoEntry.id)); return next; });
    onToggle(undoEntry.id, true); // un-complete it
    if (onRemoveFromPantry) onRemoveFromPantry(undoEntry.item_name);
  };

  const pending = useMemo(() => list.filter(i => !i.is_completed), [list]);
  const completed = useMemo(() => list.filter(i => i.is_completed && !hidden.has(String(i.id))), [list, hidden]);

  const handleMarkAllDoneWithTimers = () => {
    if (onMarkAllDone) {
      pending.forEach(item => {
        setHidden(prev => new Set([...prev, String(item.id)]));
        if (onAddToPantry) onAddToPantry(item.item_name);
        const clearTimerId = setTimeout(() => {
          if (onClear) onClear(item.id);
          setUndoQueue(prev => prev.filter(u => u.id !== item.id));
        }, 5000);
        setUndoQueue(prev => [...prev.filter(u => u.id !== item.id), { id: item.id, item_name: item.item_name, clearTimerId }]);
      });
      onMarkAllDone();
    }
  };

  const groupedByAisle = useMemo(() => AISLES.reduce((acc, aisle) => {
    acc[aisle.key] = pending.filter(i => getAisle(i.item_name) === aisle.key);
    return acc;
  }, {}), [pending]);

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditingName(item.item_name);
    setTimeout(() => editRef.current?.focus(), 0);
  };
  const commitEdit = (item) => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== item.item_name && onRename) onRename(item.id, trimmed);
    setEditingId(null);
  };

  const startNoteEditing = (item) => {
    setNoteEditingId(item.id);
    setNoteInput(item.note || '');
    setTimeout(() => noteRef.current?.focus(), 0);
  };
  const commitNote = async (item) => {
    if (onUpdateNote) onUpdateNote(item.id, noteInput);
    setNoteEditingId(null);

    // Fire mention_notification for @username tags in notes
    const mentioned = [...noteInput.matchAll(/@(\w+)/g)].map(m => m[1].toLowerCase());
    if (mentioned.length && user?.id && activeHousehold?.id) {
      const { data: mems } = await supabase
        .from('household_members')
        .select('profile_id, profiles(id, username)')
        .eq('household_id', activeHousehold.id);
      const matched = (mems || [])
        .filter(m => mentioned.includes(m.profiles?.username?.toLowerCase()))
        .map(m => m.profiles);
      await Promise.all(matched.map(p =>
        supabase.from('cross_app_activity').insert({
          user_id: user.id,
          app: 'pantry',
          activity_type: 'mention_notification',
          is_public: false,
          payload: { household_id: activeHousehold.id, mentioned_id: p.id, mentioned_name: p.username, context: noteInput.slice(0, 100) },
        })
      ));
    }
  };

  const getHHLabel = (hhId) => households.find(h => h.id === hhId)?.name || 'Shared';

  const renderItem = (item) => (
    <div key={item.id} className={`bg-white border rounded-2xl transition-all ${item.is_completed ? 'border-transparent opacity-50' : 'border-blue-50 shadow-sm'}`}>
      <div className="flex items-center justify-between gap-2 p-4 min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => handleToggleItem(item)} className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${item.is_completed ? 'bg-sky-500 text-white' : 'bg-blue-50 text-transparent border border-blue-100'}`}>
            <Check size={14} strokeWidth={4} />
          </button>
          {editingId === item.id ? (
            <input
              ref={editRef}
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              onBlur={() => commitEdit(item)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') setEditingId(null); }}
              className="flex-1 text-xs font-bold text-slate-700 bg-blue-50 border border-sky-300 rounded-lg px-2 py-1 focus:outline-none"
              style={{ fontSize: '16px' }}
            />
          ) : (
            <span
              className={`text-xs font-bold text-slate-700 break-words min-w-0 flex-1 leading-snug ${item.is_completed ? 'line-through text-slate-400' : ''}`}
              onDoubleClick={() => !item.is_completed && startEditing(item)}
            >{item.item_name}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!item.is_completed && onRename && (
            <button onClick={() => startEditing(item)} className="text-slate-200 hover:text-sky-400 transition-colors p-1.5"><Pencil size={14} /></button>
          )}
          {/* Note button */}
          {!item.is_completed && onUpdateNote && (
            <button
              onClick={() => startNoteEditing(item)}
              className={`p-1.5 transition-colors ${item.note ? 'text-amber-400' : 'text-slate-200 hover:text-amber-400'}`}
              title={item.note ? 'Edit note' : 'Add note'}
            >
              <MessageSquare size={14} />
            </button>
          )}
          {/* Household assignment */}
          {!item.is_completed && onMoveItem && households.length > 0 && (
            <div className="relative" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <button
                onClick={() => setHhPickerId(prev => prev === item.id ? null : item.id)}
                className={`flex items-center gap-1 p-1.5 rounded-lg transition-colors ${item.household_id ? 'text-[#6BAEE0]' : 'text-slate-200 hover:text-sky-400'}`}
                title="Move to household list"
              >
                {item.household_id ? <Users size={14} /> : <User size={14} />}
              </button>
              {hhPickerId === item.id && (
                <div className="absolute right-0 bottom-full mb-2 bg-white border border-blue-100 rounded-2xl shadow-2xl min-w-[160px] p-2 space-y-1"
                  style={{ zIndex: 9999 }}>
                  <button
                    onClick={() => { onMoveItem(item.id, null); setHhPickerId(null); }}
                    className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2"
                  >
                    <User size={11} /> Personal
                  </button>
                  {households.map(h => (
                    <button
                      key={h.id}
                      onClick={() => { onMoveItem(item.id, h.id); setHhPickerId(null); }}
                      className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-sky-50 hover:text-[#6BAEE0] flex items-center gap-2"
                    >
                      <Users size={11} /> {h.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* AI Swap suggestion */}
          {!item.is_completed && nutritionGoal && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchSwap(item); }}
              className="p-1.5 text-slate-300 hover:text-violet-400 transition-colors"
              title="Suggest better alternative"
            >
              {swapLoadingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            </button>
          )}
          <button onClick={() => onClear(item.id)} className="text-slate-200 hover:text-red-400 transition-colors p-1.5"><Trash2 size={14} /></button>
        </div>
      </div>
      {/* Inline note editor */}
      {noteEditingId === item.id && (
        <div className="px-4 pb-3">
          <input
            ref={noteRef}
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onBlur={() => commitNote(item)}
            onKeyDown={e => { if (e.key === 'Enter') commitNote(item); if (e.key === 'Escape') setNoteEditingId(null); }}
            placeholder="Add a note…"
            className="w-full text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400"
            style={{ fontSize: '16px' }}
          />
        </div>
      )}
      {/* Display existing note */}
      {item.note && noteEditingId !== item.id && (
        <div className="px-4 pb-3 flex items-start gap-2 cursor-pointer" onClick={() => !item.is_completed && startNoteEditing(item)}>
          <MessageSquare size={10} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-600 italic leading-relaxed">{item.note}</p>
        </div>
      )}
      {/* Swap suggestion result */}
      {swapResults[item.id] && !item.is_completed && (
        <div className="px-4 pb-3 flex items-start gap-2">
          <Sparkles size={11} className="text-violet-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-violet-600 font-bold leading-relaxed">{swapResults[item.id]}</p>
          <button onClick={() => setSwapResults(prev => { const n = {...prev}; delete n[item.id]; return n; })} className="text-slate-200 hover:text-slate-400 shrink-0">
            <span className="text-[10px]">×</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Undo toasts */}
      {undoQueue.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-200">
          {undoQueue.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 bg-slate-800 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-300">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span className="truncate max-w-40">{entry.item_name} added to pantry</span>
              <button
                onClick={() => handleUndo(entry)}
                className="ml-1 text-[#6BAEE0] font-black hover:text-sky-300 transition-colors shrink-0"
              >Undo</button>
            </div>
          ))}
        </div>
      )}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="p-3 bg-sky-50 text-[#6BAEE0] rounded-2xl">
            <ShoppingCart size={20} />
          </div>
          <h2 className="text-[14px] font-bold text-slate-400">Shopping List</h2>
          <span className="ml-auto bg-blue-50 text-[#6BAEE0] text-[10px] font-black px-3 py-1 rounded-full border border-blue-100">{pending.length} items</span>
        </div>
        {list.length > 0 && (
          <div className="flex gap-2 mb-4">
            {onMarkAllDone && pending.length > 0 && (
              <button onClick={handleMarkAllDoneWithTimers} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100 hover:bg-emerald-100 transition-all">
                <Check size={12} /> Mark All Done
              </button>
            )}
            {onClearAll && (
              <button onClick={() => { if (window.confirm('Clear the entire shopping list?')) onClearAll(); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-400 text-[10px] font-black border border-red-100 hover:bg-red-100 transition-all">
                <Trash2 size={12} /> Delete All
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleAddSubmit} className="flex gap-2 mb-2">
          <input
            type="text" value={shoppingInput}
            onChange={(e) => { setShoppingInput(e.target.value); setQuantitySuggestion(''); }}
            placeholder="Add items to buy..."
            style={{ fontSize: '16px' }}
            className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm"
          />
          {shoppingInput.trim() && (
            <button
              type="button"
              onClick={fetchQuantitySuggestion}
              disabled={quantityLoading}
              className="p-4 bg-violet-50 text-violet-400 rounded-2xl hover:bg-violet-100 transition-all active:scale-90"
              title="Suggest quantity"
            >
              {quantityLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            </button>
          )}
          <button type="submit" className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
            <Plus size={20} />
          </button>
        </form>
        {quantitySuggestion && (
          <div className="flex items-center gap-2 mb-4 px-1">
            <Sparkles size={11} className="text-violet-400 shrink-0" />
            <p className="text-[10px] text-violet-600 font-bold">Suggested: {quantitySuggestion}</p>
            <button
              onClick={() => setShoppingInput(prev => `${quantitySuggestion} ${prev}`.trim())}
              className="text-[9px] font-black text-violet-500 bg-violet-50 px-2 py-0.5 rounded-lg hover:bg-violet-100 transition-colors"
            >Add</button>
            <button onClick={() => setQuantitySuggestion('')} className="text-[9px] text-slate-300 hover:text-slate-500 ml-auto">✕</button>
          </div>
        )}

        {list.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium italic text-center py-10">Your list is empty</p>
        ) : (
          <div className="space-y-5">
            {AISLES.filter(a => groupedByAisle[a.key]?.length > 0).map(aisle => (
              <div key={aisle.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-base">{aisle.emoji}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{aisle.key}</span>
                  <span className="text-[9px] font-bold text-slate-300 ml-1">{groupedByAisle[aisle.key].length}</span>
                </div>
                <div className="grid gap-2">
                  {groupedByAisle[aisle.key].map(renderItem)}
                </div>
              </div>
            ))}
            {completed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-base">✅</span>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Done</span>
                </div>
                <div className="grid gap-2">{completed.map(renderItem)}</div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
