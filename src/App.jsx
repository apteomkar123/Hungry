import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import html2canvas from 'html2canvas';

export default function App() {
  // Session & Auth States
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  // Password Recovery States
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
  const [isResettingPasswordMode, setIsResettingPasswordMode] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  // Core Data States
  const [fridge, setFridge] = useState([]);
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState('');
  
  // Advanced Matrix Tracking States
  const [aiGenerating, setAiGenerating] = useState(false);
  const [expirationMap, setExpirationMap] = useState({});
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });

  // Navigation UI Layout States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);

  // DYNAMIC SERVINGS TRACKING STATE
  const [servingMultiplier, setServingMultiplier] = useState(1);

  const snapshotCardRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPasswordMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAppData = async () => {
    if (!user) return;
    try {
      let { data: inventory, error: invError } = await supabase
        .from('fridge_inventory')
        .select('item_name, created_at')
        .eq('user_id', user.id);
      
      if (invError) throw invError;
      
      const currentFridge = inventory 
        ? inventory
            .filter(i => i && i.item_name)
            .map(i => i.item_name.toLowerCase().trim()) 
        : [];
      setFridge(currentFridge);

      calculateMacroMetrics(currentFridge);
      if (inventory && inventory.length > 0) generateExpirationTimelines(inventory);

      // Fetch the 5,000 recipes from the database
      let { data: recipes, error: recError } = await supabase.from('recipes').select('*');
      if (recError) throw recError;

      const normalizedRecipes = (recipes || []).map(r => {
        let parsedIngredients = [];
        try {
          if (r.ingredients) {
            parsedIngredients = typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients;
          }
        } catch (e) {
          parsedIngredients = [];
        }
        return { ...r, ingredients: Array.isArray(parsedIngredients) ? parsedIngredients : [] };
      });
      setMasterRecipes(normalizedRecipes);
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  // Dynamic Recipe Steps Multiplier Values
  const getCleanMeasurement = (ingredientName, multiplier) => {
    const baseAmount = 1;
    const scaledAmount = baseAmount * multiplier;
    
    if (['pizza dough', 'naan bread', 'brioche bun', 'spinach tortilla'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount} Pcs`;
    }
    if (['mozzarella', 'cheese sauce', 'goat cheese', 'pepper jack cheese'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount * 75}g`;
    }
    if (['paneer', 'tofu', 'tempeh', 'mushrooms', 'sweet potato cubes'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount * 150}g`;
    }
    return `${scaledAmount * 0.5} Cups`;
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail.trim()) return alert("Please enter your email address first.");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert("📧 Security password reset token dispatched! Please check your email inbox.");
      setIsForgotPasswordView(false);
    } catch (err) {
      alert(`Recovery Fault: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPasswordConfirmation = async (e) => {
    e.preventDefault();
    if (newPasswordValue.trim().length < 6) return alert("Passwords must be at least 6 characters long.");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPasswordValue.trim() });
      if (error) throw error;
      alert("✅ Secure password reset validated cleanly!");
      setIsResettingPasswordMode(false);
      setNewPasswordValue('');
    } catch (err) {
      alert(`Modification Fault: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleChangePasswordInternally = async (e) => {
    e.preventDefault();
    if (newPasswordValue.trim().length < 6) return alert("New password must be at least 6 characters.");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPasswordValue.trim() });
      if (error) throw error;
      alert("🌟 Password altered cleanly from current session loops!");
      setIsSettingsOpen(false);
      setNewPasswordValue('');
    } catch (err) {
      alert(`Internal Update Error: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = authEmail.trim();
    const cleanPassword = authPassword.trim();
    if (!cleanEmail || !cleanPassword) return alert("Fields required.");
    if (cleanPassword.length < 6) return alert("Password must be at least 6 characters.");

    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: cleanEmail, password: cleanPassword });
        if (error) throw error;
        alert("🚀 Profile registered! Sign in with your credentials.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
        if (error) throw error;
      }
    } catch (err) { 
      alert(`Identity Validation Refused: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDownloadRecipeImage = async () => {
    if (!snapshotCardRef.current) return;
    try {
      const canvas = await html2canvas(snapshotCardRef.current, {
        backgroundColor: '#ffffff',
        scale: 3, 
        logging: false,
        useCORS: true
      });
      const imageUri = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = imageUri;
      downloadLink.download = `recipe-${(activeModalRecipe.name || activeModalRecipe.recipeName || 'download').replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) { console.error(err); }
  };

  const handleGenerateAiRecipe = async () => {
    if (fridge.length === 0) return alert("Pantry empty.");
    setAiGenerating(true);
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: "", customPrompt: `Review these available ingredients: ${fridge.join(', ')}.` })
      });
      if (response.ok) {
        const data = await response.json();
        setActiveModalRecipe({ 
          name: data.recipeName, 
          ingredients: data.ingredients || [], 
          meal_type: 'AI Generation Matrix', 
          isAiGeneratedElement: true, 
          steps: data.steps || [] 
        });
        setServingMultiplier(1); // Reset serving multiplier back to base configuration
      }
    } catch (err) { console.error(err); }
    setAiGenerating(false);
  };

  // TRIP PLANNER REPAIR FIX: Dynamically queries aligned database ingredient rows
  const triggerStoreTripPlanner = () => {
    const alerts = [];
    masterRecipes.forEach(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const missing = recipeIngredients.filter(ing => !fridge.includes(ing.toLowerCase().trim()));
      
      if (missing.length >= 1 && missing.length <= 2 && recipeIngredients.length > missing.length) {
        alerts.push({ recipe, missingItems: missing, mealType: recipe.meal_type || 'General' });
      }
    });
    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setFridge([]);
    setMasterRecipes([]);
    setActiveModalRecipe(null);
  };

  const handleRemoveItem = async (itemName) => {
    setFridge(prev => prev.filter(item => item !== itemName));
    await supabase.from('fridge_inventory').document.delete().eq('item_name', itemName).eq('user_id', user.id);
    await fetchAppData();
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
        const cleanItems = data.added ? data.added.map(item => item.trim().toLowerCase()) : [];
        const uniqueItems = [...new Set(cleanItems)];
        const insertPayload = uniqueItems.map(item => ({ item_name: item, user_id: user.id }));
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
    const input = manualItem.trim().toLowerCase();
    setFridge(prev => [...new Set([...prev, input])]);
    setManualItem('');
    await supabase.from('fridge_inventory').upsert([{ item_name: input, user_id: user.id }], { onConflict: 'user_id,item_name' });
    await fetchAppData();
  };

  const calculateMacroMetrics = (items) => {
    let p = 0, c = 0, f = 0;
    items.forEach(item => {
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea')) { p += 9; c += 22; f += 1; }
      else { p += 4; c += 12; f += 2; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  };

  const generateExpirationTimelines = (rawInventory) => {
    const freshMap = {};
    rawInventory.forEach(row => {
      if (row && row.item_name) {
        const name = row.item_name.toLowerCase().trim();
        freshMap[name] = { daysLeft: 6, statusLabel: 'STABLE' };
      }
    });
    setExpirationMap(freshMap);
  };

  const getStaticRecipeSteps = (recipe) => {
    if (recipe && recipe.steps && recipe.steps.length > 0) return recipe.steps;
    const itemsList = recipe && recipe.ingredients ? recipe.ingredients : ['ingredients'];
    return [
      `Carefully prep your primary base ingredient (${itemsList[0] || 'vegetables'}).`,
      `Heat 2 tbsp of olive oil or butter equivalent in an artisan skillet over medium heat.`,
      `Incorporate secondary structural elements: ${itemsList.slice(1).join(', ')}.`,
      `Toss and cook thoroughly for 8-10 minutes, adjust seasoning to taste, and serve.`
    ];
  };

  // REPAIR PROFILE: Fixed ingredient verification algorithms matching against JSON matrices
  const processedRecipes = masterRecipes.map(recipe => {
    const recipeIngredients = recipe.ingredients || [];
    const total = recipeIngredients.length;
    
    // Check against what is actually inside the active user's fridge inventory loop array
    const ownedItems = recipeIngredients.filter(ing => fridge.includes(ing.toLowerCase().trim()));
    const owned = ownedItems.length;
    
    const matchPercentage = total > 0 ? Math.round((owned / total) * 100) : 0;
    return { ...recipe, matchPercentage, ownedCount: owned, totalCount: total };
  }).filter(recipe => {
    if (!recipeSearch) return true;
    return recipe.name && recipe.name.toLowerCase().includes(recipeSearch.toLowerCase());
  }).sort((a, b) => b.matchPercentage - a.matchPercentage);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] text-slate-800 font-sans antialiased flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl w-full max-w-md shadow-xl relative">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          {isForgotPasswordView ? (
            <>
              <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Recover Password</h2>
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 mt-6">
                <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Type your email" />
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest">{authLoading ? "Sending..." : "Send Reset Link"}</button>
              </form>
              <button onClick={() => setIsForgotPasswordView(false)} className="text-xs text-center block w-full text-indigo-600 font-bold mt-5 hover:underline">Return to Login</button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SmartFridge AI</h2>
              <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6">
                <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none" placeholder="Email Address" />
                <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none" placeholder="Password" />
                <div className="text-right"><button type="button" onClick={() => setIsForgotPasswordView(true)} className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors">Forgot Password?</button></div>
                <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20">{authLoading ? "Verifying..." : (isSignUp ? "Register Account" : "Sign In")}</button>
              </form>
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-center block w-full text-indigo-600 font-bold mt-5 hover:underline">{isSignUp ? "Have an account? Login" : "Create Account"}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-12">
      
      {/* MOBILE REPAIR FLEX LAYER HEADER WRAPPER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="text-center md:text-left">
          <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">SmartFridge AI</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Account Profile: <span className="text-slate-600 normal-case font-semibold">{user.email}</span></p>
        </div>
        
        {/* Responsive action grid preventing clip breaks */}
        <div className="flex flex-wrap justify-center items-center gap-2 w-full md:w-auto">
          <button onClick={handleGenerateAiRecipe} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold text-[10px] sm:text-[11px] px-3 sm:px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all border border-indigo-100">
            {aiGenerating ? "⚡ Processing..." : "🔮 AI Recipe"}
          </button>
          <button onClick={triggerStoreTripPlanner} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-[10px] sm:text-[11px] px-3 sm:px-4 py-2.5 rounded-xl uppercase tracking-wider shadow-md">🛒 Trip Planner</button>
          
          {/* REPAIRED SETTINGS FONT DECLARATION ENGINE */}
          <button onClick={() => setIsSettingsOpen(true)} className="bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors font-sans text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
            <span>⚙️</span> <span className="hidden sm:inline">Settings</span>
          </button>
          
          <button onClick={handleSignOut} className="bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold text-[10px] sm:text-[11px] px-3 sm:px-4 py-2.5 rounded-xl uppercase tracking-wider border border-slate-200/40">Sign Out</button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="space-y-6 lg:col-span-1">
          {/* Macros Monitor */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-[11px] font-black tracking-widest uppercase text-slate-400 mb-4">📊 Nutrient Allocation Monitor</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-indigo-50/40 border border-indigo-100/60 p-2.5 rounded-2xl"><p className="text-[10px] text-indigo-500 font-extrabold uppercase">Protein</p><p className="text-lg font-black text-indigo-600 mt-1">{nutritionMetrics.protein}g</p></div>
              <div className="bg-purple-50/40 border border-purple-100/60 p-2.5 rounded-2xl"><p className="text-[10px] text-purple-500 font-extrabold uppercase">Carbs</p><p className="text-lg font-black text-purple-600 mt-1">{nutritionMetrics.carbs}g</p></div>
              <div className="bg-pink-50/40 border border-pink-100/60 p-2.5 rounded-2xl"><p className="text-[10px] text-pink-500 font-extrabold uppercase">Fats</p><p className="text-lg font-black text-pink-600 mt-1">{nutritionMetrics.fat}g</p></div>
            </div>
          </div>

          {/* Scanner Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">📸 Receipt Intake Scanner</h2>
            <div className="relative border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50 rounded-2xl cursor-pointer">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <p className="text-xs font-bold text-slate-600">Upload Grocery Receipt</p>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-4 mt-4 border-t border-slate-100">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Type item token..." className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-medium text-slate-700 focus:outline-none" />
              <button type="submit" className="bg-slate-800 text-white text-xs font-bold px-4 rounded-xl">Add</button>
            </form>
          </div>

          {/* Storage Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase flex justify-between items-center mb-4"><span>🏡 Private Storage Items</span><span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">{fridge.length}</span></h2>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {fridge.length === 0 ? <p className="text-xs text-slate-400 italic py-4">Storage empty.</p> : fridge.map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200/40 p-2.5 rounded-xl flex justify-between items-center shadow-sm"><span className="text-xs font-bold capitalize text-slate-700">{item}</span><button onClick={() => handleRemoveItem(item)} className="text-slate-300 hover:text-red-500 font-mono text-sm px-2">×</button></div>
              ))}
            </div>
          </div>
        </div>

        {/* Aligned Match Array Deck */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">⚡ Personal Match Arrays</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Calibrated directly against the 5,000 catalog entries</p>
            </div>
            <input type="text" placeholder="Filter indices..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="w-full sm:w-64 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-2">
            {processedRecipes.slice(0, 40).map((recipe) => (
              <div 
                key={recipe.id || recipe.name} 
                onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }} 
                className="p-4 bg-slate-50 hover:bg-white border border-slate-200/60 hover:border-indigo-400 hover:-translate-y-0.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between shadow-sm group"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-extrabold text-slate-700 group-hover:text-indigo-600 text-xs line-clamp-2 tracking-tight transition-colors">{recipe.name}</h3>
                    {/* WORKING REALTIME PERCENT COMPOSITION DISPLAY BADGE */}
                    <span className={`text-[10px] font-mono font-black shrink-0 px-1.5 py-0.5 rounded ${
                      recipe.matchPercentage === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                    }`}>{recipe.matchPercentage}% MATCH</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md mt-2.5 inline-block uppercase font-bold tracking-wide">{recipe.meal_type || 'General'}</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full mt-4 overflow-hidden">
                  <div className={`h-full ${recipe.matchPercentage === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${recipe.matchPercentage}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FULL EXPANDABLE RECIPE DETAILED MODAL VIEWER */}
      {activeModalRecipe && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto transition-all">
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-4 mb-6">
              <div>
                <span className="bg-indigo-50 text-indigo-600 font-mono text-[9px] px-2 py-0.5 rounded-md uppercase font-black">{activeModalRecipe.meal_type}</span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1">{activeModalRecipe.name || activeModalRecipe.recipeName}</h3>
              </div>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button onClick={handleDownloadRecipeImage} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md">📸 Save Card Photo</button>
                <button onClick={() => { setActiveModalRecipe(null); setServingMultiplier(1); }} className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200">Close</button>
              </div>
            </div>

            {/* DYNAMIC SCALE CONTROLLERS */}
            <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl mb-6 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono pl-2">👥 Scale Active Yield Servings:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button 
                    key={num} 
                    onClick={() => setServingMultiplier(num)} 
                    className={`w-8 h-8 rounded-xl font-mono text-xs font-black transition-all ${
                      servingMultiplier === num ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>

            {/* PHOTO PRINT CANVAS HOOK TARGET */}
            <div ref={snapshotCardRef} className="bg-white border border-slate-100 p-6 rounded-2xl space-y-6">
              <div className="border-b border-slate-100 pb-4 text-center">
                <h2 className="text-xl font-black text-indigo-600 uppercase tracking-wide">{activeModalRecipe.name || activeModalRecipe.recipeName}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase font-mono mt-1">SmartFridge AI Formulation Document • Yield Category {servingMultiplier}x</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* CALIBRATED SCALABLE VOLUME GENERATORS */}
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-slate-200 pb-1 mb-3">📋 Component Specs</h4>
                  <ul className="space-y-2">
                    {activeModalRecipe.ingredients?.map((ing, idx) => (
                      <li key={idx} className="text-xs font-bold text-slate-700 capitalize flex flex-col border-b border-slate-200/40 pb-1.5">
                        {/* Scaled Volume Generation Text */}
                        <span className="text-[8px] font-mono text-purple-500 font-black tracking-wide uppercase">
                          {getCleanMeasurement(ing, servingMultiplier)}
                        </span>
                        <span className="text-slate-700 mt-0.5">{ing}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-slate-100 pb-1">🔥 Preparation Progression Matrix</h4>
                  <ol className="space-y-2.5">
                    {(activeModalRecipe.isAiGeneratedElement ? activeModalRecipe.steps : getStaticRecipeSteps(activeModalRecipe)).map((step, idx) => (
                      <li key={idx} className="bg-slate-50 border border-slate-200/40 p-3 rounded-xl text-xs text-slate-600 flex gap-3 leading-relaxed">
                        <span className="font-mono font-black text-indigo-600 bg-white border border-slate-200 w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-sm">{idx + 1}</span>
                        <p className="font-semibold text-slate-600">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Shopping Trip Planner Modal */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">🔮 Market Procurement Matrix</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200/60">Dismiss</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Add ingredients to your fridge to reveal optimized recipe gaps.</p>
              ) : (
                shoppingAlerts.slice(0, 15).map((alert, i) => (
                  <div key={i} onClick={() => { setIsStoreAlertOpen(false); setServingMultiplier(1); setActiveModalRecipe(alert.recipe); }} className="p-3.5 bg-slate-50 border border-slate-200/60 hover:border-indigo-400 rounded-2xl cursor-pointer transition-all shadow-sm group">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-slate-700 text-xs group-hover:text-indigo-600 transition-colors">{alert.recipe.name}</h4>
                      <span className="text-[8px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase font-bold">{alert.mealType}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-semibold mt-2">Target Store Purchases: <span className="text-indigo-600 font-mono text-xs capitalize font-bold ml-0.5">{alert.missingItems.join(', ')}</span></p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Internal settings modal box */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">🔒 Modify Profile Credentials</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-xs font-mono text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleChangePasswordInternally} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1">New System Password</label>
                <input type="password" required value={newPasswordValue} onChange={(e) => setNewPasswordValue(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide shadow-sm">Save New Password</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}