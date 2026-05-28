import React, { useState } from 'react';
import { X, Star, CalendarDays, Clock, ChevronDown, ChevronUp, Loader2, BookmarkCheck, Bookmark } from 'lucide-react';
import { useRecipes } from './RecipeContext';

const BATCH_COLORS = [
  { bg: 'bg-sky-50', border: 'border-sky-100', accent: 'text-[#6BAEE0]', dot: 'bg-[#6BAEE0]', header: 'bg-sky-100' },
  { bg: 'bg-violet-50', border: 'border-violet-100', accent: 'text-violet-500', dot: 'bg-violet-400', header: 'bg-violet-100' },
  { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'text-emerald-600', dot: 'bg-emerald-500', header: 'bg-emerald-100' },
];

export default function MealPrepModal() {
  const {
    isMealPrepOpen,
    setIsMealPrepOpen,
    activeMealPlan,
    prepLoading,
    savedMealPlans,
    saveMealPlan,
    processedRecipes,
    savedRecipes,
    onSaveRecipe,
    onRemoveSavedRecipe,
    setActiveModalRecipe,
  } = useRecipes();

  const [expandedBatch, setExpandedBatch] = useState(null);
  const [planSaved, setPlanSaved] = useState(false);

  if (!isMealPrepOpen) return null;

  const isPlanAlreadySaved = activeMealPlan && savedMealPlans.some(
    p => p.generatedAt === activeMealPlan.generatedAt
  );

  const handleSavePlan = () => {
    if (activeMealPlan && !isPlanAlreadySaved) {
      saveMealPlan(activeMealPlan);
      setPlanSaved(true);
      setTimeout(() => setPlanSaved(false), 2000);
    }
  };

  const handleOpenRecipe = (recipeName) => {
    const match = processedRecipes?.find(r => r.name.toLowerCase() === recipeName.toLowerCase());
    if (match) {
      setActiveModalRecipe(match);
    }
  };

  const handleToggleRecipeStar = (recipeName) => {
    const savedEntry = savedRecipes?.find(sr => sr.recipe_name?.toLowerCase() === recipeName.toLowerCase());
    if (savedEntry) {
      onRemoveSavedRecipe(savedEntry.id);
    } else {
      const match = processedRecipes?.find(r => r.name.toLowerCase() === recipeName.toLowerCase());
      if (match) onSaveRecipe(match);
    }
  };

  return (
    <div className="fixed inset-0 bg-blue-900/30 backdrop-blur-xl z-[55] flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col max-w-2xl mx-auto w-full px-4 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/90 rounded-2xl shadow-sm">
                <CalendarDays className="text-[#6BAEE0]" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Weekly Meal Prep</h2>
                <p className="text-[11px] text-white/60 font-medium">AI-generated prep batches</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeMealPlan && !prepLoading && (
                <button
                  onClick={handleSavePlan}
                  disabled={isPlanAlreadySaved || planSaved}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${isPlanAlreadySaved || planSaved ? 'bg-emerald-400 text-white' : 'bg-white/90 text-[#6BAEE0] hover:bg-white'}`}
                >
                  {isPlanAlreadySaved || planSaved
                    ? <><BookmarkCheck size={13} /> Saved</>
                    : <><Bookmark size={13} /> Save Plan</>
                  }
                </button>
              )}
              <button
                onClick={() => setIsMealPrepOpen(false)}
                className="p-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Loading state */}
          {prepLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
              <div className="p-6 bg-white/90 rounded-3xl shadow-xl">
                <Loader2 size={32} className="animate-spin text-[#6BAEE0] mx-auto mb-3" />
                <p className="text-sm font-black text-slate-700 text-center">Building your prep plan…</p>
                <p className="text-xs text-slate-400 text-center mt-1">Analysing your pantry for batch opportunities</p>
              </div>
            </div>
          )}

          {/* Plan content */}
          {activeMealPlan && !prepLoading && (
            <div className="space-y-4">
              {activeMealPlan.batches?.length === 0 ? (
                <div className="bg-white/90 rounded-3xl p-8 text-center shadow-lg">
                  <p className="text-sm text-slate-500">Could not generate a plan. Close and try again from the Analytics tab.</p>
                </div>
              ) : activeMealPlan.batches?.map((batch, i) => {
                const c = BATCH_COLORS[i % BATCH_COLORS.length];
                const isOpen = expandedBatch === i;
                return (
                  <div key={i} className="bg-white/95 backdrop-blur rounded-3xl overflow-hidden shadow-xl border border-white/50">
                    {/* Batch header */}
                    <button
                      onClick={() => setExpandedBatch(isOpen ? null : i)}
                      className={`w-full flex items-center justify-between px-5 py-4 text-left ${c.header}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${c.dot}`} />
                        <div className="min-w-0">
                          <p className={`text-sm font-black ${c.accent} truncate`}>{batch.title}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{batch.recipes?.length || 0} recipes in batch</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {batch.prepTime && (
                          <span className={`flex items-center gap-1 text-[10px] font-bold ${c.accent} bg-white/60 px-2 py-1 rounded-lg`}>
                            <Clock size={10} /> {batch.prepTime}
                          </span>
                        )}
                        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 py-4 space-y-4">
                        {/* Recipes list */}
                        {batch.recipes?.length > 0 && (
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Recipes</p>
                            <div className="space-y-2">
                              {batch.recipes.map((r, j) => {
                                const savedEntry = savedRecipes?.find(sr => sr.recipe_name?.toLowerCase() === r.toLowerCase());
                                const canOpen = processedRecipes?.some(rr => rr.name.toLowerCase() === r.toLowerCase());
                                return (
                                  <div key={j} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${c.bg} ${c.border}`}>
                                    <span className={`text-[11px] font-black ${c.accent} shrink-0 w-5`}>{j + 1}.</span>
                                    <button
                                      className={`flex-1 text-left text-xs font-bold ${canOpen ? `${c.accent} hover:underline` : 'text-slate-700'}`}
                                      onClick={() => handleOpenRecipe(r)}
                                      disabled={!canOpen}
                                    >
                                      {r}
                                    </button>
                                    <button
                                      onClick={() => handleToggleRecipeStar(r)}
                                      className={`shrink-0 p-1.5 rounded-xl transition-all ${savedEntry ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                                    >
                                      <Star size={14} fill={savedEntry ? 'currentColor' : 'none'} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shared ingredients */}
                        {batch.sharedIngredients?.length > 0 && (
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Shared Ingredients</p>
                            <div className="flex flex-wrap gap-1.5">
                              {batch.sharedIngredients.map((ing, j) => (
                                <span key={j} className="text-[10px] font-bold bg-blue-50 border border-blue-100 text-slate-600 px-2.5 py-1 rounded-full">
                                  {ing}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tip */}
                        {batch.tip && (
                          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex gap-2.5 items-start">
                            <span className="text-base shrink-0">💡</span>
                            <p className="text-[11px] text-slate-600 leading-snug">{batch.tip}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
