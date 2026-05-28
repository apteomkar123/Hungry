import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Loader2, CalendarDays, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { categorizeItem, CATEGORY_ICONS, CATEGORY_ORDER } from './recipeUtils';

const BATCH_COLORS = [
  { bg: 'bg-sky-50', border: 'border-sky-100', accent: 'text-[#6BAEE0]', dot: 'bg-[#6BAEE0]' },
  { bg: 'bg-violet-50', border: 'border-violet-100', accent: 'text-violet-500', dot: 'bg-violet-400' },
  { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'text-emerald-600', dot: 'bg-emerald-500' },
];

export default function AiIngredientPickerModal() {
  const { isAiPickerOpen, setIsAiPickerOpen, fridge, handleGenerateAiRecipe, aiGenerating } = useRecipes();

  const allItems = useMemo(() => {
    if (!fridge) return [];
    return [...fridge].sort((a, b) => {
      if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
      if (a.expiry_date) return -1;
      if (b.expiry_date) return 1;
      return (a.raw_name || '').localeCompare(b.raw_name || '');
    });
  }, [fridge]);

  const groupedItems = useMemo(() => {
    const groups = {};
    CATEGORY_ORDER.forEach(cat => { groups[cat] = []; });
    allItems.forEach(item => {
      const cat = categorizeItem(item.raw_name);
      (groups[cat] = groups[cat] || []).push(item);
    });
    return CATEGORY_ORDER.filter(cat => groups[cat]?.length > 0).map(cat => ({ category: cat, items: groups[cat] }));
  }, [allItems]);

  const [selected, setSelected] = useState(new Set());
  const [mode, setMode] = useState('recipe'); // 'recipe' | 'prep'
  const [prepPlan, setPrepPlan] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);

  useEffect(() => {
    if (isAiPickerOpen) {
      setSelected(new Set(allItems.map(i => i.raw_name)));
      setPrepPlan(null);
      setExpandedBatch(null);
    }
  }, [isAiPickerOpen, allItems]);

  const toggleItem = (name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleGenerate = () => {
    const ingredients = allItems.filter(i => selected.has(i.raw_name)).map(i => i.raw_name);
    setIsAiPickerOpen(false);
    handleGenerateAiRecipe(ingredients);
  };

  const handleMealPrep = async () => {
    const ingredients = allItems.filter(i => selected.has(i.raw_name)).map(i => i.raw_name);
    if (ingredients.length === 0) return;

    setPrepPlan(null);
    setExpandedBatch(null);
    setPrepLoading(true);

    try {
      const prompt = `I have these ingredients: ${ingredients.slice(0, 20).join(', ')}. Create a smart weekly meal prep plan by grouping recipes that share these ingredients for efficient batch cooking. Return ONLY valid JSON with no markdown: {"batches":[{"title":"string","recipes":["recipe1","recipe2"],"sharedIngredients":["ingredient1","ingredient2"],"prepTime":"string","tip":"under 30 words"}]} — include 3 batches.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true })
      });
      const text = await res.text();
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      setPrepPlan(Array.isArray(parsed.batches) ? parsed.batches : []);
    } catch {
      setPrepPlan([]);
    } finally {
      setPrepLoading(false);
    }
  };

  if (!isAiPickerOpen) return null;

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-50">
      <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-t-[3rem] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border-t border-white/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tighter">Pick Your Ingredients</h3>
            <p className="text-[10px] text-slate-400 font-medium">Grouped by category · soonest-expiring first</p>
          </div>
          <button onClick={() => setIsAiPickerOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="bg-blue-50/60 rounded-2xl p-1 flex gap-1 mb-3">
          <button
            onClick={() => { setMode('recipe'); setPrepPlan(null); }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${mode === 'recipe' ? 'bg-[#6BAEE0] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Sparkles size={11} /> Recipe
          </button>
          <button
            onClick={() => { setMode('prep'); setPrepPlan(null); }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${mode === 'prep' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <CalendarDays size={11} /> Meal Prep
          </button>
        </div>

        <div className="flex gap-3 mb-3">
          <button onClick={() => setSelected(new Set(allItems.map(i => i.raw_name)))} className="text-[10px] font-bold text-sky-500 hover:text-sky-700 transition-colors">Select All</button>
          <span className="text-slate-200 select-none">|</span>
          <button onClick={() => setSelected(new Set())} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors">Clear</button>
          <span className="ml-auto text-[10px] font-bold text-slate-400">{selected.size} selected</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {allItems.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8">Add items to your pantry first.</p>
          ) : groupedItems.map(({ category, items }) => (
            <div key={category}>
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <span className="text-sm">{CATEGORY_ICONS[category]}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{category}</span>
                <span className="text-[9px] text-slate-300 font-bold">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map(item => {
                  const isSelected = selected.has(item.raw_name);
                  const daysLeft = item.expiry_date
                    ? Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.raw_name)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-left transition-all border ${isSelected ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-100 opacity-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-700 truncate">{item.raw_name}</span>
                        {daysLeft !== null && (
                          <span className={`shrink-0 text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md ${daysLeft <= 0 ? 'bg-red-50 text-red-500' : daysLeft <= 3 ? 'bg-orange-50 text-orange-500' : daysLeft <= 7 ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-400'}`}>
                            {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
                          </span>
                        )}
                      </div>
                      <div className={`shrink-0 w-4 h-4 rounded-full border-2 transition-all ml-3 ${isSelected ? 'bg-[#6BAEE0] border-[#6BAEE0]' : 'border-slate-300 bg-white'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Meal Prep results */}
        {mode === 'prep' && (prepPlan !== null || prepLoading) && (
          <div className="mt-4 border-t border-blue-50 pt-4 space-y-2 max-h-64 overflow-y-auto">
            {prepLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
                <Loader2 size={16} className="animate-spin text-[#6BAEE0]" />
                <span className="text-xs font-bold">Building your prep plan…</span>
              </div>
            ) : prepPlan.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">Could not generate a plan. Please try again.</p>
            ) : prepPlan.map((batch, i) => {
              const isOpen = expandedBatch === i;
              const c = BATCH_COLORS[i % BATCH_COLORS.length];
              return (
                <div key={i} className={`rounded-2xl border ${c.bg} ${c.border} overflow-hidden`}>
                  <button onClick={() => setExpandedBatch(isOpen ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                      <div className="min-w-0">
                        <p className={`text-xs font-black ${c.accent} truncate`}>{batch.title}</p>
                        <p className="text-[9px] text-slate-400">{batch.recipes?.length || 0} recipes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {batch.prepTime && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Clock size={9} /> {batch.prepTime}</span>}
                      {isOpen ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                      {batch.recipes?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {batch.recipes.map((r, j) => (
                            <div key={j} className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5">
                              <span className={`text-[9px] font-black ${c.accent}`}>{j + 1}.</span>
                              <span className="text-xs font-semibold text-slate-700">{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {batch.sharedIngredients?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {batch.sharedIngredients.map((ing, j) => (
                            <span key={j} className="text-[9px] font-bold bg-white/80 border border-blue-100 text-slate-500 px-2 py-0.5 rounded-full">{ing}</span>
                          ))}
                        </div>
                      )}
                      {batch.tip && <p className="text-[10px] text-slate-500 italic">💡 {batch.tip}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-blue-50">
          {mode === 'recipe' ? (
            <button
              onClick={handleGenerate}
              disabled={selected.size === 0 || aiGenerating}
              className="w-full bg-[#6BAEE0] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {aiGenerating
                ? <><Loader2 size={16} className="animate-spin" /> Generating...</>
                : <><Sparkles size={16} /> Generate Recipe ({selected.size} ingredients)</>
              }
            </button>
          ) : (
            <button
              onClick={handleMealPrep}
              disabled={selected.size === 0 || prepLoading}
              className="w-full bg-slate-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {prepLoading
                ? <><Loader2 size={16} className="animate-spin" /> Planning...</>
                : <><CalendarDays size={16} /> Plan Meal Prep ({selected.size} ingredients)</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
