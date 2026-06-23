const fs = require('fs');
let content = fs.readFileSync('src/components/recipeUtils.js', 'utf8');

const start = content.indexOf('export const cleanIngredientLocally');
const end = content.indexOf('\nexport const normalizeIngredientTokens');

const newFn = `export const cleanIngredientLocally = (rawName) => {
  if (!rawName) return '';
  let name = String(rawName).toLowerCase().trim();
  name = name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  name = name.replace(/[\\u2013\\u2014•]/g, ' ');
  // Strip leading measurement + count patterns before digit removal
  name = name.replace(/^[\\d\\/\\.\\s\\-½⅓¼¾⅛]+(?:cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|g|kg|lb|lbs|mls?|l|pieces?|cloves?|heads?|bunches?|sprigs?|stalks?|cans?|jars?|bags?|pinch(?:es)?|dash(?:es)?|handful|handfuls?)?\\s*/i, '');
  name = name.replace(/\\d+/g, ' ');
  // Measurement & packaging words
  name = name.replace(/\\b(?:organic|fresh|freshly|large|small|medium|extra|reduced fat|low fat|low-sodium|low sodium|unsalted|sliced|diced|chopped|shredded|minced|ground|boneless|skinless|prepared|peeled|packaged|package|pack|can|canned|jar|bottle|tube|stick|slice|pieces|piece|cups?|tablespoons?|tbsps?|teaspoons?|tsps?|grams?|g|kg|pounds?|lb|lbs|oz|ounces?|fluid|fl oz|mls?|ltrs?|liters?|litres?|pkg|ct|count)\\b/g, ' ');
  // Cooking-method and descriptor words that should not be part of an ingredient name
  name = name.replace(/\\b(?:finely|thinly|roughly|coarsely|lightly|gently|well|very|about|approximately|plus|more|divided|separated|halved|quartered|crushed|torn|grated|zested|squeezed|pressed|toasted|roasted|cooked|boiled|fried|baked|grilled|steamed|melted|softened|to taste|as needed|if desired|optional|heaping|level|packed|sifted|beaten|whisked|strained|drained|rinsed)\\b/g, ' ');
  // cloves used as a unit before another word (e.g. "cloves garlic" -> "garlic")
  name = name.replace(/\\bcloves?\\s+(?=\\w)/g, '');
  // Strip any leading unit words that may remain after digit removal
  name = name.replace(/^(?:tbsps?|tsps?|tablespoons?|teaspoons?|cups?|oz|ounces?|g|kg|lb|lbs|mls?|fl|cloves?|heads?|bunches?|sprigs?|pinch(?:es)?)\\s+/, '');
  name = name.replace(/[^a-z0-9\\s]/g, ' ');
  name = name.replace(/\\s+/g, ' ').trim();
  return name;
};`;

content = content.slice(0, start) + newFn + content.slice(end);
fs.writeFileSync('src/components/recipeUtils.js', content, 'utf8');
console.log('OK');
