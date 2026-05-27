import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import domtoimage from 'dom-to-image-more';

// --- Utilities moved outside component to prevent re-creation and improve clarity ---

const vegetarianBlocklist = [
  'chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'ham', 'bacon', 'anchovy', 'turkey', 'lamb', 'duck', 'mutton', 'veal', 'crab', 'lobster', 'sausage', 'pepperoni'
];

const isVegetarianIngredient = (value) => {
  if (!value) return true;
  const normalized = String(value).toLowerCase();
  return !vegetarianBlocklist.some(token => normalized.includes(token));
};

const cleanIngredientLocally = (rawName) => {
  if (!rawName) return '';
  let name = String(rawName).toLowerCase().trim();
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/[\u2013\u2014•]/g, ' ');
  name = name.replace(/\b(?:organic|fresh|large|small|medium|extra|reduced fat|low fat|low-sodium|low sodium|unsalted|sliced|diced|chopped|shredded|minced|ground|boneless|skinless|prepared|peeled|packaged|package|pack|can|canned|jar|bottle|tube|stick|slice|pieces|piece|cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|grams|gram|g|kg|pounds|pound|lb|lbs|oz|ounces|fluid|fl oz|ml|ltr|liter|litre|pkg|ct|count)\b/g, ' ');
  name = name.replace(/[^a-z0-9\s]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
};

const normalizeIngredientTokens = (value) => {
  const clean = cleanIngredientLocally(value);
  return Array.from(new Set(clean.split(/\s+/).filter(Boolean)));
};

const formatIngredientMeasurement = (ingredientString, multiplier) => {
  const lower = String(ingredientString).toLowerCase();
  const nameOnly = ingredientString.replace(/^[0-9\/\.\s\-½⅓¼¾⅛]+/, '').trim();
  if (/\b(cup|cups|ml|l|liter|litre|milk|yogurt|broth|water)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(tbsp|tablespoon|tablespoons|oil|sauce|vinegar|soy)\b/.test(lower)) return `${1 * multiplier} tbsp ${nameOnly}`;
  if (/\b(tsp|teaspoon|teaspoons|garlic|ginger|salt|pepper|spice|herb)\b/.test(lower)) return `${0.5 * multiplier} tsp ${nameOnly}`;
  if (/\b(flour|rice|lentil|sugar|pasta|beans)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(onion|tomato|potato|carrot|apple)\b/.test(lower)) return `${1 * multiplier} medium ${nameOnly}`;
  if (/\b(paneer|tofu|cheese|yogurt)\b/.test(lower)) {
    const oz = Math.max(1, Math.round((100 * multiplier) / 28.35));
    return `${oz} oz ${nameOnly}`;
  }
  return `${1 * multiplier} each ${nameOnly}`;
};

const getStaticRecipeSteps = (recipe) => {
  if (!recipe) return ['Follow the ingredient list to create the dish.'];
  const rawSteps = recipe.steps || recipe.instructions || recipe.step || [];
  let steps = [];
  if (Array.isArray(rawSteps)) {
    steps = rawSteps.map(step => String(step || '').trim()).filter(Boolean);
  } else {
    const textSteps = String(rawSteps || '').trim();
    if (textSteps.includes('\n')) steps = textSteps.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    else if (textSteps) steps = [textSteps];
  }
  if (steps && steps.length) return steps;
  const ingList = (recipe.cleanedIngredients || []).slice(0, 8).map(i => i.replace(/^[0-9\/\.\s\-½⅓¼¾⅛]+/, '').trim());
  const firstFew = ingList.length ? ingList.join(', ') : 'your ingredients';
  return [
    `Prep: gather ${firstFew}.`,
    'Combine the ingredients in a suitable pan or bowl.',
    'Cook or bake until ingredients are tender and flavors meld (approx. 10–25 minutes).',
    'Taste and adjust seasoning, then serve warm.'
  ];
};

const parseRecipeIngredientMeasurements = (ingredientString, multiplier) => {
  if (!ingredientString) return '';
  const numericTokenMatch = ingredientString.match(/^([0-9\/\.\s\-½⅓¼¾⅛]+)/);
  if (numericTokenMatch) {
    const rawNumberString = numericTokenMatch[1].trim();
    let baseVal = parseFloat(rawNumberString);
    if (isNaN(baseVal)) {
      if (rawNumberString.includes('½')) baseVal = 0.5;
      else if (rawNumberString.includes('¼')) baseVal = 0.25;
      else if (rawNumberString.includes('¾')) baseVal = 0.75;
      else baseVal = 1.0; 
    }
    return `${baseVal * multiplier} ${ingredientString.substring(numericTokenMatch[0].length).trim()}`;
  }
  return formatIngredientMeasurement(ingredientString, multiplier);
};

export default function App() 
{
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
  const [recipeCount, setRecipeCount] = useState(0);
  const [shoppingList, setShoppingList] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Input Handling States
  const [manualItem, setManualItem] = useState('');
  const [shoppingInput, setShoppingInput] = useState('');
  const [storeName, setStoreName] = useState('General Grocery');
  
  // Advanced Matrix Tracking States
  const [aiGenerating, setAiGenerating] = useState(false);
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });

  // Navigation UI Layout States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [activeRecipeFilter, setActiveRecipeFilter] = useState('all');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('pantry');

  // Dynamic Servings Multiplier State
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

  const recipeCategoryMatches = (recipe, patterns) => {
    const text = `${recipe.meal_type || ''} ${recipe.name || ''} ${(recipe.cleanedIngredients || []).join(' ')}`.toLowerCase();
    return patterns.some((pattern) => text.includes(pattern));
  };

  const isRecipeVegan = (recipe) => {
    const nonVegan = ['egg', 'eggs', 'milk', 'butter', 'cheese', 'cream', 'yogurt', 'honey', 'gelatin', 'paneer', 'whey'];
    return !(recipe.cleanedIngredients || []).some((ing) => nonVegan.some((token) => ing.includes(token)));
  };

  const isRecipeMeat = (recipe) => {
    const meatTokens = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'veal', 'duck', 'venison', 'mutton'];
    return (recipe.cleanedIngredients || []).some((ing) => meatTokens.some((token) => ing.includes(token)));
  };

  const isRecipeFish = (recipe) => {
    const fishTokens = ['fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'anchovy', 'trout', 'cod', 'seafood'];
    return (recipe.cleanedIngredients || []).some((ing) => fishTokens.some((token) => ing.includes(token)));
  };

  const isRecipeEgg = (recipe) => {
    return (recipe.cleanedIngredients || []).some((ing) => /(egg|eggs)/.test(ing));
  };

  const matchesRecipeFilter = (recipe, filter) => {
    switch (filter) {
      case 'vegetarian':
        return !isRecipeMeat(recipe) && !isRecipeFish(recipe);
      case 'vegan':
        return isRecipeVegan(recipe);
      case 'breakfast':
        return recipeCategoryMatches(recipe, ['breakfast', 'morning', 'brunch']);
      case 'lunch':
        return recipeCategoryMatches(recipe, ['lunch', 'sandwich', 'salad', 'bowl']);
      case 'dinner':
        return recipeCategoryMatches(recipe, ['dinner', 'supper', 'main', 'casserole', 'stew', 'pasta']);
      case 'dessert':
        return recipeCategoryMatches(recipe, ['dessert', 'cake', 'pie', 'pudding', 'sweet', 'custard', 'ice cream', 'brownie']);
      case 'snack':
        return recipeCategoryMatches(recipe, ['snack', 'finger', 'appetizer', 'dip', 'nibble', 'side']);
      case 'meat':
        return isRecipeMeat(recipe);
      case 'fish':
        return isRecipeFish(recipe);
      case 'egg':
        return isRecipeEgg(recipe);
      default:
        return true;
    }
  };

  const buildCreativeRecipePrompt = (pantryItems) => {
    const ingredientList = pantryItems.slice(0, 10).join(', ');
    return `You are a creative vegetarian chef. Invent a new recipe idea using these ingredients: ${ingredientList}. Create one unique vegetarian dish with an original name, a concise ingredient list that uses the supplied pantry items, and 4-6 short preparation steps. Output only valid JSON with keys: recipeName, ingredients, steps.`;
  };

  const fetchCreativeRecipeFromAi = async (pantryItems) => {
    const prompt = buildCreativeRecipePrompt(pantryItems);
    const response = await fetch('/.netlify/functions/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: prompt })
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_err) {
      const cleaned = text.replace(/```json|```/g, '').trim();
      try { parsed = JSON.parse(cleaned); } catch (err) { throw new Error('AI response parsing failed'); }
    }
    if (!parsed || !parsed.recipeName) {
      throw new Error('AI did not return a valid recipe');
    }
    return {
      id: `ai-${Date.now()}`,
      name: parsed.recipeName,
      meal_type: 'Creative',
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      cleanedIngredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(cleanIngredientLocally).filter(Boolean) : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : [String(parsed.steps || '').trim()].filter(Boolean)
    };
  };

  const generateLocalCreativeRecipe = (pantryItems) => {
    const unique = Array.from(new Set(pantryItems.map(p => cleanIngredientLocally(p)).filter(Boolean)));
    const take = unique.slice(0, 8);
    const name = `${take[0] ? take[0].split(' ')[0] : 'Pantry'} ${take[1] ? take[1].split(' ')[0] : 'Mix'} Bowl`;
    const ingredients = take.map(i => i);
    const steps = [
      `Prep the following: ${ingredients.join(', ')}.`,
      'Combine in a skillet with oil over medium heat.',
      'Simmer briefly until flavors meld and texture is pleasant.',
      'Adjust seasoning and serve warm.'
    ];
    return {
      id: `local-ai-${Date.now()}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      meal_type: 'Creative',
      ingredients,
      cleanedIngredients: ingredients.map(cleanIngredientLocally).filter(Boolean),
      steps
    };
  };

  const resolveSanitizedTokenOnline = async (rawInputString) => {
    const localToken = cleanIngredientLocally(rawInputString);
    if (!rawInputString || !rawInputString.trim()) return localToken;
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolveItemToken: rawInputString, storeContext: storeName })
      });
      if (response.ok) {
        const data = await response.json();
        const aiToken = cleanIngredientLocally(data.sanitized || '');
        if (!aiToken) return localToken;

        const localTokens = new Set(normalizeIngredientTokens(localToken));
        const aiTokens = new Set(normalizeIngredientTokens(aiToken));
        const overlap = [...localTokens].filter(token => aiTokens.has(token));

        if (overlap.length > 0) {
          return aiToken;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return localToken;
  };

  const parseMealDbRecipe = (meal) => {
    const ingredients = [];
    for (let i = 1; i <= 20; i += 1) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ingredient && ingredient.trim()) {
        const cleanedIngredient = `${measure ? measure.trim() : ''} ${ingredient.trim()}`.trim();
        ingredients.push(cleanedIngredient);
      }
    }
    const steps = String(meal.strInstructions || '')
      .split(/\r?\n+/)
      .map((step) => step.trim())
      .filter(Boolean);

    return {
      id: meal.idMeal,
      name: meal.strMeal || `Recipe ${meal.idMeal}`,
      meal_type: meal.strCategory || meal.strArea || 'General',
      ingredients,
      steps
    };
  };

  const fetchOnlineRecipes = async () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const results = await Promise.all(letters.map(async (letter) => {
      try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.meals || [];
      } catch (err) {
        console.error('Online recipe fetch failed for', letter, err);
        return [];
      }
    }));
    const meals = results.flat();
    const uniqueMeals = Array.from(new Map(meals.map((meal) => [meal.idMeal, meal])).values());
    return uniqueMeals.map(parseMealDbRecipe);
  };

  const fetchAppData = async () => {
    if (!user) return;
    try {
      let { data: inventory } = await supabase.from('fridge_inventory').select('*').eq('user_id', user.id);
      const normalizedFridge = (inventory || []).map(row => {
        const rawNameField = row.item_name || row.item || row.name || '';
        return {
          id: row.id,
          raw_name: rawNameField,
          item_name: cleanIngredientLocally(rawNameField)
        };
      }).filter(item => item.raw_name);
      setFridge(normalizedFridge);

      const plainTokensArray = normalizedFridge.map(f => f.item_name).filter(Boolean);
      calculateMacroMetrics(plainTokensArray);

      let { data: shopItems } = await supabase.from('shopping_list').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      setShoppingList(shopItems || []);

      let { data: likedRecipes } = await supabase.from('saved_recipes').select('*').eq('user_id', user.id);
      setSavedRecipes(likedRecipes || []);

      let onlineRecipes = [];
      try {
        onlineRecipes = await fetchOnlineRecipes();
      } catch (err) {
        console.error('Failed to fetch online recipes', err);
      }

      if (onlineRecipes.length > 0) {
        const normalizedRecipes = onlineRecipes.map((recipe) => {
          const cleanedIngredients = (recipe.ingredients || []).map((i) => cleanIngredientLocally(i)).filter(Boolean);
          const steps = Array.isArray(recipe.steps)
            ? recipe.steps.map((step) => String(step || '').trim()).filter(Boolean)
            : String(recipe.steps || '').split(/\r?\n+/).map((step) => String(step || '').trim()).filter(Boolean);
          return {
            ...recipe,
            ingredients: recipe.ingredients || [],
            cleanedIngredients,
            steps
          };
        }).filter((recipe) => {
          const joinedIngredients = (Array.isArray(recipe.cleanedIngredients) ? recipe.cleanedIngredients : []).join(' ').toLowerCase();
          return isVegetarianIngredient(joinedIngredients);
        });
        setMasterRecipes(normalizedRecipes);
        setRecipeCount(normalizedRecipes.length);
      } else {
        let { data: recipes } = await supabase.from('recipes').select('*').limit(10000);
        const parseIngredientArray = (raw) => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.map(i => String(i || '').trim()).filter(Boolean);
          const text = String(raw).trim();
          if (!text) return [];
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed.map(i => String(i || '').trim()).filter(Boolean);
            if (typeof parsed === 'string') return [parsed.trim()];
          } catch (e) {}
          const splitItems = text.split(/[\r\n,;•–—]+/).map(i => String(i || '').trim()).filter(Boolean);
          if (splitItems.length > 1) return splitItems;
          const quotedItems = [...String(text).matchAll(/"([^"']+)"|'([^"']+)'/g)].map(m => m[1] || m[2]).filter(Boolean);
          if (quotedItems.length) return quotedItems;
          if (text.includes(' and ')) return text.split(/ and /i).map(i => String(i || '').trim()).filter(Boolean);
          return [text];
        };
        const parseStepArray = (raw) => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.map(i => String(i || '').trim()).filter(Boolean);
          let text = String(raw).trim();
          if (!text) return [];
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed.map(i => String(i || '').trim()).filter(Boolean);
            if (typeof parsed === 'string') text = parsed.trim();
          } catch (e) {}
          if (text.includes('\n')) return text.split(/\r?\n+/).map(i => String(i || '').trim()).filter(Boolean);
          const numbered = text.split(/\d+\.\s*/).map(i => String(i || '').trim()).filter(Boolean);
          if (numbered.length > 1) return numbered;
          const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).map(i => String(i || '').trim()).filter(Boolean);
          return sentences.length > 1 ? sentences : [text];
        };
        const normalizedRecipes = (recipes || []).map(r => {
          const parsedIngredients = parseIngredientArray(r.ingredients || r.ingredient_list || r.items || '');
          const parsedSteps = parseStepArray(r.steps || r.instructions || r.method || '');
          const cleanedIngredients = parsedIngredients.map(i => cleanIngredientLocally(i)).filter(Boolean);
          return {
            ...r,
            name: r.name || r.recipe_name || r.title || 'Untitled Recipe Formulation',
            meal_type: r.meal_type || r.category || r.type || 'General',
            ingredients: parsedIngredients,
            cleanedIngredients,
            steps: parsedSteps
          };
        }).filter((recipe) => {
          const joinedIngredients = (Array.isArray(recipe.cleanedIngredients) ? recipe.cleanedIngredients : []).join(' ').toLowerCase();
          return isVegetarianIngredient(joinedIngredients);
        });
        setMasterRecipes(normalizedRecipes);
        setRecipeCount(normalizedRecipes.length);
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
        alert("PROFILE CREATED SUCCESSFULLY!");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
      }
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleUpdateInlineItem = async (id, updatedRawValue) => {
    setFridge(prev => (prev || []).map(item => item.id === id ? { ...item, raw_name: updatedRawValue, item_name: cleanIngredientLocally(updatedRawValue) } : item));
    await supabase.from('fridge_inventory').update({ item_name: updatedRawValue }).eq('id', id); // Ensure DB column name matches
  };

  const handleAddShoppingItem = async (e, textOverride = '') => {
    if (e) e.preventDefault();
    const targetText = textOverride || shoppingInput;
    if (!targetText || !targetText.trim()) return;

    const resolvedTokenName = cleanIngredientLocally(targetText);
    if (!resolvedTokenName) return;

    // Prevent duplicates (case-insensitive) in local state first
    const alreadyLocal = (shoppingList || []).some(i => String(i.item_name || '').toLowerCase() === resolvedTokenName.toLowerCase());
    if (alreadyLocal) {
      alert('Item already in list');
      if (!textOverride) setShoppingInput('');
      return;
    }

    // Insert into Supabase
    const { data, error } = await supabase.from('shopping_list').insert([{
      user_id: user.id,
      item_name: resolvedTokenName,
      is_completed: false
    }]).select();

    if (!error && data) setShoppingList(prev => [...(prev || []), data[0]]);
    if (!textOverride) setShoppingInput('');
  };

  const handleToggleShoppingCompleted = async (id, status) => {
    setShoppingList(prev => (prev || []).map(item => item.id === id ? { ...item, is_completed: !status } : item));
    await supabase.from('shopping_list').update({ is_completed: !status }).eq('id', id);
  };

  const handleClearShoppingItem = async (id) => {
    setShoppingList(prev => (prev || []).filter(item => item.id !== id));
    await supabase.from('shopping_list').delete().eq('id', id);
  };

  const handleSaveRecipeToProfile = async (recipe) => {
    if ((savedRecipes || []).some(r => r.recipe_id === String(recipe.id))) return alert("Recipe already liked!");
    const { data, error } = await supabase.from('saved_recipes').insert([{
      user_id: user.id,
      recipe_id: String(recipe.id),
      recipe_name: recipe.name,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      meal_type: recipe.meal_type || 'General'
    }]).select();
    if (!error && data) setSavedRecipes(prev => [...(prev || []), data[0]]);
  };

  const handleRemoveSavedRecipe = async (id) => {
    setSavedRecipes(prev => (prev || []).filter(r => r.id !== id));
    await supabase.from('saved_recipes').delete().eq('id', id);
  };

  const handleDownloadRecipeImage = async () => {
    if (!snapshotCardRef.current) return;
    try {
      const original = snapshotCardRef.current;
      const clone = original.cloneNode(true);
      clone.style.backgroundColor = '#ffffff';
      clone.style.width = `${original.offsetWidth}px`;
      clone.style.minHeight = `${original.offsetHeight}px`;
      clone.style.display = 'block';
      clone.style.boxSizing = 'border-box';

      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.backgroundColor = '#ffffff';
      wrapper.style.overflow = 'visible';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.zIndex = '9999';
      wrapper.appendChild(clone);

      document.body.appendChild(wrapper);
      const blob = await domtoimage.toBlob(clone, {
        bgcolor: '#ffffff',
        cacheBust: true,
        width: clone.scrollWidth || original.offsetWidth,
        height: clone.scrollHeight || original.offsetHeight,
        style: {
          overflow: 'visible',
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: `${clone.scrollWidth || original.offsetWidth}px`,
          height: `${clone.scrollHeight || original.offsetHeight}px`,
          backgroundColor: '#ffffff'
        },
        quality: 1
      });
      document.body.removeChild(wrapper);
      if (!blob) throw new Error('Unable to render recipe card image');
      const filename = `${(activeModalRecipe.name || activeModalRecipe.recipeName || 'recipe-card').toLowerCase().replace(/\s+/g, '-')}.png`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    } catch (err) {
      console.error(err);
      try {
        const dataUri = await domtoimage.toPng(snapshotCardRef.current, { bgcolor: '#ffffff', quality: 1, style: { backgroundColor: '#ffffff' } });
        const fallbackLink = document.createElement('a');
        fallbackLink.href = dataUri;
        fallbackLink.download = `${(activeModalRecipe.name || activeModalRecipe.recipeName || 'recipe-card').toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        fallbackLink.remove();
      } catch (fallbackErr) {
        console.error('Fallback export also failed', fallbackErr);
      }
    }
  };

  const handleGenerateAiRecipe = async () => {
    const pantryItems = (fridge || []).map(f => cleanIngredientLocally(f.item_name)).filter(Boolean);
    if (pantryItems.length === 0) return alert("Your pantry is empty. Add a few ingredients to get a recipe suggestion.");
    setAiGenerating(true);
    try {
      const aiRecipe = await fetchCreativeRecipeFromAi(pantryItems);
      // Fix: Prioritize showing the actual AI generated recipe
      setActiveModalRecipe(aiRecipe);
      setActiveTab('recipes');
      setServingMultiplier(1);
    } catch (err) {
      console.error(err);
      // Fix: Fallback to local creative generation instead of just a database recipe
      const local = generateLocalCreativeRecipe(pantryItems);
      setActiveModalRecipe(local);
      setActiveTab('recipes');
      setServingMultiplier(1);
    } finally {
      setAiGenerating(false);
    }
  };

  const triggerStoreTripPlanner = () => {
    const pantryTokens = (fridge || []).map(f => f.item_name).filter(Boolean);
    const alerts = (processedRecipes || [])
      .filter(recipe => recipe.matchPercentage > 10 && recipe.matchPercentage < 100)
      .slice(0, 20)
      .map(recipe => {
        const missingItems = (recipe.cleanedIngredients || []).filter(ing => {
          return !pantryTokens.some(token => token && (ing.includes(token) || token.includes(ing)));
        }).slice(0, 5);
        return { recipe, missingItems, mealType: recipe.meal_type || 'General' };
      })
      .filter(alert => alert.missingItems.length > 0);

    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setFridge([]); setMasterRecipes([]); setActiveModalRecipe(null);
  };

  const handleRemoveItem = async (id) => {
    setFridge(prev => (prev || []).filter(item => item.id !== id));
    await supabase.from('fridge_inventory').delete().eq('id', id);
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

  const sendImageToBackend = async (base64Data) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.storeName) setStoreName(data.storeName);
        const rawItems = Array.isArray(data.added) ? data.added.map(item => item.trim()) : [];
        for (let rawItem of rawItems) {
          if (!rawItem.trim()) continue;
          const sanitizedToken = await resolveSanitizedTokenOnline(rawItem.trim());
          const backgroundParsedToken = sanitizedToken || cleanIngredientLocally(rawItem.trim());
          if (backgroundParsedToken) {
            await supabase.from('fridge_inventory').insert([{ item_name: backgroundParsedToken, user_id: user.id }]);
          }
        }
        await fetchAppData();
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;
    const input = manualItem.trim();
    setManualItem('');
    const backgroundParsedToken = cleanIngredientLocally(input);
    if (backgroundParsedToken) {
      await supabase.from('fridge_inventory').insert([{ item_name: backgroundParsedToken, user_id: user.id }]);
      await fetchAppData();
    }
  };

  const calculateMacroMetrics = (tokens) => {
    let p = 0, c = 0, f = 0;
    (tokens || []).forEach(item => {
      if (!item) return;
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea') || item.includes('bean')) { p += 9; c += 22; f += 1; }
      else { p += 4; c += 12; f += 2; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  };

  // 🛡️ SAFELY MEMOIZED SORT MATRIX DECK
  const processedRecipes = useMemo(() => {
    const pantryStrings = (fridge || []).map(f => cleanIngredientLocally(f.item_name || '')).filter(Boolean);
    const pantryTokens = new Set(pantryStrings.flatMap(normalizeIngredientTokens));
    const pantryPhrases = new Set(pantryStrings);

    const stopwords = new Set(['salt','water','pepper','oil','sugar','butter','egg','eggs','flour','onion','garlic','milk','cream','vinegar','soy','wheat','corn','bread']);

    const scoreIngredientMatch = (ingClean) => {
      if (!ingClean) return 0;
      const ingTokens = normalizeIngredientTokens(ingClean).filter((t) => !stopwords.has(t));
      if (pantryPhrases.has(ingClean)) return 1;
      if (ingTokens.some((token) => pantryTokens.has(token) && pantryTokens.has(token))) return 0.95;

      let bestScore = 0;
      pantryStrings.forEach((pantry) => {
        const pantryClean = cleanIngredientLocally(pantry);
        if (!pantryClean) return;
        const pantryTokensFromPhrase = normalizeIngredientTokens(pantryClean).filter((t) => !stopwords.has(t));
        if (pantryClean === ingClean || pantryClean.includes(ingClean) || ingClean.includes(pantryClean)) {
          bestScore = 1;
          return;
        }
        const overlap = ingTokens.filter((token) => pantryTokensFromPhrase.includes(token)).length;
        if (overlap >= 2) bestScore = Math.max(bestScore, 0.9);
        else if (overlap === 1) bestScore = Math.max(bestScore, 0.65);
      });

      return bestScore;
    };

    const scored = (masterRecipes || []).map(recipe => {
      const cleanedIngredients = (recipe.cleanedIngredients || []).filter(Boolean);
      const totalIngredients = cleanedIngredients.length || 1;

      const ingredientMatches = cleanedIngredients.map((ing) => {
        const matchScore = scoreIngredientMatch(cleanIngredientLocally(ing));
        return {
          raw: ing,
          cleaned: cleanIngredientLocally(ing),
          score: matchScore,
          exact: matchScore >= 0.95
        };
      });

      const ownedCount = ingredientMatches.filter((match) => match.score > 0).length;
      const exactMatchCount = ingredientMatches.filter((match) => match.exact).length;
      const totalScore = ingredientMatches.reduce((sum, match) => sum + match.score, 0);
      const matchPercentage = Math.round((totalScore / totalIngredients) * 100);
      const missingCount = totalIngredients - ownedCount;
      const scoreVariance = totalScore * 100 - missingCount * 8;

      const steps = getStaticRecipeSteps({ ...recipe, cleanedIngredients });

      return {
        ...recipe,
        cleanedIngredients,
        matchPercentage,
        scoreVariance,
        ownedCount,
        exactMatchCount,
        totalCount: totalIngredients,
        missingCount,
        totalScore,
        steps
      };
    });

    const filteredBySearch = scored.filter((recipe) => {
      if (!recipeSearch) return true;
      const search = recipeSearch.toLowerCase();
      return (recipe.name && recipe.name.toLowerCase().includes(search)) || (recipe.cleanedIngredients || []).some((ing) => ing.toLowerCase().includes(search));
    });

    const filteredByCategory = filteredBySearch.filter((recipe) => matchesRecipeFilter(recipe, activeRecipeFilter));

    return filteredByCategory.sort((a, b) => {
      if (b.matchPercentage !== a.matchPercentage) return b.matchPercentage - a.matchPercentage;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.exactMatchCount !== a.exactMatchCount) return b.exactMatchCount - a.exactMatchCount;
      if (b.ownedCount !== a.ownedCount) return b.ownedCount - a.ownedCount;
      return a.totalCount - b.totalCount;
    });
  }, [fridge, masterRecipes, recipeSearch, activeRecipeFilter]);

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-50 text-slate-900 font-sans font-black tracking-tight antialiased flex items-center justify-center p-6 select-none uppercase">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 to-indigo-600"></div>
          <h2 className="text-4xl font-black uppercase tracking-tighter bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-sans">SmartFridge AI</h2>
          
          {isForgotPasswordView ? (
            <form onSubmit={async (e) => { e.preventDefault(); try { await supabase.auth.resetPasswordForEmail(authEmail); alert('Password reset link sent to your email!'); setIsForgotPasswordView(false); setAuthEmail(''); } catch (err) { alert(err.message); } }} className="space-y-4 mt-6 font-sans">
              <p className="text-xs text-slate-400 mb-4">Enter your email to receive a password reset link.</p>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Email Address" />
              <button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-sky-100">{authLoading ? "Sending..." : "Send Reset Link"}</button>
              <button type="button" onClick={() => { setIsForgotPasswordView(false); setAuthEmail(''); }} className="w-full bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Back to Sign In</button>
            </form>
          ) : isSignUp ? (
            <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6 font-sans">
              <p className="text-xs text-slate-400 mb-2">Create a new account</p>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Email Address" />
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Password" />
              <button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-sky-100">{authLoading ? "Creating..." : "Create Account"}</button>
              <button type="button" onClick={() => { setIsSignUp(false); setAuthEmail(''); setAuthPassword(''); }} className="w-full bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Back to Sign In</button>
            </form>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6 font-sans">
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Email Address" />
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Password" />
              <button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-sky-100">{authLoading ? "Verifying..." : "Sign In"}</button>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setIsSignUp(true); setAuthEmail(''); setAuthPassword(''); }} className="flex-1 bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Create Account</button>
                <button type="button" onClick={() => { setIsForgotPasswordView(true); setAuthPassword(''); }} className="flex-1 bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Forgot Password</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50/50 text-slate-800 font-sans font-semibold tracking-tight antialiased pb-12 selection:bg-sky-500 selection:text-white w-full overflow-x-hidden uppercase">
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 w-full shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold uppercase tracking-tighter bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">SmartFridge AI</h1>
          <p className="text-slate-500 text-[12px] normal-case mt-0.5">Signed in as <span className="text-sky-600 font-bold">{user.email}</span></p>
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 w-full md:w-auto">
          {storeName && storeName !== 'General Grocery' && (
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2 border border-blue-100 bg-white/50 rounded-full">Scanned store: {storeName}</div>
          )}
          <button onClick={handleGenerateAiRecipe} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold text-[11px] px-5 py-2.5 uppercase tracking-widest rounded-md">Cook Something</button>
          <button onClick={triggerStoreTripPlanner} className="bg-white hover:bg-blue-50 text-slate-600 font-semibold text-[11px] px-5 py-2.5 uppercase tracking-widest border border-blue-100 rounded-md transition-colors">Shopping Helper</button>
          <button onClick={handleSignOut} className="bg-transparent hover:bg-red-50 text-red-500 font-semibold text-[11px] px-4 py-2.5 uppercase tracking-widest rounded-md transition-colors">Sign Out</button>
        </div>
      </header>

      <main className="w-full flex justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-4xl">
        {/* Debug preview removed */}

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {['recipes','pantry','saved'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`text-[10px] uppercase tracking-widest px-6 py-2.5 border rounded-full font-black transition-all ${activeTab === tab ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200' : 'bg-white border-blue-100 text-slate-400 hover:border-sky-300 hover:text-sky-500'}`}>
              {tab === 'recipes' ? 'Recipes' : tab === 'pantry' ? 'Pantry' : 'Saved Recipes'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mx-auto">
          <div className={`${activeTab === 'pantry' ? 'space-y-6 lg:col-span-1' : 'hidden'}`}>
            <div className="bg-white/80 backdrop-blur-lg p-6 border border-white/20 rounded-[2rem] shadow-xl shadow-blue-900/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">📸 Receipt Intake Scanner</h2>
            <div className="relative border-2 border-dashed border-blue-100 hover:border-sky-400 p-8 text-center bg-blue-50/30 rounded-3xl cursor-pointer transition-colors group">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-sky-600">Upload Grocery Receipt</p>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-5 mt-5 border-t border-blue-50">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Add an item to your pantry..." className="flex-1 bg-white border border-blue-100 px-4 py-3 rounded-xl text-xs font-semibold text-slate-800 uppercase focus:border-sky-400 focus:outline-none transition-all" />
              <button type="submit" className="bg-sky-500 text-white text-xs font-black px-6 uppercase tracking-wider rounded-xl shadow-lg shadow-sky-100">Add</button>
            </form>
          </div>

          <div className="bg-white/80 backdrop-blur-lg p-6 border border-white/20 rounded-[2rem] shadow-xl shadow-blue-900/5">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center mb-4"><span>🏡 Storage Pantry Stock</span><span className="bg-blue-50 text-sky-600 border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black font-mono">{fridge ? fridge.length : 0}</span></h2>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {!fridge || fridge.length === 0 ? <p className="text-xs text-slate-500 font-black uppercase tracking-wider italic py-4">Your fridge looks empty — add some items to get recipe matches.</p> : fridge.map((item) => (
                <div key={item.id} className="bg-white border border-blue-50 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-1 min-w-0">
                    <input type="text" value={item.raw_name || ''} onChange={(e) => handleUpdateInlineItem(item.id, e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-800 uppercase border-b border-transparent hover:border-blue-100 focus:border-sky-400 focus:outline-none pb-0.5" />
                    <div className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest mt-0.5 normal-case">Sanitized: <span className="text-sky-500 font-bold">{item.item_name || 'Empty'}</span></div>
                  </div>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-red-400 font-mono text-base font-black px-2 transition-colors">×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-lg p-6 border border-white/20 rounded-[2rem] shadow-xl shadow-blue-900/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">📝 Profile Shopping List</h2>
            <form onSubmit={(e) => handleAddShoppingItem(e, '')} className="flex gap-2 mb-4">
              <input type="text" value={shoppingInput} onChange={(e) => setShoppingInput(e.target.value)} placeholder="Type target shopping items..." className="flex-1 bg-white border border-blue-100 px-4 py-3 rounded-xl text-xs font-semibold text-slate-800 uppercase focus:border-sky-400 focus:outline-none" />
              <button type="submit" className="bg-sky-500 text-white text-xs font-semibold px-5 rounded-xl shadow-lg shadow-sky-100">+</button>
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {!shoppingList || shoppingList.length === 0 ? <p className="text-xs text-slate-500 font-black uppercase tracking-wider italic py-2">No shopping items yet. Add things you need next time.</p> : shoppingList.map((item) => (
                <div key={item.id} className="bg-white border border-blue-50 p-3 rounded-2xl flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={item.is_completed || false} onChange={() => handleToggleShoppingCompleted(item.id, item.is_completed)} className="accent-sky-500 h-4 w-4 rounded-md cursor-pointer" />
                    <span className={`text-xs font-bold uppercase tracking-tight truncate text-slate-700 ${item.is_completed ? 'line-through text-slate-300' : ''}`}>{item.item_name}</span>
                  </div>
                  <button onClick={() => handleClearShoppingItem(item.id)} className="text-slate-300 hover:text-red-400 font-mono text-xs font-bold px-1 transition-colors">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${activeTab === 'recipes' ? 'lg:col-span-2 space-y-6' : 'hidden'}`}>
          <div className="bg-white/80 backdrop-blur-lg p-6 border border-white/20 rounded-[2rem] shadow-xl shadow-blue-900/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">⚡ Best recipe matches</h2>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider mt-0.5">Top recipes based on your ingredients</p>
              </div>
              <div className="w-full sm:w-auto flex flex-col gap-3">
                <input type="text" placeholder="Search recipes..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-800 uppercase tracking-wide focus:border-sky-400 focus:outline-none transition-all" />
                <div className="flex flex-wrap gap-2">
                  {['all','vegetarian','vegan','breakfast','lunch','dinner','snack','dessert','meat','fish','egg'].map((filter) => (
                    <button key={filter} onClick={() => setActiveRecipeFilter(filter)} className={`text-[9px] uppercase tracking-widest px-3 py-1.5 border rounded-full font-black transition-all ${activeRecipeFilter === filter ? 'bg-sky-500 border-sky-500 text-white shadow-md' : 'bg-white border-blue-50 text-slate-400 hover:border-sky-200 hover:text-sky-500'}`}>
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-2">
              {processedRecipes.slice(0, 20).map((recipe) => (
                <div key={recipe.id || recipe.name} className="bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-3xl fade-in-up cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-sky-900/10 flex flex-col justify-between shadow-lg shadow-blue-900/5 group">
                  <div onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }}>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold uppercase tracking-tight text-slate-700 group-hover:text-sky-600 text-xs line-clamp-2 leading-tight transition-colors">{recipe.name}</h3>
                      <span className="text-[10px] font-mono font-black shrink-0 px-2.5 py-1 bg-sky-50 border border-sky-100 text-sky-600 rounded-full">{recipe.matchPercentage}% MATCH</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 bg-blue-50/50 border border-blue-100 px-2 py-1 mt-3 inline-block uppercase font-black tracking-widest rounded-md">{recipe.meal_type || 'General'}</span>
                  </div>
                  <div className="flex justify-between items-center mt-5 pt-3 border-t border-blue-50">
                      <div className="w-2/3 bg-blue-50 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 rounded-full transition-all duration-500" style={{ width: `${recipe.matchPercentage}%` }}></div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleSaveRecipeToProfile(recipe); }} className="text-[10px] uppercase font-black text-sky-500 hover:text-sky-400 tracking-widest transition-colors">⭐ Like</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${activeTab === 'saved' ? 'lg:col-span-2 space-y-6' : 'hidden'}`}>
          {savedRecipes && savedRecipes.length > 0 ? (
            <div className="bg-white/80 backdrop-blur-lg p-6 border border-white/20 rounded-[2rem] shadow-xl shadow-blue-900/5">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">⭐ Saved Liked Recipes ({savedRecipes.length})</h2>
              <div className="flex flex-wrap gap-2">
                {savedRecipes.map((recipe) => (
                  <div key={recipe.id} className="bg-white border border-blue-100 px-5 py-3 rounded-2xl flex items-center gap-4 shadow-sm hover:border-sky-400 transition-colors">
                    <span onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }} className="text-xs font-bold uppercase text-slate-700 cursor-pointer hover:text-sky-600 tracking-tight transition-colors">{recipe.recipe_name || recipe.name}</span>
                    <button onClick={() => handleRemoveSavedRecipe(recipe.id)} className="text-slate-300 hover:text-red-400 font-mono text-sm font-black transition-colors">×</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-lg p-6 border border-white/20 rounded-[2rem] shadow-xl shadow-blue-900/5">
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest py-4">You haven't saved any recipes yet.</p>
            </div>
          )}
        </div>
      </div>
      </div>
      </main>

      {activeModalRecipe && (
        <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-2xl">
            <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[3rem] shadow-2xl border border-white/50 relative max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-blue-50 pb-5 mb-6">
              <div>
                <span className="bg-sky-50 text-sky-600 font-mono text-[9px] px-3 py-1 rounded-full uppercase font-black tracking-widest border border-sky-100">{activeModalRecipe.meal_type}</span>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mt-2">{activeModalRecipe.name || activeModalRecipe.recipeName}</h3>
              </div>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button onClick={handleDownloadRecipeImage} className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold px-4 py-2.5 uppercase tracking-widest rounded-md shadow-md">📸 Save Card</button>
                <button onClick={() => { setActiveModalRecipe(null); setServingMultiplier(1); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-5 py-2.5 uppercase rounded-xl transition-colors">Close</button>
              </div>
            </div>
            
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl mb-8 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">👥 Adjust Servings Yield Index:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button key={num} onClick={() => setServingMultiplier(num)} className={`w-10 h-10 font-mono text-xs font-black rounded-xl transition-all ${servingMultiplier === num ? 'bg-sky-500 text-white shadow-lg shadow-sky-100' : 'bg-white border border-blue-100 text-slate-400 hover:bg-sky-50'}`}>{num}x</button>
                ))}
              </div>
            </div>

            <div className="p-2 bg-transparent">
              <div ref={snapshotCardRef} className="bg-white p-8 space-y-8 text-slate-900 rounded-3xl shadow-sm border border-blue-50">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-slate-900 uppercase tracking-tight">{activeModalRecipe.name || activeModalRecipe.recipeName}</h2>
                  <p className="text-[12px] text-slate-500 mt-1">Serving Index {servingMultiplier}x • {activeModalRecipe.meal_type || 'General'}</p>
                </div>

                {/* Optional image */}
                {(activeModalRecipe.image || activeModalRecipe.thumbnail || activeModalRecipe.strMealThumb) && (
                  <div className="w-full h-48 rounded-lg overflow-hidden">
                    <img src={activeModalRecipe.image || activeModalRecipe.thumbnail || activeModalRecipe.strMealThumb} alt={activeModalRecipe.name} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50/30 border border-blue-50 p-5 rounded-2xl">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-blue-100 pb-2 mb-4">📋 Component Specifications</h4>
                    <ul className="space-y-3">
                      {(activeModalRecipe.ingredients || []).map((ing, idx) => {
                        const cleanIng = cleanIngredientLocally(ing);
                        const isOwned = (fridge || []).map(f => f.item_name).filter(Boolean).some(token => cleanIng.includes(token) || token.includes(cleanIng));
                        return (
                          <li key={idx} className="text-xs font-bold text-slate-800 capitalize flex flex-col border-b border-blue-50 pb-2 last:border-0">
                            <span className="text-[10px] font-mono text-sky-600 font-black tracking-wide uppercase">
                              {parseRecipeIngredientMeasurements(ing, servingMultiplier)}
                            </span>
                            <div className="flex justify-between items-center gap-1 mt-1">
                              <span className={isOwned ? 'text-slate-900' : 'text-slate-400 font-semibold'}>{ing}</span>
                              {!isOwned && (
                                <button data-html2canvas-ignore="true" onClick={() => handleAddShoppingItem(null, cleanIngredientLocally(ing))} className="text-[8px] bg-sky-50 hover:bg-sky-100 text-sky-700 px-2 py-0.5 font-black uppercase rounded transition-colors shrink-0">
                                  + Buy
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-blue-50 pb-2 mb-4">🔥 Preparation Progression Matrix</h4>
                    <ol className="space-y-4">
                      {getStaticRecipeSteps(activeModalRecipe).map((step, idx) => (
                        <li key={idx} className="bg-blue-50/20 border border-blue-50 p-4 rounded-2xl text-sm text-slate-700 flex gap-4 leading-relaxed items-start hover:bg-blue-50 transition-colors">
                          <span className="font-mono font-black text-white bg-sky-500 w-7 h-7 flex items-center justify-center rounded-lg shadow-lg shadow-sky-100 shrink-0">{idx + 1}</span>
                          <p className="pt-0.5">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-white/90 backdrop-blur-2xl border border-white/50 w-full max-w-xl rounded-[3rem] p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-blue-50 pb-5 mb-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🔮 Market Procurement Matrix</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black px-4 py-2 uppercase tracking-widest rounded-full transition-colors">Dismiss</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.length === 0 ? (
                <p className="text-xs text-slate-500 font-black uppercase tracking-wider italic py-6 text-center">No missing grocery gaps detected right now.</p>
              ) : (
                shoppingAlerts.slice(0, 15).map((alert, i) => (
                  <div key={i} onClick={() => { setIsStoreAlertOpen(false); setServingMultiplier(1); setActiveModalRecipe(alert.recipe); }} className="p-5 bg-white border border-blue-50 hover:border-sky-400 rounded-3xl cursor-pointer transition-all shadow-sm hover:shadow-md group">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-700 text-xs group-hover:text-sky-600 uppercase tracking-tight transition-colors">{alert.recipe.name}</h4>
                      <span className="text-[8px] font-mono text-sky-500 bg-sky-50 border border-sky-100 px-2 py-1 rounded-full uppercase font-black tracking-widest">{alert.mealType}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-3">Missing items: <span className="text-sky-500 font-mono text-[10px] capitalize font-black ml-1">{alert.missingItems.join(', ')}</span></p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
