import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import {
  cleanIngredientLocally,
  normalizeIngredientTokens,
  fuzzyTokenMatch,
  getStaticRecipeSteps,
  matchesRecipeFilter,
  toTitleCase
} from './recipeUtils';
import { STATIC_RECIPES } from './staticRecipes';

const RecipeContext = createContext();

const MEALDB_CACHE_KEY = 'hungry_mealdb_v1';
const MEALDB_CACHE_TTL = 24 * 60 * 60 * 1000;

export const useRecipes = () => {
  const context = useContext(RecipeContext);
  if (!context) throw new Error('useRecipes must be used within a RecipeProvider');
  return context;
};

export const RecipeProvider = ({ children, fridge }) => {
  const { user, userSettings } = useUser();
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dietFilter, setDietFilter] = useState('all');
  const [cuisineFilter, setCuisineFilter] = useState('all');
  const [savedSearch, setSavedSearch] = useState('');
  const [savedCategoryFilter, setSavedCategoryFilter] = useState('all');
  const [savedDietFilter, setSavedDietFilter] = useState('all');
  const [savedCuisineFilter, setSavedCuisineFilter] = useState('all');

  // Debounced search states to prevent heavy filtering on every keystroke
  const [debouncedRecipeSearch, setDebouncedRecipeSearch] = useState('');
  const [debouncedSavedSearch, setDebouncedSavedSearch] = useState('');

  const [aiGenerating, setAiGenerating] = useState(false);
  const [isAiPickerOpen, setIsAiPickerOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);

  const [activeMealPlan, setActiveMealPlan] = useState(null);
  const [isMealPrepOpen, setIsMealPrepOpen] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [savedMealPlans, setSavedMealPlans] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_meal_plans_v1')) || []; } catch { return []; }
  });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedRecipeSearch(recipeSearch), 300);
    return () => clearTimeout(handler);
  }, [recipeSearch]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSavedSearch(savedSearch), 300);
    return () => clearTimeout(handler);
  }, [savedSearch]);

  const fetchMealDbRecipes = async () => {
    try {
      const cached = localStorage.getItem(MEALDB_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < MEALDB_CACHE_TTL && Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}

    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const results = await Promise.all(letters.map(async (l) => {
      try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${l}`);
        const data = await res.json();
        return data.meals || [];
      } catch { return []; }
    }));

    const meals = results.flat();
    const unique = Array.from(new Map(meals.map(m => [m.idMeal, m])).values());
    const processed = unique.map(m => {
      const ings = [];
      for (let i = 1; i <= 20; i++) {
        if (m[`strIngredient${i}`]) ings.push(`${m[`strMeasure${i}`] || ''} ${m[`strIngredient${i}`]}`.trim());
      }
      return {
        id: m.idMeal,
        name: toTitleCase(m.strMeal || ''),
        meal_type: m.strCategory || 'General',
        cuisine: m.strArea || '',
        ingredients: ings.map(i => toTitleCase(i)),
        steps: String(m.strInstructions || '').split(/\r?\n+/).filter(Boolean)
      };
    });
    try { localStorage.setItem(MEALDB_CACHE_KEY, JSON.stringify({ data: processed, ts: Date.now() })); } catch {}
    return processed;
  };

  const fetchSpoonacularRecipes = async () => {
    try {
      const cacheKey = 'hungry_spoon_v3';
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
      const res = await fetch('/.netlify/functions/get-recipes');
      if (!res.ok) return [];
      const data = await res.json();
      const recipes = data.recipes || [];
      try { sessionStorage.setItem(cacheKey, JSON.stringify(recipes)); } catch {}
      return recipes;
    } catch {
      return [];
    }
  };

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const [mealDb, spoonacular] = await Promise.all([
        fetchMealDbRecipes(),
        fetchSpoonacularRecipes()
      ]);

      const mealDbIds = new Set(mealDb.map(r => String(r.id)));
      const uniqueSpoonacular = spoonacular.filter(r => !mealDbIds.has(String(r.id)));
      const apiIds = new Set([...mealDb, ...uniqueSpoonacular].map(r => String(r.id)));
      const staticProcessed = STATIC_RECIPES
        .filter(r => !apiIds.has(String(r.id)))
        .map(r => ({
          ...r,
          name: toTitleCase(r.name || ''),
          ingredients: (r.ingredients || []).map(i => toTitleCase(i)),
          cleanedIngredients: (r.ingredients || []).map(cleanIngredientLocally).filter(Boolean),
          steps: r.steps || []
        }));
      const combined = [...mealDb, ...uniqueSpoonacular, ...staticProcessed];

      const normalized = combined.map(r => ({
        ...r,
        name: toTitleCase(r.name || ''),
        ingredients: (r.ingredients || []).map(i => toTitleCase(i)),
        cleanedIngredients: (r.ingredients || []).map(cleanIngredientLocally).filter(Boolean),
        steps: getStaticRecipeSteps(r)
      }));

      setMasterRecipes(normalized);

      if (user) {
        const { data } = await supabase.from('saved_recipes').select('*').eq('user_id', user.id);
        setSavedRecipes(data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  // Deep Linking logic: auto-open recipe from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('recipe');
    if (recipeId && masterRecipes.length > 0) {
      const match = masterRecipes.find(r => String(r.id) === recipeId);
      if (match) setActiveModalRecipe(match);
    }
  }, [masterRecipes]);

  const handleGenerateAiRecipe = async (selectedIngredients) => {
    const pantry = (selectedIngredients || [])
      .map(i => cleanIngredientLocally(i))
      .filter(Boolean);
    if (pantry.length === 0) return alert("Add items to your pantry first so AI knows what you have.");

    setAiGenerating(true);
    try {
      const restrictions = (userSettings?.dietary_restrictions || []).join(', ');
      const goal = userSettings?.nutrition_goal || '';
      const dietContext = [restrictions, goal].filter(Boolean).join('; ');
      const prompt = `Create a unique recipe using: ${pantry.slice(0, 10).join(', ')}${dietContext ? `. Dietary context: ${dietContext}` : ''}. Return ONLY valid JSON with keys recipeName, ingredients, and steps.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = {};
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = {};
      }

      const recipeName = parsed.recipeName || parsed.name || parsed.title || '';
      if (!recipeName) {
        const match = cleaned.match(/"recipeName"\s*:\s*"([^"]+)"/i) || cleaned.match(/recipe name\s*[:\-]\s*([^\n"]+)/i);
        if (match) parsed.recipeName = match[1].trim();
      }

      const ingredients = Array.isArray(parsed.ingredients)
        ? parsed.ingredients
        : typeof parsed.ingredients === 'string'
          ? parsed.ingredients.split(/\r?\n|,|;/).map(i => i.trim()).filter(Boolean)
          : [];

      const steps = Array.isArray(parsed.steps)
        ? parsed.steps
        : typeof parsed.steps === 'string'
          ? parsed.steps.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
          : [];

      if (!parsed.recipeName) throw new Error('AI response was missing recipe name. Please try again.');

      setActiveModalRecipe({
        id: `ai-${Date.now()}`,
        name: parsed.recipeName,
        meal_type: 'Creative',
        ingredients,
        cleanedIngredients: ingredients.map(cleanIngredientLocally).filter(Boolean),
        steps: steps.length > 0 ? steps : ['Follow the ingredient list to prepare this dish.']
      });
      setMultiplier(1);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not generate recipe. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

    const processedRecipes = useMemo(() => {
      const pantryTokens = new Set((fridge || []).flatMap(f => normalizeIngredientTokens(f.item_name)));
      const scored = masterRecipes.map(recipe => {
        const cleaned = recipe.cleanedIngredients || [];
        const matchCount = cleaned.filter(ing => normalizeIngredientTokens(ing).some(t => fuzzyTokenMatch(t, pantryTokens))).length;
        const matchPercentage = Math.round((matchCount / (cleaned.length || 1)) * 100);
        return { ...recipe, matchPercentage };
      });

      return scored
        .filter(r => {
          const s = debouncedRecipeSearch.toLowerCase();
          return !s || r.name.toLowerCase().includes(s) || r.cleanedIngredients.some(i => i.includes(s));
        })
        .filter(r => matchesRecipeFilter(r, categoryFilter))
        .filter(r => dietFilter === 'all' || matchesRecipeFilter(r, dietFilter))
        .filter(r => cuisineFilter === 'all' || matchesRecipeFilter(r, cuisineFilter))
        .filter(r => {
          const restrictions = userSettings?.dietary_restrictions || [];
          return restrictions.every(d => matchesRecipeFilter(r, d.toLowerCase()));
        })
        .sort((a, b) => b.matchPercentage - a.matchPercentage);
    }, [fridge, masterRecipes, debouncedRecipeSearch, categoryFilter, dietFilter, cuisineFilter, userSettings]);

  const triggerStoreTripPlanner = useCallback(() => {
    const pantryTokens = (fridge || []).map(f => f.item_name).filter(Boolean);
    const alerts = processedRecipes
      .filter(recipe => recipe.matchPercentage > 10 && recipe.matchPercentage < 100)
      .slice(0, 20)
      .map(recipe => {
        const missingItems = (recipe.ingredients || []).map(cleanIngredientLocally).filter(ing => {
          return !pantryTokens.some(token => token && (ing.includes(token) || token.includes(ing)));
        }).slice(0, 5);
        return { recipe, missingItems, mealType: recipe.meal_type || 'General' };
      })
      .filter(alert => alert.missingItems.length > 0);

    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  }, [fridge, processedRecipes]);

  const onSaveRecipe = async (recipe) => {
    if (!user) return;
    if (savedRecipes.some(r => r.recipe_id === String(recipe.id))) return;
    const { data, error: err } = await supabase.from('saved_recipes').insert([{
      user_id: user.id,
      recipe_id: String(recipe.id),
      recipe_name: recipe.name,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      meal_type: [recipe.meal_type, recipe.cuisine].filter(Boolean).join(' ').trim() || 'General'
    }]).select();
    if (!err && data) setSavedRecipes(prev => [...prev, data[0]]);
  };

  const onRemoveSavedRecipe = async (pkId) => {
    if (!user) return;
    const { error } = await supabase.from('saved_recipes').delete().eq('id', pkId);
    if (!error) {
      setSavedRecipes(prev => prev.filter(r => r.id !== pkId));
    }
  };

  const generateMealPlan = async (ingredients) => {
    const ingredientList = (ingredients || (fridge || []).map(i => i.raw_name)).filter(Boolean).slice(0, 30);
    setActiveMealPlan(null);
    setPrepLoading(true);
    setIsMealPrepOpen(true);
    try {
      const prompt = `I have these pantry/fridge ingredients: ${ingredientList.join(', ') || 'general pantry staples'}. Create a smart weekly meal prep plan that batches cooking efficiently by grouping recipes that share ingredients or cooking methods. Return ONLY valid JSON (no markdown): {"batches":[{"title":"string","recipes":["recipe1","recipe2"],"sharedIngredients":["ingredient1","ingredient2"],"prepTime":"string","tip":"under 30 words"}]} — include 3 batches.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true })
      });
      const text = await res.text();
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      setActiveMealPlan({ batches: Array.isArray(parsed.batches) ? parsed.batches : [], generatedAt: Date.now() });
    } catch {
      setActiveMealPlan({ batches: [], generatedAt: Date.now() });
    } finally {
      setPrepLoading(false);
    }
  };

  const saveMealPlan = (plan) => {
    const newPlan = { ...plan, id: `plan-${Date.now()}`, savedAt: Date.now() };
    setSavedMealPlans(prev => {
      const next = [newPlan, ...prev];
      try { localStorage.setItem('hungry_meal_plans_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const removeMealPlan = (id) => {
    setSavedMealPlans(prev => {
      const next = prev.filter(p => p.id !== id);
      try { localStorage.setItem('hungry_meal_plans_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const filteredSavedRecipes = useMemo(() => {
    if (!savedRecipes) return [];
    return savedRecipes
      .filter(r => {
        const s = debouncedSavedSearch.toLowerCase();
        const name = r.recipe_name || '';
        const ings = r.ingredients || [];
        return !s || name.toLowerCase().includes(s) || ings.some(i => i.toLowerCase().includes(s));
      })
      .filter(r => {
        if (savedCategoryFilter === 'all') return true;
        const normalized = {
          meal_type: r.meal_type,
          name: r.recipe_name,
          cuisine: r.meal_type || '',
          cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : []
        };
        return matchesRecipeFilter(normalized, savedCategoryFilter);
      })
      .filter(r => {
        if (savedDietFilter === 'all') return true;
        const normalized = {
          meal_type: r.meal_type,
          name: r.recipe_name,
          cuisine: r.meal_type || '',
          cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : []
        };
        return matchesRecipeFilter(normalized, savedDietFilter);
      })
      .filter(r => {
        if (savedCuisineFilter === 'all') return true;
        const normalized = {
          meal_type: r.meal_type,
          name: r.recipe_name,
          cuisine: r.meal_type || '',
          cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : []
        };
        return matchesRecipeFilter(normalized, savedCuisineFilter);
      });
  }, [savedRecipes, debouncedSavedSearch, savedCategoryFilter, savedDietFilter, savedCuisineFilter]);

  const findRecipeByName = useCallback((name) => {
    const lower = name.toLowerCase();
    return masterRecipes.find(r => r.name.toLowerCase() === lower)
      || masterRecipes.find(r => r.name.toLowerCase().includes(lower))
      || masterRecipes.find(r => lower.includes(r.name.toLowerCase()));
  }, [masterRecipes]);

  return (
    <RecipeContext.Provider value={{
      masterRecipes,
      processedRecipes,
      findRecipeByName,
      savedRecipes,
      filteredSavedRecipes,
      recipeSearch,
      setRecipeSearch,
      categoryFilter,
      setCategoryFilter,
      dietFilter,
      setDietFilter,
      cuisineFilter,
      setCuisineFilter,
      savedSearch,
      setSavedSearch,
      savedCategoryFilter,
      setSavedCategoryFilter,
      savedDietFilter,
      setSavedDietFilter,
      savedCuisineFilter,
      setSavedCuisineFilter,
      aiGenerating,
      isAiPickerOpen,
      setIsAiPickerOpen,
      handleGenerateAiRecipe,
      onSaveRecipe,
      onRemoveSavedRecipe,
      activeModalRecipe,
      setActiveModalRecipe: (val) => setActiveModalRecipe(val || null),
      multiplier,
      setMultiplier,
      loading,
      error,
      shoppingAlerts,
      isStoreAlertOpen,
      setIsStoreAlertOpen,
      triggerStoreTripPlanner,
      activeMealPlan,
      setActiveMealPlan,
      isMealPrepOpen,
      setIsMealPrepOpen,
      prepLoading,
      generateMealPlan,
      savedMealPlans,
      saveMealPlan,
      removeMealPlan,
      fridge
    }}>
      {children}
    </RecipeContext.Provider>
  );
};