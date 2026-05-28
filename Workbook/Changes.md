BUGS TO FIX. 
-------------
The voice input is understanding the quantities, but isn't adding them to the ingredient when the ingredients get stored in the pantry.

Algorithm isn't able to figure out when items are fruits, I just added bananas and apples and they got added to the general category.

In some recipes, multiple ingredients are getting grouped as one. Not in all recipes, but some, especially the indian ones. even then, its only some of the indian ones.



FEATURES TO ADD:
-------------------
Make a separte page/section for Chef History so that there's less clutter.
Add the "Cooked" button at the very bottom of the recipe card, so the recipe card doesn't get wider than can be handled on a screen. The cooking mode button is getting pushed to the right right now and you have to scroll to it inside the card.

-------------------------------------------




-------------------------------------------

IMPLEMENTED (session 2026-05-28):
- Voice quantities now persist to localStorage (hungry_quantities) -- temp ID migrated to real DB ID on save
- Category regexes updated to match plural forms (bananas, apples, tomatoes, onions, etc.)
- Ingredient grouping fixed -- entries containing newlines or comma+number patterns are split into separate items; MealDB cache bumped to v5
- Chef History moved to its own dedicated tab (Clock icon in bottom nav)
- Mark Cooked button moved to its own full-width row at bottom of recipe card
