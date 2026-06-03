import React, { useState, useEffect } from 'react';
import { Users, Copy, Plus, Home, Check, Trash2, DollarSign, Share2, Lock } from 'lucide-react';
import { useUser } from './UserContext';

export default function HouseholdSettings() {
  const {
    households,
    activeHousehold,
    pantryHouseholdId,
    isPantryShared,
    handleSetPantrySpecificHousehold,
    handleClearPantryHousehold,
    handleCreateHousehold: onCreate,
    handleJoinHousehold: onJoin,
    handleSetActiveHousehold: onSetActive,
    handleDeleteHousehold: onDelete,
    handleUpdateBudgetLimit,
  } = useUser();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState({});

  useEffect(() => {
    const inputs = {};
    households.forEach(hh => {
      inputs[hh.id] = hh.budget_limit > 0 ? String(Number(hh.budget_limit).toFixed(2)) : '';
    });
    setBudgetInputs(inputs);
  }, [households]);

  const handleCreate = () => { onCreate(name); setName(''); setShowAddForm(false); };
  const handleJoin = () => { onJoin(code); setCode(''); setShowAddForm(false); };

  return (
    <div className="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── HOUSEHOLD MODE ── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-4">
        <h2 className="text-[14px] font-bold text-slate-400 flex items-center gap-2"><Share2 size={15} /> Household Mode</h2>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          By default, Pantry shares your active household with HomeBase — including the grocery list.
          Switch to a Pantry-specific household to keep them separate.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleClearPantryHousehold}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[12px] font-black transition-all border ${isPantryShared ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-100' : 'bg-white text-slate-500 border-blue-100 hover:bg-sky-50'}`}
          >
            <Share2 size={13} /> Shared with HomeBase
          </button>
          <button
            onClick={() => {
              if (isPantryShared && households.length > 1) {
                // Pick the first household that isn't the active one
                const other = households.find(h => h.id !== activeHousehold?.id);
                if (other) handleSetPantrySpecificHousehold(other.id);
              }
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[12px] font-black transition-all border ${!isPantryShared ? 'bg-[#6BAEE0] text-white border-[#6BAEE0] shadow-md shadow-blue-100' : 'bg-white text-slate-500 border-blue-100 hover:bg-sky-50'}`}
          >
            <Lock size={13} /> Pantry-Specific
          </button>
        </div>
        {!isPantryShared && households.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pantry is using:</p>
            <div className="flex flex-wrap gap-2">
              {households.map(hh => (
                <button
                  key={hh.id}
                  onClick={() => handleSetPantrySpecificHousehold(hh.id)}
                  className={`px-4 py-2 rounded-xl text-[11px] font-black border transition-all ${pantryHouseholdId === hh.id ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-600 border-blue-100 hover:bg-sky-50'}`}
                >
                  {hh.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {isPantryShared && households.length <= 1 && (
          <p className="text-[11px] text-amber-500 font-semibold">
            Add another household below to use a Pantry-specific one.
          </p>
        )}
      </section>

      {/* ── HOUSEHOLDS ── */}
      {(
        <>
          {households.length > 0 && (
            <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-4">
              <h2 className="text-[14px] font-bold text-slate-400 flex items-center gap-2"><Home size={15} /> My Households</h2>
              {households.map(hh => {
                const isActive = hh.id === activeHousehold?.id;
                return (
                  <div key={hh.id} className={`p-5 rounded-2xl border transition-all ${isActive ? 'bg-sky-50 border-sky-200' : 'bg-white border-blue-50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {isActive && <Check size={13} className="text-[#6BAEE0]" />}
                        <span className={`text-sm font-black ${isActive ? 'text-[#1F6FB8]' : 'text-slate-700'}`}>{hh.name}</span>
                        {isActive && <span className="text-[9px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-2 py-0.5 rounded-full uppercase">Active</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <button onClick={() => onSetActive(hh.id)} className="text-[10px] font-black text-[#6BAEE0] bg-sky-50 border border-sky-100 px-3 py-1.5 rounded-xl hover:bg-sky-100 transition-all">Switch</button>
                        )}
                        <button onClick={() => onDelete(hh.id)} className="text-[10px] font-black text-red-400 bg-red-50 border border-red-100 p-1.5 rounded-xl hover:bg-red-100 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">Invite:</span>
                      <span className="text-sm font-mono font-black text-[#6BAEE0] tracking-widest">{hh.invite_code}</span>
                      <button onClick={() => { navigator.clipboard.writeText(hh.invite_code); alert('Code copied!'); }} className="text-slate-400 hover:text-[#6BAEE0] transition-colors">
                        <Copy size={13} />
                      </button>
                    </div>

                    {/* Monthly Budget */}
                    <div className="pt-3 border-t border-blue-50">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><DollarSign size={10} /> Monthly Budget</p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetInputs[hh.id] || ''}
                            onChange={(e) => setBudgetInputs(prev => ({ ...prev, [hh.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-full bg-white border border-blue-100 pl-7 pr-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handleUpdateBudgetLimit(budgetInputs[hh.id] || 0, hh.id)}
                          className="bg-[#6BAEE0] text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-md shadow-blue-100 hover:bg-[#5da0cf] transition-all"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 text-[13px] font-bold text-[#6BAEE0] flex items-center justify-center gap-2 hover:bg-sky-50 transition-all"
            >
              <Plus size={16} /> {households.length === 0 ? 'Create or Join a Household' : 'Add Another Household'}
            </button>
          ) : (
            <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-slate-400">Add Household</h2>
                <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Cancel</button>
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Plus size={11} /> Create New</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="Household name (e.g. My Flat)" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold focus:border-sky-400 focus:outline-none" />
                  <button onClick={handleCreate} className="bg-[#6BAEE0] text-white p-4 rounded-2xl"><Plus size={20} /></button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Users size={11} /> Join Existing</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="Enter invite code" value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold uppercase focus:border-sky-400 focus:outline-none" />
                  <button onClick={handleJoin} className="bg-[#6BAEE0] text-white p-4 rounded-2xl">Join</button>
                </div>
              </div>
            </section>
          )}
        </>
      )}

    </div>
  );
}
