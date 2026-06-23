import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Loader2, RefreshCw, Activity, ChefHat, CheckSquare, ShoppingCart, Music, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

// ── helpers ──────────────────────────────────────────────────────────────────

const APP_ICON = { pantry: '🥦', homebase: '🏠', vinyl: '🎵' };

function formatEventText(event, profileMap) {
  const name = profileMap[event.user_id] || 'Someone';
  const p = event.payload || {};
  switch (event.activity_type) {
    case 'cooking_started':      return `${name} started cooking ${p.recipe_name || 'a recipe'} 🍳`;
    case 'chore_completed':      return `${name} completed "${p.chore || 'a chore'}" ✅`;
    case 'all_chores_done':      return `${name} — all household chores done! 🎉`;
    case 'all_bills_paid':       return `${name} marked all bills paid 💸`;
    case 'shopping_item_added':  return `${name} added "${p.item || 'an item'}" to the shopping list 🛒`;
    case 'record_added':         return `${name} added "${p.album || 'an album'}" to Vinyl 🎶`;
    case 'mention_notification': return `${name} mentioned @${p.mentioned_name || 'someone'} in a note`;
    case 'soundtrack_of_week':   return `🎵 This week's top track: "${p.track_title || '?'}" by ${p.artist || '?'}`;
    case 'recipe_scheduled':     return `${name} scheduled "${p.recipe_name || 'a recipe'}" for ${p.date || 'tonight'} 🍽️`;
    case 'potluck_created':      return `${name} created a potluck / event 🥘`;
    case 'concert_fund_suggested': return `${name} suggested a concert fund 🎫`;
    default:                     return null;
  }
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── main component ────────────────────────────────────────────────────────────

export default function LyfeWareTab({ fridge }) {
  const { user, household } = useUser();
  const [tab, setTab] = useState('feed'); // 'feed' | 'wrap'
  const [feedEvents, setFeedEvents] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [feedLoading, setFeedLoading] = useState(false);
  const [wrapData, setWrapData] = useState(null);
  const [wrapLoading, setWrapLoading] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!user?.id || !household?.id) return;
    setFeedLoading(true);
    try {
      // Get household members so we can pull their activity
      const { data: members } = await supabase
        .from('household_members')
        .select('profile_id')
        .eq('household_id', household.id);

      const memberIds = (members || []).map(m => m.profile_id);
      if (!memberIds.includes(user.id)) memberIds.push(user.id);

      const { data: events } = await supabase
        .from('cross_app_activity')
        .select('id, user_id, app, activity_type, payload, created_at')
        .in('user_id', memberIds)
        .not('activity_type', 'in', '("mood_signal","late_night_active","nutrition_shortfall","audio_features_update")')
        .order('created_at', { ascending: false })
        .limit(40);

      const evts = (events || []);

      // Fetch display names for all user IDs
      const uniqueIds = [...new Set(evts.map(e => e.user_id))];
      if (uniqueIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', uniqueIds);
        const map = {};
        (profiles || []).forEach(p => { map[p.id] = p.display_name || p.username || 'A member'; });
        setProfileMap(map);
      }

      // Filter to events with displayable text
      setFeedEvents(evts);
    } catch {}
    setFeedLoading(false);
  }, [user?.id, household?.id]);

  const loadWrap = useCallback(async () => {
    if (!user?.id) return;
    setWrapLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    try {
      const { data: events } = await supabase
        .from('cross_app_activity')
        .select('app, activity_type, payload, created_at')
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());

      const { data: chefRows } = await supabase
        .from('chef_history')
        .select('cuisine, cooked_at')
        .eq('user_id', user.id)
        .gte('cooked_at', monthStart.toISOString());

      const evts = events || [];
      const thisMonth = chefRows || [];
      const choresDone = evts.filter(e => e.activity_type === 'chore_completed').length;
      const billsPaid  = evts.some(e => e.activity_type === 'all_bills_paid');
      const topCuisine = (() => {
        const counts = {};
        thisMonth.forEach(e => { if (e.cuisine) counts[e.cuisine] = (counts[e.cuisine] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      })();
      const { data: np } = await supabase
        .from('now_playing').select('track_title, artist').eq('user_id', user.id).maybeSingle();

      setWrapData({
        recipesCookedThisMonth: thisMonth.length,
        choresDoneThisMonth: choresDone,
        billsPaidThisMonth: billsPaid,
        topCuisineThisMonth: topCuisine,
        currentlyPlaying: np ? `${np.track_title} — ${np.artist}` : null,
        pantryWorth: (fridge || []).reduce((s, i) => s + (i.price || 0), 0),
      });
    } catch {}
    setWrapLoading(false);
  }, [user?.id, fridge]);

  useEffect(() => {
    if (tab === 'feed') loadFeed();
    else loadWrap();
  }, [tab, loadFeed, loadWrap]);

  // Realtime: refresh feed when cross_app_activity changes in the household
  useEffect(() => {
    if (!household?.id) return;
    const ch = supabase.channel('lyfeware-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cross_app_activity' }, () => {
        if (tab === 'feed') loadFeed();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [household?.id, tab, loadFeed]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Tab bar */}
      <div className="flex gap-2 bg-blue-50 rounded-2xl p-1">
        <button
          onClick={() => setTab('feed')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'feed' ? 'bg-white text-[#6BAEE0] shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <Activity size={13} /> Live Feed
        </button>
        <button
          onClick={() => setTab('wrap')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${tab === 'wrap' ? 'bg-white text-violet-500 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <Globe size={13} /> Monthly Wrap
        </button>
      </div>

      {tab === 'feed' ? (
        <FeedTab events={feedEvents} profileMap={profileMap} loading={feedLoading} onRefresh={loadFeed} />
      ) : (
        <WrapTab data={wrapData} loading={wrapLoading} onRefresh={loadWrap} />
      )}
    </div>
  );
}

// ── Feed Tab ──────────────────────────────────────────────────────────────────

function FeedTab({ events, profileMap, loading, onRefresh }) {
  const visible = events.filter(e => formatEventText(e, profileMap) !== null);
  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 p-5 rounded-[2.5rem] shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-[#6BAEE0] flex items-center gap-2">
          <Activity size={15} /> LyfeWare Feed
        </h3>
        <button onClick={onRefresh} disabled={loading} className="p-2 text-sky-400 hover:text-sky-600 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mb-4">What's happening across your household</p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-sky-400" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-slate-400 font-bold">No recent activity yet.</p>
          <p className="text-[10px] text-slate-300 mt-1">Cook a recipe, add a shopping item, or complete a chore to see it here!</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {visible.map(event => {
            const text = formatEventText(event, profileMap);
            if (!text) return null;
            return (
              <div key={event.id} className="flex items-start gap-3 bg-white/80 rounded-2xl px-3.5 py-3 border border-sky-50">
                <span className="text-base shrink-0 mt-0.5">{APP_ICON[event.app] || '🌐'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 leading-snug">{text}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(event.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Wrap Tab ──────────────────────────────────────────────────────────────────

function WrapTab({ data, loading, onRefresh }) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-sky-50 border border-violet-100 p-6 rounded-[2.5rem] shadow-xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[14px] font-bold text-violet-500 flex items-center gap-2">
          <Globe size={15} /> LyfeWare Monthly Wrap
        </h3>
        <button onClick={onRefresh} disabled={loading} className="p-2 text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mb-5">Your life across all three apps this month</p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-violet-400" />
        </div>
      ) : !data ? (
        <button onClick={onRefresh} className="w-full py-3 rounded-2xl bg-violet-100 text-violet-600 text-xs font-black hover:bg-violet-200 transition-all">
          Load My Wrap
        </button>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={data.recipesCookedThisMonth} label="🍽️ Recipes Cooked" color="text-[#6BAEE0]" />
            <StatCard value={data.choresDoneThisMonth} label="✅ Chores Done" color="text-emerald-500" />
            <StatCard value={`$${data.pantryWorth.toFixed(0)}`} label="🥦 Pantry Value" color="text-amber-500" />
            <StatCard value={data.billsPaidThisMonth ? '✓ Paid' : 'Pending'} label="💸 Bills" color="text-violet-500" />
          </div>
          {data.topCuisineThisMonth && (
            <div className="bg-white/80 rounded-2xl px-4 py-3 border border-violet-100 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500">Top Cuisine This Month</p>
              <p className="text-sm font-black text-violet-500">{data.topCuisineThisMonth}</p>
            </div>
          )}
          {data.currentlyPlaying && (
            <div className="bg-white/80 rounded-2xl px-4 py-3 border border-violet-100 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-500 shrink-0">🎵 Now on Vinyl</p>
              <p className="text-xs font-black text-violet-500 truncate">{data.currentlyPlaying}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div className="bg-white/80 rounded-2xl p-4 text-center border border-violet-100">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}
