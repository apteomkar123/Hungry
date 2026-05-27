import React from 'react';
import { Plus, Check, Trash2, ShoppingCart } from 'lucide-react';

export default function ShoppingListManager({ list, onAdd, onToggle, onClear }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="p-3 bg-sky-50 text-[#6BAEE0] rounded-2xl">
            <ShoppingCart size={20} />
          </div>
          <h2 className="text-[14px] font-bold text-slate-400">Shopping List</h2>
        </div>

        <form onSubmit={onAdd} className="flex gap-2 mb-8">
          <input type="text" placeholder="Add items to buy..." className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm" />
          <button type="submit" className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
            <Plus size={20} />
          </button>
        </form>

        <div className="grid gap-3">
          {list.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium italic text-center py-10">Your list is empty</p>
          ) : (
            list.map((item) => (
              <div key={item.id} className={`bg-white border p-4 rounded-2xl flex items-center justify-between gap-4 transition-all ${item.is_completed ? 'border-transparent opacity-50' : 'border-blue-50 shadow-sm'}`}>
                <div className="flex items-center gap-4 flex-1">
                  <button onClick={() => onToggle(item.id, item.is_completed)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${item.is_completed ? 'bg-sky-500 text-white' : 'bg-blue-50 text-transparent border border-blue-100'}`}>
                    <Check size={14} strokeWidth={4} />
                  </button>
                  <span className={`text-xs font-bold text-slate-700 ${item.is_completed ? 'line-through text-slate-400' : ''}`}>{item.item_name}</span>
                </div>
                <button onClick={() => onClear(item.id)} className="text-slate-200 hover:text-red-400 transition-colors p-2"><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}