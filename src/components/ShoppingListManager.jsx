import React, { useState } from 'react';
import { Plus, Check, Trash2, ShoppingCart, Target, Edit2, LayoutList, Store } from 'lucide-react';
import { useUser } from './UserContext';

const AISLES = [
  { key: 'Produce', emoji: '🥦', pattern: /\b(apple|banana|orange|mango|grape|strawberry|blueberry|raspberry|lemon|lime|pear|peach|cherry|watermelon|pineapple|kiwi|avocado|fig|coconut|carrot|potato|tomato|onion|garlic|spinach|broccoli|cauliflower|lettuce|cabbage|cucumber|pepper|celery|kale|zucchini|eggplant|mushroom|corn|pea|bean|lentil|asparagus|beetroot|radish|leek|squash|ginger|chili|herb|cilantro|parsley|basil|mint|thyme|rosemary|scallion|shallot|arugula|chard)\b/i },
  { key: 'Dairy & Eggs', emoji: '🥛', pattern: /\b(milk|cheese|butter|yogurt|cream|egg|paneer|ghee|curd|whey|kefir|mozzarella|cheddar|parmesan|brie|ricotta|cottage|sour cream|dairy|half and half)\b/i },
  { key: 'Meat & Fish', emoji: '🫘', pattern: /\b(chicken|beef|pork|lamb|turkey|fish|salmon|tuna|shrimp|crab|lobster|bacon|sausage|ham|mutton|duck|seafood|steak|mince|pepperoni|anchovy|venison|veal|salami|prawn|tilapia|cod|sardine)\b/i },
  { key: 'Frozen', emoji: '🧊', pattern: /\b(frozen|ice cream|gelato|popsicle|sorbet|frost)\b/i },
  { key: 'Beverages', emoji: '☕', pattern: /\b(water|juice|soda|tea|coffee|beer|wine|spirit|whiskey|vodka|rum|gin|drink|beverage|smoothie|shake|cola|lemonade|kombucha|sparkling|almond milk|oat milk)\b/i },
  { key: 'Snacks & Bakery', emoji: '🍿', pattern: /\b(chip|crisp|cracker|cookie|biscuit|candy|chocolate|popcorn|pretzel|almond|cashew|walnut|peanut|pistachio|granola|protein bar|rice cake|bread|roll|bun|muffin|croissant|bagel|tortilla|wrap|pita|naan)\b/i },
  { key: 'Pantry', emoji: '📦', pattern: null },
];

const getAisle = (itemName) => {
  const n = (itemName || '').toLowerCase();
  for (const aisle of AISLES) {
    if (aisle.pattern && aisle.pattern.test(n)) return aisle.key;
  }
  return 'Pantry';
};

export default function ShoppingListManager({ list = [], onAdd, onToggle, onClear }) {
  const { household, handleUpdateBudgetLimit } = useUser();
  const [shoppingInput, setShoppingInput] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(household?.budget_limit || 0);
  const [storeView, setStoreView] = useState(false);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!shoppingInput.trim()) return;
    onAdd(shoppingInput);
    setShoppingInput('');
  };

  const handleSaveBudget = () => {
    if (!handleUpdateBudgetLimit) return;
    handleUpdateBudgetLimit(budgetInput);
    setIsEditingBudget(false);
  };

  const pending = list.filter(i => !i.is_completed);
  const completed = list.filter(i => i.is_completed);

  const groupedByAisle = AISLES.reduce((acc, aisle) => {
    acc[aisle.key] = pending.filter(i => getAisle(i.item_name) === aisle.key);
    return acc;
  }, {});

  const renderItem = (item) => (
    <div key={item.id} className={`bg-white border p-4 rounded-2xl flex items-center justify-between gap-4 transition-all ${item.is_completed ? 'border-transparent opacity-50' : 'border-blue-50 shadow-sm'}`}>
      <div className="flex items-center gap-4 flex-1">
        <button onClick={() => onToggle(item.id, item.is_completed)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${item.is_completed ? 'bg-sky-500 text-white' : 'bg-blue-50 text-transparent border border-blue-100'}`}>
          <Check size={14} strokeWidth={4} />
        </button>
        <span className={`text-xs font-bold text-slate-700 ${item.is_completed ? 'line-through text-slate-400' : ''}`}>{item.item_name}</span>
      </div>
      <button onClick={() => onClear(item.id)} className="text-slate-200 hover:text-red-400 transition-colors p-2"><Trash2 size={16} /></button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Budget Limit Section */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-50 text-[#6BAEE0] rounded-2xl">
              <Target size={20} />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-slate-400">Monthly Budget</h2>
              <p className="text-lg font-black text-slate-700">${(household?.budget_limit || 0).toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={() => { setIsEditingBudget(!isEditingBudget); setBudgetInput(household?.budget_limit || 0); }}
            className="p-3 bg-blue-50 text-[#6BAEE0] rounded-2xl hover:bg-sky-100 transition-all"
          >
            <Edit2 size={16} />
          </button>
        </div>

        {isEditingBudget && (
          <div className="mt-4 flex gap-2 animate-in slide-in-from-top-2 duration-300">
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="flex-1 bg-white border border-blue-100 px-5 py-3 rounded-2xl text-xs font-semibold focus:border-sky-400 focus:outline-none"
              placeholder="Set limit..."
            />
            <button onClick={handleSaveBudget} className="bg-[#6BAEE0] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">Save</button>
          </div>
        )}
      </section>

      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-50 text-[#6BAEE0] rounded-2xl">
              <ShoppingCart size={20} />
            </div>
            <h2 className="text-[14px] font-bold text-slate-400">Shopping List</h2>
          </div>
          {/* View toggle */}
          <button
            onClick={() => setStoreView(v => !v)}
            title={storeView ? 'Switch to List View' : 'Switch to Store View'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${storeView ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-blue-50 text-[#6BAEE0] border-blue-100 hover:bg-sky-100'}`}
          >
            {storeView ? <LayoutList size={13} /> : <Store size={13} />}
            {storeView ? 'List' : 'Store'}
          </button>
        </div>

        <form onSubmit={handleAddSubmit} className="flex gap-2 mb-8">
          <input type="text" value={shoppingInput} onChange={(e) => setShoppingInput(e.target.value)} placeholder="Add items to buy..." className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm" />
          <button type="submit" className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
            <Plus size={20} />
          </button>
        </form>

        {list.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium italic text-center py-10">Your list is empty</p>
        ) : storeView ? (
          /* ── Store View: grouped by aisle ── */
          <div className="space-y-5">
            {AISLES.filter(a => groupedByAisle[a.key]?.length > 0).map(aisle => (
              <div key={aisle.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-base">{aisle.emoji}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{aisle.key}</span>
                  <span className="text-[9px] font-bold text-slate-300 ml-1">{groupedByAisle[aisle.key].length}</span>
                </div>
                <div className="grid gap-2">
                  {groupedByAisle[aisle.key].map(renderItem)}
                </div>
              </div>
            ))}
            {completed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-base">✅</span>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Done</span>
                </div>
                <div className="grid gap-2">{completed.map(renderItem)}</div>
              </div>
            )}
          </div>
        ) : (
          /* ── List View: flat ── */
          <div className="grid gap-3">
            {list.map(renderItem)}
          </div>
        )}
      </section>
    </div>
  );
}
