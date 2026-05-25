import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  // Auth Session States
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Application Data States
  const [fridge, setFridge] = useState([]);
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState('');
  
  // Advanced Interactive States
  const [aiRecipe, setAiRecipe] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [expirationMap, setExpirationMap] = useState({});
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });

  // Interface Layout States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);

  // Handle active user session tracking
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data rows mapped strictly to the logged-in user
  const fetchAppData = async () => {
    if (!user) return;
    try {
      let { data: inventory, error: invError } = await supabase
        .from('fridge_inventory')
        .select('item_name, created_at')
        .eq('user_id', user.id);
      
      if (invError) throw invError;
      
      const currentFridge = inventory ? inventory.map(i => i.item_name.toLowerCase().trim()) : [];
      setFridge(currentFridge);

      calculateMacroMetrics(currentFridge);
      if (inventory) generateExpirationTimelines(inventory);

      // Recipes remain global for everyone to read
      let { data: recipes, error: recError } = await supabase
        .from('recipes')
        .select('*');
        
      if (recError) throw recError;

      const normalizedRecipes = (recipes || []).map(r => {
        let parsedIngredients = [];
        try {
          parsedIngredients = typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients;
        } catch (e) {
          parsedIngredients = [];
        }
        return { ...r, ingredients: parsedIngredients || [] };
      });

      setMasterRecipes(normalizedRecipes);
    } catch (err) {
      console.error("Database secure streaming error:", err.message);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  // Auth Operations Gateway Handler
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert("🚀 Account created successfully! Access your dashboard loops via sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (err) {
      alert(`Authentication Boundary Failure: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setFridge([]);
    setMasterRecipes([]);
    setAiRecipe(null);
    setActiveModalRecipe(null);
  };

  // Macro Metrics Processing Matrix
  const calculateMacroMetrics = (items) => {
    let p = 0, c = 0, f = 0;
    items.forEach(item => {
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea')) { p += 9; c += 22; f += 1; }
      else if (item.includes('bread') || item.includes('croissant')) { p += 4; c += 28; f += 5; }
      else if (item.includes('spinach') || item.includes('salad')) { p += 2; c += 1; f += 0; }
      else if (item.includes('avocado')) { p += 2; c += 8; f += 15; }
      else { p += 5; c += 10; f += 3; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  };

  // Expiration Timeline Calculator
  const generateExpirationTimelines = (rawInventory) => {
    const freshMap = {};
    rawInventory.forEach(row => {
      const name = row.item_name.toLowerCase().trim();
      const createdDate = new Date(row.created_at || Date.now());
      let shelfDays = 7;

      if (name.includes('spinach') || name.includes('salad')) shelfDays = 4;
      if (name.includes('croissant') || name.includes('bread')) shelfDays = 5;
      if (name.includes('paneer') || name.includes('tofu')) shelfDays = 10;

      const expiryDate = new Date(createdDate.getTime() + shelfDays * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      
      freshMap[name] = {
        daysLeft: daysRemaining,
        statusLabel: daysRemaining <= 1 ? 'CRITICAL' : daysRemaining <= 3 ? 'WARNING' : 'STABLE'
      };
    });
    setExpirationMap(freshMap);
  };

  const getStructuralStepsForRecipe = (recipe) => {
    if (recipe.steps && recipe.steps.length > 0) return recipe.steps;
    return [
      `Carefully prep and scale your primary base component configuration (${recipe.ingredients[0] || 'vegetables'}).`,
      `Heat 2 tbsp of olive oil or butter equivalent in an artisan skillet over medium heat.`,
      `Incorporate secondary structural elements: ${recipe.ingredients.slice(1).join(', ')}.`,
      `Toss and cook thoroughly for 8-10 minutes, garnish with herbs, and plate your dish.`
    ];
  };

  const handleShareRecipe = (recipe, isAi = false) => {
    const steps = isAi ? recipe.steps : getStructuralStepsForRecipe(recipe);
    const ingredientsText = recipe.ingredients.map(ing => `• 1.5 Units of ${ing}`).join('\n');
    const stepsText = steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
    const shareText = `🍳 SmartFridge AI Recipe Sync Share!\n\nRECIPE: ${recipe.name || recipe.recipeName}\nTYPE: ${recipe.meal_type || 'Custom AI Generation'}\n\nINGREDIENTS:\n${ingredientsText}\n\nDIRECTIONS:\n${stepsText}`;
    
    navigator.clipboard.writeText(shareText);
    alert("🚀 Complete recipe specifications copied cleanly to clipboard layout!");
  };

  const handleGenerateAiRecipe = async () => {
    if (fridge.length === 0) return alert("Pantry configuration offline. Add ingredients first.");
    setAiGenerating(true);
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: "", 
          customPrompt: `Generate a premium custom vegetarian dish utilizing a highly compatible subset from these available options: ${fridge.join(', ')}.` 
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAiRecipe(data);
        setActiveModalRecipe({ 
          name: data.recipeName, 
          ingredients: fridge.filter((_, i) => i < 5), // Correlate matching sample subsets
          meal_type: 'AI Generation Matrix', 
          isAiGeneratedElement: true, 
          steps: data.steps 
        });
      }
    } catch (err) { 
      console.error(err); 
    }
    setAiGenerating(false);
  };

  const handleRemoveItem = async (itemName) => {
    try {
      // Instant local optimistic state flash
      setFridge(prev => prev.filter(item => item !== itemName));
      await supabase.from('fridge_inventory').delete().eq('item_name', itemName).eq('user_id', user.id);
      await fetchAppData();
    } catch (err) { console.error(err); }
  };

  const sendImageToBackend = async (base64Data) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });
      if (response.ok) {
        const data = await response.json();
        const cleanItems = data.added.map(item => item.trim().toLowerCase());
        const uniqueItems = [...new Set(cleanItems)];
        const insertPayload = uniqueItems.map(item => ({ item_name: item, user_id: user.id }));
        
        // Instant structural local state hydration to bypass async lag barriers
        setFridge(prev => [...new Set([...prev, ...uniqueItems])]);
        
        await supabase.from('fridge_inventory').upsert(insertPayload, { onConflict: 'user_id,item_name' });
        await fetchAppData();
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600; canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 600, 800);
      sendImageToBackend(canvas.toDataURL('image/jpeg', 0.75));
    };
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;
    const sanitizedInput = manualItem.trim().toLowerCase();

    // Instant optimistic data loop flash
    setFridge(prev => [...new Set([...prev, sanitizedInput])]);
    setManualItem('');

    await supabase.from('fridge_inventory').upsert([{ item_name: sanitizedInput, user_id: user.id }], { onConflict: 'user_id,item_name' });
    await fetchAppData();
  };

  const triggerStoreTripPlanner = () => {
    const alerts = [];
    masterRecipes.forEach(recipe => {
      const missing = recipe.ingredients ? recipe.ingredients.filter(ing => !fridge.includes(ing.toLowerCase().trim())) : [];
      // Flexible Threshold captures any array tracking a difference optimization scale boundary
      if (missing.length >= 1 && missing.length <= 4) {
        alerts.push({ recipe, missingItems: missing, mealType: recipe.meal_type || 'General' });
      }
    });
    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  const processedRecipes = masterRecipes.map(recipe => {
    const totalIngredients = recipe.ingredients ? recipe.ingredients.length : 0;
    const itemsWeHave = recipe.ingredients ? recipe.ingredients.filter(ing => fridge.includes(ing.toLowerCase().trim())) : [];
    const matchPercentage = totalIngredients > 0 ? Math.round((itemsWeHave.length / totalIngredients) * 100) : 0;
    return { ...recipe, matchPercentage, ownedCount: itemsWeHave.length, totalCount: totalIngredients };
  }).filter(recipe => {
    if (!recipeSearch) return true;
    return recipe.name.toLowerCase().includes(recipeSearch.toLowerCase());
  }).sort((a, b) => b.matchPercentage - a.matchPercentage);

  // SECURE ACCOUNT GATEWAY DISPLAY LAYER
  if (!user) {
    return (
      <div className="min-h-screen bg-[#070a13] text-slate-200 font-sans antialiased flex items-center justify-center p-6">
        <div className="bg-[#0c1222] border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent"></div>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(139,92,246,0.3)]">
              SmartFridge AI Terminal
            </h2>
            <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mt-1.5">Authorization Verification Sequence</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Email Address</label>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-[#070a13] border border-slate-800 px-4 py-3 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-all" placeholder="name@domain.com" />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Password</label>
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-[#070a13] border border-slate-800 px-4 py-3 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-all" placeholder="••••••••" />
            </div>

            <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black text-xs uppercase tracking-wider py-3.5 rounded-xl text-white shadow-lg shadow-violet-500/15 hover:shadow-violet-500/30 active:scale-[0.99] transition-all">
              {authLoading ? "⚡ Querying Matrix..." : (isSignUp ? "Create Account Token" : "Verify Secure Identity")}
            </button>
          </form>

          <div className="text-center mt-6 pt-4 border-t border-slate-900/60">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-violet-400 hover:underline">
              {isSignUp ? "Already hold an interface token? Sign In" : "Need multi-user validation? Create account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SYSTEM CENTRAL DASHBOARD INTERFACE
  return (
    <div className="min-h-screen bg-[#070a13] text-slate-200 font-sans antialiased selection:bg-violet-500 pb-12">
      <header className="bg-[#0c1222]/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-xl shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent tracking-tight drop-shadow-[0_2px_15px_rgba(168,85,247,0.4)]">
              SmartFridge AI
            </h1>
            <p className="text-slate-500 text-[9px] font-mono tracking-wider uppercase mt-1">
              Active Session Profile: <span className="text-slate-300 normal-case">{user.email}</span>
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto items-center">
            <button onClick={handleGenerateAiRecipe} className="bg-[#16122c] border border-violet-800/60 text-violet-300 font-black text-[11px] uppercase tracking-wider px-4 py-3 rounded-xl hover:bg-violet-900/40 transition-all">
              {aiGenerating ? "⚡ Processing..." : "🔮 AI Recipe"}
            </button>
            <button onClick={triggerStoreTripPlanner} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-[11px] uppercase tracking-wider px-4 py-3 rounded-xl shadow-lg transition-all">
              🛒 Trip Planner
            </button>
            <button onClick={handleSignOut} className="bg-slate-800 hover:bg-red-950 hover:text-red-400 border border-slate-700 font-bold text-[11px] uppercase tracking-wider px-3 py-3 rounded-xl transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1">
          {/* Macro panel */}
          <div className="bg-[#0c1222] p-5 rounded-2xl border border-slate-800/80 shadow-2xl">
            <h2 className="text-[11px] font-black tracking-widest uppercase text-slate-500 mb-4">📊 Available Macro Metrics</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#070a13] border border-slate-800 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Protein</p>
                <p className="text-lg font-black text-violet-400 mt-1">{nutritionMetrics.protein}g</p>
              </div>
              <div className="bg-[#070a13] border border-slate-800 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Carbs</p>
                <p className="text-lg font-black text-fuchsia-400 mt-1">{nutritionMetrics.carbs}g</p>
              </div>
              <div className="bg-[#070a13] border border-slate-800 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fats</p>
                <p className="text-lg font-black text-cyan-400 mt-1">{nutritionMetrics.fat}g</p>
              </div>
            </div>
          </div>

          {/* Ingestion Panel */}
          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-4">📸 Intake Node</h2>
            <div className="mb-5">
              <div className="relative border border-dashed border-slate-800 hover:border-violet-500/80 rounded-xl p-6 text-center bg-[#090d1a] cursor-pointer transition-all">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <p className="text-xs font-bold text-slate-300">Drop Target Receipt</p>
              </div>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-4 border-t border-slate-800/60">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Type item token..." className="flex-1 bg-[#070a13] border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-all" />
              <button type="submit" className="bg-slate-800 hover:bg-violet-600 text-slate-300 text-xs font-bold px-4 rounded-xl transition-all">Inject</button>
            </form>
            {loading && <div className="mt-4 p-3 bg-violet-950/30 text-center rounded-xl text-[10px] text-violet-400 font-black tracking-widest animate-pulse">⚡ RUNNING OPTICAL PARSER...</div>}
          </div>

          {/* Stock Room Panel */}
          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-4 flex items-center justify-between">
              <span>🏡 Private Stock Room</span>
              <span className="bg-[#070a13] border border-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">{fridge.length}</span>
            </h2>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {fridge.map((item, idx) => {
                const decay = expirationMap[item] || { daysLeft: 7, statusLabel: 'STABLE' };
                return (
                  <div key={idx} className="bg-[#090d1a] border border-slate-800 p-2.5 rounded-xl flex items-center justify-between group transform hover:translate-x-0.5 transition-all">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleRemoveItem(item)} className="text-slate-600 hover:text-red-400 font-mono text-sm">×</button>
                      <div>
                        <p className="text-xs font-black capitalize text-slate-200">{item}</p>
                        <p className="text-[9px] font-mono text-slate-500 mt-0.5">{decay.daysLeft} DAYS ({decay.statusLabel})</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recipe Dashboard Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">⚡ Personal Match Arrays</h2>
              <input type="text" placeholder="Search keys..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="bg-[#070a13] border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-all" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[620px] overflow-y-auto pr-2">
              {processedRecipes.slice(0, 40).map((recipe) => (
                <div key={recipe.id || recipe.name} onClick={() => setActiveModalRecipe(recipe)} className="p-4 bg-[#090d1a] border border-slate-800 rounded-xl cursor-pointer hover:border-violet-500/60 hover:-translate-y-0.5 transition-all flex flex-col justify-between group shadow-lg">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-extrabold text-slate-200 group-hover:text-violet-400 text-xs line-clamp-2 tracking-tight">{recipe.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black bg-slate-900 text-slate-400 shrink-0">{recipe.matchPercentage}%</span>
                    </div>
                    <span className="inline-block text-[8px] font-mono text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded mt-2 uppercase">{recipe.meal_type}</span>
                  </div>
                  <div className="w-full bg-[#070a13] h-1 rounded-full mt-4 overflow-hidden">
                    <div className={`h-full ${recipe.matchPercentage === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${recipe.matchPercentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Full Recipe Modal Expand Block Frame Layout */}
      {activeModalRecipe && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1222] border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-5">
              <div>
                <span className="bg-violet-950 border border-violet-800 text-violet-400 font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-black">{activeModalRecipe.meal_type}</span>
                <h3 className="text-lg font-black text-slate-100 mt-1.5 tracking-tight">{activeModalRecipe.name}</h3>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleShareRecipe(activeModalRecipe, !!activeModalRecipe.isAiGeneratedElement)} className="bg-[#121c2c] border border-cyan-800/60 text-cyan-400 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-cyan-950/40 transition-colors">🔗 Share</button>
                <button onClick={() => setActiveModalRecipe(null)} className="bg-slate-800 text-slate-400 text-xs font-mono px-3 py-1.5 rounded-xl border border-slate-700">Close</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-[#070a13] border border-slate-800 p-4 rounded-xl">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">📋 Scaling Specs</h4>
                <ul className="space-y-2">
                  {activeModalRecipe.ingredients?.map((ing, idx) => (
                    <li key={idx} className="text-xs text-slate-300 border-b border-slate-900 pb-1.5 flex flex-col capitalize">
                      <span className="font-mono text-[9px] text-violet-400 font-black">1.5 Units measure</span>
                      <span className="mt-0.5 text-slate-200 font-semibold">{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-2 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">🔥 Directions Roadmap</h4>
                <ol className="space-y-3">
                  {getStructuralStepsForRecipe(activeModalRecipe).map((step, idx) => (
                    <li key={idx} className="bg-[#090d1a] border border-slate-800 p-3 rounded-xl text-xs text-slate-300 flex gap-3 leading-relaxed">
                      <span className="font-mono font-black text-cyan-400 bg-slate-900 border border-slate-800 w-5 h-5 rounded flex items-center justify-center shrink-0">{idx + 1}</span>
                      <p className="font-medium text-slate-300">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Planner Optimization Dialog */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1222] border border-slate-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">🔮 Market Procurement Vector</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-1 rounded">DISMISS</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.slice(0, 15).map((alert, i) => (
                <div key={i} onClick={() => { setIsStoreAlertOpen(false); setActiveModalRecipe(alert.recipe); }} className="p-3.5 bg-[#090d1a] border border-slate-800 hover:border-violet-500 rounded-xl cursor-pointer transition-all">
                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-slate-300 text-xs">{alert.recipe.name}</h4>
                    <span className="text-[8px] font-mono text-violet-400 bg-violet-950/40 border border-violet-900/60 px-1.5 py-0.5 rounded uppercase">{alert.mealType}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-2">Missing Items to Buy: <span className="text-cyan-400 font-mono text-xs capitalize ml-1">{alert.missingItems.join(', ')}</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}