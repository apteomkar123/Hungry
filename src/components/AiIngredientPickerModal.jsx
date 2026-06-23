import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Loader2, CalendarDays, ChevronRight } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { categorizeItem, CATEGORY_ICONS, CATEGORY_ORDER } from './recipeUtils';
import AiLoadingAnimation from './AiLoadingAnimation';

export default function AiIngredientPickerModal() {
  const {
    isAiPickerOpen, setIsAiPickerOpen,
    fridge, handleGenerateAiRecipe, aiGenerating,
    generateMealPlan, prepLoading,
    generatedRecipes, setGeneratedRecipes,
    setActiveModalRecipe,
  } = useRecipes();

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
  const [mode, setMode] = useState('recipe');

  useEffect(() => {
    if (isAiPickerOpen) {
      setSelected(new Set(allItems.map(i => i.raw_name)));
      setGeneratedRecipes(null);
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
    handleGenerateAiRecipe(ingredients);
  };

  const handleMealPrep = () => {
    const ingredients = allItems.filter(i => selected.has(i.raw_name)).map(i => i.raw_name);
    if (ingredients.length === 0) return;
    generateMealPlan(ingredients);
  };

  const handlePickRecipe = (recipe) => {
    setActiveModalRecipe(recipe);
    setGeneratedRecipes(null);
    setIsAiPickerOpen(false);
  };

  if (aiGenerating || prepLoading) {
    return (
      <div className="fixed inset-0 bg-white/90 backdrop-blur-2xl flex items-center justify-center z-50">
        <AiLoadingAnimation />
      </div>
    );
  }

  if (!isAiPickerOpen) return null;

  // Recipe selection screen after generation
  if (generatedRecipes && generatedRecipes.length > 0) {
    return (
      <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-50">
        <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-t-4xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border-t border-white/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tighter">Pick a Recipe</h3>
              <p className="text-[10px] text-slate-400 font-medium">AI generated {generatedRecipes.length} options for you</p>
            </div>
            <button onClick={() => { setGeneratedRecipes(null); setIsAiPickerOpen(false); }} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {generatedRecipes.map((recipe, idx) => (
              <button
                key={recipe.id || idx}
                onClick={() => handlePickRecipe(recipe)}
                className="w-full text-left bg-linear-to-br from-sky-50 to-blue-50 border border-sky-100 rounded-3xl p-4 hover:shadow-md active:scale-95 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Recipe {idx + 1}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-800 tracking-tight leading-tight mb-1.5">{recipe.title || recipe.recipeName}</h4>
                    {recipe.description && (
                      <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{recipe.description}</p>
                    )}
                    {recipe.ingredients && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {recipe.ingredients.slice(0, 4).map((ing, i) => (
                          <span key={i} className="text-[9px] bg-white/80 text-slate-600 font-medium px-1.5 py-0.5 rounded-lg border border-sky-100">
                            {typeof ing === 'string' ? ing : ing.name}
                          </span>
                        ))}
                        {recipe.ingredients.length > 4 && (
                          <span className="text-[9px] text-slate-400 font-medium px-1.5 py-0.5">+{recipe.ingredients.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-sky-400 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-blue-50">
            <button
              onClick={() => setGeneratedRecipes(null)}
              className="w-full py-3 rounded-2xl text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Back to ingredients
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-50">
      <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-t-4xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border-t border-white/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tighter">Pick Your Ingredients</h3>
            <p className="text-[10px] text-slate-400 font-medium">Grouped by category · soonest-expiring first</p>
          </div>
          <button onClick={() => setIsAiPickerOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="bg-blue-50/60 rounded-2xl p-1 flex gap-1 mb-3">
          <button
            onClick={() => setMode('recipe')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${mode === 'recipe' ? 'bg-[#6BAEE0] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Sparkles size={11} /> Recipe
          </button>
          <button
            onClick={() => setMode('prep')}
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

        <div className="mt-4 pt-4 border-t border-blue-50">
          {mode === 'recipe' ? (
            <button
              onClick={handleGenerate}
              disabled={selected.size === 0 || aiGenerating}
              className="w-full bg-[#6BAEE0] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {aiGenerating
                ? <><Loader2 size={16} className="animate-spin" /> Generating...</>
                : <><Sparkles size={16} /> Generate 3 Recipes ({selected.size} ingredients)</>
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
