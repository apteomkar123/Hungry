import React, { useState, useRef, useCallback } from 'react';
import { ChefHat, Refrigerator, ShoppingCart, BarChart3, Users, Star, Search, Trash2, Settings } from 'lucide-react';
import { cleanIngredientLocally, getStaticRecipeSteps, triggerHaptic, matchesRecipeFilter } from './components/recipeUtils';
import Header from './components/Header';
import PantryManager from './components/PantryManager';
import RecipeExplorer from './components/RecipeExplorer';
import ShoppingListManager from './components/ShoppingListManager';
import RecipeModal from './components/RecipeModal';
import CookingMode from './components/CookingMode';
import AiIngredientPickerModal from './components/AiIngredientPickerModal';
import HouseholdSettings from './components/HouseholdSettings';
import SettingsPage from './components/SettingsPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import MealPrepModal from './components/MealPrepModal';
import AuthManager from './components/AuthManager';
import { useUser } from './components/UserContext';
import { RecipeProvider, useRecipes } from './components/RecipeContext';
import { useInventory } from './components/useInventory';
import ChefHistory from './components/ChefHistory';

function AppContent({ inventory }) {
  const { household: activeHousehold, households } = useUser();
  const {
    fridge,
    shoppingList,
    nutritionMetrics,
    receiptLoading,
    receiptMessage,
    barcodeLoading,
    barcodeResult,
    isScanningBarcode,
    barcodeInput,
    setBarcodeInput,
    setIsScanningBarcode,
    handleAddManualItem,
    handleRemoveItem,
    handleToggleItemHousehold,
    handleAddShoppingItem,
    handleToggleShoppingCompleted,
    handleClearShoppingItem,
    handleBarcodeLookup,
    handleFileUpload,
    handleUpdateItem,
    handleMarkCooked
  } = inventory;

  const {
    activeModalRecipe,
    setActiveModalRecipe,
    savedRecipes,
    onRemoveSavedRecipe,
    filteredSavedRecipes,
    savedSearch,
    setSavedSearch,
    savedCategoryFilters,
    setSavedCategoryFilters,
    savedDietFilters,
    setSavedDietFilters,
    savedCuisineFilters,
    setSavedCuisineFilters,
    shoppingAlerts,
    isStoreAlertOpen,
    setIsStoreAlertOpen,
    savedMealPlans,
    removeMealPlan,
    setActiveMealPlan,
    setIsMealPrepOpen,
  } = useRecipes();

  const [activeTab, setActiveTab] = useState('pantry');
  const [isCookingMode, setIsCookingMode] = useState(false);
  const mainRef = useRef(null);
  const [shopCategoryFilters, setShopCategoryFilters] = useState([]);
  const [shopDietFilters, setShopDietFilters] = useState([]);
  const [shopCuisineFilters, setShopCuisineFilters] = useState([]);
  const toggleFilter = (setter) => (f) =>
    setter(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  const scrollToTop = useCallback(() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), []);

  const addedItems = new Set(shoppingList.map(i => cleanIngredientLocally(i.item_name)));

  return (
    <div className="h-[100dvh] flex flex-col bg-blue-50/50 text-slate-800 font-sans antialiased selection:bg-[#6BAEE0] selection:text-white overflow-hidden">
      {/* Scrollable area — Header sticky inside here */}
      <main ref={mainRef} className="flex-1 overflow-y-auto w-full">
        <div className="w-full flex justify-center">
          <Header scrollToTop={scrollToTop} />
        </div>
        <div className="w-full flex justify-center px-4 sm:px-6 py-8">
          <div className="w-full max-w-5xl pb-4">
            {activeTab === 'pantry' && (
              <PantryManager
                fridge={fridge}
                activeHousehold={activeHousehold}
                households={households}
                handleAddManualItem={handleAddManualItem}
                handleUpdateItem={handleUpdateItem}
                handleRemoveItem={handleRemoveItem}
                handleToggleItemHousehold={handleToggleItemHousehold}
                receiptLoading={receiptLoading}
                receiptMessage={receiptMessage}
                handleFileUpload={handleFileUpload}
                barcodeInput={barcodeInput}
                setBarcodeInput={setBarcodeInput}
                handleBarcodeLookup={handleBarcodeLookup}
                barcodeLoading={barcodeLoading}
                barcodeResult={barcodeResult}
                isScanningBarcode={isScanningBarcode}
                setIsScanningBarcode={setIsScanningBarcode}
              />
            )}
            {activeTab === 'recipes' && <RecipeExplorer />}
            {activeTab === 'shopping' && (
              <ShoppingListManager
                list={shoppingList}
                onAdd={handleAddShoppingItem}
                onToggle={handleToggleShoppingCompleted}
                onClear={handleClearShoppingItem}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                metrics={nutritionMetrics}
                fridge={fridge}
                shoppingList={shoppingList}
                onAddShoppingItem={handleAddShoppingItem}
              />
            )}
            {activeTab === 'household' && <HouseholdSettings />}
            {activeTab === 'settings' && <SettingsPage />}
            {activeTab === 'saved' && (
              <div className="space-y-6">
                {/* ── Chef History ── */}
                <ChefHistory />

                {/* ── Meal Plans ── */}
                {savedMealPlans.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
                    <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2">
                      <span className="text-base">📅</span> Saved Meal Plans
                    </h2>
                    <div className="space-y-3">
                      {savedMealPlans.map(plan => (
                        <div key={plan.id} className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-[#6BAEE0]">{plan.batches?.length || 0} Batch{plan.batches?.length !== 1 ? 'es' : ''}</p>
                            <p className="text-[10px] text-slate-400">{new Date(plan.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setActiveMealPlan(plan); setIsMealPrepOpen(true); }}
                              className="text-[10px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-3 py-1.5 rounded-xl hover:bg-sky-50 transition-all"
                            >
                              View
                            </button>
                            <button
                              onClick={() => removeMealPlan(plan.id)}
                              className="text-red-300 hover:text-red-500 transition-colors p-1.5"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search saved recipes..."
                      value={savedSearch}
                      onChange={(e) => setSavedSearch(e.target.value)}
                      className="w-full bg-blue-50/50 border border-blue-100 pl-12 pr-6 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button onClick={() => setSavedCategoryFilters([])} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${savedCategoryFilters.length === 0 ? 'bg-[#6BAEE0] text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-400 border border-blue-50 hover:border-sky-200'}`}>all</button>
                    {['breakfast', 'lunch', 'dinner', 'snack', 'dessert'].map((f) => (
                      <button key={f} onClick={() => toggleFilter(setSavedCategoryFilters)(f)}
                        className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${savedCategoryFilters.includes(f) ? 'bg-[#6BAEE0] text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-400 border border-blue-50 hover:border-sky-200'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-2">
                    {['vegetarian', 'vegan', 'meat', 'fish'].map((f) => (
                      <button key={f} onClick={() => toggleFilter(setSavedDietFilters)(f)}
                        className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${savedDietFilters.includes(f) ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-400 border border-blue-50 hover:border-emerald-200'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-2">
                    {['indian', 'chinese', 'mexican', 'japanese', 'korean', 'jamaican', 'latin', 'african', 'mediterranean'].map((f) => (
                      <button key={f} onClick={() => toggleFilter(setSavedCuisineFilters)(f)}
                        className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${savedCuisineFilters.includes(f) ? 'bg-slate-700 text-white shadow-lg' : 'bg-white text-slate-400 border border-blue-50 hover:border-slate-300'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  {filteredSavedRecipes.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium italic text-center py-10">No saved recipes match your criteria</p>
                  ) : (
                    filteredSavedRecipes.map(recipe => (
                      <div key={recipe.id} className="bg-white/80 p-6 rounded-3xl border border-blue-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => setActiveModalRecipe({
                            ...recipe,
                            id: recipe.recipe_id,
                            name: recipe.recipe_name,
                            cleanedIngredients: recipe.ingredients ? recipe.ingredients.map(cleanIngredientLocally) : []
                          })}
                        >
                          <span className="text-[8px] font-mono font-black text-slate-400 uppercase bg-blue-50/50 px-2 py-1 rounded-md">{recipe.meal_type}</span>
                          <h3 className="font-bold text-slate-700 mt-1 group-hover:text-[#6BAEE0] transition-colors">{recipe.recipe_name}</h3>
                        </div>
                        <button onClick={() => onRemoveSavedRecipe(recipe.id)} className="text-red-300 hover:text-red-500 transition-colors p-2"><Trash2 size={20} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom nav — always at bottom, never scrolls */}
      <div className="shrink-0 w-full flex justify-center px-4 pb-6 pt-3 bg-blue-50/60 backdrop-blur-sm">
        <nav className="w-full max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 rounded-full h-16 shadow-2xl flex items-center justify-around px-6 transition-all hover:scale-[1.02]">
          <button onClick={() => { triggerHaptic(); setActiveTab('pantry'); }} className={`p-2 rounded-full transition-all ${activeTab === 'pantry' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><Refrigerator size={24} /></button>
          <button onClick={() => { triggerHaptic(); setActiveTab('recipes'); }} className={`p-2 rounded-full transition-all ${activeTab === 'recipes' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><ChefHat size={24} /></button>
          <button onClick={() => { triggerHaptic(); setActiveTab('shopping'); }} className={`p-2 rounded-full transition-all ${activeTab === 'shopping' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><ShoppingCart size={24} /></button>
          <button onClick={() => { triggerHaptic(); setActiveTab('saved'); }} className={`p-2 rounded-full transition-all ${activeTab === 'saved' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><Star size={24} /></button>
          <button onClick={() => { triggerHaptic(); setActiveTab('household'); }} className={`p-2 rounded-full transition-all ${activeTab === 'household' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><Users size={24} /></button>
          <button onClick={() => { triggerHaptic(); setActiveTab('analytics'); }} className={`p-2 rounded-full transition-all ${activeTab === 'analytics' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><BarChart3 size={24} /></button>
          <button onClick={() => { triggerHaptic(); setActiveTab('settings'); }} className={`p-2 rounded-full transition-all ${activeTab === 'settings' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><Settings size={22} /></button>
        </nav>
      </div>

      <AiIngredientPickerModal />
      <MealPrepModal />

      {activeModalRecipe && (
        <RecipeModal
          onStartCooking={() => setIsCookingMode(true)}
          addedItems={addedItems}
          onAddIngredient={handleAddShoppingItem}
          onAddToPantry={handleAddManualItem}
          onMarkCooked={handleMarkCooked}
        />
      )}

      {isCookingMode && activeModalRecipe && (
        <CookingMode
          steps={getStaticRecipeSteps(activeModalRecipe)}
          onClose={() => setIsCookingMode(false)}
        />
      )}

      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-3xl bg-white rounded-[2.5rem] border border-blue-100 shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-800">Shopping Suggestions</h3>
                <p className="text-sm text-slate-500">Recipes almost matching your pantry. Pick up the missing items.</p>
              </div>
              <button onClick={() => setIsStoreAlertOpen(false)} className="text-slate-400 hover:text-slate-700 font-black text-2xl">×</button>
            </div>

            {/* Filters */}
            <div className="mb-4 space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button onClick={() => setShopCategoryFilters([])} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${shopCategoryFilters.length === 0 ? 'bg-[#6BAEE0] text-white shadow-md' : 'bg-blue-50 text-slate-400 hover:border-sky-200'}`}>all</button>
                {['breakfast', 'lunch', 'dinner', 'snack', 'dessert'].map(f => (
                  <button key={f} onClick={() => toggleFilter(setShopCategoryFilters)(f)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${shopCategoryFilters.includes(f) ? 'bg-[#6BAEE0] text-white shadow-md' : 'bg-blue-50 text-slate-400 hover:border-sky-200'}`}>{f}</button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['vegetarian', 'vegan', 'meat', 'fish'].map(f => (
                  <button key={f} onClick={() => toggleFilter(setShopDietFilters)(f)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${shopDietFilters.includes(f) ? 'bg-emerald-500 text-white shadow-md' : 'bg-blue-50 text-slate-400 hover:border-emerald-200'}`}>{f}</button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['indian', 'chinese', 'mexican', 'japanese', 'korean', 'jamaican', 'latin', 'african', 'mediterranean'].map(f => (
                  <button key={f} onClick={() => toggleFilter(setShopCuisineFilters)(f)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${shopCuisineFilters.includes(f) ? 'bg-slate-700 text-white shadow-md' : 'bg-blue-50 text-slate-400 hover:border-slate-300'}`}>{f}</button>
                ))}
              </div>
            </div>

            {(() => {
              const filtered = shoppingAlerts.filter(a => {
                const r = a.recipe;
                if (shopCategoryFilters.length > 0 && !shopCategoryFilters.some(f => matchesRecipeFilter(r, f))) return false;
                if (shopDietFilters.length > 0 && !shopDietFilters.some(f => matchesRecipeFilter(r, f))) return false;
                if (shopCuisineFilters.length > 0 && !shopCuisineFilters.some(f => matchesRecipeFilter(r, f))) return false;
                return true;
              });
              if (filtered.length === 0) return (
                <div className="rounded-3xl bg-blue-50 p-6 text-center text-slate-600">
                  {shoppingAlerts.length === 0 ? 'No shopping suggestions found yet. Add pantry items and try again.' : 'No suggestions match these filters.'}
                </div>
              );
              return (
                <div className="grid gap-4">
                  {filtered.map((alert, idx) => (
                    <div key={idx} className="bg-slate-50 border border-blue-50 rounded-3xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] uppercase tracking-widest font-black text-slate-400 bg-blue-50 px-3 py-1 rounded-full">{alert.mealType}</span>
                        <span className="text-xs font-bold text-slate-500">Missing {alert.missingItems.length}</span>
                      </div>
                      <h4 className="font-bold text-slate-800 mb-3">{alert.recipe.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        {alert.missingItems.map((item, i) => (
                          <span key={i} className="text-[11px] text-slate-600 bg-white border border-blue-100 rounded-full px-3 py-1">{item}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => { setActiveModalRecipe(alert.recipe); setIsStoreAlertOpen(false); }}
                        className="mt-3 text-xs font-bold text-[#6BAEE0] hover:underline"
                      >
                        View Recipe & Add Missing Items →
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
            )}
            <div className="mt-6 text-right">
              <button
                onClick={() => { setIsStoreAlertOpen(false); setActiveTab('shopping'); }}
                className="bg-[#6BAEE0] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-100"
              >
                Go to Shopping List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MainApp() {
  const { user, household, loading: authLoading } = useUser();
  const inventory = useInventory(user, household);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-slate-400 font-semibold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-50 text-slate-900 font-sans font-black tracking-tight antialiased flex items-center justify-center p-6 select-none">
        <AuthManager />
      </div>
    );
  }

  return (
    <RecipeProvider fridge={inventory.fridge}>
      <AppContent inventory={inventory} />
    </RecipeProvider>
  );
}

export default function App() {
  return <MainApp />;
}
