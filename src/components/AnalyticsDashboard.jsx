import React, { useState } from 'react';
import { DollarSign, BarChart, ShoppingBag, TrendingDown, PieChart, Target, Sparkles, Loader2, RefreshCw, Star, Plus, Leaf, AlertTriangle, CalendarDays, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';

const MACRO_GOALS = [
  { key: 'protein', label: 'Protein', emoji: '💪', color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
  { key: 'carbs',   label: 'Carbs',   emoji: '🌾', color: 'text-amber-500',  bg: 'bg-amber-50 border-amber-200'  },
  { key: 'fat',     label: 'Fat',     emoji: '🥑', color: 'text-rose-400',   bg: 'bg-rose-50 border-rose-200'    },
  { key: 'all',     label: 'Balance', emoji: '✨', color: 'text-[#6BAEE0]',  bg: 'bg-sky-50 border-sky-200'      },
];

const ECO_RATINGS = [
  { label: 'Green Chef', emoji: '🌿', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', maxRisk: 0 },
  { label: 'Eco Keeper', emoji: '🍃', color: 'text-lime-600 bg-lime-50 border-lime-200',          maxRisk: 2 },
  { label: 'Getting There', emoji: '🌱', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', maxRisk: 4 },
  { label: 'Needs Work',    emoji: '⚠️', color: 'text-orange-500 bg-orange-50 border-orange-200', maxRisk: Infinity },
];

export default function AnalyticsDashboard({ metrics, fridge, shoppingList, onAddShoppingItem }) {
  const { household } = useUser();
  const { onSaveRecipe, processedRecipes, savedRecipes } = useRecipes();

  const [selectedMacro, setSelectedMacro] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState(new Set());
  const [starredRecipes, setStarredRecipes] = useState(new Set());

  const [prepPlan, setPrepPlan] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState(null);

  // ── Spending calcs ───────────────────────────────────────────────────────
  const pantryValue    = fridge.reduce((sum, item) => sum + (item.price || 0), 0);
  const missingSpend   = shoppingList.filter(i => !i.is_completed).reduce((sum, i) => sum + (i.price || 0), 0);
  const purchasedSpend = shoppingList.filter(i => i.is_completed).reduce((sum, i) => sum + (i.price || 0), 0);
  const totalListCost  = missingSpend + purchasedSpend;
  const totalBudget    = pantryValue + missingSpend;
  const stockEfficiency = totalBudget > 0 ? Math.round((pantryValue / totalBudget) * 100) : 0;
  const budgetLimit    = household?.budget_limit || 0;
  const budgetPercent  = budgetLimit > 0 ? Math.min(100, Math.round((totalListCost / budgetLimit) * 100)) : 0;
  const isOverBudget   = totalListCost > budgetLimit && budgetLimit > 0;

  const totalMacros = (metrics.protein + metrics.carbs + metrics.fat) || 1;
  const getPercent  = (val) => Math.round((val / totalMacros) * 100);

  // ── Eco-Score calcs ──────────────────────────────────────────────────────
  const now = new Date();
  const expiringItems = fridge.filter(item => {
    if (!item.expiry_date) return false;
    const diff = (new Date(item.expiry_date) - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });
  const expiredItems = fridge.filter(item => {
    if (!item.expiry_date) return false;
    return new Date(item.expiry_date) < now;
  });
  const atRiskValue = expiringItems.reduce((s, i) => s + (i.price || 0), 0);
  const ecoRating = ECO_RATINGS.find(r => expiringItems.length <= r.maxRisk) || ECO_RATINGS[ECO_RATINGS.length - 1];
  const uniqueStores = [...new Set(fridge.map(item => item.storeName).filter(Boolean))];

  // ── AI Coach ────────────────────────────────────────────────────────────
  const askAiCoach = async (macroKey) => {
    setSelectedMacro(macroKey);
    setAiResult(null);
    setAiLoading(true);
    setAddedIngredients(new Set());
    setStarredRecipes(new Set());

    try {
      const focus = macroKey === 'all'
        ? 'overall nutritional balance'
        : `increasing ${macroKey} intake`;

      const pct = (v) => Math.round((v / totalMacros) * 100);
      const prompt = `User's pantry macro distribution: Protein ${metrics.protein || 0}g (${pct(metrics.protein)}%), Carbs ${metrics.carbs || 0}g (${pct(metrics.carbs)}%), Fat ${metrics.fat || 0}g (${pct(metrics.fat)}%). User wants help with ${focus}. Suggest 3 specific ingredients to add to their shopping list and 2 recipe ideas. Return ONLY valid JSON: {"ingredients":[{"name":"...","amount":"...","reason":"under 25 words"}],"recipes":[{"name":"...","reason":"under 25 words"}]}`;

      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt })
      });

      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setAiResult({
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      });
    } catch {
      setAiResult({ ingredients: [], recipes: [], error: true });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddIngredient = (name) => {
    if (onAddShoppingItem) onAddShoppingItem(name);
    setAddedIngredients(prev => new Set([...prev, name]));
  };

  const handleStarRecipe = (recipeName) => {
    const match = processedRecipes.find(r => r.name.toLowerCase() === recipeName.toLowerCase());
    if (match) onSaveRecipe(match);
    setStarredRecipes(prev => new Set([...prev, recipeName]));
  };

  const generateMealPrepPlan = async () => {
    setPrepPlan(null);
    setPrepLoading(true);
    setExpandedBatch(null);

    try {
      const ingredients = fridge.map(i => i.raw_name).filter(Boolean).slice(0, 30).join(', ');
      const prompt = `I have these pantry/fridge ingredients: ${ingredients || 'general pantry staples'}. Create a smart weekly meal prep plan that batches cooking efficiently by grouping recipes that share ingredients or cooking methods. Return ONLY valid JSON (no markdown): {"batches":[{"title":"string","recipes":["recipe1","recipe2"],"sharedIngredients":["ingredient1","ingredient2"],"prepTime":"string","tip":"under 30 words"}]} — include 3 batches.`;

      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt })
      });

      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setPrepPlan(Array.isArray(parsed.batches) ? parsed.batches : []);
    } catch {
      setPrepPlan([]);
    } finally {
      setPrepLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Nutritional Overview ──────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-6 px-2">
          <BarChart className="text-[#6BAEE0]" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Nutritional Overview</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Protein</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.protein}g</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Carbs</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.carbs}g</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Fat</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.fat}g</p>
          </div>
        </div>

        <div className="mt-8 space-y-5 px-2">
          {[
            { label: 'Protein', val: metrics.protein, color: 'bg-[#6BAEE0]', pctColor: 'text-[#6BAEE0]' },
            { label: 'Carbs',   val: metrics.carbs,   color: 'bg-sky-300',   pctColor: 'text-sky-400' },
            { label: 'Fat',     val: metrics.fat,     color: 'bg-blue-200',  pctColor: 'text-blue-300' },
          ].map(({ label, val, color, pctColor }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>{label} Distribution</span>
                <span className={pctColor}>{getPercent(val)}%</span>
              </div>
              <div className="h-3 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50">
                <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${getPercent(val)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Nutrition Coach ────────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[#6BAEE0]" size={18} />
            <h2 className="text-[14px] font-bold text-slate-400">AI Nutrition Coach</h2>
          </div>
          {aiResult && (
            <button onClick={() => { setAiResult(null); setSelectedMacro(null); }} className="text-slate-300 hover:text-[#6BAEE0] transition-colors">
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {!selectedMacro && !aiLoading && (
          <>
            <p className="text-xs text-slate-400 mb-4 px-1">What would you like to increase in your diet?</p>
            <div className="grid grid-cols-2 gap-2">
              {MACRO_GOALS.map(({ key, label, emoji, bg }) => (
                <button
                  key={key}
                  onClick={() => askAiCoach(key)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] ${bg}`}
                >
                  <span className="text-base">{emoji}</span> {label}
                </button>
              ))}
            </div>
          </>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin text-[#6BAEE0]" />
            <span className="text-xs font-bold">Crafting your plan…</span>
          </div>
        )}

        {aiResult && !aiLoading && (
          <div className="space-y-5">
            {aiResult.error && (
              <p className="text-xs text-slate-400 italic text-center py-4">Could not load recommendations. Tap refresh to try again.</p>
            )}

            {aiResult.ingredients?.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Add to Shopping List</p>
                <div className="space-y-2">
                  {aiResult.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-700">{ing.name} <span className="font-normal text-slate-400">{ing.amount}</span></p>
                        <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{ing.reason}</p>
                      </div>
                      <button
                        onClick={() => handleAddIngredient(ing.name)}
                        disabled={addedIngredients.has(ing.name)}
                        className={`shrink-0 p-2 rounded-xl transition-all ${addedIngredients.has(ing.name) ? 'bg-emerald-100 text-emerald-500' : 'bg-white border border-blue-100 text-[#6BAEE0] hover:bg-sky-50'}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiResult.recipes?.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recipe Suggestions</p>
                <div className="space-y-2">
                  {aiResult.recipes.map((rec, i) => {
                    const isAlreadySaved = savedRecipes?.some(sr => sr.recipe_name?.toLowerCase() === rec.name?.toLowerCase());
                    const isJustStarred = starredRecipes.has(rec.name);
                    return (
                      <div key={i} className="flex items-start justify-between gap-3 bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-700">{rec.name}</p>
                          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{rec.reason}</p>
                        </div>
                        <button
                          onClick={() => handleStarRecipe(rec.name)}
                          disabled={isAlreadySaved || isJustStarred}
                          className={`shrink-0 p-2 rounded-xl transition-all ${(isAlreadySaved || isJustStarred) ? 'text-amber-400' : 'bg-white border border-sky-100 text-slate-300 hover:text-amber-400'}`}
                        >
                          <Star size={14} fill={(isAlreadySaved || isJustStarred) ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Smart Meal Prep Batches ───────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-[#6BAEE0]" size={18} />
            <h2 className="text-[14px] font-bold text-slate-400">Smart Meal Prep</h2>
          </div>
          {prepPlan && (
            <button onClick={() => { setPrepPlan(null); setExpandedBatch(null); }} className="text-slate-300 hover:text-[#6BAEE0] transition-colors">
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {!prepPlan && !prepLoading && (
          <div className="text-center space-y-4">
            <p className="text-xs text-slate-400 px-2">AI analyses your pantry and groups recipes into efficient weekly prep batches — cook less, eat better.</p>
            <button
              onClick={generateMealPrepPlan}
              className="inline-flex items-center gap-2 bg-[#6BAEE0] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-100 hover:bg-[#5da0cf] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={14} /> Generate Weekly Plan
            </button>
          </div>
        )}

        {prepLoading && (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin text-[#6BAEE0]" />
            <span className="text-xs font-bold">Building your prep plan…</span>
          </div>
        )}

        {prepPlan && !prepLoading && (
          <div className="space-y-3">
            {prepPlan.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">Could not generate a plan. Tap refresh to try again.</p>
            ) : prepPlan.map((batch, i) => {
              const isOpen = expandedBatch === i;
              const batchColors = [
                { bg: 'bg-sky-50', border: 'border-sky-100', accent: 'text-[#6BAEE0]', dot: 'bg-[#6BAEE0]' },
                { bg: 'bg-violet-50', border: 'border-violet-100', accent: 'text-violet-500', dot: 'bg-violet-400' },
                { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'text-emerald-600', dot: 'bg-emerald-500' },
              ];
              const c = batchColors[i % batchColors.length];
              return (
                <div key={i} className={`rounded-2xl border ${c.bg} ${c.border} overflow-hidden`}>
                  <button
                    onClick={() => setExpandedBatch(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                      <div className="min-w-0">
                        <p className={`text-xs font-black ${c.accent} truncate`}>{batch.title}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{batch.recipes?.length || 0} recipes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {batch.prepTime && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Clock size={10} /> {batch.prepTime}
                        </span>
                      )}
                      {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-current border-opacity-10" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                      {batch.recipes?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Recipes in This Batch</p>
                          <div className="flex flex-col gap-1.5">
                            {batch.recipes.map((r, j) => (
                              <div key={j} className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2">
                                <span className={`text-[10px] font-black ${c.accent}`}>{j + 1}.</span>
                                <span className="text-xs font-semibold text-slate-700">{r}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {batch.sharedIngredients?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Shared Ingredients</p>
                          <div className="flex flex-wrap gap-1.5">
                            {batch.sharedIngredients.map((ing, j) => (
                              <span key={j} className="text-[10px] font-bold bg-white/80 border border-blue-100 text-slate-600 px-2.5 py-1 rounded-full">{ing}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {batch.tip && (
                        <div className="bg-white/60 rounded-xl px-3 py-2.5 flex gap-2 items-start">
                          <span className="text-sm">💡</span>
                          <p className="text-[11px] text-slate-500 leading-snug">{batch.tip}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Eco-Score & Waste Analytics ───────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-5 px-1">
          <Leaf className="text-emerald-500" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Eco-Score & Waste</h2>
        </div>

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Rating</p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black ${ecoRating.color}`}>
              {ecoRating.emoji} {ecoRating.label}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">At Risk Value</p>
            <p className="text-xl font-black text-orange-400">${atRiskValue.toFixed(2)}</p>
          </div>
        </div>

        {expiringItems.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={10} className="text-orange-400" /> Expiring Within 7 Days</p>
            {expiringItems.map((item, i) => {
              const daysLeft = Math.ceil((new Date(item.expiry_date) - now) / (1000 * 60 * 60 * 24));
              return (
                <div key={i} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-2.5">
                  <span className="text-xs font-bold text-slate-700">{item.raw_name}</span>
                  <div className="flex items-center gap-2">
                    {item.price > 0 && <span className="text-[10px] text-emerald-500 font-bold">${Number(item.price).toFixed(2)}</span>}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${daysLeft <= 1 ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}`}>
                      {daysLeft === 0 ? 'Today!' : `${daysLeft}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
            <p className="text-xs font-bold text-emerald-600">Nothing expiring soon — great job!</p>
          </div>
        )}

        {expiredItems.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-red-500">{expiredItems.length} item{expiredItems.length !== 1 ? 's' : ''} already expired</span>
            <span className="text-xs font-black text-red-400">${expiredItems.reduce((s,i) => s+(i.price||0),0).toFixed(2)} lost</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100">
            <p className="text-base font-black text-[#6BAEE0]">{fridge.length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Items</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-3 border border-orange-100">
            <p className="text-base font-black text-orange-400">{expiringItems.length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Expiring Soon</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
            <p className="text-base font-black text-emerald-500">{fridge.length - expiringItems.length - expiredItems.length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Freshness OK</p>
          </div>
        </div>
      </section>

      {/* ── Spending Breakdown ────────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-6 px-2">
          <PieChart className="text-[#6BAEE0]" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Spending Breakdown</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-emerald-500 shadow-sm"><TrendingDown size={16} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Inventory Value</p>
                  <p className="text-lg font-bold text-slate-700">${pantryValue.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">In Stock</p>
            </div>
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-amber-500 shadow-sm"><ShoppingBag size={16} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Projected Spend</p>
                  <p className="text-lg font-bold text-slate-700">${missingSpend.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">Missing</p>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-sky-50/30 p-6 rounded-[2rem] border border-sky-100/50 text-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-sky-100 opacity-20"><DollarSign size={80} /></div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Stock Efficiency</p>
            <p className="text-4xl font-black text-[#6BAEE0]">{stockEfficiency}%</p>
            <p className="text-[11px] text-slate-500 mt-2 px-4 leading-tight">Percentage of your total grocery budget sitting in your pantry.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center mt-6">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <DollarSign size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Total List Cost</p>
            <p className={`text-xl font-bold ${isOverBudget ? 'text-red-400' : 'text-[#6BAEE0]'}`}>${totalListCost.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <ShoppingBag size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Stores Shopped</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{uniqueStores.length}</p>
          </div>
        </div>

        {budgetLimit > 0 && (
          <div className="mt-8 px-2 space-y-3">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-2">
                <Target size={14} className={isOverBudget ? 'text-red-400' : 'text-slate-400'} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Budget Progress</span>
              </div>
              <span className={`text-[10px] font-black ${isOverBudget ? 'text-red-400' : 'text-[#6BAEE0]'}`}>
                ${totalListCost.toFixed(2)} / ${budgetLimit.toFixed(2)}
              </span>
            </div>
            <div className="h-4 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50">
              <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${isOverBudget ? 'bg-red-400' : 'bg-[#6BAEE0]'}`} style={{ width: `${budgetPercent}%` }} />
            </div>
            {isOverBudget && <p className="text-[9px] font-bold text-red-400 text-center animate-pulse italic">Warning: You have exceeded your budget limit!</p>}
          </div>
        )}

        {uniqueStores.length > 0 && (
          <p className="mt-4 text-center text-xs text-slate-400">Tracked stores: {uniqueStores.join(', ')}</p>
        )}
      </section>
    </div>
  );
}
