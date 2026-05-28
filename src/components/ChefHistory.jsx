import React, { useState, useEffect, useRef } from 'react';
import { X, ChefHat, Camera, Star, Trash2, Plus, Edit3, Check, Lock, Globe } from 'lucide-react';
import { useRecipes } from './RecipeContext';

function HistoryCard({ entry, onUpdateNotes, onAddPhoto, onDelete, onOpenRecipe, onTogglePrivacy }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(entry.notes || '');
  const fileRef = useRef(null);

  const saveNotes = () => {
    onUpdateNotes(entry.id, notes);
    setEditingNotes(false);
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onAddPhoto(entry.id, ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cookedDate = new Date(entry.cookedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white/20 shadow-md p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenRecipe(entry)}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-slate-400 uppercase bg-blue-50 px-2 py-0.5 rounded-md tracking-widest">{entry.meal_type || 'Recipe'}</span>
            <span className="text-[9px] text-slate-300 font-mono">{cookedDate}</span>
          </div>
          <h3 className="font-black text-slate-800 tracking-tight text-sm leading-tight hover:text-[#6BAEE0] transition-colors">{entry.recipeName}</h3>
        </div>
        <button onClick={() => onDelete(entry.id)} className="text-slate-200 hover:text-red-400 transition-colors shrink-0 p-1">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Photos */}
      {entry.photos && entry.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {entry.photos.map((photo, i) => (
            <img
              key={i}
              src={photo}
              alt="cooked"
              className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-blue-50"
            />
          ))}
        </div>
      )}

      {/* Notes */}
      {editingNotes ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it turn out? Any tweaks you'd make?"
            rows={3}
            autoFocus
            className="w-full bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs text-slate-800 focus:border-sky-400 focus:outline-none resize-none placeholder:text-slate-300"
          />
          <button onClick={saveNotes} className="flex items-center gap-1.5 bg-[#6BAEE0] text-white px-4 py-2 rounded-xl text-xs font-black">
            <Check size={11} /> Save
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditingNotes(true)}
          className={`w-full text-left text-xs rounded-2xl px-4 py-3 border transition-all ${entry.notes ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-slate-50 border-slate-100 text-slate-400 italic hover:border-sky-200'}`}
        >
          {entry.notes || 'Add your thoughts on this recipe…'}
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 bg-violet-50 text-violet-600 border border-violet-100 rounded-xl hover:bg-violet-100 transition-all"
        >
          <Camera size={12} /> Add Photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
        <button
          onClick={() => onOpenRecipe(entry)}
          className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 bg-sky-50 text-[#6BAEE0] border border-sky-100 rounded-xl hover:bg-sky-100 transition-all"
        >
          <Star size={12} /> View Recipe
        </button>
        <button
          onClick={() => onTogglePrivacy(entry.id)}
          className={`flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl transition-all ${entry.isPrivate ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
        >
          {entry.isPrivate ? <><Lock size={12} /> Private</> : <><Globe size={12} /> Public</>}
        </button>
      </div>
    </div>
  );
}

export default function ChefHistory() {
  const { setActiveModalRecipe, masterRecipes } = useRecipes();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem('hungry_chef_history') || '[]'));
    } catch {
      setHistory([]);
    }
  }, []);

  const persist = (next) => {
    setHistory(next);
    try { localStorage.setItem('hungry_chef_history', JSON.stringify(next)); } catch {}
  };

  const handleUpdateNotes = (id, notes) => {
    persist(history.map(e => e.id === id ? { ...e, notes } : e));
  };

  const handleAddPhoto = (id, dataUrl) => {
    persist(history.map(e => e.id === id ? { ...e, photos: [...(e.photos || []), dataUrl] } : e));
  };

  const handleDelete = (id) => {
    persist(history.filter(e => e.id !== id));
  };

  const handleTogglePrivacy = (id) => {
    persist(history.map(e => e.id === id ? { ...e, isPrivate: !e.isPrivate } : e));
  };

  const handleOpenRecipe = (entry) => {
    // Try to find the original recipe in master list; fall back to the saved snapshot
    const found = masterRecipes.find(r => String(r.id) === String(entry.recipeId));
    setActiveModalRecipe(found || {
      id: entry.recipeId,
      name: entry.recipeName,
      meal_type: entry.meal_type,
      ingredients: entry.ingredients || [],
      cleanedIngredients: entry.ingredients || [],
      steps: entry.steps || []
    });
  };

  if (history.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl text-center space-y-3">
        <ChefHat size={32} className="text-slate-200 mx-auto" />
        <p className="text-sm font-black text-slate-400">No cooked recipes yet</p>
        <p className="text-xs text-slate-300">Mark a recipe as "Cooked" to start your Chef History</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <ChefHat size={18} className="text-[#6BAEE0]" />
        <h2 className="text-[14px] font-bold text-slate-400">Chef History</h2>
        <span className="bg-blue-50 text-[#6BAEE0] border border-blue-100 px-2.5 py-0.5 rounded-full text-[10px] font-black">{history.length}</span>
      </div>
      <div className="space-y-4">
        {history.map(entry => (
          <HistoryCard
            key={entry.id}
            entry={entry}
            onUpdateNotes={handleUpdateNotes}
            onAddPhoto={handleAddPhoto}
            onDelete={handleDelete}
            onOpenRecipe={handleOpenRecipe}
            onTogglePrivacy={handleTogglePrivacy}
          />
        ))}
      </div>
    </div>
  );
}
