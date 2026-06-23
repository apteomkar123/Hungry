import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Clock, Check, Pencil, ShoppingCart, Sparkles, Loader2, ChefHat, TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

const getDaysUntilExpiry = (date) => {
  if (!date) return null;
  return (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
};

const formatExpiry = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationPanel({ fridge, quantities, onRemoveItem, onAdjustQuantity, onUpdateItem, onAddShoppingItem, onClose }) {
  const { user, household } = useUser();
  const [activeTab, setActiveTab] = useState('expiry'); // 'expiry' | 'digest'
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachRecipe, setCoachRecipe] = useState(null);
  const [addedToList, setAddedToList] = useState(new Set());
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);

  const notifications = useMemo(() => {
    const expired = [];
    const expiringSoon = [];
    (fridge || []).forEach(item => {
      const days = getDaysUntilExpiry(item.expiry_date);
      if (days === null) return;
      if (days <= 0) expired.push({ ...item, days });
      else if (days <= 7) expiringSoon.push({ ...item, days });
    });
    expired.sort((a, b) => a.days - b.days);
    expiringSoon.sort((a, b) => a.days - b.days);
    return { expired, expiringSoon };
  }, [fridge]);

  const urgentItems = useMemo(() =>
    [...notifications.expired, ...notifications.expiringSoon].filter(i => i.days <= 2),
    [notifications]
  );

  const total = notifications.expired.length + notifications.expiringSoon.length;
  const notifBadge = total + (digest?.mentions || 0);

  const loadDigest = useCallback(async () => {
    if (!user?.id || !household?.id) return;
    setDigestLoading(true);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    try {
      // Shopping spend this week
      const { data: shopItems } = await supabase
        .from('shopping_list')
        .select('price, is_completed')
        .eq('household_id', household.id)
        .gte('created_at', weekStart.toISOString());

      const groceriesSpent = (shopItems || [])
        .filter(i => i.is_completed)
        .reduce((s, i) => s + (parseFloat(i.price) || 0), 0);

      // Chores done this week
      const { data: choreEvents } = await supabase
        .from('cross_app_activity')
        .select('id')
        .eq('activity_type', 'chore_completed')
        .gte('created_at', weekStart.toISOString());

      // Mentions this week (for the user)
      const { data: mentions } = await supabase
        .from('cross_app_activity')
        .select('id')
        .eq('activity_type', 'mention_notification')
        .contains('payload', { mentioned_id: user.id })
        .gte('created_at', weekStart.toISOString());

      // Upcoming expiries
      const upcomingExpiry = notifications.expiringSoon.length + notifications.expired.length;

      setDigest({
        groceriesSpent,
        choresDone: choreEvents?.length ?? 0,
        upcomingExpiry,
        mentions: mentions?.length ?? 0,
        weekStart: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    } catch {}
    setDigestLoading(false);
  }, [user?.id, household?.id, notifications]);

  useEffect(() => {
    if (activeTab === 'digest' && !digest) loadDigest();
  }, [activeTab, digest, loadDigest]);

  const handleMarkUsed = (item) => {
    const qty = quantities?.[item.id] || item.quantity || 1;
    if (qty <= 1) onRemoveItem(item.id);
    else onAdjustQuantity(item.id, -1);
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditDate(item.expiry_date ? item.expiry_date.split('T')[0] : '');
  };

  const handleSaveDate = (item) => {
    if (onUpdateItem && editDate) onUpdateItem(item.id, { expiry_date: editDate });
    setEditingId(null);
  };

  const handleAddToList = (item) => {
    if (onAddShoppingItem) {
      onAddShoppingItem(item.raw_name || item.item_name);
      setAddedToList(prev => new Set([...prev, item.id]));
    }
  };

  const handleGenerateExpiryRecipe = async () => {
    if (urgentItems.length < 1 || coachLoading) return;
    setCoachLoading(true);
    setCoachRecipe(null);
    try {
      const ingredientList = urgentItems.slice(0, 6).map(i => i.raw_name || i.item_name).join(', ');
      const prompt = `I have these ingredients expiring very soon: ${ingredientList}. Generate a creative recipe that uses as many of them as possible. Return ONLY valid JSON: {"recipeName":"...","ingredients":["..."],"steps":["..."]}`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true }),
      });
      const text = await res.text();
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      setCoachRecipe(parsed);
    } catch {
      setCoachRecipe({ recipeName: 'Could not generate recipe', ingredients: [], steps: [] });
    }
    setCoachLoading(false);
  };

  const renderItem = (item, isExpired) => {
    const qty = quantities?.[item.id] || item.quantity || 1;
    const isEditing = editingId === item.id;
    const wasAdded = addedToList.has(item.id);
    return (
      <div key={item.id} className="py-2.5 border-b border-blue-50 last:border-0">
        <div className="flex items-center gap-3">
          <div className={`shrink-0 ${isExpired ? 'text-red-400' : 'text-orange-400'}`}>
            {isExpired ? <AlertCircle size={16} /> : <Clock size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-700 truncate">{item.raw_name || item.item_name}</p>
            {isEditing ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="text-[10px] border border-blue-200 rounded-lg px-2 py-1 bg-blue-50 text-slate-700 focus:outline-none focus:border-sky-400"
                />
                <button onClick={() => handleSaveDate(item)} className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded-lg font-bold">Save</button>
                <button onClick={() => setEditingId(null)} className="text-[10px] text-slate-400 hover:text-slate-600 px-1">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className={`text-[10px] font-semibold ${isExpired ? 'text-red-400' : 'text-orange-400'}`}>
                  {isExpired
                    ? `Expired ${Math.abs(Math.round(item.days))} day${Math.abs(Math.round(item.days)) !== 1 ? 's' : ''} ago`
                    : `Expires ${formatExpiry(item.expiry_date)} · ${Math.ceil(item.days)} day${Math.ceil(item.days) !== 1 ? 's' : ''} left`}
                </p>
                <button onClick={() => handleStartEdit(item)} className="text-slate-300 hover:text-slate-500 transition-colors ml-0.5" title="Edit expiry date">
                  <Pencil size={10} />
                </button>
              </div>
            )}
            {qty > 1 && <p className="text-[10px] text-slate-400 font-semibold">Qty: {qty}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleMarkUsed(item)}
              title={qty <= 1 ? 'Remove from pantry' : 'Mark 1 as used'}
              className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1.5 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              <Check size={10} /> {qty <= 1 ? 'Used' : 'Use 1'}
            </button>
            <button
              onClick={() => handleAddToList(item)}
              disabled={wasAdded}
              title="Add to shopping list"
              className={`flex items-center gap-1 text-[10px] font-black px-2 py-1.5 rounded-xl border transition-colors ${wasAdded ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-sky-50 text-[#6BAEE0] border-sky-100 hover:bg-sky-100'}`}
            >
              <ShoppingCart size={10} /> {wasAdded ? '✓' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute right-0 top-full mt-3 bg-white border border-blue-100 rounded-[2rem] shadow-2xl shadow-blue-900/10 w-80 max-h-[80vh] overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-blue-50">
        <span className="text-sm font-black text-slate-700">Notifications</span>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-2.5 pb-1">
        <button
          onClick={() => setActiveTab('expiry')}
          className={`flex-1 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 ${activeTab === 'expiry' ? 'bg-sky-100 text-[#6BAEE0]' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <AlertCircle size={10} /> Expiry {total > 0 && <span className="bg-red-400 text-white text-[8px] px-1 py-0.5 rounded-full leading-none">{total}</span>}
        </button>
        <button
          onClick={() => setActiveTab('digest')}
          className={`flex-1 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 ${activeTab === 'digest' ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <TrendingUp size={10} /> Weekly Digest
        </button>
      </div>

      {/* Expiry tab */}
      {activeTab === 'expiry' && (
        total === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-xs font-bold text-slate-400">All good! No expiring items.</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-5 py-2">
            {urgentItems.length >= 3 && (
              <div className="mb-3 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">⚡ Expiry Coach</p>
                <p className="text-[11px] text-slate-600 mb-2">
                  {urgentItems.length} ingredients expiring soon — let AI suggest a recipe that uses them all!
                </p>
                {coachRecipe ? (
                  <div>
                    <p className="text-xs font-black text-slate-700 mb-1">{coachRecipe.recipeName}</p>
                    {coachRecipe.ingredients?.slice(0, 3).map((ing, i) => (
                      <p key={i} className="text-[10px] text-slate-500">• {ing}</p>
                    ))}
                    {coachRecipe.ingredients?.length > 3 && <p className="text-[10px] text-slate-400">+{coachRecipe.ingredients.length - 3} more ingredients</p>}
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateExpiryRecipe}
                    disabled={coachLoading}
                    className="flex items-center gap-1.5 bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60"
                  >
                    {coachLoading ? <Loader2 size={10} className="animate-spin" /> : <ChefHat size={10} />}
                    {coachLoading ? 'Generating…' : 'Generate Recipe'}
                  </button>
                )}
              </div>
            )}
            {notifications.expired.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 pt-2">Expired</p>
                {notifications.expired.map(item => renderItem(item, true))}
              </div>
            )}
            {notifications.expiringSoon.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1 pt-2">Expiring Soon</p>
                {notifications.expiringSoon.map(item => renderItem(item, false))}
              </div>
            )}
          </div>
        )
      )}

      {/* Weekly Digest tab */}
      {activeTab === 'digest' && (
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {digestLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-violet-400" />
            </div>
          ) : !digest ? (
            <button onClick={loadDigest} className="w-full py-3 rounded-2xl bg-violet-100 text-violet-600 text-xs font-black hover:bg-violet-200 transition-all">Load Weekly Digest</button>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">This week · since {digest.weekStart}</p>
              <DigestCard emoji="🛒" label="Groceries Spent" value={`$${digest.groceriesSpent.toFixed(2)}`} color="text-emerald-500" />
              <DigestCard emoji="✅" label="Chores Done" value={String(digest.choresDone)} color="text-blue-500" />
              <DigestCard emoji="⏰" label="Items Expiring" value={String(digest.upcomingExpiry)} color="text-orange-500" note={digest.upcomingExpiry > 0 ? 'Check the Expiry tab!' : undefined} />
              {digest.mentions > 0 && (
                <DigestCard emoji="💬" label="New Mentions" value={String(digest.mentions)} color="text-violet-500" note="Someone @mentioned you in a note" />
              )}
              <button
                onClick={loadDigest}
                className="w-full mt-2 py-2 rounded-2xl bg-violet-50 text-violet-500 text-[10px] font-black hover:bg-violet-100 transition-all"
              >
                Refresh Digest
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DigestCard({ emoji, label, value, color, note }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
      <span className="text-xl shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        {note && <p className="text-[9px] text-slate-400">{note}</p>}
      </div>
      <p className={`text-lg font-black shrink-0 ${color}`}>{value}</p>
    </div>
  );
}
