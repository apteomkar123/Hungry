const CUISINES = [
  'indian', 'chinese', 'mexican', 'japanese', 'korean',
  'jamaican', 'greek', 'italian', 'moroccan', 'spanish',
  'turkish', 'thai', 'french', 'vietnamese', 'american', 'british'
];

const EDAMAM_QUERIES = [
  'chicken', 'pasta', 'beef', 'vegetarian', 'fish', 'salad',
  'soup', 'breakfast', 'dessert', 'curry', 'stir fry', 'tacos',
  'pizza', 'noodles', 'rice', 'shrimp', 'lamb', 'tofu',
  'burger', 'sandwich', 'steak', 'salmon', 'lentils', 'beans'
];

const formatEdamamRecipe = (hit) => {
  const r = hit.recipe;
  const id = 'edamam-' + (r.uri || '').split('#recipe_')[1];
  const cuisineTypes = (r.cuisineType || []).join(' ') || 'international';
  const mealTypes = [...(r.mealType || []), ...(r.dishType || []), ...(r.dietLabels || [])];
  return {
    id,
    name: r.label || '',
    meal_type: mealTypes.join(' ') || 'General',
    cuisine: cuisineTypes,
    ingredients: r.ingredientLines || [],
    steps: r.url
      ? [`For step-by-step instructions, visit the original recipe: ${r.url}`]
      : ['Prepare ingredients according to the list above.'],
    image: r.image || '',
    source_url: r.url || ''
  };
};

const formatRecipe = (r, sourceCuisine) => {
  const ingredients = (r.extendedIngredients || []).map(ing => ing.original || ing.name || '');
  const steps = (r.analyzedInstructions || [])
    .flatMap(block => block.steps || [])
    .map(s => s.step || '')
    .filter(Boolean);
  const cuisines = (r.cuisines || []).join(' ').toLowerCase() || sourceCuisine;
  return {
    id: `spoon-${r.id}`,
    name: r.title || '',
    meal_type: [...(r.dishTypes || []), ...(r.diets || [])].join(' ') || 'General',
    cuisine: cuisines,
    ingredients,
    steps: steps.length > 0 ? steps : ['Follow the ingredient list to prepare this dish.'],
    image: r.image || ''
  };
};

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiKey = (process.env.SPOONACULAR_API_KEY || '').trim();
  const edamamId = (process.env.EDAMAM_APP_ID || '').trim();
  const edamamKey = (process.env.EDAMAM_APP_KEY || '').trim();
  if (!apiKey && (!edamamId || !edamamKey)) {
    return { statusCode: 200, headers, body: JSON.stringify({ recipes: [] }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const requestedCuisine = params.cuisine;

    // Single cuisine request (used for lazy loading per-cuisine)
    if (requestedCuisine) {
      const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
      url.searchParams.set('apiKey', apiKey);
      url.searchParams.set('cuisine', requestedCuisine);
      url.searchParams.set('number', '50');
      url.searchParams.set('addRecipeInformation', 'true');
      url.searchParams.set('fillIngredients', 'true');
      url.searchParams.set('instructionsRequired', 'true');

      const res = await fetch(url.toString());
      if (!res.ok) return { statusCode: 200, headers, body: JSON.stringify({ recipes: [] }) };
      const data = await res.json();
      const recipes = (data.results || []).map(r => formatRecipe(r, requestedCuisine));
      return { statusCode: 200, headers, body: JSON.stringify({ recipes }) };
    }

    // Default: fetch all cuisines in parallel, 50 each (Spoonacular)
    const allRecipes = apiKey ? (await Promise.all(
      CUISINES.map(async (cuisine) => {
        try {
          const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
          url.searchParams.set('apiKey', apiKey);
          url.searchParams.set('cuisine', cuisine);
          url.searchParams.set('number', '50');
          url.searchParams.set('addRecipeInformation', 'true');
          url.searchParams.set('fillIngredients', 'true');
          url.searchParams.set('instructionsRequired', 'true');

          const res = await fetch(url.toString());
          if (!res.ok) return [];
          const data = await res.json();
          return (data.results || []).map(r => formatRecipe(r, cuisine));
        } catch { return []; }
      })
    )).flat() : [];

    // Fetch Edamam recipes in parallel across queries
    let edamamRecipes = [];
    if (edamamId && edamamKey) {
      const edamamBatches = await Promise.all(
        EDAMAM_QUERIES.map(async (q) => {
          try {
            const url = new URL('https://api.edamam.com/api/recipes/v2');
            url.searchParams.set('type', 'public');
            url.searchParams.set('app_id', edamamId);
            url.searchParams.set('app_key', edamamKey);
            url.searchParams.set('q', q);
            for (const f of ['label', 'cuisineType', 'mealType', 'dishType', 'dietLabels', 'ingredientLines', 'image', 'url', 'uri']) {
              url.searchParams.append('field', f);
            }
            const res = await fetch(url.toString());
            if (!res.ok) return [];
            const data = await res.json();
            return (data.hits || []).map(formatEdamamRecipe).filter(r => r.id && r.name);
          } catch { return []; }
        })
      );
      edamamRecipes = edamamBatches.flat();
    }

    // Deduplicate all recipes by ID
    const seen = new Set();
    const unique = [...allRecipes, ...edamamRecipes].filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return { statusCode: 200, headers, body: JSON.stringify({ recipes: unique }) };
  } catch (err) {
    console.error('get-recipes error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ recipes: [] }) };
  }
};
