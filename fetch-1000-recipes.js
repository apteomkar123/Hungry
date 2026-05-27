// fetch-1000-recipes.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://hlyiihiztwgtktqfkxkb.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseWlpaGl6dHdndGt0cWZreGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDI2MTMsImV4cCI6MjA5NTIxODYxM30.IzqAuhMUksmcvw60wMSwbKDapW8t4YLMrNT_DHD9eqw";
const supabase = createClient(supabaseUrl, supabaseKey);

const THEMEALDB_API = 'https://www.themealdb.com/api/json/v1/1';
const BATCH_SIZE = 50;

function parseRecipeFromMealDB(meal) {
  if (!meal) return null;
  
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredientKey = `strIngredient${i}`;
    const measureKey = `strMeasure${i}`;
    const ingredient = meal[ingredientKey];
    if (ingredient && ingredient.trim()) {
      const measure = meal[measureKey] ? meal[measureKey].trim() : '';
      ingredients.push(`${measure} ${ingredient}`.trim());
    }
  }

  const instructions = meal.strInstructions || '';
  const steps = instructions
    .split(/\.\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  return {
    name: meal.strMeal || 'Untitled Recipe',
    ingredients: ingredients.length > 0 ? ingredients : ['See instructions'],
    meal_type: meal.strCategory || 'General'
  };
}

async function fetchRecipesFromMealDB() {
  console.log('🔍 Fetching recipes from TheMealDB...');
  const recipes = [];
  const seen = new Set();

  // Fetch by first letter (a-z)
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(97 + i);
    try {
      const response = await fetch(`${THEMEALDB_API}/search.php?f=${letter}`);
      const data = await response.json();
      if (data.meals && Array.isArray(data.meals)) {
        data.meals.forEach(meal => {
          if (!seen.has(meal.idMeal)) {
            const parsed = parseRecipeFromMealDB(meal);
            if (parsed) {
              recipes.push(parsed);
              seen.add(meal.idMeal);
            }
          }
        });
      }
      console.log(`✓ Letter '${letter}': fetched ${data.meals ? data.meals.length : 0} recipes (total: ${recipes.length})`);
    } catch (err) {
      console.error(`❌ Error fetching recipes for letter '${letter}':`, err.message);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Fetch by category to get more diversity
  const categories = ['Seafood', 'Pasta', 'Breakfast', 'Vegetarian', 'Dessert', 'Chicken', 'Beef'];
  for (const category of categories) {
    if (recipes.length >= 1000) break;
    try {
      const response = await fetch(`${THEMEALDB_API}/filter.php?c=${category}`);
      const data = await response.json();
      if (data.meals && Array.isArray(data.meals)) {
        for (const meal of data.meals) {
          if (recipes.length >= 1000) break;
          if (!seen.has(meal.idMeal)) {
            const detailResponse = await fetch(`${THEMEALDB_API}/lookup.php?i=${meal.idMeal}`);
            const detailData = await detailResponse.json();
            if (detailData.meals && detailData.meals[0]) {
              const parsed = parseRecipeFromMealDB(detailData.meals[0]);
              if (parsed) {
                recipes.push(parsed);
                seen.add(meal.idMeal);
              }
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log(`✓ Category '${category}': total recipes now ${recipes.length}`);
    } catch (err) {
      console.error(`❌ Error fetching category '${category}':`, err.message);
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return recipes.slice(0, 1000);
}

async function insertRecipesInBatches(recipes) {
  console.log(`\n📦 Inserting ${recipes.length} recipes into Supabase in batches of ${BATCH_SIZE}...`);
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await supabase.from('recipes').insert(batch);
      if (error) {
        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
        failed += batch.length;
      } else {
        inserted += batch.length;
        console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} recipes (total: ${inserted})`);
      }
    } catch (err) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} exception:`, err.message);
      failed += batch.length;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { inserted, failed };
}

async function main() {
  try {
    console.log('🚀 Starting 1000 recipes fetch from TheMealDB...\n');
    const recipes = await fetchRecipesFromMealDB();
    console.log(`\n✅ Fetched ${recipes.length} unique recipes from TheMealDB`);

    const { inserted, failed } = await insertRecipesInBatches(recipes);
    console.log(`\n🎉 Insert complete! Inserted: ${inserted}, Failed: ${failed}`);
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

main();
