import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Star, Users, Wand2, Loader2, X, SlidersHorizontal, Heart, Flame } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { useUser } from './UserContext';
import { supabase } from '../supabaseClient';
import SearchWithHistory from './SearchWithHistory';
import AiLoadingAnimation from './AiLoadingAnimation';
import { cleanIngredientLocally } from './recipeUtils';

const MOODS = [
  { key: 'tired',       label: '😴 Tired',        keywords: ['soup', 'pasta', 'oatmeal', 'rice', 'noodle', 'comfort', 'warm', 'broth', 'porridge'] },
  { key: 'postworkout', label: '💪 Post-Workout',  keywords: ['chicken', 'egg', 'salmon', 'lentil', 'bean', 'protein', 'quinoa', 'greek', 'tofu', 'steak'] },
  { key: 'celebratory', label: '🎉 Celebratory',   keywords: ['roast', 'lobster', 'pasta', 'cake', 'tart', 'risotto', 'steak', 'prawn', 'fancy', 'feast'] },
  { key: 'stressed',    label: '🧘 Stressed',       keywords: ['salad', 'smoothie', 'avocado', 'green', 'light', 'fresh', 'detox', 'fruit', 'veggie', 'bowl'] },
  { key: 'adventurous', label: '🌍 Adventurous',   keywords: ['indian', 'thai', 'korean', 'ethiopian', 'moroccan', 'peruvian', 'vietnamese', 'jamaican', 'fusion', 'spicy'] },
  { key: 'late_night',  label: '🌙 Late Night',    keywords: ['snack', 'pizza', 'ramen', 'noodle', 'grilled cheese', 'quesadilla', 'nachos', 'fries', 'wings', 'quick', 'easy', 'toast', 'eggs'] },
];

export default function RecipeExplorer({ initialMood = null }) {
  const [shareMenuId, setShareMenuId] = useState(null);
  const [selectedMood, setSelectedMood] = useState(initialMood);
  const [customIngredients, setCustomIngredients] = useState('');
  const [customGenerating, setCustomGenerating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tasteCuisines, setTasteCuisines] = useState([]); // top cuisines from history

  useEffect(() => {
    if (initialMood && !selectedMood) setSelectedMood(initialMood);
  }, [initialMood]);

  const shareMenuRef = useRef(null);
  const { households, userSettings, user } = useUser();

  // Load chef history to build "Your Taste" profile
  useEffect(() => {
    if (!user) return;
    supabase.from('chef_history')
      .select('cuisine, meal_type, recipe_name')
      .eq('user_id', user.id)
      .order('cooked_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data?.length) return;
        const counts = {};
        data.forEach(r => {
          const c = (r.cuisine || '').toLowerCase().trim();
          if (c && c !== 'general' && c !== 'creative') counts[c] = (counts[c] || 0) + 1;
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([c]) => c);
        setTasteCuisines(sorted);
      });
  }, [user]);

  useEffect(() => {
    if (!shareMenuId) return;
    const handler = (e) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) setShareMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [shareMenuId]);

  const {
    processedRecipes: recipes,
    recipeSearch,
    setRecipeSearch,
    categoryFilters,
    setCategoryFilters,
    dietFilters: activeDietFilters,
    setDietFilters,
    cuisineFilters: activeCuisineFilters,
    setCuisineFilters,
    setActiveModalRecipe: onOpenRecipe,
    onSaveRecipe,
    onRemoveSavedRecipe,
    savedRecipes
  } = useRecipes();

  const generateCustomRecipe = async () => {
    if (!customIngredients.trim() || customGenerating) return;
    setCustomGenerating(true);
    try {
      const restrictions = (userSettings?.dietary_restrictions || []).join(', ');
      const goal = userSettings?.nutrition_goal || '';
      const dietContext = [restrictions, goal].filter(Boolean).join('; ');
      const prompt = `Create a real, delicious, and complete recipe using these ingredients: ${customIngredients}. Use proper culinary measurements (e.g. "2 cups flour", "1 tbsp olive oil", "3 cloves garlic", "2 medium tomatoes", "1/2 cup vodka"). The recipe must be authentic, well-balanced, and actually tasty — not just a list of raw ingredients.${dietContext ? ` Dietary context: ${dietContext}.` : ''} Return ONLY valid JSON with keys: recipeName (string), ingredients (array of properly-measured strings like "2 tbsp butter", "1 cup diced tomatoes", "3 garlic cloves, minced"), steps (array of clear cooking instructions).`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true }),
      });
      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = {};
      try { parsed = JSON.parse(cleaned); } catch {}
      if (!parsed.recipeName && !parsed.name) throw new Error('No recipe name returned');
      const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
      const steps = Array.isArray(parsed.steps) ? parsed.steps : [cleaned];
      onOpenRecipe({
        id: `custom-${Date.now()}`,
        name: parsed.recipeName || parsed.name || 'Custom Recipe',
        meal_type: 'Creative',
        cuisine: '',
        ingredients,
        cleanedIngredients: ingredients.map(cleanIngredientLocally).filter(Boolean),
        steps: steps.length > 0 ? steps : ['Combine and cook the ingredients until ready.'],
      });
      setCustomIngredients('');
    } catch {
      alert('Could not generate recipe. Please try again.');
    }
    setCustomGenerating(false);
  };

  const mealTypeOptions = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
  const dietOptions = ['vegetarian', 'vegan', 'meat', 'fish'];
  const cuisineOptions = ['indian', 'chinese', 'mexican', 'japanese', 'korean', 'jamaican', 'latin', 'african', 'mediterranean'];

  const toggleFilter = (setter) => (f) =>
    setter(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleSearchChange = (value) => {
    const lower = value.toLowerCase().trim();
    if (mealTypeOptions.includes(lower)) {
      setCategoryFilters(prev => prev.includes(lower) ? prev : [...prev, lower]);
    } else if (dietOptions.includes(lower)) {
      setDietFilters(prev => prev.includes(lower) ? prev : [...prev, lower]);
    } else if (cuisineOptions.includes(lower)) {
      setCuisineFilters(prev => prev.includes(lower) ? prev : [...prev, lower]);
    }
    setRecipeSearch(value);
  };

  const savedRecipesMap = useMemo(
    () => new Map((savedRecipes || []).map(sr => [sr.recipe_id, sr.id])),
    [savedRecipes]
  );

  const allActiveFilters = [...categoryFilters, ...activeDietFilters, ...activeCuisineFilters];
  const activeFilterCount = allActiveFilters.length;
  const clearAllFilters = () => { setCategoryFilters([]); setDietFilters([]); setCuisineFilters([]); };

  // Mood boost
  const moodFilteredRecipes = useMemo(() => {
    if (!selectedMood) return recipes;
    const mood = MOODS.find(m => m.key === selectedMood);
    if (!mood) return recipes;
    const score = (r) => {
      const text = `${r.name} ${r.cuisine || ''} ${(r.cleanedIngredients || []).join(' ')}`.toLowerCase();
      return mood.keywords.filter(k => text.includes(k)).length;
    };
    return [...recipes].sort((a, b) => score(b) - score(a));
  }, [recipes, selectedMood]);

  // "Your Taste" section — recipes matching the user's top cuisines (from chef history)
  const yourTasteRecipes = useMemo(() => {
    if (!tasteCuisines.length) return [];
    const scored = moodFilteredRecipes.filter(r => {
      const c = (r.cuisine || '').toLowerCase();
      const name = r.name.toLowerCase();
      return tasteCuisines.some(tc => c.includes(tc) || name.includes(tc));
    });
    // Return up to 8 unique picks, sorted by pantry match
    return scored.slice(0, 8);
  }, [moodFilteredRecipes, tasteCuisines]);

  const RecipeCard = ({ recipe }) => {
    const adaptedLabel = recipe._adapted
      ? `✅ ${recipe._adaptedFor ? (recipe._adaptedFor.charAt(0).toUpperCase() + recipe._adaptedFor.slice(1)) : ''} Adaptation Applied`
      : null;
    const showImg = recipe.image && !adaptedLabel;
    const stableId = String(recipe.id).replace(/^adapted-local-/, '');
    const pkId = savedRecipesMap.get(String(recipe.id)) || savedRecipesMap.get(stableId);
    const isSaved = !!pkId;

    return (
      <div
        className="bg-white/80 backdrop-blur-md border border-white/40 rounded-4xl shadow-lg shadow-blue-900/5 group hover:scale-[1.02] transition-all cursor-pointer overflow-hidden"
        onClick={() => onOpenRecipe(recipe)}
      >
        {showImg ? (
          <div className="w-full h-36 overflow-hidden">
            <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          </div>
        ) : adaptedLabel ? (
          <div className="w-full h-14 bg-emerald-50 border-b border-emerald-100 flex items-center justify-center px-4">
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">{adaptedLabel}</span>
          </div>
        ) : null}
        <div className="p-5">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex gap-1 flex-wrap">
                <span className="text-[8px] font-mono font-black text-slate-400 uppercase bg-blue-50/50 px-2 py-1 rounded-md">{recipe.meal_type}</span>
                {recipe.cuisine && <span className="text-[8px] font-mono font-black text-[#6BAEE0] uppercase bg-sky-50 px-2 py-1 rounded-md">{recipe.cuisine}</span>}
              </div>
              <h3 className="text-sm font-bold text-slate-700 mt-2 line-clamp-2 leading-tight group-hover:text-[#6BAEE0] transition-colors">{recipe.name}</h3>
            </div>
            <div className="bg-sky-50 text-[#6BAEE0] px-3 py-1.5 rounded-full text-[10px] font-black font-mono shadow-sm shrink-0">
              {recipe.matchPercentage}%
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="h-1.5 flex-1 bg-blue-50 rounded-full overflow-hidden mr-4">
              <div className="h-full bg-[#6BAEE0]/60 rounded-full transition-all duration-1000" style={{ width: `${recipe.matchPercentage}%` }} />
            </div>
            <div className="flex items-center gap-2">
              {households?.length > 0 && (
                <div className="relative" ref={shareMenuId === recipe.id ? shareMenuRef : null}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareMenuId(shareMenuId === recipe.id ? null : recipe.id); }}
                    className="flex items-center gap-1 text-[9px] font-black text-slate-400 hover:text-[#6BAEE0] border border-slate-200 hover:border-sky-200 px-2 py-1.5 rounded-xl transition-all"
                  >
                    <Users size={11} /> Share
                  </button>
                  {shareMenuId === recipe.id && (
                    <div className="absolute right-0 bottom-9 bg-white border border-blue-100 rounded-2xl shadow-xl z-30 min-w-40 p-2 space-y-1">
                      {households.map(h => (
                        <button key={h.id}
                          onClick={(e) => { e.stopPropagation(); onSaveRecipe(recipe, h.id); setShareMenuId(null); }}
                          className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-sky-50 hover:text-[#6BAEE0] transition-all flex items-center gap-2"
                        >
                          <Users size={11} /> {h.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (pkId) onRemoveSavedRecipe(pkId);
                  else onSaveRecipe({ ...recipe, id: stableId });
                }}
                className={`transition-colors ${isSaved ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
              >
                <Star size={18} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Search + compact filter header */}
      <div className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-4">
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <SearchWithHistory
              value={recipeSearch}
              onChange={handleSearchChange}
              placeholder="Search recipes, ingredients, or type a filter…"
              namespace="recipes"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className={`relative flex items-center gap-1.5 px-4 py-3 rounded-2xl text-[11px] font-black transition-all shrink-0 ${filtersOpen || activeFilterCount > 0 ? 'bg-[#6BAEE0] text-white shadow-md' : 'bg-white border border-blue-100 text-slate-500 hover:border-sky-300'}`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {allActiveFilters.map(f => (
              <span key={f} className="inline-flex items-center gap-1 bg-[#6BAEE0]/10 text-[#6BAEE0] text-[10px] font-black px-2.5 py-1 rounded-full border border-[#6BAEE0]/20">
                {f}
                <button onClick={() => {
                  if (categoryFilters.includes(f)) setCategoryFilters(p => p.filter(x => x !== f));
                  else if (activeDietFilters.includes(f)) setDietFilters(p => p.filter(x => x !== f));
                  else setCuisineFilters(p => p.filter(x => x !== f));
                }}><X size={10} /></button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-[10px] font-black text-slate-400 hover:text-red-400 transition-colors px-1">Clear all</button>
          </div>
        )}

        {/* Expandable filter panel */}
        {filtersOpen && (
          <div className="space-y-3 pt-2 border-t border-blue-50">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Meal Type</p>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setCategoryFilters([])} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilters.length === 0 ? 'bg-[#6BAEE0] text-white' : 'bg-white text-slate-400 border border-blue-100'}`}>All</button>
                {mealTypeOptions.map(f => (
                  <button key={f} onClick={() => toggleFilter(setCategoryFilters)(f)} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilters.includes(f) ? 'bg-[#6BAEE0] text-white' : 'bg-white text-slate-400 border border-blue-100'}`}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Diet</p>
              <div className="flex gap-1.5 flex-wrap">
                {dietOptions.map(f => (
                  <button key={f} onClick={() => toggleFilter(setDietFilters)(f)} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeDietFilters.includes(f) ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border border-blue-100'}`}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cuisine</p>
              <div className="flex gap-1.5 flex-wrap">
                {cuisineOptions.map(f => (
                  <button key={f} onClick={() => toggleFilter(setCuisineFilters)(f)} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeCuisineFilters.includes(f) ? 'bg-slate-700 text-white' : 'bg-white text-slate-400 border border-blue-100'}`}>{f}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mood Food selector */}
        <div className="pt-2 border-t border-blue-50">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">How are you feeling?</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {MOODS.map(m => (
              <button
                key={m.key}
                onClick={() => setSelectedMood(prev => prev === m.key ? null : m.key)}
                className={`px-4 py-2 rounded-full text-[10px] font-black whitespace-nowrap transition-all ${selectedMood === m.key ? 'bg-[#6BAEE0] text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-500 border border-blue-50 hover:border-sky-200'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Recipe Generator */}
      <div className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 size={16} className="text-violet-500" />
          <h3 className="text-[13px] font-bold text-slate-400">Generate from Any Ingredients</h3>
        </div>
        {customGenerating ? (
          <AiLoadingAnimation label="Creating your recipe…" />
        ) : (
          <>
            <p className="text-[10px] text-slate-400 mb-3">Type any ingredients you have (not just from your pantry) to get a custom AI recipe.</p>
            <div className="relative mb-3">
              <input
                type="text"
                value={customIngredients}
                onChange={e => setCustomIngredients(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateCustomRecipe()}
                placeholder="e.g. chicken, lemon, garlic, pasta…"
                style={{ fontSize: '16px' }}
                className="w-full bg-violet-50/50 border border-violet-100 px-4 py-3 pr-10 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none"
              />
              {customIngredients && (
                <button onClick={() => setCustomIngredients('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={generateCustomRecipe}
              disabled={!customIngredients.trim()}
              className="w-full flex items-center justify-center gap-1.5 bg-violet-500 text-white py-3 rounded-2xl text-xs font-black shadow-md shadow-violet-100 disabled:opacity-50 transition-all active:scale-95"
            >
              <Wand2 size={14} /> Create Recipe
            </button>
          </>
        )}
      </div>

      {/* Your Taste section */}
      {yourTasteRecipes.length > 0 && (
        <div className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={16} className="text-rose-400" fill="currentColor" />
            <h3 className="text-[14px] font-bold text-slate-700">Your Taste</h3>
            <span className="text-[10px] text-slate-400 font-medium">based on what you love to cook</span>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {tasteCuisines.map(c => (
              <span key={c} className="text-[10px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full capitalize">{c}</span>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {yourTasteRecipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
          </div>
        </div>
      )}

      {/* All Recipes Grid */}
      <div className="space-y-3">
        {activeFilterCount > 0 || recipeSearch ? null : (
          <div className="flex items-center gap-2 px-1">
            <Flame size={14} className="text-orange-400" />
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">All Recipes</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {moodFilteredRecipes.length === 0 ? (
            <div className="col-span-full bg-white/80 border border-blue-100 p-8 rounded-4xl text-center text-slate-500">
              {activeFilterCount > 0 || recipeSearch ? 'No recipes found for this filter.' : 'Loading recipes…'}
            </div>
          ) : moodFilteredRecipes.slice(0, 100).map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </div>
    </div>
  );
}
