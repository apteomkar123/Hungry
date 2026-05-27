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
    const cuisine = params.cuisine || 'indian,chinese,mexican,japanese,korean,jamaican,african,mediterranean,latin american';
    const number = Math.min(parseInt(params.number || '80', 10), 100);
    const ingredients = params.ingredients || '';

    const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('number', String(number));
    url.searchParams.set('addRecipeInformation', 'true');
    url.searchParams.set('fillIngredients', 'true');
    url.searchParams.set('instructionsRequired', 'true');

    if (ingredients) {
      url.searchParams.set('includeIngredients', ingredients);
    } else {
      url.searchParams.set('cuisine', cuisine);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      console.error('Spoonacular error:', res.status, errText);
      return { statusCode: 200, headers, body: JSON.stringify({ recipes: [] }) };
    }

    const data = await res.json();
    const results = (data.results || []).map(r => {
      const ingredients = (r.extendedIngredients || []).map(ing => ing.original || ing.name || '');
      const steps = (r.analyzedInstructions || [])
        .flatMap(block => block.steps || [])
        .map(s => s.step || '')
        .filter(Boolean);

      return {
        id: `spoon-${r.id}`,
        name: r.title || '',
        meal_type: (r.dishTypes && r.dishTypes[0]) || 'General',
        cuisine: (r.cuisines && r.cuisines[0]) || '',
        ingredients,
        steps: steps.length > 0 ? steps : ['Follow the ingredient list to prepare this dish.'],
        image: r.image || ''
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify({ recipes: results }) };
  } catch (err) {
    console.error('get-recipes error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ recipes: [] }) };
  }
};
