import React from 'react';
import { PieChart, DollarSign, Zap, TrendingUp } from 'lucide-react';

export default function AnalyticsDashboard({ metrics, fridge, shoppingList }) {
  const totalPantryValue = fridge.reduce((sum, item) => sum + (item.price || 0), 0);
  const shoppingBudget = shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-50 text-[#6BAEE0] rounded-2xl"><DollarSign size={20} /></div>
            <h2 className="text-[14px] font-bold text-slate-400">Spending Overview</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-slate-400">Inventory Value</span>
              <span className="text-2xl font-black text-slate-800">${totalPantryValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-slate-400">Est. Shopping Trip</span>
              <span className="text-xl font-bold text-[#6BAEE0]">${shoppingBudget.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-50 text-[#6BAEE0] rounded-2xl"><Zap size={20} /></div>
            <h2 className="text-[14px] font-bold text-slate-400">Nutrition Matrix</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Protein</p>
              <p className="text-lg font-bold text-slate-800">{metrics.protein}g</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Carbs</p>
              <p className="text-lg font-bold text-slate-800">{metrics.carbs}g</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Fat</p>
              <p className="text-lg font-bold text-slate-800">{metrics.fat}g</p>
            </div>
          </div>
        </section>
      </div>
      
      <div className="bg-white/40 p-10 rounded-[2.5rem] border border-white/20 text-center">
        <TrendingUp size={48} className="mx-auto text-blue-100 mb-4" />
        <p className="text-xs text-slate-400 font-bold">Scanning more receipts will unlock advanced spending trends.</p>
      </div>
    </div>
  );
}