import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <-- Add this exact line to inject your styles!
import { UserProvider } from './components/UserContext';

// Migrate old localStorage keys from Hungry→Pantry rename (one-time, preserves existing data)
;[
  ['hungry_cat_overrides', 'pantry_cat_overrides'],
  ['hungry_quantities',    'pantry_quantities'],
  ['hungry_pantry_v1',     'pantry_pantry_v1'],
  ['hungry_shopping_v1',   'pantry_shopping_v1'],
  ['hungry_chef_history',  'pantry_chef_history'],
  ['hungry_default_shopping_dest', 'pantry_default_shopping_dest'],
].forEach(([oldKey, newKey]) => {
  const old = localStorage.getItem(oldKey);
  if (old !== null && localStorage.getItem(newKey) === null) {
    localStorage.setItem(newKey, old);
    localStorage.removeItem(oldKey);
  }
});

// Preserve ?recipe= param before any auth redirect can modify the URL
const _rl = new URLSearchParams(window.location.search).get('recipe');
if (_rl) sessionStorage.setItem('_pendingRecipeId', _rl);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>,
)