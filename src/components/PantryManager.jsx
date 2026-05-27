import React from 'react';
import { Camera, Plus, AlertCircle, Trash2, Eye, Loader2 } from 'lucide-react';

export default function PantryManager({ fridge, handleFileUpload, handleAddManualItem, handleUpdateInlineItem, handleRemoveItem, loading }) {
  const isExpiringSoon = (date) => {
    if (!date) return false;
    const today = new Date();
    const expiry = new Date(date);
    const diff = (expiry - today) / (1000 * 60 * 60 * 24);
    return diff <= 2;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Scanner Section */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 px-2">AI Vision Intake</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative border-2 border-dashed border-blue-100 hover:border-[#6BAEE0] p-8 text-center bg-blue-50/30 rounded-[2rem] cursor-pointer transition-all group active:scale-95">
            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'receipt')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-2xl shadow-sm text-[#6BAEE0] group-hover:scale-110 transition-transform">
                {loading ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Receipt Scan</p>
            </div>
          </div>
          <div className="relative border-2 border-dashed border-blue-100 hover:border-[#6BAEE0] p-8 text-center bg-blue-50/30 rounded-[2rem] cursor-pointer transition-all group active:scale-95">
            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'fridge')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-2xl shadow-sm text-[#6BAEE0] group-hover:scale-110 transition-transform">
                {loading ? <Loader2 className="animate-spin" size={24} /> : <Eye size={24} />}
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Fridge Scan</p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleAddManualItem} className="flex gap-2 mt-6">
          <input type="text" placeholder="Add manually..." className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm" />
          <button type="submit" className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
            <Plus size={20} />
          </button>
        </form>
      </section>

      {/* Stock List */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex justify-between items-center mb-6 px-2">
          <h2 className="text-[14px] font-bold text-slate-400">Pantry Stock</h2>
          <span className="bg-blue-50 text-[#6BAEE0] border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black">{fridge.length} items</span>
        </div>
        
        <div className="grid gap-3">
          {fridge.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium italic text-center py-10">Your pantry is empty</p>
          ) : (
            fridge.map((item) => (
              <div key={item.id} className="bg-white border border-blue-50 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm group hover:shadow-md transition-all">
                <div className="flex-1 min-w-0">
                  <input type="text" defaultValue={item.raw_name} onBlur={(e) => handleUpdateInlineItem(item.id, e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-800 border-b border-transparent hover:border-blue-100 focus:border-sky-400 focus:outline-none pb-1" />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono font-black text-slate-300 uppercase">Sanitized: <span className="text-[#6BAEE0]">{item.item_name}</span></span>
                    {isExpiringSoon(item.expiry_date) && <AlertCircle size={10} className="text-orange-400 animate-pulse" />}
                  </div>
                </div>
                <button onClick={() => handleRemoveItem(item.id)} className="text-slate-200 hover:text-red-400 transition-colors p-2"><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}