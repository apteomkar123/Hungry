import React, { useState, useEffect } from 'react';
import { Users, Copy, Plus, Home, Check, Trash2, Settings, DollarSign } from 'lucide-react';
import { useUser } from './UserContext';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Dairy-Free', 'Nut-Free', 'Low-Carb', 'High-Protein'];
const NUTRITION_GOALS = ['Balanced', 'High Protein', 'Low Carb', 'Low Fat', 'Build Muscle', 'Lose Weight'];

export default function HouseholdSettings() {
  const {
    households,
    activeHousehold,
    userName: profileName,
    userSettings,
    handleUpdateProfileName: onUpdateName,
    handleUpdateSettings,
    handleCreateHousehold: onCreate,
    handleJoinHousehold: onJoin,
    handleSetActiveHousehold: onSetActive,
    handleDeleteHousehold: onDelete,
    handleUpdateBudgetLimit,
  } = useUser();

  const [activeTab, setActiveTab] = useState('households');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState(profileName || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState({});

  // Settings state
  const [dietary, setDietary] = useState(userSettings?.dietary_restrictions || []);
  const [goal, setGoal] = useState(userSettings?.nutrition_goal || 'Balanced');
  const [age, setAge] = useState(String(userSettings?.age || ''));
  const [weight, setWeight] = useState(String(userSettings?.weight || ''));
  const [height, setHeight] = useState(String(userSettings?.height || ''));
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => { setDisplayName(profileName || ''); }, [profileName]);
  useEffect(() => {
    if (userSettings) {
      setDietary(userSettings.dietary_restrictions || []);
      setGoal(userSettings.nutrition_goal || 'Balanced');
      setAge(String(userSettings.age || ''));
      setWeight(String(userSettings.weight || ''));
      setHeight(String(userSettings.height || ''));
    }
  }, [userSettings]);

  useEffect(() => {
    const inputs = {};
    households.forEach(hh => {
      inputs[hh.id] = hh.budget_limit > 0 ? String(Number(hh.budget_limit).toFixed(2)) : '';
    });
    setBudgetInputs(inputs);
  }, [households]);

  const handleCreate = () => { onCreate(name); setName(''); setShowAddForm(false); };
  const handleJoin = () => { onJoin(code); setCode(''); setShowAddForm(false); };

  const toggleDietary = (opt) => {
    setDietary(prev => prev.includes(opt) ? prev.filter(d => d !== opt) : [...prev, opt]);
  };

  const saveSettings = async () => {
    await handleUpdateSettings({
      name: displayName,
      dietary_restrictions: dietary,
      nutrition_goal: goal,
      age: age ? Number(age) : '',
      weight: weight ? Number(weight) : '',
      height: height ? Number(height) : '',
    });
    onUpdateName(displayName);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Tab switcher */}
      <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white/20 shadow-xl shadow-blue-900/5 p-1.5 flex gap-1">
        <button
          onClick={() => setActiveTab('households')}
          className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${activeTab === 'households' ? 'bg-[#6BAEE0] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Home size={13} /> Households
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${activeTab === 'settings' ? 'bg-[#6BAEE0] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Settings size={13} /> Settings
        </button>
      </div>

      {/* ── HOUSEHOLDS TAB ── */}
      {activeTab === 'households' && (
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
                          onClick={() => handleUpdateBudgetLimit(budgetInputs[hh.id] || 0)}
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

      {/* ── SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-6">
          {/* Name */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
            />
          </div>

          {/* Body stats */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Body Stats</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { label: 'Age', value: age, set: setAge, placeholder: 'yrs', unit: 'yrs' },
                { label: 'Weight', value: weight, set: setWeight, placeholder: 'kg', unit: 'kg' },
                { label: 'Height', value: height, set: setHeight, placeholder: 'cm', unit: 'cm' },
              ].map(({ label, value, set, unit }) => (
                <div key={label} className="relative">
                  <input
                    type="number" min="0" value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="—"
                    className="w-full bg-blue-50/50 border border-blue-100 px-3 pt-5 pb-2 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
                  />
                  <span className="absolute top-1.5 left-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">{label} ({unit})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dietary restrictions */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dietary Restrictions</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DIETARY_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleDietary(opt)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${dietary.includes(opt) ? 'bg-[#6BAEE0] text-white border-[#6BAEE0] shadow-md' : 'bg-white text-slate-400 border-blue-100 hover:border-sky-300'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Nutrition goal */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nutrition Goal</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {NUTRITION_GOALS.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${goal === g ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-white text-slate-400 border-blue-100 hover:border-slate-300'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={saveSettings}
            className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${settingsSaved ? 'bg-emerald-500 text-white' : 'bg-[#6BAEE0] text-white shadow-blue-100'}`}
          >
            {settingsSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </section>
      )}
    </div>
  );
}
