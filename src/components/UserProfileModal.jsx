import React, { useState, useEffect } from 'react';
import { X, ChefHat, Star, Clock, Globe, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useRecipes } from './RecipeContext';

export default function UserProfileModal({ user: profileUser, onClose }) {
  const { setActiveModalRecipe, masterRecipes } = useRecipes();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [cookHistory, setCookHistory] = useState([]);
  const [tab, setTab] = useState('history');

  useEffect(() => {
    if (!profileUser?.id) return;

    // Fetch their public saved recipes from Supabase
    supabase.from('saved_recipes')
      .select('recipe_id, recipe_name, meal_type, cuisine')
      .eq('user_id', profileUser.id)
      .is('household_id', null)
      .limit(30)
      .then(({ data }) => setSavedRecipes(data || []));

    // Fetch public chef history from Supabase
    supabase.from('chef_history')
      .select('recipe_name, meal_type, cuisine, cooked_at')
      .eq('user_id', profileUser.id)
      .order('cooked_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setCookHistory((data || []).map(e => ({
          recipeName: e.recipe_name,
          meal_type: e.meal_type,
          cuisine: e.cuisine,
          cookedAt: e.cooked_at,
        })));
      });
  }, [profileUser?.id]);

  const openRecipe = (entry) => {
    const found = masterRecipes?.find(r => String(r.id) === String(entry.recipeId || entry.recipe_id));
    setActiveModalRecipe(found || {
      id: entry.recipeId || entry.recipe_id,
      name: entry.recipeName || entry.recipe_name,
      meal_type: entry.meal_type || '',
      ingredients: entry.ingredients || [],
      cleanedIngredients: entry.ingredients || [],
      steps: entry.steps || [],
    });
    onClose();
  };

  // Cuisine stats from cook history
  const cuisineCounts = {};
  cookHistory.forEach(e => { if (e.cuisine) cuisineCounts[e.cuisine] = (cuisineCounts[e.cuisine] || 0) + 1; });
  const topCuisines = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const initial = (profileUser?.display_name || '?')[0].toUpperCase();

  return (
    <div className="fixed inset-0 bg-blue-900/30 backdrop-blur-xl flex items-center justify-center p-4 z-[150] overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-white/50 w-full max-w-lg relative max-h-[90vh] flex flex-col">
        {/* Hero header */}
        <div className="bg-gradient-to-br from-[#4d96d1] to-[#6BAEE0] rounded-t-[3rem] px-8 pt-8 pb-6 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/25 border-2 border-white/40 flex items-center justify-center text-white font-black text-2xl">
                {initial}
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{profileUser?.display_name || 'Chef'}</h2>
                <p className="text-white/70 text-xs font-bold mt-0.5">
                  {cookHistory.length} dish{cookHistory.length !== 1 ? 'es' : ''} cooked · {savedRecipes.length} saved
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-white">
              <X size={18} />
            </button>
          </div>

          {/* Cuisine badges */}
          {topCuisines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topCuisines.map(([cuisine, count]) => (
                <span key={cuisine} className="text-[9px] font-black text-white/90 bg-white/20 border border-white/30 px-2.5 py-1 rounded-full">
                  {cuisine} ×{count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex gap-1 p-3 border-b border-blue-50">
          <button
            onClick={() => setTab('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${tab === 'history' ? 'bg-[#6BAEE0] text-white shadow-md' : 'text-slate-400'}`}
          >
            <Clock size={12} /> History
          </button>
          <button
            onClick={() => setTab('saved')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${tab === 'saved' ? 'bg-[#6BAEE0] text-white shadow-md' : 'text-slate-400'}`}
          >
            <Star size={12} /> Favorites
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 pt-4">
          {tab === 'history' && (
            cookHistory.length === 0 ? (
              <div className="text-center py-10">
                <ChefHat size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">No public cooking history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cookHistory.map((entry, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      {entry.photos?.[0] && (
                        <img src={entry.photos[0]} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-blue-50" />
                      )}
                      <div className="flex-1 min-w-0">
                        <button onClick={() => openRecipe(entry)} className="text-sm font-black text-[#6BAEE0] hover:underline text-left block truncate">
                          {entry.recipeName}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(entry.cookedAt).toLocaleDateString()}</p>
                        {entry.notes && <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">"{entry.notes}"</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'saved' && (
            savedRecipes.length === 0 ? (
              <div className="text-center py-10">
                <Star size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-bold">No public saved recipes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedRecipes.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => openRecipe(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl hover:border-sky-200 transition-all text-left"
                  >
                    <Star size={14} className="text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{r.recipe_name}</p>
                      {r.meal_type && <p className="text-[10px] text-slate-400 font-mono">{r.meal_type}{r.cuisine ? ` · ${r.cuisine}` : ''}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
