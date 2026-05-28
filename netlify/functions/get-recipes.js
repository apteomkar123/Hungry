const CUISINES = [
  'indian', 'chinese', 'mexican', 'japanese', 'korean',
  'jamaican', 'greek', 'italian', 'moroccan', 'spanish',
  'turkish', 'thai', 'french', 'vietnamese', 'american', 'british'
];

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
  if (!apiKey) {
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

    // Default: fetch all cuisines in parallel, 50 each
    const batches = await Promise.all(
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
    );

    const allRecipes = batches.flat();
    // Deduplicate by Spoonacular ID
    const seen = new Set();
    const unique = allRecipes.filter(r => {
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
